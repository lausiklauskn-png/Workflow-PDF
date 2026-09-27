/* Gegenprobe zu tests/schieber.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_schieber.mjs
   BENANNTE GRENZE: die Mindestbreite des Griffs (44 px) hat keinen Fall — bei den gemessenen Leisten
   ist der Griff ohnehin breiter, eine Sabotage daran änderte nichts, was die Probe sieht. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 'assets/schieber.js', A = 'assets/app.js';
const FAELLE = [
  { name: 'der Griff hat keine Rillen', datei: S, anker: "<div class=\"wfsch-griff\"><i></i><i></i><i></i></div>", ersatz: '<div class="wfsch-griff"></div>', trifft: /Viereck mit Rillen/ },
  { name: 'die Browser-Leiste bleibt zusätzlich stehen', datei: S, anker: '.wfsch-leiste{scrollbar-width:none}', ersatz: '.wfsch-leiste{}', trifft: /EINE Anzeige/ },
  { name: 'die Schiene schrumpft im Flex-Fuß auf 0 px (Befund beim Bau)', datei: S, anker: 'flex:0 0 100%;width:100%;', ersatz: '', trifft: /SIEHT/ },
  { name: 'die Schiene bleibt auch ohne Überlauf stehen', datei: S, anker: 'if (bahn.hidden === ueber) bahn.hidden = !ueber;', ersatz: 'if (bahn.hidden) bahn.hidden = false;', trifft: /KEIN Schieber/ },
  { name: 'der Griff läuft beim Wischen nicht mit', datei: S, anker: "leiste.addEventListener('scroll', zeichne, { passive: true });", ersatz: ';', trifft: /läuft der Griff mit/ },
  { name: 'Ziehen bewegt nichts', datei: S, anker: 'rolleAuf(e.clientX - bahn.getBoundingClientRect().left - fass);', ersatz: ';', trifft: /bis ans Ende/ },
  { name: 'Tippen auf die Schiene springt nicht', datei: S, anker: 'rolleAuf(x - fass);', ersatz: ';', trifft: /springt an den Anfang/ },
  { name: 'ein neu gezeichneter Fuß bekommt keinen Schieber', datei: S, anker: "if (typeof MutationObserver === 'function') new MutationObserver(suche).observe(wurzel, { childList: true, subtree: true });", ersatz: ';', trifft: /SIEHT|Neuzeichnen/ },
  { name: 'die Ordner-Leiste bekommt keinen Schieber', datei: A, anker: "WFSchieber.an($('ordnerLeiste')); ", ersatz: '', trifft: /Ordner-Knöpfen/ },
  { name: 'Größenänderung vor dem Zurück wirft wieder (Befund beim Bau)', datei: A, anker: '_rz = setTimeout(() => { if (!S.doc) return;', ersatz: '_rz = setTimeout(() => {', trifft: /keine Fehler/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-schieber-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/schieber.mjs')], { env: { ...process.env, WF_WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
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
