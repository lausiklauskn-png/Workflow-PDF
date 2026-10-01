/* Workfloh PDF — Prüfung beim Einlesen (Klaus 2026-10-01), im echten Browser.
   „Schon wenn ich ein Foto mache, kann das ja passieren. Oder Importdatei." Gemessen an den
   Vorlagen des Auslieferungsprüfers (tests/eingang-vorlagen/, alle Angaben erfunden):
   - der Prüfkern ist byte-1:1 aus dem Auslieferungsprüfer (SHA-gepinnt; liegt ein Klon
     daneben, wird auch gegen ihn verglichen)
   - 0D (weißer 1-pt-Text), 1A als Bild und als Scan, 4C mit Botschaft → Warnung
   - 4C ohne, H0 (sauberes Foto), H2 (GPS + Anhängsel — in Kamerafotos normal), ein
     sauberes PDF → KEINE Warnung (die Gegenrichtung)
   - das Original bleibt Byte für Byte, wie es kam; nichts wird entfernt
   - die Karte zeigt die Marke, ein Tipp öffnet Fund, Stelle (bei Bildern) und „Was jetzt tun"
   - der Dialog erscheint nach dem Einlesen von selbst
   - ein Befund in einer fremden Arbeitsstand-Datei wird nicht geglaubt
   - fehlt der Prüfkern, heißt es „nicht ganz geprüft", nie still sauber
   - offen im Editor: das nächste Speichern überschreibt den Befund nicht
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };
console.log('Workfloh PDF — Prüfung beim Einlesen');

/* 1 · der Kern, byte-1:1 */
const PINS = {
  'pruefer-anhang.js': '10616efbb1a862ad989e2ac6b69c27d7d43e67ac1ae86b45e85b10097d7304d3',
  'pruefer-mail.js': '27e86606a3de4592100f20224eb955cb2f6e48339a82dc40e48fe309f8bdc989',
  'pruefer-formate.js': 'b057aa084f4b7821fce96f2b717ae51d183a0d8e3bcb67a08edc9fdfa3862a98'
};
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
for (const [n, s] of Object.entries(PINS)) ok('Kern byte-1:1 aus dem Auslieferungsprüfer: ' + n, sha(path.join(WURZEL, 'assets', n)) === s, sha(path.join(WURZEL, 'assets', n)));
const NACHBAR = path.resolve(WURZEL, '..', 'Auslieferung-Pruefer', 'assets');
if (fs.existsSync(NACHBAR)) for (const n of Object.keys(PINS)) ok('… und gleich dem Klon daneben: ' + n, sha(path.join(NACHBAR, n)) === sha(path.join(WURZEL, 'assets', n)));
const APP = fs.readFileSync(path.join(WURZEL, 'assets/app.js'), 'utf8');
ok('eigene Ausgaben (Übersetzung, Teil) werden nicht als Eingang geprüft', /EINGANG_QUELLEN = \['pdf', 'foto'\]/.test(APP));
const SW = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8');
ok('Kern und Klebstoff stehen im Offline-Vorrat (Einlesen geht auch ohne Netz)', ['eingang.js', 'pruefer-anhang.js', 'pruefer-mail.js', 'pruefer-formate.js'].every(n => SW.includes('./assets/' + n + '?v=')));

let pw = null, pdflib = null;
try { pw = await import('playwright-core'); pdflib = await import('pdf-lib'); } catch (_) {}
if (!pw || !pdflib) { console.log('  ⊘ nicht lauffähig (playwright-core/pdf-lib fehlt — npm install)'); console.log(`\n${gruen} grün · ${rot} ROT`); process.exitCode = rot ? 1 : 0; process.exit(); }
const { PDFDocument, StandardFonts } = pdflib;
const sauberPdf = await (async () => { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); d.addPage([595, 842]).drawText('Antrag auf Bewohnerparkausweis', { x: 60, y: 760, size: 16, font: f }); return Buffer.from(await d.save()); })();

