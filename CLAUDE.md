# Workfloh PDF — Sitzungs-Anker

PWA für Formulare: einlesen (PDF, Foto, Ordner) → Felder erkennen oder setzen →
ausfüllen → festes / ausfüllbares PDF / leere Vorlage. Kein Build-Schritt.
Vorlage war der Originaldokument-Modus von Mein-WorkFloh (Felder in Prozent
über der echten Seite, „bearbeiten" gegen „ausfüllen").

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
- **Erkennung:** Linien, Rahmen, Kästchen UND hellgraue Flächen (`flaechen()`).
  Die KI bekommt die Offline-Kandidaten nummeriert ins Bild gezeichnet und
  benennt sie — ihre eigenen Koordinaten sind ungenau („alle auf einem Haufen").
- **Speichern:** laufend in IndexedDB, sofort bei `visibilitychange`/`pagehide`;
  💾 legt eine Arbeitsstand-Datei (`*.workfloh.json`, PDF + Felder) aufs Gerät.
- **KI ist BYOK und freiwillig**, Standard Mistral (EU). Ohne Bestätigung geht
  nichts ins Netz.

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
- **Bilder mit Text auf Seiten MIT Textebene** (`bildFlaechen`): größere Bilder werden bei
  3-facher Größe per Texterkennung gelesen und übersetzt — vorher nur ganz textlose Seiten.
  Das ist Klaus' Idee „das Bild in der anderen Sprache": der Text im Bild wird übersetzt
  darübergelegt. Logos/Symbole (< 4 % der Seite, < 80×60 pt) bleiben unberührt.
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

## 📘 Handbuch und Beispiel-Formular (Klaus 2026-09-25)

`beispiele/Workfloh-PDF-Benutzerhandbuch.pdf` (14 Seiten) und
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
