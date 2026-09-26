# Brief: am Tablet prüfen — Links, Feldgröße, Behördenkasten, Kunden- und Artikelnummer

**Für die nächste Sitzung.** Klaus prüft am Gerät; die Sitzung hilft Schritt für Schritt und
repariert, was er findet. Stand und Messungen: `ABSCHLUSS_2026-09-26b_links-nummern.md`.

## Pflicht vor jeder Arbeit

```bash
for r in Workflow-PDF Mein-WorkFloh Tomys-Hub; do git -C $r fetch origin --quiet; done
git -C Workflow-PDF grep -c "nummerOeffnen" origin/main -- assets/app.js   # ≥ 1, sonst fehlt der Stand
```
Arbeitszweig frisch von `origin/main`. Workflow-PDF ist die Quelle; `erkennung.js`, `export.js`,
`html-export.js`, `uebersetzung.js`, `blatt.js` byte-1:1 in beide WorkFlohs; `werkzeug.js` und die
`ov*`-Funktionen in `index.html` identisch in Mein-WorkFloh und Tomys-Hub/workfloh.

## Was Klaus prüfen kann (je ⟳ vorher)

1. **Workflow PDF → Beispiel-Formular:** der Kasten „Nur von der Behörde auszufüllen" ist kein
   großes Feld mehr (alte Dokumente: Felder neu erkennen).
2. **Textfeld mit `www.musterstadt.de` / `info@muster.de`:** blau, Tipp öffnet Browser/Mail.
   **Eine reine Zahl** (z. B. 10234) bleibt schwarz.
3. **Feld setzen → 📞 Telefon:** Nummer eintragen → Tipp öffnet das Telefon.
4. **Feld setzen → 🔢 Kundennummer:** Nummer eintragen → Tipp zeigt die Dokumente (Workflow PDF)
   bzw. den Kunden und seine Aufträge (WorkFloh). Im WorkFloh vorher beim Kunden unter
   „Kundennummer" dieselbe Nummer eintragen.
5. **WorkFloh:** PDF mit Kundennummer am Auftrag ablegen → oben im Suchfeld die Nummer tippen →
   der Auftrag erscheint.
6. **Workflow PDF Bibliothek:** oben ins Suchfeld eine Nummer oder einen Namen aus einem Feld.
7. **WorkFloh → Feld setzen → Text:** neues Feld so hoch wie die erkannten, am roten Punkt kleiner.

## Offen, nur auf Klaus' Wort

- Links auch im **exportierten** PDF (Link-Anmerkungen in `export.js`, dann in die WorkFlohs kopieren).
- E-Mail neben dem Formular im exportierten PDF: erst Feldlage prüfen lassen.
- Warenwirtschaft anbinden (`WF_ARTIKEL_OEFFNEN`).

## Regeln

- **Nur erfundene Testdaten.** Nie Klaus' echte Dokumente, Namen, Mail, Telefon oder Dateinamen aus
  Bildschirmfotos in ein Repo oder eine Probe.
- Jede neue Zusicherung mit Gegenprobe; Cache-Nummern hochzählen (`sw.js`).
- Am Ende: Abschlussbrief mit gemessenem Stundennachweis + neuer Brief als Codeblock im Chat.
