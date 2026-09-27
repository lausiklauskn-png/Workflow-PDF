# Brief für die nächste Sitzung · To-Do-Punkte 2–7 am Gerät prüfen lassen, Reste aufräumen

Stand: 2026-09-27, nach Workflow-PDF #65 · Mein-WorkFloh #230 · Tomys-Hub #209.
Vorher lesen: `CLAUDE.md` (Workflow-PDF), `docs/TODO.md`,
`docs/sessions/ABSCHLUSS_2026-09-27b_todo-2-7.md`.
Parallel offen und NICHT Teil dieses Briefs: `docs/sessions/BRIEF_workflohs-dieselbe-maschine.md`
(Scan- und Bearbeiten-Maschine in die WorkFlohs) — wer beides anfasst, fängt dort an.

## 1 · Klaus' Sichttest — zuerst, bevor gebaut wird

Adresse: https://lausiklauskn-png.github.io/Workflow-PDF/ (einmal ⟳ tippen, damit Cache v51 kommt).
Am schmalen Handy oder schmal gezogenen DeX-Fenster:

1. **↑ an der Karte:** nach unten rollen → links neben dem Auswahl-Punkt steht ↑ → antippen → ganz oben.
2. **Kopfleiste:** „Workfloh PDF" ist ganz zu lesen, DE · ⟳ · ? · ⚙️ liegen nicht darauf.
3. **Erstellungsdatum:** Sortieren → „Erstellungsdatum"; „📅 Erstellt am" → ein Tag → nur Dokumente dieses Tages.
4. **Spracheingabe:** 🎤 → Balken steht SOFORT im Suchfeld → „kopieren" sagen → steht EINMAL da → „■ Stopp".
5. **Eine Lupe** im leeren Suchfeld.
6. Dasselbe 🎤 in **Mein-WorkFloh** und **Tomys WorkFloh** (Suchfeld der Aufträge).

Sagt Klaus „nicht in Ordnung", ist der Punkt nicht fertig — Befund wörtlich in `docs/TODO.md`.

## 2 · Reste, die vorgefunden und nicht behoben sind

- `tests/gegenprobe_suche.mjs`: toter Anker „beim Einlesen wird kein Text erfasst …" (auch auf `main`).
  Zieh den Fall nach (der Anker trifft zweimal) — nicht „bau einen Wächter".
- Tomys-Hub: `tests/smoke-spore-download.cjs` und `tests/smoke-verbund.cjs` sind auf `main` rot.
  Ursache nicht untersucht.
- `gegenprobe_ordner.mjs`, `gegenprobe_suche.mjs`, `gegenprobe_teile.mjs` kennen kein `NUR_ANKER=1`.

## 3 · Worauf man hier achten muss (an diesem Tag gemessen)

- **Cache-Nummern kollidieren**, wenn zwei Sitzungen parallel an einem Depot bauen: an einem Tag
  dreimal. Nach JEDEM Zusammenführen die Nummer neu zählen, nicht nur davor.
- **Mein-WorkFloh pinnt die `wfpdf/`-Kopien per SHA** (`test/smoke.test.js`): wer eine geteilte
  Datei neu kopiert, zieht den Pin nach — und fährt dort `npm test`, nicht nur die Browser-Probe.
- **`isMobile` in Playwright:** das Layout-Fenster wächst mit dem Inhalt. „Nichts läuft quer" wird
  gegen die GESETZTE Breite gemessen, nicht gegen `innerWidth`.

## Abschluss (Pflicht)

Abschlussbrief mit gemessenem Stundennachweis (Reflog-Beginn, letzter Commit, UTC) ·
Forschungseintrag in Kimhub (`node tools/sitzung-eintragen.mjs`, `arm: "voll"`, `ende` NACH dem
letzten Commit) · neuer Brief, auch als Codeblock im Chat.
