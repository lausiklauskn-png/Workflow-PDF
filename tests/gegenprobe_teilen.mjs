/* Gegenprobe zu tests/teilen.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_teilen.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'assets/app.js', C = 'assets/style.css';
const FAELLE = [
  { name: 'kein 📤 in der Kartenleiste', datei: A, anker: '<button data-teilen title="Teilen mit … (E-Mail, Messenger …)">📤</button>', ersatz: '', trifft: /Kartenleiste/ },
  { name: 'Teilen geht immer über einen Dialog', datei: A, anker: 'if (teilbar && !hinweise.length) {', ersatz: 'if (false) {', trifft: /DIREKT/ },
  { name: 'Einträge gehen nicht mit (immer das Original)', datei: A, anker: "const m = nimmEintraege(d) ? 'fest' : 'original';", ersatz: "const m = 'original';", trifft: /FESTE PDF/ },
  { name: 'verweigertes Teilen endet still', datei: A, anker: "catch (e) { if (e && e.name === 'AbortError') return; /* verweigert", ersatz: 'catch (e) { return; /* verweigert', trifft: /Jetzt teilen/ },
  { name: 'Editor speichert nicht vor dem Teilen', datei: A, anker: 'if (S.doc && ids.includes(S.doc.id)) await speichernJetzt();', ersatz: ';', trifft: /gespeichert, bevor/ },
  { name: 'Editor-Knopf tut nichts', datei: A, anker: "$('edTeilen').onclick = () => teilenDocs([S.doc.id]);", ersatz: ';', trifft: /im Editor teilt/ },
  { name: 'Kästchen oben wählt nicht', datei: A, anker: "el.querySelector('[data-haken]').onclick = () => { WAHL_AN = true; wahlUmschalten(id); };", ersatz: "el.querySelector('[data-haken]').onclick = () => {};", trifft: /Kästchen oben antippen/ },
  { name: 'im Auswahl-Modus öffnet ein Tipp trotzdem', datei: A, anker: 'const auf = () => { if (WAHL_AN) wahlUmschalten(id); else oeffneDok(id, fund); };', ersatz: 'const auf = () => oeffneDok(id, fund);', trifft: /wählt ein Tipp/ },
  { name: 'Leiste teilt nur die erste Auswahl', datei: A, anker: "q('[data-wahl-teilen]').onclick = () => teilenDocs([...WAHL]);", ersatz: "q('[data-wahl-teilen]').onclick = () => teilenDocs([...WAHL].slice(0, 1));", trifft: /ALLE gewählten/ },
  { name: 'überstrichene Karten kommen nicht dazu', datei: A, anker: 'WAHL.add(karte.dataset.id); wahlMarken(); wahlLeiste(); ziehGeist();', ersatz: ';', trifft: /überstrichene|zweite Karte/ },
  { name: 'überstrichene Karten kommen ohne Verweilen dazu', datei: A, anker: 'const VERWEIL_MS = 250;', ersatz: 'const VERWEIL_MS = 0;', trifft: /HINWEG|noch keine Karte/ },
  // Zwei Riegel decken einander (die alte Uhr wird gestoppt UND prüft beim Feuern, ob der Zeiger noch da ist) — EIN Fall nimmt beide
  { name: 'Verweilen wird beim Weitergleiten nicht abgebrochen', datei: A, anker: "clearTimeout(ZG.verweil); ZG.kand = karte;\n      if (karte && !WAHL.has(karte.dataset.id)) ZG.verweil = setTimeout(() => {\n        if (!ZG || ZG.kand !== karte) return;", ersatz: "ZG.kand = karte;\n      if (karte && !WAHL.has(karte.dataset.id)) ZG.verweil = setTimeout(() => {\n        if (!ZG) return;", trifft: /HINWEG/ },
  { name: 'Loslassen auf dem Ordner verschiebt nicht', datei: A, anker: "else await inOrdner(ids, ziel.dataset.o === 'ohne' ? null : ziel.dataset.o);", ersatz: ';', trifft: /loslassen auf dem Ordner/i },
  { name: '„Alle" gilt als Ordner-Ziel', datei: A, anker: "(chip.dataset.o && chip.dataset.o !== 'alle')", ersatz: 'chip.dataset.o', trifft: /„Alle"/ },
  { name: 'der Finger rollt beim Ziehen die Seite', datei: A, anker: "document.addEventListener('touchmove', e => { if (ZG && ZG.aktiv && e.cancelable) e.preventDefault(); }, { passive: false });", ersatz: ';', trifft: /rollt dabei/ },
  { name: 'schon ein kurzer Druck wählt', datei: A, anker: 'const LANGDRUCK_MS = 450,', ersatz: 'const LANGDRUCK_MS = 30,', trifft: /kurzer Druck/ },
  { name: 'Rollen mit dem Finger startet ein Ziehen', datei: A, anker: 'if (ZG.maus) ziehStart(); else { ziehAus(); return; }', ersatz: 'ziehStart();', trifft: /sofort bewegt/ },
  { name: 'der Klick nach dem langen Druck wählt wieder ab', datei: A, anker: "if (klickSperre && e.target.closest('#dokGitter,.ordner-leiste')) {", ersatz: 'if (false) {', trifft: /bleibt gewählt/ },
  { name: 'das Schattenbild bleibt liegen', datei: A, anker: 'if (ZG.geist) ZG.geist.remove();', ersatz: ';', trifft: /kein Schatten/ },
  { name: 'am Tablet ist das Kästchen unsichtbar', datei: C, anker: '@media (hover:none){.dok-haken{opacity:.75}}', ersatz: '', trifft: /Kästchen oben sichtbar/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-teilen-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/teilen.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
for (const f of FAELLE) {
  if (process.env.NUR_FALL && !f.name.includes(process.env.NUR_FALL)) continue;
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
