# Abschluss: PDF-Ordner übersetzen (2026-09-25)

## Gebaut

| Wo | Was |
|---|---|
| **Workflow-PDF** | Knopf **🌐 Übersetzen …** mit eigenem Bereich: Ordner vom Gerät oder einzelne PDFs, Ordner wird beim Einlesen benannt (und ist wie jeder Ordner umbenennbar), 🌐-Marke, Ergebnis-Ordner je Sprache (`<Name> · RU`, `<Name> · Gegenprobe RU→DE`), per Kennung verknüpft |
| | Deutsch ↔ Русский ↔ English, jede Richtung; Gegenprobe als eigenes PDF |
| | Seite für Seite **in die Lage des Originals**: Textblöcke aus der Textebene, Hintergrund- und Textfarbe gemessen, Block abgedeckt, Übersetzung an dieselbe Stelle, gleiche Drehung; Bilder und Seiten bleiben |
| | Scans ohne Textebene: **Texterkennung auf dem Gerät** (Tesseract.js, Apache-2.0, `vendor/tesseract/`) |
| | Übersetzer im Browser (`Translator`, Gerät) **oder** KI mit eigenem Schlüssel (Mistral Standard · Anthropic · OpenAI), Wiederholung bei 429/5xx, Prüfung auf abgeschnittene Antworten |
| | „Seite N von M", ⏹ Abbrechen, Zwischenstand je Seite in IndexedDB, Fortsetzen |
| | **🔎 Messen** im Dialog: Übersetzer da? welche Sprachpaare? Textebene ja/nein? Speicher |
| | Kyrillisch über fontkit + Noto Sans (OFL), als Teilmenge eingebettet |
| **Mein-WorkFloh + Tomys-Hub/workfloh** | Knopf **🌐 PDF übersetzen** in der Akte neben „📝 PDF bearbeiten": Datei oder Anhang → Übersetzung (+ Gegenprobe) als neue PDF am Auftrag. KI-Sperre der App (`kiGuard`) gilt auch hier. Texterkennung wird von `/Workflow-PDF/vendor/` geladen; fehlt sie, bleibt die Scan-Seite stehen und der Grund wird genannt |

Weggenommen auf Klaus' Wort („keine halbe Lösung"): der Weg „Text-HTML für den
Chrome-Übersetzer" — er hätte die Gestaltung verloren.

## Gemessen

| | Ergebnis |
|---|---|
| `npm test` (Workflow-PDF) | Syntax · e2e **67 grün** · Übersetzung **48 grün · 0 ROT** |
| `browser_pdf.mjs` (beide WorkFlohs) | **47 grün · 0 ROT**, mit Texterkennung; ohne (`WFPDF_OHNE=1`) ebenfalls grün |
| Gegenproben von Hand | Hinweis „Texterkennung nicht verfügbar" ausgebaut → rot (erst nach Schärfung: zwei Hinweise deckten einander) · `kiGuard` ausgebaut → rot |
| 400 Seiten Handbuch (digital, `npm run messen`) | lesen + Farben + speichern **32 ms/Seite** (12,8 s) · PDF bauen **99 s** · 0,34 MB → **0,86 MB** · Zwischenstand 1,4 MB · Speicher-Spitze **65 MB** |
| 10 gescannte Seiten mit Texterkennung | **2,1 s/Seite** (inkl. Laden) · Speicher-Spitze 47 MB |
| Headless-Chromium 141 | hat **keinen** `Translator` |

Die Mengen-Messung ersetzt den Übersetzer durch einen sofort antwortenden —
**die Übersetzungszeit selbst ist NICHT gemessen**; sie kommt am Gerät dazu.

## Nicht gemessen

- ob Klaus' Tablet-Chrome den `Translator` hat und welche Sprachpaare (→ 🔎 Messen)
- echte Übersetzungsqualität und -zeit, echte KI-Kosten je 400 Seiten
- Klaus' echte Handbücher (Schriften, Tabellen, Spalten)
- Texterkennung auf echten Fotos/Scans schlechter Qualität

## Grenzen (benannt, auch in der App)

- Innerhalb eines Absatzes bricht die Übersetzung neu um; Absätze, Bilder,
  Seiten bleiben. Wird eine Übersetzung viel länger, wird die Schrift kleiner.
- Der Originaltext liegt abgedeckt weiter im PDF (markier- und suchbar).
- Schräg gesetzter Text bleibt stehen.
- WorkFloh: Zwischenstand nur im Speicher — lange Handbücher im großen Werkzeug.
- Datenschutz Abschnitt 4 der WorkFlohs nennt als KI-Anbieter nur Anthropic,
  obwohl Mistral/OpenAI wählbar sind (vorbestehend, nicht angefasst).

## Stundennachweis (gemessen)

Arbeitsbeginn am Zweig laut Reflog **2026-09-25 18:14:41 UTC** (20:14 MESZ),
letzter Code-Commit **18:44:43 UTC** — Spanne aus Reflog und Commit-Zeit der
Maschine. Die Zeit vor dem ersten Handgriff (Lesen des Briefs) hinterlässt keine
Spur und ist nicht enthalten.
