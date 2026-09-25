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

/* Formular mit grauen Eingabeflächen statt Linien (wie Klaus' Fragebogen) */
async function grauFormular() {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage([595.28, 841.89]); const g = rgb(0.89, 0.89, 0.89);
  p.drawText('Versicherungsnehmer:', { x: 180, y: 712, size: 10, font: f });
  p.drawRectangle({ x: 180, y: 690, width: 330, height: 14, color: g });
  p.drawText('Max Muster', { x: 184, y: 694, size: 9, font: f });   // schon ausgefüllt
  p.drawText('Unfallzeugen?', { x: 60, y: 652, size: 10, font: f });
  p.drawText('Ja', { x: 190, y: 652, size: 10, font: f }); p.drawRectangle({ x: 210, y: 649, width: 12, height: 12, color: g });
  p.drawText('Nein', { x: 250, y: 652, size: 10, font: f }); p.drawRectangle({ x: 280, y: 649, width: 12, height: 12, color: g });
  p.drawText('Schilderung:', { x: 60, y: 600, size: 10, font: f });
  p.drawRectangle({ x: 60, y: 480, width: 450, height: 110, color: g });
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
const grauBytes = await grauFormular();
const TMP = fs.mkdtempSync('/tmp/wfpdf-');
fs.writeFileSync(path.join(TMP, 'Testformular.pdf'), bytes);
fs.writeFileSync(path.join(TMP, 'Grauformular.pdf'), grauBytes);
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
let kiAufrufe = 0, kiNummern = false, kiBild = null, kiVerz = 0;
await page.route('https://api.anthropic.com/**', async route => {
  kiAufrufe++;
  if (kiVerz) await new Promise(r => setTimeout(r, kiVerz));
  const body = JSON.parse(route.request().postData() || '{}');
  const bild = body.messages?.[0]?.content?.find(c => c.type === 'image');
  if (bild) kiBild = bild.source.data;
  const antwort = kiNummern ? { text: 'Graues Formular', felder: [{ nr: 1, typ: 'text', bezeichnung: 'KI eins' }, { nr: 3, typ: 'kaestchen', bezeichnung: 'KI drei' }],
      keinFeld: [2], zusaetzlich: [{ typ: 'text', bezeichnung: 'In Pixeln', x: 700, y: 1500, b: 350, h: 40 }, { typ: 'text', bezeichnung: 'Auf der Beschriftung', x: 423, y: 295, b: 420, h: 26 }, { typ: 'text', bezeichnung: 'KI eins', x: 100, y: 1800, b: 300, h: 30 }] }
    : { text: 'Anmeldung Testformular\nName:', felder: [
    { typ: 'text', bezeichnung: 'Vollständiger Name', x: 19.5, y: 14.2, b: 47, h: 2.4 },       // absichtlich etwas daneben
    { typ: 'kaestchen', bezeichnung: 'Newsletter', x: 10.4, y: 41.9, b: 2.2, h: 1.6 },
    { typ: 'email', bezeichnung: 'E-Mail', x: 55, y: 80, b: 30, h: 2.2 } ] };
  if (kiNummern) {}
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
  // 7b. HTML zum Ausfüllen im Browser
  const ht = await exportiere('html'); const htPfad = ht.datei.replace(/\.pdf$/, '.html'); fs.renameSync(ht.datei, htPfad);
  const hp = await ctx.newPage(); await hp.goto('file://' + htPfad);
  const hInfo = await hp.evaluate(() => ({ bilder: document.querySelectorAll('.seite img.hg').length, text: document.querySelectorAll('input.t,textarea.f').length, k: document.querySelectorAll('input.k').length, netz: [...document.querySelectorAll('[src]')].filter(e => /^https?:/.test(e.getAttribute('src'))).length }));
  const soll = { text: docJson.fields.filter(f => !['check', 'unterschrift', 'qr'].includes(f.type)).length, k: docJson.fields.filter(f => f.type === 'check').length };
  ok('HTML: Seitenbilder, alle Felder als Eingabefelder, nichts aus dem Netz', /\.html$/.test(ht.name) && hInfo.bilder === docJson.pages.length && hInfo.text === soll.text && hInfo.k === soll.k && hInfo.netz === 0, [ht.name, hInfo, soll]);
  await hp.locator('input.t').first().fill('Im Browser'); await hp.locator('input.k').first().check();
  const [dlH] = await Promise.all([hp.waitForEvent('download'), hp.click('#sichern')]);
  const hF = path.join(TMP, 'aus.html'); await dlH.saveAs(hF); const hTxt = fs.readFileSync(hF, 'utf8');
  ok('HTML: „Ausgefüllt speichern" behält Einträge und Haken', hTxt.includes('value="Im Browser"') && /class="f k"[^>]*checked/.test(hTxt));
  await hp.emulateMedia({ media: 'print' });
  const druck = await hp.evaluate(() => ({ leiste: getComputedStyle(document.querySelector('.leiste')).display, rand: getComputedStyle(document.querySelector('input.t')).borderTopColor }));
  ok('HTML: beim Drucken ohne Knopfleiste und ohne Feldrahmen', druck.leiste === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(druck.rand), druck);
  await hp.close();
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

  // 10. Graue Eingabeflächen (Befund Klaus 2026-09-25: „erkennt die grauen Bereiche nicht")
  if (await page.locator('#edZurueck').isVisible()) await page.click('#edZurueck');
  await page.setInputFiles('#inDatei', path.join(TMP, 'Grauformular.pdf'));
  await page.waitForFunction(() => window.__wfpdf.S.doc && window.__wfpdf.S.doc.name === 'Grauformular');
  await page.waitForSelector('#sc-ed.on .seite canvas');
  await page.click('#edErkennen'); await page.click('[data-off]');
  await page.waitForFunction(() => window.__wfpdf.S.doc.fields.length >= 4, null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.fortschritt'));
  const G = await page.evaluate(() => window.__wfpdf.S.doc.fields);
  const gv = G.find(f => f.type === 'text' && /Versicherungsnehmer/.test(f.label));
  ok('grau: Fläche „Versicherungsnehmer" als Textfeld erkannt, Beschriftung von oben', !!gv, G.map(f => [f.type, f.label]));
  ok('grau: Fläche liegt genau auf dem grauen Balken (< 0,5 %)', gv && Math.abs(gv.x - 180 / 595.28 * 100) < 0.5 && Math.abs(gv.y - (841.89 - 704) / 841.89 * 100) < 0.5 && Math.abs(gv.w - 330 / 595.28 * 100) < 0.8, gv);
  const gk = G.filter(f => f.type === 'check');
  ok('grau: beide grauen Kästchen erkannt, mit Frage beschriftet', gk.length === 2 && gk.some(f => /Unfallzeugen.*Ja/.test(f.label)) && gk.some(f => /Unfallzeugen.*Nein/.test(f.label)), gk.map(f => f.label));
  ok('grau: große Fläche „Schilderung" mehrzeilig', G.some(f => f.type === 'text' && f.mehrzeilig && /Schilderung/.test(f.label)), G.map(f => [f.label, f.h.toFixed(1)]));
  ok('grau: Text im Feld wird zum Feldwert, mit Deckfarbe der Fläche', gv && gv.value === 'Max Muster' && /^#e[0-9a-f]e[0-9a-f]e[0-9a-f]$/i.test(gv.decken || ''), gv && [gv.value, gv.decken]);
  const af = await page.evaluate(async () => { const w = window.__wfpdf; const r = await WFP.Export.exportieren(w.S.doc, w.S.bytes, 'ausfuellbar');
    const d = await PDFLib.PDFDocument.load(r.bytes); const fs = d.getForm().getFields();
    const w0 = fs[0].acroField.getWidgets()[0]; const mk = w0.getAppearanceCharacteristics();
    const cbx = fs.find(x => x instanceof PDFLib.PDFCheckBox); const mkc = cbx && cbx.acroField.getWidgets()[0].getAppearanceCharacteristics();
    return { n: fs.length, bg: !!(mk && mk.getBackgroundColor()), print: (w0.dict.get(PDFLib.PDFName.of('F')) || {}).numberValue, cbBg: !cbx ? 'kein' : !!(mkc && mkc.getBackgroundColor()),
      dr: (() => { const a = d.catalog.lookup(PDFLib.PDFName.of('AcroForm')); const dr = a && a.lookup(PDFLib.PDFName.of('DR')); const fo = dr && dr.lookup(PDFLib.PDFName.of('Font')); return !!(fo && fo.get(PDFLib.PDFName.of('Helvetica'))) && /Helvetica/.test(String(a.get(PDFLib.PDFName.of('DA')))); })() }; });
  ok('ausfüllbares PDF: echte Felder mit sichtbarem Hintergrund und Druck-Flag', af.n >= 4 && af.bg && (af.print & 4) === 4, af);
  ok('ausfüllbares PDF: Formular trägt Standard-Schrift (/DR, /DA) für Acrobat und Android-Anzeigen', af.dr === true, af);
  ok('ausfüllbares PDF: Kästchen ohne Füllung (gedruckte Haken bleiben sichtbar)', af.cbBg === false, af);
  const offGrau = G.length;

  // 11. KI mit nummerierten Kandidaten
  kiNummern = true; kiBild = null; kiVerz = 2500;
  await page.click('#edErkennen'); await page.click('[data-ki]');
  await page.waitForSelector('.fortschritt.laeuft', { timeout: 10000 });
  const w0 = await page.evaluate(() => parseFloat(document.querySelector('.fortschritt i').style.width));
  await page.waitForTimeout(1600);
  const lb = await page.evaluate(() => ({ w: parseFloat(document.querySelector('.fortschritt i').style.width), t: document.querySelector('.dlg [data-t]').textContent }));
  ok('Ladebalken bewegt sich, während die KI liest, zählt Sekunden, Rad dreht sich', await page.locator('.dlg .dreher').isVisible() && lb.w > w0 && /KI liest/.test(lb.t) && /\d+ s$/.test(lb.t), [w0, lb]);
  kiVerz = 0;
  await page.waitForFunction(() => window.__wfpdf.S.doc.fields.some(f => f.label === 'KI eins'), null, { timeout: 30000 });
  await page.waitForFunction(() => !document.querySelector('.fortschritt'));
  const K = await page.evaluate(() => window.__wfpdf.S.doc.fields);
  const kn1 = K.find(f => f.label === 'KI eins');
  ok('KI (Nummern): benanntes Feld übernimmt die Lage eines Offline-Kandidaten exakt', kn1 && G.some(g => Math.abs(g.x - kn1.x) < 1e-6 && Math.abs(g.y - kn1.y) < 1e-6 && Math.abs(g.w - kn1.w) < 1e-6), kn1);
  ok('KI (Nummern): „keinFeld" nimmt einen Kandidaten heraus', K.filter(f => f.label !== 'In Pixeln').length === offGrau - 1, [K.length, offGrau]);
  const px = K.find(f => f.label === 'In Pixeln');
  ok('KI: Pixel-Koordinaten werden in Prozent umgerechnet', px && Math.abs(px.x - 50) < 0.5 && px.y > 50 && px.y < 95, px);
  ok('KI: frei gesetztes Feld auf der Beschriftung über einer Fläche wird verworfen', !K.some(f => f.label === 'Auf der Beschriftung'), K.map(f => [f.label, f.y.toFixed(1)]));
  ok('KI: frei gesetztes Feld mit derselben Bezeichnung wie ein vorhandenes wird verworfen', K.filter(f => f.label === 'KI eins').length === 1, K.filter(f => f.label === 'KI eins').map(f => f.y.toFixed(1)));
  ok('KI bekommt das Bild mit den markierten Stellen', !!kiBild && kiBild.length > 1000);

  // 12. Ausfüllen: Tippen trotz Bildschirmtastatur (Fenster wird niedriger)
  await page.click('#vorschlagBand [data-alle]');
  await page.click('#mAusfuellen');
  const ziel = page.locator(`.feld[data-id="${kn1.id}"] input, .feld[data-id="${kn1.id}"] textarea`).first();
  await ziel.fill(""); await ziel.click();
  await page.setViewportSize({ width: 1280, height: 520 }); await page.waitForTimeout(450);
  await page.keyboard.type('Getippt');
  ok('Ausfüllen: Feld behält den Fokus, wenn die Tastatur das Fenster verkleinert', await page.evaluate(id => window.__wfpdf.S.doc.fields.find(f => f.id === id).value === 'Getippt', kn1.id));
  await page.setViewportSize({ width: 1280, height: 900 });

  // 12b. Unterschrift mit Stift/Finger
  await page.click('#mBearbeiten');
  await page.click('[data-t="unterschrift"]');
  const lage0 = page.locator('.seite .lage').first(); const lg = await lage0.boundingBox();
  await lage0.click({ position: { x: lg.width * 0.3, y: lg.height * 0.55 } });
  const usId = await page.evaluate(() => window.__wfpdf.S.sel);
  ok('Unterschriftsfeld lässt sich setzen', await page.evaluate(id => window.__wfpdf.S.doc.fields.find(f => f.id === id).type === 'unterschrift', usId));
  await page.click('#mAusfuellen');
  await page.click(`.feld[data-id="${usId}"]`);
  await page.waitForSelector('#usFlaeche');
  const cb = await page.locator('#usFlaeche').boundingBox();
  await page.mouse.move(cb.x + 20, cb.y + cb.height * 0.7); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(cb.x + 20 + i * 18, cb.y + cb.height * (0.7 - 0.4 * Math.sin(i / 2)));
  await page.mouse.up();
  await page.click('.dlg [data-ok]');
  const usWert = await page.evaluate(id => window.__wfpdf.S.doc.fields.find(f => f.id === id).value, usId);
  ok('Unterschrift gespeichert (PNG) und im Feld zu sehen', /^data:image\/png;base64,/.test(usWert) && await page.locator(`.feld[data-id="${usId}"] img.usbild`).count() === 1);
  const usPdf = await page.evaluate(async () => { const w = window.__wfpdf; const r = await WFP.Export.exportieren(w.S.doc, w.S.bytes, 'fest'); const v = await WFP.Export.exportieren(w.S.doc, w.S.bytes, 'vorlage'); const t = b => new TextDecoder('latin1').decode(b); return [ /\/Subtype\s*\/Image/.test(t(r.bytes)), /\/Subtype\s*\/Image/.test(t(v.bytes)) ]; });
  ok('Unterschrift steht im festen PDF als Bild, die leere Vorlage bleibt ohne', usPdf[0] && !usPdf[1], usPdf);

  // 13. Speichern: Arbeitsstand als Datei, wieder einlesen
  await page.click('#edSpeichern');
  const [dlStand] = await Promise.all([page.waitForEvent('download'), page.click('[data-dl]')]);
  const standPfad = path.join(TMP, dlStand.suggestedFilename()); await dlStand.saveAs(standPfad);
  const stand = JSON.parse(fs.readFileSync(standPfad, 'utf8'));
  ok('Arbeitsstand-Datei: Format, Felder und PDF enthalten', stand.format === 'workfloh-pdf-arbeitsstand' && stand.doc.fields.some(f => f.value === 'Getippt') && stand.pdf.length > 500, dlStand.suggestedFilename());
  await page.evaluate(async () => { const w = window.__wfpdf; const id = w.S.doc.id; w.S.doc.fields.forEach(f => { if (f.value === 'Getippt') f.value = 'geändert'; }); w.S.doc.updatedAt = '2000-01-01T00:00:00Z'; await WFP.DB.put('docs', w.S.doc); });
  await page.click('#edZurueck');
  await page.setInputFiles('#inDatei', standPfad);
  await page.waitForFunction(() => window.__wfpdf.S.doc && window.__wfpdf.S.doc.fields.some(f => f.value === 'Getippt'), null, { timeout: 15000 });
  ok('Arbeitsstand eingelesen: Einträge wieder da, älterer Browserstand ersetzt', await page.evaluate(async () => (await WFP.DB.all('docs')).filter(d => d.name === 'Grauformular').length === 1));

  // 13b. Schon vorhandenes, leeres Feld liest bei erneuter Erkennung seinen Inhalt
  const vnId = await page.evaluate(() => { const f = window.__wfpdf.S.doc.fields.find(f => f.type === 'text' && f.geprueft && Math.abs(f.y - (841.89 - 704) / 841.89 * 100) < 0.6 && f.x < 35); f.value = ''; delete f.decken; return f.id; });
  await page.click('#mBearbeiten'); { await page.click('#edErkennen'); await page.click('[data-off]'); await page.waitForTimeout(400); await page.waitForFunction(() => !document.querySelector('.fortschritt')); }
  const vnW = await page.evaluate(id => { const f = window.__wfpdf.S.doc.fields.find(f => f.id === id); return f && f.value; }, vnId);
  ok('vorhandenes leeres Feld übernimmt den Text in der Fläche', vnW === 'Max Muster', [vnId, vnW, await page.locator('#edErkennen').isVisible()]);

  // 14a. Felder erkennen in der Bibliothek: Dokumente einzeln wählen, nichts vorgewählt
  if (await page.locator('#edZurueck').isVisible()) await page.click('#edZurueck');
  await page.click('[data-erk]'); await page.waitForSelector('.dlg [data-dok]');
  const wahl0 = await page.evaluate(() => ({ n: document.querySelectorAll('.dlg [data-dok]').length, an: document.querySelectorAll('.dlg [data-dok]:checked').length, ki: document.querySelector('.dlg [data-ki]').disabled }));
  await page.locator('.dlg [data-dok]').first().check();
  const wahl1 = await page.evaluate(() => ({ ki: document.querySelector('.dlg [data-ki]').disabled, t: document.querySelector('.dlg [data-zahl]').textContent }));
  ok('Erkennen: Dokumente einzeln wählbar, nichts vorgewählt, Knöpfe erst nach Wahl aktiv', wahl0.n >= 2 && wahl0.an === 0 && wahl0.ki && !wahl1.ki && /^1 von/.test(wahl1.t), [wahl0, wahl1]);
  await page.click('.dlg [data-x]');

  // 14. ⟳ Hard-Reload: lädt neu, räumt die Adresse auf, Dokumente bleiben
  const vorN = await page.evaluate(async () => (await WFP.DB.all('docs')).length);
  await Promise.all([page.waitForNavigation(), page.click('#btnNeu')]);
  await page.waitForFunction(() => window.__wfpdf && !location.search.includes('neu='), null, { timeout: 15000 });
  ok('⟳ lädt neu, Adresse aufgeräumt, Dokumente bleiben', await page.evaluate(async () => (await WFP.DB.all('docs')).length) === vorN && vorN > 0, vorN);

  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
