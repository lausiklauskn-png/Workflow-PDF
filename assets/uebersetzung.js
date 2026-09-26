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
      // Stücke ohne Buchstaben und Ziffern (✓ • ■ ☐) bleiben, wie sie sind: sie gehören
      // nicht in einen Absatz, sonst werden sie mit abgedeckt oder blähen die Schriftgröße auf.
      if (!/[\p{L}\p{N}]/u.test(it.str)) continue;
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
    for (const o of Object.keys(nachRichtung).map(Number)) out.push(...gruppieren(nachRichtung[o].map(t => ({ ...t })), o));
    return { bloecke: out, gedreht, w: vp.width, h: vp.height, t: vp.transform.slice(), roh: nachRichtung };
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
  // bild (optional): Prüfer auf dem gerenderten Seitenbild, nur bei waagerechtem Text (o = 0).
  function gruppieren(teile, o, bild) {
    const pb = o === 0 ? bild : null;
    // Zeilen: gleiche Grundlinie, dicht nebeneinander, ähnliche Schriftgröße
    // (Befund Klaus 2026-09-25: mit 1,6 Schrifthöhen Abstand verschmolz das Logo-„M" mit „Bürgeramt …")
    teile.sort((a, b) => a.y - b.y || a.x - b.x);
    const zeilen = [];
    for (const t of teile) {
      const z = zeilen.find(z => Math.abs(z.y - t.y) < Math.min(z.fh, t.fh) * 0.45 && t.x - (z.x + z.w) < Math.min(z.fh, t.fh) * 1.0 && t.x > z.x - t.fh * 0.5
        && Math.max(z.fh, t.fh) / Math.min(z.fh, t.fh) < 1.6);
      if (z) {
        const luecke = t.x - (z.x + z.w);
        if (luecke > t.fh * 0.12 && !/\s$/.test(z.s) && !/^\s/.test(t.s)) z.s += ' ';
        z.s += t.s; z.w = Math.max(z.w, t.x + t.w - z.x); z.fh = Math.max(z.fh, t.fh);
      } else zeilen.push({ s: t.s, x: t.x, y: t.y, w: t.w, fh: t.fh, ocr: t.ocr });
    }
    // Vor der Zeile ein Zeichen (Kästchen, Punkt, Kreis)? Dann ist sie ein eigener Eintrag.
    // Größen-Toleranz: die Textebene nennt die Schriftgröße genau, die Texterkennung schätzt sie aus dem Zeilenkasten
    const rat = pb ? 1.15 : 1.3;
    // Ein Zeichen (Kästchen, Kreis mit Ziffer) steht links vor der Zeile und ist vom Zeichen
    // der Zeile darüber durch eine leere Zeile getrennt. Der Rand eines Kastens läuft dagegen
    // durch — der ist keine Marke, sonst zerfällt der Kastentext in einzelne Zeilen.
    const marke = (z, letzte) => {
      if (!pb) return false;
      const x0 = z.x - z.fh * 1.8, x1 = z.x - z.fh * 0.12;
      if (!(pb.tinte(x0, z.y - z.fh * 0.85, x1, z.y + z.fh * 0.1) > 0.04 && pb.breite(x0, z.y - z.fh * 0.85, x1, z.y + z.fh * 0.1) > 2)) return false;
      return !letzte || pb.leereZeile(x0, letzte.y - letzte.fh * 0.85, x1, z.y - z.fh * 0.85);
    };
    // Absätze: Zeilen untereinander, ähnliche Schrift, kleiner Abstand, überlappend;
    // ein Aufzählungspunkt beginnt immer einen neuen Absatz
    zeilen.sort((a, b) => a.y - b.y || a.x - b.x);
    const abs = [];
    for (const z of zeilen) {
      const oben = z.y - z.fh;
      const b = AUFZ.test(z.s) ? null : abs.find(b => {
        const letzte = b.zeilen[b.zeilen.length - 1];
        if (marke(z, letzte)) return false;
        const abstand = oben - (letzte.y + letzte.fh * 0.25);
        const quer = Math.min(b.x + b.w, z.x + z.w) - Math.max(b.x, z.x);
        if (!(abstand > -z.fh * 0.3 && abstand < z.fh * 0.9 && quer > Math.min(b.w, z.w) * 0.3
          && Math.abs(z.x - b.x) < z.fh * 3 && z.fh / letzte.fh < rat && letzte.fh / z.fh < rat)) return false;
        // Eine Beschriftung („Vorname:", „Unfalltag:") ist eine Zeile für sich — sie steht neben
        // IHREM Feld. Ebenso Zeilen mit weitem Abstand (Beschriftungs-Spalte neben Feldern,
        // Überschrift über dem ersten Feld): zusammengezogen und neu umbrochen rutschen sie
        // von ihren Feldern weg (Befund Klaus 2026-09-26, Fragebogen: „Postal code, / City: Email:").
        if (/:\s*$/.test(letzte.s)) return false;
        // Nicht bei Texterkennung: dort misst fh das Buchstaben-Kästchen, nicht die
        // Schriftgröße — der Zeilenabstand sähe immer zu groß aus (Scan-Absatz zerfiel).
        if (!z.ocr && z.y - letzte.y > Math.max(z.fh, letzte.fh) * 1.6) return false;
        // Kurze erste Zeile in etwas größerer Schrift = Überschrift eines Kastens („Hinweis zu Fotos")
        if (b.zeilen.length === 1 && letzte.w < z.w * 0.6 && letzte.fh / z.fh > 1.04) return false;
        // Zwischen den Zeilen eine Linie, ein Feld, ein Kasten? Dann zwei Absätze.
        if (pb) { const x0 = Math.max(letzte.x, z.x), x1 = Math.min(letzte.x + letzte.w, z.x + z.w);
          if (x1 > x0 && pb.tinte(x0, letzte.y + letzte.fh * 0.3, x1, z.y - z.fh * 0.8) > 0.03) return false; }
        return true;
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
      // Jede Zeile einzeln abdecken statt des ganzen Rechtecks — sonst verschwinden
      // Logo, Kreis-Ziffer oder Kästchen, die zufällig im Rechteck liegen.
      const zr = b.zeilen.map(z => [+z.x.toFixed(2), +(z.y - z.fh * 1.02).toFixed(2), +z.w.toFixed(2), +(z.fh * 1.3).toFixed(2)]);
      return { t: zeichenNormal(text).replace(/\s+/g, ' ').trim(), x: +b.x.toFixed(2), y: +y.toFixed(2), w: +b.w.toFixed(2), h: +(unten - y).toFixed(2), s: +size.toFixed(2), z: b.zeilen.length, o, zr };
    }).filter(b => /\p{L}[^]*\p{L}/u.test(b.t));   // ein einzelner Buchstabe (Logo-„M", Kreis-Ziffer) bleibt, wie er ist
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
    // Schrift = die KRÄFTIGSTE deutlich andere Farbe, die oft genug vorkommt — nicht einfach
    // die häufigste: bei kleiner Schrift sind die weichen Kantenpixel (hellgrau) zahlreicher als
    // der dunkle Kern, und die Übersetzung stand blassgrau da (Befund Klaus 2026-09-26).
    const kand = sort.filter(([k]) => abst(rgbAus(k)) > 180);
    const fgK = kand.length ? kand.filter(([, n]) => n >= kand[0][1] * 0.25).reduce((m, e) => abst(rgbAus(e[0])) > abst(rgbAus(m[0])) ? e : m) : null;
    const hell = (bgE[0] * 299 + bgE[1] * 587 + bgE[2] * 114) / 1000;
    const fg = fgK ? rgbAus(fgK[0]) : (hell > 128 ? [17, 17, 17] : [255, 255, 255]);
    return [hex(...bgE), hex(...fg)];
  }
  /* Prüfer auf dem Seitenbild (Koordinaten in Punkten der Anzeige, y nach unten).
     tinte(): Anteil der Pixel, die sich deutlich von der häufigsten Farbe im Rechteck
     abheben. frei(): wie weit rechts und unten neben einem Absatz leere Fläche liegt —
     bis zur nächsten Linie, zum nächsten Kasten, zum nächsten Text. Dorthin darf eine
     längere Übersetzung wachsen, BEVOR ihre Schrift kleiner wird. */
  function seitenPruefer(canvas, scale) {
    const W = canvas.width, H = canvas.height;
    const d = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H).data;
    const px = v => Math.round(v * scale);
    const klemm = (v, m) => Math.max(0, Math.min(m, v));
    function tinte(x0, y0, x1, y1) {
      const X0 = klemm(px(x0), W), X1 = klemm(px(x1), W), Y0 = klemm(px(y0), H), Y1 = klemm(px(y1), H);
      if (X1 - X0 < 1 || Y1 - Y0 < 1) return 0;
      const zaehl = new Map(); let n = 0;
      for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) { const i = (Y * W + X) * 4, k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); zaehl.set(k, (zaehl.get(k) || 0) + 1); n++; }
      let bk = 0, bn = -1; for (const [k, c] of zaehl) if (c > bn) { bn = c; bk = k; }
      const br = ((bk >> 8) & 15) * 16 + 8, bg = ((bk >> 4) & 15) * 16 + 8, bb = (bk & 15) * 16 + 8;
      let t = 0;
      for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) { const i = (Y * W + X) * 4; if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 120) t++; }
      return t / n;
    }
    // Breite (in Punkten) der Spalten, in denen überhaupt Tinte steht
    function breite(x0, y0, x1, y1) {
      const X0 = klemm(px(x0), W), X1 = klemm(px(x1), W), Y0 = klemm(px(y0), H), Y1 = klemm(px(y1), H);
      if (X1 - X0 < 1 || Y1 - Y0 < 1) return 0;
      const zaehl = new Map();
      for (let Y = Y0; Y < Y1; Y++) for (let X = X0; X < X1; X++) { const i = (Y * W + X) * 4, k = (d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4); zaehl.set(k, (zaehl.get(k) || 0) + 1); }
      let bk = 0, bn = -1; for (const [k, c] of zaehl) if (c > bn) { bn = c; bk = k; }
      const br = ((bk >> 8) & 15) * 16 + 8, bg = ((bk >> 4) & 15) * 16 + 8, bb = (bk & 15) * 16 + 8;
      let n = 0;
      for (let X = X0; X < X1; X++) for (let Y = Y0; Y < Y1; Y++) { const i = (Y * W + X) * 4; if (Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg) + Math.abs(d[i + 2] - bb) > 120) { n++; break; } }
      return n / scale;
    }
    // Gibt es zwischen y0 und y1 eine Pixelzeile, die im Streifen durchgehend eine Farbe hat?
    function leereZeile(x0, y0, x1, y1) {
      const X0 = klemm(px(x0), W), X1 = klemm(px(x1), W), Y0 = klemm(px(y0), H), Y1 = klemm(px(y1), H);
      if (X1 - X0 < 1) return false;
      for (let Y = Y0; Y < Y1; Y++) {
        const j = (Y * W + X0) * 4; let gleich = true;
        for (let X = X0 + 1; X < X1 && gleich; X++) { const i = (Y * W + X) * 4; gleich = Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]) < 60; }
        if (gleich) return true;
      }
      return false;
    }
    const leer = (X, Y, rgb) => { const i = (Y * W + X) * 4; return Math.abs(d[i] - rgb[0]) + Math.abs(d[i + 1] - rgb[1]) + Math.abs(d[i + 2] - rgb[2]) < 60; };
    // b: [x, y, w, h, size, …, bgF]; andere: Rechtecke der übrigen Absätze; grenzeR: rechter Rand
    function frei(b, andere, grenzeR) {
      const [x, y, w, h, size] = b, bgF = b[8] || '#ffffff';
      const rgb = [1, 3, 5].map(i => parseInt(bgF.slice(i, i + 2), 16));
      const trifft = (ax, ay, aw, ah) => andere.some(r => r !== b && r[0] < ax + aw && r[0] + r[2] > ax && r[1] < ay + ah && r[1] + r[3] > ay);
      // rechts: Spalte für Spalte im Band des Absatzes
      const Y0 = klemm(px(y), H - 1), Y1 = klemm(px(y + h), H - 1);
      let X = klemm(px(x + w) + 1, W - 1); const XE = klemm(px(grenzeR), W - 1);
      for (; X < XE; X++) {
        let ok = true; for (let Y = Y0; Y <= Y1 && ok; Y += 1) ok = leer(X, Y, rgb);
        if (!ok || trifft(X / scale, y, 1 / scale, h)) break;
      }
      const wFrei = Math.max(0, X / scale - (x + w) - size * 0.5);
      // unten: Zeile für Zeile unter dem Absatz, höchstens drei Schrifthöhen
      const XA = klemm(px(x), W - 1), XB = klemm(px(x + w + wFrei), W - 1);
      let Y = klemm(px(y + h) + 1, H - 1); const YE = klemm(px(y + h + size * 3), H - 1);
      for (; Y < YE; Y++) {
        let ok = true; for (let Xs = XA; Xs <= XB && ok; Xs += 1) ok = leer(Xs, Y, rgb);
        if (!ok || trifft(x, Y / scale, w + wFrei, 1 / scale)) break;
      }
      const hFrei = Math.max(0, Y / scale - (y + h) - size * 0.6);
      return [+wFrei.toFixed(2), +hFrei.toFixed(2)];
    }
    return { tinte, breite, leereZeile, frei };
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
  /* Bilder auf einer Seite MIT Text (Klaus 2026-09-25: „Kurzanleitung wurde nicht übersetzt").
     Die Texterkennung lief nur auf Seiten ganz ohne Textebene — ein eingefügter Scan, ein
     Foto einer Anleitung oder ein Bildschirmfoto auf einer normalen Seite blieb deutsch.
     Gesucht werden die Stellen, an denen die Seite ein Bild zeichnet (Anzeige-Punkte, y
     nach unten). Nur größere Bilder: ein Logo oder Symbol ist kein Lesestoff. */
  async function bildFlaechen(page) {
    const vp = page.getViewport({ scale: 1 }); let ops;
    try { ops = await page.getOperatorList(); } catch (_) { return []; }
    const O = pdfjsLib.OPS, mal = pdfjsLib.Util.transform, stapel = []; let ctm = [1, 0, 0, 1, 0, 0]; const raus = [];
    const bild = new Set([O.paintImageXObject, O.paintInlineImageXObject, O.paintJpegXObject, O.paintImageXObjectRepeat].filter(v => v != null));
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i], a = ops.argsArray[i];
      if (fn === O.save) stapel.push(ctm.slice());
      else if (fn === O.restore) ctm = stapel.pop() || [1, 0, 0, 1, 0, 0];
      else if (fn === O.transform) ctm = mal(ctm, a);
      else if (fn === O.paintFormXObjectBegin && a && a[0]) { stapel.push(ctm.slice()); ctm = mal(ctm, a[0]); }
      else if (fn === O.paintFormXObjectEnd) ctm = stapel.pop() || [1, 0, 0, 1, 0, 0];
      else if (bild.has(fn)) {
        const m = mal(vp.transform, ctm);
        const ecken = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]);
        const x0 = Math.max(0, Math.min(...ecken.map(e => e[0]))), y0 = Math.max(0, Math.min(...ecken.map(e => e[1])));
        const x1 = Math.min(vp.width, Math.max(...ecken.map(e => e[0]))), y1 = Math.min(vp.height, Math.max(...ecken.map(e => e[1])));
        if (x1 - x0 >= 80 && y1 - y0 >= 60 && (x1 - x0) * (y1 - y0) >= vp.width * vp.height * 0.04) raus.push([x0, y0, x1 - x0, y1 - y0]);
      }
    }
    return raus;
  }
  async function ocrBloecke(worker, canvas, scale, dx = 0, dy = 0) {
    const r = await worker.recognize(canvas, {}, { blocks: true, text: false });
    const teile = [];
    for (const bl of (r.data.blocks || [])) for (const pa of (bl.paragraphs || [])) for (const li of (pa.lines || [])) {
      const t = String(li.text || '').replace(/\s+/g, ' ').trim();
      if (!t || li.confidence < 45 || !/[\p{L}]{2}/u.test(t)) continue;
      const bb = li.bbox, hoehe = (bb.y1 - bb.y0) / scale;
      const basis = li.baseline && li.baseline.y0 > bb.y0 ? li.baseline.y0 / scale : bb.y1 / scale - hoehe * 0.2;
      teile.push({ s: t, x: bb.x0 / scale + dx, y: basis + dy, w: (bb.x1 - bb.x0) / scale, fh: Math.max(4, hoehe * 0.82), ocr: true });
    }
    return gruppieren(teile, 0);
  }

  /* ---------- 2. Übersetzer ---------- */
  // Sätze zu Stücken von höchstens max Zeichen; ein einzelner überlanger Satz wird an Leerzeichen geteilt.
  const ZERLEGEN_AB = 4000, SATZ_MAX = 600;
  function saetze(t, max) {
    const roh = String(t).match(/[^.!?;:\n]+[.!?;:\n]*\s*/g) || [String(t)];
    const out = []; let akt = '';
    const leg = x => { x = x.trim(); if (x) out.push(x); };
    for (let s of roh) {
      while (s.length > max) { const cut = s.lastIndexOf(' ', max) > max / 2 ? s.lastIndexOf(' ', max) : max; if (akt) { leg(akt); akt = ''; } leg(s.slice(0, cut)); s = s.slice(cut); }
      if ((akt + s).length > max && akt) { leg(akt); akt = ''; }
      akt += s;
    }
    leg(akt);
    return out;
  }

  function browserDa() { return typeof self !== 'undefined' && 'Translator' in self; }
  // 'available' | 'downloadable' | 'downloading' | 'unavailable' | 'fehlt' (kein Translator im Browser)
  async function browserVerfuegbar(von, nach) {
    if (!browserDa()) return 'fehlt';
    try { return await self.Translator.availability({ sourceLanguage: von, targetLanguage: nach }); } catch (e) { return 'unavailable'; }
  }
  // Muss aus einem Tipp heraus aufgerufen werden, falls das Sprachpaket erst geladen wird.
  async function browserUebersetzer(von, nach, meldeLaden) {
    if (!browserDa()) throw new Error('Dieser Browser hat keinen eingebauten Übersetzer.');
    let tr = await self.Translator.create({ sourceLanguage: von, targetLanguage: nach,
      monitor(m) { m.addEventListener('downloadprogress', e => { if (meldeLaden) meldeLaden(e.loaded); }); } });
    const stat = { zeichen: 0, anfragen: 0, neustarts: 0, zerlegt: 0 };
    /* Klaus 2026-09-26: ein 384-Seiten-Handbuch brach nach 6 Seiten ab mit
       „Other generic failures occurred" — der allgemeine Fehler von Chromes
       eingebautem Übersetzer, keine Speichermeldung der App. Er ist oft
       vorübergehend (das Sprachmodell wurde entladen) oder kommt von einem zu
       langen Absatz. Deshalb: einmal einen NEUEN Übersetzer holen und noch einmal
       versuchen; scheitert es wieder, den Absatz in Sätze zerlegen. Erst dann
       gilt der Fehler — und wird gemeldet wie bisher. Ein Kontingent/429 und
       ein Abbruch durch den Nutzer werden NICHT wiederholt. */
    const nichtWiederholen = e => e && (e.name === 'AbortError' || e.name === 'NotAllowedError' || /429|Kontingent/i.test(e.message || ''));
    const einer = async t => {
      if (t.length > ZERLEGEN_AB) return stueckweise(t);
      try { return await tr.translate(t); }
      catch (e) {
        if (nichtWiederholen(e)) throw e;
        if (e && e.name === 'QuotaExceededError') return stueckweise(t, e);
        stat.neustarts++;
        try { tr.destroy && tr.destroy(); } catch (_) {}
        tr = await self.Translator.create({ sourceLanguage: von, targetLanguage: nach });
        try { return await tr.translate(t); }
        catch (e2) { if (nichtWiederholen(e2)) throw e2; return stueckweise(t, e2); }
      }
    };
    const stueckweise = async (t, fehler) => {
      // Bei einem Fehler höchstens halb so lang wie der Absatz, sonst bliebe ein kurzer Absatz ein Stück.
      const st = saetze(t, fehler ? Math.min(SATZ_MAX, Math.max(40, Math.floor(t.length / 2))) : SATZ_MAX);
      if (st.length < 2) { if (fehler) throw fehler; return tr.translate(t); }
      stat.zerlegt++;
      const out = []; for (const x of st) out.push(await tr.translate(x));
      return out.join(' ');
    };
    const fn = async texte => { const out = []; for (const t of texte) { stat.zeichen += t.length; stat.anfragen++; out.push(await einer(t)); } return out; };
    fn.stat = stat; fn.art = 'browser'; fn.zu = () => { try { tr.destroy && tr.destroy(); } catch (_) {} };
    return fn;
  }

  /* ---------- Chrome übersetzt die Seite (Klaus 2026-09-25) ----------
     Android-Chrome hat keine Übersetzer-Schnittstelle für Apps, aber ⋮ → Übersetzen
     übersetzt jeden ECHTEN Text auf der Seite (über Google). Also stellt die App die
     Absätze einer Seite als Text auf eine eigene Fläche, der Nutzer schaltet Chromes
     Übersetzung EINMAL ein, und die App liest, was Chrome daraus macht. Chrome
     übersetzt danach nachgeschobenen Text von selbst — so läuft es Seite für Seite.
     Erkennen: Chrome setzt `translated-ltr/-rtl` an <html> und hüllt jeden übersetzten
     Text in <font>. Die App-Oberfläche bekommt so lange translate="no" (sonst stünde
     sie danach auf Russisch), bis Chrome wieder das Original zeigt. */
  let _chromeAktiv = null;
  const chromeAn = () => /(^|\s)translated-(ltr|rtl)(\s|$)/.test(document.documentElement.className);
  // opt.tab(el): der Aufrufer hängt in el Knöpfe „In Chrome öffnen / Teilen / Adresse
  // kopieren" — nur er kennt Adresse und Dokumente (Klaus 2026-09-25: im installierten
  // App-Fenster fehlt oft „Übersetzen", und die Adresse kennt kaum jemand).
  // Welche Schrift steht da? null = passt (oder zu wenig Text, um es zu sagen)
  // Chrome merkt sich die zuletzt gewählte Zielsprache — und man kann sie mitten im Lauf
  // umstellen (Klaus 2026-09-26: Paschtu statt Englisch, im PDF standen Kästchen, weil die
  // Schrift keine arabischen Zeichen hat). Geprüft wird deshalb JEDE Schrift, nicht nur
  // kyrillisch ⟷ lateinisch: die Zielschrift muss den Text tragen. Namen und Kürzel in
  // fremder Schrift (PDF, Chrome) sind erlaubt, darum ein Anteil, keine Reinheit.
  // Benannte Grenze: DE und EN teilen die lateinische Schrift und sind so nicht zu trennen.
  const SCHRIFTEN = [
    ['Latin', 'eine Sprache in lateinischer Schrift'],
    ['Cyrillic', 'Russisch (kyrillische Schrift)'],
    ['Arabic', 'eine Sprache in arabischer Schrift (z. B. Arabisch, Persisch, Paschtu)'],
    ['Han', 'Chinesisch oder Japanisch'], ['Hiragana', 'Japanisch'], ['Katakana', 'Japanisch'], ['Hangul', 'Koreanisch'],
    ['Hebrew', 'Hebräisch'], ['Greek', 'Griechisch'], ['Devanagari', 'eine Sprache in Devanagari (z. B. Hindi)'], ['Thai', 'Thailändisch']];
  function falscheSchrift(text, nach) {
    const t = String(text), buchstaben = (t.match(/\p{L}/gu) || []).length;
    if (buchstaben < 20) return null;
    const ziel = nach === 'ru' ? 'Cyrillic' : 'Latin';
    const zahl = n => (t.match(new RegExp('\\p{Script=' + n + '}', 'gu')) || []).length;
    if (zahl(ziel) / buchstaben >= 0.4) return null;
    let best = null, bestN = 0;
    for (const [n, name] of SCHRIFTEN) if (n !== ziel) { const z = zahl(n); if (z > bestN) { best = name; bestN = z; } }
    return best || 'eine andere Schrift';
  }
  function chromeUebersetzer(von, nach, opt) {
    opt = opt || {};
    if (_chromeAktiv) { try { _chromeAktiv.zu(); } catch (_) {} }
    const stat = { zeichen: 0, anfragen: 0, ohne: 0, modell: 'Chrome (Google)' };
    const html = document.documentElement, langVorher = html.getAttribute('lang');
    const markiert = [];
    const markiere = el => { if (el === flaeche || el.nodeType !== 1 || el.tagName === 'SCRIPT' || el.hasAttribute('data-wfp-tr')) return; el.setAttribute('data-wfp-tr', el.getAttribute('translate') == null ? '' : el.getAttribute('translate')); el.setAttribute('translate', 'no'); markiert.push(el); };
    const flaeche = document.createElement('div');
    flaeche.id = 'wfp-chrome'; flaeche.setAttribute('translate', 'yes'); flaeche.setAttribute('lang', von);
    flaeche.style.cssText = 'position:fixed;left:0;right:0;bottom:0;height:46vh;z-index:2147483000;background:#fffdf5;border-top:3px solid #E0231B;box-shadow:0 -6px 20px rgba(0,0,0,.25);display:flex;flex-direction:column;font:14px/1.35 system-ui,sans-serif;color:#111';
    flaeche.innerHTML = '<div translate="no" data-kopf style="padding:10px 12px;background:#fff3cd;border-bottom:1px solid #e6d9a8"><b data-anl></b><div data-st style="font-size:12px;color:#555;margin-top:4px"></div><button type="button" data-halt style="margin-top:6px;padding:6px 10px;border:1px solid #999;border-radius:8px;background:#fff">⏹ Abbrechen</button><div data-tab style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px"></div></div><div data-liste style="overflow:auto;padding:8px 12px;flex:1"></div>';
    const anl = flaeche.querySelector('[data-anl]'), st = flaeche.querySelector('[data-st]'), liste = flaeche.querySelector('[data-liste]');
    const ANL = 'In Chrome oben rechts ⋮ → „Übersetzen" antippen und ' + NAME_DE[nach] + ' wählen. Danach läuft alles von selbst.';
    let halt = false, warte = null;
    flaeche.querySelector('[data-halt]').onclick = () => fn.halt();
    if (typeof opt.tab === 'function') { try { opt.tab(flaeche.querySelector('[data-tab]')); } catch (_) {} }
    const WARTE = opt.tab ? 'Warte auf Chromes Übersetzung … Fehlt „Übersetzen" (im installierten App-Fenster oft der Fall): „🌐 In Chrome öffnen" tippen — dort geht es mit denselben Seiten weiter.' : 'Warte auf Chromes Übersetzung … Im installierten App-Fenster gibt es ⋮ → „Übersetzen" nicht — dann ⏹ Abbrechen und einen anderen Weg wählen (Übersetzer im Browser oder KI).';
    const beob = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(markiere)));
    let offen = false;
    function auf() {
      if (offen) return; offen = true;
      [...document.body.children].forEach(markiere);
      beob.observe(document.body, { childList: true });
      html.setAttribute('lang', von);
      document.body.appendChild(flaeche);
      _chromeAktiv = fn;
    }
    const schlaf = ms => new Promise((r, j) => { const t = setTimeout(r, ms); warte = () => { clearTimeout(t); j(new Error('Angehalten')); }; });
    const hatText = t => /\p{L}/u.test(t);
    const fertigEl = (el, orig) => !hatText(orig) || !!el.querySelector('font') || el.textContent.replace(/\s+/g, ' ').trim() !== orig;
    const fn = async texte => {
      if (halt) throw new Error('Angehalten');
      auf();
      liste.innerHTML = '';
      const els = texte.map(t => { const p = document.createElement('p'); p.style.margin = '0 0 6px'; p.textContent = t; liste.appendChild(p); return p; });
      const orig = texte.map(t => String(t).replace(/\s+/g, ' ').trim());
      stat.anfragen++; stat.zeichen += texte.reduce((n, t) => n + t.length, 0);
      let letzt = Date.now(), vorher = -1, gescrollt = false;
      for (;;) {
        if (!chromeAn()) { anl.textContent = ANL; st.textContent = WARTE; letzt = Date.now(); await schlaf(400); continue; }
        const fertig = els.filter((el, i) => fertigEl(el, orig[i])).length;
        anl.textContent = 'Chrome übersetzt nach ' + NAME_DE[nach] + ' …';
        st.textContent = fertig + ' von ' + els.length + ' Absätzen dieser Seite übersetzt.';
        if (fertig === els.length) {
          // Übersetzt Chrome in die gewählte Sprache? Chrome merkt sich die letzte Zielsprache —
          // Klaus 2026-09-25: „auf Englisch gedrückt, und dann war es komplett in Russisch".
          // Unterscheiden lässt sich die SCHRIFT (kyrillisch · lateinisch), nicht Deutsch von Englisch.
          const falsch = falscheSchrift(els.map(el => el.textContent).join(' '), nach);
          if (falsch) {
            anl.textContent = 'Chrome hat nach ' + falsch + ' übersetzt — gewählt ist ' + NAME_DE[nach] + '. In Chrome ⋮ → „Übersetzen" → die Sprache auf ' + NAME_DE[nach] + ' umstellen.';
            st.textContent = 'Die App wartet und übernimmt nichts, bis der Text in ' + NAME_DE[nach] + ' dasteht.';
            anl.setAttribute('data-falsch', '1'); letzt = Date.now(); await schlaf(400); continue;
          }
          anl.removeAttribute('data-falsch');
          await schlaf(250); break;
        }
        if (fertig !== vorher) { vorher = fertig; letzt = Date.now(); gescrollt = false; }
        const still = Date.now() - letzt;
        if (still > 8000 && !gescrollt) { const e = els.find((el, i) => !fertigEl(el, orig[i])); if (e) e.scrollIntoView({ block: 'center' }); gescrollt = true; }
        if (still > 30000) { st.textContent = 'Chrome übersetzt nicht weiter. Falls nötig ⋮ → „Übersetzen" erneut antippen.'; if (still > 45000) break; }
        await schlaf(300);
      }
      return els.map((el, i) => { if (fertigEl(el, orig[i])) return el.textContent.replace(/\s+/g, ' ').trim(); stat.ohne++; return texte[i]; });
    };
    fn.stat = stat; fn.art = 'chrome';
    fn.halt = () => { if (halt) return; halt = true; if (warte) warte(); if (fn.beimHalt) fn.beimHalt(); };   // beimHalt: der Aufrufer merkt sich den Abbruch
    fn.zu = () => {
      flaeche.remove();
      if (langVorher == null) html.removeAttribute('lang'); else html.setAttribute('lang', langVorher);
      if (_chromeAktiv === fn) _chromeAktiv = null;
      // Die Markierung bleibt, solange Chrome übersetzt anzeigt — sonst würde es die App übersetzen.
      const frei = () => { beob.disconnect(); offen = false; markiert.splice(0).forEach(el => { const v = el.getAttribute('data-wfp-tr'); el.removeAttribute('data-wfp-tr'); if (v) el.setAttribute('translate', v); else el.removeAttribute('translate'); }); };
      if (!chromeAn()) return frei();
      const w = new MutationObserver(() => { if (!chromeAn()) { w.disconnect(); frei(); } });
      w.observe(html, { attributes: true, attributeFilter: ['class'] });
    };
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
    // Ein Tempo-Limit (Mistral: wenige Anfragen je Sekunde/Minute, gemessen am 2026-09-25
    // bei Klaus: 429 „Rate limit exceeded" trotz Guthaben) wird ABGEWARTET: Abstand
    // zwischen Anfragen, bis zu fünf Wiederholungen über gut zwei Minuten, und eine
    // Wartezeit, die der Anbieter nennt (Retry-After), gilt vor der eigenen.
    const ABSTAND = 1200, WIEDERHOL = [3000, 10000, 20000, 40000, 60000];
    let naechste = 0;
    async function frage(liste) {
      for (let v = 0; ; v++) {
        const pause = naechste - Date.now(); if (pause > 0) await warte(pause);
        naechste = Date.now() + ABSTAND;
        try { return await frage1(liste); }
        catch (e) {
          if (v >= WIEDERHOL.length || !/^(Zu viele|Fehler 5|Überlast)/.test(e.message)) throw e;
          const ms = Math.min(120000, Math.max(WIEDERHOL[v], e.warte || 0));
          stat.wartete = (stat.wartete || 0) + ms;
          if (fn.meldeWarten) fn.meldeWarten(ms, v + 1, WIEDERHOL.length);
          await warte(ms);
        }
      }
    }
    async function frage1(liste) {
      const nutz = JSON.stringify({ t: liste });
      stat.zeichen += liste.reduce((n, t) => n + t.length, 0); stat.anfragen++;
      let text;
      if (a.kind === 'anthropic') {
        const r = await fetch(a.base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
          body: JSON.stringify({ model: modell, max_tokens: 8000, system, messages: [{ role: 'user', content: nutz }] }) });
        if (!r.ok) throw await fehlerObj(r);
        const j = await r.json(); text = (j.content || []).map(c => c.text || '').join('');
        if (j.stop_reason === 'max_tokens') throw new Error('Antwort abgeschnitten');
        if (j.usage) { stat.tokenEin += j.usage.input_tokens || 0; stat.tokenAus += j.usage.output_tokens || 0; }
      } else {
        const body = { model: modell, max_tokens: 8000, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: nutz }], response_format: { type: 'json_object' } };
        const r = await fetch(a.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key }, body: JSON.stringify(body) });
        if (!r.ok) throw await fehlerObj(r);
        const j = await r.json(); text = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
        if (j.choices && j.choices[0] && j.choices[0].finish_reason === 'length') throw new Error('Antwort abgeschnitten');
        if (j.usage) { stat.tokenEin += j.usage.prompt_tokens || 0; stat.tokenAus += j.usage.completion_tokens || 0; }
      }
      const t = jsonAus(text).t;
      if (!Array.isArray(t) || t.length !== liste.length) throw new Error('KI lieferte ' + (Array.isArray(t) ? t.length : 0) + ' statt ' + liste.length + ' Einträgen');
      return t.map(x => String(x == null ? '' : x));
    }
    async function fehlerObj(r) {
      const e = new Error(await fehler(r));
      const ra = r.headers && r.headers.get('retry-after'); const sek = ra != null ? Number(ra) : NaN;
      if (isFinite(sek) && sek > 0) e.warte = sek * 1000;
      return e;
    }
    async function fehler(r) {
      let t = ''; try { t = await r.text(); } catch (_) {}
      let m = t; try { const j = JSON.parse(t); m = (j.error && (j.error.message || j.error.type)) || j.message || t; } catch (_) {}
      if (r.status === 401) return 'Schlüssel ungültig (401)';
      if (r.status === 529 || r.status === 503) return 'Überlast beim Anbieter (' + r.status + ')';
      if (r.status === 429) return /rate.?limit|too many|requests per/i.test(String(m))
        ? 'Zu viele Anfragen in kurzer Zeit (429, Tempo-Limit des Kontos). ' + String(m).slice(0, 120)
        : 'Zu viele Anfragen oder Kontingent erschöpft (429). ' + String(m).slice(0, 120);
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

  /* ---------- Aufteilen in Teile, VOR dem Übersetzen gerechnet (Klaus 2026-09-26) ----------
     „dass er vorher misst … in wie viele Teile muss ich die Datei teilen … rechnerisch
     nachweisbar". Gerechnet wird mit dem, was vor dem Lauf feststeht: Dateigröße und
     Seitenzahl. Jede Zahl steht mit ihrer Rechnung im Ergebnis (rechnung[]).
     Die Grenzen sind gewählt, nicht gemessen, und heißen so:
       TEIL_ZIEL_MB    — das Ergebnis-PDF eines Teils soll höchstens so groß werden
                         (es enthält die Originalseiten des Teils plus die Schrift)
       TEIL_MAX_SEITEN — höchstens so viele Seiten je Teil (wie in den WorkFlohs)
     Der Durchschnitt je Seite ist ein Durchschnitt: einzelne Teile werden größer oder
     kleiner. Die echte Größe jedes Teils steht nach dem Aufteilen daneben (gemessen). */
  const TEIL_ZIEL_MB = 8, TEIL_MAX_SEITEN = 40, SCHRIFT_MB = 0.3, MB = 1048576;
  function teilPlan(groesse, seiten, jeTeil) {
    seiten = Math.max(1, Math.floor(seiten || 1)); groesse = Math.max(0, +groesse || 0);
    const jeSeite = groesse / seiten, platz = TEIL_ZIEL_MB * MB - SCHRIFT_MB * MB;
    const nachGroesse = jeSeite > 0 ? Math.max(1, Math.floor(platz / jeSeite)) : seiten;
    const auto = Math.max(1, Math.min(TEIL_MAX_SEITEN, nachGroesse, seiten));
    const n = jeTeil > 0 ? Math.max(1, Math.min(seiten, Math.floor(jeTeil))) : auto;
    const teile = [];
    for (let v = 1; v <= seiten; v += n) { const bis = Math.min(seiten, v + n - 1); teile.push({ nr: teile.length + 1, von: v, bis, seiten: bis - v + 1, mb: ((bis - v + 1) * jeSeite + SCHRIFT_MB * MB) / MB }); }
    const f = x => x.toLocaleString('de-DE', { maximumFractionDigits: 1 });
    const rechnung = [
      `Datei ${f(groesse / MB)} MB ÷ ${seiten} Seiten = ${f(jeSeite / 1024)} KB je Seite (Durchschnitt)`,
      `Ziel je Teil höchstens ${TEIL_ZIEL_MB} MB, davon ${f(SCHRIFT_MB)} MB Schrift → ${f(platz / MB)} MB ÷ ${f(jeSeite / 1024)} KB = ${nachGroesse} Seiten`,
      `gedeckelt auf ${TEIL_MAX_SEITEN} Seiten je Teil → ${auto} Seiten je Teil`,
      (n !== auto ? `selbst gewählt: ${n} Seiten je Teil → ` : '') + `${seiten} Seiten ÷ ${n} = ${teile.length} Teil${teile.length === 1 ? '' : 'e'}` +
        (teile.length > 1 ? (teile[teile.length - 1].seiten === n ? ` (${teile.length} × ${n})` : ` (${teile.length - 1} × ${n} + 1 × ${teile[teile.length - 1].seiten})`) : '')
    ];
    return { groesse, seiten, jeSeiteKB: jeSeite / 1024, auto, jeTeil: n, teile, rechnung,
      noetig: seiten > TEIL_MAX_SEITEN || groesse > TEIL_ZIEL_MB * MB };
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
        const pr = seitenPruefer(bild, scale);
        if (!ocr && r.roh) { r.bloecke = []; for (const o of Object.keys(r.roh).map(Number)) r.bloecke.push(...gruppieren(r.roh[o].map(t => ({ ...t })), o, pr)); }
        // Bilder auf einer Seite mit Text: den Bildausschnitt groß rendern und lesen.
        // Was schon als echter Text über dem Bild liegt, wird nicht doppelt übernommen.
        let bildText = 0;
        if (!ocr && opt.ocr && r.bloecke.length) {
          const flaechen = (await bildFlaechen(page)).filter(f => !r.bloecke.some(b => b.x >= f[0] - 2 && b.y - b.h * 0.2 >= f[1] - 2 && b.x + b.w <= f[0] + f[2] + 2 && b.y + b.h <= f[1] + f[3] + 2 && b.w * b.h > f[2] * f[3] * 0.25));
          if (flaechen.length) {
            if (!ocrWorker && !ocrFehler) {
              if (opt.melde) opt.melde(stand.seiten.filter(Boolean).length, n, { ms: Date.now() - t0, neu, text: 'Texterkennung wird geladen …' });
              try { ocrWorker = await ocrStarten(opt.ocr.basis, opt.ocr.von); } catch (e) { ocrFehler = e.message || String(e); }
            }
            if (ocrWorker) {
              const S = 3, gross = await seitenBild(page, S);
              for (const [fx, fy, fw, fh] of flaechen) {
                const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(fw * S)); c.height = Math.max(1, Math.round(fh * S));
                c.getContext('2d').drawImage(gross, Math.round(fx * S), Math.round(fy * S), c.width, c.height, 0, 0, c.width, c.height);
                const neuB = (await ocrBloecke(ocrWorker, c, S, fx, fy)).filter(nb => !r.bloecke.some(b => b.x < nb.x + nb.w && b.x + b.w > nb.x && b.y - b.h < nb.y && b.y > nb.y - nb.h));
                bildText += neuB.length; r.bloecke.push(...neuB);
                c.width = c.height = 0;
              }
              gross.width = gross.height = 0;
              if (bildText) ocrSeiten++;
            }
          }
        }
        try { page.cleanup(); } catch (_) {}
        const b = r.bloecke.map(b => [b.x, b.y, b.w, b.h, b.s, b.z, b.t, b.o || 0]);
        b.forEach(x => x.push(...farben(bild, scale, x)));
        // [10] freie Breite rechts, [11] freie Höhe unten, [12] Zeilenrechtecke zum Abdecken
        const links = Math.max(18, Math.min(...b.map(x => x[0]).concat([r.w])));
        b.forEach((x, k) => { const f = (x[7] || 0) === 0 ? pr.frei(x, b, r.w - links) : [0, 0]; x.push(f[0], f[1], r.bloecke[k].zr || null); });
        bild.width = bild.height = 0; bild = null;
        const texte = r.bloecke.map(b => b.t);
        // Scheitert der Übersetzer (Kontingent, 429, Netz), bleibt das Übersetzte
        // gespeichert, und der Lauf meldet den Grund, statt ihn zu werfen —
        // sonst ginge die Teilübersetzung für den Aufrufer verloren.
        let u;
        try { u = texte.length ? (await opt.uebersetzer(texte)).map(zeichenNormal) : []; }
        catch (e) { fehler = (e && e.message) || String(e); break; }
        stand.seiten[i] = { b, u, gedreht: r.gedreht, t: r.t, ocr: ocr || bildText > 0 };
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
    const font = await pdf.embedFont(schrift, { subset: false });
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
      // Durchgang 1: je Absatz die Größe, in der er passt
      const groesse = s.b.map((b, k) => {
        const roh = s.u && s.u[k]; if (roh == null) return null;
        const [, , w, h, size] = b, text = saeubern(font, roh).text;
        const W2 = w + (+b[10] || 0), H2 = h + (+b[11] || 0);
        const ok = (g, br, ho, zu = 0) => { const z = umbrechen(font, text, g, br); return z.length * g * 1.18 <= ho + g * zu && !z.some(t => font.widthOfTextAtSize(t, g) > br + 0.5); };
        let g = Math.min(size, 40); if (ok(g, w, h, 0.3) || ok(g, W2, h, 0.3) || ok(g, W2, H2)) return g;
        while (g > 3.5 && !ok(g, W2, H2)) g -= 0.25; return g;
      });
      // Angleichen: gleiche Originalgröße in derselben Spalte bekommt dieselbe Größe —
      // sonst springt die Schrift von Listenpunkt zu Listenpunkt. Nicht unter 70 % des Originals.
      // Zwei Sorten Nachbarn: dieselbe Spalte (Listenpunkte) und dieselbe Zeile (Ankreuz-Reihe „Ja · Nein").
      const gruppen = b => ['s' + (b[7] || 0) + ':' + Math.round(b[0] / 3) + ':' + Math.round(b[4] * 2),
        // nur kurze Beschriftungen — eine lange Frage in derselben Zeile ist kein Nachbar
        ...(String(b[6] || '').length <= 24 ? ['z' + (b[7] || 0) + ':' + Math.round(b[1] / 3) + ':' + Math.round(b[4] * 2)] : [])];
      const kleinste = {};
      s.b.forEach((b, k) => { const g = groesse[k]; if (g == null || g < Math.min(b[4], 40) * 0.7) return;
        for (const schl of gruppen(b)) kleinste[schl] = Math.min(kleinste[schl] == null ? 99 : kleinste[schl], g); });
      const angeglichen = (b, g) => gruppen(b).reduce((m, schl) => kleinste[schl] == null ? m : Math.min(m, kleinste[schl]), g);
      s.b.forEach((b, k) => {
        const [x, y, w, h, size, , , o = 0, bgF = '#ffffff', fgF = '#111111'] = b; const roh = s.u && s.u[k];
        const ziel = groesse[k] == null ? null : angeglichen(b, groesse[k]);
        const farbe = f => { const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(f) || [0, 'ff', 'ff', 'ff']; return rgb(parseInt(m[1], 16) / 255, parseInt(m[2], 16) / 255, parseInt(m[3], 16) / 255); };
        if (roh == null) return;
        const { text, ersetzt: e } = saeubern(font, roh); ersetzt += e;
        // Punkt im Rahmen des Absatzes (Text läuft nach rechts) → Anzeige → PDF
        const p = (dx, dy) => { const d = ausRahmen(o, x + dx, y + dy); return inv(d[0], d[1]); };
        const dreh = degrees(winkel - o);
        const pad = Math.max(0.6, size * 0.08);
        const zr = b[12];
        if (zr && zr.length) for (const [zx, zy, zw, zh] of zr) {
          const a = ausRahmen(o, zx - pad, zy + zh + pad), q = inv(a[0], a[1]);
          page.drawRectangle({ x: q[0], y: q[1], width: zw + 2 * pad, height: zh + 2 * pad, color: farbe(bgF), rotate: dreh });
        } else {
          const a = p(-pad, h + pad);
          page.drawRectangle({ x: a[0], y: a[1], width: w + 2 * pad, height: h + 2 * pad, color: farbe(bgF), rotate: dreh });
        }
        // Erst in der Größe des Originals: im alten Rahmen, dann mit dem freien Platz
        // rechts, dann auch unten — erst danach wird die Schrift kleiner.
        const W2 = w + (+b[10] || 0), H2 = h + (+b[11] || 0);
        const passt = (g, br, ho, zu = 0) => { const z = umbrechen(font, text, g, br); return z.length * g * 1.18 <= ho + g * zu && !z.some(t => font.widthOfTextAtSize(t, g) > br + 0.5) ? z : null; };
        let gr = ziel, zeilen = passt(gr, w, h, 0.3) || passt(gr, W2, h, 0.3) || passt(gr, W2, H2);
        while (!zeilen && gr > 3.5) { gr -= 0.25; zeilen = passt(gr, W2, H2); }
        if (!zeilen) zeilen = umbrechen(font, text, gr, W2);
        if (gr < size * 0.6) zuKlein++;
        zeilen.forEach((z, j) => {
          const q = p(0, (j + 1) * gr * 1.18 - gr * 0.22);
          page.drawText(z, { x: q[0], y: q[1], size: gr, font, color: farbe(fgF), rotate: dreh });
        });
      });
    }
    if (offen) hinweise.push(offen + ' Seite(n) sind noch nicht übersetzt (Lauf abgebrochen) und stehen im Original da.');
    if (ohneText) hinweise.push(ohneText + ' Seite(n) ohne erkennbaren Text (leer, nur Bild, oder Texterkennung nicht verfügbar) bleiben wie im Original.');
    if (ocr) hinweise.push('Auf ' + ocr + ' Seite(n) wurde Text in Scans oder Bildern per Texterkennung (OCR) gelesen — dort bitte die Übersetzung gegenlesen, Erkennungsfehler sind möglich.');
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
  window.WFP.Uebersetzung = { zeichenNormal, saetze, teilPlan, TEIL_ZIEL_MB, TEIL_MAX_SEITEN, SPRACHEN, NAME_DE, KI_TEXTMODELL, bloecke, browserDa, browserVerfuegbar, browserUebersetzer, chromeUebersetzer, falscheSchrift, chromeAn, kiUebersetzer, lauf, rueck, schriftLaden, pdfBauen, anzeige, farben, ocrStarten };
})();
