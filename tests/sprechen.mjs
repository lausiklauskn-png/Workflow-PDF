/* Workfloh PDF — Spracheingabe mit Laufbalken (Klaus 2026-09-27).
   Im echten Browser, mit einer GESTELLTEN Spracherkennung (Headless-Chromium hat keine): die Probe
   spielt die Ereignisse, die Chrome schickt (speechstart, Zwischenstände, Endstand, end).
   Gemessen wird, was man SIEHT: der Balken, Striche beim Sprechen, Pünktchen in der Pause, der
   Text im Feld schon während des Sprechens, und dass erst am Ende gesucht wird.
   Nicht gemessen (und nicht messbar hier): echte Spracherkennung, echtes Mikrofon.
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 500) : '')); } };
console.log('Workfloh PDF — Spracheingabe mit Laufbalken');

let pw = null, pdflib = null;
try { pw = await import('playwright-core'); pdflib = await import('pdf-lib'); } catch (_) {}
if (!pw || !pdflib) { console.log('  ⊘ nicht lauffähig (playwright-core/pdf-lib fehlt — npm install)'); process.exit(0); }

const { PDFDocument, StandardFonts } = pdflib;
async function pdf(titel) { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); d.addPage([595, 842]).drawText(titel, { x: 60, y: 760, size: 16, font: f }); return d.save(); }
const TMP = fs.mkdtempSync('/tmp/wfpdf-sprechen-');
fs.writeFileSync(path.join(TMP, 'Auftrag Baeckerei.pdf'), await pdf('Auftrag Baeckerei'));
fs.writeFileSync(path.join(TMP, 'Angebot Tischlerei.pdf'), await pdf('Angebot Tischlerei'));

const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});

// Die gestellte Erkennung: merkt sich start/stop, stop() löst wie in Chrome kurz danach „end" aus.
const STUB = () => {
  window.__rec = [];
  class Stub { constructor() { this.starts = 0; this.stops = 0; window.__rec.push(this); }
    start() { this.starts++; } stop() { this.stops++; setTimeout(() => this.onend && this.onend(), 20); } abort() {} }
  window.SpeechRecognition = Stub;
  window.__sag = (teile, idx) => {
    const r = window.__rec[window.__rec.length - 1];
    const res = teile.map(([t, fertig]) => { const a = [{ transcript: t }]; a.isFinal = !!fertig; return a; });
    r.onresult({ resultIndex: idx || 0, results: res });
  };
  window.__ereignis = n => { const r = window.__rec[window.__rec.length - 1]; r['on' + n] && r['on' + n]({ error: n === 'error' ? window.__fehler : undefined }); };
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await ctx.addInitScript(STUB);
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.__wfpdf);
  await page.setInputFiles('#inDatei', [path.join(TMP, 'Auftrag Baeckerei.pdf'), path.join(TMP, 'Angebot Tischlerei.pdf')]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 2, null, { timeout: 30000 });
  await page.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });

  const lage = () => page.evaluate(() => {
    const b = document.querySelector('[data-wfs]'), spur = b && [...b.querySelectorAll('.wfs-spur i')];
    const sichtbar = b && !b.hidden && b.getClientRects().length > 0 && b.checkVisibility();
    return { da: !!b, sichtbar, n: spur ? spur.length : 0, striche: spur ? spur.filter(i => i.classList.contains('st')).length : 0,
      letzte: spur ? spur.slice(-4).map(i => i.className) : [], hoehen: spur ? spur.filter(i => i.classList.contains('st')).map(i => parseFloat(i.style.height)) : [],
      feld: document.getElementById('bibSuche').value, suche: window.__wfpdf.S.suche || '',
      doks: document.querySelectorAll('#dokGitter .dok').length, knopf: document.getElementById('bibMic').classList.contains('hoert'),
      rec: window.__rec.length, lang: window.__rec.length ? window.__rec[window.__rec.length - 1].lang : '',
      zwischen: window.__rec.length ? window.__rec[window.__rec.length - 1].interimResults : null,
      unterFeld: b ? b.getBoundingClientRect().top >= document.getElementById('bibForm').getBoundingClientRect().bottom - 1 : false };
  });

  let l = await lage();
  ok('vor dem Tippen: kein Balken zu sehen', l.da && !l.sichtbar, l);
  await page.click('#bibMic'); await page.waitForTimeout(250);
  l = await lage();
  ok('Mikrofon antippen: der Balken erscheint unter dem Suchfeld', l.sichtbar && l.unterFeld, l);
  ok('… mit 40 Stellen, am Anfang nur Pünktchen', l.n === 40 && l.striche === 0, l);
  ok('… der Knopf zeigt, dass zugehört wird', l.knopf, l);
  ok('die Erkennung liefert Zwischenstände (interimResults) und hört Deutsch', l.zwischen === true && l.lang === 'de-DE', l);

  await page.evaluate(() => { window.__ereignis('speechstart'); window.__sag([['Bäcke', false]]); });
  await page.waitForTimeout(160);
  l = await lage();
  ok('beim Sprechen steht der Text SCHON im Feld („Bäcke")', l.feld === 'Bäcke', l);
  ok('… aber gesucht wird noch nicht (die Liste bleibt ganz)', l.suche === '' && l.doks === 2, l);
  for (const t of ['Bäckerei', 'Bäckerei Auf', 'Bäckerei Auftrag']) { await page.evaluate(t => window.__sag([[t, false]]), t); await page.waitForTimeout(120); }
  l = await lage();
  ok('beim Sprechen laufen Striche durch den Balken', l.striche >= 3 && l.letzte.includes('st'), l);
  ok('… und die Striche sind verschieden hoch', new Set(l.hoehen).size >= 2, l.hoehen);
  ok('der Text wächst mit („Bäckerei Auftrag")', l.feld === 'Bäckerei Auftrag', l);

  await page.evaluate(() => { window.__sag([['Bäckerei Auftrag', true]]); window.__ereignis('speechend'); });
  await page.waitForTimeout(700);
  l = await lage();
  ok('in der Pause kommen Pünktchen nach (die neuesten Stellen sind Pünktchen)', l.sichtbar && l.letzte.every(c => c === 'pt') && l.striche > 0, l);
  ok('… und die Aufnahme läuft in der Pause weiter (noch nicht fertig)', l.knopf && l.suche === '', l);

  await page.waitForTimeout(2600);
  l = await lage();
  ok('nach einer längeren Pause endet sie von selbst', !l.sichtbar && !l.knopf, l);
  ok('… und dann wird gesucht: nur noch das passende Dokument', l.suche === 'Bäckerei Auftrag' && l.doks === 1, l);
  ok('… der Balken ist danach wieder leer (keine Striche stehen)', l.striche === 0, l);

  // zweiter Durchgang: „Fertig" beendet sofort, Endstand aus zwei Sätzen
  await page.click('#bibMic'); await page.waitForTimeout(150);
  await page.evaluate(() => { window.__ereignis('speechstart'); window.__sag([['Angebot', true], [' Tisch', false]]); });
  await page.waitForTimeout(150);
  l = await lage();
  ok('Endstand und Zwischenstand stehen zusammen im Feld', l.feld === 'Angebot Tisch', l);
  await page.click('.wfs-fertig'); await page.waitForTimeout(150);
  l = await lage();
  ok('„Fertig" beendet sofort und sucht', !l.sichtbar && l.suche === 'Angebot Tisch' && l.doks === 1, l);
  ok('für den zweiten Durchgang wurde eine neue Erkennung angelegt', l.rec === 2, l);

  // Mikrofon noch einmal tippen beendet ebenfalls
  await page.click('#bibMic'); await page.waitForTimeout(100);
  await page.click('#bibMic'); await page.waitForTimeout(120);
  l = await lage();
  ok('Mikrofon ein zweites Mal antippen beendet die Aufnahme', !l.sichtbar && !l.knopf && await page.evaluate(() => window.__rec[2].stops === 1), l);

  // Fehler wird gesagt
  await page.click('#bibMic'); await page.waitForTimeout(100);
  await page.evaluate(() => { window.__fehler = 'not-allowed'; window.__ereignis('error'); window.__ereignis('end'); });
  await page.waitForTimeout(150);
  ok('ein verweigertes Mikrofon wird gesagt, der Balken geht weg', await page.evaluate(() => /nicht erlaubt/.test(document.body.innerText) && document.querySelector('[data-wfs]').hidden));

  // ganz ohne Sprache: hört nach einer Weile von selbst auf, sucht nichts
  await page.fill('#bibSuche', ''); await page.evaluate(() => { window.__wfpdf.S.suche = ''; });
  await page.click('#bibMic');
  await page.waitForFunction(() => document.querySelector('[data-wfs]').hidden, null, { timeout: 12000 }).catch(() => {});
  l = await lage();
  ok('ohne jede Sprache hört sie nach einigen Sekunden von selbst auf', !l.sichtbar && !l.knopf, l);
  ok('… und sucht dann nichts', l.feld === '' && l.suche === '', l);

  // Englische Oberfläche: Englisch wird erkannt
  await page.evaluate(() => WFP.Sprache.setzen('en')); await page.waitForTimeout(100);
  await page.click('#bibMic'); await page.waitForTimeout(100);
  l = await lage();
  ok('bei englischer Oberfläche hört die Erkennung Englisch', l.lang === 'en-US', l);
  ok('… und der Balken spricht Englisch', await page.evaluate(() => /Listening/.test(document.querySelector('.wfs-status').textContent) && /Done/.test(document.querySelector('.wfs-fertig').textContent)));
  await page.click('.wfs-fertig'); await page.evaluate(() => WFP.Sprache.setzen('de'));

  // schmal (Handy): der Balken läuft nicht quer über den Rand
  await page.setViewportSize({ width: 360, height: 780 }); await page.waitForTimeout(100);
  await page.click('#bibMic'); await page.waitForTimeout(150);
  ok('am Handy (360 px) passt der Balken in die Breite', await page.evaluate(() => { const b = document.querySelector('[data-wfs]').getBoundingClientRect(); return b.width > 0 && b.right <= innerWidth + 1 && document.documentElement.scrollWidth <= innerWidth + 1; }));
  await page.click('.wfs-fertig');
  ok('keine Fehler auf der Seite', fehler.length === 0, fehler);
  await ctx.close();

  // Ein Browser ohne Spracherkennung: der Knopf bleibt stehen, ist aus und sagt warum
  const ctx2 = await browser.newContext();
  await ctx2.addInitScript(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; });
  const p2 = await ctx2.newPage(); await p2.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await p2.goto(url); await p2.waitForFunction(() => window.__wfpdf);
  ok('ohne Spracherkennung im Browser: Knopf aus, mit Grund, kein Balken', await p2.evaluate(() => { const k = document.getElementById('bibMic'); return k.disabled && /kann dieser Browser nicht/.test(k.title) && !document.querySelector('[data-wfs]'); }));
  await ctx2.close();
} catch (e) { rot++; console.log('  ✗ ROT: Probe lief nicht durch → ' + String(e && e.stack || e).slice(0, 600)); }
await browser.close(); srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
