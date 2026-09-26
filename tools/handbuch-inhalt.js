/* Benutzerhandbuch Workfloh PDF — Inhalt und Satz. Läuft im Browser (pdf-lib geladen),
   aufgerufen von tools/handbuch-bauen.mjs mit ARG = { bilder: {name: jpeg-base64}, icon }.
   Nur Zeichen der Standardschrift (WinAnsi): keine Emojis, keine Pfeile. */
const pdf = await PDFDocument.create();
const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold), I = await pdf.embedFont(StandardFonts.HelveticaOblique);
const ROT = farbe('#c8201a'), SW = farbe('#151515'), GR = farbe('#5a5a5a'), HELL = farbe('#f2f2f2'), WEISS = rgb(1, 1, 1);
const HOCH = [595.28, 841.89], QUER = [841.89, 595.28];
const L = 56, BR = 483;
let p, y, nr = 0; const kapitel = [];
const fuss = () => { p.drawLine({ start: { x: L, y: 50 }, end: { x: p.getWidth() - L, y: 50 }, thickness: 0.5, color: GR }); p.drawText('Workfloh PDF · Benutzerhandbuch', { x: L, y: 36, size: 8, font: R, color: GR }); const t = 'Seite ' + nr; p.drawText(t, { x: p.getWidth() - L - R.widthOfTextAtSize(t, 8), y: 36, size: 8, font: R, color: GR }); };
const seite = (format) => { p = pdf.addPage(format || HOCH); nr++; y = p.getHeight() - 64; fuss(); };
const platz = h => { if (y - h < 70) seite(); };
const kap = (t) => { seite(); kapitel.push([t, nr]); p.drawRectangle({ x: 0, y: y - 8, width: 8, height: 30, color: ROT }); p.drawText(t, { x: L, y, size: 20, font: B, color: SW }); y -= 36; };
const ueber = t => { platz(40); y -= 4; p.drawText(t, { x: L, y, size: 13, font: B, color: ROT }); y -= 20; };
const text = (t, o = {}) => { const gr = o.gr || 10.5, f = o.f || R, x = o.x || L, br = o.br || BR; for (const z of umbrechen(f, t, gr, br)) { platz(gr * 1.5); p.drawText(z, { x, y, size: gr, font: f, color: o.farbe || SW }); y -= gr * 1.45; } y -= o.nach == null ? 7 : o.nach; };
const schritte = liste => liste.forEach((t, i) => { platz(30); p.drawCircle({ x: L + 9, y: y + 4, size: 9, color: ROT }); const n = String(i + 1); p.drawText(n, { x: L + 9 - B.widthOfTextAtSize(n, 10) / 2, y: y, size: 10, font: B, color: WEISS }); text(t, { x: L + 26, br: BR - 26, nach: 5 }); });
const punkte = (liste, x = L, br = BR) => liste.forEach(t => { const z = umbrechen(R, t, 10.5, br - 14); z.forEach((s, k) => { platz(16); if (!k) p.drawText('•', { x, y, size: 10.5, font: B, color: ROT }); p.drawText(s, { x: x + 14, y, size: 10.5, font: R, color: SW }); y -= 15.2; }); y -= 3; });
const kasten = (kopf, t, grund, schrift, rand) => { const z = umbrechen(R, t, 10, BR - 30), h = 30 + z.length * 14.5; platz(h + 14); y -= 8; p.drawRectangle({ x: L, y: y - h + 14, width: BR, height: h, color: farbe(grund), borderColor: rand ? farbe(rand) : undefined, borderWidth: rand ? 1 : 0 }); p.drawText(kopf, { x: L + 14, y: y - 4, size: 11, font: B, color: farbe(schrift) }); let yy = y - 22; z.forEach(s => { p.drawText(s, { x: L + 14, y: yy, size: 10, font: R, color: farbe(schrift) }); yy -= 14.5; }); y -= h + 12; };
const tabelle = (kopf, reihen, breiten, x0 = L) => { const gr = 9.5, ges = breiten.reduce((a, b) => a + b); const zeile = (werte, fett, grund) => { const zs = werte.map((w, i) => umbrechen(fett ? B : R, w, gr, breiten[i] - 12)); const h = Math.max(...zs.map(z => z.length)) * gr * 1.38 + 9; platz(h + 4); p.drawRectangle({ x: x0, y: y - h + 12, width: ges, height: h, color: grund ? farbe(grund) : WEISS }); let x = x0; zs.forEach((z, i) => { z.forEach((s, k) => p.drawText(s, { x: x + 6, y: y - k * gr * 1.38, size: gr, font: fett ? B : R, color: SW })); x += breiten[i]; }); p.drawLine({ start: { x: x0, y: y - h + 12 }, end: { x: x0 + ges, y: y - h + 12 }, thickness: 0.6, color: GR }); y -= h; }; y -= 6; platz(70); zeile(kopf, true, '#e4e4e4'); reihen.forEach((r, i) => zeile(r, false, i % 2 ? '#f7f7f7' : null)); y -= 16; };
const bild = async (name, unter, maxH = 330, br = BR) => { const img = await pdf.embedJpg(b64(ARG.bilder[name])); const s = Math.min(br / img.width, maxH / img.height); const w = img.width * s, h = img.height * s; platz(h + 34); const x = L + (BR - w) / 2; p.drawRectangle({ x: x - 1, y: y - h - 1, width: w + 2, height: h + 2, color: farbe('#bdbdbd') }); p.drawImage(img, { x, y: y - h, width: w, height: h }); y -= h + 14; text(unter, { f: I, gr: 9, farbe: GR, nach: 10 }); };
const spalten = (links, rechts, kl, kr) => { const y0 = y, b = (BR - 24) / 2; p.drawText(kl, { x: L, y, size: 11.5, font: B, color: SW }); y -= 18; punkte(links, L, b); const yl = y; y = y0; p.drawText(kr, { x: L + b + 24, y, size: 11.5, font: B, color: SW }); y -= 18; punkte(rechts, L + b + 24, b); y = Math.min(y, yl) - 6; };

