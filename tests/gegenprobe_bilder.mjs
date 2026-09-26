/* Gegenprobe zu tests/bilder.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_bilder.mjs  ·  NUR_FALL=<Teil des Namens> */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const U = 'assets/uebersetzung.js', A = 'assets/app.js';
const FAELLE = [
  { name: 'Vorgabe liest Bilder wieder', datei: U, anker: 'const bilderLesen = !!(opt.ocr && opt.ocr.bilder);', ersatz: 'const bilderLesen = !!opt.ocr;', trifft: /Vorgabe: Bilder werden nicht gelesen|bildText 0/ },
  { name: 'strenger Filter fehlt im Bild', datei: U, anker: '      if (imBild && !bildZeileTaugt(t, li.confidence)) continue;\n', ersatz: '', trifft: /kein Schein-Text/ },
  { name: 'Bild-Lesen ohne strengen Filter aufgerufen', datei: U, anker: 'ocrBloecke(ocrWorker, c, S, fx, fy, true)', ersatz: 'ocrBloecke(ocrWorker, c, S, fx, fy)', trifft: /kein Schein-Text/ },
  { name: 'Sicherheit wird nicht geprüft', datei: U, anker: '!(sicherheit >= BILD_SICHER) || ', ersatz: '', trifft: /unsicher erkannt/ },
  { name: 'Rahmen-Zeichen werden nicht geprüft', datei: U, anker: ' || BILD_ZEICHEN.test(t)) return false;', ersatz: ') return false;', trifft: /Rahmen-Zeichen/ },
  { name: 'Buchstabenanteil wird nicht geprüft', datei: U, anker: 'buchst < 4 || buchst / ohne.length < 0.7', ersatz: 'buchst < 4', trifft: /überwiegend Ziffern/ },
  { name: 'Wortregel fehlt', datei: U, anker: "return woerter.some(w => w.length >= 5) || woerter.filter(w => w.length >= 4).length >= 2;", ersatz: 'return true;', trifft: /Kästen fallen heraus/ },
  { name: 'gespeicherter Bild-Text wird nicht neu gelesen', datei: U, anker: 'if (alte && !(alte.bildText > 0 && !bilderLesen) && ', ersatz: 'if (alte && ', trifft: /wird ohne den Haken neu gelesen/ },
  { name: 'alter Stand (ohne bildText) wird nicht neu gelesen', datei: U, anker: ' && !(alte.ocr && alte.bildText === undefined && !bilderLesen)) continue;', ersatz: ') continue;', trifft: /vor dem 2026-09-26/ },
  { name: 'Scan-Seite aus altem Stand wird neu gelesen', datei: U, anker: "if (alte && !(alte.bildText > 0) && !r.bloecke.length) { try { page.cleanup(); } catch (_) {} continue; }", ersatz: '', trifft: /Scan-Seite bleibt/ },
  { name: 'bildText wird nicht gespeichert', datei: U, anker: 'ocr: ocr || bildText > 0, bildText };', ersatz: 'ocr: ocr || bildText > 0 };', trifft: /bildText 0/ },
  { name: 'Haken kommt nicht beim Lauf an', datei: A, anker: "bilder: !!EINST.ueBilder }", ersatz: 'bilder: false }', trifft: /mit Haken/ },
  { name: 'Haken steht vorab an', datei: A, anker: "data-bilder${EINST.ueBilder ? ' checked' : ''}", ersatz: 'data-bilder checked', trifft: /steht da und ist aus/ },
  { name: 'Wahl wird nicht gemerkt', datei: A, anker: " EINST.ueBilder = dl.querySelector('[data-bilder]').checked;", ersatz: '', trifft: /gemerkt|wie zuletzt/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gpb-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/bilder.mjs')], { encoding: 'utf8', timeout: 900000 });

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
