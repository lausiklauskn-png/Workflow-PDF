/* Workfloh PDF — Sprache der Oberfläche (assets/sprache.js), im echten Browser.
   Läuft durch die Zustände der App (Bibliothek, jeder Dialog, Editor in beiden Modi,
   Ausgabe, Übersetzen …) und schlägt dabei jeden sichtbaren Text nach.
   Gemessen wird, was ein Nutzer sieht — nicht, was im Wörterbuch steht:
   - in EN, RU und AR fehlt KEIN Text, den die Rundreise erreicht
   - Namen des Nutzers (Dokument, Ordner, Feld) bleiben unübersetzt
   - zurück auf Deutsch steht wieder genau das Deutsche da (nichts bleibt hängen)
   - Arabisch läuft von rechts, die Seiten der Dokumente nicht
   - Hinweise (Tooltips) lassen sich ausschalten und kommen übersetzt wieder
   - die Wahl übersteht das Neuladen
   SAMMELN=1 gibt statt der Prüfung alle fehlenden Texte als JSON aus (Werkzeug beim Bau). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SAMMELN = !!process.env.SAMMELN;
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 1500) : '')); } };

function server() {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
  const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  });
  return new Promise(res => s.listen(0, '127.0.0.1', () => res(s)));
}

const srv = await server();
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

const zu = p => p.evaluate(() => { for (const g of document.querySelectorAll('.dlg-grund')) g.remove(); document.getElementById('toast').classList.remove('an'); });
const ruhe = p => p.waitForTimeout(60);
async function schritt(p, name, fn) {
  try { await fn(); await ruhe(p); } catch (e) { if (!SAMMELN) ok('Rundreise: ' + name, false, String(e).slice(0, 300)); }
  await zu(p);
}

/* Die Rundreise: jeder erreichbare Zustand einmal. */
async function rundreise(p) {
  const W = '__wfpdf';
  await schritt(p, 'Hilfe', () => p.evaluate(W => window[W].dlg.hilfe(), W));
  await schritt(p, 'Einstellungen', async () => { await p.evaluate(W => window[W].dlg.einstellungen(), W); await p.waitForTimeout(150); });
  await schritt(p, 'Sprache', () => p.evaluate(W => window[W].dlg.spracheWaehlen(), W));
  await schritt(p, 'Installieren', () => p.evaluate(W => window[W].dlg.installHinweis(false), W));
  await schritt(p, 'Installiert', () => p.evaluate(W => window[W].dlg.installHinweis(true), W));
  await schritt(p, 'Übersetzen-Start', () => p.evaluate(W => window[W].dlg.uebersetzenStart(), W));
  await schritt(p, 'Neuer Ordner', () => p.evaluate(W => { window[W].dlg.neuerOrdner(); }, W));
  await schritt(p, 'Chrome-Hinweis', () => p.evaluate(W => window[W].dlg.chromeHinweis('http://x/', true), W));
  await schritt(p, 'Chrome-Hinweis ohne Kopie', () => p.evaluate(W => window[W].dlg.chromeHinweis('http://x/', false), W));
  await schritt(p, 'Zurück-Band', async () => { await p.evaluate(W => window[W].dlg.zurueckBand(), W); await ruhe(p); await p.evaluate(() => document.querySelectorAll('[data-zurueckband]').forEach(e => e.remove())); });
  await schritt(p, 'Aufnahme', () => p.evaluate(W => window[W].dlg.aufnahmeDialog(), W));
  // Mit Dokumenten
  await p.evaluate(W => window[W].beispieleLaden(), W);
  await p.waitForFunction(W => window[W].S.docs.length >= 2, W, { timeout: 30000 });
  await ruhe(p);
  const ids = await p.evaluate(W => window[W].S.docs.map(d => d.id), W);
  // Suche mit Fundstellen (2026-09-26): Fundzeilen, Hinweis „wird noch erfasst", Öffnen mit Markierung
  await schritt(p, 'Suche', async () => {
    await p.evaluate(W => { const w = window[W]; w.S.suche = 'Musterstadt'; w.suche.zeichneBibliothek(); }, W);
    await p.evaluate(W => window[W].suche.texteNachholen(), W);
    await p.evaluate(W => { const w = window[W]; w.suche.TEXTE.delete('__nichtda'); w.S.docs.push({ id: '__nichtda', name: 'x', pages: [], fields: [] }); w.suche.zeichneBibliothek(); w.S.docs.pop(); }, W);
    await p.waitForTimeout(100);
    const id = await p.evaluate(W => [...window[W].S.fund.keys()][0], W);
    if (id) { await p.evaluate(([W, id]) => window[W].oeffneDok(id, window[W].S.fund.get(id)), [W, id]); await p.waitForSelector('#sc-ed.on .seite canvas'); await p.waitForTimeout(150); await p.click('#flohKnopf'); await p.waitForSelector('#sc-bib.on'); }
    await p.evaluate(W => { const w = window[W]; w.S.suche = ''; w.suche.zeichneBibliothek(); }, W);
  });
  await schritt(p, 'Verschieben', () => p.evaluate(([W, id]) => { window[W].dlg.verschieben(id); }, [W, ids[0]]));
  await schritt(p, 'Löschen-Frage', () => p.evaluate(([W, id]) => { window[W].dlg.loeschen(id); }, [W, ids[0]]));
  await schritt(p, 'Ordner ausgeben', () => p.evaluate(W => { const w = window[W]; const o = w.S.ordner.find(o => w.S.docs.some(d => d.folderId === o.id)); if (o) w.dlg.ordnerAusgabe(o); }, W));
  await schritt(p, 'Erkennen', () => p.evaluate(([W, ids]) => { window[W].dlg.erkennenDialog(ids); }, [W, ids]));
  await schritt(p, 'Übersetzen-Dialog', async () => { await p.evaluate(([W, ids]) => { window[W].dlg.uebersetzenDialog(ids, true); }, [W, ids]); await p.waitForTimeout(300); });
  // Übersetzen mit dem (gestellten) Übersetzer des Browsers — Fortschritt, Ergebnis, Rückweg
  const form0 = await p.evaluate(W => window[W].S.docs.find(d => /Amtsformular/.test(d.name)).id, W);
  await schritt(p, 'Messen', async () => { await p.evaluate(([W, id]) => { window[W].dlg.uebersetzenDialog([id], true); }, [W, form0]); await p.waitForSelector('.dlg .ue-mess summary'); await p.click('.dlg .ue-mess summary'); await p.click('.dlg [data-messen]'); await p.waitForTimeout(1500); });
  await schritt(p, 'Übersetzen-Lauf', async () => {
    await p.evaluate(([W, id]) => { window[W].dlg.uebersetzenDialog([id], true); }, [W, form0]);
    await p.waitForSelector('.dlg [data-nach]'); await p.selectOption('.dlg [data-von]', 'de'); await p.selectOption('.dlg [data-nach]', 'ru');
    await p.evaluate(() => { const c = document.querySelector('.dlg [data-rueck]'); if (!c.checked) c.click(); });
    await p.click('.dlg [data-weg="browser"]');
    await p.waitForFunction(() => document.querySelector('.dlg [data-x]') && document.querySelectorAll('.dlg li').length, null, { timeout: 60000 });
  });
  await schritt(p, 'Rückweg', async () => {
    const id = await p.evaluate(W => (window[W].S.docs.find(d => d.uebersetzung && !d.uebersetzung.gegenprobe) || {}).id, W);
    await p.evaluate(([W, id]) => { window[W].dlg.rueckwegDialog(id); }, [W, id]); await p.waitForTimeout(300);
  });
  await schritt(p, 'Übersetzung erneut übersetzen', async () => {
    const id = await p.evaluate(W => (window[W].S.docs.find(d => d.uebersetzung && !d.uebersetzung.gegenprobe) || {}).id, W);
    await p.evaluate(([W, id]) => { window[W].dlg.uebersetzenDialog([id], false); }, [W, id]); await p.waitForTimeout(300);
  });
  await p.evaluate(W => window[W].dlg.zeichneFuss && 0, W);
  // Editor: das Formular (hat Felder? sonst setzt die Probe eins)
  const form = await p.evaluate(W => (window[W].S.docs.find(d => /Amtsformular/.test(d.name)) || window[W].S.docs[0]).id, W);
  await p.evaluate(([W, id]) => window[W].oeffneDok(id), [W, form]);
  await p.waitForSelector('#sc-ed.on .seite canvas', { timeout: 30000 });
  await ruhe(p);
  await p.evaluate(W => { const w = window[W]; w.S.modus = 'bearbeiten'; document.getElementById('mBearbeiten').click(); }, W);
  await schritt(p, 'Feld setzen', () => p.evaluate(W => window[W].dlg.platzierenStart('text'), W));
  await p.evaluate(W => window[W].dlg.platzierenStart('text'), W);   // wieder aus
  await p.evaluate(W => { const w = window[W]; if (!w.S.doc.fields.length) w.S.doc.fields.push({ id: 'probe1', page: 0, type: 'text', label: '', value: '', x: 10, y: 10, w: 30, h: 3, geprueft: false }); w.S.sel = w.S.doc.fields[0].id; w.dlg.zeichneFuss(); document.getElementById('mBearbeiten').click(); }, W);
  await ruhe(p);
  await schritt(p, 'Feld gewählt', async () => { await p.evaluate(W => { const w = window[W]; w.S.sel = w.S.doc.fields[0].id; w.dlg.zeichneFuss(); }, W); });
  await schritt(p, 'Unterschrift', () => p.evaluate(W => { const w = window[W]; w.dlg.unterschreiben({ id: 'x', type: 'unterschrift', label: '', value: '', page: 0, x: 10, y: 60, w: 30, h: 6 }); }, W));
  await schritt(p, 'Erkannter Text', () => p.evaluate(W => window[W].dlg.erkannterText(), W));
  await schritt(p, 'Seite anhängen', () => p.evaluate(W => window[W].dlg.seiteDialog(), W));
  await schritt(p, 'Speichern', async () => { await p.evaluate(W => { window[W].dlg.speichernDialog(); }, W); await p.waitForTimeout(200); });
  await schritt(p, 'Ausgabe', () => p.evaluate(W => window[W].dlg.exportDialog(), W));
  await p.click('#mAusfuellen'); await ruhe(p);
  await schritt(p, 'Ausfüllen', () => p.evaluate(W => window[W].dlg.zeichneFuss(), W));
}

