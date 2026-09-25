/* Workfloh PDF — Probe der Übersetzung im echten Browser (Chromium, playwright-core).
   Erfundene Daten. Der Übersetzer des Browsers (Translator) fehlt im Test-Chromium
   und wird durch einen Stellvertreter mit festem Wörterbuch ersetzt; die KI-Antwort
   (Mistral) ist gestellt — es geht kein Byte ins Netz.
   Geprüft wird am ERGEBNIS-PDF (zurückgelesen mit pdf.js):
   - dieselbe Seitenzahl und Seitengröße, jede Seite auf DERSELBEN Seite übersetzt
   - echter russischer Text lesbar (Kyrillisch eingebettet, Glyphen sichtbar)
   - die Übersetzung steht an der Stelle des Originals (auch gedreht / beschnitten)
   - das Original ist abgedeckt, die Absätze wurden richtig zusammengesetzt
   - Gegenprobe, Abbrechen + Fortsetzen, gescannte Seite, KI-Weg mit Bestätigung und 429 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, rgb, degrees } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

/* ---------- Wörterbuch (echte Sätze, beide Richtungen) ---------- */
const DE_RU = {
  'Mietvertrag für Wohnräume': 'Договор аренды жилых помещений',
  'Zwischen dem Vermieter und dem Mieter wird folgender Vertrag geschlossen. Die Wohnung liegt im zweiten Obergeschoss.': 'Между арендодателем и арендатором заключается следующий договор. Квартира находится на третьем этаже.',
  'Die Miete beträgt 850 Euro im Monat.': 'Арендная плата составляет 850 евро в месяц.',
  'Ort:': 'Место:', 'Datum:': 'Дата:',
  'Hamburg, den 1. Mai': 'Гамбург, 1 мая',
  'Seite zwei ist gedreht.': 'Вторая страница повёрнута.',
  'Auf beschnittener Seite.': 'На обрезанной странице.',
  'Querformat, aufrecht gedruckt.': 'Альбомная ориентация, напечатано прямо.',
  'Bedienung': 'Управление',
  '• Gerät einschalten.': '• Включите устройство.',
  '• Taste drei Sekunden drücken.': '• Нажмите кнопку на три секунды.',
  '1. Deckel öffnen.': '1. Откройте крышку.',
  '2. Filter wechseln.': '2. Замените фильтр.',
  'Warnung: Nicht ins Wasser tauchen.': 'Внимание: не погружать в воду.'
};
const RU_DE = Object.fromEntries(Object.entries(DE_RU).map(([a, b]) => [b, a]));
const RU_EN = { 'Добро пожаловать в наш дом.': 'Welcome to our house.', 'Ключи лежат на столе. Пожалуйста, закройте окна перед уходом.': 'The keys are on the table. Please close the windows before leaving.' };

