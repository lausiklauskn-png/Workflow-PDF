/* Workfloh PDF — baut das Benutzerhandbuch und ein Amtsformular (Klaus 2026-09-25).
   Beides liegt danach unter beispiele/ und ist in der App mit einem Knopf zu laden:
   als Hilfe UND als Testmaterial für die Übersetzung, ohne eigene Daten ins Netz zu geben.

   Das Handbuch deckt ab, was ein Handbuch enthalten kann: Titelseite mit Farbfläche,
   Inhaltsverzeichnis, Fließtext in einer und zwei Spalten, nummerierte Schritte,
   Hinweiskästen (weiß auf Farbe, schwarz auf Gelb), Tabellen, ECHTE Bildschirmfotos der
   App (im Browser aufgenommen, mit erfundenen Daten), eine Querformat-Seite und eine
   GESCANNTE Seite (Bild ohne Textebene — dort muss die Texterkennung lesen).
   Das Amtsformular ist erfunden (Stadt Musterstadt): graue Eingabeflächen, Linien,
   Kästchen, Unterschrift, eine zweite Seite mit dichtem Kleingedruckten.

   Aufruf:  node tools/handbuch-bauen.mjs      (braucht playwright-core; kein Netz) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ZIEL = path.join(W, 'beispiele');
fs.mkdirSync(ZIEL, { recursive: true });
const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const srv = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(W, p); if (!f.startsWith(W) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const BASIS = `http://127.0.0.1:${srv.address().port}`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, locale: 'de-DE' });
// Headless-Chromium hat keine Spracherkennung — für das Bild vom Laufbalken wird sie gestellt.
await ctx.addInitScript(() => {
  class Stub { constructor() { window.__rec = this; } start() {} stop() { setTimeout(() => this.onend && this.onend(), 20); } abort() {} }
  window.SpeechRecognition = Stub;
  window.__sag = t => { const a = [{ transcript: t }]; a.isFinal = false; window.__rec.onresult({ resultIndex: 0, results: [a] }); };
});
const page = await ctx.newPage();
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
const fehler = []; page.on('pageerror', e => fehler.push(String(e)));

/* Gemeinsame Zeichen-Helfer, als Text in den Browser gereicht (dort läuft pdf-lib). */
const HELFER = `
  const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
  const DATUM = new Date('2026-09-25T12:00:00Z');
  const farbe = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
  const umbrechen = (f, t, gr, breite) => { const z = []; for (const abs of String(t).split('\\n')) { let a = ''; for (const x of abs.split(' ')) { const n = a ? a + ' ' + x : x; if (f.widthOfTextAtSize(n, gr) > breite && a) { z.push(a); a = x; } else a = n; } z.push(a); } return z; };
  const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
`;

await page.goto(BASIS + '/index.html');
await page.waitForFunction(() => !!window.__wfpdf && !!window.PDFLib);
await page.addStyleTag({ content: '#toast{display:none!important}' }); // Meldungen gehören nicht ins Handbuch-Bild

/* ---------- 1. Amtsformular (erfunden) ---------- */
const FORMKOERPER = fs.readFileSync(new URL('./handbuch-formular.js', import.meta.url), 'utf8');
const formB64 = await page.evaluate(new Function(`return (async () => {${HELFER}${FORMKOERPER}
  const b = await pdf.save(); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); })()`));
const FORM = path.join(ZIEL, 'Beispiel-Amtsformular-Bewohnerparkausweis.pdf');
fs.writeFileSync(FORM, Buffer.from(formB64, 'base64'));