async function lauf(lang, sammeln) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(l => { try { if (!sessionStorage.getItem('__l')) { localStorage.setItem('wfpdf_sprache_v1', JSON.stringify({ lang: l, tipps: true })); sessionStorage.setItem('__l', '1'); } } catch (_) {} }, lang);
  await ctx.addInitScript(() => {
    self.Translator = {
      availability: async ({ sourceLanguage: a, targetLanguage: b }) => (a === b ? 'unavailable' : 'available'),
      create: async ({ targetLanguage: b }) => ({ translate: async t => '[' + b + '] ' + t, destroy() {} })
    };
  });
  const p = await ctx.newPage();
  await p.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  const fehler = []; p.on('pageerror', e => fehler.push(String(e)));
  await p.goto(URL0);
  await p.waitForFunction(() => window.__wfpdf && window.WFP && window.WFP.Sprache);
  await rundreise(p);
  const r = await p.evaluate(() => ({ text: [...WFP.Sprache.fehlt], satz: [...WFP.Sprache.fehltSatz] }));
  return { p, ctx, r, fehler };
}

try {
  if (SAMMELN) {
    const { ctx, r } = await lauf('en');
    fs.writeFileSync(process.env.SAMMELN, JSON.stringify(r, null, 1));
    console.log('gesammelt:', r.text.length, 'Texte,', r.satz.length, 'Sätze →', process.env.SAMMELN);
    await ctx.close();
  } else {
    console.log('Workfloh PDF — Sprache der Oberfläche');
    for (const lang of ['en', 'ru', 'ar']) {
      const { p, ctx, r, fehler } = await lauf(lang);
      ok(`${lang}: kein Seitenfehler auf der Rundreise`, !fehler.length, fehler);
      ok(`${lang}: die Rundreise hat Texte nachgeschlagen (sonst misst sie nichts)`, await p.evaluate(() => Object.keys(WFP.SPRACH_TEXTE[WFP.Sprache.lang] || {}).length > 200));
      ok(`${lang}: kein sichtbarer Text ohne Übersetzung`, r.text.length === 0, r.text);
      ok(`${lang}: <html lang> und Richtung stimmen`, await p.evaluate(l => document.documentElement.lang === l && document.documentElement.dir === (l === 'ar' ? 'rtl' : 'ltr'), lang));
      ok(`${lang}: Knopf oben nennt die Sprache`, (await p.textContent('#btnSprache')).trim() === lang.toUpperCase());
      // Namen des Nutzers bleiben: der Ordner „Beispiele" und die Dokumentnamen
      await p.click('#flohKnopf'); await p.waitForSelector('#sc-bib.on');
      await p.waitForTimeout(100);
      const namen = await p.evaluate(() => ({ chip: [...document.querySelectorAll('.ordner-chip [data-kein-ue]')].map(e => e.textContent), dok: [...document.querySelectorAll('.dok-name')].map(e => e.textContent) }));
      ok(`${lang}: Ordnername „Beispiele" bleibt unübersetzt`, namen.chip.includes('Beispiele'), namen);
      ok(`${lang}: Dokumentnamen bleiben unübersetzt`, namen.dok.some(n => /Benutzerhandbuch/.test(n)) && namen.dok.some(n => /Amtsformular/.test(n)), namen);
      ok(`${lang}: Oberfläche ist wirklich übersetzt (Kachel „Importieren zum Übersetzen")`, !(await p.textContent('#btnUebersetzen')).includes('Importieren'));
      if (lang === 'ar') {
        ok('ar: die Seiten der Dokumente laufen weiter von links', await p.evaluate(() => { document.getElementById('sc-ed').classList.add('on'); const d = getComputedStyle(document.getElementById('seiten')).direction; document.getElementById('sc-ed').classList.remove('on'); return d === 'ltr'; }));
      }
      // Hinweise aus → kein title; an → übersetzt wieder da
      const tip = sel => p.evaluate(s => document.querySelector(s).getAttribute('title'), sel);
      const vorher = await tip('#btnEinst');
      ok(`${lang}: Hinweis (Tooltip) ist übersetzt`, vorher && vorher !== 'Einstellungen', vorher);
      await p.evaluate(() => WFP.Sprache.tippsSetzen(false));
      ok(`${lang}: Hinweise aus → kein Tooltip mehr`, (await tip('#btnEinst')) == null && await p.evaluate(() => !document.querySelector('.kopf [title]')));
      // die App setzt einen Titel neu, während Hinweise aus sind: er darf nicht auftauchen
      await p.evaluate(() => { document.getElementById('btnHilfe').title = 'So geht\'s'; });
      await p.waitForTimeout(50);
      ok(`${lang}: ein neu gesetzter Titel bleibt bei ausgeschalteten Hinweisen verborgen`, (await tip('#btnHilfe')) == null);
      await p.evaluate(() => WFP.Sprache.tippsSetzen(true));
      ok(`${lang}: Hinweise an → Tooltip übersetzt zurück`, (await tip('#btnEinst')) === vorher);
      // Neu laden: die Wahl bleibt
      await p.reload(); await p.waitForFunction(() => window.WFP && WFP.Sprache);
      ok(`${lang}: die Wahl übersteht das Neuladen`, await p.evaluate(l => WFP.Sprache.lang === l && document.documentElement.lang === l, lang));
      // Zurück auf Deutsch: kein Rest der Übersetzung
      const deutsch = await p.evaluate(() => { WFP.Sprache.setzen('de'); return document.body.innerText; });
      // Vergleich: dieselbe Seite, auf Deutsch NEU geladen (gleicher Speicher, gleiche Ordner)
      await p.reload(); await p.waitForFunction(() => window.WFP && WFP.Sprache && window.__wfpdf); await p.waitForTimeout(800);
      const dePlain = await p.evaluate(() => document.body.innerText);
      const norm = t => t.replace(/\s+/g, ' ').replace(/\d+/g, '#').trim();
      ok(`${lang}: zurück auf Deutsch steht dieselbe Seite da wie ohne Umschalten`, norm(deutsch) === norm(dePlain), (() => { const a = norm(deutsch), b = norm(dePlain); let i = 0; while (i < a.length && a[i] === b[i]) i++; return [a.slice(Math.max(0, i - 60), i + 200), b.slice(Math.max(0, i - 60), i + 200)]; })());
      ok(`${lang}: zurück auf Deutsch: <html lang="de">, links nach rechts`, await p.evaluate(() => document.documentElement.lang === 'de' && document.documentElement.dir === 'ltr'));
      await ctx.close();
    }
    // Deutsch ist die Vorgabe und bleibt unberührt
    const c = await browser.newContext(); const q = await c.newPage(); await q.goto(URL0); await q.waitForFunction(() => window.__wfpdf);
    ok('Vorgabe ist Deutsch', await q.evaluate(() => WFP.Sprache.lang === 'de' && document.documentElement.lang === 'de' && document.getElementById('btnSprache').textContent.trim() === 'DE'));
    ok('Wörterbücher für EN, RU und AR vorhanden (erweiterbar)', await q.evaluate(() => ['en', 'ru', 'ar'].every(l => Object.keys(WFP.SPRACH_TEXTE[l] || {}).length > 200)));
    ok('das Wörterbuch hat keinen Schlüssel ohne Übersetzung in einer der drei Sprachen', await q.evaluate(() => { const T = WFP.SPRACH_TEXTE; const k = new Set(['en', 'ru', 'ar'].flatMap(l => Object.keys(T[l]))); return [...k].filter(x => ['en', 'ru', 'ar'].some(l => !(x in T[l]))); }).then(x => x.length === 0));
    await c.close();
  }
} catch (e) { ok('Probe lief durch', false, String(e.stack || e)); }
await browser.close(); srv.close();
if (!SAMMELN) { console.log(`\n${gruen} grün · ${rot} ROT`); process.exit(rot ? 1 : 0); }