/* ----- Titelseite ----- */
p = pdf.addPage(HOCH); nr++;
p.drawRectangle({ x: 0, y: 560, width: HOCH[0], height: 282, color: ROT });
const floh = await pdf.embedPng(b64(ARG.icon));
/* Heller Rauch hinter dem roten Floh (Klaus 2026-09-25): rot auf Rot verschwamm. */
/* EIN Kreis mit Verlauf nach außen (Klaus: „ein Kreis … Verlauf nach außen, dünner werdend"):
   viele deckungsgleiche Kreise mit wenig Deckkraft — innen addieren sie sich, außen bleibt nur der Rand. */
for (let i = 0; i < 36; i++) p.drawCircle({ x: 475, y: 675, size: 100 - i * 2.4, color: WEISS, opacity: 0.03 });
p.drawImage(floh, { x: 400, y: 600, width: 150, height: 150 });
p.drawText('Workfloh PDF', { x: L, y: 760, size: 38, font: B, color: WEISS });
p.drawText('Benutzerhandbuch', { x: L, y: 722, size: 20, font: R, color: WEISS });
p.drawText('Formulare einlesen, ausfüllen, ausgeben', { x: L, y: 660, size: 12.5, font: R, color: WEISS });
p.drawText('und übersetzen – auf dem eigenen Gerät.', { x: L, y: 643, size: 12.5, font: R, color: WEISS });
p.drawText('Stand: September 2026', { x: L, y: 590, size: 10, font: R, color: WEISS });
y = 500; text('Dieses Handbuch erklärt jede Funktion der App an einem durchgespielten Beispiel: einem Antrag auf einen Bewohnerparkausweis der Stadt Musterstadt. Formular und Personendaten sind erfunden; das Formular liegt in der App bei und kann selbst ausprobiert werden.', { br: 483 });
text('Das Handbuch dient zugleich als Probestück für die Übersetzung: Es enthält Bilder, farbige Hinweiskästen, Tabellen, eine Seite im Querformat und eine gescannte Seite. Nach dem Übersetzen sollte jedes dieser Elemente an seiner Stelle stehen.', { f: I, farbe: GR });
fuss();
/* ----- Inhaltsverzeichnis (wird am Ende gefüllt) ----- */
seite(); const tocSeite = p; p.drawText('Inhalt', { x: L, y, size: 20, font: B, color: SW });

