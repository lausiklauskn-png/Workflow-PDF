/* Workfloh PDF — 🎬 Erklärvideo in der Hilfe (Klaus 2026-09-28: „1 und 2 zusammen").
   Das Video liegt auf der Webseite (Workfloh-PDF-Page, gleiche Adresse), wird erst auf Tipp geladen,
   steht NICHT im Offline-Vorrat und sagt offline, dass es Internet braucht — statt ein totes Video zu zeigen.
   Die Webseite ist hier nicht erreichbar: ihre Adressen werden gestellt (page.route). Chromium ohne H.264
   bekommt eine WebM als Stellvertreter — gemessen wird die APP (Quelle, Sprache, Laden, Vorrat), nicht das Video. */
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = process.env.WF_WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

const SEITE = 'https://lausiklauskn-png.github.io/Workfloh-PDF-Page/';
let STELLV = null;
try {
  const FF = process.env.FFMPEG || execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
  STELLV = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'video-')), 'stellv.webm');
  execFileSync(FF, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=64x36:r=1:d=5', '-c:v', 'libvpx-vp9', '-b:v', '20k', STELLV]);
} catch { STELLV = null; }

const srv = await new Promise(res => {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

async function oeffne(lang, opt = {}) {
  const ctx = await browser.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(l => { try { localStorage.setItem('wfpdf_sprache_v1', JSON.stringify({ lang: l, tipps: true })); } catch (_) {} }, lang);
  const abrufe = [];
  await ctx.route(SEITE + '**', r => {
    abrufe.push(r.request().url());
    if (opt.kaputt || !STELLV || !r.request().url().endsWith('.mp4')) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ status: 200, contentType: 'video/webm', body: fs.readFileSync(STELLV) });
  });
  const p = await ctx.newPage();
  await p.goto(URL0);
  await p.waitForFunction(() => window.__wfpdf && window.WFP && WFP.Sprache);
  return { ctx, p, abrufe };
}

