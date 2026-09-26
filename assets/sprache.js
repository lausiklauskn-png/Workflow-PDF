/* Workfloh PDF — Sprache der Oberfläche (Klaus 2026-09-26).
   „mache bitte die App übersetzbar … die Button und alles andere auch. Auch die Tool-Types."
   Offline: die Wörterbücher stehen in dieser App (assets/sprache-texte.js), nichts geht ins Netz.

   Wie es arbeitet: die App schreibt weiter Deutsch. Diese Datei übersetzt, was im DOM
   steht — beim Start und bei jeder Änderung (MutationObserver). Deshalb braucht app.js
   kaum Änderungen, und ein Dialog, der später dazukommt, wird mitübersetzt.

   Zwei Stufen:
   1. Satz-Ebene: ein Element, das nur Text und Auszeichnung (b, i, small, span …) trägt,
      wird als GANZER Satz nachgeschlagen („Der Speicher gilt nur für <b>diesen</b> Browser").
      Sonst stünde die Wortstellung der Bruchstücke im Deutschen fest.
   2. Text-Ebene: jedes übrige Textstück einzeln. Titel, Platzhalter, aria-label ebenso.

   Schlüssel dürfen {} enthalten (Zahlen, Namen): im Wert stehen {1}, {2} … oder eine
   Funktion (für Mehrzahl, z. B. im Russischen). Was ein {} fängt, wird selbst nachgeschlagen.
   Fehlt ein Eintrag, bleibt das Deutsche stehen (fail-soft) und wird in `fehlt` gemerkt.

   NIE übersetzt: alles unter [data-kein-ue] (Dokument- und Ordnernamen, Feldbezeichnungen,
   Seiten), die Chrome-Fläche #wfp-chrome, Eingabewerte, SCRIPT/STYLE/TEXTAREA. */
