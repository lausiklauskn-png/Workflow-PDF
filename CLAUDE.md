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
- **KI ist BYOK und freiwillig**, Standard Mistral (EU). Ohne Bestätigung geht
  nichts ins Netz.

## Netzweit

Freibrief · frisch von `origin/main` · Ton · kein PII · Ehrlichkeit:
[Sage-Protokol/docs/NETZWEIT.md](https://github.com/lausiklauskn-png/Sage-Protokol/blob/main/docs/NETZWEIT.md)
