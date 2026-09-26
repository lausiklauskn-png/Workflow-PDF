/* Gegenprobe zu tests/ordner.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — und zwar mit einer roten Zeile, die zu ihm passt
   („trifft"). Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_ordner.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'Namen werden nicht natürlich verglichen (Teil 10 vor Teil 2)', datei: 'assets/app.js', anker: "localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' })", ersatz: "localeCompare(b.name, 'de', { sensitivity: 'base' })", trifft: /nach Name: Teil 1/ },
  { name: 'Einlesen ordnet nicht natürlich', datei: 'assets/app.js', anker: "b.webkitRelativePath || b.name, 'de', { numeric: true }));", ersatz: "b.webkitRelativePath || b.name, 'de'));", trifft: /Einlesen: Teil 1/ },
  { name: 'Seitenzahl wird nicht sortiert', datei: 'assets/app.js', anker: "if (art === 'seiten') return", ersatz: "if (false) return", trifft: /nach Seitenzahl/ },
  { name: 'Dateigröße wird nicht sortiert', datei: 'assets/app.js', anker: '(_groesse.get(b.id) || 0) - (_groesse.get(a.id) || 0) || namensVergleich(a, b)', ersatz: 'namensVergleich(a, b)', trifft: /nach Dateigröße/ },
  { name: 'Größe steht nicht an der Karte', datei: 'assets/app.js', anker: "EINST.sortierung === 'groesse' && _groesse.has(d.id)", ersatz: 'false', trifft: /Größe steht an jeder Karte/ },
  { name: 'Sortier-Wahl wird nicht gespeichert', datei: 'assets/app.js', anker: 'EINST.sortierung = e.target.value; einstSpeichern();', ersatz: 'EINST.sortierung = e.target.value;', trifft: /Neuladen/ },
  { name: 'Knopf „Ordner ausgeben" fehlt', datei: 'assets/app.js', anker: 'o && S.docs.some(d => d.folderId === o.id) ? `<button class="knopf" data-ausgabe>', ersatz: 'false ? `<button class="knopf" data-ausgabe>', trifft: /steht beim gewählten Ordner/ },
  { name: 'Ausgabe folgt nicht der Sortierung', datei: 'assets/app.js', anker: 'const docs = sortiere(S.docs.filter(d => d.folderId === o.id));', ersatz: 'const docs = S.docs.filter(d => d.folderId === o.id);', trifft: /Reihenfolge der Bibliothek|Reihenfolge Teil 1|beginnt mit Teil 10/ },
  { name: '„Original" wird trotzdem neu gebaut', datei: 'assets/app.js', anker: "if (m === 'original') return { bytes, hinweise: [] };", ersatz: '', trifft: /eingelesenen Bytes/ },
  { name: 'Zusammenfügen nimmt nur die erste Seite je Dokument', datei: 'assets/app.js', anker: '(await eins.copyPages(q, q.getPageIndices())).forEach(p => eins.addPage(p));', ersatz: '(await eins.copyPages(q, [0])).forEach(p => eins.addPage(p));', trifft: /6 Seiten/ },
  { name: 'ZIP: falsche Prüfsumme', datei: 'assets/zip.js', anker: 'crc = crc32(daten);', ersatz: 'crc = 0;', trifft: /Prüfsumme stimmt/ },
  { name: 'ZIP: Namen ohne UTF-8-Marke', datei: 'assets/zip.js', anker: 'k.setUint16(6, 0x0800, true);', ersatz: 'k.setUint16(6, 0, true);', trifft: /UTF-8-Marke/ },
  { name: 'ZIP: Verzeichnis zeigt an die falsche Stelle', datei: 'assets/zip.js', anker: 'e.setUint32(16, pos, true);', ersatz: 'e.setUint32(16, 0, true);', trifft: /ZIP ist gültig/ },
  { name: 'ZIP: gleiche Namen überschreiben einander', datei: 'assets/zip.js', anker: 'if (!z) return n;', ersatz: 'return n;', trifft: /unterschieden/ }
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/ordner.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

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
