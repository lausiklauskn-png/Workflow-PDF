/* Gegenprobe zu tests/scan.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser); NUR_FALL=<Teil des Namens> fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_scan.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'uneinig heißt trotzdem „sicher"', datei: 'assets/scan-bild.js', anker: "return { ecken: ml, quelle: 'ml', sicher: false, grund: bl || kl", ersatz: "return { ecken: ml, quelle: 'ml', sicher: true, grund: bl || kl", trifft: /NICHT sicher|KEIN Foto/ },
  { name: 'schwaches Modell zählt mit', datei: 'assets/scan-bild.js', anker: '!(eing.ml.score != null && eing.ml.score < 0.5)', ersatz: 'true', trifft: /schwaches Modell/ },
  { name: 'Blatterkennung allein gilt als sicher', datei: 'assets/scan-bild.js', anker: "if (bl) return { ecken: bl, quelle: 'blatt', sicher: false", ersatz: "if (bl) return { ecken: bl, quelle: 'blatt', sicher: true", trifft: /nur eine Meinung|KEIN Foto/ },
  { name: 'winzige Vierecke gelten als Blatt', datei: 'assets/scan-bild.js', anker: 'return flaeche(e) >= w * h * 0.05;', ersatz: 'return true;', trifft: /winziges Viereck/ },
  { name: 'Grenze der Einigkeit viel zu weit', datei: 'assets/scan-bild.js', anker: 'const EINIG = 4;', ersatz: 'const EINIG = 40;', trifft: /uneinig|KEIN Foto/ },
  { name: 'quer wird nie erkannt', datei: 'assets/scan-bild.js', anker: 'const quer = br > ho;', ersatz: 'const quer = false;', trifft: /Letter quer/ },
  { name: 'drehen dreht falsch herum', datei: 'assets/scan-bild.js', anker: 'if (n === 1) { X = h - 1 - y; Y = x; }', ersatz: 'if (n === 1) { X = y; Y = w - 1 - x; }', trifft: /drehen rechts/ },
  { name: 'Hintergrund wird nicht geschätzt (Schatten bleibt)', datei: 'assets/scan-bild.js', anker: 'const g = Math.max(bg[p], 30), norm', ersatz: 'const g = 250, norm', trifft: /Schatten weg/ },
  { name: 'Schwarzweiß-Schwelle kaputt', datei: 'assets/scan-bild.js', anker: 'const v = norm < 0.8 ? 0 : 255;', ersatz: 'const v = norm < 0.8 ? 0 : 200;', trifft: /Schwarzweiß/ },
  { name: 'Kontrast wirkt verkehrt', datei: 'assets/scan-bild.js', anker: 'const k = kon >= 0 ? 1 + kon / 50 : 1 + kon / 125', ersatz: 'const k = kon >= 0 ? 1 - kon / 125 : 1 + kon / 125', trifft: /Kontrast/ },
  { name: 'Farben von Papier und Schrift vertauscht', datei: 'assets/scan-bild.js', anker: 'return { grund: mittel(hellst), schrift: mittel(dunkelst) };', ersatz: 'return { grund: mittel(dunkelst), schrift: mittel(hellst) };', trifft: /textFarben/ },
  { name: 'Modell sucht seine Dateien im Netz statt in vendor/scanic/', datei: 'assets/scanner.js', anker: "ml: { assetBaseUrl: new URL('vendor/scanic/', location.href).href }", ersatz: 'ml: {}', trifft: /Modell \(Scanic ML\) lief|kein Aufruf ins Netz/ },
  { name: 'gezogene Ecke gilt nicht als „von Hand"', datei: 'assets/scanner.js', anker: 's.ecken[i] = [x / f, y / f]; s.manuell = true;', ersatz: 's.ecken[i] = [x / f, y / f];', trifft: /von Hand gesetzt/ },
  { name: '↺ Automatisch holt die Ecken nicht zurück', datei: 'assets/scanner.js', anker: 's.manuell = false; s.ecken = s.erkennung.ecken.map(p => p.slice());', ersatz: 's.manuell = false;', trifft: /Automatisch setzt/ },
  { name: 'Drehen tut nichts', datei: 'assets/scanner.js', anker: 's.drehung = (s.drehung + (+k.dataset.dreh) + 4) % 4;', ersatz: '', trifft: /dreht die Seite/ },
  { name: 'Umordnen tauscht nicht', datei: 'assets/scanner.js', anker: 'const x = ST.seiten[a]; ST.seiten[a] = ST.seiten[b]; ST.seiten[b] = x;', ersatz: '', trifft: /tauscht die Reihenfolge/ },
  { name: 'geänderter Text wird nicht ins Bild geschrieben', datei: 'assets/scanner.js', anker: 'if (mitText !== false && s.ocr) textAnwenden(c, img, s);', ersatz: '', trifft: /neu geschrieben/ },
  { name: 'keine Textebene im PDF', datei: 'assets/scanner.js', anker: 'if (ST.durchsuchbar && s.ocr) {', ersatz: 'if (false) {', trifft: /durchsuchbar/ },
  { name: 'Textebene trägt den alten Text', datei: 'assets/scanner.js', anker: 'const zeilenText = (s, i) => (s.aenderungen', ersatz: 'const zeilenText = (s, i) => s.ocr.zeilen[i].text; const _alt = (s, i) => (s.aenderungen', trifft: /alte Text nicht mehr/ },
  { name: 'ungeprüfte Seite wird ohne Frage übernommen', datei: 'assets/scanner.js', anker: 'if (offen && !await ST.opt.frage(', ersatz: 'if (false && !await ST.opt.frage(', trifft: /fragt vor dem Übernehmen/ },
  { name: 'ZIP enthält keine Bilder', datei: 'assets/scanner.js', anker: 'bytes: await jpeg(seiteRechnen(ST.seiten[i], Q.dpi, true).canvas, Q.q)', ersatz: 'bytes: new Uint8Array(8)', trifft: /ZIP mit einem JPEG/ },
  { name: 'Seite ist nicht A4', datei: 'assets/scan-bild.js', anker: 'else { pw = quer ? A4.h : A4.w; ph = quer ? A4.w : A4.h; }', ersatz: 'else { pw = quer ? 800 : 600; ph = quer ? 600 : 800; }', trifft: /A4/ }
];

const NUR = process.env.NUR_FALL; if (NUR) FAELLE.splice(0, FAELLE.length, ...FAELLE.filter(f => f.name.includes(NUR)));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/scan.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const n = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8').split(f.anker).length - 1; if (n !== 1) { tot++; console.log('  ☠ TOTER ANKER (' + n + '×): ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
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
