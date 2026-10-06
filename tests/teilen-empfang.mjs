/* Workfloh PDF — Empfang aus der Teilen-Liste anderer Apps (Klaus 2026-10-06).
   „Workflow soll damit auftauchen auf diese Leiste … Überall, wo ich Teilen machen kann."
   Android trägt eine installierte PWA in die Teilen-Liste ein, wenn ihr Manifest ein share_target
   nennt. Geteilt wird als POST (multipart) an ./teilen-empfang; der Worker legt die Dateien ab und
   leitet auf ./?geteilt=1 weiter, die App liest sie ein. Gemessen wird der GANZE Weg im echten
   Browser: Worker registriert, ein echtes Formular mit Datei abgeschickt (wie Android es tut).
   Ob Android die App wirklich in die Liste nimmt, misst diese Probe NICHT — das sieht nur das Tablet.
   Nur erfundene Daten. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

console.log('Workfloh PDF — Empfang aus der Teilen-Liste');
// ===== A. Manifest und Worker passen zusammen (ohne Browser) =====
const man = JSON.parse(fs.readFileSync(path.join(WURZEL, 'manifest.webmanifest'), 'utf8'));
const sw = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
const st = man.share_target || {};
ok('das Manifest nennt ein share_target', !!man.share_target);
ok('… als POST mit multipart/form-data (nur so kommen Dateien mit)', st.method === 'POST' && st.enctype === 'multipart/form-data', st);
const feld = ((st.params || {}).files || [])[0] || {};
ok('… mit einem Datei-Feld, das PDFs und Bilder annimmt', (feld.accept || []).includes('application/pdf') && (feld.accept || []).some(a => /^image\//.test(a)), feld);
ok('… und der Worker liest genau dieses Feld', !!feld.name && sw.includes(`fd.getAll('${feld.name}')`), feld.name);
ok('… und fängt genau diese Adresse ab', !!st.action && sw.includes(`endsWith('/${String(st.action).replace(/^\.\//, '')}')`), st.action);
ok('… und sie liegt im Geltungsbereich der App', new URL(st.action || 'x:', 'https://a.b/W/').href.startsWith(new URL(man.scope || './', 'https://a.b/W/').href));
const fh = (man.file_handlers || [])[0] || {};
ok('„Öffnen mit": file_handlers nennt PDF', !!(fh.accept && fh.accept['application/pdf']), man.file_handlers);
ok('der Vorrat der geteilten Dateien übersteht ein neues CACHE_VERSION', /BLEIBT = \[[^\]]*GETEILT_VORRAT/.test(sw));
ok('der POST-Empfang steht VOR dem Ausstieg für alles, was nicht GET ist',
  sw.indexOf("r.method === 'POST'") > -1 && sw.indexOf("r.method === 'POST'") < sw.indexOf("if (r.method !== 'GET'"));

// ===== B. Der ganze Weg im echten Browser =====
async function blatt(titel) {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([595.28, 841.89]).drawText(titel, { x: 60, y: 760, size: 14, font: f });
  return Buffer.from(await pdf.save({ useObjectStreams: false }));
}
let posts = 0;
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
  const s = http.createServer((q, r) => {
    if (q.method === 'POST') { posts++; r.writeHead(303, { Location: './' }); r.end(); return; }   // weiter in die App, damit die Probe meldet statt stolpert   // kommt hier etwas an, hat der Worker es NICHT abgefangen
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
let browser;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); }
catch (e) { console.log('  ⊘ nicht lauffähig: kein Browser (' + (e.message || e).split('\n')[0] + ')'); srv.close(); process.exit(2); }

const tmp = fs.mkdtempSync(path.join(WURZEL, 'tests', '.teilen-'));
const pdfPfad = path.join(tmp, 'Übersicht Ärger.pdf'); fs.writeFileSync(pdfPfad, await blatt('Erfundener Brief'));
const pdf2 = path.join(tmp, 'Zweiter Brief.pdf'); fs.writeFileSync(pdf2, await blatt('Noch ein erfundener Brief'));
const png = path.join(tmp, 'Foto vom Zettel.png'); fs.copyFileSync(path.join(WURZEL, 'icons', 'icon-192.png'), png);

async function bereit(page) {
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB, null, { timeout: 30000 });
  await page.waitForFunction(() => document.readyState === 'complete');
}
// Wie Android: ein Formular mit Datei-Feld wird an die share_target-Adresse geschickt
async function teilen(page, dateien, text) {
  await page.evaluate(({ action, name, text }) => {
    const f = document.createElement('form'); f.method = 'POST'; f.enctype = 'multipart/form-data'; f.action = action; f.id = '__teilform';
    const i = document.createElement('input'); i.type = 'file'; i.name = name; i.multiple = true; f.appendChild(i);
    const t = document.createElement('input'); t.type = 'hidden'; t.name = 'text'; t.value = text || ''; f.appendChild(t);
    document.body.appendChild(f);
  }, { action: st.action, name: feld.name, text });
  // Als Puffer, nicht als Pfad: Playwright verliert bei Umlauten im PFAD die Datei (gemessen, 0 Byte)
  if (dateien.length) await page.setInputFiles('#__teilform input[type=file]', dateien.map(d => ({ name: path.basename(d), mimeType: d.endsWith('.png') ? 'image/png' : 'application/pdf', buffer: fs.readFileSync(d) })));
  await Promise.all([page.waitForNavigation({ timeout: 30000 }), page.evaluate(() => document.getElementById('__teilform').submit())]);
  await bereit(page);
}
const toastText = page => page.evaluate(() => { const t = document.getElementById('toast'); return t && t.classList.contains('an') ? t.textContent : ''; });
const vorrat = page => page.evaluate(async () => (await (await caches.open('workfloh-pdf-geteilt')).keys()).length);

try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(URL0); await bereit(page);
  // Die App registriert den Worker nur unter https; hier (127.0.0.1) von Hand, derselbe sw.js
  await page.evaluate(async () => { await navigator.serviceWorker.register('sw.js'); await navigator.serviceWorker.ready; });
  await page.reload(); await bereit(page);
  ok('der Worker steuert die Seite (Ausgangslage, sonst misst der Rest nichts)', await page.evaluate(() => !!navigator.serviceWorker.controller));

  // B1: ein PDF geteilt
  await teilen(page, [pdfPfad]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.some(d => d.name === 'Übersicht Ärger'), null, { timeout: 30000 }).catch(() => {});
  const docs1 = await page.evaluate(() => window.__wfpdf.S.docs.map(d => d.name));
  ok('ein geteiltes PDF landet in der Bibliothek (Name mit Umlauten unverändert)', docs1.includes('Übersicht Ärger'), docs1);
  ok('… und die Datei wurde nie an den Server geschickt (der Worker hat sie abgefangen)', posts === 0, posts);
  ok('… und die Adresse trägt danach kein ?geteilt mehr (Neuladen liest nicht doppelt ein)', !/geteilt/.test(page.url()), page.url());
  ok('… und der Vorrat der geteilten Dateien ist leer', (await vorrat(page)) === 0);
  ok('… und eine einzelne Datei wird gleich geöffnet', await page.waitForFunction(() => !!document.querySelector('#sc-ed.on'), null, { timeout: 15000 }).then(() => true, () => false));
  await page.reload(); await bereit(page);
  const nach = await page.evaluate(() => window.__wfpdf.S.docs.filter(d => d.name === 'Übersicht Ärger').length);
  ok('Neuladen danach legt das Dokument nicht ein zweites Mal an', nach === 1, nach);

  // B2: zwei Dateien, PDF und Foto
  await teilen(page, [pdf2, png]);
  await page.waitForFunction(() => ['Zweiter Brief', 'Foto vom Zettel'].every(n => window.__wfpdf.S.docs.some(d => d.name === n)), null, { timeout: 30000 }).catch(() => {});
  const docs2 = await page.evaluate(() => window.__wfpdf.S.docs.map(d => d.name));
  ok('PDF und Foto zusammen geteilt: beide kommen an', docs2.includes('Zweiter Brief') && docs2.includes('Foto vom Zettel'), docs2);

  // B3: nur Text geteilt (etwa ein Link) — es kommt keine Datei, und das wird gesagt
  await teilen(page, [], 'https://beispiel.example/');
  await page.waitForFunction(() => /keine Datei an/.test(document.getElementById('toast').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('nur Text geteilt: die App sagt, dass keine Datei ankam', /keine Datei an/.test(await toastText(page)), await toastText(page));

  // B4: ?geteilt=1, aber der Vorrat ist leer — nie still
  await page.goto(URL0 + '?geteilt=1'); await bereit(page);
  await page.waitForFunction(() => /kam nicht an/.test(document.getElementById('toast').textContent), null, { timeout: 8000 }).catch(() => {});
  ok('leerer Vorrat: die App meldet es, statt still zu bleiben', /kam nicht an/.test(await toastText(page)), await toastText(page));
  ok('keine Seitenfehler im Teilen-Weg', !fehler.length, fehler);
  await ctx.close();

  // ===== C. „Öffnen mit" über launchQueue (gestellt — headless gibt es keine) =====
  const ctx2 = await browser.newContext();
  // Chromium bringt launchQueue selbst mit (nur lesbar) — deshalb überschrieben, nicht zugewiesen
  await ctx2.addInitScript(() => { Object.defineProperty(window, 'launchQueue', { configurable: true, value: { setConsumer(f) { window.__verbraucher = f; } } }); });
  const p2 = await ctx2.newPage();
  await p2.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p2.goto(URL0); await bereit(p2);
  await p2.waitForFunction(() => typeof window.__verbraucher === 'function', null, { timeout: 15000 }).catch(() => {});
  ok('„Öffnen mit": die App meldet sich bei launchQueue an', await p2.evaluate(() => typeof window.__verbraucher === 'function'));
  const b64 = fs.readFileSync(pdf2).toString('base64');
  await p2.evaluate(b64 => window.__verbraucher && window.__verbraucher({ files: [{ getFile: async () => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Mit geöffnet.pdf', { type: 'application/pdf' }) }] }), b64);
  await p2.waitForFunction(() => window.__wfpdf.S.docs.some(d => d.name === 'Mit geöffnet'), null, { timeout: 30000 }).catch(() => {});
  ok('… und eine damit geöffnete PDF landet in der Bibliothek', await p2.evaluate(() => window.__wfpdf.S.docs.some(d => d.name === 'Mit geöffnet')));
  await ctx2.close();
} catch (e) { rot++; console.log('  ✗ ROT: Probe gestolpert → ' + (e.stack || e)); }
finally { await browser.close(); srv.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
console.log(`${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
