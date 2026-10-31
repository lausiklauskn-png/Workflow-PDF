/* Workfloh PDF — „Im Netz antworten“ (Klaus 2026-10-31, Punkt 5 seiner Antworten: die PWA antwortet im SBKIM-Netz wie Workflow PDF Pro).
   Vorlage: Workflow-PDF-Pro native/native-netz.js (Pro-Umbau 14 A3); Regeln wie BookLedgerPro src/sbkim/netz.js + src/domain/ueberall.js.
   Andere Arbeitsplätze im Mycel (Modul 23, byte-1:1 aus Sage) dürfen fragen; Workfloh PDF antwortet — ab Werk AUS — mit:
     • öffentlich: nur dem Dateinamen. Verglichen wird auch nur mit ihm — die Trefferauswahl verrät nichts über den Inhalt.
     • im eigenen Netz (Netz-Box im Mycel-Fenster, Modul 23 _meta.network === 'eigen') und nur mit dem Schalter „Mit Ausschnitt“:
       verglichen wird der Seitentext in Abschnitten (Anfang und immer die letzten drei = Briefende, ≤ 60 je Dokument), eine Zeile
       je Dokument, dazu ein Ausschnitt um die Suchwörter (≤ 200 Zeichen). Die Vektoren stammen aus der Suche nach Bedeutung
       (Fach „vektoren“, dasselbe Modell wie Modul 03); nichts wird neu gerechnet.
   Der Korpus ist eine Funktion (Modul 04 setLocalCorpus(function)), gesetzt NACH enableAnswering: jede Frage liest den aktuellen Stand.
   Der Antwort-Filter prüft bei JEDER Frage neu, ob ein eigenes Netz steht; sonst antwortet er mit Ausschnitt-Korpus gar nicht.
   Gelesen wird über die Datenbank der App (WFP.DB, db.js); fehlt sie, nur lesend und OHNE Versionsangabe (Lehre V3 #34). */
