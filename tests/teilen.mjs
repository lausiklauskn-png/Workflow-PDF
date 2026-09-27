/* Workfloh PDF — Teilen, Mehrfachauswahl, Ziehen auf einen Ordner (Klaus 2026-09-27).
   „sodass man am schnellsten von einem Ort zum Teilen kommt, wenn man fertig ist" ·
   „durch ein dauerhaftes Klick soll ein kleines Kästchen oben angehen … Klick, Klick, Klick,
   wie bei Bilderauswahl … auch mit ziehen sollen gleich mehrere selektiert werden" ·
   „fest andrücken und ziehen" auf einen Ordner. Nur erfundene Daten.
   Teilen gibt es headless nicht — navigator.share/canShare sind gestellt und schreiben mit,
   was hinausgegangen wäre. Ob Android es so annimmt: am Tablet, nicht hier. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

async function blatt(titel) {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  const s = pdf.addPage([595.28, 841.89]); s.drawText(titel, { x: 60, y: 760, size: 14, font: f });
  return pdf.save({ useObjectStreams: false });
}
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const NAMEN = ['Musterbrief A', 'Musterbrief B', 'Musterbrief C'];
const DATEIEN = [];
for (const n of NAMEN) DATEIEN.push([n + '.pdf', Buffer.from(await blatt('Erfundener Inhalt ' + n)).toString('base64')]);

const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
// Gestelltes Teilen: 'ja' nimmt an, 'nein' verweigert (Tipp verbraucht), 'weg' = Gerät kann nicht teilen
const STELLEN = () => {
  window.__geteilt = []; window.__teilenLage = 'ja';
  const pdfOk = f => f.type === 'application/pdf';
  Object.defineProperty(navigator, 'canShare', { configurable: true, get: () => window.__teilenLage === 'weg' ? undefined : (d => !!(d && d.files && d.files.every(pdfOk))) });
  navigator.share = async d => {
    if (window.__teilenLage === 'nein') { window.__teilenLage = 'ja'; throw new DOMException('verbraucht', 'NotAllowedError'); }
    const files = [];
    for (const f of d.files) { const b = new Uint8Array(await f.arrayBuffer()); files.push({ name: f.name, type: f.type, pdf: String.fromCharCode(...b.slice(0, 5)), laenge: b.length }); }
    window.__geteilt.push({ title: d.title, files });
  };
};

async function aufbauen(ctx) {
  const page = await ctx.newPage();
  await ctx.addInitScript(STELLEN);
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB);
  return { page, fehler };
}
const karte = (page, n) => page.locator('#dokGitter .dok', { has: page.locator('.dok-name', { hasText: new RegExp('^' + n + '$') }) });
const idVon = (page, n) => page.evaluate(n => window.__wfpdf.S.docs.find(d => d.name === n).id, n);
const geteilt = page => page.evaluate(() => window.__geteilt);

try {
  console.log('Workfloh PDF — Teilen, Auswahl, Ziehen auf einen Ordner');
  // ===== A. Maus, großer Bildschirm =====
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const { page, fehler } = await aufbauen(ctx);
  await page.evaluate(async list => {
    const files = list.map(([n, b64]) => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], n, { type: 'application/pdf' }));
    await window.__wfpdf.importDateien(files, 'Posteingang');
  }, DATEIEN);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 3, null, { timeout: 30000 });
  if (await page.evaluate(() => !!document.querySelector('#sc-ed.on'))) await page.click('#edZurueck');
  await page.waitForSelector('#sc-bib.on');
  await page.evaluate(async () => { const w = window.__wfpdf; const o = { id: 'ziel-o', name: 'Erledigt', createdAt: new Date().toISOString() }; await WFP.DB.put('folders', o); w.S.ordner.push(o); w.S.aktOrdner = 'alle'; w.suche.zeichneBibliothek(); });
  // Ein Dokument bekommt einen Eintrag — dann geht das feste PDF hinaus
  const idB = await idVon(page, 'Musterbrief B');
  await page.evaluate(async id => { const w = window.__wfpdf, d = w.S.docs.find(x => x.id === id); d.fields.push({ id: 'f1', page: 0, type: 'text', label: 'Name', value: 'Erika Beispiel', x: 10, y: 20, w: 40, h: 3 }); await WFP.DB.put('docs', d); w.suche.zeichneBibliothek(); }, idB);

  // A1 — der Knopf in der Kartenleiste
  const leiste = await karte(page, 'Musterbrief A').evaluate(el => [...el.querySelectorAll('.dok-akt button')].map(b => b.textContent.trim()));
  ok('Kartenleiste: ✏️ 🗂️ ⧉ 📤 🗑 — der Teilen-Knopf steht vor dem Mülleimer', JSON.stringify(leiste) === JSON.stringify(['✏️', '🗂️', '⧉', '📤', '🗑']), leiste);
  ok('… und alle fünf passen in eine Reihe (keiner umgebrochen, keiner schmaler als 30 px)', await karte(page, 'Musterbrief A').evaluate(el => { const bs = [...el.querySelectorAll('.dok-akt button')].map(b => b.getBoundingClientRect()); return bs.every(r => r.top === bs[0].top && r.width >= 30); }));
  await karte(page, 'Musterbrief A').locator('[data-teilen]').click();
  await page.waitForFunction(() => window.__geteilt.length === 1, null, { timeout: 15000 }).catch(() => {});
  let g = await geteilt(page);
  ok('📤 an der Karte teilt DIREKT, ohne Umweg über einen Dialog', g.length === 1 && !(await page.$('.dlg')), g);
  ok('… genau eine PDF-Datei, benannt wie das Dokument', g[0] && g[0].files.length === 1 && g[0].files[0].name === 'Musterbrief A.pdf' && g[0].files[0].type === 'application/pdf' && g[0].files[0].pdf === '%PDF-', g[0]);
  ok('… ohne Einträge geht das Original hinaus (unverändert)', await page.evaluate(() => window.__wfpdfTeilen.dateien[0].m === 'original'));
  ok('… und die Bibliothek bleibt stehen (nichts wird geöffnet)', await page.evaluate(() => document.querySelector('#sc-bib.on') && !document.querySelector('#sc-ed.on')));
  await karte(page, 'Musterbrief B').locator('[data-teilen]').click();
  await page.waitForFunction(() => window.__geteilt.length === 2, null, { timeout: 15000 }).catch(() => {});
  ok('mit Einträgen geht das FESTE PDF hinaus (Einträge auf der Seite)', await page.evaluate(() => window.__wfpdfTeilen.dateien[0].m === 'fest' && window.__geteilt[1].files[0].name === 'Musterbrief B.pdf'));

  // A2 — verweigert (Tipp verbraucht) → „Jetzt teilen" mit frischem Tipp
  await page.evaluate(() => { window.__teilenLage = 'nein'; });
  await karte(page, 'Musterbrief C').locator('[data-teilen]').click();
  const jetzt = await page.waitForSelector('.dlg [data-teilen-jetzt]', { timeout: 15000 }).then(() => true, () => false);
  ok('verweigert Android das Teilen, steht „📤 Jetzt teilen …" da', jetzt);
  if (jetzt) { await page.click('.dlg [data-teilen-jetzt]'); await page.waitForFunction(() => window.__geteilt.length === 3, null, { timeout: 8000 }).catch(() => {}); }
  ok('… und der frische Tipp teilt wirklich', (await geteilt(page)).length === 3 && (await geteilt(page))[2].files[0].name === 'Musterbrief C.pdf');
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(x => x.remove()));

  // A3 — Gerät kann nicht teilen → Herunterladen
  await page.evaluate(() => { window.__teilenLage = 'weg'; });
  await karte(page, 'Musterbrief A').locator('[data-teilen]').click();
  const kann = await page.waitForSelector('.dlg [data-nicht-teilbar]', { timeout: 15000 }).then(() => true, () => false);
  ok('ohne Teilen am Gerät: der Dialog sagt es und bietet Herunterladen', kann && !(await page.$('.dlg [data-teilen-jetzt]')));
  if (kann) { const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.dlg [data-dl]')]); const b = fs.readFileSync(await dl.path()); ok('… und lädt das PDF herunter', b.subarray(0, 5).toString() === '%PDF-'); }
  await page.evaluate(() => { document.querySelectorAll('.dlg-grund').forEach(x => x.remove()); window.__teilenLage = 'ja'; window.__geteilt = []; });

  // A4 — Editor: 📤 neben „PDF ausgeben", teilt den Stand MIT den eben getippten Einträgen
  await karte(page, 'Musterbrief A').locator('.dok-bild').click();
  await page.waitForSelector('#sc-ed.on .seite canvas', { timeout: 30000 });
  ok('Editor: 📤 Teilen steht direkt vor „⬇ PDF ausgeben"', await page.evaluate(() => { const t = document.getElementById('edTeilen'), x = document.getElementById('edExport'); return !!t && t.nextElementSibling === x && getComputedStyle(t).display !== 'none'; }));
  await page.evaluate(() => { const w = window.__wfpdf; w.S.doc.fields.push({ id: 'f9', page: 0, type: 'text', label: 'Ort', value: 'Musterstadt', x: 10, y: 30, w: 40, h: 3 }); });
  await page.click('#edTeilen');
  await page.waitForFunction(() => window.__geteilt.length === 1, null, { timeout: 15000 }).catch(() => {});
  g = await geteilt(page);
  ok('📤 im Editor teilt das offene Dokument direkt', g.length === 1 && g[0].files[0].name === 'Musterbrief A.pdf', g);
  ok('… mit dem Eintrag, der eben erst getippt wurde (festes PDF)', await page.evaluate(() => window.__wfpdfTeilen.dateien[0].m === 'fest'));
  ok('… und der Eintrag ist gespeichert, bevor geteilt wird', await page.evaluate(async id => ((await WFP.DB.get('docs', id)).fields || []).some(f => f.value === 'Musterstadt'), await idVon(page, 'Musterbrief A')));
  await page.click('#edZurueck'); await page.waitForSelector('#sc-bib.on');
  await page.evaluate(() => { window.__geteilt = []; });

  // A5 — Kästchen oben: antippen wählt, weitere Tipps wählen dazu (öffnen NICHT)
  ok('ohne Auswahl ist keine Auswahl-Leiste zu sehen', await page.evaluate(() => document.getElementById('wahlLeiste').hidden));
  await karte(page, 'Musterbrief A').hover();
  await karte(page, 'Musterbrief A').locator('[data-haken]').click();
  ok('Kästchen oben antippen: die Karte ist gewählt, die Leiste zeigt „1 ausgewählt"', await page.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '1' && document.querySelectorAll('#dokGitter .dok.gewaehlt').length === 1));
  await karte(page, 'Musterbrief C').locator('.dok-bild').click();
  ok('danach wählt ein Tipp auf eine Karte dazu, statt sie zu öffnen', await page.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '2' && !document.querySelector('#sc-ed.on')));
  await karte(page, 'Musterbrief C').locator('.dok-bild').click();
  ok('… ein zweiter Tipp nimmt sie wieder heraus', await page.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '1'));
  await page.click('[data-wahl-alle]');
  ok('„Alle" wählt alle sichtbaren', await page.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '3'));
  await page.click('[data-wahl-teilen]');
  await page.waitForFunction(() => window.__geteilt.length === 1, null, { timeout: 20000 }).catch(() => {});
  g = await geteilt(page);
  ok('📤 Teilen in der Leiste gibt ALLE gewählten auf einmal hinaus', g.length === 1 && g[0].files.length === 3 && g[0].files.every(f => f.pdf === '%PDF-'), g);
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(x => x.remove()));
  await page.click('[data-wahl-ende]');
  ok('✕ Fertig hebt die Auswahl auf, die Leiste verschwindet', await page.evaluate(() => document.getElementById('wahlLeiste').hidden && !document.querySelector('#dokGitter .dok.gewaehlt')));
  await karte(page, 'Musterbrief C').locator('.dok-bild').click();
  const offen = await page.waitForSelector('#sc-ed.on', { timeout: 15000 }).then(() => true, () => false);
  ok('… danach öffnet ein Tipp wieder das Dokument', offen);
  if (offen) { await page.click('#edZurueck'); await page.waitForSelector('#sc-bib.on'); }

  // A6 — Mauszug: von A über B auf den Ordner „Erledigt"
  const mitte = async loc => { const r = await loc.boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  const [ax, ay] = await mitte(karte(page, 'Musterbrief A').locator('.dok-bild'));
  const [bx, by] = await mitte(karte(page, 'Musterbrief B').locator('.dok-bild'));
  const [ox, oy] = await mitte(page.locator('.ordner-chip[data-o="ziel-o"]'));
  await page.mouse.move(ax, ay); await page.mouse.down();
  await page.mouse.move(ax + 20, ay + 5, { steps: 3 });
  await page.mouse.move(bx, by, { steps: 8 }); await page.waitForTimeout(400);   // auf B verweilen
  ok('Mauszug: ein Schattenbild folgt der Maus', await page.evaluate(() => !!document.getElementById('ziehGeist')));
  ok('… und die überstrichene Karte kommt dazu (2 gewählt)', await page.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '2'));
  await page.mouse.move(ox, oy, { steps: 8 });
  ok('… der Ordner unter der Maus leuchtet als Ziel', await page.evaluate(() => document.querySelector('.ordner-chip.ziel')?.dataset.o === 'ziel-o'));
  await page.mouse.up();
  await page.waitForFunction(() => window.__wfpdf.S.docs.filter(d => d.folderId === 'ziel-o').length === 2, null, { timeout: 8000 }).catch(() => {});
  const imZiel = await page.evaluate(() => window.__wfpdf.S.docs.filter(d => d.folderId === 'ziel-o').map(d => d.name).sort());
  ok('loslassen auf dem Ordner: beide sind dorthin verschoben', JSON.stringify(imZiel) === JSON.stringify(['Musterbrief A', 'Musterbrief B']), imZiel);
  ok('… auch im Speicher, nicht nur in der Anzeige', await page.evaluate(async () => (await WFP.DB.all('docs')).filter(d => d.folderId === 'ziel-o').length === 2));
  ok('… nichts wurde dabei geöffnet, kein Schatten bleibt liegen', await page.evaluate(() => !document.querySelector('#sc-ed.on') && !document.getElementById('ziehGeist') && !document.querySelector('.ordner-chip.ziel')));
  ok('… und die Auswahl ist danach aufgehoben', await page.evaluate(() => document.getElementById('wahlLeiste').hidden));

  // A7 — Loslassen auf „Alle" verschiebt nichts; Loslassen im Leeren auch nicht
  await page.evaluate(() => { const w = window.__wfpdf; w.S.aktOrdner = 'alle'; w.suche.zeichneBibliothek(); });
  const cVor = await page.evaluate(() => window.__wfpdf.S.docs.find(x => x.name === 'Musterbrief C').folderId || null);
  const [cx, cy] = await mitte(karte(page, 'Musterbrief C').locator('.dok-bild'));
  const [lx, ly] = await mitte(page.locator('.ordner-chip[data-o="alle"]'));
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(lx, ly, { steps: 10 }); await page.mouse.up();
  await page.waitForTimeout(300);
  ok('Loslassen auf „Alle" verschiebt nichts', await page.evaluate(async vor => { const d = (await WFP.DB.all('docs')).find(x => x.name === 'Musterbrief C'); return (d.folderId || null) === vor && !document.querySelector('.ordner-chip.ziel'); }, cVor), cVor);
  await page.evaluate(() => window.__wfpdf.dlg.wahlEnde());

  // A8 — Verweilen (wie VERWEIL_MS in den WorkFlohs): wer über eine Karte nur HINWEGgleitet, nimmt sie nicht mit
  const gewaehlt = () => page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok.gewaehlt .dok-name')].map(e => e.textContent).sort());
  const [hax, hay] = await mitte(karte(page, 'Musterbrief C').locator('.dok-bild'));
  const [hbx, hby] = await mitte(karte(page, 'Musterbrief A').locator('.dok-bild'));
  const [hcx, hcy] = await mitte(karte(page, 'Musterbrief B').locator('.dok-bild'));
  await page.mouse.move(hax, hay); await page.mouse.down();
  await page.mouse.move(hax + 20, hay + 5, { steps: 3 });
  await page.mouse.move(hbx, hby, { steps: 3 }); await page.mouse.move(hcx, hcy, { steps: 3 });
  ok('(Selbst-Riegel) das Ziehen läuft, und der Weg führte wirklich über Musterbrief A', await page.evaluate(() => !!document.getElementById('ziehGeist')) && await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.dok'), [hbx, hby]));
  ok('… direkt nach dem Überstreichen ist noch keine Karte dazugekommen', JSON.stringify(await gewaehlt()) === '["Musterbrief C"]', await gewaehlt());
  await page.waitForTimeout(400);
  ok('… Karten, über die der Zeiger nur HINWEGgleitet, bleiben draußen — die, auf der er verweilt, kommt dazu', JSON.stringify(await gewaehlt()) === '["Musterbrief B","Musterbrief C"]', await gewaehlt());
  await page.mouse.up(); await page.waitForTimeout(300);
  await page.evaluate(() => window.__wfpdf.dlg.wahlEnde());
  ok('A: kein Seitenfehler', !fehler.length, fehler);
  await ctx.close();

  // ===== B. Finger (Tablet): langer Druck, ziehen, auf einen Ordner =====
  const ctx2 = await browser.newContext({ viewport: { width: 800, height: 1100 }, hasTouch: true, isMobile: true });
  const { page: p2, fehler: f2 } = await aufbauen(ctx2);
  await p2.evaluate(async list => {
    const files = list.map(([n, b64]) => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], n, { type: 'application/pdf' }));
    await window.__wfpdf.importDateien(files, 'Posteingang');
  }, DATEIEN);
  await p2.waitForFunction(() => window.__wfpdf.S.docs.length === 3, null, { timeout: 30000 });
  if (await p2.evaluate(() => !!document.querySelector('#sc-ed.on'))) await p2.evaluate(() => document.getElementById('edZurueck').click());
  await p2.waitForSelector('#sc-bib.on');
  await p2.evaluate(async () => { const w = window.__wfpdf; const o = { id: 'ziel-o', name: 'Erledigt', createdAt: new Date().toISOString() }; await WFP.DB.put('folders', o); w.S.ordner.push(o); w.S.aktOrdner = 'alle'; w.suche.zeichneBibliothek(); window.scrollTo(0, 0); });
  const cdp = await ctx2.newCDPSession(p2);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const m2 = async loc => { const r = await loc.boundingBox(); return [r.x + r.width / 2, r.y + r.height / 2]; };
  // kurzer Tipp: öffnet wie immer
  ok('am Tablet ist das Kästchen oben sichtbar (kein Schweben mit der Maus)', await karte(p2, 'Musterbrief A').locator('[data-haken]').evaluate(e => parseFloat(getComputedStyle(e).opacity) > 0.5));
  const [tax, tay] = await m2(karte(p2, 'Musterbrief A').locator('.dok-bild'));
  const [tbx, tby] = await m2(karte(p2, 'Musterbrief B').locator('.dok-bild'));
  const [tox, toy] = await m2(p2.locator('.ordner-chip[data-o="ziel-o"]'));
  await touch('touchStart', tax, tay); await p2.waitForTimeout(150);
  ok('ein kurzer Druck wählt noch nichts', await p2.evaluate(() => document.getElementById('wahlLeiste').hidden));
  await p2.waitForTimeout(500);
  ok('langer Druck (fest andrücken): die Karte ist gewählt, das Kästchen oben an', await p2.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '1' && document.querySelector('#dokGitter .dok.gewaehlt [data-haken]')?.textContent === '✓'));
  for (let i = 1; i <= 8; i++) await touch('touchMove', tax + (tbx - tax) * i / 8, tay + (tby - tay) * i / 8);
  await p2.waitForTimeout(400);   // auf B verweilen
  ok('ziehen über eine zweite Karte wählt sie dazu', await p2.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '2'));
  await p2.evaluate(() => { window.__tmGesperrt = 0; window.__tm = 0; window.addEventListener('touchmove', e => { window.__tm++; if (e.defaultPrevented) window.__tmGesperrt++; }, { passive: true }); });
  for (let i = 1; i <= 10; i++) await touch('touchMove', tbx + (tox - tbx) * i / 10, tby + (toy - tby) * i / 10);
  ok('… der Ordner unter dem Finger leuchtet als Ziel', await p2.evaluate(() => document.querySelector('.ordner-chip.ziel')?.dataset.o === 'ziel-o'));
  ok('… und der Finger rollt dabei die Seite nicht (jede Bewegung abgefangen)', await p2.evaluate(() => window.__tm > 5 && window.__tmGesperrt === window.__tm), await p2.evaluate(() => [window.__tm, window.__tmGesperrt]));
  await touch('touchEnd');
  await p2.waitForFunction(() => window.__wfpdf.S.docs.filter(d => d.folderId === 'ziel-o').length === 2, null, { timeout: 8000 }).catch(() => {});
  const z2 = await p2.evaluate(() => window.__wfpdf.S.docs.filter(d => d.folderId === 'ziel-o').map(d => d.name).sort());
  ok('Finger loslassen auf dem Ordner: beide sind verschoben', JSON.stringify(z2) === JSON.stringify(['Musterbrief A', 'Musterbrief B']), z2);
  ok('… nichts wurde geöffnet', await p2.evaluate(() => !document.querySelector('#sc-ed.on')));
  // Langer Druck und loslassen, ohne zu ziehen: die Karte bleibt gewählt (der Klick danach nimmt sie nicht wieder heraus)
  await p2.evaluate(() => { const w = window.__wfpdf; w.S.aktOrdner = 'alle'; w.suche.zeichneBibliothek(); window.scrollTo(0, 0); });
  const [tdx, tdy] = await m2(karte(p2, 'Musterbrief C').locator('.dok-bild'));
  await touch('touchStart', tdx, tdy); await p2.waitForTimeout(700); await touch('touchEnd'); await p2.waitForTimeout(400);
  ok('langer Druck, dann loslassen: die Karte bleibt gewählt, nichts öffnet sich', await p2.evaluate(() => document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl === '1' && !document.querySelector('#sc-ed.on')), await p2.evaluate(() => [document.querySelector('[data-wahl-zahl]')?.dataset.wahlZahl, !!document.querySelector('#sc-ed.on')]));
  const [tex, tey] = await m2(karte(p2, 'Musterbrief C').locator('.dok-bild'));
  await touch('touchStart', tex, tey); await touch('touchEnd'); await p2.waitForTimeout(400);
  ok('… danach nimmt ein kurzer Tipp sie wieder heraus', await p2.evaluate(() => document.getElementById('wahlLeiste').hidden));
  // Rollen bleibt Rollen: Finger sofort bewegen = kein Ziehen, keine Auswahl
  await p2.evaluate(() => { const w = window.__wfpdf; w.S.aktOrdner = 'alle'; w.suche.zeichneBibliothek(); window.scrollTo(0, 0); });
  const [tcx, tcy] = await m2(karte(p2, 'Musterbrief C').locator('.dok-bild'));
  await touch('touchStart', tcx, tcy); for (let i = 1; i <= 6; i++) await touch('touchMove', tcx, tcy - i * 15); await p2.waitForTimeout(600); await touch('touchEnd');
  ok('Finger sofort bewegt (rollen): keine Auswahl, kein Ziehen', await p2.evaluate(() => document.getElementById('wahlLeiste').hidden && !document.getElementById('ziehGeist')));
  ok('B: kein Seitenfehler', !f2.length, f2);
  await ctx2.close();
} catch (e) { ok('Probe lief ohne Absturz', false, String(e && e.stack || e)); }
finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
