/* Workfloh PDF — sichtbarer Schieberegler (Klaus 2026-09-27).
   „noch einen Schieberegler … dass man ihn anfassen kann mit einem Viereck … Bei kleineren Handys
   ist sonst nicht zu erkennen, dass da noch mehr folgt." Nur erfundene Daten.
   Gemessen wird, was man SIEHT und was ein Finger tut — nicht, ob eine Klasse im Code steht. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = process.env.WF_WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

const pdf = await PDFDocument.create(); const schrift = await pdf.embedFont(StandardFonts.Helvetica);
pdf.addPage([595.28, 841.89]).drawText('Erfundenes Formular', { x: 60, y: 760, size: 14, font: schrift });
const B64 = Buffer.from(await pdf.save({ useObjectStreams: false })).toString('base64');

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

/* Lage einer Leiste und ihres Schiebers — so, wie man sie sieht. */
const LAGE = sel => {
  const l = document.querySelector(sel); if (!l) return null;
  const b = l.nextElementSibling && l.nextElementSibling.classList.contains('wfsch') ? l.nextElementSibling : null;
  const g = b && b.querySelector('.wfsch-griff');
  const sicht = el => !!el && el.getClientRects().length > 0 && el.checkVisibility() && el.getBoundingClientRect().width > 20;   // eine Schiene mit 0 px Breite sieht niemand (Befund beim Bau)
  const r = g && g.getBoundingClientRect(), rb = b && b.getBoundingClientRect();
  return { ueber: l.scrollWidth - l.clientWidth, links: l.scrollLeft, rest: l.scrollWidth - l.clientWidth - l.scrollLeft,
    bahnDa: !!b, bahnSicht: sicht(b), griffSicht: sicht(g), griffB: r ? Math.round(r.width) : 0, griffH: r ? Math.round(r.height) : 0,
    griffX: r ? Math.round(r.left + r.width / 2) : 0, griffY: r ? Math.round(r.top + r.height / 2) : 0,
    bahnL: rb ? Math.round(rb.left) : 0, bahnR: rb ? Math.round(rb.right) : 0, bahnY: rb ? Math.round(rb.top + rb.height / 2) : 0,
    rillen: g ? g.querySelectorAll('i').length : 0, fremdeLeiste: getComputedStyle(l).scrollbarWidth };
};

