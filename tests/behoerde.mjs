/* Workfloh PDF — Probe „Behördenformular": Hin- und Rückweg im echten Browser.
   Erfundene Daten. Der Übersetzer des Browsers ist ein Stellvertreter mit festem
   Wörterbuch (Headless-Chromium hat keinen); es geht kein Byte ins Netz.

   Der Weg, den Klaus am Gerät geht:
   1. deutsches Formular (mit Feldern) in den Übersetzen-Bereich einlesen
   2. DE → RU: die Felder kommen übersetzt an DIESELBE Stelle mit
   3. auf Russisch ausfüllen, als festes / ausfüllbares PDF ausgeben (Kyrillisch!)
   4. „↩ Einträge ins Original": die Einträge zurück ins Deutsche, in eine Kopie
      des Originals — Umlaute richtig (NFC), auch wenn der Übersetzer sie zerlegt
   5. dasselbe DE → EN
   6. Papierbrief fotografiert: das Blatt wird gefunden und auf A4 gerade gezogen */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts, PDFName } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

const DE_RU = {
  'Antrag auf Erstattung der Gebühr': 'Заявление о возмещении пошлины',
  'Name': 'Фамилия', 'Geburtsort': 'Место рождения', 'Einverstanden': 'Согласен',
  'Müller': 'Мюллер'
};
// Rückweg: der Übersetzer liefert „Müller" ZERLEGT (u + U+0308) — so kam es am Gerät an
const RU_DE = { 'Мюллер': 'Müller', 'Москва': 'Moskau', 'Фамилия': 'Name' };
const DE_EN = { 'Antrag auf Erstattung der Gebühr': 'Application for refund of the fee', 'Name': 'Surname', 'Geburtsort': 'Place of birth', 'Einverstanden': 'Agreed', 'Müller': 'Müller' };
const EN_DE = { 'Müller': 'Müller', 'London': 'London' };

