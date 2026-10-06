# Abschluss 2026-10-06 · Teilen-Liste, Zuschneiden, Schärfe

Zweig `claude/workflow-pdf-open-list-tromzm`. Nächster Brief:
`docs/sessions/BRIEF_workflohs-faehigkeiten.md`.

## 1 · Gemergt

| Depot | PR | was |
|---|---|---|
| Workflow-PDF | #96 | in der Teilen-Liste und bei „Öffnen mit" (`share_target`, `file_handlers`, `launchQueue`) |
| Workflow-PDF | #97 | ✂️ Zuschneiden im Editor |
| Workflow-PDF | #98 | Hinweis: die Pages-Auslieferung nach dem Merge scheiterte bei GitHub |
| Workflow-PDF | #99 | Zuschneiden legt ein **zweites** Dokument „(zugeschnitten)" an, das Original bleibt |
| Workflow-PDF | #100 | 🔪 Schärfe-Regler, weiche Kanten bei Schwarzweiß, feinere Vorschau |
| Mein-WorkFloh | #253 | Teilen → WorkFloh: der Worker wird sofort angemeldet (vorher „405 Not Allowed" von GitHub Pages) |
| Mein-WorkFloh | #254 | Schärfe byte-1:1 übernommen |
| Tomys-Hub | #233 | Schärfe byte-1:1 übernommen |
| Kim-sync | #17 | Teilen → Kim-sync: derselbe 405-Fehler, derselbe Weg |

## 2 · Gemessen

- `tests/scan.mjs` **119 grün · 0 ROT**. Schärfe 0 / 40 / 80 an einem blassen Strich: Dokument Kern
  90 / 52 / 22, Schwarzweiß Rand 114 / 59 / 17. Vorgabe 40.
- Gegenprobe `SCHAERFE:` **6 gefangen · 0 durchgerutscht · 0 tote Anker**. Der erste `NUR_ANKER`-Gang
  meldete einen toten Anker („Schwarzweiß-Schwelle kaputt"), nachgezogen.
- WorkFlohs: `wfpdf_kanon` 37 grün, `browser_scan` 46 grün, in beiden.
- Teilen-Empfang (Workflow-PDF, Mein-WorkFloh, Kim-sync): ein geteiltes Formular erreicht den Server
  **nie**, es landet im Vorrat des Workers.
- Nebenbei gefunden: `zuschneiden(c)` gab es schon (Unterschrift). Die erste Fassung hieß gleich, die spätere
  Deklaration gewann. Seitdem prüft `tests/zuschneiden.mjs`, dass kein Funktionsname in app.js zweimal steht.

## 3 · Nicht gemessen

- Schärfe, Zuschneiden und Teilen **am Tablet**. Klaus' Sichttest steht aus.
- Ob Android die App bei „Öffnen mit" anbietet (`file_handlers` ist am Desktop-Chrome belegt).
- Wer eine App vor diesem Stand installiert hat, öffnet sie einmal (oder tippt ⟳), bevor er teilt.
- Klaus' echtes Formular (es trägt Lohndaten und kommt in kein Depot).

## 4 · Bestandsaufnahme für den nächsten Schritt

Klaus: *„Wenn ich im Workflow arbeite … möchte ich nicht immer zwischen zwei Apps hin und her fliegen
… weil das ja dieselbe Software ist."* Nachgezählt mit `git grep` auf `origin/main` (0 = fehlt in beiden
WorkFlohs): Prüfung beim Einlesen, Suche im Seitentext, Bedeutungssuche, Sprachschicht, Zuschneiden,
„Öffnen mit", Arbeitsstand-Datei. Tomys WorkFloh erwartet einen geteilten POST (`index.html`), sein Manifest
trägt aber kein `share_target`. Die Tabelle und die Reihenfolge stehen im Brief.

## Stundennachweis

Erster Handgriff **12:21:33 UTC** (Reflog `checkout`), letzter Commit der Arbeit **16:38:42 UTC**
(Tomys-Hub #233), dazu die Commits dieser beiden Briefe. Das sind rund **4 h 17 min** bis zum letzten
Arbeits-Commit. Die Spanne ist die **Obergrenze** von Klaus' Arbeitszeit (seine Auskunft vom 2026-09-22).
Pausen sind nicht abgezogen, und die Zeit vor dem ersten Handgriff hinterlässt keine Spur. Sie wird nicht zu
den Commit-Stunden addiert.
