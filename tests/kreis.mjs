/* Workfloh PDF — Buchstaben und Ziffern im Kreis sind Symbole (Klaus 2026-09-26).
   Befund an einer englischen Werkstatt-Anleitung: „Ⓒ and body ground: Approx. 5V" kam als
   „C und Karosseriemasse: Ca. 5V B und …" an — der Kreis war weg, und die drei Listenzeilen
   waren zu EINEM Absatz verschmolzen (falscher Umbruch). Die eingerückte Zeile „Voltage Between:"
   war mit dem Satz davor verschmolzen, dabei ging ein Wort verloren.
   Erfundenes Handbuch; der Übersetzer ist ein Stellvertreter, der Ⓐ absichtlich zu „A" macht. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 700) : '')); } };
const DEJAVU = '/usr/share/fonts/truetype/freefont/FreeSans.ttf';   // hat Ⓐ–Ⓩ, ①, ❷ (DejaVu hat Ⓐ NICHT — gemessen)
if (!fs.existsSync(DEJAVU)) { console.log('  ⊘ nicht lauffähig: keine Schrift mit Kreis-Zeichen (' + DEJAVU + ')'); process.exit(0); }
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
const F = await pdf.embedFont(fs.readFileSync(DEJAVU), { subset: false }), B = await pdf.embedFont(StandardFonts.HelveticaBold);
const p = pdf.addPage([595.28, 841.89]); const T = (t, x, y, f = F, size = 11) => p.drawText(t, { x, y, size, font: f });
T('VOLTAGE CHECK', 60, 780, B, 13);
T('If measurements were taken as shown in the figure at the right', 60, 700);
T('and results are as listed below, it means that the circuit is open', 60, 685);
T('between terminals Ⓐ and Ⓑ.', 60, 670);
T('Voltage Between:', 80, 652, B);   // eingerückt, aber näher als 3 Schrifthöhen — sonst trennt es schon die alte Regel (Befund der Gegenprobe)
// eine Zeile als EIN Textstück, eine mit dem Symbol als EIGENEM Stück davor
T('Ⓒ and body ground: Approx. 5V', 100, 636);
T('Ⓑ and body ground: Approx. 5V', 100, 620);
T('Ⓐ', 100, 604); T('and body ground:', 100 + F.widthOfTextAtSize('Ⓐ ', 11), 604); T('0V', 330, 604);
T('Remove the cover ① and then the screw ❷ carefully.', 60, 560);
const bytes = await pdf.save();

const srv = await server();
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  const page = await browser.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.goto(`http://127.0.0.1:${srv.address().port}/`);
  await page.waitForFunction(() => window.WFP && WFP.Uebersetzung);
  const r = await page.evaluate(async b64 => {
    const UE = WFP.Uebersetzung, bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const W = { 'and body ground': 'und Karosseriemasse', 'Approx.': 'Ca.', 'Voltage Between': 'Spannung zwischen', 'between terminals': 'zwischen den Klemmen', 'and': 'und', 'Remove the cover': 'Den Deckel', 'and then the screw': 'und dann die Schraube', 'carefully': 'vorsichtig abnehmen' };
    const gesendet = [];
    // Stellvertreter: übersetzt einzelne Wendungen und macht aus Ⓐ/①/❷ einfache Zeichen (wie es ein Übersetzer tun kann)
    const ueb = async l => l.map(t => { gesendet.push(t); let x = t.normalize('NFKC').replace(/❷/g, '2'); for (const [a, b] of Object.entries(W).sort((p, q) => q[0].length - p[0].length)) x = x.split(a).join(b); return x; });
    const lauf = await UE.lauf({ bytes, uebersetzer: ueb });
    const s = lauf.stand.seiten[0];
    const sch = await UE.schriftLaden('vendor/');
    const e = await UE.pdfBauen(bytes, lauf.stand.seiten, sch, { nach: 'de' });
    const doc = await pdfjsLib.getDocument({ data: e.bytes }).promise, pg = await doc.getPage(1);
    const S = 3, vp = pg.getViewport({ scale: S }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await pg.render({ canvasContext: x, viewport: vp }).promise;
    const dunkel = (px, py) => { const d = x.getImageData(Math.round(px * S), Math.round(py * S), 1, 1).data; return d[0] + d[1] + d[2] < 400; };
    // Ring um jedes gezeichnete Kreis-Symbol: 16 Punkte auf dem Radius, gezählt wird Tinte in ±1 px
    const tc = await pg.getTextContent(), v1 = pg.getViewport({ scale: 1 });
    const stuecke = tc.items.map(it => { const t = pdfjsLib.Util.transform(v1.transform, it.transform); return { s: it.str, x: t[4], y: t[5], g: Math.hypot(t[2], t[3]), w: it.width }; });
    const ring = st => { const cx = st.x + st.w / 2, cy = st.y - st.g * 0.36, rr = st.g / 0.62 * 0.42; let n = 0;
      for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; if ([-0.4, 0, 0.4].some(d => dunkel(cx + Math.cos(a) * (rr + d), cy + Math.sin(a) * (rr + d)))) n++; } return n; };
    const kreise = stuecke.filter(st => /^[ABC12]$/.test(st.s)).map(st => ({ s: st.s, ring: ring(st) }));
    // Gegenstück: dieselbe Messung an einem gewöhnlichen Wortanfang (kein Kreis) — sonst sagt „Ring gefunden" nichts
    const ohneKreis = stuecke.filter(st => /^Spannung zwischen/.test(st.s)).map(st => ring({ x: st.x, w: st.g * 0.62, y: st.y, g: st.g * 0.62 }));
    const neben = stuecke.filter(st => /Karosseriemasse/.test(st.s)).map(st => ({ s: st.s, x: +st.x.toFixed(1) }));
    const T2 = UE.kreisZurueck;
    return { bl: s.b.map(b => b[6]), u: s.u, gesendet, hinweise: e.hinweise, kreise, neben, ohneKreis,
      einzel: { ab: T2('between Ⓐ and Ⓑ.', 'zwischen A und B.'), wort: T2('Ⓐ', 'Also A'), zahl: T2('① 5V', '1 5V'), neg: T2('❷', 'Schraube 2'), schon: T2('Ⓐ x', 'Ⓐ y'), fehlt: T2('Ⓐ', 'nichts'), ohne: T2('kein Symbol', 'A B') },
      inhalt: ['Ⓐ', 'ⓑ', '①', '⑫', '❶', '➋', '➁'].map(UE.kreisInhalt) };
  }, Buffer.from(bytes).toString('base64'));

  const bl = r.bl;
  ok('Listenzeilen mit Ⓒ Ⓑ Ⓐ davor: drei eigene Absätze (nicht verschmolzen)', ['Ⓒ and body ground: Approx. 5V', 'Ⓑ and body ground: Approx. 5V'].every(t => bl.includes(t)) && bl.some(t => /^Ⓐ and body ground:$/.test(t)), bl);
  ok('… auch wenn Ⓐ ein eigenes Textstück vor der Zeile ist', bl.some(t => /^Ⓐ and body ground:$/.test(t)), bl);
  ok('„Voltage Between:" (eingerückt nach Satzende) steht für sich', bl.includes('Voltage Between:') && !bl.some(t => /Ⓑ\.\s*Voltage/.test(t)), bl);
  ok('… und der Satz davor bleibt vollständig ein Absatz („… open between terminals Ⓐ and Ⓑ.")', bl.some(t => /^If measurements .* is open between terminals Ⓐ and Ⓑ\.$/.test(t)), bl);
  ok('das Symbol geht mit zum Übersetzer (der Satz bleibt lesbar)', r.gesendet.some(t => /Ⓐ and Ⓑ/.test(t)), r.gesendet);
  ok('nach der Übersetzung sind die Symbole wieder da, obwohl der Übersetzer „A" daraus machte', r.u.includes('Ⓒ und Karosseriemasse: Ca. 5V') && r.u.some(t => /zwischen den Klemmen Ⓐ und Ⓑ\./.test(t)), r.u);
  ok('… auch mitten im Satz und bei Ziffern (① ❷)', r.u.some(t => /Deckel ① und dann die Schraube ❷ vorsichtig/.test(t)), r.u);
    ok('im PDF steht um jedes Symbol ein gezeichneter Kreis (Ring aus Tinte)', r.kreise.length >= 7 && r.kreise.every(k => k.ring >= 13), r.kreise);
  ok('Selbst-Riegel: der Ring-Messer findet an einem gewöhnlichen Wortanfang keinen Kreis', r.ohneKreis.length === 1 && r.ohneKreis[0] < 9, r.ohneKreis);
  ok('der Text läuft hinter dem Symbol weiter (nicht darübergeschrieben)', r.neben.length === 3 && r.neben.every(n => n.x > 108), r.neben);
  const e = r.einzel;
  ok('kreisZurueck: der Reihe nach, jedes Symbol einmal', e.ab === 'zwischen Ⓐ und Ⓑ.', e.ab);
  ok('kreisZurueck: nie mitten in einem Wort („Also")', e.wort === 'Also Ⓐ', e.wort);
  ok('kreisZurueck: „5V" bleibt, nur die freistehende 1 wird ①', e.zahl === '① 5V' && e.neg === 'Schraube ❷', [e.zahl, e.neg]);
  ok('kreisZurueck: schon vorhandenes Symbol bleibt, ohne Gegenstück nichts erfunden', e.schon === 'Ⓐ y' && e.fehlt === 'nichts' && e.ohne === 'A B', e);
  ok('Inhalt der Kreise: Ⓐ→A, ⓑ→b, ①→1, ⑫→12, ❶→1, ➋→2, ➁→2', JSON.stringify(r.inhalt) === JSON.stringify(['A', 'b', '1', '12', '1', '2', '2']), r.inhalt);
  ok('keine Seitenfehler', fehler.length === 0, fehler);
} finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
