/* Workfloh PDF — Versionsnummer (Klaus 2026-10-22), im echten Browser.
   „Damit man prüfen kann, ob es sich um eine ältere oder jüngere Version handelt. Das sollte unten bei
   dem Impressum und beim Datenschutz stehen und nochmal hinten in den Einstellungen."
   - EINE Quelle: <meta name="wfp-version"> in index.html. Sie ist gleich package.json, und ihr
     data-cache ist gleich CACHE_VERSION in sw.js — wer den Cache erhöht, muss hier vorbei und die
     Version erhöhen.
   - Fuß und Einstellungen zeigen genau diese Nummer.
   - Die Pro-App setzt ihre eigene Nummer ein (Meta ändern + Ereignis „wfp-version"): der Fuß folgt.
   - Fehlt die Nummer oder ist sie falsch geformt, steht keine erfundene Nummer da.
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 400) : '')); } };
console.log('Workfloh PDF — Versionsnummer');

const HTML = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
const PKG = JSON.parse(fs.readFileSync(path.join(WURZEL, 'package.json'), 'utf8'));
const meta = (HTML.match(/<meta name="wfp-version"[^>]*>/g) || []);
const nummer = meta.length === 1 && (meta[0].match(/content="([^"]*)"/) || [])[1];
const cache = meta.length === 1 && (meta[0].match(/data-cache="([^"]*)"/) || [])[1];
const swCache = (SW.match(/const CACHE_VERSION = '([^']+)'/) || [])[1];
ok('genau eine Versionsangabe in index.html', meta.length === 1, meta.length);
ok('die Nummer hat die Form 1.2.3', /^\d+\.\d+\.\d+$/.test(nummer || ''), nummer);
ok('Version gleich package.json', nummer === PKG.version, { index: nummer, paket: PKG.version });
ok('data-cache gleich CACHE_VERSION in sw.js — Cache erhöht? Dann auch die Version erhöhen', cache && cache === swCache, { index: cache, sw: swCache });

let pw = null;
try { pw = await import('playwright-core'); } catch (_) {}
if (!pw) { console.log('  ⊘ nicht lauffähig (playwright-core fehlt — npm install)'); console.log(`\n${gruen} grün · ${rot} ROT`); process.exitCode = rot ? 1 : 0; process.exit(); }
const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
const seite = async (sprache, html) => {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 860 } });
  const page = await ctx.newPage(); const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (html) await page.route(url, r => r.fulfill({ status: 200, contentType: 'text/html', body: html }));
  if (sprache) await page.addInitScript(l => localStorage.setItem('wfpdf_sprache_v1', JSON.stringify({ lang: l })), sprache);
  await page.goto(url); await page.waitForFunction(() => window.__wfpdf);
  return { ctx, page, fehler };
};
const fuss = page => page.evaluate(() => { const e = document.getElementById('versionFuss'); const r = document.getElementById('rechtFuss');
  return e ? { text: e.textContent.trim(), sicht: e.checkVisibility(), unterImpressum: !!r && !!(r.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) } : null; });
const einst = async page => { await page.click('#btnEinst'); await page.waitForSelector('.dlg [data-einst-version]');
  return page.evaluate(() => { const e = document.querySelector('.dlg [data-einst-version]'); const alle = [...document.querySelectorAll('.dlg *')].filter(x => x.checkVisibility() && x.children.length === 0);
    return { text: e.textContent.trim(), sicht: e.checkVisibility(), ganzUnten: alle[alle.length - 1] === e || alle.indexOf(e) >= alle.length - 1 }; }); };
try {
  {
    const { ctx, page, fehler } = await seite();
    const f = await fuss(page);
    ok('Fuß: „Version ' + nummer + '" steht sichtbar unter „Impressum & Datenschutz"', f && f.sicht && f.text === 'Version ' + nummer && f.unterImpressum, f);
    const e = await einst(page);
    ok('Einstellungen: „Version ' + nummer + '" steht sichtbar ganz unten', e.sicht && e.text === 'Version ' + nummer && e.ganzUnten, e);
    await page.keyboard.press('Escape');
    // Pro-Weg: die App setzt ihre eigene Nummer ein
    const pro = await page.evaluate(() => { document.querySelector('meta[name="wfp-version"]').content = '1.0.3'; document.dispatchEvent(new Event('wfp-version')); return document.getElementById('versionFuss').textContent.trim(); });
    ok('Pro-Weg: neue Nummer + Ereignis „wfp-version" → der Fuß zeigt sie', pro === 'Version 1.0.3', pro);
    ok('keine Seitenfehler', fehler.length === 0, fehler);
    await ctx.close();
  }
  for (const [l, wort] of [['en', 'Version'], ['ru', 'Версия'], ['ar', 'الإصدار']]) {
    const { ctx, page } = await seite(l);
    await page.waitForFunction(w => (document.getElementById('versionFuss').textContent || '').includes(w), wort, { timeout: 8000 }).catch(() => {});
    const f = await fuss(page);
    ok(`Fuß auf ${l.toUpperCase()}: „${wort} ${nummer}"`, f && f.text === wort + ' ' + nummer, f);
    await ctx.close();
  }
  {
    // Gegenrichtung: falsche Form → keine Zahl erfinden, nichts anzeigen
    const kaputt = HTML.replace(/<meta name="wfp-version"[^>]*>/, '<meta name="wfp-version" content="neu">');
    const { ctx, page } = await seite(null, kaputt);
    const f = await fuss(page);
    ok('falsch geformte Nummer → der Fuß zeigt keine erfundene Version', f && !f.sicht && f.text === '', f);
    await ctx.close();
  }
} catch (e) { ok('Probe lief durch', false, String(e && e.stack || e)); }
await browser.close(); srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
