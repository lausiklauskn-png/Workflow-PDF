/* Workfloh PDF — SBKIM-Knoten mit Netz-Einstellung (2026-10-13).
   Ohne Browser: 13 Module byte-1:1 aus Sage (SHA gepinnt) · Schublade im <head> VOR jedem Modul ·
   Kette vollständig, in der Kanon-Reihenfolge, mit Komma zwischen den Gliedern · KEIN Modul im
   Installations-Vorrat · Klebstoff und Identität stehen da · ?v= und CACHE_VERSION passen.
   Im echten Browser: Lampen, Siegel 28×28, Mycel-Blase mit Netz-Box, KEIN WebSocket und kein fremder
   Abruf beim Laden, Kopfleiste bei 320/360/380 ohne Überlauf, die Lasche verdeckt keinen Knopf.
   Nicht gemessen: das Tablet, ein echtes Relais (Verbinden), der Beitritt zu einem eigenen Netz.
   WURZEL=<pfad> misst eine andere Kopie (für die Gegenprobe). */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const WURZEL = process.env.WURZEL || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let gruen = 0, rot = 0;
const ok = (name, bed, info) => { if (bed) { gruen++; console.log('  ✓ ' + name); } else { rot++; console.log('  ✗ ROT: ' + name + (info !== undefined ? ' → ' + JSON.stringify(info).slice(0, 500) : '')); } };
const lies = (p) => fs.readFileSync(path.join(WURZEL, p), 'utf8');
console.log('Workfloh PDF — SBKIM-Knoten');

/* ---- 1 · Kanon: byte-1:1 aus Sage-Protokol (origin/main 49fb020, 2026-10-13) ---- */
const PIN = {
  'sbkim/01_storage.js': '5a5a4bf64dfcc107da7ed70fb755d7db5cce7d80e963b3e2fbc2004537747820',
  'sbkim/02_spore.js': '0cbf0664e2a79f1301c03e52f7ac0030d4b2961f03b97b38e8634827a52353c5',
  'vendor/sbkim/03_embedding.js': '2e31baa09a2959c95efff8eecd224e8343e75695b4b293aa35209d8f96d1f3b5',
  'vendor/sbkim/04_match.js': '721eecc3c0d6ea4c259259e6071215ec1cd16f1c43c87b42ce9e72e9a0b5e41c',
  'sbkim/05_anastomose.js': '255ac79aeb3b0203e92f0cebd0a905e47c488b43efe18f41332a7d35520bbf23',
  'sbkim/05b_nostr_relay.js': '37eee5b196b3efad57131edd1cc3c0ee23acb97b5ca40740d6a0771db4b4a421',
  'sbkim/07_apoptose.js': '0acdd6ab2d95e131fa6953061cc0e95a2396e05fff091a7dc690b2668a4c035a',
  'sbkim/15_membran.js': '829a5bc01976b59c5ce428125314b87b314b6212cd5a473634c2d22c02579397',
  'sbkim/16_siegel.js': 'd26a262f593a75c44d22377059d4d076e4455e9f6bcc68b0c2ea992cd3380d37',
  'sbkim/16b_andock_wizard.js': 'c415eafdb1b660a5256e19957c667074b64b0c3990cc8acc4daeeef34a57e85d',
  'sbkim/23_rendezvous.js': '5aa8262638eeaf70f5e5563592a730f240a95ed80daf41a4df5d7d51824afb74',
  'sbkim/23_rendezvous_ui.js': '66b2c6b95d27e35cb3b9697a5edc3250dfb50eb960375f9a68ab696ab05b82d2',
  'sbkim/noble-secp256k1.js': '8f3879ca422c4fdfe7ca0361688636fa7cc550a59bd94d512ed6ec79aa3d55d1',
};
for (const [f, sha] of Object.entries(PIN)) {
  const p = path.join(WURZEL, f);
  const ist = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'fehlt';
  ok('Modul ' + f + ' ist byte-1:1 aus Sage', ist === sha, ist);
}
// Liegt Sage daneben, wird zusätzlich gegen dessen Dateien verglichen (sagt, wenn der Kanon weitergezogen ist).
const SAGE = process.env.SAGE_KLON || path.resolve(WURZEL, '..', 'Sage-Protokol');
if (fs.existsSync(path.join(SAGE, 'src/modules/01_storage.js'))) {
  const anders = Object.keys(PIN).filter(f => { const s = path.join(SAGE, 'src/modules', path.basename(f)); return fs.existsSync(s) && crypto.createHash('sha256').update(fs.readFileSync(s)).digest('hex') !== PIN[f]; });
  console.log(anders.length ? '  ℹ Sage-Klon daneben trägt eine neuere Fassung von: ' + anders.join(', ') + ' (neu kopieren, Pin nachziehen)' : '  ℹ Sage-Klon daneben: alle Pins gleich');
}

