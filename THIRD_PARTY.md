# Mitgelieferte Bibliotheken

| Datei | Bibliothek | Lizenz | Herkunft |
|---|---|---|---|
| `vendor/pdfjs/pdf.min.js`, `vendor/pdfjs/pdf.worker.min.js` | PDF.js 3.x, Mozilla Foundation | Apache License 2.0 | byte-gleich aus Mein-WorkFloh (`assets/pdfjs/`) |
| `vendor/pdf-lib.min.js` | pdf-lib 1.17.1, Andrew Dillon | MIT | npm-Paket `pdf-lib@1.17.1`, `dist/pdf-lib.min.js` |
| `vendor/qrcode.js` | qrcode-generator 2.0.4, Kazuhiko Arase | MIT | npm-Paket `qrcode-generator`, `dist/qrcode.js` |

Die Lizenzköpfe in den Dateien bleiben erhalten.
Lizenztexte: <https://www.apache.org/licenses/LICENSE-2.0> · <https://opensource.org/license/mit/>

## Übersetzung (seit 2026-09-25)

| Datei | Bibliothek | Lizenz | Herkunft |
|---|---|---|---|
| `vendor/fontkit.umd.min.js` | @pdf-lib/fontkit 1.1.1 (Fork von fontkit, Devon Govett) | MIT, Lizenztext in `vendor/fontkit-LICENSE.txt` | npm-Paket `@pdf-lib/fontkit@1.1.1`, `dist/fontkit.umd.min.js`, unverändert |
| `vendor/fonts/NotoSans-Regular.ttf` | Noto Sans Regular (Latein, Griechisch, Kyrillisch), The Noto Project Authors | SIL Open Font License 1.1, Lizenztext in `vendor/fonts/OFL.txt` | `notofonts/notofonts.github.io`, `fonts/NotoSans/unhinted/ttf/`, unverändert |
| `vendor/tesseract/tesseract.min.js`, `worker.min.js` | Tesseract.js 7.0.0 (naptha) | Apache-2.0, Lizenztext in `vendor/tesseract/LICENSE-Apache-2.0.txt`; gebündelte Hilfsbibliotheken in den `*.LICENSE.txt` daneben | npm-Paket `tesseract.js@7.0.0`, `dist/`, unverändert |
| `vendor/tesseract/tesseract-core-*-lstm.wasm.js` | tesseract.js-core 7.0.0 (Tesseract OCR als WebAssembly) | Apache-2.0 | npm-Paket `tesseract.js-core@7.0.0`, unverändert |
| `vendor/tesseract/lang/{deu,rus,eng}.traineddata` | tessdata_fast (Tesseract OCR) | Apache-2.0 | `tesseract-ocr/tessdata_fast`, Zweig `main`, unverändert |

Die Schrift wird nur beim Übersetzen geladen und als **Teilmenge** (nur die benutzten
Zeichen) in das Ergebnis-PDF eingebettet. Die OFL erlaubt das Einbetten in Dokumente;
die Schrift selbst wird nicht verändert oder umbenannt.

**Texterkennung (OCR)** läuft nur für Seiten ohne Textebene (Scans), vollständig auf dem
Gerät, und wird erst beim ersten Bedarf geladen (rund 21 MB).

**Übersetzer im Browser (`Translator`)** ist Teil des Browsers, nichts wird mitgeliefert.
Für die Nutzung gelten die Bedingungen des Browser-Herstellers. **KI-Übersetzung** (Mistral ·
Anthropic · OpenAI) läuft mit dem eigenen Schlüssel des Nutzers.
