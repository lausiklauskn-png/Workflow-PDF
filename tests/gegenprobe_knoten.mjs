/* Gegenprobe zu tests/knoten.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_knoten.mjs
   BENANNTE GRENZE: kein Fall gegen den Beitritt zu einem eigenen Netz und gegen ein echtes Relais —
   beides misst die Probe nicht (kein Relais im Behälter, kein Netz-Code im Depot). */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const I = 'assets/sbkim-init.js', H = 'index.html', C = 'assets/style.css';
const FAELLE = [
  { name: 'ein Kanon-Modul wird hier abgewandelt', datei: 'sbkim/15_membran.js', anker: ' * SBKIM — Modul 15 — Membran', ersatz: ' * SBKIM — Modul 15 — hier abgewandelt', trifft: /15_membran\.js ist byte-1:1/ },
  { name: 'die Schublade fehlt im Kopf', datei: H, anker: '<script>window.SBKIM_DB_SUFFIX = "workflowpdf";</script>', ersatz: '', trifft: /Schublade/ },
  { name: 'ein Komma zwischen zwei Kettengliedern fehlt', datei: I, anker: '["",       "sbkim/23_rendezvous.js"],', ersatz: '["",       "sbkim/23_rendezvous.js"]', trifft: /Komma/ },
  { name: 'jede fremde Herkunft darf reden', datei: I, anker: 'allowedOrigins: []', ersatz: 'allowedOrigins: ["*"]', trifft: /allowedOrigins leer/ },
  { name: 'das Band im Wappen bleibt leer', datei: I, anker: 'ribbonText: "WORKFLOH PDF"', ersatz: 'ribbonText: ""', trifft: /Band im Wappen/ },
  { name: 'ein Modul landet im Installations-Vorrat', datei: 'sw.js', anker: "'./assets/siegel-inhalt.js?v=1',", ersatz: "'./assets/siegel-inhalt.js?v=1', './sbkim/23_rendezvous.js',", trifft: /Installations-Vorrat/ },
  { name: 'beim Laden geht ein WebSocket auf', datei: I, anker: 'window.WFP_KNOTEN_BEREIT = true;', ersatz: 'try { new WebSocket("wss://relay.family-projekt.de"); } catch (_e) {} window.WFP_KNOTEN_BEREIT = true;', trifft: /KEIN WebSocket/ },
  { name: 'die Leiste bleibt am Handy in der Kopfzeile', datei: C, anker: '@media (max-width:600px){', ersatz: '@media (max-width:200px){', trifft: /Kopfzeile läuft nicht über/ },
  { name: 'ein Tipp daneben klappt nicht zu', datei: I, anker: '      setze(false);\n', ersatz: '', trifft: /Tipp daneben/ },
  { name: 'der Gerätename wird nicht eingehängt', datei: I, anker: '      geraetenameFeldEinhaengen();\n', ersatz: '', trifft: /Gerätenamen/ },
  { name: 'die LEBT-Lampe geht nie an', datei: I, anker: 'lampe("lamp-alive", "on")', ersatz: 'lampe("lamp-alive", "")', trifft: /LEBT-Lampe/ },
  { name: 'Modul 03 lädt wieder von selbst', datei: I, anker: '    ["",       "vendor/sbkim/04_match.js?v=1"],', ersatz: '    ["",       "vendor/sbkim/03_embedding.js?v=2"],\n    ["",       "vendor/sbkim/04_match.js?v=1"],', trifft: /Modul 03/ },
  { name: 'das Siegel hat keine Maße (0×0)', datei: C, anker: '#sbkim-siegel-badge{width:28px;height:28px;', ersatz: '#sbkim-siegel-badge{', trifft: /28×28/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-knoten-'));
const kopieren = () => {
  fs.rmSync(kopie, { recursive: true, force: true }); fs.mkdirSync(kopie);
  for (const e of fs.readdirSync(WURZEL)) if (!['node_modules', '.git'].includes(e)) fs.cpSync(path.join(WURZEL, e), path.join(kopie, e), { recursive: true });
  fs.symlinkSync(path.join(WURZEL, 'node_modules'), path.join(kopie, 'node_modules'));
};
const tausche = (datei, anker, ersatz) => {
  const f = path.join(kopie, datei), s = fs.readFileSync(f, 'utf8');
  if (s.split(anker).length !== 2) return false;
  fs.writeFileSync(f, s.replace(anker, () => ersatz)); return true;
};
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/knoten.mjs')], { env: { ...process.env, WURZEL: kopie, SAGE_KLON: '/gibt-es-nicht' }, encoding: 'utf8', timeout: 300000 });

kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + (basis.stdout || '').slice(-1500)); process.exit(2); }
for (const f of FAELLE) {
  if (nur && !f.name.includes(nur)) continue;
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (r.status !== 0 && !rote.length) rote.push('✗ ROT (Absturz): ' + (r.stderr || '').split('\n').find(Boolean));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ').slice(0, 600)); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.slice(0, 3).join('\n      ').slice(0, 400)); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
