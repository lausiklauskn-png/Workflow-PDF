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
  // Formate (Klaus 2026-09-27): Automatisch · Original · A4 · A5 · A6
  const m5 = SB.seitenMass([[0, 0], [700, 0], [700, 990], [0, 990]], 'a5', 72), m6 = SB.seitenMass(quer, 'a6', 72);
  ok('seitenMass A5 hoch: 419,53 × 595,28 pt', !m5.quer && m5.seite[0] === 419.53 && m5.seite[1] === 595.28 && m5.format === 'a5', m5);
  ok('seitenMass A6 quer: 419,53 × 297,64 pt', m6.quer && m6.seite[0] === 419.53 && m6.seite[1] === 297.64 && m6.format === 'a6', m6);
  const ma = SB.seitenMass([[0, 0], [700, 0], [700, 990], [0, 990]], 'auto', 72);
  ok('Automatisch: Verhältnis wie DIN (√2) → A4', ma.format === 'a4' && ma.seite[1] === 841.89, ma);
  const mb = SB.seitenMass([[0, 0], [500, 0], [500, 1000], [0, 1000]], 'auto', 72);
  ok('Automatisch: 1:2 ist kein DIN-Blatt → Original, Verhältnis bleibt', mb.format === 'blatt' && Math.abs(mb.seite[0] / mb.seite[1] - 0.5) < 1e-6, mb);
  const rand = r => SB.seitenMass([[0, 0], [1000, 0], [1000, 1000 * r], [0, 1000 * r]], 'auto', 72).format;
  ok('Automatisch: Grenze ± 8 % um √2 — 1,52 noch A4, 1,54 schon Original, 1,31 noch A4, 1,29 (US Letter) Original', rand(1.52) === 'a4' && rand(1.54) === 'blatt' && rand(1.31) === 'a4' && rand(1.29) === 'blatt', [1.52, 1.54, 1.31, 1.29].map(rand));
  ok('unbekanntes Format fällt auf A4 zurück (und sagt es)', SB.seitenMass(quer, 'quatsch', 72).format === 'a4');

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
  // Schärfe (Klaus 2026-10-06: „Schärfeeinstellung … Pixelkanten glätten"). Gemessen an einem
  // blassen, verwischten Strich (erfunden): Kern dunkler, Papier bleibt hell, 0 heißt aus.
  const strich = () => bild(120, 40, (x) => { const v = Math.exp(-((x - 60) ** 2) / (2 * 1.2 * 1.2)); const L = 240 - 70 * v; return [L, L, L]; });
  const kern = (m, s) => { const b = strich(); SB.filtern(b, m, { schaerfe: s }); return px(b, 60, 20)[0]; };
  const papier = (m, s) => { const b = strich(); SB.filtern(b, m, { schaerfe: s }); return px(b, 10, 20)[0]; };
  ok('Schärfe 40 macht einen blassen Strich im Filter „Dokument" deutlich dunkler (Kern ' + kern('dokument', 0) + ' → ' + kern('dokument', 40) + ')', kern('dokument', 40) < kern('dokument', 0) - 20);
  ok('Schärfe lässt das Papier weiß (Dokument)', papier('dokument', 40) > 245);
  ok('Schärfe 0 ändert nichts (Dokument, Pixel gleich ohne Option)', (() => { const a1 = strich(), a2 = strich(); SB.filtern(a1, 'dokument', { schaerfe: 0 }); SB.filtern(a2, 'dokument'); return a1.data.every((v, i) => v === a2.data[i]); })());
  ok('Schärfe wirkt auch im Filter „Original" (Kern dunkler, Farbe bleibt grau)', (() => { const b = strich(); SB.filtern(b, 'original', { schaerfe: 60 }); const p = px(b, 60, 20); return p[0] < px(strich(), 60, 20)[0] - 5 && p[0] === p[1] && p[1] === p[2]; })());
  ok('Schwarzweiß hat weiche Kanten: neben dem Strich ein Zwischenton statt Treppe', (() => { const b = strich(); SB.filtern(b, 'sw', { schaerfe: 0 }); const v = px(b, 59, 20)[0]; return v > 10 && v < 245; })());
  ok('Schwarzweiß: Schärfe macht die Kante steiler (Zwischenton dunkler)', (() => { const z = s => { const b = strich(); SB.filtern(b, 'sw', { schaerfe: s }); return px(b, 59, 20)[0]; }; return z(40) < z(0) - 20; })());
  const bunt = bild(200, 200, (x, y) => { const papier = 250 - x * 0.55; return (x > 80 && x < 120 && y > 20 && y < 60) ? [papier * 0.8, papier * 0.3, papier * 0.3] : [papier, papier * 0.98, papier * 0.94]; });
  SB.filtern(bunt, 'farbe');
  const rotF = px(bunt, 100, 40);
  ok('Filter „Farbe": Schatten weg (Papier rechts > 235), ein roter Stempel bleibt rot', px(bunt, 190, 180)[0] > 235 && rotF[0] > rotF[1] + 60, [px(bunt, 190, 180), rotF]);
  const f = SB.textFarben(seite(), { x: 20, y: 90, w: 100, h: 20 });
  ok('textFarben: Papier hell, Schrift dunkel gemessen', f.grund[0] > 180 && f.schrift[0] < 80, f);
}

