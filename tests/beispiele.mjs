/* Workfloh PDF — Probe „Beispiele zum Ausprobieren" und „📘 Handbuch öffnen" (Klaus 2026-09-25).
   Geprüft: die zwei beigelegten PDFs sind da und heil · der Knopf im Übersetzen-Fenster legt
   beide in den Ordner „Beispiele" (Bereich Übersetzung) und öffnet den Übersetzer · ein zweiter
   Druck legt nichts doppelt an · die Hilfe öffnet das Handbuch · fehlt das Netz beim ersten
   Mal, sagt die App das statt einen leeren Ordner anzulegen · Handbuch und App nennen den
   Weg gleich. Kein Byte ins Netz. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

// 1. Die Dateien selbst
const HB = path.join(WURZEL, 'beispiele/Workfloh-PDF-Benutzerhandbuch.pdf');
const FO = path.join(WURZEL, 'beispiele/Beispiel-Amtsformular-Bewohnerparkausweis.pdf');
let seitenHB = -1, seitenFO = -1;
try { seitenHB = (await PDFDocument.load(fs.readFileSync(HB))).getPageCount(); } catch (_) {}
try { seitenFO = (await PDFDocument.load(fs.readFileSync(FO))).getPageCount(); } catch (_) {}
ok('Handbuch liegt bei und hat mehr als 10 Seiten', seitenHB > 10, seitenHB);
ok('Amtsformular liegt bei und hat 2 Seiten', seitenFO === 2, seitenFO);
// Handbuch und App nennen denselben Weg — sonst sucht der Leser einen Knopf, den es nicht gibt
const app = fs.readFileSync(path.join(WURZEL, 'assets/app.js'), 'utf8');
const inhalt = fs.readFileSync(path.join(WURZEL, 'tools/handbuch-inhalt.js'), 'utf8');
ok('Handbuch und App nennen „Beispiele zum Ausprobieren"', /Beispiele zum Ausprobieren/.test(app) && /Beispiele zum Ausprobieren/.test(inhalt));
ok('beide Dateinamen stehen in der App', app.includes('beispiele/Workfloh-PDF-Benutzerhandbuch.pdf') && app.includes('beispiele/Beispiel-Amtsformular-Bewohnerparkausweis.pdf'));

function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
const srv = await server();
const BASIS = `http://127.0.0.1:${srv.address().port}/index.html`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const neueSeite = async (ohneBeispiele) => {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });
  const p = await ctx.newPage(); const konsole = [];
  p.on('pageerror', e => konsole.push(String(e)));
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  if (ohneBeispiele) await p.route(/\/beispiele\//, r => r.abort());
  await p.goto(BASIS); await p.waitForFunction(() => !!window.__wfpdf && !!window.__wfpdf.beispieleLaden);
  return { ctx, p, konsole };
};
const lage = p => p.evaluate(() => { const S = window.__wfpdf.S; const o = S.ordner.filter(x => /^Beispiele/.test(x.name)); return { ordner: o.map(x => [x.name, x.bereich]), docs: S.docs.filter(d => o.some(x => x.id === d.folderId) && !d.uebersetzung).map(d => [d.name, d.pages.length]) }; });

try {
  // 2. Übersetzen → Beispiele zum Ausprobieren
  const { ctx, p, konsole } = await neueSeite(false);
  await p.click('#btnUebersetzen'); await p.waitForSelector('.dlg [data-ubsp]');
  await p.click('.dlg [data-ubsp]');
  await p.waitForSelector('.dlg [data-weg]', { timeout: 60000 }).catch(() => {});
  let l = await lage(p);
  ok('ein Ordner „Beispiele" im Bereich Übersetzung', l.ordner.length === 1 && l.ordner[0][0] === 'Beispiele' && l.ordner[0][1] === 'uebersetzung', l.ordner);
  ok('beide Beispiele darin, mit ihrer Seitenzahl', l.docs.length === 2 && l.docs.some(d => /Benutzerhandbuch/.test(d[0]) && d[1] === seitenHB) && l.docs.some(d => /Amtsformular/.test(d[0]) && d[1] === 2), l.docs);
  ok('danach steht das Übersetzen-Fenster offen', !!(await p.$('.dlg [data-weg]')));
  ok('…mit beiden Dokumenten gewählt', await p.evaluate(() => /2 Dokumente/.test((document.querySelector('.dlg') || {}).textContent || '')));
  while (await p.$('.dlg')) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
  // zweiter Druck: nichts doppelt
  await p.click('#btnUebersetzen'); await p.waitForSelector('.dlg [data-ubsp]'); await p.click('.dlg [data-ubsp]');
  await p.waitForSelector('.dlg [data-weg]', { timeout: 30000 }).catch(() => {});
  l = await lage(p);
  ok('ein zweiter Druck legt nichts doppelt an', l.docs.length === 2 && l.ordner.length === 1, l);
  while (await p.$('.dlg')) { await p.keyboard.press('Escape'); await p.waitForTimeout(150); }
  // 3. Hilfe → Handbuch öffnen
  await p.click('#btnHilfe'); await p.waitForSelector('.dlg [data-hb]');
  await p.click('.dlg [data-hb]');
  await p.waitForSelector('#sc-ed.on', { timeout: 30000 }).catch(() => {});
  ok('Hilfe → „📘 Handbuch öffnen" öffnet das Handbuch', await p.evaluate(() => { const d = window.__wfpdf.S.doc; return !!d && /Benutzerhandbuch/.test(d.name) && !!document.querySelector('#sc-ed.on'); }));
  l = await lage(p);
  ok('…ohne es ein zweites Mal einzulesen', l.docs.length === 2, l);
  // Klaus 2026-09-26: der Kasten „Nur von der Behörde auszufüllen" wurde als großes Feld erkannt,
  // seine Beschriftungen als Inhalt gelesen und doppelt über die echten Felder gelegt
  const beh = await p.evaluate(async () => { const W = window.__wfpdf, S = W.S; const d = S.docs.find(x => /Amtsformular/.test(x.name) && !x.uebersetzung);
    await W.oeffneDok(d.id); const doc = S.doc; doc.fields = []; await W.erkenneDok(doc, S.bytes, false, () => {});
    const f2 = doc.fields.filter(f => f.page === 1 && f.type !== 'check');
    const drin = (g, f) => g.x >= f.x - 0.5 && g.x + g.w <= f.x + f.w + 0.5 && g.y >= f.y - 0.5 && g.y + g.h <= f.y + f.h + 0.5;
    return { kasten: f2.filter(f => f2.filter(g => g !== f && drin(g, f)).length >= 2).map(f => f.label), felder: f2.map(f => f.label),
      mitInhalt: doc.fields.filter(f => typeof f.value === 'string' && f.value).map(f => [f.label, f.value]) }; });
  ok('Behördenkasten: kein großes Feld um die Felder herum', beh.kasten.length === 0, beh);
  ok('…die fünf Behörden-Felder sind da', ['Ausweis-Nr', 'Gültig von', 'Gültig bis', 'Gebühr bezahlt am', 'Bearbeitet'].every(n => beh.felder.some(l => l.startsWith(n))), beh.felder);
  ok('…und keine gedruckte Beschriftung wird als Eintrag übernommen', beh.mitInhalt.length === 0, beh.mitInhalt);
  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
  await ctx.close();

  // 4. ohne Netz beim ersten Mal
  const o = await neueSeite(true);
  await o.p.click('#btnUebersetzen'); await o.p.waitForSelector('.dlg [data-ubsp]'); await o.p.click('.dlg [data-ubsp]');
  await o.p.waitForFunction(() => /nicht laden/.test(document.getElementById('toast').textContent), null, { timeout: 15000 }).catch(() => {});
  ok('ohne Netz: Meldung statt Stille', await o.p.evaluate(() => /nicht laden/.test(document.getElementById('toast').textContent)));
  const lo = await lage(o.p);
  ok('…und kein leerer Ordner', lo.ordner.length === 0 && lo.docs.length === 0, lo);
  await o.ctx.close();
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e && e.message || e));
} finally {
  await browser.close(); srv.close();
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
