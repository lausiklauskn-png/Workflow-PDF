/* Workfloh PDF — die Bibliothek sichern und zurückholen (Klaus 2026-10-02).
   „Workflow soll dasselbe bekommen. Dieselbe Sicherung." Nur erfundene Daten.
   Teil A ohne Browser: das Schloss ist byte-1:1, die Rechnung hält in beide Richtungen.
   Teil B im Browser: der ganze Weg wie ein Nutzer — sichern, Bibliothek leeren, falsches
   Passwort, zurückholen, ein zweites Mal zurückholen überschreibt nichts. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WURZEL = process.env.WF_WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

/* Das Schloss ist byte-1:1 aus kim-hub-company (über den Sende-Prüfer). Nie hier abwandeln. */
const TRESOR_SHA = 'eaed30e8f3921835a3f58b69f89d9b008831f69f164ad1dfec630fa43161f666';

console.log('Workfloh PDF — Sicherung');
console.log('A · ohne Browser');
const tresorCode = fs.readFileSync(path.join(WURZEL, 'assets/schluesseltresor.js'));
ok('das Schloss ist byte-1:1 (SHA-256 gepinnt)', crypto.createHash('sha256').update(tresorCode).digest('hex') === TRESOR_SHA);
vm.runInThisContext(tresorCode.toString(), { filename: 'schluesseltresor.js' });
vm.runInThisContext(fs.readFileSync(path.join(WURZEL, 'assets/sicherung.js'), 'utf8'), { filename: 'sicherung.js' });
const SI = globalThis.WFP && globalThis.WFP.Sicherung;
ok('WFP.Sicherung steht bereit', !!SI && !!globalThis.WERKSTATT_SCHLUESSEL);

/* Eine gestellte Speicher-Naht mit derselben Oberfläche wie WFP.DB. */
function falscheDB() {
  const st = { folders: new Map(), docs: new Map(), files: new Map() };
  return {
    st,
    all: async s => [...st[s].values()].map(x => structuredClone(x)),
    get: async (s, id) => st[s].get(id),
    put: async (s, o) => { st[s].set(o.id, structuredClone(o)); },
    getFile: async id => st.files.has(id) ? st.files.get(id) : null,
    putFile: async (id, b) => { st.files.set(id, new Uint8Array(b)); },
  };
}
const GEHEIM = 'Erfundene-Mieterin-Quast-4711';
const quelle = falscheDB();
await quelle.put('folders', { id: 'o1', name: 'Verträge' });
await quelle.put('docs', { id: 'd1', name: GEHEIM, folderId: 'o1', fields: [{ id: 'f1', value: 'DE89370400440532013000' }], pruefung: { stand: 'sauber' } });
await quelle.putFile('d1', new TextEncoder().encode('%PDF-1.4 erfunden ' + GEHEIM));
await quelle.put('docs', { id: 'd2', name: 'Ohne Datei', folderId: null, fields: [] });

const r = await SI.verschliessen('richtig-langes-Passwort', quelle);
const text = JSON.stringify(r.datei);
ok('die Datei trägt Art und Fassung', r.datei.art === 'workfloh-pdf-sicherung' && r.datei.fassung === 1);
ok('in der Datei steht KEIN Klartext (Name, IBAN, PDF-Inhalt)', !text.includes(GEHEIM) && !text.includes('DE8937040044') && !text.includes('PDF-1.4'), text.slice(0, 200));
ok('ein Dokument ohne Datei wird gezählt, nicht verschwiegen', r.ohneDatei === 1 && r.docs === 2, r);

let fehler = null; try { await SI.oeffnen('falsches-Passwort-123', r.datei); } catch (e) { fehler = e.message; }
ok('falsches Passwort → „passwort"', fehler === 'passwort', fehler);
fehler = null; try { await SI.oeffnen('x', { art: 'etwas-anderes' }); } catch (e) { fehler = e.message; }
ok('fremde Datei → „keine-sicherung"', fehler === 'keine-sicherung', fehler);
fehler = null; try { await SI.oeffnen('richtig-langes-Passwort', Object.assign({}, r.datei, { fassung: 2 })); } catch (e) { fehler = e.message; }
ok('andere Fassung → „fassung"', fehler === 'fassung', fehler);

