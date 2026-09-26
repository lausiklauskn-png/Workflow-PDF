# Brief: Suche am Tablet prüfen — danach Stufe 2 (Bedeutungssuche)

Sitzung: Prüfung am Tablet — Suche Stufe 1, dann die Prüfliste vom 26.09.,
dann Stufe 2 (Workflow-PDF; Mein-WorkFloh, Tomys-Hub/workfloh erst ab Stufe 3)

Zuerst lesen:
- Workflow-PDF/CLAUDE.md (Abschnitt „🔎 Suche, Stufe 1"), Mein-WorkFloh/CLAUDE.md, Tomys-Hub/CLAUDE.md
- Workflow-PDF/docs/sessions/ABSCHLUSS_2026-09-26c_suche-stufe1.md   (Stand, Messungen, Offenes)
- Workflow-PDF/docs/sessions/BRIEF_pruefen-am-geraet.md              (die sieben Punkte vom 26.09.)

Pflicht vor jeder Arbeit:
  for r in Workflow-PDF Mein-WorkFloh Tomys-Hub Sage-Protokol; do git -C $r fetch origin --quiet; done
  git -C Workflow-PDF grep -c "texteNachholen" origin/main -- assets/app.js   # muss ≥ 1 sein
Arbeitszweig frisch von origin/main.

Klaus prüft am Tablet, nach ⟳:
S1. Bibliothek, Suchfeld: einen Namen aus einem PDF eingeben, der NICHT in einem Feld steht
    → das PDF erscheint, darunter „Auf Seite N · …Text…".
S2. Umlaut anders schreiben (Mueller statt Müller), Nummer mit/ohne Bindestrich, Datum anders
    (3.9.2026 statt 03.09.2026) → derselbe Treffer.
S3. Treffer antippen → das PDF öffnet an der Fundstelle, gelb umrandet. Markierung antippen → weg.
S4. Ältere PDFs (von vor dem Update): kurz „Seitentext wird noch erfasst", danach gefunden.
Danach die sieben Punkte aus BRIEF_pruefen-am-geraet.md.

Stufe 2 (erst nach Klaus' Wort): Modul 03 (Embedding) und 04 (Match) byte-1:1 aus
Sage-Protokol/src/modules/, Drift-Guard mit Pins; Absätze je Seite als Vektoren im Fach
„texte"; Wort- und Bedeutungssuche über 04 queryLocal (RRF); Schalter standardmäßig AUS;
Modellgröße MESSEN, bevor sie genannt wird (im Netz stehen 30 MB und 113 MB); Lernen aus
geöffneten Treffern mit sichtbarer Marke „aus deinem Verlauf" und Knopf „Gelerntes
zurücksetzen"; Trefferquote „erster Treffer geöffnet" zählen und anzeigen.

Entschieden (Klaus 2026-09-26): Mein-WorkFloh und Tomys WorkFloh werden GETRENNT durchsucht,
und nur, wenn der WorkFloh entsperrt ist (Suchverzeichnis mit demselben Schlüssel verschlossen).

Regeln: nur erfundene Testdaten. Jede neue Zusicherung mit Gegenprobe (Wegwerf-Kopie),
CACHE_VERSION in sw.js hochzählen. Am Ende Abschlussbrief mit gemessenem Stundennachweis und
neuer Brief als Codeblock im Chat.
