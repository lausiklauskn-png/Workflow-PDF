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
zurück.

## Technik

Statische Dateien, GitHub Pages. PDF.js zeigt die Seiten, pdf-lib schreibt die
PDFs, qrcode-generator zeichnet QR-Codes (siehe [THIRD_PARTY.md](THIRD_PARTY.md)).
Dokumente liegen in IndexedDB (`WorkflohPDF1`), der Service-Worker hält die
App-Dateien offline vor. Wer eine Datei der App ändert, erhöht `CACHE_VERSION`
in `sw.js`.

Rechte: [LICENSE](LICENSE) · [RECHTE.md](RECHTE.md) · [Impressum & Datenschutz](impressum.html)