const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
const V = n => fs.readFileSync(path.join(WURZEL, 'tests/eingang-vorlagen', n)).toString('base64');
const DATEIEN = {
  '0D.pdf': V('Vorlage-0D-PDF-versteckter-Text.pdf'), '1A.png': V('Vorlage-1A-Bild-mit-Text.png'), '1A-Scan.pdf': V('Vorlage-1A-PDF-Scan-ohne-Textebene.pdf'),
  '4C-mit.png': V('Vorlage-4C-Bild-mit-versteckter-Botschaft.png'), '4C-ohne.png': V('Vorlage-4C-Bild-ohne-Botschaft.png'),
  'H0.jpg': V('Vorlage-H0-Foto-sauber.jpg'), 'H2.jpg': V('Vorlage-H2-Foto-mit-GPS-Verweis-und-Anhaengsel.jpg'), 'Antrag.pdf': sauberPdf.toString('base64'),
  'Testbild.png': fs.readFileSync(path.join(WURZEL, 'beispiele/Testbild-versteckte-Anweisung.png')).toString('base64')
};
const neueSeite = async (sperre) => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (sperre) await page.route(sperre, r => r.abort());
  await page.goto(url); await page.waitForFunction(() => window.__wfpdf);
  return { ctx, page, fehler };
};
const einlesen = (page, namen, still = true) => page.evaluate(async ({ namen, B, still }) => {
  const files = namen.map(n => { const s = atob(B[n]); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
    return new File([u], n, { type: n.endsWith('.pdf') ? 'application/pdf' : n.endsWith('.png') ? 'image/png' : 'image/jpeg' }); });
  const neu = await window.__wfpdf.importDateien(files, null, { still });
  return neu.map(d => ({ id: d.id, name: d.name }));
}, { namen, B: Object.fromEntries(namen.map(n => [n, DATEIEN[n]])), still });
const warteFertig = page => page.waitForFunction(() => window.__wfpdf.eingang.PRUEF.laufend.size === 0, null, { timeout: 240000 });
const stand = (page, name) => page.evaluate(n => { const d = window.__wfpdf.S.docs.find(x => x.name === n); return d && d.pruefung ? { stand: d.pruefung.stand, arten: d.pruefung.funde.map(f => f.kennung), markiert: !!d.pruefung.markiert, hinweise: d.pruefung.hinweise } : null; }, name);

