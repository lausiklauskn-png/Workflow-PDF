# Brief: Übersetzung am Gerät messen und schärfen

Stand: 2026-09-25 · geschrieben gegen `origin/main` NACH dem Merge von „Übersetzen"
(Workflow-PDF, Mein-WorkFloh, Tomys-Hub). Ist der Merge nicht auf `main`, zuerst
nachsehen: `git grep -c "uebersetzenStart" origin/main -- assets/app.js`.

## Pflichtlektüre, in dieser Reihenfolge

1. `CLAUDE.md` (Abschnitt „🌐 Übersetzen") und `Sage-Protokol/docs/NETZWEIT.md`
2. `docs/sessions/ABSCHLUSS_2026-09-25_uebersetzung.md` — gebaut, gemessen, offen
3. `assets/uebersetzung.js` (host-neutral, byte-1:1 in beiden WorkFlohs)
4. `tests/uebersetzung.mjs`, `tests/masse.mjs`

Erst lesen, dann einen **Plan an Klaus** — erst danach bauen.

## Was Klaus zuerst tut (braucht keine Sitzung)

1. Workflow PDF am Tablet öffnen → **🌐 Übersetzen …** → einen Ordner einlesen →
   im Dialog **🔎 Messen** drücken → Ergebnis (Text) kopieren und in die Sitzung geben.
2. Ein echtes Handbuch (ein paar Seiten, mit Bildern) DE→RU übersetzen,
   **mit Gegenprobe**, und beide PDFs ansehen: Stimmt die Lage? Lesbar? Farben?
3. Einen Scan / ein Foto eines Handbuchs übersetzen und gegenlesen.

## Was die Sitzung danach tut

- **Messung auswerten:** hat das Tablet den `Translator`? Welche Paare
  (de-ru, ru-de, de-en, en-de, ru-en, en-ru)? Falls **nein**: KI-Weg als Standard
  vorschlagen und Kosten je 400 Seiten aus Klaus' echtem Lauf (Token im Bericht)
  beziffern — nicht schätzen.
- **Befunde aus Klaus' Sichttest** umsetzen (Lage, Schriftgröße, Farben, Tabellen,
  Spalten). Jede Änderung zuerst in `tests/uebersetzung.mjs` als gestellte Lage.
- **PDF bauen dauert 99 s bei 400 Seiten** (gemessen) — prüfen, wo die Zeit steckt
  (Schrift-Teilmenge beim Speichern? Farben?), erst messen, dann ändern.
- Nach jeder Änderung an `assets/uebersetzung.js`: byte-1:1 nach
  `Mein-WorkFloh/assets/wfpdf/` und `Tomys-Hub/workfloh/assets/wfpdf/` kopieren,
  `?v=` und Cache-Versionen in allen drei `sw.js` erhöhen, `browser_pdf.mjs` in
  beiden WorkFlohs fahren.

## Offene Fragen an Klaus

- Welcher Weg am Tablet: Übersetzer im Browser (kostenlos, falls vorhanden) oder KI?
- Sollen Ergebnis-PDFs den Originaltext unter der Abdeckung **entfernen** (dann nicht
  mehr durchsuchbar im Original, aber sauberer) — heute bleibt er drin.

## Abschluss

Abschlussbrief mit gemessenem Stundennachweis, neuer Brief als Codeblock im Chat,
eigenen PR selbst mergen, auf `main` nachsehen, dann den Zweig heben.
