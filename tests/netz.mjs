// „Im Netz antworten“ (assets/netz.js, Klaus 2026-10-31, Punkt 5): echtes Modul 04 (vendor/sbkim/04_match.js), Sprachmodell gestellt
// (Wort-Hash, 384 Stellen), Modul 23 auf das Nötige gestellt (kein Relais). Die Datenbank WorkflohPDF1 kommt aus der echten db.js der App
// (Fächer docs und vektoren, Blöcke zu 64 Abschnitten wie app.js). Vorbild: Workflow-PDF-Pro tools/native/test-netz.mjs.
// Geprüft:
//   A1 öffentlich: der Korpus trägt nur Dateinamen, nie Seitentext; „Meier“ (nur im Text) findet den Brief nicht, der Dateiname schon
//   A2 eigenes Netz + Ausschnitt: ein langer Brief (130 Abschnitte, „Hans Meier“ nur im letzten) wird gefunden, eine Zeile je Dokument,
//      der Ausschnitt zeigt „Meier“, ≤ 200 Zeichen, alle Korpus-Vektoren Float32Array
//   A3 ein neues Dokument nach dem Einschalten wird ohne Aus/An gefunden (Korpus als Funktion, nach enableAnswering gesetzt)
//   A4 wechselt das Netz auf öffentlich, antwortet der Ausschnitt-Filter nichts (Prüfung je Frage)
//   A5 die Datenbank bleibt auf Version 3 — auch auf dem Weg ohne db.js (öffnen ohne Version)
//   B  in der echten App: Abschnitt in ⚙️ Einstellungen, ab Werk aus, ohne Modell eine ehrliche Meldung und nichts gemerkt
// Rückgabe 0 grün · 1 ROT. WF_WURZEL = andere Wurzel (Gegenprobe).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from 'playwright-core';

const WURZEL = path.resolve(process.env.WF_WURZEL || path.join(path.dirname(fileURLToPath(import.meta.url)), '..'));
let gruen = 0, rot = 0;
const ok = (n, c, info) => { if (c) { gruen++; console.log('✓ ' + n); } else { rot++; console.log('✗ ROT: ' + n + (info ? '  — ' + info : '')); } };

const STELLVERTRETER = `
(function () {
  const vec = s => { const v = new Float32Array(384); for (const w of String(s).toLowerCase().normalize('NFKD').replace(/[\\u0300-\\u036f]/g, '').match(/[a-z0-9]{3,}/g) || []) {
    let h = 7; for (const c of w) h = (h * 31 + c.charCodeAt(0)) >>> 0; v[h % 384] += 1; } const n = Math.hypot(...v) || 1; for (let i = 0; i < 384; i++) v[i] /= n; return v; };
  window.__vec = vec; window.__eingebettet = [];
  window.SbkimEmbedding = { init: async () => {}, isReady: () => true, embedPassage: async s => { window.__eingebettet.push(s); return vec(s); }, embedQuery: async s => vec(s) };
  const meta = { network: 'eigen', answering: false };
  window.SbkimRendezvous = { _prep: null, _match: null, get _meta() { return meta; },
    configure(o) { if ('prepareCorpus' in o) this._prep = o.prepareCorpus; if ('match' in o) this._match = o.match; },
    connectAndAnnounce: async () => ({ ok: true }),
    // wie der Kanon (ensureAnswerCorpus): einmal eine feste Liste aus prepareCorpus ablegen
    enableAnswering: async function () { if (this._prep) window.SbkimMatch.setLocalCorpus(await this._prep()); meta.answering = true; return { ok: true }; },
    disableAnswering() { meta.answering = false; },
    // so beantwortet Modul 23 eine fremde Frage: match = cfg.match || SbkimMatch
    frage: async function (q) { const m = this._match || window.SbkimMatch; return m.queryLocal(q, 5); } };
  window.__meta = meta;
})();`;
const SEITE = (mitDb) => `<!doctype html><html lang="de"><head><meta charset="utf-8"></head><body>
<script src="/vendor/sbkim/04_match.js"></script>
<script>${STELLVERTRETER}</script>
${mitDb ? '<script src="/assets/db.js"></script>' : ''}
<script src="/assets/netz.js"></script>
</body></html>`;