try {
  /* 2 · alle Vorlagen einlesen */
  const { ctx, page, fehler } = await neueSeite();
  const t0 = Date.now();
  await einlesen(page, Object.keys(DATEIEN));
  const laeuft = await page.evaluate(() => document.querySelectorAll('[data-pruefung="laeuft"]').length);
  ok('während der Prüfung trägt die Karte „wird geprüft"', laeuft > 0, laeuft);
  await warteFertig(page);
  console.log('    (alle Prüfungen zusammen ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s, Behälter)');
  const st = {};
  for (const n of Object.keys(DATEIEN)) st[n.replace(/\.[^.]+$/, '')] = await stand(page, n.replace(/\.[^.]+$/, ''));
  ok('0D (weißer 1-pt-Text im PDF) → Warnung', st['0D'] && st['0D'].stand === 'warnung' && st['0D'].arten.includes('PDF-VERSTECKTER-TEXT'), st['0D']);
  ok('… und die Anweisung darin wird als Anweisung an eine KI genannt', st['0D'] && st['0D'].arten.includes('PDF-KI-ANWEISUNG'), st['0D']);
  ok('1A als Foto → Anweisung im Bild', st['1A'] && st['1A'].stand === 'warnung' && st['1A'].arten.includes('BILD-KI-ANWEISUNG'), st['1A']);
  ok('… mit markierter Kopie der Stelle', st['1A'] && st['1A'].markiert, st['1A']);
  // Klaus' Testbild zum Herunterladen (beispiele/, gebaut von tools/testbild-bauen.mjs): die Zeile ist blass
  ok('Testbild zum Herunterladen → blasse Anweisung im Bild, mit markierter Kopie', st['Testbild'] && st['Testbild'].stand === 'warnung' && st['Testbild'].arten.includes('BILD-KI-ANWEISUNG') && st['Testbild'].markiert, st['Testbild']);
  ok('1A als Scan-PDF ohne Textebene → Anweisung gefunden', st['1A-Scan'] && st['1A-Scan'].stand === 'warnung' && st['1A-Scan'].arten.some(k => /KI-ANWEISUNG/.test(k)), st['1A-Scan']);
  ok('4C mit Botschaft in den Bildpunkten → Verdacht', st['4C-mit'] && st['4C-mit'].arten.includes('BILD-LSB-VERDACHT'), st['4C-mit']);
  ok('4C OHNE Botschaft → keine Warnung', st['4C-ohne'] && st['4C-ohne'].stand !== 'warnung', st['4C-ohne']);
  ok('H0 (sauberes Foto) → keine Warnung', st['H0'] && st['H0'].stand !== 'warnung', st['H0']);
  ok('H2 (GPS und Anhängsel, in Kamerafotos normal) → keine Warnung', st['H2'] && st['H2'].stand !== 'warnung', st['H2']);
  ok('ein sauberes PDF → sauber', st['Antrag'] && st['Antrag'].stand === 'sauber', st['Antrag']);

  /* 3 · nichts wird entfernt */
  const gleich = await page.evaluate(async (b64) => {
    const d = window.__wfpdf.S.docs.find(x => x.name === '0D'); const f = await WFP.DB.getFile(d.id);
    const u = new Uint8Array(f instanceof Blob ? await f.arrayBuffer() : f); const s = atob(b64);
    if (u.length !== s.length) return 'Länge ' + u.length + ' statt ' + s.length;
    for (let i = 0; i < u.length; i++) if (u[i] !== s.charCodeAt(i)) return 'Byte ' + i;
    return true;
  }, DATEIEN['0D.pdf']);
  ok('das Original bleibt Byte für Byte, wie es kam (nichts entfernt)', gleich === true, gleich);

  /* 4 · Marke, Dialog, Was jetzt tun */
  const auto = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-pruef-funde]')].length);
  ok('nach dem Einlesen öffnet sich der Dialog von selbst — genau einer, auch bei mehreren Funden', auto === 1, auto);
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(g => g.remove()));
  const marke = await page.evaluate(() => { const k = [...document.querySelectorAll('.dok')].find(d => d.querySelector('.dok-name').textContent.trim() === '0D'); const b = k && k.querySelector('[data-pruefung="warnung"]'); return b ? { text: b.textContent, sicht: b.checkVisibility() } : null; });
  ok('die Karte von 0D trägt die Marke „Verdächtiger Inhalt", sichtbar', marke && marke.sicht && /Verdächtig/.test(marke.text), marke);
  const sauberMarke = await page.evaluate(() => { const k = [...document.querySelectorAll('.dok')].find(d => d.querySelector('.dok-name').textContent.trim() === 'Antrag'); return k ? k.querySelectorAll('[data-pruefung]').length : -1; });
  ok('die Karte eines sauberen Dokuments trägt keine Marke', sauberMarke === 0, sauberMarke);
  await page.evaluate(() => { const k = [...document.querySelectorAll('.dok')].find(d => d.querySelector('.dok-name').textContent.trim() === '0D'); k.querySelector('[data-pruef]').click(); });
  await page.waitForSelector('.dlg [data-pruef-funde]');
  const dl = await page.evaluate(() => { const d = document.querySelector('.dlg'); return { funde: d.querySelectorAll('[data-pruef-funde] li').length, tun: d.querySelectorAll('[data-was-tun] li').length, tunText: (d.querySelector('[data-was-tun]') || {}).textContent || '', original: !!d.querySelector('[data-pruef-original]'), text: d.textContent }; });
  ok('ein Tipp auf die Marke öffnet den Fund', dl.funde >= 1, dl);
  ok('… mit „Was jetzt tun" (ruhig bleiben)', dl.tun >= 3 && /Ruhig bleiben/.test(dl.tunText), dl.tunText.slice(0, 200));
  ok('… und dem Satz, dass nichts entfernt wurde und beim Absender nachzufragen ist', dl.original && /Nichts wurde entfernt/.test(dl.text) && /Absender/.test(dl.text), dl.text.slice(0, 300));
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(g => g.remove()));
  await page.evaluate(() => { const k = [...document.querySelectorAll('.dok')].find(d => d.querySelector('.dok-name').textContent.trim() === '1A'); k.querySelector('[data-pruef]').click(); });
  await page.waitForSelector('.dlg [data-pruef-funde]');
  const bild = await page.evaluate(() => { const i = document.querySelector('.dlg [data-pruef-markiert] img'); return i ? { breit: i.naturalWidth, sicht: i.checkVisibility(), knopf: !!document.querySelector('.dlg [data-markiert-laden]') } : null; });
  ok('bei einem Bild zeigt der Dialog die markierte Stelle samt Knopf zum Speichern', bild && bild.breit > 100 && bild.sicht && bild.knopf, bild);
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(g => g.remove()));
  ok('keine Fehler auf der Seite', fehler.length === 0, fehler);

  /* 5 · Arbeitsstand-Datei mit erfundenem „sauber" */
  const stand2 = await page.evaluate(async (b64) => {
    const d = { id: 'fremd1', name: 'Fremder Stand', folderId: null, quelle: 'pdf', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), pages: [{ w: 595, h: 842 }, { w: 595, h: 842 }], fields: [],
      pruefung: { stand: 'sauber', funde: [], hinweise: [], zeit: new Date().toISOString() } };
    const f = new File([JSON.stringify({ format: 'workfloh-pdf-arbeitsstand', version: 1, gesichert: d.updatedAt, doc: d, pdf: b64 })], 'x.workfloh.json', { type: 'application/json' });
    await window.__wfpdf.importDateien([f], null, { still: true });
    return true;
  }, DATEIEN['0D.pdf']);
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(g => g.remove()));
  await warteFertig(page);
  const fremd = await stand(page, 'Fremder Stand');
  ok('ein „sauber" in einer fremden Arbeitsstand-Datei wird nicht geglaubt: neu geprüft → Warnung', stand2 && fremd && fremd.stand === 'warnung', fremd);
  await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(g => g.remove()));

  /* 6 · offen im Editor: Speichern überschreibt den Befund nicht */
  await einlesen(page, ['0D.pdf'], false);
  await page.waitForFunction(() => window.__wfpdf.S.doc);
  await warteFertig(page);
  const ed = await page.evaluate(async () => { const id = window.__wfpdf.S.doc.id; window.__wfpdf.S.doc.name = window.__wfpdf.S.doc.name; await window.__wfpdf.speichernJetzt?.(); const d = await WFP.DB.get("docs", id); return { amDoc: window.__wfpdf.S.doc.pruefung && window.__wfpdf.S.doc.pruefung.stand, inDb: d.pruefung && d.pruefung.stand }; });
  ok('im offenen Editor bekommt das Dokument den Befund, und gespeichert bleibt er', ed.amDoc === 'warnung' && ed.inDb === 'warnung', ed);
  await ctx.close();

  /* 7 · ohne Prüfkern: nie still sauber */
  const b = await neueSeite(/pruefer-anhang\.js/);
  await einlesen(b.page, ['Antrag.pdf']);
  await warteFertig(b.page);
  const ohne = await stand(b.page, 'Antrag');
  ok('fehlt der Prüfkern, heißt es „nicht ganz geprüft" mit Grund, nie sauber', ohne && ohne.stand === 'ungeprueft' && ohne.hinweise.some(x => /lief nicht/.test(x)), ohne);
  const um = await b.page.evaluate(() => { const k = document.querySelector('[data-pruefung="ungeprueft"]'); return k ? k.textContent : null; });
  ok('… und die Karte sagt das', um && /Nicht ganz geprüft/.test(um), um);
  await b.ctx.close();
  /* 9 · Hilfe → Testdateien (Klaus 2026-10-01): ein Tipp liest sie ein, die Warnung erscheint */
  {
    const { ctx, page, fehler } = await neueSeite();
    await page.evaluate(() => window.__wfpdf.dlg.hilfe());
    const knoepfe = await page.evaluate(() => ({ bild: !!document.querySelector('.dlg [data-test-bild]'), pdf: !!document.querySelector('.dlg [data-test-pdf]'), laden: (document.querySelector('.dlg [data-test-laden]') || {}).getAttribute?.('href'), text: document.querySelector('.dlg').textContent }));
    ok('Hilfe: Abschnitt „Versteckte Befehle erkennen" mit zwei Testdateien und Download', knoepfe.bild && knoepfe.pdf && knoepfe.laden === 'beispiele/Testbild-versteckte-Anweisung.png' && /Versteckte Befehle erkennen/.test(knoepfe.text) && /rot markiert, nicht gelöscht/.test(knoepfe.text), knoepfe.laden);
    await page.click('.dlg [data-test-bild]');
    await page.waitForFunction(() => window.__wfpdf.S.docs.some(d => /Testbild/.test(d.name)), null, { timeout: 30000 });
    await warteFertig(page);
    const w = await page.waitForSelector('.dlg [data-pruef-funde]', { timeout: 30000 }).then(() => page.evaluate(() => ({ text: document.querySelector('.dlg').textContent, bild: !!document.querySelector('.dlg [data-pruef-markiert] img') })), () => null);
    ok('Hilfe → 🧪 Bild: eingelesen, die Warnung öffnet sich mit markierter Stelle', w && /Anweisung an eine KI im Bild/.test(w.text) && w.bild, w && w.text.slice(0, 200));
    await page.evaluate(() => document.querySelectorAll('.dlg-grund').forEach(g => g.remove()));
    await page.evaluate(() => window.__wfpdf.dlg.hilfe());
    await page.click('.dlg [data-test-pdf]');
    await page.waitForFunction(() => window.__wfpdf.S.docs.some(d => /unsichtbarer/.test(d.name)), null, { timeout: 30000 });
    await warteFertig(page);
    const st = await stand(page, 'Testdatei unsichtbarer Text');
    ok('Hilfe → 🧪 PDF: unsichtbarer Text wird gemeldet', st && st.stand === 'warnung' && st.arten.includes('PDF-VERSTECKTER-TEXT'), st);
    ok('keine Seitenfehler (Testdateien)', fehler.length === 0, fehler);
    await ctx.close();
  }
} catch (e) { ok('Probe lief durch', false, String(e && e.stack || e)); }
await browser.close(); srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
