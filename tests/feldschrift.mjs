/* Workfloh PDF — Schriftgröße je Feld, Feld wächst mit, Einrasten, Erkennung ohne Belegtes (Klaus 2026-11-03).
   Klaus: „im mehrzeiligen Modus … Zeilenumbruch nicht passend … Schrift abgeschnitten … Schriftgröße mit einer Zahl" ·
   „Felder sollen sich automatisch an die gewählte Schriftgröße anpassen … Breite … Höhe … Enter … zweite Zeile" ·
   „Parallel stehende … Felder sollen sich automatisch ausrichten zueinander" ·
   „Logos … Überschriften … vorausgefüllte Felder … unterstrichene Texte … grau ausgefüllte Hinweise … nicht als Feld".
   A ohne Browser (WFP.Erkennung.schonBelegt an gestellten Bildern) · B im Browser mit einem erfundenen Formular. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

/* ---------- A · schonBelegt ohne Browser ---------- */
console.log('A · schonBelegt');
{
  const ctx = { window: {} }; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(WURZEL, 'assets/erkennung.js'), 'utf8'), ctx);
  const ER = ctx.window.WFP.Erkennung;
  const bild = (W, H, mal) => { const data = new Uint8ClampedArray(W * H * 4).fill(255); if (mal) mal((x, y, r, g, b) => { const i = (y * W + x) * 4; data[i] = r; data[i + 1] = g; data[i + 2] = b; }); return { width: W, height: H, data }; };
  const W = 200, H = 100, feld = { type: 'text', x: 10, y: 10, w: 50, h: 20, quelle: 'rahmen' };
  ok('leerer Rahmen bleibt ein Feld', ER.schonBelegt(feld, [], bild(W, H), undefined) === '');
  ok('Text der Textebene im Rahmen → belegt (text)', ER.schonBelegt(feld, [], bild(W, H), 'Max Muster') === 'text');
  ok('ein einzelner Buchstabe allein zählt nicht als Text', ER.schonBelegt(feld, [], bild(W, H), 'M') === '');
  const logo = bild(W, H, set => { for (let y = 12; y < 28; y++) for (let x = 22; x < 60; x++) set(x, y, 220, 30, 30); });
  ok('farbiges Logo im Rahmen → belegt (bild)', ER.schonBelegt(feld, [], logo, undefined) === 'bild');
  // „Datum:" als Beschriftung in der Ecke: ihre Tinte zählt nicht
  const mitDatum = bild(W, H, set => { for (let y = 11; y < 16; y++) for (let x = 21; x < 40; x++) set(x, y, 0, 0, 0); });
  const datum = [{ str: 'Datum:', x: 10.5, y: 11, w: 9.5, h: 5 }];
  ok('Beschriftung „Datum:" ohne Text danach → bleibt ein Feld', ER.schonBelegt(feld, datum, mitDatum, undefined) === '', ER.TINTE_MAX);
  ok('… ohne Beschriftung in der Textebene wäre dieselbe Tinte belegt (Gegenprobe im Lauf)', ER.schonBelegt(feld, [], mitDatum, undefined) === 'bild');
  ok('istBeschriftung: „Aktenzeichen: ____" ja, „Datum: 3.11." nein', ER.istBeschriftung('Aktenzeichen: ____') && !ER.istBeschriftung('Datum: 3.11.'));
  ok('Kästchen und KI-Felder bleiben unberührt', ER.schonBelegt({ ...feld, type: 'check' }, [], logo, 'x') === '' && ER.schonBelegt({ ...feld, quelle: 'ki' }, [], logo, 'x') === '');
  // Linie: die Linie selbst (unteres Fünftel) zählt nicht
  const linie = bild(W, H, set => { for (let x = 20; x < 120; x++) for (let y = 27; y < 29; y++) set(x, y, 0, 0, 0); });
  ok('leere Linie bleibt ein Feld (die Linie selbst zählt nicht)', ER.schonBelegt({ ...feld, quelle: 'linie' }, [], linie, undefined) === '');
}

/* ---------- B · im Browser ---------- */
let chromium;
try { ({ chromium } = await import('playwright-core')); } catch { console.log('⊘ B nicht lauffähig: playwright-core fehlt'); console.log(`\n${gruen} grün · ${rot} ROT`); process.exit(rot ? 1 : 0); }

