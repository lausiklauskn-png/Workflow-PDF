/* Gegenprobe zu tests/bibliothek.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser).
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_bibliothek.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = 'assets/app.js', C = 'assets/style.css', H = 'index.html';
const FAELLE = [
  // 2 · Pfeil nach oben
  // Nicht einfach wegnehmen: dann wirft die Bindung (querySelector(...).onclick = …) und die ganze
  // Bibliothek bricht — gefangen aus falschem Grund. Ein leeres Element behält die Bindung.
  { name: 'kein Pfeil nach oben an der Karte', datei: A, anker: '<button class="dok-hoch" data-hoch title="Ganz nach oben" aria-label="Ganz nach oben">↑</button>', ersatz: '<span data-hoch></span>', trifft: /Pfeil steht da|gleich groß/ },
  { name: 'der Pfeil tut nichts', datei: A, anker: "el.querySelector('[data-hoch]').onclick = ganzNachOben;", ersatz: ';', trifft: /GANZ nach oben/ },
  { name: 'der Pfeil rollt nur ein Stück statt ganz nach oben', datei: A, anker: "function ganzNachOben() { window.scrollTo({ top: 0, behavior: 'smooth' }); }", ersatz: "function ganzNachOben() { window.scrollBy({ top: -800 }); }", trifft: /GANZ nach oben/ },
  { name: 'der Pfeil steht auch ganz oben', datei: C, anker: 'box-shadow:0 1px 4px rgba(0,0,0,.3);display:none}', ersatz: 'box-shadow:0 1px 4px rgba(0,0,0,.3);display:block}', trifft: /ganz oben steht er nicht/ },
  { name: 'der Pfeil sitzt auf dem Auswahl-Punkt', datei: C, anker: '.dok-hoch{position:absolute;right:40px;', ersatz: '.dok-hoch{position:absolute;right:6px;', trifft: /links neben dem Auswahl-Punkt/ },
  // 3 · Kopfleiste
  { name: 'der Bedeutungs-Knopf macht die Seite bei 320 px wieder breiter (328 px, wie auf main)', datei: C, anker: '.bedeutung-leiste .knopf{white-space:normal;text-align:left;max-width:100%}', ersatz: '', trifft: /320 px: die Seite ist nicht breiter/ },
  { name: 'Kopfleiste am Handy ohne Verkleinerung', datei: C, anker: '@media (max-width:480px){.kopf{gap:6px;', ersatz: '@media (max-width:1px){.kopf{gap:6px;', trifft: /überlagern den Schriftzug nicht|nicht abgeschnitten/ },
  { name: 'der Schriftzug darf nicht umbrechen (schmalste Breite)', datei: C, anker: '.marke-name{font-size:1.08rem;white-space:normal;line-height:1.05}', ersatz: '.marke-name{font-size:1.08rem}', trifft: /überlagern den Schriftzug nicht|nicht abgeschnitten/ },
  { name: 'die Knöpfe werden zu klein zum Treffen', datei: C, anker: '.ikon{width:31px;height:31px;', ersatz: '.ikon{width:22px;height:22px;', trifft: /treffbar/ },
  // 4 · Erstellungsdatum
  { name: '„Erstellungsdatum" fehlt im Sortieren', datei: A, anker: " erstellt: 'Erstellungsdatum',", ersatz: '', trifft: /Erstellungsdatum/ },
  { name: 'nach Erstellungsdatum sortiert die ältesten zuerst', datei: A, anker: "liste.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || namensVergleich(a, b));", ersatz: "liste.sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '') || namensVergleich(a, b));", trifft: /neuesten zuerst/ },
  { name: 'das Datum sucht nach dem Änderungsdatum', datei: A, anker: '(!S.datum || tagVon(d.createdAt) === S.datum)', ersatz: '(!S.datum || tagVon(d.createdAt) === S.datum || tagVon(d.updatedAt) === S.datum)', trifft: /Änderungsdatum/ },
  { name: 'das Datum wird in UTC statt Ortszeit gerechnet', datei: A, anker: "const tagVon = iso => { if (!iso) return ''; const t = new Date(iso); if (isNaN(t)) return ''; const z = n => String(n).padStart(2, '0'); return t.getFullYear() + '-' + z(t.getMonth() + 1) + '-' + z(t.getDate()); };", ersatz: "const tagVon = iso => iso ? String(iso).slice(0, 10) : '';", trifft: /Ortszeit/ },
  { name: 'die Datumswahl filtert nicht', datei: A, anker: "q('[data-datum]').onchange = e => { S.datum = e.target.value || ''; zeichneBibliothek(); };", ersatz: "q('[data-datum]').onchange = e => {};", trifft: /genau die drei/ },
  { name: 'ein leerer Tag sagt nichts (kein Hinweis, kein Weg zurück)', datei: A, anker: "if (S.datum && S.docs.some(d => imOrdner(d) && (!such.length || FUND.has(d.id)))) {", ersatz: "if (false) {", trifft: /sagt das/ },
  { name: 'die Karte nennt ihr Erstellungsdatum nicht', datei: A, anker: "(d.createdAt ? h('erstellt ' + tagText(tagVon(d.createdAt))) : h('ohne Erstellungsdatum'))", ersatz: "''", trifft: /nennt dabei/ },
  // 7 · eine Lupe
  { name: 'die Lupe steht wieder im Platzhalter', datei: H, anker: 'placeholder="Suchen — Name oder Inhalt, z. B. eine Kundennummer"', ersatz: 'placeholder="🔎 Suchen — Name oder Inhalt, z. B. eine Kundennummer"', trifft: /keine Lupe mehr/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-bibliothek-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/bibliothek.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts.\n' + basis.stdout.slice(-1500)); process.exit(2); }
for (const f of FAELLE) {
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
