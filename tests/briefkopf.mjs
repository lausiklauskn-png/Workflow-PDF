// Briefkopf lesen (Pro-Umbau 14 D) — reine Rechnung, ohne Browser. Alle Briefe sind ERFUNDEN.
//   node tests/briefkopf.mjs          Rückgabe 0 = grün, 1 = ROT
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const wurzel = process.env.BRIEFKOPF_WURZEL || join(dirname(fileURLToPath(import.meta.url)), '..');
await import(pathToFileURL(join(wurzel, 'assets', 'briefkopf.js')).href);
const B = globalThis.__WFP_BRIEFKOPF;

let gruen = 0, rot = 0;
const pruefe = (name, ok, ist) => { if (ok) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (ist !== undefined ? ' → ' + JSON.stringify(ist) : '')); } };
const nummer = (k, art) => (k.nummern.find(n => n.art === art) || {}).wert;

// 1. DIN 5008 Form B, Rechnung eines Versorgers
const rechnung = [
  'Stadtwerke Musterstadt GmbH',
  'Stadtwerke Musterstadt GmbH · Werkstraße 4 · 12345 Musterstadt',
  'Herrn',
  'Max Mustermann',
  'Lindenweg 7',
  '12345 Musterstadt',
  'Kundennummer: 4711-0815',
  'Rechnungsnummer: R-2026-00042',
  'Vertragsnummer 99887766',
  'Musterstadt, den 12. Oktober 2026',
  'Betreff: Jahresabrechnung Strom 2025',
  'Sehr geehrter Herr Mustermann,',
  'anbei Ihre Jahresabrechnung. Der Rechnungsbetrag ist zahlbar bis 30.10.2026.',
  'Mit freundlichen Grüßen',
];
console.log('1 · Rechnung (DIN 5008)');
let k = B.lesen(rechnung, { namen: ['Max Mustermann', 'Erika Mustermann'] });
pruefe('Briefdatum aus „Ort, den …“', k.datum && k.datum.wert === '2026-10-12', k.datum);
pruefe('Fundstelle des Datums ist die Zeile selbst', k.datum && /den 12\. Oktober 2026/.test(k.datum.fund), k.datum);
pruefe('Absender aus der Rücksendezeile', k.absender && k.absender.wert === 'Stadtwerke Musterstadt GmbH', k.absender);
pruefe('Empfänger aus dem Anschriftfeld (ohne „Herrn“)', k.empfaenger && k.empfaenger.wert === 'Max Mustermann', k.empfaenger);
pruefe('Empfänger mit der Familie abgeglichen', k.empfaenger && k.empfaenger.bekannt === 'Max Mustermann', k.empfaenger);
pruefe('Kundennummer', nummer(k, 'kundennummer') === '4711-0815', k.nummern);
pruefe('Rechnungsnummer', nummer(k, 'rechnungsnummer') === 'R-2026-00042', k.nummern);
pruefe('Vertragsnummer ohne Doppelpunkt', nummer(k, 'vertragsnummer') === '99887766', k.nummern);
pruefe('Betreff', k.betreff && k.betreff.wert === 'Jahresabrechnung Strom 2025', k.betreff);
pruefe('Wichtigkeit 1 (zahlbar bis)', k.wichtigkeit.stufe === 1, k.wichtigkeit);
pruefe('Thema Energie & Versorgung', k.thema && k.thema.wert === 'Energie & Versorgung', k.thema);
pruefe('„zahlbar bis 30.10.2026“ ist NICHT das Briefdatum', k.datum.wert !== '2026-10-30');

