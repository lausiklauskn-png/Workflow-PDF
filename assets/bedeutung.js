/* Workfloh PDF — Suche, Stufe 2: Bedeutungssuche (Klaus 2026-09-26).
   „Semantische Suche, Embedding-Modell runterladen mit Ladebalken und Ladezustandsanzeige."

   Das Modell kommt aus Sage (Modul 03 Embedding, Modul 04 Match — byte-1:1 unter vendor/sbkim/),
   dasselbe wie in PWA Toolpoint: multilingual-e5-small, 384 Zahlen je Text, auf dem Gerät gerechnet.
   Diese Datei trägt nur die RECHNUNG — keine Oberfläche, kein Speicher, kein Netz —, damit sie in
   Node geprüft und später in die WorkFlohs kopiert werden kann:
   · stuecke()     ein Dokument satzweise in kurze Abschnitte zerlegen (Name, Felder, Seitentext mit Lage)
   · signatur()    ändert sich der Text, wird neu eingeordnet — sonst nicht
   · ladeStand()   die Fortschritts-Meldungen des Modells zu EINER Zahl zusammenzählen
   · rangliste()   jedes Dokument bekommt seinen BESTEN Abschnitt; sortiert, relativ zum besten Treffer

   ⚠ Die Zahl ist eine NÄHE (Cosinus), eine Rangfolge — kein „passt zu 83 %". So steht es auch
   in PWA Toolpoint; hier von Anfang an. */
