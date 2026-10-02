/* Gegenprobe zu tests/sicherung.mjs: baut in einer WEGWERF-KOPIE je einen Fehler ein.
   Jeder Fall muss die Probe umwerfen — mit einer roten Zeile, die zu ihm passt („trifft").
   Ein Anker, der nicht genau einmal vorkommt, ist ein toter Anker — dann wurde nichts sabotiert.
   NUR_ANKER=1 prüft nur die Anker (Sekunden, ohne Browser). NUR_FALL="…" fährt nur passende Fälle.
   Nicht in npm test (dauert); Aufruf: node tests/gegenprobe_sicherung.mjs
   BENANNTE GRENZE: das Schloss selbst (schluesseltresor.js) hat keinen Fall außer dem Pin —
   es ist byte-1:1 und wird an seiner Quelle geprüft. */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const S = 'assets/sicherung.js', A = 'assets/app.js', T = 'assets/schluesseltresor.js';
const FAELLE = [
  { name: 'das Schloss wird hier abgewandelt', datei: T, anker: ' * schluesseltresor.js — DER SCHLÜSSEL DES NUTZERS, IM BROWSER.', ersatz: ' * schluesseltresor.js — hier abgewandelt.', trifft: /byte-1:1/ },
  { name: 'die Datei trägt den Inhalt offen statt verschlossen', datei: S, anker: 'const paket = await T.zu(pw, JSON.stringify(inhalt));', ersatz: 'const paket = Object.assign(await T.zu(pw, "x"), { offen: inhalt });', trifft: /KEIN Klartext|kein Klartext/ },
  { name: 'ein falsches Passwort wird als Fassung gemeldet', datei: S, anker: "throw new Error(e && e.message === 'fassung' ? 'fassung' : 'passwort');", ersatz: "throw new Error('fassung');", trifft: /falsches Passwort/ },
  { name: 'die Fassung wird nicht geprüft', datei: S, anker: 'if (datei.fassung !== FASSUNG || datei.paket.v !== 1) throw new Error(\'fassung\');', ersatz: '', trifft: /andere Fassung/ },
  { name: 'Zurückholen überschreibt Vorhandenes', datei: S, anker: 'if (daD.has(d.id)) { schonDa++; continue; }', ersatz: 'if (daD.has(d.id)) schonDa++;', trifft: /überschreibt nichts|nichts doppelt|unberührt/ },
  { name: 'ein Prüf-Befund aus der Datei wird geglaubt', datei: S, anker: 'delete k.pruefung;', ersatz: ';', trifft: /nicht geglaubt/ },
  { name: 'ein fehlender Ordner bleibt als Verweis stehen', datei: S, anker: 'if (k.folderId && !daO.has(k.folderId)) k.folderId = null;', ersatz: ';', trifft: /nicht erfunden/ },
  { name: 'ein Dokument ohne Datei wird still übergangen', datei: S, anker: 'if (b) dateien.push({ id: d.id, b64: zuB64(b) }); else ohne++;', ersatz: 'if (b) dateien.push({ id: d.id, b64: zuB64(b) });', trifft: /ohne Datei/ },
  { name: 'die Erinnerung zählt auch nach 14 Tagen nicht', datei: S, anker: 'tageSeit(zuletztIso, jetzt) >= ERINNERN_TAGE', ersatz: 'tageSeit(zuletztIso, jetzt) > 10000', trifft: /14 Tagen/ },
  { name: '„Später" wirkt nicht', datei: S, anker: 'anzahlDocs > 0 && !spaeter &&', ersatz: 'anzahlDocs > 0 &&', trifft: /Später/ },
  { name: 'das Passwort wird gemerkt', datei: A, anker: "lsSetz(SICH_ZULETZT, r.datei.erstellt);", ersatz: "lsSetz(SICH_ZULETZT, r.datei.erstellt); lsSetz('wfpdf_pw', p1);", trifft: /nirgends abgelegt/ },
  { name: 'ein zu kurzes Passwort geht durch', datei: A, anker: "if (p1.length < SI.MIN_PW) { e.textContent = 'Das Passwort braucht mindestens ' + SI.MIN_PW + ' Zeichen.'; return; }", ersatz: '', trifft: /zu kurzes/ },
  { name: 'nach dem Zurückholen wird die Liste nicht neu geladen', datei: A, anker: "await ladeBibliothek();\n        } catch (err) { e.textContent = '⚠️ ' + (SICH_FEHLER[err && err.message] || 'Zurückholen", ersatz: "\n        } catch (err) { e.textContent = '⚠️ ' + (SICH_FEHLER[err && err.message] || 'Zurückholen", trifft: /in der Liste/ },
  { name: 'die Erinnerung erscheint nie', datei: A, anker: "if (!SI || !SI.erinnernNoetig(n, zuletzt, lsLies(SICH_SPAETER, true) === '1')) { el.hidden = true;", ersatz: "if (true) { el.hidden = true;", trifft: /nie gesichert|kommt die Erinnerung/ },
  { name: 'der Speicher-Stand wird nicht genannt', datei: A, anker: 'dauerStand().then(dauerZeigen);', ersatz: ';', trifft: /Speicher-Stand|Fehler/ },
  { name: 'die Einstellungen führen nicht hin', datei: A, anker: 'id="stSicherung"', ersatz: 'id="stSicherungWeg"', trifft: /Einstellungen/ }
];

let gefangen = 0, durch = 0, falsch = 0, tot = 0;
const nur = process.env.NUR_FALL;
const kopie = fs.mkdtempSync(path.join(os.tmpdir(), 'wfpdf-gp-sicherung-'));
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
const lauf = () => spawnSync('node', [path.join(kopie, 'tests/sicherung.mjs')], { env: { ...process.env, WF_WURZEL: kopie }, encoding: 'utf8', timeout: 240000 });

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
