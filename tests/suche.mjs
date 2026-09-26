/* Workfloh PDF — Suche, Stufe 1 (Klaus 2026-09-26).
   Teil A (ohne Browser): die Rechnung in assets/suche.js — Umlaute, Nummern, Daten, UND.
   Teil B (echter Browser): zwei erfundene PDFs einlesen, suchen, die Fundstelle markiert
   sehen, antippen blendet sie aus. Nur erfundene Daten.
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

/* ---------- Teil A: die Rechnung ---------- */
console.log('Workfloh PDF — Suche');
await import(pathToFileURL(path.join(WURZEL, 'assets/suche.js')).href);
const SU = globalThis.__WFP_SUCHE;
const passt = (q, text) => { const t = SU.anfrage(q), b = SU.bereite(text); return t.length > 0 && t.every(x => SU.trifft(x, b)); };
ok('Umlaut: „Mueller" findet „Müller"', passt('Mueller', 'Bäckerei Müller'));
ok('Umlaut: „muller" findet „Müller"', passt('muller', 'Bäckerei Müller'));
ok('Umlaut: „Müller" findet „MUELLER"', passt('Müller', 'MUELLER GMBH'));
ok('ß: „Strasse" findet „Straße"', passt('Strasse', 'Hauptstraße 5'));
ok('Nummer: „kd4711" findet „KD-4711"', passt('kd4711', 'Kundennummer KD-4711'));
ok('Nummer: „KD-4711" findet „KD 4711"', passt('KD-4711', 'Kunde KD 4711'));
ok('Datum: „3.9.2026" findet „03.09.2026"', passt('3.9.2026', 'Datum: 03.09.2026'));
ok('Datum: „2026-09-03" findet „03.09.26"', passt('2026-09-03', 'am 03.09.26 geliefert'));
ok('Datum ohne Jahr: „03.09." findet „3.9.2026"', passt('03.09.', 'Termin 3.9.2026'));
ok('Datum: „03.09.2026" findet NICHT „04.09.2026"', !passt('03.09.2026', 'Termin 04.09.2026'));
ok('Datum: ein ungültiges Datum (31.13.) ist kein Datum', !SU.datumVonWort('31.13.2026') && SU.daten('31.13.2026').length === 0);
ok('Kyrillisch bleibt suchbar', passt('Москва', 'Адрес: Москва, ул. Ленина'));
ok('leere Suche ergibt keine Suchwörter', SU.anfrage('   ').length === 0 && SU.anfrage('- · ,').length === 0);
const dok = { name: 'Auftrag', fields: [{ id: 'f1', label: 'Kundennummer', value: 'KD-4711', page: 0, x: 10, y: 10, w: 20, h: 3 }] };
const seiten = SU.vorbereiten([[['Kunde:', 10, 20, 8, 2], ['Bäckerei Müller', 20, 20, 20, 2]], [['Rechnung', 10, 10, 15, 2]]]);
const r1 = SU.sucheDok(dok, seiten, SU.anfrage('müller rechnung'));
ok('mehrere Wörter: jedes darf auf einer anderen Seite stehen', r1 && r1.funde.some(f => f.page === 0) && r1.funde.some(f => f.page === 1), r1);
ok('mehrere Wörter: fehlt eines, passt das Dokument nicht (UND)', SU.sucheDok(dok, seiten, SU.anfrage('müller schmidt')) === null);
const r2 = SU.sucheDok(dok, seiten, SU.anfrage('kd4711'));
ok('ein Feld-Treffer trägt Feld, Seite und Lage', r2 && r2.funde[0].art === 'feld' && r2.funde[0].feldId === 'f1' && r2.funde[0].boxen[0].x === 10, r2);
const r3 = SU.sucheDok(dok, seiten, SU.anfrage('müller'));
ok('ein Seiten-Treffer trägt die Lage des Textstücks', r3 && r3.funde[0].art === 'seite' && r3.funde[0].boxen[0].x === 20 && r3.funde[0].boxen[0].w === 20, r3);
const zwei = SU.vorbereiten([[['Nr. KD-', 10, 30, 10, 2], ['4711', 21, 30, 5, 2]]]);
const r4 = SU.sucheDok({ name: 'x', fields: [] }, zwei, SU.anfrage('KD-4711'));
ok('ein Wort über zwei Textstücke wird markiert (Hülle beider)', r4 && r4.funde[0].boxen.length === 1 && r4.funde[0].boxen[0].x === 10 && Math.abs(r4.funde[0].boxen[0].w - 16) < 0.01, r4);
ok('ohne Seitentext sucht es trotzdem in Name und Feldern', !!SU.sucheDok(dok, null, SU.anfrage('KD 4711')));

