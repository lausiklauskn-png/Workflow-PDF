# Abschluss 2026-09-26 (c) — Suche, Stufe 1

## Auftrag
Klaus: eine Suche über das ganze WorkFloh-Produkt — Auftragsnummer, Kundennummer, Kundenname,
Datum, „eine Sache, die gemacht wurde" — die das PDF findet und die Stelle markiert, auf deren
Grundlage es gefunden wurde; antippen nimmt die Markierung weg. Erst ein Plan.

## Plan (mit Klaus abgestimmt)
1. Wortsuche mit Fundstelle, ohne Modell · 2. Bedeutungssuche (Modul 03/04 aus Sage, dasselbe
Modell wie PWA Toolpoint), freiwillig, lernt aus geöffneten Treffern · 3. dieselbe Suche in den
WorkFlohs · 4. Scans, E-Mails. Entschieden: Mein-WorkFloh und Tomys WorkFloh getrennt; nur
entsperrt suchen; Anfang mit Stufe 1.

## Bestand, gemessen (origin/main, vor dem Bau)
- Workflow PDF suchte in Name und Feldinhalten, per Teilstring, ohne Angleichung — nicht im Seitentext.
- Die WorkFlohs suchen in Aufträgen, Kunden, Dateinamen, `files[].nummern` — nicht im PDF-Inhalt.
- Keine der Apps konnte eine Stelle auf einer PDF-Seite markieren.
- Modul 03 liegt byte-gleich in Sage, Kimseek, Company-Brain, Privat-Brain, PWA Toolpoint; in
  Mein-WorkFloh als `modules/sbkim-embedding.js`. Workflow PDF hat es nicht.

## Gebaut (Workflow PDF)
- `assets/suche.js`: Angleichung (Umlaute, Satzzeichen, Daten), UND über alle Wörter,
  Fundstellen mit Lage; ein Wort über zwei Textstücke wird als Hülle markiert.
- `assets/db.js`: Fach `texte` (DB-Version 2); neue Bytes / gelöschte Datei werfen den Text weg.
- `assets/app.js`: Seitentext beim Einlesen erfassen, für alte Dokumente nachholen; Fundzeilen
  in der Bibliothek; Öffnen aus der Suche markiert, Tipp blendet aus; Hinweis, solange Text fehlt.
- Übersetzungen EN/RU/AR der neuen Texte; dabei „Ohne Ordner" nachgetragen (fehlte vorher).
- `tests/syntax.mjs` findet seine Dateien jetzt selbst (die gepflegte Liste hätte `suche.js`
  nicht geprüft).
- Cache v31 → v32.

## Gemessen
- `npm test`: alle zehn Proben grün (syntax 23 · e2e 78 · uebersetzung 56 · layout 21 ·
  behoerde 45 · chrome 47 · schrift 5 · beispiele 17 · sprache 49 · suche 37), Rückgabewert 0.
- `node tests/gegenprobe_suche.mjs`: **12 gefangen · 0 durchgerutscht · 0 aus falschem Grund ·
  0 tote Anker** (Wegwerf-Kopie, Arbeitsbaum vorher festgeschrieben).
- Die Zahl davor bleibt stehen: zuerst **11 · 1 · 0 · 0**. Der durchgerutschte Fall („Markierung
  klebt") hatte zwei Ursachen: zwei Riegel decken einander (Öffnen und Schließen leeren), und die
  Probe hatte nach dem Antippen gar keine Markierung mehr übrig — sie maß nichts. Beides behoben.

## Nicht gemessen
- Am Tablet: alles (Klaus' Sichttest steht aus).
- Wie schnell das Nachholen bei vielen/langen PDFs ist (das Handbuch hat 14 Seiten).
- Gescannte PDFs: ohne Textebene findet Stufe 1 dort nichts (Stufe 4).
- Die WorkFlohs sind nicht angefasst (Stufe 3).

## Stundennachweis
Gemessen am Reflog: Arbeitsbeginn am Zweig **10:38:57 UTC**, letzter Commit dieser Arbeit
**11:05 UTC** → **26 min**. Davor lag die Planung (Bestandsaufnahme, Plan, Klaus' Antworten);
sie hinterlässt keine Spur im Zweig und ist nicht mitgezählt. Die Spanne ist die Obergrenze
von Klaus' Arbeitszeit in diesem Zeitraum (seine Auskunft vom 2026-09-22), Pausen nicht abgezogen.