/* ---- 2 · Seite: Schublade im <head>, vor jedem Skript ---- */
const html = lies('index.html');
const kopf = html.slice(0, html.indexOf('</head>'));
const schublade = kopf.search(/<script>\s*window\.SBKIM_DB_SUFFIX\s*=\s*"workflowpdf";\s*<\/script>/);
const erstesSkript = html.search(/<script[^>]*\bsrc=/);
ok('die Schublade window.SBKIM_DB_SUFFIX = "workflowpdf" steht im <head>', schublade > 0);
ok('… VOR dem ersten geladenen Skript (Modul 01 liest sie beim Laden)', schublade > 0 && schublade < erstesSkript, { schublade, erstesSkript });
ok('die Seite lädt den Klebstoff assets/sbkim-init.js mit defer', /<script defer src="assets\/sbkim-init\.js\?v=\d+"><\/script>/.test(html));
ok('die Seite lädt KEIN Modul selbst (die Kette tut es nach dem Laden)', !/<script[^>]*src="(sbkim|vendor\/sbkim)\//.test(html));
ok('KEIN Modul 17 (die Leiste ist fest, kein fliegendes Widget)', !fs.existsSync(path.join(WURZEL, 'sbkim/17_widget.js')) && !/17_widget/.test(lies('assets/sbkim-init.js')));
const leiste = html.match(/<header class="kopf"[\s\S]*?<\/header>/);
ok('die Netz-Leiste steht IN der Kopfzeile', !!leiste && /id="netzleiste"/.test(leiste[0]));
for (const id of ['lamp-alive', 'lamp-traffic', 'lamp-fremd', 'siegel-platz']) ok('… mit #' + id, !!leiste && leiste[0].includes('id="' + id + '"'));
ok('… und dem Platz für die Mycel-Blase', !!leiste && /data-sbkim-mycel-platz/.test(leiste[0]));

/* ---- 3 · Klebstoff: Kette, Reihenfolge, Kommas, Netz ---- */
const init = lies('assets/sbkim-init.js');
const kette = init.slice(init.indexOf('var KANON = ['), init.indexOf('];', init.indexOf('var KANON = [')) + 2);
const glieder = [...kette.matchAll(/\[\s*"(module|)"\s*,\s*"([^"]+)"\s*\]/g)].map(m => m[2]);
const SOLL = ['sbkim/01_storage.js', 'sbkim/02_spore.js', 'vendor/sbkim/04_match.js', 'assets/pruefer-mail.js' /* Prüfliste vor dem KI-Richter, Sage Bau 04.J (2026-10-14) */, 'sbkim/05_anastomose.js', 'sbkim/07_apoptose.js', 'sbkim/15_membran.js', 'sbkim/16_siegel.js', 'sbkim/05b_nostr_relay.js', 'sbkim/23_rendezvous.js', 'sbkim/23_rendezvous_ui.js', 'assets/siegel-inhalt.js', 'sbkim/16b_andock_wizard.js'];
ok('die Kette trägt alle Glieder in der Kanon-Reihenfolge', JSON.stringify(glieder.map(g => g.split('?')[0])) === JSON.stringify(SOLL), glieder);
const zeilen = kette.split('\n').filter(l => /^\s*\[/.test(l));
ok('… zwischen den Gliedern steht jedes Komma (sonst wird [..] [..] ein Index-Zugriff)', zeilen.length === SOLL.length && zeilen.slice(0, -1).every(l => /\]\s*,/.test(l)), zeilen);
ok('… Modul 05b als ES-Modul (es holt noble-secp256k1.js selbst)', /\[\s*"module"\s*,\s*"sbkim\/05b_nostr_relay\.js"\s*\]/.test(kette));
ok('… 04 aus vendor/sbkim mit DERSELBEN Adresse wie die Suche nach Bedeutung (keine zweite Kopie)',
  kette.includes('"vendor/sbkim/04_match.js?v=1"') && lies('assets/app.js').includes("'vendor/sbkim/04_match.js?v=1'"));
ok('… Modul 03 steht NICHT in der Kette (es lädt erst auf „Modell laden")', !/03_embedding/.test(kette.replace(/\/\*[\s\S]*?\*\//g, '')));
ok('… und ein schon geladenes 04 wird nicht zweimal geholt', /window\.SbkimMatch\)/.test(init));
ok('der Klebstoff nennt dieselbe Schublade', /dbSuffix:\s*"workflowpdf"/.test(init));
ok('keine fremde Herkunft darf per postMessage reden (allowedOrigins leer)', /allowedOrigins:\s*\[\]/.test(init));
ok('das Band im Wappen heißt WORKFLOH PDF', /ribbonText:\s*"WORKFLOH PDF"/.test(init));
ok('Rendezvous ohne ensureIdentity (nichts beim Laden)', !/ensureIdentity\s*\(/.test(init));
ok('der Gerätename hängt der Klebstoff ins Verbinden-Panel (data-sbkim-geraetename)', /sbkim-rdv-panel/.test(init) && /data-sbkim-geraetename/.test(init));
ok('die Kette läuft erst nach dem Laden (load / Leerlauf)', /addEventListener\("load"/.test(init) && /requestIdleCallback/.test(init));

/* ---- 4 · Identität ---- */
const wiz = lies('assets/siegel-inhalt.js');
const besch = (wiz.match(/domainDescription:\s*"([^"]+)"/) || [])[1] || '';
ok('Identität: nodeName „Workfloh PDF", Endpunkt dieser App', /nodeName:\s*"Workfloh PDF"/.test(wiz) && /endpoint:\s*"https:\/\/lausiklauskn-png\.github\.io\/Workflow-PDF\/"/.test(wiz));
ok('… die Beschreibung beginnt mit dem eigenen Namen', /^Workfloh PDF\b/.test(besch), besch.slice(0, 60));
ok('… nennt den Zweck (Formular einlesen, ausfüllen, ausgeben)', /Formular/.test(besch) && /ausfüll/.test(besch) && /PDF/.test(besch));
ok('… nennt SBKIM, Mycel, Sage-Protokol und dass es ein Knoten ist', /SBKIM/.test(besch) && /Mycel/.test(besch) && /Sage-Protokol/.test(besch) && /Knoten/.test(besch));

/* ---- 5 · Vorrat und Versionen ---- */
const sw = lies('sw.js');
const schale = sw.slice(sw.indexOf('const SCHALE'), sw.indexOf('];', sw.indexOf('const SCHALE')));
ok('KEIN SBKIM-Modul im Installations-Vorrat (der Worker legt sie beim ersten Abruf ab)', !/sbkim\//.test(schale), schale.match(/[^']*sbkim\/[^']*/g));
ok('… Klebstoff und Identität stehen im Vorrat', /'\.\/assets\/sbkim-init\.js\?v=\d+'/.test(schale) && /'\.\/assets\/siegel-inhalt\.js\?v=\d+'/.test(schale));
const vSeite = Object.fromEntries([...html.matchAll(/(?:src|href)="(assets\/[^"?]+)\?v=(\d+)"/g)].map(m => [m[1], m[2]]));
const vSw = Object.fromEntries([...schale.matchAll(/'\.\/(assets\/[^'?]+)\?v=(\d+)'/g)].map(m => [m[1], m[2]]));
const abweichend = Object.keys(vSeite).filter(k => vSw[k] && vSw[k] !== vSeite[k]);
ok('jede ?v= in der Seite ist dieselbe wie im Vorrat', abweichend.length === 0 && Object.keys(vSeite).length > 15, abweichend);
ok('siegel-inhalt.js: dieselbe ?v= in Kette und Vorrat', (kette.match(/siegel-inhalt\.js\?v=(\d+)/) || [])[1] === vSw['assets/siegel-inhalt.js']);
ok('CACHE_VERSION ist erhöht (v81 oder später)', Number((sw.match(/workfloh-pdf-v(\d+)/) || [])[1]) >= 81);

/* ---- 6 · im echten Browser ---- */
let pw = null;
try { pw = await import('playwright-core'); } catch (_) {}
if (!pw) { console.log('  ⊘ Browser-Teil nicht lauffähig (playwright-core fehlt — npm install)'); }
else {
  const typ = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.pdf': 'application/pdf' };
  const srv = await new Promise(res => { const s = http.createServer((q, r) => {
    let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(WURZEL, p); if (!f.startsWith(WURZEL) || !fs.existsSync(f)) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': typ[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
  }); s.listen(0, '127.0.0.1', () => res(s)); });
  const url = `http://127.0.0.1:${srv.address().port}/`;
  const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
  const browser = await pw.chromium.launch(exe ? { executablePath: exe } : {});
  try {
    for (const [w, handy] of [[1280, false], [520, true], [380, true], [360, true], [320, true]]) {
      const ctx = await browser.newContext({ serviceWorkers: 'block', viewport: { width: w, height: 760 }, hasTouch: handy, isMobile: handy });
      const page = await ctx.newPage();
      const fehler = [], draussen = [], sockets = [];
      page.on('pageerror', e => fehler.push(String(e)));
      page.on('websocket', ws => sockets.push(ws.url()));
      /* Der 'websocket'-Ereignis von Playwright kommt hinter dem Ausgangs-Proxy des Behälters nicht an
         (gemessen: 0 Ereignisse für ein echtes new WebSocket). Gezählt wird deshalb zusätzlich jeder
         Aufruf des Konstruktors, bevor die Seite läuft. */
      await page.addInitScript(() => {
        const W = window.WebSocket; window.__wfpSockets = [];
        const Z = function (u, p) { window.__wfpSockets.push(String(u)); return p === undefined ? new W(u) : new W(u, p); };
        Z.prototype = W.prototype; for (const k of ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED']) Z[k] = W[k];
        window.WebSocket = Z;
      });
      const alleSockets = async () => sockets.concat(await page.evaluate(() => window.__wfpSockets || []));
      await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => { draussen.push(r.request().url()); r.abort(); });
      await page.goto(url);
      await page.waitForFunction(() => window.WFP_KNOTEN_BEREIT === true, null, { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(700);
      const z = await page.evaluate((w) => ({
        bereit: window.WFP_KNOTEN_BEREIT === true, storage: !!window.SbkimStorage, siegel: !!window.SbkimSiegel, rdv: !!window.SbkimRendezvous, ui: !!window.SbkimRendezvousUI, nostr: !!window.SbkimNostrRelay || !!window.SbkimNostr,
        suffix: window.SBKIM_DB_SUFFIX, wiz: !!window.SBKIM_SIEGEL_WIZ, alive: document.getElementById('lamp-alive').classList.contains('on'),
        blase: !!document.querySelector('[data-sbkim-mycel-platz] [data-sbkim-angedockt]'),
        widget17: !!window.SbkimWidget, embed: !!window.SbkimEmbedding || !!document.querySelector('script[src*="03_embedding"]'), match: !!window.SbkimMatch, ueber: document.documentElement.scrollWidth - w }), w);
      ok(`${w} px: die Kette ist durch, Storage · Siegel · Rendezvous · Panel stehen da`, z.bereit && z.storage && z.siegel && z.rdv && z.ui && z.wiz && z.suffix === 'workflowpdf', z);
      ok(`${w} px: die Mycel-Blase ist in ihrem Platz angedockt, kein fliegendes Widget`, z.blase && !z.widget17, z);
      ok(`${w} px: 04 ist geladen, Modul 03 NICHT (die Suche nach Bedeutung holt es erst auf Knopfdruck)`, z.match && !z.embed, z);
      { const so = await alleSockets(); ok(`${w} px: beim Laden geht KEIN WebSocket auf`, so.length === 0, so); }
      ok(`${w} px: … und kein Abruf nach draußen (nur die eigene Adresse)`, draussen.length === 0, draussen);
      ok(`${w} px: keine Fehler auf der Seite`, fehler.length === 0, fehler);
      if (w === 1280) ok('1280 px: die LEBT-Lampe leuchtet (eigene Identität)', z.alive, z);
      const k = await page.evaluate((w) => {
        const kopf = document.querySelector('.kopf'), name = document.querySelector('.marke-name'), rng = document.createRange(); rng.selectNodeContents(name);
        const t = rng.getBoundingClientRect(), mk = document.querySelector('.marke').getBoundingClientRect();
        const kn = [...document.querySelectorAll('.kopf-rechts > *')].filter(e => e.checkVisibility()).map(e => e.getBoundingClientRect());
        const la = document.getElementById('lampen').getBoundingClientRect();
        return { quer: document.documentElement.scrollWidth > w + 1, kopfQuer: kopf.scrollWidth - kopf.clientWidth, abgeschnitten: name.scrollWidth > name.clientWidth + 1 || t.right > mk.right + 1,
          knoepfe: kn.length, textRechts: t.right, ersterKnopf: Math.min(...kn.map(r => r.left)), lampen: [Math.round(la.left), Math.round(la.top), Math.round(la.right), Math.round(la.bottom)], lampeSicht: document.getElementById('lampen').checkVisibility() };
      }, w);
      ok(`${w} px: die Kopfzeile läuft nicht über, „Workfloh PDF" steht ganz da`, !k.quer && k.kopfQuer <= 0 && !k.abgeschnitten && k.knoepfe >= 4 && k.textRechts <= k.ersterKnopf - 2, k);
      ok(`${w} px: die Lampen sind zu sehen und liegen im Fenster`, k.lampeSicht && k.lampen[0] >= 0 && k.lampen[2] <= w, k);
      if (handy) {
        // Die Lasche darf keinen Knopf verdecken: kein bedienbares Element hat seine Mitte unter ihr.
        const verdeckt = await page.evaluate(() => { const la = document.getElementById('lampen').getBoundingClientRect();
          return [...document.querySelectorAll('main button, main label, main input, main a, main summary')].filter(e => e.checkVisibility()).filter(e => { const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; return x >= la.left && x <= la.right && y >= la.top && y <= la.bottom; }).map(e => e.id || e.textContent.trim().slice(0, 20)); });
        ok(`${w} px: die Lasche mit den Lampen verdeckt keinen Knopf`, verdeckt.length === 0, verdeckt);
        const zu = await page.evaluate(() => document.getElementById('sbkim-siegel-badge')?.checkVisibility());
        ok(`${w} px: zugeklappt steht das Siegel nicht da`, zu === false);
        await page.click('#lampen');
      }
      const s = await page.evaluate(() => { const b = document.getElementById('sbkim-siegel-badge'); if (!b) return null; const r = b.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), sicht: b.checkVisibility(), rechts: r.right };
      });
      ok(`${w} px: das Siegel steht sichtbar da, 28×28`, !!s && s.sicht && s.w === 28 && s.h === 28 && s.rechts <= w, s);
      if (handy) {
        const leg = await page.evaluate(() => [...document.querySelectorAll('[data-lampe-kopie]')].map(e => e.checkVisibility() ? e.textContent : ''));
        ok(`${w} px: … aufgeklappt mit den Namen der Lampen, ohne die Seite zu sprengen`, leg.join('|') === 'lebt|verkehr|fremd' && await page.evaluate((w) => document.documentElement.scrollWidth <= w + 1, w), leg);
        ok(`${w} px: … und sagt es dem Vorleser (aria-expanded)`, (await page.getAttribute('#lampen', 'aria-expanded')) === 'true');
        // „Daneben" ist die leere Bibliotheksfläche, nicht eine feste Koordinate: bei (w/2, 600) lag seit der
        // Bildbeschreibung (2026-10-26) der Knopf „Suche nach Bedeutung einschalten", dessen Dialog die nächsten Tipps verdeckte.
        const leer = await page.$('#dokGitter .leer');
        if (leer) await leer.click({ position: { x: 10, y: 10 } }); else await page.mouse.click(w / 2, 600);
        const zu2 = await page.evaluate(() => document.getElementById('netzleiste').getAttribute('data-offen'));
        ok(`${w} px: ein Tipp daneben klappt die Leiste wieder zu`, zu2 === '0', zu2);
        await page.click('#lampen');
      }
      // Mycel-Blase öffnen: die Netz-Box steht darin (öffentlich ist die Vorgabe)
      await page.evaluate(() => { const b = document.querySelector('[data-sbkim-mycel-platz] button'); if (b) b.click(); });
      await page.waitForTimeout(300);
      const n = await page.evaluate(() => { const p = document.getElementById('sbkim-rdv-panel'), box = document.querySelector('[data-sbkim-netz-box]');
        return { panel: !!p && p.checkVisibility(), box: !!box && box.checkVisibility(), inPanel: !!p && !!box && p.contains(box), gn: !!document.querySelector('#sbkim-rdv-panel [data-sbkim-geraetename]') }; });
      ok(`${w} px: die Mycel-Blase öffnet ihr Fenster mit der Netz-Box`, n.panel && n.box && n.inPanel, n);
      ok(`${w} px: … und dem Feld für den Gerätenamen`, n.gn, n);
      { const so = await alleSockets(); ok(`${w} px: auch nach dem Öffnen kein WebSocket (Verbinden braucht einen eigenen Klick)`, so.length === 0, so); }
      await ctx.close();
    }
  } finally { await browser.close(); srv.close(); }
}

console.log(`\n${gruen} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
