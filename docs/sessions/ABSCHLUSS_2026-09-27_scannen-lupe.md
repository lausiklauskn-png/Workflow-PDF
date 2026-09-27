# Abschluss 2026-09-26/27 · Scannen: vom Foto zum PDF, ChatGPT-Weg, Ablage, Qualität, kleine Lupe

Zweig `claude/pwa-pdf-scanner-research-yzpmks`. Gemergt: #43 bis #48 und der PR zu Lupe und
Handy-Platz aus diesem Durchgang.

## Was gebaut ist

| PR | Was |
|---|---|
| #43 | 📷 Scannen: Foto → Blatt finden (drei Meinungen) → Ecken ziehen → gerade ziehen → Filter → PDF |
| #44 | Kopie neben Original, Zeilen einstellen, Text sauber überdrucken |
| #45 | Text mit ChatGPT erkennen · 🎭 Textmaske mit durchsichtigem Grund |
| #46 | Ein Knopf zu ChatGPT (Bild + kurzer Auftrag), ein Knopf zurück. Der Textlisten-Weg ist entfernt. |
| #47 | Herunterladen, Teilen und „PDF erstellen" legen das PDF auch in der Bibliothek ab. Ein zweites Mal ersetzt dasselbe Dokument. |
| #48 | Qualität: Der Auftrag verlangt scharfe Schrift und hohe Auflösung, das Bild geht mit 300 dpi hinaus und kommt in voller Auflösung ins PDF. |
| (dieser) | Lupe klein und neben dem Punkt · am Handy bekommt das Foto Platz, alle Ecken sind greifbar |

## Gemessen

- **Lupe:** vorher **431×574 px bei einem 431×574-Bild**, also das ganze Bild. Die CSS-Regel
  `.scan-bild canvas{width:100%}` war stärker als `.scan-lupe{width:120px}`.
  Jetzt 81–84 px am Rechner und 56 px am Handy (360×740). Die Lupe steht neben dem Punkt, nie darauf.
- **Handy 360×740:** Vorher bekam das Foto 156 px, und die zwei oberen Ecken lagen unter der
  Kopfleiste. Die Ecke oben links traf `elementFromPoint` → `scan-kopf`.
  Jetzt ist das Foto 259×345 px groß, alle vier Ecken sind greifbar, und der Rest des
  Fensters rollt.
- `tests/scan.mjs` steht bei **92 grün · 0 ROT**.
- Gegenprobe `LUPE:` 3 gefangen, `HANDY:` 2 gefangen, 0 durchgerutscht, 0 aus falschem Grund.
- `NUR_ANKER` meldet 50 Anker, 0 tot.
- **WorkFlohs, SHA-256 gegen `origin/main`:**
  - byte-gleich mit Workflow PDF: erkennung · export · html-export · uebersetzung · blatt ·
    zip · sprechen · pdf-lib · fontkit
  - **fehlen dort ganz:** scanner · scan-bild · Scanic
  - `typAusLabel` in app.js ≠ werkzeug.js.
  - Details: `BRIEF_workflohs-dieselbe-maschine.md`.

## Nicht gemessen

- Echte ChatGPT-Antworten und ihre Qualität.
- Die Lupe am echten Tablet oder Handy mit dem Finger. Gemessen wurde mit Maus-Ereignissen
  in Chromium bei 360×740.
- Querformat am Handy (740×360): Das Foto bleibt dort klein (110×147). Die Ecken sind
  greifbar, schön ist es nicht.
- „Zwei Seiten": Seite 1 ist das Original, Seite 2 das ChatGPT-Ergebnis. Das ist so gebaut,
  Klaus prüft es beim Drucken.

## Stundennachweis

Gemessen aus Reflog und Commit-Zeiten. Klaus' Pausen sind nicht abgezogen, weil sie keine
Spur hinterlassen.

- Teil 1: 2026-09-26 22:26Z (Arbeitsbeginn im Behälter) bis 2026-09-27 02:05Z (Merge #48),
  also **3 h 39 min**.
- Teil 2: 2026-09-27 12:57Z bis zum Merge dieses PRs. Die genaue Zeit steht im
  Kimhub-Eintrag `2026-09-27-lupe-und-workfloh-auftrag`.
- Zwischen 02:05Z und 12:56Z gibt es keine Spur. Diese Zeit ist nicht gezählt.

## Nächster Auftrag

`BRIEF_workflohs-dieselbe-maschine.md`: die WorkFlohs bekommen dieselbe Scan- und
Bearbeiten-Maschine wie Workflow PDF.