/* ---------- Test-PDFs ---------- */
async function deutsch() {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage([595.28, 841.89]);
  p.drawText('Mietvertrag für Wohnräume', { x: 60, y: 780, size: 18, font: f });
  p.drawText('Zwischen dem Vermieter und dem Mieter wird folgen-', { x: 60, y: 740, size: 11, font: f });
  p.drawText('der Vertrag geschlossen. Die Wohnung liegt im', { x: 60, y: 726, size: 11, font: f });
  p.drawText('zweiten Obergeschoss.', { x: 60, y: 712, size: 11, font: f });
  p.drawText('Die Miete beträgt 850 Euro im Monat.', { x: 60, y: 676, size: 11, font: f });
  p.drawText('Ort:', { x: 60, y: 630, size: 11, font: f });
  p.drawText('Datum:', { x: 350, y: 630, size: 11, font: f });
  p.drawText('Hamburg,', { x: 60, y: 590, size: 11, font: f });                         // zwei Stücke, eine Zeile
  p.drawText('den 1. Mai', { x: 60 + f.widthOfTextAtSize('Hamburg, ', 11), y: 590, size: 11, font: f });
  const p2 = pdf.addPage([595.28, 841.89]); p2.setRotation(degrees(90));
  p2.drawText('Seite zwei ist gedreht.', { x: 80, y: 700, size: 14, font: f });
  const p3 = pdf.addPage([595.28, 841.89]);                                               // „gescannt": nur Grafik
  p3.drawRectangle({ x: 60, y: 600, width: 300, height: 120, color: rgb(0.2, 0.2, 0.2) });
  const p4 = pdf.addPage([595.28, 841.89]); p4.setCropBox(50, 50, 450, 650);
  p4.drawText('Auf beschnittener Seite.', { x: 100, y: 500, size: 12, font: f });
  // Querformat-Seite (Rotate 90), Text so gesetzt, dass er auf dem Schirm AUFRECHT steht
  const p5 = pdf.addPage([595.28, 841.89]); p5.setRotation(degrees(90));
  p5.drawText('Querformat, aufrecht gedruckt.', { x: 120, y: 100, size: 14, font: f, rotate: degrees(90) });
  // Handbuch-Seite: Bild, Aufzählung, nummerierte Schritte, farbiger Warnkasten mit weißer Schrift
  const p6 = pdf.addPage([595.28, 841.89]);
  p6.drawRectangle({ x: 300, y: 560, width: 240, height: 220, color: rgb(0.2, 0.45, 0.8) });   // „Bild"
  p6.drawText('Bedienung', { x: 60, y: 780, size: 16, font: f });
  p6.drawText('• Gerät einschalten.', { x: 60, y: 750, size: 11, font: f });
  p6.drawText('• Taste drei Sekunden drücken.', { x: 60, y: 736, size: 11, font: f });
  p6.drawText('1. Deckel öffnen.', { x: 60, y: 700, size: 11, font: f });
  p6.drawText('2. Filter wechseln.', { x: 60, y: 686, size: 11, font: f });
  p6.drawRectangle({ x: 50, y: 600, width: 230, height: 30, color: rgb(0.95, 0.75, 0.1) });
  p6.drawText('Warnung: Nicht ins Wasser tauchen.', { x: 58, y: 611, size: 10, font: f, color: rgb(1, 1, 1) });
  return pdf.save();
}
async function russisch() {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const f = await pdf.embedFont(fs.readFileSync(path.join(WURZEL, 'vendor/fonts/NotoSans-Regular.ttf')), { subset: true });
  const p = pdf.addPage([595.28, 841.89]);
  p.drawText('Добро пожаловать в наш дом.', { x: 60, y: 760, size: 16, font: f });
  p.drawText('Ключи лежат на столе. Пожалуйста, за-', { x: 60, y: 720, size: 11, font: f });
  p.drawText('кройте окна перед уходом.', { x: 60, y: 705, size: 11, font: f });
  return pdf.save();
}
async function lang(n) {   // n Seiten, je ein Absatz — für Abbrechen/Fortsetzen
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) pdf.addPage([595.28, 841.89]).drawText('Absatz auf Seite ' + i + '.', { x: 60, y: 760, size: 12, font: f });
  return pdf.save();
}

function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}

// Gescannte Seite: ein echtes Bild von gedrucktem Text (von Chromium gerendert), keine Textebene
async function scan(browser) {
  const pg = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
  await pg.setContent('<body style="margin:0;background:#f4f1e8;font:40px Arial"><div style="position:absolute;left:120px;top:200px;font-size:64px;font-weight:bold">Sicherheitshinweise</div><div style="position:absolute;left:120px;top:340px;width:1000px;line-height:1.3">Vor dem Reinigen den Netzstecker ziehen. Das Gerät nicht öffnen.</div><div style="position:absolute;left:120px;top:1200px;width:500px;height:300px;background:#3a7bd5"></div></body>');
  const png = await pg.screenshot({ type: 'png' }); await pg.close();
  const pdf = await PDFDocument.create(); const img = await pdf.embedPng(png);
  pdf.addPage([595.28, 841.89]).drawImage(img, { x: 0, y: 0, width: 595.28, height: 841.89 });
  return pdf.save();
}
const TMP = fs.mkdtempSync('/tmp/wfpdf-ue-');
const ORD = path.join(TMP, 'Vertraege'); fs.mkdirSync(ORD);
fs.writeFileSync(path.join(ORD, 'Mietvertrag.pdf'), await deutsch());
fs.writeFileSync(path.join(ORD, 'Hausregeln.pdf'), await russisch());
fs.writeFileSync(path.join(TMP, 'Lang.pdf'), await lang(6));
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
fs.writeFileSync(path.join(TMP, 'Scan.pdf'), await scan(browser));
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 900 } });
await ctx.addInitScript(({ DE_RU, RU_DE, RU_EN }) => {
  const W = { 'de>ru': DE_RU, 'ru>de': RU_DE, 'ru>en': RU_EN };
  window.__ueCalls = []; window.__ueDelay = 0;
  self.Translator = {
    availability: async ({ sourceLanguage: a, targetLanguage: b }) => (a === b ? 'unavailable' : 'available'),
    create: async ({ sourceLanguage: a, targetLanguage: b }) => ({
      translate: async t => { if (window.__ueFehlerAb && window.__ueCalls.length + 1 >= window.__ueFehlerAb) throw new Error('Zu viele Anfragen oder Kontingent erschöpft (429). gestellt'); window.__ueCalls.push(a + '>' + b + ':' + t); if (window.__ueDelay) await new Promise(r => setTimeout(r, window.__ueDelay)); const w = W[a + '>' + b] || {}; return w[t] != null ? w[t] : '[' + b + '] ' + t; },
      destroy() {}
    })
  };
}, { DE_RU, RU_DE, RU_EN });
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(String(e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
let mistral = [], mistral429 = 1;
await page.route('https://api.mistral.ai/**', async route => {
  const body = JSON.parse(route.request().postData() || '{}'); mistral.push(body);
  if (mistral429-- > 0) return route.fulfill({ status: 429, contentType: 'application/json', headers: { 'retry-after': '5', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'retry-after' }, body: '{"message":"Rate limit exceeded"}' });
  const t = JSON.parse(body.messages[1].content).t;
  const aus = t.map(x => RU_EN[x] != null ? RU_EN[x] : Object.entries(RU_EN).find(([k, v]) => v === x) ? Object.entries(RU_EN).find(([k, v]) => v === x)[0] : '[ki] ' + x);
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ t: aus }) }, finish_reason: 'stop' }], usage: { prompt_tokens: 120, completion_tokens: 60 } }) });
});

