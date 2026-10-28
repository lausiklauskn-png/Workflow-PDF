/* Workfloh PDF — Pro-Umbau 5 (Klaus 2026-10-28, Leitfaden der Pro-Apps § 3 und § 5):
   nichts startet von selbst · „Prüfen" und „Einordnen" nebeneinander, für die Auswahl oder „Alle N?" ·
   Hintergrundaufgabe (window.ProHintergrund) mit Stand und Abbrechen · Bildbeschreibung erst auf „Beschreiben" ·
   flache Start-Kacheln, Knöpfe ≈ 32 px · Strichgrafiken statt Emojis · die Bibliothek öffnet beim Anzeigen kein PDF.
   Gemessen im echten Browser. Modul 03 (Bedeutung) und transformers.js (Bildmodell) sind gestellt — das echte Modell
   lädt der Behälter nicht (Netz gesperrt). window.ProHintergrund ist gestellt; ob Android die App mit der Mitteilung
   wirklich weiterrechnen lässt, misst nur das Tablet. Nur erfundene Daten. WURZEL=<pfad> misst eine andere Kopie. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 700) : '')); } };
const EMOJI = /(?![↗©™®↔↕↺↻])\p{Extended_Pictographic}/u;
console.log('Workfloh PDF — Pro-Umbau 5: Prüfen · Einordnen · Beschreiben auf Knopfdruck, Strichgrafiken, nur Vorschaubilder');

/* ===== A. Ohne Browser ===== */
const lies = f => fs.readFileSync(path.join(WURZEL, f), 'utf8');
const HTML = lies('index.html'), SW = lies('sw.js'), APP = lies('assets/app.js'), TX = lies('assets/sprache-texte.js'), STR = lies('assets/strich.js');
const v = (HTML.match(/assets\/strich\.js\?v=(\d+)/) || [])[1];
ok('A1 strich.js steht VOR sprache.js (ihr Beobachter läuft zuerst) und im Vorrat des Workers', !!v && HTML.indexOf('assets/strich.js') < HTML.indexOf('assets/sprache.js') && SW.includes(`./assets/strich.js?v=${v}'`), v);
ok('A2 beim Start wird die Bedeutung nur geladen, nicht eingeordnet', /if \(EINST\.bedeutung\) bedeutungStarten\(\{ einordnen: false \}\)/.test(APP));
const emojiApp = new Set([...(APP + HTML + lies('assets/bildbeschreibung.js')).matchAll(/(?![↗©™®↔↕↺↻])\p{Extended_Pictographic}/gu)].map(m => m[0]));
globalThis.window = globalThis; globalThis.document = undefined;
const map = {}; for (const m of STR.matchAll(/'(\p{Extended_Pictographic})': '(\w+)'/gu)) map[m[1]] = m[2];
const fehlen = [...emojiApp].filter(e => !map[e]);
ok('A3 jedes Emoji aus app.js, index.html und bildbeschreibung.js hat ein Strichsymbol', !fehlen.length, fehlen);
const ohneSym = Object.values(map).filter(s => !new RegExp('\\n    ' + s + ": '").test(STR));
ok('A4 jedes zugeordnete Symbol ist gezeichnet', !ohneSym.length, ohneSym);
for (const lang of ['en', 'ru', 'ar']) {
  const i = TX.indexOf(` "${lang}": {`), b = TX.slice(i, TX.indexOf('\n },', i));
  const k = ['"▶ Prüfen"', '"🧠 Einordnen ({})"', '"Alle {} Dokumente einordnen?"', '"Alle {} noch nicht geprüften Dokumente prüfen?"', '"Beschreiben"', '"{} Foto(s) beschreiben?"', '"Prüfen läuft"', '"Einordnen läuft"', '"Bildbeschreibung läuft"', '"{} noch nicht eingeordnet"'].filter(x => !b.includes('\n  ' + x + ':'));
  ok(`A5 neue Sätze in ${lang.toUpperCase()}`, !k.length, k);
}

