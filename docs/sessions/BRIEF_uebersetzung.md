# Brief: PDF-Ordner übersetzen (Deutsch · Russisch · Englisch)

Stand: 2026-09-25 · geschrieben gegen `origin/main`, kein offener PR vorausgesetzt.

> ✅ **Erledigt am 2026-09-25** — was gebaut, gemessen und offen ist, steht in
> `ABSCHLUSS_2026-09-25_uebersetzung.md`; weiter geht es mit
> `BRIEF_uebersetzung-am-geraet.md`.

## Pflichtlektüre, in dieser Reihenfolge

1. `CLAUDE.md` dieses Repos und `Sage-Protokol/docs/NETZWEIT.md`
2. `THIRD_PARTY.md` — was schon mitgeliefert wird und unter welcher Lizenz
3. `assets/app.js` (Ordner-Import `inOrdner`, Bibliothek), `assets/export.js`,
   `assets/html-export.js`
4. In Mein-WorkFloh und Tomys-Hub: `assets/wfpdf/werkzeug.js` — der Klebstoff,
   der das Werkzeug in beide WorkFlohs bringt (identisch halten)

Erst lesen, dann einen **Plan an Klaus** — erst danach bauen.

## Das Ziel, in Klaus' Worten

> „einen kompletten Ordner importieren … mindestens 400 Seiten … in eine andere
> Sprache übersetzen … genauso wie es in Google gemacht wird, im Google-Browser …
> dann ausgedruckt oder als PDF neu ausgegeben … Genauso die Gegenprobe: in die
> andere Richtung übersetzen … und in der jeweiligen Sprache abspeichern."

- **Sprachen:** Deutsch, Russisch, Englisch — jede Richtung.
- **Hauptziel ist die Übersetzung**, nicht die Felderkennung. Felder suchen je
  Seite ist erlaubt, aber nachrangig (kostet Zeit und API-Geld).
- **Gilt für alle Werkzeuge, die PDFs bearbeiten:** Workflow-PDF, Mein-WorkFloh,
  Tomys-Hub/workfloh.
- **Umfang:** „Was machbar ist, werden wir sehen." Ist ein Teil leicht, darf er
  gleich gebaut werden; sonst zuerst der Plan.

## Was heute schon da ist

- Ordner einlesen (`webkitdirectory`, alle PDFs und Bilder) → IndexedDB.
- pdf.js rendert die Seiten, pdf-lib schreibt PDFs, HTML-Ausgabe legt die Seiten
  als **Bild** plus Eingabefelder ab.
- KI ist BYOK und freiwillig, Standard Mistral (EU).

## Die Frage, an der alles hängt: hat die Seite Text oder nur ein Bild?

| PDF-Art | Text da? | Weg |
|---|---|---|
| digital erzeugt | ja, per `page.getTextContent()` samt Lage | Text herausziehen → übersetzen → neu setzen |
| gescannt / Foto | **nein** | erst Texterkennung (OCR), dann wie oben |

**Die heutige HTML-Ausgabe hilft dem Chrome-Übersetzer nicht:** die Seiten sind
Bilder, und Bilder übersetzt Chrome nicht. Für „wie in Google" braucht es eine
Ansicht mit **echtem Text im HTML**.

## Drei Wege zur Übersetzung — zum Abwägen, nicht entschieden