/* ----- 1 ----- */
kap('1  Was Workfloh PDF ist');
text('Workfloh PDF macht aus einem Papier- oder PDF-Formular ein Formular, das sich am Tablet, Handy oder Computer ausfüllen lässt. Die App findet die Stellen, an denen etwas eingetragen werden soll, Sie prüfen die Vorschläge, füllen aus, unterschreiben mit dem Finger und geben ein fertiges PDF aus. Dokumente in einer fremden Sprache übersetzt die App Seite für Seite – so, dass Bilder und Aufbau des Originals erhalten bleiben.');
text('Die App läuft im Browser und lässt sich wie eine gewöhnliche App auf den Startbildschirm legen. Nach dem ersten Öffnen funktioniert sie ohne Internet.');
y -= 4; spalten(['liest PDF-Dateien, Fotos und ganze Ordner ein', 'erkennt Linien, Rahmen, graue Flächen und Kästchen', 'füllt aus, auch mit Unterschrift', 'gibt festes oder ausfüllbares PDF aus', 'übersetzt Deutsch, Russisch und Englisch'], ['lädt nichts ungefragt ins Internet', 'verändert das Original nicht', 'verlangt kein Konto und keine Anmeldung', 'ersetzt keine beglaubigte Übersetzung', 'speichert nichts auf fremden Servern'], 'Was die App tut', 'Was sie nicht tut');
kasten('Ihre Daten bleiben auf dem Gerät', 'Alles, was Sie einlesen und eintragen, liegt im Speicher dieses Browsers. Ins Netz geht nur, was Sie ausdrücklich an eine KI oder an den Chrome-Übersetzer schicken – und davor fragt die App.', '#2e7d32', '#ffffff');

/* ----- 2 ----- */
kap('2  Einrichten');
schritte(['Die Adresse der App im Browser öffnen (Chrome empfohlen).', 'Oben auf „Installieren" tippen. Die App liegt danach als Symbol auf dem Startbildschirm und öffnet sich im eigenen Fenster.', 'Nach einer neuen Fassung der App oben rechts auf das Kreispfeil-Symbol tippen. Die Dokumente bleiben dabei erhalten.']);
await bild('bibliothek', 'Bild 1: Die Bibliothek. Oben die Knöpfe zum Einlesen und Übersetzen, darunter die Ordner und Dokumente.');
kasten('Zwei Browser sind zwei Speicher', 'Auf einem Samsung-Tablet sind Chrome im DeX-Modus und Chrome im Tablet-Modus getrennte Browser. Ein Dokument, das Sie im einen einlesen, sehen Sie im anderen nicht. Über „Speichern" als Datei lässt es sich mitnehmen.', '#1f4e8c', '#ffffff');

/* ----- 3 ----- */
kap('3  Ein Formular einlesen');
text('Es gibt drei Wege, ein Formular in die App zu bringen. Alle drei legen das Dokument in einen Ordner der Bibliothek; das Original auf dem Gerät bleibt unverändert.');
tabelle(['Weg', 'Wofür', 'Was die App daraus macht'], [['PDF oder Bild', 'eine PDF-Datei oder ein Foto (JPG, PNG)', 'PDF: jede Seite wie im Original. Foto: das Blatt wird gesucht und auf A4 gerade gezogen.'], ['Ordner', 'viele Dateien auf einmal', 'jede Datei wird ein eigenes Dokument im gleichnamigen Ordner'], ['Fotografieren', 'ein Papierformular', 'Seite für Seite aufnehmen, jede Seite auf A4 gerade gezogen']], [110, 150, 223]);
ueber('Beispiel: den Antrag einlesen');
schritte(['In der Bibliothek auf „PDF oder Bild" tippen.', 'Die Datei „Beispiel-Amtsformular-Bewohnerparkausweis.pdf" wählen (sie liegt der App bei, siehe Kapitel 8).', 'Die App öffnet das Dokument im Bearbeiten-Modus.']);
kasten('Hinweis zu Fotos', 'Findet die App die Blattkanten nicht sicher, schneidet sie nichts ab: Dann wird das ganze Foto auf A4 gesetzt. Ausgedruckt mit „Tatsächliche Größe" hat das Blatt wieder die Größe des Papiers.', '#fff4c2', '#151515', '#c9a400');
await bild('eingelesen', 'Bild 2: Der Antrag direkt nach dem Einlesen – noch ohne Felder.', 225);

