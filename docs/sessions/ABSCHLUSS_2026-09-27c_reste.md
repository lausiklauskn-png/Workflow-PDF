# Abschluss 2026-09-27 (c) · Reste aus dem Sichttest-Brief

Zweig `claude/klaus-sichttest-reste-gp78ny`. Gemergt: **Tomys-Hub #215 · Workflow-PDF #73**.
Brief: `docs/sessions/BRIEF_todo-sichttest.md`.

## 1 · Klaus' Sichttest — offen

Punkte 2–7 der To-Do-Liste kann nur Klaus am Gerät prüfen. Das ist **nicht** geschehen.
Die Liste steht im neuen Brief (`BRIEF_todo-sichttest-2.md`), unverändert.

## 2 · Reste — erledigt

| Rest | Befund | was jetzt gilt |
|---|---|---|
| `gegenprobe_suche`: toter Anker | #47 legte `dokErsetzen` an, das dieselbe Zeile `await textAblegen(d.id, text);` trägt → der Anker traf zweimal | Anker trägt den Kontext des Einlese-Wegs. **Nachgezogen, kein neuer Wächter.** Gefahren: **22 gefangen · 0 durch · 0 aus falschem Grund · 0 tote Anker** |
| `NUR_ANKER` fehlt in ordner/suche/teile | — | eingebaut, auch für die `extra`-Anker. ordner 14 · suche 22 · teile 14 Anker, 0 tot |
| **neu gefunden:** Ausgangslage mit ⊘ galt als grün | ohne `node_modules` meldete gegenprobe_suche **14 „durchgerutscht"** — Teil B lief gar nicht, `suche.mjs` gab trotzdem 0 zurück | die drei Gegenproben brechen bei ⊘ ab („erst npm install") |
| Tomys-Hub `smoke-spore-download` rot | #111 (2026-07-16) hat das eigene Spore-Werkzeug **mit Absicht** durch den kanonischen Andock-Wizard ersetzt; die Probe suchte seitdem den alten Knopf — **gut zwei Monate rot** | misst denselben Zweck am heutigen Weg (🔑-Knopf, genau einer, eigene Beschreibung, Wizard öffnet). 4 Sabotagen von Hand, je die eigene rote Zeile |
| Tomys-Hub `smoke-verbund` rot | einzige rote Zeile: der **Sitzungs-Proxy** verweigert die WebSocket-Verbindung zum Relais — Umgebung, nicht App | eng gefiltert (nur „WebSocket connection to 'wss://…' failed"); ein geworfener Fehler bleibt rot (nachgestellt) |

Gemessen: Tomys-Hub **alle 13 Proben grün** (mit playwright-core/pdf-lib: 448 grün) ·
Workflow-PDF `npm test` lief die ganze `&&`-Kette durch.

## Nicht gemessen

- volle Läufe von `gegenprobe_ordner` und `gegenprobe_teile` (nur ihre Anker).
- der Sichttest (oben).

## Stundennachweis

Beginn am Zweig **17:04:56 UTC** (Reflog `checkout -B`), letzter Commit der Arbeit
**17:17:08 UTC** (Squash #73) — dazu die Doku-Commits danach. Die Spanne ist die
**Obergrenze** von Klaus' Arbeitszeit (seine Auskunft vom 2026-09-22), Pausen nicht abgezogen;
was vor dem ersten Handgriff lag, hinterlässt keine Spur.
