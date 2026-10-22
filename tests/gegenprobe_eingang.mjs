/* Gegenprobe zu tests/eingang.mjs (Prüfung beim Einlesen, Klaus 2026-10-01): baut in einer
   WEGWERF-KOPIE je einen Fehler ein. Jeder Fall muss die Probe umwerfen — mit einer roten Zeile,
   die zu ihm passt („trifft"). NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser).
   NUR_FALL="…" fährt nur passende Fälle. Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_eingang.mjs
   BENANNTE GRENZEN: die geschärfte Wartebedingung in tests/bedeutung.mjs und der ffmpeg-Rückfall in
   tests/video.mjs haben keinen Fall — eine Sabotage dort macht die Probe flatterhaft bzw. „nicht
   lauffähig", nicht rot. Das Austragen aus PRUEF.laufend erst NACH dem Befund (Befund unter Last in
   der vollen Kette) hat ebenfalls keinen: einzeln läuft die Probe auch mit der alten Reihenfolge grün. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = 'assets/eingang.js', A = 'assets/app.js';
const FAELLE = [
  { name: 'unsichtbarer Text im PDF wird nicht mehr gemeldet', datei: E, anker: "'PDF-VERSTECKTER-TEXT', 'VERSTECKTER-TEXT',", ersatz: "'VERSTECKTER-TEXT',", trifft: /0D \(weißer|PDF: unsichtbarer/ },
  { name: 'die markierte Kopie fällt weg', datei: E, anker: 'markiert: m, art: r.art, zeit', ersatz: 'markiert: null, art: r.art, zeit', trifft: /markiert/ },
  { name: 'geprüft wird das daraus gebaute PDF statt des Fotos', datei: A, anker: "const b = !d ? null : o && o.bytes ? o.bytes : await DB.getFile(id);", ersatz: "const b = !d ? null : await DB.getFile(id);", trifft: /Foto|Bild|ORIGINALFOTO/ },
  { name: 'ein „sauber" aus einer fremden Arbeitsstand-Datei wird geglaubt', datei: A, anker: '        delete d.pruefung;                                  // ein Befund', ersatz: '        // ein Befund', trifft: /fremde[nm] Arbeitsstand/ },
  { name: 'der offene Editor bekommt den Befund nicht', datei: A, anker: 'if (S.doc && S.doc.id === id) S.doc.pruefung = r;', ersatz: ';', trifft: /Editor/ },
  { name: 'der Dialog öffnet sich nicht mehr von selbst', datei: A, anker: "if (r.stand === 'warnung' && !ALLE.an && !document.querySelector('.dlg')) pruefDialog(id);", ersatz: ';', trifft: /von selbst/ },
  { name: 'die Karte bekommt nach der Prüfung keine Marke', datei: A, anker: "      markeErneuern(id);\n      // Ein Fenster genügt", ersatz: "      // Ein Fenster genügt", trifft: /Marke/ },
  { name: 'der Satz „Nichts wurde entfernt" fehlt', datei: A, anker: '<p class="hinweis" data-pruef-original>Nichts wurde entfernt:', ersatz: '<p class="hinweis">Nichts wurde entfernt:', trifft: /Nichts wurde entfernt|Absender/ },
  { name: 'der Hilfe-Knopf holt die Testdatei, liest sie aber nicht ein', datei: A, anker: "await importDateien([new File([await r.blob()], name, { type: typ })], 'Beispiele', { still: true, pruefen: true });", ersatz: 'await r.blob();', trifft: /Hilfe → 🧪/ },
  // Herkunftsnachweis (C2PA, Klaus 2026-10-14): eine Angabe, nie eine Warnung
  { name: 'HERKUNFT: der Nachweis landet in der Warnliste', datei: E, anker: "'BILD-LSB-VERDACHT', 'PDF-ANHANG', 'ANHANG-PROGRAMM', 'ANHANG-TARNUNG'];", ersatz: "'BILD-LSB-VERDACHT', 'PDF-ANHANG', 'ANHANG-PROGRAMM', 'ANHANG-TARNUNG', 'PDF-HERKUNFT', 'BILD-HERKUNFT'];", trifft: /Warnung|Warnliste/ },
  { name: 'HERKUNFT: das Ergebnis trägt keine Herkunft mehr', datei: E, anker: 'markiert: m, art: r.art, zeit, herkunft, angaben };', ersatz: 'markiert: m, art: r.art, zeit, angaben };', trifft: /HERKUNFT|Herkunft/ },
  { name: 'HERKUNFT: die Daten (Programm, Unterzeichner) fallen weg', datei: E, anker: 'daten: Array.isArray(x.daten) ? x.daten.map(z => [String(z[0]), String(z[1])]) : null', ersatz: 'daten: null', trifft: /Programm|Unterzeichner/ },
  { name: 'HERKUNFT: bei „sauber" fehlt die Marke', datei: A, anker: "if (p.herkunft && p.herkunft.length) return '<button", ersatz: "if (false) return '<button", trifft: /Marke „ℹ Herkunft"/ },
  { name: 'HERKUNFT: die Details stehen schon aufgeklappt', datei: A, anker: '<details data-herkunft-details>', ersatz: '<details data-herkunft-details open>', trifft: /zugeklappt/ },
  { name: 'BERICHT: ein sauberes Dokument hat wieder keine Marke', datei: A, anker: `return '<button class="dok-pruefung ok" data-pruef data-pruefung="sauber">✓ Geprüft · Prüfbericht</button>';`, ersatz: "return '';", trifft: /ruhige Marke/ },
  { name: 'BERICHT: die Angaben werden nicht mehr aufgehoben', datei: E, anker: 'const angaben = alle.filter(x => !WARN.includes(x.kennung) && !HERKUNFT.includes(x.kennung))', ersatz: 'const angaben = [].filter(x => x)', trifft: /Metadaten als Angabe|Was sonst in der Datei steht/ },
  { name: 'BERICHT: der Knopf „als Textdatei" fehlt', datei: A, anker: '<button class="knopf" data-bericht-laden>⬇ Prüfbericht als Textdatei</button>', ersatz: '', trifft: /Pruefbericht\.txt|Prüfbericht als Textdatei/ },
  { name: 'MANUELL: das Einlesen prüft wieder von selbst', datei: A, anker: 'if (pruefen && EINGANG_QUELLEN.includes(quelle)) pruefungNachholen([d.id]);', ersatz: 'if (EINGANG_QUELLEN.includes(quelle)) pruefungNachholen([d.id]);', trifft: /läuft KEINE Prüfung|keine Prüfung läuft/ },
  { name: 'MANUELL: ungeprüfte Dokumente tragen keinen Knopf', datei: A, anker: `if (!p) return pruefbar(d) ? '<button class="dok-pruefung offen"`, ersatz: `if (!p) return false ? '<button class="dok-pruefung offen"`, trifft: /jetzt prüfen/ },
  { name: 'MANUELL: der Knopf im Editor tut nichts', datei: A, anker: 'if (d) pruefKnopfBinden(w, d.id);', ersatz: '', trifft: /Tipp im Editor startet/ },
  // Benannte Grenze: kein Fall für „der Knopf an der Karte öffnet das Dokument mit“. Die Marke steht in .dok-info,
  // außerhalb jedes [data-auf]; die Karte selbst hat keinen Klick-Zuhörer. Ohne stopPropagation öffnet also nichts —
  // der Riegel ist am Bestand nicht von seinem Fehlen zu unterscheiden (gemessen 2026-10-14: durchgerutscht).
  // Der Wächter in eingang.mjs bleibt und fängt es, sobald die Marke je in einen Öffnen-Bereich wandert.
  { name: 'MANUELL: geprüft wird das PDF statt des Originalfotos', datei: A, anker: "const o = d ? await DB.get('files', id + ORIGINAL) : null;", ersatz: 'const o = null;', trifft: /ORIGINALFOTO/ },
  { name: 'MANUELL: das Originalfoto bleibt nach der Prüfung liegen', datei: A, anker: 'if (originalWeg) await DB.del(\'files\', id + ORIGINAL);', ersatz: '', trifft: /Original ist danach weg/ },
  { name: 'MANUELL: Löschen lässt das Originalfoto liegen', datei: 'assets/db.js', anker: "st.delete(id); if (store === 'files' && !String(id).endsWith('~original')) st.delete(id + '~original');", ersatz: 'st.delete(id);', trifft: /Original mit/ },
  // „Alle prüfen" (Klaus 2026-10-22)
  { name: 'ALLE: der Knopf fehlt', datei: A, anker: '} else if (offen) {', ersatz: '} else if (false) {', trifft: /Knopf „▶ Alle prüfen"/ },
  { name: 'ALLE: alle zugleich statt nacheinander', datei: A, anker: 'await PRUEF.kette;                         // erst', ersatz: '//', trifft: /nie zwei zugleich/ },
  { name: 'ALLE: Abbrechen tut nichts', datei: A, anker: 'if (ALLE.stopp) break;', ersatz: ';', trifft: /Abbrechen|Noch offen/ },
  { name: 'ALLE: ein Fund öffnet mitten im Lauf ein Fenster', datei: A, anker: "r.stand === 'warnung' && !ALLE.an && ", ersatz: "r.stand === 'warnung' && ", trifft: /kein Fenster/ },
  { name: 'ALLE: die Leiste wird nach dem Einlesen nicht gezeichnet', datei: A, anker: '    wahlLeiste();\n    pruefLeiste();', ersatz: '    wahlLeiste();', trifft: /3 noch nicht geprüft/ },
  { name: 'eingang.js fehlt im Offline-Vorrat', datei: 'sw.js', anker: "'./assets/eingang.js?v=5', ", ersatz: '', trifft: /Offline-Vorrat/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-eingang-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/eingang.mjs')], { env: { ...process.env, WF_WURZEL: kopie, WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const s = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8'); if (s.split(f.anker).length !== 2) { tot++; console.log('  ☠ TOTER ANKER: ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
kopieren();
const basis = lauf();
if (basis.status !== 0) { console.log('Ausgangslage ist schon rot — Gegenprobe misst nichts. Status ' + basis.status + ', Signal ' + basis.signal + (basis.error ? ', ' + basis.error.message : '') + '\n' + (basis.stdout || '').slice(-1500) + '\n' + (basis.stderr || '').slice(-800)); process.exit(2); }
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
