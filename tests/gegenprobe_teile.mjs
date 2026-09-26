/* Gegenprobe zu tests/teile.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — und zwar mit einer roten Zeile, die zu ihm passt
   („trifft"). Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_teile.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'Deckel von 40 Seiten fällt weg', datei: 'assets/uebersetzung.js', anker: 'Math.min(TEIL_MAX_SEITEN, nachGroesse, seiten)', ersatz: 'Math.min(nachGroesse, seiten)', trifft: /10 Teile zu 40|90 Seiten ÷ 40/ },
  { name: 'Schrift wird nicht abgezogen', datei: 'assets/uebersetzung.js', anker: 'platz = TEIL_ZIEL_MB * MB - SCHRIFT_MB * MB', ersatz: 'platz = TEIL_ZIEL_MB * MB', trifft: /Rechnung steht Zeile/ },
  { name: 'letzter Teil fehlt', datei: 'assets/uebersetzung.js', anker: 'for (let v = 1; v <= seiten; v += n)', ersatz: 'for (let v = 1; v + n - 1 <= seiten; v += n)', trifft: /der letzte 24|lückenlos/ },
  { name: 'kein neuer Übersetzer nach „generic failures"', datei: 'assets/uebersetzung.js', anker: '        stat.neustarts++;\n', ersatz: '        throw e;\n', trifft: /bricht NICHT mehr ab/ },
  { name: 'Bericht verschweigt den Neustart', datei: 'assets/app.js', anker: 'if (neuN || zerN) zeile.hinweise', ersatz: 'if (false) zeile.hinweise', trifft: /neu gestartet wurde/ },
  { name: 'kurzer Absatz wird bei Längenfehler nicht zerlegt', datei: 'assets/uebersetzung.js', anker: 'const st = saetze(t, fehler ? Math.min(SATZ_MAX, Math.max(40, Math.floor(t.length / 2))) : SATZ_MAX);', ersatz: 'const st = saetze(t, SATZ_MAX);', trifft: /Satz für Satz/ },
  { name: 'Kasten erscheint nicht', datei: 'assets/app.js', anker: 'if (p.noetig) gross.push({ d, p });', ersatz: 'if (false) gross.push({ d, p });', trifft: /Kasten mit Rechnung/ },
  { name: 'Seiten je Teil rechnet nicht neu', datei: 'assets/app.js', anker: '      inp.oninput = neuRechnen;\n', ersatz: '\n', trifft: /rechnet neu/ },
  { name: 'gleiche Teile werden doppelt angelegt', datei: 'assets/app.js', anker: 'if (gleich.every(Boolean)) {', ersatz: 'if (false) {', trifft: /doppelten/ },
  { name: 'jeder Teil beginnt mit Seite 1', datei: 'assets/app.js', anker: '(_, i) => t.von - 1 + i)', ersatz: '(_, i) => i)', trifft: /beginnt mit Seite 31/ },
  { name: 'alle Teile gewählt statt nur Teil 1', datei: 'assets/app.js', anker: '(opt.gewaehlt ? opt.gewaehlt.includes(d.id) :', ersatz: '(false ? 0 :', trifft: /nur Teil 1 gewählt/ },
  { name: '„fertig" obwohl nichts übersetzt', datei: 'assets/app.js', anker: "bericht.some(z => z.ohneErgebnis) ? 'abgebrochen — noch nichts übersetzt' : ", ersatz: '', trifft: /kein falsches/ },
  { name: 'Zeit je Seite wird nicht gemerkt', datei: 'assets/app.js', anker: 'if (r.neu) { EINST.ueMsSeite', ersatz: 'if (false) { EINST.ueMsSeite', trifft: /jetzt gemessen/ },
  { name: 'englische Rechnung fehlt', datei: 'assets/sprache-texte.js', anker: '  "Datei {} MB ÷ {} Seiten = {} KB je Seite (Durchschnitt)": "File', ersatz: '  "Datei-weg": "File', trifft: /en: Aufteilen/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/teile.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
for (const f of FAELLE) {
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz) || (f.extra && !tausche(f.extra.datei, f.extra.anker, f.extra.ersatz))) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ')); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)'); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
