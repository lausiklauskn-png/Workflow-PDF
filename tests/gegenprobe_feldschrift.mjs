/* Gegenprobe zu tests/feldschrift.mjs (Klaus 2026-11-03): baut in einer WEGWERF-KOPIE je einen Fehler ein. Jeder Fall muss
   die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft"). NUR_ANKER=1 prüft nur die Anker, NUR_FALL="…" fährt
   nur passende Fälle. Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_feldschrift.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'assets/app.js', E = 'assets/erkennung.js', X = 'assets/export.js';
const FAELLE = [
  { name: 'ausgefüllter Text zählt nicht als belegt', datei: E, anker: "if (typeof inhalt === 'string' && inhalt.trim() && !/^\\p{L}$/u.test(inhalt.trim())) return 'text';", ersatz: '', trifft: /unterstrichener|Überschrift|Hinweis|gedruckten Text|Text der Textebene/ },
  { name: 'Logo-Tinte wird nicht gezählt', datei: E, anker: "return n && tinte / n > TINTE_MAX ? 'bild' : '';", ersatz: "return '';", trifft: /Logo/ },
  { name: 'Beschriftung wird als Tinte gezählt', datei: E, anker: "if (marken.some(m => x >= m[0] && x <= m[2] && y >= m[1] && y <= m[3])) continue;", ersatz: '', trifft: /Datum/ },
  // zwei Riegel, die einander decken (vor der KI und danach) — ein Fall nimmt beide weg
  { name: 'die App filtert Belegtes nicht', datei: A, anker: "return liste.filter(f => { const g = ER.schonBelegt(f, its, seitenBild, f.inhalt); if (g) belegtWeg.push(g); return !g; });", ersatz: 'return liste;',
    weitere: [["        felder = felder.filter(f => { const g = ER.schonBelegt(f, items, seitenBild, f.inhalt); if (g) belegtWeg.push(g); return !g; });\n", '']], trifft: /kein Feld|gedruckten Text|zählt/ },
  { name: 'feste Schriftgröße wird auf dem Bildschirm übergangen', datei: A, anker: "if (g) { ziel.style.fontSize = (g * pxProPt).toFixed(2) + 'px'; return; }", ersatz: '', trifft: /14 pt|10 pt|Zahl 14/ },
  { name: 'auto: Schrift wird nicht verkleinert', datei: A, anker: "while (s > min && zuGross()) { s = Math.max(min, s - 0.5); ziel.style.fontSize = s + 'px'; }", ersatz: '', trifft: /abgeschnitten/ },
  { name: 'Feld wächst nicht mit', datei: A, anker: "    f.w = w; f.h = h; return true;", ersatz: '    return false;', trifft: /hoch|breit|höher/ },
  { name: 'Ausfüllen: Feld wächst nicht beim Tippen', datei: A, anker: "if (feldAnText(f)) { el.style.width = f.w + '%'; el.style.height = f.h + '%'; } ", ersatz: '', trifft: /Ausfüllen/ },
  { name: 'kein Zahlenfeld', datei: A, anker: "if ($('eigGr')) $('eigGr').oninput", ersatz: "if (false) $('eigGr').oninput", trifft: /14|Zahl|auto|Abbruch/ },
  { name: 'Export übergeht die Zahl (fest)', datei: X, anker: "    if (!g) return passendeGroesse(font, text, bw, bh, !!f.mehrzeilig);", ersatz: "    return passendeGroesse(font, text, bw, bh, !!f.mehrzeilig);", trifft: /festes PDF/ },
  { name: 'Export übergeht die Zahl (ausfüllbar)', datei: X, anker: "let gross = fest || Math.max(", ersatz: "let gross = Math.max(", trifft: /ausfüllbares PDF/ },
  { name: 'kein Einrasten', datei: A, anker: "        if (fx) x += fx.d; if (fy) y += fy.d;", ersatz: '', trifft: /rastet/ }
  // BENANNTE GRENZE: das Wegnehmen der Hilfslinien beim Loslassen hat keinen Fall — nach einem Zug zeichnet die App die Felder
  // ohnehin neu (zeichneFelder leert die Seite), die Linien sind dann auch ohne diesen Riegel weg.
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-feldschrift-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/feldschrift.mjs')], { env: { ...process.env, WF_WURZEL: kopie, WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if ([f.anker, ...(f.weitere || []).map(w => w[0])].some(an => s.split(an).length !== 2)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts. Status ' + basis.status + ', Signal ' + basis.signal + (basis.error ? ', ' + basis.error.message : '') + '\n' + (basis.stdout || '').slice(-1500) + '\n' + (basis.stderr || '').slice(-800)); process.exit(2); }
for (const f of FAELLE) {
  if (nur && !f.name.includes(nur)) continue;
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz) || (f.weitere || []).some(([an, er]) => !tausche(f.datei, an, er))) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ').slice(0, 600)); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.join('\n      ').slice(0, 400)); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