async function formular() {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica), fb = await pdf.embedFont(StandardFonts.HelveticaBold);
  const p = pdf.addPage([595.28, 841.89]);
  // 1 leere Linie mit Beschriftung links → Feld
  p.drawText('Name:', { x: 60, y: 760, size: 10, font: f }); p.drawLine({ start: { x: 110, y: 758 }, end: { x: 400, y: 758 }, thickness: 1 });
  // 2 unterstrichener Text → kein Feld
  p.drawText('Wichtige Vertragsbedingungen beachten', { x: 60, y: 700, size: 11, font: f }); p.drawLine({ start: { x: 60, y: 697 }, end: { x: 260, y: 697 }, thickness: 1 });
  // 3 Rahmen mit Überschrift darin → kein Feld
  p.drawRectangle({ x: 60, y: 600, width: 470, height: 40, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  p.drawText('Name und Anschrift des behandelnden Arztes', { x: 66, y: 616, size: 14, font: fb });
  // 4 leerer Rahmen mit Beschriftung „Datum:" oben links → Feld
  p.drawRectangle({ x: 60, y: 520, width: 230, height: 40, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  p.drawText('Datum:', { x: 64, y: 548, size: 8, font: f });
  // 5 Logo: farbige Fläche mit Rahmen → kein Feld
  p.drawRectangle({ x: 330, y: 520, width: 200, height: 40, borderWidth: 1, borderColor: rgb(0, 0, 0) });
  p.drawRectangle({ x: 340, y: 528, width: 50, height: 24, color: rgb(0.85, 0.1, 0.1) });
  p.drawCircle({ x: 420, y: 540, size: 10, color: rgb(0.05, 0.6, 0.6) });
  // 6 grauer Hinweis mit Text → kein Feld; 7 leere graue Fläche → Feld
  p.drawRectangle({ x: 60, y: 420, width: 470, height: 40, color: rgb(0.85, 0.85, 0.85) });
  p.drawText('Ich willige ein, dass meine Angaben geprüft werden.', { x: 66, y: 436, size: 10, font: f });
  p.drawText('Telefon:', { x: 60, y: 372, size: 10, font: f });
  p.drawRectangle({ x: 60, y: 350, width: 250, height: 16, color: rgb(0.85, 0.85, 0.85) });
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
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(fs.existsSync);
let browser;
try { browser = await chromium.launch(exe ? { executablePath: exe } : {}); } catch (e) { console.log('⊘ B nicht lauffähig: kein Browser — ' + e.message.split('\n')[0]); console.log(`\n${gruen} grün · ${rot} ROT`); process.exit(rot ? 1 : 0); }
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const PDF64 = Buffer.from(await formular()).toString('base64');
async function kleinesPdf(titel) { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); d.addPage([300, 200]).drawText('Erfunden', { x: 20, y: 100, size: 12, font: f }); if (titel) d.setTitle(titel); return Buffer.from(await d.save()).toString('base64'); }
const PDF_TITEL64 = await kleinesPdf('Eröffnungsmail'), PDF_OHNE64 = await kleinesPdf('');

try {
  console.log('B · im Browser');
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB);
  await page.evaluate(async b64 => {
    const f = new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], 'Erfundenes Formular.pdf', { type: 'application/pdf' });
    await window.__wfpdf.importDateien([f], 'Schrift');
  }, PDF64);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 1, null, { timeout: 30000 });
  if (!await page.evaluate(() => !!document.querySelector('#sc-ed.on'))) await page.click('#dokGitter .dok .dok-name');
  await page.waitForSelector('#sc-ed.on');
  await page.waitForFunction(() => window.__wfpdf.S.pdf && document.querySelectorAll('.seite canvas').length === 1, null, { timeout: 30000 });

  // 1 · Erkennung ohne KI lässt Belegtes aus
  const E = await page.evaluate(async () => { const W = window.__wfpdf, S = W.S; S.doc.fields = []; const r = await W.erkenneDok(S.doc, S.bytes, false, () => {});
    return { r, weg: window.__wfpdfBelegtWeg, felder: S.doc.fields.map(f => ({ label: f.label, type: f.type, x: +f.x.toFixed(1), y: +f.y.toFixed(1), w: +f.w.toFixed(1), h: +f.h.toFixed(1), value: f.value })) }; });
  const yPct = pt => (841.89 - pt) / 841.89 * 100;
  const bei = (ptOben, ptUnten) => E.felder.filter(f => f.type !== 'check' && f.y < yPct(ptUnten) - 0.3 && f.y + f.h > yPct(ptOben) + 0.3);
  ok('leere Linie „Name" wird ein Feld', E.felder.some(f => /Name/.test(f.label) && Math.abs(f.y + f.h - yPct(758)) < 0.8), E.felder);
  ok('unterstrichener Text wird kein Feld', bei(712, 697).length === 0, bei(712, 697));
  ok('Rahmen mit Überschrift darin wird kein Feld', bei(640, 600).length === 0, bei(640, 600));
  ok('leerer Rahmen mit „Datum:" oben links bleibt ein Feld', E.felder.some(f => f.x < 15 && Math.abs(f.y - yPct(560)) < 0.8), E.felder);
  ok('farbiges Logo im Rahmen wird kein Feld', !E.felder.some(f => f.x > 50 && f.y < yPct(520) - 0.3 && f.y + f.h > yPct(560) + 0.3), E.felder);
  ok('grau hinterlegter Hinweis mit Text wird kein Feld', bei(460, 420).length === 0, bei(460, 420));
  ok('leere graue Fläche „Telefon" bleibt ein Feld', E.felder.some(f => Math.abs(f.y - yPct(366)) < 0.6), E.felder);
  ok('kein Feld trägt gedruckten Text als Wert', !E.felder.some(f => typeof f.value === 'string' && f.value), E.felder.filter(f => f.value));
  ok('die Erkennung zählt, was sie ausgelassen hat (text und bild)', Array.isArray(E.weg) && E.weg.includes('text') && E.weg.includes('bild'), E.weg);

  // 2 · Schriftgröße als Zahl, Bildschirm = pt × Maßstab
  await page.evaluate(async () => { const S = window.__wfpdf.S;
    S.doc.fields = [{ id: 'a', page: 0, type: 'text', label: 'Lang', x: 10, y: 10, w: 20, h: 2, value: 'Ein recht langer Eintrag, der sonst abgeschnitten wäre', geprueft: true, herkunft: 'hand' },
                    { id: 'b', page: 0, type: 'text', label: 'Nachbar', x: 10, y: 20, w: 30, h: 2.5, value: '', geprueft: true, herkunft: 'hand' }];
    S.modus = 'bearbeiten'; S.sel = null; await WFP.DB.put('docs', S.doc); window.__wfpdf.zeichneModus ? window.__wfpdf.zeichneModus() : null; });
  await page.evaluate(() => { const b = document.querySelector('#mBearbeiten'); if (b) b.click(); });
  await page.waitForSelector('.feld[data-id="a"] .wert');
  await page.waitForTimeout(200);
  const auto = await page.evaluate(() => { const w = document.querySelector('.feld[data-id="a"] .wert'); return { sw: w.scrollWidth, cw: w.clientWidth, fs: parseFloat(w.style.fontSize), gr: w.dataset.gr }; });
  ok('ohne Zahl: Schrift passt sich an, nichts abgeschnitten', auto.gr === 'auto' && auto.sw <= auto.cw + 1, auto);
  await page.click('.feld[data-id="a"]');
  await page.waitForSelector('#eigGr');
  ok('Zahlenfeld „Schrift (pt)" steht direkt hinter dem Inhalt', await page.evaluate(() => { const g = document.getElementById('eigGr').closest('label'), w = document.getElementById('eigWert').closest('label'); return w.nextElementSibling === g && g.textContent.includes('Schrift'); }));
  const w0 = await page.evaluate(() => window.__wfpdf.S.doc.fields.find(f => f.id === 'a').w);
  await page.fill('#eigGr', '14');
  await page.waitForTimeout(150);
  const fest = await page.evaluate(() => { const S = window.__wfpdf.S, f = S.doc.fields.find(f => f.id === 'a'), w = document.querySelector('.feld[data-id="a"] .wert');
    const pxProPt = document.querySelector('.feld[data-id="a"]').parentElement.getBoundingClientRect().width / S.doc.pages[0].w;
    return { gr: f.gr, fs: parseFloat(w.style.fontSize), soll: 14 * pxProPt, w: f.w, h: f.h, hSoll: (14 * 1.35 + 2) / S.doc.pages[0].h * 100, sw: w.scrollWidth, cw: w.clientWidth }; });
  ok('Zahl 14 → f.gr = 14, Schrift auf dem Bildschirm = 14 pt × Maßstab', fest.gr === 14 && Math.abs(fest.fs - fest.soll) < 0.1, fest);
  ok('Feld wird so hoch wie eine Zeile in 14 pt', Math.abs(fest.h - fest.hSoll) < 0.05, fest);
  ok('Feld wird so breit wie der Text (wächst), nichts abgeschnitten', fest.w > w0 + 5 && fest.sw <= fest.cw + 2, { w0, ...fest });
  await page.fill('#eigGr', '');
  ok('leeres Zahlenfeld → wieder „auto"', await page.evaluate(() => window.__wfpdf.S.doc.fields.find(f => f.id === 'a').gr === undefined));
  await page.fill('#eigGr', '10');

  // 3 · mehrzeilig: Enter → zweite Zeile → Feld wird höher
  await page.check('#eigMz');
  await page.waitForSelector('textarea#eigWert');
  await page.fill('textarea#eigWert', 'Zeile eins');
  const h1 = await page.evaluate(() => window.__wfpdf.S.doc.fields.find(f => f.id === 'a').h);
  await page.fill('textarea#eigWert', 'Zeile eins\nZeile zwei\nZeile drei');
  const h3 = await page.evaluate(() => { const S = window.__wfpdf.S, f = S.doc.fields.find(f => f.id === 'a'); return { h: f.h, soll: (3 * 10 * 1.18 + 3) / S.doc.pages[0].h * 100 }; });
  ok('mehrzeilig: Inhalt ist ein mehrzeiliges Eingabefeld', true);
  ok('mehrzeilig: drei Zeilen → Feld dreimal so hoch (+ Rand)', h3.h > h1 * 2.2 && Math.abs(h3.h - h3.soll) < 0.05, { h1, ...h3 });
  ok('mehrzeilig: auf dem Blatt wird umbrochen wie eingegeben, nichts abgeschnitten', await page.evaluate(() => { const w = document.querySelector('.feld[data-id="a"] .wert'); return w.scrollHeight <= w.clientHeight + 2 && w.textContent.split('\n').length === 3; }));

  // 4 · Ausfüllen: Tippen lässt das Feld mitwachsen
  await page.click('#mAusfuellen');
  const ta = page.locator('.feld[data-id="a"] textarea');
  await ta.click(); await page.keyboard.press('End'); await page.keyboard.press('Control+End'); await page.keyboard.press('Enter'); await page.keyboard.type('Zeile vier');
  const h4 = await page.evaluate(() => { const f = window.__wfpdf.S.doc.fields.find(f => f.id === 'a'); const el = document.querySelector('.feld[data-id="a"]'); return { h: f.h, css: parseFloat(el.style.height) }; });
  ok('Ausfüllen: Enter + Text → Feld wird höher, auch auf dem Bildschirm', h4.h > h3.h + 0.5 && Math.abs(h4.css - h4.h) < 0.01, { h3: h3.h, ...h4 });

  // 5 · PDF-Ausgabe nimmt die Zahl
  const pdfGr = await page.evaluate(async () => { const w = window.__wfpdf; const r = await WFP.Export.exportieren(w.S.doc, w.S.bytes, 'fest');
    const d = await pdfjsLib.getDocument({ data: r.bytes }).promise; const tc = await (await d.getPage(1)).getTextContent();
    const z = tc.items.find(t => t.str === 'Zeile vier'); return { h: z && Math.hypot(z.transform[2], z.transform[3]), hinweise: r.hinweise };
  });
  ok('festes PDF: Text in genau 10 pt', pdfGr.h && Math.abs(pdfGr.h - 10) < 0.01, pdfGr);
  const af = await page.evaluate(async () => { const w = window.__wfpdf; const r = await WFP.Export.exportieren(w.S.doc, w.S.bytes, 'ausfuellbar');
    const d = await PDFLib.PDFDocument.load(r.bytes); const t = d.getForm().getFields().find(x => x.getName() === 'Lang'); return t && String(t.acroField.getDefaultAppearance()); });
  ok('ausfüllbares PDF: Feld trägt 10 pt im /DA', / 10 Tf/.test(af || ''), af);

  // 6 · Einrasten beim Ziehen
  await page.click('#mBearbeiten');
  await page.waitForSelector('.feld[data-id="b"] .etikett');
  const zug = await page.evaluate(() => { const S = window.__wfpdf.S, a = S.doc.fields.find(f => f.id === 'a'); const el = document.querySelector('.feld[data-id="b"]'), r = el.getBoundingClientRect(), L = el.parentElement.getBoundingClientRect();
    return { sx: r.left + r.width / 2, sy: r.top + r.height / 2, pxX: L.width / 100, ax: a.x, bx: S.doc.fields.find(f => f.id === 'b').x }; });
  // b steht bei x 10, a bei x 10 — b 5 % nach rechts ziehen, dann bis 3 px vor a.x zurück: rastet auf a.x
  await page.mouse.move(zug.sx, zug.sy); await page.mouse.down();
  await page.mouse.move(zug.sx + 5 * zug.pxX, zug.sy + 40, { steps: 5 });
  const frei = await page.evaluate(() => window.__wfpdf.S.doc.fields.find(f => f.id === 'b').x);
  await page.mouse.move(zug.sx + 3, zug.sy + 40, { steps: 5 });
  const linie = await page.evaluate(() => !!document.querySelector('.hilfslinie.senk'));
  await page.mouse.up();
  const nach = await page.evaluate(() => ({ b: window.__wfpdf.S.doc.fields.find(f => f.id === 'b').x, a: window.__wfpdf.S.doc.fields.find(f => f.id === 'a').x, rest: document.querySelectorAll('.hilfslinie').length }));
  ok('ohne Nachbarn im Fangbereich bleibt das Feld frei', Math.abs(frei - (zug.bx + 5)) < 0.3, { frei, zug });
  ok('nahe an der Kante des Nachbarn rastet es genau dort ein', Math.abs(nach.b - nach.a) < 1e-6, nach);
  ok('… mit Hilfslinie während des Ziehens, danach keine mehr', linie && nach.rest === 0, { linie, nach });

  // 7 · eigene Feldart merken, wieder setzen, bleibt nach dem Neuladen, löschen
  await page.click('.feld[data-id="a"]');
  await page.waitForSelector('#eigVorlage');
  await page.click('#eigVorlage');
  await page.waitForSelector('.dlg #vlName');
  await page.fill('.dlg #vlName', 'Meine Adresse');
  await page.click('.dlg [data-ok]');
  await page.waitForSelector('#edFuss [data-v]');
  const knopf = await page.evaluate(() => { const b = document.querySelector('#edFuss [data-v]'); return b && b.textContent.trim(); });
  ok('„★ Als Feldart merken" legt einen eigenen Knopf in „Feld setzen" an', /Meine Adresse/.test(knopf || ''), knopf);
  await page.click('#edFuss [data-v]');
  await page.locator('.seite .lage').first().click({ position: { x: 300, y: 520 } });
  const gesetzt = await page.evaluate(() => { const S = window.__wfpdf.S, a = S.doc.fields.find(f => f.id === 'a'), n = S.doc.fields.find(f => f.vorlage === 'Meine Adresse');
    return n && { type: n.type, gr: n.gr, mz: n.mehrzeilig, value: n.value, label: n.label, w: +n.w.toFixed(3), h: +n.h.toFixed(3), aw: +a.w.toFixed(3), ah: +a.h.toFixed(3), aval: a.value, alabel: a.label }; });
  ok('ein Tipp auf den Knopf und aufs Blatt setzt das Feld mit Art, Schrift, mehrzeilig, Inhalt und Größe', gesetzt && gesetzt.type === 'text' && gesetzt.gr === 10 && gesetzt.mz === true && gesetzt.value === gesetzt.aval && gesetzt.label === gesetzt.alabel && Math.abs(gesetzt.w - gesetzt.aw) < 0.01 && Math.abs(gesetzt.h - gesetzt.ah) < 0.01, gesetzt);
  // sofort neu laden, ohne auf das verzögerte Speichern zu warten (Notstand-Schnappschuss muss greifen)
  await page.reload(); await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 1, null, { timeout: 15000 });
  await page.evaluate(async () => { await window.__wfpdf.oeffneDok(window.__wfpdf.S.docs[0].id); });
  await page.waitForSelector('#sc-ed.on', { timeout: 15000 });
  await page.evaluate(() => { const b = document.querySelector('#mBearbeiten'); if (b) b.click(); });
  await page.waitForSelector('#edFuss [data-v]', { timeout: 15000 }).catch(() => {});
  ok('das eben gesetzte Feld ist nach sofortigem Neuladen da (Notstand)', await page.evaluate(() => window.__wfpdf.S.doc.fields.some(f => f.vorlage === 'Meine Adresse')));
  ok('die eigene Feldart steht nach dem Neuladen wieder da', await page.evaluate(() => !!document.querySelector('#edFuss [data-v]') && /Meine Adresse/.test(document.querySelector('#edFuss [data-v]').textContent)));
  await page.click('#edFuss [data-v-weg]');
  await page.waitForSelector('.dlg [data-j]'); await page.click('.dlg [data-j]');
  await page.waitForTimeout(150);
  const weg = await page.evaluate(() => ({ knopf: !!document.querySelector('#edFuss [data-v]'), feld: window.__wfpdf.S.doc.fields.some(f => f.vorlage === 'Meine Adresse'), vorlagen: (window.__wfpdf.EINST.feldVorlagen || []).length }));
  ok('✕ fragt und löscht die Feldart; gesetzte Felder bleiben', !weg.knopf && weg.feld && weg.vorlagen === 0, weg);

  // 8 · ⟳ mitten in der Arbeit: getippt, sofort aktualisiert → dasselbe Dokument, derselbe Modus, Eintrag da
  await page.click('#mAusfuellen');
  const feldB = page.locator('.feld[data-id="b"] input, .feld[data-id="b"] textarea').first();
  await feldB.click(); await page.keyboard.type('Schnell getippt');
  await Promise.all([page.waitForURL(/neu=/, { timeout: 15000 }).catch(() => {}), page.click('#btnNeu')]);
  await page.waitForFunction(() => window.__wfpdfWeiter && window.__wfpdf && window.__wfpdf.S.doc, null, { timeout: 30000 }).catch(() => {});
  const weiter = await page.evaluate(() => { const S = window.__wfpdf && window.__wfpdf.S; const b = S && S.doc && S.doc.fields.find(f => f.id === 'b');
    return { w: window.__wfpdfWeiter || null, offen: !!document.querySelector('#sc-ed.on'), modus: S && S.modus, wert: b && b.value, toast: (document.getElementById('toast') || {}).textContent || '', url: location.search }; });
  ok('⟳ mitten im Tippen: nach dem Neuladen ist dasselbe Dokument offen, im Ausfüllen-Modus', weiter.w && weiter.offen && weiter.modus === 'ausfuellen', weiter);
  ok('… und der eben getippte Eintrag ist gespeichert', weiter.wert === 'Schnell getippt', weiter);
  ok('… die Meldung nennt Fassung und „gespeichert", die Adresse ist wieder sauber', /Fassung \d+\.\d+\.\d+/.test(weiter.toast) && /gespeichert/.test(weiter.toast) && !/neu=/.test(weiter.url), weiter);

  // 9 · Umlaute im Namen: Titel der PDF hilft, zerlegte Umlaute werden zusammengesetzt
  const namen = await page.evaluate(async ([t64, n64]) => {
    const f1 = new File([Uint8Array.from(atob(t64), c => c.charCodeAt(0))], 'Eroffnungsmail - Leistungsnr. 3766961_02.10.2026.pdf', { type: 'application/pdf' });
    const f2 = new File([Uint8Array.from(atob(n64), c => c.charCodeAt(0))], 'Gebühren.pdf', { type: 'application/pdf' });
    const f3 = new File([Uint8Array.from(atob(t64), c => c.charCodeAt(0))], 'Ganz anderer Name.pdf', { type: 'application/pdf' });
    const r = await window.__wfpdf.importDateien([f1, f2, f3], 'Namen', { still: true });
    return (Array.isArray(r) ? r : window.__wfpdf.S.docs.filter(d => d.name !== 'Erfundenes Formular')).map(d => d.name);
  }, [PDF_TITEL64, PDF_OHNE64]);
  ok('Dateiname ohne Umlaute + Titel „Eröffnungsmail" → „Eröffnungsmail - Leistungsnr. …"', namen.includes('Eröffnungsmail - Leistungsnr. 3766961_02.10.2026'), namen);
  ok('zerlegter Umlaut im Dateinamen wird zusammengesetzt („Gebühren")', namen.includes('Gebühren') && namen.every(n => n === n.normalize('NFC')), namen);
  ok('… ein ganz anderer Dateiname bleibt, wie er kam', namen.includes('Ganz anderer Name'), namen);

  ok('keine Seitenfehler', fehler.length === 0, fehler);
  await ctx.close();
} catch (e) { ok('Abbruch', false, String(e && e.stack || e).slice(0, 600)); }
finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
