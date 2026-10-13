/* ============================================================================
 * Workfloh PDF — SBKIM-Andock (Klebstoff zwischen Seite und Modulen), 2026-10-13.
 *
 * Bauart wie der Sende-Prüfer (`Sende-Pruefer/assets/sbkim-init.js`), der sie
 * vom Marktplatz übernommen hat: feste Lampen-Leiste in der Kopfzeile, KEIN
 * Modul 17 (kein fliegendes Widget). Angepasst an drei Stellen:
 *
 *   1. EIGENE SCHUBLADE `workflowpdf` (steht zusätzlich im <head>, weil
 *      Modul 01 den Wert BEIM LADEN liest — Falle 1 aus Sages LEHREN § 4).
 *      Nie ändern. Die Bibliothek (IndexedDB `WorkflohPDF1`) ist davon getrennt.
 *   2. MODUL 03 UND 04 kommen aus `vendor/sbkim/` — dieselben Dateien und
 *      dieselben Adressen, die die Suche nach Bedeutung schon lädt (byte-gleich
 *      mit Sage, gepinnt in tests/bedeutung.mjs und tests/knoten.mjs). Keine
 *      zweite Kopie: app.js lädt sie nur, wenn `window.SbkimEmbedding` fehlt.
 *   3. Keine Abschirmung, kein Überblick-Link (die gehören dem Sende-Prüfer).
 *
 * NACHGELADEN nach `load` in einer Leerlauf-Pause, Datei für Datei. ALLES
 * FAIL-SOFT: fehlt ein Modul, fehlen Lampen und Siegel — die Bibliothek, der
 * Editor und die Ausgabe laufen weiter.
 *
 * ⚠ BEIM LADEN GEHT NICHTS INS NETZ. `init()` der Module baut keine
 * Verbindung auf; „Mit dem Netz verbinden" braucht einen Klick in der
 * Mycel-Blase, das Sprachmodell (Modul 03) lädt erst beim Signieren im Siegel
 * oder beim Einschalten der Suche nach Bedeutung. tests/knoten.mjs misst es.
 *
 * Die Netz-Einstellung (öffentlich oder eigenes Netz) legt Modul 23 selbst ab,
 * unter `sbkim_netz_workflowpdf`. Ein Netz-Code steht nie im Depot.
 * ========================================================================== */