const inhalt = await SI.oeffnen('richtig-langes-Passwort', r.datei);
const ziel = falscheDB();
await ziel.put('docs', { id: 'x9', name: 'Schon vorher da', fields: [] });
const z1 = await SI.zusammenfuehren(ziel, inhalt);
ok('zurückholen: 1 Dokument dazu, 1 Ordner dazu, 1 ohne Datei übersprungen', z1.dazu === 1 && z1.ordnerDazu === 1 && z1.ohneDatei === 1, z1);
ok('die PDF-Bytes kommen Byte für Byte zurück', new TextDecoder().decode(ziel.st.files.get('d1')) === '%PDF-1.4 erfunden ' + GEHEIM);
ok('ein Prüf-Befund aus der Datei wird nicht geglaubt (pruefung entfernt)', !('pruefung' in ziel.st.docs.get('d1')));
ok('ein vorhandenes Dokument bleibt unberührt', ziel.st.docs.get('x9').name === 'Schon vorher da');
await ziel.put('docs', Object.assign({}, ziel.st.docs.get('d1'), { name: 'Hier umbenannt' }));
const z2 = await SI.zusammenfuehren(ziel, inhalt);
ok('ein zweites Zurückholen fügt nichts hinzu und überschreibt nichts', z2.dazu === 0 && z2.schonDa === 1 && ziel.st.docs.get('d1').name === 'Hier umbenannt', z2);
const ohneOrdner = { ordner: [], docs: [{ id: 'd7', name: 'x', folderId: 'gibt-es-nicht' }], dateien: new Map([['d7', new Uint8Array([1])]]) };
await SI.zusammenfuehren(ziel, ohneOrdner);
ok('ein Ordner, den es nicht gibt, wird nicht erfunden (folderId → null)', ziel.st.docs.get('d7').folderId === null);

const T = Date.parse('2026-10-02T12:00:00Z');
ok('Erinnerung: eigene Dokumente, nie gesichert → ja', SI.erinnernNoetig(1, null, false, T) === true);
ok('Erinnerung: keine eigenen Dokumente → nein', SI.erinnernNoetig(0, null, false, T) === false);
ok('Erinnerung: vor 13 Tagen gesichert → nein', SI.erinnernNoetig(3, new Date(T - 13 * 86400000).toISOString(), false, T) === false);
ok('Erinnerung: vor 14 Tagen gesichert → ja', SI.erinnernNoetig(3, new Date(T - 14 * 86400000).toISOString(), false, T) === true);
ok('Erinnerung: „Später" gewählt → nein', SI.erinnernNoetig(3, null, true, T) === false);

console.log('B · im Browser');
let chromium = null;
try { ({ chromium } = await import('playwright-core')); } catch (_) {}
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
if (!chromium) { console.log('  ⊘ nicht lauffähig: playwright-core fehlt'); console.log(`\n${gruen} grün · ${rot} ROT`); process.exit(rot ? 1 : 2); }

const srv = await new Promise(res => {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
  const s = http.createServer((q, rq) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { rq.writeHead(404); rq.end(); return; }
    rq.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(rq);
  });
  s.listen(0, '127.0.0.1', () => res(s));
});
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const { PDFDocument, StandardFonts } = await import('pdf-lib');
const pdf = await PDFDocument.create(); const schrift = await pdf.embedFont(StandardFonts.Helvetica);
pdf.addPage([595.28, 841.89]).drawText('Erfundener Mietvertrag', { x: 60, y: 760, size: 14, font: schrift });
const B64 = Buffer.from(await pdf.save({ useObjectStreams: false })).toString('base64');
const DLDIR = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'wfsich-'));