try {
  // 1 · Die Hilfe trägt den Knopf und den Weg zur Webseite — und lädt dabei noch nichts
  {
    const { ctx, p, abrufe } = await oeffne('de');
    await p.evaluate(() => window.__wfpdf.dlg.hilfe());
    const knopf = await p.$('.dlg [data-video]');
    ok('Hilfe: der Knopf „🎬 Erklärvideo" steht da', !!knopf && /Erklärvideo/.test(await knopf.textContent()));
    const link = await p.$eval('.dlg [data-webseite]', a => ({ href: a.href, ziel: a.target, rel: a.rel, text: a.textContent })).catch(() => null);
    ok('Hilfe: der Link führt zur Webseite, in neuem Tab, ohne window.opener', link && link.href === 'https://lausiklauskn-png.github.io/Workfloh-PDF-Page/' && link.ziel === '_blank' && /noopener/.test(link.rel), link);
    ok('Hilfe: der Link nennt Kapitel und Kurzfassung', link && /Kapitel/.test(link.text) && /Kurzfassung/.test(link.text), link);
    await p.waitForTimeout(300);
    ok('Hilfe: solange nicht getippt wird, geht KEIN Abruf zur Webseite', abrufe.length === 0, abrufe);
    // 2 · Tipp: Dialog mit Video, Deutsch
    await knopf.click();
    await p.waitForSelector('.dlg video[data-erklaer]');
    const v = await p.$eval('.dlg video', e => ({ src: e.getAttribute('src'), poster: e.getAttribute('poster'), controls: e.controls, pre: e.getAttribute('preload') }));
    ok('Deutsch: die deutsche Fassung', v.src === SEITE + 'assets/workfloh-pdf-quer.mp4', v);
    ok('Deutsch: das passende Standbild', v.poster === SEITE + 'assets/poster-de.jpg', v);
    ok('das Video hat Bedienelemente und lädt vorab nur die Eckdaten', v.controls && v.pre === 'metadata', v);
    ok('Deutsch: kein Hinweis auf eine Ersatzsprache', !(await p.$('.dlg [data-ersatz]')));
    ok('online: der Offline-Hinweis ist verborgen', !(await p.$eval('.dlg [data-offline]', e => e.checkVisibility())));
    if (STELLV) {
      const geladen = await p.waitForFunction(() => { const e = document.querySelector('.dlg video'); return e && e.readyState >= 1; }, null, { timeout: 15000 }).then(() => true, () => false);
      ok('auf Tipp wird das Video wirklich von der Webseite geholt (Stellvertreter)', geladen && abrufe.some(u => u.endsWith('workfloh-pdf-quer.mp4')), abrufe);
    } else console.log('  ⊘ Stellvertreter-Video nicht erzeugbar (ffmpeg fehlt) — Laden nicht gemessen');
    await p.click('.dlg [data-x]');
    ok('Schließen nimmt den Dialog samt Video weg', !(await p.$('.dlg video')));
    await ctx.close();
  }
  // 2b · Der Knopf 🎬 in der Kopfleiste, direkt links neben „?" (Klaus 2026-09-28) — sichtbar, treffbar, öffnet das Video
  for (const breite of [1280, 320]) {
    const { ctx, p, abrufe } = await oeffne('de');
    await p.setViewportSize({ width: breite, height: 740 });
    const k = await p.evaluate(() => {
      const v = document.getElementById('btnVideo'), h = document.getElementById('btnHilfe');
      if (!v) return null;
      const a = v.getBoundingClientRect(), b = h.getBoundingClientRect(), mitte = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
      return { sichtbar: v.checkVisibility(), nachbar: v.nextElementSibling === h, links: a.right <= b.left + 1, treffbar: mitte === v || v.contains(mitte), w: a.width, h: a.height, im: a.left >= 0 && a.right <= innerWidth };
    });
    ok(`Kopfleiste ${breite} px: 🎬 steht sichtbar direkt links neben „?"`, !!k && k.sichtbar && k.nachbar && k.links && k.im, k);
    ok(`Kopfleiste ${breite} px: 🎬 ist treffbar (mindestens 30 px, nichts liegt darüber)`, !!k && k.treffbar && k.w >= 30 && k.h >= 30, k);
    await p.waitForTimeout(200);
    ok(`Kopfleiste ${breite} px: vor dem Tipp geht nichts zur Webseite`, abrufe.length === 0, abrufe);
    if (k) { await p.click('#btnVideo'); }
    const v = await p.waitForSelector('.dlg video[data-erklaer]', { timeout: 5000 }).then(() => true, () => false);
    ok(`Kopfleiste ${breite} px: ein Tipp auf 🎬 öffnet das Erklärvideo`, v);
    await ctx.close();
  }
  // 3 · Sprachen: EN, RU eigen; AR → Englisch, und es wird gesagt
  for (const [lang, datei, bild] of [['en', 'workfloh-pdf-quer-en.mp4', 'poster-en.jpg'], ['ru', 'workfloh-pdf-quer-ru.mp4', 'poster-ru.jpg'], ['ar', 'workfloh-pdf-quer-en.mp4', 'poster-en.jpg']]) {
    const { ctx, p } = await oeffne(lang);
    await p.evaluate(() => window.__wfpdf.dlg.erklaervideo());
    const v = await p.$eval('.dlg video', e => ({ src: e.getAttribute('src'), poster: e.getAttribute('poster') })).catch(() => null);
    ok(`${lang}: Fassung ${datei}`, v && v.src === SEITE + 'assets/' + datei && v.poster === SEITE + 'assets/' + bild, v);
    const ersatz = !!(await p.$('.dlg [data-ersatz]'));
    ok(`${lang}: Hinweis auf die Ersatzsprache ${lang === 'ar' ? 'steht da' : 'fehlt zu Recht'}`, ersatz === (lang === 'ar'));
    await ctx.close();
  }
  // 4 · Offline: kein totes Video, sondern ein Satz
  {
    const { ctx, p, abrufe } = await oeffne('de');
    await ctx.setOffline(true);
    await p.evaluate(() => window.__wfpdf.dlg.erklaervideo());
    ok('offline: kein Video-Element', !(await p.$('.dlg video')));
    const t = await p.$eval('.dlg [data-offline]', e => e.checkVisibility() && e.textContent).catch(() => false);
    ok('offline: der Hinweis ist zu sehen und nennt das Internet', !!t && /Internet/.test(t), t);
    ok('offline: der Link zur Webseite bleibt', !!(await p.$('.dlg a[href="' + SEITE + '"]')));
    ok('offline: nichts wurde abgerufen', abrufe.length === 0, abrufe);
    await ctx.close();
  }
  // 5 · Die Webseite antwortet nicht (Video fehlt): derselbe Satz statt eines schwarzen Kastens
  {
    const { ctx, p } = await oeffne('de', { kaputt: true });
    await p.evaluate(() => window.__wfpdf.dlg.erklaervideo());
    const weg = await p.waitForFunction(() => !document.querySelector('.dlg video'), null, { timeout: 10000 }).then(() => true, () => false);
    ok('Fehler beim Laden: das Video verschwindet', weg);
    ok('Fehler beim Laden: der Hinweis ist zu sehen', await p.$eval('.dlg [data-offline]', e => e.checkVisibility()).catch(() => false));
    await ctx.close();
  }
  // 6 · Der Offline-Vorrat fasst die Webseite nicht an
  {
    const sw = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
    const fetchTeil = sw.slice(sw.indexOf("addEventListener('fetch'"));
    const aus = fetchTeil.indexOf("'/Workfloh-PDF-Page/'"), vorrat = fetchTeil.indexOf('e.respondWith(caches.match(r)');
    ok('sw.js: Abrufe der Webseite werden durchgelassen, BEVOR der Vorrat greift', aus > 0 && vorrat > 0 && aus < vorrat, { aus, vorrat });
    ok('sw.js: die Webseite steht nicht in der SCHALE', !/SCHALE[\s\S]*?Workfloh-PDF-Page[\s\S]*?\];/.test(sw.slice(0, sw.indexOf("addEventListener('install'"))));
    // ⚠ BENANNTE GRENZE: einen Lauf MIT Worker gibt es hier nicht, und das ist gemessen. Die Probe läuft auf
    // 127.0.0.1, die Webseite ist damit ein FREMDER Ursprung, den der Worker ohnehin nie anfasst. Ohne die
    // Sperrzeile blieb der Lauf grün (von Hand nachgestellt, 2026-09-28): er hätte nichts gemessen. Auf
    // lausiklauskn-png.github.io ist es DERSELBE Ursprung — dort trägt allein die Zeile oben.
  }
} catch (e) { ok('Probe lief durch', false, String(e).slice(0, 400)); }

await browser.close(); srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
