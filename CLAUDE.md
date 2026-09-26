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
- **Bilder mit Text auf Seiten MIT Textebene** (`bildFlaechen`): größere Bilder werden bei
  3-facher Größe per Texterkennung gelesen und übersetzt — vorher nur ganz textlose Seiten.
  Das ist Klaus' Idee „das Bild in der anderen Sprache": der Text im Bild wird übersetzt
  darübergelegt. Logos/Symbole (< 4 % der Seite, < 80×60 pt) bleiben unberührt.
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
- **Plan danach** (Klaus' Wahl): Stufe 2 Bedeutungssuche mit Modul 03/04 aus Sage (dasselbe
  Modell wie PWA Toolpoint), freiwillig einschaltbar, lernt aus den geöffneten Treffern ·
  Stufe 3 dieselbe Suche in den WorkFlohs — **Mein-WorkFloh und Tomys WorkFloh getrennt**, und
  **nur entsperrt** · Stufe 4 Scans und E-Mails.
- Proben: `tests/suche.mjs` (in `npm test`) · `node tests/gegenprobe_suche.mjs` (22 Fälle,
  Wegwerf-Kopie; zwei Riegel, die einander decken — Öffnen und Schließen leeren die
  Markierungen — nimmt EIN Fall zusammen weg).

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
