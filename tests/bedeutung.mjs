/* Workfloh PDF — Suche, Stufe 2: nach Bedeutung (Klaus 2026-09-26).
   Teil A (ohne Browser): die Rechnung in assets/bedeutung.js — Abschnitte, Fingerabdruck,
   Ladestand, Rangliste.
   Teil B (echter Browser): einschalten, Ladebalken mit Prozent und MB, einordnen, finden OHNE
   die gesuchten Wörter, Fundstelle markiert, Speicher überlebt das Neuladen, ausschalten, Fehler.

   ⚠ Das echte Modell kommt hier NICHT: der Behälter erreicht weder jsDelivr noch Hugging Face
   (gemessen: CONNECT 403). Modul 03 wird deshalb durch einen STELLVERTRETER ersetzt, der
   dieselbe Oberfläche hat (init, embedQuery, embedPassageBatch) und dieselben Fortschritts-
   Meldungen schickt wie transformers.js ({status, file, progress, loaded, total}). Er rechnet
   Vektoren aus einer kleinen Begriffs-Tafel. Modul 04 (Match) ist das ECHTE aus vendor/sbkim/.
   Was das echte Modell unter „Kündigung" findet, misst diese Probe nicht — das zeigt erst das
   Tablet. Nur erfundene Daten.
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const WURZEL = process.env.WURZEL || path.resolve(HIER, '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

/* ---------- Teil A: die Rechnung ---------- */
console.log('Workfloh PDF — Suche nach Bedeutung');
await import(pathToFileURL(path.join(WURZEL, 'assets/bedeutung.js')).href);
const BD = globalThis.__WFP_BEDEUTUNG;

// Sage-Module sind byte-1:1 — dort pflegen, hier neu kopieren (Stand Sage 4fe124d)
const PIN = { '03_embedding.js': 'e4bb8bd6a237914e7841cab5165912daf636adf0ee90c5d4ffd0c74cc5d706e5', '04_match.js': '5de95923c3f62f141e94f576feebcac0eecc55c60e40b564540a56420436a4cd' };
for (const [f, sha] of Object.entries(PIN)) {
  const p = path.join(WURZEL, 'vendor/sbkim', f);
  const ist = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'fehlt';
  ok('Modul ' + f + ' ist byte-1:1 aus Sage', ist === sha, ist);
}

const doc = { name: 'Brief', fields: [{ label: 'Kunde', value: 'Frau Muster' }, { label: 'Unterschrift', value: 'data:image/png;base64,xx' }] };
const seiten = [[['Hallo', 10, 10, 5, 2], ['Welt', 16, 10, 5, 2]], [], [['Zweite', 10, 50, 8, 2]]];
let st = BD.stuecke(doc, seiten);
ok('Abschnitte: Name und Felder zuerst, ohne Seite (nichts zu markieren)', st[0].page === null && /Brief/.test(st[0].text) && /Kunde: Frau Muster/.test(st[0].text), st[0]);
ok('Abschnitte: eine Unterschrift (Bild) wird nicht eingeordnet', !/data:image/.test(st[0].text));
ok('Abschnitte: je Seite mit Text, leere Seite übersprungen, Seitennummer stimmt', st.length === 3 && st[1].page === 0 && st[2].page === 2, st.map(x => x.page));
ok('Abschnitte: die Lage ist die Hülle der Textstücke', st[1].box && st[1].box.x === 10 && st[1].box.w === 11 && st[1].box.y === 10, st[1].box);
// Satzweise: ein Abschnitt endet am Satzende (ab STUECK_ZIEL), spätestens bei STUECK_MAX
const saetze = [Array.from({ length: 30 }, (_, i) => ['Satz ' + i + ' erklärt einen eigenen Gedanken mit einigen Wörtern.', 10, i * 2, 40, 1.5])];
st = BD.stuecke({ name: '', fields: [] }, saetze);
ok('Abschnitte: satzweise, keiner über ' + BD.STUECK_MAX + ' Zeichen', st.length >= 8 && st.every(x => x.text.length <= BD.STUECK_MAX), st.map(x => x.text.length));
ok('Abschnitte: jeder endet an einem Satzende', st.every(x => /\.$/.test(x.text)), st.map(x => x.text.slice(-12)));
ok('Abschnitte: kurz genug für EINEN Gedanken (keiner über zwei Mal STUECK_ZIEL)', st.every(x => x.text.length <= 2 * BD.STUECK_ZIEL), st.map(x => x.text.length));
ok('Abschnitte: überlappen — das letzte Stück eines Abschnitts beginnt den nächsten', st.slice(0, -1).every((x, i) => { const letzt = x.text.split(/(?<=\.) /).pop(); return st[i + 1].text.startsWith(letzt); }), st.slice(0, 3).map(x => x.text));
ok('Abschnitte: nichts geht verloren (jeder Satz steht in einem Abschnitt)', saetze[0].every(a => st.some(x => x.text.includes(a[0]))));
// Wie eine echte Seite: Zeilen brechen MITTEN im Satz um — ohne diese Lage wäre „endet am Satzende" nie verletzbar
const zeilen = [Array.from({ length: 40 }, (_, i) => [i % 2 ? 'Gedanken mit einigen Wörtern ' + i + '.' : 'Zeile ' + i + ' erklärt einen eigenen', 10, i * 2, 40, 1.5])];
st = BD.stuecke({ name: '', fields: [] }, zeilen);
ok('Abschnitte: Zeilen, die mitten im Satz umbrechen, werden bis zum Satzende gesammelt', st.length >= 4 && st.every(x => /\.$/.test(x.text)), st.map(x => x.text.slice(-14)));
const zulang = [[['w'.repeat(30) + ' '.repeat(1) + 'v'.repeat(700), 1, 1, 5, 1]]];
st = BD.stuecke({ name: '', fields: [] }, zulang);
ok('Abschnitte: ein überlanges Textstück wird geteilt, keiner über STUECK_MAX', st.length >= 3 && st.every(x => x.text.length <= BD.STUECK_MAX), st.map(x => x.text.length));
const riesig = Array.from({ length: 200 }, (_, p) => [['Seite ' + p + ' hat einen eigenen Satz.', 10, 10, 5, 2]]);
st = BD.stuecke({ name: 'Handbuch', fields: [] }, riesig);
ok('Abschnitte: KEIN Deckel mehr — alle 200 Seiten sind eingeordnet', st.length === 201 && st[st.length - 1].page === 199, st.length);
const fnv = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(36); };
ok('Fingerabdruck: trägt die Zerlegung (alte Vektoren aus der 500-Zeichen-Zeit werden neu eingeordnet)', typeof BD.ZERLEGUNG === 'string' && BD.ZERLEGUNG && !BD.signatur([{ page: 0, text: 'a' }]).endsWith('-' + fnv('0:a')), BD.signatur([{ page: 0, text: 'a' }]));
const vorbereitet = [{ it: [{ s: 'Hallo', x: 10, y: 10, w: 5, h: 2 }] }];
ok('Abschnitte: nimmt auch die vorbereitete Form der Suche ({ it: [...] })', BD.stuecke({ name: '', fields: [] }, vorbereitet)[0].text === 'Hallo');
ok('Fingerabdruck: gleich bei gleichem Text', BD.signatur(BD.stuecke(doc, seiten)) === BD.signatur(BD.stuecke(doc, seiten)));
ok('Fingerabdruck: anders, wenn ein Feld sich ändert', BD.signatur(BD.stuecke(doc, seiten)) !== BD.signatur(BD.stuecke({ name: 'Brief', fields: [{ label: 'Kunde', value: 'Herr Muster' }] }, seiten)));

