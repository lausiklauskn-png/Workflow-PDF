/*
 * Siegel-Inhalt — DIE IDENTITÄT DIESES KNOTENS, und sonst nichts.
 *
 * Der Andock-Wizard selbst liegt byte-1:1 aus Sage in
 * `sbkim/16b_andock_wizard.js` und liest nur `window.SBKIM_SIEGEL_WIZ`.
 * Diese Datei wird NIE verteilt: sie trägt die Bedeutung des Knotens, und ein
 * Überschreiben gäbe ihm Namen und Vektor einer fremden App (Alis Moderaum,
 * 2026-08-16). Vertrag: Sage-Protokol/docs/INTERFACES.md §11.9.
 *
 * ⚠ DIE BESCHREIBUNG IST KEINE ZIERDE. Modul 03 rechnet daraus den
 * Domänen-Vektor. Das Wichtigste steht vorn (Name, Zweck, Protokoll) — Modul 03
 * schneidet bei 512 Tokens ab, und wer kürzen muss, kürzt von hinten.
 */
(function () {
  "use strict";
  window.SBKIM_SIEGEL_WIZ = {
    domain: "Formulare/PDF/Werkzeug",
    endpoint: "https://lausiklauskn-png.github.io/Workflow-PDF/",
    nodeType: "hybrid",
    nodeName: "Workfloh PDF",
    domainDescription: "Workfloh PDF ist ein Werkzeug für Formulare im SBKIM-Mycel und ein eigener Knoten. ZWECK: ein Formular ausfüllen, ohne es auszudrucken. Ein PDF, ein Foto oder ein ganzer Ordner wird eingelesen, die Felder werden auf dem Gerät erkannt oder von Hand gesetzt, ausgefüllt und als festes PDF, als ausfüllbares PDF, als leere Vorlage oder als HTML-Seite ausgegeben. FORSCHUNG UND PROTOKOLL: Workfloh PDF gehört zum SBKIM-Protokoll (Semantisches Bidirektionales KI-Matching), der offenen Spezifikation aus dem Sage-Protokol; die Suche nach Bedeutung nutzt die Sage-Module 03 und 04 unverändert. Es ist selbst ein Knoten: eigene signierte Spore, eigene Kennung, und mit dem Netz verbindet es sich nur auf ausdrücklichen Klick, öffentlich oder in einem eigenen Netz. WAS ES TUT: Dokumente Seite für Seite zwischen Deutsch, Englisch und Russisch übersetzen und an dieselbe Stelle setzen; mit der Kamera scannen, Ecken prüfen und gerade ziehen; in Namen, Feldern und Seitentext suchen, auch nach Bedeutung; jede eingelesene Datei auf versteckte Befehle an eine KI prüfen und den Fund markieren; die Bibliothek verschlüsselt sichern. Die Dateien bleiben im Browser des Geräts. WAS ES NICHT IST: kein Virenscanner und keine Cloud; eine KI hilft nur, wenn man sie mit eigenem Schlüssel einschaltet. FÜR WEN: für Leute, die Anträge, Bestellungen und Behördenformulare am Tablet ausfüllen wollen.",
    domainKeywords: ["SBKIM", "SBKIM-Protokoll", "Sage-Protokol", "Mycel", "Knoten", "Workfloh PDF", "Formular", "PDF", "ausfüllen", "Felder erkennen", "ausfüllbares PDF", "Vorlage", "Scannen", "Übersetzen", "Suche nach Bedeutung", "versteckte Befehle", "offline", "Daten bleiben auf dem Gerät", "Werkzeug"],
    stammCategories: ["Formular", "PDF", "Werkzeug"],
    guestCategories: ["Dokument", "Übersetzung", "Siegel"],
    backupPrefix: "workfloh-pdf-backup",
  };
})();
