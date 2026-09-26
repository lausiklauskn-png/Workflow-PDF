/* Gegenprobe zu tests/bedeutung.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser).
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_bedeutung.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'das Modell lädt von selbst, ohne Knopf', datei: 'assets/app.js', anker: 'if (EINST.bedeutung) bedeutungStarten();', ersatz: 'bedeutungStarten();', trifft: /NICHT von selbst/ },
  { name: 'der Fortschritt kommt nicht an die Anzeige', datei: 'assets/app.js', anker: 'BED.stand = BD.ladeStand(BED.dateien, (ev && ev.detail) || {});', ersatz: '', trifft: /Ladebalken|Ladeanzeige/ },
  { name: 'Prozent falsch gerechnet (halb)', datei: 'assets/bedeutung.js', anker: 'geladen / gesamt * 100', ersatz: 'geladen / gesamt * 50', trifft: /12,5 %|100 %/ },
  { name: 'Ladeanzeige ohne MB', datei: 'assets/app.js', anker: '+ (st.gesamt ? `<span class="bed-mb"', ersatz: '+ (false ? `<span class="bed-mb"', trifft: /MB von MB/ },
  { name: 'die Schwelle wird übergangen', datei: 'assets/bedeutung.js', anker: 'const gezeigt = alle.filter(r => r.w >= min).slice(0, max);', ersatz: 'const gezeigt = alle.slice(0, max);', trifft: /Schwelle/ },
  { name: 'nicht der BESTE Abschnitt, sondern der erste', datei: 'assets/bedeutung.js', anker: 'if (w > best) { best = w; st = s; }', ersatz: 'if (best === -Infinity) { best = w; st = s; }', trifft: /BESTEN/ },
  { name: 'kein Deckel für lange Dokumente', datei: 'assets/bedeutung.js', anker: 'if (out.length > MAX_STUECKE)', ersatz: 'if (false)', trifft: /gedeckelt/ },
  { name: 'Name und Felder bekommen eine Seite (würden an falscher Stelle markiert)', datei: 'assets/bedeutung.js', anker: 'out.push({ page: null, text: kopf.slice', ersatz: 'out.push({ page: 0, text: kopf.slice', trifft: /ohne Seite/ },
  { name: 'ein Wort-Treffer steht zweimal da', datei: 'assets/app.js', anker: '      if (FUND.has(r.id)) continue;\n', ersatz: '', trifft: /nur EINMAL/ },
  { name: 'der Speicher wird nicht genutzt (jedes Öffnen ordnet alles neu ein)', datei: 'assets/app.js', anker: 'if (alt && alt.sig === sig) { BED.vek.set(d.id, alt); continue; }', ersatz: '', trifft: /aus dem Speicher/ },
  { name: 'neue Bytes behalten die alten Vektoren', datei: 'assets/db.js', anker: ".then(() => tx('vektoren', 'readwrite', st => st.delete(id)))", ersatz: '', trifft: /alten Vektoren/ },
  { name: 'die Wahl wird nicht gemerkt', datei: 'assets/app.js', anker: 'zu(); EINST.bedeutung = true; einstSpeichern(); bedeutungStarten();', ersatz: 'zu(); bedeutungStarten();', trifft: /gemerkt/ },
  { name: 'Ausschalten lässt die Leiste an', datei: 'assets/app.js', anker: "    BED.zustand = 'aus'; BED.ergebnis = null;", ersatz: '    BED.ergebnis = null;', trifft: /^.*Aus: der Abschnitt/ },
  { name: 'ein Fehler wird verschluckt (Leiste geht still auf „aus")', datei: 'assets/app.js', anker: "BED.zustand = 'fehler'; BED.fehler =", ersatz: "BED.zustand = 'aus'; BED.fehler =", trifft: /Fehler: wird gesagt/ },
  { name: '„Nochmal" tut nichts', datei: 'assets/app.js', anker: "b('[data-bed-nochmal]').onclick = () => bedeutungStarten();", ersatz: "b('[data-bed-nochmal]').onclick = () => {};", trifft: /Nochmal/ },
  { name: 'aus der Bedeutung geöffnet wird nichts markiert', datei: 'assets/app.js', anker: 'S.funde = fundMarken(fund); S.fundIdx = S.funde.length ? 0 : -1;', ersatz: 'S.funde = []; S.fundIdx = -1;', trifft: /Editor/ },
  { name: 'die Grenze (Nähe, Höchstzahl, Rangfolge) steht nicht dabei', datei: 'assets/app.js', anker: "const grenze = `", ersatz: "const grenze = '', _grenze = `", trifft: /Grenze steht dabei/ },
  { name: 'Modul 04 ist nicht mehr byte-1:1 aus Sage', datei: 'vendor/sbkim/04_match.js', anker: '"MODUL 04 MATCH bereit, Funktionen:', ersatz: '"MODUL 04 MATCH  bereit, Funktionen:', trifft: /byte-1:1/ },
  { name: 'der Dialog verschweigt, dass etwas aus dem Netz kommt', datei: 'assets/app.js', anker: 'von jsDelivr und Hugging Face. Der Balken', ersatz: 'aus dem Internet. Der Balken', trifft: /VORHER/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gpb-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/bedeutung.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 300000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); const n = s.split(f.anker).length - 1; if (n !== 1) { tot++; console.log('  ☠ TOTER ANKER (' + n + '×): ' + f.name); } }
  console.log(`\n${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
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
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.slice(0, 3).join('\n      ')); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
