# Workfloh PDF — Sitzungs-Anker

PWA für Formulare: einlesen (PDF, Foto, Ordner) → Felder erkennen oder setzen →
ausfüllen → festes / ausfüllbares PDF / leere Vorlage. Kein Build-Schritt.
Vorlage war der Originaldokument-Modus von Mein-WorkFloh (Felder in Prozent
über der echten Seite, „bearbeiten" gegen „ausfüllen").

## Namen

In der Kopfleiste **Workfloh PDF** (mit h), in sachlichen Erklärungen
**Workflow PDF**. Maskottchen **W-Floh** (`icons/w-floh-*.png`, aus Klaus' Bild).

## Prüfen

```bash
npm install && npm test     # Syntax + Probe im echten Browser
```

## Was hier leicht kaputtgeht

- **Koordinaten:** Felder stehen in Prozent der ANGEZEIGTEN Seite. Der Export
  rechnet über die pdf.js-Viewport-Matrix je Seite (`doc.pages[i].t`) zurück —
  nur so stimmen gedrehte Seiten und verschobene CropBoxen. pdf-lib dreht
  Widget-Rechtecke selbst um ihren Anker; deshalb Anzeige-Breite/-Höhe und die
  linke untere Anzeige-Ecke übergeben. Die Probe prüft das an einer 90°-Seite.
- **pdf-lib:** `setFontSize` erst NACH `addToPage` (vorher kein /DA-Eintrag).
- **Cache-Bump:** `CACHE_VERSION` in `sw.js` erhöhen, wenn eine App-Datei sich ändert.
- **DB-Name `WorkflohPDF1` nie ändern** — github.io ist eine geteilte Adresse.
- **Resize nur bei Breitenänderung neu zeichnen.** Die Bildschirmtastatur macht das
  Fenster niedriger; ein Neuzeichnen warf das Feld weg, in das getippt wurde
  (Befund Klaus 2026-09-25). Die Probe prüft es.
- **Erkennung:** Linien, Rahmen, Kästchen UND hellgraue Flächen (`flaechen()`).
  Die KI bekommt die Offline-Kandidaten nummeriert ins Bild gezeichnet und
  benennt sie — ihre eigenen Koordinaten sind ungenau („alle auf einem Haufen").
- **Speichern:** laufend in IndexedDB, sofort bei `visibilitychange`/`pagehide`;
  💾 legt eine Arbeitsstand-Datei (`*.workfloh.json`, PDF + Felder) aufs Gerät.
- **KI ist BYOK und freiwillig**, Standard Mistral (EU). Ohne Bestätigung geht
  nichts ins Netz.

## 🌐 Übersetzen (seit 2026-09-25)

Eigener Bereich (Knopf „🌐 Übersetzen …", Ordner mit `bereich:'uebersetzung'`,
Ergebnis-Ordner je Sprache, per Kennung verknüpft — Umbenennen bricht nichts).
Seite für Seite: Textblöcke aus der Textebene (Scans: Texterkennung auf dem
Gerät), Farbe gemessen, Block in Hintergrundfarbe abgedeckt, Übersetzung in
Textfarbe an dieselbe Stelle. Zwischenstand je Seite in IndexedDB
(`ue:<doc>:<von>-<nach>`), Fortsetzen nach Abbruch.

- `assets/uebersetzung.js` ist **host-neutral** und wird byte-1:1 in die WorkFlohs
  kopiert (`assets/wfpdf/`) — nur hier ändern, dann dort neu kopieren.
- **Kyrillisch** braucht fontkit + Noto Sans (`vendor/`), als Teilmenge eingebettet.
- **Texterkennung** `vendor/tesseract/` (21 MB, nicht im Installations-Vorrat) —
  die WorkFlohs laden sie von hier (`/Workflow-PDF/vendor/`). **Nicht umbenennen.**
- Headless-Chromium hat **keinen** `Translator` (gemessen) — die Probe stellt ihn;
  am Gerät misst der Knopf „🔎 Messen" im Übersetzen-Dialog.
- Unter der Übersetzung bleibt der Originaltext im PDF (abgedeckt); die Gegenprobe
  übersetzt deshalb die gespeicherten Übersetzungen zurück, statt neu zu lesen.
- **Teilergebnis bei Abbruch** (Klaus 2026-09-25): `lauf()` wirft bei einem Fehler des
  Übersetzers (429/Kontingent, Netz) NICHT, sondern meldet `fehler` mit gespeichertem
  Stand. Ist mindestens eine Seite fertig, entsteht „[RU, Teil N von M]" (Rest im
  Original, `doc.teil`); der vollständige Lauf ersetzt es. Vorher stand das Übersetzte
  nur im Speicher und war nicht zu sehen.
- `npm run messen` misst 400 Seiten + 10 Scans (nicht Teil von `npm test`).
- **Behördenformular** (`tests/behoerde.mjs`): Felder kommen übersetzt mit
  (`quellFeld` → Feld im Original), Rückweg „↩ Einträge ins Original" legt eine
  KOPIE des Originals an (`ausgefuellt`). `zeichenNormal()` setzt zerlegte Umlaute
  zusammen — vor dem Übersetzen UND auf dessen Ausgabe (der Übersetzer kann sie
  zerlegt liefern). Kyrillische Feldwerte brauchen Noto im Export (`opt.schrift`);
  der /DR-Schlüssel ist `fontU.name`, weil pdf-lib ihn so in /DA schreibt.
- **`assets/blatt.js`** (byte-1:1 in die WorkFlohs): Blatt im Foto finden, auf A4
  entzerren. Unsicher → NICHT schneiden, ganzes Foto auf A4. `bilderZuPdf` nimmt
  `b.seite` als Seitengröße.

## Netzweit

Freibrief · frisch von `origin/main` · Ton · kein PII · Ehrlichkeit:
[Sage-Protokol/docs/NETZWEIT.md](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/NETZWEIT.md)
- **HTML-Ausgabe** (`assets/html-export.js`): Seiten als Bild + echte Eingabefelder,
  eigenständige Datei. Für Geräte, deren PDF-Anzeige keine Formulare kann (Google
  Drive/Files). Kästchen sind durchsichtig, damit gedruckte Haken sichtbar bleiben —
  dasselbe gilt für die Kästchen-Widgets im ausfüllbaren PDF.
