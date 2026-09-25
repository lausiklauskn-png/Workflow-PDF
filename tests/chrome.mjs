/* Workfloh PDF — Probe „🌐 Mit Chrome übersetzen" im echten Browser (Chromium, playwright-core).
   Chromes Seitenübersetzung (⋮ → Übersetzen) gibt es headless nicht; ein Stellvertreter
   tut, was Chrome tut: <html> bekommt „translated-ltr", jeder Text außerhalb von
   translate="no" wird in <font> gehüllt und ersetzt — auch Text, der NACHHER dazukommt.
   Erfundene Daten, kein Byte ins Netz.
   Geprüft: die App wartet, bis der Nutzer übersetzen lässt · übernimmt Seite für Seite ·
   ein Absatz, den Chrome unverändert lässt („Hamburg"), zählt als übersetzt · die
   App-Oberfläche bleibt deutsch · Abbrechen während des Wartens. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 600) : '')); } };

async function dok() {
  const pdf = await PDFDocument.create(); const f = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage([595.28, 841.89]).drawText('Seite eins wird übersetzt.', { x: 60, y: 760, size: 12, font: f });
  pdf.addPage([595.28, 841.89]).drawText('Hamburg', { x: 60, y: 760, size: 12, font: f });
  pdf.addPage([595.28, 841.89]).drawText('Seite drei wird übersetzt.', { x: 60, y: 760, size: 12, font: f });
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

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'wfp-chrome-'));
fs.writeFileSync(path.join(TMP, 'Chrome.pdf'), await dok());
const srv = await server();
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
await ctx.addInitScript(() => {
  // Stellvertreter für Chromes Seitenübersetzung
  let an = false, beob = null;
  const gesperrt = n => { for (let e = n.nodeType === 1 ? n : n.parentElement; e; e = e.parentElement) { const t = e.getAttribute && e.getAttribute('translate'); if (t === 'no') return true; if (t === 'yes') return false; } return false; };
  const zu = t => t.trim() === 'Hamburg' ? t : '[ru] ' + t;
  const lauf = wurzel => {
    const w = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT); const ns = [];
    for (let n; (n = w.nextNode());) if (n.nodeValue.trim() && !gesperrt(n) && !(n.parentElement && n.parentElement.closest('font,script,style'))) ns.push(n);
    ns.forEach(n => { const a = document.createElement('font'); a.style.verticalAlign = 'inherit'; const b = document.createElement('font'); b.style.verticalAlign = 'inherit'; b.textContent = zu(n.nodeValue); a.appendChild(b); n.replaceWith(a); });
  };
  window.__chromeUebersetzen = () => {
    an = true; document.documentElement.classList.add('translated-ltr'); lauf(document.body);
    beob = new MutationObserver(ms => { if (an) ms.forEach(m => m.addedNodes.forEach(x => { if (x.nodeType === 1 || x.nodeType === 3) setTimeout(() => { const w = x.nodeType === 1 ? x : x.parentElement; if (w && w.isConnected) lauf(w); }, 60); })); });
    beob.observe(document.body, { childList: true, subtree: true });
  };
  window.__chromeOriginal = () => { an = false; if (beob) beob.disconnect(); document.documentElement.classList.remove('translated-ltr'); };
});
const page = await ctx.newPage();
const konsole = [];
page.on('pageerror', e => konsole.push(String(e)));
page.on('console', m => { if (m.type() === 'error') konsole.push(m.text()); });
await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());

try {
  await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
  await page.waitForFunction(() => !!window.__wfpdf);
  await page.setInputFiles('#inDatei', path.join(TMP, 'Chrome.pdf'));
  await page.waitForSelector('#sc-ed.on'); await page.click('#edZurueck');
  await page.evaluate(() => { const w = window.__wfpdf; w.EINST.ueRueck = true; w.einstSpeichern(); w.S.aktOrdner = 'alle'; });
  await page.click('.ordner-chip[data-o="alle"]');
  const oeffne = async nach => {
    await page.click('[data-ueb]'); await page.waitForSelector('.dlg [data-dok]');
    const i = await page.evaluate(() => [...document.querySelectorAll('.dlg [data-dok]')].findIndex(c => /Chrome/.test(c.parentNode.textContent) && !/\[/.test(c.parentNode.textContent)));
    await page.locator('.dlg [data-dok]').nth(i).check();
    await page.selectOption('.dlg [data-von]', 'de'); await page.selectOption('.dlg [data-nach]', nach);
  };

  // 1. Start: die App wartet auf den Nutzer
  await oeffne('ru');
  ok('Dialog bietet „🌐 Mit Chrome übersetzen (Google)" an und nennt, dass der Text an Google geht', await page.evaluate(() => { const b = document.querySelector('.dlg [data-weg="chrome"]'); return !!b && !b.disabled && /Google/.test(b.textContent); }));
  await page.click('.dlg [data-weg="chrome"]');
  await page.waitForSelector('#wfp-chrome');
  const anl = await page.textContent('#wfp-chrome [data-anl]');
  ok('Fläche unten nennt den Weg: ⋮ → „Übersetzen" und Russisch', /⋮/.test(anl) && /Übersetzen/.test(anl) && /Russisch/.test(anl), anl);
  ok('der Text der Seite steht als echter Text da (übersetzbar)', await page.evaluate(() => document.querySelector('#wfp-chrome').getAttribute('translate') === 'yes' && /Seite eins wird übersetzt/.test(document.querySelector('#wfp-chrome [data-liste]').textContent)));
  ok('die App-Oberfläche ist für Chrome gesperrt (translate="no")', await page.evaluate(() => document.querySelector('header.kopf').getAttribute('translate') === 'no' && document.getElementById('modals').getAttribute('translate') === 'no'));
  ok('Ausgangssprache der Seite ist angesagt (lang="de")', await page.evaluate(() => document.documentElement.lang === 'de' && document.getElementById('wfp-chrome').lang === 'de'));
  await page.waitForTimeout(1500);
  ok('ohne Chromes Übersetzung wartet die App (nichts wird als übersetzt angenommen)', await page.evaluate(async () => !(await WFP.DB.all('docs')).some(d => /\[RU/.test(d.name)) && !!document.getElementById('wfp-chrome')));

  // 2. Nutzer tippt ⋮ → Übersetzen
  const t0 = Date.now();
  await page.evaluate(() => window.__chromeUebersetzen());
  await page.waitForFunction(() => /Übersetzung fertig/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 60000 });
  console.log('    gemessen: 3 Seiten über den Chrome-Weg in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const bericht = await page.textContent('.dlg');
  ok('Bericht: 3 von 3 Seiten, Hinweis „keine Gegenprobe auf dem Chrome-Weg"', /3 von 3 Seiten/.test(bericht) && /Gegenprobe gibt es auf dem Chrome-Weg nicht/.test(bericht), bericht.slice(0, 500));
  ok('… und kein Absatz als „nicht übersetzt" gemeldet (Hamburg bleibt Hamburg)', !/nicht übersetzt/.test(bericht), bericht.slice(0, 500));
  const erg = await page.evaluate(async () => {
    const d = (await WFP.DB.all('docs')).find(x => x.name === 'Chrome [RU]'); if (!d) return null;
    const pdf = await pdfjsLib.getDocument({ data: (await WFP.DB.getFile(d.id)).slice(0) }).promise; const t = [];
    for (let i = 1; i <= pdf.numPages; i++) t.push((await (await pdf.getPage(i)).getTextContent()).items.map(x => x.str).join(' '));
    return { t, von: d.uebersetzung.von, nach: d.uebersetzung.nach, weg: d.uebersetzung.weg };
  });
  ok('Ergebnis „Chrome [RU]": jede Seite an ihrem Platz, Chromes Text übernommen', erg && erg.t.length === 3 && erg.t[0].includes('[ru] Seite eins wird übersetzt.') && erg.t[2].includes('[ru] Seite drei wird übersetzt.') && erg.t[1].includes('Hamburg'), erg);
  ok('… als Chrome-Weg vermerkt (de → ru)', erg && erg.von === 'de' && erg.nach === 'ru' && erg.weg === 'chrome', erg);
  ok('Fläche wieder weg, <html lang> wieder wie vorher', await page.evaluate(() => !document.getElementById('wfp-chrome') && document.documentElement.lang === 'de'));
  ok('App-Oberfläche blieb deutsch (nichts von Chrome übersetzt)', await page.evaluate(() => !/\[ru\]/.test(document.querySelector('header.kopf').textContent + document.getElementById('modals').textContent.replace(/Chrome \[RU\]/g, ''))));
  ok('solange Chrome übersetzt anzeigt, bleibt die Sperre an der App', await page.evaluate(() => document.querySelector('header.kopf').getAttribute('translate') === 'no'));
  await page.evaluate(() => window.__chromeOriginal());
  await page.waitForFunction(() => !document.querySelector('[data-wfp-tr]'), null, { timeout: 5000 }).catch(() => {});
  ok('… und fällt, sobald Chrome wieder das Original zeigt', await page.evaluate(() => !document.querySelector('[data-wfp-tr]') && document.querySelector('header.kopf').getAttribute('translate') == null));
  await page.click('.dlg [data-x]');

  // 3. Abbrechen, während die App auf Chrome wartet
  await oeffne('en');
  await page.click('.dlg [data-weg="chrome"]');
  await page.waitForSelector('#wfp-chrome [data-halt]');
  await page.click('#wfp-chrome [data-halt]');
  await page.waitForFunction(() => /angehalten/.test(document.querySelector('.dlg h2')?.textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const b2 = await page.evaluate(() => document.querySelector('.dlg h2')?.textContent + ' | ' + document.querySelector('.dlg')?.textContent);
  ok('Abbrechen beim Warten: Lauf „angehalten", kein Teil-PDF ohne Seiten, keine falsche Fehlermeldung', /angehalten/.test(b2) && /Noch keine Seite übersetzt/.test(b2) && !/Der Übersetzer hat abgebrochen/.test(b2), b2.slice(0, 400));
  ok('… Fläche entfernt, Sperre an der App wieder frei', await page.evaluate(() => !document.getElementById('wfp-chrome') && !document.querySelector('[data-wfp-tr]')));

  ok('keine Fehler in der Konsole', konsole.length === 0, konsole);
} catch (e) {
  rot++; console.log('  ✗ ROT: Abbruch → ' + (e && e.message || e));
} finally {
  await browser.close(); srv.close(); fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