/* ===== B. Im echten Browser ===== */
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-arbeit-'));
async function pdfMit(zeilen) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); const p = d.addPage([595, 842]);
  zeilen.forEach((z, i) => p.drawText(z, { x: 50, y: 780 - i * 28, size: 12, font: f }));
  return Buffer.from(await d.save());
}
const PDFS = { Kuendigung: await pdfMit(['Wir beenden den Vertrag zum Monatsende.']), Rechnung: await pdfMit(['Rechnung 4711, Betrag zahlbar in 14 Tagen.']), Garantie: await pdfMit(['Garantie und Gewaehrleistung zwei Jahre.']) };
const STUB = `(function(){
  var D = 16; function vek(t){ var v=new Float32Array(D); v[0]=1; v[1+(String(t).length%15)]=1; var s=Math.sqrt(2); for(var i=0;i<D;i++) v[i]/=s; return v; }
  window.__stub = { passagen: 0, fragen: 0, init: 0 };
  var bereit = null;
  window.SbkimEmbedding = {
    init: function(){ if (bereit) return bereit; window.__stub.init++; bereit = new Promise(function(r){ setTimeout(r, 80); }); return bereit; },
    isReady: function(){ return !!bereit; },
    embedQuery: function(t){ window.__stub.fragen++; return Promise.resolve(vek(t)); },
    embedPassage: function(t){ window.__stub.passagen++; return Promise.resolve(vek(t)); },
    embedPassageBatch: function(ts){ window.__stub.passagen += ts.length; var t = window.__stubBatchTakt || 0; return new Promise(function(res){ setTimeout(function(){ res(ts.map(vek)); }, t); }); },
    embedQueryBatch: function(ts){ return Promise.resolve(ts.map(vek)); }
  };
})();`;
const LIB = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
const BILDSTUB = `export const env = {};
export async function pipeline(task, model, opt) { const st = window.__bildStub; st.pipelines++;
  opt.progress_callback({ status: 'progress', file: 'm.onnx', loaded: 5, total: 10 }); await new Promise(r => setTimeout(r, 60)); opt.progress_callback({ status: 'done', file: 'm.onnx' });
  return async img => { st.calls++; await new Promise(r => setTimeout(r, window.__bildTakt || 30)); return [{ generated_text: 'a garden' }]; }; }`;