(function () {
  'use strict';

  /* Abschnitte (Klaus 2026-09-26, nach dem ersten Sichttest: „einen Satz von ungefähr zehn Wörtern,
     da fehlt ihm noch die Erfahrung"). Ein Abschnitt von 500 Zeichen ist ein Durchschnitt aus
     mehreren Gedanken — ein Satz als Frage trifft ihn schlecht. Jetzt: SATZWEISE, etwa 120–260
     Zeichen, und das letzte Textstück eines Abschnitts steht noch einmal am Anfang des nächsten
     (Überlappung), damit ein Gedanke an der Grenze nicht zerschnitten wird. */
  const STUECK_ZIEL = 120;      // ab hier endet ein Abschnitt am nächsten Satzende
  const STUECK_MAX = 260;       // spätestens hier endet er (e5 schneidet erst bei 512 Tokens ab)
  const ZERLEGUNG = 'z2';       // gehört zum Fingerabdruck: neue Zerlegung ⇒ neu einordnen
  /* KEIN Deckel je Dokument mehr: bis 2026-09-26 standen hier 80 Abschnitte — bei einem
     Handbuch waren damit nur etwa die ersten 15 Seiten eingeordnet, der Rest war für die
     Bedeutungssuche unsichtbar. Eingeordnet wird jetzt alles; die App macht es im
     Hintergrund, Stück für Stück gespeichert, und setzt nach einer Unterbrechung fort. */

  /* Welche Dokumente gezeigt werden: RELATIV zum besten Treffer. Der rohe e5-Cosinus hat einen
     hohen Boden (Sage, LEHRE-EMBEDDING-MATCH-KALIBRIERUNG: Unverwandtes liegt um 0,83) — eine
     feste Schwelle lässt bei langen Fragen fast alles durch oder fast nichts. Gezeigt wird, was
     höchstens ABSTAND hinter dem besten liegt, und nie unter der UNTERGRENZE. Findet sich
     darüber nichts, stehen die SCHWACH_ZEIGEN nächsten da — ausdrücklich als „schwach".
     ⚠ 0,04 · 0,80 · 12 · 3 sind GEWÄHLT, nicht an Klaus' Dokumenten gemessen. */
  const NAEHE_MIN = 0.80;
  const ABSTAND = 0.04;
  const MAX_ZEIGEN = 12;
  const SCHWACH_ZEIGEN = 3;
  /* Lange Fragen: Wort und Bedeutung zusammen. Wer von mehreren Suchwörtern viele im Abschnitt
     hat, bekommt bis zu WORT_BONUS auf die Rangfolge — die angezeigte Nähe bleibt die echte. */
  const WORT_BONUS = 0.05;

  const huelle = boxen => {
    const x0 = Math.min(...boxen.map(b => b.x)), y0 = Math.min(...boxen.map(b => b.y));
    return { x: x0, y: y0, w: Math.max(...boxen.map(b => b.x + b.w)) - x0, h: Math.max(...boxen.map(b => b.y + b.h)) - y0 };
  };
  const leer = s => !String(s || '').trim();
  const satzEnde = s => /[.!?:;…]["'»«“”)\]]*$/.test(String(s).trim());

  /* doc: { name, fields: [{ label, value }] }
     seiten: je Seite eine Liste von Textstücken { s, x, y, w, h } (so liegen sie in der Suche,
     assets/suche.js vorbereiten()) oder [text, x, y, w, h] (so liegen sie im Speicher).
     Rückgabe: [{ page, text, box }] — page null für Name und Felder (sie haben keine Stelle
     auf einer Seite, die man markieren könnte). */
  function stuecke(doc, seiten) {
    const out = [];
    const kopf = [doc && doc.name].concat((doc && doc.fields || [])
      .filter(f => typeof f.value === 'string' && f.value && !/^data:/.test(f.value))
      .map(f => (f.label ? f.label + ': ' : '') + f.value)).filter(s => !leer(s)).join(' · ');
    if (!leer(kopf)) out.push({ page: null, text: kopf.slice(0, STUECK_MAX), box: null });
    (seiten || []).forEach((items, p) => {
      const roh = (items && items.it) ? items.it : (items || []);
      // Ein einzelnes Textstück über STUECK_MAX wird an Wortgrenzen geteilt (gleiche Lage)
      const it = [];
      for (const a of roh) {
        const s = String(Array.isArray(a) ? a[0] : a.s || '').replace(/\s+/g, ' ').trim();
        const b = Array.isArray(a) ? { x: a[1], y: a[2], w: a[3], h: a[4] } : { x: a.x, y: a.y, w: a.w, h: a.h };
        if (!s) continue;
        if (s.length <= STUECK_MAX) { it.push({ s, b }); continue; }
        let rest = s;
        while (rest.length > STUECK_MAX) {
          let cut = rest.lastIndexOf(' ', STUECK_MAX); if (cut < STUECK_ZIEL) cut = STUECK_MAX;
          it.push({ s: rest.slice(0, cut).trim(), b }); rest = rest.slice(cut).trim();
        }
        if (rest) it.push({ s: rest, b });
      }
      let teile = [];
      const len = () => teile.reduce((n, x) => n + x.s.length + 1, 0);
      const ab = () => {
        if (!teile.length) return;
        out.push({ page: p, text: teile.map(x => x.s).join(' '), box: huelle(teile.map(x => x.b)) });
        // Überlappung: das letzte Stück beginnt den nächsten Abschnitt — nur wenn es davor mehr gab
        const letztes = teile[teile.length - 1];
        teile = teile.length > 1 && letztes.s.length < STUECK_ZIEL ? [letztes] : [];
        teile.ueber = teile.length;
      };
      for (let i = 0; i < it.length; i++) {
        const x = it[i];
        if (teile.length && len() + x.s.length > STUECK_MAX) { ab(); if (len() + x.s.length > STUECK_MAX) teile = []; }
        teile.push(x);
        if (len() >= STUECK_ZIEL && satzEnde(x.s)) ab();
      }
      // Was am Seitenende übrig bleibt: nur, wenn es mehr als die Überlappung ist
      if (teile.length > (teile.ueber || 0)) ab();
    });
    return out;
  }

  // Kurzer, stabiler Fingerabdruck der Texte (FNV-1a) — kein Schutz, nur „hat sich etwas geändert?"
  function signatur(st) {
    let h = 0x811c9dc5;
    const s = ZERLEGUNG + '\n' + st.map(x => (x.page == null ? '-' : x.page) + ':' + x.text).join('\n');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return st.length + '-' + h.toString(36);
  }

  /* Fortschritt: transformers.js meldet JE DATEI {status, file, progress, loaded, total}.
     Gezählt wird über alle Dateien, die bisher gemeldet wurden. Ohne Größenangabe gibt es
     keine Prozentzahl (null) — dann läuft der Balken unbestimmt, statt etwas zu behaupten. */
  function ladeStand(dateien, d) {
    if (d && d.file) {
      const alt = dateien.get(d.file) || { geladen: 0, gesamt: 0, fertig: false };
      if (typeof d.total === 'number' && d.total > 0) alt.gesamt = d.total;
      if (typeof d.loaded === 'number') alt.geladen = d.loaded;
      if (d.status === 'done') { alt.fertig = true; if (alt.gesamt) alt.geladen = alt.gesamt; }
      dateien.set(d.file, alt);
    }
    let geladen = 0, gesamt = 0;
    for (const v of dateien.values()) { geladen += Math.min(v.geladen, v.gesamt || v.geladen); gesamt += v.gesamt; }
    const prozent = gesamt > 0 ? Math.max(0, Math.min(100, geladen / gesamt * 100)) : null;
    return { prozent, geladen, gesamt, datei: d && d.file ? String(d.file).split('/').pop() : '' };
  }

  /* qv: Frage-Vektoren (eine oder mehrere Fassungen), vek: Map id → { st: [{ page, text, box, v }] },
     dot: (a, b) → Zahl (Modul 04 match). opt.wortAnteil(text) → 0…1: wie viele der Suchwörter im
     Abschnitt stehen (nur bei Fragen aus mehreren Wörtern, sonst fehlt es).
     Rückgabe: alle Dokumente mit ihrem besten Abschnitt ({ id, w: Nähe, rang, anteil, stueck }),
     beste zuerst; `gezeigt` hält Fenster, Untergrenze und Deckel; `schwach` steht nur da, wenn
     `gezeigt` leer ist. */
  function rangliste(qv, vek, dot, opt) {
    const o = opt || {};
    const min = typeof o.min === 'number' ? o.min : NAEHE_MIN;
    const abstand = typeof o.abstand === 'number' ? o.abstand : ABSTAND;
    const max = o.max || MAX_ZEIGEN;
    const wa = typeof o.wortAnteil === 'function' ? o.wortAnteil : null;
    const alle = [];
    for (const [id, e] of vek) {
      let best = null;
      for (const s of e.st || []) {
        let w = -Infinity; for (const q of qv) { const x = dot(q, s.v); if (x > w) w = x; }
        const anteil = wa ? Math.max(0, Math.min(1, +wa(s.text) || 0)) : 0;
        const rang = w + WORT_BONUS * anteil;
        if (!best || rang > best.rang) best = { id, w, rang, anteil, stueck: s };
      }
      if (best) alle.push(best);
    }
    alle.sort((a, b) => b.rang - a.rang);
    const grenze = alle.length ? Math.max(min, alle[0].rang - abstand) : min;
    const gezeigt = alle.filter(r => r.rang >= grenze).slice(0, max);
    const schwach = gezeigt.length ? [] : alle.slice(0, SCHWACH_ZEIGEN);
    return { gezeigt, schwach, alle, unter: alle.length - gezeigt.length, min, abstand, max, grenze };
  }

  const API = { STUECK_ZIEL, STUECK_MAX, ZERLEGUNG, NAEHE_MIN, ABSTAND, MAX_ZEIGEN, SCHWACH_ZEIGEN, WORT_BONUS, stuecke, signatur, ladeStand, rangliste };
  if (typeof window !== 'undefined') { window.WFP = window.WFP || {}; window.WFP.Bedeutung = API; }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof globalThis !== 'undefined') globalThis.__WFP_BEDEUTUNG = API;
})();