/* ----- 4 ----- */
kap('4  Felder erkennen und setzen');
text('Ein Feld ist eine Stelle, an der später etwas eingetragen wird. Die App kann Felder selbst finden; Sie prüfen die Vorschläge und setzen fehlende von Hand.');
ueber('Felder erkennen lassen');
schritte(['Auf „Felder erkennen" tippen.', '„Ohne KI" wählen: Die App sucht Linien, Rahmen, graue Eingabeflächen und Kästchen – auf dem Gerät, ohne Internet.', 'Die Vorschläge erscheinen orange gestrichelt. Die Beschriftung übernimmt die App aus dem Text daneben.']);
await bild('erkannt', 'Bild 3: Die erkannten Felder im Antrag. Graue Flächen wurden zu Textfeldern, die Quadrate zu Kästchen.', 330);
ueber('Felder prüfen und korrigieren');
punkte(['Ein Feld antippen, um Bezeichnung und Art zu ändern. „Passt" bestätigt einen Vorschlag.', 'Ziehen verschiebt ein Feld, der rote Punkt an der Ecke ändert seine Größe.', 'Ein Feld löschen: antippen und „Löschen" wählen.']);
platz(130); ueber('Eigene Felder setzen');
text('Unten die Art wählen und auf die Stelle im Formular tippen:');
tabelle(['Art', 'Wofür', 'Beispiel im Antrag'], [['Text', 'Namen, Adressen, freie Angaben', 'Familienname, Straße'], ['Datum', 'ein Tag; beim Ausfüllen mit Kalender', 'Geburtsdatum'], ['Kästchen', 'ankreuzen', 'Hauptwohnsitz'], ['E-Mail', 'Adresse mit passender Tastatur', 'E-Mail-Adresse'], ['Internetadresse', 'Links', '–'], ['QR-Code', 'ein Code aus dem eingetragenen Text', '–'], ['Unterschrift', 'mit Finger oder Stift', 'Unterschrift unten']], [110, 210, 163]);

/* ----- 5 ----- */
kap('5  Ausfüllen und unterschreiben');
schritte(['Oben auf „Ausfüllen" wechseln.', 'In die Felder tippen und schreiben. Ein Kästchen antippen setzt das Kreuz.', 'Das Unterschriftsfeld antippen und mit Finger oder Stift unterschreiben.']);
await bild('ausgefuellt', 'Bild 4: Der ausgefüllte Beispiel-Antrag. Alle Angaben sind erfunden (Erika Mustermann, Musterstadt).', 330);
kasten('Achtung: Browserdaten löschen löscht auch die Dokumente', 'Die App speichert laufend im Browser. Wer im Browser „Browserdaten löschen" wählt, entfernt damit auch alle Dokumente. Wichtiges deshalb mit „Speichern" zusätzlich als Datei ablegen.', '#fff4c2', '#151515', '#c9a400');

/* ----- 6 ----- */
kap('6  Speichern und ausgeben');
text('„Speichern" legt eine Arbeitsdatei aufs Gerät, die das PDF und alle Felder enthält. Über „PDF oder Bild" eingelesen, geht die Arbeit genau dort weiter – auch in einem anderen Browser. „PDF ausgeben" erzeugt das fertige Dokument:');
tabelle(['Ausgabe', 'Ergebnis', 'Wann sinnvoll'], [['Festes PDF', 'Einträge fest auf der Seite', 'zum Versenden und Drucken'], ['Ausfüllbares PDF', 'Felder bleiben ausfüllbar', 'wenn jemand anderes weiter ausfüllt'], ['Leere Vorlage', 'ausfüllbar, ohne Einträge', 'dasselbe Formular öfter verwenden'], ['HTML-Seite', 'Seiten als Bild mit echten Eingabefeldern', 'für Geräte, deren PDF-Anzeige keine Formulare kann'], ['Drucken', 'festes PDF, direkt zum Drucker', 'Papier für die Behörde']], [120, 190, 173]);
await bild('ausgeben', 'Bild 5: Die Auswahl beim Ausgeben.', 280, 360);

