# Abschluss 2026-09-27 · To-Do-Liste Punkte 1–7 (Bibliothek am Handy, Spracheingabe)

Zweig `claude/workflow-repos-todo-list-hbaj1d` in drei Depots. Gemergt:
**Workflow-PDF #65 · Mein-WorkFloh #230 · Tomys-Hub #209** (alle 13:43 UTC).
Vorher in derselben Sitzung: die To-Do-Liste selbst (`docs/TODO.md`, #51–#59).

## Was gebaut ist

| Punkt | Was | Wo |
|---|---|---|
| 1 · Schieberegler Ordner | **nicht von hier.** Zweimal gebaut, einmal behalten: die Parallel-Sitzung hat `assets/schieber.js` (#67) für Feldarten- UND Ordner-Leiste gemergt. Die To-Do-Liste verlangt EINE Bauweise — der eigene Griff ist beim Zusammenführen wieder raus. | — |
| 2 · Pfeil nach oben | ↑ an jeder Karte links neben dem Auswahl-Punkt, erst nach dem Herunterrollen; ein Tipp rollt ganz nach oben | Workflow-PDF |
| 3 · Kopfleiste schmal | ≤ 480 und ≤ 370 px kleinere Knöpfe und Floh, der Schriftzug bricht um statt unter die Knöpfe zu laufen | Workflow-PDF |
| 4 · Erstellungsdatum | Sortierung „Erstellungsdatum" (neueste zuerst) · „📅 Erstellt am" (ein Tag, nur das Anlagedatum, Ortszeit) | Workflow-PDF |
| 5 · Wörter doppelt | Text wird bei jedem Ereignis aus der GANZEN Ergebnisliste gebaut (`zusammenfuegen`) | alle drei (`sprechen.js` byte-1:1) |
| 6 · Laufbalken | sofort beim Tipp, IM Suchfeld (das Feld wird unten höher), „■ Stopp", die Lupe bleibt | alle drei |
| 7 · Zwei Lupen | die Lupe im Platzhalter ist weg, der 🔍-Knopf bleibt | Workflow-PDF |

Nebenbei: der Knopf **„🧠 Suche nach Bedeutung einschalten"** machte die Seite bei 320 px
**328 px** breit — auch auf `main`, vor dieser Arbeit. Er bricht jetzt um.

## Gemessen

- `npm test` in Workflow-PDF nach dem letzten Zusammenführen: **20 Proben, 831 grün · 0 ROT**
  (`bibliothek.mjs` 41 · `sprechen.mjs` 42 · `schieber.mjs` 17 · `scan.mjs` 92).
- Mein-WorkFloh `npm test` **13/13**, `browser_sprechen.mjs` **17 grün**; Tomys-Hub
  `browser_sprechen.mjs` **17 grün**. `sprechen.js` in allen drei Depots auf `main`
  **byte-gleich** (md5 `ba0a86be…`).
- Gegenproben, erster Lauf → nach der Reparatur:

  | | gefangen | durch | falscher Grund | tote Anker |
  |---|---|---|---|---|
  | `gegenprobe_sprechen.mjs` | 22 → **25** | 2 → **0** | 1 → **0** | 0 |
  | `gegenprobe_bibliothek.mjs` | 20 → **17** | 2 → **0** | 1 → **0** | 0 |

  (Bibliothek hat weniger Fälle, weil die acht Griff-Fälle mit dem eigenen Griff rausgingen
  und einer für den 320-px-Knopf dazukam.)

### Was die Gegenprobe gefunden hat — keiner der Funde lag im gebauten Verhalten

| Fund | |
|---|---|
| eine Zeile, die nichts fing | `if (n === letzte) continue;` in `zusammenfuegen` — die zwei Zeilen darunter fangen dasselbe. Raus; gemessen wird der Riegel, der trägt („Angebot Tisch Tisch") |
| Handy-Wächter bei der falschen Breite | bei 360 px passen 40 Striche auch ohne `overflow:hidden`. Erst ab 340 px lief „Stopp" aus dem Balken (gemessen 325 px bei 320 breitem Balken). Jetzt 360 UND 320 |
| 320-px-Wächter blind | mit `isMobile` wächst das Layout-Fenster mit dem Inhalt: `innerWidth` war bei 328 px Inhalt ebenfalls 328. Gemessen wird gegen die gesetzte Breite — und dabei kam der Bedeutungs-Knopf heraus |
| Sabotage brachte die App zum Absturz | „kein Pfeil" nahm den Knopf weg, die Bindung warf, die ganze Bibliothek brach. Jetzt ein leeres Element |
| alter Name im `trifft` | „Fertig" heißt seit diesem Bau „Stopp" |

### Was das Zusammenführen gefunden hat

- **Cache-Nummern doppelt vergeben, dreimal:** Workflow-PDF `v49` und dann `v50`,
  Mein-WorkFloh `v171`, Tomys `v35` — jeweils beide Seiten dieselbe Nummer mit anderem
  Inhalt. Neu gezählt: **v51 · v172 · v36**, `sprache-texte` v20, `app` v44, `style` v23.
- **Mein-WorkFloh pinnt `sprechen.js` per SHA** (`test/smoke.test.js`, seit #226). Mein
  erster Push dorthin hatte `npm test` rot — ich hatte nur die Browser-Probe gefahren. Der Pin
  hat die neue Kopie zu Recht gefangen; nachgezogen.

## Nicht gemessen

- **Klaus' Sichttest, alle sechs Punkte** — am Handy/Tablet, mit dem Finger.
- Echte Spracherkennung auf Android (gestellt: `SpeechRecognition` ist eine Attrappe).
- Im Headless-Chromium geht nach einem Finger-Zug über eine Fläche mit `touch-action:none`
  der **nächste** Tipp verloren (an einer leeren Testseite nachgestellt). Die Probe misst den ↑
  deshalb ohne Zug davor. Ob das am Tablet auch so ist: ungemessen.
- Punkte 2 und 3 in den WorkFlohs: mitgeprüft, **nicht gebaut** — dort gibt es weder eine
  Karten-Liste mit Auswahl-Punkt noch diese Kopfleiste.

## Vorgefunden, nicht behoben

- `tests/gegenprobe_suche.mjs`: **ein toter Anker** („beim Einlesen wird kein Text erfasst …"),
  auch auf `main`.
- Tomys-Hub: `tests/smoke-spore-download.cjs` (stirbt) und `tests/smoke-verbund.cjs`
  (15/16) sind **auch auf `main` rot** — nicht von dieser Arbeit.

## Stundennachweis (gemessen, UTC)

| | |
|---|---|
| Beginn | **12:02:52** — erster Handgriff am Zweig (Reflog, Workflow-PDF) |
| Ende Bau | **13:43:40** — letzter der drei Merges (Tomys-Hub #209) |
| Spanne Bau | **1 h 40 min** |

Danach kamen noch dieser Brief und der Forschungseintrag; deren Ende steht im Eintrag in
Kimhub (`forschung/sitzungen.json`), gemessen nach dem letzten Commit. Die Zeit **vor** dem
ersten Handgriff (die To-Do-Liste, #51–#59) steht nicht in dieser Spanne.
Die Spanne ist die Obergrenze von Klaus' Arbeitszeit; seine Pausen sind nicht abgezogen.