const dat = new Map();
let s0 = BD.ladeStand(dat, { status: 'initiate', file: 'config.json' });
ok('Ladestand: ohne Größenangabe keine Prozentzahl (null, unbestimmt)', s0.prozent === null);
BD.ladeStand(dat, { status: 'progress', file: 'onnx/model.onnx', loaded: 25, total: 100 });
s0 = BD.ladeStand(dat, { status: 'progress', file: 'tokenizer.json', loaded: 0, total: 100 });
ok('Ladestand: über alle Dateien zusammengezählt (25 von 200 = 12,5 %)', Math.abs(s0.prozent - 12.5) < 1e-9 && s0.gesamt === 200 && s0.geladen === 25, s0);
s0 = BD.ladeStand(dat, { status: 'done', file: 'tokenizer.json' });
ok('Ladestand: „done" zählt die Datei voll (125 von 200)', s0.geladen === 125 && s0.datei === 'tokenizer.json', s0);
s0 = BD.ladeStand(dat, { status: 'progress', file: 'onnx/model.onnx', loaded: 999, total: 100 });
ok('Ladestand: nie über 100 %', s0.prozent === 100, s0);

const V = a => Float32Array.from(a);
const vek = new Map([['a', { st: [{ page: 0, text: 'x', v: V([1, 0]) }, { page: 2, text: 'y', v: V([0.6, 0.8]) }] }], ['b', { st: [{ page: 1, text: 'z', v: V([0, 1]) }] }]]);
const dot = (p, q) => p[0] * q[0] + p[1] * q[1];
let r = BD.rangliste([V([0.8, 0.6])], vek, dot, { min: 0.7 });
ok('Rangliste: jedes Dokument mit seinem BESTEN Abschnitt, beste zuerst', r.alle[0].id === 'a' && r.alle[0].stueck.page === 2 && Math.abs(r.alle[0].w - 0.96) < 1e-6, r.alle);
ok('Rangliste: unter der Untergrenze wird nicht gezeigt, aber gezählt', r.gezeigt.length === 1 && r.unter === 1, r);
r = BD.rangliste([V([0, 1]), V([1, 0])], vek, dot, { min: 0 });
ok('Rangliste: mehrere Fassungen der Frage — die beste zählt', r.alle.every(x => x.w === 1), r.alle);
ok('Rangliste: höchstens ' + BD.MAX_ZEIGEN + ' gezeigt', BD.rangliste([V([1, 0])], new Map(Array.from({ length: 30 }, (_, i) => ['d' + i, { st: [{ page: 0, text: '', v: V([1, 0]) }] }])), dot).gezeigt.length === BD.MAX_ZEIGEN);
// Relativ: gezeigt wird nur, was nah am BESTEN liegt — nicht alles über der Untergrenze
const eng = new Map([['a', { st: [{ page: 0, text: '', v: V([0.95, Math.sqrt(1 - 0.95 ** 2)]) }] }], ['b', { st: [{ page: 0, text: '', v: V([0.93, Math.sqrt(1 - 0.93 ** 2)]) }] }], ['c', { st: [{ page: 0, text: '', v: V([0.86, Math.sqrt(1 - 0.86 ** 2)]) }] }]]);
r = BD.rangliste([V([1, 0])], eng, dot);
ok('Rangliste: relativ — gezeigt, was höchstens ' + BD.ABSTAND + ' hinter dem besten liegt (0,95 und 0,93, nicht 0,86)', r.gezeigt.map(x => x.id).join() === 'a,b' && r.schwach.length === 0, r.gezeigt.map(x => [x.id, x.w.toFixed(2)]));
ok('Rangliste: die Grenze steht im Ergebnis (bester − Abstand)', Math.abs(r.grenze - (0.95 - BD.ABSTAND)) < 1e-6, r.grenze);
const tief = new Map([['a', { st: [{ page: 0, text: '', v: V([0.7, Math.sqrt(1 - 0.49)]) }] }], ['b', { st: [{ page: 0, text: '', v: V([0.6, 0.8]) }] }]]);
r = BD.rangliste([V([1, 0])], tief, dot);
ok('Rangliste: nie unter der Untergrenze ' + BD.NAEHE_MIN + ' — dann bleibt „gezeigt" leer', r.gezeigt.length === 0, r.gezeigt);
ok('Rangliste: … und die ' + BD.SCHWACH_ZEIGEN + ' nächsten stehen als „schwach" da, beste zuerst', r.schwach.length === 2 && r.schwach[0].id === 'a', r.schwach);
// Wörter: gleiche Nähe, aber einer hat die Suchwörter — er steht vorn, die angezeigte Nähe bleibt echt
const gleich = new Map([['ohne', { st: [{ page: 0, text: 'etwas anderes', v: V([0.9, Math.sqrt(1 - 0.81)]) }] }], ['mit', { st: [{ page: 0, text: 'Mietvertrag Wohnung', v: V([0.9, Math.sqrt(1 - 0.81)]) }] }]]);
r = BD.rangliste([V([1, 0])], gleich, dot, { wortAnteil: t => (/Mietvertrag/.test(t) ? 0.5 : 0) + (/Wohnung/.test(t) ? 0.5 : 0) });
ok('Rangliste: bei gleicher Nähe steht vorn, wer die Suchwörter hat', r.alle[0].id === 'mit' && r.alle[0].anteil === 1, r.alle.map(x => [x.id, x.rang]));
ok('Rangliste: der Wort-Vorsprung ist höchstens ' + BD.WORT_BONUS + ', die angezeigte Nähe bleibt die echte', Math.abs(r.alle[0].rang - r.alle[0].w - BD.WORT_BONUS) < 1e-6 && Math.abs(r.alle[0].w - 0.9) < 1e-6, r.alle[0]);
const zwei = new Map([['a', { st: [{ page: 0, text: 'x', v: V([0.95, Math.sqrt(1 - 0.9025)]) }, { page: 3, text: 'Mietvertrag Wohnung', v: V([0.92, Math.sqrt(1 - 0.8464)]) }] }]]);
r = BD.rangliste([V([1, 0])], zwei, dot, { wortAnteil: t => (/Mietvertrag/.test(t) ? 1 : 0) });
ok('Rangliste: der Abschnitt MIT den Wörtern wird markiert, wenn er zusammen vorn liegt', r.alle[0].stueck.page === 3, r.alle[0]);