/* ---------- A2 · Bild mit ChatGPT (Klaus 2026-09-27) ---------- */
console.log('Scannen — A2 · Auftrag an ChatGPT (ohne Browser)');
{
  // Der einfachere Weg: ein fertiges BILD von ChatGPT (Klaus 2026-09-27, „mach's nicht zu kompliziert")
  const bU = SB.bildAuftrag({ nach: 'en' }), bR = SB.bildAuftrag({ nach: 'ru' });
  ok('Bild-Auftrag: kurz, wie Klaus ihn schreibt — Text extrahieren, übersetzen, an derselben Stelle einfügen, Bild zurück', /Extrahiere den Text/.test(bU) && /auf Englisch/.test(bU) && /derselben Stelle/.test(bU) && /fertige Bild/.test(bU) && /Bildqualität/.test(bU) && /hoher Auflösung/.test(bU) && bU.length < 450 && !/JSON|zeilen/.test(bU), bU);
  ok('Bild-Auftrag: die Sprache kommt aus der Wahl', /auf Russisch/.test(bR) && Object.keys(SB.BILD_SPRACHEN).length >= 3);
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
// Lage der Lupe gegen das Bild und den gezogenen Punkt (läuft im Browser)
const lupeMass = () => {
  const l = document.querySelector('.scan [data-lupe]'), r = document.querySelector('.scan [data-rahmen]'), g = document.querySelector('.scan .scan-griff[data-zieht]');
  if (!l || !r) return null;
  const a = l.getBoundingClientRect(), b = r.getBoundingClientRect();
  let deckt = null;
  if (g) { const q = g.getBoundingClientRect(), x = q.left + q.width / 2, y = q.top + q.height / 2; deckt = x > a.left - 18 && x < a.right + 18 && y > a.top - 18 && y < a.bottom + 18; }
  return { sichtbar: !l.hidden && a.width > 0, gezogen: !!g, lupe: [Math.round(a.left - b.left), Math.round(a.top - b.top), Math.round(a.width), Math.round(a.height)], bild: [Math.round(b.width), Math.round(b.height)], deckt };
};
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
  const FM = await page.evaluate(() => ({ opt: [...document.querySelectorAll('.scan [data-format] option')].map(o => o.value), wahl: document.querySelector('.scan [data-format]').value, ist: (document.querySelector('.scan [data-format-ist]') || {}).dataset }));
  ok('Seitengröße: Automatisch · Original · A4 · A5 · A6 · US Letter (Klaus 2026-09-27)', FM.opt.join() === 'auto,blatt,a4,a5,a6,letter', FM.opt);
  ok('… Automatisch ist vorgewählt und sagt, was es gewählt hat (→ A4)', FM.wahl === 'auto' && FM.ist && FM.ist.formatIst === 'a4', FM);

  // Ecke ziehen → von Hand gesetzt; ↺ Automatisch holt die Erkennung zurück
  const g0 = await page.locator('.scan .scan-griff').first().boundingBox();
  await page.mouse.move(g0.x + g0.width / 2, g0.y + g0.height / 2); await page.mouse.down();
  await page.mouse.move(g0.x + 40, g0.y + 30, { steps: 5 });
  ok('beim Ziehen erscheint die Lupe', await page.isVisible('.scan [data-lupe]'));
  // Klaus 2026-09-27: „nur der Punkt, sodass man den Rest noch sehen kann" — vorher 431×574 = das GANZE Bild
  const LU = await page.evaluate(lupeMass);
  ok('Lupe ist klein (≤ 90 px, ≤ 25 % der Bildbreite) — der Rest des Fotos bleibt zu sehen', LU && LU.lupe[2] <= 90 && LU.lupe[2] <= LU.bild[0] * 0.25, LU);
  ok('… und liegt NICHT über dem Punkt, den der Finger gerade setzt', LU && LU.gezogen && LU.deckt === false, LU);
  await page.mouse.up();
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Ecke gezogen → Seite gilt als „von Hand gesetzt", die Ecke hat sich bewegt', Z.seiten[0].manuell && SB.abstand(Z.seiten[0].ecken, mach.ecken, f0[0], f0[1]) > 1 && await page.getAttribute('.scan [data-befund]', 'data-befund') === 'hand');
  ok('von Hand gesetzt: kein Befund-Text (die Punkte sagen es, Klaus 2026-09-27)', await page.evaluate(() => { const b = document.querySelector('.scan [data-befund]'); return b.hidden && b.getBoundingClientRect().height === 0; }));
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
  // Schärfe-Regler: Vorgabe 40, ein Zug ändert die Seite und das Ergebnisbild
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Regler „🔪 Schärfe" steht da, Vorgabe 40', await page.isVisible('.scan [data-schaerfe]') && Z.seiten[0].schaerfe === 40, Z.seiten[0].schaerfe);
  const ergVor = await page.evaluate(() => document.querySelector('.scan [data-ergebnis]').src);
  await page.evaluate(() => { const r = document.querySelector('.scan [data-schaerfe]'); r.value = '90'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Schärfe 90 wird übernommen und das Ergebnisbild neu gerechnet', Z.seiten[0].schaerfe === 90 && await page.evaluate(v => document.querySelector('.scan [data-ergebnis]').src !== v, ergVor));
  const vs = await page.evaluate(() => { const i = document.querySelector('.scan [data-ergebnis]'); const soll = Math.min(150, Math.max(80, Math.round(innerWidth * devicePixelRatio / 8.27 / 10) * 10)); return { ist: Math.round(i.naturalWidth / 8.27), soll }; });
  ok('Vorschau so fein wie der Schirm (hier über 80 dpi, höchstens 150)', vs.soll > 80 && Math.abs(vs.ist - vs.soll) <= 6, vs);
  await page.evaluate(() => { const r = document.querySelector('.scan [data-schaerfe]'); r.value = '40'; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); });
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

  /* D · Original und Kopie nebeneinander, Zeilen einstellen (Klaus 2026-09-27) */
  await page.click('#btnScan'); await page.waitForSelector('.scan [data-galerie]');
  const gal = await page.evaluate(() => { const k = document.querySelector('.scan-leer [data-galerie]'), cs = getComputedStyle(k); return [cs.color, cs.backgroundColor]; });
  ok('leeres Werkzeug: „Aus der Galerie" ist lesbar (Schrift ≠ Grund)', gal[0] !== gal[1] && gal[0] !== 'rgb(255, 255, 255)', gal);
  const zwei = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 1100; c.height = 700; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 1100, 700); x.fillStyle = '#111'; x.font = '40px Arial'; x.fillText('Honig gegen Regen', 80, 200); x.fillText('Zucker und Mehl', 80, 248); x.fillText('Butter backen', 80, 296); return c.toDataURL('image/png'); });
  const zweiF = path.join(TMP, 'Zwei Zeilen.png'); fs.writeFileSync(zweiF, Buffer.from(zwei.split(',')[1], 'base64'));
  await page.setInputFiles('.scan [data-in-galerie]', zweiF);
  await page.waitForFunction(() => window.__wfpdfScan.seiten[0] && window.__wfpdfScan.seiten[0].erkennung, null, { timeout: 60000 });
  await page.evaluate(() => { const st = WFP.Scanner.zustand(), s = st.seiten[0]; s.manuell = true; s.ecken = WFP.ScanBild.ganz(s.foto.width, s.foto.height); s.filter = 'original'; st.format = 'blatt'; st.ansicht = 'ergebnis'; WFP.Scanner.zeichne(); });
  await page.click('.scan [data-kopie]');
  // erst auf die Erkennung warten (die dauert), dann kurz auf die Kopie: fehlt sie, wird es GEMELDET statt gewartet
  await page.waitForFunction(() => window.__wfpdfScan.seiten[0].ocr > 0, null, { timeout: 180000 });
  await page.waitForSelector('.scan [data-tafel="kopie"] [data-zeile]', { timeout: 5000 }).catch(() => {});
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('„📄 Kopie neben Original": erkennt den Text und zeigt beide nebeneinander', Z.vergleich === 'neben' && Z.seiten[0].ocr >= 3 && await page.isVisible('.scan [data-tafel="original"] img') && await page.isVisible('.scan [data-tafel="kopie"] img'), Z.seiten[0].ocr);
  const lage = await page.evaluate(() => { const s = WFP.Scanner.zustand().seiten[0]; return s.ocr.zeilen.map(z => ({ t: z.text, base: !!z.base, rh: z.rh })); });
  ok('jede Zeile trägt ihre Grundlinie und Schrifthöhe (nicht nur den Rahmen)', lage.length >= 3 && lage.every(z => z.base && z.rh > 0), lage);
  const kopieOk = await page.evaluate(() => { const i = document.querySelector('.scan [data-tafel="kopie"] img'); return !!i && i.naturalWidth > 0; });
  ok('die Kopie ist ein eigenes Bild neben dem Original', kopieOk);

  // Unterlängen bleiben: erst alle Deckflächen, dann alle Texte (Klaus: „150 q Butter")
  const unterl = await page.evaluate(() => {
    const s = WFP.Scanner.zustand().seiten[0], SBk = WFP.ScanBild;
    s.aenderungen = { 0: 'gggg gggg gggg', 1: 'xxxx xxxx' }; s.stil = { 0: { ausr: 'l', gr: 2.5, dx: 0, dy: 0 } };
    const c = WFP.Scanner.seiteRechnen(s, 150, true).canvas, W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const l0 = SBk.zeilenLage(s.ocr.zeilen[0], W, H), l1 = SBk.zeilenLage(s.ocr.zeilen[1], W, H), band1 = SBk.zeilenBand(l1);
    const oben = Math.min(...band1.map(p => p[1])), unten = l0.y + l0.tief * 2.5;
    let dunkel = 0;
    for (let y = Math.ceil(oben); y < unten; y++) for (let x = Math.round(l0.x); x < Math.round(l0.x + l0.laenge * 0.8); x++) { const o = (y * W + x) * 4; if (d[o] < 90) dunkel++; }
    return { zone: unten - oben, dunkel };
  });
  ok('(Selbst-Riegel) die vergrößerte Zeile ragt in das Band der nächsten — sonst misst die Zeile darunter nichts', unterl.zone > 2, unterl);
  ok('Unterlängen der vorigen Zeile werden vom Band der nächsten NICHT gelöscht', unterl.dunkel > 20, unterl);

  // Zeile einstellen und Ziehen brauchen die Kopie-Tafel. Fehlt sie, ist das oben schon ROT —
  // dann wird dieser Teil GEMELDET übersprungen, statt 30 s auf einen Knopf zu warten, den es nicht gibt.
  const hatKopie = !!(await page.$('.scan [data-tafel="kopie"] [data-zeile="1"]'));
  if (!hatKopie) ok('Zeile einstellen und Ziehen: übersprungen, weil die Kopie-Tafel fehlt', false);
  else {
  // Zeile einstellen: rechtsbündig und größer, im Dialog
  await page.evaluate(() => { const s = WFP.Scanner.zustand().seiten[0]; s.aenderungen = {}; s.stil = {}; WFP.Scanner.zeichne(); });
  await page.click('.scan [data-tafel="kopie"] [data-zeile="1"]');
  await page.click('.dlg [data-ausr="r"]'); await page.click('.dlg [data-gr="1"]'); await page.click('.dlg [data-gr="1"]');
  await page.click('.dlg [data-j]');
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Zeile einstellen: rechtsbündig und 120 % gemerkt', Z.seiten[0].stil[1] && Z.seiten[0].stil[1].ausr === 'r' && Math.abs(Z.seiten[0].stil[1].gr - 1.2) < 1e-9, Z.seiten[0].stil);
  const rechts = await page.evaluate(() => {
    const s = WFP.Scanner.zustand().seiten[0], c = WFP.Scanner.kopieRechnen(s, 100).canvas, W = c.width, H = c.height, d = c.getContext('2d').getImageData(0, 0, W, H).data;
    const l = WFP.ScanBild.zeilenLage(s.ocr.zeilen[1], W, H); let maxX = 0, minX = W;
    for (let y = Math.round(l.mitte - l.rh); y < l.mitte + 2; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; if (d[o] < 90) { maxX = Math.max(maxX, x); minX = Math.min(minX, x); } }
    return { maxX, minX, W, x0: l.x };
  });
  ok('in der Kopie steht die Zeile jetzt am rechten Rand, nicht mehr links', rechts.maxX > rechts.W * 0.9 && rechts.minX > rechts.x0 + 20, rechts);

  // Ziehen in der Kopie verschiebt die Zeile
  const kz = await page.$('.scan [data-tafel="kopie"] [data-zeile="2"]'), kb = await kz.boundingBox();
  await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2); await page.mouse.down();
  await page.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2 + 40, { steps: 5 }); await page.mouse.up();
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('Ziehen in der Kopie verschiebt die Zeile nach unten (ohne Dialog)', Z.seiten[0].stil[2] && Z.seiten[0].stil[2].dy > 0.02 && !(await page.$('.dlg')), Z.seiten[0].stil);

  }

  // Ins PDF kommt die Kopie: echter Text, kein Bild
  await page.click('.scan [data-ausgabe="kopie"]');
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('„Ins PDF kommt: Kopie" gemerkt', Z.seiten[0].ausgabe === 'kopie');
  const kpdf = await page.evaluate(async () => {
    const b = await WFP.Scanner.pdfBauen(); const pdf = await pdfjsLib.getDocument({ data: b.slice(0) }).promise; const pg = await pdf.getPage(1);
    const tc = await pg.getTextContent(), ops = await pg.getOperatorList(); pdf.destroy();
    return { txt: tc.items.map(i => i.str).join(' '), bilder: ops.fnArray.filter(f => f === pdfjsLib.OPS.paintImageXObject || f === pdfjsLib.OPS.paintJpegXObject).length, bytes: b.length };
  });
  ok('PDF aus der Kopie: der Text steht als echter Text drin, KEIN Bild auf der Seite', /Zucker/.test(kpdf.txt) && /Honig/.test(kpdf.txt) && kpdf.bilder === 0, kpdf);

  // Kopie stimmt nicht → Seite neu fotografieren ersetzt DIESE Seite
  const [neu] = await Promise.all([page.waitForEvent('filechooser'), page.click('.scan [data-neufoto]')]);
  const neuF = path.join(TMP, 'Neu.png'); fs.copyFileSync(zweiF, neuF);
  await neu.setFiles(neuF);
  // gewartet wird darauf, dass das neue Foto IRGENDWO angekommen ist — ob es ersetzt oder anhängt, misst die Zeile darunter
  await page.waitForFunction(() => window.__wfpdfScan.seiten.some(s => s.name === 'Neu.png' && s.erkennung), null, { timeout: 60000 });
  Z = await page.evaluate(() => window.__wfpdfScan);
  ok('„📷 Seite neu fotografieren" ersetzt die Seite, statt eine anzuhängen', Z.seiten.length === 1 && Z.seiten[0].name === 'Neu.png' && Z.seiten[0].ocr === null, Z.seiten.map(s => s.name));

  // 🎨 Mit ChatGPT übersetzen: EIN Knopf hin, EIN Knopf zurück (Klaus 2026-09-27, „mach's nicht zu kompliziert")
  await page.evaluate(() => { const st = WFP.Scanner.zustand(), s = st.seiten[0]; s.manuell = true; s.ecken = WFP.ScanBild.ganz(s.foto.width, s.foto.height); s.filter = 'original'; st.format = 'blatt'; st.ansicht = 'ergebnis'; st.vergleich = 'original'; WFP.Scanner.zeichne(); });
  const kiK = await page.evaluate(() => { const b = document.querySelector('.scan [data-bildki]'); if (!b) return null; const cs = getComputedStyle(b); return { cls: b.className, anim: cs.animationName, bild: cs.backgroundImage, text: b.textContent, textweg: !!document.querySelector('.scan [data-ki]') }; });
  ok('ChatGPT-Knopf: Bauart wie im Rezeptbuch — wandernder Verlauf in Rot und Blau, kein Roboterkopf', kiK && /ki-knopf/.test(kiK.cls) && /kiWandern/.test(kiK.anim) && /224, 35, 27/.test(kiK.bild) && /29, 78, 216/.test(kiK.bild) && !/🤖/.test(kiK.text), kiK);
  ok('Nur ein Weg zu ChatGPT: kein zweiter Knopf mit Textliste', kiK && !kiK.textweg, kiK);
  await page.selectOption('.scan [data-bildnach]', 'ru');
  // Teilen im Browser nachstellen: Android gibt Bild + Text an die gewählte App
  await page.evaluate(() => { navigator.canShare = () => true; navigator.share = d => { window.__geteilt = { dateien: d.files.map(f => [f.name, f.type, f.size]), text: d.text }; return Promise.resolve(); }; });
  await page.waitForFunction(() => { const s = WFP.Scanner.zustand().seiten[0]; return s._kiBild && s._kiBild.datei; }, null, { timeout: 30000 }).catch(() => {});
  await page.click('.scan [data-bildki]', { force: true });   // hüpft beim Zeigen (Rezeptbuch-Bauart) — nie „stabil"
  await page.waitForFunction(() => window.__geteilt, null, { timeout: 10000 }).catch(() => {});
  const TEIL = await page.evaluate(() => ({ g: window.__geteilt || null, ki: window.__wfpdfBildKi || null, dlg: !!document.querySelector('.dlg') }));
  ok('Ein Tipp teilt Seitenbild (JPEG) UND Auftrag, ohne Dialog dazwischen', TEIL.g && TEIL.g.dateien.length === 1 && TEIL.g.dateien[0][1] === 'image/jpeg' && TEIL.g.dateien[0][2] > 1000 && /Extrahiere den Text/.test(TEIL.g.text) && !TEIL.dlg, TEIL);
  ok('Der Auftrag nennt die gewählte Sprache (Russisch)', TEIL.g && /auf Russisch/.test(TEIL.g.text), TEIL.g && TEIL.g.text);
  // Ohne Teilen (Rechner): Bild speichern, Auftrag in die Zwischenablage, ChatGPT öffnen
  await page.evaluate(() => { navigator.canShare = () => false; window.__geoeffnet = []; window.open = u => { window.__geoeffnet.push(u); return null; }; window.__wfpdfBildKi = null; });
  await page.click('.scan [data-bildki]', { force: true });
  await page.waitForFunction(() => window.__wfpdfBildKi && window.__wfpdfBildKi.weg, null, { timeout: 10000 }).catch(() => {});
  const OHNE = await page.evaluate(() => ({ weg: window.__wfpdfBildKi && window.__wfpdfBildKi.weg, auf: window.__geoeffnet }));
  ok('Ohne Teilen: Bild wird gespeichert und ChatGPT geöffnet', OHNE.weg === 'speichern' && OHNE.auf.length === 1 && /chatgpt\.com/.test(OHNE.auf[0]), OHNE);
  // ein GROSSES Bild wie von ChatGPT (2200 px): nur daran ist zu sehen, ob das PDF es herunterrechnet
  const kiGross = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 2200; c.height = 1500; const x = c.getContext('2d'); x.fillStyle = '#fff5c0'; x.fillRect(0, 0, 2200, 1500); x.fillStyle = '#111'; x.font = 'bold 80px Arial'; x.fillText('Further information', 300, 400); x.fillText('Have a pleasant stay', 300, 700); return c.toDataURL('image/png'); });
  const kiF = path.join(TMP, 'ChatGPT-Bild.png'); fs.writeFileSync(kiF, Buffer.from(kiGross.split(',')[1], 'base64'));
  // eine zweite Seite dahinter: nur dann unterscheidet sich „dahinter“ von „ans Ende“
  await page.evaluate(() => { const st = WFP.Scanner.zustand(); st.seiten.push(Object.assign({}, st.seiten[0], { id: 'zweite', name: 'Zweite Seite' })); st.akt = 0; st.ansicht = 'ergebnis'; WFP.Scanner.zeichne(); });
  const vor = await page.evaluate(() => window.__wfpdfScan.seiten.map(s => s.name));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('.scan [data-bildholen]')]);
  await fc.setFiles(kiF);
  await page.waitForFunction(() => window.__wfpdfScan.seiten.some(s => s.kiBild), null, { timeout: 30000 }).catch(() => {});
  const BZ = await page.evaluate(() => window.__wfpdfScan);
  const kb = BZ.seiten.find(s => s.kiBild);
  ok('„📥 Ergebnis zurückholen": das Bild kommt als Seite dahinter, das Original bleibt davor', BZ.seiten.length === 3 && BZ.seiten[0].name === vor[0] && BZ.seiten[1] && BZ.seiten[1].kiBild && BZ.seiten[2].name === 'Zweite Seite' && BZ.akt === 1, BZ.seiten.map(s => [s.name, s.kiBild]));
  ok('Das Bild von ChatGPT IST die Seite: ganzes Bild, kein Filter, kein Zuschnitt-Zweifel', kb && kb.filter === 'original' && kb.manuell && kb.erkennung && kb.erkennung.sicher && kb.ecken[2][0] === kb.foto[0] && kb.ecken[2][1] === kb.foto[1], kb);
  // Klaus 2026-09-27: „dann lädt er es nicht in das PWA Workflow PDF … Ich muss erst wieder eine Datei importieren."
  // Herunterladen legt das PDF AUCH in der Bibliothek ab — und ein zweites Mal ersetzt es, statt zu verdoppeln.
  ok('Im Fuß steht, dass Herunterladen auch hier ablegt', await page.isVisible('.scan [data-ablegen-hinweis]'));
  const docsVor = await page.evaluate(() => WFP.DB.all('docs').then(a => a.length));
  const [dl1] = await Promise.all([page.waitForEvent('download'), page.click('.scan [data-laden]')]);
  await page.waitForFunction(() => window.__wfpdfScanAbgelegt, null, { timeout: 30000 }).catch(() => {});
  const AB1 = await page.evaluate(async () => { const id = window.__wfpdfScanAbgelegt, d = id && await WFP.DB.get('docs', id); return { id, n: (await WFP.DB.all('docs')).length, seiten: d && d.pages.length, datei: !!(id && await WFP.DB.getFile(id)), offen: !!document.querySelector('.scan') }; });
  const DPI = await page.evaluate(() => ({ seiten: window.__wfpdfScanDpi || [], foto: (() => { const s = WFP.Scanner.zustand().seiten.find(x => x.kiBild); return s ? Math.max(s.foto.width, s.foto.height) : 0; })() }));
  const kiD = DPI.seiten.find(x => x.ki), orD = DPI.seiten.find(x => !x.ki);
  ok('(Selbst-Riegel) das ChatGPT-Bild ist wirklich groß (2200 px) — sonst misst die Zeile darunter nichts', DPI.foto === 2200, DPI);
  ok('Das ChatGPT-Bild kommt in SEINER Auflösung ins PDF (nicht auf 150 dpi heruntergerechnet)', kiD && orD && kiD.dpi > orD.dpi && kiD.px >= 2090, DPI);
  ok('„⬇ PDF herunterladen" lädt herunter UND legt das PDF in Workfloh PDF ab (alle 3 Seiten, Werkzeug bleibt offen)', !!dl1 && AB1.id && AB1.n === docsVor + 1 && AB1.seiten === 3 && AB1.datei && AB1.offen, { docsVor, AB1 });
  await Promise.all([page.waitForEvent('download'), page.click('.scan [data-laden]')]);
  await page.waitForFunction(() => window.__wfpdfScanAblagen >= 2, null, { timeout: 30000 }).catch(() => {});
  const AB2 = await page.evaluate(async () => ({ id: window.__wfpdfScanAbgelegt, mal: window.__wfpdfScanAblagen, n: (await WFP.DB.all('docs')).length }));
  ok('… ein zweites Herunterladen ersetzt dasselbe Dokument, statt ein zweites anzulegen', AB2.mal >= 2 && AB2.id === AB1.id && AB2.n === AB1.n, AB2);
  await page.evaluate(() => { const st = WFP.Scanner.zustand(); st.seiten.splice(1, 2); st.akt = 0; st.ansicht = 'ergebnis'; WFP.Scanner.zeichne(); });
  await page.evaluate(() => WFP.Scanner.ocrSeite(WFP.Scanner.zustand().seiten[0]).then(() => WFP.Scanner.zeichne()));
  // Textmaske: nur die Schrift, durchsichtiger Grund
  const mk = await page.evaluate(() => {
    const s = WFP.Scanner.zustand().seiten[0], m = WFP.Scanner.kopieRechnen(s, 100, true).canvas, k = WFP.Scanner.kopieRechnen(s, 100).canvas;
    const d = m.getContext('2d').getImageData(0, 0, m.width, m.height).data; let leer = 0, tinte = 0;
    for (let i = 3; i < d.length; i += 4) { if (d[i] === 0) leer++; else if (d[i] > 200 && d[i - 3] < 90) tinte++; }
    return { ecke: d[3], leerAnteil: leer / (d.length / 4), tinte, kopieEcke: k.getContext('2d').getImageData(0, 0, 1, 1).data[3] };
  });
  ok('Textmaske ist durchsichtig (Ecke Alpha 0, fast alles leer) und trägt Schrift', mk.ecke === 0 && mk.leerAnteil > 0.9 && mk.tinte > 100 && mk.kopieEcke === 255, mk);
  await page.click('.scan [data-maske]');
  await page.waitForFunction(() => window.__wfpdfMaske, null, { timeout: 15000 }).catch(() => {});
  const mD = await page.evaluate(() => window.__wfpdfMaske || null);
  ok('„🎭 Textmaske" legt eine PNG-Datei ab', mD && /Textmaske Seite 1\.png$/.test(mD.name) && mD.bytes > 500, mD);
  // „✓ PDF erstellen" nach dem Herunterladen: dasselbe Dokument, jetzt mit einer Seite, und es geht auf
  await page.click('.scan [data-fertig]');
  await page.waitForSelector('#sc-ed.on .seite canvas', { timeout: 60000 }).catch(() => {});
  const AB3 = await page.evaluate(async () => ({ id: window.__wfpdf.S.doc && window.__wfpdf.S.doc.id, seiten: window.__wfpdf.S.doc && window.__wfpdf.S.doc.pages.length, n: (await WFP.DB.all('docs')).length }));
  ok('„✓ PDF erstellen" nach dem Herunterladen öffnet DASSELBE Dokument, neu gefüllt — kein Doppel', AB3.id === AB1.id && AB3.n === AB1.n && AB3.seiten === 1, AB3);

  /* ---------- Handy: Platz für das Foto, alle Ecken greifbar, kleine Lupe ---------- */
  const hp = await (await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true })).newPage();
  hp.on('pageerror', e => konsole.push('Handy: ' + e));
  await hp.goto(URL0);
  await hp.waitForFunction(() => window.__wfpdf && window.WFP && WFP.Scanner);
  await hp.click('#btnScan');
  await hp.setInputFiles('.scan [data-in-galerie]', foto1);
  await hp.waitForSelector('.scan .scan-griff', { timeout: 60000 });
  const HM = await hp.evaluate(() => {
    const r = document.querySelector('.scan [data-rahmen]').getBoundingClientRect();
    const griffe = [...document.querySelectorAll('.scan .scan-griff')].map(g => { const b = g.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === g; });
    return { hoehe: Math.round(r.height), schirm: innerHeight, griffe };
  });
  ok('Handy 360×740: das Foto bekommt mindestens ein Drittel der Höhe (vorher 156 px)', HM.hoehe >= HM.schirm / 3, HM);
  ok('Handy: alle vier Ecken sind zu greifen — keine liegt unter der Kopfleiste', HM.griffe.length === 4 && HM.griffe.every(Boolean), HM);
  // Klaus 2026-09-27: Reiter und Befund schmal — dieselben Maße stehen in beiden WorkFlohs (scanner.css)
  const HT = await hp.evaluate(() => { const t = document.querySelector('.scan-tabs .modus-k'), bf = document.querySelector('.scan-befund');
    return { tab: Math.round(t.getBoundingClientRect().height), befund: bf ? Math.round(bf.getBoundingClientRect().height) : 0 }; });
  ok('Handy: Reiter Zuschneiden/Ergebnis höchstens 30 px hoch', HT.tab <= 30, HT);
  ok('Handy: der Befund („Ecken …") höchstens 48 px hoch', HT.befund > 0 && HT.befund <= 48, HT);
  // Klaus 2026-09-27: Schließen nur als ✕, der Kopf einzeilig, kein Erklärtext zu den Punkten
  const HK = await hp.evaluate(() => { const z = document.querySelector('.scan [data-schliessen]'), k = document.querySelector('.scan-kopf'), t = document.querySelector('.scan-titel');
    return { zu: z.textContent.trim(), label: z.getAttribute('aria-label'), kopf: Math.round(k.getBoundingClientRect().height), titel: Math.round(t.getBoundingClientRect().height), erklaer: /roten Punkte|Lupe zeigt/.test(document.querySelector('.scan').textContent) }; });
  ok('Handy: Schließen ist nur ein ✕ (mit Namen für Vorleser)', HK.zu === '✕' && HK.label === 'Schließen', HK);
  ok('Handy: der Scanner-Kopf ist einzeilig (höchstens 56 px, Titel bricht nicht um)', HK.kopf <= 56 && HK.titel <= 30, HK);
  ok('Handy: kein Erklärtext zu den roten Punkten und der Lupe', !HK.erklaer, HK);
  const hg = await hp.locator('.scan .scan-griff').nth(2).boundingBox();
  await hp.mouse.move(hg.x + hg.width / 2, hg.y + hg.height / 2); await hp.mouse.down();
  await hp.mouse.move(hg.x + hg.width / 2 - 20, hg.y + hg.height / 2 - 15, { steps: 4 });
  const HL = await hp.evaluate(lupeMass);
  await hp.mouse.up();
  ok('Handy: Lupe sichtbar, ≤ 64 px, deckt den Punkt nicht', HL && HL.sichtbar && HL.gezogen && HL.lupe[2] <= 64 && HL.deckt === false, HL);
  await hp.context().close();

  /* ---------- Vollbild quer (Klaus 2026-09-27: „nutzt den Platz für das Bild nicht optimal aus") ---------- */
  const gp = await (await browser.newContext({ viewport: { width: 1000, height: 540 } })).newPage();
  gp.on('pageerror', e => konsole.push('Vollbild: ' + e));
  await gp.goto(URL0);
  await gp.waitForFunction(() => window.__wfpdf && window.WFP && WFP.Scanner);
  await gp.click('#btnScan');
  await gp.setInputFiles('.scan [data-in-galerie]', foto1);
  await gp.waitForSelector('.scan .scan-griff', { timeout: 60000 });
  const GM = await gp.evaluate(() => { const b = document.querySelector('.scan-buehne').getBoundingClientRect(), r = document.querySelector('.scan [data-rahmen]').getBoundingClientRect(), l = document.querySelector('.scan-leiste').getBoundingClientRect(), f = document.querySelector('.scan-fuss').getBoundingClientRect();
    return { buehne: Math.round(b.height), bild: Math.round(Math.max(r.width, r.height)), schirm: innerHeight, leisteRechts: l.left >= b.right - 1, fussRechts: f.left >= b.right - 1, leiste: Math.round(l.height) }; });
  ok('Vollbild 1000×540: die Bühne nimmt mindestens 80 % der Höhe (vorher 151 px)', GM.buehne >= GM.schirm * 0.8, GM);
  ok('Vollbild: das Foto füllt die Bühne (auch ein kleines Foto wird größer gezeigt)', GM.bild >= GM.buehne - 60, GM);
  ok('Vollbild: Seitenleiste und Fuß stehen rechts neben dem Foto, nicht darunter', GM.leisteRechts && GM.fussRechts && GM.leiste >= 60, GM);
  // Klaus 2026-09-27: „immer das Maximum" — Fenster größer gezogen (DeX), das Foto wächst mit
  await gp.setViewportSize({ width: 1600, height: 1000 });
  const GW = await gp.waitForFunction(() => { const b = document.querySelector('.scan-buehne').getBoundingClientRect(), r = document.querySelector('.scan [data-rahmen]').getBoundingClientRect();
    return r.height >= b.height - 60 || r.width >= b.width - 60 ? { buehne: Math.round(b.height), bild: Math.round(Math.max(r.width, r.height)) } : null; }, null, { timeout: 5000 }).then(h => h.jsonValue()).catch(() => null);
  ok('Vollbild: Fenster größer gezogen → das Foto füllt wieder die Bühne', !!GW && GW.bild > GM.bild, { vorher: GM.bild, nachher: GW });
  await gp.context().close();

  ok('kein Aufruf ins Netz (Modell, Texterkennung, Schrift liegen auf dem Gerät)', fremd.length === 0, fremd);
  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