// 2. Behördenbrief mit Aktenzeichen und Frist
const behoerde = [
  'Finanzamt Musterstadt',
  'Postfach 1234 · 12340 Musterstadt',
  'Frau',
  'Erika Mustermann',
  'Lindenweg 7',
  '12345 Musterstadt',
  'Steuernummer: 123/456/78901',
  'Datum: 03.09.2026',
  'Einkommensteuerbescheid 2025',
  'Gegen diesen Bescheid können Sie innerhalb von 30 Tagen Einspruch einlegen. Die Frist beginnt mit Bekanntgabe.',
];
console.log('2 · Behördenbrief');
k = B.lesen(behoerde, { namen: ['Erika Mustermann'] });
pruefe('Datum aus „Datum:“', k.datum && k.datum.wert === '2026-09-03', k.datum);
pruefe('Absender Behörde aus dem Kopf', k.absender && k.absender.wert === 'Finanzamt Musterstadt', k.absender);
pruefe('„Postfach …“ der Rücksendezeile ist nie der Absender', !k.absender || !/Postfach/.test(k.absender.wert), k.absender);
pruefe('Empfängerin', k.empfaenger && k.empfaenger.wert === 'Erika Mustermann', k.empfaenger);
pruefe('Steuernummer als Aktenzeichen', nummer(k, 'aktenzeichen') === '123/456/78901', k.nummern);
pruefe('Wichtigkeit 2 (Frist)', k.wichtigkeit.stufe === 2, k.wichtigkeit);
pruefe('Thema Steuern & Behörden', k.thema && k.thema.wert === 'Steuern & Behörden', k.thema);

// 3. Mahnung — höchste Stufe
console.log('3 · Letzte Mahnung');
k = B.lesen(['Muster Versand AG', 'Ihre Bestellnummer 55512', 'Letzte Mahnung', 'Bitte zahlen Sie bis spätestens 15.11.2026, sonst geben wir den Vorgang an ein Inkasso-Unternehmen.']);
pruefe('Wichtigkeit 3', k.wichtigkeit.stufe === 3, k.wichtigkeit);
pruefe('Wort der Wichtigkeit genannt', /letzte mahnung/i.test(k.wichtigkeit.wort), k.wichtigkeit);
pruefe('Absender mit Rechtsform aus der ersten Zeile', k.absender && k.absender.wert === 'Muster Versand AG', k.absender);
pruefe('kein Briefdatum (nur eine Zahlungsfrist)', k.datum === null, k.datum);

// 4. Arztbrief, zwei Daten ohne Etikett → kein Datum (nie geraten)
console.log('4 · Arztbrief');
k = B.lesen(['Praxis Dr. med. Beispiel', 'Hauptstraße 9 · 12345 Musterstadt', 'Patient: Max Mustermann, geb. 01.02.1960', 'Untersuchung am 14.10.2026', 'Kontrolle 21.10.2026', 'Befund: unauffällig. Diagnose siehe Anlage.']);
pruefe('zwei unbeschriftete Daten → kein Briefdatum', k.datum === null, k.datum);
pruefe('Geburtsdatum nie als Briefdatum', !k.datum || k.datum.wert !== '1960-02-01', k.datum);
pruefe('Thema Gesundheit & Pflege', k.thema && k.thema.wert === 'Gesundheit & Pflege', k.thema);

// 5. Mail
console.log('5 · Mail');
k = B.lesen(['Hallo,', 'Ihre Buchungsbestätigung für das Hotel finden Sie im Anhang.', 'Buchungsnummer folgt.'], { mail: { von: '"Reise Beispiel GmbH" <info@reise.example>', an: 'Max Mustermann <max@example.org>', datum: '2026-08-01T10:00:00Z', betreff: 'Ihre Reise im September' } });
pruefe('Absender aus „Von“', k.absender && k.absender.wert === 'Reise Beispiel GmbH', k.absender);
pruefe('Empfänger aus „An“', k.empfaenger && k.empfaenger.wert === 'Max Mustermann', k.empfaenger);
pruefe('Datum aus der Mail', k.datum && k.datum.wert === '2026-08-01', k.datum);
pruefe('Betreff aus der Mail', k.betreff && k.betreff.wert === 'Ihre Reise im September', k.betreff);
pruefe('Thema Reisen & Freizeit', k.thema && k.thema.wert === 'Reisen & Freizeit', k.thema);
pruefe('„Buchungsnummer folgt.“ ergibt keine Nummer', k.nummern.length === 0, k.nummern);

