/* Workfloh PDF — Probe: Aufbau der Übersetzung auf der Seite (Klaus 2026-09-25:
   „Es kommt zu Textüberlagerung … Logos oder Zahlen wie 1, 2, 3 werden abgedeckt",
   „Kurzanleitung wurde auch nicht mit ins Russische übersetzt").
   Erfundenes Formular (Stadt Musterstadt), gebaut mit pdf-lib. Übersetzer ist ein
   Stellvertreter: jedes Wort wird um ein Drittel LÄNGER und kyrillisch — so wie
   Russisch meist länger ist als Deutsch. Geprüft wird an den Absätzen, die lauf()
   bildet, und am Ergebnis-PDF, das pdfBauen() schreibt. Kein Netz. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.wasm': 'application/wasm' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}

/* ---------- das erfundene Formular ---------- */
async function formular(bildPng) {
  const pdf = await PDFDocument.create();
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const p = pdf.addPage([595.28, 841.89]);
  const SW = rgb(0.1, 0.1, 0.1), ROT = rgb(0.8, 0.1, 0.1), WEISS = rgb(1, 1, 1);
  // Logo: ein Buchstabe im Kasten, daneben der Kopf
  p.drawRectangle({ x: 56, y: 760, width: 34, height: 34, borderColor: rgb(0.1, 0.3, 0.6), borderWidth: 2 });
  p.drawText('M', { x: 65, y: 769, size: 18, font: B, color: rgb(0.1, 0.3, 0.6) });
  p.drawText('Stadt Musterstadt', { x: 100, y: 780, size: 14, font: B, color: SW });
  // Schritte mit rotem Kreis und Ziffer
  const schritte = ['In der Bibliothek auf den Knopf tippen.', 'Die Datei wählen, sie liegt der App bei und heißt Beispiel.', 'Die App öffnet das Dokument.'];
  let y = 720;
  schritte.forEach((t, i) => { p.drawCircle({ x: 65, y: y + 4, size: 9, color: ROT }); p.drawText(String(i + 1), { x: 62, y, size: 10, font: B, color: WEISS }); p.drawText(t, { x: 82, y, size: 10.5, font: R, color: SW }); y -= 22; });
  // Ankreuz-Liste mit gezeichneten Kästchen
  y = 630;
  ['Ich wohne in der Zone.', 'Ich habe ein Auto.', 'Ich brauche einen Ausweis.'].forEach(t => { p.drawRectangle({ x: 56, y: y - 1, width: 9, height: 9, borderColor: SW, borderWidth: 1 }); p.drawText(t, { x: 72, y, size: 10, font: R, color: SW }); y -= 16; });
  // grüner Kasten: Überschrift fett 11, Text 10 über zwei Zeilen
  p.drawRectangle({ x: 50, y: 470, width: 495, height: 70, color: rgb(0.18, 0.49, 0.2) });
  p.drawText('Ihre Daten bleiben hier', { x: 63, y: 520, size: 11, font: B, color: WEISS });
  p.drawText('Alles, was Sie eintragen, liegt im Speicher dieses Browsers und geht nur mit', { x: 63, y: 502, size: 10, font: R, color: WEISS });
  p.drawText('Ihrer Zustimmung ins Netz.', { x: 63, y: 488, size: 10, font: R, color: WEISS });
  // kurze Beschriftung mit viel Platz rechts daneben
  p.drawText('Name:', { x: 56, y: 440, size: 10, font: R, color: SW });
  // Liste in der rechten Spalte: der mittlere Punkt hat rechts eine Linie, die anderen Platz
  [['Karte', 420], ['Ausweis', 404], ['Antrag', 388]].forEach(([t, yy], i) => {
    p.drawText('• ' + t, { x: 320, y: yy, size: 10, font: R, color: SW });
    if (i === 1) p.drawLine({ start: { x: 320 + R.widthOfTextAtSize('• ' + t, 10) + 11, y: yy - 3 }, end: { x: 320 + R.widthOfTextAtSize('• ' + t, 10) + 11, y: yy + 10 }, thickness: 1.5, color: SW });
  });
  // zwei Zeilen, die zweite kurz; rechts neben ihr (im Rechteck des Absatzes) ein Stempel
  p.drawText('Dieser Absatz hat eine lange erste Zeile, die bis zum Rand geht.', { x: 56, y: 90, size: 10, font: R, color: SW });
  p.drawText('Kurz.', { x: 56, y: 77, size: 10, font: R, color: SW });
  p.drawRectangle({ x: 300, y: 74, width: 30, height: 9, color: rgb(0.1, 0.3, 0.8) });
  // ein Bild mit Text darin (wie ein eingefügter Scan) auf einer Seite MIT Textebene
  const img = await pdf.embedPng(bildPng);
  p.drawImage(img, { x: 56, y: 120, width: 420, height: 280 });
  // Seite 2: Fragebogen (erfunden) — Beschriftungs-Spalte neben grauen Feldern, 9 pt,
  // dunkelgrau, 16 pt Abstand; Überschrift direkt über dem ersten Feld; ein gewöhnlicher
  // dreizeiliger Absatz daneben (Befund Klaus 2026-09-26: Beschriftungen verrutschten, blass)
  const q = pdf.addPage([595.28, 841.89]); const DG = rgb(0.25, 0.25, 0.25);
  q.drawText('1. Angaben zum Termin', { x: 36, y: 780, size: 10, font: R, color: SW });
  q.drawText('Datum:', { x: 56, y: 761, size: 9, font: R, color: DG });
  q.drawRectangle({ x: 56, y: 740, width: 230, height: 14, color: rgb(0.9, 0.9, 0.9) });
  ['Vorname:', 'Name:', 'Straße, Nr.:', 'PLZ, Ort:', 'E-Mail:', 'Geburtsdatum:'].forEach((t, i) => {
    q.drawText(t, { x: 57, y: 640 - i * 16, size: 9, font: R, color: DG });
    q.drawRectangle({ x: 137, y: 638 - i * 16, width: 160, height: 12, color: rgb(0.9, 0.9, 0.9) });
  });
  ['Die Stadt Musterstadt bearbeitet Ihren Antrag innerhalb von vier Wochen und', 'meldet sich bei Rückfragen per Post oder per E-Mail bei Ihnen, sobald', 'alle Unterlagen vollständig vorliegen.'].forEach((t, i) => q.drawText(t, { x: 36, y: 500 - i * 11, size: 9, font: R, color: SW }));
  return pdf.save();
}

