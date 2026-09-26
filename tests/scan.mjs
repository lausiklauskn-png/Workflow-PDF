/* Workfloh PDF — Probe „Scannen" (Klaus 2026-09-26).
   A · Rechnung ohne Browser (assets/scan-bild.js): entscheiden, Maße, drehen, Filter, Farben.
   B · Blatterkennung an 17 echten Testfotos mit geprüften Ecken (tests/scan-fotos/):
       keine Seite darf „sicher" heißen und mehr als 5 % daneben liegen.
   C · Der ganze Weg im echten Browser: Foto → Ecken → ziehen → Filter → drehen →
       Texterkennung (echtes Tesseract) → Zeile ändern → durchsuchbares PDF in der Bibliothek.
   Aufruf: node tests/scan.mjs */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info) : '')); } };

/* ---------- A · Rechnung ---------- */
console.log('Scannen — A · Rechnung (ohne Browser)');
await import(path.join(WURZEL, 'assets/scan-bild.js'));
const SB = globalThis.__WFP_SCANBILD;
{
  const W = 1000, H = 1000;
  const blatt = [[100, 100], [900, 110], [890, 900], [110, 890]];
  const nah = blatt.map(p => [p[0] + 10, p[1] - 8]);
  const fern = blatt.map(p => [p[0] + 120, p[1] + 90]);
  ok('abstand: gleiche Ecken → 0, verschobene → in % der Diagonale', SB.abstand(blatt, blatt, W, H) === 0 && Math.abs(SB.abstand(blatt, nah, W, H) - Math.hypot(10, 8) / Math.hypot(W, H) * 100) < 1e-9);
  const e1 = SB.entscheiden({ ml: { ecken: blatt, score: 0.9 }, blatt: { sicher: true, ecken: nah } }, W, H);
  ok('entscheiden: Modell und Blatterkennung einig → sicher, Ecken vom Modell', e1.sicher && e1.quelle === 'ml' && e1.ecken === blatt, e1);
  const e2 = SB.entscheiden({ ml: { ecken: blatt, score: 0.9 }, blatt: { sicher: true, ecken: fern } }, W, H);
  ok('entscheiden: uneinig → NICHT sicher (wird zum Prüfen markiert)', !e2.sicher && e2.quelle === 'ml' && /prüfen/.test(e2.grund), e2);
  const e3 = SB.entscheiden({ ml: { ecken: blatt, score: 0.9 }, klassisch: { ecken: nah } }, W, H);
  ok('entscheiden: Modell und Kantenerkennung einig → sicher', e3.sicher && e3.quelle === 'ml', e3);
  const e4 = SB.entscheiden({ ml: { ecken: fern, score: 0.2 }, blatt: { sicher: true, ecken: blatt }, klassisch: { ecken: nah } }, W, H);
  ok('entscheiden: schwaches Modell (score < 0,5) zählt nicht, Blatt + Kanten einig → sicher', e4.sicher && e4.quelle === 'blatt', e4);
  const e5 = SB.entscheiden({ blatt: { sicher: true, ecken: blatt } }, W, H);
  ok('entscheiden: nur eine Meinung → nicht sicher', !e5.sicher && e5.quelle === 'blatt', e5);
  const e6 = SB.entscheiden({}, W, H);
  ok('entscheiden: nichts gefunden → ganzes Foto, nicht sicher', !e6.sicher && e6.quelle === 'ganz' && SB.abstand(e6.ecken, SB.ganz(W, H), W, H) === 0, e6);
  const e7 = SB.entscheiden({ ml: { ecken: [[0, 0], [5, 0], [5, 5], [0, 5]], score: 0.99 }, blatt: { sicher: true, ecken: blatt } }, W, H);
  ok('entscheiden: winziges Viereck taugt nicht als Blatt', e7.quelle === 'blatt', e7);
  ok('sortiere: Ecken in beliebiger Reihenfolge → oben links, oben rechts, unten rechts, unten links', JSON.stringify(SB.sortiere([blatt[2], blatt[0], blatt[3], blatt[1]])) === JSON.stringify(blatt));

  const m1 = SB.seitenMass([[0, 0], [700, 0], [700, 990], [0, 990]], 'a4', 72);
  ok('seitenMass A4 hoch: 595,28 × 841,89 pt, bei 72 dpi 595 × 842 px', !m1.quer && m1.seite[0] === 595.28 && m1.seite[1] === 841.89 && m1.W === 595 && m1.H === 842, m1);
  const quer = [[0, 0], [1400, 0], [1400, 1000], [0, 1000]];
  const m2 = SB.seitenMass(quer, 'letter', 100);
  ok('seitenMass Letter quer: 792 × 612 pt', m2.quer && m2.seite[0] === 792 && m2.seite[1] === 612, m2);
  const m3 = SB.seitenMass([[0, 0], [500, 0], [500, 1000], [0, 1000]], 'blatt', 72);
  ok('seitenMass „wie das Blatt": Seitenverhältnis 1:2 bleibt', Math.abs(m3.seite[0] / m3.seite[1] - 0.5) < 1e-6, m3);

  // drehen: 3×2 → 2×3, Pixel wandern richtig
  const bild = (w, h, f) => { const d = new Uint8ClampedArray(w * h * 4); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, v = f(x, y); d[i] = v[0]; d[i + 1] = v[1]; d[i + 2] = v[2]; d[i + 3] = 255; } return { data: d, width: w, height: h }; };
  const px = (img, x, y) => { const i = (y * img.width + x) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  const klein = bild(3, 2, (x, y) => [x * 50, y * 100, 7]);
  const r1 = SB.drehen(klein, 1);
  ok('drehen rechts: 3×2 wird 2×3, oben links ist das alte unten links', r1.width === 2 && r1.height === 3 && px(r1, 0, 0)[1] === 100 && px(r1, 1, 0)[1] === 0, [r1.width, r1.height, px(r1, 0, 0)]);
  const r4 = SB.drehen(SB.drehen(SB.drehen(SB.drehen(klein, 1), 1), 1), 1);
  ok('viermal drehen = unverändert', Buffer.from(r4.data).equals(Buffer.from(klein.data)));
  ok('drehen -1 = dreimal rechts', Buffer.from(SB.drehen(klein, -1).data).equals(Buffer.from(SB.drehen(klein, 3).data)));

  // entzerren: ein schräg liegendes weißes Blatt auf dunklem Tisch, mit rotem Punkt in der Blattmitte
  const quad = [[60, 40], [300, 70], [280, 380], [40, 350]];
  const innen = (x, y) => { let s = 0; for (let i = 0; i < 4; i++) { const a = quad[i], b = quad[(i + 1) % 4]; const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]); if (c < 0) return false; } return true; };
  const mitte = [(60 + 300 + 280 + 40) / 4, (40 + 70 + 380 + 350) / 4];
  const foto = bild(340, 420, (x, y) => Math.hypot(x - mitte[0], y - mitte[1]) < 8 ? [220, 20, 20] : innen(x, y) ? [240, 238, 232] : [40, 40, 45]);
  const ent = SB.entzerren(foto, quad, 100, 141);
  const ecke = [px(ent, 1, 1), px(ent, 98, 1), px(ent, 98, 139), px(ent, 1, 139)];
  ok('entzerren: in allen vier Ecken der Seite ist Papier, kein Tisch', ecke.every(c => c[0] > 200), ecke);
  const m = px(ent, 50, 70);
  ok('entzerren: der Punkt aus der Blattmitte liegt in der Seitenmitte', m[0] > 150 && m[1] < 90, m);

  // Filter: Blatt mit Schatten von links nach rechts, dunkle Schrift in der Mitte
  const seite = () => bild(200, 200, (x, y) => { const papier = 250 - x * 0.55; return (y > 95 && y < 105 && x > 30 && x < 170) ? [papier * 0.25, papier * 0.25, papier * 0.3] : [papier, papier * 0.98, papier * 0.94]; });
  const doku = seite(); SB.filtern(doku, 'dokument');
  const hellL = px(doku, 10, 20)[0], hellR = px(doku, 190, 20)[0], text = px(doku, 100, 100)[0];
  ok('Filter „Dokument": Schatten weg — Papier links und rechts beide fast weiß (> 235)', hellL > 235 && hellR > 235, [hellL, hellR]);
  ok('… und die Schrift bleibt dunkel (< 80)', text < 80, text);
  const roh = seite();
  ok('(ohne Filter lag rechts ein Schatten: ' + px(roh, 190, 20)[0] + ')', px(roh, 190, 20)[0] < 160);
  const sw = seite(); SB.filtern(sw, 'sw');
  let nurSW = true; for (let i = 0; i < sw.data.length; i += 4) if (!(sw.data[i] === 0 || sw.data[i] === 255) || sw.data[i] !== sw.data[i + 1]) { nurSW = false; break; }
  ok('Filter „Schwarzweiß": nur 0 und 255, Schrift schwarz', nurSW && px(sw, 100, 100)[0] === 0 && px(sw, 190, 20)[0] === 255);
  const gr = seite(); SB.filtern(gr, 'grau');
  ok('Filter „Graustufen": R = G = B', px(gr, 50, 20)[0] === px(gr, 50, 20)[1] && px(gr, 50, 20)[1] === px(gr, 50, 20)[2]);
  const org = seite(); SB.filtern(org, 'original');
  ok('Filter „Original": Pixel unverändert', Buffer.from(org.data).equals(Buffer.from(seite().data)));
  const hell = seite(); SB.filtern(hell, 'original', { hell: 50 });
  ok('Helligkeit +50 macht heller', px(hell, 100, 100)[0] > px(seite(), 100, 100)[0]);
  const kon = seite(); SB.filtern(kon, 'original', { kontrast: 60 });
  ok('Kontrast +60: Schrift dunkler, Papier heller', px(kon, 100, 100)[0] < px(seite(), 100, 100)[0] && px(kon, 10, 20)[0] > px(seite(), 10, 20)[0]);
  const bunt = bild(200, 200, (x, y) => { const papier = 250 - x * 0.55; return (x > 80 && x < 120 && y > 20 && y < 60) ? [papier * 0.8, papier * 0.3, papier * 0.3] : [papier, papier * 0.98, papier * 0.94]; });
  SB.filtern(bunt, 'farbe');
  const rotF = px(bunt, 100, 40);
  ok('Filter „Farbe": Schatten weg (Papier rechts > 235), ein roter Stempel bleibt rot', px(bunt, 190, 180)[0] > 235 && rotF[0] > rotF[1] + 60, [px(bunt, 190, 180), rotF]);
  const f = SB.textFarben(seite(), { x: 20, y: 90, w: 100, h: 20 });
  ok('textFarben: Papier hell, Schrift dunkel gemessen', f.grund[0] > 180 && f.schrift[0] < 80, f);
}