async function formular() {
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit);
  const noto = await pdf.embedFont(fs.readFileSync(path.join(WURZEL, 'vendor/fonts/NotoSans-Regular.ttf')), { subset: true });
  const hv = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage([595.28, 841.89]);
  // Überschrift mit ZERLEGTEM Umlaut (u + kombinierendes Trema) — wie ihn manche Ämter-PDFs tragen
  p.drawText('Antrag auf Erstattung der Gebühr', { x: 60, y: 770, size: 16, font: noto });
  p.drawText('Name:', { x: 60, y: 700, size: 11, font: hv });
  p.drawText('Geburtsort:', { x: 60, y: 660, size: 11, font: hv });
  p.drawText('Einverstanden', { x: 90, y: 620, size: 11, font: hv });
  const form = pdf.getForm();
  const n = form.createTextField('Name'); n.setText('Müller'); n.addToPage(p, { x: 150, y: 694, width: 250, height: 20, font: hv });
  const g = form.createTextField('Geburtsort'); g.addToPage(p, { x: 150, y: 654, width: 250, height: 20, font: hv });
  const c = form.createCheckBox('Einverstanden'); c.addToPage(p, { x: 60, y: 616, width: 16, height: 16 });
  return pdf.save();
}
// Ein Papierbrief auf dunklem Tisch, schräg fotografiert (von Chromium gerendert).
// Oben links im Blatt ein schwarzes Quadrat: 10 % vom linken, 7 % vom oberen Rand.
async function foto(browser) {
  const pg = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await pg.setContent(`<body style="margin:0;background:#3b3029;height:1000px;overflow:hidden">
    <div style="position:absolute;left:240px;top:200px;width:420px;height:594px;background:#fbfaf6;transform:perspective(1400px) rotateX(9deg) rotateZ(-7deg);font:14px Arial">
      <div style="position:absolute;left:42px;top:42px;width:42px;height:42px;background:#000"></div>
      <div style="position:absolute;left:42px;top:140px;width:330px">Stadt Beispiel · Bürgeramt<br><br>Sehr geehrte Damen und Herren, bitte füllen Sie das Formular aus.</div>
    </div></body>`);
  const png = await pg.screenshot({ type: 'png' }); await pg.close(); return png;
}
async function leeresFoto(browser) {   // kein Tisch, nur Text — da ist kein Blattrand
  const pg = await browser.newPage({ viewport: { width: 700, height: 500 } });
  await pg.setContent('<body style="margin:0;background:#fff;font:24px Arial;padding:40px">Nur ein Bildschirmfoto mit Text.</body>');
  const png = await pg.screenshot({ type: 'png' }); await pg.close(); return png;
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

const TMP = fs.mkdtempSync('/tmp/wfpdf-amt-');
fs.writeFileSync(path.join(TMP, 'Antrag.pdf'), await formular());
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
fs.writeFileSync(path.join(TMP, 'Brief.png'), await foto(browser));
fs.writeFileSync(path.join(TMP, 'Bildschirm.png'), await leeresFoto(browser));
const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1100, height: 900 } });
await ctx.addInitScript(W => {
  window.__ueCalls = [];
  self.Translator = {
    availability: async ({ sourceLanguage: a, targetLanguage: b }) => (a === b ? 'unavailable' : 'available'),
    create: async ({ sourceLanguage: a, targetLanguage: b }) => ({
      translate: async t => { window.__ueCalls.push(a + '>' + b + ':' + t); const w = W[a + '>' + b] || {}; return w[t] != null ? w[t] : '[' + b + '] ' + t; },
      destroy() {}
    })
  };
}, { 'de>ru': DE_RU, 'ru>de': RU_DE, 'de>en': DE_EN, 'en>de': EN_DE });
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(String(e.stack || e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => { konsole.push('NETZ: ' + r.request().url()); r.abort(); });

const doc = name => page.evaluate(async n => (await WFP.DB.all('docs')).find(x => x.name === n) || null, name);
// Liest eine heruntergeladene PDF im Browser zurück: Text, Formularfelder, /DR-Schriften
async function pdfLesen(datei) {
  const b64 = fs.readFileSync(datei).toString('base64');
  return page.evaluate(async b64 => {
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise; const p = await pdf.getPage(1);
    const vp = p.getViewport({ scale: 1 }); const tc = await p.getTextContent(); const an = await p.getAnnotations();
    const text = tc.items.map(t => t.str).join(' ');
    pdf.destroy();
    const lib = await PDFLib.PDFDocument.load(bytes); let dr = [];
    try { const af = lib.catalog.lookup(PDFLib.PDFName.of('AcroForm')); const f = af.lookup(PDFLib.PDFName.of('DR')).lookup(PDFLib.PDFName.of('Font')); dr = f.keys().map(k => k.decodeText()); } catch (_) {}
    return { w: vp.width, h: vp.height, text, felder: an.filter(a => a.subtype === 'Widget').map(a => ({ name: a.fieldName, wert: a.fieldValue })), dr };
  }, b64);
}
async function ausgeben(modus) {
  await page.click('#edExport'); await page.waitForSelector(`.dlg [data-m="${modus}"]`);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click(`.dlg [data-m="${modus}"]`)]);
  const ziel = path.join(TMP, modus + '-' + Date.now() + '.pdf'); await dl.saveAs(ziel);
  await page.evaluate(() => document.querySelectorAll('.dlg [data-x]').forEach(b => b.click()));
  return pdfLesen(ziel);
}
async function uebersetzen(nach) {
  await page.click('#btnUebersetzen'); await page.waitForSelector('.dlg [data-o]');
  await page.click('.dlg [data-o]'); await page.waitForSelector('.dlg [data-dok]');
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', nach);
  await page.evaluate(() => { const c = document.querySelector('.dlg [data-rueck]'); if (c.checked) c.click(); });
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 60000 });
}

