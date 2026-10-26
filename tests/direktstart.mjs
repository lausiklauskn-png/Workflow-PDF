/* Workfloh PDF — Direktstart des Scanners aus einer anderen App (Klaus 2026-10-26).
   BookLedgerPro öffnet Workflow PDF mit ./?scan=1&von=BookLedgerPro: der Scanner geht sofort auf,
   „Durchsuchbar" ist für diesen Scan vorbelegt (BookLedgerPro liest den erkannten Text aus der
   Textebene), die Adresse wird geputzt, ein Toast nennt den Rückweg (📤 Teilen). Gemessen im echten
   Browser; ob Android die Pro-App über den Link öffnet, misst diese Probe NICHT (nur das Tablet).
   Nur erfundene Daten. WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };
console.log('Workfloh PDF — Direktstart des Scanners (?scan=1)');

// ===== A. Ohne Browser: die Kette und die Übersetzungen =====
const app = fs.readFileSync(path.join(WURZEL, 'assets/app.js'), 'utf8');
ok('scanDirektstart hängt in der Startkette NACH dem Teilen-Empfang', /\.then\(geteiltUebernehmen\)\.then\(oeffnenMitEmpfangen\)\.then\(scanDirektstart\)/.test(app));
ok('die Adresse wird geputzt (⟳ öffnet den Scanner nicht noch einmal)', /\['scan', 'von'\]\.forEach\(n => q\.delete\(n\)\)/.test(app) && /history\.replaceState/.test(app.slice(app.indexOf('function scanDirektstart'), app.indexOf('function oeffnenMitEmpfangen'))));
ok('„Durchsuchbar" wird nur für diesen Scan gesetzt, nicht gemerkt', /st\.durchsuchbar = true/.test(app) && !/merk\.durchsuchbar = true/.test(app));
const texte = fs.readFileSync(path.join(WURZEL, 'assets/sprache-texte.js'), 'utf8');
for (const lang of ['en', 'ru', 'ar']) {
  const block = texte.slice(texte.indexOf(` "${lang}": {`));
  ok(`Toast-Texte des Direktstarts in ${lang.toUpperCase()}`, block.includes('"Scan aus einer anderen App gestartet') && block.includes('"Scan für „{}\\" gestartet'));
}

// ===== B. Im echten Browser =====
const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROMIUM].find(p => p && fs.existsSync(p));
let browser;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); }
catch (e) { console.log('  ⊘ nicht lauffähig: kein Browser (' + (e.message || e).split('\n')[0] + ')'); srv.close(); process.exit(2); }
const bereit = async (page) => { await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB, null, { timeout: 30000 }); await page.waitForFunction(() => document.readyState === 'complete'); };
const toastText = page => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.classList.contains('an') ? t.textContent : ''; });
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  // Ausgangslage: ohne Parameter kein Scanner
  await page.goto(URL0); await bereit(page); await page.waitForTimeout(400);
  ok('ohne ?scan=1 öffnet sich kein Scanner', !(await page.$('.scan')));
  // Die gemerkte Wahl des Nutzers: NICHT durchsuchbar
  await page.evaluate(() => localStorage.setItem('wfpdf_scan_v1', JSON.stringify({ durchsuchbar: false })));
  await page.goto(URL0 + '?scan=1&von=BookLedgerPro'); await bereit(page);
  const offen = await page.waitForSelector('.scan', { timeout: 15000 }).then(() => true, () => false);
  ok('?scan=1 öffnet den Scanner sofort', offen);
  const d = await page.evaluate(() => window.__wfpdfDirektstart || null);
  ok('„Durchsuchbar" ist für diesen Scan vorbelegt', !!d && d.durchsuchbar === true && (await page.evaluate(() => WFP.Scanner.zustand().durchsuchbar === true)), d);
  ok('… die gemerkte Wahl des Nutzers bleibt unberührt', await page.evaluate(() => JSON.parse(localStorage.getItem('wfpdf_scan_v1') || '{}').durchsuchbar === false));
  ok('die Adresse trägt danach kein ?scan und kein ?von mehr', !/scan=|von=/.test(page.url()), page.url());
  const toast = await toastText(page);
  ok('der Toast nennt die startende App und den Rückweg über Teilen', /BookLedgerPro/.test(toast) && /Teilen/.test(toast), toast);
  await page.reload(); await bereit(page); await page.waitForTimeout(400);
  ok('Neuladen öffnet den Scanner nicht noch einmal', !(await page.$('.scan')));
  await page.goto(URL0 + '?scan=1'); await bereit(page);
  ok('?scan=1 ohne Absender öffnet den Scanner ebenfalls', await page.waitForSelector('.scan', { timeout: 15000 }).then(() => true, () => false));
  ok('… mit dem allgemeinen Toast', /anderen App/.test(await toastText(page)), await toastText(page));
  ok('keine Seitenfehler', !fehler.length, fehler);
  await ctx.close();
} finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