/* ----- 7 ----- */
kap('7  Übersetzen');
text('Die App übersetzt Deutsch, Russisch und Englisch in jede Richtung. Jede Seite wird auf derselben Seite übersetzt: Bilder, Farben und Seitenumbrüche bleiben, nur der Text wird an seiner Stelle ersetzt. Das Ergebnis ist ein neues Dokument in einem eigenen Ordner je Sprache; das Original bleibt unberührt.');
tabelle(['Weg', 'Kosten', 'Wohin geht der Text', 'Gegenprobe'], [['Übersetzer im Browser', 'kostenlos', 'bleibt auf dem Gerät', 'ja'], ['Mit Chrome übersetzen', 'kostenlos, ohne Kontingent', 'an Google', 'nein'], ['Mit KI (eigener Schlüssel)', 'je Seite, über den eigenen Schlüssel', 'an den gewählten Anbieter, Standard Mistral (EU)', 'ja']], [135, 110, 150, 88]);
await bild('uebersetzen-dialog', 'Bild 6: Das Übersetzen-Fenster mit Sprachwahl und den drei Wegen.', 360, 330);
ueber('Mit Chrome übersetzen');
schritte(['„Mit Chrome übersetzen" wählen. Unten erscheint eine gelbe Fläche mit dem Text der Seite.', 'In Chrome oben rechts auf die drei Punkte tippen, dann „Übersetzen" und die Zielsprache wählen.', 'Danach läuft es Seite für Seite von selbst.']);
kasten('Wenn „Übersetzen" im Menü fehlt', 'Im installierten App-Fenster bietet Chrome das Übersetzen oft nicht an. Dann „In Chrome öffnen" tippen und im Teilen-Fenster Chrome wählen: derselbe Übersetzer öffnet sich mit denselben Dokumenten, und das Ergebnis liegt danach auch in der App.', '#1f4e8c', '#ffffff');
ueber('Beispiel: den Antrag auf Russisch ausfüllen');
schritte(['Im Original die Felder setzen (Kapitel 4). Sie kommen übersetzt an dieselbe Stelle mit.', 'Übersetzen: Deutsch nach Russisch.', 'Das russische Dokument öffnen und auf Russisch ausfüllen.', '„PDF ausgeben", dann „Einträge ins Original": Die Einträge werden in eine Kopie des deutschen Formulars übernommen.']);
text('Mit Gegenprobe wird das Ergebnis zusätzlich in die Ausgangssprache zurückübersetzt und daneben abgelegt. Weicht die Gegenprobe im Sinn ab, lohnt ein zweiter Blick.');
text('Bricht eine Übersetzung ab – etwa weil ein Anbieter zu viele Anfragen meldet –, entsteht ein Teilergebnis „Teil N von M". Erneut übersetzen setzt dort fort und ersetzt das Teilergebnis.');
kasten('Eine Übersetzung ist kein amtliches Dokument', 'Für Behörden und Gerichte gilt die Fassung in der Originalsprache. Die Übersetzung hilft beim Verstehen und Ausfüllen; eine beglaubigte Übersetzung ersetzt sie nicht.', '#c8201a', '#ffffff');

/* ----- Querformat ----- */
seite(QUER); kapitel.push(['Übersicht: alle Knöpfe', nr]);
p.drawText('Übersicht: alle Knöpfe auf einen Blick', { x: L, y, size: 18, font: B, color: SW }); y -= 30;
tabelle(['Knopf', 'Ort', 'Was er tut', 'Siehe'], [['Installieren', 'oben', 'legt die App auf den Startbildschirm', 'Kapitel 2'], ['Kreispfeil', 'oben rechts', 'lädt die neueste Fassung, Dokumente bleiben', 'Kapitel 2'], ['DE (Sprache)', 'oben rechts', 'Sprache der App: Deutsch, Englisch, Russisch, Arabisch; Hinweise beim Zeigen ein/aus. Auch unter Einstellungen', 'Kapitel 2'], ['PDF oder Bild', 'Bibliothek', 'Datei oder Foto einlesen', 'Kapitel 3'], ['Ordner', 'Bibliothek', 'viele Dateien auf einmal einlesen', 'Kapitel 3'], ['Fotografieren', 'Bibliothek', 'Papierformular aufnehmen', 'Kapitel 3'], ['Übersetzen', 'Bibliothek', 'Dokumente oder Ordner übersetzen', 'Kapitel 7'], ['Felder bearbeiten', 'Dokument', 'Felder setzen, verschieben, ändern', 'Kapitel 4'], ['Ausfüllen', 'Dokument', 'Einträge schreiben, unterschreiben', 'Kapitel 5'], ['Felder erkennen', 'Dokument', 'Felder finden lassen, mit oder ohne KI', 'Kapitel 4'], ['Speichern', 'Dokument', 'Arbeitsdatei aufs Gerät legen', 'Kapitel 6'], ['PDF ausgeben', 'Dokument', 'festes, ausfüllbares PDF, Vorlage, HTML, Drucken', 'Kapitel 6'], ['Einstellungen', 'oben rechts', 'KI-Anbieter und eigenen Schlüssel eintragen', 'Kapitel 7']], [150, 110, 330, 139]);