// Liest ein Dokument aus der Bibliothek zurück: Seiten, Textstücke in Anzeige-Koordinaten
async function lies(name) {
  return page.evaluate(async name => {
    const d = (await WFP.DB.all('docs')).find(x => x.name === name); if (!d) return null;
    const bytes = await WFP.DB.getFile(d.id);
    const lib = await PDFLib.PDFDocument.load(bytes); const fonts = [];
    for (const [, obj] of lib.context.enumerateIndirectObjects()) { if (obj instanceof PDFLib.PDFDict && obj.get(PDFLib.PDFName.of('FontName')) && obj.get(PDFLib.PDFName.of('FontFile2'))) fonts.push(obj.get(PDFLib.PDFName.of('FontName')).toString()); }
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const seiten = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const p = await pdf.getPage(i); const vp = p.getViewport({ scale: 1 });
      const tc = await p.getTextContent();
      seiten.push({ w: vp.width, h: vp.height, stuecke: tc.items.filter(t => t.str.trim()).map(t => { const tr = pdfjsLib.Util.transform(vp.transform, t.transform); return { s: t.str, x: tr[4], y: tr[5], fh: Math.hypot(tr[2], tr[3]), w: t.width }; }) });
    }
    pdf.destroy();
    return { d, seiten, groesse: bytes.length, fonts, noto: fonts.some(f => /NotoSans/.test(f)) };
  }, name);
}
// Anteil dunkler Pixel in einem Rechteck (Anzeige-pt) der gerenderten Seite
async function tinte(name, seite, r) {
  return page.evaluate(async ({ name, seite, r }) => {
    const d = (await WFP.DB.all('docs')).find(x => x.name === name); const bytes = await WFP.DB.getFile(d.id);
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const p = await pdf.getPage(seite + 1); const vp = p.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: x, viewport: vp }).promise; pdf.destroy();
    const px = x.getImageData(Math.round(r[0] * 2), Math.round(r[1] * 2), Math.round(r[2] * 2), Math.round(r[3] * 2)).data;
    let dunkel = 0; for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] < 300) dunkel++;
    return dunkel / (px.length / 4);
  }, { name, seite, r });
}
const text = s => s.stuecke.map(t => t.s).join(' ').replace(/\s+/g, ' ');