// 6. Falsche Einlesereihenfolge: Seitentext-Stücke durcheinander → zeilenAusSeiten setzt sie nach Lage zusammen
console.log('6 · Stücke in falscher Reihenfolge');
const seite = [
  ['12345 Musterstadt', 10, 26, 30, 1.4], ['Kundennummer:', 60, 20, 12, 1.4], ['Max Mustermann', 10, 22, 25, 1.4],
  ['4711-0815', 74, 19.8, 10, 1.4], ['Lindenweg 7', 10, 24, 20, 1.4], ['Muster Bank AG · Ring 1 · 12345 Musterstadt', 10, 18, 50, 1.2],
  ['Datum:', 60, 22, 8, 1.4], ['05.10.2026', 69, 21.8, 10, 1.4],
];
const zeilen = B.zeilenAusSeiten([seite]);
pruefe('Kundennummer und Wert in einer Zeile', zeilen.includes('Kundennummer: 4711-0815'), zeilen);
k = B.lesen(zeilen);
pruefe('Datum trotz Reihenfolge', k.datum && k.datum.wert === '2026-10-05', k.datum);
pruefe('Kundennummer trotz Reihenfolge', nummer(k, 'kundennummer') === '4711-0815', k.nummern);
pruefe('Absender aus Rücksendezeile', k.absender && k.absender.wert === 'Muster Bank AG', k.absender);

// 7. Brief ohne Kopf
console.log('7 · Ohne Kopf');
k = B.lesen(['Liebe Oma,', 'danke für das Paket!', 'Viele Grüße']);
pruefe('alles leer statt geraten', !k.datum && !k.absender && !k.empfaenger && !k.betreff && k.nummern.length === 0 && k.wichtigkeit.stufe === 0 && !k.thema, k);

// 8. Gleichstand beim Thema → leer
console.log('8 · Thema unsicher');
pruefe('Gleichstand zweier Themen → kein Thema', B.themaLesen(['Strom', 'Mietvertrag']) === null, B.themaLesen(['Strom', 'Mietvertrag']));
pruefe('eigene Themenliste (Betrieb) wird benutzt', (B.themaLesen(['Lieferschein Nr 5'], [['Lieferanten', ['lieferschein']], ['Kunden', ['angebot']]]) || {}).wert === 'Lieferanten');

// 9. Daten: ungültige Kalendertage werden nicht genommen
console.log('9 · Datumsregeln');
pruefe('31.02.2026 ist kein Datum', B.datenIn('31.02.2026').length === 0, B.datenIn('31.02.2026'));
pruefe('2-stelliges Jahr', (B.datenIn('Datum: 03.09.26')[0] || {}).wert === '2026-09-03');
pruefe('ISO-Datum', (B.datenIn('2026-01-15')[0] || {}).wert === '2026-01-15');
pruefe('Monatsname abgekürzt', (B.datenIn('1. Okt. 2026')[0] || {}).wert === '2026-10-01');

// 10. Sortieren und Gruppieren
console.log('10 · Sortieren und Gruppieren');
const docs = [
  { id: 'a', createdAt: '2026-10-20T00:00:00Z', briefkopf: { datum: { wert: '2026-09-01' }, absender: { wert: 'B GmbH' }, nummern: [], wichtigkeit: { stufe: 0 }, thema: { wert: 'Versicherungen' } } },
  { id: 'b', createdAt: '2026-10-20T00:00:00Z', briefkopf: { datum: { wert: '2026-10-01' }, absender: { wert: 'A AG' }, nummern: [], wichtigkeit: { stufe: 2 }, thema: { wert: 'Versicherungen' } } },
  { id: 'c', createdAt: '2026-10-25T00:00:00Z', briefkopf: null },
  { id: 'd', createdAt: '2026-10-20T00:00:00Z', briefkopf: { datum: { wert: '2026-10-01' }, absender: { wert: 'A AG' }, nummern: [], wichtigkeit: { stufe: 3 } } },
];
const ordnung = docs.slice().sort(B.vergleich).map(d => d.id).join('');
pruefe('Briefdatum (sonst Eingang) neueste zuerst, dann Absender, dann Wichtigkeit', ordnung === 'cdba', ordnung);
const g = B.gruppen(docs, 'thema');
pruefe('Gruppe nach Thema, „ohne“ zuletzt', g.length === 2 && g[0].name === 'Versicherungen' && g[0].docs.length === 2 && g[1].name === '', g.map(x => [x.name, x.docs.length]));