/* ---------- 2. Bildschirmfotos der echten App ---------- */
const bilder = {};
const foto = async (name, loc) => { const b = await (loc || page).screenshot({ type: 'jpeg', quality: 80 }); bilder[name] = b.toString('base64'); };
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(150); };
await page.setInputFiles('#inDatei', FORM);
await page.waitForSelector('#sc-ed.on'); await page.waitForTimeout(600);
await foto('eingelesen');
await page.click('#edErkennen'); await page.click('[data-off]');
await page.waitForFunction(() => window.__wfpdf.S.doc.fields.some(f => !f.geprueft), null, { timeout: 60000 });
await page.waitForFunction(() => !document.querySelector('.fortschritt')); await page.waitForTimeout(500);
while (await page.$('.dlg')) await esc();
await foto('erkannt');
// Beispiel-Werte (erfunden) einsetzen und alle Vorschläge bestätigen
await page.evaluate(() => {
  const W = window.__wfpdf, werte = [[/Familienname/, 'Mustermann'], [/Vorname/, 'Erika'], [/Geburtsdatum/, '1980-02-01'], [/Geburtsort/, 'Musterdorf'], [/Staats/, 'deutsch'], [/Straße/, 'Musterweg 12'], [/Postleitzahl/, '12345'], [/Wohnort/, 'Musterstadt'], [/Telefon/, '01234 567890'], [/E-Mail/, 'erika.mustermann@example.org'], [/Kennzeichen/, 'MS-EM 123'], [/Hersteller/, 'Beispielwagen Kompakt']];
  let k = 0;
  for (const f of W.S.doc.fields) { f.geprueft = true; if (f.type === 'check') { f.value = k++ < 3; continue; } const w = werte.find(([r]) => r.test(f.label || '')); if (w) f.value = w[1]; }
});
await page.click('#mBearbeiten'); await page.click('#mAusfuellen'); await page.waitForTimeout(500);
await foto('ausgefuellt');
await page.click('#edExport'); await page.waitForSelector('.dlg'); await foto('ausgeben', page.locator('.dlg')); await esc();
await page.click('#edZurueck'); await page.waitForTimeout(500);
await foto('bibliothek');
await page.click('#btnUebersetzen'); await page.waitForSelector('.dlg'); await foto('uebersetzen-start', page.locator('.dlg')); await esc();
await page.click('.ordner-chip[data-o="alle"]').catch(() => {});
await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-weg]'); await page.waitForTimeout(400);
await foto('uebersetzen-dialog', page.locator('.dlg')); await esc();
// Suchen: Wortsuche mit Fundstelle (Kapitel 6)
await page.fill('#bibSuche', 'Mustermann'); await page.waitForTimeout(300);
await foto('suche');
await page.fill('#bibSuche', ''); await page.waitForTimeout(150);
// Spracheingabe: Text schon im Feld, darunter der Laufbalken
await page.click('#bibMic'); await page.evaluate(() => window.__rec.onspeechstart && window.__rec.onspeechstart());
for (const t of ['Antrag', 'Antrag Park', 'Antrag Parkausweis', 'Antrag Parkausweis Musterstadt']) { await page.evaluate(t => window.__sag(t), t); await page.waitForTimeout(260); }
await page.evaluate(() => window.__rec.onspeechend && window.__rec.onspeechend()); await page.waitForTimeout(500);
{ const a = await page.locator('#bibForm').boundingBox(), b = await page.locator('[data-wfs]').boundingBox();
  const x = Math.min(a.x, b.x) - 8, y0 = a.y - 8; bilder.sprechen = (await page.screenshot({ type: 'jpeg', quality: 80, clip: { x, y: y0, width: Math.max(a.x + a.width, b.x + b.width) - x + 8, height: b.y + b.height - y0 + 8 } })).toString('base64'); }
await page.click('.wfs-fertig'); await page.waitForTimeout(200);
await page.fill('#bibSuche', ''); await page.evaluate(() => { window.__wfpdf.S.suche = ''; window.__wfpdf.suche.zeichneBibliothek(); });
// Suche nach Bedeutung: das Fenster VOR dem Laden
await page.click('[data-bed-an]'); await page.waitForSelector('.dlg'); await foto('bedeutung', page.locator('.dlg')); await esc();
// Ordner ausgeben: zweites Dokument dazu, beide in einen Ordner
await page.setInputFiles('#inDatei', path.join(ZIEL, 'Workfloh-PDF-Benutzerhandbuch.pdf'));
await page.waitForFunction(() => window.__wfpdf.S.docs.length >= 2, null, { timeout: 60000 }); await page.waitForTimeout(400);
while (await page.$('.dlg')) await esc();
await page.evaluate(async () => { const W = window.__wfpdf; const o = { id: 'o-hb', name: 'Formulare', erstellt: Date.now() }; await WFP.DB.put('folders', o);
  for (const d of W.S.docs) { d.folderId = o.id; await WFP.DB.put('docs', d); } });
await page.reload(); await page.waitForFunction(() => window.__wfpdf && window.__wfpdf.S.ordner.length >= 1);
await page.click('.ordner-chip[data-o="o-hb"]'); await page.click('[data-ausgabe]'); await page.waitForSelector('.dlg [data-weg]');
await foto('ordner', page.locator('.dlg')); await esc();
// Scannen: ein Foto (aus tests/scan-fotos, Scanics Testbilder) — Blatt gefunden, Ecken zum Prüfen
await page.click('#btnScan'); await page.waitForSelector('.scan [data-galerie]');
await page.setInputFiles('.scan [data-in-galerie]', path.join(W, 'tests/scan-fotos/foto01.jpg'));
await page.waitForFunction(() => window.__wfpdfScan && window.__wfpdfScan.seiten[0] && window.__wfpdfScan.seiten[0].erkennung, null, { timeout: 90000 });
await page.waitForTimeout(800); await foto('scannen');
const icon = fs.readFileSync(path.join(W, 'icons/w-floh-320.png')).toString('base64');

/* ---------- 3. Das Handbuch ---------- */
const INHALT = fs.readFileSync(new URL('./handbuch-inhalt.js', import.meta.url), 'utf8');
const hbB64 = await page.evaluate(new Function('ARG', `return (async () => {${HELFER}${INHALT}
  const b = await pdf.save(); let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); })()`), { bilder, icon });
fs.writeFileSync(path.join(ZIEL, 'Workfloh-PDF-Benutzerhandbuch.pdf'), Buffer.from(hbB64, 'base64'));
if (fehler.length) console.log('Fehler in der Seite:', fehler);
console.log('geschrieben: beispiele/Workfloh-PDF-Benutzerhandbuch.pdf (' + Math.round(Buffer.from(hbB64, 'base64').length / 1024) + ' KB), beispiele/Beispiel-Amtsformular-Bewohnerparkausweis.pdf (' + Math.round(Buffer.from(formB64, 'base64').length / 1024) + ' KB)');
await browser.close(); srv.close();