// Die Hintergrundaufgabe der Pro-Apps, gestellt: merkt Anmeldung, Stand und Ende; window.__hgAbbruch(art) bricht ab wie die Mitteilung
const HG = () => {
  window.__hg = [];
  window.ProHintergrund = { FASSUNG: 1, verfuegbar: () => true, aktiv: () => window.__hg.filter(a => !a.ende).length,
    beginnen: async ({ art, titel }) => { const ac = new AbortController(); const e = { art, titel, staende: [], ende: false, ac };
      window.__hg.push(e); return { art, signal: ac.signal, geschuetzt: true, stand: (t, i, n) => e.staende.push([t, i, n]), abbrechen: () => ac.abort(), ende: () => { e.ende = true; } }; } };
  window.__hgAbbruch = art => { const e = window.__hg.filter(x => x.art === art && !x.ende).pop(); if (e) e.ac.abort('mitteilung'); return !!e; };
};
const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.ttf': 'font/ttf', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
let pw; try { pw = await import('playwright-core'); } catch (_) {}
const exe = [process.env.CHROMIUM, '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean).find(fs.existsSync);
let browser;
try { browser = await pw.chromium.launch(exe ? { executablePath: exe } : {}); }
catch (e) { console.log('  ⊘ nicht lauffähig: kein Browser (' + String((e && e.message) || e).split('\n')[0] + ')'); srv.close(); process.exit(2); }
// Zählt, was beim Anzeigen gelesen wird: IndexedDB-Fächer und pdf.js getDocument
const ZAEHLER = () => {
  window.__lese = { files: 0, texte: 0, vektoren: 0, pdf: 0 };
  const g = IDBObjectStore.prototype.get, ga = IDBObjectStore.prototype.getAll;
  IDBObjectStore.prototype.get = function (...a) { if (this.name in window.__lese) window.__lese[this.name]++; return g.apply(this, a); };
  IDBObjectStore.prototype.getAll = function (...a) { if (this.name in window.__lese) window.__lese[this.name]++; return ga.apply(this, a); };
  let lib; Object.defineProperty(window, 'pdfjsLib', { configurable: true, get: () => lib, set: v => { lib = v; if (v && v.getDocument && !v.__gezaehlt) { const echt = v.getDocument.bind(v); try { v.getDocument = (...a) => { window.__lese.pdf++; return echt(...a); }; } catch (_) {} } } });
};
const bereit = page => page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.DB && document.readyState === 'complete', null, { timeout: 30000 });
const offenE = page => page.evaluate(() => window.__wfpdf.bedeutung.offeneEinordnen().length);
// Ein einzelnes eingelesenes PDF öffnet den Editor — zurück zur Bibliothek
const zurBib = async page => { if (await page.evaluate(() => document.getElementById('sc-ed').classList.contains('on'))) { await page.click('#edZurueck'); await page.waitForFunction(() => document.getElementById('sc-bib').classList.contains('on')); } };
const dlgJa = async page => { await page.waitForSelector('.dlg [data-j]', { timeout: 5000 }); await page.click('.dlg [data-j]'); };
// Die SBKIM-Fenster (Siegel, Mycel-Pille) sind byte-1:1 aus Sage und tragen ihre eigenen Zeichen — sie misst diese Probe nicht
const sichtEmoji = page => page.evaluate(sel => { const weg = [...document.querySelectorAll('[id^="sbkim"],[class*="sbkim"],[data-sbkim-mycel-platz],#siegel-platz')].map(e => [e, e.style.display]); weg.forEach(([e]) => { e.style.display = 'none'; }); const out = []; for (const e of document.querySelectorAll(sel)) { if (!e.checkVisibility || !e.checkVisibility()) continue; const t = e.innerText || ''; const m = t.match(/(?![↗©™®↔↕↺↻])\p{Extended_Pictographic}/gu); if (m) out.push((e.id || e.className) + ': ' + m.join('')); } weg.forEach(([e, d]) => { e.style.display = d; }); return out; }, '.kopf, #sc-bib .import-leiste, #ordnerLeiste, #bibForm, #bildZeilen, #bedeutungLeiste, #pruefAlle, #dokGitter, .ed-leiste, .dlg, .scan-kopf, .scan');
try {
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.addInitScript(HG); await page.addInitScript(ZAEHLER);
  await page.addInitScript(() => { window.__bildStub = { pipelines: 0, calls: 0 }; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.route(/\/vendor\/sbkim\/03_embedding\.js/, r => r.fulfill({ contentType: 'text/javascript', body: STUB }));
  await page.route(LIB, r => r.fulfill({ contentType: 'text/javascript', body: BILDSTUB }));
  await page.goto(URL0); await bereit(page);
  await page.setInputFiles('#inDatei', Object.entries(PDFS).map(([n, b]) => ({ name: n + '.pdf', mimeType: 'application/pdf', buffer: b })));
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 3 && document.querySelectorAll('#dokGitter .dok').length === 3, null, { timeout: 60000 });

  // --- B1 Prüfen: nichts von selbst, „Alle N?" fragt, Auswahl prüft nur die gewählten ---
  await page.waitForTimeout(500);
  const b1 = await page.evaluate(() => ({ geprueft: window.__wfpdf.S.docs.filter(d => d.pruefung).length, knopf: (document.querySelector('#pruefAlle [data-pruefen]') || {}).textContent || '', rot: !!document.querySelector('#pruefAlle [data-pruefen].rot') }));
  ok('B1 nach dem Einlesen ist nichts geprüft; „Prüfen" steht als farbiger nächster Schritt da', b1.geprueft === 0 && /Prüfen/.test(b1.knopf) && b1.rot, b1);
  await page.click('#pruefAlle [data-pruefen]');
  const frage = await page.waitForSelector('.dlg', { timeout: 5000 }).then(e => e.innerText(), () => '');
  ok('B2 ohne Auswahl fragt „Prüfen" erst: „Alle 3 … prüfen?"', /Alle 3 noch nicht geprüften Dokumente prüfen\?/.test(frage), frage);
  await page.click('.dlg [data-n]'); await page.waitForTimeout(300);
  ok('B3 „Abbrechen" in der Frage prüft nichts', await page.evaluate(() => window.__wfpdf.S.docs.every(d => !d.pruefung) && !window.__wfpdf.eingang.ALLE.an && !window.__hg.length));
  await page.evaluate(() => { const k = [...document.querySelectorAll('#dokGitter .dok')].find(d => d.querySelector('.dok-name').textContent === 'Rechnung'); k.querySelector('[data-haken]').click(); });
  const wahlKnopf = await page.textContent('#pruefAlle [data-pruefen]');
  ok('B4 mit Auswahl heißt der Knopf „Prüfen (1)" und „Einordnen" fehlt noch (Bedeutung aus)', /Prüfen \(1\)/.test(wahlKnopf) && !(await page.$('#pruefAlle [data-einordnen]')), wahlKnopf);
  await page.click('#pruefAlle [data-pruefen]');
  await page.waitForFunction(() => { const d = window.__wfpdf.S.docs.find(x => x.name === 'Rechnung'); return d.pruefung && !window.__wfpdf.eingang.ALLE.an; }, null, { timeout: 60000 });
  const b5 = await page.evaluate(() => ({ dlg: !!document.querySelector('.dlg'), geprueft: window.__wfpdf.S.docs.filter(d => d.pruefung).map(d => d.name), hg: window.__hg.map(a => ({ art: a.art, titel: a.titel, n: a.staende.length, ende: a.ende })) }));
  ok('B5 „Prüfen (1)" prüft ohne Frage genau das gewählte Dokument', !b5.dlg && b5.geprueft.length === 1 && b5.geprueft[0] === 'Rechnung', b5);
  ok('B6 … als Hintergrundaufgabe „Prüfen läuft" mit Stand, danach beendet', b5.hg.length === 1 && b5.hg[0].art === 'pruefen' && b5.hg[0].titel === 'Prüfen läuft' && b5.hg[0].n >= 1 && b5.hg[0].ende, b5.hg);
  await page.evaluate(() => document.querySelector('#wahlLeiste [data-wahl-ende]').click());
  // Abbrechen aus der Mitteilung hält nach dem laufenden Dokument an
  await page.click('#pruefAlle [data-pruefen]'); await dlgJa(page);
  await page.waitForFunction(() => window.__hg.some(a => a.art === 'pruefen' && !a.ende), null, { timeout: 10000 });
  await page.evaluate(() => window.__hgAbbruch('pruefen'));
  await page.waitForFunction(() => !window.__wfpdf.eingang.ALLE.an, null, { timeout: 60000 });
  const b7 = await page.evaluate(() => ({ geprueft: window.__wfpdf.S.docs.filter(d => d.pruefung).length, ende: (document.querySelector('[data-pruef-alle-ende]') || {}).innerText || '', hg: window.__hg.filter(a => a.art === 'pruefen').map(a => a.ende) }));
  ok('B7 „Abbrechen" in der Mitteilung hält „Prüfen" an (nicht alle geprüft, Leiste sagt „Abgebrochen")', b7.geprueft < 3 && /Abgebrochen/.test(b7.ende) && b7.hg.every(Boolean), b7);

  // --- B8 Bedeutung: „Modell laden" ordnet ein; nach dem Neuladen NICHT von selbst ---
  await page.click('#bedeutungLeiste [data-bed-an]'); await page.click('.dlg [data-bed-laden]');
  await page.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit' && window.__wfpdf.bedeutung.offeneEinordnen().length === 0, null, { timeout: 30000 });
  ok('B8 „Modell laden" ist der Tipp: danach sind alle 3 eingeordnet, als Hintergrundaufgabe „Einordnen läuft"', await page.evaluate(() => window.__hg.some(a => a.art === 'einordnen' && a.titel === 'Einordnen läuft' && a.ende)));
  await page.evaluate(() => { localStorage.setItem('wfpdf_einst_v1', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('wfpdf_einst_v1') || '{}'), { bild: true }))); });
  await page.reload(); await bereit(page);
  await page.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit', null, { timeout: 30000 });
  await page.waitForTimeout(1200);
  const b9 = await page.evaluate(() => ({ passagen: window.__stub.passagen, hg: window.__hg.length, lese: window.__lese, bild: document.getElementById('bildLeiste').dataset.bildZustand, pipes: window.__bildStub.pipelines, thumbs: [...document.querySelectorAll('#dokGitter .dok-bild')].map(b => b.style.backgroundImage.slice(0, 26)) }));
  ok('B9 nach dem Neuladen: Modell bereit, aber KEIN Abschnitt eingeordnet und keine Aufgabe gestartet', b9.passagen === 0 && b9.hg === 0, b9);
  ok('B10 Bildbeschreibung (Wahl gemerkt) wartet auf „Beschreiben" — kein Bildmodell geladen', b9.bild === 'wartet' && b9.pipes === 0 && !!(await page.$('#bildLeiste [data-bild-beschreiben]')), b9);
  ok('B11 die Bibliothek öffnet beim Anzeigen kein PDF und liest weder Dateien noch Seitentext — nur Vorschaubilder', b9.lese.files === 0 && b9.lese.pdf === 0 && b9.lese.texte === 0 && b9.thumbs.length === 3 && b9.thumbs.every(t => t.startsWith('url("data:image/jpeg')), b9);
  // Suche liest den Seitentext erst dann nach
  await page.fill('#bibSuche', 'Betrag'); await page.waitForTimeout(600);
  const b12 = await page.evaluate(() => ({ lese: window.__lese, karten: [...document.querySelectorAll('#dokGitter .dok:not([data-bedeutung]) .dok-name')].map(e => e.textContent) }));
  ok('B12 erst die Suche liest den Seitentext (aus dem Fach, ohne PDF zu öffnen) und findet „Rechnung"', b12.lese.texte >= 1 && b12.lese.pdf === 0 && b12.lese.files === 0 && b12.karten.includes('Rechnung'), b12);
  await page.fill('#bibSuche', ''); await page.waitForTimeout(300);
  // Neues Dokument: kein Einordnen von selbst; „Einordnen" fragt „Alle N?"
  await page.setInputFiles('#inDatei', [{ name: 'Mahnung.pdf', mimeType: 'application/pdf', buffer: await pdfMit(['Zweite Mahnung, bitte zahlen.']) }]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 4, null, { timeout: 60000 }); await page.waitForTimeout(800); await zurBib(page);
  const b13 = await page.evaluate(() => ({ passagen: window.__stub.passagen, offen: window.__wfpdf.bedeutung.offeneEinordnen().length, knopf: (document.querySelector('#pruefAlle [data-einordnen]') || {}).textContent || '', neben: (() => { const p = document.querySelector('#pruefAlle [data-pruefen]'), e = document.querySelector('#pruefAlle [data-einordnen]'); return !!p && !!e && Math.abs(p.getBoundingClientRect().top - e.getBoundingClientRect().top) < 4; })(), zeile: (document.querySelector('#bedeutungLeiste [data-bed-offen]') || {}).textContent || '' }));
  ok('B13 ein neues Dokument wird NICHT von selbst eingeordnet; „Prüfen" und „Einordnen" stehen nebeneinander', b13.passagen === 0 && b13.offen === 1 && /Einordnen/.test(b13.knopf) && b13.neben && /1 noch nicht eingeordnet/.test(b13.zeile), b13);
  await page.click('#pruefAlle [data-einordnen]');
  const f2 = await page.waitForSelector('.dlg', { timeout: 5000 }).then(e => e.innerText(), () => '');
  ok('B14 ohne Auswahl fragt „Einordnen": „Alle 1 Dokumente einordnen?"', /Alle 1 Dokumente einordnen\?/.test(f2), f2);
  await dlgJa(page);
  await page.waitForFunction(() => window.__wfpdf.bedeutung.offeneEinordnen().length === 0 && !window.__wfpdf.bedeutung.BED.einLauf, null, { timeout: 30000 });
  ok('B15 … nach „Einordnen" ist es eingeordnet (Abschnitte gerechnet)', await page.evaluate(() => window.__stub.passagen > 0));
  // Auswahl: nur die gewählten
  await page.reload(); await bereit(page);
  await page.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit', null, { timeout: 30000 });
  await page.setInputFiles('#inDatei', [{ name: 'A.pdf', mimeType: 'application/pdf', buffer: await pdfMit(['Erstes neues Blatt.']) }, { name: 'B.pdf', mimeType: 'application/pdf', buffer: await pdfMit(['Zweites neues Blatt.']) }]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 6 && document.querySelectorAll('#dokGitter .dok').length === 6, null, { timeout: 60000 });
  await page.evaluate(() => { const k = [...document.querySelectorAll('#dokGitter .dok')].find(d => d.querySelector('.dok-name').textContent === 'A'); k.querySelector('[data-haken]').click(); });
  const wk = await page.textContent('#pruefAlle [data-einordnen]');
  await page.click('#pruefAlle [data-einordnen]');
  await page.waitForFunction(() => !window.__wfpdf.bedeutung.BED.einLauf && window.__wfpdf.bedeutung.offeneEinordnen().length === 1, null, { timeout: 30000 }).catch(() => {});
  const b16 = await page.evaluate(() => ({ dlg: !!document.querySelector('.dlg'), offen: window.__wfpdf.bedeutung.offeneEinordnen().map(d => d.name) }));
  ok('B16 mit Auswahl: „Einordnen (1)" ordnet ohne Frage nur das gewählte ein', /Einordnen \(1\)/.test(wk) && !b16.dlg && b16.offen.length === 1 && b16.offen[0] === 'B', { wk, b16 });
  await page.evaluate(() => document.querySelector('#wahlLeiste [data-wahl-ende]').click());
  // Abbrechen (Leiste): hält an, der Rest bleibt offen
  await page.evaluate(() => { window.__stubBatchTakt = 700; });
  await page.setInputFiles('#inDatei', [{ name: 'C.pdf', mimeType: 'application/pdf', buffer: await pdfMit(['Drittes neues Blatt.']) }]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 7, null, { timeout: 60000 }); await zurBib(page);
  await page.click('#pruefAlle [data-einordnen]'); await dlgJa(page);
  await page.waitForSelector('#pruefAlle [data-einordnen-stopp]', { timeout: 5000 });
  await page.click('#pruefAlle [data-einordnen-stopp]');
  await page.waitForFunction(() => !window.__wfpdf.bedeutung.BED.einLauf, null, { timeout: 30000 });
  const b17 = await page.evaluate(() => ({ offen: window.__wfpdf.bedeutung.offeneEinordnen().length, zeile: (document.querySelector('#bedeutungLeiste [data-bed-offen]') || {}).textContent || '', frei: window.__wfpdf.bedeutung.BED.frei }));
  ok('B17 „Abbrechen" hält das Einordnen an: Dokumente bleiben offen, die Zeile sagt „Angehalten"', b17.offen >= 1 && /Angehalten/.test(b17.zeile) && !b17.frei, b17);
  await page.evaluate(() => { window.__stubBatchTakt = 0; });

  // --- B18 Bildbeschreibung erst auf „Beschreiben" ---
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 300, height: 400 } });
  await page.setInputFiles('#inDatei', [{ name: 'Garten.png', mimeType: 'image/png', buffer: png }, { name: 'Hof.png', mimeType: 'image/png', buffer: png }]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 9, null, { timeout: 60000 }); await page.waitForTimeout(500); await zurBib(page);
  const b18 = await page.evaluate(() => ({ pipes: window.__bildStub.pipelines, text: document.querySelector('#bildLeiste [data-bild-text]').innerText, haupt: !!document.querySelector('#bildLeiste [data-bild-beschreiben].bild-haupt') }));
  ok('B18 neue Fotos werden nicht von selbst beschrieben; die Zeile zählt sie, „Beschreiben" ist farbig', b18.pipes === 0 && /2 Foto\(s\) noch nicht beschrieben/.test(b18.text) && b18.haupt, b18);
  await page.click('#bildLeiste [data-bild-beschreiben]');
  const f3 = await page.waitForSelector('.dlg', { timeout: 5000 }).then(e => e.innerText(), () => '');
  ok('B19 „Beschreiben" fragt mit Zahl und Größe', /2 Foto\(s\) beschreiben\?/.test(f3) && /256 MB/.test(f3), f3);
  await dlgJa(page);
  await page.waitForFunction(() => document.getElementById('bildLeiste').dataset.bildZustand === 'bereit', null, { timeout: 30000 });
  const b20 = await page.evaluate(() => ({ calls: window.__bildStub.calls, hg: window.__hg.filter(a => a.art === 'beschreiben').map(a => ({ titel: a.titel, n: a.staende.length, ende: a.ende })) }));
  ok('B20 danach: beide Fotos beschrieben, als Hintergrundaufgabe „Bildbeschreibung läuft" mit Stand', b20.calls === 2 && b20.hg.length === 1 && b20.hg[0].titel === 'Bildbeschreibung läuft' && b20.hg[0].n >= 2 && b20.hg[0].ende, b20);

  // --- B21 Strichgrafiken, flache Knöpfe ---
  const em = await sichtEmoji(page);
  ok('B21 Bibliothek: kein sichtbares Emoji (Kopf, Kacheln, Suche, Leisten, Karten)', !em.length, em);
  const st = await page.evaluate(() => ({ svg: document.querySelectorAll('#sc-bib svg.ic-strich, .kopf svg.ic-strich').length, desc: (document.querySelector('#btnScan svg.ic-strich desc') || {}).textContent || '', farbe: getComputedStyle(document.querySelector('#btnScan svg.ic-strich')).stroke }));
  ok('B22 an ihrer Stelle Strichsymbole (currentColor), das Emoji nur noch als <desc>', st.svg >= 10 && st.desc === '📷' && /rgb/.test(st.farbe), st);
  const masse = await page.evaluate(() => [...document.querySelectorAll('#sc-bib .import-leiste .gross-knopf, .kopf .ikon, #pruefAlle .knopf, #ordnerAktionen .knopf, #bildZeilen button, #dokGitter .knopf')].filter(e => e.checkVisibility()).map(e => [e.id || e.className.split(' ').slice(0, 2).join('.'), Math.round(e.getBoundingClientRect().height)]).filter(([, hh]) => hh > 34));
  ok('B23 Start-Kacheln und Knöpfe der Bibliothek sind flach (höchstens 34 px hoch)', !masse.length, masse);
  const kach = await page.evaluate(() => [...document.querySelectorAll('.import-leiste .gross-knopf')].map(e => ({ rot: e.classList.contains('rot'), schatten: getComputedStyle(e).boxShadow })));
  ok('B24 von den Start-Kacheln ist genau eine farbig, keine wirft Schatten', kach.filter(k => k.rot).length === 1 && kach.every(k => k.schatten === 'none'), kach);
  // Englisch: dieselben Knöpfe übersetzt, Symbol bleibt
  await page.evaluate(() => WFP.Sprache.setzen('en')); await page.waitForTimeout(300);
  const en = await page.evaluate(() => ({ scan: document.getElementById('btnScan').innerText.trim(), svg: !!document.querySelector('#btnScan svg.ic-strich'), pruef: (document.querySelector('#pruefAlle [data-pruefen]') || document.querySelector('#pruefAlle [data-einordnen]') || {}).innerText || '' }));
  ok('B25 auf Englisch: übersetzt, Strichsymbol bleibt, kein Emoji', /Scan/.test(en.scan) && !/Scannen/.test(en.scan) && en.svg && !EMOJI.test(en.scan + en.pruef) && !/Prüfen|Einordnen/.test(en.pruef), en);
  ok('B25b ein Satz, der nur mit Emoji im Wörterbuch steht, wird auch ohne Emoji übersetzt („Ordner ausgeben" → „Export folder")', await page.evaluate(() => WFP.Sprache.T('Ordner ausgeben') === 'Export folder'), await page.evaluate(() => WFP.Sprache.T('Ordner ausgeben')));
  ok('B26 auf Englisch kein sichtbares Emoji', !(await sichtEmoji(page)).length, await sichtEmoji(page));
  await page.evaluate(() => WFP.Sprache.setzen('de')); await page.waitForTimeout(300);
  ok('B27 zurück auf Deutsch: wieder deutsch, Symbol bleibt', await page.evaluate(() => /Scannen/.test(document.getElementById('btnScan').innerText) && !!document.querySelector('#btnScan svg.ic-strich')));
  // Editor-Leiste, Einstellungen, Scanner-Kopf
  await page.evaluate(() => window.__wfpdf.oeffneDok(window.__wfpdf.S.docs.find(x => x.name === 'Rechnung').id));
  await page.waitForFunction(() => document.getElementById('sc-ed').classList.contains('on'));
  ok('B28 Editor-Leiste ohne sichtbares Emoji', !(await sichtEmoji(page)).length, await sichtEmoji(page));
  await page.click('#edZurueck'); await page.waitForFunction(() => document.getElementById('sc-bib').classList.contains('on'));
  await page.click('#btnEinst'); await page.waitForSelector('.dlg');
  ok('B29 Einstellungen ohne sichtbares Emoji', !(await sichtEmoji(page)).length, await sichtEmoji(page));
  await page.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });
  await page.click('#btnScan'); await page.waitForSelector('.scan', { timeout: 15000 });
  ok('B30 Scanner ohne sichtbares Emoji', !(await sichtEmoji(page)).length, await sichtEmoji(page));
  ok('B31 keine Seitenfehler', !fehler.length, fehler);
  await ctx.close();
} catch (e) { ok('Probe lief durch', false, String((e && e.stack) || e).split('\n').slice(0, 3).join(' | ')); }
finally { await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
