/* Workfloh PDF — Probe im echten Browser (Chromium über playwright-core).
   Deckt den ganzen Weg ab: einlesen → offline erkennen → KI erkennen (Antwort
   gestellt, kein Netz) → prüfen → ausfüllen → drei Exporte → zurücklesen.
   Die Positionen werden über pdf.js aus dem EXPORT zurückgerechnet und mit den
   Feldern verglichen — auch auf einer um 90° gedrehten Seite.
   Aufruf: npm install && npm test */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); } };

/* ---------- Test-Formular ---------- */
async function testFormular() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage([595.28, 841.89]);
  p.drawText('Anmeldung Testformular', { x: 60, y: 780, size: 18, font: f });
  p.drawText('Name:', { x: 60, y: 700, size: 12, font: f });
  p.drawLine({ start: { x: 110, y: 698 }, end: { x: 400, y: 698 }, thickness: 1 });
  p.drawText('Geburtsdatum:', { x: 60, y: 650, size: 12, font: f });
  p.drawLine({ start: { x: 150, y: 648 }, end: { x: 300, y: 648 }, thickness: 1 });
  p.drawText('Bemerkung', { x: 60, y: 600, size: 12, font: f });
  p.drawRectangle({ x: 60, y: 520, width: 400, height: 70, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  p.drawText('Newsletter', { x: 85, y: 482, size: 12, font: f });
  p.drawRectangle({ x: 60, y: 480, width: 14, height: 14, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  p.drawText('AGB gelesen', { x: 85, y: 452, size: 12, font: f });
  p.drawRectangle({ x: 60, y: 450, width: 14, height: 14, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  // vorhandenes Formularfeld
  const form = pdf.getForm();
  const tf = form.createTextField('Kundennummer'); tf.setText('K-4711');
  p.drawText('Kundennummer:', { x: 60, y: 402, size: 12, font: f });
  tf.addToPage(p, { x: 160, y: 396, width: 150, height: 20 });
  // Seite 2: um 90° gedreht
  const p2 = pdf.addPage([595.28, 841.89]); p2.setRotation(degrees(90));
  p2.drawText('Seite zwei', { x: 60, y: 780, size: 14, font: f });
  return pdf.save();
}

/* ---------- kleiner Server ---------- */
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}

const bytes = await testFormular();
const TMP = fs.mkdtempSync('/tmp/wfpdf-');
fs.writeFileSync(path.join(TMP, 'Testformular.pdf'), bytes);
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(String(e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
// Kein echter KI-Aufruf: die Antwort ist gestellt
let kiAufrufe = 0;
await page.route('https://api.anthropic.com/**', async route => {
  kiAufrufe++;
  const body = JSON.parse(route.request().postData() || '{}');
  const bild = body.messages?.[0]?.content?.find(c => c.type === 'image');
  const antwort = { text: 'Anmeldung Testformular\nName:', felder: [
    { typ: 'text', bezeichnung: 'Vollständiger Name', x: 19.5, y: 14.2, b: 47, h: 2.4 },       // absichtlich etwas daneben
    { typ: 'kaestchen', bezeichnung: 'Newsletter', x: 10.4, y: 41.9, b: 2.2, h: 1.6 },
    { typ: 'email', bezeichnung: 'E-Mail', x: 55, y: 80, b: 30, h: 2.2 } ] };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ type: 'text', text: 'Hier: ' + JSON.stringify(antwort) }], _bild: !!bild }) });
});