try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const seitenFehler = []; page.on('pageerror', e => seitenFehler.push(String(e.stack || e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, rt => rt.abort());
  await page.goto(URL0 + 'index.html');
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB && WFP.Sicherung && window.WERKSTATT_SCHLUESSEL);
  ok('Schloss und Sicherung sind in der Seite geladen', true);

  // ein eigenes Dokument anlegen (erfunden)
  await page.evaluate(async b64 => {
    const bin = atob(b64), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    await window.__wfpdf.importDateien([new File([a], 'Erfundener Mietvertrag Quast.pdf', { type: 'application/pdf' })], 'Testordner Sicherung', { still: true });
  }, B64);
  await page.waitForFunction(() => window.__wfpdf.S.docs.some(d => d.name.includes('Quast')), null, { timeout: 30000 });

  // Erinnerung: eigenes Dokument, nie gesichert
  await page.evaluate(() => { localStorage.removeItem('wfpdf_sicherung_zuletzt'); sessionStorage.removeItem('wfpdf_sicherung_spaeter'); window.__wfpdf.dlg.sicherungErinnerung(); });
  const erin = await page.evaluate(() => { const e = document.querySelector('[data-sicherung-erinnerung]'); return e && !e.hidden && e.checkVisibility() ? e.textContent : null; });
  ok('die Erinnerung steht da, solange nie gesichert wurde', !!erin && /Sicherung/.test(erin), erin);

  // sichern über den Knopf in der Erinnerung
  await page.click('[data-sich-jetzt]');
  await page.waitForSelector('#siPw1');
  await page.fill('#siPw1', 'kurz'); await page.fill('#siPw2', 'kurz'); await page.click('#siErstellen');
  ok('ein zu kurzes Passwort wird abgewiesen', /mindestens/.test(await page.textContent('[data-sich-ergebnis]')));
  await page.fill('#siPw1', 'Testpasswort-2026'); await page.fill('#siPw2', 'anderes-Passwort'); await page.click('#siErstellen');
  ok('zwei verschiedene Passwörter werden abgewiesen', /nicht gleich/.test(await page.textContent('[data-sich-ergebnis]')));
  await page.fill('#siPw1', 'Testpasswort-2026'); await page.fill('#siPw2', 'Testpasswort-2026');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#siErstellen')]);
  const datei = path.join(DLDIR, 'sicherung.json'); await dl.saveAs(datei);
  await page.waitForFunction(() => /Gesichert/.test(document.querySelector('[data-sich-ergebnis]').textContent), null, { timeout: 60000 });
  const inhaltDL = fs.readFileSync(datei, 'utf8');
  ok('der Dateiname nennt Workfloh-PDF-Sicherung und das Datum', /^Workfloh-PDF-Sicherung-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  ok('in der heruntergeladenen Datei steht kein Klartext', !inhaltDL.includes('Quast') && !inhaltDL.includes('Testordner') && !inhaltDL.includes('Testpasswort') && !inhaltDL.includes('%PDF'));
  ok('das Passwort wird nirgends abgelegt', await page.evaluate(() => !JSON.stringify(localStorage).includes('Testpasswort') && !JSON.stringify(sessionStorage).includes('Testpasswort')));
  ok('die letzte Sicherung ist vermerkt', await page.evaluate(() => !!localStorage.getItem('wfpdf_sicherung_zuletzt')));
  ok('der Speicher-Stand wird genannt', !!(await page.evaluate(() => { const e = document.querySelector('[data-dauer]'); return e && e.textContent.trim(); })));
  ok('nach dem Sichern ist die Erinnerung weg', await page.evaluate(() => { const e = document.querySelector('[data-sicherung-erinnerung]'); return !e || e.hidden; }));

  // Bibliothek leeren (wie ein gelöschter Browser) und neu laden
  await page.evaluate(async () => {
    const DB = WFP.DB;
    for (const d of await DB.all('docs')) { await DB.del('docs', d.id); await DB.del('files', d.id); }
    for (const o of await DB.all('folders')) await DB.del('folders', o.id);
  });
  await page.reload();
  await page.waitForFunction(() => window.__wfpdf && WFP.Sicherung);
  ok('die Bibliothek ist leer', await page.evaluate(async () => (await WFP.DB.all('docs')).length === 0));

  await page.evaluate(() => window.__wfpdf.dlg.sicherungDialog());
  await page.waitForSelector('#siDatei');
  await page.setInputFiles('#siDatei', datei);
  await page.fill('#siPwZ', 'falsches-Passwort-99'); await page.click('#siZurueck');
  await page.waitForFunction(() => /⚠️/.test(document.querySelector('[data-sich-zurueck]').textContent), null, { timeout: 60000 });
  ok('falsches Passwort: die Meldung sagt es', /Passwort passt nicht/.test(await page.textContent('[data-sich-zurueck]')), await page.textContent('[data-sich-zurueck]'));
  ok('falsches Passwort: nichts kam herein', await page.evaluate(async () => (await WFP.DB.all('docs')).length === 0));

  await page.fill('#siPwZ', 'Testpasswort-2026'); await page.click('#siZurueck');
  await page.waitForFunction(() => /✅/.test(document.querySelector('[data-sich-zurueck]').textContent), null, { timeout: 60000 });
  ok('zurückgeholt: 1 Dokument und 1 Ordner dazu', /1 Dokument\(e\) dazu, 0 schon da, 1 Ordner dazu/.test(await page.textContent('[data-sich-zurueck]')), await page.textContent('[data-sich-zurueck]'));
  const zurueck = await page.evaluate(async () => {
    const d = (await WFP.DB.all('docs')).find(x => x.name.includes('Quast')); if (!d) return null;
    const b = await WFP.DB.getFile(d.id); const o = (await WFP.DB.all('folders')).find(x => x.id === d.folderId);
    return { name: d.name, ordner: o && o.name, kopf: b ? new TextDecoder().decode(new Uint8Array(b).slice(0, 5)) : null, inListe: window.__wfpdf.S.docs.some(x => x.id === d.id) };
  });
  ok('das Dokument ist mit Datei und Ordner zurück und steht in der Liste', !!zurueck && zurueck.kopf === '%PDF-' && zurueck.ordner === 'Testordner Sicherung' && zurueck.inListe, zurueck);

  await page.fill('#siPwZ', 'Testpasswort-2026'); await page.click('#siZurueck');
  await page.waitForFunction(() => /0 Dokument\(e\) dazu/.test(document.querySelector('[data-sich-zurueck]').textContent), null, { timeout: 60000 });
  ok('ein zweites Zurückholen legt nichts doppelt an', await page.evaluate(async () => (await WFP.DB.all('docs')).filter(x => x.name.includes('Quast')).length === 1));

  // „Später" blendet die Erinnerung für diesen Besuch aus
  await page.evaluate(() => { localStorage.removeItem('wfpdf_sicherung_zuletzt'); sessionStorage.removeItem('wfpdf_sicherung_spaeter'); window.__wfpdf.dlg.sicherungErinnerung(); });
  ok('ohne Sicherung kommt die Erinnerung wieder', await page.evaluate(() => { const e = document.querySelector('[data-sicherung-erinnerung]'); return e && !e.hidden; }));
  await page.evaluate(() => document.querySelector('[data-sich-spaeter]').click());
  ok('„Später" blendet sie für diesen Besuch aus', await page.evaluate(() => { const e = document.querySelector('[data-sicherung-erinnerung]'); return !e || e.hidden; }));

  // Einstellungen führen hin
  await page.evaluate(() => { document.querySelectorAll('[data-x]').forEach(b => b.click()); window.__wfpdf.dlg.einstellungen(); });
  ok('in den Einstellungen steht der Weg zur Sicherung', await page.evaluate(() => !!document.querySelector('#stSicherung')));
  ok('keine Fehler in der Seite', seitenFehler.length === 0, seitenFehler);
} catch (e) {
  ok('der Lauf stolpert nicht', false, String(e && e.stack || e));
} finally {
  await browser.close(); srv.close();
  fs.rmSync(DLDIR, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