(() => {
  'use strict';
  if (window.WFPNetz) return;
  const DB_NAME = 'WorkflohPDF1';
  const JE_DOK = 60, GESAMT = 4000, ENDE = 3, DOKS_MAX = 300, LABEL_MAX = 200;
  const SPEICHER = 'wfpdf_netz_v1';   // nur: an/aus und mit Ausschnitt (nie Inhalt)
  const W = window;
  const rdv = () => W.SbkimRendezvous || null;
  const eigen = () => { const r = rdv(); try { return !!(r && r._meta && r._meta.network === 'eigen'); } catch { return false; } };
  const txt = v => (v === undefined || v === null ? '' : String(v));

  // ---------- reine Logik (ohne DOM, ohne Datenbank; in tests/netz.mjs geprüft) ----------
  /** Höchstens `max` Abschnitte: die ersten und immer die letzten ENDE (Briefende). */
  function abschnitteWaehlen(a, max = JE_DOK) {
    a = Array.isArray(a) ? a : [];
    if (max <= 0) return [];
    if (a.length <= max) return a.slice();
    const e = Math.min(ENDE, max);
    return [...a.slice(0, max - e), ...a.slice(a.length - e)];
  }
  const titel = d => txt(d && d.name).replace(/\.[a-z0-9]{2,5}$/i, '').slice(0, 150) || 'Dokument';
  const label = d => 'Dokument · ' + titel(d);
  const fold = s => txt(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss');
  const woerter = frage => fold(frage).split(/[^\p{L}\p{N}]+/u).filter(w => w.length >= 3);
  /** Ausschnitt um das erste Suchwort, höchstens `max` Zeichen. */
  function ausschnitt(text, frage, max) {
    const t = txt(text).replace(/\s+/g, ' ').trim();
    if (!t) return '';
    const f = fold(t); let pos = -1;
    for (const w of woerter(frage)) { const i = f.indexOf(w); if (i >= 0 && (pos < 0 || i < pos)) pos = i; }
    const start = Math.max(0, (pos < 0 ? 0 : pos) - Math.floor(max / 3));
    let s = t.slice(start, start + max);
    if (start > 0) s = '…' + s.slice(1);
    if (start + max < t.length) s = s.slice(0, -1) + '…';
    return s;
  }
  function ausschnittLabel(l, text, frage, max = LABEL_MAX) {
    l = txt(l).slice(0, max);
    const rest = max - l.length - 3;
    if (!txt(text).trim() || rest < 40) return l;
    const a = ausschnitt(text, frage, rest);
    return a ? (l + ' — ' + a).slice(0, max) : l;
  }
  const vek = v => (v instanceof Float32Array ? v : (v && typeof v.length === 'number' ? Float32Array.from(v) : null));
  /**
   * Korpus mit Ausschnitt aus Dokumenten und gespeicherten Abschnitten.
   * @param {object[]} docs  Einträge des Fachs „docs“ ({id,name,createdAt})
   * @param {Map<string,{page,text,v}[]>} stuecke  Abschnitte je Dokument (lückenlos aus „vektoren“)
   * @returns {{eintraege:object[], texte:Map<string,string>}}
   */
  function korpusMitAusschnitt(docs, stuecke) {
    const aus = [], texte = new Map();
    let budget = GESAMT;
    const sortiert = (docs || []).filter(d => d && d.id).slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)).slice(0, DOKS_MAX);
    for (const d of sortiert) {
      if (budget <= 0) break;
      const st = (stuecke.get(d.id) || []).filter(x => x && x.text && vek(x.v));
      if (!st.length) continue;
      const teile = abschnitteWaehlen(st, Math.max(1, Math.min(JE_DOK, budget)));
      const anchorId = 'dok:' + d.id, l = label(d);
      texte.set(d.id, st.map(x => x.text).join(' '));
      for (const x of teile) aus.push({ label: l, text: l + ' · ' + x.text, anchorId, passageVec: vek(x.v) });
      budget -= teile.length;
    }
    return { eintraege: aus, texte };
  }
  /** Öffentlicher Korpus: nur Dateinamen (Vektor aus Modul 03, nur aus dem Namen; gemerkt je Name). */
  async function korpusOeffentlich(docs, embed, cache) {
    const aus = [];
    const sortiert = (docs || []).filter(d => d && d.id).slice().sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0)).slice(0, DOKS_MAX);
    for (const d of sortiert) {
      const l = label(d);
      let v = cache.get(l);
      if (!v) { v = vek(await embed(l)); if (!v) continue; cache.set(l, v); }
      aus.push({ label: l, text: l, anchorId: 'dok:' + d.id, passageVec: v });
    }
    return aus;
  }
  /** Antwort-Filter für Modul 23 (configure({match})): außerhalb eines eigenen Netzes nichts, sonst je Dokument ein Treffer mit Ausschnitt. */
  function antwortFilter(echt, { istEigen, texte }) {
    const f = Object.create(echt || null);
    f.queryLocal = async (frage, k, opts) => {
      if (typeof istEigen !== 'function' || !istEigen()) return [];
      const kk = Number.isInteger(k) && k > 0 ? k : 5;
      const hits = await echt.queryLocal(frage, kk * 4, opts);
      const gesehen = new Set();
      return (Array.isArray(hits) ? hits : []).filter(h => {
        const a = txt(h && h.anchorId); if (!a) return true;
        if (gesehen.has(a)) return false; gesehen.add(a); return true;
      }).slice(0, kk).map(h => {
        const id = txt(h && h.anchorId).startsWith('dok:') ? txt(h.anchorId).slice(4) : '';
        const t = id ? texte().get(id) : '';
        return { ...h, label: ausschnittLabel(h && h.label, t, frage) };
      });
    };
    f.__wfpAusschnitt = true;
    return f;
  }

  /** Abschnitte je Dokument aus dem Fach „vektoren“ (Kopf id + Blöcke id#00000 …), nur lückenlos wie der Kern. */
  function stueckeAus(roh) {
    const koepfe = new Map(), bloecke = new Map();
    for (const r of roh) {
      const i = txt(r.id).indexOf('#');
      if (i < 0) koepfe.set(r.id, r);
      else { const id = r.id.slice(0, i); if (!bloecke.has(id)) bloecke.set(id, new Map()); bloecke.get(id).set(+r.id.slice(i + 1), r.st || []); }
    }
    const stuecke = new Map();
    for (const [id, k] of koepfe) {
      if (!k.sig || !k.n) continue;
      const st = [], bs = bloecke.get(id) || new Map();
      for (let b = 0; bs.has(b); b++) st.push(...bs.get(b));   // nur lückenlos, wie der Kern
      if (st.length) stuecke.set(id, st.slice(0, k.n));
    }
    return stuecke;
  }

  // ---------- Datenbank: nur lesen ----------
  async function lesen() {
    const A = W.WFP && W.WFP.DB;
    if (A && typeof A.all === 'function') {   // die Datenbank der App selbst (db.js, eigene Version) — nur lesende Aufrufe
      let docs = [], roh = [];
      try { docs = await A.all('docs'); } catch { /* fail-soft */ }
      try { roh = await A.all('vektoren'); } catch { /* fail-soft */ }
      return { docs: docs || [], stuecke: stueckeAus(roh || []) };
    }
    if (!W.indexedDB) return { docs: [], stuecke: new Map() };
    try { if (typeof indexedDB.databases === 'function' && !(await indexedDB.databases()).some(x => x.name === DB_NAME)) return { docs: [], stuecke: new Map() }; } catch { /* weiter */ }
    const db = await new Promise((ok, no) => {
      const r = indexedDB.open(DB_NAME);   // ohne Version: nie ein Versionssprung von hier (Lehre V3 #34)
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch { /* nicht anlegen */ } };
      r.onsuccess = () => { const d = r.result; d.onversionchange = () => d.close(); ok(d); };
      r.onerror = () => no(r.error);
    });
    try {
      const alle = name => new Promise(ok => {
        if (!db.objectStoreNames.contains(name)) return ok([]);
        const q = db.transaction(name).objectStore(name).getAll(); q.onsuccess = () => ok(q.result || []); q.onerror = () => ok([]);
      });
      const docs = await alle('docs'), roh = await alle('vektoren');
      const stuecke = stueckeAus(roh);
      return { docs, stuecke };
    } finally { try { db.close(); } catch { /* fail-soft */ } }
  }

  // ---------- Antworten an/aus ----------
  let lauf = { an: false, mitAusschnitt: false, anzahl: 0 };
  let texteLive = new Map();
  const namenCache = new Map();
  const embed = () => W.SbkimEmbedding;

  /** Baut den Korpus für die aktuelle Lage; Modul 04 ruft ihn bei jeder Frage neu (setLocalCorpus(function)). */
  async function korpus() {
    const { docs, stuecke } = await lesen();
    if (lauf.mitAusschnitt) {
      const k = korpusMitAusschnitt(docs, stuecke);
      texteLive = k.texte; lauf.anzahl = new Set(k.eintraege.map(e => e.anchorId)).size;
      return k.eintraege;
    }
    const e = embed();
    const k = await korpusOeffentlich(docs, t => e.embedPassage(t), namenCache);
    lauf.anzahl = k.length;
    return k;
  }

  async function an({ mitAusschnitt = false } = {}) {
    const r = rdv(), m = W.SbkimMatch, e = embed();
    if (!r || typeof r.enableAnswering !== 'function') return { ok: false, grund: 'Das Mycel ist noch nicht geladen.' };
    if (!m || typeof m.setLocalCorpus !== 'function' || typeof m.queryLocal !== 'function') return { ok: false, grund: 'Modul 04 (Treffer) ist nicht geladen.' };
    if (!e || typeof e.embedPassage !== 'function' || typeof e.embedQuery !== 'function')
      return { ok: false, grund: 'Erst in der Bibliothek die Suche nach Bedeutung einschalten (Sprachmodell laden). Ohne Modell kann diese App keine Fragen vergleichen.' };
    if (mitAusschnitt && !eigen()) return { ok: false, grund: 'Mit Ausschnitt nur im eigenen Netz (Netz-Box im Mycel-Fenster).' };
    if (lauf.an) aus();
    lauf = { an: false, mitAusschnitt: !!mitAusschnitt, anzahl: 0 };
    try {
      if (typeof e.init === 'function') await e.init();
      await korpus();   // einmal vorab: Fehler früh melden, Namen eingebettet
      r.configure({ prepareCorpus: korpus, match: mitAusschnitt ? antwortFilter(m, { istEigen: eigen, texte: () => texteLive }) : null });
      const ann = typeof r.connectAndAnnounce === 'function' ? await r.connectAndAnnounce({}).catch(x => ({ ok: false, reason: String((x && x.message) || x) })) : { ok: true };
      if (ann && ann.ok === false) { aus(); return { ok: false, grund: ann.reason || 'Anmelden im Netz fehlgeschlagen.' }; }
      const res = await r.enableAnswering({}).catch(x => ({ ok: false, reason: String((x && x.message) || x) }));
      lauf.an = !!(res && res.ok);
      if (!lauf.an) { aus(); return { ok: false, grund: (res && res.reason) || 'Antworten ließ sich nicht einschalten.' }; }
      // Erst NACH enableAnswering: Modul 23 legt dort einmal eine feste Liste aus prepareCorpus ab (ensureAnswerCorpus). Die Funktion
      // ersetzt sie, damit jede Frage den aktuellen Stand liest (neue Dokumente ohne Aus/An).
      m.setLocalCorpus(korpus);
      return { ok: true, anzahl: lauf.anzahl, mitAusschnitt: lauf.mitAusschnitt };
    } catch (x) { aus(); return { ok: false, grund: String((x && x.message) || x) }; }
  }
  function aus() {
    const r = rdv(), m = W.SbkimMatch;
    lauf.an = false; lauf.mitAusschnitt = false; texteLive = new Map();
    try { if (r && typeof r.disableAnswering === 'function') r.disableAnswering(); } catch { /* fail-soft */ }
    try { if (r && typeof r.configure === 'function') r.configure({ prepareCorpus: null, match: null }); } catch { /* fail-soft */ }
    try { if (m && typeof m.setLocalCorpus === 'function') m.setLocalCorpus(null); } catch { /* fail-soft */ }
    return { ok: true };
  }
  const stand = () => ({ an: lauf.an, mitAusschnitt: lauf.mitAusschnitt, anzahl: lauf.anzahl, eigen: eigen() });

  // ---------- Abschnitt in ⚙️ Einstellungen (app.js ruft abschnittHtml() und binden(dialog)) ----------
  const merken = v => { try { localStorage.setItem(SPEICHER, JSON.stringify(v)); } catch { /* fail-soft */ } };
  const gemerkt = () => { try { return JSON.parse(localStorage.getItem(SPEICHER) || '{}') || {}; } catch { return {}; } };
  const modellDa = () => { const e = embed(); return !!(e && typeof e.embedPassage === 'function'); };
  function abschnittHtml() {
    return '<section data-netz-antworten>'
      + '<h3 style="margin:14px 0 0;font-size:1rem">Im Netz antworten</h3>'
      + '<p class="hinweis">Andere Arbeitsplätze im Mycel dürfen fragen. Öffentlich antwortet Workfloh PDF nur mit dem Dateinamen und vergleicht auch nur mit ihm. Im eigenen Netz kann es auf Wunsch den Seitentext mitvergleichen und einen kurzen Ausschnitt zeigen. Die Dateien selbst gehen nie hinaus.</p>'
      + '<p class="hinweis" data-netz-stand></p>'
      + '<p class="hinweis" data-netz-lage></p>'
      + '<label style="font-weight:400"><input type="checkbox" data-netz-an> Anderen antworten</label>'
      + '<label style="font-weight:400"><input type="checkbox" data-netz-ausschnitt> Mit Ausschnitt antworten (nur im eigenen Netz)</label>'
      + '<p class="hinweis" data-netz-meldung role="status"></p>'
      + '</section>';
  }
  function binden(d) {
    const q = s => d.querySelector(s);
    const box = q('[data-netz-antworten]'); if (!box) return;
    const c1 = q('[data-netz-an]'), c2 = q('[data-netz-ausschnitt]'), meldung = q('[data-netz-meldung]');
    const zeichnen = () => {
      const s = stand();
      c1.checked = s.an; c2.checked = s.an && s.mitAusschnitt; c2.disabled = !s.eigen;
      q('[data-netz-stand]').textContent = s.an ? ('● Antwortet ' + (s.mitAusschnitt ? 'mit Ausschnitt' : 'mit Dateinamen') + ' · ' + s.anzahl + ' Dokument(e)') : '○ Antwortet nicht';
      q('[data-netz-lage]').textContent = (s.eigen ? 'Netz: eigenes Netz.' : 'Netz: öffentlich.') + (modellDa() ? '' : ' Braucht die Suche nach Bedeutung (Sprachmodell).');
      box.dataset.netzZustand = s.an ? (s.mitAusschnitt ? 'ausschnitt' : 'namen') : 'aus';
    };
    const schalten = async () => {
      meldung.textContent = '';
      if (!c1.checked) { aus(); merken({ an: false }); zeichnen(); return; }
      c1.disabled = true;
      const r = await an({ mitAusschnitt: c2.checked });
      c1.disabled = false;
      if (!r.ok) { meldung.textContent = r.grund; merken({ an: false }); }
      else merken({ an: true, mitAusschnitt: r.mitAusschnitt });
      zeichnen();
    };
    c1.addEventListener('change', schalten);
    c2.addEventListener('change', () => { if (c1.checked) schalten(); });
    zeichnen();
  }

  // Gemerkt „an“: nach dem Start wieder einschalten, sobald Mycel und Modell da sind (das Modell lädt nur die App, nie diese Datei).
  let versuche = 0;
  const wieder = () => {
    const g = gemerkt();
    if (!g.an || lauf.an || versuche++ > 40) return;
    if (rdv() && W.SbkimMatch && modellDa()) { an({ mitAusschnitt: !!g.mitAusschnitt }); return; }
    setTimeout(wieder, 3000);
  };
  addEventListener('load', () => setTimeout(wieder, 2000));

  W.WFPNetz = Object.freeze({ abschnitteWaehlen, ausschnittLabel, korpusMitAusschnitt, korpusOeffentlich, antwortFilter, stueckeAus, lesen, an, aus, stand,
    abschnittHtml, binden, JE_DOK, GESAMT, ENDE, LABEL_MAX });
})();