try {
  console.log('Workfloh PDF — sichtbarer Schieberegler');
  const ctx = await browser.newContext({ viewport: { width: 380, height: 800 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e.stack || e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB);
  ok('der Baustein ist geladen (WFSchieber)', await page.evaluate(() => !!window.WFSchieber));

  // ===== A. Feldarten-Leiste im Bearbeiten-Fenster, schmales Handy =====
  await page.evaluate(async b64 => {
    const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Formular.pdf', { type: 'application/pdf' });
    await window.__wfpdf.importDateien([f], 'Posteingang');
  }, B64);
  await page.waitForFunction(() => !!document.querySelector('#sc-ed.on'), null, { timeout: 30000 });
  // Ein Erkennen-Dialog nach dem Einlesen darf die Messung nicht verdecken
  await page.evaluate(() => { const m = document.getElementById('modals'); if (m) m.innerHTML = ''; });
  await page.evaluate(() => { const w = window.__wfpdf; w.S.modus = 'bearbeiten'; document.getElementById('mBearbeiten').click(); });
  const SEL = '#edFuss .werkzeug';
  await page.waitForFunction(s => { const l = document.querySelector(s); return l && l.nextElementSibling && l.nextElementSibling.classList.contains('wfsch'); }, SEL, { timeout: 10000 }).catch(() => {});
  let a = await page.evaluate(LAGE, SEL);
  ok('Vorbedingung: die Feldarten-Leiste ragt am Handy über den Rand (sonst misst der Rest nichts)', !!a && a.ueber > 20, a);
  ok('unter der Leiste steht ein Schieberegler, und man SIEHT ihn', !!a && a.bahnSicht && a.griffSicht, a);
  ok('der Griff ist ein Viereck mit Rillen, groß genug für einen Finger (≥ 44 × 18 px)', !!a && a.griffB >= 44 && a.griffH >= 18 && a.rillen === 3, a);
  ok('die dünne Leiste des Browsers ist ausgeblendet (nur EINE Anzeige)', !!a && a.fremdeLeiste === 'none', a);
  // Handy: mehr Fläche fürs Blatt, flachere Knöpfe, kleinere Griffe (Klaus 2026-09-27: „die Button in der
  // Handyansicht zu fett … flacher … so dass mehr Fläche bleibt für die Ansicht des Bildes"; „rote Punkte
  // … um 20 % verkleinert, aber nicht mehr"). Gemessen, was man SIEHT: vorher 47 % des Schirms fürs Blatt.
  const flach = await page.evaluate(() => {
    const sicht = e => e.offsetParent && e.getBoundingClientRect().height > 0;
    const hoehen = [...document.querySelectorAll('.ed-leiste .knopf, .ed-such .knopf, #edFuss .werkzeug .knopf')].filter(sicht).map(e => Math.round(e.getBoundingClientRect().height));
    const fl = document.querySelector('.ed-flaeche').getBoundingClientRect();
    // Griff an einem gestellten, gewählten Feld messen — und ob der Finger NEBEN dem Punkt ihn noch trifft
    const f = document.createElement('div'); f.className = 'feld sel'; f.style.cssText = 'position:fixed;left:120px;top:300px;width:80px;height:24px';
    const g = document.createElement('span'); g.className = 'griff'; f.appendChild(g); document.body.appendChild(f);
    f.style.zIndex = '9999'; const r = g.getBoundingClientRect(); const neben = document.elementFromPoint(r.right + 5, r.top + r.height / 2);
    const w = { knoepfe: hoehen, blatt: Math.round(fl.height), schirm: innerHeight, griff: Math.round(r.width), nebenTrifft: neben === g };
    f.remove(); return w;
  });
  // Gemessen bei 380 × 800: vorher 423 px (53 %), nachher 487 px (61 %). „Die Hälfte" wäre schon VORHER
  // wahr gewesen — die Gegenprobe hat es gezeigt. Die Schwelle liegt deshalb zwischen beiden.
  ok('Handy: das Blatt bekommt mehr als 58 % des Schirms (vorher 53 %)', flach.blatt >= flach.schirm * 0.58, flach);
  ok('Handy: die Knöpfe im Bearbeiten-Fenster sind flach (höchstens 32 px)', flach.knoepfe.length >= 5 && Math.max(...flach.knoepfe) <= 32, flach);
  ok('Handy: der rote Griff ist um rund 20 % kleiner, nicht mehr (12–14 px statt 16)', flach.griff >= 12 && flach.griff <= 14, flach);
  ok('… und ein Finger knapp daneben trifft ihn trotzdem (Greiffläche blieb groß)', flach.nebenTrifft, flach);
  ok('am Anfang steht der Griff links', !!a && a.links === 0 && a.griffX - a.griffB / 2 - a.bahnL <= 2, a);

  // Griff mit dem Finger ganz nach rechts ziehen
  const zug = async (x0, y0, x1) => {
    const cdp = await ctx.newCDPSession(page);
    const tp = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y: y0 }] });
    await tp('touchStart', x0); for (let i = 1; i <= 8; i++) await tp('touchMove', x0 + (x1 - x0) * i / 8); await tp('touchEnd'); await cdp.detach();
  };
  await zug(a.griffX, a.griffY, a.bahnR + 40);
  a = await page.evaluate(LAGE, SEL);
  ok('Griff nach rechts ziehen rollt die Leiste bis ans Ende', a.rest <= 2, a);
  ok('… und der Griff steht dann rechts', a.bahnR - (a.griffX + a.griffB / 2) <= 2, a);
  // Auf den Anfang der Schiene tippen springt zurück
  await page.touchscreen.tap(a.bahnL + 3, a.bahnY);
  a = await page.evaluate(LAGE, SEL);
  ok('auf den Anfang der Schiene tippen springt an den Anfang', a.links <= 2, a);
  // Wischen in der Leiste selbst: der Griff läuft mit
  await page.evaluate(s => { const l = document.querySelector(s); l.scrollLeft = (l.scrollWidth - l.clientWidth) / 2; }, SEL);
  await page.waitForTimeout(50);
  a = await page.evaluate(LAGE, SEL);
  const mitte = (a.griffX - a.bahnL - a.griffB / 2) / Math.max(1, (a.bahnR - a.bahnL - a.griffB));
  ok('wischt man die Leiste selbst, läuft der Griff mit (Mitte ↔ Mitte)', Math.abs(mitte - 0.5) < 0.08, { mitte, a });
  ok('ein Knopf der Leiste bleibt antippbar (Text setzen)', await page.evaluate(() => { const b = document.querySelector('#edFuss [data-t="text"]'); b.click(); return window.__wfpdf.S.platzieren === 'text'; }));
  // Der Fuß wird neu gezeichnet (platzieren) — der Schieber muss wieder da sein
  a = await page.evaluate(LAGE, SEL);
  ok('nach dem Neuzeichnen des Fußes ist der Schieber wieder da', !!a && a.bahnSicht, a);
  await page.evaluate(() => { document.querySelector('#edFuss [data-t="text"]').click(); });

  // ===== B. Breiter Bildschirm: alles passt → kein Schieber =====
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.waitForTimeout(150);
  a = await page.evaluate(LAGE, SEL);
  ok('am breiten Bildschirm passt alles — dann ist KEIN Schieber zu sehen (kein toter Griff)', !!a && a.ueber <= 1 && !a.bahnSicht, a);

  // ===== C. Ordner-Leiste der Bibliothek =====
  await page.setViewportSize({ width: 380, height: 800 });
  await page.click('#edZurueck');
  await page.waitForSelector('#sc-bib.on');
  await page.evaluate(async () => {
    const w = window.__wfpdf;
    for (let i = 1; i <= 7; i++) { const o = { id: 'o' + i, name: 'Ordner Nummer ' + i, createdAt: new Date().toISOString() }; await WFP.DB.put('folders', o); w.S.ordner.push(o); }
    w.suche.zeichneBibliothek();
  });
  await page.waitForTimeout(120);
  a = await page.evaluate(LAGE, '#ordnerLeiste');
  ok('Vorbedingung: die Ordner-Leiste ragt am Handy über den Rand', !!a && a.ueber > 20, a);
  ok('unter den Ordner-Knöpfen steht ein Schieberegler mit Griff', !!a && a.bahnSicht && a.griffSicht && a.griffB >= 44, a);
  await zug(a.griffX, a.griffY, a.bahnR + 40);
  a = await page.evaluate(LAGE, '#ordnerLeiste');
  ok('… und er rollt die Ordner bis ans Ende', a.rest <= 2, a);

  ok('keine Fehler auf der Seite', fehler.length === 0, fehler);
} catch (e) { rot++; console.log('  ✗ ROT: unterwegs gestolpert → ' + (e && e.stack || e)); }
finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
