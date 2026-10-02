/* Gegenprobe zu tests/eingang.mjs (Prüfung beim Einlesen, Klaus 2026-10-01): baut in einer
   WEGWERF-KOPIE je einen Fehler ein. Jeder Fall muss die Probe umwerfen — mit einer roten Zeile,
   die zu ihm passt („trifft"). NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser).
   NUR_FALL="…" fährt nur passende Fälle. Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_eingang.mjs
   BENANNTE GRENZEN: die geschärfte Wartebedingung in tests/bedeutung.mjs und der ffmpeg-Rückfall in
   tests/video.mjs haben keinen Fall — eine Sabotage dort macht die Probe flatterhaft bzw. „nicht
   lauffähig", nicht rot. Das Austragen aus PRUEF.laufend erst NACH dem Befund (Befund unter Last in
   der vollen Kette) hat ebenfalls keinen: einzeln läuft die Probe auch mit der alten Reihenfolge grün. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = 'assets/eingang.js', A = 'assets/app.js';
const FAELLE = [
  { name: 'unsichtbarer Text im PDF wird nicht mehr gemeldet', datei: E, anker: "'PDF-VERSTECKTER-TEXT', 'VERSTECKTER-TEXT',", ersatz: "'VERSTECKTER-TEXT',", trifft: /0D \(weißer|PDF: unsichtbarer/ },
  { name: 'die markierte Kopie fällt weg', datei: E, anker: 'markiert: m, art: r.art, zeit', ersatz: 'markiert: null, art: r.art, zeit', trifft: /markiert/ },
  { name: 'geprüft wird das daraus gebaute PDF statt des Fotos', datei: A, anker: "original ? original.bytes : bytes);", ersatz: "bytes);", trifft: /Foto|Bild/ },
  { name: 'ein „sauber" aus einer fremden Arbeitsstand-Datei wird geglaubt', datei: A, anker: '        delete d.pruefung;                                  // ein Befund', ersatz: '        // ein Befund', trifft: /fremde[nm] Arbeitsstand/ },
  { name: 'der offene Editor bekommt den Befund nicht', datei: A, anker: 'if (S.doc && S.doc.id === id) S.doc.pruefung = r;', ersatz: ';', trifft: /Editor/ },
  { name: 'der Dialog öffnet sich nicht mehr von selbst', datei: A, anker: "if (r.stand === 'warnung' && !document.querySelector('.dlg')) pruefDialog(id);", ersatz: ';', trifft: /von selbst/ },
  { name: 'die Karte bekommt nach der Prüfung keine Marke', datei: A, anker: "      markeErneuern(id);\n      // Ein Fenster genügt", ersatz: "      // Ein Fenster genügt", trifft: /Marke/ },
  { name: 'der Satz „Nichts wurde entfernt" fehlt', datei: A, anker: '<p class="hinweis" data-pruef-original>Nichts wurde entfernt:', ersatz: '<p class="hinweis">Nichts wurde entfernt:', trifft: /Nichts wurde entfernt|Absender/ },
  { name: 'der Hilfe-Knopf holt die Testdatei, liest sie aber nicht ein', datei: A, anker: "await importDateien([new File([await r.blob()], name, { type: typ })], 'Beispiele', { still: true });", ersatz: 'await r.blob();', trifft: /Hilfe → 🧪/ },
  { name: 'eingang.js fehlt im Offline-Vorrat', datei: 'sw.js', anker: "'./assets/eingang.js?v=2', ", ersatz: '', trifft: /Offline-Vorrat/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-eingang-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/eingang.mjs')], { env: { ...process.env, WF_WURZEL: kopie, WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts. Status ' + basis.status + ', Signal ' + basis.signal + (basis.error ? ', ' + basis.error.message : '') + '\n' + (basis.stdout || '').slice(-1500) + '\n' + (basis.stderr || '').slice(-800)); process.exit(2); }
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
