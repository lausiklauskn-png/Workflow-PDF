/* Workfloh PDF — Strichgrafiken statt Emojis (Pro-Umbau 5, Klaus 2026-10-28, Leitfaden § 5: „kein Bilderbuch").
   Gleicher Stil wie die Pro-Apps (Private Brain Pro pb-icons.svg): 24 × 24, Strich 1,75, runde Enden,
   currentColor — das Symbol hat die Farbe der Schrift, in jedem Thema.

   Wie es arbeitet: die App schreibt weiter ihre Texte mit Emoji („📷 Scannen"), und die Wörterbücher
   (sprache-texte.js) bleiben, wie sie sind. Diese Datei ersetzt im DOM jedes Bildzeichen durch ein kleines
   <svg data-strich="📷"> — sofort beim Start und bei jeder Änderung (MutationObserver). sprache.js liest das
   svg wieder als sein Emoji (Satz-Ebene) bzw. schlägt den Text ohne Emoji nach (Text-Ebene); so passen alle
   Schlüssel weiter. Das svg trägt das Emoji als <desc>: textContent bleibt gleich (Proben, die nach „📤" suchen),
   sichtbar ist nur der Strich, Vorlesen sagt nur den Text (aria-hidden).

   ⚠ Reihenfolge: diese Datei steht VOR sprache.js — ihr Beobachter muss vor dem der Übersetzung laufen,
   sonst merkte sich die Übersetzung den Text mit Emoji als „Original".

   Wo kein Symbol stehen kann (title, aria-label, placeholder, <option>), fällt das Emoji weg. Ein unbekanntes
   Bildzeichen fällt ebenso weg (nie still ein Bild). Unberührt: Eingaben, Textfelder, Namen des Nutzers
   ([data-kein-ue]), [data-kein-strich], die SBKIM-Fenster (byte-1:1 aus Sage, Kennungen „sbkim-…"). */
