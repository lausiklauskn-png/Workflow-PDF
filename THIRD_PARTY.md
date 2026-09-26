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

## Scannen (seit 2026-09-26)

| Datei | Bibliothek | Lizenz | Herkunft |
|---|---|---|---|
| `vendor/scanic/scanic.js` | Scanic 1.6.0 (marquaye) — Blatterkennung und Kantenerkennung (WebAssembly im Paket) | MIT, Lizenztext in `vendor/scanic/LICENSE-scanic.txt` | npm-Paket `scanic@1.6.0`, `dist/`, unverändert |
| `vendor/scanic/scanic-mlDetector.js`, `scanic-ort.wasm.min.js`, `ort-wasm-simd-threaded.mjs`, `ort-wasm-simd-threaded.wasm` | scanic-ml 0.2.0 — Eckenerkennung mit Modell; enthält eine verkleinerte ONNX Runtime Web 1.27.0 (Microsoft) | MIT (scanic-ml) · MIT (ONNX Runtime) | npm-Paket `scanic-ml@0.2.0`, `dist/`, unverändert |
| `vendor/scanic/doccornernet_lean.ort` | Modell „DocCornerNet LEAN" (1,9 MB), Architektur aus DocCornerNet-CoordClass (mapo80) | MIT (als Teil von `scanic-ml`) | npm-Paket `scanic-ml@0.2.0`, unverändert |
| `tests/scan-fotos/foto01–17.jpg`, `ecken.json` | Testbilder und geprüfte Ecken aus dem Scanic-Depot | MIT | `marquaye/scanic`, `testImages/` und `ground-truth.json`, auf lange Kante ≤ 1000 px verkleinert |

Alles läuft auf dem Gerät und wird erst beim ersten Scannen geladen (rund 3,5 MB).
**Nicht geprüft:** unter welchen Bedingungen die Trainingsdaten des Modells stehen — die
Model-Card nennt nur die Herkunft der Architektur. Die Gewichte selbst liegen im npm-Paket
unter MIT.

**Filter, Entzerren, Textänderung** (`assets/scan-bild.js`, `assets/scanner.js`) sind eigene
Arbeit. Bewusst NICHT übernommen: BentoPDF und Nitidoc (AGPL-3.0, verträgt sich nicht mit der
Lizenz dieser App), document-scanner-web (ohne Lizenz), die Filter von Vigil Lens (MIT nur im
README, keine Lizenzdatei).
