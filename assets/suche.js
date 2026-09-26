/* Workfloh PDF — Suche, Stufe 1 (Klaus 2026-09-26).
   „wenn ich einen Suchbegriff eingebe … eine Auftragsnummer oder eine Kundennummer oder einen
   Kundennamen … oder ein Datum mit Kundenname … soll die PDF gefunden werden, und der Text,
   worauf man schlussfolgert, dass das die richtige PDF ist, soll markiert werden."

   Stufe 1 ist eine WORT-Suche, ohne Modell und ohne Netz. Die Bedeutungssuche (Modul 03/04
   aus Sage) kommt als Stufe 2 dazu. Diese Datei trägt nur die Rechnung — keine Oberfläche,
   kein Speicher —, damit sie in Node geprüft und später in die WorkFlohs kopiert werden kann.

   Vergleichen wird in einer angeglichenen Form auf beiden Seiten:
   · klein, Umlaute gefaltet (ä, ae → a · ö, oe → o · ü, ue → u · ß → ss), Akzente weg
   · ohne Leerzeichen und Satzzeichen („KD-4711" = „kd 4711" = „KD4711")
   · Daten zusätzlich als JJJJMMTT („26.9.2026" = „2026-09-26"); ein Datum ohne Jahr
     („26.09.") passt auf jedes Jahr.
   Jedes Suchwort muss irgendwo im Dokument stehen (Name, Feld oder Seitentext). */
