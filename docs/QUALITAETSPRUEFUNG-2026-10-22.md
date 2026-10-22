# Qualitätsprüfung am 22.10.2026

Auftrag: vorhandene Workflow-PDF-Varianten auf Fehler prüfen und beheben;
iOS bleibt als Vorbereitung für eine spätere Veröffentlichung zurückgestellt.

## Vorräte anderer Apps wurden beim Aktualisieren gelöscht

CacheStorage gehört dem ganzen Ursprung. Auf GitHub Pages teilen sich Workflow
PDF und Private Brain denselben Ursprung. Der bisherige activate-Handler löschte
jeden Vorrat außer dem aktuellen Workflow-Vorrat und drei Ausnahmen. Dadurch
konnten fremde Offline-Dateien und andere App-Vorräte verloren gehen.

Korrektur: ausschließlich alte App-Schalen mit Präfix `workfloh-pdf-v` entfernen.
Die Cache-Version steigt auf 106. Dokumentdaten in IndexedDB werden nicht verändert.
`tests/vorrat-isolation.mjs` aktiviert den echten Service Worker in Chromium,
prüft Inhalte von fünf vorher angelegten fremden/bleibenden Vorräten und das
Entfernen zweier alter eigener Schalen. Vor der Korrektur scheitert die Probe
am gelöschten `private-brain-v89`, danach besteht sie.

Die vollständige vorhandene Browserkette bleibt erhalten und wird zusätzlich in
GitHub Actions ausgeführt. Die lokale Cloud sperrt `file://`-Navigation; dadurch
endet der bestehende PDF-Exportfall nach 34 bestandenen Aussagen an einer
Umgebungsgrenze. Die übrigen Skripte werden unabhängig geprüft. Ein solcher
Abbruch ist kein vollständig bestandener Test und wird nicht verschwiegen.

Keine neue PWA-Version oder native Veröffentlichung aus diesem Prüfauftrag ableiten.
Der gemeinsame Kern für native Hosts wird aus diesem Quellcommit bytegleich übernommen.
