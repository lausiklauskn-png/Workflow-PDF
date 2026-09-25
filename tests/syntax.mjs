// node --check über alle eigenen Skripte (die Vendor-Dateien sind fremde Releases).
import { execFileSync } from 'node:child_process';
const dateien = ['assets/app.js', 'assets/db.js', 'assets/erkennung.js', 'assets/blatt.js', 'assets/export.js', 'assets/html-export.js', 'assets/uebersetzung.js', 'sw.js', 'tests/uebersetzung.mjs', 'tests/e2e.mjs', 'tests/behoerde.mjs'];
let rot = 0;
for (const d of dateien) { try { execFileSync(process.execPath, ['--check', d]); console.log('  ✓ Syntax ' + d); } catch (e) { rot++; console.log('  ✗ ROT: ' + d + '\n' + e.stderr); } }
process.exitCode = rot ? 1 : 0;
