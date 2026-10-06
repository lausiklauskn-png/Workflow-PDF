/* Gegenprobe zu tests/teilen-empfang.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_teilen_empfang.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'assets/app.js', W = 'sw.js', M = 'manifest.webmanifest';
const FAELLE = [
  { name: 'der Worker fängt den POST nicht ab', datei: W, anker: "    e.respondWith(teilenEmpfangen(r));\n    return;", ersatz: '    /* weg */', trifft: /fängt genau diese Adresse|nie an den Server/ },
  { name: 'der Worker liest ein anderes Feld', datei: W, anker: "fd.getAll('dateien')", ersatz: "fd.getAll('files')", trifft: /liest genau dieses Feld/ },
  { name: 'kein share_target im Manifest', datei: M, anker: '"share_target": {', ersatz: '"teilen_aus": {', trifft: /nennt ein share_target/ },
  { name: 'das Teilen-Ziel nimmt keine PDFs', datei: M, anker: '"application/pdf",\n', ersatz: '', trifft: /PDFs und Bilder annimmt/ },
  { name: 'kein file_handlers im Manifest', datei: M, anker: '"file_handlers": [', ersatz: '"datei_griffe": [', trifft: /file_handlers nennt PDF/ },
  { name: 'der Vorrat der geteilten Dateien fällt beim neuen CACHE_VERSION weg', datei: W, anker: ', GETEILT_VORRAT]', ersatz: ']', trifft: /übersteht ein neues CACHE_VERSION/ },
  { name: 'die App holt die geteilten Dateien nicht ab', datei: A, anker: '.then(geteiltUebernehmen)', ersatz: '', trifft: /landet in der Bibliothek|beide kommen an/ },
  { name: 'der Vorrat wird nicht geleert', datei: A, anker: 'await c.delete(k);', ersatz: ';', trifft: /Vorrat der geteilten Dateien ist leer|nicht ein zweites Mal/ },
  { name: 'die Adresse behält ?geteilt', datei: A, anker: "q.delete('geteilt'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);", ersatz: ';', trifft: /kein \?geteilt mehr/ },
  { name: 'nur Text geteilt bleibt still', datei: A, anker: "if (g === '0') { toast('Es kam keine Datei an. Workfloh PDF nimmt PDFs und Bilder.'); return; }", ersatz: "if (g === '0') return;", trifft: /keine Datei ankam/ },
  { name: 'leerer Vorrat bleibt still', datei: A, anker: "if (!dateien.length) { toast('⚠️ Die geteilte Datei kam nicht an. Bitte noch einmal teilen.'); return; }", ersatz: 'if (!dateien.length) return;', trifft: /statt still zu bleiben/ },
  { name: 'der Dateiname verliert seine Umlaute', datei: A, anker: "name = decodeURIComponent(r.headers.get('X-Name') || 'Datei');", ersatz: "name = r.headers.get('X-Name') || 'Datei';", trifft: /Umlauten unverändert/ },
  { name: '„Öffnen mit" meldet sich nicht an', datei: A, anker: '.then(oeffnenMitEmpfangen)', ersatz: '', trifft: /launchQueue an/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-empfang-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/teilen-empfang.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

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