(function () {
  'use strict';

  function falte(s) {
    return String(s == null ? '' : s).toLowerCase()
      .replace(/ß/g, 'ss').replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u');
  }
  // Nur Buchstaben und Ziffern jeder Schrift bleiben (Kyrillisch, Arabisch eingeschlossen).
  const kompakt = s => falte(s).replace(/[^\p{L}\p{N}]+/gu, '');

  const zwei = n => String(n).padStart(2, '0');
  const jahr = j => (String(j).length === 2 ? '20' + j : String(j));
  const gueltig = (t, m) => t >= 1 && t <= 31 && m >= 1 && m <= 12;
  // Alle Daten eines Textes als JJJJMMTT.
  function daten(text) {
    const out = [], s = String(text || '');
    let m;
    const r1 = /(?<!\d)(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4}|\d{2})(?!\d)/g;
    while ((m = r1.exec(s))) if (gueltig(+m[1], +m[2])) out.push(jahr(m[3]) + zwei(m[2]) + zwei(m[1]));
    const r2 = /(?<!\d)(\d{4})-(\d{1,2})-(\d{1,2})(?!\d)/g;
    while ((m = r2.exec(s))) if (gueltig(+m[3], +m[2])) out.push(m[1] + zwei(m[2]) + zwei(m[3]));
    return out;
  }
  // Ein Suchwort, das ein Datum ist: ganz (JJJJMMTT) oder ohne Jahr (MMTT).
  function datumVonWort(w) {
    let m = /^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})$/.exec(w);
    if (m && gueltig(+m[1], +m[2])) return { ganz: jahr(m[3]) + zwei(m[2]) + zwei(m[1]) };
    m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(w);
    if (m && gueltig(+m[3], +m[2])) return { ganz: m[1] + zwei(m[2]) + zwei(m[3]) };
    m = /^(\d{1,2})\.(\d{1,2})\.?$/.exec(w);
    if (m && gueltig(+m[1], +m[2])) return { ohneJahr: zwei(m[2]) + zwei(m[1]) };
    return null;
  }

  function anfrage(q) {
    return String(q || '').trim().split(/\s+/).filter(Boolean)
      .map(roh => ({ roh, k: kompakt(roh), datum: datumVonWort(roh) }))
      .filter(t => t.k || t.datum);
  }
  // Ein Text, einmal für viele Suchen vorbereitet.
  const bereite = text => ({ k: kompakt(text), d: daten(text) });
  function trifft(tok, b) {
    if (tok.datum) {
      if (tok.datum.ganz && b.d.includes(tok.datum.ganz)) return true;
      if (tok.datum.ohneJahr && b.d.some(x => x.slice(4) === tok.datum.ohneJahr)) return true;
    }
    return !!tok.k && b.k.includes(tok.k);
  }

  /* Seitentext: je Seite eine Liste [text, x, y, w, h] in Prozent der angezeigten Seite.
     vorbereiten() rechnet die Vergleichsformen einmal — nicht bei jedem Tastendruck. */
  function vorbereiten(seiten) {
    return (seiten || []).map(items => {
      const it = (items || []).map(a => ({ s: a[0], x: a[1], y: a[2], w: a[3], h: a[4], b: bereite(a[0]) }));
      return { it, b: bereite(it.map(a => a.s).join(' ')) };
    });
  }

  const kurz = (s, n) => { s = String(s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
  const huelle = boxen => {
    const x0 = Math.min(...boxen.map(b => b.x)), y0 = Math.min(...boxen.map(b => b.y));
    return { x: x0, y: y0, w: Math.max(...boxen.map(b => b.x + b.w)) - x0, h: Math.max(...boxen.map(b => b.y + b.h)) - y0 };
  };

  // Wo steht das Wort auf der Seite? Erst einzelne Textstücke, sonst zwei, drei hintereinander
  // (ein Wort kann über zwei Stücke laufen, „KD-" | „4711").
  function stellen(tok, seite) {
    const out = [], it = seite.it;
    for (let i = 0; i < it.length; i++) if (trifft(tok, it[i].b)) out.push({ von: i, bis: i });
    if (out.length) return out;
    for (let n = 2; n <= 3 && !out.length; n++) for (let i = 0; i + n <= it.length; i++) {
      const teil = it.slice(i, i + n);
      if (trifft(tok, bereite(teil.map(a => a.s).join('')))) out.push({ von: i, bis: i + n - 1 });
    }
    return out;
  }

  /* Ein Dokument durchsuchen.
     doc: { name, ordner?, fields: [{ id, label, value, page, x, y, w, h }] }
     seiten: vorbereitet (siehe oben) oder null, wenn der Seitentext noch fehlt.
     Rückgabe: null (passt nicht) oder { punkte, funde: [...], treffer }.
       fund: { art: 'name'|'ordner'|'feld'|'seite', wort, page, feldId, label, text, boxen: [{x,y,w,h}] } */
  function sucheDok(doc, seiten, toks) {
    if (!toks.length) return null;
    const funde = []; let punkte = 0;
    const felder = (doc.fields || []).filter(f => typeof f.value === 'string' && f.value && !/^data:/.test(f.value));
    for (const tok of toks) {
      let hier = 0;
      if (trifft(tok, bereite(doc.name))) { hier++; punkte += 3; funde.push({ art: 'name', wort: tok.roh, text: kurz(doc.name, 90) }); }
      // der Ordner, in dem es liegt („Betriebsanleitungen" findet alles darin)
      if (doc.ordner && trifft(tok, bereite(doc.ordner))) { hier++; punkte += 1; funde.push({ art: 'ordner', wort: tok.roh, text: kurz(doc.ordner, 90) }); }
      for (const f of felder) if (trifft(tok, bereite(f.value))) {
        hier++; punkte += 2;
        funde.push({ art: 'feld', wort: tok.roh, feldId: f.id, label: f.label || '', page: f.page, text: kurz(f.value, 90), boxen: [{ x: f.x, y: f.y, w: f.w, h: f.h }] });
      }
      (seiten || []).forEach((seite, p) => {
        if (!trifft(tok, seite.b)) return;
        const st = stellen(tok, seite);
        hier++; punkte += 1;
        const um = st[0] ? seite.it.slice(Math.max(0, st[0].von - 3), st[0].bis + 4).map(a => a.s).join(' ') : '';
        funde.push({ art: 'seite', wort: tok.roh, page: p, text: kurz(um, 110), anzahl: st.length || 1,
          boxen: st.slice(0, 30).map(s => huelle(seite.it.slice(s.von, s.bis + 1))) });
      });
      if (!hier) return null;   // jedes Wort muss irgendwo stehen
    }
    // Trefferzahl: jede Fundstelle zählt, auf einer Seite jede Stelle einzeln (Klaus 2026-09-26:
    // „mit kleinen Zahlen, dass man sieht, die Trefferquote bei dem ist viel höher als bei dem")
    const treffer = funde.reduce((n, f) => n + (f.anzahl || 1), 0);
    return { punkte, funde, treffer };
  }

  const API = { falte, kompakt, daten, datumVonWort, anfrage, bereite, trifft, vorbereiten, sucheDok };
  if (typeof window !== 'undefined') { window.WFP = window.WFP || {}; window.WFP.Suche = API; }
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof globalThis !== 'undefined') globalThis.__WFP_SUCHE = API;
})();
