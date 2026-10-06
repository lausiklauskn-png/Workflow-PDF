# Brief: Erklärvideo mit der Prüfung beim Einlesen, danach in den FP-Video-Pool

**Von:** Sitzung vom 2026-10-06 · **Für:** die nächste Sitzung · **Auftrag:** Klaus 2026-10-06

## Klaus' Auftrag, wörtlich

> „… im Video von Workflow PDF … aktualisierte Informationen … PDFs … nach
> Schadsoftware durchsucht werden oder Schadbefehle … Bilder … im Hintergrund …
> am Ende noch neu dazugekommen. Oder … Specials … was eigentlich kaum ein
> PDF-Scanner hat … in dem bestimmten Rahmen, die das Programm möglich macht.
> Es soll dabei nicht die Technik verraten werden … sondern nur … was möglich
> ist. … eine Werbung … in Motion Graphics Style … so wie das Werbevideo von …
> Family Project Punkt Video … etwas aufwendiger … dann soll das gesamte Video
> mit in den Pool kommen … dass ich … nicht mehr zwei in FP Video habe, sondern
> drei Videos"

## Pflichtlektüre (in dieser Reihenfolge)

1. `Workflow-PDF/CLAUDE.md`: § „Prüfung beim Einlesen — versteckte Befehle“ und § „Erklärvideo aus der Hilfe“
2. `family-projekt.de-video/CLAUDE.md`: Aufnehmen, Grenzen, Push in Etappen
3. **Workfloh-PDF-Page**: liegt dort, wo das heutige Video liegt. Das Repo steht **nicht** in der Scope-Liste dieser Sitzung. Es wird über `list_repos` gesucht und mit `add_repo` geholt. Vorher nicht behaupten, dass es fehlt.
4. Dieser Brief

Vor jeder Arbeit: `git fetch origin --quiet && git checkout -B <zweig> origin/main`, in jedem Repo.

## Stand (gemessen am 2026-10-06)

| | |
|---|---|
| Video heute | `Workfloh-PDF-Page/assets/workfloh-pdf-quer{,-en,-ru}.mp4` und `workfloh-pdf-hochvoll{,-en,-ru}.mp4`, Bilder `poster-{de,en,ru}.jpg` und `poster-hochvoll-*.jpg`. Quer und hoch sind szenengenau gleich lang (Drehen springt an dieselbe Stelle). |
| in der App | `erklaervideo()` und `videoFuer(lang, hoch)` in `assets/app.js`. Arabisch bekommt Englisch. `sw.js` lässt `/Workfloh-PDF-Page/` durch. |
| Marke „neu“ | `assets/app.js` Zeile ~2740: `<div class="pruef-neu" data-neu>Neu, noch nicht im Video: versteckte Befehle erkennen …`. Achtung: `data-neu` heißt **auch** der Knopf „＋ Ordner“ (Zeilen 180, 615, 703, 744, 1479). Gemeint ist nur `.pruef-neu`. |
| Probe | `tests/video.mjs` kennt die Dateinamen (Zeilen 81, 90, 116, 129). |
| Pool | `family-projekt.de-video/videos.json`: **4 Einträge, aber nur 2 Videos**: `werbevideo-67s` mit seinen Fassungen `-480p` und `-720p`, dazu `werbevideo-60s`. Mit dem Workflow-PDF-Video sind es **3**. |
| Platz im Pool | Videos und Vorschaufilme zusammen **457 MB** von 1 GB (Pages). Jede Datei < 50 MB, Teile zu 14 000 000 Bytes, höchstens 100 Teile je Video. |

## Was die neue Szene zeigen darf, und was nicht

Inhaltlich gilt nur, was `eingang.js` wirklich meldet (siehe CLAUDE.md § Prüfung beim Einlesen):

- Jede eingelesene Datei wird **im Hintergrund** geprüft: PDF, Foto, Scan, Arbeitsstand.
- Gefunden wird: eine Anweisung an eine KI, auch im Bild und blass gesetzt; unsichtbarer Text im PDF; eine Datei im PDF; ein Programm oder eine Tarnung; ein Verdacht in den Bildpunkten.
- Der Fund wird **markiert, nicht gelöscht**. Dazu kommt der Rat, beim Absender auf einem anderen Weg nachzufragen.
- Alles läuft **auf dem Gerät, ohne Internet**.

**Nicht verraten** (Klaus): keine Bibliotheken, keine Verfahren wie „Texterkennung“, „untere Bits“ oder „Kontrast-Spreizung“, keine Schwellen oder Zahlen.

**Nicht behaupten** (Ehrlichkeit, das ist die Grenze der Werbung):

