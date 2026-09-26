/* Workfloh PDF — Suche, Stufe 2: Bedeutungssuche (Klaus 2026-09-26).
   „Semantische Suche, Embedding-Modell runterladen mit Ladebalken und Ladezustandsanzeige."

   Das Modell kommt aus Sage (Modul 03 Embedding, Modul 04 Match — byte-1:1 unter vendor/sbkim/),
   dasselbe wie in PWA Toolpoint: multilingual-e5-small, 384 Zahlen je Text, auf dem Gerät gerechnet.
   Diese Datei trägt nur die RECHNUNG — keine Oberfläche, kein Speicher, kein Netz —, damit sie in
   Node geprüft und später in die WorkFlohs kopiert werden kann:
   · stuecke()     ein Dokument in kurze Abschnitte zerlegen (Name, Felder, Seitentext mit Lage)
   · signatur()    ändert sich der Text, wird neu eingeordnet — sonst nicht
   · ladeStand()   die Fortschritts-Meldungen des Modells zu EINER Zahl zusammenzählen
   · rangliste()   jedes Dokument bekommt seinen BESTEN Abschnitt; sortiert, mit Schwelle und Deckel

   ⚠ Die Zahl ist eine NÄHE (Cosinus), eine Rangfolge — kein „passt zu 83 %". So steht es auch
   in PWA Toolpoint; hier von Anfang an. */
(function () {
  'use strict';

  const STUECK_ZEICHEN = 500;   // e5 schneidet bei 512 Tokens ab; 500 Zeichen bleiben sicher darunter
  const MAX_STUECKE = 80;       // je Dokument — ein 384-Seiten-Handbuch wäre am Tablet eine Stunde
  const NAEHE_MIN = 0.80;       // gezeigt ab dieser Nähe (gewählt, nicht an Klaus' Dokumenten gemessen)
  const MAX_ZEIGEN = 12;        // höchstens so viele Dokumente „nach Bedeutung"

  const huelle = boxen => {
    const x0 = Math.min(...boxen.map(b => b.x)), y0 = Math.min(...boxen.map(b => b.y));
    return { x: x0, y: y0, w: Math.max(...boxen.map(b => b.x + b.w)) - x0, h: Math.max(...boxen.map(b => b.y + b.h)) - y0 };
  };
  const leer = s => !String(s || '').trim();

  /* doc: { name, fields: [{ label, value }] }
     seiten: je Seite eine Liste von Textstücken { s, x, y, w, h } (so liegen sie in der Suche,
     assets/suche.js vorbereiten()) oder [text, x, y, w, h] (so liegen sie im Speicher).
     Rückgabe: [{ page, text, box }] — page null für Name und Felder (sie haben keine Stelle
     auf einer Seite, die man markieren könnte), und { gekuerzt } als Eigenschaft der Liste. */
  function stuecke(doc, seiten) {
    const out = [];
    const kopf = [doc && doc.name].concat((doc && doc.fields || [])
      .filter(f => typeof f.value === 'string' && f.value && !/^data:/.test(f.value))
      .map(f => (f.label ? f.label + ': ' : '') + f.value)).filter(s => !leer(s)).join(' · ');
    if (!leer(kopf)) out.push({ page: null, text: kopf.slice(0, STUECK_ZEICHEN), box: null });
    let gekuerzt = false;
    (seiten || []).forEach((items, p) => {
      const it = (items && items.it) ? items.it : (items || []);
      let text = '', boxen = [];
      const ab = () => { if (!leer(text)) out.push({ page: p, text: text.trim(), box: boxen.length ? huelle(boxen) : null }); text = ''; boxen = []; };
      for (const a of it) {
        const s = Array.isArray(a) ? a[0] : a.s;
        const b = Array.isArray(a) ? { x: a[1], y: a[2], w: a[3], h: a[4] } : { x: a.x, y: a.y, w: a.w, h: a.h };
        if (leer(s)) continue;
        if (text.length + s.length + 1 > STUECK_ZEICHEN) ab();
        text += (text ? ' ' : '') + s; boxen.push(b);
      }
      ab();
    });
    if (out.length > MAX_STUECKE) { out.length = MAX_STUECKE; gekuerzt = true; }
    out.gekuerzt = gekuerzt;
    return out;
  }

  // Kurzer, stabiler Fingerabdruck der Texte (FNV-1a) — kein Schutz, nur „hat sich etwas geändert?"
  function signatur(st) {
    let h = 0x811c9dc5;
    const s = st.map(x => (x.page == null ? '-' : x.page) + ':' + x.text).join('\n');
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
     dot: (a, b) → Zahl (Modul 04 match). Rückgabe: alle Dokumente, beste zuerst; gezeigt wird,
     was die Schwelle hält, höchstens MAX_ZEIGEN — `unter` zählt, was darunter lag. */
  function rangliste(qv, vek, dot, opt) {
    const min = opt && typeof opt.min === 'number' ? opt.min : NAEHE_MIN;
    const max = opt && opt.max ? opt.max : MAX_ZEIGEN;
    const alle = [];
    for (const [id, e] of vek) {
      let best = -Infinity, st = null;
      for (const s of e.st || []) for (const q of qv) { const w = dot(q, s.v); if (w > best) { best = w; st = s; } }
      if (st) alle.push({ id, w: best, stueck: st });
    }
    alle.sort((a, b) => b.w - a.w);
    const gezeigt = alle.filter(r => r.w >= min).slice(0, max);
    return { gezeigt, alle, unter: alle.filter(r => r.w < min).length, min, max };
  }

  const API = { STUECK_ZEICHEN, MAX_STUECKE, NAEHE_MIN, MAX_ZEIGEN, stuecke, signatur, ladeStand, rangliste };
  if (typeof window !== 'undefined') { window.WFP = window.WFP || {}; window.WFP.Bedeutung = API; }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof globalThis !== 'undefined') globalThis.__WFP_BEDEUTUNG = API;
})();
