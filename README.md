# Workfloh PDF

**Workflow PDF** ist eine installierbare Web-App (PWA) für Formulare: PDF oder
Foto einlesen, Formularfelder erkennen lassen oder selbst setzen, ausfüllen und
als **festes** oder **ausfüllbares** PDF ausgeben. Offline, ohne Konto, ohne
Build-Schritt. Maskottchen: **W-Floh**.

App: <https://lausiklauskn-png.github.io/Workflow-PDF/>

## Was die erste Fassung kann

| | |
|---|---|
| **Einlesen** | PDF oder Bild aus dem Dateiordner · Formular fotografieren (mehrere Seiten) · ganzen Ordner einlesen · Dateien auf die Seite ziehen · Seiten an ein Dokument anhängen |
| **Ordner** | Dokumente in Ordnern ablegen, verschieben, duplizieren (als Vorlage), löschen |
| **Vorhandene Formulare** | Felder, die schon im PDF stehen, werden samt Wert übernommen |
| **Erkennen, offline** | Unterstriche, Eingabe-Rahmen und Kästchen im Seitenbild; bei digitalen PDFs kommt die Beschriftung aus dem Text daneben |
| **Erkennen, mit KI** | freiwillig, eigener Schlüssel (Mistral · EU, Anthropic, OpenAI). Die KI liefert Bezeichnungen und den Seitentext; ihre Positionen rasten an die offline gefundenen Linien ein |
| **Vorschläge prüfen** | Erkanntes ist orange gestrichelt, bis es bestätigt wird — einzeln („✓ Passt") oder alle |
| **Felder von Hand** | Text, Datum, Kästchen, E-Mail, Internetadresse, QR-Code: Art wählen, auf die Stelle tippen, verschieben, am roten Punkt vergrößern |
| **Ausfüllen** | direkt auf der Seite schreiben |
| **Ausgeben** | festes PDF · ausfüllbares PDF (vorbelegt) · leere ausfüllbare Vorlage · Ansehen/Drucken |
| **🌐 Übersetzen** (seit 2026-09-25) | eigener Bereich mit selbst benannten Ordnern · ganze Ordner oder einzelne PDFs · Deutsch ↔ Русский ↔ English in jede Richtung · Seite für Seite **in die Lage des Originals** (Bilder, Farben, Seitenumbrüche bleiben) · gescannte Seiten per Texterkennung auf dem Gerät · Gegenprobe (Rückübersetzung) als eigenes PDF · Übersetzer im Browser (Gerät) oder KI mit eigenem Schlüssel · „Seite N von M", Abbrechen, Fortsetzen |
| **🏛️ Behördenformulare** (seit 2026-09-25) | Felder im Original setzen → beim Übersetzen kommen sie **übersetzt an dieselbe Stelle** mit → in der Fremdsprache ausfüllen → „⬇ PDF ausgeben → ↩ Einträge ins Original" setzt die Einträge zurückübersetzt in eine **Kopie des Originals** · Umlaute werden vor und nach dem Übersetzen zusammengesetzt (NFC) · Kyrillisch in festem und ausfüllbarem PDF |
| **📷 Papierbrief → A4** (seit 2026-09-25) | im Foto wird das Blatt gesucht und auf **genau A4** gerade gezogen (auch schräg aufgenommen) — ausgedruckt mit „Tatsächliche Größe / 100 %" so groß wie das Papier, mit seinem Rand · nicht sicher erkannt → nichts wird abgeschnitten, das ganze Foto liegt auf A4 · pro Seite umschaltbar · auch im Übersetzen-Bereich („📷 Brief fotografieren", Fotos als Datei) |

## Grenzen der ersten Fassung

- Erkannte Felder sind Vorschläge. Die offline-Erkennung findet durchgezogene
  Linien und Rahmen, keine gepunkteten Linien; KI-Positionen sind ungefähr.
- Die PDF-Standardschrift (Helvetica) kann Umlaute und ß, aber keine Emojis
  oder z. B. kyrillische Schrift. Nicht darstellbare Zeichen werden durch „?"
  ersetzt, und die App sagt das.
- QR-Codes sind in jeder Fassung ein festes Bild auf der Seite. Datum, E-Mail
  und Internetadresse sind im ausfüllbaren PDF gewöhnliche Textfelder.
- Der KI-Schlüssel liegt unverschlüsselt im Speicher des Browsers.
- Die KI-Erkennung ist mit **gestellten** Antworten geprüft, nicht mit einem
  echten Anbieter-Aufruf.
- Übersetzen: innerhalb eines Absatzes bricht die Übersetzung neu um (andere
  Länge); Absätze, Bilder und Seiten bleiben am Platz. Der Originaltext liegt
  abgedeckt weiter im PDF (beim Markieren/Suchen findbar). Schräg gesetzter
  Text bleibt stehen. Texterkennung kann sich verlesen — Scans gegenlesen.
- Der eingebaute Übersetzer des Browsers ist in der Probe **gestellt** (der
  Probe-Browser hat keinen); ob er auf dem Gerät da ist, zeigt „🔎 Messen".
- Später vorgesehen: Bildgestaltung, Druck-PDFs bis 300 dpi.

## Prüfen

```bash
npm install     # einmalig: pdf-lib und playwright-core für die Probe
npm test        # Syntax + Probe im echten Browser (Chromium)
npm run serve   # http://localhost:8000/
```

Die Probe liest ein Test-Formular ein (mit vorhandenem Formularfeld und einer
um 90° gedrehten Seite), erkennt offline und mit gestellter KI-Antwort, füllt
aus, gibt alle drei Fassungen aus und rechnet die Positionen aus den Dateien
zurück. `tests/uebersetzung.mjs` übersetzt Ordner mit Handbuch-, gedrehten,
beschnittenen, Querformat- und gescannten Seiten und prüft Lage, Farbe,
Seitenzahl, Kyrillisch, Abbruch/Fortsetzen und die Gegenprobe.
`npm run messen` misst 400 Seiten und 10 Scans.

## Technik

Statische Dateien, GitHub Pages. PDF.js zeigt die Seiten, pdf-lib schreibt die
PDFs, qrcode-generator zeichnet QR-Codes (siehe [THIRD_PARTY.md](THIRD_PARTY.md)).
Dokumente liegen in IndexedDB (`WorkflohPDF1`), der Service-Worker hält die
App-Dateien offline vor. Wer eine Datei der App ändert, erhöht `CACHE_VERSION`
in `sw.js`.

Rechte: [LICENSE](LICENSE) · [RECHTE.md](RECHTE.md) · [Impressum & Datenschutz](impressum.html)