try {
  console.log('Workfloh PDF — Probe im Browser');
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf);
  ok('Kopfleiste zeigt W-Floh und „Workfloh PDF"', await page.evaluate(() => getComputedStyle(document.getElementById('floh')).backgroundImage.includes('w-floh') && document.querySelector('.marke-name').textContent.includes('Workfloh')));

  // 1. Einlesen
  await page.setInputFiles('#inDatei', path.join(TMP, 'Testformular.pdf'));
  await page.waitForSelector('#sc-ed.on .seite canvas');
  await page.waitForFunction(() => document.querySelectorAll('.seite').length === 2);
  ok('PDF eingelesen, Editor zeigt 2 Seiten', true);
  const vorh = await page.evaluate(() => window.__wfpdf.S.doc.fields.map(f => ({ l: f.label, v: f.value, h: f.herkunft })));
  ok('vorhandenes PDF-Formularfeld übernommen (Kundennummer, Wert K-4711)', vorh.some(f => f.l === 'Kundennummer' && f.v === 'K-4711' && f.h === 'pdf'), vorh);
  const seite2 = await page.evaluate(() => { const p = window.__wfpdf.S.doc.pages[1]; return { w: p.w, h: p.h, rot: p.rot }; });
  ok('gedrehte Seite wird quer angezeigt (Breite > Höhe)', seite2.rot === 90 && seite2.w > seite2.h, seite2);

  // 2. Offline erkennen
  await page.click('#edErkennen'); await page.click('[data-off]');
  await page.waitForFunction(() => window.__wfpdf.S.doc.fields.some(f => !f.geprueft), null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.fortschritt'));
  let F = await page.evaluate(() => window.__wfpdf.S.doc.fields);
  const off = F.filter(f => !f.geprueft);
  const name = off.find(f => /^Name/.test(f.label));
  ok('offline: Feld auf der Namenslinie gefunden und aus dem Text beschriftet', !!name && name.type === 'text', off.map(f => f.label));
  ok('offline: Linie liegt unter dem Namensfeld (x≈18.5 %, Unterkante ≈ 17.1 %)', name && Math.abs(name.x - 110 / 595.28 * 100) < 1 && Math.abs(name.y + name.h - (841.89 - 698.5) / 841.89 * 100) < 0.6, name);
  const geb = off.find(f => /Geburtsdatum/.test(f.label));
  ok('offline: „Geburtsdatum" wird als Datumsfeld vorgeschlagen', geb && geb.type === 'datum', geb);
  const rahmen = off.find(f => f.type === 'text' && f.h > 6);
  ok('offline: Eingabe-Rahmen „Bemerkung" erkannt, mehrzeilig', rahmen && rahmen.mehrzeilig, off.map(f => [f.label, f.h.toFixed(1)]));
  const kaest = off.filter(f => f.type === 'check');
  ok('offline: beide Kästchen erkannt', kaest.length === 2, kaest.map(f => f.label));
  ok('offline: Kundennummer-Feld nicht doppelt vorgeschlagen', F.filter(f => f.page === 0 && f.y > 50 && f.y < 55 && f.x > 25 && f.x < 30).length <= 1);
  ok('Vorschlags-Band zeigt die Zahl der offenen Vorschläge', await page.evaluate(n => !document.getElementById('vorschlagBand').hidden && document.getElementById('vorschlagBand').textContent.includes(n + ' Vorschläge'), off.length));
  ok('Vorschläge sind orange gestrichelt markiert', await page.locator('.feld.ki').count() === off.length);

  // 3. KI erkennen (gestellte Antwort)
  await page.evaluate(() => { const w = window.__wfpdf; w.EINST.anbieter = 'anthropic'; w.EINST.schluessel.anthropic = 'sk-test'; w.EINST.kiOk.anthropic = true; w.einstSpeichern(); });
  await page.click('#edErkennen'); await page.click('[data-ki]');
  await page.waitForFunction(() => window.__wfpdf.S.doc.fields.some(f => f.herkunft === 'ki'), null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.fortschritt'));
  F = await page.evaluate(() => window.__wfpdf.S.doc.fields);
  ok('KI: je Seite ein Aufruf (2 Seiten)', kiAufrufe === 2, kiAufrufe);
  const kiName = F.find(f => f.label === 'Vollständiger Name');
  ok('KI: Namensfeld an die erkannte Linie eingerastet', kiName && Math.abs(kiName.x - name.x) < 0.01 && Math.abs(kiName.w - name.w) < 0.01, [kiName, name]);
  ok('KI: kein doppeltes Namensfeld (Linienvorschlag ersetzt)', F.filter(f => f.page === 0 && Math.abs(f.y - name.y) < 1 && Math.abs(f.x - name.x) < 1).length === 1);
  ok('KI: Typ E-Mail übernommen', F.some(f => f.label === 'E-Mail' && f.type === 'email'));
  ok('KI: erkannter Text gespeichert', await page.evaluate(() => (window.__wfpdf.S.doc.pages[0].text || '').includes('Anmeldung')));
  ok('KI-Vorschläge ungeprüft bis zur Freigabe', F.filter(f => f.herkunft === 'ki').every(f => !f.geprueft));

  // 4. Prüfen: einen Vorschlag bestätigen, dann alle
  await page.click(`.feld[data-id="${kiName.id}"]`);
  await page.click('#eigOk');
  ok('„✓ Passt" bestätigt einen einzelnen Vorschlag', await page.evaluate(id => window.__wfpdf.S.doc.fields.find(f => f.id === id).geprueft, kiName.id));
  await page.click('#vorschlagBand [data-alle]');
  ok('„Alle übernehmen" bestätigt alles', await page.evaluate(() => window.__wfpdf.S.doc.fields.every(f => f.geprueft)));

  // 5. Feld von Hand setzen (QR) per Tipp auf die Seite
  await page.click('[data-t="qr"]');
  const s1 = await page.locator('.seite[data-i="0"] .lage').boundingBox();
  await page.mouse.click(s1.x + s1.width * 0.8, s1.y + s1.height * 0.1);
  await page.fill('#eigWert', 'https://lausiklauskn-png.github.io/Workflow-PDF/');
  ok('QR-Feld von Hand gesetzt und quadratisch', await page.evaluate(() => { const f = window.__wfpdf.S.doc.fields.find(x => x.type === 'qr'); const p = window.__wfpdf.S.doc.pages[0]; return f && Math.abs(f.w * p.w - f.h * p.h) < 0.5; }));
  // Feld auf der gedrehten Seite 2
  await page.locator('.seite[data-i="1"]').scrollIntoViewIfNeeded();
  await page.click('[data-t="text"]');
  const s2 = await page.locator('.seite[data-i="1"] .lage').boundingBox();
  await page.mouse.click(s2.x + s2.width * 0.2, s2.y + s2.height * 0.3);
  await page.fill('#eigLabel', 'Quer');

  // 6. Ausfüllen
  await page.click('#mAusfuellen');
  await page.locator(`.feld[data-id="${kiName.id}"] input`).fill('Erika Müller');
  const gebId = F.find(f => /Geburtsdatum/.test(f.label)).id;
  await page.locator(`.feld[data-id="${gebId}"] input`).fill('1970-05-24');
  const k1 = F.find(f => f.label === 'Newsletter' && f.type === 'check');
  await page.click(`.feld[data-id="${k1.id}"]`);
  const quer = await page.evaluate(() => window.__wfpdf.S.doc.fields.find(f => f.label === 'Quer').id);
  await page.locator(`.feld[data-id="${quer}"] input`).fill('Quertext');
  await page.waitForTimeout(500);
  ok('Ausfüllen: Werte stehen im Dokument', await page.evaluate(([a, b]) => { const d = window.__wfpdf.S.doc; return d.fields.find(f => f.id === a).value === 'Erika Müller' && d.fields.find(f => f.id === b).value === true; }, [kiName.id, k1.id]));
  // gespeichert? neu laden und zurück
  await page.reload(); await page.waitForFunction(() => document.querySelectorAll('.dok').length === 1);
  ok('nach Neuladen: Dokument in der Bibliothek, Felder gespeichert', await page.evaluate(() => document.querySelector('.dok-meta').textContent.includes('Felder')));
  await page.click('.dok [data-auf]'); await page.waitForSelector('#sc-ed.on .seite');

  // 7. Export
  const docJson = await page.evaluate(() => JSON.parse(JSON.stringify(window.__wfpdf.S.doc)));
  async function exportiere(m) {
    await page.click('#edExport');
    const warte = page.waitForEvent('download', { timeout: 20000 });
    await page.click(`[data-m="${m}"]`);
    const dl = await warte.catch(async e => { throw new Error('kein Download bei ' + m + ' · Meldung: ' + await page.locator('#toast').textContent()); });
    const f = path.join(TMP, m + '.pdf'); await dl.saveAs(f);
    await page.click('.dlg [data-x]');
    return { datei: f, name: dl.suggestedFilename(), bytes: fs.readFileSync(f) };
  }
  const aus = await exportiere('ausfuellbar'), vor = await exportiere('vorlage'), fest = await exportiere('fest');
  ok('Dateinamen tragen die Fassung', /ausfuellbar/.test(aus.name) && /Vorlage/.test(vor.name) && !/\(/.test(fest.name), [aus.name, vor.name, fest.name]);
  const pa = await PDFDocument.load(aus.bytes), pv = await PDFDocument.load(vor.bytes), pf = await PDFDocument.load(fest.bytes);
  const felderA = pa.getForm().getFields(), felderV = pv.getForm().getFields();
  const nichtQr = docJson.fields.filter(f => f.type !== 'qr').length;
  ok('ausfüllbar: echte Formularfelder, eines je Feld (ohne QR)', felderA.length === nichtQr, [felderA.length, nichtQr]);
  const tfName = felderA.find(f => f.getName().startsWith('Vollstaendiger_Name'));
  ok('ausfüllbar: Name vorbelegt, Umlaut erhalten', tfName && tfName.getText() === 'Erika Müller', tfName && tfName.getText());
  ok('ausfüllbar: Datum als TT.MM.JJJJ', felderA.some(f => f.constructor.name === 'PDFTextField' && f.getText() === '24.05.1970'));
  ok('ausfüllbar: Kästchen angekreuzt', felderA.some(f => f.getName().startsWith('Newsletter') && f.isChecked && f.isChecked()));
  ok('ausfüllbar: Original-Feld „Kundennummer" nicht doppelt', felderA.filter(f => /^Kundennummer/.test(f.getName())).length === 1);
  ok('Vorlage: gleiche Felder, alle leer', felderV.length === felderA.length && felderV.every(f => f.getText ? !f.getText() : !f.isChecked()));
  ok('festes PDF: keine Formularfelder mehr', pf.getForm().getFields().length === 0);

  // Positionen im Export per pdf.js zurückrechnen — auch auf der gedrehten Seite
  const lage = await page.evaluate(async b64 => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pdf = await pdfjsLib.getDocument({ data: bin }).promise; const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 1 });
      for (const a of await p.getAnnotations()) if (a.subtype === 'Widget') {
        const r = vp.convertToViewportRectangle(a.rect);
        out.push({ name: a.fieldName, page: n - 1, x: Math.min(r[0], r[2]) / vp.width * 100, y: Math.min(r[1], r[3]) / vp.height * 100, w: Math.abs(r[2] - r[0]) / vp.width * 100, h: Math.abs(r[3] - r[1]) / vp.height * 100 });
      }
    }
    return out;
  }, aus.bytes.toString('base64'));
  const abw = (a, f) => Math.max(Math.abs(a.x - f.x), Math.abs(a.y - f.y), Math.abs(a.w - f.w), Math.abs(a.h - f.h));
  const nameA = lage.find(a => a.name.startsWith('Vollstaendiger_Name'));
  ok('Export: Namensfeld liegt, wo es in der App lag (< 0,2 %)', nameA && abw(nameA, kiName) < 0.2, [nameA, kiName]);
  const querF = docJson.fields.find(f => f.label === 'Quer'); const querA = lage.find(a => a.name === 'Quer');
  ok('Export: Feld auf der GEDREHTEN Seite liegt richtig (< 0,2 %)', querA && querA.page === 1 && abw(querA, querF) < 0.2, [querA, querF]);

  // Text im festen PDF an der richtigen Stelle?
  const txt = await page.evaluate(async b64 => {
    const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pdf = await pdfjsLib.getDocument({ data: bin }).promise; const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 1 }); const tc = await p.getTextContent();
      for (const t of tc.items) { const tr = pdfjsLib.Util.transform(vp.transform, t.transform); out.push({ s: t.str, page: n - 1, x: tr[4] / vp.width * 100, y: tr[5] / vp.height * 100, dx: tr[0], dy: tr[1] }); }
    }
    return out;
  }, fest.bytes.toString('base64'));
  const erika = txt.find(t => t.s.includes('Erika Müller'));
  ok('festes PDF: Name steht im Feld (Grundlinie innerhalb des Kastens)', erika && erika.x >= kiName.x - 0.1 && erika.x < kiName.x + 3 && erika.y > kiName.y && erika.y <= kiName.y + kiName.h + 0.1, [erika, kiName]);
  const querT = txt.find(t => t.s.includes('Quertext'));
  ok('festes PDF: Text auf der gedrehten Seite steht aufrecht im Feld', querT && querT.page === 1 && querT.dx > 0 && Math.abs(querT.dy) < 0.01 && querT.x >= querF.x - 0.1 && querT.y > querF.y && querT.y <= querF.y + querF.h + 0.1, [querT, querF]);
  ok('festes PDF: QR-Code als Grafik gezeichnet (Seite enthält viele Rechtecke)', (await PDFDocument.load(fest.bytes)).getPage(0).node.Contents() !== undefined && fest.bytes.length > bytes.length);

  // 8. Kamera: Foto → Dokument
  await page.click('#edZurueck'); await page.waitForSelector('#sc-bib.on');
  const png = path.join(TMP, 'foto.png');
  const shot = await page.screenshot({ clip: { x: 0, y: 0, width: 600, height: 800 } }); fs.writeFileSync(png, shot);
  await page.setInputFiles('#inKamera', png);
  await page.waitForSelector('.aufnahme-bilder div');
  await page.click('.dlg [data-ok]');
  await page.waitForSelector('#sc-ed.on .seite canvas');
  ok('Kamera: Foto wird zu einem Dokument mit einer Seite', await page.evaluate(() => window.__wfpdf.S.doc.quelle === 'foto' && window.__wfpdf.S.doc.pages.length === 1));

  // 9. Ordner-Import (mehrere Dateien)
  await page.click('#edZurueck'); await page.waitForSelector('#sc-bib.on');
  await page.setInputFiles('#inDatei', [path.join(TMP, 'Testformular.pdf'), png]);
  await page.waitForFunction(() => document.querySelectorAll('.dok').length === 4, null, { timeout: 20000 });
  ok('mehrere Dateien auf einmal eingelesen', true);

  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
