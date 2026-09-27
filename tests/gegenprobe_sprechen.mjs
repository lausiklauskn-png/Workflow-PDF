/* Gegenprobe zu tests/sprechen.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser).
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_sprechen.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 'assets/sprechen.js', A = 'assets/app.js';
const FAELLE = [
  { name: 'keine Zwischenstände bestellt', datei: S, anker: 'rec.interimResults = true;', ersatz: 'rec.interimResults = false;', trifft: /Zwischenstände/ },
  { name: 'Text erscheint erst am Ende', datei: S, anker: 'if (neu && opt.text) opt.text(neu, false);', ersatz: ';', trifft: /SCHON im Feld/ },
  { name: 'die App sucht bei jedem halben Wort', datei: A, anker: 'feld.value = t; if (fertig) {', ersatz: 'feld.value = t; if (true) {', trifft: /noch nicht/ },
  { name: 'keine Striche beim Sprechen', datei: S, anker: 'if (h > 0) { el.className', ersatz: 'if (false) { el.className', trifft: /laufen Striche/ },
  { name: 'Pausen zeigen keine Pünktchen', datei: S, anker: 'if (letzterText && seit < 380)', ersatz: 'if (letzterText)', trifft: /Pünktchen nach/ },
  { name: 'nach der Pause endet sie nicht von selbst', datei: S, anker: 'if (!spricht && seit > STILLE_ENDE) stop();', ersatz: ';', trifft: /endet sie von selbst/ },
  { name: 'der Endstand wird nicht abgegeben', datei: S, anker: 'if (t && !abgeschickt) { abgeschickt = true; opt.text && opt.text(t, true); }', ersatz: ';', trifft: /wird gesucht|sucht/ },
  { name: '„Fertig" tut nichts', datei: S, anker: "balken.querySelector('.wfs-fertig').onclick = stop;", ersatz: ';', trifft: /Fertig/ },
  { name: 'ein Fehler wird verschwiegen', datei: S, anker: "if (e !== 'aborted' && !(e === 'no-speech' && textJetzt())) opt.meldung && opt.meldung(fehlerText(e));", ersatz: ';', trifft: /verweigertes/ },
  { name: 'der Balken bleibt nach dem Ende stehen', datei: S, anker: "balken.hidden = true; k.classList.remove('hoert');", ersatz: "k.classList.remove('hoert');", trifft: /endet sie von selbst|geht weg/ },
  { name: 'ohne Sprache hört sie nie auf', datei: S, anker: 'else if (t - beginn > NICHTS_ENDE) stop();', ersatz: ';', trifft: /ohne jede Sprache/ },
  { name: 'immer Deutsch, auch bei englischer Oberfläche', datei: A, anker: "return MIC_LANG[(WFP.Sprache && WFP.Sprache.lang) || 'de'] || 'de-DE'; },", ersatz: "return 'de-DE'; },", trifft: /hört die Erkennung Englisch/ },
  { name: 'ohne Spracherkennung bleibt der Knopf an', datei: S, anker: "if (!SR) { k.disabled = true; k.title = 'Spracheingabe kann dieser Browser nicht — bitte tippen'; return null; }", ersatz: 'if (!SR) { return null; }', trifft: /ohne Spracherkennung/ },
  { name: 'der Balken steht im Suchfeld statt darunter', datei: A, anker: "nach: $('bibForm'),", ersatz: "nach: $('bibSuche'),", trifft: /unter dem Suchfeld/ },
  { name: 'Balken läuft am Handy über den Rand', datei: S, anker: 'height:28px;overflow:hidden;min-width:0}', ersatz: 'height:28px}', trifft: /Handy/ },
  { name: 'der Knopf zeigt das Zuhören nicht', datei: S, anker: "balken.hidden = false; k.classList.add('hoert');", ersatz: 'balken.hidden = false;', trifft: /Knopf zeigt/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-sprechen-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/sprechen.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
for (const f of FAELLE) {
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ')); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.join('\n      ').slice(0, 400)); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
