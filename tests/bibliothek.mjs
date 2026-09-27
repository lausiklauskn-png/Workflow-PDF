/* Workfloh PDF — Bibliothek am schmalen Handy (Klaus' To-Do-Liste 2026-09-27, Punkte 1–4 und 7).
   Im echten Browser. Gemessen wird, was man SIEHT und TRIFFT:
   1 · (Schiebe-Griff: gemessen in tests/schieber.mjs — assets/schieber.js aus der Parallel-Sitzung #67
       ist die EINE Bauweise für Feldarten- und Ordner-Leiste; der eigene Griff ist beim Zusammenführen raus.)
   2 · Pfeil nach oben neben dem Auswahl-Punkt: erst nach dem Herunterrollen, ein Tipp → ganz oben.
   3 · Kopfleiste: bei 320 · 360 · 390 · 412 · 480 px überlagern die Knöpfe den Schriftzug nicht,
       der Schriftzug ist nicht abgeschnitten, und die Seite ist nicht breiter als das Fenster.
   4 · Erstellungsdatum: sortieren (neueste zuerst) und nach einem Tag suchen — nur das Anlagedatum.
   7 · Eine Lupe im leeren Suchfeld (der Platzhalter trägt keine mehr, der Knopf bleibt).
   Nicht gemessen: echter Finger am Tablet (Zeiger-Ereignisse stehen dafür), echtes Scroll-Gefühl.
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 500) : '')); } };
console.log('Workfloh PDF — Bibliothek am schmalen Handy');

let pw = null, pdflib = null;
try { pw = await import('playwright-core'); pdflib = await import('pdf-lib'); } catch (_) {}
if (!pw || !pdflib) { console.log('  ⊘ nicht lauffähig (playwright-core/pdf-lib fehlt — npm install)'); process.exit(0); }
const { PDFDocument, StandardFonts } = pdflib;
async function pdf(titel) { const d = await PDFDocument.create(); const f = await d.embedFont(StandardFonts.Helvetica); d.addPage([595, 842]).drawText(titel, { x: 60, y: 760, size: 16, font: f }); return d.save(); }

const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const url = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});

// neun Ordner mit langen Namen, je ein Dokument — damit die Leiste am Handy übersteht
const ORDNER = ['Rechnungen 2026', 'Behördenpost', 'Kunden Bäckerei', 'Aufträge Werkstatt', 'Übersetzungen Russisch', 'Versicherung', 'Steuer 2025', 'Mietverträge', 'Vorlagen Formulare'];
const B64 = {};
for (let i = 0; i < ORDNER.length; i++) B64['Dokument ' + (i + 1) + '.pdf'] = Buffer.from(await pdf('Dokument ' + (i + 1))).toString('base64');

try {
  // Zeitzone fest (nicht UTC): sonst wäre „Ortszeit gegen UTC" in einem UTC-Behälter nicht zu unterscheiden
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2, timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await page.goto(url);
  await page.waitForFunction(() => window.__wfpdf);

  // 7 · eine Lupe
  const such = await page.evaluate(() => { const f = document.getElementById('bibSuche'); return { ph: f.placeholder, lupen: document.querySelectorAll('#bibForm #bibLos').length, knopf: document.getElementById('bibLos').textContent.trim() }; });
  ok('7 · der Platzhalter im leeren Suchfeld trägt keine Lupe mehr', !/🔎|🔍/.test(such.ph) && /Suchen/.test(such.ph), such);
  ok('7 · … die Lupe als Knopf rechts bleibt (Suchen)', such.lupen === 1 && /🔍/.test(such.knopf), such);

  // 3 · Kopfleiste bei verschiedenen Breiten
  for (const w of [320, 360, 390, 412, 480]) {
    await page.setViewportSize({ width: w, height: 740 }); await page.waitForTimeout(80);
    const k = await page.evaluate((w) => {
      const name = document.querySelector('.marke-name'), rng = document.createRange(); rng.selectNodeContents(name);
      const t = rng.getBoundingClientRect(), mk = document.querySelector('.marke').getBoundingClientRect();
      const kn = [...document.querySelectorAll('.kopf-rechts > *')].filter(e => e.checkVisibility()).map(e => e.getBoundingClientRect());
      const floh = document.getElementById('flohKnopf').getBoundingClientRect();
      return { textRechts: t.right, textLinks: t.left, markeRechts: mk.right, ersterKnopf: Math.min(...kn.map(r => r.left)), letzterKnopf: Math.max(...kn.map(r => r.right)), flohRechts: floh.right,
        knoepfe: kn.length, abgeschnitten: name.scrollWidth > name.clientWidth + 1 || t.right > mk.right + 1, quer: document.documentElement.scrollWidth > w + 1, seite: document.documentElement.scrollWidth, breite: w,
        kleinsterKnopf: Math.min(...kn.map(r => Math.min(r.width, r.height))), bedeutung: !!document.querySelector('.bedeutung-leiste .knopf')?.checkVisibility() };
    }, w);
    if (process.env.BILD) await page.locator('.kopf').screenshot({ path: process.env.BILD + `/kopf-${w}.png` });
    ok(`3 · ${w} px: die Knöpfe überlagern den Schriftzug nicht`, k.knoepfe >= 4 && k.textRechts <= k.ersterKnopf - 2 && k.textLinks >= k.flohRechts - 1, k);
    ok(`3 · ${w} px: „Workfloh PDF" steht ganz da (nicht abgeschnitten), nichts läuft quer`, !k.abgeschnitten && !k.quer && k.letzterKnopf <= k.breite + 1, k);
    // Mit isMobile wächst das Layout-Fenster mit dem Inhalt: innerWidth wäre bei 328 px Inhalt auch 328 —
    // gemessen wird deshalb gegen die GESETZTE Breite. Der Knopf „Suche nach Bedeutung“ muss dabei
    // sichtbar sein, er war bei 320 px der Grund (328 px, auch auf origin/main).
    ok(`3 · ${w} px: die Seite ist nicht breiter als das Fenster (Knopf „Suche nach Bedeutung“ sichtbar)`, k.bedeutung && !k.quer, k);
    ok(`3 · ${w} px: die Knöpfe bleiben treffbar (mindestens 30 px)`, k.kleinsterKnopf >= 30, k);
  }
  await page.setViewportSize({ width: 360, height: 740 });


  // Dokumente in neun Ordnern
  await page.evaluate(async ([list, ordner]) => {
    const n = Object.keys(list);
    for (let i = 0; i < n.length; i++) {
      const f = new File([Uint8Array.from(atob(list[n[i]]), c => c.charCodeAt(0))], n[i], { type: 'application/pdf' });
      await window.__wfpdf.importDateien([f], ordner[i]);
    }
  }, [B64, ORDNER]);
  await page.waitForFunction(n => window.__wfpdf.S.docs.length === n && window.__wfpdf.S.ordner.length === n, ORDNER.length, { timeout: 60000 });
  await page.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); if (document.querySelector('#sc-ed.on')) document.querySelector('#edZurueck').click(); });
  await page.waitForSelector('#sc-bib.on');
  await page.evaluate(() => { const w = window.__wfpdf; w.S.aktOrdner = 'alle'; w.suche.zeichneBibliothek(); });
  await page.waitForTimeout(150);

  // 2 · Pfeil nach oben. (Im Headless-Chromium geht nach einem Finger-Zug über eine Fläche mit
  // touch-action:none der NÄCHSTE Tipp verloren — an einer leeren Testseite nachgestellt. Deshalb
  // steht hier vor dem Tipp kein Finger-Zug. Ob das am Tablet auch so ist: ungemessen.)
  const hoch = () => page.evaluate(() => { const b = [...document.querySelectorAll('#dokGitter .dok [data-hoch]')]; const sich = b.filter(x => x.checkVisibility());
    const h0 = sich[0] && sich[0].getBoundingClientRect(), dot = sich[0] && sich[0].parentElement.querySelector('[data-haken]').getBoundingClientRect();
    return { knoepfe: b.length, sichtbar: sich.length, y: scrollY, nebenPunkt: h0 && dot ? Math.abs(h0.top - dot.top) < 3 && h0.right <= dot.left + 1 && dot.left - h0.right < 16 : false, groesse: h0 ? Math.min(h0.width, h0.height) : 0 }; });
  let h = await hoch();
  ok('2 · jede Karte hat einen Pfeil nach oben', h.knoepfe === ORDNER.length, h);
  ok('2 · ganz oben steht er nicht (er hätte nichts zu tun)', h.y === 0 && h.sichtbar === 0, h);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(1200);
  h = await hoch();
  if (process.env.BILD) await page.screenshot({ path: process.env.BILD + '/unten.png' });
  ok('2 · heruntergerollt: der Pfeil steht da, direkt links neben dem Auswahl-Punkt', h.y > 400 && h.sichtbar > 0 && h.nebenPunkt, h);
  ok('2 · … gleich groß wie der Punkt (28 px)', h.groesse >= 26, h);
  const letzte = await page.evaluate(() => { const b = [...document.querySelectorAll('#dokGitter .dok [data-hoch]')].pop(); const r = b.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.touchscreen.tap(letzte[0], letzte[1]);
  await page.waitForFunction(() => scrollY === 0, null, { timeout: 4000 }).catch(() => {});
  h = await hoch();
  ok('2 · ein Tipp auf den Pfeil rollt GANZ nach oben', h.y === 0, h);
  ok('2 · … und oben stehen wieder Suchfeld und Ordner-Knöpfe', await page.evaluate(() => { const r = document.getElementById('bibSuche').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
  ok('2 · der Pfeil öffnet das Dokument nicht und wählt es nicht aus', await page.evaluate(() => document.querySelector('#sc-bib.on') && !document.querySelector('.dok.gewaehlt')));


  // 4 · Erstellungsdatum: je drei Dokumente an drei Tagen
  await page.evaluate(() => {
    const w = window.__wfpdf, tage = ['2026-09-20T09:00:00', '2026-09-24T11:00:00', '2026-09-25T08:30:00'];
    w.S.docs.slice().sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true })).forEach((d, i) => { d.createdAt = new Date(tage[i % 3]).toISOString(); d.updatedAt = new Date('2026-09-26T10:00:00').toISOString(); });
    w.EINST.sortierung = 'erstellt'; w.einstSpeichern(); w.suche.zeichneBibliothek();
  });
  await page.waitForTimeout(100);
  const karten = () => page.evaluate(() => [...document.querySelectorAll('#dokGitter .dok')].map(e => ({ n: e.querySelector('.dok-name').textContent.trim(), t: (e.querySelector('[data-erstellt]') || {}).dataset?.erstellt || '', text: (e.querySelector('[data-erstellt]') || {}).textContent || '' })));
  let k = await karten();
  ok('4 · im Sortieren gibt es „Erstellungsdatum"', await page.evaluate(() => [...document.querySelectorAll('[data-sort] option')].some(o => o.value === 'erstellt' && /Erstellungsdatum/.test(o.textContent) && o.selected)));
  ok('4 · nach Erstellungsdatum sortiert: die neuesten zuerst', k.length === 9 && k.map(x => x.t).join() === [...k.map(x => x.t)].sort().reverse().join() && k[0].t === '2026-09-25' && k[8].t === '2026-09-20', k.map(x => x.t));
  ok('4 · … bei gleichem Tag nach Name (Dokument 3 vor Dokument 6 vor Dokument 9)', k.filter(x => x.t === '2026-09-25').map(x => x.n).join() === 'Dokument 3,Dokument 6,Dokument 9', k);
  ok('4 · jede Karte nennt dabei ihr Erstellungsdatum', k.every(x => /erstellt \d\d\.\d\d\.2026/.test(x.text)), k.map(x => x.text));
  // nach einem Tag suchen
  await page.fill('[data-datum]', '2026-09-24'); await page.dispatchEvent('[data-datum]', 'change'); await page.waitForTimeout(100);
  k = await karten();
  ok('4 · „Erstellt am 24.09.2026": genau die drei Dokumente dieses Tages', k.length === 3 && k.every(x => x.t === '2026-09-24'), k);
  ok('4 · … und der Ordner-Knopf daneben hebt es wieder auf', await page.evaluate(() => !!document.querySelector('[data-datumweg]')));
  // es ist das ANLAGEdatum, nicht ein Datum im Inhalt oder das Änderungsdatum
  await page.fill('[data-datum]', '2026-09-26'); await page.dispatchEvent('[data-datum]', 'change'); await page.waitForTimeout(100);
  k = await karten();
  ok('4 · das Änderungsdatum (26.09.) zählt NICHT — nur das Erstellungsdatum', k.length === 0 && await page.evaluate(() => /24|26/.test(document.querySelector('[data-datumleer]')?.textContent || '')), k);
  ok('4 · ein Tag ohne Dokument sagt das, mit Weg zurück', await page.evaluate(() => /Kein Dokument wurde am 26\.09\.2026 erstellt/.test(document.querySelector('[data-datumleer]')?.textContent || '') && !!document.querySelector('[data-datumweg2]')));
  await page.click('[data-datumweg2]'); await page.waitForTimeout(100);
  k = await karten();
  ok('4 · „✕ jedes Datum" zeigt wieder alle', k.length === 9, k.length);
  // zusammen mit der Wortsuche
  await page.fill('[data-datum]', '2026-09-20'); await page.dispatchEvent('[data-datum]', 'change'); await page.waitForTimeout(80);
  await page.fill('#bibSuche', 'Dokument 4'); await page.press('#bibSuche', 'Enter'); await page.waitForTimeout(400);
  k = await karten();
  ok('4 · Datum und Suchwort zusammen: nur „Dokument 4" vom 20.09.', k.length >= 1 && k.every(x => x.t === '2026-09-20') && k.some(x => x.n === 'Dokument 4'), k);
  await page.fill('#bibSuche', ''); await page.press('#bibSuche', 'Enter');
  await page.evaluate(() => { const w = window.__wfpdf; w.S.datum = ''; w.EINST.sortierung = 'name'; w.einstSpeichern(); w.suche.zeichneBibliothek(); });
  // ein Dokument aus einer Zeitzone kurz nach Mitternacht gehört zum Tag des Geräts
  const tag = await page.evaluate(() => { const d = window.__wfpdf.S.docs[0]; d.createdAt = new Date(2026, 8, 21, 0, 20).toISOString(); window.__wfpdf.S.datum = '2026-09-21'; window.__wfpdf.suche.zeichneBibliothek(); const n = document.querySelectorAll('#dokGitter .dok').length; window.__wfpdf.S.datum = ''; window.__wfpdf.suche.zeichneBibliothek(); return n; });
  ok('4 · 00:20 Uhr Ortszeit zählt zum Tag des Geräts, nicht zum Vortag in UTC', tag === 1, tag);
  ok('keine Fehler auf der Seite', fehler.length === 0, fehler);
  await ctx.close();
} catch (e) { rot++; console.log('  ✗ ROT: Probe lief nicht durch → ' + String(e && e.stack || e).slice(0, 700)); }
await browser.close(); srv.close();
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
