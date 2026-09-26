/* Gegenprobe zu tests/suche.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — und zwar mit einer roten Zeile, die zu ihm passt
   („trifft"). Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_suche.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'Umlaute werden nicht mehr gefaltet', datei: 'assets/suche.js', anker: ".replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');", ersatz: ';', trifft: /Mueller" findet/ },
  { name: 'Satzzeichen bleiben stehen', datei: 'assets/suche.js', anker: "replace(/[^\\p{L}\\p{N}]+/gu, '')", ersatz: "replace(/\\s+/g, '')", trifft: /kd4711/ },
  { name: 'Daten werden nicht erkannt', datei: 'assets/suche.js', anker: '    return out;\n  }\n  // Ein Suchwort, das ein Datum ist', ersatz: '    return [];\n  }\n  // Ein Suchwort, das ein Datum ist', trifft: /Datum/ },
  { name: 'ODER statt UND', datei: 'assets/suche.js', anker: '      if (!hier) return null;', ersatz: '      if (!hier) continue;', trifft: /UND/ },
  { name: 'kein Wort über zwei Textstücke', datei: 'assets/suche.js', anker: 'for (let n = 2; n <= 3 && !out.length; n++)', ersatz: 'for (let n = 2; n <= 1 && !out.length; n++)', trifft: /zwei Textstücke|KD-" \| „4711/ },
  { name: 'Markierungen werden nicht gezeichnet', datei: 'assets/app.js', anker: '    zeichneFunde(i, lage);\n', ersatz: '', trifft: /Fundstelle ist auf Seite 1 markiert|übrigen bleiben/ },
  { name: 'antippen blendet nicht aus', datei: 'assets/app.js', anker: 'S.funde = S.funde.filter(x => x.id !== m.id); el.remove();', ersatz: 'el.remove();', trifft: /kommt beim Umschalten nicht wieder|genau diese Markierung/ },
  { name: 'Markierung klebt am Öffnen ohne Suche', datei: 'assets/app.js', anker: '    S.funde = []; S.fundIdx = -1;\n    // Aus der Bibliothek', ersatz: '    // Aus der Bibliothek',
    // zwei Riegel decken einander (Öffnen UND Schließen leeren) — beide weg, sonst misst der Fall nichts
    extra: { datei: 'assets/app.js', anker: 'S.doc = null; S.sel = null; S.funde = []; S.fundIdx = -1;', ersatz: 'S.doc = null; S.sel = null; S.fundIdx = -1;' }, trifft: /ohne Suche geöffnet/ },
  { name: 'neue Bytes behalten den alten Text', datei: 'assets/db.js', anker: "await DB.put('files', { id, bytes }); await tx('texte', 'readwrite', st => st.delete(id));", ersatz: "await DB.put('files', { id, bytes });", trifft: /neue Bytes werfen/ },
  { name: 'beim Einlesen wird kein Text erfasst, nachgeholt wird nie', datei: 'assets/app.js', anker: '    texteNachholen();\n  }', ersatz: '  }', extra: { datei: 'assets/app.js', anker: " await textAblegen(d.id, text);\n", ersatz: '\n' }, trifft: /Probe lief durch|Seitentext/ },
  { name: 'Suche liest den Seitentext nicht', datei: 'assets/app.js', anker: 'TEXTE.get(d.id) || null, such)', ersatz: 'null, such)', trifft: /SEITENTEXT/ },
  // --- Trefferzahlen, Ordner, Suche im Dokument (2026-09-26)
  { name: 'eine Seite zählt nur einen Treffer', datei: 'assets/suche.js', anker: 'anzahl: st.length || 1,', ersatz: 'anzahl: 1,', trifft: /zwei Stellen|zweimal/ },
  { name: 'Ordnername zählt nicht', datei: 'assets/suche.js', anker: "      if (doc.ordner && trifft(tok, bereite(doc.ordner)))", ersatz: "      if (false && doc.ordner)", trifft: /Ordnername/ },
  { name: 'Dokument zeigt keine Trefferzahl', datei: 'assets/app.js', anker: 'const tr = FUND.has(d.id) ? FUND.get(d.id).treffer : 0;', ersatz: 'const tr = 0;', trifft: /am Dokument steht/ },
  { name: 'Ordner-Knopf zählt Dokumente statt Treffer', datei: 'assets/app.js', anker: 'imO(d, id) ? FUND.get(d.id).treffer : 0)', ersatz: 'imO(d, id) ? 1 : 0)', trifft: /Alle/ },
  { name: 'gewählter Ordner begrenzt die Suche nicht', datei: 'assets/app.js', anker: 'const imOrdner = d => imO(d, S.aktOrdner);', ersatz: 'const imOrdner = d => !SU.anfrage(S.suche).length ? imO(d, S.aktOrdner) : true;', trifft: /nur darin/ },
  { name: 'Lupe der Tastatur lädt die Seite neu', datei: 'assets/app.js', anker: '      e.preventDefault(); suchen(); $(\'bibSuche\').blur();', ersatz: '      suchen();', trifft: /Tastatur/ },
  { name: 'Enter im Dokument springt nicht weiter', datei: 'assets/app.js', anker: 'else springeZuFund(S.fundIdx + 1);', ersatz: 'else springeZuFund(S.fundIdx);', trifft: /nächsten Treffer/ },
  { name: '▲ geht nicht zurück', datei: 'assets/app.js', anker: "$('edSuchZurueck').onclick = () => springeZuFund(S.fundIdx - 1);", ersatz: "$('edSuchZurueck').onclick = () => springeZuFund(S.fundIdx);", trifft: /▲/ },
  { name: 'Zähler zieht beim Antippen nicht nach', datei: 'assets/app.js', anker: ' S.fundIdx = Math.min(S.fundIdx, S.funde.length - 1); zeichneSuchZahl(); };', ersatz: ' };', trifft: /Zähler zieht nach/ },
  { name: 'Schließen leert das Suchfeld im Dokument nicht', datei: 'assets/app.js', anker: "S.fundIdx = -1; $('edSuche').value = '';", ersatz: 'S.fundIdx = -1;', trifft: /Schließen/ },
  { name: 'kein Hinweis, solange der Text fehlt', datei: 'assets/app.js', anker: "    return offen ? `<div", ersatz: "    return false ? `<div", trifft: /sagt die Suche das/ }
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/suche.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

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
