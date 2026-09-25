/* Workfloh PDF — PDFs übersetzen (Deutsch · Русский · English), seitenweise.
   Ablauf je Seite: Textebene lesen (pdf.js getTextContent) → zu Absätzen
   zusammenfassen → übersetzen → gespeichert. Am Ende entsteht ein NEUES PDF:
   das Original als Hintergrund, jeder Absatz weiß abgedeckt, die Übersetzung
   in dieselbe Lage gesetzt. Das Original bleibt unberührt.

   Übersetzer (austauschbar, gleiche Form: async texte[] → texte[]):
     browser — der Übersetzer im Browser (Translator), läuft auf dem Gerät
     ki      — eigener Schlüssel (Mistral EU · Anthropic · OpenAI), nur nach Bestätigung
   Gescannte Seiten haben keine Textebene: dort erkennt Tesseract.js (auf dem
   Gerät) den Text samt Lage. Abgedeckt wird in der Hintergrundfarbe der Stelle,
   geschrieben in der Textfarbe des Originals.

   Kyrillisch: die Standardschriften von pdf-lib können es nicht. Eingebettet
   wird Noto Sans (OFL 1.1) über @pdf-lib/fontkit (MIT), als Teilmenge.

   Diese Datei ist host-neutral und wird byte-gleich nach Mein-WorkFloh und
   Tomys-Hub/workfloh kopiert (assets/wfpdf/). Dort NIE abwandeln. */
