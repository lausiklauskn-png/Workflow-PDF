/* Workfloh PDF — Briefkopf in der Bibliothek (Pro-Umbau 14 D, Klaus 2026-10-31). Klebstoff zwischen app.js und dem
   reinen Baustein assets/briefkopf.js: lesen nach dem Seitentext, am Dokument merken (d.briefkopf, liegt in IndexedDB
   wie jedes Dokument), Zeile an der Karte, Thema als Filter, von Hand ändern. Nähte über init() aus app.js.
   Von Hand geändert (d.briefkopf.hand) wird nie wieder überschrieben; „Neu lesen“ nimmt die Hand-Angaben bewusst zurück. */
(function () {
  'use strict';
  const BK = () => window.WFP && WFP.Briefkopf;
  let N = null;   // { S, DB, dialog, toast, neu, texteNachholen }
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tag = iso => iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4) : '';
  const STUFEN = ['normal', 'Zahlungsziel', 'Frist oder Mahnung', 'Letzte Mahnung oder Kündigung'];
  const kdnr = k => { const n = ((k && k.nummern) || []).find(x => x.art === 'kundennummer'); return n ? n.wert : ''; };

  function init(naehte) { N = naehte; }

  /** Nach dem Seitentext: Briefkopf lesen und merken (nicht, wenn von Hand geändert). true = geändert. */
  async function setzen(id, seiten) {
    if (!N || !BK()) return false;
    // Beim Einlesen steht das Dokument noch nicht in S.docs: dann aus der Datenbank (die Liste lädt danach neu)
    let d = N.S.docs.find(x => x.id === id);
    if (!d) { try { d = await N.DB.get('docs', id); } catch (_) { d = null; } }
    if (!d || (d.briefkopf && d.briefkopf.hand)) return false;
    let k; try { k = BK().lesen(BK().zeilenAusSeiten(seiten)); } catch (_) { return false; }
    const neu = Object.assign({}, k, { aus: 'seitentext' });
    if (d.briefkopf && JSON.stringify(Object.assign({}, d.briefkopf, { am: 0 })) === JSON.stringify(Object.assign({}, neu, { am: 0 }))) return false;
    neu.am = new Date().toISOString();
    d.briefkopf = neu;
    try { await N.DB.put('docs', d); } catch (_) { return false; }
    return true;
  }

  /** Für die Sortierung: Dokumente ohne Briefkopf aus dem gemerkten Seitentext nachziehen (Texte sonst erst lesen). */
  let _laeuft = null; const _versucht = new Set();
  function nachholen() {
    if (_laeuft || !N) return _laeuft;
    // Jedes Dokument nur einmal je Sitzung versuchen (ohne Datei oder ohne Text bleibt es leer, ohne bei jedem Zeichnen neu zu lesen)
    const offen = N.S.docs.filter(d => !d.briefkopf && !_versucht.has(d.id)); if (!offen.length) return null;
    offen.forEach(d => _versucht.add(d.id));
    _laeuft = (async () => {
      let geaendert = false;
      try {
        for (const r of await N.DB.all('texte')) {
          const d = N.S.docs.find(x => x.id === r.id);
          if (d && !d.briefkopf && await setzen(r.id, r.seiten)) geaendert = true;
        }
      } catch (_) {}
      // Dokumente ganz ohne gemerkten Seitentext liest die App nach (setzt dabei den Briefkopf über textAblegen).
      if (N.S.docs.some(d => !d.briefkopf) && N.texteNachholen) { try { await N.texteNachholen(); } catch (_) {} }
      if (geaendert) N.neu();
    })().finally(() => { _laeuft = null; });
    return _laeuft;
  }

  /** Zeile an der Karte. */
  function meta(d) {
    const k = d.briefkopf; if (!k) return '<div class="dok-meta dok-brief" data-briefkopf="leer">Briefkopf noch nicht gelesen</div>';
    const teile = [];
    if (k.datum) teile.push(tag(k.datum.wert)); else teile.push('ohne Briefdatum');
    if (k.absender) teile.push(h(k.absender.wert));
    if (kdnr(k)) teile.push('Kd ' + h(kdnr(k)));
    if (k.thema) teile.push(h(k.thema.wert));
    const w = k.wichtigkeit && k.wichtigkeit.stufe || 0;
    return `<div class="dok-meta dok-brief" data-briefkopf="${k.hand ? 'hand' : 'gelesen'}"${w ? ` data-wichtig="${w}"` : ''}>`
      + `<button class="link-knopf" data-briefkopf-aendern data-kein-ue title="Briefkopf ansehen und ändern">${teile.join(' · ')}${w >= 2 ? ' · <b>' + h(STUFEN[w]) + '</b>' : ''}</button></div>`;
  }

  const themen = docs => [...new Set((docs || []).map(d => d.briefkopf && d.briefkopf.thema && d.briefkopf.thema.wert).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'));
  const passtThema = (d, thema) => !thema || (thema === '-' ? !(d.briefkopf && d.briefkopf.thema) : !!(d.briefkopf && d.briefkopf.thema && d.briefkopf.thema.wert === thema));

  /** Ansehen und von Hand ändern. */
  function aendern(d) {
    if (!N || !BK()) return;
    const k = d.briefkopf || {};
    const fund = x => x && x.fund ? `<span class="hinweis klein" data-kein-ue>${h(x.fund)}</span>` : '';
    const themenListe = BK().THEMEN_PRIVAT.map(t => t[0]);
    const html = `<h2>Briefkopf</h2>
      <p class="hinweis">${k.hand ? 'Von Hand geändert.' : k.aus ? 'Gelesen aus dem Seitentext. Unsicheres bleibt leer.' : 'Noch nicht gelesen.'}</p>
      <label>Briefdatum <input type="date" data-bk="datum" value="${h(k.datum && k.datum.wert || '')}"></label>${fund(k.datum)}
      <label>Absender <input type="text" data-bk="absender" value="${h(k.absender && k.absender.wert || '')}"></label>${fund(k.absender)}
      <label>Empfänger <input type="text" data-bk="empfaenger" value="${h(k.empfaenger && k.empfaenger.wert || '')}"></label>${fund(k.empfaenger)}
      <label>Kundennummer <input type="text" data-bk="kundennummer" value="${h(kdnr(k))}"></label>
      <label>Betreff <input type="text" data-bk="betreff" value="${h(k.betreff && k.betreff.wert || '')}"></label>
      <label>Thema <select data-bk="thema" data-kein-ue><option value="">ohne Thema</option>${themenListe.map(t => `<option value="${h(t)}"${k.thema && k.thema.wert === t ? ' selected' : ''}>${h(t)}</option>`).join('')}</select></label>
      <label>Wichtigkeit <select data-bk="wichtigkeit">${STUFEN.map((s, i) => `<option value="${i}"${(k.wichtigkeit && k.wichtigkeit.stufe || 0) === i ? ' selected' : ''}>${h(s)}</option>`).join('')}</select></label>
      <div class="knopfreihe"><button class="knopf" data-bk-neu>Neu lesen</button><button class="knopf" data-x>Abbrechen</button><button class="knopf rot" data-bk-speichern>Speichern</button></div>`;
    N.dialog(html, (box, zu) => {
    const xb = box.querySelector('[data-x]'); if (xb) xb.onclick = zu;
    const wert = n => (box.querySelector(`[data-bk="${n}"]`) || {}).value || '';
    const mit = (alt, w) => w ? Object.assign({}, alt || {}, { wert: w }) : null;
    box.querySelector('[data-bk-speichern]').onclick = async () => {
      const nummern = (k.nummern || []).filter(n => n.art !== 'kundennummer');
      if (wert('kundennummer').trim()) nummern.unshift({ art: 'kundennummer', wert: wert('kundennummer').trim(), fund: 'von Hand' });
      d.briefkopf = Object.assign({}, k, {
        v: 1, hand: true, am: new Date().toISOString(),
        datum: mit(k.datum, wert('datum')), absender: mit(k.absender, wert('absender').trim()), empfaenger: mit(k.empfaenger, wert('empfaenger').trim()),
        betreff: mit(k.betreff, wert('betreff').trim()), thema: mit(k.thema, wert('thema')), nummern,
        wichtigkeit: Object.assign({}, k.wichtigkeit || {}, { stufe: +wert('wichtigkeit') || 0 }),
      });
      try { await N.DB.put('docs', d); } catch (_) {}
      zu(); N.neu(); N.toast('Briefkopf gespeichert');
    };
    box.querySelector('[data-bk-neu]').onclick = async () => {
      // Hand-Angaben bewusst zurücknehmen und aus dem gemerkten Seitentext neu lesen
      delete d.briefkopf; let r = null;
      try { r = await N.DB.get('texte', d.id); } catch (_) {}
      if (r && r.seiten) await setzen(d.id, r.seiten); else { try { await N.DB.put('docs', d); } catch (_) {} if (N.texteNachholen) N.texteNachholen(); }
      zu(); N.neu(); aendern(d);
    };
    });
  }

  /** Im Editor: ein flacher Knopf mit Briefdatum und Absender neben dem Prüfstand. */
  function editor(d) {
    const el = document.getElementById('edBrief'); if (!el) return;
    const k = d && d.briefkopf;
    el.hidden = !d;
    el.textContent = k ? [k.datum ? tag(k.datum.wert) : 'ohne Briefdatum', k.absender ? k.absender.wert : ''].filter(Boolean).join(' · ') : 'Briefkopf';
    el.title = 'Briefkopf ansehen und ändern';
    el.onclick = () => aendern(d);
  }

  const API = { init, setzen, nachholen, meta, themen, passtThema, aendern, editor };
  window.WFP = window.WFP || {}; window.WFP.BriefkopfAnsicht = API;
})();
