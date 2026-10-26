/* Workfloh PDF — Bildbeschreibung (Klaus, Sitzung 4, 2026-10-26; Sammlung Punkte 12–14).
   „Bilder verstehen läuft überall" · „je Bild ein kurzes Feld Bildbeschreibung: eigene Worte tippen oder
   diktieren, getrennt von der Beschreibung des Modells, beide werden gesucht" · „ein kurzer Schalter
   Bildbeschreibung in der Suche".

   Drei Dinge, dieselben wie in Private Brain Pro und V3 (gemeinsamer Webteil, nur die Anbindung ist hier die
   der PWA):
   1 · Das MODELL (vit-gpt2-image-captioning, transformers.js 2.17.2) kommt erst auf Knopfdruck aus dem Netz,
       mit Ladebalken, und liegt danach im Vorrat dieses Browsers („transformers-cache"). Es beschreibt jedes
       Foto in der Bibliothek einmal auf dem Gerät — nichts geht hinaus. Gemessen (GitHub-Runner, Chromium 156,
       nicht am Tablet): 256 MB Download, 1,2 GB Arbeitsspeicher in der Spitze, rund 3 s je Bild. Das steht
       VORHER im Dialog.
   2 · Das FELD an jedem Foto (Karte und Editor): eigene Worte, getippt oder diktiert (assets/sprechen.js),
       gespeichert am Dokument (d.bild.eigen), getrennt von der Beschreibung des Modells (d.bild.modell).
   3 · Der SCHALTER „Bildbeschreibung" unter dem Suchfeld: an = nur beschriebene Fotos; die Wortsuche findet
       eigene Worte und Modellworte immer (als Felder in assets/suche.js, Fundzeile „Bildbeschreibung").
   Keine Emojis, Liniensymbole, flache Knöpfe, Hinweise ohne Kasten, ⓘ für die Erklärung (anfangs offen, gemerkt).
   app.js reicht seine Nähte über init() herein; so ist die Datei in Node und in der Probe ohne app.js prüfbar. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const MODELL = 'Xenova/vit-gpt2-image-captioning';
  const REVISION = '215b4edcb7ec1fad5905a18a03f7b2007f6fabd0';   // dieselben Dateien wie in der Pro-App gemessen
  const LIB = 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2';
  const EIGENER_SERVER = 'https://family-projekt.de/models/';
  // Gemessen 2026-10-26 (Privat-Brain-Pro, Lauf 40327837624): nicht am Tablet.
  const MESSUNG = { downloadMB: 256, spitzeMB: 1217, jeBildS: 3 };
  const BILD_QUELLEN = ['foto', 'zuschnitt'];
  const HILFE_KEY = 'wfpdf_hilfe_v1', FILTER_KEY = 'wfpdf_bildfilter_v1';
  const EIGEN_MAX = 500;

  const SVG = {
    bild: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-8 8"/>',
    mic: '<path d="M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3z"/><path d="M19 11a7 7 0 0 1-14 0M12 18v3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/>',
    mehr: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    stopp: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    weg: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12h10l1-12M9 7V4h6v3"/>'
  };
  const sym = (name, gr) => `<svg class="bild-sym" viewBox="0 0 24 24" width="${gr || 16}" height="${gr || 16}" aria-hidden="true" focusable="false">${SVG[name]}</svg>`;
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nm = s => '<span data-kein-ue>' + h(s) + '</span>';
  const mb = n => String(Math.round(n / 1048576));

  let A = null;   // Nähte aus app.js: { S, EINST, einstSpeichern, DB, dialog, toast, neu, sprechen, micSprache }
  const B = { zustand: 'aus', stand: { geladen: 0, gesamt: 0 }, fehler: '', beschreibt: null, pipe: null, _lauf: null, tf: null, fertig: 0 };

  /* ---------- Daten ---------- */
  const istBild = d => !!d && BILD_QUELLEN.includes(d.quelle);
  const eigen = d => String((d && d.bild && d.bild.eigen) || '').trim();
  const modell = d => String((d && d.bild && d.bild.modell) || '').trim();
  const beschrieben = d => istBild(d) && !!(eigen(d) || modell(d));
  // Fingerabdruck des Vorschaubilds: ändert es sich (neu fotografiert, zugeschnitten), beschreibt das Modell neu.
  const sig = d => 'v1:' + String(d.thumb || '').length + ':' + ((d.pages && d.pages.length) || 0);
  const modellAktuell = d => !!(d.bild && d.bild.modell && d.bild.sig === sig(d));
  // Die Felder für assets/suche.js: eigene Worte und Modellworte, jedes Wort zählt wie ein Feldinhalt.
  function suchFelder(d) {
    if (!istBild(d)) return [];
    const out = [];
    if (eigen(d)) out.push({ id: '__bild:eigen', label: '', value: eigen(d), page: null });
    if (modell(d)) out.push({ id: '__bild:modell', label: '', value: modell(d), page: null });
    return out;
  }
  const istBildFund = f => !!f && f.art === 'feld' && /^__bild:/.test(f.feldId || '');
  const fundWo = f => f.feldId === '__bild:modell' ? 'Bildbeschreibung vom Modell' : 'Bildbeschreibung';

  async function eigenSetzen(id, text) {
    const d = A.S.docs.find(x => x.id === id); if (!d) return;
    const t = String(text || '').slice(0, EIGEN_MAX);
    if (eigen(d) === t.trim() && d.bild) return;
    d.bild = Object.assign({}, d.bild || {}, { eigen: t, eigenZeit: new Date().toISOString() });
    d.updatedAt = new Date().toISOString();
    await A.DB.put('docs', d);
    // Karten und Editor zeigen den neuen Stand; die laufende Eingabe bleibt stehen
    document.querySelectorAll(`.bild-feld[data-bild-id="${id}"]`).forEach(f => feldFuellen(f, d, true));
    if (A.S.suche && A.neu) A.neu();
  }

  /* ---------- Hilfe (ⓘ): anfangs offen, die Wahl wird gemerkt ---------- */
  const hilfeLesen = () => { try { const o = JSON.parse(localStorage.getItem(HILFE_KEY) || '{}'); return o.bild !== false; } catch (_) { return true; } };
  const hilfeMerken = offen => { try { const o = JSON.parse(localStorage.getItem(HILFE_KEY) || '{}'); o.bild = !!offen; localStorage.setItem(HILFE_KEY, JSON.stringify(o)); } catch (_) {} };

  /* ---------- Filter: nur beschriebene Fotos ---------- */
  let filter = false; try { filter = localStorage.getItem(FILTER_KEY) === '1'; } catch (_) {}
  const filterAn = () => filter;
  function filterSetzen(an) {
    filter = !!an; try { localStorage.setItem(FILTER_KEY, filter ? '1' : '0'); } catch (_) {}
    filterZeichnen(); if (A && A.neu) A.neu();
  }
  function filterZeichnen() {
    const z = document.getElementById('bildFilterZeile'); if (!z) return;
    if (!z.querySelector('[data-bild-filter]')) {
      z.innerHTML = `<button class="bild-knopf" type="button" data-bild-filter aria-pressed="false" title="Nur Fotos mit Bildbeschreibung zeigen">${sym('bild')}<span>Bildbeschreibung</span></button>`
        + `<button class="bild-info" type="button" data-bild-hilfe aria-expanded="true" aria-controls="bildHilfe" title="Hilfe ausblenden" aria-label="Bildbeschreibung: Hilfe">${sym('info', 18)}</button>`
        ;
      // Die Erklärung steht unter BEIDEN Leisten (Schalter und Modell), damit die Zeile flach bleibt
      const t = document.createElement('div'); t.className = 'bild-hilfe'; t.id = 'bildHilfe'; t.dataset.bildHilfetext = ''; t.setAttribute('role', 'region');
      t.innerHTML = '<span>Der Schalter zeigt nur Fotos, die eine Bildbeschreibung haben. Die Suche findet immer auch die Worte aus der Bildbeschreibung — deine eigenen und die vom Modell. „Fotos beschreiben lassen“ holt dafür einmal ein Modell auf das Gerät; die Fotos selbst gehen nicht ins Netz.</span>';
      (z.parentElement && z.parentElement.id === 'bildZeilen' ? z.parentElement : z).appendChild(t);
      z.querySelector('[data-bild-filter]').onclick = () => filterSetzen(!filter);
      const i = z.querySelector('[data-bild-hilfe]');
      const zeigen = offen => { t.hidden = !offen; i.setAttribute('aria-expanded', String(offen)); i.title = offen ? 'Hilfe ausblenden' : 'Hilfe anzeigen'; };
      zeigen(hilfeLesen());
      i.onclick = () => { const offen = t.hidden; zeigen(offen); hilfeMerken(offen); };
    }
    const b = z.querySelector('[data-bild-filter]');
    b.setAttribute('aria-pressed', String(filter)); b.classList.toggle('on', filter);
  }

  /* ---------- Das Feld an jedem Foto ---------- */
  const uhren = new Map();
  function feldBauen(d, ort) {
    const f = document.createElement('div');
    f.className = 'bild-feld' + (ort ? ' bild-feld-' + ort : ''); f.dataset.bildId = d.id;
    f.innerHTML = `<div class="bild-feld-kopf">${sym('bild', 14)}<span class="bild-feld-name">Bildbeschreibung</span></div>`
      + `<div class="bild-modell" data-bild-modell hidden><span class="bild-modell-wo">Vom Modell:</span> <span class="bild-modell-text" data-kein-ue></span></div>`
      + `<div class="bild-eigen-zeile"><textarea class="bild-eigen" rows="1" maxlength="${EIGEN_MAX}" placeholder="Eigene Worte, getippt oder gesprochen" aria-label="Bildbeschreibung – eigene Worte" data-kein-ue enterkeyhint="done"></textarea>`
      + `<button class="bild-mic" type="button" data-bild-mic title="Sprechen statt tippen" aria-label="Bildbeschreibung sprechen">${sym('mic')}</button></div>`;
    const ta = f.querySelector('.bild-eigen');
    // Ein Tipp ins Feld öffnet nichts und zieht nichts (die Karte hört auf Druck und Zug)
    for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'click']) f.addEventListener(ev, e => e.stopPropagation());
    const speichern = () => { clearTimeout(uhren.get(d.id)); uhren.delete(d.id); eigenSetzen(d.id, ta.value); };
    ta.addEventListener('input', () => { clearTimeout(uhren.get(d.id)); uhren.set(d.id, setTimeout(speichern, 600)); });
    ta.addEventListener('change', speichern);
    ta.addEventListener('blur', speichern);
    ta.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); speichern(); ta.blur(); } });
    const mic = f.querySelector('[data-bild-mic]');
    if (A.sprechen && typeof A.sprechen.anhaengen === 'function' && ('SpeechRecognition' in W || 'webkitSpeechRecognition' in W)) {
      A.sprechen.anhaengen({ knopf: mic, nach: ta, feld: ta,
        sprache: () => (A.micSprache ? A.micSprache() : 'de-DE'),
        text: (t, fertig) => { ta.value = String(t || '').slice(0, EIGEN_MAX); if (fertig) speichern(); },
        meldung: A.toast });
    } else mic.hidden = true;
    feldFuellen(f, d, false);
    return f;
  }
  function feldFuellen(f, d, nurModell) {
    const m = f.querySelector('[data-bild-modell]');
    m.hidden = !modell(d); m.querySelector('.bild-modell-text').textContent = modell(d);
    const ta = f.querySelector('.bild-eigen');
    if (!nurModell || document.activeElement !== ta) { const v = eigen(d); if (ta.value.trim() !== v) ta.value = v; }
  }
  // Karten: nach dem Zeichnen an jedes Foto ein Feld (ins .dok-info, unter die Metazeilen)
  function karten(gitter) {
    if (!A || !gitter) return;
    gitter.querySelectorAll('.dok[data-id]').forEach(el => {
      if (el.querySelector('.bild-feld')) return;
      const d = A.S.docs.find(x => x.id === el.dataset.id); if (!istBild(d)) return;
      const info = el.querySelector('.dok-info'); if (info) info.appendChild(feldBauen(d, 'karte'));
    });
  }
  // Editor: dasselbe Feld unter der Leiste, nur bei Fotos
  function editor(d) {
    const halt = document.getElementById('edBild'); if (!halt) return;
    halt.innerHTML = ''; halt.hidden = !istBild(d);
    if (istBild(d)) halt.appendChild(feldBauen(d, 'editor'));
  }

  /* ---------- Das Modell: laden auf Knopfdruck, beschreiben auf dem Gerät ---------- */
  function leiste() {
    const l = document.getElementById('bildLeiste'); if (!l) return;
    l.dataset.bildZustand = B.zustand;
    const z = B.zustand, st = B.stand;
    const mehr = `<button class="bild-knopf bild-knopf-rund" type="button" data-bild-mehr title="Bildbeschreibung: Einstellungen" aria-label="Bildbeschreibung: Einstellungen">${sym('mehr')}</button>`;
    let html = '';
    if (z === 'aus') html = `<button class="bild-knopf" type="button" data-bild-an>${sym('bild')}<span>Fotos beschreiben lassen</span></button><span class="bild-t">Modell auf dem Gerät, einmal laden</span>`;
    else if (z === 'laedt') {
      const p = st.gesamt ? Math.min(100, st.geladen / st.gesamt * 100) : 0;
      html = `<span class="bild-t" data-bild-text>Bildmodell wird geladen: ${nm(mb(st.geladen))} von ${nm(st.gesamt ? mb(st.gesamt) : String(MESSUNG.downloadMB))} MB</span>`
        + `<button class="bild-knopf" type="button" data-bild-abbruch>${sym('stopp')}<span>Abbrechen</span></button>`
        + `<div class="fortschritt laeuft" data-bild-balken role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p)}"><i style="width:${p.toFixed(1)}%"></i></div>`;
    } else if (z === 'beschreibt') {
      const o = B.beschreibt || { i: 0, n: 0, name: '' };
      const p = o.n ? (o.i - 1) / o.n * 100 : 0;
      html = `<span class="bild-t" data-bild-text>Fotos werden beschrieben: ${nm(o.name)} · ${nm(String(o.i))} von ${nm(String(o.n))}</span>`
        + `<div class="fortschritt laeuft" data-bild-balken role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p)}"><i style="width:${p.toFixed(1)}%"></i></div>`;
    } else if (z === 'bereit') html = `<span class="bild-t" data-bild-text>Bildbeschreibung an · ${nm(String(B.fertig))} Fotos vom Modell beschrieben</span>${mehr}`;
    else html = `<span class="bild-t bild-fehler" data-bild-text>Bildbeschreibung ging nicht: <span data-kein-ue>${h(B.fehler)}</span></span><button class="bild-knopf" type="button" data-bild-nochmal><span>Nochmal</span></button>${mehr}`;
    l.innerHTML = html;
    const b = sel => l.querySelector(sel);
    if (b('[data-bild-an]')) b('[data-bild-an]').onclick = dialogZeigen;
    if (b('[data-bild-mehr]')) b('[data-bild-mehr]').onclick = dialogZeigen;
    if (b('[data-bild-nochmal]')) b('[data-bild-nochmal]').onclick = () => starten();
    if (b('[data-bild-abbruch]')) b('[data-bild-abbruch]').onclick = abbrechen;
  }
  function dialogZeigen() {
    const an = B.zustand !== 'aus';
    const stand = { laedt: 'lädt', beschreibt: 'beschreibt', bereit: 'bereit', fehler: 'Fehler' }[B.zustand] || B.zustand;
    A.dialog(`<h2>Bildbeschreibung</h2>
      <p>Ein Modell auf dem Gerät findet zu jedem Foto ein paar Worte („a beach with palm trees"). Die Worte stehen am Foto, getrennt von deinen eigenen, und die Suche findet beide. Deine eigenen Worte kannst du auch ohne Modell eintragen.</p>
      <p><b>Was dafür aus dem Netz kommt:</b> einmalig das Bildmodell (vit-gpt2-image-captioning) — das Programm von jsDelivr, die Modelldateien vom Server des Betreibers (family-projekt.de); antwortet er nicht, von Hugging Face. Danach liegt es im Vorrat dieses Browsers.</p>
      <p><b>Gemessen, nicht geschätzt</b> (Prüfrechner, nicht Tablet): Download ${nm(String(MESSUNG.downloadMB))} MB · Arbeitsspeicher in der Spitze ${nm('1,2')} GB · rund ${nm(String(MESSUNG.jeBildS))} s je Foto. Ein Tablet mit wenig Speicher kann dabei an seine Grenze kommen; dann hilft nur Ausschalten.</p>
      <p><b>Was NICHT ins Netz geht:</b> deine Fotos. Beschrieben wird auf diesem Gerät.</p>
      <p class="hinweis">Abbrechen hält das Laden an; was schon ganz geladen ist, bleibt im Browser, der nächste Start holt nur den Rest. „Modell entfernen" nimmt die Modelldateien aus dem Vorrat; die Beschreibungen an den Fotos bleiben.</p>
      ${an ? `<p data-bild-dlgstand>Stand: <b>${h(stand)}</b></p>` : ''}
      <div class="zeile">${an ? '<button class="knopf" data-bild-aus>Ausschalten</button><button class="knopf gefahr" data-bild-entfernen>Modell entfernen</button>' : '<button class="knopf primaer" data-bild-laden>Modell laden</button>'}<button class="knopf" data-x>Schließen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      const la = d.querySelector('[data-bild-laden]'); if (la) la.onclick = () => { zu(); A.EINST.bild = true; A.einstSpeichern(); starten(); };
      const au = d.querySelector('[data-bild-aus]'); if (au) au.onclick = () => { zu(); aus(); };
      const en = d.querySelector('[data-bild-entfernen]'); if (en) en.onclick = async () => { zu(); await entfernen(); };
    });
  }
  function aus() {
    A.EINST.bild = false; A.einstSpeichern();
    B.zustand = 'aus'; B.fehler = ''; B.beschreibt = null; B._lauf = null; B.pipe = null;
    leiste();
  }
  function abbrechen() { aus(); A.toast('Laden abgebrochen. Was schon da ist, bleibt im Browser.'); }
  async function entfernen() {
    aus();
    let n = 0;
    try {
      if (W.caches) { const c = await caches.open('transformers-cache'); for (const r of await c.keys()) if (r.url.includes('vit-gpt2-image-captioning')) { await c.delete(r); n++; } }
    } catch (_) {}
    A.toast(n ? 'Bildmodell entfernt. Die Beschreibungen an den Fotos bleiben.' : 'Im Vorrat lag kein Bildmodell. Die Beschreibungen an den Fotos bleiben.');
  }
  async function bibliothekLaden() {
    if (B.tf) return B.tf;
    B.tf = await import(/* webpackIgnore: true */ LIB);
    return B.tf;
  }
  async function modellLaden() {
    const tf = await bibliothekLaden();
    tf.env.allowLocalModels = false; tf.env.useBrowserCache = true;
    const dateien = new Map();
    const fortschritt = ev => {
      if (!ev || !ev.file || B.zustand !== 'laedt') return;
      const alt = dateien.get(ev.file) || { geladen: 0, gesamt: 0 };
      if (ev.status === 'progress') dateien.set(ev.file, { geladen: ev.loaded || 0, gesamt: ev.total || alt.gesamt });
      else if (ev.status === 'done') dateien.set(ev.file, { geladen: alt.gesamt || alt.geladen, gesamt: alt.gesamt || alt.geladen });
      let g = 0, s = 0; for (const x of dateien.values()) { g += x.geladen; s += x.gesamt; }
      B.stand = { geladen: g, gesamt: s }; leiste();
    };
    const versuch = extra => tf.pipeline('image-to-text', MODELL, Object.assign({ quantized: true, progress_callback: fortschritt }, extra || {}));
    // Erst der eigene Server, dann Hugging Face — wie die Pro-App
    try { tf.env.remoteHost = EIGENER_SERVER; tf.env.remotePathTemplate = '{model}/'; return await versuch(); }
    catch (e) { dateien.clear(); tf.env.remoteHost = 'https://huggingface.co/'; tf.env.remotePathTemplate = '{model}/resolve/{revision}/'; return await versuch({ revision: REVISION }); }
  }
  function starten() {
    if (B._lauf) { B._nochmal = true; return B._lauf; }
    B.zustand = B.pipe ? 'beschreibt' : 'laedt'; B.fehler = ''; B.stand = { geladen: 0, gesamt: 0 }; leiste();
    const lauf = B._lauf = (async () => {
      await Promise.resolve();   // erst nach der Zuweisung weiter — sonst liest der Lauf seine eigene Kennung, bevor sie steht (gemessen: TDZ-Fehler beim Nachziehen)
      if (!B.pipe) B.pipe = await modellLaden();
      if (B._lauf !== lauf) return;
      do { B._nochmal = false; await alleBeschreiben(lauf); } while (B._lauf === lauf && B._nochmal);
      if (B._lauf !== lauf) return;
      B.zustand = 'bereit'; B.beschreibt = null; B._lauf = null; leiste();
      if (A.S.suche && A.neu) A.neu();
    })().catch(e => {
      if (B._lauf !== lauf) return;
      B.zustand = 'fehler'; B.fehler = String((e && e.message) || e).slice(0, 200); B._lauf = null; B.pipe = null; leiste();
    });
    return lauf;
  }
  async function beschreiben(d) {
    if (!B.pipe || !d.thumb) return '';
    const r = await B.pipe(d.thumb);
    const t = Array.isArray(r) ? (r[0] && r[0].generated_text) : (r && r.generated_text);
    return String(t || '').replace(/\s+/g, ' ').trim();
  }
  async function alleBeschreiben(lauf) {
    const offen = A.S.docs.filter(d => istBild(d) && !modellAktuell(d));
    B.fertig = A.S.docs.filter(modellAktuell).length;
    let i = 0;
    for (const d of offen) {
      if (B._lauf !== lauf) return;
      i++; B.zustand = 'beschreibt'; B.beschreibt = { i, n: offen.length, name: d.name }; leiste();
      const t = await beschreiben(d);
      if (B._lauf !== lauf) return;
      d.bild = Object.assign({}, d.bild || {}, { modell: t, modellZeit: new Date().toISOString(), sig: sig(d) });
      await A.DB.put('docs', d); B.fertig++;
      document.querySelectorAll(`.bild-feld[data-bild-id="${d.id}"]`).forEach(f => feldFuellen(f, d, true));
      await new Promise(r => setTimeout(r, 30));
    }
  }
  // Nach dem Start, wenn die Wahl gemerkt ist: das Modell kommt aus dem Browser-Vorrat, neue Fotos werden beschrieben
  function start() { if (A && A.EINST.bild) starten(); }
  // Ein neues Foto, solange das Modell bereit ist (Einlesen, Scannen): nachziehen
  function nachziehen() { if (!A || !A.EINST.bild || !B.pipe || B.zustand === 'aus' || B.zustand === 'fehler') return; if (A.S.docs.some(d => istBild(d) && !modellAktuell(d))) starten(); }

  function init(naehte) {
    A = naehte;
    if (typeof A.EINST.bild !== 'boolean') A.EINST.bild = false;
    filterZeichnen(); leiste();
    return API;
  }
  const API = { init, start, starten, nachziehen, aus, leiste, karten, editor, istBild, beschrieben, suchFelder, istBildFund, fundWo, eigenSetzen, filterAn, filterSetzen, filterZeichnen, hilfeLesen, MODELL, REVISION, LIB, MESSUNG, BILD_QUELLEN, EIGEN_MAX, zustand: () => B };
  W.WFP = W.WFP || {}; W.WFP.Bild = API;
  if (typeof globalThis !== 'undefined') globalThis.__WFP_BILD = API;
})();