- „Virenschutz“ oder „findet jede Schadsoftware“ sind falsch. Gesucht wird nach festen Wendungen, und eine umformulierte Anweisung fällt durch.
- „Kaum ein PDF-Scanner kann das“ ist **Klaus' Einschätzung, nicht gemessen**. Im Video als Haltung formulieren, etwa „Was ein gewöhnlicher Scanner nicht prüft“, und nicht als belegte Marktaussage.

Zum Filmen der Szenen: `beispiele/Testbild-versteckte-Anweisung.png` und `beispiele/Testdatei-unsichtbarer-Text.pdf` (Hilfe → „🛡 Versteckte Befehle erkennen“). Die Aufnahmen kommen von der echten App, wie beim Handbuch (`tools/handbuch-bauen.mjs` zeigt, wie das geht).

## Was gebaut werden soll, in dieser Reihenfolge

1. **Fragen an Klaus klären** (unten). Ohne die Antworten nicht rendern.
2. **Video bauen** im Motion-Graphics-Stil des FP-Werbevideos: Hintergründe, Lichtführung, Schrift und Musik wie dort, „etwas aufwendiger“. Die bestehenden Kapitel bleiben, am Ende kommt der neue Teil „Specials“ / „Neu dazugekommen“. Das Video gibt es in DE/EN/RU, jeweils **quer und hochvoll mit gleicher Länge je Szene**. Sonst bricht der Sprung beim Drehen (`tests/video.mjs` 3b). Die Vorschaubilder werden neu gebaut.
3. **Auf Workfloh-PDF-Page ablegen**: unter denselben Dateinamen, wenn es das alte Video ersetzt. Unter neuen Namen nur, wenn Klaus beide behalten will. Dann muss man `videoFuer` und `tests/video.mjs` nachziehen. Wer umbenennt, bricht sonst den 🎬-Knopf.
4. **In Workflow-PDF**: `.pruef-neu` (DE/EN/RU/AR in `sprache-texte.js`) entfernen und `CACHE_VERSION` sowie `?v=` hochzählen. Dann `npm test`.
5. **In den Pool** (family-projekt.de-video):
   ```bash
   node tools/video-aufnehmen.mjs <workfloh-pdf.mp4> --id workfloh-pdf-erklaervideo --titel "Workfloh PDF — Erklärvideo" --beschreibung "…" [--vorschau-bei <s>]
   ```
   Je Push etwa fünf Teile, mit ausdrücklicher Refspec. Danach `node tests/smoke.mjs` und `node tests/browser.mjs`. Wie viele Sprachfassungen in den Pool kommen, entscheidet Klaus. Jede Fassung ist ein eigener Eintrag und kostet ihre volle Größe, und ein Entfernen macht das Depot nicht wieder kleiner.
6. Im Pool steht das Neueste oben. Dann zeigt `abspielen.html` ohne `?id=` das neue Video. Das ist zu benennen und nicht still hinzunehmen.

## Akzeptanzkriterien

- Die neue Szene zeigt nur, was die App heute kann, ohne Technikbegriffe und ohne Virenschutz-Versprechen.
- Quer und hochvoll sind je Sprache szenengenau gleich lang (gemessen, nicht angenommen).
- `tests/video.mjs` ist grün, `.pruef-neu` ist weg, und der 🎬-Knopf spielt das neue Video.
- Im Pool stehen 3 verschiedene Videos. `smoke` und `browser` sind grün, die Seite bleibt unter 1 GB.
- Klaus' Sichttest am Tablet steht aus und wird so benannt.

## Offene Fragen an Klaus (vor dem Bau)

1. **Wo liegt die Quelle des FP-Werbevideos** (Projektdatei oder Skript)? `family-project/werbevideo/` gibt es nicht. Im Pool liegen nur das fertige MP4, `assets/ls/musik.mp3` und die Hintergründe unter `assets/ls/`.
2. **Ersetzt** das neue Video das alte Erklärvideo, oder **kommt es dazu**?
3. **Sprechtext und Stimme:** dieselbe Stimme wie im alten Video, oder neu aufnehmen (speechma, wie im Handbuch)? Nur Musik und Schrift?
4. **Länge** des ganzen Videos und des Specials-Teils?
5. **Musik:** die Spur des FP-Werbevideos oder eine eigene?
6. **Pool:** nur Deutsch oder alle drei Sprachen?

## Abschluss-Befehl (die Kette reißt nicht ab)

Am Ende: CLAUDE.md in Workflow-PDF und family-projekt.de-video nachziehen, auf main nachsehen (`git grep -c "<Zeile>" origin/main -- <pfad>`) und **danach** die Zweige heben. Den nächsten Brief schreiben und vollständig als Codeblock im Chat ausgeben. Klaus die Adressen zum Ansehen geben.
