/* Gegenprobe zu tests/netz.mjs („Im Netz antworten“, Klaus 2026-10-31): baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft"). NUR_ANKER=1 prüft nur die Anker
   (ohne Browser), NUR_FALL="…" fährt nur passende Fälle. Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_netz.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const N = 'assets/netz.js';
const FAELLE = [
  { name: 'Korpus-Vektoren als Liste statt Float32Array', datei: N,
    anker: "const vek = v => (v instanceof Float32Array ? v : (v && typeof v.length === 'number' ? Float32Array.from(v) : null));",
    ersatz: "const vek = v => (v && typeof v.length === 'number' ? Array.from(v) : null);", trifft: /Float32Array/ },
  { name: 'Filter prüft nicht je Frage, ob ein eigenes Netz steht', datei: N,
    anker: "      if (typeof istEigen !== 'function' || !istEigen()) return [];\n", ersatz: '', trifft: /A4/ },
  { name: 'Briefende fehlt (nur die ersten Abschnitte)', datei: N,
    anker: 'return [...a.slice(0, max - e), ...a.slice(a.length - e)];', ersatz: 'return a.slice(0, max);', trifft: /Briefende/ },
  { name: 'Korpus nicht live (feste Liste nach enableAnswering)', datei: N,
    anker: '      m.setLocalCorpus(korpus);\n      return { ok: true', ersatz: '      return { ok: true', trifft: /A3/ },
  { name: 'öffentlich mit Seitentext', datei: N,
    anker: '    if (lauf.mitAusschnitt) {\n      const k = korpusMitAusschnitt', ersatz: '    if (true) {\n      const k = korpusMitAusschnitt', trifft: /A1/ },
  { name: 'Abschnitt fehlt in den Einstellungen', datei: 'assets/app.js',
    anker: "      ${window.WFPNetz ? WFPNetz.abschnittHtml() : ''}\n", ersatz: '', trifft: /B Abschnitt/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-netz-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/netz.mjs')], { env: { ...process.env, WF_WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + (basis.stdout || '').slice(-1500) + '\n' + (basis.stderr || '').slice(-800)); process.exit(2); }
for (const f of FAELLE) {
  if (nur && !f.name.includes(nur)) continue;
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name + (r.status ? '  (Status ' + r.status + ')\n' + (r.stderr || '').slice(-400) : '')); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ').slice(0, 600)); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.join('\n      ').slice(0, 500)); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