| | Weg | Kosten | Grenze |
|---|---|---|---|
| A | **Chrome übersetzt die Textansicht** (Klaus' Idee): Seite als HTML mit echtem Text, Nutzer tippt „Übersetzen", dann Drucken → PDF | keine | Chrome übersetzt nur, was sichtbar geladen ist; 400 Seiten in einer Ansicht sind schwer; das Ergebnis liegt nur im Browser, die App kann es nicht auslesen und speichern. **Ob Chrome auf Android die Seite übersetzt, wenn sie als PWA läuft, ist nicht geprüft** |
| B | **Übersetzer-API im Browser** (`Translator`, in Chrome eingebaut, läuft auf dem Gerät) | keine | **nicht geprüft**, ob es auf Klaus' Tablet (Android-Chrome) verfügbar ist und ob Deutsch↔Russisch dabei ist. Zuerst mit `'Translator' in self` und `Translator.availability()` messen |
| C | **KI mit eigenem Schlüssel** (Mistral schon da; DeepL wäre möglich) | je Seite bezahlt | Text verlässt das Gerät → vorher bestätigen lassen, wie bei der KI-Felderkennung |

### Klaus' Ansatz (2026-09-25, nachgereicht): erst HTML, dann übersetzen

> „die PDFs als HTML-Dokument … im Hintergrund speichern und die HTML-Datei zu
> übersetzen, wenn es ein Problem darstellt mit der Übersetzung."

Das ist ein **Zwischenformat**: PDF → HTML-Datei mit echtem Text (je Seite ein
Abschnitt, Text in seiner Lage über dem Seitenbild) → diese Datei übersetzen
(Chrome, `Translator` oder KI) → drucken oder als PDF ausgeben.

**Was dafür stimmen muss:**
- Die HTML-Datei braucht **Text**, nicht nur Seitenbilder. Die heutige
  `html-export.js` legt Bilder ab — sie müsste um eine **Textebene** aus
  `getTextContent()` erweitert werden (so wie pdf.js' eigener „text layer").
- Der Vorteil: die Datei liegt gespeichert vor, man kann sie seitenweise öffnen
  (kein 400-Seiten-Brocken auf einmal), und jede übersetzte Fassung lässt sich
  als eigene Datei ablegen.
- Die offene Frage bleibt dieselbe wie bei Weg A: **übersetzt Chrome eine
  lokal geöffnete HTML-Datei auf dem Tablet?** Zuerst an einer Seite messen.

Wahrscheinlich die ehrlichste Richtung: **B wo verfügbar, C als Rückfall, A als
Hilfe ohne Speichern**. Das ist ein Vorschlag, keine Messung.

## Die Ausgabe

- **Neues PDF je Sprache**, abgelegt im Ordner als eigenes Dokument
  (`<name>.ru.pdf` o. ä.). Original bleibt unberührt.
- **Gegenprobe:** das übersetzte PDF zurück in die Ausgangssprache übersetzen und
  neben das Original legen — so sieht man, was verloren ging.
- **Layout:** der übersetzte Text ist länger oder kürzer. Einfachster Weg:
  Original als Hintergrund, Textblöcke weiß abdecken, Übersetzung in die Lage
  setzen (Schrift ggf. verkleinern). Zweiter Weg: reiner Textfluss ohne Lage.

## ⚠ Russisch braucht eine eingebettete Schrift

pdf-lib kann mit den eingebauten Standard-Schriften **keine kyrillischen
Buchstaben** schreiben. Nötig ist `@pdf-lib/fontkit` plus eine Schrift mit
Kyrillisch (z. B. Noto Sans). Das vergrößert jede Ausgabe um die Schrift.
Ohne das bricht der Export ab oder zeigt Leerstellen — **mit einem russischen
Satz testen, nicht nur mit Deutsch**.

## Lizenzen — was wir gelernt haben

Alles, was neu mitgeliefert wird, kommt **lokal** in `vendor/` (kein CDN — das
verrät die IP an Dritte) und bekommt eine Zeile in `THIRD_PARTY.md`.

| Baustein | Lizenz (vor dem Einbau am Paket nachlesen) | Pflicht |
|---|---|---|
| `@pdf-lib/fontkit` | MIT | Lizenzkopf behalten |
| Noto Sans (o. ä.) | SIL Open Font License 1.1 | **Lizenztext mitliefern**, Schrift nicht unter „Noto" umbenannt verändern |
| Tesseract.js (OCR, falls nötig) | Apache-2.0 | Lizenz + NOTICE; Sprachdaten (deu/rus/eng) sind groß — Größe messen, nicht schätzen |
| Chrome-Übersetzung / `Translator` | Teil des Browsers, nichts mitzuliefern | Nutzungsbedingungen von Google gelten für den Nutzer; im Hilfetext nennen |
| Mistral / DeepL | Dienst, BYOK | Datenschutzerklärung: welche Daten wohin gehen (Datenschutz dieses Repos und der WorkFlohs nachziehen) |

PDF selbst ist ISO 32000, frei nutzbar — keine Adobe-Lizenz nötig (geklärt am
2026-09-25). Das ist keine Rechtsberatung.

## Mengengerüst — messen, nicht schätzen

400 Seiten sind der Maßstab. Zu messen, bevor irgendetwas versprochen wird:
Zeit je Seite (Text holen, übersetzen, neu setzen), Speicher im Tablet-Browser,
Größe des Ergebnis-PDFs, und bei C die Kosten je Seite. **Seitenweise arbeiten
und nach jeder Seite speichern**, damit ein Abbruch nicht alles kostet; eine
Fortschritts-Anzeige mit „Seite 137 von 400" und einem Abbrechen-Knopf.

## Akzeptanz

- Ein Ordner mit mehreren PDFs lässt sich in DE→RU, RU→DE, DE→EN, EN→DE,
  RU→EN, EN→RU übersetzen, jede Seite einzeln.
- Kyrillisch steht im Export-PDF lesbar da (Probe prüft es mit einem echten Satz).
- Die Gegenprobe (Rückübersetzung) lässt sich auslösen und wird abgelegt.
- Nichts geht ohne Bestätigung ins Netz.
- `THIRD_PARTY.md`, Impressum/Datenschutz nachgezogen, Cache-Bump in `sw.js`.
- Mein-WorkFloh und Tomys-Hub bekommen dasselbe über `werkzeug.js`.
- `npm test` grün, dazu eine Browser-Probe mit erfundenen Daten.
- Klaus' Sichttest am Tablet steht aus, bis er ihn gemacht hat.

## Offene Fragen an Klaus

1. Soll das Ergebnis das **Layout behalten** (Übersetzung auf dem Original)
   oder reicht **reiner Text**?
2. Welche PDFs sind es meistens — **digital** oder **gescannt**? Davon hängt ab,
   ob OCR nötig ist.
3. Ist ein bezahlter Weg (Mistral/DeepL) in Ordnung, oder nur kostenlos?

## Abschluss-Befehl

Am Ende: Abschlussbrief mit gemessenem Stundennachweis, neuen Brief als
Codeblock im Chat, PR selbst mergen, auf `main` nachsehen, dann den Zweig heben.
