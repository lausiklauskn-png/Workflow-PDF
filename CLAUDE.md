# Workfloh PDF — Sitzungs-Anker

PWA für Formulare: einlesen (PDF, Foto, Ordner) → Felder erkennen oder setzen →
ausfüllen → festes / ausfüllbares PDF / leere Vorlage. Kein Build-Schritt.
Vorlage war der Originaldokument-Modus von Mein-WorkFloh (Felder in Prozent
über der echten Seite, „bearbeiten" gegen „ausfüllen").

## To-Do-Liste

Klaus' Prüf-Befunde für alle Workflow-Repos (Workflow-PDF · Mein-WorkFloh ·
Tomys-Hub/workfloh) stehen in **`docs/TODO.md`**. Sagt er „To-Do für Workflow",
wird dort eingetragen — abgearbeitet wird über Plan/Brief.

## Namen

In der Kopfleiste **Workfloh PDF** (mit h), in sachlichen Erklärungen
**Workflow PDF**. Maskottchen **W-Floh** (`icons/w-floh-*.png`, aus Klaus' Bild).

## Prüfen

```bash
npm install && npm test     # Syntax + Probe im echten Browser
```

## Was hier leicht kaputtgeht

- **Koordinaten:** Felder stehen in Prozent der ANGEZEIGTEN Seite. Der Export
  rechnet über die pdf.js-Viewport-Matrix je Seite (`doc.pages[i].t`) zurück —
  nur so stimmen gedrehte Seiten und verschobene CropBoxen. pdf-lib dreht
  Widget-Rechtecke selbst um ihren Anker; deshalb Anzeige-Breite/-Höhe und die
  linke untere Anzeige-Ecke übergeben. Die Probe prüft das an einer 90°-Seite.
- **pdf-lib:** `setFontSize` erst NACH `addToPage` (vorher kein /DA-Eintrag).
- **Schrift NIE als Teilmenge einbetten** (`subset: false`, Befund Klaus 2026-09-25):
  pdf-lib + fontkit verlor bei Noto Sans Buchstaben („An … e" statt „Anspruchsteller") —
  die Textebene stimmte, nur das Bild nicht. Kostet ~240 KB je PDF. `tests/schrift.mjs`
  misst die Tinte im gerenderten Bild (heil 0,74–0,79 · Teilmenge 0,11–0,35).
- **Cache-Bump:** `CACHE_VERSION` in `sw.js` erhöhen, wenn eine App-Datei sich ändert.
- **DB-Name `WorkflohPDF1` nie ändern** — github.io ist eine geteilte Adresse.
- **Resize nur bei Breitenänderung neu zeichnen.** Die Bildschirmtastatur macht das
  Fenster niedriger; ein Neuzeichnen warf das Feld weg, in das getippt wurde
  (Befund Klaus 2026-09-25). Die Probe prüft es.
- **Kasten um Felder ist kein Feld** (Klaus 2026-09-26, Beispiel „Nur von der Behörde auszufüllen"):
  ein Rahmen mit zwei oder mehr erkannten Feldern darin fällt weg (`linienErkennung`). Sonst las
  `inhaltUebernehmen` seine Beschriftungen als Inhalt und legte sie doppelt über die echten Felder.
  Gedruckter Text, der auf „:" endet (auch „Aktenzeichen: ____"), und ein einzelner Buchstabe
  (Wappen, Logo) werden nie als Eintrag übernommen. `tests/beispiele.mjs` misst es am Beispiel.
- **Erkennung:** Linien, Rahmen, Kästchen UND hellgraue Flächen (`flaechen()`).
  Die KI bekommt die Offline-Kandidaten nummeriert ins Bild gezeichnet und
  benennt sie — ihre eigenen Koordinaten sind ungenau („alle auf einem Haufen").
- **Speichern:** laufend in IndexedDB, sofort bei `visibilitychange`/`pagehide`;
  💾 legt eine Arbeitsstand-Datei (`*.workfloh.json`, PDF + Felder) aufs Gerät.
- **KI ist BYOK und freiwillig**, Standard Mistral (EU). Ohne Bestätigung geht
  nichts ins Netz.

## 📷 Scannen · Foto → PDF (Klaus 2026-09-26)

„Ein umfangreiches PDF-Scan-Tool … aus Foto PDF scannen." Knopf **📷 Scannen** in der
Bibliothek; dasselbe Werkzeug öffnen „📷 Brief fotografieren" (Übersetzen) und „Seiten
fotografieren" (an ein Dokument anhängen). Der alte Aufnahme-Dialog ist weg.

- **Ablauf je Seite:** Foto → Blatt finden → Ecken prüfen/ziehen (Lupe) → gerade ziehen
  (A4 · US Letter · wie das Blatt) → drehen → Filter (Original · Farbe · Graustufen ·
  Dokument · Schwarzweiß), Helligkeit, Kontrast → Texterkennung, Zeilen ändern →
  PDF (auf Wunsch durchsuchbar) · Teilen · Herunterladen · Bilder als ZIP. Ohne KI, ohne Netz.
- `assets/scan-bild.js`: die Rechnung, ohne DOM, in Node geprüft. `assets/scanner.js`: die
  Oberfläche (`WFP.Scanner`), Vollbild über der App (z-index 55, Dialoge 60 liegen darüber).
- **Blatt finden = drei Meinungen** (`entscheiden`): Scanic-Modell (ML), Scanic-Kanten,
  `blatt.js`. „Sicher" nur, wenn das Modell mit einem der anderen auf ≤ 4 % der Diagonale
  übereinstimmt (ohne Modell: Blatt + Kanten). Sonst **„bitte prüfen"** — nie still
  schneiden. „Fertig" fragt, solange eine Seite ungeprüft ist.
- **Gemessen an 17 Testfotos** (`tests/scan-fotos/`, Ecken aus Scanics `ground-truth.json`):
  blatt.js allein 10 richtig, aber **3 sicher und 11–27 % daneben**; Scanic-Modell 14 richtig.
  Die Entscheidung: **12 sicher und richtig · 5 zum Prüfen · 0 sicher und falsch.**
  ⚠ Die Ecken dort hat Scanic mit seinem Modell vorbelegt und von Hand nachgezogen — das
  Modell wird an Daten gemessen, die es mit erzeugt hat. Ein Tablet-Foto ist nicht gemessen.
- `vendor/scanic/` ist **unverändert aus npm** (scanic 1.6.0, scanic-ml 0.2.0, siehe
  THIRD_PARTY.md). Das Modell braucht `ml: { assetBaseUrl }` auf `vendor/scanic/` — ohne
  das holt es sich die Dateien von jsDelivr. Nicht im Installations-Vorrat (3,5 MB), der
  Worker legt es beim ersten Scannen ab. `.mjs` muss als JavaScript ausgeliefert werden
  (die Proben-Server tun das seitdem).
- **Filter sind eigene Arbeit:** Papier-Helligkeit je Block (90. Perzentil), geglättet, dann
  herausgerechnet — Schatten verschwinden, statt nur heller zu werden.
- **Text ändern** geht auf dem BILD: Tesseract (DE/EN/RU, auf dem Gerät) liefert Zeilen;
  eine geänderte Zeile wird in Papierfarbe überdeckt und in Schriftfarbe neu geschrieben
  (`textFarben`). Die Textebene des durchsuchbaren PDFs trägt den geänderten Text
  (unsichtbar, Noto ganz eingebettet, falls nötig). Ecken, Drehen oder Format ändern
  verwirft die Erkennung.
- **Zeilen an der Grundlinie, nicht am Rahmen** (Klaus 2026-09-27, Bienenstich-Foto: „150 q
  Butter", abgeschnittene Zeilen, „die Textrahmen sind nicht stimmig"). Bei einem schrägen Foto
  ist der Rahmen einer Zeile höher als ihre Schrift; wer ihn überdeckt, löscht die Nachbarzeile.
  Gespeichert wird je Zeile `base` (Grundlinie samt Neigung) und `rh`/`desc` (Tesseract
  `rowAttributes`); `zeilenLage`/`zeilenBand` in scan-bild.js rechnen daraus das Schriftband.
  **Erst alle Deckflächen, dann alle Texte** — sonst frisst das Band der nächsten Zeile die
  Unterlängen. Deckfarbe als Verlauf, links und rechts an der Zeile gemessen; Papier = 45.–85.
  Perzentil, nicht das hellste. Schrift 1,1 × rowHeight (kalibriert an Arial: 40 px → 38),
  Zeilen ±30 % um den Median bekommen dieselbe Größe.
- **Kopie neben Original** (Klaus 2026-09-27: „eine Kopie neu aufbauen … zwei nebeneinander
  … vergleichen"): „📄 Kopie neben Original" setzt die erkannten Zeilen gerade auf ein weißes
  Blatt; Ansicht Original · Nebeneinander · Kopie; dieselbe Zeile leuchtet in beiden; unsichere
  Zeilen (< 70 %) gelb. „Ins PDF kommt: Original (Foto) / Kopie (sauberer Text)" je Seite
  (`s.ausgabe`) — die Kopie geht als ECHTER Text ins PDF, ohne Bild. Stimmt sie nicht: „🔍 Genauer
  erkennen (300 dpi)" oder „📷 Seite neu fotografieren" (ersetzt DIESE Seite, `ST.ersetze`).
  Bilder, Stempel und Handschrift kommen nicht in die Kopie — das steht in der App.
- **Zeilen einstellen** (Klaus: „linksbündig oder rechtsbündig oder kleiner, größer gezogen"):
  im Zeilen-Dialog Ausrichtung und Größe (40–300 %), in der Kopie ziehen = verschieben
  (`s.stil[i] = {ausr, gr, dx, dy}`, Versatz in Anteilen der Seite). Mit eigener Größe wird nicht
  mehr automatisch verkleinert.
- **🎨 Mit ChatGPT übersetzen — ein Knopf hin, ein Knopf zurück** (Klaus 2026-09-27: „Es ging nur um
  einen Prompt, der automatisch eingefügt wird … Mach's nicht zu kompliziert"). In der Gruppe „Text":
  Sprache wählen · **🎨 Mit ChatGPT übersetzen** teilt Seitenbild + Auftrag in EINEM Tipp (Web-Share,
  Auftrag zusätzlich in der Zwischenablage; ohne Teilen: Bild speichern + chatgpt.com öffnen) ·
  **📥 Ergebnis zurückholen** legt das fertige Bild als neue Seite HINTER die aktuelle (Original bleibt).
  Kein Dialog. Der Auftrag (`bildAuftrag`, `BILD_SPRACHEN` in scan-bild.js) ist ein Satz, wie Klaus ihn
  selbst in ChatGPT gesprochen hat: „Extrahiere den Text aus diesem Bild, übersetze ihn auf <Sprache> und
  füge ihn an derselben Stelle wieder in das Originalbild ein. Gib mir das fertige Bild zurück."
  Das Seitenbild wird vorab gebaut (`kiBildBauen`, `s._kiBild`) — Teilen braucht einen frischen Tipp.
  Das zurückgeholte Bild IST die Seite: ganzes Bild, Filter „Original", kein Blatt-Suchen (`s.kiBild`).
  Der frühere Weg über eine Textliste (JSON, Abgleich mit der Erkennung auf dem Gerät, PR #45) ist
  **wieder entfernt**: ChatGPT antwortete damit mit Text statt mit einem Bild (Klaus' Bildschirmfoto),
  und es waren zu viele Schritte. Klaus hat den kurzen Auftrag direkt in ChatGPT an seinem Hotel-Aushang
  (DE → RU) gezeigt; über die App ist er nicht mit einer echten ChatGPT-Antwort gemessen.
  ⚠ ChatGPT malt das Bild neu — Zahlen und Namen können sich ändern.
  **Qualität** (Klaus 2026-09-27: „Sehr schlechte Textqualität. Höhere Auflösung wäre besser."): der Auftrag
  verlangt zusätzlich schärfere Schrift, weniger Unschärfe/Rauschen und hohe Auflösung · das Bild geht mit
  300 dpi hinaus (`KI_DPI`, vorher 200) · das zurückgeholte Bild kommt in SEINER Auflösung ins PDF
  (`eigeneDpi`, höchstens 300 dpi, JPEG 0,92), nicht auf die Qualitätsstufe (150 dpi) heruntergerechnet.
  Wie scharf ChatGPT zurückliefert, entscheidet ChatGPT — nicht gemessen.
- **Herunterladen legt auch ab** (Klaus 2026-09-27: „dann lädt er es nicht in das PWA Workflow PDF … Ich muss
  erst wieder eine Datei importieren"). Beim Scannen aus der Bibliothek legen „⬇ PDF herunterladen", „📤 Teilen"
  und „✓ PDF erstellen" das PDF IMMER auch in der Bibliothek ab (aktueller Ordner; `opt.ablegen` in app.js,
  beim Übersetzen/Anhängen nicht). Ein zweites Ablegen ersetzt DASSELBE Dokument (`ST.abgelegt`, `dokErsetzen`
  behält Kennung, Ordner, Anlagedatum) — kein Doppel. „PDF erstellen" öffnet es danach. ZIP legt nichts ab.
- **🎭 Textmaske (PNG, durchsichtig):** die Kopie ohne weißen Grund (`kopieRechnen(s, dpi, true)`),
  zum Auflegen auf einen neuen Hintergrund in einem Bildprogramm. Erscheint, sobald Text erkannt ist.
- **Lupe beim Ecken-Ziehen** (Klaus 2026-09-27: „nur der Punkt, sodass man den Rest noch sehen kann"):
  ein Fünftel der kürzeren Bildseite, 56–84 px, schräg ÜBER dem Punkt (der Finger liegt darunter),
  deckt ihn nie. Vorher war sie so groß wie das ganze Bild (gemessen 431×574 bei 431×574): die
  Regel `.scan-bild canvas{width:100%}` schlug `.scan-lupe{width:120px}` — die Regel heißt deshalb
  `.scan-bild canvas.scan-lupe`, und das Maß steht zusätzlich inline (`lupeGroesse`, `lupeLage`).
- **Handy** (≤ 760 px, gemessen 360×740): das Foto bekam 156 px, und die oberen Ecken lagen unter
  der Kopfleiste (nicht greifbar). Jetzt 52 dvh für das Foto, das Scan-Fenster ROLLT, und das Bild
  hält 20 px Abstand für die halben Griffe (keine 200-px-Untergrenze mehr). Quer (740×360) bleibt
  das Foto klein — benannte Grenze.
- **Vollbild quer und Handy gleich in allen drei Apps** (Klaus 2026-09-27: „Zuschneiden und Ergebnis … nicht so schmal" ·
  „die Vollbildansicht nutzt den Platz für das Bild nicht optimal aus"): ab 761 px quer steht das Foto links über die
  ganze Höhe, Werkzeug · Seiten · Fuß rechts in einer Spalte (360 px), die rollt; gemessen bei 1000 × 540: Bühne
  151 → 482 px. Das Foto im Zuschneiden wird nicht mehr bei 100 % gedeckelt (kleine Fotos füllen die Bühne). Am Handy
  Reiter ≤ 30 px, Befund einzeilig mit Nachsatz (≤ 48 px). Dieselben Blöcke stehen in `assets/wfpdf/scanner.css`
  beider WorkFlohs; dort heißt Rot `--scan-rot`, weil tomy-ui `--rot` per `@property` als Winkel anmeldet (in Tomys
  war der gewählte Reiter durchsichtig). ⚠ Dass ein KLEINES Foto größer gezeigt wird, misst keine Probe — die
  Testfotos sind groß.
- **Scanner-Kopf einzeilig, keine Erklärtexte** (Klaus 2026-09-27): Schließen ist nur ein ✕ (`aria-label="Schließen"`), Titel und „1 Seite" in einer Zeile (Kopf 68 → 51 px am Handy); Zuschneiden/Ergebnis auf JEDER Breite 28 px hoch, einzeilig. Kein Text „Ecken von Hand gesetzt" (die Marke `data-befund="hand"` bleibt, unsichtbar) und kein Satz zu roten Punkten und Lupe. Wird das Fenster größer gezogen (DeX, Vollbild), zeichnet ein ResizeObserver die Bühne neu — das Foto füllt sie wieder (vorher blieb es klein).
- **Seitengröße** (Klaus 2026-09-27): Automatisch (Vorgabe) · Original (wie das Blatt) · A4 · A5 · A6 · US Letter.
  Automatisch: Verhältnis ± 8 % um √2 (`AUTO_TOLERANZ`) → A4, sonst Original — und es SAGT, was es gewählt hat
  (`data-format-ist`). A4, A5, A6 haben dasselbe Verhältnis; welche Größe das Papier hatte, zeigt ein Foto nicht.
  `seitenMass` gibt `format` (das tatsächlich genommene) mit zurück.
- **Die WorkFlohs tragen scanner.js und scan-bild.js byte-1:1** (seit 2026-09-27, per SHA gepinnt in
  `Mein-WorkFloh/scripts/wfpdf_kanon.mjs` und `Tomys-Hub/tests/wfpdf_kanon.mjs`) — nur hier ändern, dann dort neu
  kopieren und die Pins nachziehen. Dafür sind die Pfade einstellbar (`WFP.Scanner.pfade({vendor, scanic, ocr})`
  oder `opt.pfade`) und der Ablageort benennbar (`opt.ort`, `opt.ortKurz`; Vorgabe wörtlich wie vorher, damit
  die Sprach-Schlüssel gelten).
- Fotos werden auf ≤ 2400 px lange Kante verkleinert, nie abgewiesen. Einstellungen
  (Filter, Format, Qualität, durchsuchbar, Sprache) in `localStorage` `wfpdf_scan_v1`.
- Proben: `tests/scan.mjs` (in `npm test`, A Rechnung · B 17 Fotos · C ganzer Weg mit echtem
  Tesseract) · `node tests/gegenprobe_scan.mjs` (50 Fälle, Wegwerf-Kopie; `NUR_ANKER=1`, `NUR_FALL="BILD:"` für den ChatGPT-Weg, `NUR_FALL="ABLAGE:"` fürs Ablegen, `LUPE:`/`HANDY:` für Lupe und Handy-Platz).
  Gemessen am 2026-09-26: `scan.mjs` 58 grün · Gegenprobe erst **20 gefangen · 1 blind ·
  1 aus falschem Grund**. Blind war „Umordnen": die zweite Seite erbte den gemerkten Filter,
  also sahen beide Seiten gleich aus — gemessen wird jetzt der Dateiname je Seite. Falsch war
  eine Sabotage (`a || (b) ? c : d` bindet anders als gedacht). Beide danach nachgefahren:
  gefangen, jede rote Zeile mit ihrem Namen.
  **Nach „Kopie neben Original" (2026-09-26):** `scan.mjs` 70 grün (D: Kopie, Grundlinie,
  Unterlängen, Ausrichtung, Ziehen, PDF aus der Kopie, neu fotografieren) · Gegenprobe 30 Fälle:
  erst **28 gefangen · 2 aus falschem Grund** — die Probe WARTETE auf das, was die Sabotage wegnahm
  (Kopie-Tafel 180 s, „Neu.png an Stelle 1" 60 s), und starb am Zeitablauf. Jetzt wird erst auf
  die Erkennung gewartet und das Fehlende gemeldet; beide Fälle nachgefahren: gefangen.
  **Nach „Text mit ChatGPT“ (2026-09-27):** `scan.mjs` 94 grün (A2: Auftrag, Antwort lesen, Abgleich;
  D: Knopf, Dialog, Übernehmen mit echter Erkennung, Textmaske) · 10 neue Fälle (`KI:`) 10 gefangen.
  **Nach „Ein Knopf zu ChatGPT“ (2026-09-27, Textlisten-Weg entfernt):** `scan.mjs` 81 grün · Gegenprobe
  `BILD:` erst **6 gefangen · 1 durchgerutscht** — „Ergebnis landet am Ende statt dahinter“ war blind, weil es
  nur EINE Seite gab (Ende = dahinter). Jetzt steht eine zweite Seite dahinter; danach **7 gefangen · 0 durch**.
- ⚠ **Nicht gemessen:** echte Handy-Kamera, Modell auf dem Tablet (Zeit, Speicher),
  Qualität der Texterkennung auf echten Briefen. Die Bildschirmfotos im Handbuch zeigen noch
  den alten Aufnahme-Dialog (`node tools/handbuch-bauen.mjs` baut sie neu).

## 📱 Handy: flache Knöpfe, kleinerer Griff (Klaus 2026-09-27)

„Die Button in der Handyansicht zu fett … flacher, etwas kleiner, so dass mehr Fläche bleibt für die Ansicht des
Bildes. Das ist wichtiger." · „Rote Punkte … um 20 % verkleinert, aber nicht mehr."
- Block am ENDE von `assets/style.css` (überstimmt die älteren Handy-Regeln): Knöpfe im Bearbeiten-Fenster 30 px
  statt 36–40 px, Suchzeile und Fuß flacher. Gemessen bei 380 × 800: Blatt **53 % → 61 %** des Schirms
  (360 × 740: 345 → 411 px).
- Griff `.feld .griff` 16 → 13 px; `::after` (inset −9 px) hält die Greiffläche groß.
- Scanner (≤ 760 px): Bild 52 → 60 % der Höhe, Knöpfe und Chips flacher. ⚠ **Ohne Wächter** — eine Sabotage daran
  fängt keine Probe (von Hand nachgestellt).
- **Start-Kacheln zwischen Handy und Bildschirm** (Klaus 2026-09-27: „fast Original Handyformat … zu schmal"): mit
  `auto-fit(220 px)` standen sie bei 641–999 px in 3 schmalen Spalten (bei 720 px je 224 px), die vierte allein darunter.
  Jetzt: bis 760 px untereinander, bis 1199 px zwei nebeneinander (2 × 2), ab 1200 px vier. `tests/schieber.mjs`
  misst 720 · 820 · 1000 px.
- **Start-Kacheln am Handy** (≤ 760 px, Klaus 2026-09-27): untereinander, je eine Zeile, höchstens 40 px wie die Scanner-Knöpfe, Unterzeile ausgeblendet (per CSS — der Sprach-Schlüssel mit `<br><small>` bleibt heil). Dasselbe Maß gilt in beiden WorkFlohs für die Blatt-Knöpfe (≤ 36 px).
- `tests/schieber.mjs` misst Blatt (> 58 %), Knopfhöhe (≤ 32 px), Griff (12–14 px) und den Tipp daneben; von Hand
  gegengeprüft (Griff 16 px, 10 px, ohne `::after`, dicke Knöpfe, ganzer Block weg): jede Sabotage wirft ihre
  eigene rote Zeile. Die erste Schwelle „die Hälfte" war blind — ohne Änderung waren es schon 53 %.

## 🌐 Übersetzen (seit 2026-09-25)

Eigener Bereich (Knopf „🌐 Übersetzen …", Ordner mit `bereich:'uebersetzung'`,
Ergebnis-Ordner je Sprache, per Kennung verknüpft — Umbenennen bricht nichts).
Seite für Seite: Textblöcke aus der Textebene (Scans: Texterkennung auf dem
Gerät), Farbe gemessen, Block in Hintergrundfarbe abgedeckt, Übersetzung in
Textfarbe an dieselbe Stelle. Zwischenstand je Seite in IndexedDB
(`ue:<doc>:<von>-<nach>`), Fortsetzen nach Abbruch.

- `assets/uebersetzung.js` ist **host-neutral** und wird byte-1:1 in die WorkFlohs
  kopiert (`assets/wfpdf/`) — nur hier ändern, dann dort neu kopieren.
- **Kyrillisch** braucht fontkit + Noto Sans (`vendor/`), **ganz** eingebettet (`subset:false`, siehe oben).
- **Texterkennung** `vendor/tesseract/` (21 MB, nicht im Installations-Vorrat) —
  die WorkFlohs laden sie von hier (`/Workflow-PDF/vendor/`). **Nicht umbenennen.**
- Headless-Chromium hat **keinen** `Translator` (gemessen) — die Probe stellt ihn;
  am Gerät misst der Knopf „🔎 Messen" im Übersetzen-Dialog.
- Unter der Übersetzung bleibt der Originaltext im PDF (abgedeckt); die Gegenprobe
  übersetzt deshalb die gespeicherten Übersetzungen zurück, statt neu zu lesen.
- **Teilergebnis bei Abbruch** (Klaus 2026-09-25): `lauf()` wirft bei einem Fehler des
  Übersetzers (429/Kontingent, Netz) NICHT, sondern meldet `fehler` mit gespeichertem
  Stand. Ist mindestens eine Seite fertig, entsteht „[RU, Teil N von M]" (Rest im
  Original, `doc.teil`); der vollständige Lauf ersetzt es. Vorher stand das Übersetzte
  nur im Speicher und war nicht zu sehen.
- **🌐 Mit Chrome übersetzen** (Klaus 2026-09-25, `chromeUebersetzer`): Android-Chrome
  hat keine Translator-API, aber ⋮ → Übersetzen übersetzt echten Text. Die App stellt die
  Absätze einer Seite auf eine Fläche (`#wfp-chrome`, translate="yes"), wartet auf
  `translated-ltr` an <html>, liest je Absatz (`<font>`-Hülle oder geänderter Text).
  Die übrige App bekommt `translate="no"` (Marke `data-wfp-tr`), bis Chrome wieder das
  Original zeigt. Keine Gegenprobe. Headless gibt es Chromes Übersetzung nicht —
  `tests/chrome.mjs` stellt sie nach; am Tablet ist sie ungemessen.
- **🌐 In Chrome öffnen** (Klaus 2026-09-25): im installierten App-Fenster fehlt oft
  „Übersetzen", und die Adresse kennt kaum jemand. Knöpfe im Dialog und auf der Fläche
  (nur `display-mode: standalone`): In Chrome öffnen · Teilen · Adresse kopieren. Die Adresse
  trägt `?ue=<ids>&von&nach&weg=chrome`; `chromeTabRueckweg()` öffnet damit im Tab denselben
  Übersetzer wieder — das Ergebnis wird ein PDF, nicht die übersetzte App-Oberfläche.
  ⚠ **Auf Android springt die App NICHT nach Chrome — sie TEILT** (Klaus 2026-09-25, dreimal
  gemessen: jeder Sprung, auch „Chrome starten" ohne Adresse, blitzte nur weiß auf und kam in
  die App zurück; der Geltungsbereich ist `./`). Was trägt, hat Klaus gefunden: Teilen →
  Chrome. Der Knopf heißt dort **„🌐 Mit Browser öffnen zum Übersetzen"** und ruft
  `navigator.share` SOFORT aus dem Tipp (danach verweigert Android es); Anhalten und Speichern
  laufen, während das Teilen-Fenster offen ist. Der Hinweis sagt „Chrome wählen, kein anderes
  Übersetzungsprogramm". Selbst abgebrochen → nichts; Teilen verweigert → Adresse kopieren +
  Anleitung. Kein eigener „Teilen"-Knopf daneben, kein `intent:` mehr. Dass Chrome dieselben
  Dokumente sieht, hat Klaus am Tablet gezeigt.
  **Samsung DeX** (Klaus 2026-09-26): Chrome meldet dort Linux statt Android — `istAndroid()`
  war falsch, und „In Chrome öffnen" blitzte nur auf. Entschieden wird jetzt über
  `teilenWeg()`: Android ODER (App-Fenster UND `navigator.share`). Im Tab steht oben ein Band
  (`data-zurueckband`): zurück in der App ⟳ tippen, dann ist das Ergebnis dort (von Klaus
  am Tablet bestätigt).
  **Im App-Fenster auf Android öffnet „Mit Chrome übersetzen" die Fläche gar nicht erst**
  (Klaus 2026-09-25: „ich kann von da aus nur abbrechen") — dort gibt es ⋮ → „Übersetzen"
  nicht. Es geht sofort ins Teilen-Fenster. Auch der **Rückweg** („↩ Einträge ins
  Original") hat diesen Weg: Adresse `?rueck=<Übersetzung>&weg=chrome`, der Tab öffnet
  denselben Rückweg (`tests/behoerde.mjs` 4b).
- **Eine Übersetzung wird nie weiterübersetzt** (Klaus 2026-09-25, „[EN] [EN]" mit Russisch
  und Englisch auf einer Seite): unter der Übersetzung liegt der abgedeckte Originaltext — wer
  sie liest, bekommt beide Sprachen. `originalVon()` ersetzt im Übersetzen-Dialog jede gewählte
  Übersetzung durch ihr Original (`uebersetzung.quelle`) und SAGT das (`data-ersetzt`); „von"
  folgt der Sprache des Originals. Fehlt das Original, steht `data-ohneoriginal` da.
- **Chrome merkt sich die Zielsprache** und fragt nicht nach: wer vorher Russisch hatte, bekommt
  bei „Englisch" wieder Russisch. `falscheSchrift()` prüft die Schrift (kyrillisch ⟷ lateinisch)
  und übernimmt dann NICHTS, sondern nennt den Weg (⋮ → Übersetzen → Sprache umstellen).
  Seit 2026-09-26 für JEDE Schrift (Klaus stellte mitten im Lauf auf Paschtu um — arabische
  Schrift, im PDF nur Kästchen): die Zielschrift muss ≥ 40 % der Buchstaben tragen, sonst
  wird die gefundene Schrift genannt. Unter 20 Buchstaben wird nicht geurteilt.
  DE und EN sind darüber nicht zu unterscheiden — benannte Grenze.
- **Ergebnisse gehören zum Stamm-Ordner** (Klaus 2026-09-26, „Beispiele · ausgefüllt (aus EN) · RU"):
  `ergebnisOrdner()` geht über `stammOrdner()` die Kette `quelle` hinauf — wer die ausgefüllte
  Kopie weiter übersetzt, landet in „Beispiele · RU" neben „Beispiele · EN". Wer den
  Stamm-Ordner umbenennt, dem ziehen die abgeleiteten Namen nach, solange sie noch mit dem
  alten Namen beginnen (selbst umbenannte bleiben). Die große Kachel heißt
  „Importieren zum Übersetzen" (neue Datei), der Knopf über der Liste übersetzt Vorhandenes.
- **Aufbau auf der Seite** (Klaus 2026-09-25: „Textüberlagerung, Logos und Zahlen abgedeckt"),
  geprüft in `tests/layout.mjs` (erfundenes Formular, Stellvertreter +34 % länger):
  Stücke ohne Buchstaben/Ziffern und Absätze mit weniger als 2 Buchstaben (Logo „M",
  Kreis-Ziffern) werden nicht übersetzt · ein Zeichen links vor der Zeile (Kreis, Kästchen)
  beginnt einen neuen Absatz, der Rand eines Kastens nicht (`breite()` + `leereZeile()` im
  Seitenprüfer) · kurze erste Zeile in größerer Schrift = Kasten-Überschrift · abgedeckt
  wird nur über den Zeilen (`b[12]`), nicht das ganze Absatz-Rechteck · freier Platz rechts
  und unten (`b[10]`, `b[11]`) wird genutzt, BEVOR die Schrift kleiner wird · gleiche
  Originalgröße in derselben Spalte oder Ankreuz-Zeile bekommt dieselbe Größe (nicht unter
  70 % des Originals).
- **Beschriftungs-Spalten** (Klaus 2026-09-26, Fragebogen auf EN: „Postal code, / City: Email:"):
  eine Zeile, die auf „:" endet, beendet den Absatz, und ein Zeilenabstand über 1,6 Schrifthöhen
  auch — sonst wurden Beschriftungen neben ihren Feldern zu einem Absatz zusammengezogen und neu
  umbrochen, und die Überschrift verschmolz mit der ersten Beschriftung. Der Abstands-Riegel gilt
  NICHT für Texterkennung (`ocr`): dort ist `fh` das Buchstaben-Kästchen, der Scan-Absatz zerfiel.
  **Textfarbe** (`farben`): unter den Farben, die sich klar vom Grund abheben, die dunkelste mit
  mindestens 25 % der Häufigsten — die häufigste ist oft das Kantengrau, daher blasse Beschriftungen.
- **Bilder bleiben standardmäßig unberührt** (Klaus 2026-09-26, Fotos mit weißen Kästen
  „e.g. : \\", „IE |", „Paes fe" mitten im Bild): die Texterkennung las Kanten und Muster als
  Text. Text in Bildern auf Seiten MIT Textebene (`bildFlaechen`) wird nur noch gelesen, wenn
  im Übersetzen-Dialog **„Text in Bildern mitübersetzen"** gesetzt ist (`EINST.ueBilder`,
  `opt.ocr.bilder`, Vorgabe aus) — und dann mit strengerem Filter `bildZeileTaugt`
  (Sicherheit ≥ 70, keine Rahmen-Zeichen `\ | @ © = ~ …`, ≥ 70 % Buchstaben, ein Wort aus 5
  oder zwei aus 4 Buchstaben). Ganze Scan-Seiten liest die Texterkennung weiter wie bisher.
  Ein gespeicherter Zwischenstand mit Bild-Text (`bildText` je Seite; alte Stände ohne das Feld:
  Seite mit Textebene + `ocr`) wird ohne Haken neu gelesen. Proben: `tests/bilder.mjs` (echte
  Texterkennung an einem erfundenen „Foto" aus Kerben/Bögen — nur dieses Muster erzeugte
  Schein-Text; Gitter, Rippen, Rauschen nicht), `node tests/gegenprobe_bilder.mjs` (14 Fälle).
  Logos/Symbole (< 4 % der Seite, < 80×60 pt) werden ohnehin nie gelesen.
- **Buchstaben und Ziffern im Kreis (Ⓐ ① ❷) sind Symbole** (Klaus 2026-09-26, Werkstatt-Anleitung:
  „Ⓒ and body ground" kam als „C und Karosseriemasse" an, drei Listenzeilen verschmolzen, und
  „Voltage Between:" verschmolz mit dem Satz davor, wobei ein Wort verloren ging). Eine Zeile, die
  mit so einem Zeichen beginnt, ist ein eigener Absatz (`KREIS_ANFANG`); ein Stück, das nur aus dem
  Zeichen besteht, gehört zur Zeile (Ⓐ ist Kategorie „Symbol", nicht Buchstabe). Das Zeichen geht mit
  zum Übersetzer; fehlt es danach, setzt `kreisZurueck` das erste freistehende „A"/„1" wieder als
  Symbol (der Reihe nach, nie mitten in einem Wort). Im PDF zeichnet `pdfBauen` den Kreis selbst —
  **Noto Sans hat keine Kreis-Zeichen** (gemessen; DejaVu hat Ⓐ auch nicht, nur ①). Nach einem
  Satzende beginnt eine um mehr als 1,2 Schrifthöhen eingerückte Zeile einen neuen Absatz.
  Grenze: ein gewöhnliches „A" mit GEZEICHNETEM Kreis (Grafik statt Zeichen) wird nicht erkannt.
  Proben: `tests/kreis.mjs` (FreeSans, erfundenes Handbuch), `node tests/gegenprobe_kreis.mjs` (9 Fälle).
- **Große Dokumente in Teilen** (Klaus 2026-09-26, 384-Seiten-Handbuch brach nach 6 Seiten ab):
  ab 41 Seiten oder 8 MB zeigt der Übersetzen-Dialog einen Kasten mit der VORHER gerechneten
  Aufteilung (`teilPlan` in `uebersetzung.js`: Datei ÷ Seiten = KB je Seite, Ziel ≤ 8 MB je Teil
  minus 0,3 MB Schrift, gedeckelt auf 40 Seiten; jede Zeile der Rechnung steht da, „Seiten je
  Teil" frei wählbar). **Optional** — ganz übersetzen bleibt möglich. „✂️ Aufteilen" legt echte
  Teil-PDFs in „<Ordner> · Teile" (`teilVon` am Dokument, gleiche Grenzen → nichts doppelt);
  ihre Übersetzungen landen im selben „<Ordner> · RU". Zeit je Seite wird nach jedem Lauf
  gemerkt (`EINST.ueMsSeite`). Die Grenzen 8 MB / 40 Seiten sind gewählt, nicht gemessen.
- **„Other generic failures occurred"** ist der allgemeine Fehler von Chromes eingebautem
  Übersetzer, keine Speichermeldung. `browserUebersetzer` holt dann EINMAL einen neuen
  Übersetzer und versucht es noch einmal; scheitert es wieder oder ist der Absatz zu lang
  (`QuotaExceededError`), wird Satz für Satz übersetzt (`saetze`). 429/Kontingent und Abbruch
  werden nie wiederholt. Der Bericht nennt die Neustarts. Proben: `tests/teile.mjs`,
  `node tests/gegenprobe_teile.mjs` (14 Fälle).
- `npm run messen` misst 400 Seiten + 10 Scans (nicht Teil von `npm test`).
- **Behördenformular** (`tests/behoerde.mjs`): Felder kommen übersetzt mit
  (`quellFeld` → Feld im Original), Rückweg „↩ Einträge ins Original" legt eine
  KOPIE des Originals an (`ausgefuellt`). `zeichenNormal()` setzt zerlegte Umlaute
  zusammen — vor dem Übersetzen UND auf dessen Ausgabe (der Übersetzer kann sie
  zerlegt liefern). Kyrillische Feldwerte brauchen Noto im Export (`opt.schrift`);
  der /DR-Schlüssel ist `fontU.name`, weil pdf-lib ihn so in /DA schreibt.
- **`assets/blatt.js`** (byte-1:1 in die WorkFlohs): Blatt im Foto finden, auf A4
  entzerren. Unsicher → NICHT schneiden, ganzes Foto auf A4. `bilderZuPdf` nimmt
  `b.seite` als Seitengröße.

## 🗣 Sprache der App-Oberfläche (Klaus 2026-09-26)

Deutsch · English · Русский · العربية (rechts nach links), offline. Knopf „DE" oben und
⚙️ Einstellungen → „Sprache der App". Dort auch: Hinweise beim Zeigen (Tooltips) aus/an.
Die Wahl liegt in `localStorage` `wfpdf_sprache_v1`.

- `assets/sprache.js` übersetzt **auf der Seite**, nicht im Code: die App schreibt weiter
  Deutsch, ein MutationObserver schlägt jeden Text und title/placeholder/aria-label nach.
  Sätze mit `<b>`, `<span>`, `<br>` … sind **ein** Schlüssel (`Text <b>x</b>`), Werte als `{}`,
  in der Übersetzung `{1}`, `{2}` … Fehlt ein Eintrag, bleibt Deutsch stehen.
- `assets/sprache-texte.js`: die Wörterbücher. Neue Oberflächentexte brauchen dort einen
  Eintrag in **allen drei** Sprachen — `tests/sprache.mjs` läuft durch alle Dialoge und
  meldet jeden sichtbaren Text ohne Übersetzung.
- **Namen des Nutzers nie übersetzen:** Dokument-, Ordner- und Feldnamen stehen in
  `nm()` (`<span data-kein-ue>`); Felder, Eingaben und die Chrome-Fläche sind ausgenommen.
- **Auf Deutsch wird nichts neu als „Original" gemerkt** — sonst hält ein Element, dessen
  Kinder einzeln übersetzt waren, das Englische für Deutsch (Befund beim Bau, die Probe prüft
  es durch Neuladen).
- Die Dokument-Übersetzung (🌐) ist davon getrennt und kennt weiter DE ↔ RU ↔ EN.

## 🔎 Suche, Stufe 1 — Wortsuche mit Fundstelle (Klaus 2026-09-26)

Die Bibliothek sucht in **Name, Feldinhalten UND dem Text der Seiten** und sagt je Dokument,
woran sie es erkannt hat („Auf Seite 2 · …Bäckerei Müller…"). Aus der Suche geöffnet, ist die
Fundstelle auf der Seite gelb umrandet; **ein Tipp nimmt genau diese Markierung weg**. Ohne
Suche geöffnet: keine Markierung. Ohne Modell, ohne Netz.

- Die Rechnung steht in `assets/suche.js` (keine Oberfläche, kein Speicher, in Node prüfbar,
  später in die WorkFlohs kopierbar). Angeglichen wird auf BEIDEN Seiten: Umlaute gefaltet
  (ä/ae → a …), Satzzeichen und Leerzeichen weg („KD-4711" = „kd4711"), Daten als JJJJMMTT
  („3.9.2026" = „2026-09-03"; ohne Jahr passt jedes Jahr). Jedes Wort muss irgendwo stehen (UND).
- Der Seitentext liegt im Fach **`texte`** (DB-Version 2), getrennt von `docs` — die Bibliothek
  lädt die Docs bei jedem Öffnen, den Text braucht nur die Suche. Je Textstück Lage in Prozent
  der angezeigten Seite (wie die Felder). **`DB.putFile` und `DB.del('files')` werfen ihn weg**;
  `texteNachholen()` erfasst ihn neu, auch für Dokumente von vor der Suche. Solange er fehlt,
  sagt die Suche das („Seitentext wird noch erfasst").
- Gescannte Seiten ohne Textebene tragen nichts bei (Texterkennung: Stufe 4). Unter einer
  Übersetzung liegt der Originaltext abgedeckt — er ist mit findbar.
- **Ordner, Trefferzahlen, Suche im Dokument** (Klaus 2026-09-26): der Ordnername zählt als Fundstelle;
  ist ein Ordner gewählt, zeigt die Suche nur ihn („In allen Ordnern suchen" hebt es auf). Jede Karte und
  jeder Ordner-Knopf trägt eine kleine Trefferzahl (🔎n, `treffer` aus `sucheDok`: jede Stelle auf einer
  Seite einzeln). Im Editor: Suchfeld wie im PDF-Programm, alle Stellen markiert, „n / m", ▲▼ und die
  Lupe der Tastatur springen. Das Suchfeld der Bibliothek ist ein `<form>` — sonst tut die Lupe der
  Tablet-Tastatur nichts; Mikrofon (Chrome schickt die Aufnahme an Google, das steht im Titel).
  Titel/Texte hier NICHT mit `T()` setzen, das übernimmt die Sprachschicht — sonst meldet `sprache.mjs`
  die schon übersetzten Wörter als fehlend.
- **Plan danach** (Klaus' Wahl): Stufe 2 Bedeutungssuche (**gebaut 2026-09-26**, siehe unten) mit Modul 03/04 aus Sage (dasselbe
  Modell wie PWA Toolpoint), freiwillig einschaltbar, lernt aus den geöffneten Treffern ·
  Stufe 3 dieselbe Suche in den WorkFlohs — **Mein-WorkFloh und Tomys WorkFloh getrennt**, und
  **nur entsperrt** · Stufe 4 Scans und E-Mails.
- Proben: `tests/suche.mjs` (in `npm test`) · `node tests/gegenprobe_suche.mjs` (22 Fälle,
  Wegwerf-Kopie; zwei Riegel, die einander decken — Öffnen und Schließen leeren die
  Markierungen — nimmt EIN Fall zusammen weg).


## 🧠 Suche, Stufe 2 — nach Bedeutung (Klaus 2026-09-26)

„Semantische Suche, Embedding-Modell runterladen mit Ladebalken und Ladezustandsanzeige."
Unter dem Suchfeld steht eine Leiste mit **🧠 Suche nach Bedeutung einschalten**. Der Dialog
sagt VORHER, was aus dem Netz kommt (einmalig das Sprachmodell von jsDelivr + Hugging Face)
und dass die Dokumente das Gerät nicht verlassen. Erst „⬇️ Modell laden" holt etwas.
Die Leiste zeigt danach den Zustand (`data-bed-zustand`): **lädt** (Balken, Prozent, „x / y MB")
· **ordnet ein** („Dokumente werden eingeordnet: i von n") · **bereit** · **Fehler** (mit Grund
und „↻ Nochmal"). Die Wahl liegt in `EINST.bedeutung`; danach startet sie beim Öffnen von selbst.

- `vendor/sbkim/03_embedding.js` und `04_match.js` sind **byte-1:1 aus Sage** (`src/modules/`,
  Stand 4fe124d), in `tests/bedeutung.mjs` per SHA-256 gepinnt — dort pflegen, hier neu kopieren.
  Dasselbe Modell wie PWA Toolpoint (multilingual-e5-small). Geladen werden sie erst auf Knopfdruck.
- Die Rechnung steht in `assets/bedeutung.js` (Node-prüfbar, später in die WorkFlohs kopierbar).
  Seit Klaus' Befund (2026-09-26: zwei Wörter gut, ein Satz aus zehn Wörtern schwach) gilt:
  **Satzweise Abschnitte** (`STUECK_ZIEL` 120, `STUECK_MAX` 260 Zeichen; ein Abschnitt endet an
  einem Satzende, das letzte kurze Stück beginnt den nächsten mit = Überlappung) + ein Abschnitt aus
  Name und Feldern ohne Seite. **Kein Deckel mehr** — vorher 80 Abschnitte je Dokument, bei einem
  400-Seiten-Handbuch blieb der größte Teil uneingeordnet. Der Fingerabdruck trägt `ZERLEGUNG`
  (`z2`): alte 500-Zeichen-Vektoren werden von selbst neu eingeordnet.
  **Relatives Fenster**: gezeigt wird, was höchstens `ABSTAND` 0,04 hinter dem besten Dokument
  liegt, nie unter `NAEHE_MIN` 0,80, höchstens 12 — der rohe e5-Cosinus hat einen Boden um 0,83
  (Sage-Lehre), eine feste Schwelle unterscheidet darüber nichts. Liegt nichts über 0,80, stehen die
  3 nächsten als „schwach" da (`data-schwach`, graue Zahl). **Lange Fragen**: Suchwörter ab vier
  Buchstaben (ab zwei Stück) geben bis zu `WORT_BONUS` 0,05 auf die Rangfolge; die angezeigte Nähe
  bleibt die echte, die Fundstelle sagt „3 von 5 Suchwörtern".
  ⚠ 120 · 260 · 0,04 · 0,80 · 0,05 · 12 · 3 sind **gewählt, nicht an echten Dokumenten gemessen**.
- **Einordnen im Hintergrund**: Dokument für Dokument, Leiste „Wird eingeordnet: Name · Seite x von y",
  darunter „Dokument i von n · ≈ s je Seite · noch ≈ min" — erst nach 32 GEMESSENEN Abschnitten
  (`BED.msStueck`, gemerkt in `EINST.bedMsStueck`), vorher „Zeit je Seite wird gemessen …".
  **Suchen geht schon währenddessen** (`bedeutungSucht`), mit dem Hinweis, dass noch etwas dazukommt.
- Die Bedeutungs-Treffer stehen UNTER den Wort-Treffern („🧠 Nach Bedeutung ähnlich — ohne die
  gesuchten Wörter"); ein Wort-Treffer steht nie zweimal da. Aus so einer Karte geöffnet, wird der
  ähnlichste Abschnitt markiert (`.fund[data-art="bedeutung"]`).
- Vektoren liegen im Fach **`vektoren`** (DB-Version 3): ein Kopf `id` → {sig, n, fertig} und
  Blöcke `id#00000` zu je 64 Abschnitten (`VEK_BLOCK`). Gespeichert wird nach jedem vollen Block —
  nach einer Unterbrechung (Neuladen, App zu) geht es an derselben Stelle weiter; nur lückenlose
  Blöcke zählen. Unveränderter Fingerabdruck = aus dem Speicher, geändert = nur dieses Dokument neu.
  `DB.putFile`/`del('files')` werfen Kopf UND Blöcke weg (`DB.vektorenWeg`).
- Der Service-Worker legt transformers.js (jsDelivr, feste Fassung 2.17.2) in einen eigenen Vorrat
  `workfloh-pdf-modell-v1`; er und `transformers-cache` (das Modell) überleben ein neues CACHE_VERSION.
- ⚠ **Das echte Modell ist hier NICHT gelaufen.** Der Behälter erreicht jsDelivr und Hugging Face
  nicht (CONNECT 403). Die Probe ersetzt Modul 03 durch einen Stellvertreter mit derselben
  Oberfläche und denselben Fortschritts-Meldungen; Modul 04 ist echt. Ungemessen: die wirkliche
  Größe (Sage nennt ~30 MB), ob Fenster und Wort-Vorsprung bei e5 wirklich besser trennen, wie
  lange das Einordnen eines 400-Seiten-Handbuchs am Tablet dauert (die Leiste misst es), wie viel
  Speicher die Vektoren brauchen (geschätzt, nicht gemessen: einige MB je 400 Seiten), ob es offline
  weiterläuft.
- Noch nicht gebaut: „lernt aus den geöffneten Treffern" (Klaus' Plan), Stufe 3 (WorkFlohs).
- Proben: `tests/bedeutung.mjs` (in `npm test`) · `node tests/gegenprobe_bedeutung.mjs`
  (27 Fälle, Wegwerf-Kopie; `NUR_ANKER=1` nur die Anker). Die Handbuch-Probe (30 Seiten, Stellvertreter
  mit Takt) misst Fortschritt, Suche während des Einordnens, Fortsetzen nach dem Neuladen und den Treffer auf Seite 30.

## 🎤 Spracheingabe mit Laufbalken (Klaus 2026-09-27)

„Beim Einsprechen sollte wie bei dir und bei ChatGPT ein Laufbalken sein mit Pünktchen und
senkrechten Strichen … und der Text wird gleich ausgegeben, so wie er eingesprochen wird."
Mikrofon im Suchfeld der Bibliothek: darunter ein Balken mit 40 Stellen, der nach links läuft —
Striche, solange die Erkennung Sprache hört und Text liefert, Pünktchen in den Pausen. Der Text
steht schon beim Sprechen im Feld; gesucht wird am Ende (nach 2,6 s Pause von selbst, oder
„Fertig"/Mikrofon), weil die Suche nach Bedeutung nicht bei jedem halben Wort neu rechnen soll.

- `assets/sprechen.js` ist **host-neutral** und wird byte-1:1 in die WorkFlohs kopiert
  (`assets/wfpdf/sprechen.js`, dort per SHA gepinnt) — nur hier ändern, dann dort neu kopieren.
- ⚠ **Der Balken ist kein Pegel.** Ein zweiter Mikrofon-Zugriff (getUserMedia) neben der
  Spracherkennung greift auf Android um dasselbe Mikrofon; der Balken folgt deshalb den Meldungen
  der Erkennung (speechstart/-end, neuer Text). Nicht am Tablet gemessen.
- Proben: `tests/sprechen.mjs` (in `npm test`, gestellte Erkennung) ·
  `node tests/gegenprobe_sprechen.mjs` (16 Fälle, Wegwerf-Kopie; `NUR_ANKER=1` nur die Anker).

## 📋 Aus der To-Do-Liste vom 2026-09-27 (docs/TODO.md, alle 7 erledigt)

- **Schiebe-Griff:** zweimal gebaut, einmal behalten. Eine Parallel-Sitzung hat am selben Tag
  `assets/schieber.js` für Feldarten- UND Ordner-Leiste gemergt (#67, Abschnitt unten); der eigene Griff
  (`#ordnerGriff`) ist beim Zusammenführen wieder raus — die To-Do-Liste verlangt EINE Bauweise für beide.
- **↑ an jeder Karte** links neben dem Auswahl-Punkt (`.dok-hoch`, `ganzNachOben`), erst wenn die Seite
  gerollt ist (`html.gerollt`, scrollY > 160). Ein langer Druck darauf startet kein Ziehen.
- **Kopfleiste schmal:** ≤ 480 px und ≤ 370 px kleinere Knöpfe/Floh, der Schriftzug darf umbrechen
  („Workfloh / PDF") statt unter die Knöpfe zu laufen; `.marke` schneidet notfalls ab. Gemessen bei
  320 · 360 · 390 · 412 · 480 px, MIT sichtbarem Installieren-Knopf.
- **Erstellungsdatum:** Sortierung `erstellt` (neueste zuerst) und ein Zeitraum **„📅 Erstellt von … bis …"**
  (`S.von`/`S.bis`, `imZeitraum`, beide Enden eingeschlossen, nur `createdAt`, Ortszeit via `tagVon`) — kein Datum
  aus dem Inhalt, nicht das Änderungsdatum. **Die Kopfzeile heißt nur „⇅ Sortieren"** (Klaus 2026-09-27, wie in Tomys
  WorkFloh: fett, ohne ▶-Pfeil und ohne „: Erstellungsdatum" — was gewählt ist, steht beim Aufklappen im Auswahlfeld);
  ein gewählter Zeitraum steht zugeklappt weiter daneben. In der Auswahl-Leiste heißt der Knopf nur „Alle". Seit 2026-09-27 (Klaus: „nicht außerhalb des Containers … klappt es
  sich mit ein") stehen Sortieren UND Zeitraum in EINEM `<details data-sortbox>`; zugeklappt nennt die Kopfzeile
  Sortierung und Zeitraum. Offen/zu liegt in `S.sortOffen` (die Leiste wird bei jedem Zeichnen neu gebaut).
  „Erstellungsdatum" wählen öffnet gleich den Kalender für „von". Widersprechen sich die Enden, gewinnt das
  gerade gewählte, das andere rückt auf denselben Tag (nie still eine leere Liste).
- **Spracheingabe** (`assets/sprechen.js`, byte-1:1 in beide WorkFlohs): Text wird bei jedem Ereignis aus
  der GANZEN Ergebnisliste gebaut (`zusammenfuegen`, keine Doppelwörter mehr) · Balken sofort und IM Feld
  (Option `feld`: das Feld wird unten höher) · „■ Stopp". Benannte Grenze: ein absichtlich als eigene
  Äußerung wiederholtes Wort kommt einmal.
- **Eine Lupe:** der Platzhalter trägt keine mehr, der 🔍-Knopf bleibt (Klaus: „Suche ist okay").
- Proben: `tests/bibliothek.mjs`, `tests/sprechen.mjs` · Gegenproben `gegenprobe_bibliothek.mjs` (17),
  `gegenprobe_sprechen.mjs` (25). ⚠ Im Headless-Chromium geht nach einem Finger-Zug über eine Fläche mit
  `touch-action:none` der NÄCHSTE Tipp verloren (an einer leeren Testseite nachgestellt) — die Probe
  misst den ↑ deshalb ohne Zug davor. Am Tablet ungemessen.

## 🎚 Sichtbarer Schieberegler (Klaus 2026-09-27)

„Dass man ihn anfassen kann mit einem Viereck … Bei kleineren Handys ist sonst nicht zu erkennen, dass
da noch mehr folgt." Unter der Feldarten-Leiste (Fuß des Editors) und den Ordner-Knöpfen steht eine
Schiene mit Griff (drei Rillen, mindestens 44 px breit). Griff ziehen oder auf die Schiene tippen rollt
die Leiste, Wischen in der Leiste lässt den Griff mitlaufen. Passt alles hinein, ist die Schiene weg.

- `assets/schieber.js` ist **host-neutral** und wird byte-1:1 in die WorkFlohs kopiert
  (`assets/wfpdf/schieber.js`, in Mein-WorkFloh per SHA gepinnt). Nur hier ändern, dann dort neu kopieren.
- Die Schiene steht als Geschwister NACH der Leiste. Im Flex-Fuß braucht sie `flex:0 0 100%`, sonst
  schrumpft sie auf **0 px** (Befund beim Bau, eigener Gegenprobe-Fall).
- Nebenbei behoben: ein Größenwechsel und Zurück zur Bibliothek innerhalb von 250 ms warf
  (`zeichneSeiten` mit `S.doc = null`).
- Proben: `tests/schieber.mjs` (in `npm test`, Handy 380 px mit Touch) ·
  `node tests/gegenprobe_schieber.mjs` (10 Fälle; `NUR_ANKER=1`, `NUR_FALL="…"`).

## 🗂 Sortieren und Ordner ausgeben (Klaus 2026-09-26)

„Seite 1 bis 40 als erstes, dann Seite 41 bis 81 … nach Dateinamen oder nach Dateigröße" · „der
Ordner als Ganzes mit den integrierten PDFs freigeben oder ausgeben".

- **Sortieren** über der Liste (`SORTIERUNG`, `sortiere()`): Name (Vorgabe), Zuletzt geändert,
  Dateigröße, Seitenzahl — die Wahl liegt in `EINST.sortierung`. Namen werden **natürlich**
  verglichen (`numeric: true`: „Teil 2" vor „Teil 10"), auch beim Einlesen eines Ordners. Bei
  einer Suche ordnet weiter die Trefferstärke. Größen stehen nicht am Dokument — beim ersten
  Sortieren nach Größe werden sie nachgelesen und die Liste neu gezeichnet.
- **📤 Ordner ausgeben** (`ordnerAusgabe`) beim gewählten Ordner, Reihenfolge = die Sortierung.
  Jedes Dokument als festes / ausfüllbares PDF / Vorlage / Original. Drei Wege: **ZIP** (eine Datei,
  benannt wie der Ordner) · **alle Dateien teilen** (nur wenn `navigator.canShare`) · **zu einem
  PDF zusammenfügen** (z. B. die übersetzten Teile wieder als ein Buch; Felder werden fest).
  Teilen braucht einen frischen Tipp — nach dem Bauen steht deshalb „📤 Jetzt teilen …" da.
- `assets/zip.js` wird **byte-1:1 in die WorkFlohs kopiert** (`assets/wfpdf/zip.js`, dort per SHA
  gepinnt) — nur hier ändern, dann dort neu kopieren. Die WorkFlohs haben dieselbe Ausgabe für die
  Dateien am Auftrag (Sortieren, „📤 Alle ausgeben") und den Aufteilen-Kasten (seit 2026-09-26).
- `assets/zip.js`: ZIP ohne Bibliothek, nur „gespeichert" (PDFs sind schon gepackt), Namen UTF-8,
  gleiche Namen bekommen „ (2)". Läuft auch in Node.
- ⚠ **Headless-Chromium meldet für JEDEN Dateinamen mit Nicht-ASCII-Zeichen („·", Umlaut) beim
  Herunterladen nur „download"** (nachgestellt an einer leeren Seite). Die Probe liest den Namen
  deshalb aus `window.__wfpdfOrdnerAusgabe`. Was das Tablet daraus macht, ist ungemessen.
- Proben: `tests/ordner.mjs` (in `npm test`) · `node tests/gegenprobe_ordner.mjs` (14 Fälle).

## 📤 Teilen, Mehrfachauswahl, auf einen Ordner ziehen (Klaus 2026-09-27)

„sodass man am schnellsten von einem Ort zum Teilen kommt, wenn man fertig ist" · „durch ein
dauerhaftes Klick soll ein kleines Kästchen oben angehen … wie bei Bilderauswahl" · „fest andrücken
und ziehen" auf einen Ordner.

- **📤 an jeder Karte** (vor 🗑) und **im Editor direkt vor „⬇ PDF ausgeben"** (`edTeilen`). Beide rufen
  `teilenDocs(ids)`: mit Einträgen das feste PDF, ohne Einträge das Original. Der Editor speichert vorher.
  Teilen braucht einen frischen Tipp — verweigert Android es nach dem Bauen (NotAllowedError), steht
  „📤 Jetzt teilen …" da; kann das Gerät nicht teilen: Herunterladen (mehrere als ZIP).
- **Auswahl** (`WAHL`, `WAHL_AN`): Kästchen oben rechts auf der Karte (am Tablet immer sichtbar, mit
  Maus beim Darüberfahren) oder langer Druck (`LANGDRUCK_MS` 450). Im Auswahl-Modus wählt ein Tipp,
  statt zu öffnen. Leiste `#wahlLeiste`: Anzahl · Alle wählen · 📤 Teilen · 🗂️ Verschieben · 🗑 Löschen · ✕ Fertig.
  **🗑 Löschen** (Klaus 2026-09-27, `loeschenMehrere`): EINE Frage mit Zahl und Namen (bis 8, dann „… und N weitere“),
  danach Dokument UND Datei weg (Seitentext und Vektoren über `DB.del('files')`), Auswahl aufgehoben.
- **Ziehen** — die Technik aus Mein Rezeptbuch: nach dem langen Druck folgt ein Schattenbild dem Finger,
  gesucht wird per `elementFromPoint` (Schatten kurz ausgeblendet), überstrichene Karten kommen in die
  Auswahl, loslassen auf einem Ordner-Chip verschiebt alle gewählten (`inOrdner`), „＋ Ordner" legt erst
  einen an, „Alle" ist kein Ziel. **Eine überstrichene Karte kommt erst nach 250 ms Verweilen dazu**
  (`VERWEIL_MS`, wie in den WorkFlohs, 2026-09-27) — wer zum Ordner oben gleitet, nimmt die Karten auf dem Weg
  nicht mit. Die alte Uhr wird gestoppt UND prüft beim Feuern, ob der Zeiger noch dort ist (zwei Riegel, ein
  Gegenprobe-Fall nimmt beide). 250 ms sind gewählt, nicht am Tablet gemessen. Mit der Maus beginnt das Ziehen nach 10 px Weg; mit dem Finger heißt
  sofortiges Bewegen Rollen. `touchmove` ist nicht passiv und wird nur beim Ziehen abgefangen; der Klick
  nach dem Ziehen/langen Druck wird geschluckt (`klickSperre`). `verschieben(id|ids)` nimmt beides.
- ✅ **Klaus' Sichttest 2026-09-28:** Auswahl, Ziehen mit Verweilen 250 ms und Teilen in Ordnung (seine
  Auskunft als Ganzes). Hier stand: *„⚠ Nicht gemessen: echtes Teilen am Tablet (headless ist `navigator.share`
  gestellt) und das Ziehen mit echtem Finger auf Android/DeX (gemessen mit CDP-Touch-Ereignissen)."* Die Proben
  stellen `navigator.share` weiter; einzelne Wege (DeX, Teilen-Abweisung) hat er nicht getrennt benannt.
- Proben: `tests/teilen.mjs` (in `npm test`, 47 grün) · `node tests/gegenprobe_teilen.mjs` (20 Fälle, zuletzt 2026-09-27: 20 gefangen · 0 blind · 0 falsch · 0 tote Anker,
  Wegwerf-Kopie; `NUR_ANKER=1`, `NUR_FALL="…"`).

## 🔗 Links im Feld (Klaus 2026-09-26)

Beim Ausfüllen wird eine E-Mail, eine Internetadresse (www…, …de) oder eine Telefonnummer
(ab 6 Ziffern) selbst zum Link: blau, unterstrichen, ein Tipp öffnet Mailprogramm, Telefon oder
Browser, ✏️ daneben zum Ändern (`linkZiel`, `linkFeld` in `app.js`). Textfelder erkennen das
selbst — Workflow PDF hat keine Feldart „Telefon". Datum, Name, PLZ bleiben Text. Beim Drucken
dunkel ohne Unterstrich. Dieselben Regeln wie `ovLinkZiel` in den WorkFlohs.

**Zahlen sind kein Anruf** (Klaus 2026-09-26): in einem normalen Textfeld wird eine Zahl NICHT
zum Telefon-Link — sie kann eine Kunden- oder Auftragsnummer sein. Anruf nur in der Feldart
**Telefon**. Dazu die Feldarten **Kundennummer** und **Artikelnummer**: antippen zeigt alle Dokumente
mit derselben Nummer (`nummerOeffnen`); eine Kundenverwaltung/Warenwirtschaft hängt sich später über
`window.WF_KUNDE_OEFFNEN(nr)` / `window.WF_ARTIKEL_OEFFNEN(nr)` ein. Die Bibliothek hat ein Suchfeld,
das auch in den Feldinhalten sucht. Nummern werden beim Übersetzen nicht übersetzt.

## 🎬 Erklärvideo aus der Hilfe (Klaus 2026-09-28)

„Ja, mach das so, 1 und 2 zusammen": in der Hilfe **🎬 Erklärvideo** (`erklaervideo()` in app.js) und ein Link
„Alle Kapitel und das Video hochkant auf der Webseite". Das Video liegt auf **Workfloh-PDF-Page** (gleiche Adresse
lausiklauskn-png.github.io), `assets/workfloh-pdf-quer{,-en,-ru}.mp4` samt `poster-{de,en,ru}.jpg` —
**keine Kopie hier**. Sprache aus `WFP.Sprache.lang`; Arabisch gibt es nicht → Englisch, und der Dialog sagt das.
- **Auch in der Kopfleiste** (Klaus 2026-09-28: „einen Knopf in die Kopfleiste neben dem Fragezeichen"): `#btnVideo` 🎬
  direkt links neben `?`. Bei ≤ 370 px passen sechs Knöpfe samt Installieren nur mit eigenem Block in `style.css`
  (Installieren rund 31 px, Abstand 2 px, Schriftzug .86rem) — ohne ihn wird „Workfloh PDF" bei 320 px abgeschnitten
  (`tests/bibliothek.mjs` 3 fängt es).
- Geladen wird erst auf Tipp (`preload="metadata"`). **Nicht im Offline-Vorrat:** `sw.js` lässt jeden Abruf unter
  `/Workfloh-PDF-Page/` durch, bevor der Vorrat greift (große Datei, Range-Antworten 206). Offline oder wenn die
  Webseite nicht antwortet: kein Video, sondern der Satz, dass es Internet braucht.
- **Hochkant läuft das GANZE Video hochkant** (Klaus 2026-09-28: „da weitermachen, wo das Querformat aufgehört hat,
  ohne Verzögerung"): `videoFuer(lang, hoch)` wählt nach `matchMedia('(orientation: portrait)')`
  `workfloh-pdf-hochvoll*.mp4` + `poster-hochvoll-*.jpg`. Beide Fassungen sind szenengenau gleich lang (gebaut auf
  der Webseite). Nach dem Start lädt die andere Lage verborgen und stumm mit; Drehen übernimmt die Stelle und schaltet
  um (nicht im Vollbild). Zuhörer gehen beim Schließen weg, auch bei Esc. `tests/video.mjs` 3b (Stellvertreter mit
  Range-Antworten — ohne sie ist nichts springbar).
- **Wer ein Video auf der Webseite umbenennt, bricht diesen Knopf** — dort steht der Hinweis darauf.
- Probe: `tests/video.mjs` (in `npm test`, Webseite gestellt, WebM als Stellvertreter). ⚠ Benannte Grenze: ein
  Lauf MIT Worker misst hier nichts (127.0.0.1 ist ein anderer Ursprung als github.io) — gemessen wird die
  Sperrzeile im Quelltext. Ob das echte MP4 am Tablet aus der App heraus spielt, ist nicht gemessen.

## ⚖️ Impressum & Datenschutz (Klaus 2026-09-27)

Unter der Bibliothek steht „Impressum & Datenschutz" (`#rechtFuss`, öffnet `impressum.html`). Der Datenschutz dort
nennt jetzt auch Scannen (samt „Mit ChatGPT übersetzen" über das Teilen-Fenster), die Suche nach Bedeutung
(Download von jsDelivr + Hugging Face), die Spracheingabe (Chrome → Google), Rechtsgrundlagen und Stand 27.09.2026.
Wer eine Funktion ergänzt, die etwas ins Netz schickt, zieht dort nach. `tests/schieber.mjs` misst Fuß und Stand.

## 📘 Handbuch und Beispiel-Formular (Klaus 2026-09-25)

`beispiele/Workfloh-PDF-Benutzerhandbuch.pdf` (22 Seiten, 13 Bilder, zuletzt neu gebaut 2026-09-27 nach #76–#82: Scannen in Kapitel 3, Kapitel 6 Suchen mit Spracheingabe und Bedeutungssuche, Kapitel 7 Teilen/Auswahl/Sortieren mit Erstellungsdatum von–bis (Bild 10)/Ordner ausgeben, Übersetzen in Teilen; die Datumsfelder im Bild zeigen das US-Format des Headless-Browsers) und
`beispiele/Beispiel-Amtsformular-Bewohnerparkausweis.pdf` (erfunden, Stadt Musterstadt).
Zum Nachlesen UND als Testmaterial fürs Übersetzen, ohne eigene Daten ins Netz zu geben:
Bilder, Farbkästen, Tabellen, Zweispalter, Querformat, eine gescannte Seite ohne Textebene.

- **Gebaut, nicht von Hand:** `node tools/handbuch-bauen.mjs` (Inhalt in
  `tools/handbuch-inhalt.js`, Formular in `tools/handbuch-formular.js`). Die Bildschirmfotos
  nimmt es an der echten App auf — wer die Oberfläche ändert, baut das Handbuch neu.
- Nur Zeichen der Standardschrift (WinAnsi): keine Emojis, keine Pfeile.
- In der App: Hilfe → „📘 Handbuch öffnen" / „📄 Beispiel-Formular", und
  🌐 Übersetzen → „📘 Beispiele zum Ausprobieren" (`beispieleLaden()`, Ordner „Beispiele",
  nichts doppelt). Nicht im Installations-Vorrat; der Worker legt sie beim ersten Abruf ab.
  Das Handbuch nennt diesen Weg wörtlich — `tests/beispiele.mjs` hält beide zusammen.

## Netzweit

Freibrief · frisch von `origin/main` · Ton · kein PII · Ehrlichkeit:
[Sage-Protokol/docs/NETZWEIT.md](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/NETZWEIT.md)
- **HTML-Ausgabe** (`assets/html-export.js`): Seiten als Bild + echte Eingabefelder,
  eigenständige Datei. Für Geräte, deren PDF-Anzeige keine Formulare kann (Google
  Drive/Files). Kästchen sind durchsichtig, damit gedruckte Haken sichtbar bleiben —
  dasselbe gilt für die Kästchen-Widgets im ausfüllbaren PDF.
