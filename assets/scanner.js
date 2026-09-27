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
  const merk = (() => { try { return Object.assign({ filter: 'farbe', format: 'auto', qualitaet: 'normal', durchsuchbar: false, sprache: '' }, JSON.parse(localStorage.getItem(MERK) || '{}')); } catch (_) { return { filter: 'farbe', format: 'auto', qualitaet: 'normal', durchsuchbar: false, sprache: '' }; } })();
  const merken = () => { try { localStorage.setItem(MERK, JSON.stringify(merk)); } catch (_) {} };

  const FILTER_NAME = { original: 'Original', farbe: 'Farbe', grau: 'Graustufen', dokument: 'Dokument', sw: 'Schwarzweiß' };
  const QUALI = { hoch: { dpi: 200, q: 0.9, name: 'Hoch (200 dpi)' }, normal: { dpi: 150, q: 0.85, name: 'Normal (150 dpi)' }, klein: { dpi: 110, q: 0.72, name: 'Klein (110 dpi)' } };
  const FORMAT = { auto: 'Automatisch', blatt: 'Original (wie das Blatt)', a4: 'A4', a5: 'A5', a6: 'A6', letter: 'US Letter' };
  const SPRACHEN = { deu: 'Deutsch', eng: 'English', rus: 'Русский' };
  const VORSCHAU_DPI = 80, OCR_DPI = 200, KI_DPI = 300;

  let ST = null;   // Zustand des offenen Werkzeugs

  /* Wo die mitgelieferten Dateien liegen (2026-09-27). Workflow PDF: vendor/. Die WorkFlohs
     kopieren diese Datei byte-1:1 und setzen die Pfade über opt.pfade bzw. WFP.Scanner.pfade():
     Schrift aus assets/wfpdf/, Scanic und Texterkennung von /Workflow-PDF/vendor/ (gleiche
     Adresse, einmal im Netz). Relative Pfade gelten gegen die Seite. */
  const PF = { vendor: 'vendor/', scanic: 'vendor/scanic/', ocr: 'vendor/' };
  const pfad = u => new URL(u, location.href).href;

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
    if (!_scanic) _scanic = import(pfad(PF.scanic + 'scanic.js')).catch(e => { _mlFehler = 'Blatterkennung (Scanic) lädt nicht: ' + (e.message || e); return null; });
    return _scanic;
  }
  async function erkennen(s) {
    const c = s.foto, w = c.width, hh = c.height, ein = {};
    try { if (WFP.Blatt) ein.blatt = WFP.Blatt.finden(c); } catch (_) {}
    const sc = await scanicLaden();
    if (sc) {
      try { const r = await sc.scanDocument(c); if (r && r.success) ein.klassisch = { ecken: SB().ausScanic(r.corners) }; } catch (_) {}
      try {
        const r = await sc.scanDocument(c, { detector: 'ml', ml: { assetBaseUrl: pfad(PF.scanic) } });
        if (r && r.corners) ein.ml = { ecken: SB().ausScanic(r.corners), score: r.score };
      } catch (e) { _mlFehler = 'Modell nicht verfügbar: ' + (e.message || e); }
    }
    s.erkennung = SB().entscheiden(ein, w, hh);
    s.erkennung.verfahren = { blatt: !!(ein.blatt && ein.blatt.sicher), klassisch: !!ein.klassisch, ml: !!ein.ml };
    if (!s.manuell) { s.ecken = s.erkennung.ecken.map(p => p.slice()); s.ocr = null; s.aenderungen = {}; s.stil = {}; }
  }

  /* ---------- Seite rechnen ---------- */
  function schluessel(s, dpi, mitText) {
    return JSON.stringify([s.ecken, s.drehung, s.filter, s.hell, s.kontrast, ST.format, dpi, mitText ? [s.aenderungen, s.stil] : 0]);
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
  // Geänderte Zeilen: das SCHRIFTBAND der alten Zeile (an der Grundlinie, samt Neigung) in
  // Papierfarbe überdecken, dann den neuen Text darauf. Erst ALLE Bänder, dann ALLE Texte —
  // sonst löscht das Band der nächsten Zeile die Unterlängen der vorigen (Klaus 2026-09-27:
  // „150 q Butter", abgeschnittene Zeilen).
  const SCHRIFT = 'Arial, Helvetica, sans-serif';
  function textAnwenden(c, img, s) {
    const x = c.getContext('2d'); const W = c.width, H = c.height;
    const jobs = [];
    // gleiche Schriftgröße für Zeilen gleicher Höhe — sonst springt sie von Zeile zu Zeile
    const alleLagen = s.ocr.zeilen.map(z => SB().zeilenLage(z, W, H)), groessen = SB().kopieGroessen(alleLagen);
    for (const [i, neu] of Object.entries(s.aenderungen || {})) {
      const z = s.ocr.zeilen[+i]; if (!z) continue;
      const l = Object.assign({}, alleLagen[+i], { fs: groessen[+i] }), band = SB().zeilenBand(l);
      // Papierfarbe am Anfang und am Ende der Zeile messen und als Verlauf überdecken —
      // ein Foto ist selten gleichmäßig hell (Klaus 2026-09-27: „die Farbanpassung stimmt nicht ganz")
      const probe = teil => { const pts = SB().zeilenBand(Object.assign({}, l, { x: l.x + Math.cos(l.winkel) * l.laenge * teil, y: l.y + Math.sin(l.winkel) * l.laenge * teil, laenge: l.laenge * 0.25 })); const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return SB().textFarben(img, { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }); };
      const fa = probe(0), fe = probe(0.75);
      jobs.push({ i: +i, l, band, fa, fe, neu });
    }
    for (const j of jobs) {
      const g = x.createLinearGradient(j.band[0][0], j.band[0][1], j.band[1][0], j.band[1][1]);
      g.addColorStop(0, `rgb(${j.fa.grund.join(',')})`); g.addColorStop(1, `rgb(${j.fe.grund.join(',')})`);
      x.fillStyle = g; x.beginPath(); j.band.forEach((p, k) => k ? x.lineTo(p[0], p[1]) : x.moveTo(p[0], p[1])); x.closePath(); x.fill();
    }
    for (const j of jobs) if (j.neu) {
      const st = stilVon(s, j.i), l = verschoben(j.l, st, W, H), schrift = j.fa.schrift.map((v, k) => Math.round((v + j.fe.schrift[k]) / 2));
      schreibe(x, j.neu, l, l.fs * st.gr, j.l.winkel, `rgb(${schrift.join(',')})`, st);
    }
  }
  /* Zeilen einstellen (Klaus 2026-09-27: „linksbündig oder rechtsbündig oder kleiner, größer
     gezogen"): je Zeile Ausrichtung, Größe und Versatz. Versatz in Anteilen der Seite,
     damit er bei jeder Auflösung gleich liegt. */
  const STIL0 = { ausr: 'l', gr: 1, dx: 0, dy: 0 };
  const stilVon = (s, i) => Object.assign({}, STIL0, (s.stil || {})[i]);
  const stilLeer = st => st.ausr === 'l' && st.gr === 1 && !st.dx && !st.dy;
  const verschoben = (l, st, W, H) => Object.assign({}, l, { x: l.x + st.dx * W, y: l.y + st.dy * H, mitte: l.mitte + st.dy * H });
  // Text an die Grundlinie setzen. Ohne eigene Größe: zu breit → kleiner (nie unter 60 %), nie gedehnt.
  function schreibe(x, t, l, fs, winkel, farbe, st) {
    st = st || STIL0;
    x.save(); x.translate(l.x, l.y); x.rotate(winkel);
    x.font = `${fs}px ${SCHRIFT}`; let br = x.measureText(t).width;
    if (st.gr === 1 && br > l.laenge * 1.02) { fs = Math.max(fs * 0.5, fs * l.laenge / br); x.font = `${fs}px ${SCHRIFT}`; br = x.measureText(t).width; }
    const ab = st.ausr === 'r' ? l.laenge - br : st.ausr === 'm' ? (l.laenge - br) / 2 : 0;
    x.fillStyle = farbe; x.textBaseline = 'alphabetic'; x.fillText(t, ab, 0); x.restore();
  }
  /* Die KOPIE (Klaus 2026-09-27: „eine Kopie neu aufbauen … Original und Kopie nebeneinander,
     und dann vergleicht man sie"): ein sauberes weißes Blatt derselben Größe, jede erkannte
     Zeile gerade an ihre Stelle gesetzt. Bilder, Stempel und Handschrift kommen NICHT mit —
     dafür ist das Original da. */
  function kopieRechnen(s, dpi, durchsichtig) {
    const m = SB().seitenMass(s.ecken, ST.format, dpi);
    const quer = s.drehung % 2;
    const W = quer ? m.H : m.W, H = quer ? m.W : m.H;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    // durchsichtig = die TEXTMASKE (Klaus 2026-09-27): nur die Schrift, kein Blatt — zum Auflegen
    // auf einen neuen Hintergrund in einem Bildprogramm
    const x = c.getContext('2d'); if (!durchsichtig) { x.fillStyle = '#fff'; x.fillRect(0, 0, W, H); }
    if (s.ocr) {
      const lagen = s.ocr.zeilen.map(z => SB().zeilenLage(z, W, H)), fs = SB().kopieGroessen(lagen);
      lagen.forEach((l, i) => { const t = zeilenText(s, i); if (!t) return; const st = stilVon(s, i), m = verschoben(l, st, W, H); schreibe(x, t, { x: m.x, y: m.mitte, laenge: kopieBreite(l, W) }, fs[i] * st.gr, 0, '#1a1a1a', st); });
    }
    const seite = quer ? [m.seite[1], m.seite[0]] : m.seite;
    return { canvas: c, seite };
  }
  // In der Kopie darf eine Zeile bis zum rechten Rand laufen: die gemessene Grundlinie ist oft
  // kürzer als der Text, und die Zeile würde sonst kleiner gesetzt als ihre Nachbarn.
  const kopieBreite = (l, W) => Math.max(l.laenge, W * 0.97 - l.x);
  function kopieVorschau(s) {
    const k = schluessel(s, VORSCHAU_DPI, true) + JSON.stringify([s.ocr && s.ocr.zeilen.length, s.ocr && s.ocr.dpi]);
    if (s._kk !== k) { s._k = kopieRechnen(s, VORSCHAU_DPI).canvas; s._kk = k; }
    return s._k;
  }
  const alsKopie = s => s.ausgabe === 'kopie' && s.ocr;

  /* ---------- Texterkennung ---------- */
  let _ocr = null;   // { sprache, worker }
  async function ocrWorker(sprache) {
    if (_ocr && _ocr.sprache === sprache) return _ocr.worker;
    if (_ocr) { try { await _ocr.worker.terminate(); } catch (_) {} _ocr = null; }
    if (!window.Tesseract) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = pfad(PF.ocr + 'tesseract/tesseract.min.js'); sc.onload = res; sc.onerror = () => rej(new Error('Texterkennung (Tesseract) lädt nicht')); document.head.appendChild(sc); });
    const abs = u => new URL(u, location.href).href;
    const w = await window.Tesseract.createWorker(sprache, 1, { workerPath: abs(PF.ocr + 'tesseract/worker.min.js'), corePath: abs(PF.ocr + 'tesseract/'), langPath: abs(PF.ocr + 'tesseract/lang'), gzip: false, cacheMethod: 'none' });
    _ocr = { sprache, worker: w };
    return w;
  }
  async function ocrSeite(s, dpi) {
    dpi = dpi || OCR_DPI;
    const r0 = seiteRechnen(s, dpi, false), c = r0.canvas;
    const w = await ocrWorker(ST.sprache);
    const r = await w.recognize(c, {}, { blocks: true, text: false });
    const zeilen = [];
    for (const bl of (r.data.blocks || [])) for (const pa of (bl.paragraphs || [])) for (const li of (pa.lines || [])) {
      const t = String(li.text || '').replace(/\s+/g, ' ').trim();
      if (!t || li.confidence < 30 || !/[\p{L}\p{N}]/u.test(t)) continue;
      const bb = li.bbox;
      const z = { text: t, conf: Math.round(li.confidence), box: [bb.x0 / c.width, bb.y0 / c.height, (bb.x1 - bb.x0) / c.width, (bb.y1 - bb.y0) / c.height] };
      const bl = li.baseline, ra = li.rowAttributes;
      if (bl && ra && ra.rowHeight > 0 && bl.x1 > bl.x0) { z.base = [bl.x0 / c.width, bl.y0 / c.height, bl.x1 / c.width, bl.y1 / c.height]; z.rh = ra.rowHeight / c.height; z.desc = (ra.descenders || 0) / c.height; }
      zeilen.push(z);
    }
    s.ocr = { zeilen, dpi, sprache: ST.sprache, schluessel: JSON.stringify([s.ecken, s.drehung, ST.format]) };
    s.aenderungen = {}; s.stil = {};
    return s.ocr;
  }
  const ocrGilt = s => s.ocr && s.ocr.schluessel === JSON.stringify([s.ecken, s.drehung, ST.format]);

  /* ---------- PDF ---------- */
  async function schriftFuer(pdf, texte) {
    const { StandardFonts } = PDFLib;
    const helv = await pdf.embedFont(StandardFonts.Helvetica);
    try { for (const t of texte) helv.encodeText(t); return helv; } catch (_) {}
    // Nicht-lateinische Zeichen (z. B. Kyrillisch): Noto Sans, GANZ eingebettet (siehe CLAUDE.md, Teilmenge verlor Buchstaben)
    if (!window.fontkit) await new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = pfad(PF.vendor + 'fontkit.umd.min.js'); sc.onload = res; sc.onerror = () => rej(new Error('Schrift lädt nicht')); document.head.appendChild(sc); });
    pdf.registerFontkit(window.fontkit);
    const bytes = new Uint8Array(await (await fetch(pfad(PF.vendor + 'fonts/NotoSans-Regular.ttf'))).arrayBuffer());
    return pdf.embedFont(bytes, { subset: false });
  }
  async function jpeg(c, q) { return new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/jpeg', q))).arrayBuffer()); }
  function eigeneDpi(s, mindest) {
    const m = SB().seitenMass(s.ecken, ST.format, 72), lang = Math.max(m.W, m.H) || 1;
    return Math.min(300, Math.max(mindest, Math.round(Math.max(s.foto.width, s.foto.height) / lang * 72)));
  }
  async function pdfBauen(melde) {
    const { PDFDocument } = PDFLib; const Q = QUALI[ST.qualitaet] || QUALI.normal;
    const seiten = ST.seiten.filter(s => s.ecken);
    const dpis = []; window.__wfpdfScanDpi = dpis;
    if (ST.durchsuchbar) for (let i = 0; i < seiten.length; i++) if (!ocrGilt(seiten[i])) { melde && melde(i / seiten.length, 'Text erkennen · Seite ' + (i + 1) + ' von ' + seiten.length); await ocrSeite(seiten[i]); }
    const pdf = await PDFDocument.create();
    for (let i = 0; i < seiten.length; i++) if (seiten[i].ausgabe === 'kopie' && !ocrGilt(seiten[i])) { melde && melde(i / seiten.length, 'Text erkennen · Seite ' + (i + 1) + ' von ' + seiten.length); await ocrSeite(seiten[i]); }
    const texte = []; for (const s of seiten) if ((ST.durchsuchbar || alsKopie(s)) && s.ocr) s.ocr.zeilen.forEach((z, i) => texte.push(zeilenText(s, i)));
    const font = texte.length ? await schriftFuer(pdf, texte) : null;
    for (let i = 0; i < seiten.length; i++) {
      const s = seiten[i]; melde && melde(i / seiten.length, 'Seite ' + (i + 1) + ' von ' + seiten.length + ' rechnen');
      if (alsKopie(s)) {
        // Kopie: weißes Blatt mit ECHTEM Text (kein Bild) — gestochen scharf, klein, durchsuchbar
        const k = kopieRechnen(s, 72), [pw, ph] = k.seite, p = pdf.addPage([pw, ph]);
        const lagen = s.ocr.zeilen.map(z => SB().zeilenLage(z, pw, ph)), fs = SB().kopieGroessen(lagen);
        lagen.forEach((l, zi) => {
          const t = zeilenText(s, zi); if (!t) return;
          const st = stilVon(s, zi), m = verschoben(l, st, pw, ph);
          const w1 = font.widthOfTextAtSize(t, 1) || 1; let size = fs[zi] * st.gr;
          const breit = kopieBreite(l, pw);
          if (st.gr === 1 && w1 * size > breit * 1.02) size = Math.max(size * 0.5, breit / w1);
          const ab = st.ausr === 'r' ? breit - w1 * size : st.ausr === 'm' ? (breit - w1 * size) / 2 : 0;
          try { p.drawText(t, { x: m.x + ab, y: ph - m.mitte, size, font, color: PDFLib.rgb(0.1, 0.1, 0.1) }); } catch (_) {}
        });
        continue;
      }
      // Ein Bild von ChatGPT kommt in SEINER Auflösung ins PDF, nicht heruntergerechnet (Klaus 2026-09-27:
      // „Sehr schlechte Textqualität. Höhere Auflösung wäre besser.") — höchstens 300 dpi.
      const dpi = s.kiBild ? eigeneDpi(s, Q.dpi) : Q.dpi;
      const r = seiteRechnen(s, dpi, true);
      dpis.push({ dpi, ki: !!s.kiBild, px: Math.max(r.canvas.width, r.canvas.height) });
      const img = await pdf.embedJpg(await jpeg(r.canvas, s.kiBild ? Math.max(Q.q, 0.92) : Q.q));
      const [pw, ph] = r.seite, p = pdf.addPage([pw, ph]);
      p.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
      if (ST.durchsuchbar && s.ocr) {
        // unsichtbare Textebene an der Grundlinie: markieren, kopieren, durchsuchen — gezeichnet wird nichts
        s.ocr.zeilen.forEach((z, zi) => {
          const t = zeilenText(s, zi); if (!t) return;
          const l = SB().zeilenLage(z, pw, ph), w1 = font.widthOfTextAtSize(t, 1) || 1;
          const size = Math.max(1, Math.min(l.fs, l.laenge / w1));
          try { p.drawText(t, { x: l.x, y: ph - l.y, size, font, opacity: 0, rotate: PDFLib.degrees(-l.winkel * 180 / Math.PI) }); } catch (_) {}
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
    if (opt.pfade) Object.assign(PF, opt.pfade);
    const sprache0 = merk.sprache || ({ de: 'deu', en: 'eng', ru: 'rus' }[(WFP.Sprache && WFP.Sprache.lang) || 'de'] || 'deu');
    ST = { opt, seiten: [], akt: -1, ansicht: 'zuschnitt', textModus: false, vergleich: 'original', ersetze: null, format: merk.format, qualitaet: merk.qualitaet, durchsuchbar: merk.durchsuchbar, sprache: sprache0, name: opt.name || ('Scan ' + new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })), el: null };
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
      <input type="file" accept="image/*" multiple data-in-galerie hidden>
      <input type="file" accept="image/*" data-in-ki hidden>`;
    document.body.appendChild(el); ST.el = el; document.body.classList.add('scan-offen');
    $q('[data-schliessen]').onclick = async () => { if (!ST.seiten.length || await opt.frage('Scan verwerfen?', '<p>Die aufgenommenen Seiten werden nicht gespeichert.</p>', 'Verwerfen')) schliessen(); };
    $q('[data-in-kamera]').onchange = e => { const f = [...(e.target.files || [])]; e.target.value = ''; if (!f.length) ST.ersetze = null; hinzu(f); };
    $q('[data-in-galerie]').onchange = e => { const f = [...(e.target.files || [])]; e.target.value = ''; hinzu(f); };
    $q('[data-in-ki]').onchange = e => { const f = [...(e.target.files || [])]; e.target.value = ''; const s = akt(); if (f.length) hinzu(f.slice(0, 1), { bildKi: true, hinter: s && s.id }); };
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
  // o.bildKi: ein fertiges Bild von ChatGPT — es IST die Seite, also kein Blatt suchen, kein Filter.
  // o.hinter: hinter dieser Seite einfügen statt ans Ende.
  async function hinzu(dateien, o) {
    o = o || {};
    const bilder = dateien.filter(f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(f.name));
    if (!bilder.length) { if (dateien.length) ST.opt.toast('Keine Bilddatei gewählt.'); return; }
    for (const f of bilder) {
      if (!ST) return;
      let foto; try { foto = await fotoLesen(f); } catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); continue; }
      const alt = ST.ersetze ? ST.seiten.findIndex(o => o.id === ST.ersetze) : -1; ST.ersetze = null;
      const s = { id: Math.random().toString(36).slice(2), name: f.name, foto, erkennung: null, ecken: null, manuell: false, drehung: 0, filter: merk.filter, hell: 0, kontrast: 0, ocr: null, aenderungen: {}, ausgabe: 'original' };
      if (o.bildKi) Object.assign(s, { filter: 'original', manuell: true, ecken: SB().ganz(foto.width, foto.height), erkennung: { ecken: SB().ganz(foto.width, foto.height), quelle: 'ki-bild', sicher: true, grund: 'Bild von ChatGPT — das ganze Bild ist die Seite' }, kiBild: true });
      const hinter = o.hinter ? ST.seiten.findIndex(x => x.id === o.hinter) : -1;
      if (alt >= 0) { const a = ST.seiten[alt]; if (!o.bildKi) Object.assign(s, { drehung: a.drehung, filter: a.filter, hell: a.hell, kontrast: a.kontrast }); ST.seiten[alt] = s; ST.akt = alt; ST.opt.toast((o.bildKi ? '🎨 ' : '📷 ') + 'Seite ' + (alt + 1) + ' ersetzt'); }
      else if (hinter >= 0) { ST.seiten.splice(hinter + 1, 0, s); ST.akt = hinter + 1; ST.opt.toast('🎨 Als Seite ' + (hinter + 2) + ' eingefügt — das Original bleibt davor'); }
      else { ST.seiten.push(s); ST.akt = ST.seiten.length - 1; }
      ST.ansicht = o.bildKi ? 'ergebnis' : 'zuschnitt'; ST.textModus = false; ST.vergleich = 'original';
      zeichne();
      if (o.bildKi) continue;
      await erkennen(s);
      if (!ST) return;
      zeichne();
    }
    melden();
  }
  function melden() {
    if (!ST) return;
    window.__wfpdfScan = { seiten: ST.seiten.map(s => ({ name: s.name, ecken: s.ecken, erkennung: s.erkennung && { quelle: s.erkennung.quelle, sicher: s.erkennung.sicher, grund: s.erkennung.grund, verfahren: s.erkennung.verfahren }, manuell: s.manuell, drehung: s.drehung, filter: s.filter, hell: s.hell, kontrast: s.kontrast, foto: [s.foto.width, s.foto.height], ocr: s.ocr ? s.ocr.zeilen.length : null, ocrDpi: s.ocr ? s.ocr.dpi : null, ausgabe: s.ausgabe || 'original', kiBild: !!s.kiBild, aenderungen: Object.assign({}, s.aenderungen), stil: JSON.parse(JSON.stringify(s.stil || {})) })), akt: ST.akt, vergleich: ST.vergleich, format: ST.format, qualitaet: ST.qualitaet, durchsuchbar: ST.durchsuchbar, mlFehler: _mlFehler };
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

  /* Lupe: Durchmesser ein Fünftel der kürzeren Bildseite, 56–84 px. Vorher legte
     `.scan-bild canvas{width:100%}` sie über das GANZE Bild (gemessen 431×574 bei 431×574). */
  function lupeGroesse(W, H) { return Math.max(56, Math.min(84, Math.round(Math.min(W, H) / 5))); }
  /* Lage: schräg über dem Punkt, zur Bildmitte hin; oben kein Platz → darunter. Bleibt im Bild
     und deckt den Punkt (± 18 px Griff) nie ab. */
  function lupeLage(x, y, d, W, H) {
    const abst = 22, links = x > W / 2;
    let lx = links ? x - abst - d : x + abst, ly = y - abst - d;
    if (ly < 0) ly = y + abst;
    lx = Math.max(0, Math.min(W - d, lx)); ly = Math.max(0, Math.min(H - d, ly));
    return [Math.round(lx), Math.round(ly)];
  }
  /* Zuschnitt: das Foto mit vier Ecken zum Ziehen und einer Lupe */
  function zeichneZuschnitt(b, s) {
    b.innerHTML = '<div class="scan-bild" data-rahmen><canvas data-foto></canvas><svg class="scan-linie" data-svg></svg><canvas class="scan-lupe" data-lupe hidden></canvas></div>';
    const rahmen = b.querySelector('[data-rahmen]'), cv = b.querySelector('[data-foto]'), svg = b.querySelector('[data-svg]'), lupe = b.querySelector('[data-lupe]');
    // Platz für die halben Griffe (36 px) an allen Seiten — und KEINE Untergrenze über der Bühne:
    // mit „mindestens 200" ragte das Bild am Handy (Bühne 156 px) oben unter die Kopfleiste,
    // und die oberen Ecken waren nicht mehr zu greifen (gemessen 2026-09-27, 360×740).
    const maxW = Math.max(60, b.clientWidth - 40), maxH = Math.max(60, b.clientHeight - 40);
    // Kein Deckel bei 1 (Klaus 2026-09-27: „die Vollbildansicht nutzt den Platz für das Bild nicht optimal
    // aus"): ein kleines Foto füllt die Bühne wie in der Ergebnis-Ansicht. Die Leinwand bekommt die
    // Pixel des Schirms, gezeichnet wird höchstens in der Auflösung des Fotos.
    const f = Math.min(maxW / s.foto.width, maxH / s.foto.height);
    const W = Math.round(s.foto.width * f), H = Math.round(s.foto.height * f);
    const dp = Math.max(1, Math.min(window.devicePixelRatio || 1, s.foto.width / W));
    cv.width = Math.round(W * dp); cv.height = Math.round(H * dp); cv.getContext('2d').drawImage(s.foto, 0, 0, cv.width, cv.height);
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
        e.preventDefault(); g.setPointerCapture(e.pointerId); lupe.hidden = false; g.dataset.zieht = '1';
        const r0 = rahmen.getBoundingClientRect();
        const bewege = ev => {
          const x = Math.max(0, Math.min(W, ev.clientX - r0.left)), y = Math.max(0, Math.min(H, ev.clientY - r0.top));
          s.ecken[i] = [x / f, y / f]; s.manuell = true; male();
          // Lupe (Klaus 2026-09-27: „nur der Punkt, sodass man den Rest noch sehen kann"):
          // klein, 3-fach, schräg ÜBER dem Punkt (der Finger liegt darunter) — nie über dem Punkt selbst.
          const d = lupeGroesse(W, H), z = 3, gr = d / z, pr = Math.min(2, window.devicePixelRatio || 1);
          if (lupe.width !== Math.round(d * pr)) { lupe.width = lupe.height = Math.round(d * pr); }
          lupe.style.width = lupe.style.height = d + 'px';
          const lx = lupe.getContext('2d'); lx.setTransform(pr, 0, 0, pr, 0, 0);
          lx.fillStyle = '#fff'; lx.fillRect(0, 0, d, d);
          lx.drawImage(s.foto, s.ecken[i][0] - gr / 2 / f, s.ecken[i][1] - gr / 2 / f, gr / f, gr / f, 0, 0, d, d);
          const m = d / 2, k = d / 6;
          lx.strokeStyle = '#E0231B'; lx.lineWidth = 1.5; lx.beginPath(); lx.moveTo(m, m - k); lx.lineTo(m, m + k); lx.moveTo(m - k, m); lx.lineTo(m + k, m); lx.stroke();
          const pos = lupeLage(x, y, d, W, H);
          lupe.style.left = pos[0] + 'px'; lupe.style.top = pos[1] + 'px';
        };
        bewege(e);
        g.onpointermove = bewege;
        g.onpointerup = g.onpointercancel = () => { g.onpointermove = null; lupe.hidden = true; delete g.dataset.zieht; s.ocr = null; s.aenderungen = {}; s.stil = {}; zeichneLeiste(); zeichneWerkzeug(); melden(); };
      };
    });
  }
  /* Ergebnis: die fertige Seite. Nach der Texterkennung auf Wunsch Original und Kopie
     nebeneinander — eine Zeile antippen ändert sie, dieselbe Zeile leuchtet in beiden. */
  function zeichneErgebnis(b, s) {
    const v = s.ocr ? (ST.vergleich || 'original') : 'original';
    const tafeln = v === 'neben' ? ['original', 'kopie'] : [v];
    b.innerHTML = `<div class="scan-vergleich${tafeln.length > 1 ? ' zwei' : ''}" data-vergleich="${v}">${tafeln.map(t => `<figure class="scan-tafel" data-tafel="${t}">${tafeln.length > 1 || t === 'kopie' ? `<figcaption>${t === 'kopie' ? '📄 Kopie — neu gesetzt aus dem erkannten Text' : '📷 Original'}</figcaption>` : ''}<div class="scan-bild" data-rahmen><img data-ergebnis${t === 'kopie' ? '-kopie' : ''} alt=""><div class="scan-zeilen" data-zeilen></div></div></figure>`).join('')}</div>`;
    const kopf = tafeln.length > 1 || v === 'kopie' ? 26 : 0;
    const maxW = Math.max(160, (b.clientWidth - 8 - (tafeln.length - 1) * 12) / tafeln.length), maxH = Math.max(200, b.clientHeight - 8 - kopf);
    tafeln.forEach(t => {
      const fig = b.querySelector(`[data-tafel="${t}"]`), c = t === 'kopie' ? kopieVorschau(s) : vorschau(s);
      const f = Math.min(maxW / c.width, maxH / c.height), rahmen = fig.querySelector('[data-rahmen]');
      rahmen.style.width = Math.round(c.width * f) + 'px'; rahmen.style.height = Math.round(c.height * f) + 'px';
      fig.querySelector('img').src = c.toDataURL(t === 'kopie' ? 'image/png' : 'image/jpeg', 0.85);
      if (!s.ocr || (!ST.textModus && t === 'original' && tafeln.length === 1)) return;
      const z = fig.querySelector('[data-zeilen]');
      const lagen = t === 'kopie' ? s.ocr.zeilen.map(zl => SB().zeilenLage(zl, c.width, c.height)) : null;
      z.innerHTML = s.ocr.zeilen.map((zl, i) => {
        let st;
        if (t === 'kopie') { const l = lagen[i], fs = SB().kopieGroessen(lagen)[i]; st = `left:${l.x / c.width * 100}%;top:${(l.mitte - fs * 0.85) / c.height * 100}%;width:${l.laenge / c.width * 100}%;height:${fs * 1.1 / c.height * 100}%`; }
        else { const bd = SB().zeilenBand(SB().zeilenLage(zl, c.width, c.height)), xs = bd.map(p => p[0]), ys = bd.map(p => p[1]); st = `left:${Math.min(...xs) / c.width * 100}%;top:${Math.min(...ys) / c.height * 100}%;width:${(Math.max(...xs) - Math.min(...xs)) / c.width * 100}%;height:${(Math.max(...ys) - Math.min(...ys)) / c.height * 100}%`; }
        const kl = (Object.prototype.hasOwnProperty.call(s.aenderungen, i) ? ' geaendert' : '') + (zl.conf < 70 ? ' unsicher' : '');
        return `<button data-kein-ue class="scan-zeile${kl}" data-zeile="${i}" style="${st}" title="${h(zeilenText(s, i))}${zl.conf < 70 ? ' — unsicher erkannt (' + zl.conf + ' %), bitte prüfen' : ''}"></button>`;
      }).join('');
    });
    b.querySelectorAll('[data-zeile]').forEach(k => {
      const alle = () => b.querySelectorAll(`[data-zeile="${k.dataset.zeile}"]`);
      k.onpointerenter = () => alle().forEach(e => e.classList.add('hell'));
      k.onpointerleave = () => alle().forEach(e => e.classList.remove('hell'));
      const i = +k.dataset.zeile, inKopie = !!k.closest('[data-tafel="kopie"]');
      if (!inKopie) { k.onclick = () => zeileAendern(s, i); return; }
      // In der Kopie: kurz tippen ändert, ziehen verschiebt
      k.onpointerdown = e => {
        const r = k.closest('[data-rahmen]').getBoundingClientRect(), x0 = e.clientX, y0 = e.clientY, st = stilVon(s, i);
        const l0 = parseFloat(k.style.left), t0 = parseFloat(k.style.top); let gezogen = false;
        k.setPointerCapture(e.pointerId);
        k.onpointermove = ev => { const dx = ev.clientX - x0, dy = ev.clientY - y0; if (!gezogen && Math.hypot(dx, dy) < 6) return; gezogen = true; k.style.left = (l0 + dx / r.width * 100) + '%'; k.style.top = (t0 + dy / r.height * 100) + '%'; };
        k.onpointerup = ev => {
          k.onpointermove = k.onpointerup = null;
          if (!gezogen) { zeileAendern(s, i); return; }
          st.dx += (ev.clientX - x0) / r.width; st.dy += (ev.clientY - y0) / r.height;
          s.stil = s.stil || {}; s.stil[i] = st; s.aenderungen[i] = zeilenText(s, i); zeichne();
        };
      };
    });
  }
  function zeileAendern(s, i) {
    const alt = s.ocr.zeilen[i].text, jetzt = zeilenText(s, i), st = stilVon(s, i);
    const chip = (k, n) => `<button class="chip${st.ausr === k ? ' on' : ''}" data-ausr="${k}">${n}</button>`;
    ST.opt.dialog(`<h2>✎ Zeile ändern</h2><p class="hinweis">Erkannt (Sicherheit ${s.ocr.zeilen[i].conf} %): <span data-kein-ue>${h(alt)}</span></p>
      <textarea data-t rows="3" data-kein-ue>${h(jetzt)}</textarea>
      <div class="scan-stil"><span>Ausrichtung</span><div class="scan-chips">${chip('l', '⇤ Links')}${chip('m', '↔ Mitte')}${chip('r', '⇥ Rechts')}</div></div>
      <div class="scan-stil"><span>Größe</span><div class="scan-chips"><button class="chip" data-gr="-1" title="Kleiner">A−</button><output data-grw>${Math.round(st.gr * 100)} %</output><button class="chip" data-gr="1" title="Größer">A+</button></div></div>
      ${alsKopie(s) || ST.vergleich !== 'original' ? '<p class="hinweis">In der Kopie lässt sich die Zeile auch mit dem Finger verschieben.</p>' : ''}
      <p class="hinweis">${alsKopie(s) ? 'Die Kopie wird mit dem neuen Text neu gesetzt.' : 'Im Original wird die alte Zeile an ihrer Schriftlinie mit der Papierfarbe überdeckt und der neue Text an dieselbe Stelle geschrieben.'}</p>
      <p class="hinweis">Leer lassen entfernt die Zeile.</p>
      <div class="zeile"><button class="knopf" data-n>Abbrechen</button><button class="knopf" data-r>↺ Wie erkannt</button><button class="knopf rot" data-j>Übernehmen</button></div>`, (d, zu) => {
      const t = d.querySelector('[data-t]'); t.focus(); t.select();
      d.querySelectorAll('[data-ausr]').forEach(k => k.onclick = () => { st.ausr = k.dataset.ausr; d.querySelectorAll('[data-ausr]').forEach(e => e.classList.toggle('on', e === k)); });
      d.querySelectorAll('[data-gr]').forEach(k => k.onclick = () => { st.gr = Math.round(Math.max(0.4, Math.min(3, st.gr + (+k.dataset.gr) * 0.1)) * 10) / 10; d.querySelector('[data-grw]').textContent = Math.round(st.gr * 100) + ' %'; });
      d.querySelector('[data-n]').onclick = zu;
      d.querySelector('[data-r]').onclick = () => { delete s.aenderungen[i]; if (s.stil) delete s.stil[i]; zu(); zeichne(); };
      d.querySelector('[data-j]').onclick = () => {
        const v = t.value.replace(/\s+/g, ' ').trim();
        s.stil = s.stil || {}; if (stilLeer(st)) delete s.stil[i]; else s.stil[i] = st;
        // Eine nur verschobene oder vergrößerte Zeile muss im Original neu geschrieben werden
        if (v === alt && stilLeer(st)) delete s.aenderungen[i]; else s.aenderungen[i] = v;
        zu(); zeichne();
      };
    });
  }
  /* ---------- Bild mit ChatGPT (Klaus 2026-09-27) ----------
     „Es ging nur um einen Prompt, der automatisch eingefügt wird … Wenn ich diesen Button betätige,
     komme ich mit dem Bild, mit dem Prompt zu ChatGPT … Dann kann ich dieses Ergebnis herunterladen
     und wieder bei Workflow PDF einfügen." Ein Knopf hin, ein Knopf zurück — kein Dialog.
     Die App schickt dabei nichts selbst: Android teilt Bild und Auftrag an die App, die man wählt. */
  // Teilen braucht einen frischen Tipp — das Bild wird deshalb VORHER gebaut.
  async function kiBildBauen(s) {
    // 300 dpi statt der 200 der Texterkennung: je schärfer das Bild hinein, desto lesbarer die Schrift zurück
    const key = schluessel(s, KI_DPI, true);
    if (s._kiBild && s._kiBild.key === key) return s._kiBild.datei;
    const c = seiteRechnen(s, KI_DPI, true).canvas;
    const datei = new File([await jpeg(c, 0.92)], (String(ST.name).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Scan') + ' - Seite ' + (ST.seiten.indexOf(s) + 1) + '.jpg', { type: 'image/jpeg' });
    s._kiBild = { key, datei };
    return datei;
  }
  async function zuChatGPT(s) {
    const auftrag = SB().bildAuftrag({ nach: merk.bildNach || 'en' });
    const datei = s._kiBild && s._kiBild.key === schluessel(s, KI_DPI, true) ? s._kiBild.datei : null;
    window.__wfpdfBildKi = { auftrag, bild: datei && { name: datei.name, bytes: datei.size } };
    try { if (navigator.clipboard) navigator.clipboard.writeText(auftrag).catch(() => {}); } catch (_) {}
    if (datei && navigator.canShare && navigator.canShare({ files: [datei], text: auftrag })) {
      try { await navigator.share({ files: [datei], text: auftrag }); window.__wfpdfBildKi.weg = 'teilen'; return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    // Ohne Teilen (Rechner): Bild speichern, Auftrag liegt in der Zwischenablage, ChatGPT öffnen.
    const d = datei || await kiBildBauen(s);
    ST.opt.laden(d.name, new Uint8Array(await d.arrayBuffer()), 'image/jpeg');
    window.__wfpdfBildKi.weg = 'speichern';
    window.open('https://chatgpt.com/', '_blank', 'noopener');
    ST.opt.toast('🖼 Bild gespeichert, Auftrag kopiert — in ChatGPT anhängen und einfügen');
  }
  function zeichneWerkzeug() {
    const w = $q('[data-werkzeug]'), s = akt();
    if (!s || !s.ecken) { w.innerHTML = ''; return; }
    const e = s.erkennung || {};
    const tabs = `<div class="scan-tabs" role="tablist"><button class="modus-k${ST.ansicht === 'zuschnitt' ? ' on' : ''}" data-ansicht="zuschnitt">✂ Zuschneiden</button><button class="modus-k${ST.ansicht === 'ergebnis' ? ' on' : ''}" data-ansicht="ergebnis">✨ Ergebnis</button></div>`;
    let inhalt;
    if (ST.ansicht === 'zuschnitt') {
      inhalt = `<p class="scan-befund ${s.manuell ? 'hand' : e.sicher ? 'ok' : 'pruefen'}" data-befund="${s.manuell ? 'hand' : e.sicher ? 'ok' : 'pruefen'}">${s.kiBild ? '🎨 Bild von ChatGPT — das ganze Bild ist die Seite' : s.manuell ? '✋ Ecken von Hand gesetzt' : e.sicher ? '✓ Blatt erkannt' : '⚠ Bitte Ecken prüfen'}<small>${s.manuell ? '' : h(e.grund || '')}</small></p>
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
          ${s.ocr ? `<button class="knopf${ST.textModus ? ' an' : ''}" data-textmodus>✎ Text ändern</button>` : '<button class="knopf" data-ocr>🔤 Text erkennen</button>'}
          <button class="knopf${ST.vergleich === 'neben' && s.ocr ? ' an' : ''}" data-kopie>📄 Kopie neben Original</button></div>
          <div class="scan-knoepfe"><select data-bildnach title="In diese Sprache übersetzt ChatGPT">${Object.entries(SB().BILD_SPRACHEN).map(([k, v]) => `<option value="${k}"${(merk.bildNach || 'en') === k ? ' selected' : ''}>${h(v)}</option>`).join('')}</select><button class="knopf ki-knopf" data-bildki>🎨 Mit ChatGPT übersetzen</button><button class="knopf" data-bildholen>📥 Ergebnis zurückholen</button></div>
          <p class="hinweis">Gibt Bild und Auftrag an ChatGPT — ChatGPT übersetzt und macht die Schrift dabei schärfer. Das fertige Bild dort speichern und mit 📥 zurückholen — es kommt als neue Seite dahinter.</p>
          ${s.ocr ? '<div class="scan-knoepfe"><button class="knopf" data-maske>🎭 Textmaske (PNG, durchsichtig)</button></div>' : ''}
          <div class="scan-stand" data-ocrstand>${s.ocr ? [
            `<p class="hinweis">${s.ocr.zeilen.length} Zeilen erkannt (${s.ocr.dpi || OCR_DPI} dpi)</p>`,
            s.ocr.zeilen.some(z => z.conf < 70) ? `<p class="hinweis">${s.ocr.zeilen.filter(z => z.conf < 70).length} davon unsicher (gelb) — bitte prüfen</p>` : '',
            Object.keys(s.aenderungen).length ? `<p class="hinweis">${Object.keys(s.aenderungen).length} geändert</p>` : '',
            ST.textModus || ST.vergleich !== 'original' ? '<p class="hinweis">Eine Zeile antippen, um sie zu ändern.</p>' : ''].join('') : '<p class="hinweis">Erkennt den Text auf dem Gerät. Danach lassen sich Zeilen ändern, und das PDF wird durchsuchbar.</p>'}</div>
          ${s.ocr ? `<div class="scan-chips" data-ansichten>${[['original', '📷 Original'], ['neben', '◧ Nebeneinander'], ['kopie', '📄 Kopie']].map(([k, n]) => `<button class="chip${(ST.vergleich || 'original') === k ? ' on' : ''}" data-vgl="${k}">${n}</button>`).join('')}</div>
          <p class="hinweis"><b>Ins PDF kommt:</b></p>
          <div class="scan-chips" data-ausgaben><button class="chip${!alsKopie(s) ? ' on' : ''}" data-ausgabe="original">Original (Foto)</button><button class="chip${alsKopie(s) ? ' on' : ''}" data-ausgabe="kopie">Kopie (sauberer Text)</button></div>
          <p class="hinweis">${alsKopie(s) ? 'Die Kopie trägt nur den erkannten Text — Bilder, Stempel und Handschrift fehlen. Vorher mit dem Original vergleichen.' : 'Das Foto bleibt, wie es ist. Die Kopie ist ein sauber neu gesetztes Blatt aus dem erkannten Text.'}</p>
          <p class="hinweis"><b>Kopie stimmt nicht?</b></p>
          <div class="scan-knoepfe"><button class="knopf" data-genauer${(s.ocr.dpi || OCR_DPI) >= 300 ? ' disabled' : ''}>🔍 Genauer erkennen (300 dpi)</button><button class="knopf" data-neufoto>📷 Seite neu fotografieren</button></div>` : ''}</div>
        <button class="knopf gefahr" data-weg>🗑 Seite entfernen</button>`;
    }
    w.innerHTML = tabs + inhalt;
    w.querySelectorAll('[data-ansicht]').forEach(k => k.onclick = () => { ST.ansicht = k.dataset.ansicht; ST.textModus = false; ST.vergleich = 'original'; zeichne(); });
    const q = sel => w.querySelector(sel);
    if (q('[data-auto]')) q('[data-auto]').onclick = () => { s.manuell = false; s.ecken = s.erkennung.ecken.map(p => p.slice()); s.ocr = null; s.aenderungen = {}; s.stil = {}; zeichne(); };
    if (q('[data-ganz]')) q('[data-ganz]').onclick = () => { s.manuell = true; s.ecken = SB().ganz(s.foto.width, s.foto.height); s.ocr = null; s.aenderungen = {}; s.stil = {}; zeichne(); };
    w.querySelectorAll('[data-filter]').forEach(k => k.onclick = () => { s.filter = k.dataset.filter; merk.filter = s.filter; merken(); zeichne(); });
    const regler = (sel, feld) => { const r = q(sel); if (!r) return; r.oninput = () => { r.nextElementSibling.textContent = r.value; }; r.onchange = () => { s[feld] = +r.value; zeichneBuehne(); zeichneLeiste(); melden(); }; };
    regler('[data-hell]', 'hell'); regler('[data-kontrast]', 'kontrast');
    w.querySelectorAll('[data-dreh]').forEach(k => k.onclick = () => { s.drehung = (s.drehung + (+k.dataset.dreh) + 4) % 4; s.ocr = null; s.aenderungen = {}; s.stil = {}; ST.textModus = false; zeichne(); });
    if (q('[data-alle]')) q('[data-alle]').onclick = () => { for (const o of ST.seiten) { o.filter = s.filter; o.hell = s.hell; o.kontrast = s.kontrast; } ST.opt.toast('Filter, Helligkeit und Kontrast gelten jetzt für alle ' + ST.seiten.length + ' Seiten'); zeichne(); };
    if (q('[data-sprache]')) q('[data-sprache]').onchange = e => { ST.sprache = e.target.value; merk.sprache = ST.sprache; merken(); };
    if (q('[data-ocr]')) q('[data-ocr]').onclick = async () => {
      const k = q('[data-ocr]'); k.disabled = true; k.textContent = '🔤 Text wird erkannt …';
      try { await ocrSeite(s); ST.textModus = true; ST.opt.toast('🔤 ' + s.ocr.zeilen.length + ' Zeilen erkannt'); }
      catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); }
      zeichne();
    };
    if (q('[data-textmodus]')) q('[data-textmodus]').onclick = () => { ST.textModus = !ST.textModus; zeichne(); };
    if (q('[data-kopie]')) q('[data-kopie]').onclick = async () => {
      if (!s.ocr) { const k = q('[data-kopie]'); k.disabled = true; k.textContent = '📄 Text wird erkannt …'; try { await ocrSeite(s); } catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); zeichne(); return; } }
      ST.vergleich = 'neben'; zeichne();
    };
    w.querySelectorAll('[data-vgl]').forEach(k => k.onclick = () => { ST.vergleich = k.dataset.vgl; zeichne(); });
    w.querySelectorAll('[data-ausgabe]').forEach(k => k.onclick = () => { s.ausgabe = k.dataset.ausgabe; zeichne(); });
    if (q('[data-genauer]')) q('[data-genauer]').onclick = async () => {
      if (Object.keys(s.aenderungen).length && !await ST.opt.frage('Neu erkennen?', '<p>Die Seite wird mit 300 dpi neu gelesen. Ihre ' + Object.keys(s.aenderungen).length + ' Änderung(en) an Zeilen gehen dabei verloren.</p>', 'Neu erkennen')) return;
      const k = q('[data-genauer]'); k.disabled = true; k.textContent = '🔍 Wird genauer erkannt …';
      try { await ocrSeite(s, 300); ST.opt.toast('🔍 ' + s.ocr.zeilen.length + ' Zeilen mit 300 dpi erkannt'); } catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); }
      zeichne();
    };
    if (q('[data-bildki]')) {
      const k = q('[data-bildki]'); k.onclick = () => zuChatGPT(s);
      kiBildBauen(s).catch(() => {});
    }
    if (q('[data-bildnach]')) q('[data-bildnach]').onchange = e => { merk.bildNach = e.target.value; merken(); };
    if (q('[data-bildholen]')) q('[data-bildholen]').onclick = () => $q('[data-in-ki]').click();
    if (q('[data-maske]')) q('[data-maske]').onclick = async () => {
      const Q = QUALI[ST.qualitaet] || QUALI.normal, c = kopieRechnen(s, Q.dpi, true).canvas;
      const b = new Uint8Array(await (await new Promise(r => c.toBlob(r, 'image/png'))).arrayBuffer());
      const name = (String(ST.name).replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Scan') + ' - Textmaske Seite ' + (ST.akt + 1) + '.png';
      window.__wfpdfMaske = { name, bytes: b.length, w: c.width, h: c.height };
      ST.opt.laden(name, b, 'image/png'); ST.opt.toast('🎭 ' + name);
    };
    if (q('[data-neufoto]')) q('[data-neufoto]').onclick = () => { ST.ersetze = s.id; $q('[data-in-kamera]').click(); };
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

  // „Automatisch" sagt, was es gewählt hat (Klaus 2026-09-27) — eine stille Wahl sähe aus wie A4 immer.
  function formatIst() {
    const s = ST.seiten[ST.akt];
    if (ST.format !== 'auto' || !s || !s.ecken) return '';
    const f = SB().seitenMass(s.ecken, 'auto', 72).format;
    return `<small data-format-ist="${f}">→ ${h(FORMAT[f] || f)}${f === 'a4' ? ' — A5 oder A6? Bitte wählen, das Foto zeigt die Größe nicht' : ''}</small>`;
  }

  function zeichneFuss() {
    const f = $q('[data-fuss]'), fertig = ST.seiten.length && ST.seiten.every(s => s.ecken);
    const offen = ST.seiten.filter(s => s.erkennung && !s.erkennung.sicher && !s.manuell).length;
    f.innerHTML = `<div class="scan-einst">
        <label>Name <input data-name value="${h(ST.name)}" data-kein-ue></label>
        <label>Seitengröße <select data-format>${Object.entries(FORMAT).map(([k, v]) => `<option value="${k}"${ST.format === k ? ' selected' : ''}>${h(v)}</option>`).join('')}</select>${formatIst()}</label>
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
      ${ST.opt.ablegen ? '<p class="hinweis" data-ablegen-hinweis>Herunterladen, Teilen und „PDF erstellen“ legen das PDF auch ' + h(ST.opt.ort || 'hier in Workfloh PDF') + ' ab — kein neues Importieren nötig.</p>' : ''}
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
    /* Klaus 2026-09-27: „dann lädt er es nicht in das PWA Workflow PDF … Ich muss erst wieder eine
       Datei importieren." Herunterladen und Teilen legen das PDF deshalb AUCH in der Bibliothek ab
       (nur beim Scannen aus der Bibliothek — opt.ablegen). Dasselbe Dokument wird danach ersetzt,
       nicht verdoppelt: ST.abgelegt trägt seine Kennung, auch für „✓ PDF erstellen". */
    const ablegen = async b => {
      if (!ST.opt.ablegen) return false;
      try { ST.abgelegt = await ST.opt.ablegen(b, { name: ST.name, id: ST.abgelegt || null }); window.__wfpdfScanAbgelegt = ST.abgelegt; window.__wfpdfScanAblagen = (window.__wfpdfScanAblagen || 0) + 1; return true; }
      catch (e) { ST.opt.toast('⚠️ ' + (e.message || e)); return false; }
    };
    q('[data-laden]').onclick = async () => { const b = await bauen(); if (b) { ST.opt.laden(datei() + '.pdf', b, 'application/pdf'); const ab = await ablegen(b); ST.opt.toast(ab ? '⬇ ' + datei() + '.pdf · auch ' + (ST.opt.ortKurz || 'in Workfloh PDF') + ' abgelegt' : '⬇ ' + datei() + '.pdf'); } };
    q('[data-teilen]').onclick = async () => {
      const b = await bauen(); if (!b) return;
      await ablegen(b);
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
        for (let i = 0; i < ST.seiten.length; i++) { fb.setze(i / ST.seiten.length, 'Seite ' + (i + 1)); eintraege.push({ name: datei() + ' - Seite ' + String(i + 1).padStart(2, '0') + '.jpg', bytes: await jpeg(alsKopie(ST.seiten[i]) ? kopieRechnen(ST.seiten[i], Q.dpi).canvas : seiteRechnen(ST.seiten[i], Q.dpi, true).canvas, Q.q) }); }
        const z = WFP.Zip.zip(eintraege); fb.zu(); ST.opt.laden(datei() + '.zip', z, 'application/zip'); ST.opt.toast('🖼 ' + eintraege.length + ' Bilder als ZIP');
      } catch (e) { fb.zu(); ST.opt.toast('⚠️ ' + (e.message || e)); }
    };
    q('[data-fertig]').onclick = async () => {
      if (offen && !await ST.opt.frage('Nicht alle Seiten geprüft', `<p>Bei ${offen} ${offen === 1 ? 'Seite' : 'Seiten'} waren sich die Verfahren beim Zuschnitt nicht einig. Trotzdem so übernehmen?</p>`, 'Trotzdem übernehmen', 'Zurück und prüfen')) return;
      const b = await bauen(); if (!b) return;
      const opt = ST.opt, name = ST.name, id = ST.abgelegt || null; schliessen();
      try { await opt.fertig(b, { name, id }); } catch (e) { opt.toast('⚠️ ' + (e.message || e)); }
    };
  }
  const groesse = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';

  window.WFP = window.WFP || {};
  window.WFP.Scanner = { pfade: p => Object.assign(PF, p || {}), oeffnen, schliessen, hinzu, zustand: () => ST, pdfBauen, seiteRechnen, kopieRechnen, ocrSeite, erkennen, zeichne, zuChatGPT };
})();
