/* Workfloh PDF — großes Dokument in Teilen übersetzen (Klaus 2026-09-26).
   „vorher messen … in wie viele Teile … rechnerisch nachweisbar … Teil 1 zum
   Übersetzen, Teil 2, Teil 3". Und der Abbruch nach 6 von 384 Seiten mit
   „Other generic failures occurred" (Chromes eingebauter Übersetzer).
   Erfundene Daten; der Übersetzer des Browsers ist ein Stellvertreter. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

async function lang(n, titel) {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= n; i++) pdf.addPage([595.28, 841.89]).drawText(titel + ' Absatz auf Seite ' + i + '.', { x: 60, y: 760, size: 12, font: f });
  return pdf.save();
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

const TMP = fs.mkdtempSync('/tmp/wfpdf-teile-');
fs.writeFileSync(path.join(TMP, 'Handbuch.pdf'), await lang(90, 'Handbuch'));
fs.writeFileSync(path.join(TMP, 'Kurz.pdf'), await lang(5, 'Kurz'));
const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.addInitScript(() => {
  // Stellvertreter: wirft auf Zuruf den allgemeinen Fehler von Chromes Übersetzer
  // (einmal je Übersetzer-Instanz ab dem n-ten Aufruf) oder die Längengrenze.
  window.__ue = { calls: [], creates: 0, genericAb: 0, genericImmer: false, langMax: 0 };
  self.Translator = {
    availability: async ({ sourceLanguage: a, targetLanguage: b }) => (a === b ? 'unavailable' : 'available'),
    create: async ({ targetLanguage: b }) => {
      const nr = ++window.__ue.creates; let eigene = 0;
      return {
        translate: async t => {
          eigene++;
          const U = window.__ue;
          if (U.genericImmer || (U.genericAb && nr === 1 && eigene >= U.genericAb)) throw new DOMException('Other generic failures occurred.', 'UnknownError');
          if (U.langMax && t.length > U.langMax) throw new DOMException('The input is too large.', 'QuotaExceededError');
          U.calls.push(t); return '[' + b + '] ' + t;
        },
        destroy() {}
      };
    }
  };
});
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(String(e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
const seitenText = name => page.evaluate(async name => {
  const d = (await WFP.DB.all('docs')).find(x => x.name === name); if (!d) return null;
  const pdf = await pdfjsLib.getDocument({ data: (await WFP.DB.getFile(d.id)).slice(0) }).promise; const out = [];
  for (let i = 1; i <= pdf.numPages; i++) out.push((await (await pdf.getPage(i)).getTextContent()).items.map(t => t.str).join(' '));
  pdf.destroy(); const o = window.__wfpdf.S.ordner.find(x => x.id === d.folderId);
  return { seiten: out, ordner: o ? o.name : null, d };
}, name);

try {
  console.log('Workfloh PDF — Teile und Übersetzer-Neustart, Probe im Browser');
  await page.goto(URL0);
  await page.waitForFunction(() => window.__wfpdf && window.WFP && WFP.Uebersetzung);

  // A. Die Rechnung selbst — mit Klaus' Zahlen (384 Seiten, ~29,3 MB)
  const A = await page.evaluate(() => {
    const U = WFP.Uebersetzung, MB = 1048576;
    const k = U.teilPlan(29.3 * MB, 384), c = U.teilPlan(29.3 * MB, 384, 6), klein = U.teilPlan(1 * MB, 30), dick = U.teilPlan(60 * MB, 100);
    const lang = 'Erster Satz über das Gerät. ' + 'Zweiter Satz mit vielen Wörtern darin. '.repeat(40);
    const st = U.saetze(lang, 600);
    return { k: { n: k.teile.length, je: k.jeTeil, letzte: k.teile.at(-1), summe: k.teile.reduce((s, t) => s + t.seiten, 0), lueckenlos: k.teile.every((t, i) => i === 0 || t.von === k.teile[i - 1].bis + 1), rechnung: k.rechnung, noetig: k.noetig, maxMB: Math.max(...k.teile.map(t => t.mb)) },
      c: { n: c.teile.length, je: c.jeTeil, rechnung: c.rechnung.at(-1) }, klein: { noetig: klein.noetig, n: klein.teile.length },
      dick: { je: dick.jeTeil, maxMB: Math.max(...dick.teile.map(t => t.mb)), ziel: U.TEIL_ZIEL_MB },
      st: { n: st.length, max: Math.max(...st.map(x => x.length)), gleich: st.join(' ').replace(/\s+/g, ' ') === lang.trim().replace(/\s+/g, ' ') } };
  });
  ok('384 Seiten, 29,3 MB → 10 Teile zu 40 Seiten, der letzte 24', A.k.n === 10 && A.k.je === 40 && A.k.letzte.von === 361 && A.k.letzte.bis === 384, A.k);
  ok('… lückenlos: jede Seite genau einmal, 384 zusammen', A.k.summe === 384 && A.k.lueckenlos, A.k);
  ok('… die Rechnung steht Zeile für Zeile da (78,1 KB je Seite, 100 Seiten nach Größe, gedeckelt auf 40, 9 × 40 + 1 × 24)', /78,1 KB je Seite/.test(A.k.rechnung[0]) && /= 100 Seiten/.test(A.k.rechnung[1]) && /gedeckelt auf 40/.test(A.k.rechnung[2]) && /10 Teile \(9 × 40 \+ 1 × 24\)/.test(A.k.rechnung[3]), A.k.rechnung);
  ok('… und jeder Teil bleibt unter dem Ziel von 8 MB', A.k.maxMB <= 8, A.k.maxMB);
  ok('selbst gewählt 6 Seiten je Teil → 64 Teile, und das steht in der Rechnung', A.c.n === 64 && A.c.je === 6 && /selbst gewählt: 6/.test(A.c.rechnung) && /64 Teile \(64 × 6\)/.test(A.c.rechnung), A.c);
  ok('30 Seiten, 1 MB: kein Aufteilen nötig', A.klein.noetig === false && A.klein.n === 1, A.klein);
  ok('große Seiten (60 MB / 100 S.) → weniger Seiten je Teil, jeder Teil ≤ 8 MB', A.dick.je < 40 && A.dick.maxMB <= A.dick.ziel, A.dick);
  ok('langer Absatz wird in Stücke ≤ 600 Zeichen zerlegt, ohne Text zu verlieren', A.st.n > 1 && A.st.max <= 600 && A.st.gleich, A.st);

  // B. Einlesen, Übersetzen-Dialog: der Kasten mit der Rechnung
  await page.setInputFiles('#inDatei', [path.join(TMP, 'Handbuch.pdf')]);
  await page.waitForSelector('#sc-ed.on'); await page.click('#edZurueck');
  await page.setInputFiles('#inDatei', [path.join(TMP, 'Kurz.pdf')]);
  await page.waitForSelector('#sc-ed.on'); await page.click('#edZurueck');
  await page.evaluate(() => { const w = window.__wfpdf; w.EINST.ueRueck = false; w.EINST.ueVon = 'de'; w.EINST.ueNach = 'ru'; delete w.EINST.ueMsSeite; w.einstSpeichern(); });
  const dlgWahl = async name => {
    await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
    await page.evaluate(n => document.querySelectorAll('.dlg [data-dok]').forEach(c => { c.checked = new RegExp('^\\s*' + n + '\\b').test(c.parentNode.textContent); c.dispatchEvent(new Event('change')); }), name);
  };
  await dlgWahl('Kurz');
  await page.waitForTimeout(300);
  ok('kleines Dokument (5 Seiten): kein Aufteilen-Kasten', await page.evaluate(() => !document.querySelector('.dlg [data-plan]')));
  await page.evaluate(() => document.querySelectorAll('.dlg [data-dok]').forEach(c => { c.checked = /Handbuch/.test(c.parentNode.textContent); c.dispatchEvent(new Event('change')); }));
  const kastenDa = await page.waitForSelector('.dlg [data-plan]', { timeout: 8000 }).then(() => true, () => false);
  const kasten = kastenDa ? await page.textContent('.dlg [data-plan]') : '(kein Kasten)';
  ok('Handbuch (90 Seiten): Kasten mit Rechnung „90 Seiten ÷ 40 = 3 Teile (2 × 40 + 1 × 10)"', kastenDa && /90 Seiten ÷ 40 = 3 Teile \(2 × 40 \+ 1 × 10\)/.test(kasten) && /KB je Seite/.test(kasten), kasten);
  ok('… Zeit je Seite ehrlich „noch nicht gemessen"', /noch nicht gemessen/.test(kasten), kasten);
  if (!kastenDa) throw new Error('ohne Kasten misst der Rest nichts');
  await page.fill('.dlg [data-jeteil]', '30');
  const neu30 = await page.waitForFunction(() => /3 Teile \(3 × 30\)/.test(document.querySelector('.dlg [data-plan]').textContent), null, { timeout: 8000 }).then(() => true, () => false);
  ok('Seiten je Teil auf 30 → rechnet neu: 3 Teile (3 × 30), Knopf sagt es', neu30 && /In 3 Teile aufteilen/.test(await page.textContent('.dlg [data-teilen]')));
  await page.click('.dlg [data-teilen]');
  await page.waitForFunction(() => Array.isArray(window.__wfpdfTeile) && document.querySelector('.dlg [data-dok]'), null, { timeout: 60000 });
  const T = await page.evaluate(() => window.__wfpdfTeile);
  ok('3 Teile angelegt: S. 1–30, 31–60, 61–90, Größe je Teil gemessen', T.length === 3 && T.map(t => t.von + '-' + t.bis).join(',') === '1-30,31-60,61-90' && T.every(t => t.gemessenMB > 0), T);
  const t2 = await seitenText('Handbuch — Teil 2 von 3 (S. 31–60)');
  ok('Teil 2 hat 30 Seiten und beginnt mit Seite 31 des Originals', t2 && t2.seiten.length === 30 && /Seite 31\./.test(t2.seiten[0]) && /Seite 60\./.test(t2.seiten[29]), t2 && [t2.seiten.length, t2.seiten[0]]);
  ok('… die Teile liegen im Ordner „Handbuch · Teile"', t2 && t2.ordner === 'Handbuch · Teile', t2 && t2.ordner);
  const gewaehlt = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')].map(c => [c.parentNode.textContent.trim().slice(0, 30), c.checked]));
  ok('Übersetzen-Fenster öffnet sich mit den 3 Teilen, nur Teil 1 gewählt', gewaehlt.length === 3 && gewaehlt.filter(x => x[1]).length === 1 && /Teil 1 von 3/.test(gewaehlt.find(x => x[1])[0]), gewaehlt);
  ok('… und bei einem Teil kein neuer Aufteilen-Kasten', await page.evaluate(() => !document.querySelector('.dlg [data-plan]')));

  // C. Teil 1 übersetzen — und mitten drin der allgemeine Fehler von Chromes Übersetzer
  await page.evaluate(() => { window.__ue.calls = []; window.__ue.creates = 0; window.__ue.genericAb = 6; });
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung (fertig|unvollständig|angehalten|abgebrochen)/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 90000 });
  const berC = await page.textContent('.dlg');
  const C = await page.evaluate(() => ({ creates: window.__ue.creates, calls: window.__ue.calls.length }));
  ok('„Other generic failures" bricht NICHT mehr ab: neuer Übersetzer, Teil 1 fertig', /Übersetzung fertig/.test(berC) && C.creates === 2 && C.calls === 30, { C, h: berC.slice(0, 300) });
  ok('… der Bericht sagt, dass der Übersetzer neu gestartet wurde', /1 Mal neu gestartet/.test(berC), berC.slice(0, 600));
  const e1 = await seitenText('Handbuch — Teil 1 von 3 (S. 1–30) [RU]');
  ok('… Ergebnis: 30 Seiten, jede übersetzt, im Ordner „Handbuch · RU"', e1 && e1.seiten.length === 30 && e1.seiten.every((s, i) => s.includes('[ru] Handbuch Absatz auf Seite ' + (i + 1) + '.')) && e1.ordner === 'Handbuch · RU', e1 && [e1.seiten.length, e1.ordner, e1.seiten[0]]);
  ok('… und die Zeit je Seite ist jetzt gemessen und gemerkt', await page.evaluate(() => window.__wfpdf.EINST.ueMsSeite > 0));
  await page.click('.dlg [data-x]');

  // D. Hält der Fehler an, gilt er — und wird gemeldet wie bisher (Teilergebnis)
  await page.evaluate(() => { window.__ue.genericAb = 0; window.__ue.genericImmer = true; });
  await dlgWahl('Handbuch — Teil 2');
  await page.click('.dlg [data-weg="browser"]');
  await page.waitForFunction(() => /Übersetzung (fertig|unvollständig|angehalten|abgebrochen)/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 60000 });
  const berD = await page.textContent('.dlg');
  ok('anhaltender Fehler: Bericht nennt ihn („Other generic failures"), kein falsches „fertig"', /Other generic failures/.test(berD) && !/Übersetzung fertig/.test(berD), berD.slice(0, 400));
  await page.click('.dlg [data-x]');

  // E. Zu langer Absatz (QuotaExceededError) → Satz für Satz
  const E = await page.evaluate(async () => { try {
    window.__ue.genericImmer = false; window.__ue.langMax = 100; window.__ue.calls = [];
    const u = await WFP.Uebersetzung.browserUebersetzer('de', 'ru');
    const t = 'Erster Satz über das Gerät und seine Teile. Zweiter Satz: bitte vorher den Stecker ziehen. Dritter Satz endet hier.';
    const r = await u([t]); window.__ue.langMax = 0;
    return { r: r[0], zerlegt: u.stat.zerlegt, stuecke: window.__ue.calls.length };
  } catch (e) { window.__ue.langMax = 0; return { fehler: e.name + ': ' + e.message }; } });
  ok('zu langer Absatz wird Satz für Satz übersetzt, nichts geht verloren', E.zerlegt === 1 && E.stuecke === 3 && /Erster Satz/.test(E.r) && /Dritter Satz endet hier\./.test(E.r), E);

  // F. Nochmal aufteilen mit denselben Grenzen legt nichts doppelt an
  await dlgWahl('Handbuch(?= ·)');
  await page.waitForSelector('.dlg [data-plan]');
  await page.fill('.dlg [data-jeteil]', '30');
  await page.click('.dlg [data-teilen]');
  await page.waitForSelector('.dlg [data-dok]');
  const F = await page.evaluate(async () => (await WFP.DB.all('docs')).filter(d => d.teilVon).length);
  ok('dieselben Grenzen noch einmal → keine doppelten Teile (weiter 3)', F === 3, F);
  await page.click('.dlg [data-x]');

  // G. Der Kasten auf Englisch: kein deutscher Satz bleibt stehen
  for (const lang of ['en', 'ru', 'ar']) {
    await page.evaluate(l => { WFP.Sprache.fehlt.clear(); WFP.Sprache.fehltSatz.clear(); WFP.Sprache.setzen(l); }, lang);
    await dlgWahl('Handbuch(?= ·)');
    await page.waitForSelector('.dlg [data-plan]');
    await page.fill('.dlg [data-jeteil]', '7');
    await page.waitForTimeout(300);
    const G = await page.evaluate(() => ({ text: document.querySelector('.dlg [data-plan]').innerText, fehlt: [...WFP.Sprache.fehlt, ...WFP.Sprache.fehltSatz].filter(x => /Teil|Seite|Datei|gemessen|Übersetzer/.test(x) && !/Felder|<n>|Importieren zum/.test(x)) }));
    ok(lang + ': Aufteilen-Kasten ganz übersetzt, samt Rechnung', !G.fehlt.length && !/Seiten|Teile|Datei|Durchschnitt|gedeckelt|gewählt/.test(G.text.replace(/Handbuch/g, '')), G.fehlt);
    await page.click('.dlg [data-x]');
  }
  await page.evaluate(() => WFP.Sprache.setzen('de'));

  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e.stack || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
