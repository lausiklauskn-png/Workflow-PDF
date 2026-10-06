# Brief · Die Fähigkeiten von Workflow PDF in beide WorkFlohs

## Klaus' Auftrag, wörtlich (2026-10-06)

> „Also da sollen die Möglichkeiten, die in Workflow PDF sind, auch beinhaltet sein. Also die Fähigkeiten.
> Wenn ich im Workflow arbeite, dann möchte ich nicht immer zwischen zwei Apps hin und her fliegen, sondern
> die Fähigkeiten sollen auch in Tommys Workflow sein. Und auch im Workflow. Weil das ja dieselbe Software
> ist, also so der Hintergrund."

Gemeint sind **Mein-WorkFloh** und **Tomys WorkFloh** (`Tomys-Hub/workfloh`). Die Reihenfolge unten ist ein
**Vorschlag**, Klaus hat sie noch nicht bestätigt. Zuerst fragen, ob sie so passt.

## Zuerst lesen

1. `Workflow-PDF/CLAUDE.md` (die Abschnitte zu den Fähigkeiten, die übernommen werden)
2. `Mein-WorkFloh/CLAUDE.md` und `Tomys-Hub/CLAUDE.md`, je Abschnitt „📝 PDF-Werkzeug aus Workflow-PDF"
3. `docs/sessions/ABSCHLUSS_2026-10-06_teilen-zuschneiden-schaerfe.md`

## Pflicht vor jeder Arbeit

```bash
for r in Workflow-PDF Mein-WorkFloh Tomys-Hub; do git -C /home/user/$r fetch origin --quiet; done
git -C <repo> checkout -B <zweig> origin/main
```

Danach die Tabelle unten **neu nachzählen**. Sie gilt für den Stand vom 2026-10-06.

## Was fehlt (gemessen am 2026-10-06, `git grep` auf origin/main)

| Fähigkeit in Workflow PDF | Mein-WorkFloh | Tomys WorkFloh |
|---|---|---|
| Prüfung beim Einlesen (`eingang.js`, `pruefer-anhang.js`, `pruefer-mail.js`, `pruefer-formate.js`) | fehlt | fehlt |
| ✂️ Zuschneiden im Editor (zweites Dokument, Original bleibt) | fehlt | fehlt |
| Teilen → App (`share_target`) | da (#253) | **fehlt im Manifest**, `index.html` erwartet es |
| „Öffnen mit" (`file_handlers`, `launchQueue`) | fehlt | fehlt |
| Wortsuche im Seitentext mit Markierung (`suche.js`) | fehlt | fehlt |
| Arbeitsstand-Datei `.workfloh.json`, Seiten drehen, Übersetzung fortsetzen | fehlt | fehlt |
| Suche nach Bedeutung (`bedeutung.js`, Sage 03/04) | fehlt | fehlt |
| Sprache der Oberfläche inkl. Russisch (`sprache.js`) | eigene Sprachen, **kein RU** | eigene Sprachen, **kein RU** |
| verschlüsselte Sicherung (`sicherung.js`, Schloss aus kim-hub-company) | nur JSON-Export | fehlt |

Schon da, in beiden: Scanner, Blatt, Erkennung, Export, HTML-Ausgabe, Übersetzen, Schieber, Sprechen,
ZIP, Auswahl, Schärfe.

## Vorgeschlagene Reihenfolge

1. **Prüfung beim Einlesen.** Zuerst, weil jede Datei, die in einen Auftrag kommt, hier ungeprüft bleibt.
2. **✂️ Zuschneiden** im Einzeldokument und im Originaldokument.
3. **Teilen in Tomys WorkFloh** (`share_target` im Manifest) und „Öffnen mit" in beiden.
4. **Wortsuche** im Seitentext der Anhänge, mit Markierung der Fundstelle.
5. Arbeitsstand-Datei, Seiten drehen, Übersetzung nach dem Schließen fortsetzen.
6. Suche nach Bedeutung, freiwillig (sie lädt einmal ein Modell aus dem Netz, das muss vorher gesagt werden).
7. Sprachschicht mit Russisch.

Danach: Handbuch, Erklärvideo, Beispiele, verschlüsselte Sicherung. Später, nur auf Klaus' Wort: Tabellen
aus der Texterkennung neu zeichnen.

## Regeln dabei

- **Byte-1:1 kopieren, nie abwandeln.** Was aus Workflow PDF kommt, wird in `wfpdf_kanon.mjs` gepinnt
  (Mein-WorkFloh `scripts/`, Tomys-Hub `tests/`). `werkzeug.js` bleibt in beiden WorkFlohs gleich.
- Ein Schritt = ein PR je Depot, **beide WorkFlohs im selben Zug**.
- Cache-Bump in beiden (`workfloh-vNNN` und `tomy-workfloh-vNN`, zuletzt v192 und v51) und `?v=` an `werkzeug.js`
  (zuletzt 26). Die neue Nummer gegen `origin/main` prüfen und nach dem Merge noch einmal.
- Zu jedem Wächter eine Gegenprobe. Jeden Fall von Hand nachstellen und die rote Zeile lesen.
  Gegenproben laufen in einer Wegwerf-Kopie.
- Datenschutz in der App: Funde werden markiert, nicht entfernt. Netzzugriffe (Bedeutungssuche) werden vorher
  genannt. Speicher-Schlüssel sind app-eigen (`github.io` ist geteilt).
- Klaus' Formulare und Bilder kommen **nie** in ein Depot, eine Probe oder einen Commit. Sie tragen Lohndaten.
- Nach jedem Merge den Lauf **„pages build and deployment"** ansehen. Am 2026-10-06 ist einer bei GitHub
  gescheitert, und die Seite blieb alt.
- `CLAUDE.md` in beiden WorkFlohs nachziehen. Forschungseintrag in Kimhub am Ende.

## Offen aus der letzten Sitzung (nur Klaus kann es messen)

Schärfe, Zuschneiden und Teilen am Tablet. Wer vor diesem Stand installiert hat, öffnet die App einmal
(oder tippt ⟳), bevor er teilt.
