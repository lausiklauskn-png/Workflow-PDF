/* Gegenprobe zu tests/kreis.mjs (Kreis-Symbole Ⓐ ① ❷, Klaus 2026-09-26): baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_kreis.mjs  ·  NUR_FALL=<Teil des Namens> */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const U = 'assets/uebersetzung.js';
const FAELLE = [
  { name: 'Symbol am Zeilenanfang beginnt keinen Absatz', datei: U, anker: 'AUFZ.test(z.s) || KREIS_ANFANG.test(z.s) ?', ersatz: 'AUFZ.test(z.s) ?', trifft: /drei eigene Absätze/ },
  { name: 'Ⓐ als eigenes Textstück wird übergangen', datei: U, anker: ' && !KREIS.test(it.str)) continue;', ersatz: ') continue;', trifft: /eigenes Textstück/ },
  { name: 'eingerückte Zeile nach Satzende verschmilzt', datei: U, anker: "        if (/[.!?]\\s*$/.test(letzte.s) && z.x - letzte.x > z.fh * 1.2) return false;\n", ersatz: '', trifft: /Voltage Between/ },
  { name: 'Symbole kommen nach der Übersetzung nicht zurück', datei: U, anker: '.map((t, k) => kreisZurueck(texte[k], zeichenNormal(t)))', ersatz: '.map(zeichenNormal)', trifft: /Symbole wieder da/ },
  { name: 'Kreis-Zeichen wird zu „?"', datei: U, anker: 'if (KREIS.test(ch)) { out += ch; continue; } ', ersatz: '', trifft: /zu „\?"|gezeichneter Kreis/ },
  { name: 'kein Kreis gezeichnet', datei: U, anker: 'page.drawCircle({', ersatz: '(() => {})({', trifft: /gezeichneter Kreis/ },
  { name: 'Text wird über das Symbol geschrieben', datei: U, anker: '              dx += bw;\n', ersatz: '', trifft: /läuft hinter dem Symbol/ },
  { name: 'Symbol wird mitten in ein Wort gesetzt', datei: U, anker: "'(^|[^\\\\p{L}\\\\p{N}])' + inh", ersatz: "'()' + inh", trifft: /mitten in einem Wort/ },
  { name: 'Negativ-Ziffern (➋) falsch gelesen', datei: U, anker: '    if (c >= 0x2780 && c <= 0x2789) return String(c - 0x277F);\n', ersatz: '', trifft: /Inhalt der Kreise/ },
  { name: 'Ring-Messer zählt alles als Kreis', datei: 'tests/kreis.mjs', anker: "if ([-0.4, 0, 0.4].some(d => dunkel(", ersatz: "if (true || [-0.4, 0, 0.4].some(d => dunkel(", trifft: /Selbst-Riegel/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gpk-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/kreis.mjs')], { encoding: 'utf8', timeout: 300000 });

const faelle = FAELLE.filter(f => !process.env.NUR_FALL || f.name.includes(process.env.NUR_FALL));
if (process.env.NUR_ANKER) {
  for (const f of faelle) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${faelle.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
for (const f of faelle) {
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name + (r.status ? ' (exit ' + r.status + ')\n' + (r.stderr || '').slice(-400) : '')); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ').slice(0, 900)); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)'); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
