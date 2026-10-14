/* Gegenprobe zu tests/reinigung.mjs (Reinigung vor der KI, 2026-10-14): baut in einer WEGWERF-KOPIE je einen
   Fehler ein. Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_reinigung.mjs
   BENANNTE GRENZE: dass „Felder erkennen" die Metadaten-Reinigung RUFT, hat keinen Fall — das Bild entsteht
   aus einer Leinwand und trägt kein EXIF/XMP/IPTC (nur das ICC-Farbprofil, das bleibt); ohne den Aufruf ändert sich
   am Bestand nichts. Die Reinigung
   selbst ist in Abschnitt A an einem JPEG mit EXIF/XMP/Kommentar gemessen. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = 'assets/reinigung.js', A = 'assets/app.js', U = 'assets/uebersetzung.js';
const FAELLE = [
  { name: 'blasser Text gilt als sichtbar', datei: R, anker: 'const KONTRAST = 32;', ersatz: 'const KONTRAST = 10;', trifft: /blass/ },
  { name: 'winzige Schrift wird nicht erkannt', datei: R, anker: "if (!(stueck.fh >= WINZIG_PT)) return 'winzig';", ersatz: ';', trifft: /winzig/ },
  { name: 'Text außerhalb der Seite gilt als sichtbar', datei: R, anker: "if (!k) return 'aussen';", ersatz: 'if (!k) return null;', trifft: /außerhalb/ },
  { name: 'reinigeRoh nimmt nichts heraus', datei: R, anker: 'return !g;', ersatz: 'return true;', trifft: /reinigeRoh|KEINER Anfrage/ },
  { name: 'zudecken deckt nichts zu', datei: R, anker: 'for (let y = b; y < d; y++) for (let x = a; x < c; x++) { const i = (y * img.width + x) * 4; D[i] = r; D[i + 1] = g; D[i + 2] = bl; }', ersatz: ';', trifft: /zugedeckt|zudecken/ },
  { name: 'EXIF bleibt im JPEG', datei: R, anker: 'const META = m => (m >= 0xE1 && m <= 0xEF && m !== 0xE2 && m !== 0xEE) || m === 0xFE;', ersatz: 'const META = m => m === 0xFE;', trifft: /EXIF/ },
  { name: 'das Farbprofil wird als Metadaten gezählt', datei: R, anker: 'const META = m => (m >= 0xE1 && m <= 0xEF && m !== 0xE2 && m !== 0xEE) || m === 0xFE;', ersatz: 'const META = m => (m >= 0xE1 && m <= 0xEF) || m === 0xFE;', trifft: /ICC|Farbprofil/ },
  { name: 'ein abgeschnittenes JPEG wird geraten', datei: R, anker: 'if (len < 2 || i + 2 + len > u8.length) return { bytes: u8, entfernt: [], geprueft: false };', ersatz: 'if (len < 2) return { bytes: u8, entfernt: [], geprueft: false };', trifft: /abgeschnittenes/ },
  { name: 'der Vermerk doppelt', datei: R, anker: 'if (schon.has(k) || alt.length >= MAX_VERMERKE) continue;', ersatz: 'if (alt.length >= MAX_VERMERKE) continue;', trifft: /einmal da/ },
  { name: 'der Vermerk kennt den Weg nicht', datei: R, anker: "const schl = v => v.weg + '|' + v.seite", ersatz: "const schl = v => '|' + v.seite", trifft: /anderer Weg|erkennung/ },
  { name: 'es wird nicht angehalten', datei: A, anker: "st.ok = await frage('Versteckten Text gefunden'", ersatz: "st.ok = true || await frage('Versteckten Text gefunden'", trifft: /hält an/ },
  { name: 'auch bei „Abbrechen" wird vermerkt', datei: A, anker: 'if (st.ok) { RE.vermerken(d, liste, weg); st.n += liste.length; }', ersatz: 'RE.vermerken(d, liste, weg); if (st.ok) st.n += liste.length;', trifft: /keinen Vermerk ab/ },
  { name: '„Abbrechen" in der App sendet trotzdem', datei: A, anker: 'if (!(await rein.halt(d, g.entfernt.map(e => Object.assign({ seite }, e))))) { abbruch = true; return false; }', ersatz: 'await rein.halt(d, g.entfernt.map(e => Object.assign({ seite }, e)));', trifft: /Abbrechen/ },
  { name: 'der Übersetzer überhört „anhalten"', datei: U, anker: 'if (rr === false) { abgebrochen = true; try { page.cleanup(); } catch (_) {} break; }', ersatz: ';', trifft: /Abbrechen/ },
  { name: 'die Übersetzung reinigt gar nicht', datei: A, anker: 'abbruch: () => abbruch, reinigen,', ersatz: 'abbruch: () => abbruch,', trifft: /hält an/ },
  { name: 'der Vermerk der Übersetzung wird nicht gespeichert', datei: A, anker: "if (rein && rein.st.n > vorN) {\n          await DB.put('docs', d);", ersatz: 'if (rein && rein.st.n > vorN) {', trifft: /Vermerk am Dokument/ },
  { name: 'Felder erkennen schickt das ungereinigte Bild', datei: A, anker: 'const antwort = await ER.kiAnfrage(kiCfg(), sicher.url,', ersatz: 'const antwort = await ER.kiAnfrage(kiCfg(), ER.markiertesBild(c, kand),', trifft: /zugedeckt/ },
  { name: 'Felder erkennen deckt den blassen Text nicht zu', datei: A, anker: 'if (g) { liste.push({ seite, text: t.str, grund: g }); RE.zudecken(img, st, vp.scale); }', ersatz: 'if (g) liste.push({ seite, text: t.str, grund: g });', trifft: /zugedeckt/ },
  { name: 'der Prüfbericht zeigt den Vermerk nicht', datei: A, anker: '${kiEntferntHtml(d)}', ersatz: '', trifft: /Prüfbericht: Abschnitt/ },
  { name: 'die Textdatei des Prüfberichts nennt ihn nicht', datei: A, anker: "z.push('Vor dem Senden an eine KI entfernt (das Dokument selbst ist unverändert):');", ersatz: "z.push('Entfernt:');", trifft: /Textdatei/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-reinigung-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/reinigung.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
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