(function () {
  'use strict';

  const SPRACHEN = { de: 'Deutsch', ru: 'Русский', en: 'English' };
  const NAME_DE = { de: 'Deutsch', ru: 'Russisch', en: 'Englisch' };
  const KI_TEXTMODELL = { mistral: 'mistral-small-latest', anthropic: 'claude-haiku-4-5', openai: 'gpt-4o-mini' };

  /* ---------- 1. Text einer Seite → Absätze ----------
     Jedes Textstück bekommt seine Leserichtung auf dem Bildschirm (0°, 90°, 180°,
     270° — Querformat-Seiten, senkrechte Beschriftungen). Gruppiert wird in einem
     eigenen Rahmen je Richtung, in dem der Text immer nach rechts läuft und die
     Zeilen nach unten folgen. Schräger Text (z. B. 45°) bleibt stehen und wird gezählt.
     Aufzählungen (•, –, 1., a)) bleiben eigene Absätze, damit Listen Listen bleiben. */
  const AUFZ = /^\s*([•●○▪■◦·‣∙\-–—*]|\d{1,3}[.)]|[a-zA-Zа-яА-Я][.)])\s/;
  const zuRahmen = (o, X, Y) => { const r = o * Math.PI / 180, c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r)); return [X * c + Y * s, -X * s + Y * c]; };
  const ausRahmen = (o, x, y) => { const r = o * Math.PI / 180, c = Math.round(Math.cos(r)), s = Math.round(Math.sin(r)); return [x * c - y * s, x * s + y * c]; };
  async function bloecke(page) {
    const vp = page.getViewport({ scale: 1 });
    let tc; try { tc = await page.getTextContent(); } catch (_) { return { bloecke: [], gedreht: 0, w: vp.width, h: vp.height, t: vp.transform.slice() }; }
    const nachRichtung = {}; let gedreht = 0;
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const tr = pdfjsLib.Util.transform(vp.transform, it.transform);
      const fh = Math.hypot(tr[2], tr[3]);
      if (!(fh > 0.5)) continue;
      const winkel = Math.atan2(tr[1], tr[0]) * 180 / Math.PI;
      const o = ((Math.round(winkel / 90) * 90) % 360 + 360) % 360;
      if (Math.abs(winkel - Math.round(winkel / 90) * 90) > 3) { gedreht++; continue; }
      const breite = Math.abs(it.width * (Math.hypot(tr[0], tr[1]) / Math.max(1e-6, Math.hypot(it.transform[0], it.transform[1])))) || it.str.length * fh * 0.5;
      const [x, y] = zuRahmen(o, tr[4], tr[5]);
      (nachRichtung[o] = nachRichtung[o] || []).push({ s: it.str, x, y, w: breite, fh });
    }
    const out = [];
    for (const o of Object.keys(nachRichtung).map(Number)) out.push(...gruppieren(nachRichtung[o], o));
    return { bloecke: out, gedreht, w: vp.width, h: vp.height, t: vp.transform.slice() };
  }
  /* Umlaute & Co. (Lehre aus den Rezeptbüchern: Umlaute kamen falsch an).
     PDFs liefern „ü" oft ZERLEGT: „u" + kombinierendes Trema (U+0308), oder als
     eigenes Trema-Zeichen „¨" daneben, manchmal durch eine Lücke getrennt. Die
     Standardschrift macht daraus „u?", ein Übersetzer liest „Mu ller". Dazu
     Ligaturen (ﬁ, ﬂ) und weiche Trennstriche. Alles wird VOR dem Übersetzen und
     auf jedem Rückweg auf eine Form gebracht (NFC). Gilt auch für ё/й. */
  const LIG = { 'ﬀ': 'ff', 'ﬁ': 'fi', 'ﬂ': 'fl', 'ﬃ': 'ffi', 'ﬄ': 'ffl', 'ﬅ': 'st', 'ﬆ': 'st' };
  function zeichenNormal(s) {
    return String(s == null ? '' : s)
      .replace(/[\uFB00-\uFB06]/g, c => LIG[c] || c)
      .replace(/\u00AD/g, '')
      .replace(/([AaEeIiOoUuYyЕеИиІі])[ \u00A0]?[\u00A8\u0308]/g, '$1\u0308')     // u¨ · u ¨ · u + U+0308
      .replace(/[\u00A8][ \u00A0]?([AaEeIiOoUuYyЕеИиІі])/g, '$1\u0308')         // ¨u (Trema vor dem Buchstaben gesetzt)
      .replace(/([Ии])[ \u00A0]?[\u02D8\u0306]/g, '$1\u0306')                   // и˘ → й
      .normalize('NFC');
  }
  function gruppieren(teile, o) {
    // Zeilen: gleiche Grundlinie, dicht nebeneinander
    teile.sort((a, b) => a.y - b.y || a.x - b.x);
    const zeilen = [];
    for (const t of teile) {
      const z = zeilen.find(z => Math.abs(z.y - t.y) < Math.min(z.fh, t.fh) * 0.45 && t.x - (z.x + z.w) < Math.max(z.fh, t.fh) * 1.6 && t.x > z.x - t.fh * 0.5);
      if (z) {
        const luecke = t.x - (z.x + z.w);
        if (luecke > t.fh * 0.12 && !/\s$/.test(z.s) && !/^\s/.test(t.s)) z.s += ' ';
        z.s += t.s; z.w = Math.max(z.w, t.x + t.w - z.x); z.fh = Math.max(z.fh, t.fh);
      } else zeilen.push({ s: t.s, x: t.x, y: t.y, w: t.w, fh: t.fh });
    }
    // Absätze: Zeilen untereinander, ähnliche Schrift, kleiner Abstand, überlappend;
    // ein Aufzählungspunkt beginnt immer einen neuen Absatz
    zeilen.sort((a, b) => a.y - b.y || a.x - b.x);
    const abs = [];
    for (const z of zeilen) {
      const oben = z.y - z.fh;
      const b = AUFZ.test(z.s) ? null : abs.find(b => {
        const letzte = b.zeilen[b.zeilen.length - 1];
        const abstand = oben - (letzte.y + letzte.fh * 0.25);
        const quer = Math.min(b.x + b.w, z.x + z.w) - Math.max(b.x, z.x);
        return abstand > -z.fh * 0.3 && abstand < z.fh * 0.9 && quer > Math.min(b.w, z.w) * 0.3
          && Math.abs(z.x - b.x) < z.fh * 3 && z.fh / letzte.fh < 1.3 && letzte.fh / z.fh < 1.3;
      });
      if (b) { b.zeilen.push(z); const r = Math.max(b.x + b.w, z.x + z.w); b.x = Math.min(b.x, z.x); b.w = r - b.x; }
      else abs.push({ zeilen: [z], x: z.x, w: z.w });
    }
    return abs.map(b => {
      let text = '';
      for (const z of b.zeilen) {
        const s = z.s.trim();
        if (!text) text = s;
        else if (/[A-Za-zÄÖÜäöüßА-Яа-яЁё]-$/.test(text) && /^[a-zäöüßа-яё]/.test(s)) text = text.slice(0, -1) + s;   // Silbentrennung
        else text += ' ' + s;
      }
      const erste = b.zeilen[0], letzte = b.zeilen[b.zeilen.length - 1];
      const size = b.zeilen.reduce((m, z) => m + z.fh, 0) / b.zeilen.length;
      const y = erste.y - erste.fh * 1.02, unten = letzte.y + letzte.fh * 0.28;
      return { t: zeichenNormal(text).replace(/\s+/g, ' ').trim(), x: +b.x.toFixed(2), y: +y.toFixed(2), w: +b.w.toFixed(2), h: +(unten - y).toFixed(2), s: +size.toFixed(2), z: b.zeilen.length, o };
    }).filter(b => /[\p{L}]/u.test(b.t));
  }

  /* ---------- 1b. Seitenbild, Farben, Texterkennung (OCR) ---------- */
  async function seitenBild(page, scale) {
    const vp = page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: x, viewport: vp }).promise;
    return c;
  }
  const hex = (r, g, b) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
  // Hintergrund = häufigste Farbe im Absatz-Rechteck, Schrift = häufigste deutlich
  // andere Farbe. So bekommt ein gelber Warnkasten gelb statt weiß, und weiße
  // Schrift auf dunklem Grund bleibt weiß — die Seite sieht aus wie das Original.
  function farben(canvas, scale, b) {
    const [x, y, w, h, , , , o = 0] = b;
    const ecken = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([a, c]) => ausRahmen(o, a, c));
    const X0 = Math.max(0, Math.floor(Math.min(...ecken.map(e => e[0])) * scale)), Y0 = Math.max(0, Math.floor(Math.min(...ecken.map(e => e[1])) * scale));
    const X1 = Math.min(canvas.width, Math.ceil(Math.max(...ecken.map(e => e[0])) * scale)), Y1 = Math.min(canvas.height, Math.ceil(Math.max(...ecken.map(e => e[1])) * scale));
    if (X1 - X0 < 2 || Y1 - Y0 < 2) return ['#ffffff', '#111111'];
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(X0, Y0, X1 - X0, Y1 - Y0).data;
    const zaehl = new Map(); const schritt = Math.max(1, Math.floor(d.length / 4 / 40000));
    for (let i = 0; i < d.length; i += 4 * schritt) { const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); zaehl.set(k, (zaehl.get(k) || 0) + 1); }
    const sort = [...zaehl.entries()].sort((a, b) => b[1] - a[1]);
    const rgbAus = k => [((k >> 8) & 15) * 16 + 8, ((k >> 4) & 15) * 16 + 8, (k & 15) * 16 + 8];
    const bg = rgbAus(sort[0][0]);
    // Mittelwert der echten Pixel im häufigsten Farbeimer — genauer als die Eimermitte
    let sr = 0, sg = 0, sb = 0, n = 0;
    for (let i = 0; i < d.length; i += 4 * schritt) { const k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); if (k === sort[0][0]) { sr += d[i]; sg += d[i + 1]; sb += d[i + 2]; n++; } }
    const bgE = n ? [sr / n, sg / n, sb / n] : bg;
    const abst = c => Math.abs(c[0] - bgE[0]) + Math.abs(c[1] - bgE[1]) + Math.abs(c[2] - bgE[2]);
    const fgK = sort.find(([k]) => abst(rgbAus(k)) > 180);
    const hell = (bgE[0] * 299 + bgE[1] * 587 + bgE[2] * 114) / 1000;
    const fg = fgK ? rgbAus(fgK[0]) : (hell > 128 ? [17, 17, 17] : [255, 255, 255]);
    return [hex(...bgE), hex(...fg)];
  }
  const TESS = { de: 'deu', ru: 'rus', en: 'eng' };
  // Texterkennung für Seiten ohne Textebene (Scans, Fotos). Läuft auf dem Gerät
  // (Tesseract.js, Apache-2.0); Programm und Sprachdaten liegen unter <basis>tesseract/.
  async function ocrStarten(basis, von) {
    if (!window.Tesseract) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = basis + 'tesseract/tesseract.min.js'; s.onload = res; s.onerror = () => rej(new Error('Texterkennung (Tesseract) lädt nicht')); document.head.appendChild(s); });
    const abs = u => new URL(u, location.href).href;
    const w = await window.Tesseract.createWorker(TESS[von] || 'eng', 1, { workerPath: abs(basis + 'tesseract/worker.min.js'), corePath: abs(basis + 'tesseract/'), langPath: abs(basis + 'tesseract/lang'), gzip: false, cacheMethod: 'none' });
    return w;
  }
  async function ocrBloecke(worker, canvas, scale) {
    const r = await worker.recognize(canvas, {}, { blocks: true, text: false });
    const teile = [];
    for (const bl of (r.data.blocks || [])) for (const pa of (bl.paragraphs || [])) for (const li of (pa.lines || [])) {
      const t = String(li.text || '').replace(/\s+/g, ' ').trim();
      if (!t || li.confidence < 45 || !/[\p{L}]{2}/u.test(t)) continue;
      const bb = li.bbox, hoehe = (bb.y1 - bb.y0) / scale;
      const basis = li.baseline && li.baseline.y0 > bb.y0 ? li.baseline.y0 / scale : bb.y1 / scale - hoehe * 0.2;
      teile.push({ s: t, x: bb.x0 / scale, y: basis, w: (bb.x1 - bb.x0) / scale, fh: Math.max(4, hoehe * 0.82) });
    }
    return gruppieren(teile, 0);
  }

  /* ---------- 2. Übersetzer ---------- */
  function browserDa() { return typeof self !== 'undefined' && 'Translator' in self; }
  // 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'fehlt' (kein Translator im Browser)
  async function browserVerfuegbar(von, nach) {
    if (!browserDa()) return 'fehlt';
    try { return await self.Translator.availability({ sourceLanguage: von, targetLanguage: nach }); } catch (e) { return 'unavailable'; }
  }
  // Muss aus einem Tipp heraus aufgerufen werden, falls das Sprachpaket erst geladen wird.
  async function browserUebersetzer(von, nach, meldeLaden) {
    if (!browserDa()) throw new Error('Dieser Browser hat keinen eingebauten Übersetzer.');
    const tr = await self.Translator.create({ sourceLanguage: von, targetLanguage: nach,
      monitor(m) { m.addEventListener('downloadprogress', e => { if (meldeLaden) meldeLaden(e.loaded); }); } });
    const stat = { zeichen: 0, anfragen: 0 };
    const fn = async texte => { const out = []; for (const t of texte) { stat.zeichen += t.length; stat.anfragen++; out.push(await tr.translate(t)); } return out; };
    fn.stat = stat; fn.art = 'browser'; fn.zu = () => { try { tr.destroy && tr.destroy(); } catch (_) {} };
    return fn;
  }

  function kiPrompt(von, nach) {
    return 'Übersetze jeden Eintrag der Liste "t" aus dem ' + NAME_DE[von] + 'en ins ' + NAME_DE[nach] + 'e. '
      + 'Die Einträge sind Absätze EINER Dokumentseite, in Lesereihenfolge; nutze sie gegenseitig als Zusammenhang. '
      + 'Übersetze vollständig und sinngetreu, erfinde nichts, lass nichts weg. Zahlen, Beträge, Daten, Namen, Adressen, Kennungen und E-Mail-Adressen bleiben unverändert. '
      + 'Ist ein Eintrag schon in der Zielsprache oder nicht übersetzbar, gib ihn unverändert zurück. '
      + 'Antworte AUSSCHLIESSLICH mit JSON: {"t":["…"]} — genau so viele Einträge wie in der Eingabe, gleiche Reihenfolge.';
  }
  // Zweistufig wie cleanJSON/repairJSON in Mein Rezeptbuch: erst sauber ausschneiden,
  // dann ungeschützte Zeilenumbrüche/Steuerzeichen in Zeichenketten reparieren.
  function jsonAus(text) {
    const s = String(text || '').replace(/```(?:json)?/g, ''); const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('Antwort der KI ist kein JSON');
    const roh = s.slice(a, b + 1);
    try { return JSON.parse(roh); } catch (_) {
      let out = '', inStr = false, esc = false;
      for (const ch of roh) {
        if (inStr) {
          if (esc) { esc = false; out += ch; continue; }
          if (ch === '\\') { esc = true; out += ch; continue; }
          if (ch === '"') { inStr = false; out += ch; continue; }
          if (ch === '\n' || ch === '\r') { out += ' '; continue; }
          if (ch < ' ') continue;
          out += ch;
        } else { if (ch === '"') inStr = true; out += ch; }
      }
      return JSON.parse(out);
    }
  }
  const warte = ms => new Promise(r => setTimeout(r, ms));
  // cfg: { anbieter, schluessel, modell } — Anbieter wie in erkennung.js (ANBIETER)
  function kiUebersetzer(cfg, von, nach) {
    const A = window.WFP && WFP.Erkennung && WFP.Erkennung.ANBIETER; const a = A && A[cfg.anbieter];
    if (!a) throw new Error('Unbekannter KI-Anbieter');
    const key = String(cfg.schluessel || '').trim(); if (!key) throw new Error('Kein Schlüssel für ' + a.label + ' hinterlegt');
    const modell = String(cfg.modell || '').trim() || KI_TEXTMODELL[cfg.anbieter] || a.modell;
    const stat = { zeichen: 0, anfragen: 0, tokenEin: 0, tokenAus: 0, modell };
    const system = kiPrompt(von, nach);
    // 429 und Überlast (5xx, 529) werden bis zu dreimal wiederholt — bei 400 Seiten
    // trifft man das Kontingent sonst mitten im Lauf. 401 bricht sofort ab.
    async function frage(liste) {
      for (let v = 0; ; v++) {
        try { return await frage1(liste); }
        catch (e) { if (v >= 3 || !/^(Zu viele|Fehler 5|Überlast)/.test(e.message)) throw e; await warte([2000, 6000, 15000][v]); }
      }
    }
    async function frage1(liste) {
      const nutz = JSON.stringify({ t: liste });
      stat.zeichen += liste.reduce((n, t) => n + t.length, 0); stat.anfragen++;
      let text;
      if (a.kind === 'anthropic') {
        const r = await fetch(a.base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: modell, max_tokens: 8000, system, messages: [{ role: 'user', content: nutz }] }) });
        if (!r.ok) throw new Error(await fehler(r));
        const j = await r.json(); text = (j.content || []).map(c => c.text || '').join('');
        if (j.stop_reason === 'max_tokens') throw new Error('Antwort abgeschnitten');
        if (j.usage) { stat.tokenEin += j.usage.input_tokens || 0; stat.tokenAus += j.usage.output_tokens || 0; }
      } else {
        const body = { model: modell, max_tokens: 8000, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: nutz }], response_format: { type: 'json_object' } };
        const r = await fetch(a.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: JSON.stringify(body) });
        if (!r.ok) throw new Error(await fehler(r));
        const j = await r.json(); text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        if (j.choices && j.choices[0] && j.choices[0].finish_reason === 'length') throw new Error('Antwort abgeschnitten');
        if (j.usage) { stat.tokenEin += j.usage.prompt_tokens || 0; stat.tokenAus += j.usage.completion_tokens || 0; }
      }
      const t = jsonAus(text).t;
      if (!Array.isArray(t) || t.length !== liste.length) throw new Error('KI lieferte ' + (Array.isArray(t) ? t.length : 0) + ' statt ' + liste.length + ' Einträgen');
      return t.map(x => String(x == null ? '' : x));
    }
    async function fehler(r) {
      let t = ''; try { t = await r.text(); } catch (_) {}
      let m = t; try { const j = JSON.parse(t); m = (j.error && (j.error.message || j.error.type)) || j.message || t; } catch (_) {}
      if (r.status === 401) return 'Schlüssel ungültig (401)';
      if (r.status === 529 || r.status === 503) return 'Überlast beim Anbieter (' + r.status + ')';
      if (r.status === 429) return 'Zu viele Anfragen oder Kontingent erschöpft (429). ' + String(m).slice(0, 120);
      return 'Fehler ' + r.status + ': ' + String(m).slice(0, 200);
    }
    // In Stücken bis ~5000 Zeichen; stimmt die Anzahl nicht, einzeln nachfragen.
    const fn = async texte => {
      const out = []; let stueck = [], laenge = 0;
      const los = async () => {
        if (!stueck.length) return;
        let r; try { r = await frage(stueck); } catch (e) { if (stueck.length === 1 || /401|429/.test(e.message)) throw e; r = []; for (const t of stueck) r.push((await frage([t]))[0]); }
        out.push(...r); stueck = []; laenge = 0;
      };
      for (const t of texte) { if (laenge + t.length > 5000) await los(); stueck.push(t); laenge += t.length; }
      await los();
      return out;
    };
    fn.stat = stat; fn.art = 'ki'; fn.zu = () => {};
    return fn;
  }

  /* ---------- 3. Lauf über ein Dokument, Seite für Seite ----------
     opt: { bytes, uebersetzer, stand (gespeicherte Seiten oder null),
            speichere(stand) — nach JEDER Seite, abbruch() → true zum Anhalten,
            melde(fertig, gesamt, info) }
     stand.seiten[i] = { b: [[x,y,w,h,size,zeilen,text]], u: [übersetzt] } */
  async function lauf(opt) {
    const pdf = await pdfjsLib.getDocument({ data: opt.bytes.slice(0) }).promise;
    const n = pdf.numPages;
    const stand = opt.stand && opt.stand.seiten && opt.stand.seiten.length === n ? opt.stand : { seiten: new Array(n).fill(null) };
    const t0 = Date.now(); let neu = 0, abgebrochen = false, fehler = '', ocrWorker = null, ocrSeiten = 0, ocrFehler = '';
    try {
      for (let i = 0; i < n; i++) {
        if (stand.seiten[i]) continue;
        if (opt.abbruch && opt.abbruch()) { abgebrochen = true; break; }
        const page = await pdf.getPage(i + 1);
        const r = await bloecke(page);
        // Ohne Textebene (gescannt): Seite groß rendern und den Text erkennen lassen
        let ocr = false;
        const scale = !r.bloecke.length && opt.ocr ? 3 : 1.5;
        let bild = await seitenBild(page, scale);
        if (!r.bloecke.length && opt.ocr) {
          if (!ocrWorker && !ocrFehler) {
            if (opt.melde) opt.melde(stand.seiten.filter(Boolean).length, n, { ms: Date.now() - t0, neu, text: 'Texterkennung wird geladen …' });
            // Lädt sie nicht (offline beim ersten Mal), laufen die Seiten MIT Text weiter;
            // die gescannten bleiben unübersetzt und werden im Ergebnis benannt.
            try { ocrWorker = await ocrStarten(opt.ocr.basis, opt.ocr.von); } catch (e) { ocrFehler = e.message || String(e); }
          }
          if (ocrWorker) { r.bloecke = await ocrBloecke(ocrWorker, bild, scale); ocr = true; ocrSeiten++; }
        }
        try { page.cleanup(); } catch (_) {}
        const b = r.bloecke.map(b => [b.x, b.y, b.w, b.h, b.s, b.z, b.t, b.o || 0]);
        b.forEach(x => x.push(...farben(bild, scale, x)));
        bild.width = bild.height = 0; bild = null;
        const texte = r.bloecke.map(b => b.t);
        // Scheitert der Übersetzer (Kontingent, 429, Netz), bleibt das Übersetzte
        // gespeichert, und der Lauf meldet den Grund, statt ihn zu werfen —
        // sonst ginge die Teilübersetzung für den Aufrufer verloren.
        let u;
        try { u = texte.length ? (await opt.uebersetzer(texte)).map(zeichenNormal) : []; }
        catch (e) { fehler = (e && e.message) || String(e); break; }
        stand.seiten[i] = { b, u, gedreht: r.gedreht, t: r.t, ocr };
        neu++;
        if (opt.speichere) await opt.speichere(stand);
        if (opt.melde) opt.melde(stand.seiten.filter(Boolean).length, n, { ms: Date.now() - t0, neu });
      }
    } finally { try { pdf.destroy(); } catch (_) {} if (ocrWorker) { try { await ocrWorker.terminate(); } catch (_) {} } }
    const fertig = stand.seiten.filter(Boolean).length;
    return { stand, n, fertig, abgebrochen: abgebrochen || fertig < n, fehler, ms: Date.now() - t0, neu, ocrSeiten, ocrFehler };
  }

  // Gegenprobe: dieselben Absätze, Übersetzung zurück — ohne die Seiten neu zu lesen
  // (unter dem weißen Deckblatt liegt der Originaltext noch; ein erneutes Lesen fände beide).
  async function rueck(stand, uebersetzer, opt) {
    const r = { seiten: stand.seiten.map(s => s && { b: s.b.map(x => x.slice()), u: null, t: s.t, gedreht: s.gedreht, ocr: s.ocr }) };
    const vor = opt && opt.stand;
    if (vor && vor.seiten && vor.seiten.length === r.seiten.length) vor.seiten.forEach((s, i) => { if (s && s.u && r.seiten[i]) r.seiten[i].u = s.u; });
    const n = r.seiten.length;
    for (let i = 0; i < n; i++) {
      const s = r.seiten[i]; if (!s || s.u) continue;
      if (opt && opt.abbruch && opt.abbruch()) break;
      s.u = stand.seiten[i].u.length ? (await uebersetzer(stand.seiten[i].u)).map(zeichenNormal) : [];
      if (opt && opt.speichere) await opt.speichere(r);
      if (opt && opt.melde) opt.melde(r.seiten.filter(x => x && x.u).length, n);
    }
    return r;
  }

  /* ---------- 4. Neues PDF: Original als Hintergrund, Übersetzung in die Lage ---------- */
  function umbrechen(font, text, size, breite) {
    const zeilen = []; let z = '';
    for (const w of String(text).split(/\s+/)) {
      if (!w) continue;
      const t = z ? z + ' ' + w : w;
      if (font.widthOfTextAtSize(t, size) <= breite || !z) z = t; else { zeilen.push(z); z = w; }
    }
    if (z) zeilen.push(z);
    return zeilen;
  }
  function saeubern(font, s) {
    let out = '', ersetzt = 0;
    for (const ch of String(s || '')) { try { font.widthOfTextAtSize(ch, 10); out += ch; } catch (_) { out += '?'; ersetzt++; } }
    return { text: out, ersetzt };
  }
  let _schrift = null;
  // basis: Pfad zu den mitgelieferten Dateien (Workflow-PDF: 'vendor/', WorkFloh: 'assets/wfpdf/')
  async function schriftLaden(basis) {
    if (_schrift) return _schrift;
    if (!window.fontkit) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = basis + 'fontkit.umd.min.js'; s.onload = res; s.onerror = () => rej(new Error('fontkit lädt nicht')); document.head.appendChild(s); });
    const r = await fetch(basis + 'fonts/NotoSans-Regular.ttf'); if (!r.ok) throw new Error('Schrift Noto Sans lädt nicht (' + r.status + ')');
    _schrift = new Uint8Array(await r.arrayBuffer());
    return _schrift;
  }
  // seiten: stand.seiten; schrift: TTF-Bytes; opt.nach: Zielsprache (für Titel/Sprache)
  async function pdfBauen(bytes, seiten, schrift, opt) {
    const { PDFDocument, rgb, degrees } = PDFLib;
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    pdf.registerFontkit(window.fontkit);
    const font = await pdf.embedFont(schrift, { subset: true });
    const pages = pdf.getPages(); const hinweise = [];
    let ersetzt = 0, zuKlein = 0, ohneText = 0, gedreht = 0, offen = 0, ocr = 0;
    const invert = WFP.Export.invert;
    for (let i = 0; i < pages.length; i++) {
      const s = seiten[i]; const page = pages[i];
      if (!s) { offen++; continue; }
      if (!s.b.length) { ohneText++; continue; }
      if (s.ocr) ocr++;
      gedreht += s.gedreht || 0;
      // Anzeige-Matrix, die pdf.js beim Lesen geliefert hat (Maßstab 1); fehlt sie, nachgebaut
      const inv = invert(s.t || anzeige(page).t);
      const o = inv(0, 0), ex = inv(1, 0);
      const winkel = Math.round(Math.atan2(ex[1] - o[1], ex[0] - o[0]) * 180 / Math.PI);
      s.b.forEach((b, k) => {
        const [x, y, w, h, size, , , o = 0, bgF = '#ffffff', fgF = '#111111'] = b; const roh = s.u && s.u[k];
        const farbe = f => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(f) || [0, 'ff', 'ff', 'ff']; return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255); };
        if (roh == null) return;
        const { text, ersetzt: e } = saeubern(font, roh); ersetzt += e;
        // Punkt im Rahmen des Absatzes (Text läuft nach rechts) → Anzeige → PDF
        const p = (dx, dy) => { const d = ausRahmen(o, x + dx, y + dy); return inv(d[0], d[1]); };
        const dreh = degrees(winkel - o);
        const pad = Math.max(0.6, size * 0.08);
        const a = p(-pad, h + pad);
        page.drawRectangle({ x: a[0], y: a[1], width: w + 2 * pad, height: h + 2 * pad, color: farbe(bgF), rotate: dreh });
        let gr = Math.min(size, 40), zeilen = umbrechen(font, text, gr, w);
        while (gr > 3.5 && (zeilen.length * gr * 1.18 > h + gr * 0.3 || zeilen.some(z => font.widthOfTextAtSize(z, gr) > w + 0.5))) { gr -= 0.25; zeilen = umbrechen(font, text, gr, w); }
        if (gr < size * 0.6) zuKlein++;
        zeilen.forEach((z, j) => {
          const q = p(0, (j + 1) * gr * 1.18 - gr * 0.22);
          page.drawText(z, { x: q[0], y: q[1], size: gr, font, color: farbe(fgF), rotate: dreh });
        });
      });
    }
    if (offen) hinweise.push(offen + ' Seite(n) sind noch nicht übersetzt (Lauf abgebrochen) und stehen im Original da.');
    if (ohneText) hinweise.push(ohneText + ' Seite(n) ohne erkennbaren Text (leer, nur Bild, oder Texterkennung nicht verfügbar) bleiben wie im Original.');
    if (ocr) hinweise.push(ocr + ' gescannte Seite(n) per Texterkennung (OCR) gelesen — dort bitte die Übersetzung gegenlesen, Erkennungsfehler sind möglich.');
    if (gedreht) hinweise.push(gedreht + ' schräg gesetzte Textstücke (nicht waagerecht oder senkrecht) bleiben im Original stehen.');
    if (zuKlein) hinweise.push(zuKlein + ' Absätze mussten stark verkleinert werden, weil die Übersetzung länger ist.');
    if (ersetzt) hinweise.push(ersetzt + ' Zeichen fehlen in der Schrift und wurden durch „?" ersetzt.');
    hinweise.push('Unter der Übersetzung liegt der Originaltext noch im PDF (in der Hintergrundfarbe abgedeckt, beim Markieren und Suchen findbar).');
    if (opt && opt.titel) pdf.setTitle(opt.titel);
    if (opt && opt.nach) pdf.setLanguage(opt.nach);
    pdf.setProducer('Workfloh PDF'); pdf.setCreator('Workflow PDF (lausiklauskn-png.github.io/Workflow-PDF)');
    return { bytes: await pdf.save(), hinweise };
  }
  // Nachbau von pdf.js' PageViewport (scale 1, ohne Versatz): transform + Größe.
  function anzeige(page) {
    const { x, y, width, height } = page.getCropBox ? page.getCropBox() : page.getMediaBox();
    const rot = ((page.getRotation().angle % 360) + 360) % 360;
    const cx = x + width / 2, cy = y + height / 2;
    let a, b, c, d;
    if (rot === 90) { a = 0; b = 1; c = 1; d = 0; } else if (rot === 180) { a = -1; b = 0; c = 0; d = 1; } else if (rot === 270) { a = 0; b = -1; c = -1; d = 0; } else { a = 1; b = 0; c = 0; d = -1; }
    const W = rot % 180 ? height : width, H = rot % 180 ? width : height;
    const ox = W / 2 - (a * cx + c * cy), oy = H / 2 - (b * cx + d * cy);
    return { t: [a, b, c, d, ox, oy], w: W, h: H };
  }

  window.WFP = window.WFP || {};
  window.WFP.Uebersetzung = { zeichenNormal, SPRACHEN, NAME_DE, KI_TEXTMODELL, bloecke, browserDa, browserVerfuegbar, browserUebersetzer, kiUebersetzer, lauf, rueck, schriftLaden, pdfBauen, anzeige, farben, ocrStarten };
})();