(function () {
  'use strict';
  const W = (window.WFP = window.WFP || {});
  const KEY = 'wfpdf_sprache_v1';
  const SPRACHEN = [
    { code: 'de', name: 'Deutsch', kurz: 'DE' },
    { code: 'en', name: 'English', kurz: 'EN' },
    { code: 'ru', name: 'Русский', kurz: 'RU' },
    { code: 'ar', name: 'العربية', kurz: 'AR', rtl: true }
  ];
  const INLINE = new Set(['B', 'STRONG', 'I', 'EM', 'SMALL', 'SPAN', 'CODE', 'U', 'KBD', 'BR', 'A', 'SUB', 'SUP', 'MARK']);
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CANVAS', 'SVG', 'svg', 'IMG', 'VIDEO']);
  const ATTR = ['title', 'placeholder', 'aria-label'];

  let st = {}; try { st = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) {}
  let LANG = SPRACHEN.some(s => s.code === st.lang) ? st.lang : 'de';
  let TIPPS = st.tipps !== false;
  const fehlt = new Set(), fehltSatz = new Set();

  const norm = s => s.replace(/\s+/g, ' ').trim();
  const text = () => (W.SPRACH_TEXTE || {})[LANG] || {};

  // Muster ({}-Schlüssel) je Sprache einmal übersetzen.
  const MUSTER = {};
  function muster() {
    if (MUSTER[LANG]) return MUSTER[LANG];
    const out = [];
    for (const [k, v] of Object.entries(text())) {
      if (!k.includes('{}')) continue;
      const teile = k.split('{}').map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      out.push({ re: new RegExp('^' + teile.join('([^<>]*?)') + '$'), v, n: k.length });
    }
    out.sort((a, b) => b.n - a.n); // der längste (genaueste) zuerst
    return (MUSTER[LANG] = out);
  }
  function einsetzen(v, caps) {
    if (typeof v === 'function') return v(...caps);
    let i = 0;
    return v.replace(/\{(\d*)\}/g, (_, n) => { const c = n ? caps[+n - 1] : caps[i++]; return c == null ? '' : c; });
  }
  // Schlägt einen normalisierten Text nach; null = unbekannt.
  function nach(k, tief = 0) {
    if (!k) return null;
    const t = text();
    if (Object.prototype.hasOwnProperty.call(t, k)) return typeof t[k] === 'function' ? t[k]() : t[k];
    for (const m of muster()) {
      const r = m.re.exec(k);
      if (r) {
        const caps = r.slice(1).map(c => { if (tief > 2 || !/\p{L}{2}/u.test(c)) return c; const x = nach(c.trim(), tief + 1); return x == null ? c : c.replace(c.trim(), x); });
        return einsetzen(m.v, caps);
      }
    }
    return null;
  }
  // Dateinamen und Kennungen („Brief.pdf", „mistral-small-latest") sind keine Sätze.
  const keinSatz = k => !/\s/.test(k) && (/\.[a-z0-9]{2,5}$/i.test(k) || /^[a-z0-9]+(-[a-z0-9]+)+$/.test(k));
  // Zusammengesetzte Zeilen („2 von 2 Seiten · 0.1 s je Seite · Ergebnis 245 KB"): gibt es
  // die ganze Zeile nicht, wird Stück für Stück zwischen den „ · " nachgeschlagen.
  // Gibt { r, fehlt: [...] } zurück; r = null, wenn gar nichts übersetzt wurde.
  function nachZeile(k) {
    const r = nach(k);
    if (r != null) return { r, fehlt: [] };
    if (!k.includes(' · ')) return { r: null, fehlt: [k] };
    const fehlt = []; let eins = false;
    const teile = k.split(' · ').map(t => {
      const x = t.trim(); if (!/\p{L}{2}/u.test(x) || keinSatz(x)) return t;
      const y = nach(x); if (y == null) { fehlt.push(x); return t; } eins = true; return t.replace(x, y);
    });
    return { r: eins ? teile.join(' · ') : null, fehlt: eins ? fehlt : [k] };
  }
  function T(deutsch) {
    if (LANG === 'de') return deutsch;
    const k = norm(String(deutsch));
    if (!/\p{L}{2}/u.test(k) || keinSatz(k)) return deutsch;
    const z = nachZeile(k); z.fehlt.forEach(x => fehlt.add(x));
    return z.r == null ? deutsch : z.r;
  }

  /* ---------- DOM ---------- */
  const ORIG = new WeakMap();   // Textknoten → { o: deutsch, t: zuletzt gesetzt }
  const RICH = new WeakMap();   // Element → { html: Kinder (Klone) im Original, key, t: gesetzter Schlüssel }
  const ATT = new WeakMap();    // Element → { attr: { o, t } }
  let aus = false;              // eigene Änderungen nicht selbst wieder beobachten

  const geschuetzt = el => {
    for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
      if (e.hasAttribute('data-kein-ue') || e.id === 'wfp-chrome') return true;
    }
    return false;
  };

  // Skelett eines Elements aus Text und Inline-Auszeichnung; null = nicht geeignet.
  function skelett(el) {
    let s = '', inl = 0, ok = true;
    (function lauf(n) {
      for (const c of n.childNodes) {
        if (!ok) return;
        if (c.nodeType === 3) s += c.nodeValue;
        else if (c.nodeType === 1) {
          // Ein Name des Nutzers steht als <n>…</n> im Satz; der Wert schreibt <n>{1}</n>,
          // eingesetzt wird beim Aufbau der Original-Knoten (unübersetzt, samt Inhalt).
          if (c.tagName === 'SPAN' && c.hasAttribute('data-kein-ue')) { inl++; s += '<n>' + c.textContent + '</n>'; continue; }
          // Ein Kind mit Kennung oder data-Marke hält die App womöglich fest (querySelector
          // im onMount, VOR diesem Beobachter) — es auszutauschen hieße, ihr den Knoten zu nehmen.
          if (!INLINE.has(c.tagName) || c.id || [...c.attributes].some(a => a.name.startsWith('data-'))) { ok = false; return; }
          inl++;
          const t = c.tagName.toLowerCase();
          if (t === 'br') { s += '<br>'; continue; }
          s += '<' + t + '>'; lauf(c); s += '</' + t + '>';
        }
      }
    })(el);
    return ok && inl ? norm(s) : null;
  }
  // Baut den übersetzten Satz aus Text + den ORIGINAL-Elementen (Attribute bleiben, kein innerHTML).
  function aufbauen(el, wert, vorlage) {
    const pools = {};
    (function sammle(n) {
      for (const c of n.childNodes) if (c.nodeType === 1) {
        const t = c.tagName === 'SPAN' && c.hasAttribute('data-kein-ue') ? 'n' : c.tagName.toLowerCase();
        (pools[t] = pools[t] || []).push(c);
        if (t !== 'n') sammle(c);
      }
    })(vorlage);
    const frag = document.createDocumentFragment();
    const stapel = [frag];
    let imNamen = false;
    for (const tok of wert.split(/(<\/?[a-z]+>)/)) {
      if (!tok) continue;
      const m = /^<(\/?)([a-z]+)>$/.exec(tok);
      const oben = stapel[stapel.length - 1];
      if (imNamen) { if (m && m[1] && m[2] === 'n') imNamen = false; continue; }
      if (m && !m[1] && m[2] === 'n') { const p = (pools.n || []).shift(); if (p) oben.appendChild(p.cloneNode(true)); imNamen = true; continue; }
      if (!m) { oben.appendChild(document.createTextNode(tok)); continue; }
      if (m[1]) { if (stapel.length > 1) stapel.pop(); continue; }
      const p = (pools[m[2]] || []).shift();
      const neu = p ? p.cloneNode(false) : document.createElement(m[2]);
      oben.appendChild(neu);
      if (m[2] !== 'br') stapel.push(neu);
    }
    el.replaceChildren(frag);
  }

  function richElement(el) {
    let info = RICH.get(el);
    if (info) {
      // Hat die App das Element seitdem selbst neu gefüllt?
      const jetzt = skelett(el);
      if (jetzt !== info.t) info = null;
    }
    if (!info) {
      const k = skelett(el);
      if (!k || !/\p{L}{2}/u.test(k)) return false;
      // Auf Deutsch wird nichts neu als „Original" gemerkt: ein Element, das hier zum
      // ersten Mal als Satz auftaucht, kann noch Übersetztes der vorigen Sprache tragen
      // (seine Kinder waren einzeln übersetzt). Dann die Kinder einzeln zurückholen.
      if (LANG === 'de') return false;
      const vorlage = el.cloneNode(true);
      info = { key: k, vorlage, t: k };
      RICH.set(el, info);
    }
    if (LANG === 'de') {
      if (info.t !== info.key) { aufbauen(el, info.key, info.vorlage); info.t = info.key; }
      return true;
    }
    const r = nach(info.key);
    if (r == null) {
      fehltSatz.add(info.key);
      // Text-Ebene versucht es stückweise — vorher das Deutsche zurück, sonst stünde
      // die Übersetzung der vorigen Sprache in den Stücken.
      if (info.t !== info.key) { aufbauen(el, info.key, info.vorlage); info.t = info.key; }
      RICH.delete(el);
      return false;
    }
    if (info.t !== norm(r)) { aufbauen(el, r, info.vorlage); info.t = skelett(el) || norm(r); }
    return true;
  }

  function textKnoten(n) {
    let info = ORIG.get(n);
    if (!info || n.nodeValue !== info.t) { info = { o: n.nodeValue, t: n.nodeValue }; ORIG.set(n, info); }
    const k = norm(info.o);
    if (!/\p{L}{2}/u.test(k) || keinSatz(k)) return;
    let neu = info.o;
    if (LANG !== 'de') {
      const z = nachZeile(k); z.fehlt.forEach(x => fehlt.add(x));
      if (z.r != null) { const m = /^(\s*)[\s\S]*?(\s*)$/.exec(info.o); neu = m[1] + z.r + m[2]; }
    }
    if (n.nodeValue !== neu) n.nodeValue = neu;
    info.t = neu;
  }

  function attribute(el) {
    let m = ATT.get(el);
    if (!m) { m = {}; ATT.set(el, m); }
    for (const a of ATTR) {
      let cur = el.getAttribute(a);
      if (cur == null && a === 'title') cur = el.getAttribute('data-ue-title');
      if (cur == null) { delete m[a]; continue; }
      let i = m[a];
      if (!i || (cur !== i.t && cur !== i.o)) i = m[a] = { o: cur, t: cur };
      let neu = i.o;
      if (LANG !== 'de' && /\p{L}{2}/u.test(i.o)) { const z = nachZeile(norm(i.o)); z.fehlt.forEach(x => fehlt.add(x)); if (z.r != null) neu = z.r; }
      i.t = neu;
      if (a === 'title' && !TIPPS) {
        // Hinweise aus: Titel beiseitelegen, damit der Browser keinen Tooltip zeigt.
        el.setAttribute('data-ue-title', i.o);
        if (el.hasAttribute('title')) el.removeAttribute('title');
        continue;
      }
      if (a === 'title') el.removeAttribute('data-ue-title');
      if (el.getAttribute(a) !== neu) el.setAttribute(a, neu);
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { const p = root.parentElement; if (p && !SKIP.has(p.tagName) && !geschuetzt(p)) { if (!(p && RICH.has(p) && richElement(p))) textKnoten(root); } return; }
    if (root.nodeType !== 1 || SKIP.has(root.tagName) || geschuetzt(root)) return;
    const stapel = [root];
    while (stapel.length) {
      const el = stapel.pop();
      if (SKIP.has(el.tagName) || el.hasAttribute('data-kein-ue') || el.id === 'wfp-chrome') continue;
      attribute(el);
      if (richElement(el)) { for (const c of el.querySelectorAll('*')) attribute(c); continue; }
      for (const c of el.childNodes) {
        if (c.nodeType === 3) textKnoten(c);
        else if (c.nodeType === 1) stapel.push(c);
      }
    }
  }

  function anwenden() {
    const h = document.documentElement;
    const s = SPRACHEN.find(x => x.code === LANG);
    h.lang = LANG; h.dir = s.rtl ? 'rtl' : 'ltr';
    aus = true;
    try {
      walk(document.body);
      const ti = document.querySelector('title');
      if (ti) walk(ti.firstChild);
    } finally { aus = false; beob.takeRecords(); }
  }

  const beob = new MutationObserver(recs => {
    if (aus) return;
    aus = true;
    try {
      const gesehen = new Set();
      for (const r of recs) {
        const z = r.target;
        if (r.type === 'childList') {
          // Neu eingefügte Knoten; bei Satz-Elementen den ganzen Satz neu lesen.
          const p = r.target;
          if (p.nodeType === 1 && RICH.has(p)) { if (!gesehen.has(p)) { gesehen.add(p); walk(p); } continue; }
          for (const n of r.addedNodes) if (!gesehen.has(n)) { gesehen.add(n); walk(n); }
          continue;
        }
        if (r.type === 'characterData') {
          const p = z.parentElement;
          if (p && RICH.has(p)) { if (!gesehen.has(p)) { gesehen.add(p); walk(p); } }
          else walk(z);
          continue;
        }
        if (r.type === 'attributes' && z.nodeType === 1 && !geschuetzt(z)) attribute(z);
      }
    } finally { aus = false; beob.takeRecords(); }
  });

  function start() {
    anwenden();
    beob.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
  }
  function speichern() { try { localStorage.setItem(KEY, JSON.stringify({ lang: LANG, tipps: TIPPS })); } catch (_) {} }

  W.Sprache = {
    SPRACHEN, T, fehlt, fehltSatz,
    get lang() { return LANG; },
    get tipps() { return TIPPS; },
    setzen(code) { if (!SPRACHEN.some(s => s.code === code)) return; LANG = code; speichern(); anwenden(); document.dispatchEvent(new CustomEvent('wfp-sprache', { detail: code })); },
    tippsSetzen(an) { TIPPS = !!an; speichern(); anwenden(); },
    anwenden, start
  };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