// 11. „Ort, den …“ schlägt ein zweites, unbeschriftetes Datum
console.log('11 · Ort, den … neben einem zweiten Datum');
k = B.lesen(['Muster Möbel KG', 'Ihre Bestellung vom 28.05.2026', 'Bremen, den 3. Juni 2026', 'Kundennummer: siehe oben', 'Kunden-Nr. 77']);
pruefe('Datum aus „Bremen, den …“, nicht das Bestelldatum', k.datum && k.datum.wert === '2026-06-03', k.datum);
pruefe('„Kundennummer: siehe oben“ ergibt keine Nummer', !k.nummern.some(n => /siehe/i.test(n.wert)), k.nummern);
pruefe('zu kurze Nummer (2 Ziffern) wird nicht genommen', !k.nummern.some(n => n.wert === '77'), k.nummern);

// ---------- Teil B: im Browser (erfundene PDFs einlesen, sortieren, Thema, von Hand ändern) ----------
{
  const http = await import('node:http'); const fs = await import('node:fs'); const path = await import('node:path'); const os = await import('node:os');
  let pw = null, pdflib = null;
  try { pw = await import('playwright-core'); pdflib = await import('pdf-lib'); } catch (_) {}
  if (!pw || !pdflib) console.log('  ⊘ Teil B nicht lauffähig (playwright-core/pdf-lib fehlt — npm install)');
  else if (process.env.NUR_TEIL_A) console.log('  ⊘ Teil B übersprungen (NUR_TEIL_A)');
  else {
    console.log('B · im Browser');
    const { PDFDocument, StandardFonts } = pdflib;
    const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'bk-b-'));
    const brief = async (zeilen) => { const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica); const p = pdf.addPage([595, 842]);
      let y = 790; for (const z of zeilen) { p.drawText(z.t, { x: z.x || 60, y, size: z.s || 11, font: f }); y -= z.dy || 18; } return pdf.save(); };
    fs.writeFileSync(path.join(TMP, 'Strom.pdf'), await brief([{ t: 'Stadtwerke Musterstadt GmbH', s: 14 }, { t: 'Stadtwerke Musterstadt GmbH - Werkstrasse 4 - 12345 Musterstadt', s: 7 }, { t: 'Herrn' }, { t: 'Max Mustermann' }, { t: 'Lindenweg 7' }, { t: '12345 Musterstadt' },
      { t: 'Kundennummer: 4711-0815' }, { t: 'Musterstadt, den 12.10.2026' }, { t: 'Betreff: Jahresabrechnung Strom 2025' }, { t: 'Der Rechnungsbetrag ist zahlbar bis 30.10.2026.' }]));
    fs.writeFileSync(path.join(TMP, 'Steuer.pdf'), await brief([{ t: 'Finanzamt Musterstadt', s: 14 }, { t: 'Postfach 1234 - 12340 Musterstadt', s: 7 }, { t: 'Frau' }, { t: 'Erika Mustermann' }, { t: 'Lindenweg 7' }, { t: '12345 Musterstadt' },
      { t: 'Datum: 03.09.2026' }, { t: 'Einkommensteuerbescheid 2025' }, { t: 'Die Frist fuer den Einspruch betraegt einen Monat.' }]));
    fs.writeFileSync(path.join(TMP, 'Notiz.pdf'), await brief([{ t: 'Liebe Oma,' }, { t: 'danke fuer das Paket!' }]));
    const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
    const srv = await new Promise(res => { const s = http.createServer((q, r) => {
      let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(wurzel, p); if (!f.startsWith(wurzel) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
      r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
    }); s.listen(0, '127.0.0.1', () => res(s)); });
    const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(fs.existsSync);
    const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    const url = `http://127.0.0.1:${srv.address().port}/`;
    const karten = () => page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok')].map(d => ({ name: d.querySelector('.dok-name').textContent, brief: (d.querySelector('[data-briefkopf]') || {}).textContent || '' })));
    try {
      await page.goto(url); await page.waitForFunction(() => window.__wfpdf);
      await page.setInputFiles('#inDatei', ['Strom.pdf', 'Steuer.pdf', 'Notiz.pdf'].map(n => path.join(TMP, n)));
      await page.waitForFunction(() => window.__wfpdf.S.docs.length === 3, null, { timeout: 30000 });
      await page.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });
      await page.waitForFunction(() => window.__wfpdf.S.docs.every(d => d.briefkopf), null, { timeout: 30000 }).catch(() => {});
      const bks = await page.evaluate(() => Object.fromEntries(window.__wfpdf.S.docs.map(d => [d.name, d.briefkopf])));
      pruefe('beim Einlesen wird der Briefkopf am Dokument gemerkt', Object.values(bks).every(Boolean), Object.keys(bks).filter(k => !bks[k]));
      const strom = Object.entries(bks).find(([n]) => /Strom/.test(n)); const steuer = Object.entries(bks).find(([n]) => /Steuer/.test(n));
      pruefe('Strom: Datum, Absender, Kundennummer aus dem echten PDF', strom && strom[1] && strom[1].datum && strom[1].datum.wert === '2026-10-12' && strom[1].absender && strom[1].absender.wert === 'Stadtwerke Musterstadt GmbH' && strom[1].nummern.some(n => n.wert === '4711-0815'), strom && strom[1]);
      pruefe('Steuer: Datum und Thema', steuer && steuer[1] && steuer[1].datum && steuer[1].datum.wert === '2026-09-03' && steuer[1].thema && steuer[1].thema.wert === 'Steuern & Behörden', steuer && steuer[1]);
      if (!(await page.$('[data-sortbox][open]'))) await page.click('[data-sortbox] summary');
      await page.selectOption('[data-sort]', 'brief');
      await page.waitForFunction(() => document.querySelectorAll('#dokGitter [data-briefkopf]').length === 3, null, { timeout: 10000 }).catch(() => {});
      let k = await karten();
      pruefe('Sortieren nach Briefdatum: ohne Datum (Eingang heute) zuerst, dann 12.10., dann 03.09.', k.map(x => x.name).join('|').replace(/\.pdf/g, '') === 'Notiz|Strom|Steuer', k.map(x => x.name));
      pruefe('Karte nennt Briefdatum, Absender und Kundennummer', k.some(x => /12\.10\.2026 · Stadtwerke Musterstadt GmbH · Kd 4711-0815/.test(x.brief)), k);
      if (!(await page.$('[data-sortbox][open]'))) await page.click('[data-sortbox] summary');
      await page.selectOption('[data-thema]', 'Steuern & Behörden');
      await page.waitForTimeout(150);
      k = await karten();
      pruefe('Thema als Filter: nur der Steuerbescheid', k.length === 1 && /Steuer/.test(k[0].name), k.map(x => x.name));
      await page.click('#dokGitter [data-briefkopf-aendern]');
      await page.waitForSelector('[data-bk="absender"]');
      await page.fill('[data-bk="absender"]', 'Finanzamt Musterstadt-Nord');
      await page.click('[data-bk-speichern]');
      await page.waitForTimeout(200);
      await page.goto(url); await page.waitForFunction(() => window.__wfpdf && window.__wfpdf.S.docs.length === 3, null, { timeout: 20000 });
      const nach = await page.evaluate(() => (window.__wfpdf.S.docs.find(d => /Steuer/.test(d.name)) || {}).briefkopf);
      pruefe('von Hand geändert: bleibt nach dem Neuladen und ist als Hand markiert', nach && nach.hand === true && nach.absender && nach.absender.wert === 'Finanzamt Musterstadt-Nord', nach);
      pruefe('keine Fehler auf der Seite', fehler.length === 0, fehler);
    } catch (e) { pruefe('Teil B lief durch', false, String(e)); }
    finally { await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
  }
}

console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
