// Gegenprobe zu tests/briefkopf.mjs: jede Sabotage am Baustein muss eine rote Zeile ergeben.
// Arbeitet in einer Wegwerf-Kopie (nur assets/briefkopf.js), der echte Baum bleibt unberührt.
//   node tests/gegenprobe_briefkopf.mjs        NUR_ANKER=1 prüft nur, ob jeder Anker genau einmal vorkommt
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');
const quelle = readFileSync(join(wurzel, 'assets/briefkopf.js'), 'utf8');

const FAELLE = [
  ['„Ort, den …“ wird nicht mehr gelesen', 'const ortDen = ORT_DEN.exec(z);', 'const ortDen = null;'],
  ['zwei unbeschriftete Daten ergeben trotzdem ein Datum', 'kandidaten.size === 1 ?', 'kandidaten.size >= 1 ?'],
  ['Frist-/Geburtszeilen zählen als Briefdatum', 'if (KEIN_BRIEFDATUM.test(z)) return;', ''],
  ['ein Postfach gilt als Absender', 'name: STRASSE.test(teile[0]) ? null : teile[0]', 'name: teile[0]'],
  ['Gleichstand beim Thema wird geraten', 'if (!best || best.n === zweit) return null;', 'if (!best) return null;'],
  ['Stücke einer Zeile werden nicht nach links/rechts geordnet', 'zeile.sort((a, b) => a.x - b.x);', ''],
  ['Sortierung übergeht die Wichtigkeit', 'return w(b) - w(a);', 'return 0;'],
  ['31. Februar gilt als Datum', "return d.getUTCFullYear() === j && d.getUTCMonth() === m - 1 && d.getUTCDate() === t;", 'return true;'],
  ['Nummer ohne Ziffern wird genommen', "if (!/\\d/.test(wert) || wert.replace(/\\D/g, '').length < 3 || wert.length > 32) continue;", 'if (wert.length > 32) continue;'],
  ['Empfänger ohne Abgleich mit der Familie', 'if (bekannt) e.bekannt = bekannt;', ''],
];

let gefangen = 0, durch = 0, tot = 0;
for (const [name, anker, ersatz] of FAELLE) {
  const n = quelle.split(anker).length - 1;
  if (n !== 1) { tot++; console.log(`  ✗ TOTER ANKER (${n}×): ${name}`); continue; }
  if (process.env.NUR_ANKER) { console.log(`  ✓ Anker lebt: ${name}`); continue; }
  if (process.env.NUR_FALL && !name.includes(process.env.NUR_FALL)) continue;
  const tmp = mkdtempSync(join(tmpdir(), 'bk-'));
  mkdirSync(join(tmp, 'assets'));
  writeFileSync(join(tmp, 'assets/briefkopf.js'), quelle.replace(anker, ersatz));
  const r = spawnSync(process.execPath, [join(wurzel, 'tests/briefkopf.mjs')], { env: { ...process.env, BRIEFKOPF_WURZEL: tmp }, encoding: 'utf8' });
  rmSync(tmp, { recursive: true, force: true });
  const rote = (r.stdout || '').split('\n').filter(z => z.includes('✗ ROT'));
  const stolpert = r.status !== 0 && !rote.length;
  if (rote.length) { gefangen++; console.log(`  ✓ gefangen: ${name}\n      ${rote[0].trim()}`); }
  else if (stolpert) { durch++; console.log(`  ✗ STOLPERT (kein Name in der roten Zeile): ${name}\n${(r.stderr || '').split('\n').slice(0, 3).join('\n')}`); }
  else { durch++; console.log(`  ✗ DURCHGERUTSCHT: ${name}`); }
}
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht/gestolpert · ${tot} tote Anker`);
process.exit(durch || tot ? 1 : 0);
