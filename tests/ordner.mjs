/* Workfloh PDF — Sortierung der Bibliothek und Ordner als Ganzes ausgeben (Klaus 2026-09-26).
   „Seite 1 bis 40 als erstes, dann Seite 41 bis 81 … nach Dateinamen geordnet oder nach
   Dateigröße" · „dass der Ordner als Ganzes mit den integrierten PDFs freigegeben werden kann
   oder ausgegeben werden kann". Nur erfundene Daten. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

// A. Die ZIP-Rechnung ohne Browser
await import(path.join(WURZEL, 'assets/zip.js'));
const Z = globalThis.WFP.Zip;
ok('CRC32 der Prüfzeichenkette „123456789" = cbf43926', Z.crc32(new TextEncoder().encode('123456789')) === 0xcbf43926);
ok('gleiche Namen im ZIP werden unterschieden („a.pdf", „a (2).pdf")', JSON.stringify(Z.eindeutig(['a.pdf', 'A.pdf', 'b.pdf'])) === JSON.stringify(['a.pdf', 'A (2).pdf', 'b.pdf']), Z.eindeutig(['a.pdf', 'A.pdf', 'b.pdf']));

// Ein ZIP ohne Bibliothek lesen: jeder Eintrag mit Name, Bytes und geprüfter Prüfsumme.
function zipLesen(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength), out = [];
  let p = 0;
  while (p + 4 <= buf.length && v.getUint32(p, true) === 0x04034b50) {
    const methode = v.getUint16(p + 8, true), crc = v.getUint32(p + 14, true), gr = v.getUint32(p + 18, true);
    const nl = v.getUint16(p + 26, true), xl = v.getUint16(p + 28, true), flags = v.getUint16(p + 6, true);
    const name = new TextDecoder().decode(buf.subarray(p + 30, p + 30 + nl));
    const daten = buf.subarray(p + 30 + nl + xl, p + 30 + nl + xl + gr);
    out.push({ name, methode, utf8: !!(flags & 0x800), crcOk: zlib.crc32(daten) === crc, daten });
    p += 30 + nl + xl + gr;
  }
  const ende = buf.length - 22;
  // Das Verzeichnis am Ende muss dorthin zeigen, wo es wirklich beginnt — sonst öffnet kein Entpacker die Datei.
  return { eintraege: out, endeOk: ende >= 0 && v.getUint32(ende, true) === 0x06054b50 && v.getUint16(ende + 10, true) === out.length && v.getUint32(ende + 16, true) === p && v.getUint32(p, true) === 0x02014b50 };
}

async function teil(titel, seiten, fuell = 0) {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= seiten; i++) {
    const s = pdf.addPage([595.28, 841.89]);
    s.drawText(titel + ' Blatt ' + i + '.', { x: 60, y: 760, size: 14, font: f });
    for (let k = 0; k < fuell; k++) s.drawText('Fuelltext ' + k + ' ' + 'x'.repeat(80), { x: 60, y: 700 - (k % 40) * 15, size: 8, font: f });
  }
  return pdf.save({ useObjectStreams: false });
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

// Absichtlich in falscher Reihenfolge und so, dass Name, Größe und Seitenzahl verschieden ordnen.
const TMP = fs.mkdtempSync('/tmp/wfpdf-ordner-');
const DATEIEN = [
  ['Buch Teil 10 (S. 361-384).pdf', 'Teil zehn', 3, 0],
  ['Buch Teil 2 (S. 41-80).pdf', 'Teil zwei', 2, 120],
  ['Buch Teil 1 (S. 1-40).pdf', 'Teil eins', 1, 0],
];
const ORIG = {};
for (const [n, t, s, f] of DATEIEN) { const b = await teil(t, s, f); ORIG[n.replace(/\.pdf$/, '')] = b; fs.writeFileSync(path.join(TMP, n), b); }

const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(String(e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
const reihe = () => page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok .dok-name')].map(e => e.textContent.trim()));
const NAME = ['Buch Teil 1 (S. 1-40)', 'Buch Teil 2 (S. 41-80)', 'Buch Teil 10 (S. 361-384)'];

try {
  console.log('Workfloh PDF — Sortierung und Ordner-Ausgabe, Probe im Browser');
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.Zip);

  // B. Einlesen als Ordner — die Einlese-Reihenfolge ist schon natürlich
  await page.evaluate(async list => {
    const files = list.map(([n, b64]) => new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], n, { type: 'application/pdf' }));
    await window.__wfpdf.importDateien(files, 'Buch · RU');
  }, DATEIEN.map(([n]) => [n, Buffer.from(fs.readFileSync(path.join(TMP, n))).toString('base64')]));
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 3, null, { timeout: 30000 });
  const eingelesen = await page.evaluate(() => window.__wfpdf.S.docs.slice().sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')).map(d => d.name));
  ok('Einlesen: Teil 1, Teil 2, Teil 10 — nicht „1, 10, 2"', JSON.stringify(eingelesen) === JSON.stringify(NAME), eingelesen);
  await page.evaluate(() => { const w = window.__wfpdf; if (document.querySelector('#sc-ed.on')) document.querySelector('#edZurueck').click(); });
  await page.waitForSelector('#sc-bib.on');
  await page.evaluate(() => { const w = window.__wfpdf; w.S.aktOrdner = w.S.ordner.find(o => o.name === 'Buch · RU').id; w.EINST.sortierung = 'name'; w.einstSpeichern(); w.suche.zeichneBibliothek(); });

  // C. Sortierung in der Ansicht
  ok('Sortier-Auswahl steht über der Liste, vorgewählt „Name (1, 2 … 10)"', await page.evaluate(() => { const s = document.querySelector('[data-sort]'); return !!s && s.value === 'name' && s.options.length === 4; }));
  ok('nach Name: Teil 1, Teil 2, Teil 10', JSON.stringify(await reihe()) === JSON.stringify(NAME), await reihe());
  await page.selectOption('[data-sort]', 'seiten');
  ok('nach Seitenzahl: 3, 2, 1 Seiten (Teil 10, 2, 1)', JSON.stringify(await reihe()) === JSON.stringify([NAME[2], NAME[1], NAME[0]]), await reihe());
  await page.selectOption('[data-sort]', 'groesse');
  const groesseOk = await page.waitForFunction(n => [...document.querySelectorAll('#dokGitter .dok .dok-name')][0]?.textContent.trim() === n, NAME[1], { timeout: 8000 }).then(() => true, () => false);
  ok('nach Dateigröße: der dicke Teil 2 zuerst', groesseOk, await reihe());
  ok('… und die Größe steht an jeder Karte', await page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok-meta')].every(m => / (KB|MB)/.test(m.textContent))));
  await page.selectOption('[data-sort]', 'seiten');
  await page.reload(); await page.waitForFunction(() => window.__wfpdf && window.__wfpdf.S.docs.length === 3);
  ok('die Wahl übersteht das Neuladen (Einstellungen)', await page.evaluate(() => window.__wfpdf.EINST.sortierung === 'seiten'));
  await page.evaluate(() => { const w = window.__wfpdf; w.S.aktOrdner = w.S.ordner.find(o => o.name === 'Buch · RU').id; w.EINST.sortierung = 'name'; w.einstSpeichern(); w.suche.zeichneBibliothek(); });

  // D. Ordner ausgeben — ZIP, Original unverändert
  const ausgabe = async (weg, m) => {
    await page.click('[data-ausgabe]'); await page.waitForSelector('.dlg [data-weg]');
    const liste = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-liste] li')].map(l => l.textContent.trim()));
    await page.selectOption('.dlg [data-m]', m);
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click(`.dlg [data-weg="${weg}"]`)]);
    const buf = new Uint8Array(fs.readFileSync(await dl.path()));
    await page.waitForSelector('.dlg [data-x]'); const bericht = await page.textContent('.dlg'); await page.click('.dlg [data-x]');
    // Der Name wird dort gelesen, wo die App ihn festlegt: dieses Chromium meldet für JEDEN
    // Dateinamen mit einem Zeichen außerhalb von ASCII („·", Umlaut, Kyrillisch) nur „download"
    // (nachgestellt an einer leeren Seite, 2026-09-26). Was ein Tablet daraus macht: ungemessen.
    const name = await page.evaluate(() => window.__wfpdfOrdnerAusgabe.dateien[0].name);
    return { liste, name, buf, bericht, groesse: await page.evaluate(() => window.__wfpdfOrdnerAusgabe.dateien[0].groesse) };
  };
  ok('„📤 Ordner ausgeben" steht beim gewählten Ordner', await page.evaluate(() => !!document.querySelector('[data-ausgabe]')));
  const z = await ausgabe('zip', 'original');
  ok('der Dialog zeigt die Reihenfolge der Bibliothek', JSON.stringify(z.liste) === JSON.stringify(NAME), z.liste);
  ok('ZIP heißt wie der Ordner, und das Heruntergeladene ist genau diese Datei', z.name === 'Buch · RU.zip' && z.groesse === z.buf.length, [z.name, z.groesse, z.buf.length]);
  const zi = zipLesen(z.buf);
  ok('ZIP ist gültig: 3 Einträge, Verzeichnis am Ende, jede Prüfsumme stimmt', zi.eintraege.length === 3 && zi.endeOk && zi.eintraege.every(e => e.crcOk && e.methode === 0), zi.eintraege.map(e => [e.name, e.crcOk]));
  ok('… Einträge in der Reihenfolge Teil 1, 2, 10, Namen mit UTF-8-Marke', JSON.stringify(zi.eintraege.map(e => e.name)) === JSON.stringify(NAME.map(n => n + '.pdf')) && zi.eintraege.every(e => e.utf8), zi.eintraege.map(e => e.name));
  ok('… „Original, unverändert" liefert die eingelesenen Bytes', zi.eintraege.every(e => Buffer.compare(Buffer.from(e.daten), Buffer.from(ORIG[e.name.replace(/\.pdf$/, '')])) === 0));
  ok('… der Bericht nennt die Datei mit Größe', /Buch · RU\.zip/.test(z.bericht) && / (KB|MB)/.test(z.bericht), z.bericht.slice(0, 200));

  // E. Zu einem PDF zusammenfügen — Seiten in der gewählten Reihenfolge
  const e = await ausgabe('eins', 'fest');
  const ep = await PDFDocument.load(e.buf);
  ok('ein PDF, benannt wie der Ordner, mit 1 + 2 + 3 = 6 Seiten', e.name === 'Buch · RU.pdf' && ep.getPageCount() === 6, [e.name, ep.getPageCount()]);
  const texte = await page.evaluate(async b64 => {
    const pdf = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }).promise, out = [];
    for (let i = 1; i <= pdf.numPages; i++) out.push((await (await pdf.getPage(i)).getTextContent()).items.map(t => t.str).join(' ').trim());
    pdf.destroy(); return out;
  }, Buffer.from(e.buf).toString('base64'));
  const soll = ['Teil eins Blatt 1.', 'Teil zwei Blatt 1.', 'Teil zwei Blatt 2.', 'Teil zehn Blatt 1.', 'Teil zehn Blatt 2.', 'Teil zehn Blatt 3.'];
  ok('… Seiten in der Reihenfolge Teil 1, Teil 2, Teil 10', soll.every((s, i) => (texte[i] || '').startsWith(s)), texte.map(t => t.slice(0, 20)));

  // F. Nach Seitenzahl sortiert folgt die Ausgabe dieser Sortierung
  await page.evaluate(() => { const w = window.__wfpdf; w.EINST.sortierung = 'seiten'; w.suche.zeichneBibliothek(); });
  const s2 = await ausgabe('zip', 'fest');
  ok('Sortierung „Seitenzahl" → ZIP beginnt mit Teil 10', zipLesen(s2.buf).eintraege[0]?.name === NAME[2] + '.pdf', zipLesen(s2.buf).eintraege.map(x => x.name));
  ok('… „festes PDF" ist neu gebaut, nicht das Original', zipLesen(s2.buf).eintraege.every(x => Buffer.from(x.daten).subarray(0, 5).toString() === '%PDF-'));

  ok('keine Fehler auf der Konsole', konsole.length === 0, konsole);
} catch (e) { rot++; console.log('  ✗ ROT: Probe ist gestolpert → ' + (e.stack || e)); }
await browser.close(); srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