/* ---------- Browser ---------- */
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const konsole = [], fremd = [];
page.on('pageerror', e => konsole.push(String(e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
page.on('request', q => { if (!q.url().startsWith(URL0) && !/^(data|blob):/.test(q.url())) fremd.push(q.url()); });
const TMP = fs.mkdtempSync('/tmp/wfpdf-scan-');

try {
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.Scanner && WFP.ScanBild);

  /* ---------- B · Erkennung an echten Fotos ---------- */
  console.log('Scannen — B · Blatterkennung an 17 Testfotos');
  const GT = JSON.parse(fs.readFileSync(path.join(WURZEL, 'tests/scan-fotos/ecken.json'), 'utf8')).bilder;
  const erg = await page.evaluate(async namen => {
    const out = {};
    for (const n of namen) {
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'tests/scan-fotos/' + n; });
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0);
      const s = { foto: c };
      await WFP.Scanner.erkennen(s);
      out[n] = { ecken: s.ecken, sicher: s.erkennung.sicher, quelle: s.erkennung.quelle, verfahren: s.erkennung.verfahren };
    }
    return out;
  }, Object.keys(GT));
  let sicherRichtig = 0, sicherFalsch = [], pruefen = 0, mitML = 0;
  for (const [n, g] of Object.entries(GT)) {
    const e = erg[n], fehler = SB.abstand(SB.sortiere(e.ecken), g.ecken, g.width, g.height);
    if (e.verfahren.ml) mitML++;
    if (e.sicher && fehler <= 5) sicherRichtig++; else if (e.sicher) sicherFalsch.push([n, fehler.toFixed(1)]); else pruefen++;
  }
  ok('Modell (Scanic ML) lief auf allen Fotos — ohne Netz, aus vendor/scanic/', mitML === Object.keys(GT).length, mitML);
  ok('KEIN Foto wird „sicher" genannt und liegt mehr als 5 % daneben (sonst würde still falsch geschnitten)', sicherFalsch.length === 0, sicherFalsch);
  ok('mindestens 10 von 17 sicher und richtig (gemessen am 2026-09-26: 12)', sicherRichtig >= 10, { sicherRichtig, pruefen });
  console.log(`  ⓘ sicher und richtig ${sicherRichtig} · zum Prüfen markiert ${pruefen} · sicher und falsch ${sicherFalsch.length}`);

  /* ---------- C · Der ganze Weg ---------- */
  console.log('Scannen — C · Foto → PDF im echten Browser');
  // Gestelltes Handyfoto: dunkler Tisch, schräges Blatt mit Schatten und Text
  const mach = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1600; const x = c.getContext('2d');
    x.fillStyle = '#2b2a2e'; x.fillRect(0, 0, 1200, 1600);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${80 + Math.random() * 60},${70 + Math.random() * 50},60,.25)`; x.fillRect(Math.random() * 1200, Math.random() * 1600, 3, 3); }
    x.save(); x.translate(600, 800); x.rotate(5 * Math.PI / 180);
    const g = x.createLinearGradient(-420, 0, 420, 0); g.addColorStop(0, '#f6f3ea'); g.addColorStop(1, '#bdb8ad');
    x.fillStyle = g; x.fillRect(-420, -594, 840, 1188);
    x.fillStyle = '#1b1b22'; x.font = 'bold 64px Arial'; x.fillText('RECHNUNG 4711', -340, -400);
    x.font = '52px Arial'; x.fillText('Betrag 128,50 EUR', -340, -250); x.fillText('Musterstadt', -340, -130);
    x.restore();
    const ecken = [[-420, -594], [420, -594], [420, 594], [-420, 594]].map(([a, b]) => { const r = 5 * Math.PI / 180; return [600 + a * Math.cos(r) - b * Math.sin(r), 800 + a * Math.sin(r) + b * Math.cos(r)]; });
    return { url: c.toDataURL('image/jpeg', 0.9), ecken };
  });
  const foto1 = path.join(TMP, 'Rechnung.jpg'); fs.writeFileSync(foto1, Buffer.from(mach.url.split(',')[1], 'base64'));
  const foto2 = path.join(TMP, 'Zweite Seite.jpg'); fs.writeFileSync(foto2, Buffer.from(mach.url.split(',')[1], 'base64'));

  await page.click('#btnScan');
  await page.waitForSelector('.scan [data-galerie]');
  ok('„Scannen" öffnet das Scan-Werkzeug mit Kamera und Galerie', await page.isVisible('.scan [data-kamera]'));
  await page.setInputFiles('.scan [data-in-galerie]', foto1);
  await page.waitForFunction(() => window.__wfpdfScan && window.__wfpdfScan.seiten[0] && window.__wfpdfScan.seiten[0].erkennung, null, { timeout: 60000 });
  let Z = await page.evaluate(() => window.__wfpdfScan);
  const f0 = Z.seiten[0].foto;
  const fehl = SB.abstand(Z.seiten[0].ecken, mach.ecken, f0[0], f0[1]);
  ok('Blatt im Foto gefunden und sicher (Verfahren einig)', Z.seiten[0].erkennung.sicher, Z.seiten[0].erkennung);
  ok('… Ecken liegen auf dem Papier (< 2 % der Diagonale)', fehl < 2, fehl.toFixed(2));
  ok('Befund steht an der Seite: „✓ Blatt erkannt"', await page.getAttribute('.scan [data-befund]', 'data-befund') === 'ok');

  // Ecke ziehen → von Hand gesetzt; ↺ Automatisch holt die Erkennung zurück
  const g0 = await page.locator('.scan .scan-griff').first().boundingBox();
  await page.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2); await page.mouse.down();
  await page.mouse.move(g0.x + 40, g0.y + 30, { steps: 5 });
  ok('beim Ziehen erscheint die Lupe', await page.isVisible('.scan [data-lupe]'));
  await page.mouse.up();
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Ecke gezogen → Seite gilt als „von Hand gesetzt", die Ecke hat sich bewegt', Z.seiten[0].manuell && SB.abstand(Z.seiten[0].ecken, mach.ecken, f0[0], f0[1]) > 1 && await page.getAttribute('.scan [data-befund]', 'data-befund') === 'hand');
  await page.click('.scan [data-auto]');
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('↺ Automatisch setzt die erkannten Ecken zurück', !Z.seiten[0].manuell && SB.abstand(Z.seiten[0].ecken, mach.ecken, f0[0], f0[1]) < 2);

  // Ergebnis: Filter, drehen
  await page.click('.scan .scan-weiter');
  await page.waitForSelector('.scan [data-ergebnis]');
  ok('„Zuschnitt passt" zeigt die gerade gezogene Seite', await page.evaluate(() => { const i = document.querySelector('.scan [data-ergebnis]'); return i.naturalWidth > 0 && i.naturalHeight / i.naturalWidth > 1.35; }));
  await page.click('.scan [data-filter="dokument"]');
  const ecke = await page.evaluate(() => new Promise(res => { const i = document.querySelector('.scan [data-ergebnis]'); const go = () => { const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight; const x = c.getContext('2d'); x.drawImage(i, 0, 0); const d = x.getImageData(c.width - 20, 20, 8, 8).data; res(d[0]); }; i.complete ? go() : i.onload = go; }));
  ok('Filter „Dokument": auch die beschattete rechte Blattseite wird weiß (> 230)', ecke > 230, ecke);
  await page.click('.scan [data-dreh="1"]');
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('⟳ dreht die Seite (quer)', Z.seiten[0].drehung === 1 && await page.evaluate(() => { const i = document.querySelector('.scan [data-ergebnis]'); return i.naturalWidth > i.naturalHeight; }));
  await page.click('.scan [data-dreh="-1"]');

  // zweite Seite, umordnen, Filter auf alle, entfernen
  await page.setInputFiles('.scan [data-in-galerie]', foto2);
  await page.waitForFunction(() => window.__wfpdfScan.seiten.length === 2 && window.__wfpdfScan.seiten[1].erkennung, null, { timeout: 60000 });
  ok('zweite Seite kommt in die Leiste', await page.locator('.scan .scan-daumen').count() === 2);
  await page.click('.scan [data-links="1"]');
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('◀ tauscht die Reihenfolge (die neue steht vorn)', Z.seiten[0].name === 'Zweite Seite.jpg' && Z.seiten[1].name === 'Rechnung.jpg' && Z.akt === 0, Z.seiten.map(s => s.name));
  await page.click('.scan [data-ansicht="ergebnis"]');
  await page.click('.scan [data-weg]');
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('🗑 entfernt die Seite, eine bleibt (die richtige)', Z.seiten.length === 1 && Z.seiten[0].name === 'Rechnung.jpg', Z.seiten.map(s => s.name));
  await page.click('.scan [data-waehle="0"]');
  await page.click('.scan [data-ansicht="ergebnis"]');

  // Texterkennung (echtes Tesseract, auf dem Gerät)
  await page.selectOption('.scan [data-sprache]', 'deu');
  const t0 = Date.now();
  await page.click('.scan [data-ocr]');
  await page.waitForFunction(() => window.__wfpdfScan.seiten[0].ocr > 0, null, { timeout: 180000 });
  const ocrMs = Date.now() - t0;
  await page.waitForSelector('.scan [data-zeile]');
  const zeilen = await page.$$eval('.scan [data-zeile]', l => l.map(k => ({ i: k.dataset.zeile, t: k.title })));
  const z4711 = zeilen.find(z => /4711/.test(z.t));
  ok('Texterkennung findet „RECHNUNG 4711" (Zeilen: ' + zeilen.length + ', ' + ocrMs + ' ms)', !!z4711, zeilen);
  if (z4711) {
    await page.click(`.scan [data-zeile="${z4711.i}"]`);
    await page.fill('.dlg [data-t]', 'RECHNUNG 9999');
    await page.click('.dlg [data-j]');
    Z = await page.evaluate(() => window.__wfpdfScan);
    ok('Zeile geändert: „RECHNUNG 9999" gemerkt, Zeile markiert', Z.seiten[0].aenderungen[z4711.i] === 'RECHNUNG 9999' && await page.locator('.scan .scan-zeile.geaendert').count() === 1);
  }

  // Die geänderte Zeile ist IM BILD neu geschrieben: Seite mit und ohne Änderung unterscheiden sich genau dort
  const diff = await page.evaluate(i => {
    const s = WFP.Scanner.zustand().seiten[0], z = s.ocr.zeilen[+i];
    const a = WFP.Scanner.seiteRechnen(s, 80, true).canvas, b = WFP.Scanner.seiteRechnen(s, 80, false).canvas;
    const da = a.getContext('2d').getImageData(0, 0, a.width, a.height).data, db = b.getContext('2d').getImageData(0, 0, b.width, b.height).data;
    let drin = 0, n = 0, draussen = 0;
    const x0 = z.box[0] * a.width, y0 = z.box[1] * a.height, x1 = x0 + z.box[2] * a.width, y1 = y0 + z.box[3] * a.height;
    for (let y = 0; y < a.height; y++) for (let x = 0; x < a.width; x++) {
      const o = (y * a.width + x) * 4, d = Math.abs(da[o] - db[o]) > 40, im = x >= x0 - 3 && x <= x1 + 3 && y >= y0 - 3 && y <= y1 + 3;
      if (im) { n++; if (d) drin++; } else if (d) draussen++;
    }
    return { anteil: drin / n, draussen };
  }, z4711 ? z4711.i : 0);
  ok('im Seitenbild ist die geänderte Zeile neu geschrieben (> 5 % der Zeile anders), sonst nichts', diff.anteil > 0.05 && diff.draussen === 0, diff);

  // Durchsuchbares PDF → Bibliothek
  await page.check('.scan [data-durch]');
  await page.fill('.scan [data-name]', 'Scan Probe'); await page.dispatchEvent('.scan [data-name]', 'change');
  const [zip] = await Promise.all([page.waitForEvent('download'), page.click('.scan [data-zip]')]);
  const zb = fs.readFileSync(await zip.path());
  ok('🖼 Als Bilder: ZIP mit einem JPEG (Name und JPEG-Kennung)', zb[0] === 0x50 && zb[1] === 0x4b && zb.includes(Buffer.from('Scan Probe - Seite 01.jpg')) && zb.includes(Buffer.from([0xff, 0xd8, 0xff])));
  await page.click('.scan [data-fertig]');
  await page.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 });
  ok('„PDF erstellen" legt das Dokument an und öffnet es', await page.evaluate(() => window.__wfpdf.S.doc.name === 'Scan Probe' && window.__wfpdf.S.doc.quelle === 'foto' && !document.querySelector('.scan')));
  const p = await page.evaluate(() => window.__wfpdf.S.doc.pages);
  ok('Seite ist GENAU A4 hoch', p.length === 1 && Math.abs(p[0].w - 595.28) < 0.01 && Math.abs(p[0].h - 841.89) < 0.01, p);
  const txt = await page.evaluate(async () => { const b = await WFP.DB.getFile(window.__wfpdf.S.doc.id); const pdf = await pdfjsLib.getDocument({ data: b.slice(0) }).promise; const tc = await (await pdf.getPage(1)).getTextContent(); pdf.destroy(); return tc.items.map(i => i.str).join(' '); });
  ok('PDF ist durchsuchbar: der geänderte Text steht in der Textebene', /9999/.test(txt) && /Betrag/.test(txt), txt);
  ok('… der alte Text nicht mehr', !/4711/.test(txt), txt);
  const pdfInfo = await page.evaluate(() => window.__wfpdfScanPdf);
  console.log(`  ⓘ Texterkennung ${ocrMs} ms · PDF ${Math.round(pdfInfo.bytes / 1024)} KB in ${pdfInfo.ms} ms`);

  // Kamera-Weg im Übersetzen-Bereich und beim Anhängen öffnet dasselbe Werkzeug
  await page.click('#edZurueck'); await page.waitForSelector('#sc-bib.on');
  await page.click('#btnUebersetzen'); await page.waitForSelector('.dlg [data-uk]');
  const [kam] = await Promise.all([page.waitForEvent('filechooser'), page.click('.dlg [data-uk]')]);
  ok('Übersetzen → „📷 Brief fotografieren" öffnet das Scan-Werkzeug mit der Kamera', await page.evaluate(() => /Brief fotografieren/.test(document.querySelector('.scan-titel')?.textContent || '')) && kam.element && (await kam.element().getAttribute('capture')) === 'environment');
  await kam.setFiles([]);
  await page.click('.scan [data-schliessen]');
  ok('✕ ohne Seiten schließt ohne Rückfrage', !(await page.$('.scan')));

  // Eine Seite, bei der sich die Verfahren nicht einig sind: wird markiert, und „fertig" fragt nach
  await page.click('#btnScan'); await page.waitForSelector('.scan [data-in-galerie]', { state: 'attached' });
  const grau = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 600; c.height = 800; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 600, 800); g.addColorStop(0, '#999'); g.addColorStop(1, '#bbb'); x.fillStyle = g; x.fillRect(0, 0, 600, 800); return c.toDataURL('image/png'); });
  const grauF = path.join(TMP, 'Grau.png'); fs.writeFileSync(grauF, Buffer.from(grau.split(',')[1], 'base64'));
  await page.setInputFiles('.scan [data-in-galerie]', grauF);
  await page.waitForFunction(() => window.__wfpdfScan.seiten[0] && window.__wfpdfScan.seiten[0].erkennung, null, { timeout: 60000 });
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Foto ohne Blatt: NICHT sicher, Befund „bitte prüfen", Warnung im Fuß', !Z.seiten[0].erkennung.sicher && await page.getAttribute('.scan [data-befund]', 'data-befund') === 'pruefen' && await page.isVisible('.scan [data-offen]'), Z.seiten[0].erkennung);
  await page.click('.scan [data-fertig]');
  ok('„PDF erstellen" fragt vor dem Übernehmen einer ungeprüften Seite', await page.waitForSelector('.dlg [data-n]', { timeout: 5000 }).then(() => true, () => false));
  await page.click('.dlg [data-n]');
  ok('… „Zurück und prüfen" lässt das Werkzeug offen', !!(await page.$('.scan')) && !(await page.$('.dlg')));
  await page.click('.scan [data-schliessen]'); await page.click('.dlg [data-j]');

  ok('kein Aufruf ins Netz (Modell, Texterkennung, Schrift liegen auf dem Gerät)', fremd.length === 0, fremd);
  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