const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  const bp = await browser.newPage({ viewport: { width: 900, height: 600 } });
  await bp.setContent('<body style="margin:0;background:#f4f1e8;font:40px Arial"><div style="position:absolute;left:60px;top:60px;font-size:64px;font-weight:bold">Kurzanleitung</div><div style="position:absolute;left:60px;top:200px;width:800px;line-height:1.4">Das Formular einlesen und die Felder erkennen lassen.</div></body>');
  const bildPng = await bp.screenshot({ type: 'png' }); await bp.close();
  const bytes = await formular(bildPng);

  const page = await browser.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.goto(URL0);
  await page.waitForFunction(() => window.WFP && WFP.Uebersetzung);
  const r = await page.evaluate(async b64 => {
    const UE = WFP.Uebersetzung, bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const kyr = 'абвгдежзиклмнопрстуфхцчшщыэюя', hin = [];
    const ueb = async l => l.map(t => { hin.push(t); return t.split(' ').map(w => { let x = ''; for (let i = 0; i < Math.max(1, Math.round(w.length * 1.34)); i++) x += kyr[(w.charCodeAt(i % w.length) + i) % kyr.length]; return x; }).join(' '); });
    const lauf = await UE.lauf({ bytes: bytes.slice(), uebersetzer: ueb, ocr: { basis: 'vendor/', von: 'de' } });
    const s = lauf.stand.seiten[0];
    const sch = await UE.schriftLaden('vendor/');
    const e = await UE.pdfBauen(bytes, lauf.stand.seiten, sch, { nach: 'ru' });
    const pdf = await pdfjsLib.getDocument({ data: e.bytes }).promise, pg = await pdf.getPage(1);
    const vp = pg.getViewport({ scale: 1 }), tc = await pg.getTextContent();
    // nur die russischen Stücke (die deutschen liegen abgedeckt darunter)
    const ru = tc.items.filter(it => /[а-я]/.test(it.str)).map(it => { const t = pdfjsLib.Util.transform(vp.transform, it.transform); return { s: it.str, x: +t[4].toFixed(1), y: +t[5].toFixed(1), g: +Math.hypot(t[2], t[3]).toFixed(2) }; });
    const c = document.createElement('canvas'); c.width = vp.width * 2; c.height = vp.height * 2;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: pg.getViewport({ scale: 2 }) }).promise;
    const px = (x, y) => Array.from(c.getContext('2d').getImageData(Math.round(x * 2), Math.round(y * 2), 1, 1).data);
    const htmlRu = await WFP.HtmlExport.htmlFormular({ fields: [], uebersetzung: { von: 'de', nach: 'ru' } }, Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    const htmlDe = await WFP.HtmlExport.htmlFormular({ fields: [] }, Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    // Farbe: weißer Grund, viele hellgraue Kantenpixel, weniger dunkle Kernpixel (kleine Schrift)
    const fc = document.createElement('canvas'); fc.width = 100; fc.height = 20; const fx = fc.getContext('2d');
    fx.fillStyle = '#fff'; fx.fillRect(0, 0, 100, 20); fx.fillStyle = '#9a9a9a'; fx.fillRect(0, 0, 100, 5); fx.fillStyle = '#333333'; fx.fillRect(0, 5, 100, 3);
    const farbe = UE.farben(fc, 1, [0, 0, 100, 20, 9, 0, '', 0]);
    return { farbe, htmlLang: [/<html lang="ru">/.test(htmlRu), /<html lang="de">/.test(htmlDe)], hin, bl: s.b.map(b => ({ t: b[6], x: b[0], y: b[1], size: b[4] })), ocr: s.ocr, ru, hinweise: e.hinweise,
      stempel: [305, 310, 315, 320, 325].map(x => px(x, 841.89 - 78.5)), kreis: [1, 2, 3].map(i => px(58.5, 841.89 - (720 - (i - 1) * 22 + 4))),
      s2: await (async () => { const pg2 = await pdf.getPage(2), vp2 = pg2.getViewport({ scale: 1 }), tc2 = await pg2.getTextContent();
        const c2 = document.createElement('canvas'); c2.width = vp2.width * 3; c2.height = vp2.height * 3;
        await pg2.render({ canvasContext: c2.getContext('2d'), viewport: pg2.getViewport({ scale: 3 }) }).promise;
        const ru2 = tc2.items.filter(it => /[а-я]/.test(it.str)).map(it => { const t = pdfjsLib.Util.transform(vp2.transform, it.transform); return { x: t[4], y: t[5], w: it.width, g: Math.hypot(t[2], t[3]) }; });
        // dunkelster Pixel je übersetzter Beschriftung der Spalte (x≈57)
        const dunkel = ru2.filter(x => Math.abs(x.x - 57) < 2 && x.y > 841.89 - 650 && x.y < 841.89 - 550).map(x => { const d = c2.getContext('2d').getImageData(Math.round(x.x * 3), Math.round((x.y - x.g) * 3), Math.max(3, Math.round(x.w * 3)), Math.round(x.g * 3)).data;
          let m = 255; for (let i = 0; i < d.length; i += 4) m = Math.min(m, (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000); return Math.round(m); });
        return { bl: lauf.stand.seiten[1].b.map(b => ({ t: b[6], y: b[1] })), ru2: ru2.map(x => ({ x: +x.x.toFixed(1), y: +x.y.toFixed(1) })), dunkel }; })() };
  }, Buffer.from(bytes).toString('base64'));

  ok('das Logo-Zeichen „M" wird nicht als Absatz übersetzt', !r.hin.includes('M') && !r.bl.some(b => b.t === 'M'), r.hin);
  ok('die Ziffern in den Kreisen werden nicht übersetzt', !r.hin.some(t => /^[123]$/.test(t.trim())), r.hin);
  ok('drei Schritte = drei Absätze (nicht zusammengeworfen)', ['In der Bibliothek auf den Knopf tippen.', 'Die Datei wählen, sie liegt der App bei und heißt Beispiel.', 'Die App öffnet das Dokument.'].every(t => r.hin.includes(t)), r.hin);
  ok('… und die roten Kreise bleiben rot (nicht abgedeckt)', r.kreis.every(c => c[0] > 150 && c[1] < 80), r.kreis);
  ok('drei Ankreuz-Zeilen = drei Absätze', ['Ich wohne in der Zone.', 'Ich habe ein Auto.', 'Ich brauche einen Ausweis.'].every(t => r.hin.includes(t)), r.hin);
  ok('Kasten: Überschrift getrennt vom Text', r.hin.includes('Ihre Daten bleiben hier'), r.hin);
  ok('Kasten: die zwei Textzeilen bleiben EIN Absatz (der Kastenrand trennt sie nicht)', r.hin.some(t => /^Alles, was Sie eintragen.*Ihrer Zustimmung ins Netz\.$/.test(t)), r.hin);
  const name = r.ru.find(x => Math.abs(x.x - 56) < 2 && Math.abs(x.y - (841.89 - 440)) < 3);
  ok('freier Platz rechts: die längere Übersetzung von „Name:" behält die Schriftgröße 10', name && name.g > 9.7, name);
  // die drei Schritte in derselben Spalte bekommen dieselbe Größe
  const gs = r.ru.filter(x => Math.abs(x.x - 82) < 2 && x.y > 841.89 - 730 && x.y < 841.89 - 670).map(x => x.g);
  ok('gleiche Originalgröße in einer Spalte → gleiche Schriftgröße in der Übersetzung', gs.length >= 3 && Math.max(...gs) - Math.min(...gs) < 0.3, gs);
  const liste = r.ru.filter(x => Math.abs(x.x - 320) < 2).map(x => x.g);
  ok('Liste mit einem eingeengten Punkt: alle Punkte der Spalte gleich groß (angeglichen)', liste.length >= 3 && Math.max(...liste) - Math.min(...liste) < 0.3, liste);
  ok('Abdeckung nur über den Zeilen: der Stempel neben der kurzen Zeile bleibt blau', r.stempel.filter(c => c[2] > 150 && c[0] < 80).length >= 3, r.stempel);
  ok('Bild mit Text auf einer Seite MIT Textebene: der Text im Bild wird gelesen und übersetzt', r.ocr && r.hin.some(t => /Kurzanleitung/.test(t)) && r.hin.some(t => /Formular einlesen/.test(t)), r.hin);
  ok('… und der Bericht nennt die Texterkennung', r.hinweise.some(h => /Texterkennung|OCR/.test(h)), r.hinweise);
  ok('HTML zum Ausfüllen trägt die Sprache der Übersetzung (ru), das Original bleibt de', r.htmlLang[0] && r.htmlLang[1], r.htmlLang);
  // Seite 2: Fragebogen
  const lab = ['Vorname:', 'Name:', 'Straße, Nr.:', 'PLZ, Ort:', 'E-Mail:', 'Geburtsdatum:'];
  ok('Beschriftungs-Spalte: jede Beschriftung ein eigener Absatz (neben IHREM Feld)', lab.every(t => r.s2.bl.some(b => b.t === t)), r.s2.bl);
  const ys = lab.map(t => (r.s2.bl.find(b => b.t === t) || {}).y), soll = lab.map((_, i) => 841.89 - (640 - i * 16));
  ok('… und jede steht in der Übersetzung auf der Höhe ihres Feldes', lab.every((t, i) => r.s2.ru2.some(x => Math.abs(x.x - 57) < 2 && Math.abs(x.y - soll[i]) < 3)), { ys, ru: r.s2.ru2.filter(x => Math.abs(x.x - 57) < 2) });
  ok('Überschrift „1. Angaben zum Termin" getrennt von der Beschriftung „Datum:"', r.s2.bl.some(b => b.t === '1. Angaben zum Termin') && r.s2.bl.some(b => b.t === 'Datum:'), r.s2.bl);
  ok('gewöhnlicher Absatz (11 pt Zeilenabstand) bleibt EIN Absatz', r.s2.bl.some(b => /^Die Stadt Musterstadt.*vollständig vorliegen\.$/.test(b.t)), r.s2.bl);
  ok('Schriftfarbe: der dunkle Kern gewinnt gegen die zahlreicheren hellen Kantenpixel', r.farbe[1] < '#505050' && r.farbe[0] > '#f0f0f0', r.farbe);
  ok('kleine dunkelgraue Beschriftungen bleiben dunkel (nicht blassgrau)', r.s2.dunkel.length >= 6 && r.s2.dunkel.every(m => m < 100), r.s2.dunkel);
  ok('keine Fehler in der Konsole', fehler.length === 0, fehler);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
