/* Workfloh PDF — Bildbeschreibung (Klaus, Sitzung 4, 2026-10-26; Sammlung Punkte 12–14).
   Teil A (ohne Browser): die Rechnung in assets/bildbeschreibung.js (Felder für die Suche, was ein Foto ist),
   die Einbindung (index.html, sw.js, app.js-Nähte) und: KEIN Emoji in den neuen Oberflächentexten.
   Teil B (echter Browser): das Feld an jedem Foto (nicht am PDF), eigene Worte tippen → gespeichert, nach dem
   Neuladen da, gefunden mit Fundzeile „Bildbeschreibung" · der Schalter unter der Suche mit ⓘ (anfangs offen,
   gemerkt) · das Modell: vor dem Tipp geht nichts ins Netz, der Dialog nennt die GEMESSENEN Zahlen, Laden mit
   Balken und MB, Beschreiben Foto für Foto, Modellworte am Foto und in der Suche, die Wahl ist gemerkt, ein neues
   Foto wird nachgezogen, Fehler und Nochmal, Abbrechen, Entfernen, Editor, Sprache, Handy-Breite.

   ⚠ Das echte Modell kommt hier NICHT (der Behälter erreicht jsDelivr und Hugging Face nicht): transformers.js
   wird durch einen STELLVERTRETER ersetzt, der dieselben Fortschritts-Meldungen schickt ({status, file, loaded,
   total}) und zu jedem Bild denselben Satz liefert. Was das echte Modell zu Klaus' Fotos sagt, zeigt erst das
   Tablet. Nur erfundene Daten. WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = process.env.WURZEL || path.resolve(HIER, '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };
const EMOJI = /\p{Extended_Pictographic}/u;

/* ---------- Teil A: Rechnung und Einbindung ---------- */
console.log('Workfloh PDF — Bildbeschreibung');
await import(pathToFileURL(path.join(WURZEL, 'assets/bildbeschreibung.js')).href);
const BI = globalThis.__WFP_BILD;
ok('Modul steht ohne Browser (WFP.Bild)', !!BI && typeof BI.suchFelder === 'function');
const foto = { id: 'f', name: 'Urlaub', quelle: 'foto', thumb: 'data:x', pages: [{}], bild: { eigen: ' Strand mit Palmen ', modell: 'a beach with palm trees' } };
const pdf = { id: 'p', name: 'Brief', quelle: 'pdf', pages: [{}], bild: { eigen: 'Hallo' } };
ok('Ein Foto (Quelle foto, zuschnitt) ist ein Bild, ein PDF nicht', BI.istBild(foto) && BI.istBild({ quelle: 'zuschnitt' }) && !BI.istBild(pdf) && !BI.istBild(null));
const sf = BI.suchFelder(foto);
ok('Felder für die Suche: eigene Worte und Modellworte, jedes als Feld mit eigener Kennung', sf.length === 2 && sf[0].id === '__bild:eigen' && sf[0].value === 'Strand mit Palmen' && sf[1].id === '__bild:modell' && sf[1].value === 'a beach with palm trees', sf);
ok('Ein PDF liefert keine Bild-Felder, ein Foto ohne Worte auch nicht', BI.suchFelder(pdf).length === 0 && BI.suchFelder({ quelle: 'foto' }).length === 0);
ok('„beschrieben" heißt: Foto mit eigenen Worten oder Modellworten', BI.beschrieben(foto) && !BI.beschrieben(pdf) && !BI.beschrieben({ quelle: 'foto', bild: { eigen: '  ' } }));
ok('Die Fundzeile heißt „Bildbeschreibung" bzw. „Bildbeschreibung vom Modell"', BI.istBildFund({ art: 'feld', feldId: '__bild:eigen' }) && BI.fundWo({ feldId: '__bild:eigen' }) === 'Bildbeschreibung' && BI.fundWo({ feldId: '__bild:modell' }) === 'Bildbeschreibung vom Modell' && !BI.istBildFund({ art: 'feld', feldId: 'x' }));
ok('Die gemessenen Zahlen stehen im Modul (256 MB Download, 1217 MB Spitze)', BI.MESSUNG.downloadMB === 256 && BI.MESSUNG.spitzeMB === 1217);
const quelle = fs.readFileSync(path.join(WURZEL, 'assets/bildbeschreibung.js'), 'utf8');
ok('KEIN Emoji im Modul (Liniensymbole, kein Bilderbuch)', !EMOJI.test(quelle));
const HTML = fs.readFileSync(path.join(WURZEL, 'index.html'), 'utf8'), SW = fs.readFileSync(path.join(WURZEL, 'sw.js'), 'utf8'), APP = fs.readFileSync(path.join(WURZEL, 'assets/app.js'), 'utf8');
const v = (HTML.match(/assets\/bildbeschreibung\.js\?v=(\d+)/) || [])[1];
ok('index.html lädt das Modul vor app.js, sw.js hat es im Vorrat (gleiches ?v=)', !!v && HTML.indexOf('assets/bildbeschreibung.js') < HTML.indexOf('assets/app.js?v=') && SW.includes(`./assets/bildbeschreibung.js?v=${v}'`), v);
ok('index.html hat die Plätze: eine Zeile mit Schalter und Modell-Leiste, Editor-Feld', /id="bildZeilen"/.test(HTML) && /id="bildFilterZeile"/.test(HTML) && /id="bildLeiste"/.test(HTML) && /id="edBild"/.test(HTML));
ok('app.js reicht die Suche, den Filter, die Karten und den Editor an das Modul', APP.includes('concat(bildFelder(d))') && APP.includes('&& bildFilter(d))') && APP.includes('WFP.Bild.karten(g)') && APP.includes('WFP.Bild.editor(d)') && APP.includes('WFP.Bild.nachziehen()'));
const IMP = fs.readFileSync(path.join(WURZEL, 'impressum.html'), 'utf8');
ok('Die Datenschutzerklärung nennt die Bildbeschreibung (Modell aus dem Netz, Fotos bleiben auf dem Gerät)', /Bildbeschreibung/.test(IMP) && /Bildmodell/.test(IMP));