/* ----- 8 ----- */
kap('8  Häufige Fragen');
tabelle(['Frage', 'Antwort'], [['Wo finde ich das Beispiel-Formular?', 'Im Übersetzen-Fenster unter „Beispiele zum Ausprobieren" und in der Hilfe. Es landet im Ordner „Beispiele".'], ['Die Felder sitzen etwas daneben.', 'Unter „Felder bearbeiten" ziehen und am roten Punkt die Größe ändern.'], ['Ein Kästchen wurde nicht erkannt.', 'Art „Kästchen" wählen und auf die Stelle tippen.'], ['Die Übersetzung wirkt eng.', 'Ist der Text länger als das Original, verkleinert die App die Schrift im Absatz. Die Meldung nach dem Übersetzen nennt, wie oft.'], ['Gescannte Seiten oder Bilder mit Text werden nicht übersetzt.', 'Die Texterkennung liest Scans und Bilder mit Text; sie lädt beim ersten Mal einmalig Daten. Ohne sie bleibt das Bild im Original, und das steht in der Meldung.'], ['Ich sehe in Chrome kein „Übersetzen".', '„In Chrome öffnen" im Übersetzen-Fenster benutzen (Kapitel 7).'], ['Kostet die App etwas?', 'Nein. Kosten entstehen nur beim Übersetzen oder Erkennen mit einer KI über einen eigenen Schlüssel.']], [190, 293]);

/* ----- Gescannte Seite: Bild ohne Textebene ----- */
seite(); kapitel.push(['Kurzanleitung (gescannte Seite)', nr]);
{
  const c = document.createElement('canvas'); c.width = 1240; c.height = 1500; const x = c.getContext('2d');
  x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, c.width, c.height);
  let s = 7; const zufall = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) { x.fillStyle = 'rgba(0,0,0,' + (zufall() * 0.06) + ')'; x.fillRect(zufall() * c.width, zufall() * c.height, 2, 2); }
  x.fillStyle = '#1b1b1b'; x.font = 'bold 54px Arial, Helvetica, sans-serif'; x.fillText('Kurzanleitung', 90, 140);
  x.font = '34px Arial, Helvetica, sans-serif';
  const zeilen = ['1. Formular einlesen: „PDF oder Bild" antippen.', '2. „Felder erkennen" antippen und Vorschläge prüfen.', '3. Auf „Ausfüllen" wechseln und eintragen.', '4. Unterschriftsfeld antippen und unterschreiben.', '5. „PDF ausgeben" und die gewünschte Form wählen.', '', 'Übersetzen:', 'In der Bibliothek „Übersetzen" antippen,', 'Sprachen wählen und einen Weg aussuchen.', 'Das Original bleibt immer unverändert.', '', 'Tipp: Wichtige Dokumente zusätzlich', 'mit „Speichern" als Datei sichern.'];
  zeilen.forEach((t, i) => x.fillText(t, 90, 260 + i * 70));
  x.strokeStyle = '#1b1b1b'; x.lineWidth = 3; x.strokeRect(70, 60, 1100, 1380);
  const jpg = c.toDataURL('image/jpeg', 0.82).split(',')[1];
  const img = await pdf.embedJpg(b64(jpg)); let h = 610, w = h * img.width / img.height; if (w > BR) { w = BR; h = w * img.height / img.width; }
  p.drawText('Kurzanleitung zum Ausschneiden (als Bild eingescannt)', { x: L, y, size: 13, font: B, color: SW }); y -= 16;
  p.drawText('Diese Seite enthält keinen Text, nur ein Bild. Beim Übersetzen liest die Texterkennung (OCR) sie.', { x: L, y, size: 9, font: I, color: GR }); y -= 18;
  p.drawImage(img, { x: L + (BR - w) / 2, y: y - h, width: w, height: h });
}

/* ----- Inhaltsverzeichnis füllen ----- */
{ let yy = 740; for (const [t, n] of kapitel) { tocSeite.drawText(t, { x: L, y: yy, size: 12, font: R, color: SW }); const tn = String(n), wn = R.widthOfTextAtSize(tn, 12), wt = R.widthOfTextAtSize(t, 12); tocSeite.drawLine({ start: { x: L + wt + 8, y: yy + 2 }, end: { x: L + BR - wn - 8, y: yy + 2 }, thickness: 1, color: GR, dashArray: [1, 3.5] }); tocSeite.drawText(tn, { x: L + BR - wn, y: yy, size: 12, font: R, color: SW }); yy -= 26; } }
pdf.setTitle('Workfloh PDF – Benutzerhandbuch'); pdf.setLanguage('de'); pdf.setAuthor('Workfloh PDF'); pdf.setCreationDate(DATUM); pdf.setModificationDate(DATUM); pdf.setProducer('Workfloh PDF'); pdf.setCreator('tools/handbuch-bauen.mjs');
