/* Workfloh PDF — Scannen: aus Fotos ein sauberes PDF (Klaus 2026-09-26).
   „Vorher möchte ich, dass sie vernünftig formatiert ist, zugeschnitten … Texte, die
   schon drin sind, durch ein OCR-Programm erkennen und direkt ändern."

   Ablauf je Seite: Foto → Blatt finden (drei Verfahren, siehe assets/scan-bild.js)
   → Ecken prüfen/nachziehen → gerade ziehen (A4 · Letter · wie das Blatt) → drehen
   → Filter, Helligkeit, Kontrast → Text erkennen, Zeilen ändern → PDF (auf Wunsch
   durchsuchbar) · Teilen · Herunterladen · Bilder als ZIP.

   Ohne KI und ohne Netz. Die Blatterkennung mit Modell (Scanic, MIT, vendor/scanic/)
   und die Texterkennung (Tesseract, vendor/tesseract/) laufen auf dem Gerät und
   werden erst beim ersten Gebrauch geladen. Lädt das Modell nicht, arbeitet die
   Erkennung ohne es weiter und sagt das. Nichts wird still geschnitten: sind sich
   die Verfahren nicht einig, steht die Seite auf „bitte prüfen". */
(function () {
  'use strict';
  const SB = () => WFP.ScanBild;
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MERK = 'wfpdf_scan_v1';
  const merk = (() => { try { return Object.assign({ filter: 'farbe', format: 'a4', qualitaet: 'normal', durchsuchbar: false, sprache: '' }, JSON.parse(localStorage.getItem(MERK) || '{}')); } catch (_) { return { filter: 'farbe', format: 'a4', qualitaet: 'normal', durchsuchbar: false, sprache: '' }; } })();
  const merken = () => { try { localStorage.setItem(MERK, JSON.stringify(merk)); } catch (_) {} };

  const FILTER_NAME = { original: 'Original', farbe: 'Farbe', grau: 'Graustufen', dokument: 'Dokument', sw: 'Schwarzweiß' };
  const QUALI = { hoch: { dpi: 200, q: 0.9, name: 'Hoch (200 dpi)' }, normal: { dpi: 150, q: 0.85, name: 'Normal (150 dpi)' }, klein: { dpi: 110, q: 0.72, name: 'Klein (110 dpi)' } };
  const FORMAT = { a4: 'A4', letter: 'US Letter', blatt: 'Wie das Blatt' };
  const SPRACHEN = { deu: 'Deutsch', eng: 'English', rus: 'Русский' };
  const VORSCHAU_DPI = 80, OCR_DPI = 200;

  let ST = null;   // Zustand des offenen Werkzeugs

  /* ---------- Bilder ---------- */
  async function fotoLesen(file) {
    let bmp = null;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {
      const url = URL.createObjectURL(file);
      try { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild „' + file.name + '" lässt sich nicht lesen')); i.src = url; }); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    // Die Kamera entscheidet die Auflösung, nicht der Nutzer: verkleinern statt abweisen.
    const f = Math.min(1, 2400 / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.round(w0 * f); c.height = Math.round(h0 * f);
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    try { bmp.close && bmp.close(); } catch (_) {}
    return c;
  }
  const bildDaten = c => c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  function zuCanvas(img) { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; c.getContext('2d').putImageData(new ImageData(img.data, img.width, img.height), 0, 0); return c; }

  /* ---------- Blatt finden ---------- */
  let _scanic = null, _mlFehler = '';
  function scanicLaden() {
    if (!_scanic) _scanic = import(new URL('vendor/scanic/scanic.js', location.href).href).catch(e => { _mlFehler = 'Blatterkennung (Scanic) lädt nicht: ' + (e.message || e); return null; });
    return _scanic;
  }
  async function erkennen(s) {
    const c = s.foto, w = c.width, hh = c.height, ein = {};
    try { if (WFP.Blatt) ein.blatt = WFP.Blatt.finden(c); } catch (_) {}
    const sc = await scanicLaden();
    if (sc) {
      try { const r = await sc.scanDocument(c); if (r && r.success) ein.klassisch = { ecken: SB().ausScanic(r.corners) }; } catch (_) {}
      try {
        const r = await sc.scanDocument(c, { detector: 'ml', ml: { assetBaseUrl: new URL('vendor/scanic/', location.href).href } });
        if (r && r.corners) ein.ml = { ecken: SB().ausScanic(r.corners), score: r.score };
      } catch (e) { _mlFehler = 'Modell nicht verfügbar: ' + (e.message || e); }
    }
    s.erkennung = SB().entscheiden(ein, w, hh);
    s.erkennung.verfahren = { blatt: !!(ein.blatt && ein.blatt.sicher), klassisch: !!ein.klassisch, ml: !!ein.ml };
    if (!s.manuell) { s.ecken = s.erkennung.ecken.map(p => p.slice()); s.ocr = null; s.aenderungen = {}; }
  }

  /* ---------- Seite rechnen ---------- */
  function schluessel(s, dpi, mitText) {
    return JSON.stringify([s.ecken, s.drehung, s.filter, s.hell, s.kontrast, ST.format, dpi, mitText ? s.aenderungen : 0]);
  }
  // Ergebnis einer Seite als Canvas: entzerren → drehen → Filter → geänderter Text
  function seiteRechnen(s, dpi, mitText) {
    const m = SB().seitenMass(s.ecken, ST.format, dpi);
    let img = SB().entzerren(bildDaten(s.foto), s.ecken, m.W, m.H);
    img = SB().drehen(img, s.drehung);
    SB().filtern(img, s.filter, { hell: s.hell, kontrast: s.kontrast });
    const c = zuCanvas(img);
    if (mitText !== false && s.ocr) textAnwenden(c, img, s);
    const quer = s.drehung % 2 ? !m.quer : m.quer, seite = s.drehung % 2 ? [m.seite[1], m.seite[0]] : m.seite;
    return { canvas: c, seite, quer };
  }
  function vorschau(s) {
    const k = schluessel(s, VORSCHAU_DPI, true);
    if (s._vk !== k) { s._v = seiteRechnen(s, VORSCHAU_DPI).canvas; s._vk = k; }
    return s._v;
  }
  // Geänderte Zeilen: Papierfarbe darüber, neuer Text in Schriftfarbe an dieselbe Stelle
  function textAnwenden(c, img, s) {
    const x = c.getContext('2d'); const W = c.width, H = c.height;
    for (const [i, neu] of Object.entries(s.aenderungen || {})) {
      const z = s.ocr.zeilen[+i]; if (!z) continue;
      const b = { x: z.box[0] * W, y: z.box[1] * H, w: z.box[2] * W, h: z.box[3] * H };
      const f = SB().textFarben(img, b), pad = Math.max(1, b.h * 0.12);
      x.fillStyle = `rgb(${f.grund.join(',')})`; x.fillRect(b.x - pad, b.y - pad, b.w + 2 * pad, b.h + 2 * pad);
      if (!neu) continue;
      let fs = b.h * 0.9; x.font = `${fs}px Arial, Helvetica, sans-serif`;
      const breite = x.measureText(neu).width;
      if (breite > b.w * 1.02) { fs = Math.max(b.h * 0.55, fs * b.w / breite); x.font = `${fs}px Arial, Helvetica, sans-serif`; }
      x.fillStyle = `rgb(${f.schrift.join(',')})`; x.textBaseline = 'alphabetic';
      x.fillText(neu, b.x, b.y + b.h * 0.82);
    }
  }

  /* ---------- Texterkennung ---------- */
  let _ocr = null;   // { sprache, worker }
  async function ocrWorker(sprache) {
    if (_ocr && _ocr.sprache === sprache) return _ocr.worker;
    if (_ocr) { try { await _ocr.worker.terminate(); } catch (_) {} _ocr = null; }
    if (!window.Tesseract) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/tesseract/tesseract.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Texterkennung (Tesseract) lädt nicht')); document.head.appendChild(sc); });
    const abs = u => new URL(u, location.href).href;
    const w = await window.Tesseract.createWorker(sprache, 1, { workerPath: abs('vendor/tesseract/worker.min.js'), corePath: abs('vendor/tesseract/'), langPath: abs('vendor/tesseract/lang'), gzip: false, cacheMethod: 'none' });
    _ocr = { sprache, worker: w };
    return w;
  }
  async function ocrSeite(s) {
    const r0 = seiteRechnen(s, OCR_DPI, false), c = r0.canvas;
    const w = await ocrWorker(ST.sprache);
    const r = await w.recognize(c, {}, { blocks: true, text: false });
    const zeilen = [];
    for (const bl of (r.data.blocks || [])) for (const pa of (bl.paragraphs || [])) for (const li of (pa.lines || [])) {
      const t = String(li.text || '').replace(/\s+/g, ' ').trim();
      if (!t || li.confidence < 30 || !/[\p{L}\p{N}]/u.test(t)) continue;
      const bb = li.bbox;
      zeilen.push({ text: t, conf: Math.round(li.confidence), box: [bb.x0 / c.width, bb.y0 / c.height, (bb.x1 - bb.x0) / c.width, (bb.y1 - bb.y0) / c.height] });
    }
    s.ocr = { zeilen, sprache: ST.sprache, schluessel: JSON.stringify([s.ecken, s.drehung, ST.format]) };
    s.aenderungen = {};
    return s.ocr;
  }
  const ocrGilt = s => s.ocr && s.ocr.schluessel === JSON.stringify([s.ecken, s.drehung, ST.format]);

  /* ---------- PDF ---------- */
  async function schriftFuer(pdf, texte) {
    const { StandardFonts } = PDFLib;
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    try { for (const t of texte) helv.encodeText(t); return helv; } catch (_) {}
    // Nicht-lateinische Zeichen (z. B. Kyrillisch): Noto Sans, GANZ eingebettet (siehe CLAUDE.md, Teilmenge verlor Buchstaben)
    if (!window.fontkit) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = 'vendor/fontkit.umd.min.js'; sc.onload = res; sc.onerror = () => rej(new Error('Schrift lädt nicht')); document.head.appendChild(sc); });
    pdf.registerFontkit(window.fontkit);
    const bytes = new Uint8Array(await (await fetch('vendor/fonts/NotoSans-Regular.ttf')).arrayBuffer());
    return pdf.embedFont(bytes, { subset: false });
  }
  async function jpeg(c, q) { return new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', q))).arrayBuffer()); }
  async function pdfBauen(melde) {
    const { PDFDocument } = PDFLib; const Q = QUALI[ST.qualitaet] || QUALI.normal;
    const seiten = ST.seiten.filter(s => s.ecken);
    if (ST.durchsuchbar) for (let i = 0; i < seiten.length; i++) if (!ocrGilt(seiten[i])) { melde && melde(i / seiten.length, 'Text erkennen · Seite ' + (i + 1) + ' von ' + seiten.length); await ocrSeite(seiten[i]); }
    const pdf = await PDFDocument.create();
    const texte = []; if (ST.durchsuchbar) for (const s of seiten) s.ocr.zeilen.forEach((z, i) => texte.push(zeilenText(s, i)));
    const font = texte.length ? await schriftFuer(pdf, texte) : null;
    for (let i = 0; i < seiten.length; i++) {
      const s = seiten[i]; melde && melde(i / seiten.length, 'Seite ' + (i + 1) + ' von ' + seiten.length + ' rechnen');
      const r = seiteRechnen(s, Q.dpi, true);
      const img = await pdf.embedJpg(await jpeg(r.canvas, Q.q));
      const [pw, ph] = r.seite, p = pdf.addPage([pw, ph]);
      p.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
      if (ST.durchsuchbar && s.ocr) {
        // unsichtbare Textebene: markieren, kopieren, durchsuchen — gezeichnet wird nichts
        s.ocr.zeilen.forEach((z, zi) => {
          const t = zeilenText(s, zi); if (!t) return;
          const bw = z.box[2] * pw, bh = z.box[3] * ph; const w1 = font.widthOfTextAtSize(t, 1) || 1;
          const size = Math.max(1, Math.min(bh * 0.95, bw / w1));
          try { p.drawText(t, { x: z.box[0] * pw, y: ph - (z.box[1] + z.box[3]) * ph + bh * 0.18, size, font, opacity: 0 }); } catch (_) {}
        });
      }
    }
    pdf.setProducer('Workfloh PDF'); pdf.setCreator('Workfloh PDF · Scannen');
    return pdf.save();
  }
  const zeilenText = (s, i) => (s.aenderungen && Object.prototype.hasOwnProperty.call(s.aenderungen, i)) ? s.aenderungen[i] : s.ocr.zeilen[i].text;

  /* ---------- Oberfläche ---------- */
  const $q = sel => ST.el.querySelector(sel);
  function oeffnen(opt) {
    if (ST) schliessen();
    opt = opt || {};
    const sprache0 = merk.sprache || ({ de: 'deu', en: 'eng', ru: 'rus' }[(WFP.Sprache && WFP.Sprache.lang) || 'de'] || 'deu');
    ST = { opt, seiten: [], akt: -1, ansicht: 'zuschnitt', textModus: false, format: merk.format, qualitaet: merk.qualitaet, durchsuchbar: merk.durchsuchbar, sprache: sprache0, name: opt.name || ('Scan ' + new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })), el: null };
    const el = document.createElement('div'); el.className = 'scan'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `
      <div class="scan-kopf">
        <b class="scan-titel">📷 ${h(opt.titel || 'Scannen')}</b><span class="scan-anz" data-anz></span>
        <button class="knopf klein" data-schliessen>✕ Schließen</button>
      </div>
      <div class="scan-haupt">
        <div class="scan-buehne" data-buehne></div>
        <div class="scan-werkzeug" data-werkzeug></div>
      </div>
      <div class="scan-leiste" data-leiste></div>
      <div class="scan-fuss" data-fuss></div>
      <input type="file" accept="image/*" capture="environment" data-in-kamera hidden>
      <input type="file" accept="image/*" multiple data-in-galerie hidden>`;
    document.body.appendChild(el); ST.el = el; document.body.classList.add('scan-offen');
    $q('[data-schliessen]').onclick = async () => { if (!ST.seiten.length || await opt.frage('Scan verwerfen?', '<p>Die aufgenommenen Seiten werden nicht gespeichert.</p>', 'Verwerfen')) schliessen(); };
    $q('[data-in-kamera]').onchange = e => { const f = [...(e.target.files || [])]; e.target.value = ''; hinzu(f); };
    $q('[data-in-galerie]').onchange = e => { const f = [...(e.target.files || [])]; e.target.value = ''; hinzu(f); };
    zeichne();
    if (opt.dateien && opt.dateien.length) hinzu(opt.dateien);
    else if (opt.start === 'kamera') $q('[data-in-kamera]').click();
    else if (opt.start === 'galerie') $q('[data-in-galerie]').click();
    scanicLaden();   // schon einmal holen, während fotografiert wird
    return ST;
  }
  function schliessen() {
    if (!ST) return;
    ST.el.remove(); document.body.classList.remove('scan-offen'); ST = null;
    if (_ocr) { const w = _ocr.worker; _ocr = null; try { w.terminate(); } catch (_) {} }
  }
  async function hinzu(dateien) {
    const bilder = dateien.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(f.name));
    if (!bilder.length) { if (dateien.length) ST.opt.toast('Keine Bilddatei gewählt.'); return; }
    for (const f of bilder) {
      if (!ST) return;
      let foto; try { foto = await fotoLesen(f); } catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); continue; }
      const s = { id: Math.random().toString(36).slice(2), name: f.name, foto, erkennung: null, ecken: null, manuell: false, drehung: 0, filter: merk.filter, hell: 0, kontrast: 0, ocr: null, aenderungen: {} };
      ST.seiten.push(s); ST.akt = ST.seiten.length - 1; ST.ansicht = 'zuschnitt'; ST.textModus = false;
      zeichne();
      await erkennen(s);
      if (!ST) return;
      zeichne();
    }
    melden();
  }
  function melden() {
    if (!ST) return;
    window.__wfpdfScan = { seiten: ST.seiten.map(s => ({ name: s.name, ecken: s.ecken, erkennung: s.erkennung && { quelle: s.erkennung.quelle, sicher: s.erkennung.sicher, grund: s.erkennung.grund, verfahren: s.erkennung.verfahren }, manuell: s.manuell, drehung: s.drehung, filter: s.filter, hell: s.hell, kontrast: s.kontrast, foto: [s.foto.width, s.foto.height], ocr: s.ocr ? s.ocr.zeilen.length : null, aenderungen: Object.assign({}, s.aenderungen) })), akt: ST.akt, format: ST.format, qualitaet: ST.qualitaet, durchsuchbar: ST.durchsuchbar, mlFehler: _mlFehler };
  }
  const akt = () => ST && ST.seiten[ST.akt];

  function zeichne() {
    if (!ST) return;
    const n = ST.seiten.length;
    $q('[data-anz]').textContent = n ? n + (n === 1 ? ' Seite' : ' Seiten') : '';
    zeichneBuehne(); zeichneWerkzeug(); zeichneLeiste(); zeichneFuss(); melden();
  }
  function zeichneBuehne() {
    const b = $q('[data-buehne]'), s = akt();
    if (!s) {
      b.innerHTML = `<div class="scan-leer"><p>Blatt auf einen dunklen Untergrund legen, gerade von oben und gut beleuchtet fotografieren. Mehrere Seiten werden ein PDF.</p>
        <div class="zeile"><button class="knopf rot" data-kamera>📷 Kamera</button><button class="knopf" data-galerie>🖼 Aus der Galerie</button></div></div>`;
      b.querySelector('[data-kamera]').onclick = () => $q('[data-in-kamera]').click();
      b.querySelector('[data-galerie]').onclick = () => $q('[data-in-galerie]').click();
      return;
    }
    if (!s.ecken) { b.innerHTML = '<div class="scan-leer"><p class="scan-sucht">🔎 Blatt wird gesucht …</p></div>'; return; }
    if (ST.ansicht === 'zuschnitt') zeichneZuschnitt(b, s); else zeichneErgebnis(b, s);
  }

  /* Zuschnitt: das Foto mit vier Ecken zum Ziehen und einer Lupe */
  function zeichneZuschnitt(b, s) {
    b.innerHTML = '<div class="scan-bild" data-rahmen><canvas data-foto></canvas><svg class="scan-linie" data-svg></svg><canvas class="scan-lupe" data-lupe width="120" height="120" hidden></canvas></div>';
    const rahmen = b.querySelector('[data-rahmen]'), cv = b.querySelector('[data-foto]'), svg = b.querySelector('[data-svg]'), lupe = b.querySelector('[data-lupe]');
    const maxW = Math.max(200, b.clientWidth - 8), maxH = Math.max(200, b.clientHeight - 8);
    const f = Math.min(maxW / s.foto.width, maxH / s.foto.height, 1);
    const W = Math.round(s.foto.width * f), H = Math.round(s.foto.height * f);
    cv.width = W; cv.height = H; cv.getContext('2d').drawImage(s.foto, 0, 0, W, H);
    rahmen.style.width = W + 'px'; rahmen.style.height = H + 'px';
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('width', W); svg.setAttribute('height', H);
    const griffe = s.ecken.map((p, i) => { const g = document.createElement('button'); g.className = 'scan-griff'; g.dataset.ecke = i; g.setAttribute('aria-label', ['Ecke oben links', 'Ecke oben rechts', 'Ecke unten rechts', 'Ecke unten links'][i]); rahmen.appendChild(g); return g; });
    const male = () => {
      svg.innerHTML = `<polygon points="${s.ecken.map(p => (p[0] * f) + ',' + (p[1] * f)).join(' ')}"/>`;
      griffe.forEach((g, i) => { g.style.left = (s.ecken[i][0] * f) + 'px'; g.style.top = (s.ecken[i][1] * f) + 'px'; });
    };
    male();
    griffe.forEach((g, i) => {
      g.onpointerdown = e => {
        e.preventDefault(); g.setPointerCapture(e.pointerId); lupe.hidden = false;
        const r0 = rahmen.getBoundingClientRect();
        const bewege = ev => {
          const x = Math.max(0, Math.min(W, ev.clientX - r0.left)), y = Math.max(0, Math.min(H, ev.clientY - r0.top));
          s.ecken[i] = [x / f, y / f]; s.manuell = true; male();
          // Lupe: 3-fach um den Finger, auf der anderen Seite, damit der Finger sie nicht verdeckt
          const lx = lupe.getContext('2d'), z = 3, gr = 120 / z;
          lx.fillStyle = '#fff'; lx.fillRect(0, 0, 120, 120);
          lx.drawImage(s.foto, s.ecken[i][0] - gr / 2 / f * 1, s.ecken[i][1] - gr / 2 / f * 1, gr / f, gr / f, 0, 0, 120, 120);
          lx.strokeStyle = '#E0231B'; lx.lineWidth = 2; lx.beginPath(); lx.moveTo(60, 48); lx.lineTo(60, 72); lx.moveTo(48, 60); lx.lineTo(72, 60); lx.stroke();
          lupe.style.left = (x < W / 2 ? W - 128 : 8) + 'px'; lupe.style.top = '8px';
        };
        bewege(e);
        g.onpointermove = bewege;
        g.onpointerup = g.onpointercancel = () => { g.onpointermove = null; lupe.hidden = true; s.ocr = null; s.aenderungen = {}; zeichneLeiste(); zeichneWerkzeug(); melden(); };
      };
    });
  }
  /* Ergebnis: die fertige Seite; im Text-Modus liegen die erkannten Zeilen als Kästen darüber */
  function zeichneErgebnis(b, s) {
    const c = vorschau(s);
    b.innerHTML = '<div class="scan-bild" data-rahmen><img data-ergebnis alt=""><div class="scan-zeilen" data-zeilen></div></div>';
    const img = b.querySelector('[data-ergebnis]'), rahmen = b.querySelector('[data-rahmen]');
    const maxW = Math.max(200, b.clientWidth - 8), maxH = Math.max(200, b.clientHeight - 8);
    const f = Math.min(maxW / c.width, maxH / c.height);
    rahmen.style.width = Math.round(c.width * f) + 'px'; rahmen.style.height = Math.round(c.height * f) + 'px';
    img.src = c.toDataURL('image/jpeg', 0.85);
    if (ST.textModus && s.ocr) {
      const z = b.querySelector('[data-zeilen]');
      z.innerHTML = s.ocr.zeilen.map((zl, i) => `<button data-kein-ue class="scan-zeile${Object.prototype.hasOwnProperty.call(s.aenderungen, i) ? ' geaendert' : ''}" data-zeile="${i}" style="left:${zl.box[0] * 100}%;top:${zl.box[1] * 100}%;width:${zl.box[2] * 100}%;height:${zl.box[3] * 100}%" title="${h(zeilenText(s, i))}"></button>`).join('');
      z.querySelectorAll('[data-zeile]').forEach(k => k.onclick = () => zeileAendern(s, +k.dataset.zeile));
    }
  }
  function zeileAendern(s, i) {
    const alt = s.ocr.zeilen[i].text, jetzt = zeilenText(s, i);
    ST.opt.dialog(`<h2>✎ Text ändern</h2><p class="hinweis">Erkannt (Sicherheit ${s.ocr.zeilen[i].conf} %): <span data-kein-ue>${h(alt)}</span></p>
      <textarea data-t rows="3" data-kein-ue>${h(jetzt)}</textarea>
      <p class="hinweis">Die alte Zeile wird mit der Papierfarbe überdeckt und der neue Text in der Schriftfarbe an dieselbe Stelle geschrieben. Leer lassen entfernt die Zeile.</p>
      <div class="zeile"><button class="knopf" data-n>Abbrechen</button><button class="knopf" data-r>↺ Wie erkannt</button><button class="knopf rot" data-j>Übernehmen</button></div>`, (d, zu) => {
      const t = d.querySelector('[data-t]'); t.focus(); t.select();
      d.querySelector('[data-n]').onclick = zu;
      d.querySelector('[data-r]').onclick = () => { delete s.aenderungen[i]; zu(); zeichne(); };
      d.querySelector('[data-j]').onclick = () => { const v = t.value.replace(/\s+/g, ' ').trim(); if (v === alt) delete s.aenderungen[i]; else s.aenderungen[i] = v; zu(); zeichne(); };
    });
  }

  function zeichneWerkzeug() {
    const w = $q('[data-werkzeug]'), s = akt();
    if (!s || !s.ecken) { w.innerHTML = ''; return; }
    const e = s.erkennung || {};
    const tabs = `<div class="scan-tabs" role="tablist"><button class="modus-k${ST.ansicht === 'zuschnitt' ? ' on' : ''}" data-ansicht="zuschnitt">✂ Zuschneiden</button><button class="modus-k${ST.ansicht === 'ergebnis' ? ' on' : ''}" data-ansicht="ergebnis">✨ Ergebnis</button></div>`;
    let inhalt;
    if (ST.ansicht === 'zuschnitt') {
      inhalt = `<p class="scan-befund ${s.manuell ? 'hand' : e.sicher ? 'ok' : 'pruefen'}" data-befund="${s.manuell ? 'hand' : e.sicher ? 'ok' : 'pruefen'}">${s.manuell ? '✋ Ecken von Hand gesetzt' : e.sicher ? '✓ Blatt erkannt' : '⚠ Bitte Ecken prüfen'}<small>${s.manuell ? '' : h(e.grund || '')}</small></p>
        <p class="hinweis">Die roten Punkte an die Ecken des Papiers ziehen. Eine Lupe zeigt, wo der Finger ist.</p>
        <div class="scan-knoepfe"><button class="knopf" data-auto>↺ Automatisch</button><button class="knopf" data-ganz>▢ Ganzes Foto</button></div>
        <button class="knopf rot scan-weiter" data-ansicht="ergebnis">✓ Zuschnitt passt → Ergebnis</button>`;
    } else {
      inhalt = `<div class="scan-gruppe"><b>Filter</b><div class="scan-chips">${SB().FILTER.map(k => `<button class="chip${s.filter === k ? ' on' : ''}" data-filter="${k}">${FILTER_NAME[k]}</button>`).join('')}</div></div>
        <label class="scan-regler">☀ Helligkeit <input type="range" min="-100" max="100" step="5" value="${s.hell}" data-hell><output>${s.hell}</output></label>
        <label class="scan-regler">◐ Kontrast <input type="range" min="-100" max="100" step="5" value="${s.kontrast}" data-kontrast><output>${s.kontrast}</output></label>
        <div class="scan-knoepfe"><button class="knopf" data-dreh="-1" title="Nach links drehen">⟲ Links</button><button class="knopf" data-dreh="1" title="Nach rechts drehen">⟳ Rechts</button><button class="knopf" data-alle>Auf alle Seiten anwenden</button></div>
        <div class="scan-gruppe"><b>Text</b>
          <div class="scan-knoepfe"><select data-sprache title="Sprache der Texterkennung">${Object.entries(SPRACHEN).map(([k, v]) => `<option value="${k}"${ST.sprache === k ? ' selected' : ''}>${h(v)}</option>`).join('')}</select>
          <button class="knopf" data-ocr>🔤 Text erkennen</button>${s.ocr ? `<button class="knopf${ST.textModus ? ' an' : ''}" data-textmodus>✎ Text ändern</button>` : ''}</div>
          <p class="hinweis" data-ocrstand>${s.ocr ? s.ocr.zeilen.length + ' Zeilen erkannt' + (Object.keys(s.aenderungen).length ? ' · ' + Object.keys(s.aenderungen).length + ' geändert' : '') + (ST.textModus ? ' — eine Zeile antippen, um sie zu ändern.' : '') : 'Erkennt den Text auf dem Gerät. Danach lassen sich Zeilen ändern, und das PDF wird durchsuchbar.'}</p></div>
        <button class="knopf gefahr" data-weg>🗑 Seite entfernen</button>`;
    }
    w.innerHTML = tabs + inhalt;
    w.querySelectorAll('[data-ansicht]').forEach(k => k.onclick = () => { ST.ansicht = k.dataset.ansicht; ST.textModus = false; zeichne(); });
    const q = sel => w.querySelector(sel);
    if (q('[data-auto]')) q('[data-auto]').onclick = () => { s.manuell = false; s.ecken = s.erkennung.ecken.map(p => p.slice()); s.ocr = null; s.aenderungen = {}; zeichne(); };
    if (q('[data-ganz]')) q('[data-ganz]').onclick = () => { s.manuell = true; s.ecken = SB().ganz(s.foto.width, s.foto.height); s.ocr = null; s.aenderungen = {}; zeichne(); };
    w.querySelectorAll('[data-filter]').forEach(k => k.onclick = () => { s.filter = k.dataset.filter; merk.filter = s.filter; merken(); zeichne(); });
    const regler = (sel, feld) => { const r = q(sel); if (!r) return; r.oninput = () => { r.nextElementSibling.textContent = r.value; }; r.onchange = () => { s[feld] = +r.value; zeichneBuehne(); zeichneLeiste(); melden(); }; };
    regler('[data-hell]', 'hell'); regler('[data-kontrast]', 'kontrast');
    w.querySelectorAll('[data-dreh]').forEach(k => k.onclick = () => { s.drehung = (s.drehung + (+k.dataset.dreh) + 4) % 4; s.ocr = null; s.aenderungen = {}; ST.textModus = false; zeichne(); });
    if (q('[data-alle]')) q('[data-alle]').onclick = () => { for (const o of ST.seiten) { o.filter = s.filter; o.hell = s.hell; o.kontrast = s.kontrast; } ST.opt.toast('Filter, Helligkeit und Kontrast gelten jetzt für alle ' + ST.seiten.length + ' Seiten'); zeichne(); };
    if (q('[data-sprache]')) q('[data-sprache]').onchange = e => { ST.sprache = e.target.value; merk.sprache = ST.sprache; merken(); };
    if (q('[data-ocr]')) q('[data-ocr]').onclick = async () => {
      const k = q('[data-ocr]'); k.disabled = true; k.textContent = '🔤 Text wird erkannt …';
      try { await ocrSeite(s); ST.textModus = true; ST.opt.toast('🔤 ' + s.ocr.zeilen.length + ' Zeilen erkannt'); }
      catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); }
      zeichne();
    };
    if (q('[data-textmodus]')) q('[data-textmodus]').onclick = () => { ST.textModus = !ST.textModus; zeichne(); };
    if (q('[data-weg]')) q('[data-weg]').onclick = () => { ST.seiten.splice(ST.akt, 1); ST.akt = Math.min(ST.akt, ST.seiten.length - 1); ST.ansicht = 'zuschnitt'; zeichne(); };
  }

  function zeichneLeiste() {
    const l = $q('[data-leiste]');
    l.innerHTML = ST.seiten.map((s, i) => `<div class="scan-daumen${i === ST.akt ? ' on' : ''}${s.erkennung && !s.erkennung.sicher && !s.manuell ? ' pruefen' : ''}" data-i="${i}">
        <button class="scan-daumen-bild" data-waehle="${i}" title="Seite ${i + 1} ansehen"><img alt="" data-bild="${i}"><span>${i + 1}</span></button>
        <div class="scan-daumen-k"><button data-links="${i}" title="Nach vorn"${i ? '' : ' disabled'}>◀</button><button data-rechts="${i}" title="Nach hinten"${i < ST.seiten.length - 1 ? '' : ' disabled'}>▶</button></div></div>`).join('')
      + (ST.seiten.length ? '<button class="scan-plus" data-kamera>📷<span>Seite</span></button><button class="scan-plus" data-galerie>🖼<span>Galerie</span></button>' : '');
    ST.seiten.forEach((s, i) => { const im = l.querySelector(`[data-bild="${i}"]`); if (!im) return; if (s.ecken) { const c = vorschau(s); im.src = c.toDataURL('image/jpeg', 0.6); } });
    l.querySelectorAll('[data-waehle]').forEach(k => k.onclick = () => { ST.akt = +k.dataset.waehle; ST.textModus = false; zeichne(); });
    const tausch = (a, b) => { const x = ST.seiten[a]; ST.seiten[a] = ST.seiten[b]; ST.seiten[b] = x; ST.akt = b; zeichne(); };
    l.querySelectorAll('[data-links]').forEach(k => k.onclick = () => tausch(+k.dataset.links, +k.dataset.links - 1));
    l.querySelectorAll('[data-rechts]').forEach(k => k.onclick = () => tausch(+k.dataset.rechts, +k.dataset.rechts + 1));
    if (l.querySelector('[data-kamera]')) l.querySelector('[data-kamera]').onclick = () => $q('[data-in-kamera]').click();
    if (l.querySelector('[data-galerie]')) l.querySelector('[data-galerie]').onclick = () => $q('[data-in-galerie]').click();
  }

  function zeichneFuss() {
    const f = $q('[data-fuss]'), fertig = ST.seiten.length && ST.seiten.every(s => s.ecken);
    const offen = ST.seiten.filter(s => s.erkennung && !s.erkennung.sicher && !s.manuell).length;
    f.innerHTML = `<div class="scan-einst">
        <label>Name <input data-name value="${h(ST.name)}" data-kein-ue></label>
        <label>Seitengröße <select data-format>${Object.entries(FORMAT).map(([k, v]) => `<option value="${k}"${ST.format === k ? ' selected' : ''}>${h(v)}</option>`).join('')}</select></label>
        <label>Qualität <select data-quali>${Object.entries(QUALI).map(([k, v]) => `<option value="${k}"${ST.qualitaet === k ? ' selected' : ''}>${h(v.name)}</option>`).join('')}</select></label>
        <label class="scan-haken"><input type="checkbox" data-durch${ST.durchsuchbar ? ' checked' : ''}> Durchsuchbar (Texterkennung für alle Seiten)</label>
      </div>
      ${offen ? `<p class="scan-befund pruefen" data-offen>⚠ ${offen} ${offen === 1 ? 'Seite ist' : 'Seiten sind'} noch nicht geprüft — die Verfahren waren sich uneinig. Zum Prüfen die Seite antippen.</p>` : ''}
      <div class="scan-aktionen">
        <button class="knopf" data-laden${fertig ? '' : ' disabled'}>⬇ PDF herunterladen</button>
        <button class="knopf" data-teilen${fertig ? '' : ' disabled'}>📤 Teilen</button>
        <button class="knopf" data-zip${fertig ? '' : ' disabled'}>🖼 Als Bilder (ZIP)</button>
        <button class="knopf rot" data-fertig${fertig ? '' : ' disabled'}>✓ ${h(ST.opt.fertigText || 'PDF erstellen')}</button>
      </div>
      <p class="hinweis" data-ergebnis-info></p>`;
    const q = sel => f.querySelector(sel);
    q('[data-name]').onchange = e => { ST.name = e.target.value.trim() || ST.name; };
    q('[data-format]').onchange = e => { ST.format = merk.format = e.target.value; merken(); zeichne(); };
    q('[data-quali]').onchange = e => { ST.qualitaet = merk.qualitaet = e.target.value; merken(); melden(); };
    q('[data-durch]').onchange = e => { ST.durchsuchbar = merk.durchsuchbar = e.target.checked; merken(); melden(); };
    const bauen = async () => {
      const info = q('[data-ergebnis-info]'); const t0 = Date.now();
      const fb = ST.opt.fortschritt('PDF wird gebaut');
      try { const bytes = await pdfBauen((a, t) => fb.setze(a, t)); fb.zu(); if (info) info.textContent = 'PDF: ' + ST.seiten.length + ' Seiten · ' + groesse(bytes.length) + ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s'; window.__wfpdfScanPdf = { bytes: bytes.length, ms: Date.now() - t0 }; return bytes; }
      catch (e) { fb.zu(); ST.opt.toast('⚠️ ' + (e.message || e)); return null; }
    };
    const datei = () => (String(ST.name).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Scan');
    q('[data-laden]').onclick = async () => { const b = await bauen(); if (b) { ST.opt.laden(datei() + '.pdf', b, 'application/pdf'); ST.opt.toast('⬇ ' + datei() + '.pdf'); } };
    q('[data-teilen]').onclick = async () => {
      const b = await bauen(); if (!b) return;
      const file = new File([b], datei() + '.pdf', { type: 'application/pdf' });
      // Teilen braucht einen frischen Tipp — nach dem Bauen ist der erste verbraucht
      ST.opt.dialog(`<h2>📤 Teilen</h2><p>Das PDF ist fertig (${groesse(b.length)}).</p><div class="zeile"><button class="knopf" data-x>Schließen</button><button class="knopf" data-dl>⬇ Herunterladen</button>${navigator.canShare && navigator.canShare({ files: [file] }) ? '<button class="knopf rot" data-jetzt>📤 Jetzt teilen …</button>' : ''}</div>${navigator.canShare ? '' : '<p class="hinweis">Dieser Browser kann keine Dateien teilen — bitte herunterladen und im Dateiordner teilen.</p>'}`, (d, zu) => {
        d.querySelector('[data-x]').onclick = zu;
        d.querySelector('[data-dl]').onclick = () => { ST.opt.laden(file.name, b, 'application/pdf'); zu(); };
        const j = d.querySelector('[data-jetzt]'); if (j) j.onclick = () => { navigator.share({ files: [file], title: ST.name }).catch(() => {}); zu(); };
      });
    };
    q('[data-zip]').onclick = async () => {
      const fb = ST.opt.fortschritt('Bilder werden gebaut'); const Q = QUALI[ST.qualitaet] || QUALI.normal;
      try {
        const eintraege = [];
        for (let i = 0; i < ST.seiten.length; i++) { fb.setze(i / ST.seiten.length, 'Seite ' + (i + 1)); eintraege.push({ name: datei() + ' - Seite ' + String(i + 1).padStart(2, '0') + '.jpg', bytes: await jpeg(seiteRechnen(ST.seiten[i], Q.dpi, true).canvas, Q.q) }); }
        const z = WFP.Zip.zip(eintraege); fb.zu(); ST.opt.laden(datei() + '.zip', z, 'application/zip'); ST.opt.toast('🖼 ' + eintraege.length + ' Bilder als ZIP');
      } catch (e) { fb.zu(); ST.opt.toast('⚠️ ' + (e.message || e)); }
    };
    q('[data-fertig]').onclick = async () => {
      if (offen && !await ST.opt.frage('Nicht alle Seiten geprüft', `<p>Bei ${offen} ${offen === 1 ? 'Seite' : 'Seiten'} waren sich die Verfahren beim Zuschnitt nicht einig. Trotzdem so übernehmen?</p>`, 'Trotzdem übernehmen', 'Zurück und prüfen')) return;
      const b = await bauen(); if (!b) return;
      const opt = ST.opt, name = ST.name; schliessen();
      try { await opt.fertig(b, { name }); } catch (e) { opt.toast('⚠️ ' + (e.message || e)); }
    };
  }
  const groesse = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  window.WFP = window.WFP || {};
  window.WFP.Scanner = { oeffnen, schliessen, hinzu, zustand: () => ST, pdfBauen, seiteRechnen, ocrSeite, erkennen, zeichne };
})();
