# Abschluss 2026-10-11 · Lighthouse (Ladezeit beim ersten Aufruf)

Zweig `ccr-6c1dbafe-wtuxxv`, PR #104 (Entwurf, nicht gemergt). Auftrag: Klaus' PageSpeed-Bericht vom
11.10.2026, mobil **75** (FCP 4,2 s, LCP 4,4 s, „Anfragen blockieren das Rendering" 4 090 ms).

## 1 · Gemacht

- Alle 22 `<script>` mit `defer`, Reihenfolge unverändert. pdf-lib (203 KB) steht nach `app.js`, denn beim
  Start ruft niemand `PDFLib` (nachgezählt: alle Aufrufe stehen in Funktionen, die erst beim Ausgeben laufen).
- Nicht-deutsche Oberfläche: ein Inline-Skript im Kopf setzt `html[data-ue-wartet]` (Seite unsichtbar, bei
  `ar` schon `dir=rtl`). `sprache.js` nimmt die Marke nach dem ersten Übersetzen weg, spätestens nach 4 s fällt sie
  von selbst. Ohne das sähe ein russischer Nutzer kurz Deutsch, ein arabischer dazu einen Sprung von links nach rechts.
- Floh: `icons/w-floh-120.webp` (6,9 KB, aus `w-floh-320.png`), PNG über `image-set` als Rückfall.
- Cache v79, `style.css?v=36`, `sprache.js?v=2`. Der Hinweis steht in `CLAUDE.md` unter „Was hier leicht kaputtgeht".

## 2 · Gemessen

- `npm test`: **25 Dateien, 1 102 grün · 0 ROT**, zweimal gefahren. Der erste Lauf überlappte mit dem Umstellen von
  pdf-lib, der zweite lief auf dem fertigen Stand.
- Lighthouse 12.6.1 lokal (mobil, `python3 -m http.server`, **ohne gzip**, deshalb höher als bei GitHub Pages):

  | | Score | FCP | LCP |
  |---|---|---|---|
  | vorher (main, 2 Läufe) | 55 · 62 | 11,5 s · 3,1 s | 12,0 s · 12,0 s |
  | defer + WebP | 68 · 68 | 0,9 s · 0,9 s | 11,9 s · 11,8 s |
  | dazu pdf-lib nach app.js | 67 · 67 | 0,9 s · 0,9 s | 11,7 s · 11,5 s |

## 3 · Nicht gelöst und nicht gemessen

- **LCP bleibt.** Das größte Element ist der Leer-Satz „Noch keine Dokumente …", gebaut von `app.js`, das auf alle
  Skripte davor wartet. Die Bandbreite teilen sich alle Skripte, deshalb brachte die neue Reihenfolge kaum etwas.
  Helfen würde nur, pdf-lib und pdf.js erst bei Bedarf zu laden. Das betrifft `scanner.js` und `uebersetzung.js`,
  die byte-1:1 in den WorkFlohs liegen. Dafür braucht es einen eigenen Brief.
- Cache-TTL 10 Min. setzt GitHub Pages. Wiederbesuche bedient der Service-Worker.
- Eigene Skripte verkleinern verlangt einen Build-Schritt. Den gibt es hier bewusst nicht.
- Der echte PageSpeed-Wert nach dem Merge ist **nicht gemessen**. Nach dem Merge den Lauf
  „pages build and deployment" ansehen und dann neu messen.

## Stundennachweis

Erster Handgriff **10:32:57 UTC** (Reflog `checkout`), letzter Arbeits-Commit **10:51 UTC** (PR #104), dazu dieser
Abschluss und der Forschungseintrag. Die Spanne ist die **Obergrenze** von Klaus' Arbeitszeit, Pausen nicht abgezogen.
