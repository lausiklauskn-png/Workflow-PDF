/* Workfloh PDF — Kopfzeile mit einer breiten Systemschrift (Befund aus Workflow-PDF #131, 2026-10-22: mit DejaVu Sans
   war „Workfloh PDF" bei 380 px abgeschnitten — 87 px Text in 81 px Platz, weil #btnInstall bis 520 px 42,7 px breit war
   statt 34 px wie die Nachbarknöpfe). tests/bibliothek.mjs misst mit der Schrift des Rechners; hier wird DejaVu Sans
   ausdrücklich gesetzt, damit der Fall auf jedem Rechner derselbe ist. WURZEL=<pfad> misst eine andere Kopie. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' — ' + JSON.stringify(info) : '')); } };
console.log('Workfloh PDF — Kopfzeile mit breiter Systemschrift (DejaVu Sans)');

const CSS = fs.readFileSync(path.join(WURZEL, 'assets/style.css'), 'utf8');
ok('style.css: #btnInstall ist bis 520 px so groß wie die Nachbarknöpfe (34 px)', /max-width:520px\)\{[^\n]*#btnInstall\{width:34px;height:34px;min-width:34px;min-height:34px;padding:0\}/.test(CSS));

const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ttf': 'font/ttf' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROMIUM].find(p => p && fs.existsSync(p));
let browser = null;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { console.log('  ⊘ Browser nicht lauffähig: ' + e.message); }
if (browser) {
  for (const w of [360, 380, 400, 412, 480, 520]) {
    const page = await browser.newPage({ viewport: { width: w, height: 800 } });
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
    await page.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style'); s.textContent = '.marke,.marke-name{font-family:"DejaVu Sans",sans-serif!important}'; document.head.appendChild(s); }));
    await page.goto(url); await page.waitForFunction(() => window.__wfpdf);
    const m = await page.evaluate(() => { const n = document.querySelector('.marke-name'); const k = document.querySelector('.kopf-rechts'); const range = document.createRange(); range.selectNodeContents(n);
      const t = range.getBoundingClientRect(), kr = k.getBoundingClientRect(), ib = document.getElementById('btnInstall').getBoundingClientRect();
      return { schrift: getComputedStyle(n).fontFamily, textRechts: Math.round(t.right), knoepfeLinks: Math.round(kr.left), abgeschnitten: n.scrollWidth > n.clientWidth + 1, seite: document.documentElement.scrollWidth, install: Math.round(ib.width), installDa: ib.width > 0 }; });
    ok(`${w} px: DejaVu Sans ist gesetzt`, /DejaVu Sans/.test(m.schrift), m.schrift);
    ok(`${w} px: Schriftzug nicht abgeschnitten und nicht unter den Knöpfen`, !m.abgeschnitten && m.textRechts <= m.knoepfeLinks, m);
    ok(`${w} px: Seite nicht breiter als das Fenster`, m.seite <= w, m.seite);
    if (w <= 520 && w > 370 && m.installDa) ok(`${w} px: Installieren-Knopf 34 px wie die Nachbarn`, m.install === 34, m.install);
    await page.close();
  }
  await browser.close();
}
srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