(function () {
  "use strict";

  var NETZ = {
    dbSuffix: "workflowpdf",
    nodeName: "Workfloh PDF",
    repoUrl: "https://github.com/lausiklauskn-png/Workflow-PDF",
    /* Fremde Seiten, die per postMessage mit diesem Knoten reden dürfen:
       KEINE. Alles andere weist Modul 15 ab und meldet es an der FREMD-Lampe. */
    allowedOrigins: []
  };
  window.WFP_NETZ = NETZ;

  /* ---- Gerätename (INTERFACES § 11.7) — ins Verbinden-Panel, nie in die
     byte-kopierte Panel-Datei. Derselbe Schlüssel wie netzweit: es ist
     dasselbe Gerät. Die Beschriftung folgt der Sprache des Panels (Modul 23-UI
     kennt Deutsch und Englisch; Russisch und Arabisch fallen dort auf Deutsch). */
  var LS_GERAETENAME = "sbkim_geraetename";
  var GN_TEXT = {
    de: { label: "🏷️ Gerätename:", ph: "z. B. Klaus-Handy (frei wählbar)", tip: "Nur ein Anzeige-Hinweis, kein Vertrauens-Beweis — die Kennung steht daneben." },
    en: { label: "🏷️ Device name:", ph: "e.g. Klaus-phone (your choice)", tip: "Only a display hint, not proof of trust — the ID stands next to it." }
  };
  function gnText() { var l = (document.documentElement.lang || "de").slice(0, 2); return GN_TEXT[l] || GN_TEXT.de; }
  function geraetename() {
    try { return (localStorage.getItem(LS_GERAETENAME) || "").trim().slice(0, 40); } catch (_e) { return ""; }
  }
  function anzeigeName() { var g = geraetename(); return g ? (NETZ.nodeName + " · " + g) : NETZ.nodeName; }
  function namensfelderAbgleichen() {
    try {
      var wert = geraetename(), liste = document.querySelectorAll("[data-sbkim-geraetename]");
      for (var i = 0; i < liste.length; i++) { if (liste[i].value !== wert) liste[i].value = wert; }
    } catch (_e) {}
  }
  function geraetenameFeldEinhaengen() {
    function versuch() {
      var panel = document.getElementById("sbkim-rdv-panel");
      if (!panel) return false;
      if (panel.querySelector("[data-sbkim-geraetename]")) return true;
      var t = gnText();
      var zeile = document.createElement("div");
      zeile.style.cssText = "margin:8px 0;display:flex;gap:6px;align-items:center;flex-wrap:wrap";
      var beschriftung = document.createElement("label");
      beschriftung.setAttribute("for", "sbkim-geraetename");
      beschriftung.textContent = t.label;
      beschriftung.style.cssText = "color:#9aa7b6;font-size:.85rem";
      var feld = document.createElement("input");
      feld.id = "sbkim-geraetename"; feld.type = "text"; feld.maxLength = 40;
      feld.setAttribute("data-sbkim-geraetename", "1");
      feld.placeholder = t.ph;
      feld.value = geraetename();
      feld.title = t.tip;
      feld.style.cssText = "flex:1;min-width:120px;padding:4px 6px;border-radius:6px;border:1px solid #33414f;background:#0d1520;color:#dfeaf2;font:inherit";
      feld.addEventListener("input", function () {
        try { localStorage.setItem(LS_GERAETENAME, String(feld.value || "").trim().slice(0, 40)); } catch (_e) {}
        try { window.dispatchEvent(new CustomEvent("sbkim:geraetename-changed")); } catch (_e) {}
      });
      zeile.appendChild(beschriftung); zeile.appendChild(feld);
      panel.insertBefore(zeile, panel.children[1] || null);
      return true;
    }
    if (versuch()) return;
    try {
      var beobachter = new MutationObserver(function () { if (versuch()) beobachter.disconnect(); });
      beobachter.observe(document.body, { childList: true, subtree: true });
    } catch (_e) {}
  }

  /* Sprachmodell vom eigenen Server (wie app.js; Modul 03 liest den Wert beim Laden). */
  if (!window.SBKIM_MODEL_ROOT) window.SBKIM_MODEL_ROOT = "https://family-projekt.de/models/";

  /* ---- Die Kette, kanonische Reihenfolge (Sage docs/PFLICHT_MODULE.md) ---- */
  var KANON = [
    ["",       "sbkim/01_storage.js"],
    ["",       "sbkim/02_spore.js"],
    /* Modul 03 steht NICHT in der Kette: die Suche nach Bedeutung lädt es erst auf
       „Modell laden" (tests/bedeutung.mjs bewacht das). Das Siegel führt 03 als „lazy". */
    ["",       "vendor/sbkim/04_match.js?v=1"],      // dieselbe Adresse wie die Suche nach Bedeutung
    ["",       "sbkim/05_anastomose.js"],
    ["",       "sbkim/07_apoptose.js"],
    ["",       "sbkim/15_membran.js"],
    ["",       "sbkim/16_siegel.js"],
    ["module", "sbkim/05b_nostr_relay.js"],   // ES-Modul, holt noble-secp256k1.js selbst
    ["",       "sbkim/23_rendezvous.js"],
    ["",       "sbkim/23_rendezvous_ui.js"],
    ["",       "assets/siegel-inhalt.js?v=1"],      // die Identität dieses Knotens
    ["",       "sbkim/16b_andock_wizard.js"]        // Andock-Werkzeug IM Siegel
  ];
  window.WFP_KETTE = KANON.map(function (k) { return k[1]; });

  function pause(f) {
    if (typeof window.requestIdleCallback === "function") window.requestIdleCallback(f, { timeout: 500 });
    else setTimeout(f, 16);
  }
  function naechste(i, fertig) {
    if (i >= KANON.length) { fertig(); return; }
    /* Steht 04 schon da (von der Suche nach Bedeutung), nicht zweimal laden. */
    if (/04_match/.test(KANON[i][1]) && window.SbkimMatch) {
      pause(function () { naechste(i + 1, fertig); }); return;
    }
    var s = document.createElement("script");
    if (KANON[i][0]) s.type = KANON[i][0];
    s.src = KANON[i][1];
    /* onerror wie onload: eine fehlende Datei darf die Kette nicht anhalten. */
    s.onload = s.onerror = function () { pause(function () { naechste(i + 1, fertig); }); };
    document.body.appendChild(s);
  }

  /* ---- Lampen: echte Ereignisse, nie ein geschätzter Zustand ------------- */
  function lampe(id, klasse) {
    var alle = [document.getElementById(id)].concat([].slice.call(document.querySelectorAll('[data-lampe-kopie="' + id + '"]')));
    alle.forEach(function (el) {
      if (!el) return;
      el.classList.remove("on", "warn", "bad");
      if (klasse) el.classList.add(klasse);
    });
  }
  function pulsSetzen(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add("puls");
    setTimeout(function () { el.classList.remove("puls"); }, 950);
  }
  function lampenVerdrahten() {
    window.addEventListener("sbkim:alive", function () { lampe("lamp-alive", "on"); });
    window.addEventListener("sbkim:nostr-listening", function (e) {
      lampe("lamp-traffic", (e && e.detail && e.detail.active) ? "on" : null);
    });
    window.addEventListener("sbkim:handshake",   function () { pulsSetzen("lamp-traffic"); });
    window.addEventListener("sbkim:postmessage", function () { pulsSetzen("lamp-traffic"); });
    window.addEventListener("sbkim:fremd-alert", function () { lampe("lamp-fremd", "bad"); });
  }

  /* ---- Auf- und Zuklappen der Leiste (am Handy nur die Lampen) ----------- */
  function leisteVerdrahten() {
    var knopf = document.getElementById("lampen"), leiste = document.getElementById("netzleiste");
    if (!knopf || !leiste) return;
    function setze(offen) {
      leiste.setAttribute("data-offen", offen ? "1" : "0");
      knopf.setAttribute("aria-expanded", String(offen));
    }
    knopf.addEventListener("click", function () { setze(leiste.getAttribute("data-offen") !== "1"); });
    /* Ein Tipp daneben klappt wieder zu — aber nicht, wenn er IN der Leiste
       landet (Siegel, Mycel-Blase) oder in einem Fenster, das sie geöffnet hat. */
    document.addEventListener("click", function (e) {
      if (leiste.getAttribute("data-offen") !== "1") return;
      var t = e.target;
      if (!document.contains(t) || leiste.contains(t)) return;
      if (t.closest && t.closest("[id^='sbkim-'],[class*='sbkim-']")) return;
      setze(false);
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") setze(false); });
  }

  /* ---- Start-Kette: Storage → Membran → Siegel → Apoptose → Anastomose →
     Rendezvous (Rezept „status-leiste-siegel", ohne Modul 17). ------------ */
  async function starten() {
    try {
      if (!window.SbkimStorage) return;
      await window.SbkimStorage.init({ dbSuffix: NETZ.dbSuffix });

      if (window.SbkimMembrane) {
        await window.SbkimMembrane.init({ allowedOrigins: NETZ.allowedOrigins, lampSelector: "#lamp-fremd" });
      }
      if (window.SbkimSiegel) {
        /* `ribbonText` ist Pflicht — ohne ihn bleibt das Band im Wappen leer. */
        window.SbkimSiegel.init({ badgeSelector: "#siegel-platz", mountModal: true, repoUrl: NETZ.repoUrl, ribbonText: "WORKFLOH PDF" });
      }
      if (window.SbkimApoptose) { try { await window.SbkimApoptose.init(); } catch (_e) {} }
      if (window.SbkimAnastomose) { try { await window.SbkimAnastomose.init(); } catch (_e) {} }

      /* Rendezvous: `init()` baut NICHTS auf und ruft NICHTS. Angemeldet wird
         erst auf Klick. `ensureIdentity` ABSICHTLICH NICHT (netzweite Stufe 0b). */
      if (window.SbkimRendezvous) { try { window.SbkimRendezvous.init({ nodeName: anzeigeName(), dbSuffix: NETZ.dbSuffix }); } catch (_e) {} }
      if (window.SbkimRendezvousUI) { try { window.SbkimRendezvousUI.init({ nodeName: anzeigeName(), dbSuffix: NETZ.dbSuffix }); } catch (_e) {} }

      geraetenameFeldEinhaengen();
      window.addEventListener("sbkim:geraetename-changed", function () {
        namensfelderAbgleichen();
        try { if (window.SbkimRendezvous && window.SbkimRendezvous.configure) window.SbkimRendezvous.configure({ nodeName: anzeigeName() }); } catch (_e) {}
      });
    } catch (e) {
      if (window.console && console.warn) console.warn("[Workfloh-PDF-SBKIM] Andock übersprungen:", e);
    } finally {
      window.WFP_KNOTEN_BEREIT = true;
    }
  }

  lampenVerdrahten();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", leisteVerdrahten);
  else leisteVerdrahten();
  if (document.readyState === "complete") pause(function () { naechste(0, starten); });
  else window.addEventListener("load", function () { pause(function () { naechste(0, starten); }); });
})();