/* ---------- Teil B: echter Browser ---------- */
let pw = null;
try { pw = await import('playwright-core'); } catch (_) {}
if (!pw) { console.log('  ⊘ nicht lauffähig (playwright-core fehlt — npm install)'); console.log(`\n${gruen} grün · ${rot} ROT`); process.exitCode = 2; process.exit(); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-bild-'));
async function pdfMit(zeilen) {
  const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); const p = d.addPage([595, 842]);
  zeilen.forEach((z, i) => p.drawText(z, { x: 50, y: 780 - i * 28, size: 12, font: f }));
  return d.save();
}
fs.writeFileSync(path.join(TMP, 'Formular.pdf'), await pdfMit(['Antrag Musterstadt', 'Kundennummer 4711']));

const LIB = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
// Der Stellvertreter für transformers.js: pipeline() mit denselben Fortschritts-Meldungen, ein Satz je Bild.
const STUB = `export const env = {};
export async function pipeline(task, model, opt) {
  const st = window.__bildStub; st.pipelines++; st.task = task; st.model = model; st.host = env.remoteHost;
  if (window.__bildStubFehler) throw new Error('Modell nicht erreichbar (Probe)');
  const dateien = [['onnx/encoder_model_quantized.onnx', 90000000], ['onnx/decoder_model_merged_quantized.onnx', 150000000], ['tokenizer.json', 2000000]];
  const takt = window.__bildStubTakt || 60;
  for (let s = 1; s <= 5; s++) { for (const [f, t] of dateien) opt.progress_callback({ status: 'progress', file: f, loaded: t * s / 5, total: t }); await new Promise(r => setTimeout(r, takt)); }
  for (const [f] of dateien) opt.progress_callback({ status: 'done', file: f });
  return async img => { st.calls++; st.letztes = img; return [{ generated_text: window.__bildStubText || 'a beach with palm trees ' }]; };
}`;
const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
const srv = await new Promise(res => { const s = http.createServer((q, r2) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r2.writeHead(404); r2.end(); return; }
  r2.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r2);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = [process.env.CB_CHROMIUM, '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean).find(fs.existsSync);
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
const fremd = [];
async function seite(ctx) {
  const page = await ctx.newPage();
  page.__fehler = []; page.on('pageerror', e => page.__fehler.push(String(e)));
  await page.addInitScript(() => { window.__bildStub = { pipelines: 0, calls: 0 }; });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r2 => { fremd.push(r2.request().url()); r2.abort(); });
  await page.route(LIB, r2 => r2.fulfill({ contentType: 'text/javascript', body: STUB }));
  return page;
}
const zustand = page => page.evaluate(() => document.getElementById('bildLeiste').dataset.bildZustand);
const warteZustand = (page, z, ms) => page.waitForFunction(z2 => document.getElementById('bildLeiste').dataset.bildZustand === z2, z, { timeout: ms || 20000 });
const karte = (page, name) => page.evaluate(n => { const k = [...document.querySelectorAll('#dokGitter .dok')].find(d => d.querySelector('.dok-name').textContent === n); if (!k) return null; const f = k.querySelector('.bild-feld'), ta = f && f.querySelector('.bild-eigen'), m = f && f.querySelector('[data-bild-modell]');
  return { feld: !!f, eigen: ta ? ta.value : null, h: ta ? ta.getBoundingClientRect().height : 0, modellSichtbar: !!m && !m.hidden, modell: m ? m.querySelector('.bild-modell-text').textContent : '', fund: [...k.querySelectorAll('.fund-wo')].map(e => e.textContent), emoji: /\p{Extended_Pictographic}/u.test(f ? f.innerText + f.querySelector('.bild-eigen').placeholder : ''), schatten: ta ? getComputedStyle(ta).boxShadow : '' }; }, name);
const namen = page => page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok .dok-name')].map(e => e.textContent));
const suchen = (page, q) => page.evaluate(q2 => { const w = window.__wfpdf; w.S.suche = q2; document.getElementById('bibSuche').value = q2; w.suche.zeichneBibliothek(); }, q);
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  let page = await seite(ctx);
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.__wfpdf.bild);
  // Ein Foto (PNG aus einem Bildschirmfoto, wird zu quelle „foto") und ein PDF — zusammen, damit sich kein Editor öffnet
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: 600, height: 800 } });
  await page.setInputFiles('#inDatei', [{ name: 'Urlaub.png', mimeType: 'image/png', buffer: png }, { name: 'Formular.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(path.join(TMP, 'Formular.pdf')) }]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 2 && document.querySelectorAll('#dokGitter .dok').length === 2, null, { timeout: 60000 });
  await page.waitForFunction(() => document.querySelector('#dokGitter .bild-feld'));
  const ku = await karte(page, 'Urlaub'), kf = await karte(page, 'Formular');
  ok('Punkt 13: das Foto trägt das Feld „Bildbeschreibung", das PDF nicht', ku && ku.feld && kf && !kf.feld, { ku, kf });
  ok('Das Feld ist flach (höchstens 32 px mit Maus) und ohne Schatten, ohne Emoji', ku.h > 0 && ku.h <= 32 && ku.schatten === 'none' && !ku.emoji, ku);
  const zeile = await page.evaluate(() => { const z = document.getElementById('bildFilterZeile'), f = z.querySelector('[data-bild-filter]'), i = z.querySelector('[data-bild-hilfe]'), t = document.getElementById('bildHilfe'), zz = document.getElementById('bildZeilen');
    const einzeilig = Math.abs(f.getBoundingClientRect().top - document.querySelector('#bildLeiste [data-bild-an]').getBoundingClientRect().top) < 4;
    return { nachSuche: document.getElementById('bibForm').nextElementSibling === zz && z.parentElement === zz && einzeilig, text: f.querySelector('span').textContent, h: f.getBoundingClientRect().height, schatten: getComputedStyle(f).boxShadow, pressed: f.getAttribute('aria-pressed'), hilfeOffen: !t.hidden, hilfe: t.textContent, emoji: /\p{Extended_Pictographic}/u.test(z.innerText + f.title + i.title), leiste: document.getElementById('bildLeiste').innerText }; });
  ok('Punkt 14: der Schalter „Bildbeschreibung" steht flach direkt unter der Suche, in EINER Zeile mit dem Modell-Knopf, aus, ohne Emoji', zeile.nachSuche && zeile.text === 'Bildbeschreibung' && zeile.h <= 32 && zeile.schatten === 'none' && zeile.pressed === 'false' && !zeile.emoji, zeile);
  ok('ⓘ: die Erklärung ist beim ersten Mal offen und sagt, was gesucht wird', zeile.hilfeOffen && /eigenen und die vom Modell/.test(zeile.hilfe), zeile.hilfe);
  ok('Die Modell-Leiste bietet „Fotos beschreiben lassen" an und ist ohne Emoji', /Fotos beschreiben lassen/.test(zeile.leiste) && !EMOJI.test(zeile.leiste), zeile.leiste);
  ok('Vor dem Tipp geht nichts ins Netz (kein jsDelivr, kein Hugging Face)', fremd.length === 0 && await page.evaluate(() => window.__bildStub.pipelines === 0), fremd);
  await page.click('#bildFilterZeile [data-bild-hilfe]');
  ok('Ein Tipp auf ⓘ blendet die Erklärung aus', await page.evaluate(() => document.getElementById('bildHilfe').hidden));
  // Eigene Worte tippen → gespeichert (nach 600 ms Ruhe)
  const ta = page.locator('#dokGitter .dok .bild-feld .bild-eigen');
  await ta.click(); await ta.fill('Strand mit Palmen');
  await page.waitForFunction(() => { const d = window.__wfpdf.S.docs.find(x => x.name === 'Urlaub'); return d.bild && d.bild.eigen === 'Strand mit Palmen'; });
  const gespeichert = await page.evaluate(async () => { const d = window.__wfpdf.S.docs.find(x => x.name === 'Urlaub'); const r = await WFP.DB.get('docs', d.id); return r.bild && r.bild.eigen; });
  ok('Punkt 13: eigene Worte werden am Dokument gespeichert (IndexedDB), getrennt vom Modell', gespeichert === 'Strand mit Palmen' && await page.evaluate(() => !window.__wfpdf.S.docs.find(x => x.name === 'Urlaub').bild.modell));
  ok('Ein Tipp ins Feld öffnet das Foto nicht', await page.evaluate(() => document.getElementById('sc-bib').classList.contains('on')));
  // Neu laden: Worte da, ⓘ gemerkt (zu)
  await page.reload(); await page.waitForFunction(() => window.__wfpdf && document.querySelectorAll('#dokGitter .dok').length === 2);
  await page.waitForFunction(() => document.querySelector('#dokGitter .bild-feld'));
  const nach = await karte(page, 'Urlaub');
  ok('Nach dem Neuladen stehen die eigenen Worte im Feld', nach.eigen === 'Strand mit Palmen', nach);
  ok('ⓘ: die Wahl ist gemerkt (bleibt zu)', await page.evaluate(() => document.getElementById('bildHilfe').hidden));
  await page.click('#bildFilterZeile [data-bild-hilfe]');
  ok('ⓘ: ein Tipp öffnet sie wieder', await page.evaluate(() => !document.getElementById('bildHilfe').hidden));
  // Suche nach den eigenen Worten
  await suchen(page, 'Palmen');
  let n = await namen(page), k = await karte(page, 'Urlaub');
  ok('Die Suche findet das Foto an den eigenen Worten, mit Fundzeile „Bildbeschreibung" — das PDF nicht', n.length === 1 && n[0] === 'Urlaub' && !!k && k.fund.includes('Bildbeschreibung'), { n, fund: k && k.fund });
  await suchen(page, 'Musterstadt'); n = await namen(page);
  ok('Die gewöhnliche Suche findet weiter das PDF', n.length === 1 && n[0] === 'Formular', n);
  // Der Schalter: nur beschriebene Fotos
  await suchen(page, '');
  await page.click('#bildFilterZeile [data-bild-filter]');
  await page.waitForFunction(() => document.querySelectorAll('#dokGitter .dok').length === 1, null, { timeout: 8000 }).catch(() => {});
  n = await namen(page);
  ok('Schalter an: nur das beschriebene Foto steht in der Liste', n.length === 1 && n[0] === 'Urlaub' && await page.evaluate(() => document.querySelector('[data-bild-filter]').getAttribute('aria-pressed') === 'true'), n);
  await suchen(page, 'Musterstadt');
  const leer = await page.evaluate(() => { const e = document.querySelector('#dokGitter [data-bildleer]'); return e ? e.innerText : null; });
  ok('Schalter an und ein Wort, das nur im PDF steht: die Liste sagt, dass der Schalter die Ursache ist', leer && /Bildbeschreibung/.test(leer) && /Schalter aus/.test(leer), leer);
  if (leer) { await page.click('#dokGitter [data-bildfilterweg]'); await page.waitForFunction(() => document.querySelectorAll('#dokGitter .dok').length === 1 && !document.querySelector('[data-bildleer]')); } else await page.evaluate(() => window.__wfpdf.bild.filterSetzen(false));
  ok('„Schalter aus" aus der leeren Liste schaltet ab und zeigt das PDF', (await namen(page))[0] === 'Formular' && await page.evaluate(() => localStorage.getItem('wfpdf_bildfilter_v1') === '0'));
  await page.reload(); await page.waitForFunction(() => window.__wfpdf && document.querySelectorAll('#dokGitter .dok').length === 2);
  ok('Schalter: aus bleibt nach dem Neuladen aus', await page.evaluate(() => document.querySelector('[data-bild-filter]').getAttribute('aria-pressed') === 'false'));
  // Das Modell: Dialog mit den gemessenen Zahlen, dann laden
  await page.click('#bildLeiste [data-bild-an]');
  const dlg = await page.evaluate(() => { const d = document.querySelector('.dlg'); return d ? d.innerText : ''; });
  ok('Der Dialog sagt VORHER, was aus dem Netz kommt, und nennt die GEMESSENEN Zahlen (256 MB, 1,2 GB, nicht Tablet)', /jsDelivr/.test(dlg) && /Hugging Face/.test(dlg) && /256 MB/.test(dlg) && /1,2 GB/.test(dlg) && /nicht Tablet/.test(dlg) && /NICHT ins Netz/.test(dlg) && !EMOJI.test(dlg), dlg);
  await page.evaluate(() => { window.__bildStubTakt = 150; });
  await page.click('.dlg [data-bild-laden]');
  await warteZustand(page, 'laedt');
  await page.waitForFunction(() => { const i = document.querySelector('#bildLeiste [data-bild-balken] i'); return i && parseFloat(i.style.width) > 0; });
  const laedt = await page.evaluate(() => ({ text: document.querySelector('#bildLeiste [data-bild-text]').innerText, breite: parseFloat(document.querySelector('#bildLeiste [data-bild-balken] i').style.width), abbruch: !!document.querySelector('#bildLeiste [data-bild-abbruch]') }));
  ok('Laden: Balken mit MB von MB und ein Abbrechen-Knopf', /Bildmodell wird geladen: \d+ von 2\d\d MB/.test(laedt.text) && laedt.breite > 0 && laedt.abbruch, laedt);
  await warteZustand(page, 'bereit', 30000);
  const bereit = await page.evaluate(() => ({ text: document.getElementById('bildLeiste').innerText, st: window.__bildStub, d: window.__wfpdf.S.docs.find(x => x.name === 'Urlaub').bild, p: window.__wfpdf.S.docs.find(x => x.name === 'Formular').bild }));
  ok('Nach dem Laden wird jedes Foto EINMAL beschrieben, das PDF nicht; die Leiste zählt', bereit.st.pipelines === 1 && bereit.st.calls === 1 && bereit.d.modell === 'a beach with palm trees' && bereit.d.eigen === 'Strand mit Palmen' && !bereit.p && /1 Fotos vom Modell beschrieben/.test(bereit.text), bereit);
  ok('Das Modell bekommt das Vorschaubild des Fotos (eine Daten-Adresse), und die Wahl ist gemerkt', /^data:image\/jpeg/.test(bereit.st.letztes || '') && await page.evaluate(() => JSON.parse(localStorage.getItem('wfpdf_einst_v1')).bild === true));
  ok('Erst der eigene Server (family-projekt.de), dann Hugging Face', bereit.st.host === 'https://family-projekt.de/models/', bereit.st.host);
  k = await karte(page, 'Urlaub');
  ok('Die Karte zeigt „Vom Modell: …" getrennt über den eigenen Worten', k.modellSichtbar && k.modell === 'a beach with palm trees' && k.eigen === 'Strand mit Palmen', k);
  await suchen(page, 'palm'); n = await namen(page); k = await karte(page, 'Urlaub');
  ok('Die Suche findet das Foto an den Modellworten, Fundzeile „Bildbeschreibung vom Modell"', n.length === 1 && !!k && k.fund.includes('Bildbeschreibung vom Modell'), { n, fund: k && k.fund });
  // Neu laden: das Modell startet (gemerkte Wahl), beschreibt aber nichts noch einmal
  await page.reload(); await page.waitForFunction(() => window.__wfpdf && document.querySelectorAll('#dokGitter .dok').length === 2);
  // Pro-Umbau 5 (Klaus 2026-10-28): nach dem Neuladen startet NICHTS von selbst — die Zeile wartet auf „Beschreiben"
  await warteZustand(page, 'wartet', 30000); await page.waitForTimeout(500);
  ok('Nach dem Neuladen lädt das Modell NICHT von selbst (Wahl gemerkt, Zeile wartet auf „Beschreiben")', await page.evaluate(() => window.__bildStub.pipelines === 0 && window.__bildStub.calls === 0) && !!(await page.$('#bildLeiste [data-bild-beschreiben]')));
  await page.click('#bildLeiste [data-bild-beschreiben]'); await page.click('.dlg [data-j]');
  await warteZustand(page, 'bereit', 30000);
  ok('Nach „Beschreiben" lädt das Modell und beschreibt NICHTS noch einmal', await page.evaluate(() => window.__bildStub.pipelines === 1 && window.__bildStub.calls === 0));
  // Ein neues Foto wird nachgezogen
  await page.setInputFiles('#inDatei', [{ name: 'Garten.png', mimeType: 'image/png', buffer: png }, { name: 'Garten 2.png', mimeType: 'image/png', buffer: png }]);
  await page.waitForFunction(() => window.__wfpdf.S.docs.length === 4, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__wfpdf.S.docs.filter(d => d.bild && d.bild.modell).length === 3, null, { timeout: 30000 }).catch(() => {});
  await warteZustand(page, 'bereit', 30000).catch(() => {});
  const nach2 = await page.evaluate(() => ({ calls: window.__bildStub.calls, zustand: document.getElementById('bildLeiste').dataset.bildZustand, leiste: document.getElementById('bildLeiste').innerText, docs: window.__wfpdf.S.docs.map(d => [d.name, d.quelle, !!(d.bild && d.bild.modell)]), einst: window.__wfpdf.EINST.bild, b: (() => { const b = window.__wfpdf.bild.zustand(); return { z: b.zustand, pipe: !!b.pipe, lauf: !!b._lauf, fehler: b.fehler }; })() }));
  ok('Neue Fotos werden nachgezogen (zwei beschrieben, das alte nicht noch einmal)', nach2.calls === 2 && /3 Fotos vom Modell beschrieben/.test(nach2.leiste), nach2);
  // Editor: dasselbe Feld, nur bei Fotos
  await page.evaluate(() => window.__wfpdf.oeffneDok(window.__wfpdf.S.docs.find(x => x.name === 'Urlaub').id));
  await page.waitForFunction(() => document.getElementById('sc-ed').classList.contains('on') && !document.getElementById('edBild').hidden);
  const ed = await page.evaluate(() => ({ eigen: document.querySelector('#edBild .bild-eigen').value, modell: document.querySelector('#edBild .bild-modell-text').textContent, h: document.querySelector('#edBild .bild-eigen').getBoundingClientRect().height }));
  ok('Editor: das Feld steht unter der Leiste mit eigenen Worten und Modellworten', ed.eigen === 'Strand mit Palmen' && ed.modell === 'a beach with palm trees' && ed.h <= 32, ed);
  await page.fill('#edBild .bild-eigen', 'Strand, Palmen, Abend'); await page.press('#edBild .bild-eigen', 'Enter');
  await page.waitForFunction(() => window.__wfpdf.S.docs.find(x => x.name === 'Urlaub').bild.eigen === 'Strand, Palmen, Abend');
  ok('Editor: Enter speichert die eigenen Worte', true);
  await page.click('#edZurueck'); await page.waitForFunction(() => document.getElementById('sc-bib').classList.contains('on'));
  await page.evaluate(() => window.__wfpdf.oeffneDok(window.__wfpdf.S.docs.find(x => x.name === 'Formular').id));
  await page.waitForFunction(() => document.getElementById('sc-ed').classList.contains('on'));
  ok('Editor: bei einem PDF ist kein Feld da', await page.evaluate(() => document.getElementById('edBild').hidden));
  await page.click('#edZurueck'); await page.waitForFunction(() => document.getElementById('sc-bib').classList.contains('on'));
  // Fehler: wird gesagt, Nochmal hilft
  await page.evaluate(() => { window.__wfpdf.bild.aus(); window.__bildStubFehler = true; window.__bildStubTakt = 10; });
  await page.evaluate(() => { window.__wfpdf.EINST.bild = true; window.__wfpdf.bild.starten(); });
  await warteZustand(page, 'fehler', 8000).catch(() => {});
  const feh = await page.evaluate(() => document.getElementById('bildLeiste').innerText);
  ok('Fehler: wird gesagt, mit Grund und „Nochmal"', /ging nicht/.test(feh) && /Probe/.test(feh) && /Nochmal/.test(feh), feh);
  await page.evaluate(() => { window.__bildStubFehler = false; });
  if (await page.$('#bildLeiste [data-bild-nochmal]')) await page.click('#bildLeiste [data-bild-nochmal]'); else await page.evaluate(() => { window.__wfpdf.EINST.bild = true; window.__wfpdf.bild.starten(); });
  await warteZustand(page, 'bereit', 30000);
  ok('„Nochmal" lädt neu und wird bereit', true);
  // Abbrechen beim Laden
  await page.evaluate(() => { window.__wfpdf.bild.aus(); window.__bildStubTakt = 400; window.__wfpdf.EINST.bild = true; window.__wfpdf.bild.starten(); });
  await warteZustand(page, 'laedt');
  await page.click('#bildLeiste [data-bild-abbruch]');
  await warteZustand(page, 'aus');
  ok('Abbrechen: Leiste aus, Wahl nicht gemerkt, Modell nicht gestartet', await page.evaluate(() => JSON.parse(localStorage.getItem('wfpdf_einst_v1')).bild === false));
  await page.waitForTimeout(2500);
  ok('… und auch nach dem Ende des Ladens bleibt es aus (nichts beschrieben)', await zustand(page) === 'aus');
  // Entfernen fragt über den Dialog, lässt die Beschreibungen stehen
  await page.evaluate(() => { window.__bildStubTakt = 10; window.__wfpdf.EINST.bild = true; window.__wfpdf.bild.starten(); });
  await warteZustand(page, 'bereit', 30000);
  await page.click('#bildLeiste [data-bild-mehr]');
  await page.waitForSelector('.dlg [data-bild-entfernen]');
  await page.click('.dlg [data-bild-entfernen]');
  await warteZustand(page, 'aus');
  ok('Entfernen: Leiste aus, Wahl aus, die Beschreibungen an den Fotos bleiben', await page.evaluate(() => JSON.parse(localStorage.getItem('wfpdf_einst_v1')).bild === false && window.__wfpdf.S.docs.find(x => x.name === 'Urlaub').bild.modell === 'a beach with palm trees'));
  // Sprache
  await page.evaluate(() => WFP.Sprache.setzen('en')); await page.waitForTimeout(300);
  const en = await page.evaluate(() => ({ leiste: document.querySelector('#bildLeiste [data-bild-an] span').textContent, filter: document.querySelector('[data-bild-filter] span').textContent, feld: document.querySelector('#dokGitter .bild-feld-name').textContent }));
  ok('Die neuen Texte folgen der App-Sprache (EN)', en.leiste === 'Let photos be described' && en.filter === 'Image description' && en.feld === 'Image description', en);
  await page.evaluate(() => WFP.Sprache.setzen('de')); await page.waitForTimeout(200);
  // Handy
  await page.setViewportSize({ width: 360, height: 740 }); await page.waitForTimeout(200);
  const handy = await page.evaluate(() => ({ breit: document.documentElement.scrollWidth <= document.documentElement.clientWidth, zeile: document.getElementById('bildFilterZeile').getBoundingClientRect().right <= 360, leiste: document.getElementById('bildLeiste').getBoundingClientRect().right <= 360, feld: document.querySelector('#dokGitter .bild-feld').getBoundingClientRect().right <= 360 }));
  ok('Handy (360 px): Schalterzeile, Leiste und Feld laufen nicht über', handy.breit && handy.zeile && handy.leiste && handy.feld, handy);
  ok('Keine Skriptfehler', page.__fehler.length === 0, page.__fehler);
  await ctx.close();
} finally { await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true }); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
