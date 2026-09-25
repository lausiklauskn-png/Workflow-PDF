/* Workfloh PDF — Probe: steht jeder Buchstabe auch im BILD? (Befund Klaus 2026-09-25)
   Die übersetzte Seite zeigte „An … e" statt „Anspruchsteller" — die eingebettete
   Schrift-TEILMENGE (pdf-lib + fontkit, subset:true) verlor Buchstaben. Die Textebene
   stimmte dabei, deshalb sahen alle Proben, die Text LESEN, nichts. Diese Probe rendert
   mit pdf.js und misst die Tinte: je Zeile der Anteil der Spalten mit Tinte zwischen
   erster und letzter Tinte. Lückenhafter Text liegt weit darunter.
   Geprüft: pdfBauen (Übersetzung, Latein + Kyrillisch) und Export „fest" mit
   kyrillischem Feldwert. Erfundene Sätze, kein Byte ins Netz. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };
const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
const konsole = []; page.on('pageerror', e => konsole.push(String(e)));
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
// Nur Satzzeichen-arme Sätze: jede Zeile füllt ihre Breite dicht mit Buchstaben.
const SAETZE = ['Anspruchsteller Schadenssache Rechtsanwaltsgesellschaft Fragebogen', 'Уважаемые дамы и господа пожалуйста заполните анкету полностью', 'Datum der Anmeldung Uhrzeit Kennzeichen Versicherungsnummer'];
try {
  console.log('Workfloh PDF — Schrift im Bild');
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await page.waitForFunction(() => !!window.__wfpdf);
  const m = await page.evaluate(async saetze => {
    const UE = WFP.Uebersetzung;
    const leer = await (async () => { const d = await PDFLib.PDFDocument.create(); d.addPage([595, 842]); return d.save(); })();
    const schrift = await UE.schriftLaden('vendor/');
    // Tinte je Zeile: Anteil der Spalten mit dunklem Pixel zwischen erster und letzter Tinte
    const tinte = async bytes => {
      const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const pg = await pdf.getPage(1); const vp = pg.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const x = c.getContext('2d');
      await pg.render({ canvasContext: x, viewport: vp }).promise;
      const d = x.getImageData(0, 0, c.width, c.height).data; const zeilen = []; let band = null;
      const dunkel = (i, j) => { const k = (j * c.width + i) * 4; return d[k] + d[k + 1] + d[k + 2] < 380; };
      for (let j = 0; j < c.height; j++) { let hat = false; for (let i = 0; i < c.width; i++) if (dunkel(i, j)) { hat = true; break; } if (hat && !band) band = [j, j]; else if (hat) band[1] = j; else if (band) { zeilen.push(band); band = null; } }
      return zeilen.filter(b => b[1] - b[0] > 6).map(([a, b]) => { let erst = -1, letzt = -1, n = 0; for (let i = 0; i < c.width; i++) { let s = false; for (let j = a; j <= b; j++) if (dunkel(i, j)) { s = true; break; } if (s) { n++; if (erst < 0) erst = i; letzt = i; } } return +(n / (letzt - erst + 1)).toFixed(2); });
    };
    const seiten = [{ b: saetze.map((t, i) => [40, 40 + i * 60, 520, 40, 14]), u: saetze }];
    const ue = await UE.pdfBauen(leer, seiten, schrift, {});
    const doc = { pages: [{ t: [1, 0, 0, -1, 0, 842], w: 595, h: 842 }], fields: saetze.map((s, i) => ({ id: 'f' + i, name: 'f' + i, type: 'text', page: 0, x: 6, y: 5 + i * 8, w: 90, h: 3.5, value: s, geprueft: true })) };
    const ex = await WFP.Export.exportieren(doc, leer, 'fest', { schrift });
    return { ue: await tinte(ue.bytes), ex: await tinte(ex.bytes) };
  }, SAETZE);
  console.log('    gemessen, Tinten-Anteil je Zeile: Übersetzung ' + m.ue.join(' · ') + ' | Export fest ' + m.ex.join(' · '));
  ok('Übersetzung: drei Zeilen gezeichnet', m.ue.length === 3, m.ue);
  ok('… jede Zeile lückenlos (Tinte ≥ 0,55 — ohne Buchstaben-Verlust)', m.ue.length === 3 && m.ue.every(v => v >= 0.55), m.ue);
  ok('Export „fest" mit kyrillischem Feldwert: drei Zeilen gezeichnet', m.ex.length === 3, m.ex);
  ok('… jede Zeile lückenlos', m.ex.length === 3 && m.ex.every(v => v >= 0.55), m.ex);
  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) { rot++; console.log('  ✗ ROT: Abbruch → ' + (e && e.message || e)); }
finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
