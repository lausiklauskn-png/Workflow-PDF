/* Workfloh PDF — Bilder bleiben beim Übersetzen unberührt (Klaus 2026-09-26).
   Befund: in übersetzten Anleitungen standen mitten in Fotos weiße Kästen mit
   „e.g. : \", „IE |", „Paes fe" — die Texterkennung las Kanten und Muster als Text.
   Klaus: „den Rahmen [des Bildes] nicht verändern … weil die Bilder sind ja meist nur
   erklärende Dinge". Gemessen mit der ECHTEN Texterkennung (vendor/tesseract) an einem
   erfundenen „Foto" (Rauschen, Kanten, Formen) und einem Bild mit echtem Text. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 700) : '')); } };
function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ttf': 'font/ttf', '.json': 'application/json', '.wasm': 'application/wasm', '.webmanifest': 'application/manifest+json' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}
async function seite(bildPng) {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  const p = pdf.addPage([595.28, 841.89]);
  p.drawText('Deckel abnehmen und die Nocken ausrichten.', { x: 56, y: 780, size: 11, font: f });
  p.drawImage(await pdf.embedPng(bildPng), { x: 56, y: 330, width: 460, height: 400 });
  p.drawText('Danach den Deckel wieder aufsetzen.', { x: 56, y: 300, size: 11, font: f });
  return pdf.save();
}

const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try {
  // 1) erfundenes „Foto": Kerben, Striche und Bögen wie Kanten an einem Maschinenteil — kein
  //    Text. Genau dieses Muster erzeugt bei der Texterkennung Zeilen wie „\ I \ fe) q ON! C"
  //    (ausprobiert an fünf Mustern je drei Startwerten; Gitter, Rippen und Rauschen lieferten nichts).
  const bp = await browser.newPage({ viewport: { width: 1380, height: 1200 } });
  await bp.setContent('<body style="margin:0"><canvas id=c width=1380 height=1200></canvas></body>');
  await bp.evaluate(() => {
    let z = 11; const R = () => (z = (z * 16807) % 2147483647) / 2147483647;
    const x = document.getElementById('c').getContext('2d'); x.fillStyle = '#d9d6cf'; x.fillRect(0, 0, 1380, 1200);
    for (let i = 0; i < 300; i++) { x.strokeStyle = '#1a1a1a'; x.lineWidth = 3 + R() * 4; const X = R() * 1380, Y = R() * 1200, h = 20 + R() * 30; x.beginPath();
      if (R() < 0.5) { x.moveTo(X, Y); x.lineTo(X + R() * 14, Y + h); } else x.arc(X, Y, h / 2, R() * 6, R() * 6 + 2 + R() * 3); x.stroke(); }
  });
  const foto = await bp.locator('#c').screenshot({ type: 'png' });
  // 2) Bild mit echtem Text (wie ein eingefügtes Schild)
  await bp.setContent('<body style="margin:0;width:1380px;height:1200px;background:#f4f1e8;font:66px Arial"><div style="position:absolute;left:90px;top:120px;font-size:105px;font-weight:bold">Warnhinweis</div><div style="position:absolute;left:90px;top:390px;width:1200px;line-height:1.4">Vor dem Öffnen den Netzstecker ziehen.</div></body>');
  const schild = await bp.screenshot({ type: 'png' }); await bp.close();
  const pdfFoto = await seite(foto), pdfSchild = await seite(schild);
  const pdfScan = await (async () => { const d = await PDFDocument.create(); d.addPage([595.28, 841.89]).drawImage(await d.embedPng(schild), { x: 56, y: 330, width: 460, height: 400 }); return d.save(); })();

  const page = await browser.newPage();
  const fehler = []; page.on('pageerror', e => fehler.push(String(e)));
  await page.goto(URL0);
  await page.waitForFunction(() => window.WFP && WFP.Uebersetzung);
  const b64 = b => Buffer.from(b).toString('base64');
  const r = await page.evaluate(async ({ foto, schild, scanPdf }) => {
    const UE = WFP.Uebersetzung, bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
    const hin = []; const ueb = async l => l.map(t => { hin.push(t); return '[ru] ' + t; });
    const lauf = (s, bilder, stand) => UE.lauf({ bytes: bytes(s), uebersetzer: ueb, stand, ocr: { basis: 'vendor/', von: 'de', bilder } });
    const texte = st => st.seiten[0].b.map(b => b[6]);
    const aus = await lauf(foto, false);
    // Zum Vergleich: dieselbe Texterkennung mit dem ALTEN Filter (Sicherheit ≥ 45, zwei Buchstaben)
    const w = await UE.ocrStarten('vendor/', 'de');
    const pdf = await pdfjsLib.getDocument({ data: bytes(foto) }).promise, pg = await pdf.getPage(1);
    const S = 3, vp = pg.getViewport({ scale: S }), c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
    await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    const ab = document.createElement('canvas'); ab.width = 460 * S; ab.height = 400 * S;
    ab.getContext('2d').drawImage(c, 56 * S, (841.89 - 730) * S, ab.width, ab.height, 0, 0, ab.width, ab.height);
    const roh = await w.recognize(ab, {}, { blocks: true, text: false }); await w.terminate();
    const zeilen = []; for (const bl of roh.data.blocks || []) for (const pa of bl.paragraphs || []) for (const li of pa.lines || []) zeilen.push({ t: String(li.text || '').replace(/\s+/g, ' ').trim(), c: Math.round(li.confidence) });
    const altDurch = zeilen.filter(z => z.t && z.c >= 45 && /[\p{L}]{2}/u.test(z.t));
    const neuDurch = altDurch.filter(z => UE.bildZeileTaugt(z.t, z.c));
    const an = await lauf(foto, true);
    const sch = await lauf(schild, true);
    const schAus = await lauf(schild, false);
    // gespeicherter Stand mit Bild-Text: ohne Bilder wird die Seite neu gelesen …
    const neuGelesen = await lauf(schild, false, JSON.parse(JSON.stringify(sch.stand)));
    // … ein Stand von VOR dem Datum (ohne bildText, ocr: true) ebenfalls
    const alt = JSON.parse(JSON.stringify(sch.stand)); delete alt.seiten[0].bildText;
    const altNeu = await lauf(schild, false, alt);
    // … eine gescannte Seite (ohne Textebene) aus einem alten Stand bleibt stehen: dort kam die
    // Texterkennung vom Scan, nicht aus einem Bild auf einer Textseite
    const scan = await lauf(scanPdf, false); const scanAlt = JSON.parse(JSON.stringify(scan.stand)); delete scanAlt.seiten[0].bildText;
    const scanNeu = await lauf(scanPdf, false, scanAlt);
    // … und mit Bildern an bleibt der Stand stehen (kein neues Lesen)
    const n0 = hin.length; const bleibt = await lauf(schild, true, JSON.parse(JSON.stringify(sch.stand)));
    return { aus: texte(aus.stand), ausBild: aus.stand.seiten[0].bildText, ausOcr: aus.ocrSeiten, zeilen, altDurch, neuDurch, an: texte(an.stand), sch: texte(sch.stand), schBild: sch.stand.seiten[0].bildText,
      schAus: texte(schAus.stand), neuGelesen: { neu: neuGelesen.neu, t: texte(neuGelesen.stand) }, altNeu: { neu: altNeu.neu, t: texte(altNeu.stand) }, scan: { ocr: scan.stand.seiten[0].ocr, n: texte(scan.stand).length, neu: scanNeu.neu }, bleibt: { neu: bleibt.neu, anfragen: hin.length - n0 } };
  }, { foto: b64(pdfFoto), schild: b64(pdfSchild), scanPdf: b64(pdfScan) });

  const txt = ['Deckel abnehmen und die Nocken ausrichten.', 'Danach den Deckel wieder aufsetzen.'];
  console.log('  · Texterkennung im Foto: ' + r.zeilen.length + ' Zeilen, alter Filter ließ ' + r.altDurch.length + ' durch, neuer ' + r.neuDurch.length + ' → ' + JSON.stringify(r.altDurch.map(z => z.t + ' (' + z.c + ')')).slice(0, 300));
  ok('Vorgabe: Bilder werden nicht gelesen — nur die zwei echten Absätze', r.aus.length === 2 && txt.every(t => r.aus.includes(t)), r.aus);
  ok('… die Seite trägt bildText 0 und keine Texterkennung', r.ausBild === 0 && r.ausOcr === 0, [r.ausBild, r.ausOcr]);
  ok('Selbst-Riegel: das erfundene Foto erzeugt mit dem ALTEN Filter wirklich Schein-Text', r.altDurch.length >= 1, r.zeilen);
  ok('der neue Filter lässt davon nichts durch', r.neuDurch.length === 0, r.neuDurch);
  ok('mit „Text in Bildern" an: kein Schein-Text aus dem Foto im Ergebnis', r.an.length === 2 && txt.every(t => r.an.includes(t)), r.an);
  ok('mit „Text in Bildern" an: echter Text im Bild wird gelesen (Warnhinweis, Netzstecker)', r.sch.some(t => /Warnhinweis/.test(t)) && r.sch.some(t => /Netzstecker/.test(t)) && r.schBild > 0, r.sch);
  ok('… ohne den Haken bleibt auch echter Bild-Text unberührt', r.schAus.length === 2, r.schAus);
  ok('gespeicherter Stand mit Bild-Text wird ohne den Haken neu gelesen (kein alter Bild-Text im Ergebnis)', r.neuGelesen.neu === 1 && r.neuGelesen.t.length === 2, r.neuGelesen);
  ok('… auch ein Stand von vor dem 2026-09-26 (ohne bildText)', r.altNeu.neu === 1 && r.altNeu.t.length === 2, r.altNeu);
  ok('Scan-Seite bleibt: eine gescannte Seite aus einem alten Stand wird ohne Haken NICHT neu gelesen', r.scan.ocr && r.scan.n >= 1 && r.scan.neu === 0, r.scan);
  ok('mit dem Haken bleibt ein vollständiger Stand stehen (keine neue Anfrage)', r.bleibt.neu === 0 && r.bleibt.anfragen === 0, r.bleibt);
  // Einzelfälle aus Klaus' Fotos (Wortlaut der Kästen, Sicherheit angenommen hoch)
  const f = await page.evaluate(() => { const T = WFP.Uebersetzung.bildZeileTaugt;
    return { e: T('e.g. : \\', 90), ie: T('IE |', 90), paes: T('Paes fe', 90), sos: T('SOs cis', 90), unsicher: T('Netzstecker ziehen', 60), gut: T('Netzstecker ziehen', 85), leer: T('', 99),
      rahmen: T('Deckel | abnehmen', 90), ziffern: T('Deckel 12345678', 90), zwei: T('Push here', 90) }; });
  ok('Klaus\' Kästen fallen heraus: „e.g. : \\", „IE |", „Paes fe", „SOs cis"', !f.e && !f.ie && !f.paes && !f.sos, f);
  ok('unsicher erkannt (60) fällt heraus, sicher erkannt (85) bleibt', !f.unsicher && f.gut && !f.leer, f);
  ok('ein Rahmen-Zeichen (|) wirft die Zeile heraus, auch mit echten Wörtern', !f.rahmen, f);
  ok('überwiegend Ziffern fällt heraus, zwei Wörter aus vier Buchstaben bleiben', !f.ziffern && f.zwei, f);

  // Oberfläche: der Haken steht im Übersetzen-Dialog, ist aus, und die Wahl kommt beim Lauf an
  const TMP = fs.mkdtempSync('/tmp/wfpdf-bilder-'); fs.writeFileSync(path.join(TMP, 'Schild.pdf'), pdfSchild);
  await page.evaluate(() => { self.Translator = { availability: async () => 'available', create: async () => ({ translate: async t => '[ru] ' + t, destroy() {} }) }; });
  await page.setInputFiles('#inDatei', path.join(TMP, 'Schild.pdf'));
  await page.waitForSelector('#sc-ed.on'); await page.click('#edZurueck');
  await page.evaluate(() => { const w = window.__wfpdf; w.EINST.ueRueck = false; delete w.EINST.ueBilder; w.einstSpeichern(); });
  const durchlauf = async setzen => {
    const vorIds = await page.evaluate(async () => (await WFP.DB.all('docs')).map(x => x.id));
    await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
    const hk = page.locator('.dlg [data-bilder]'); const vorher = (await hk.count()) === 1 ? await hk.isChecked() : null;
    if (setzen) await hk.check();
    await page.locator('.dlg [data-dok]').first().check();
    await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', 'ru');
    await page.click('.dlg [data-weg="browser"]');
    await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 180000 });
    await page.click('.dlg [data-x]');
    // das fertige PDF lesen: welche übersetzten Stücke stehen darin? (der Zwischenstand wird nach dem Lauf gelöscht)
    // das NEUE Ergebnis (updatedAt ist ein Text — danach zu sortieren war zufällig, Befund der Gegenprobe)
    const job = await page.evaluate(async vorIds => {
      const neu = (await WFP.DB.all('docs')).filter(x => x.uebersetzung && x.uebersetzung.nach === 'ru' && !vorIds.includes(x.id));
      if (neu.length !== 1) return { anzahl: neu.length };
      const d = neu[0];
      const pdf = await pdfjsLib.getDocument({ data: await WFP.DB.getFile(d.id) }).promise, tc = await (await pdf.getPage(1)).getTextContent();
      const ru = tc.items.map(i => i.str).join(' ').match(/\[ru\][^\[]*/g) || [];
      return { ru: ru.map(x => x.trim()), bild: ru.some(x => /Warnhinweis|Netzstecker/.test(x)) };
    }, vorIds);
    return { vorher, merkt: await page.evaluate(() => window.__wfpdf.EINST.ueBilder), job };
  };
  const d1 = await durchlauf(false);
  ok('Übersetzen-Dialog: Haken „Text in Bildern mitübersetzen" steht da und ist aus', d1.vorher === false, d1.vorher);
  ok('… ohne Haken: im fertigen PDF stehen nur die zwei Absätze, nichts aus dem Bild', d1.job && d1.job.ru && !d1.job.bild && d1.job.ru.length === 2, d1.job);
  const d2 = await durchlauf(true);
  ok('mit Haken: die Wahl wird gemerkt und der Bild-Text kommt an', d2.merkt === true && d2.job && d2.job.ru && d2.job.bild === true, d2);
  const d3 = await durchlauf(false);
  ok('beim nächsten Öffnen steht der Haken wieder so, wie zuletzt gewählt', d3.vorher === true, d3.vorher);
  ok('keine Seitenfehler', fehler.length === 0, fehler);
} finally { await browser.close(); srv.close(); }
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