(function () {
  'use strict';
  const W = window;
  // Typografische Zeichen, die keine Bilder sind (dieselbe Ausnahme wie der Wächter in Private Brain Pro)
  const BILD = /(?![↗©™®↔↕↺↻])\p{Extended_Pictographic}(?:️|⃣)*(?:‍\p{Extended_Pictographic}️?)*/gu;
  const EIN = new RegExp(BILD.source, 'u');
  const P = {
    warn: '<path d="M12 3 2 21h20zM12 9v5"/><circle cx="12" cy="17.5" r=".5"/>',
    welt: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
    teilen: '<path d="M12 15V3m-4 4 4-4 4 4M6 11H5v10h14V11h-1"/>',
    ki: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M12 8l1.4 2.6L16 12l-2.6 1.4L12 16l-1.4-2.6L8 12l2.6-1.4z"/>',
    download: '<path d="M12 3v12m-4-4 4 4 4-4M4 18v3h16v-3"/>',
    upload: '<path d="M12 21V9m-4 4 4-4 4 4M4 6V3h16v3"/>',
    datei: '<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/>',
    kamera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.5" r="3.5"/>',
    bedeutung: '<circle cx="6" cy="7" r="2.2"/><circle cx="18" cy="7" r="2.2"/><circle cx="12" cy="17" r="2.2"/><path d="M8.1 7.6h7.8M7.1 9l3.8 6.1M16.9 9l-3.8 6.1"/>',
    ordner: '<path d="M3 7V4h6l2 3h10v13H3z"/>',
    stift: '<path d="m15 4 5 5M4 20l5-1L21 7l-5-5L4 14z"/>',
    schreiben: '<path d="M3 19c2.5-1 4-4 6-4s1.5 3 3.5 3 3-1.5 5-2.5M14 3l4 4-6 6H8V9z"/>',
    papierkorb: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
    mikro: '<path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"/>',
    suche: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.2 15.2 5 5"/>',
    haken: '<path d="m5 12 4 4L19 6"/>',
    hakenBox: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="m8 12 3 3 5-6"/>',
    box: '<rect x="5" y="5" width="14" height="14" rx="2"/>',
    zurueck: '<path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3"/>',
    liste: '<path d="M9 4h6v3H9zM7 5H6v16h12V5h-1M9 11h6M9 15h6"/>',
    schere: '<circle cx="6" cy="7" r="3"/><circle cx="6" cy="17" r="3"/><path d="M8.5 8.5 20 18M8.5 15.5 20 6"/>',
    zahnrad: '<path d="m9 3-.5 2-2 1-2-.5-2 3L4 10v4l-1.5 1.5 2 3 2-.5 2 1 .5 2h6l.5-2 2-1 2 .5 2-3L20 14v-4l1.5-1.5-2-3-2 .5-2-1-.5-2z"/><circle cx="12" cy="12" r="3"/>',
    los: '<path d="M8 5v14l11-7z"/>',
    zurueckSpiel: '<path d="M16 5v14L5 12z"/>',
    bild: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
    etikett: '<path d="M3 4h8l10 10-8 8L3 12z"/><circle cx="7.5" cy="8.5" r="1"/>',
    stopp: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    speichern: '<path d="M4 3h14l3 3v15H3V3zM7 3v6h10V3M7 21v-8h10v8"/>',
    schloss: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2"/>',
    film: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m10 9 5 3-5 3z"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2h1.5a4.5 4.5 0 0 0 4.5-4.5C21 7 17 3 12 3z"/><circle cx="7.5" cy="12" r="1"/><circle cx="10" cy="7.5" r="1"/><circle cx="15" cy="7.5" r="1"/>',
    notiz: '<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>',
    kalender: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    buecher: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM15.5 5.2l3.9-1 3.4 14.6-3.9 1z"/>',
    buch: '<path d="M4 4h12a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2zM4 18a2 2 0 0 1 2-2h12M8 8h6M8 12h6"/>',
    handy: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
    installieren: '<rect x="9" y="2" width="10" height="20" rx="2"/><path d="M2 12h9m-3-3 3 3-3 3"/>',
    text: '<path d="M3 18 8 6l5 12M5 14h6M16 18v-5M16 13a2.5 2.5 0 1 1 5 0v5"/>',
    zahlen: '<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.5" r=".5"/>',
    packen: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 3v2M12 7v2M12 11v2M10 15h4v4h-4z"/>',
    sprechen: '<circle cx="9" cy="9" r="4"/><path d="M2 21a7 7 0 0 1 14 0M17 6a5 5 0 0 1 0 6M20 4a8 8 0 0 1 0 10"/>',
    schild: '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/>',
    kolben: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-9V3M7 15h10"/>',
    eingang: '<path d="M12 3v11m-4-4 4 4 4-4M4 14v6h16v-6"/>',
    maske: '<path d="M4 5c5 2 11 2 16 0v6c0 5-4 8-8 8s-8-3-8-8zM8 10h2M14 10h2M9 14c2 1.5 4 1.5 6 0"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    telefon: '<path d="M5 3h4l2 5-3 2a11 11 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
    link: '<path d="m10 7 2-2a4.25 4.25 0 0 1 6 6l-2 2m-2 4-2 2a4.25 4.25 0 0 1-6-6l2-2m1 4 6-6"/>',
    zeigen: '<path d="M9 12V5a2 2 0 0 1 4 0v6M13 10a2 2 0 0 1 4 0v2M17 12a2 2 0 0 1 3 1.5V16a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-3l-2.5-4a1.8 1.8 0 0 1 3-2L9 15"/>',
    lineal: '<rect x="2" y="8" width="20" height="8" rx="1"/><path d="M6 8v3M10 8v4M14 8v3M18 8v4"/>',
    drucken: '<path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M6 14h12v7H6z"/>',
    auge: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    nadel: '<path d="M9 3h6l-1 6 3 3H7l3-3zM12 12v9"/>',
    stecker: '<path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0zM12 17v4"/>',
    hand: '<path d="M7 12V6a1.5 1.5 0 0 1 3 0v5M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v6M16 11V8a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2.5-4A1.5 1.5 0 0 1 6 12.5L7 14"/>',
    sonne: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    schaerfe: '<path d="M3 21 14 10l3 3-9 8zM14 10l5-5a2 2 0 0 1 3 3l-5 5"/>',
    punkt: '<circle cx="12" cy="12" r="3" fill="currentColor"/>'
  };
  // Emoji (ohne Varianten-Wähler) → Symbol
  const STRICH = {
    '⚠': 'warn', '🌐': 'welt', '📤': 'teilen', '🤖': 'ki', '✨': 'ki', '⬇': 'download', '⬆': 'upload', '📥': 'eingang',
    '📄': 'datei', '📷': 'kamera', '🧠': 'bedeutung', '🗂': 'ordner', '📂': 'ordner', '📁': 'ordner',
    '✏': 'stift', '✎': 'stift', '✍': 'schreiben', '✒': 'schreiben', '📝': 'notiz', '🗑': 'papierkorb',
    '🎤': 'mikro', '🎙': 'mikro', '🔎': 'suche', '🔍': 'suche', '✅': 'haken', '✔': 'haken', '☑': 'hakenBox', '☐': 'box',
    '↩': 'zurueck', '📋': 'liste', '✂': 'schere', '⚙': 'zahnrad', '▶': 'los', '◀': 'zurueckSpiel', '🖼': 'bild',
    '🏷': 'etikett', '⏹': 'stopp', '💾': 'speichern', '🔐': 'schloss', '🔒': 'schloss', '🎬': 'film', '🎨': 'palette',
    '📅': 'kalender', '📚': 'buecher', '📘': 'buch', '📱': 'handy', '📲': 'installieren', '🔤': 'text', '🔢': 'zahlen',
    'ℹ': 'info', '🗜': 'packen', '🗣': 'sprechen', '🛡': 'schild', '🧪': 'kolben', '🎭': 'maske', '✉': 'mail',
    '📞': 'telefon', '🔗': 'link', '👆': 'zeigen', '📏': 'lineal', '🖨': 'drucken', '👁': 'auge', '📌': 'nadel',
    '🔌': 'stecker', '✋': 'hand', '☀': 'sonne', '🔪': 'schaerfe', '▪': 'punkt'
  };
  const grund = e => e.replace(/[️⃣]/g, '');
  const AUS = 'input,textarea,script,style,svg,select,[data-kein-strich],[data-kein-ue],[contenteditable="true"],[id^="sbkim"],[class*="sbkim"],#wfp-chrome';
  const NUR_TEXT = 'option,optgroup,title';
  const ATTR = ['title', 'aria-label', 'placeholder'];
  const ohneBild = t => String(t).replace(new RegExp('\\s?' + BILD.source + '\\s?', 'gu'), ' ').replace(/[️‍]/g, '').replace(/ {2,}/g, ' ').trim();

  function svg(e) {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic-strich'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.setAttribute('focusable', 'false');
    s.setAttribute('data-strich', e);
    s.innerHTML = '<desc>' + e + '</desc>' + P[STRICH[grund(e)]];
    return s;
  }
  function textErsetzen(n) {
    const v = n.nodeValue, e = n.parentElement;
    if (!e || !EIN.test(v) || e.closest(AUS)) return 0;
    if (e.closest(NUR_TEXT)) { const neu = ohneBild(v); if (neu !== v) n.nodeValue = neu; return 1; }
    const teile = []; let rest = v, zahl = 0;
    for (let m = EIN.exec(rest); m; m = EIN.exec(rest)) {
      if (m.index) teile.push(document.createTextNode(rest.slice(0, m.index)));
      rest = rest.slice(m.index + m[0].length);
      if (STRICH[grund(m[0])]) teile.push(svg(m[0]));
      else rest = rest.replace(/^\s/, '');   // unbekanntes Bild: weg samt Leerzeichen
      zahl++;
    }
    if (rest) teile.push(document.createTextNode(rest));
    n.replaceWith(...teile);
    return zahl;
  }
  function attribute(e) {
    if (!e || e.nodeType !== 1 || e.closest('[data-kein-strich],[id^="sbkim"],[class*="sbkim"],#wfp-chrome')) return;
    for (const a of ATTR) { const v = e.getAttribute(a); if (v && EIN.test(v)) e.setAttribute(a, ohneBild(v)); }
  }
  function ersetzen(root) {
    if (!root) return 0;
    if (root.nodeType === 3) return textErsetzen(root);
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return 0;
    if (root.nodeType === 1 && root.closest && root.closest(AUS) && !root.matches('select')) { attribute(root); return 0; }
    const treffer = [], w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) if (EIN.test(n.nodeValue)) treffer.push(n);
    let zahl = 0; for (const n of treffer) zahl += textErsetzen(n);
    if (root.nodeType === 1) attribute(root);
    if (root.querySelectorAll) for (const e of root.querySelectorAll('[title],[aria-label],[placeholder]')) attribute(e);
    // <option> in einer Auswahl (select steht in AUS): nur Text, kein Symbol
    if (root.querySelectorAll) for (const o of root.querySelectorAll('option,optgroup')) for (const c of o.childNodes) if (c.nodeType === 3 && EIN.test(c.nodeValue)) c.nodeValue = ohneBild(c.nodeValue);
    return zahl;
  }
  let beob = null;
  function start() {
    if (beob || !document.body) return;
    ersetzen(document.body);
    beob = new MutationObserver(liste => {
      for (const r of liste) {
        if (r.type === 'childList') { for (const n of r.addedNodes) if (n.isConnected) ersetzen(n); }
        else if (r.type === 'characterData') { if (r.target.isConnected) ersetzen(r.target); }
        else if (r.type === 'attributes') attribute(r.target);
      }
    });
    beob.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  // Sichtbare Bildzeichen in einem Text (für Proben und für sprache.js)
  const istBild = t => EIN.test(String(t || ''));
  W.WFP = W.WFP || {};
  W.WFP.Strich = { start, ersetzen, ohneBild, istBild, STRICH, SYMBOLE: P, BILD };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