const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf', '.ttf': 'font/ttf', '.svg': 'image/svg+xml' };
const srv = await new Promise(res => { const s = http.createServer((q, r) => {
  let p = decodeURIComponent(new URL(q.url, 'http://x').pathname);
  if (p === '/probe.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(SEITE(true)); }
  if (p === '/probe-ohne-db.html') { r.writeHead(200, { 'Content-Type': 'text/html' }); return r.end(SEITE(false)); }
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); r.end(); return; }
  r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
}); s.listen(0, '127.0.0.1', () => res(s)); });
const URL0 = `http://127.0.0.1:${srv.address().port}/`;
const exe = [process.env.WFP_CHROMIUM, '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].filter(Boolean).find(fs.existsSync);
const browser = await pw.chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
try {
  /* ---------- A: Logik gegen das echte Modul 04 ---------- */
  const ctx = await browser.newContext();
  const page = await ctx.newPage(), fehler = [];
  page.on('pageerror', e => fehler.push(e.message));
  await page.goto(URL0 + 'probe.html');
  await page.waitForFunction(() => window.WFPNetz && window.SbkimMatch && window.WFP && window.WFP.DB);
  await page.evaluate(async () => {
    const DB = window.WFP.DB;
    window.__dok = async (id, name, saetze, createdAt) => {
      await DB.put('docs', { id, name, createdAt, pages: [{}] });
      const st = saetze.map(t => ({ page: 0, text: t, box: null, v: window.__vec(t) }));
      await DB.put('vektoren', { id, sig: 'z2:probe', n: st.length, fertig: st.length });
      for (let b = 0; b * 64 < st.length; b++) await DB.put('vektoren', { id: id + '#' + String(b).padStart(5, '0'), st: st.slice(b * 64, (b + 1) * 64) });
    };
    const fuell = n => Array.from({ length: n }, (_, i) => 'Absatz ' + (i + 1) + ' wir bestätigen den Eingang der Unterlagen und prüfen die Lieferung.');
    await window.__dok('d1', 'Schreiben Lieferung.pdf', ['Sehr geehrte Damen und Herren', ...fuell(128), 'Mit freundlichen Grüßen Hans Meier'], 3);
    for (let i = 1; i <= 8; i++) await window.__dok('r' + i, 'Rechnung ' + i + '.pdf', ['Rechnung Nr. ' + i, ...fuell(5), 'Ihre Buchhaltung'], 2);
    await window.__dok('m1', 'Mietvertrag Garage.pdf', ['Mietvertrag Garage Hauptstraße', ...fuell(3)], 1);
  });
  // Wirft Modul 04 (z. B. validateCorpus: Vektor kein Float32Array), wird das eine eigene rote Zeile — die Probe läuft weiter.
  const frage = q => page.evaluate(async q => { try { return await window.SbkimRendezvous.frage(q); } catch (e) { return { wirft: String(e && e.message || e) }; } }, q)
    .then(h => { if (h && h.wirft) { ok('Modul 04 nimmt den Korpus an (kein Float32Array-Fehler) bei „' + q + '“', false, h.wirft); return []; } return h; });
  const version = p => p.evaluate(async () => ((await indexedDB.databases()).find(d => d.name === 'WorkflohPDF1') || {}).version);

  ok('Ab Werk aus: stand().an ist false', !(await page.evaluate(() => window.WFPNetz.stand().an)));

  // A1 öffentlich
  await page.evaluate(() => { window.__meta.network = 'oeffentlich'; });
  let r = await page.evaluate(() => window.WFPNetz.an({ mitAusschnitt: false }));
  ok('A1 öffentlich: Antworten lässt sich einschalten', r.ok, JSON.stringify(r));
  ok('A1 öffentlich: „Mit Ausschnitt“ wird außerhalb des eigenen Netzes abgewiesen', !(await page.evaluate(() => window.WFPNetz.an({ mitAusschnitt: true }))).ok);
  r = await page.evaluate(() => window.WFPNetz.an({ mitAusschnitt: false }));
  const eingebettet = await page.evaluate(() => window.__eingebettet.slice());
  ok('A1 öffentlich: eingebettet werden nur Dateinamen (nie Seitentext)', eingebettet.length > 0 && eingebettet.every(s => /^Dokument · /.test(s) && !/Absatz|Meier|Hauptstraße/.test(s)), JSON.stringify(eingebettet.slice(0, 3)));
  let h = await frage('Mietvertrag Garage');
  ok('A1 öffentlich: der Dateiname wird gefunden', h.some(x => /Mietvertrag Garage/.test(x.label)), JSON.stringify(h.map(x => x.label)));
  ok('A1 öffentlich: keine Antwortzeile trägt Seitentext', h.every(x => !/Absatz|Hauptstraße/.test(x.label)));
  h = await frage('freundlichen Grüßen Hans Meier');
  ok('A1 öffentlich: „Hans Meier“ (nur im Text) findet den Brief nicht', !h.some(x => /Schreiben Lieferung/.test(x.label)), JSON.stringify(h.map(x => x.label)));

  // A2 eigenes Netz mit Ausschnitt
  await page.evaluate(() => { window.__meta.network = 'eigen'; });
  r = await page.evaluate(() => window.WFPNetz.an({ mitAusschnitt: true }));
  ok('A2 eigenes Netz: mit Ausschnitt eingeschaltet', r.ok && r.mitAusschnitt, JSON.stringify(r));
  const k = await page.evaluate(async () => { const l = await window.WFPNetz.lesen(); const kk = window.WFPNetz.korpusMitAusschnitt(l.docs, l.stuecke); const d1 = kk.eintraege.filter(e => e.anchorId === 'dok:d1');
    return { n: d1.length, letzter: d1.some(e => /Hans Meier/.test(e.text)), erster: d1.some(e => /Sehr geehrte/.test(e.text)), vek: kk.eintraege.length > 0 && kk.eintraege.every(e => e.passageVec instanceof Float32Array) }; });
  ok('A2 langer Brief: höchstens 60 Abschnitte, Anfang dabei', k.n > 0 && k.n <= 60 && k.erster, JSON.stringify(k));
  ok('A2 langer Brief: das Briefende ist dabei', k.letzter, JSON.stringify(k));
  ok('A2 alle Korpus-Vektoren sind Float32Array', k.vek, JSON.stringify(k));
  h = await frage('freundlichen Grüßen Hans Meier');
  ok('A2 eigenes Netz: „Hans Meier“ am Briefende findet den Brief', h.length > 0 && /Schreiben Lieferung/.test(h[0].label), JSON.stringify(h.map(x => x.label)));
  ok('A2 eigenes Netz: der Ausschnitt zeigt „Meier“, ≤ 200 Zeichen', h.length > 0 && /Meier/.test(h[0].label) && h[0].label.length <= 200, h[0] && h[0].label);
  ok('A2 eigenes Netz: eine Zeile je Dokument', h.length > 0 && new Set(h.map(x => x.anchorId)).size === h.length);

  // A3 neues Dokument nach dem Einschalten
  await page.evaluate(() => window.__dok('n1', 'Neu.pdf', ['Kaufvertrag Wohnmobil Seeblick'], 9));
  h = await frage('Kaufvertrag Wohnmobil Seeblick');
  ok('A3 neues Dokument nach dem Einschalten wird ohne Aus/An gefunden', h.some(x => /Neu/.test(x.label)), JSON.stringify(h.map(x => x.label)));

  // A4 Netz wechselt auf öffentlich: Ausschnitt-Filter schweigt
  await page.evaluate(() => { window.__meta.network = 'oeffentlich'; });
  h = await frage('freundlichen Grüßen Hans Meier');
  ok('A4 Netz auf öffentlich gewechselt: der Ausschnitt-Filter antwortet nichts', h.length === 0, JSON.stringify(h));

  // A5 keine Versionssprünge
  ok('A5 die Datenbank bleibt auf Version 3', (await version(page)) === 3);
  await page.evaluate(() => window.WFPNetz.aus());
  ok('Aus: Modul 23 antwortet nicht mehr', !(await page.evaluate(() => window.__meta.answering)));
  ok('A: keine Seitenfehler', fehler.length === 0, fehler.join(' | '));
  // Ohne db.js (Weg „öffnen ohne Version“): liest dieselben Dokumente, keine neue Version
  const p2 = await ctx.newPage();
  await p2.goto(URL0 + 'probe-ohne-db.html');
  await p2.waitForFunction(() => window.WFPNetz);
  const l2 = await p2.evaluate(async () => { const l = await window.WFPNetz.lesen(); return { docs: l.docs.length, st: (l.stuecke.get('d1') || []).length }; });
  ok('A5 ohne db.js: liest Dokumente und Abschnitte nur lesend', l2.docs === 11 && l2.st === 130, JSON.stringify(l2));
  ok('A5 ohne db.js: die Datenbank bleibt auf Version 3', (await version(p2)) === 3);
  await ctx.close();

  /* ---------- B: in der echten App ---------- */
  const c3 = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  await c3.route(u => !u.toString().startsWith(URL0), rt => rt.abort());
  const app = await c3.newPage(), fehler3 = [];
  app.on('pageerror', e => fehler3.push(e.message));
  await app.goto(URL0 + 'index.html');
  await app.waitForFunction(() => window.WFPNetz && window.__wfpdf);
  await app.click('#btnEinst');
  const da = await app.waitForSelector('[data-netz-antworten]', { timeout: 8000 }).then(() => true, () => false);
  ok('B Abschnitt „Im Netz antworten“ ist in den Einstellungen', da);
  if (da) {
  const b = await app.evaluate(() => { const q = s => document.querySelector(s); return { an: q('[data-netz-an]').checked, aus: q('[data-netz-ausschnitt]').checked, gesperrt: q('[data-netz-ausschnitt]').disabled, stand: q('[data-netz-stand]').textContent, lage: q('[data-netz-lage]').textContent, sicht: !!q('[data-netz-antworten] h3').offsetParent }; });
  ok('B Abschnitt „Im Netz antworten“ steht sichtbar in den Einstellungen', b.sicht, JSON.stringify(b));
  ok('B ab Werk aus: beide Schalter aus, „Antwortet nicht“', !b.an && !b.aus && /Antwortet nicht/.test(b.stand), JSON.stringify(b));
  ok('B ohne eigenes Netz ist „Mit Ausschnitt“ gesperrt', b.gesperrt);
  ok('B ohne Modell sagt der Abschnitt, dass er die Suche nach Bedeutung braucht', /Suche nach Bedeutung/.test(b.lage), b.lage);
  await app.click('[data-netz-an]');
  await app.waitForFunction(() => document.querySelector('[data-netz-meldung]').textContent.length > 0, null, { timeout: 15000 }).catch(() => {});
  const b2 = await app.evaluate(() => ({ m: document.querySelector('[data-netz-meldung]').textContent, an: document.querySelector('[data-netz-an]').checked, gemerkt: localStorage.getItem('wfpdf_netz_v1'), stand: window.WFPNetz.stand().an }));
  ok('B einschalten ohne Mycel/Modell: ehrliche Meldung, Schalter bleibt aus, nichts gemerkt als „an“', b2.m.length > 0 && !b2.an && !b2.stand && !/"an":true/.test(b2.gemerkt || ''), JSON.stringify(b2));
  }
  ok('B: keine Seitenfehler', fehler3.length === 0, fehler3.join(' | '));
  await c3.close();
} finally { await browser.close(); srv.close(); }
console.log(`netz: ${gruen} grün · ${rot} ROT`);
process.exit(rot ? 1 : 0);
