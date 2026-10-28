/* Gegenprobe zu tests/arbeit.mjs (Pro-Umbau 5, Klaus 2026-10-28): baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   NUR_ANKER=1 prüft nur die Anker (ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_arbeit.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'assets/app.js', B = 'assets/bildbeschreibung.js', S = 'assets/sprache.js', C = 'assets/style.css';
const FAELLE = [
  { name: 'Einordnen startet wieder beim Öffnen', datei: A, anker: 'if (EINST.bedeutung) bedeutungStarten({ einordnen: false });', ersatz: 'if (EINST.bedeutung) bedeutungStarten();', trifft: /A2|B9/ },
  { name: 'Bildbeschreibung startet wieder beim Öffnen', datei: B, anker: "function start() { if (A && A.EINST.bild && B.zustand === 'aus' && !B._lauf) { B.zustand = 'wartet'; leiste(); } }", ersatz: 'function start() { if (A && A.EINST.bild) starten(); }', trifft: /B10/ },
  { name: '„Prüfen" fragt nicht vorher', datei: A, anker: "    const n = offenePruefungen().length; if (!n) return;\n", ersatz: "    const n = offenePruefungen().length; if (!n) return; return allePruefen();\n", trifft: /B2|B3/ },
  { name: '„Prüfen" mit Auswahl prüft alle', datei: A, anker: "      const ids = gewaehlt(pruefbar);\n      if (!ids.length) { toast('Unter den gewählten ist nichts mehr zu prüfen.'); return; }\n      return allePruefen(ids);", ersatz: '      return allePruefen();', trifft: /B5/ },
  { name: 'Prüfen meldet keine Hintergrundaufgabe', datei: A, anker: "const hg = await hgBeginnen('pruefen', 'Prüfen läuft');", ersatz: 'const hg = null;', trifft: /B6|B7/ },
  { name: 'Abbrechen aus der Mitteilung wirkungslos', datei: A, anker: "    if (hg) hg.signal.addEventListener('abort', () => { ALLE.stopp = true; pruefLeiste(); }, { once: true });\n", ersatz: '', trifft: /B7/ },
  { name: 'neue Dokumente werden wieder von selbst eingeordnet', datei: A, anker: "if (BED.zustand === 'bereit' && BED.frei) einordnenLauf(null)", ersatz: "if (BED.zustand === 'bereit') einordnenLauf(null)", trifft: /B13/ },
  { name: '„Einordnen" mit Auswahl ordnet alle ein', datei: A, anker: '      return einordnenLauf(new Set(ids));', ersatz: '      return einordnenLauf(null);', trifft: /B16/ },
  { name: 'Abbrechen hält das Einordnen nicht an', datei: A, anker: "if (BED.zustand === 'aus' || BED.zustand === 'fehler' || BED.stopp) return;", ersatz: "if (BED.zustand === 'aus' || BED.zustand === 'fehler') return;", trifft: /B17/ },
  { name: 'die Bibliothek liest beim Öffnen wieder den Seitentext', datei: A, anker: '    zeichneBibliothek();\n    /* Pro-Umbau 5', ersatz: '    zeichneBibliothek(); texteNachholen();\n    /* Pro-Umbau 5', trifft: /B11/ },
  { name: 'Bildbeschreibung meldet keine Hintergrundaufgabe', datei: B, anker: 'try { B.hg = W.ProHintergrund &&', ersatz: 'try { B.hg = null &&', trifft: /B20/ },
  { name: 'strich.js wird nicht geladen', datei: 'index.html', anker: '<script defer src="assets/strich.js?v=1"></script>\n', ersatz: '', trifft: /A1|B21|B22/ },
  { name: 'ohne Emoji wird nicht nachgeschlagen', datei: S, anker: "      if (!/\\p{Extended_Pictographic}/u.test(k)) continue;", ersatz: '      continue;', trifft: /B25/ },
  { name: 'Knöpfe wieder 40 px hoch', datei: C, anker: '.knopf{min-height:32px;padding:4px 10px;', ersatz: '.knopf{min-height:40px;padding:8px 12px;', trifft: /B23/ },
  { name: 'Start-Kacheln wieder mit Schatten', datei: C, anker: '.gross-knopf{padding:4px 10px;gap:8px;min-height:32px;border-width:1.5px;border-radius:8px;box-shadow:none;', ersatz: '.gross-knopf{padding:14px 16px;gap:12px;min-height:32px;border-width:1.5px;border-radius:8px;box-shadow:0 2px 8px #0004;', trifft: /B23|B24/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-arbeit-'));
const kopieren = () => {
  fs.rmSync(kopie, { recursive: true, force: true }); fs.mkdirSync(kopie);
  for (const e of fs.readdirSync(WURZEL)) if (!['node_modules', '.git'].includes(e)) fs.cpSync(path.join(WURZEL, e), path.join(kopie, e), { recursive: true });
  fs.symlinkSync(path.join(WURZEL, 'node_modules'), path.join(kopie, 'node_modules'));
};
const tausche = (datei, anker, ersatz) => {
  const f = path.join(kopie, datei), s = fs.readFileSync(f, 'utf8');
  if (s.split(anker).length !== 2) return false;
  const neu = s.replace(anker, () => ersatz); if (neu === s) return false;
  fs.writeFileSync(f, neu); return true;
};
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/arbeit.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 900000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts. Status ' + basis.status + '\n' + (basis.stdout || '').slice(-1500) + '\n' + (basis.stderr || '').slice(-800)); process.exit(2); }
for (const f of FAELLE) {
  if (nur && !f.name.includes(nur)) continue;
  kopieren();
  if (!tausche(f.datei, f.anker, f.ersatz)) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); continue; }
  const r = lauf(); const rote = (r.stdout || '').split('\n').filter(l => l.includes('✗ ROT'));
  if (!rote.length) { durch++; console.log('  ✗ DURCHGERUTSCHT: ' + f.name + (r.status ? ' (Status ' + r.status + ': ' + String(r.stderr || '').split('\n').slice(0, 3).join(' ') + ')' : '')); }
  else if (!rote.some(l => f.trifft.test(l))) { falsch++; console.log('  ⚠ AUS FALSCHEM GRUND: ' + f.name + '\n      ' + rote.join('\n      ').slice(0, 600)); }
  else { gefangen++; console.log('  ✓ gefangen: ' + f.name + '  (' + rote.length + ' rot)\n      ' + rote.join('\n      ').slice(0, 300)); }
}
fs.rmSync(kopie, { recursive: true, force: true });
console.log(`\n${gefangen} gefangen · ${durch} durchgerutscht · ${falsch} aus falschem Grund · ${tot} tote Anker`);
process.exit(durch || falsch || tot ? 1 : 0);