try {
  console.log('Workfloh PDF — Übersetzung, Probe im Browser');
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf);

  // 1. Eigener Bereich: 🌐 Übersetzen → Ordner vom Gerät — genau der Weg, den Klaus nimmt
  await page.click('#btnUebersetzen'); await page.waitForSelector('.dlg [data-uo]');
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), page.click('.dlg [data-uo]')]);
  await wahl.setFiles(ORD);
  await page.waitForSelector('.dlg [data-e]');
  ok('fragt nach dem Ordnernamen, vorbelegt mit dem Namen vom Gerät', await page.inputValue('.dlg [data-e]') === 'Vertraege');
  await page.fill('.dlg [data-e]', 'Handbücher'); await page.click('.dlg [data-j]');
  await page.waitForSelector('.dlg [data-dok]', { timeout: 30000 });
  ok('eigener Ordner „Handbücher" für die Originale angelegt, markiert als Übersetzungs-Bereich', await page.evaluate(() => window.__wfpdf.S.ordner.some(o => o.name === 'Handbücher' && o.bereich === 'uebersetzung')));
  ok('Übersetzen-Fenster öffnet sich danach von selbst, beide Dokumente gewählt', await page.evaluate(() => document.querySelectorAll('.dlg [data-dok]:checked').length === 2));

  // 2. Messen: zeigt Übersetzer + Textebene
  await page.click('.dlg .ue-mess summary');
  await page.click('.dlg [data-messen]'); await page.waitForFunction(() => /Textebene/.test(document.querySelector('.dlg [data-mess]').textContent));
  const mess = await page.textContent('.dlg [data-mess]');
  ok('Messen: nennt Übersetzer, alle 6 Richtungen und die Textebene je Dokument', /vorhanden/.test(mess) && /DE→RU: available/.test(mess) && /RU→EN: available/.test(mess) && /3 von 3 geprüften|1 von 1 geprüften/.test(mess), mess);
  ok('Dialog: gleiche Sprache hin und zurück sperrt die Knöpfe', await page.evaluate(async () => { const v = document.querySelector('.dlg [data-von]'), n = document.querySelector('.dlg [data-nach]'); n.value = 'de'; n.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 100)); const g = document.querySelector('.dlg [data-weg="browser"]').disabled; n.value = 'ru'; n.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 100)); return g && !document.querySelector('.dlg [data-weg="browser"]').disabled; }));

  // 3. DE → RU mit Gegenprobe, nur der Mietvertrag
  await page.locator('.dlg [data-dok]').nth(1).uncheck();
  const erster = await page.evaluate(() => document.querySelector('.dlg [data-dok]').parentNode.textContent);
  if (!/Mietvertrag/.test(erster)) { await page.locator('.dlg [data-dok]').first().uncheck(); await page.locator('.dlg [data-dok]').nth(1).check(); }
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'ru');
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 60000 });
  const calls = await page.evaluate(() => window.__ueCalls);
  const hin = calls.filter(c => c.startsWith('de>ru:')).map(c => c.slice(6));
  ok('Absätze richtig zusammengesetzt (3 Zeilen + Silbentrennung → ein Absatz)', hin.includes('Zwischen dem Vermieter und dem Mieter wird folgender Vertrag geschlossen. Die Wohnung liegt im zweiten Obergeschoss.'), hin);
  ok('zwei Stücke auf einer Zeile → ein Absatz; Spalten „Ort:" / „Datum:" bleiben getrennt', hin.includes('Hamburg, den 1. Mai') && hin.includes('Ort:') && hin.includes('Datum:'), hin);
  ok('jede Zeichenkette hat ein Wort im Wörterbuch (nichts Unerwartetes)', hin.every(t => DE_RU[t]), hin.filter(t => !DE_RU[t]));
  const bericht = await page.textContent('.dlg');
  ok('Bericht nennt Seiten, Zeit je Seite, Größe und die gescannte Seite', /6 von 6 Seiten/.test(bericht) && /s je neu übersetzter Seite/.test(bericht) && /[KM]B/.test(bericht) && /ohne erkennbaren Text/.test(bericht), bericht.slice(0, 500));
  await page.click('.dlg [data-x]');

  const org = await lies('Mietvertrag'), ru = await lies('Mietvertrag [RU]'), gp = await lies('Mietvertrag [RU→DE Gegenprobe]');
  const ordnerName = id => page.evaluate(id => (window.__wfpdf.S.ordner.find(o => o.id === id) || {}).name, id);
  ok('Ergebnis liegt getrennt im Ordner „Handbücher · RU", Original bleibt in „Handbücher"', ru && org && await ordnerName(ru.d.folderId) === 'Handbücher · RU' && await ordnerName(org.d.folderId) === 'Handbücher' && ru.d.uebersetzung.von === 'de' && ru.d.uebersetzung.nach === 'ru');
  ok('Gegenprobe liegt in eigenem Ordner „Handbücher · Gegenprobe RU→DE"', gp && await ordnerName(gp.d.folderId) === 'Handbücher · Gegenprobe RU→DE');
  ok('Original-PDF ist bytegleich wie eingelesen', await page.evaluate(async () => { const d = (await WFP.DB.all('docs')).find(x => x.name === 'Mietvertrag'); const b = await WFP.DB.getFile(d.id); return b.length; }) === fs.readFileSync(path.join(ORD, 'Mietvertrag.pdf')).length);
  ok('gleiche Seitenzahl und Seitengrößen (auch gedreht und beschnitten) — keine Umbrüche verschoben', ru.seiten.length === 6 && ru.seiten.every((s, i) => Math.abs(s.w - org.seiten[i].w) < 0.01 && Math.abs(s.h - org.seiten[i].h) < 0.01), ru.seiten.map(s => [s.w, s.h]));
  ok('Kyrillisch: Noto Sans als Teilmenge eingebettet', ru.noto, ru.fonts);
  const t1 = text(ru.seiten[0]);
  ok('russischer Text steht lesbar im PDF (Seite 1)', ['Договор аренды жилых помещений', 'Арендная плата составляет 850 евро в месяц.', 'Место:', 'Дата:', 'Гамбург, 1 мая'].every(x => t1.includes(x)) && /Между арендодателем.*третьем этаже\./.test(t1), t1);
  // Lage: das erste Stück der Übersetzung steht dort, wo das Original stand
  const lage = (seite, orig, neu) => { const o = org.seiten[seite].stuecke.find(t => t.s.startsWith(orig)), n = ru.seiten[seite].stuecke.find(t => t.s.startsWith(neu)); return o && n ? { dx: n.x - o.x, dy: n.y - o.y, fh: o.fh } : null; };
  const l1 = lage(0, 'Mietvertrag', 'Договор'), l2 = lage(1, 'Seite zwei', 'Вторая'), l4 = lage(3, 'Auf beschnittener', 'На обрезанной'), l5 = lage(0, 'Datum:', 'Дата:');
  const nah = l => l && Math.abs(l.dx) < 3 && Math.abs(l.dy) < l.fh * 0.6;
  ok('Übersetzung an der Stelle des Originals: Überschrift', nah(l1), l1);
  ok('… rechte Spalte („Datum:")', nah(l5), l5);
  ok('… auf der Seite mit senkrecht stehendem Text (Längs-/Querachse vertauscht)', l2 && Math.abs(l2.dy) < 3 && Math.abs(l2.dx) < l2.fh * 0.6, l2);
  ok('… auf der beschnittenen Seite (CropBox versetzt)', nah(l4), l4);
  const l6 = lage(4, 'Querformat', 'Альбомная');
  ok('… auf der Querformat-Seite mit aufrechtem Text', nah(l6), l6);
  ok('senkrecht stehender Text wird mitübersetzt (Seite 2 steht quer auf dem Schirm)', hin.includes('Seite zwei ist gedreht.'));
  ok('Handbuch: Aufzählungspunkte und Schritte bleiben einzelne Absätze', ['• Gerät einschalten.', '• Taste drei Sekunden drücken.', '1. Deckel öffnen.', '2. Filter wechseln.'].every(x => hin.includes(x)), hin);
  const t6 = text(ru.seiten[5]);
  ok('Handbuch: russische Liste steht im PDF', t6.includes('• Включите устройство.') && t6.includes('2. Замените фильтр.'), t6);
  // Aussehen wie das Original: der gelbe Warnkasten bleibt gelb, die weiße Schrift weiß, das Bild unberührt
  const farbeBei = (name, seite, X, Y) => page.evaluate(async ({ name, seite, X, Y }) => {
    const d = (await WFP.DB.all('docs')).find(x => x.name === name); const bytes = await WFP.DB.getFile(d.id);
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const p = await pdf.getPage(seite + 1); const vp = p.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const x = c.getContext('2d'); await p.render({ canvasContext: x, viewport: vp }).promise; pdf.destroy();
    return Array.from(x.getImageData(Math.round(X * 2), Math.round(Y * 2), 1, 1).data.slice(0, 3));
  }, { name, seite, X, Y });
  const warn = org.seiten[5].stuecke.find(t => t.s.startsWith('Warnung'));
  const gelbNeu = await farbeBei('Mietvertrag [RU]', 5, warn.x + 200, warn.y - 2);   // rechts im Kasten, wo nur Hintergrund ist
  ok('Warnkasten bleibt gelb (Abdeckung in der Hintergrundfarbe, nicht weiß)', gelbNeu[0] > 200 && gelbNeu[1] > 150 && gelbNeu[2] < 80, gelbNeu);
  const inkWeiss = await page.evaluate(async ({ x, y, fh }) => {
    const d = (await WFP.DB.all('docs')).find(q => q.name === 'Mietvertrag [RU]'); const bytes = await WFP.DB.getFile(d.id);
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const p = await pdf.getPage(6); const vp = p.getViewport({ scale: 2 });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const k = c.getContext('2d'); await p.render({ canvasContext: k, viewport: vp }).promise; pdf.destroy();
    const px = k.getImageData(Math.round(x * 2), Math.round((y - fh) * 2), 160, Math.round(fh * 2)).data; let weiss = 0, dunkel = 0;
    for (let i = 0; i < px.length; i += 4) { if (px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235) weiss++; if (px[i] + px[i + 1] + px[i + 2] < 200) dunkel++; }
    return { weiss, dunkel };
  }, warn);
  ok('… und die Übersetzung darin ist weiß geschrieben wie im Original (keine schwarze Schrift)', inkWeiss.weiss > 50 && inkWeiss.dunkel < 20, inkWeiss);
  const bildNeu = await farbeBei('Mietvertrag [RU]', 5, 420, 841.89 - 670);
  ok('Bild auf der Handbuch-Seite unverändert (blau)', bildNeu[2] > 150 && bildNeu[0] < 90, bildNeu);
  ok('gescannte Seite bleibt, wie sie war (kein Text dazu)', ru.seiten[2].stuecke.length === 0);
  // Sichtbarkeit: Kyrillisch wird wirklich gezeichnet; das Original ist abgedeckt
  const o = org.seiten[0].stuecke.find(t => t.s === 'den 1. Mai');
  // Gemessen wird der Teil, den die (kürzere) Übersetzung NICHT beschreibt: vom Ende
  // von „Гамбург, 1 мая" bis zum Ende von „Mai". Bis 2026-09-25 maß die Probe den Anfang
  // von „den 1. Mai" — dort steht zu Recht die Übersetzung, und grün war sie nur, weil
  // die Schrift-Teilmenge Buchstaben verlor (tests/schrift.mjs).
  const nRu = ru.seiten[0].stuecke.find(t => t.s.startsWith('Гамбург'));
  const x0 = nRu ? nRu.x + nRu.w + 2 : o.x + o.w, bx = [x0, o.y - o.fh * 0.8, o.x + o.w - x0, o.fh * 0.9];
  const ink = bx[2] > 4 ? await tinte('Mietvertrag [RU]', 0, bx) : null;
  const inkOrg = bx[2] > 4 ? await tinte('Mietvertrag', 0, bx) : null;
  ok('Original abgedeckt: wo „Mai" stand und die Übersetzung nicht hinreicht, ist die Seite (fast) weiß', bx[2] > 4 && inkOrg > 0.05 && ink < 0.02, { inkOrg, ink, breite: bx[2] });
  const h1 = org.seiten[0].stuecke.find(t => t.s.startsWith('Mietvertrag'));
  ok('russische Überschrift ist sichtbar gezeichnet (Tinte im Bereich)', await tinte('Mietvertrag [RU]', 0, [h1.x, h1.y - h1.fh, 150, h1.fh * 1.1]) > 0.04);
  ok('Gegenprobe liegt daneben und trägt den deutschen Text zurück', gp && gp.d.uebersetzung.gegenprobe && text(gp.seiten[0]).includes('Die Miete beträgt 850 Euro im Monat.') && gp.seiten.length === 6);
  ok('Gegenprobe übersetzt die gespeicherte Übersetzung zurück, nicht den Text unter dem Deckblatt', calls.filter(c => c.startsWith('ru>de:')).length === hin.length);
  ok('keine offenen Zwischenstände mehr in der Datenbank', await page.evaluate(async () => (await WFP.DB.all('files')).filter(f => String(f.id).startsWith('ue:')).length === 0));

  // 4. RU → EN über die KI (Mistral, gestellt): Bestätigung zuerst, dann 429 → Wiederholung
  await page.evaluate(() => { const w = window.__wfpdf; w.EINST.anbieter = 'mistral'; w.EINST.schluessel.mistral = 'test-schluessel'; w.EINST.ueRueck = false; w.einstSpeichern(); });
  await page.evaluate(() => { window.__wfpdf.S.aktOrdner = 'alle'; });
  await page.click('.ordner-chip[data-o="alle"]');
  await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
  const idx = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')].findIndex(c => /Hausregeln/.test(c.parentNode.textContent)));
  await page.locator('.dlg [data-dok]').nth(idx).check();
  await page.selectOption('.dlg [data-von]', 'ru'); await page.selectOption('.dlg [data-nach]', 'en');
  await page.click('.dlg [data-weg="ki"]');
  await page.waitForFunction(() => /Text an die KI senden/.test(document.querySelector('.dlg h2')?.textContent || ''));
  ok('KI: vor dem ersten Senden wird gefragt, nichts ist bis dahin gesendet', mistral.length === 0);
  await page.click('.dlg [data-n]');
  await page.waitForTimeout(300);
  ok('KI: „Abbrechen" sendet nichts', mistral.length === 0);
  await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
  await page.locator('.dlg [data-dok]').nth(idx).check();
  await page.selectOption('.dlg [data-von]', 'ru'); await page.selectOption('.dlg [data-nach]', 'en');
  await page.click('.dlg [data-weg="ki"]'); await page.click('.dlg [data-j]');
  const bremsText = await page.waitForFunction(() => { const t = document.querySelector('.dlg [data-t]')?.textContent || ''; return /Tempo-Limit/.test(t) && t; }, null, { timeout: 15000 }).then(h => h.jsonValue(), () => '');
  ok('KI: Tempo-Limit wird sichtbar abgewartet, die Wartezeit des Anbieters (Retry-After 5 s) gilt', /warte 5 s/.test(bremsText), bremsText);
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 60000 });
  ok('KI: 429 wird abgewartet und wiederholt (2 Anfragen für 1 Seite)', mistral.length === 2, mistral.length);
  ok('KI: gesendet wird nur Text (kein Bild), Modell mistral-small-latest, JSON verlangt', mistral.every(b => !JSON.stringify(b).includes('image') && b.model === 'mistral-small-latest' && b.response_format?.type === 'json_object'));
  ok('KI: Bericht nennt die Token', /Token/.test(await page.textContent('.dlg')));
  await page.click('.dlg [data-x]');
  const en = await lies('Hausregeln [EN]');
  ok('RU → EN: kyrillische Absätze gelesen, englischer Text steht im PDF', en && text(en.seiten[0]).includes('Welcome to our house.') && text(en.seiten[0]).includes('The keys are on the table. Please close the windows before leaving.'), en && text(en.seiten[0]));

  // 4b. Gescannte Seite: Texterkennung (OCR) auf dem Gerät, dann übersetzen
  await page.setInputFiles('#inDatei', path.join(TMP, 'Scan.pdf'));
  await page.waitForSelector('#sc-ed.on'); await page.click('#edZurueck');
  await page.evaluate(() => { window.__ueCalls = []; const w = window.__wfpdf; w.EINST.ueRueck = false; w.einstSpeichern(); });
  await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
  const si = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')].findIndex(c => /Scan/.test(c.parentNode.textContent)));
  await page.locator('.dlg [data-dok]').nth(si).check();
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'ru');
  const tOcr = Date.now();
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 120000 });
  const ocrMs = Date.now() - tOcr;
  const ocrCalls = await page.evaluate(() => window.__ueCalls.map(c => c.slice(6)));
  ok('OCR: Text der gescannten Seite erkannt (Überschrift + Absatz)', ocrCalls.some(t => /Sicherheitshinweise/.test(t)) && ocrCalls.some(t => /Netzstecker ziehen/.test(t) && /nicht öffnen/.test(t)), ocrCalls);
  ok('OCR: Bericht nennt die Texterkennung', /Texterkennung \(OCR\)/.test(await page.textContent('.dlg')));
  await page.click('.dlg [data-x]');
  const sc = await lies('Scan [RU]');
  const hdr = sc && sc.seiten[0].stuecke.find(t => /Sicherheitshinweise/.test(t.s));
  ok('OCR: Übersetzung steht an der Stelle der Überschrift (Scan: 120 px/1240 → x≈58 pt, Grundlinie ≈ y 125 pt)', hdr && Math.abs(hdr.x - 120 / 1240 * 595.28) < 6 && Math.abs(hdr.y - 262 / 1754 * 841.89) < 12, hdr);
  const papier = await farbeBei('Scan [RU]', 0, 400, 262 / 1754 * 841.89 - 4);
  ok('OCR: Abdeckung im Papierton des Scans, nicht reinweiß', papier[0] > 225 && papier[2] < 240 && papier[0] - papier[2] > 6, papier);
  console.log('    gemessen: 1 gescannte Seite mit OCR in ' + (ocrMs / 1000).toFixed(1) + ' s (inkl. einmaligem Laden der Texterkennung)');

  // 5. Abbrechen und Fortsetzen (6 Seiten)
  await page.setInputFiles('#inDatei', path.join(TMP, 'Lang.pdf'));
  await page.waitForSelector('#sc-ed.on'); await page.click('#edZurueck');
  await page.evaluate(() => { window.__ueDelay = 250; const w = window.__wfpdf; w.EINST.ueRueck = false; w.einstSpeichern(); });
  await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
  const li = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')].findIndex(c => /Lang/.test(c.parentNode.textContent)));
  await page.locator('.dlg [data-dok]').nth(li).check();
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'en');
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Seite 2 von 6/.test(document.querySelector('.dlg [data-t]')?.textContent || ''));
  ok('Fortschritt zeigt „Seite N von M"', true);
  await page.click('.dlg [data-abbruch]');
  await page.waitForFunction(() => /angehalten/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 20000 });
  const stand = await page.evaluate(async () => { const j = (await WFP.DB.all('files')).find(f => String(f.id).startsWith('ue:')); return j ? j.job.seiten.filter(Boolean).length : -1; });
  ok('Abbrechen hält nach der laufenden Seite an, Zwischenstand gespeichert', stand >= 2 && stand < 6, stand);
  // Klaus 2026-09-25: „es wird zwar gesagt, dass ein Teil übersetzt wurde … die
  // Teilübersetzung wird nicht angezeigt." Seitdem liegt ein Teil-PDF bereit.
  ok('bei Abbruch kein vollständiges Ergebnis angelegt', !(await lies('Lang [EN]')));
  const tl = await lies('Lang [EN, Teil ' + stand + ' von 6]');
  ok('… aber ein Teil-PDF „[EN, Teil N von 6]" mit allen 6 Seiten', tl && tl.seiten.length === 6 && tl.d.teil && tl.d.teil.fertig === stand, tl && tl.d.name);
  ok('… fertige Seiten übersetzt, der Rest steht im Original', tl && tl.seiten.slice(0, stand).every((s, i) => text(s).includes('[en] Absatz auf Seite ' + (i + 1) + '.')) && !text(tl.seiten[5]).includes('[en]') && text(tl.seiten[5]).includes('Absatz auf Seite 6.'), tl && tl.seiten.map(text));
  ok('… und der Bericht bietet es zum Öffnen an', /Teilübersetzung öffnen/.test(await page.textContent('.dlg')));
  await page.click('.dlg [data-x]');
  await page.evaluate(() => { window.__ueCalls = []; window.__ueDelay = 0; });
  await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
  await page.locator('.dlg [data-dok]').nth(li).check();
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'en');
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 30000 });
  const neuCalls = await page.evaluate(() => window.__ueCalls.length);
  ok('Fortsetzen übersetzt nur die fehlenden Seiten', neuCalls === 6 - stand, { neuCalls, stand });
  const lg = await lies('Lang [EN]');
  ok('… und das Ergebnis hat alle 6 Seiten, jede an ihrem Platz übersetzt', lg && lg.seiten.length === 6 && lg.seiten.every((s, i) => text(s).includes('[en] Absatz auf Seite ' + (i + 1) + '.')), lg && lg.seiten.map(text));
  ok('… und das Teil-PDF ist durch das vollständige ersetzt', await page.evaluate(async () => !(await WFP.DB.all('docs')).some(d => /^Lang \[EN, Teil/.test(d.name))));
  await page.click('.dlg [data-x]');

  // 5b. Der Übersetzer bricht mitten im Lauf ab (Kontingent erschöpft) — Teilergebnis sichtbar
  await page.evaluate(() => { window.__ueCalls = []; window.__ueFehlerAb = 3; });
  await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
  await page.locator('.dlg [data-dok]').nth(li).check();
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'ru');
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /unvollständig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 30000 });
  const berK = await page.textContent('.dlg');
  ok('Kontingent erschöpft: Bericht nennt den Grund und „2 von 6 Seiten"', /Kontingent/.test(berK) && /2 von 6 Seiten/.test(berK), berK.slice(0, 600));
  const tk = await lies('Lang [RU, Teil 2 von 6]');
  ok('… Teil-PDF mit 2 übersetzten Seiten liegt bereit', tk && tk.seiten.length === 6 && text(tk.seiten[1]).includes('[ru] Absatz auf Seite 2.') && !text(tk.seiten[2]).includes('[ru]'), tk && tk.seiten.map(text));
  await page.click('.dlg [data-oeffne]');
  await page.waitForSelector('#sc-ed.on');
  ok('… und „Teilübersetzung öffnen" zeigt es im Editor', await page.evaluate(() => window.__wfpdf.S.doc && /Teil 2 von 6/.test(window.__wfpdf.S.doc.name)));
  await page.click('#edZurueck');
  await page.evaluate(() => { window.__ueFehlerAb = 0; });

  const echt = konsole.filter(k => !/status of 429/.test(k));   // die 429 ist gestellt
  ok('keine Fehler in der Konsole (außer der gestellten 429)', echt.length === 0, echt);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