/* ---------- Teil B: im Browser ---------- */
let pw = null, pdflib = null;
try { pw = await import('playwright-core'); pdflib = await import('pdf-lib'); } catch (_) {}
if (!pw || !pdflib) { console.log('  ⊘ Teil B nicht lauffähig (playwright-core/pdf-lib fehlt — npm install)'); }
else {
  const { PDFDocument, StandardFonts } = pdflib;
  async function pdfMit(zeilen) {
    const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
    const p = pdf.addPage([595.28, 841.89]);
    zeilen.forEach((z, i) => p.drawText(z, { x: 60, y: 780 - i * 30, size: 12, font: f }));
    return pdf.save();
  }
  const TMP = fs.mkdtempSync('/tmp/wfpdf-bedeutung-');
  fs.writeFileSync(path.join(TMP, 'Brief A.pdf'), await pdfMit(['Sehr geehrte Damen und Herren,', 'wir möchten den Vertrag zum Monatsende beenden.', 'Mit freundlichen Grüßen']));
  fs.writeFileSync(path.join(TMP, 'Beleg B.pdf'), await pdfMit(['Rechnung Nr. 17', 'Betrag: 120,00 EUR', 'Zahlbar bis 30.09.2026']));
  // Ein langes Handbuch (erfunden): 30 Seiten Fülltext, der gesuchte Gedanke steht auf der LETZTEN Seite
  async function handbuch(n) {
    const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
    for (let s = 0; s < n; s++) {
      const p = pdf.addPage([595.28, 841.89]);
      const zeilen = Array.from({ length: 8 }, (_, z) => 'Kapitel ' + (s + 1) + ' zeigt im Absatz ' + (z + 1) + ' die Bedienung der Anzeige am Gerät.');
      if (s === n - 1) zeilen.push('Die Garantie gilt zwei Jahre ab dem Tag des Kaufs.');
      zeilen.forEach((z, i) => p.drawText(z, { x: 50, y: 780 - i * 28, size: 11, font: f }));
    }
    return pdf.save();
  }
  fs.writeFileSync(path.join(TMP, 'Handbuch.pdf'), await handbuch(30));
  fs.writeFileSync(path.join(TMP, 'Miete.pdf'), await pdfMit(['Wir möchten den Mietvertrag für die Wohnung beenden.']));
  fs.writeFileSync(path.join(TMP, 'Abo.pdf'), await pdfMit(['Wir möchten das Abonnement beenden.']));

  // Der Stellvertreter für Modul 03: gleiche Oberfläche, gleiche Fortschritts-Meldungen.
  const STUB = `(function(){
    var BEGRIFFE = { kuendigung:1, kundigung:1, beenden:1, kuendigen:1, rechnung:2, betrag:2, zahlbar:2, grussen:3, grusse:3, garantie:4, gewahrleistung:4 };
    var D = 384;
    function norm(v){ var s=0; for (var i=0;i<D;i++) s+=v[i]*v[i]; s=Math.sqrt(s)||1; for (var j=0;j<D;j++) v[j]/=s; return v; }
    function falte(t){ return String(t).toLowerCase().replace(/ü/g,'u').replace(/ä/g,'a').replace(/ö/g,'o').replace(/ß/g,'ss'); }
    function vek(t){ var v=new Float32Array(D); v[0]=1; String(falte(t)).split(/[^a-z]+/).forEach(function(w){ var k=BEGRIFFE[w]; if(k) v[k]=1; }); return norm(v); }
    window.__stub = { passagen: 0, fragen: 0, init: 0 };
    var bereit = null;
    function melde(d){ window.dispatchEvent(new CustomEvent('sbkim:embedding-progress', { detail: d })); }
    window.SbkimEmbedding = {
      init: function(){
        if (bereit) return bereit;
        window.__stub.init++;
        if (window.__stubFehler) return Promise.reject(new Error('Modell nicht erreichbar (Probe)'));
        var dateien = [['onnx/model_quantized.onnx', 30000000], ['tokenizer.json', 17000000]];
        bereit = new Promise(function(res){
          var schritt = 0;
          melde({ status: 'initiate', file: 'config.json' });
          (function weiter(){
            schritt++;
            dateien.forEach(function(f){ melde({ status: 'progress', file: f[0], loaded: Math.min(f[1], f[1] * schritt / 8), total: f[1], progress: Math.min(100, schritt / 8 * 100) }); });
            if (schritt < 8) setTimeout(weiter, window.__stubTakt || 120);
            else { dateien.forEach(function(f){ melde({ status: 'done', file: f[0] }); }); melde({ status: 'ready' }); res(); }
          })();
        });
        return bereit;
      },
      isReady: function(){ return !!bereit; },
      embedQuery: function(t){ window.__stub.fragen++; return Promise.resolve(vek(t)); },
      embedPassage: function(t){ window.__stub.passagen++; return Promise.resolve(vek(t)); },
      embedPassageBatch: function(ts){ window.__stub.passagen += ts.length; var t = window.__stubBatchTakt || 0; return new Promise(function(res){ setTimeout(function(){ res(ts.map(vek)); }, t); }); },
      embedQueryBatch: function(ts){ return Promise.resolve(ts.map(vek)); }
    };
  })();`;

  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
  const srv = await new Promise(res => { const s = http.createServer((q, r2) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r2.writeHead(404); r2.end(); return; }
    r2.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r2);
  }); s.listen(0, '127.0.0.1', () => res(s)); });
  const URL0 = `http://127.0.0.1:${srv.address().port}/`;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  const fremd = [];
  async function seite(ctx) {
    const page = await ctx.newPage();
    page.__fehler = []; page.on('pageerror', e => page.__fehler.push(String(e)));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r2 => { fremd.push(r2.request().url()); r2.abort(); });
    await page.route(/\/vendor\/sbkim\/03_embedding\.js/, r2 => r2.fulfill({ contentType: 'text/javascript', body: STUB }));
    return page;
  }
  const zustand = page => page.evaluate(() => document.getElementById('bedeutungLeiste').dataset.bedZustand);
  const karten = page => page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok')].map(d => ({ name: d.querySelector('.dok-name').textContent, bed: d.hasAttribute('data-bedeutung'), naehe: d.querySelector('[data-naehe]') ? +d.querySelector('[data-naehe]').dataset.naehe : null, fund: [...d.querySelectorAll('.fund-zeile')].map(z => z.textContent.trim()) })));
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await seite(ctx);
    await page.goto(URL0);
    await page.waitForFunction(() => window.__wfpdf);
    await page.setInputFiles('#inDatei', [path.join(TMP, 'Brief A.pdf'), path.join(TMP, 'Beleg B.pdf')]);
    await page.waitForFunction(() => window.__wfpdf.S.docs.length === 2, null, { timeout: 30000 });
    await page.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });
    await page.waitForFunction(() => window.__wfpdf.S.docs.every(d => window.__wfpdf.suche.TEXTE.has(d.id)), null, { timeout: 30000 });

    ok('Anfang: aus, mit einem Knopf zum Einschalten', await zustand(page) === 'aus' && await page.isVisible('[data-bed-an]'));
    ok('Anfang: Modul 03 wird NICHT von selbst geladen', await page.evaluate(() => !window.SbkimEmbedding && !document.querySelector('script[src*="sbkim/03"]')));
    await page.fill('#bibSuche', 'Kündigung'); await page.waitForTimeout(80);
    let k = await karten(page);
    ok('Aus: „Kündigung" findet nach Wörtern nichts, und nach Bedeutung wird nicht gesucht', k.length === 0 && !(await page.$('[data-bed-kopf], [data-bed-sucht]')), k);

    await page.click('[data-bed-an]');
    const dlg = await page.textContent('.dlg');
    ok('Dialog: sagt VORHER, was aus dem Netz kommt (jsDelivr, Hugging Face, Größe)', /jsDelivr/.test(dlg) && /Hugging Face/.test(dlg) && /30 MB/.test(dlg), dlg.slice(0, 300));
    ok('Dialog: sagt, dass die Dokumente NICHT ins Netz gehen', /NICHT ins Netz/.test(dlg) && /deine Dokumente/.test(dlg));
    ok('Dialog: noch nichts geladen, solange nicht „Modell laden" gedrückt ist', await page.evaluate(() => !window.SbkimEmbedding));
    await page.evaluate(() => { window.__stubTakt = 150; window.__stand = []; const l = document.getElementById('bedeutungLeiste');
      new MutationObserver(() => { const b = l.querySelector('[data-bed-balken]'); window.__stand.push({ z: l.dataset.bedZustand, p: b ? b.getAttribute('aria-valuenow') : null, t: (l.querySelector('[data-bed-text]') || {}).textContent || '', mb: (l.querySelector('[data-bed-mb]') || {}).textContent || '' }); }).observe(l, { childList: true, subtree: true, attributes: true }); });
    await page.click('[data-bed-laden]');
    await page.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'laedt', null, { timeout: 5000 });
    await page.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit', null, { timeout: 20000 });
    const stand = await page.evaluate(() => window.__stand);
    const laed = stand.filter(x => x.z === 'laedt' && x.p != null).map(x => +x.p);
    ok('Ladebalken: zeigt steigende Prozente (mindestens 4 verschiedene)', new Set(laed).size >= 4 && laed.every((p, i) => i === 0 || p >= laed[i - 1]), laed);
    ok('Ladebalken: erreicht 100 %', laed.includes(100), laed);
    ok('Ladeanzeige: der Text nennt die Prozent', stand.some(x => x.z === 'laedt' && /Sprachmodell wird geladen … \d+ %/.test(x.t)), stand.slice(0, 5));
    ok('Ladeanzeige: nennt, wie viel schon da ist (MB von MB)', stand.some(x => x.z === 'laedt' && /^\d+,\d \/ 44,8 MB$/.test(x.mb)), stand.map(x => x.mb).filter(Boolean).slice(-3));
    ok('Ladeanzeige: danach wird eingeordnet — mit Dokument und Seite', stand.some(x => x.z === 'ordnet' && /Wird eingeordnet: (Brief A|Beleg B) · Seite \d+ von 1/.test(x.t)), stand.filter(x => x.z === 'ordnet'));
    ok('Bereit: sagt es, mit der Zahl der eingeordneten Dokumente', /Suche nach Bedeutung an · 2 Dokumente eingeordnet/.test(await page.textContent('#bedeutungLeiste')));
    ok('Bereit: die Wahl ist gemerkt', await page.evaluate(() => window.__wfpdf.EINST.bedeutung === true));

    await page.waitForSelector('[data-bed-kopf], [data-bed-nichts]', { timeout: 5000 }).catch(() => {});
    k = await karten(page);
    const brief = k.find(x => /Brief A/.test(x.name));
    ok('Bedeutung: „Kündigung" findet den Brief, in dem „Vertrag beenden" steht', brief && brief.bed, k);
    ok('Bedeutung: die Nähe steht an der Karte (ab 0,80)', brief && brief.naehe >= 0.8, brief);
    ok('Bedeutung: die Rechnung ist nicht dabei (unter der Schwelle)', !k.some(x => /Beleg B/.test(x.name)), k);
    ok('Bedeutung: die Fundstelle sagt „Nach Bedeutung, Seite 1" und zeigt den Text', brief && brief.fund.some(z => /^Nach Bedeutung, Seite 1/.test(z) && /Vertrag/.test(z)), brief);
    ok('Bedeutung: die Grenze steht dabei (Nähe, Höchstzahl, „Rangfolge, keine Prozent")', /Gezeigt: höchstens 0,04 hinter dem besten Treffer, nie unter 0,8 · höchstens 12 · die Zahl ist eine Rangfolge, keine Prozent/.test(await page.textContent('#dokGitter')));
    ok('Bedeutung: „Kein Dokument passt" sagt, dass es nach Bedeutung doch etwas gibt', /nach Bedeutung schon/.test(await page.textContent('[data-suchleer]')));

    await page.fill('#bibSuche', 'Rechnung'); await page.waitForTimeout(80);
    await page.waitForSelector('[data-bed-kopf], [data-bed-nichts]', { timeout: 5000 }).catch(() => {});
    k = await karten(page);
    ok('Wort und Bedeutung: ein Wort-Treffer steht nur EINMAL (nicht noch einmal unter „Bedeutung")', k.filter(x => /Beleg B/.test(x.name)).length === 1 && !k.find(x => /Beleg B/.test(x.name)).bed, k);

    await page.fill('#bibSuche', 'Kündigung'); await page.waitForSelector('[data-bed-kopf]', { timeout: 5000 }).catch(() => {});
    await page.click('#dokGitter .dok[data-bedeutung] [data-fundzeilen]');
    await page.waitForSelector('#sc-ed.on .seite canvas', { timeout: 30000 }); await page.waitForTimeout(200);
    const marke = await page.evaluate(() => { const m = document.querySelector('.seite[data-i="0"] .fund'); return m && { art: m.dataset.art, y: parseFloat(m.style.top), n: document.querySelectorAll('.fund').length }; });
    ok('Editor: aus der Bedeutungssuche geöffnet, ist der Abschnitt auf Seite 1 markiert', marke && marke.art === 'bedeutung' && marke.y > 5 && marke.y < 15, marke);
    await page.click('#flohKnopf'); await page.waitForSelector('#sc-bib.on');

    // Neu laden: die Wahl und die Vektoren bleiben — es wird nichts neu eingeordnet
    await page.reload(); await page.waitForFunction(() => window.__wfpdf && window.__wfpdf.S.docs.length === 2);
    await page.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit', null, { timeout: 20000 });
    ok('Neu geladen: startet von selbst wieder (die Wahl ist gemerkt)', true);
    ok('Neu geladen: nichts wird neu eingeordnet — die Vektoren kommen aus dem Speicher', await page.evaluate(() => window.__stub.passagen === 0), await page.evaluate(() => window.__stub));

    // Ein Dokument ändert sich → nur dieses wird neu eingeordnet
    await page.evaluate(async () => { const w = window.__wfpdf; const d = w.S.docs.find(x => /Beleg/.test(x.name)); d.fields.push({ id: 'neu', label: 'Notiz', value: 'Kündigung bitte prüfen', page: 0, x: 1, y: 1, w: 10, h: 2 }); await WFP.DB.put('docs', d); });
    await page.evaluate(() => window.__wfpdf.bedeutung.vektorenNachholen());
    ok('Geändert: genau das geänderte Dokument wird neu eingeordnet', await page.evaluate(() => window.__stub.passagen >= 1 && window.__stub.passagen <= 2), await page.evaluate(() => window.__stub));

    // Neue Bytes (Seite ersetzt, Datei angehängt): die alten Vektoren gehören zu einem anderen Text
    const weg = await page.evaluate(async () => { const d = window.__wfpdf.S.docs.find(x => /Brief/.test(x.name)); const vor = !!(await WFP.DB.get('vektoren', d.id)); await WFP.DB.putFile(d.id, await WFP.DB.getFile(d.id)); return { vor, nach: !!(await WFP.DB.get('vektoren', d.id)) }; });
    ok('neue Bytes werfen die alten Vektoren weg (sie werden neu eingeordnet)', weg.vor && !weg.nach, weg);

    // Ausschalten
    await page.click('[data-bed-mehr]');
    ok('Dialog (an): zeigt den Stand und „Ausschalten"', /Stand:\s*bereit/.test(await page.textContent('.dlg')) && await page.isVisible('[data-bed-aus]'));
    await page.click('[data-bed-aus]');
    await page.fill('#bibSuche', 'Kündigung'); await page.waitForTimeout(100);
    ok('Aus: der Abschnitt „nach Bedeutung" verschwindet, der Knopf zum Einschalten ist wieder da', await zustand(page) === 'aus' && !(await page.$('[data-bed-kopf]')) && await page.isVisible('[data-bed-an]'));
    ok('Aus: die Wahl ist gemerkt', await page.evaluate(() => window.__wfpdf.EINST.bedeutung === false));
    ok('keine Seitenfehler', page.__fehler.length === 0, page.__fehler);
    await ctx.close();

    // Fehler: das Modell kommt nicht — gesagt, mit „Nochmal"
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p2 = await seite(ctx2);
    await p2.addInitScript(() => { window.__stubFehler = true; });
    await p2.goto(URL0); await p2.waitForFunction(() => window.__wfpdf);
    await p2.click('[data-bed-an]'); await p2.click('[data-bed-laden]');
    await p2.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'fehler', null, { timeout: 10000 }).catch(() => {});
    const t2 = await p2.textContent('#bedeutungLeiste');
    ok('Fehler: wird gesagt, mit dem Grund', await zustand(p2) === 'fehler' && /Suche nach Bedeutung ging nicht/.test(t2) && /Modell nicht erreichbar/.test(t2), t2);
    ok('Fehler: „Nochmal" steht da und versucht es wirklich noch einmal', await p2.isVisible('[data-bed-nochmal]') && await (async () => { await p2.evaluate(() => { window.__stubFehler = false; }); await p2.click('[data-bed-nochmal]'); return p2.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit', null, { timeout: 15000 }).then(() => true, () => false); })());
    ok('Fehler: die Wortsuche läuft unberührt weiter', await (async () => { await p2.fill('#bibSuche', 'xyz'); await p2.waitForTimeout(80); return !!(await p2.$('[data-suchleer]')); })());
    await ctx2.close();

    // Das lange Handbuch: alle Seiten werden eingeordnet, Seite und Zeit stehen da, und nach
    // einem Neuladen geht es an derselben Stelle weiter.
    const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const p4 = await seite(ctx4);
    await p4.addInitScript(() => { window.__stubTakt = 20; window.__stubBatchTakt = 400; });
    await p4.goto(URL0); await p4.waitForFunction(() => window.__wfpdf);
    await p4.setInputFiles('#inDatei', [path.join(TMP, 'Handbuch.pdf')]);
    await p4.waitForFunction(() => window.__wfpdf.S.docs.length === 1, null, { timeout: 30000 });
    await p4.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });
    await p4.waitForFunction(() => window.__wfpdf.S.docs.every(d => window.__wfpdf.suche.TEXTE.has(d.id)), null, { timeout: 30000 });
    // Ein einzelnes Dokument öffnet sich nach dem Einlesen — zurück in die Bibliothek
    if (await p4.waitForSelector('#sc-ed.on', { timeout: 15000 }).then(() => true, () => false)) { await p4.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); }); await p4.click('#flohKnopf'); await p4.waitForSelector('#sc-bib.on'); }
    const hbId = await p4.evaluate(() => window.__wfpdf.S.docs[0].id);
    const hbN = await p4.evaluate(() => { const w = window.__wfpdf, d = w.S.docs[0]; return WFP.Bedeutung.stuecke(d, w.suche.TEXTE.get(d.id)).length; });
    ok('Handbuch: mehr Abschnitte als der alte Deckel von 80 (sonst misst der Rest nichts)', hbN > 80, hbN);
    await p4.evaluate(() => { window.__zeilen = []; const l = document.getElementById('bedeutungLeiste');
      new MutationObserver(() => { window.__zeilen.push(l.textContent); }).observe(l, { childList: true, subtree: true }); });
    await p4.click('[data-bed-an]'); await p4.click('[data-bed-laden]');
    // Während eingeordnet wird: gespeichert wird blockweise — warten, bis der erste Block liegt
    // (waitForFunction nimmt keine async-Bedingung: ein Promise ist sofort „wahr" — deshalb selbst abfragen)
    const fertigIm = id => p4.evaluate(async i => { const k = await WFP.DB.get('vektoren', i); return k ? k.fertig : -1; }, id);
    for (let t = 0; t < 300 && (await fertigIm(hbId)) < 64; t++) await p4.waitForTimeout(100);
    const vorher = await p4.evaluate(() => ({ z: document.getElementById('bedeutungLeiste').dataset.bedZustand, t: document.getElementById('bedeutungLeiste').textContent }));
    ok('Handbuch: die Leiste nennt Dokument und Seite („Seite x von 30")', vorher.z === 'ordnet' && /Wird eingeordnet: Handbuch · Seite \d+ von 30/.test(vorher.t) && /Dokument 1 von 1/.test(vorher.t), vorher);
    ok('Handbuch: die Leiste sagt, dass Suchen schon geht', /Suchen geht schon/.test(vorher.t), vorher.t);
    ok('Handbuch: die Zeit je Seite wird GEMESSEN angezeigt (erst „wird gemessen", dann „≈ … s je Seite")', await p4.evaluate(() => window.__zeilen.some(t => /Zeit je Seite wird gemessen/.test(t)) && window.__zeilen.some(t => /≈ \d+,\d s je Seite · noch ≈ (unter 1|\d+) min/.test(t))), await p4.evaluate(() => window.__zeilen.filter(t => /Seite/.test(t)).slice(-2)));
    // Suchen während des Einordnens
    await p4.fill('#bibSuche', 'Gewährleistung');
    const waehrend = await p4.waitForSelector('[data-bed-nochnicht]', { timeout: 4000 }).then(() => true, () => false);
    ok('Handbuch: Suchen geht schon während des Einordnens, und es wird gesagt, dass noch etwas dazukommt', waehrend && await p4.evaluate(() => document.getElementById('bedeutungLeiste').dataset.bedZustand) === 'ordnet' && !(await p4.$('[data-bed-wartet]')));
    await p4.fill('#bibSuche', '');
    // Neu laden mitten im Einordnen
    const gespeichert = await p4.evaluate(async id => (await WFP.DB.get('vektoren', id)).fertig, hbId);
    ok('Handbuch: noch nicht fertig, als neu geladen wird (sonst misst das Fortsetzen nichts)', gespeichert < hbN, [gespeichert, hbN]);
    await p4.reload(); await p4.waitForFunction(() => window.__wfpdf && window.__wfpdf.S.docs.length === 1);
    await p4.waitForFunction(() => document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit', null, { timeout: 60000 });
    const nach = await p4.evaluate(() => window.__stub.passagen);
    ok('Handbuch: nach dem Neuladen geht es an derselben Stelle weiter (nur der Rest wird eingeordnet)', nach === hbN - gespeichert, { nach, rest: hbN - gespeichert });
    ok('Handbuch: am Ende sind ALLE Abschnitte da, im Speicher wie im Vorrat', await p4.evaluate(async ([id, n]) => { const k = await WFP.DB.get('vektoren', id); return k.fertig === n && window.__wfpdf.bedeutung.BED.vek.get(id).st.length === n; }, [hbId, hbN]));
    await p4.fill('#bibSuche', 'Gewährleistung');
    // Auf die Antwort ZU DIESER Frage warten, nicht auf irgendeinen Kopf: der kann noch von der
    // vorigen Frage dastehen. Unter Last (Prüfung beim Einlesen, Texterkennung) kommt die neue später.
    await p4.waitForFunction(q => { const e = window.__wfpdf.bedeutung.BED.ergebnis; return e && e.frage === q; }, 'Gewährleistung', { timeout: 20000 }).catch(() => {});
    await p4.waitForSelector('[data-bed-kopf], [data-bed-nichts], [data-bed-schwach]', { timeout: 8000 }).catch(() => {});
    k = await karten(p4);
    ok('Handbuch: „Gewährleistung" findet den Satz auf der LETZTEN Seite (30)', k.some(x => /Handbuch/.test(x.name) && x.bed && x.fund.some(z => /^Nach Bedeutung, Seite 30/.test(z) && /Garantie/.test(z))), k);
    ok('Handbuch: die Fundstelle ist ein kurzer Abschnitt, nicht die halbe Seite', k.some(x => x.fund.some(z => /Garantie/.test(z) && z.length < 400)), k.map(x => x.fund));
    // Lange Frage: Wort und Bedeutung zusammen
    await p4.setInputFiles('#inDatei', [path.join(TMP, 'Abo.pdf'), path.join(TMP, 'Miete.pdf')]);
    await p4.waitForFunction(() => window.__wfpdf.S.docs.length === 3, null, { timeout: 30000 });
    await p4.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); });
    // Drei Einträge reichen nicht: ein neu eingelesenes Dokument steht schon in BED.vek, bevor es
    // eingeordnet ist (st leer), und die Leiste bleibt dabei „bereit". Ohne Last war das Fenster zu
    // kurz, um es zu sehen; mit der Prüfung beim Einlesen (Texterkennung daneben) nicht mehr.
    await p4.waitForFunction(() => { const B = window.__wfpdf.bedeutung.BED; return B.vek.size === 3 && [...B.vek.values()].every(e => e.st.length === e.n) && document.getElementById('bedeutungLeiste').dataset.bedZustand === 'bereit'; }, null, { timeout: 60000 });
    await p4.fill('#bibSuche', 'Mietvertrag Wohnung zum Monatsende beenden bitte');
    // Auf die Antwort ZU DIESER Frage warten, nicht auf irgendeinen Kopf: der kann noch von der
    // vorigen Frage dastehen. Unter Last (Prüfung beim Einlesen, Texterkennung) kommt die neue später.
    await p4.waitForFunction(q => { const e = window.__wfpdf.bedeutung.BED.ergebnis; return e && e.frage === q; }, 'Mietvertrag Wohnung zum Monatsende beenden bitte', { timeout: 20000 }).catch(() => {});
    await p4.waitForSelector('[data-bed-kopf]', { timeout: 8000 }).catch(() => {});
    k = await karten(p4);
    const erst = k.filter(x => x.bed);
    ok('Lange Frage: bei gleicher Nähe steht vorn, wer die meisten Suchwörter hat (Miete vor Abo)', erst.length >= 2 && /Miete/.test(erst[0].name) && erst.findIndex(x => /Abo/.test(x.name)) > 0, erst.map(x => x.name));
    ok('Lange Frage: die Fundstelle sagt, wie viele Suchwörter darin stehen („3 von 5")', erst[0] && erst[0].fund.some(z => /3 von 5 Suchwörtern/.test(z)), erst[0]);
    ok('keine Seitenfehler (Handbuch)', p4.__fehler.length === 0, p4.__fehler);
    await ctx4.close();

    // Schmaler Schirm: die Leiste läuft nicht quer
    const ctx3 = await browser.newContext({ viewport: { width: 360, height: 740 } });
    const p3 = await seite(ctx3);
    await p3.addInitScript(() => { window.__stubTakt = 600; });
    await p3.goto(URL0); await p3.waitForFunction(() => window.__wfpdf);
    await p3.click('[data-bed-an]'); await p3.click('[data-bed-laden]');
    await p3.waitForFunction(() => { const b = document.querySelector('#bedeutungLeiste [data-bed-balken]'); return b && b.getAttribute('aria-valuenow'); }, null, { timeout: 10000 });
    const quer = await p3.evaluate(() => { const l = document.getElementById('bedeutungLeiste').getBoundingClientRect(); return { l: Math.round(l.left), r: Math.round(l.right), vw: innerWidth, sw: document.documentElement.scrollWidth }; });
    ok('Schmal (360 px): Ladeanzeige passt in die Breite, nichts läuft quer', quer.r <= quer.vw && quer.sw <= quer.vw, quer);
    await ctx3.close();

    ok('nichts ging ins Netz außer der eigenen Adresse (das Modell ist hier gestellt)', fremd.length === 0, fremd.slice(0, 5));
  } catch (e) { ok('Probe lief durch', false, String(e && e.stack || e).slice(0, 600)); }
  finally { await browser.close(); srv.close(); }
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
