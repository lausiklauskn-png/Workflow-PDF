# Abschluss 2026-09-26 (Nachtrag): Links, Feldgröße, Behördenkasten, Kunden- und Artikelnummer

**Ein Stand, kein Auftrag.** Schließt an `ABSCHLUSS_2026-09-26_uebersetzung-feldarten.md` an
(dort: Übersetzen, Oberflächen-Sprachen, Feldarten bis Workflow-PDF #29). Aufgeschrieben gegen
`origin/main` nach dem letzten Merge (Workflow-PDF #33, Mein-WorkFloh #221, Tomys-Hub #200).

Nachprüfen, ob `main` diesen Stand trägt:

```bash
git -C Workflow-PDF  grep -c "nummerOeffnen"   origin/main -- assets/app.js           # ≥ 1
git -C Mein-WorkFloh grep -c "ovNummerOeffnen" origin/main -- index.html              # ≥ 1
git -C Tomys-Hub     grep -c "ovNummerOeffnen" origin/main -- workfloh/index.html     # ≥ 1
```

## 1. Was gebaut ist

| Was | Workflow-PDF | Mein-WorkFloh | Tomys-Hub |
|---|---|---|---|
| E-Mail, Internetadresse, Telefon im Feld werden zum Link (blau, antippbar, ✏️ zum Ändern, beim Drucken schwarz) | #31 | #218 | #197 |
| neues Feld aus „Feld setzen" so groß wie die erkannten, am roten Punkt kleiner ziehbar | — | #219 | #198 |
| ein Kasten um mehrere Felder ist kein Feld; Beschriftungen mit „:" und Einzelbuchstaben werden kein Eintrag (Beispiel „Nur von der Behörde auszufüllen") | #32 | #220 | #199 |
| Zahlen im normalen Textfeld sind **kein Anruf** mehr (Kundennummern); Anruf nur in der Feldart Telefon | #33 | #221 | #200 |
| Feldarten **Kundennummer** und **Artikelnummer** | #33 | #221 | #200 |

**Kunden- und Artikelnummer, wie es sich verhält:**
- Workflow-PDF: antippen zeigt alle Dokumente mit derselben Nummer. Neue Feldart **Telefon**.
  Suchfeld in der Bibliothek sucht auch in Feldinhalten.
- WorkFlohs: antippen öffnet ein Fenster über dem Dokument (nichts geht verloren) mit dem Kunden
  (neues Feld „Kundennummer" beim Kunden, `k.nr`) und allen Aufträgen/PDFs mit der Nummer.
  Unbekannte Nummer → „Neuen Kunden mit dieser Nummer anlegen". Ein abgelegtes Einzeldokument
  trägt seine Nummern am Anhang (`files[].nummern`); Auftragssuche und Kundenakte finden es.
- Warenwirtschaft / Kundenverwaltung später über `window.WF_ARTIKEL_OEFFNEN(nr)` bzw.
  `window.WF_KUNDE_OEFFNEN(nr)` (Workflow-PDF). Heute nicht angebunden — gesagt, nicht verschwiegen.

## 2. Was gemessen ist

- Workflow-PDF `npm test`: alle Teile grün (e2e 78, sprache 49, beispiele 17 …).
- WorkFlohs `browser_pdf.mjs`: je 117 grün · 0 ROT; Mein `npm test` 13/13.
- Gegenproben von Hand: Telefon-Regel zurück, Nummern nicht mitgenommen, Kundennummer ohne Link,
  Suche ohne Filter — jede fällt mit dem Namen ihrer Zusicherung.
- Nur erfundene Daten (Musterstadt, Muster GmbH, 10234, A-2031).

## 3. Was NICHT gemessen ist

- **Nichts davon auf Klaus' Tablet.** Links, Feldgröße, Behördenkasten, Kundennummer-Fenster,
  Bibliothek-Suche: nur im Headless-Browser.
- Links im **exportierten** PDF gibt es nicht (Link-Anmerkungen wären in `export.js` zu bauen).
- Die E-Mail, die im exportierten PDF neben dem Formular stand (Klaus' Bild vom 2026-09-26):
  Ursache nicht untersucht; zuerst die Feldlage unter „Felder positionieren" ansehen.
- Tomys-Hub: `tests/smoke-spore-download.cjs` und `tests/smoke-verbund.cjs` schlagen fehl —
  **auch auf `main` ohne diese Änderungen**, nicht untersucht.

## 4. Stundennachweis

Gemessen an den Commit-Zeiten dieser Sitzung (`Claude-Session: …01DZe6Eq8AWfcw1tftDbCNWx`) über
alle drei Repos, Ortszeit:

| | |
|---|---|
| erster Commit | 25.09.2026 20:46 |
| letzter Commit | 26.09.2026 09:20 |
| Spanne | **12 h 34 min** |
| darin eine Pause über 90 min | 04:08 → 08:37 (4 h 29 min) |
| in zwei Abschnitten | 20:46–04:08 (7 h 22 min) · 08:37–09:20 (43 min) = **8 h 05 min** |

Die Zeit vor dem ersten Commit hinterlässt keine Spur und fehlt in der Zahl. Die Spanne ist die
Obergrenze; die Anwesenheit darin ist Klaus' Auskunft, nicht gemessen.
