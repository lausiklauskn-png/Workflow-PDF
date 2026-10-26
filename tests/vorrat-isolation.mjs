/* Workfloh PDF — der Worker löscht beim Aktivieren NUR eigene alte Schalen (Klaus 2026-10-26: „Es darf auf gar
   keinen Fall passieren", dass Workflow PDF die Vorräte anderer Apps derselben github.io-Adresse löscht).
   Gemessen am ECHTEN sw.js in Chromium: vorher werden fremde Vorräte (Private Brain, BookLedger, Sage), die
   eigenen bleibenden Vorräte (Modell, transformers-cache, geteilte Dateien) und zwei alte eigene Schalen angelegt.
   Nach der Aktivierung: fremde und bleibende Vorräte samt Inhalt da, alte eigene Schalen weg, neue Schale da.
   Ohne Browser: der Quelltext trägt den Präfix-Riegel. WURZEL=<pfad> misst eine andere Kopie (Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' — ' + JSON.stringify(info) : '')); } };
console.log('Workfloh PDF — Vorräte anderer Apps bleiben');

const SW = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
const cacheVersion = (SW.match(/const CACHE_VERSION = '([^']+)'/) || [])[1] || '';
ok('sw.js: die eigene Schale heißt workfloh-pdf-v…', /^workfloh-pdf-v\d+$/.test(cacheVersion), cacheVersion);
ok('sw.js: activate löscht nur Namen mit dem eigenen Präfix', /activate[\s\S]*?n\.startsWith\(EIGENE_SCHALE\)\s*&&\s*n !== CACHE_VERSION/.test(SW));
ok('sw.js: der Präfix ist genau workfloh-pdf-v (trifft nicht den Modell-Vorrat)', /const EIGENE_SCHALE = 'workfloh-pdf-v'/.test(SW));

const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.ttf': 'font/ttf' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p === '/probe.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><title>Vorratsprobe</title>'); return; }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', process.env.CHROMIUM].find(p => p && fs.existsSync(p));
let browser = null;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { console.log('  ⊘ Browser nicht lauffähig: ' + e.message); }
if (browser) {
  // Fremde Apps derselben Adresse (echte Namen der Nachbarn), eigene bleibende Vorräte, eigene alte Schalen.
  const FREMD = ['private-brain-v91', 'blpr-shell-v258', 'blpr-geteilt', 'sage-protokol-v12', 'kimboard-v3'];
  const BLEIBT = ['workfloh-pdf-modell-v1', 'transformers-cache', 'workfloh-pdf-geteilt'];
  const ALT = ['workfloh-pdf-v1', 'workfloh-pdf-v106'];
  const page = await browser.newPage();
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(url + 'probe.html');
  await page.evaluate(async (namen) => {
    for (const n of namen) await (await caches.open(n)).put('./nachweis', new Response('Inhalt von ' + n));
    const reg = await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(r => navigator.serviceWorker.addEventListener('controllerchange', r, { once: true }));
    // activate.waitUntil kann nach ready noch laufen: kurz warten, bis die alten Schalen verschwunden sind (höchstens 10 s).
    for (let i = 0; i < 100; i++) { const k = await caches.keys(); if (!k.includes('workfloh-pdf-v1') && !k.includes('workfloh-pdf-v106')) break; await new Promise(r => setTimeout(r, 100)); }
    void reg;
  }, [...FREMD, ...BLEIBT, ...ALT]);
  const stand = await page.evaluate(async (namen) => {
    const keys = await caches.keys(); const inhalt = {};
    for (const n of namen) { const c = await caches.open(n); const r = await c.match('./nachweis'); inhalt[n] = r ? await r.text() : null; }
    return { keys, inhalt };
  }, [...FREMD, ...BLEIBT]);
  for (const n of FREMD) ok('fremder Vorrat bleibt samt Inhalt: ' + n, stand.keys.includes(n) && stand.inhalt[n] === 'Inhalt von ' + n, stand.inhalt[n]);
  for (const n of BLEIBT) ok('eigener bleibender Vorrat bleibt: ' + n, stand.keys.includes(n) && stand.inhalt[n] === 'Inhalt von ' + n, stand.inhalt[n]);
  for (const n of ALT) ok('eigene alte Schale weg: ' + n, !stand.keys.includes(n), stand.keys);
  ok('die aktuelle Schale ' + cacheVersion + ' ist da', stand.keys.includes(cacheVersion), stand.keys);
  await browser.close();
}
srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
