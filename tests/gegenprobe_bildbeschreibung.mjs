/* Gegenprobe zu tests/bildbeschreibung.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur Fälle mit diesem Wortanfang.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_bildbeschreibung.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'eigene Worte werden nicht gesucht', datei: 'assets/app.js', anker: "fields: (d.fields || []).concat(bildFelder(d)) }", ersatz: "fields: d.fields }", trifft: /eigenen Worten/ },
  { name: 'der Schalter tut nichts', datei: 'assets/app.js', anker: ' && imZeitraum(d) && bildFilter(d));', ersatz: ' && imZeitraum(d));', trifft: /Schalter an/ },
  { name: 'das Feld steht auch am PDF', datei: 'assets/bildbeschreibung.js', anker: "const d = A.S.docs.find(x => x.id === el.dataset.id); if (!istBild(d)) return;", ersatz: "const d = A.S.docs.find(x => x.id === el.dataset.id); if (!d) return;", trifft: /das PDF nicht/ },
  { name: 'das Modell lädt von selbst, ohne Wahl', datei: 'assets/bildbeschreibung.js', anker: 'function start() { if (A && A.EINST.bild) starten(); }', ersatz: 'function start() { starten(); }', trifft: /nichts ins Netz|von selbst/ },
  { name: 'eigene Worte werden nicht gespeichert', datei: 'assets/bildbeschreibung.js', anker: "    await A.DB.put('docs', d);\n    // Karten und Editor", ersatz: "    // Karten und Editor", trifft: /gespeichert|Neuladen/ },
  { name: 'ⓘ wird nicht gemerkt', datei: 'assets/bildbeschreibung.js', anker: 'i.onclick = () => { const offen = t.hidden; zeigen(offen); hilfeMerken(offen); };', ersatz: 'i.onclick = () => { const offen = t.hidden; zeigen(offen); };', trifft: /gemerkt/ },
  { name: 'der Dialog verschweigt die gemessenen Zahlen', datei: 'assets/bildbeschreibung.js', anker: 'Download ${nm(String(MESSUNG.downloadMB))} MB', ersatz: 'Download', trifft: /GEMESSENEN/ },
  { name: 'die Fundzeile nennt die Bildbeschreibung nicht', datei: 'assets/app.js', anker: 'const wo = bild ? WFP.Bild.fundWo(f) :', ersatz: 'const wo = false ? WFP.Bild.fundWo(f) :', trifft: /Fundzeile/ },
  { name: 'ein neues Foto wird nicht beschrieben', datei: 'assets/app.js', anker: '    if (window.WFP && WFP.Bild) WFP.Bild.nachziehen();', ersatz: '', trifft: /nachgezogen/ },
  { name: 'ein Foto wird nach dem Neuladen noch einmal beschrieben', datei: 'assets/bildbeschreibung.js', anker: "const modellAktuell = d => !!(d.bild && d.bild.modell && d.bild.sig === sig(d));", ersatz: "const modellAktuell = d => false;", trifft: /NICHTS noch einmal/ },
  { name: 'ein Emoji schleicht sich ein', datei: 'assets/bildbeschreibung.js', anker: '<span>Fotos beschreiben lassen</span>', ersatz: '<span>📷 Fotos beschreiben lassen</span>', trifft: /Emoji/ },
  // Der Riegel vor der Schleife und der in alleBeschreiben decken einander — sabotiert wird deshalb das Abbrechen selbst (der Lauf bleibt der gültige).
  { name: 'Abbrechen lässt das Modell weiterlaufen und beschreiben', datei: 'assets/bildbeschreibung.js', anker: "B.zustand = 'aus'; B.fehler = ''; B.beschreibt = null; B._lauf = null; B.pipe = null;", ersatz: "B.zustand = 'aus'; B.fehler = ''; B.beschreibt = null; B.pipe = null;", trifft: /nach dem Ende des Ladens|Abbrechen/ },
  { name: 'ein Fehler wird verschluckt (Leiste geht auf „aus")', datei: 'assets/bildbeschreibung.js', anker: "B.zustand = 'fehler'; B.fehler =", ersatz: "B.zustand = 'aus'; B.fehler =", trifft: /Fehler: wird gesagt/ },
  { name: 'das Modul fehlt im Vorrat des Workers', datei: 'sw.js', anker: " './assets/bildbeschreibung.js?v=1',", ersatz: '', trifft: /Vorrat/ },
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gpbild-'));
const kopieren = () => {
  fs.rmSync(kopie, { recursive: true, force: true }); fs.mkdirSync(kopie);
  for (const e of fs.readdirSync(WURZEL)) if (!['node_modules', '.git'].includes(e)) fs.cpSync(path.join(WURZEL, e), path.join(kopie, e), { recursive: true });
  if (fs.existsSync(path.join(WURZEL, 'node_modules'))) fs.symlinkSync(path.join(WURZEL, 'node_modules'), path.join(kopie, 'node_modules'));
};
const tausche = (datei, anker, ersatz) => {
  const f = path.join(kopie, datei), s = fs.readFileSync(f, 'utf8');
  if (s.split(anker).length !== 2) return false;
  fs.writeFileSync(f, s.replace(anker, () => ersatz)); return true;
};
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/bildbeschreibung.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 400000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); const n = s.split(f.anker).length - 1; if (n !== 1) { tot++; console.log('  ☠ TOTER ANKER (' + n + '×): ' + f.name); } }
  console.log(`\n${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
for (const f of FAELLE) {
  if (process.env.NUR_FALL && !f.name.startsWith(process.env.NUR_FALL)) continue;
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf();
  const rote = (r.stdout || '').split('\n').filter(z => /✗ ROT/.test(z));
  if (r.status === 0 && !rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name); continue; }
  if (rote.some(z => f.trifft.test(z))) { gefangen++; console.log('  ✓ gefangen: ' + f.name + '\n      ' + rote.find(z => f.trifft.test(z)).trim()); }
  else { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + (rote[0] || (r.stderr || '').split('\n').slice(0, 3).join(' | ')).trim()); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
