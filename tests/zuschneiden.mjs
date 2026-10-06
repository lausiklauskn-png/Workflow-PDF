/* Workfloh PDF — „✂️ Zuschneiden" im Editor (Klaus 2026-10-06).
   „Es soll nur ein Button hinzukommen, zuschneiden. Und dann kann man das Dokument
   zuschneiden, ausrichten und auf die Größe anpassen, die gewünscht ist. Alles andere ist okay."
   Gemessen: der Knopf steht in der Leiste, öffnet den Scanner mit JEDER Seite des offenen
   Dokuments, „Übernehmen" ersetzt die Datei DESSELBEN Dokuments (Kennung, Ordner, Felder
   bleiben), und Abbrechen lässt alles, wie es war. Nur erfundene Daten. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { console.log('⊘ nicht lauffähig: playwright-core fehlt'); process.exit(2); }
const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

// Kein Funktionsname doppelt in app.js: eine zweite Deklaration gewinnt still und nahm am
// 2026-10-06 dem Unterschrift-Zuschnitt (zuschneiden(c)) seine Funktion.
{
  const app = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'app.js'), 'utf8');
  const namen = [...app.matchAll(/^\s*(?:async\s+)?function\s+([\wäöüÄÖÜß$]+)\s*\(/gm)].map(m => m[1]);
  const doppelt = namen.filter((n, k) => namen.indexOf(n) !== k);
  ok('kein Funktionsname steht in app.js zweimal', namen.length > 50 && doppelt.length === 0, doppelt);
}

async function zweiSeiten() {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  for (const t of ['Erfundene Seite eins', 'Erfundene Seite zwei']) { const s = pdf.addPage([595.28, 841.89]); s.drawText(t, { x: 60, y: 760, size: 22, font: f }); s.drawRectangle({ x: 60, y: 400, width: 470, height: 200, borderWidth: 2 }); }
  return pdf.save({ useObjectStreams: false });
}
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.onnx': 'application/octet-stream' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
let browser;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { console.log('⊘ nicht lauffähig: kein Browser — ' + e.message.split('\n')[0]); process.exit(2); }
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const PDF64 = Buffer.from(await zweiSeiten()).toString('base64');

try {
  console.log('Workfloh PDF — Zuschneiden im Editor');
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB);
  await page.evaluate(async b64 => {
    const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Erfundenes Formular.pdf', { type: 'application/pdf' });
    await window.__wfpdf.importDateien([f], 'Zuschnitt');
  }, PDF64);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 1, null, { timeout: 30000 });
  if (!await page.evaluate(() => !!document.querySelector('#sc-ed.on'))) await page.click('#dokGitter .dok .dok-name');
  await page.waitForSelector('#sc-ed.on');
  await page.waitForFunction(() => window.__wfpdf.S.pdf && document.querySelectorAll('.seite').length === 2, null, { timeout: 30000 });
  // zwei Felder, eins je Seite, mit Eintrag
  const vorher = await page.evaluate(async () => {
    const S = window.__wfpdf.S;
    S.doc.fields = [{ id: 'f1', page: 0, x: 10, y: 20, w: 40, h: 4, type: 'text', label: 'Name', value: 'Erika Beispiel' },
                    { id: 'f2', page: 1, x: 10, y: 30, w: 40, h: 4, type: 'text', label: 'Ort', value: 'Musterstadt' }];
    await WFP.DB.put('docs', S.doc);
    return { id: S.doc.id, folderId: S.doc.folderId, createdAt: S.doc.createdAt, laenge: S.bytes.length, seiten: S.doc.pages.length };
  });

  // 1 · der Knopf steht in der Leiste, neben „Felder erkennen", und alles andere bleibt
  const leiste = await page.evaluate(() => [...document.querySelectorAll('.ed-leiste > *')].map(e => e.id || e.className));
  const iE = leiste.indexOf('edErkennen'), iZ = leiste.indexOf('edZuschneiden');
  ok('„✂️ Zuschneiden" steht in der Editor-Leiste, direkt nach „Felder erkennen"', iZ > 0 && iZ === iE + 1, leiste);
  ok('… und die übrigen Knöpfe sind alle noch da', ['edZurueck', 'edName', 'edErkennen', 'edSpeichern', 'edTeilen', 'edExport'].every(k => leiste.includes(k)), leiste);
  ok('… er ist sichtbar und trägt einen Namen', await page.isVisible('#edZuschneiden') && /Zuschneiden/.test(await page.textContent('#edZuschneiden')));

  // 2 · Abbrechen lässt alles, wie es war
  await page.click('#edZuschneiden');
  await page.waitForFunction(() => window.__wfpdfScan && window.__wfpdfScan.seiten.length === 2 && window.__wfpdfScan.seiten.every(s => s.erkennung), null, { timeout: 90000 });
  let Z = await page.evaluate(() => window.__wfpdfScan);
  ok('der Scanner öffnet mit JEDER Seite des Dokuments als Bild', Z.seiten.length === 2 && Z.seiten.every(s => Math.max(...s.foto) >= 2000), Z.seiten.map(s => s.foto));
  ok('… im Zuschneiden, mit „Übernehmen" statt „PDF erstellen"', /Übernehmen/.test(await page.textContent('.scan [data-fertig]')) && !(await page.$('.scan [data-ablegen-hinweis]')));
  await page.click('.scan [data-schliessen]');
  if (await page.$('.dlg [data-j]')) await page.click('.dlg [data-j]');
  await page.waitForFunction(() => !document.querySelector('.scan'));
  const nachAbbruch = await page.evaluate(async id => { const S = window.__wfpdf.S; const f = await WFP.DB.getFile(id); return { laenge: S.bytes.length, datei: f && (f.byteLength || f.length || f.size), felder: S.doc.fields.length }; }, vorher.id);
  ok('Abbrechen ändert nichts (Datei und Felder wie vorher)', nachAbbruch.laenge === vorher.laenge && nachAbbruch.felder === 2, nachAbbruch);

  // 3 · Zuschneiden und übernehmen
  await page.click('#edZuschneiden');
  await page.waitForFunction(() => window.__wfpdfScan && window.__wfpdfScan.seiten.length === 2 && window.__wfpdfScan.seiten.every(s => s.erkennung), null, { timeout: 90000 });
  await page.click('.scan [data-fertig]');
  for (let i = 0; i < 4 && await page.waitForSelector('.dlg [data-j]', { timeout: 1500 }).then(() => true, () => false); i++) await page.click('.dlg [data-j]');
  await page.waitForFunction(() => window.__wfpdfZuschnitt && window.__wfpdfZuschnitt.fertig, null, { timeout: 90000 });
  const nach = await page.evaluate(async () => {
    const S = window.__wfpdf.S; const d = await WFP.DB.get('docs', S.doc.id); const g = await WFP.DB.getFile(S.doc.id);
    return { id: S.doc.id, folderId: d.folderId, createdAt: d.createdAt, laenge: S.bytes.length, gespeichert: g ? g.length : -1, seiten: d.pages.length, pdfSeiten: S.pdf.numPages, felder: d.fields.map(f => f.id + ':' + f.value), docs: S.docs.length, gezeichnet: document.querySelectorAll('.seite').length, toast: (document.querySelector('.toast') || {}).textContent || '' };
  });
  ok('„Übernehmen" ersetzt die Datei (neue Bytes, gleiche Seitenzahl)', nach.laenge !== vorher.laenge && nach.seiten === 2 && nach.pdfSeiten === 2, nach);
  ok('… und die neue Datei liegt gespeichert in der Bibliothek (nicht nur im Speicher)', nach.gespeichert === nach.laenge && nach.gespeichert !== vorher.laenge, nach);
  ok('… DASSELBE Dokument: Kennung, Ordner und Anlagedatum bleiben, kein zweites entsteht', nach.id === vorher.id && nach.folderId === vorher.folderId && nach.createdAt === vorher.createdAt && nach.docs === 1, nach);
  ok('… die Felder samt Einträgen bleiben', nach.felder.join() === 'f1:Erika Beispiel,f2:Musterstadt', nach.felder);
  ok('… die Seiten sind neu gezeichnet', nach.gezeichnet === 2, nach);
  ok('… und die Meldung bittet, die Felder zu prüfen', /Felder/.test(nach.toast), nach.toast);
  ok('keine Fehler auf der Seite', fehler.length === 0, fehler);
} catch (e) { rot++; console.log('  ✗ ROT: unterwegs gestolpert → ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ')); }
await browser.close(); srv.close();
console.log(`${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
