/* Amtsformular (erfunden) — Körper für tools/handbuch-bauen.mjs; läuft im Browser, pdf-lib ist dort geladen. */

  const pdf = await PDFDocument.create();
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const SW = farbe('#111111'), GR = farbe('#555555'), FL = farbe('#e6e6e6'), BL = farbe('#1f4e8c');
  let p = pdf.addPage([595.28, 841.89]);
  // Kopf: Wappen-Ersatz + Behörde
  p.drawRectangle({ x: 50, y: 770, width: 34, height: 40, borderColor: BL, borderWidth: 2 });
  p.drawText('M', { x: 59, y: 782, size: 20, font: B, color: BL });
  p.drawText('Stadt Musterstadt', { x: 96, y: 796, size: 14, font: B, color: SW });
  p.drawText('Bürgeramt · Straßenverkehrsbehörde', { x: 96, y: 780, size: 10, font: R, color: GR });
  p.drawText('Rathausplatz 1 · 12345 Musterstadt · Tel. 01234 5678-0', { x: 96, y: 767, size: 8.5, font: R, color: GR });
  p.drawText('Aktenzeichen: ____________', { x: 400, y: 796, size: 9, font: R, color: GR });
  p.drawText('Eingangsstempel', { x: 445, y: 745, size: 7.5, font: R, color: GR });
  p.drawRectangle({ x: 420, y: 700, width: 125, height: 55, borderColor: GR, borderWidth: 0.6, borderDashArray: [3, 2] });
  p.drawText('Antrag auf Erteilung eines Bewohnerparkausweises', { x: 50, y: 720, size: 13, font: B, color: SW });
  p.drawText('für die Parkzone B (Innenstadt) nach § 45 Abs. 1b StVO', { x: 50, y: 703, size: 10, font: R, color: SW });
  let y = 672;
  const abschnitt = t => { p.drawRectangle({ x: 50, y: y - 4, width: 495, height: 18, color: BL }); p.drawText(t, { x: 56, y: y + 1, size: 10.5, font: B, color: rgb(1, 1, 1) }); y -= 30; };
  const feld = (label, x, w) => { p.drawText(label, { x, y: y + 16, size: 8, font: R, color: GR }); p.drawRectangle({ x, y: y - 4, width: w, height: 17, color: FL }); };
  const zeile = (felder) => { felder.forEach(([l, x, w]) => feld(l, x, w)); y -= 38; };
  abschnitt('1. Angaben zur antragstellenden Person');
  zeile([['Familienname', 50, 235], ['Vorname(n)', 300, 245]]);
  zeile([['Geburtsdatum (TT.MM.JJJJ)', 50, 150], ['Geburtsort', 215, 160], ['Staatsangehörigkeit', 390, 155]]);
  zeile([['Straße, Hausnummer', 50, 330], ['Postleitzahl', 395, 150]]);
  zeile([['Wohnort', 50, 235], ['Telefon (tagsüber erreichbar)', 300, 245]]);
  zeile([['E-Mail-Adresse', 50, 495]]);
  const kaestchen = (x, t) => { p.drawRectangle({ x, y: y - 1, width: 10, height: 10, borderColor: SW, borderWidth: 0.8 }); p.drawText(t, { x: x + 15, y, size: 9.5, font: R, color: SW }); };
  p.drawText('Mit Hauptwohnsitz gemeldet seit:', { x: 50, y, size: 9.5, font: R, color: SW }); p.drawLine({ start: { x: 205, y: y - 2 }, end: { x: 330, y: y - 2 }, thickness: 0.7, color: SW });
  kaestchen(360, 'Hauptwohnsitz'); kaestchen(460, 'Nebenwohnsitz'); y -= 34;
  abschnitt('2. Angaben zum Fahrzeug');
  zeile([['Amtliches Kennzeichen', 50, 160], ['Hersteller und Typ', 225, 320]]);
  p.drawText('Das Fahrzeug ist', { x: 50, y, size: 9.5, font: R, color: SW });
  kaestchen(140, 'auf mich zugelassen'); kaestchen(275, 'ein Firmenwagen'); kaestchen(395, 'geleast / gemietet'); y -= 20;
  p.drawText('Bei Firmen- oder Leasingfahrzeug: Nachweis der überwiegenden privaten Nutzung beifügen.', { x: 50, y, size: 8.5, font: R, color: GR }); y -= 30;
  abschnitt('3. Beigefügte Unterlagen');
  kaestchen(50, 'Kopie der Zulassungsbescheinigung Teil I (Fahrzeugschein)'); y -= 18;
  kaestchen(50, 'Kopie des Personalausweises (Vorder- und Rückseite)'); y -= 18;
  kaestchen(50, 'Nachweis der privaten Nutzung (nur bei Firmen- oder Leasingfahrzeug)'); y -= 30;
  // Gebühren-Hinweis
  p.drawRectangle({ x: 50, y: y - 34, width: 495, height: 44, color: farbe('#fff4c2'), borderColor: farbe('#c9a400'), borderWidth: 0.8 });
  p.drawText('Gebühr: 30,00 € für zwölf Monate. Der Ausweis wird erst nach Zahlungseingang ausgestellt.', { x: 58, y: y - 6, size: 9.5, font: B, color: SW });
  p.drawText('Die Zahlungsaufforderung erhalten Sie nach Prüfung Ihres Antrags per Post.', { x: 58, y: y - 22, size: 9, font: R, color: SW });
  y -= 70;
  p.drawText('Ich versichere, dass die Angaben vollständig und richtig sind.', { x: 50, y, size: 9.5, font: R, color: SW }); y -= 44;
  p.drawLine({ start: { x: 50, y }, end: { x: 230, y }, thickness: 0.7, color: SW }); p.drawLine({ start: { x: 290, y }, end: { x: 545, y }, thickness: 0.7, color: SW });
  p.drawText('Ort, Datum', { x: 50, y: y - 11, size: 8, font: R, color: GR }); p.drawText('Unterschrift der antragstellenden Person', { x: 290, y: y - 11, size: 8, font: R, color: GR });
  p.drawText('Seite 1 von 2 · Vordruck BPA-01 (erfundenes Beispiel, keine echte Behörde)', { x: 50, y: 30, size: 7.5, font: R, color: GR });
  // Seite 2: Kleingedrucktes + Behördenteil
  p = pdf.addPage([595.28, 841.89]); y = 790;
  p.drawText('Hinweise zum Datenschutz (Art. 13 DSGVO)', { x: 50, y, size: 12, font: B, color: SW }); y -= 20;
  const klein = ['Verantwortlich für die Verarbeitung Ihrer Daten ist die Stadt Musterstadt, Bürgeramt, Rathausplatz 1, 12345 Musterstadt. Die Datenschutzbeauftragte erreichen Sie unter der oben genannten Anschrift mit dem Zusatz „Datenschutz".',
    'Ihre Angaben werden ausschließlich zur Bearbeitung dieses Antrags und zur Ausstellung des Bewohnerparkausweises verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 Buchstabe e DSGVO in Verbindung mit § 45 Abs. 1b der Straßenverkehrs-Ordnung.',
    'Die Daten werden nach Ablauf der Gültigkeit des Ausweises für die Dauer von zwei Jahren aufbewahrt und danach gelöscht, sofern keine gesetzlichen Aufbewahrungsfristen entgegenstehen. Eine Weitergabe an Dritte findet nicht statt.',
    'Sie haben das Recht auf Auskunft, Berichtigung, Löschung und Einschränkung der Verarbeitung sowie ein Beschwerderecht bei der Aufsichtsbehörde. Ohne die Angaben in Abschnitt 1 und 2 kann der Antrag nicht bearbeitet werden.'];
  for (const a of klein) { for (const z of umbrechen(R, a, 9, 495)) { p.drawText(z, { x: 50, y, size: 9, font: R, color: SW }); y -= 12.5; } y -= 8; }
  y -= 10;
  p.drawRectangle({ x: 50, y: y - 150, width: 495, height: 160, borderColor: GR, borderWidth: 1 });
  p.drawText('Nur von der Behörde auszufüllen', { x: 60, y: y - 10, size: 10, font: B, color: GR });
  const behoerde = ['Ausweis-Nr.:', 'Gültig von:', 'Gültig bis:', 'Gebühr bezahlt am:', 'Bearbeitet (Kürzel):'];
  behoerde.forEach((t, i) => { const yy = y - 36 - i * 24; p.drawText(t, { x: 60, y: yy, size: 9.5, font: R, color: GR }); p.drawLine({ start: { x: 175, y: yy - 2 }, end: { x: 380, y: yy - 2 }, thickness: 0.6, color: GR }); });
  p.drawText('Seite 2 von 2 · Vordruck BPA-01 (erfundenes Beispiel, keine echte Behörde)', { x: 50, y: 30, size: 7.5, font: R, color: GR });
  pdf.setTitle('Antrag auf Bewohnerparkausweis (Beispiel)'); pdf.setLanguage('de'); pdf.setCreationDate(DATUM); pdf.setModificationDate(DATUM); pdf.setProducer('Workfloh PDF'); pdf.setCreator('tools/handbuch-bauen.mjs');
