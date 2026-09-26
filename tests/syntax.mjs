// node --check über alle eigenen Skripte (die Vendor-Dateien sind fremde Releases).
// Die Liste wird GEFUNDEN, nicht gepflegt (2026-09-26): bis dahin stand sie von Hand da, und
// eine neue Datei (assets/suche.js) wäre ungeprüft geblieben — eine gepflegte Liste sieht
// immer vollständig aus.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const dateien = ['sw.js']
  .concat(fs.readdirSync('assets').filter(f => f.endsWith('.js')).map(f => 'assets/' + f))
  .concat(fs.readdirSync('tests').filter(f => f.endsWith('.mjs')).map(f => 'tests/' + f));
let rot = 0;
for (const d of dateien) { try { execFileSync(process.execPath, ['--check', d]); console.log('  ✓ Syntax ' + d); } catch (e) { rot++; console.log('  ✗ ROT: ' + d + '\n' + e.stderr); } }
if (!dateien.includes('assets/suche.js') || dateien.length < 15) { rot++; console.log('  ✗ ROT: die Suche nach Skripten fand zu wenig (' + dateien.length + ')'); }
console.log(`\n${dateien.length - rot} grün · ${rot} ROT`);
process.exitCode = rot ? 1 : 0;
