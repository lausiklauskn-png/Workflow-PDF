/* Workfloh PDF — Export mit pdf-lib.
   modus 'fest'        : Inhalte werden Teil der Seite (keine Formularfelder mehr)
   modus 'ausfuellbar' : echte PDF-Formularfelder, vorbelegt mit den eingetragenen Werten
   modus 'vorlage'     : echte PDF-Formularfelder, LEER — der Empfänger füllt aus
   Koordinaten: Felder stehen in Prozent der ANGEZEIGTEN Seite. Umgerechnet wird
   über die Viewport-Matrix, die pdf.js beim Import je Seite mitgeliefert hat —
   so stimmen auch gedrehte Seiten und verschobene Seitenränder (CropBox). */
(function () {
  'use strict';

  function invert(t) {
    const [a, b, c, d, e, f] = t; const det = a * d - b * c;
    return (px, py) => [(d * (px - e) - c * (py - f)) / det, (-b * (px - e) + a * (py - f)) / det];
  }

  // Helvetica (WinAnsi) kann Umlaute und ß, aber keine Emojis oder kyrillische
  // Zeichen. Was nicht darstellbar ist, wird ersetzt statt den Export abzubrechen.
  const ERSATZ = { '–': '-', '—': '-', '„': '"', '“': '"', '”': '"', '‚': "'", '‘': "'", '’': "'", '…': '...', ' ': ' ', '→': '->', '✓': 'x', '✔': 'x' };
  function saeubern(font, s) {
    let out = '', ersetzt = 0;
    for (const ch of String(s || '')) {
      const c = ERSATZ[ch] != null ? ERSATZ[ch] : ch;
      if (c === '\n' || c === '\r') { out += c; continue; }
      try { font.widthOfTextAtSize(c, 10); out += c; } catch (_) { out += '?'; ersetzt++; }
    }
    return { text: out, ersetzt };
  }

  function datumText(v) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(v || ''));
    return m ? m[3] + '.' + m[2] + '.' + m[1] : String(v || '');
  }

  function umbrechen(font, text, size, breite) {
    const zeilen = [];
    for (const absatz of String(text).split(/\r?\n/)) {
      const woerter = absatz.split(/\s+/); let z = '';
      for (const w of woerter) {
        const t = z ? z + ' ' + w : w;
        if (font.widthOfTextAtSize(t, size) <= breite || !z) z = t; else { zeilen.push(z); z = w; }
      }
      zeilen.push(z);
    }
    return zeilen;
  }

  // Schriftgröße, die in den Kasten passt (einzeilig: Höhe und Breite; mehrzeilig: umbrechen)
  function passendeGroesse(font, text, bw, bh, mehrzeilig) {
    let s = Math.min(12, bh * 0.68);
    if (!mehrzeilig) {
      while (s > 4 && font.widthOfTextAtSize(text, s) > bw - 2) s -= 0.25;
      return { size: Math.max(4, s), zeilen: [text] };
    }
    for (; s > 4; s -= 0.25) {
      const z = umbrechen(font, text, s, bw - 2);
      if (z.length * s * 1.18 <= bh) return { size: s, zeilen: z };
    }
    return { size: 4, zeilen: umbrechen(font, text, 4, bw - 2) };
  }

  function feldName(f, vergeben) {
    let base = String(f.label || '').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
    if (!base) base = f.type === 'check' ? 'Kaestchen' : f.type === 'datum' ? 'Datum' : 'Feld';
    let n = base, i = 2;
    while (vergeben.has(n.toLowerCase())) n = base + '_' + (i++);
    vergeben.add(n.toLowerCase());
    return n;
  }

  async function exportieren(doc, bytes, modus) {
    const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const pages = pdf.getPages();
    const hinweise = [];
    let ersetztGesamt = 0;

    // Vorhandene Formularfelder des Originals entfernen: sie stehen (übernommen)
    // im eigenen Feldmodell und würden sonst doppelt erscheinen.
    let form = null;
    try {
      form = pdf.getForm();
      for (const fld of form.getFields()) { try { form.removeField(fld); } catch (_) { hinweise.push('Ein Originalfeld ließ sich nicht entfernen: ' + fld.getName()); } }
    } catch (_) { form = null; }
    if (modus !== 'fest' && !form) form = pdf.getForm();

    const vergeben = new Set();
    for (const f of doc.fields) {
      const pInfo = doc.pages[f.page]; const page = pages[f.page];
      if (!pInfo || !page) continue;
      const inv = invert(pInfo.t);
      const W = pInfo.w, H = pInfo.h;                 // angezeigte Seite in pt (Maßstab 1)
      const u = f.x / 100 * W, v = f.y / 100 * H, bw = f.w / 100 * W, bh = f.h / 100 * H;
      const o = inv(0, 0), ex = inv(1, 0);
      const winkel = Math.round(Math.atan2(ex[1] - o[1], ex[0] - o[0]) * 180 / Math.PI);
      const p = (dx, dy) => inv(u + dx, v + dy);     // Punkt relativ zur linken oberen Ecke (angezeigt)

      const wert = f.type === 'check' ? !!f.value : f.type === 'datum' ? datumText(f.value) : String(f.value == null ? '' : f.value);

      // Gedruckten Inhalt im Feld abdecken, damit nichts doppelt übereinander steht
      if (f.decken && /^#[0-9a-f]{6}$/i.test(f.decken) && f.type !== 'check') {
        const hx = s => parseInt(f.decken.slice(s, s + 2), 16) / 255;
        const a = p(0, bh);
        page.drawRectangle({ x: a[0], y: a[1], width: bw, height: bh, color: rgb(hx(1), hx(3), hx(5)), rotate: degrees(winkel) });
      }
      if (f.type === 'unterschrift') {
        // Als Bild auf die Seite, in allen Fassungen gleich; die leere Vorlage bleibt leer
        if (!wert || modus === 'vorlage' || !/^data:image\/png;base64,/.test(wert)) continue;
        try {
          const img = await pdf.embedPng(wert);
          const s = Math.min(bw / img.width, bh / img.height), iw = img.width * s, ih = img.height * s;
          const a = p(0, bh - (bh - ih) / 2);
          page.drawImage(img, { x: a[0], y: a[1], width: iw, height: ih, rotate: degrees(winkel) });
        } catch (e) { hinweise.push('Unterschrift „' + (f.label || 'Unterschrift') + '" ließ sich nicht einsetzen.'); }
        continue;
      }
      if (f.type === 'qr') {
        if (!wert) continue;
        try {
          const qr = qrcode(0, 'M'); qr.addData(wert); qr.make();
          const n = qr.getModuleCount(), seite = Math.min(bw, bh), m = seite / n;
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
            if (!qr.isDark(r, c)) continue;
            const a = p(c * m, (r + 1) * m);
            page.drawRectangle({ x: a[0], y: a[1], width: m + 0.02, height: m + 0.02, color: rgb(0, 0, 0), rotate: degrees(winkel) });
          }
        } catch (e) { hinweise.push('QR-Code „' + (f.label || 'QR') + '" ist für die Feldgröße zu lang.'); }
        continue;
      }

      if (modus === 'fest') {
        if (f.type === 'check') {
          if (!wert) continue;
          const s = Math.min(bw, bh);
          const a = p(s * 0.18, s * 0.55), b = p(s * 0.42, s * 0.8), c = p(s * 0.85, s * 0.2);
          page.drawLine({ start: { x: a[0], y: a[1] }, end: { x: b[0], y: b[1] }, thickness: Math.max(1, s * 0.12), color: rgb(0, 0, 0) });
          page.drawLine({ start: { x: b[0], y: b[1] }, end: { x: c[0], y: c[1] }, thickness: Math.max(1, s * 0.12), color: rgb(0, 0, 0) });
          continue;
        }
        if (!wert) continue;
        const { text, ersetzt } = saeubern(font, wert); ersetztGesamt += ersetzt;
        const { size, zeilen } = passendeGroesse(font, text, bw, bh, !!f.mehrzeilig);
        const zeilenH = size * 1.18;
        const blockH = zeilen.length * zeilenH;
        const oben = f.mehrzeilig ? Math.max(0, (bh - blockH) / 2) : 0;
        zeilen.forEach((z, i) => {
          const base = f.mehrzeilig ? oben + (i + 1) * zeilenH - size * 0.22 : bh / 2 + size * 0.34;
          const a = p(1, base);
          page.drawText(z, { x: a[0], y: a[1], size, font, color: rgb(0, 0, 0.12), rotate: degrees(winkel) });
        });
        continue;
      }

      // ausfüllbar / vorlage: echte Formularfelder
      const name = feldName(f, vergeben);
      // pdf-lib dreht das Widget-Rechteck selbst um seinen Anker (x, y). Deshalb:
      // Breite/Höhe in Anzeige-Richtung, Anker = linke untere Ecke der ANZEIGE.
      const anker = p(0, bh);
      const opt = { x: anker[0], y: anker[1], width: bw, height: bh, rotate: degrees(((winkel % 360) + 360) % 360), backgroundColor: rgb(0.91, 0.94, 1), borderColor: rgb(0.45, 0.58, 0.9), borderWidth: 0.6 };
      if (f.type === 'check') {
        const cb = form.createCheckBox(name);
        // Kästchen ohne Füllung: sonst deckt der Hintergrund einen gedruckten Haken ab
        cb.addToPage(page, Object.assign({}, opt, { backgroundColor: undefined }));
        if (modus === 'ausfuellbar' && wert) cb.check();
        continue;
      }
      const tf = form.createTextField(name);
      if (f.mehrzeilig) tf.enableMultiline();
      let gross = Math.max(5, Math.min(12, bh * (f.mehrzeilig ? 0.34 : 0.62)));
      if (modus === 'ausfuellbar' && wert) {
        const { text, ersetzt } = saeubern(font, wert); ersetztGesamt += ersetzt;
        tf.setText(text);
        gross = Math.min(gross, passendeGroesse(font, text, bw, bh, !!f.mehrzeilig).size);
      }
      tf.addToPage(page, Object.assign({ font }, opt));   // erst danach gibt es einen /DA-Eintrag
      tf.setFontSize(gross);
    }
    if (ersetztGesamt) hinweise.push(ersetztGesamt + ' Zeichen ließen sich mit der PDF-Standardschrift nicht darstellen und wurden durch „?" ersetzt.');
    if (form && modus !== 'fest') { try { form.updateFieldAppearances(font); } catch (_) {} }
    // Standard-Ressourcen des Formulars (/DR, /DA). pdf-lib lässt sie weg; Programme,
    // die beim Ausfüllen das Feldbild neu zeichnen (Acrobat, Android-Anzeigen),
    // finden die Schrift sonst nicht und zeigen den Text nicht an.
    if (form && modus !== 'fest') {
      try {
        const af = form.acroForm.dict;
        af.set(PDFLib.PDFName.of('DR'), pdf.context.obj({ Font: { Helvetica: font.ref } }));
        af.set(PDFLib.PDFName.of('DA'), PDFLib.PDFString.of('/Helvetica 0 Tf 0 g'));
      } catch (_) {}
    }
    pdf.setTitle(doc.name || 'Workfloh PDF');
    pdf.setProducer('Workfloh PDF');
    pdf.setCreator('Workflow PDF (lausiklauskn-png.github.io/Workflow-PDF)');
    const out = await pdf.save({ updateFieldAppearances: modus !== 'fest' });
    return { bytes: out, hinweise };
  }

  /* Fotos (JPEG-DataURLs) zu einem PDF: je Bild eine Seite in A4-Breite. */
  async function bilderZuPdf(bilder) {
    const { PDFDocument } = PDFLib;
    const pdf = await PDFDocument.create();
    for (const b of bilder) {
      const img = await pdf.embedJpg(b.bytes);
      const breite = 595.28, hoehe = breite * img.height / img.width;
      const page = pdf.addPage([breite, hoehe]);
      page.drawImage(img, { x: 0, y: 0, width: breite, height: hoehe });
    }
    pdf.setProducer('Workfloh PDF');
    return pdf.save();
  }

  window.WFP = window.WFP || {};
  window.WFP.Export = { exportieren, bilderZuPdf, datumText, invert };
})();
