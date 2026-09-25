/* Workfloh PDF — Mengen-Messung: 400 Seiten Handbuch übersetzen (erfundene Daten).
   Misst Zeit je Seite, Speicher, Größe des Ergebnisses — ohne Netz: der Übersetzer
   ist ein Stellvertreter, der sofort antwortet. Gemessen wird also der Anteil der
   App (Text lesen, Farben, speichern, PDF bauen), NICHT die Übersetzungszeit des
   echten Übersetzers — die kommt auf dem Gerät dazu.
   Dazu eine Stichprobe gescannter Seiten mit echter Texterkennung (OCR).
   Aufruf: npm run messen   (dauert einige Minuten, nicht Teil von npm test) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SEITEN = +(process.env.SEITEN || 400), SCANS = +(process.env.SCANS || 10);
const WORT = 'Gerät Taste Deckel Filter Wasser Sicherheit Hinweis Betrieb Reinigung Wartung Anzeige Stecker Kabel Schalter Gehäuse'.split(' ');
async function handbuch() {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica), fb = await pdf.embedFont(StandardFonts.HelveticaBold);
  const satz = (i, k) => Array.from({ length: 12 }, (_, j) => WORT[(i * 7 + k * 3 + j) % WORT.length]).join(' ');
  for (let i = 0; i < SEITEN; i++) {
    const p = pdf.addPage([595.28, 841.89]);
    p.drawText('Kapitel ' + (i + 1) + ' Bedienung', { x: 60, y: 780, size: 16, font: fb });
    for (let a = 0; a < 3; a++) for (let z = 0; z < 4; z++) p.drawText(satz(i, a * 4 + z) + (z < 3 ? '' : '.'), { x: 60, y: 740 - a * 80 - z * 14, size: 10, font: f });
    p.drawRectangle({ x: 330, y: 330, width: 200, height: 150, color: rgb(0.3, 0.5, 0.8) });
    for (let l = 0; l < 5; l++) p.drawText('• Schritt ' + (l + 1) + ': ' + satz(i, 20 + l).slice(0, 40), { x: 60, y: 480 - l * 16, size: 10, font: f });
    p.drawRectangle({ x: 50, y: 240, width: 260, height: 26, color: rgb(0.95, 0.75, 0.1) });
    p.drawText('Warnung: ' + satz(i, 30).slice(0, 36), { x: 58, y: 249, size: 9, font: f, color: rgb(1, 1, 1) });
    p.drawText('Seite ' + (i + 1), { x: 280, y: 40, size: 8, font: f });
  }
  return pdf.save();
}
async function scans(browser) {
  const pg = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  const pdf = await PDFDocument.create();
  for (let i = 0; i < SCANS; i++) {
    await pg.setContent(`<body style="margin:0;background:#f2efe6;font:30px Arial;padding:140px 120px;line-height:1.35"><h1 style="font-size:52px">Kapitel ${i + 1}: Reinigung</h1>${Array.from({ length: 6 }, (_, a) => `<p>${Array.from({ length: 30 }, (_, j) => WORT[(i + a * 5 + j) % WORT.length]).join(' ')}.</p>`).join('')}</body>`);
    const img = await pdf.embedJpg(await pg.screenshot({ type: 'jpeg', quality: 80 }));
    pdf.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  }
  await pg.close(); return pdf.save();
}
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(Object.assign(exe ? { executablePath: exe } : {}, { args: ['--enable-precise-memory-info'] }));
const hb = await handbuch(), sc = await scans(browser);
const srv = await server();
const page = await (await browser.newContext()).newPage();
page.on('pageerror', e => console.log('Fehler:', String(e)));
await page.goto(`http://127.0.0.1:${srv.address().port}/`);
await page.waitForFunction(() => window.WFP && WFP.Uebersetzung);
const messe = (b64, ocr) => page.evaluate(async ({ b64, ocr }) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const UE = WFP.Uebersetzung;
  const uebersetzer = async t => t.map(x => 'Перевод: ' + x);
  const db = []; let spitze = 0; const mem = () => { if (performance.memory) spitze = Math.max(spitze, performance.memory.usedJSHeapSize); };
  const t0 = performance.now();
  const r = await UE.lauf({ bytes, uebersetzer, ocr: ocr ? { basis: 'vendor/', von: 'de' } : null, speichere: async st => { await WFP.DB.put('files', { id: 'ue:mess', job: st }); mem(); } });
  const t1 = performance.now();
  const schrift = await UE.schriftLaden('vendor/');
  const out = await UE.pdfBauen(bytes, r.stand.seiten, schrift, { nach: 'ru' }); mem();
  const t2 = performance.now();
  const job = JSON.stringify(r.stand).length; await WFP.DB.del('files', 'ue:mess');
  return { seiten: r.n, absaetze: r.stand.seiten.reduce((n, s) => n + s.b.length, 0), lesenMs: t1 - t0, bauenMs: t2 - t1, eingang: bytes.length, ausgang: out.bytes.length, zwischenstand: job, spitzeMB: spitze / 1048576, ocrSeiten: r.ocrSeiten };
}, { b64: Buffer.from(ocr ? sc : hb).toString('base64'), ocr });
const fmt = r => `${r.seiten} Seiten · ${r.absaetze} Absätze · lesen+übersetzen+speichern ${(r.lesenMs / 1000).toFixed(1)} s (${(r.lesenMs / r.seiten).toFixed(0)} ms/Seite) · PDF bauen ${(r.bauenMs / 1000).toFixed(1)} s · Eingang ${(r.eingang / 1048576).toFixed(2)} MB → Ergebnis ${(r.ausgang / 1048576).toFixed(2)} MB · Zwischenstand ${(r.zwischenstand / 1048576).toFixed(2)} MB · Speicher-Spitze ${r.spitzeMB.toFixed(0)} MB`;
console.log('Handbuch digital:', fmt(await messe(null, false)));
console.log('Gescannt mit OCR:', fmt(await messe(null, true)));
await browser.close(); srv.close();