/* ---------- Teil B: im Browser ---------- */
let pw = null, pdflib = null;
try { pw = await import('playwright-core'); pdflib = await import('pdf-lib'); } catch (_) {}
if (!pw || !pdflib) { console.log('  ⊘ Teil B nicht lauffähig (playwright-core/pdf-lib fehlt — npm install)'); }
else {
  const { PDFDocument, StandardFonts } = pdflib;
  async function auftrag() {
    const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
    const p = pdf.addPage([595.28, 841.89]);
    p.drawText('Auftrag A-2026-0815', { x: 60, y: 780, size: 18, font: f });
    p.drawText('Kunde: Bäckerei Müller', { x: 60, y: 700, size: 12, font: f });
    p.drawText('Datum: 03.09.2026', { x: 60, y: 670, size: 12, font: f });
    p.drawText('Leistung: Schaufensterfolie montiert', { x: 60, y: 640, size: 12, font: f });
    const p2 = pdf.addPage([595.28, 841.89]);
    p2.drawText('Rechnung zu Kunde KD-', { x: 60, y: 780, size: 12, font: f });
    p2.drawText('4711', { x: 60 + f.widthOfTextAtSize('Rechnung zu Kunde KD-', 12), y: 780, size: 12, font: f });
    return pdf.save();
  }
  async function anderes() {
    const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
    const p = pdf.addPage([595.28, 841.89]);
    p.drawText('Angebot Tischlerei Schmidt', { x: 60, y: 780, size: 18, font: f });
    p.drawText('Datum: 04.09.2026', { x: 60, y: 700, size: 12, font: f });
    return pdf.save();
  }
  const TMP = fs.mkdtempSync('/tmp/wfpdf-suche-');
  fs.writeFileSync(path.join(TMP, 'Auftrag Beispiel.pdf'), await auftrag());
  fs.writeFileSync(path.join(TMP, 'Angebot Beispiel.pdf'), await anderes());

  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
  const srv = await new Promise(res => { const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }); s.listen(0, '127.0.0.1', () => res(s)); });
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const suche = async q => { await page.fill('#bibSuche', q); await page.waitForTimeout(80);
    return page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok')].map(d => ({ name: d.querySelector('.dok-name').textContent, fund: [...d.querySelectorAll('.fund-zeile')].map(z => z.textContent.trim()) }))); };
  try {
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    await page.waitForFunction(() => window.__wfpdf);
    await page.setInputFiles('#inDatei', [path.join(TMP, 'Auftrag Beispiel.pdf'), path.join(TMP, 'Angebot Beispiel.pdf')]);
    await page.waitForFunction(() => window.__wfpdf.S.docs.length === 2, null, { timeout: 30000 });
    await page.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });
    await page.waitForFunction(() => window.__wfpdf.S.docs.every(d => window.__wfpdf.suche.TEXTE.has(d.id)), null, { timeout: 30000 });
    ok('beim Einlesen wird der Seitentext erfasst', true);

    let r = await suche('Mueller');
    ok('Bibliothek: „Mueller" findet das Dokument über seinen SEITENTEXT', r.length === 1 && /Auftrag/.test(r[0].name), r);
    ok('Bibliothek: die Fundstelle sagt, wo — „Auf Seite 1" und der Text', r[0] && r[0].fund.some(z => /^Auf Seite 1/.test(z) && /Müller/.test(z)), r);
    r = await suche('kd4711');
    ok('Bibliothek: „kd4711" findet „KD-" | „4711" auf Seite 2', r.length === 1 && r[0].fund.some(z => /^Auf Seite 2/.test(z)), r);
    r = await suche('03.09.');
    ok('Bibliothek: ein Datum ohne Jahr trifft nur das richtige Dokument', r.length === 1 && /Auftrag/.test(r[0].name), r);
    r = await suche('Müller 2026-09-03');
    ok('Bibliothek: Kundenname + Datum (anders geschrieben) finden den Auftrag', r.length === 1 && /Auftrag/.test(r[0].name), r);
    r = await suche('Müller Schmidt');
    ok('Bibliothek: zwei Wörter aus zwei Dokumenten → keins (UND)', r.length === 0 && await page.$('[data-suchleer]') !== null, r);
    r = await suche('schaufenster');
    ok('Bibliothek: ein Wortteil genügt („schaufenster" in „Schaufensterfolie")', r.length === 1, r);

    // Öffnen aus der Suche: markiert
    // zwei Wörter → zwei Markierungen: nach dem Antippen bleibt eine stehen, sonst misst
    // „ohne Suche geöffnet → keine Markierung" weiter unten nichts
    await suche('Müller 03.09.2026');
    await page.click('#dokGitter .dok [data-fundzeilen]');
    // auf die Seite warten, nicht auf die Markierung — fehlt sie, meldet es die Prüfung mit Namen statt eines Zeitablaufs
    await page.waitForSelector('#sc-ed.on .seite canvas', { timeout: 30000 }); await page.waitForTimeout(150);
    const marke = await page.evaluate(() => { const m = document.querySelector('.seite[data-i="0"] .fund'); return m && { x: parseFloat(m.style.left), y: parseFloat(m.style.top), n: document.querySelectorAll('.fund').length }; });
    ok('Editor: die Fundstelle ist auf Seite 1 markiert, dort wo „Müller" steht', marke && marke.x > 8 && marke.x < 12 && marke.y > 13 && marke.y < 18, marke);
    if (marke) await page.click('.seite[data-i="0"] .fund');
    const nach = await page.evaluate(() => ({ dom: document.querySelectorAll('.fund').length, s: window.__wfpdf.S.funde.length }));
    ok('Editor: antippen blendet genau diese Markierung aus', !!marke && nach.dom === marke.n - 1 && nach.s === marke.n - 1, { marke, nach });
    ok('Editor: nach dem Antippen steht noch eine Markierung (Vorbedingung für die Prüfungen danach)', nach.s >= 1, nach);
    await page.click('#mBearbeiten'); await page.waitForTimeout(100); await page.click('#mAusfuellen'); await page.waitForTimeout(100);
    ok('Editor: eine ausgeblendete Markierung kommt beim Umschalten nicht wieder', await page.evaluate(() => document.querySelectorAll('.fund').length) === nach.dom);
    await page.click('#flohKnopf'); await page.waitForSelector('#sc-bib.on');
    await page.fill('#bibSuche', ''); await page.waitForTimeout(80);
    await page.evaluate(() => window.__wfpdf.oeffneDok(window.__wfpdf.S.docs.find(d => /Auftrag/.test(d.name)).id));
    await page.waitForSelector('#sc-ed.on .seite canvas');
    ok('Editor: ohne Suche geöffnet → keine Markierung', await page.evaluate(() => document.querySelectorAll('.fund').length) === 0);
    await page.click('#flohKnopf'); await page.waitForSelector('#sc-bib.on');

    // Ein neues Byte-Stück wirft den alten Text weg; nachgeholt wird er von selbst
    const weg = await page.evaluate(async () => { const w = window.__wfpdf, id = w.S.docs[0].id; const b = await WFP.DB.getFile(id); await WFP.DB.putFile(id, b); return !(await WFP.DB.get('texte', id)); });
    ok('Speicher: neue Bytes werfen den alten Seitentext weg', weg);
    // Wie ein Dokument aus der Zeit vor der Suche: kein Seitentext — Hinweis, dann nachgeholt
    await page.evaluate(async () => { const w = window.__wfpdf; for (const d of w.S.docs) { await WFP.DB.del('texte', d.id); w.suche.TEXTE.delete(d.id); } });
    await page.fill('#bibSuche', 'Mueller'); await page.waitForTimeout(30);
    ok('Bibliothek: fehlt der Seitentext noch, sagt die Suche das', await page.evaluate(() => !!document.querySelector('[data-suchstand]')));
    await page.evaluate(() => window.__wfpdf.suche.texteNachholen());
    await page.waitForFunction(() => window.__wfpdf.S.docs.every(d => window.__wfpdf.suche.TEXTE.has(d.id)), null, { timeout: 30000 });
    await page.fill('#bibSuche', 'x'); await page.fill('#bibSuche', 'Mueller'); await page.waitForTimeout(80);
    ok('Bibliothek: nachgeholter Seitentext wird gefunden, der Hinweis ist weg', await page.evaluate(() => document.querySelectorAll('#dokGitter .dok').length === 1 && !document.querySelector('[data-suchstand]')));
    await page.reload(); await page.waitForFunction(() => window.__wfpdf && window.__wfpdf.S.docs.length === 2);
    await page.waitForFunction(() => window.__wfpdf.S.docs.every(d => window.__wfpdf.suche.TEXTE.has(d.id)), null, { timeout: 30000 });
    r = await suche('kd 4711');
    ok('nach dem Neuladen: der Seitentext kommt aus dem Speicher', r.length === 1, r);
    ok('kein Seitenfehler', !fehler.length, fehler);
  } catch (e) { ok('Probe lief durch', false, String(e.stack || e).slice(0, 800)); }
  await browser.close(); srv.close();
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
