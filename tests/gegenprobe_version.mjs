/* Gegenprobe zu tests/version.mjs (Prüfung beim Einlesen, Klaus 2026-10-01): baut in einer
   WEGWERF-KOPIE je einen Fehler ein. Jeder Fall muss die Probe umwerfen — mit einer roten Zeile,
   die zu ihm passt („trifft"). NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser).
   NUR_FALL="…" fährt nur passende Fälle. Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_eingang.mjs
   BENANNTE GRENZEN: die geschärfte Wartebedingung in tests/bedeutung.mjs und der ffmpeg-Rückfall in
   tests/video.mjs haben keinen Fall — eine Sabotage dort macht die Probe flatterhaft bzw. „nicht
   lauffähig", nicht rot. Das Austragen aus PRUEF.laufend erst NACH dem Befund (Befund unter Last in
   der vollen Kette) hat ebenfalls keinen: einzeln läuft die Probe auch mit der alten Reihenfolge grün. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'assets/app.js';
const FAELLE = [
  { name: 'package.json bleibt bei der alten Nummer', datei: 'package.json', anker: '"version": "1.1.10"', ersatz: '"version": "1.0.0"', trifft: /package\.json/ },
  { name: 'Cache erhöht, Version vergessen', datei: 'sw.js', anker: "const CACHE_VERSION = 'workfloh-pdf-v115';", ersatz: "const CACHE_VERSION = 'workfloh-pdf-v116';", trifft: /CACHE_VERSION/ },
  { name: 'der Fuß zeigt keine Version', datei: A, anker: "const f = $('versionFuss'); if (f) { f.textContent = v ? z : ''; f.hidden = !v; }", ersatz: ';', trifft: /Fuß/ },
  { name: 'die Einstellungen zeigen keine Version', datei: A, anker: '<p class="hinweis einst-version" data-einst-version>Version ${h(versionNummer())}</p>', ersatz: '', trifft: /Einstellungen|Probe lief durch/ },
  { name: 'die Pro-Nummer wird nicht übernommen', datei: A, anker: "document.addEventListener('wfp-version', versionZeigen);", ersatz: '', trifft: /Pro-Weg/ },
  { name: 'eine falsch geformte Nummer wird angezeigt', datei: A, anker: "return m && /^\\d+\\.\\d+\\.\\d+$/.test(m.content) ? m.content : '';", ersatz: "return m ? m.content : '';", trifft: /falsch geformte/ },
  { name: 'die russische Übersetzung fehlt', datei: 'assets/sprache-texte.js', anker: '  "Version {}": "Версия {1}",\n', ersatz: '', trifft: /Fuß auf RU/ },
  // Update-Fähnchen (Klaus 2026-11-13)
  { name: 'FAHNE: version.json bleibt bei der alten Fassung', datei: 'version.json', anker: '"version": "1.1.10"', ersatz: '"version": "1.1.9"', trifft: /version\.json nennt/ },
  { name: 'FAHNE: der Worker liefert version.json aus dem Vorrat', datei: 'sw.js', anker: "  if (new URL(r.url).pathname.endsWith('/version.json')) return;", ersatz: '  ;', trifft: /Worker bedient version\.json/ },
  { name: 'FAHNE: beim Start wird nicht gefragt', datei: A, anker: 'setTimeout(neueFassungPruefen, 1500);', ersatz: '', trifft: /erscheint von selbst/ },
  { name: 'FAHNE: jedes Zurückholen fragt neu', datei: A, anker: "document.visibilityState === 'hidden' || Date.now() - FASSUNG.zuletzt < 3600000", ersatz: "document.visibilityState === 'hidden'", trifft: /höchstens einmal je Stunde/ },
  { name: 'FAHNE: auch dieselbe Fassung zeigt ein Fähnchen', datei: A, anker: 'vorratZahl(j && j.cache) > ich', ersatz: 'vorratZahl(j && j.cache) >= ich', trifft: /dieselbe Fassung/ },
  { name: 'FAHNE: eine falsch geformte Nummer wird gezeigt', datei: A, anker: " && /^\\d+\\.\\d+\\.\\d+$/.test(String(j.version || '')) ? j.version : '';", ersatz: " ? j.version : '';", trifft: /falsch geformte Antwort/ },
  { name: 'FAHNE: der Tipp tut nichts', datei: A, anker: "if (!b.onclick) b.onclick = () => { const n = $('btnNeu'); if (n) n.click(); };", ersatz: '', trifft: /Tipp geht den vorhandenen Weg/ },
  { name: 'FAHNE: in den Einstellungen fehlt es', datei: A, anker: 'versionZeigen(); fahneZeigen(d);', ersatz: 'versionZeigen();', trifft: /auch in den Einstellungen/ },
  { name: 'FAHNE: die englische Übersetzung fehlt', datei: 'assets/sprache-texte.js', anker: '  "Update {}": "Update {1}",\n', ersatz: '', trifft: /Fähnchen auf EN/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-version-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/version.mjs')], { env: { ...process.env, WF_WURZEL: kopie, WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts. Status ' + basis.status + ', Signal ' + basis.signal + (basis.error ? ', ' + basis.error.message : '') + '\n' + (basis.stdout || '').slice(-1500) + '\n' + (basis.stderr || '').slice(-800)); process.exit(2); }
for (const f of FAELLE) {
  if (nur && !f.name.includes(nur)) continue;
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ').slice(0, 600)); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.join('\n      ').slice(0, 400)); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
