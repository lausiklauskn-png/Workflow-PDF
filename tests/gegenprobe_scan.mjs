/* Gegenprobe zu tests/scan.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Fall, der nur fremde Zeilen rot macht, gilt als „aus falschem Grund".
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser); NUR_FALL=<Teil des Namens> fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_scan.mjs */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FAELLE = [
  { name: 'uneinig heißt trotzdem „sicher"', datei: 'assets/scan-bild.js', anker: "return { ecken: ml, quelle: 'ml', sicher: false, grund: bl || kl", ersatz: "return { ecken: ml, quelle: 'ml', sicher: true, grund: bl || kl", trifft: /NICHT sicher|KEIN Foto/ },
  { name: 'schwaches Modell zählt mit', datei: 'assets/scan-bild.js', anker: '!(eing.ml.score != null && eing.ml.score < 0.5)', ersatz: 'true', trifft: /schwaches Modell/ },
  { name: 'Blatterkennung allein gilt als sicher', datei: 'assets/scan-bild.js', anker: "if (bl) return { ecken: bl, quelle: 'blatt', sicher: false", ersatz: "if (bl) return { ecken: bl, quelle: 'blatt', sicher: true", trifft: /nur eine Meinung|KEIN Foto/ },
  { name: 'winzige Vierecke gelten als Blatt', datei: 'assets/scan-bild.js', anker: 'return flaeche(e) >= w * h * 0.05;', ersatz: 'return true;', trifft: /winziges Viereck/ },
  { name: 'Grenze der Einigkeit viel zu weit', datei: 'assets/scan-bild.js', anker: 'const EINIG = 4;', ersatz: 'const EINIG = 40;', trifft: /uneinig|KEIN Foto/ },
  { name: 'quer wird nie erkannt', datei: 'assets/scan-bild.js', anker: 'const quer = br > ho;', ersatz: 'const quer = false;', trifft: /Letter quer/ },
  { name: 'drehen dreht falsch herum', datei: 'assets/scan-bild.js', anker: 'if (n === 1) { X = h - 1 - y; Y = x; }', ersatz: 'if (n === 1) { X = y; Y = w - 1 - x; }', trifft: /drehen rechts/ },
  { name: 'Hintergrund wird nicht geschätzt (Schatten bleibt)', datei: 'assets/scan-bild.js', anker: 'const g = Math.max(bg[p], 30), norm', ersatz: 'const g = 250, norm', trifft: /Schatten weg/ },
  { name: 'Schwarzweiß-Schwelle kaputt', datei: 'assets/scan-bild.js', anker: 'const v = norm < 0.8 ? 0 : 255;', ersatz: 'const v = norm < 0.8 ? 0 : 200;', trifft: /Schwarzweiß/ },
  { name: 'Kontrast wirkt verkehrt', datei: 'assets/scan-bild.js', anker: 'const k = kon >= 0 ? 1 + kon / 50 : 1 + kon / 125', ersatz: 'const k = kon >= 0 ? 1 - kon / 125 : 1 + kon / 125', trifft: /Kontrast/ },
  { name: 'Farben von Papier und Schrift vertauscht', datei: 'assets/scan-bild.js', anker: 'return { grund: mittel(hellst), schrift: mittel(dunkelst) };', ersatz: 'return { grund: mittel(dunkelst), schrift: mittel(hellst) };', trifft: /textFarben/ },
  { name: 'Modell sucht seine Dateien im Netz statt in vendor/scanic/', datei: 'assets/scanner.js', anker: "ml: { assetBaseUrl: new URL('vendor/scanic/', location.href).href }", ersatz: 'ml: {}', trifft: /Modell \(Scanic ML\) lief|kein Aufruf ins Netz/ },
  { name: 'gezogene Ecke gilt nicht als „von Hand"', datei: 'assets/scanner.js', anker: 's.ecken[i] = [x / f, y / f]; s.manuell = true;', ersatz: 's.ecken[i] = [x / f, y / f];', trifft: /von Hand gesetzt/ },
  { name: '↺ Automatisch holt die Ecken nicht zurück', datei: 'assets/scanner.js', anker: 's.manuell = false; s.ecken = s.erkennung.ecken.map(p => p.slice());', ersatz: 's.manuell = false;', trifft: /Automatisch setzt/ },
  { name: 'Drehen tut nichts', datei: 'assets/scanner.js', anker: 's.drehung = (s.drehung + (+k.dataset.dreh) + 4) % 4;', ersatz: '', trifft: /dreht die Seite/ },
  { name: 'Umordnen tauscht nicht', datei: 'assets/scanner.js', anker: 'const x = ST.seiten[a]; ST.seiten[a] = ST.seiten[b]; ST.seiten[b] = x;', ersatz: '', trifft: /tauscht die Reihenfolge/ },
  { name: 'geänderter Text wird nicht ins Bild geschrieben', datei: 'assets/scanner.js', anker: 'if (mitText !== false && s.ocr) textAnwenden(c, img, s);', ersatz: '', trifft: /neu geschrieben/ },
  { name: 'keine Textebene im PDF', datei: 'assets/scanner.js', anker: 'if (ST.durchsuchbar && s.ocr) {', ersatz: 'if (false) {', trifft: /durchsuchbar/ },
  { name: 'Textebene trägt den alten Text', datei: 'assets/scanner.js', anker: 'const zeilenText = (s, i) => (s.aenderungen', ersatz: 'const zeilenText = (s, i) => s.ocr.zeilen[i].text; const _alt = (s, i) => (s.aenderungen', trifft: /alte Text nicht mehr/ },
  { name: 'ungeprüfte Seite wird ohne Frage übernommen', datei: 'assets/scanner.js', anker: 'if (offen && !await ST.opt.frage(', ersatz: 'if (false && !await ST.opt.frage(', trifft: /fragt vor dem Übernehmen/ },
  { name: 'ZIP enthält keine Bilder', datei: 'assets/scanner.js', anker: 'bytes: await jpeg(alsKopie(ST.seiten[i]) ? kopieRechnen(ST.seiten[i], Q.dpi).canvas : seiteRechnen(ST.seiten[i], Q.dpi, true).canvas, Q.q)', ersatz: 'bytes: new Uint8Array(8)', trifft: /ZIP mit einem JPEG/ },
  // Kopie und Nebeneinander (2026-09-27)
  { name: 'Deckfläche und Text in EINEM Durchgang (Band löscht Unterlängen)', datei: 'assets/scanner.js', anker: 'x.closePath(); x.fill();\n    }', ersatz: "x.closePath(); x.fill();\n      if (j.neu) { const st = stilVon(s, j.i); schreibe(x, j.neu, verschoben(j.l, st, W, H), j.l.fs * st.gr, j.l.winkel, '#000', st); }\n    }", extra: { datei: 'assets/scanner.js', anker: '    for (const j of jobs) if (j.neu) {', ersatz: '    for (const j of []) if (j.neu) {' }, trifft: /Unterlängen/ },
  { name: 'Grundlinie wird nicht gemerkt', datei: 'assets/scanner.js', anker: 'if (bl && ra && ra.rowHeight > 0 && bl.x1 > bl.x0) {', ersatz: 'if (false) {', trifft: /Grundlinie und Schrifthöhe/ },
  { name: 'Ausrichtung wird in der Kopie nicht beachtet', datei: 'assets/scanner.js', anker: "const ab = st.ausr === 'r' ? l.laenge - br : st.ausr === 'm' ? (l.laenge - br) / 2 : 0;", ersatz: 'const ab = 0;', trifft: /rechten Rand/ },
  { name: 'Ziehen in der Kopie verschiebt nichts', datei: 'assets/scanner.js', anker: 'st.dx += (ev.clientX - x0) / r.width; st.dy += (ev.clientY - y0) / r.height;', ersatz: '', trifft: /verschiebt die Zeile/ },
  { name: 'PDF nimmt trotz „Kopie" das Foto', datei: 'assets/scanner.js', anker: "const alsKopie = s => s.ausgabe === 'kopie' && s.ocr;", ersatz: 'const alsKopie = s => false;', trifft: /KEIN Bild auf der Seite/ },
  { name: 'neu fotografieren hängt eine Seite an', datei: 'assets/scanner.js', anker: "const alt = ST.ersetze ? ST.seiten.findIndex(o => o.id === ST.ersetze) : -1;", ersatz: 'const alt = -1;', trifft: /ersetzt die Seite/ },
  { name: 'nur das Original, keine Kopie daneben', datei: 'assets/scanner.js', anker: "const tafeln = v === 'neben' ? ['original', 'kopie'] : [v];", ersatz: "const tafeln = ['original'];", trifft: /nebeneinander/ },
  { name: '„Aus der Galerie" weiß auf weiß', datei: 'assets/style.css', anker: '.scan-leer .knopf:not(.rot){color:var(--ink)}', ersatz: '', trifft: /Galerie/ },
  { name: 'Seite ist nicht A4', datei: 'assets/scan-bild.js', anker: 'else { pw = quer ? A4.h : A4.w; ph = quer ? A4.w : A4.h; }', ersatz: 'else { pw = quer ? 800 : 600; ph = quer ? 600 : 800; }', trifft: /A4/ },
  { name: "KI: Textmaske hat weißen Grund", datei: "assets/scanner.js", anker: "if (!durchsichtig) { x.fillStyle = '#fff';", ersatz: "if (true) { x.fillStyle = '#fff';", trifft: /durchsichtig/ },
  { name: "KI: Knopf ohne Bauart des Rezeptbuchs", datei: "assets/style.css", anker: "background:linear-gradient(90deg,#b71a13,#E0231B,#1d4ed8,#E0231B,#b71a13)", ersatz: "background:#E0231B", trifft: /Bauart wie im Rezeptbuch/ },
  { name: "ABLAGE: Herunterladen legt nicht mehr ab", datei: "assets/scanner.js", anker: "ST.opt.laden(datei() + '.pdf', b, 'application/pdf'); const ab = await ablegen(b);", ersatz: "ST.opt.laden(datei() + '.pdf', b, 'application/pdf'); const ab = false;", trifft: /lädt herunter UND legt/ },
  { name: "ABLAGE: zweites Ablegen legt ein Doppel an", datei: "assets/scanner.js", anker: "{ name: ST.name, id: ST.abgelegt || null }", ersatz: "{ name: ST.name, id: null }", trifft: /ersetzt dasselbe Dokument/ },
  { name: "ABLAGE: PDF erstellen vergisst das abgelegte Dokument", datei: "assets/scanner.js", anker: "name = ST.name, id = ST.abgelegt || null;", ersatz: "name = ST.name, id = null;", trifft: /DASSELBE Dokument/ },
  { name: "ABLAGE: Bibliothek ersetzt nicht, sondern legt neu an", datei: "assets/app.js", anker: "if (alt) { await dokErsetzen(alt, info.name, bytes);", ersatz: "if (false) { await dokErsetzen(alt, info.name, bytes);", trifft: /ersetzt dasselbe Dokument|DASSELBE Dokument/ },
  { name: "BILD: Auftrag verlangt keine bessere Qualität", datei: "assets/scan-bild.js", anker: "Verbessere dabei die Bildqualität: Schrift gestochen scharf und gut lesbar, Unschärfe und Rauschen entfernt, Layout und Farben wie im Original. ", ersatz: "", trifft: /Bild-Auftrag: kurz/ },
  { name: "BILD: ChatGPT-Bild wird auf die Qualitätsstufe heruntergerechnet", datei: "assets/scanner.js", anker: "const dpi = s.kiBild ? eigeneDpi(s, Q.dpi) : Q.dpi;", ersatz: "const dpi = Q.dpi;", trifft: /SEINER Auflösung/ },
  { name: "BILD: Auftrag vergisst die gewählte Sprache", datei: "assets/scan-bild.js", anker: "const sp = BILD_SPRACHEN[(o || {}).nach] || 'Deutsch';", ersatz: "const sp = 'Deutsch';", trifft: /Sprache kommt aus der Wahl|nennt die gewählte Sprache/ },
  { name: "BILD: Auftrag verlangt kein Bild zurück", datei: "assets/scan-bild.js", anker: "Gib mir das fertige Bild in möglichst hoher Auflösung zurück.", ersatz: "Antworte mit dem Text.", trifft: /Bild-Auftrag: kurz/ },
  { name: "BILD: Teilen gibt nur den Text, kein Bild", datei: "assets/scanner.js", anker: "await navigator.share({ files: [datei], text: auftrag });", ersatz: "await navigator.share({ files: [], text: auftrag });", trifft: /teilt Seitenbild/ },
  { name: "BILD: Sprachwahl wird nicht gemerkt", datei: "assets/scanner.js", anker: "onchange = e => { merk.bildNach = e.target.value; merken(); };", ersatz: "onchange = e => {};", trifft: /gewählte Sprache \(Russisch\)/ },
  { name: "BILD: ohne Teilen passiert nichts", datei: "assets/scanner.js", anker: "window.open('https://chatgpt.com/', '_blank', 'noopener');", ersatz: "", trifft: /Ohne Teilen/ },
  { name: "BILD: zurückgeholtes Bild wird zugeschnitten und gefiltert", datei: "assets/scanner.js", anker: "if (o.bildKi) Object.assign(s, { filter: 'original',", ersatz: "if (false) Object.assign(s, { filter: 'original',", trifft: /IST die Seite/ },
  { name: "BILD: Ergebnis landet am Ende statt dahinter", datei: "assets/scanner.js", anker: "else if (hinter >= 0) { ST.seiten.splice(hinter + 1, 0, s);", ersatz: "else if (false) { ST.seiten.splice(hinter + 1, 0, s);", trifft: /Seite dahinter/ },
  // Lupe und Handy-Platz (Klaus 2026-09-27). Die Größe halten ZWEI Riegel (Inline-Maß UND die CSS-Regel mit
  // höherem Vorrang als `.scan-bild canvas{width:100%}`) — der Fall nimmt beide, sonst misst er nichts.
  { name: "LUPE: wieder so groß wie das ganze Bild", datei: "assets/scanner.js", anker: "lupe.style.width = lupe.style.height = d + 'px';", ersatz: "", extra: { datei: "assets/style.css", anker: ".scan-bild canvas.scan-lupe{", ersatz: ".scan-lupe{" }, trifft: /Lupe ist klein/ },
  { name: "LUPE: feste 120 px statt nach dem Bild", datei: "assets/scanner.js", anker: "return Math.max(56, Math.min(84, Math.round(Math.min(W, H) / 5)));", ersatz: "return 120;", trifft: /Lupe ist klein|≤ 64 px/ },
  { name: "LUPE: liegt über dem Punkt", datei: "assets/scanner.js", anker: "lx = Math.max(0, Math.min(W - d, lx)); ly = Math.max(0, Math.min(H - d, ly));", ersatz: "lx = x - d / 2; ly = y - d / 2;", trifft: /NICHT über dem Punkt|deckt den Punkt nicht/ },
  { name: "HANDY: Foto bekommt wieder nur einen Streifen", datei: "assets/style.css", anker: ".scan-buehne{flex:none;height:52vh;height:52dvh}", ersatz: ".scan-buehne{flex:none;height:20vh;height:20dvh}", trifft: /ein Drittel der Höhe/ },
  { name: "HANDY: Bild ragt über die Bühne, Ecken nicht greifbar", datei: "assets/scanner.js", anker: "const maxW = Math.max(60, b.clientWidth - 40), maxH = Math.max(60, b.clientHeight - 40);", ersatz: "const maxW = Math.max(60, b.clientWidth + 120), maxH = Math.max(60, b.clientHeight + 120);", trifft: /alle vier Ecken sind zu greifen/ }
];

const NUR = process.env.NUR_FALL; if (NUR) FAELLE.splice(0, FAELLE.length, ...FAELLE.filter(f => f.name.includes(NUR)));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/scan.mjs')], { env: { ...process.env, WURZEL: kopie }, encoding: 'utf8', timeout: 600000 });

if (process.env.NUR_ANKER) {
  for (const f of FAELLE) { const n = fs.readFileSync(path.join(WURZEL, f.datei), 'utf8').split(f.anker).length - 1; if (n !== 1) { tot++; console.log('  ☠ TOTER ANKER (' + n + '×): ' + f.name); } }
  console.log(`${FAELLE.length} Anker geprüft · ${tot} tot`); process.exit(tot ? 1 : 0);
}
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