try {
  console.log('Workfloh PDF — Behördenformular, Hin- und Rückweg');
  await page.goto(URL0); await page.waitForFunction(() => window.__wfpdf);

  // 1. einlesen in den Übersetzen-Bereich
  const t0 = Date.now();
  await page.click('#btnUebersetzen'); await page.waitForSelector('.dlg [data-ud]');
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), page.click('.dlg [data-ud]')]);
  await wahl.setFiles(path.join(TMP, 'Antrag.pdf'));
  await page.waitForSelector('.dlg [data-e]'); await page.fill('.dlg [data-e]', 'Amt'); await page.click('.dlg [data-j]');
  await page.waitForSelector('.dlg [data-dok]');
  const zeile = await page.textContent('.dlg .erk-dok');
  ok('Übersetzen-Fenster nennt die Felder, die übersetzt mitkommen', /3 Felder kommen übersetzt mit/.test(zeile), zeile);
  ok('der Weg zum Felder-Setzen wird erklärt (Hinweis im Fenster)', /erst Felder setzen/.test(await page.textContent('.dlg')));
  const quelle = await doc('Antrag');
  await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'ru');
  await page.evaluate(() => { const c = document.querySelector('.dlg [data-rueck]'); if (c.checked) c.click(); });
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 60000 });
  const hinMs = Date.now() - t0;
  ok('Bericht: „3 Felder übersetzt mitgenommen" + Knopf zum Öffnen', /3 Felder übersetzt mitgenommen/.test(await page.textContent('.dlg')) && await page.$('.dlg [data-oeffne]'));
  const calls = await page.evaluate(() => window.__ueCalls);
  ok('zerlegter Umlaut in der Überschrift wird VOR dem Übersetzen zusammengesetzt (NFC)', calls.includes('de>ru:Antrag auf Erstattung der Gebühr'), calls.filter(c => /Antrag/.test(c)));

  const ru = await doc('Antrag [RU]');
  const paar = quelle.fields.map(q => [q, ru.fields.find(f => f.quellFeld === q.id)]);
  ok('jedes Feld des Originals steht in der Übersetzung (quellFeld)', paar.every(([, f]) => f), ru.fields);
  ok('… an DERSELBEN Stelle (x, y, w, h gleich)', paar.every(([q, f]) => f && ['x', 'y', 'w', 'h', 'page'].every(k => Math.abs(q[k] - f[k]) < 1e-9)));
  ok('Beschriftungen übersetzt (Фамилия, Место рождения, Согласен)', ['Фамилия', 'Место рождения', 'Согласен'].every(l => ru.fields.some(f => f.label === l)), ru.fields.map(f => f.label));
  ok('vorhandener Eintrag übersetzt, Kästchen unverändert', ru.fields.find(f => f.label === 'Фамилия').value === 'Мюллер' && ru.fields.find(f => f.type === 'check').value === false);

  // 2. auf Russisch ausfüllen
  await page.click('.dlg [data-oeffne]'); await page.waitForSelector('.feld input');
  ok('Öffnen führt direkt in den Editor zum Ausfüllen', await page.evaluate(() => window.__wfpdf.S.doc.name === 'Antrag [RU]' && window.__wfpdf.S.modus === 'ausfuellen'));
  await page.fill('.feld input[aria-label="Место рождения"]', 'Москва');
  await page.click('.feld.check-feld');
  await page.waitForTimeout(500);   // Speichern ist entprellt (350 ms)
  const fest = await ausgeben('fest');
  ok('festes PDF (RU): Kyrillisch lesbar, keine Fragezeichen', /Москва/.test(fest.text) && /Мюллер/.test(fest.text) && !/\?\?/.test(fest.text), fest.text);
  ok('festes PDF behält A4', Math.abs(fest.w - 595.28) < 0.5 && Math.abs(fest.h - 841.89) < 0.5);
  const ausf = await ausgeben('ausfuellbar');
  ok('ausfüllbares PDF (RU): Felder mit kyrillischem Wert', ausf.felder.some(f => f.wert === 'Москва'), ausf.felder);
  ok('… und die Schrift dafür steht in /DR (Noto, unter dem Namen aus /DA)', ausf.dr.some(k => /NotoSans/.test(k)), ausf.dr);

  // 3. Rückweg ins deutsche Original
  const t1 = Date.now();
  await page.click('#edExport'); await page.waitForSelector('.dlg [data-rueckweg]');
  ok('Ausgeben-Fenster bietet „↩ Einträge ins Original (DE)"', /Einträge ins Original \(DE\)/.test(await page.textContent('.dlg [data-rueckweg]')));
  await page.click('.dlg [data-rueckweg]'); await page.waitForSelector('.dlg [data-weg="browser"]:not([disabled])');
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => window.__wfpdfRueckweg, null, { timeout: 30000 });
  const rueckMs = Date.now() - t1;
  const de = await page.evaluate(async () => WFP.DB.get('docs', window.__wfpdfRueckweg.id));
  const f = l => de.fields.find(x => x.label === l);
  ok('Kopie des Originals mit den Beschriftungen des Originals', de && f('Name') && f('Geburtsort') && f('Einverstanden'), de && de.fields.map(x => x.label));
  ok('Einträge zurückübersetzt: Geburtsort = Moskau', f('Geburtsort').value === 'Moskau');
  ok('Umlaut richtig: „Müller" als EIN Zeichen (NFC), obwohl zerlegt geliefert', f('Name').value === 'Müller' && f('Name').value.length === 6, f('Name').value);
  ok('Kästchen übernommen (angekreuzt)', f('Einverstanden').value === true);
  ok('Stellen gleich dem Original', quelle.fields.every(q => { const z = de.fields.find(x => x.label === q.label); return z && Math.abs(z.x - q.x) < 1e-9 && Math.abs(z.y - q.y) < 1e-9; }));
  ok('als „ausgefüllt aus RU" markiert, im eigenen Ordner, Original unverändert', de.ausgefuellt && de.ausgefuellt.aus === 'ru' && de.folderId !== quelle.folderId && (await doc('Antrag')).fields.find(x => x.label === 'Geburtsort').value === '');
  await page.waitForFunction(id => window.__wfpdf.S.doc && window.__wfpdf.S.doc.id === id, de.id);
  const festDe = await ausgeben('fest');
  ok('festes PDF (DE, ausgefüllt): Müller und Moskau auf der Seite', /Müller/.test(festDe.text) && /Moskau/.test(festDe.text), festDe.text);

  // 4. dasselbe mit Englisch
  await page.click('#edZurueck');
  await uebersetzen('en');
  const en = await doc('Antrag [EN]');
  ok('DE → EN: Felder mitgenommen, Beschriftungen englisch', en && ['Surname', 'Place of birth', 'Agreed'].every(l => en.fields.some(x => x.label === l)), en && en.fields.map(x => x.label));
  await page.click('.dlg [data-oeffne]'); await page.waitForSelector('.feld input');
  await page.fill('.feld input[aria-label="Place of birth"]', 'London'); await page.waitForTimeout(500);
  await page.click('#edExport'); await page.waitForSelector('.dlg [data-rueckweg]');
  ok('EN: Rückweg heißt „↩ Einträge ins Original (DE)"', /\(DE\)/.test(await page.textContent('.dlg [data-rueckweg]')));
  await page.evaluate(() => { window.__wfpdfRueckweg = null; });
  await page.click('.dlg [data-rueckweg]'); await page.waitForSelector('.dlg [data-weg="browser"]:not([disabled])');
  await page.click('.dlg [data-weg="browser"]'); await page.waitForFunction(() => window.__wfpdfRueckweg, null, { timeout: 30000 });
  const deEn = await page.evaluate(async () => WFP.DB.get('docs', window.__wfpdfRueckweg.id));
  ok('EN → DE: Geburtsort = London, Name = Müller, Ordner „ausgefüllt (aus EN)"', deEn.fields.find(x => x.label === 'Geburtsort').value === 'London' && deEn.fields.find(x => x.label === 'Name').value === 'Müller' && deEn.ausgefuellt.aus === 'en');

  // 4b. Rückweg im installierten App-Fenster auf Android (Klaus 2026-09-25: „ich kann von da
  //     aus nur abbrechen"). Dort gibt es ⋮ → „Übersetzen" nicht; die Chrome-Fläche wäre eine
  //     Sackgasse. Also: Adresse kopieren + Anleitung, und der Chrome-Tab öffnet denselben Rückweg.
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(page.url()).origin });
  await page.evaluate(id => window.__wfpdf.oeffneDok(id), en.id);
  await page.waitForFunction(id => window.__wfpdf.S.doc && window.__wfpdf.S.doc.id === id, en.id);
  await page.evaluate(() => {
    window.__mmAlt = window.matchMedia; const o = window.matchMedia.bind(window);
    window.matchMedia = q => /standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : o(q);
    Object.defineProperty(navigator, 'userAgent', { get: () => 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/140 Safari/537.36', configurable: true });
    window.__geteilt = []; navigator.share = d => { window.__geteilt.push(d); return new Promise(() => {}); };
  });
  await page.click('#edExport'); await page.waitForSelector('.dlg [data-rueckweg]');
  await page.click('.dlg [data-rueckweg]'); await page.waitForSelector('.dlg [data-weg="chrome"]');
  ok("App-Fenster: Rückweg nennt, dass „Übersetzen“ dort fehlt, und bietet „Mit Browser öffnen zum Übersetzen“", await page.evaluate(() => /eigenen Fenster/.test(document.querySelector('.dlg [data-weg="chrome"]').textContent) && /Mit Browser öffnen zum Übersetzen/.test(document.querySelector(".dlg [data-tabreihe]")?.textContent || '')));
  await page.click('.dlg [data-weg="chrome"]');
  await page.waitForFunction(() => window.__geteilt.length, null, { timeout: 3000 }).catch(() => {});
  const rw = await page.evaluate(async () => ({ geteilt: window.__geteilt.map(d => d.url), flaeche: !!document.getElementById('wfp-chrome'), adr: (window.__wfpdfChromeTab || {}).url }));
  ok('… „Mit Chrome übersetzen" führt dort NICHT in die Sackgasse (keine Fläche), sondern gleich ins Teilen-Fenster', rw.geteilt.length === 1 && !rw.flaeche, rw);
  const rwU = rw.adr ? new URL(rw.adr) : null;
  ok("… geteilt wird der Rückweg (rueck=<Übersetzung>, weg=chrome)", rwU && rwU.searchParams.get("rueck") === en.id && rwU.searchParams.get("weg") === "chrome" && !rwU.searchParams.has("ue") && rw.geteilt[0] === rw.adr, rw);
  await page.evaluate(() => { window.matchMedia = window.__mmAlt; delete navigator.userAgent; });
  // Der Tab: gleicher Speicher → derselbe Rückweg, Chrome-Weg hervorgehoben
  const tab = await ctx.newPage();
  await tab.goto(rw.adr); await tab.waitForSelector('.dlg [data-ausapp]', { timeout: 15000 }).catch(() => {});
  const tz = await tab.evaluate(() => ({ aus: /Einträge ins Original/.test(document.querySelector('.dlg h2')?.textContent || '') && !!document.querySelector('.dlg [data-ausapp]'), mark: document.querySelector('.dlg [data-weg="chrome"]')?.style.outlineStyle, url: location.href, tabs: !!document.querySelector('.dlg [data-tabreihe]') }));
  ok('Chrome-Tab öffnet „↩ Einträge ins Original" mit hervorgehobenem Chrome-Weg, Adresse sauber, ohne „In Chrome öffnen"', tz.aus && tz.mark === 'solid' && !/rueck=/.test(tz.url) && !tz.tabs, tz);
  await tab.goto(new URL('index.html?rueck=gibtsnicht&weg=chrome', rw.adr).href); await tab.waitForTimeout(1500);
  ok('… unbekanntes Dokument: ehrliche Meldung statt leerem Dialog', await tab.evaluate(() => /nicht da/.test(document.getElementById('toast').textContent) && !document.querySelector('.dlg [data-ausapp]')));
  await tab.close();

  // 5. Papierbrief fotografieren → Blatt auf A4
  await page.click('#edZurueck');
  const t2 = Date.now();
  await page.click('#btnUebersetzen'); await page.waitForSelector('.dlg [data-uk]');
  ok('Übersetzen-Bereich bietet „📷 Brief fotografieren"', true);
  const [kam] = await Promise.all([page.waitForEvent('filechooser'), page.click('.dlg [data-uk]')]);
  await kam.setFiles(path.join(TMP, 'Brief.png'));
  await page.waitForSelector('.dlg .aufnahme-bilder');
  const blatt = await page.evaluate(() => window.__wfpdfBlatt);
  ok('Blatt im Foto erkannt', blatt && blatt.erkannt, blatt);
  ok('Aufnahme zeigt „✂ Blatt · A4" und lässt aufs ganze Foto umschalten', /Blatt · A4/.test(await page.textContent('.dlg [data-um]')));
  await page.click('.dlg [data-um]'); await page.waitForSelector('.dlg [data-um]');
  ok('… umschalten geht (ganzes Foto), und zurück', /ganzes Foto/.test(await page.textContent('.dlg [data-um]')));
  await page.click('.dlg [data-um]'); await page.waitForSelector('.dlg [data-um]');
  await page.click('.dlg [data-ok]');
  await page.waitForSelector('.dlg [data-e]'); ok('fragt nach dem Ordnernamen', await page.inputValue('.dlg [data-e]') === 'Briefe');
  await page.click('.dlg [data-j]');
  await page.waitForSelector('.dlg [data-dok]');
  const fotoMs = Date.now() - t2;
  const brief = await page.evaluate(async () => (await WFP.DB.all('docs')).find(d => /^Brief /.test(d.name)));
  ok('danach öffnet sich das Übersetzen-Fenster mit dem Brief', !!brief && await page.evaluate(id => !!document.querySelector(`.dlg [data-dok="${CSS.escape(id)}"]`), brief.id));
  ok('Seite ist GENAU A4 hoch (595,28 × 841,89 pt)', brief.pages.length === 1 && Math.abs(brief.pages[0].w - 595.28) < 0.01 && Math.abs(brief.pages[0].h - 841.89) < 0.01, brief.pages);
  ok('Brief liegt im Übersetzungs-Bereich', await page.evaluate(id => window.__wfpdf.S.ordner.find(o => o.id === id)?.bereich === 'uebersetzung', brief.folderId));
  // Wo steht das schwarze Quadrat auf der A4-Seite? Soll: Mitte bei 15 % / 10,6 %.
  const lage = await page.evaluate(async id => {
    const b = await WFP.DB.getFile(id); const pdf = await pdfjsLib.getDocument({ data: b.slice(0) }).promise; const p = await pdf.getPage(1);
    const vp = p.getViewport({ scale: 0.5 }); const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    const x = c.getContext('2d'); await p.render({ canvasContext: x, viewport: vp }).promise; pdf.destroy();
    const d = x.getImageData(0, 0, c.width, c.height).data; let sx = 0, sy = 0, n = 0, rand = 0, randN = 0;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) {
      const o = (y * c.width + i) * 4, v = d[o] + d[o + 1] + d[o + 2];
      if (i < c.width * 0.4 && y < c.height * 0.3 && v < 150) { sx += i; sy += y; n++; }
      if (i < 3 || y < 3 || i > c.width - 4 || y > c.height - 4) { randN++; if (v < 300) rand++; }
    }
    return { x: sx / n / c.width * 100, y: sy / n / c.height * 100, n, randDunkel: rand / randN };
  }, brief.id);
  ok('Quadrat steht dort, wo es auf dem Papier steht (±2 %)', Math.abs(lage.x - 15) < 2 && Math.abs(lage.y - 10.6) < 2, lage);
  ok('kein Tisch am Rand: der Seitenrand ist Papier', lage.randDunkel < 0.05, lage);
  await page.evaluate(() => document.querySelectorAll('.dlg [data-x]').forEach(b => b.click()));

  // 6. Foto ohne Blattrand: nichts abschneiden, trotzdem A4
  await page.setInputFiles('#inDatei', path.join(TMP, 'Bildschirm.png'));
  await page.waitForFunction(() => window.__wfpdf.S.doc && window.__wfpdf.S.doc.name === 'Bildschirm');
  const bs = await page.evaluate(() => ({ b: window.__wfpdfBlatt, p: window.__wfpdf.S.doc.pages[0] }));
  ok('ohne erkennbaren Rand: nicht geschnitten, Grund genannt', bs.b && !bs.b.erkannt && bs.b.grund, bs.b);
  ok('… liegt trotzdem auf A4 (quer, weil das Bild quer ist)', Math.abs(bs.p.w - 841.89) < 0.01 && Math.abs(bs.p.h - 595.28) < 0.01, bs.p);
  await page.click('#edExport'); await page.waitForSelector('.dlg [data-m="fest"]');
  const fmt = await page.evaluate(() => document.querySelector('.dlg [data-format]')?.textContent || '');
  ok('Ausgeben-Fenster nennt Seitengröße und „Tatsächliche Größe / 100 %"', /A4 quer · 297 × 210 mm/.test(fmt) && /Tatsächliche Größe/.test(fmt), fmt);
  await page.evaluate(() => document.querySelectorAll('.dlg [data-x]').forEach(b => b.click()));

  console.log(`  ⏱ Hinweg DE→RU (1 Seite, 3 Felder): ${hinMs} ms · Rückweg RU→DE: ${rueckMs} ms · Foto → A4 + Ablage: ${fotoMs} ms`);
  ok('keine Fehler in der Konsole, kein Aufruf ins Netz', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
