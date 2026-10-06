/* Workfloh PDF — Oberfläche.
   Muster aus Mein-WorkFloh (Originaldokument-Modus): Felder liegen in Prozent
   über der echten Seite, „Felder bearbeiten" setzt und verschiebt sie,
   „Ausfüllen" schreibt hinein. Dokumente liegen lokal (IndexedDB), in Ordnern.
   Ins Netz geht nur, was der Nutzer ausdrücklich an eine KI schickt. */
(function () {
  'use strict';
  const { DB, Erkennung: ER, Export: EX, Uebersetzung: UE, Suche: SU, Bedeutung: BD } = WFP;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  const $ = id => document.getElementById(id);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Namen, die der Nutzer vergeben hat (Dokumente, Ordner, Felder): die Oberflächen-Übersetzung
  // (assets/sprache.js) fasst sie nicht an — ein Ordner „Briefe" bleibt „Briefe".
  const nm = s => '<span data-kein-ue>' + h(s) + '</span>';
  // Für Text, der in einem geschützten Bereich steht (die Felder auf der Seite tragen den
  // Namen des Nutzers als Titel): dort wird schon beim Bauen übersetzt.
  const T = s => (WFP.Sprache ? WFP.Sprache.T(s) : s);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const jetzt = () => new Date().toISOString();

  const TYPEN = {
    text: { name: 'Text', ico: '📝' }, datum: { name: 'Datum', ico: '📅' }, check: { name: 'Kästchen', ico: '☑️' },
    email: { name: 'E-Mail', ico: '✉️' }, tel: { name: 'Telefon', ico: '📞' }, url: { name: 'Internetadresse', ico: '🔗' },
    kdnr: { name: 'Kundennummer', ico: '🔢' }, artnr: { name: 'Artikelnummer', ico: '🏷️' }, qr: { name: 'QR-Code', ico: '▦' }, unterschrift: { name: 'Unterschrift', ico: '✒️' }
  };
  const GROESSE = { text: [28, 2.2], datum: [16, 2.2], email: [28, 2.2], tel: [20, 2.2], url: [28, 2.2], kdnr: [16, 2.2], artnr: [16, 2.2], check: [2.6, 1.9], qr: [14, 10], unterschrift: [30, 4.5] };

  /* ---------- Einstellungen ---------- */
  const EINST_KEY = 'wfpdf_einst_v1';
  const EINST = Object.assign({ anbieter: 'mistral', schluessel: {}, modell: {}, uebModell: {}, linien: true, kiOk: {}, ueVon: 'de', ueNach: 'ru', ueRueck: true }, lesen(EINST_KEY));
  if (!EINST.uebModell) EINST.uebModell = {};
  function lesen(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch (_) { return {}; } }
  function einstSpeichern() { try { localStorage.setItem(EINST_KEY, JSON.stringify(EINST)); } catch (_) {} }
  const kiCfg = () => ({ anbieter: EINST.anbieter, schluessel: EINST.schluessel[EINST.anbieter] || '', modell: EINST.modell[EINST.anbieter] || '' });
  const kiBereit = () => !!(EINST.schluessel[EINST.anbieter] || '').trim();

  /* ---------- Zustand ---------- */
  const S = { ordner: [], docs: [], aktOrdner: 'alle', doc: null, bytes: null, pdf: null, modus: 'bearbeiten', sel: null,
    zoom: 1, platzieren: null, beob: null, funde: [], fund: new Map() };

  /* ---------- Kleinkram ---------- */
  let _tt = null;
  function toast(txt, aktion) {
    const t = $('toast'); t.innerHTML = h(txt); t.classList.add('an');
    if (aktion) { const b = document.createElement('button'); b.textContent = aktion.text; b.onclick = () => { t.classList.remove('an'); aktion.tun(); }; t.appendChild(b); }
    clearTimeout(_tt); _tt = setTimeout(() => t.classList.remove('an'), aktion ? 7000 : 4200);
  }
  function hops() { const f = $('floh'); f.classList.remove('hopst'); void f.offsetWidth; f.classList.add('hopst'); }
  function dialog(html, onMount) {
    const g = document.createElement('div'); g.className = 'dlg-grund';
    g.innerHTML = '<div class="dlg" role="dialog" aria-modal="true">' + html + '</div>';
    g.addEventListener('click', e => { if (e.target === g) zu(); });
    const zu = () => { g.remove(); document.removeEventListener('keydown', esc); };
    const esc = e => { if (e.key === 'Escape') zu(); };
    document.addEventListener('keydown', esc);
    $('modals').appendChild(g);
    if (onMount) onMount(g.querySelector('.dlg'), zu);
    return zu;
  }
  function frage(titel, text, ja, nein) {
    return new Promise(res => {
      dialog(`<h2>${h(titel)}</h2><div>${text}</div><div class="zeile"><button class="knopf" data-n>${h(nein || 'Abbrechen')}</button><button class="knopf rot" data-j>${h(ja || 'OK')}</button></div>`,
        (d, zu) => { d.querySelector('[data-j]').onclick = () => { zu(); res(true); }; d.querySelector('[data-n]').onclick = () => { zu(); res(false); }; d.querySelector('[data-j]').focus(); });
    });
  }
  function eingabe(titel, label, wert) {
    return new Promise(res => {
      dialog(`<h2>${h(titel)}</h2><label>${h(label)}</label><input type="text" data-e value="${h(wert || '')}"><div class="zeile"><button class="knopf" data-n>Abbrechen</button><button class="knopf rot" data-j>OK</button></div>`,
        (d, zu) => {
          const i = d.querySelector('[data-e]'); i.focus(); i.select();
          const ok = () => { const v = i.value.trim(); zu(); res(v || null); };
          d.querySelector('[data-j]').onclick = ok; i.onkeydown = e => { if (e.key === 'Enter') ok(); };
          d.querySelector('[data-n]').onclick = () => { zu(); res(null); };
        });
    });
  }
  function fortschritt(titel, abbrechen) {
    let zuF = null, el = null, tx = null;
    dialog(`<h2 class="fb-kopf"><span class="dreher" aria-hidden="true"></span>${h(titel)}</h2><div class="fortschritt"><i></i></div><p class="hinweis" data-t>…</p>${abbrechen ? '<div class="zeile"><button class="knopf" data-abbruch>⏹ Abbrechen</button></div>' : ''}`, (d, zu) => {
      zuF = zu; el = d.querySelector('.fortschritt i'); tx = d.querySelector('[data-t]');
      const ab = d.querySelector('[data-abbruch]'); if (ab) ab.onclick = () => { ab.disabled = true; ab.textContent = 'Wird nach dieser Seite angehalten …'; abbrechen(); };
    });
    // Wartet die App auf etwas Langes (KI-Antwort), kriecht der Balken Richtung „bis",
    // läuft ein Streifen darüber und die Sekunden zählen mit — sonst sieht es aus wie stehengeblieben.
    let uhr = null;
    const stopp = () => { clearInterval(uhr); uhr = null; if (el) el.parentNode.classList.remove('laeuft'); };
    return {
      setze(anteil, text, bis) {
        stopp();
        if (el) el.style.width = Math.round(anteil * 100) + '%';
        if (tx && text) tx.textContent = text;
        if (bis > anteil && el) {
          el.parentNode.classList.add('laeuft');
          const t0 = Date.now();
          uhr = setInterval(() => {
            const s = (Date.now() - t0) / 1000;
            el.style.width = ((anteil + (bis - anteil) * (1 - Math.exp(-s / 25))) * 100).toFixed(1) + '%';
            if (tx) tx.textContent = text + ' · ' + Math.round(s) + ' s';
          }, 500);
        }
      },
      zu() { stopp(); if (zuF) zuF(); }
    };
  }
  function laden(dateiname, bytes, typ) {
    const blob = new Blob([bytes], { type: typ || 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = dateiname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return blob;
  }
  const dateiName = s => (String(s || 'Dokument').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'Dokument');

  /* ---------- Bibliothek ---------- */
  async function ladeBibliothek() {
    S.ordner = (await DB.all('folders')).sort((a, b) => a.name.localeCompare(b.name, 'de'));
    S.docs = (await DB.all('docs')).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    // Was DB.putFile/del weggeworfen hat, fällt auch aus dem Vorrat
    try { const da = new Set(await DB.keys('texte')); for (const id of [...TEXTE.keys()]) if (!da.has(id) && TEXTE.get(id).length) TEXTE.delete(id); } catch (_) {}
    zeichneBibliothek();
    texteNachholen();
    if (BED.zustand === 'bereit') vektorenNachholen().then(() => { bedeutungZeichnen(); if (BED.ergebnis === null && $('sc-bib').classList.contains('on')) zeichneBibliothek(); }).catch(() => {});
  }
  function offeneVorschlaege(d) { return (d.fields || []).filter(f => !f.geprueft).length; }
  /* Sortierung der Bibliothek (Klaus 2026-09-26: „Seite 1 bis 40 als erstes, dann Seite 41 bis 81
     … nach Dateinamen geordnet oder nach Dateigröße"). Namen werden NATÜRLICH verglichen:
     „Teil 2" vor „Teil 10", „S. 41–80" vor „S. 321–360". Vorgabe ist der Name. Bei einer Suche
     ordnet weiter die Trefferstärke. Die Wahl liegt in den Einstellungen dieses Browsers. */
  const SORTIERUNG = { name: 'Name (1, 2 … 10)', neu: 'Zuletzt geändert', erstellt: 'Erstellungsdatum', groesse: 'Dateigröße', seiten: 'Seitenzahl' };
  /* Erstellungsdatum (Klaus 2026-09-27: „nach Datum suchen … nur das Dokument, nicht der Inhalt.
     Wann wurde das Datum erstellt?"). Gemeint ist der Tag, an dem das Dokument HIER angelegt wurde
     (createdAt) — nicht ein Datum im Text; das findet die gewöhnliche Suche. Der Tag wird in der
     Ortszeit gerechnet: ein um 00:30 angelegtes Dokument gehört zum Tag, den das Gerät anzeigt.
     Dokumente ohne createdAt (sehr alte Stände) haben keinen Tag: sie stehen beim Sortieren hinten
     und passen zu keinem Datum. */
  const tagVon = iso => { if (!iso) return ''; const t = new Date(iso); if (isNaN(t)) return ''; const z = n => String(n).padStart(2, '0'); return t.getFullYear() + '-' + z(t.getMonth() + 1) + '-' + z(t.getDate()); };
  const tagText = tag => tag ? tag.slice(8, 10) + '.' + tag.slice(5, 7) + '.' + tag.slice(0, 4) : '';
  // Zeitraum „von – bis" nach dem Erstellungsdatum (Klaus 2026-09-27: „von bis ist besser … in der Woche
  // eingrenzen"). Beide Enden gehören dazu; fehlt eines, ist die Seite offen. S.von/S.bis: JJJJ-MM-TT.
  const imZeitraum = d => { if (!S.von && !S.bis) return true; const t = tagVon(d.createdAt); return !!t && (!S.von || t >= S.von) && (!S.bis || t <= S.bis); };
  const zeitraumText = () => S.von && S.bis ? (S.von === S.bis ? tagText(S.von) : tagText(S.von) + ' – ' + tagText(S.bis)) : S.von ? 'ab ' + tagText(S.von) : S.bis ? 'bis ' + tagText(S.bis) : '';
  const zeitraumLeer = () => S.von && S.bis ? (S.von === S.bis ? 'Kein Dokument wurde am ' + tagText(S.von) + ' erstellt.' : 'Kein Dokument wurde zwischen dem ' + tagText(S.von) + ' und dem ' + tagText(S.bis) + ' erstellt.')
    : S.von ? 'Kein Dokument wurde ab dem ' + tagText(S.von) + ' erstellt.' : 'Kein Dokument wurde bis zum ' + tagText(S.bis) + ' erstellt.';
  if (!SORTIERUNG[EINST.sortierung]) EINST.sortierung = 'name';
  const namensVergleich = (a, b) => a.name.localeCompare(b.name, 'de', { numeric: true, sensitivity: 'base' });
  function sortiere(liste) {
    const art = EINST.sortierung;
    if (art === 'groesse') {
      const fehlt = liste.filter(d => !_groesse.has(d.id));
      // Größen stehen nicht am Dokument — einmal nachlesen, dann neu zeichnen (fail-soft: fehlt eine, zählt sie als 0)
      if (fehlt.length && !sortiere._laeuft) { sortiere._laeuft = true; Promise.all(fehlt.map(d => dateiGroesse(d.id).catch(() => 0))).finally(() => { sortiere._laeuft = false; zeichneBibliothek(); }); }
      return liste.sort((a, b) => (_groesse.get(b.id) || 0) - (_groesse.get(a.id) || 0) || namensVergleich(a, b));
    }
    if (art === 'seiten') return liste.sort((a, b) => b.pages.length - a.pages.length || namensVergleich(a, b));
    if (art === 'neu') return liste.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (art === 'erstellt') return liste.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || namensVergleich(a, b));
    return liste.sort(namensVergleich);
  }
  const mbText = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  function zeichneBibliothek() {
    // Suche (Klaus 2026-09-26): Name, Ordner, Feldinhalte UND der Text der Seiten — mit Fundstellen.
    // Die Rechnung steht in assets/suche.js; hier nur Auswahl und Anzeige. Gerechnet wird über ALLE
    // Dokumente, damit jeder Ordner-Knopf seine Trefferzahl zeigt; angezeigt nur der gewählte Ordner.
    const such = SU.anfrage(S.suche);
    const FUND = new Map();
    if (such.length) for (const d of S.docs) {
      const ordn = S.ordner.find(x => x.id === d.folderId);
      const r = SU.sucheDok(Object.assign({}, d, { ordner: ordn ? ordn.name : '' }), TEXTE.get(d.id) || null, such); if (r) FUND.set(d.id, r);
    }
    const imO = (d, id) => id === 'alle' ? true : id === 'ohne' ? !d.folderId || !S.ordner.some(x => x.id === d.folderId) : d.folderId === id;
    const treffO = id => S.docs.reduce((n, d) => n + (FUND.has(d.id) && imO(d, id) ? FUND.get(d.id).treffer : 0), 0);
    const tz = id => such.length ? `<span class="treffer-zahl" data-treffer="${treffO(id)}" title="Treffer in diesem Ordner">🔎${treffO(id)}</span>` : '';
    const anz = id => S.docs.filter(d => id === 'alle' ? true : id === 'ohne' ? !d.folderId || !S.ordner.some(o => o.id === d.folderId) : d.folderId === id).length;
    let html = `<button class="ordner-chip${S.aktOrdner === 'alle' ? ' on' : ''}" data-o="alle">Alle<span class="anz">${anz('alle')}</span>${tz('alle')}</button>`;
    for (const o of S.ordner) html += `<button class="ordner-chip${S.aktOrdner === o.id ? ' on' : ''}" data-o="${o.id}">${o.bereich === 'uebersetzung' ? '🌐 ' : '🗂️ '}${nm(o.name)}<span class="anz">${anz(o.id)}</span>${tz(o.id)}</button>`;
    if (S.ordner.length && anz('ohne')) html += `<button class="ordner-chip${S.aktOrdner === 'ohne' ? ' on' : ''}" data-o="ohne">Ohne Ordner<span class="anz">${anz('ohne')}</span>${tz('ohne')}</button>`;
    html += `<button class="ordner-chip" data-neu>＋ Ordner</button>`;
    const ol = $('ordnerLeiste'); ol.innerHTML = html;
    ol.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { S.aktOrdner = b.dataset.o; zeichneBibliothek(); });
    ol.querySelector('[data-neu]').onclick = neuerOrdner;

    const akt = $('ordnerAktionen'); const o = S.ordner.find(x => x.id === S.aktOrdner);
    // Ist ein Ordner gewählt, zeigt die Suche NUR ihn (Klaus 2026-09-26) — ein Knopf hebt das auf.
    const imOrdner = d => imO(d, S.aktOrdner);
    S.fund = FUND;
    const sicht = S.sicht = S.docs.filter(d => imOrdner(d) && (!such.length || FUND.has(d.id)) && imZeitraum(d));
    if (such.length) sicht.sort((a, b) => FUND.get(b.id).punkte - FUND.get(a.id).punkte);
    else sortiere(sicht);
    // EIN Kasten für Sortieren UND den Zeitraum (Klaus 2026-09-27: „nicht außerhalb des Containers, weil es
    // wieder zu viel Platz wegnimmt … wenn es im Container mit drin ist, klappt es sich mit ein").
    // Zugeklappt nennt die Kopfzeile, wonach sortiert und welcher Zeitraum gewählt ist — eine Eingrenzung,
    // die man zugeklappt nicht sieht, wäre eine still fehlende Liste.
    const zr = zeitraumText();
    const zeitraumZeigen = EINST.sortierung === 'erstellt' || S.von || S.bis;
    const sortWahl = S.docs.length ? `<details class="sortier-box" data-sortbox${S.sortOffen ? ' open' : ''}><summary>⇅ Sortieren${zr ? ` <span class="zeitraum-kurz" data-zeitraumkurz>📅 ${h(zr)}</span>` : ''}</summary>`
      + `<div class="sortier-inhalt"><label class="sortier">Sortieren nach: <select data-sort>${Object.entries(SORTIERUNG).map(([k, v]) => `<option value="${k}"${k === EINST.sortierung ? ' selected' : ''}>${v}</option>`).join('')}</select></label>`
      + (such.length ? '<span class="hinweis klein">Bei einer Suche ordnet die Trefferzahl.</span>' : '')
      + (zeitraumZeigen ? `<div class="zeitraum" data-zeitraum>📅 Erstellt von <input type="date" data-von value="${h(S.von || '')}"> bis <input type="date" data-bis value="${h(S.bis || '')}">${S.von || S.bis ? '<button class="knopf klein" data-datumweg title="Zeitraum wieder weglassen">✕ jedes Datum</button>' : ''}</div>` : '')
      + '</div></details>' : '';
    akt.innerHTML = sortWahl + (o && S.docs.some(d => d.folderId === o.id) ? `<button class="knopf" data-ausgabe>📤 Ordner ausgeben</button>` : '') + (sicht.length ? `<button class="knopf" data-ueb>🌐 Übersetzen${sicht.length > 1 ? ' — Dokumente wählen' : ''}</button><button class="knopf" data-erk>🤖 Felder erkennen${sicht.length > 1 ? ' — Dokumente wählen' : ''}</button>` : '')
      + (o ? `<button class="knopf" data-ren>✎ Ordner umbenennen</button><button class="knopf gefahr" data-del>🗑 Ordner löschen</button>` : '');
    const q = s => akt.querySelector(s);
    // Offen/zu merkt sich S.sortOffen. „toggle" feuert erst in einer späteren Aufgabe — wer im Kasten wählt,
    // liest deshalb den Kasten SELBST (sonst klappt ein schneller Griff ihn beim Neuzeichnen wieder zu).
    const kastenOffen = () => { const b = q('[data-sortbox]'); if (b) S.sortOffen = b.open; };
    if (q('[data-sortbox]')) q('[data-sortbox]').ontoggle = kastenOffen;
    // „Erstellungsdatum" gewählt → der Zeitraum steht da (der Kasten ist offen, man hat ja darin gewählt),
    // und der Kalender für „von" geht gleich auf.
    if (q('[data-sort]')) q('[data-sort]').onchange = e => { EINST.sortierung = e.target.value; einstSpeichern(); kastenOffen(); zeichneBibliothek();
      if (e.target.value === 'erstellt') { const v = $('ordnerAktionen').querySelector('[data-von]'); if (v) { v.focus(); try { v.showPicker(); } catch (_) {} } } };
    // Widersprechen sich die Enden, gewinnt das gerade gewählte, und das andere rückt auf denselben Tag —
    // so steht nie still eine leere Liste da, und im Feld sieht man, was gilt.
    const zeitraumSetzen = welches => () => { let v = q('[data-von]').value || '', b = q('[data-bis]').value || ''; if (v && b && v > b) { if (welches === 'von') b = v; else v = b; } S.von = v; S.bis = b; kastenOffen(); zeichneBibliothek(); };
    if (q('[data-von]')) { q('[data-von]').onchange = zeitraumSetzen('von'); q('[data-bis]').onchange = zeitraumSetzen('bis'); }
    if (q('[data-datumweg]')) q('[data-datumweg]').onclick = () => { S.von = S.bis = ''; zeichneBibliothek(); };
    if (q('[data-ausgabe]')) q('[data-ausgabe]').onclick = () => ordnerAusgabe(o);
    if (q('[data-erk]')) q('[data-erk]').onclick = () => erkennenDialog(sicht.map(d => d.id));
    if (q('[data-ueb]')) q('[data-ueb]').onclick = () => uebersetzenDialog(sicht.filter(d => !d.uebersetzung).map(d => d.id).concat(sicht.filter(d => d.uebersetzung).map(d => d.id)));
    if (q('[data-ren]')) q('[data-ren]').onclick = async () => { const n = await eingabe('Ordner umbenennen', 'Name', o.name); if (!n) return; const alt = o.name; o.name = n; await DB.put('folders', o);
      // Abgeleitete Ordner („Beispiele · EN") ziehen mit, solange sie noch den alten Namen vorn tragen.
      // Wer einen davon selbst umbenannt hat, behält seinen Namen.
      for (const x of S.ordner) if (x !== o && stammOrdner(x) === stammOrdner(o) && abkoemmling(x, o) && x.name.startsWith(alt + ' · ')) { x.name = n + x.name.slice(alt.length); await DB.put('folders', x); }
      ladeBibliothek(); };
    if (q('[data-del]')) q('[data-del]').onclick = async () => {
      if (!await frage('Ordner löschen?', `<p>Der Ordner „${nm(o.name)}" wird gelöscht. Die ${anz(o.id)} Dokumente darin bleiben erhalten und stehen danach unter „Ohne Ordner".</p>`, 'Ordner löschen')) return;
      for (const d of S.docs.filter(d => d.folderId === o.id)) { d.folderId = null; await DB.put('docs', d); }
      await DB.del('folders', o.id); S.aktOrdner = 'alle'; ladeBibliothek();
    };

    sicherungErinnerung();
    wahlLeiste();
    const g = $('dokGitter');
    const nurOrdner = such.length && S.aktOrdner !== 'alle' ? '<div class="hinweis such-ordner" data-suchordner><span>Gesucht nur in diesem Ordner.</span><button class="knopf klein" data-alleordner>In allen Ordnern suchen</button></div>' : '';
    const alleOrdnerKnopf = () => { const b = g.querySelector('[data-alleordner]'); if (b) b.onclick = () => { S.aktOrdner = 'alle'; zeichneBibliothek(); }; };
    if (!sicht.length) {
      if ((S.von || S.bis) && S.docs.some(d => imOrdner(d) && (!such.length || FUND.has(d.id)))) { g.innerHTML = nurOrdner + `<div class="leer" data-datumleer><b>${h(zeitraumLeer())}</b>${such.length ? '<br>' + h('Die Suche ist dabei mitgezählt.') : ''}<br><button class="knopf klein" data-datumweg2>✕ jedes Datum</button></div>`; g.querySelector('[data-datumweg2]').onclick = () => { S.von = S.bis = ''; zeichneBibliothek(); }; alleOrdnerKnopf(); return; }
      if (such.length) { const bz = bedeutungZusatz(FUND, imOrdner); g.innerHTML = nurOrdner + `<div class="leer" data-suchleer><b>Kein Dokument passt zu „${nm(S.suche.trim())}".</b>${bz.docs.length ? '<br>Nach Wörtern nicht — nach Bedeutung schon, siehe unten.' : ''}</div>` + bz.html + suchStand(); kartenBinden(g, FUND); alleOrdnerKnopf(); return; }
      g.innerHTML = `<div class="leer"><b>Noch keine Dokumente${o ? ' in diesem Ordner' : ''}.</b><br>Oben ein PDF oder Bild wählen, ein Blatt scannen oder einen ganzen Ordner einlesen. Du kannst Dateien auch einfach hierher ziehen.</div>`;
      return;
    }
    const bz = such.length ? bedeutungZusatz(FUND, imOrdner) : { html: '', docs: [] };
    g.innerHTML = nurOrdner + sicht.map(d => karte(d, FUND.get(d.id))).join('') + bz.html + (such.length ? suchStand() : '');
    alleOrdnerKnopf();
    kartenBinden(g, FUND);
  }
  /* Eine Dokument-Karte. fund: Wort-Treffer (assets/suche.js) oder Bedeutungs-Treffer ({ bedeutung }). */
  function karte(d, fund) {
      const v = offeneVorschlaege(d), ord = S.ordner.find(x => x.id === d.folderId);
      const tr = fund && !fund.bedeutung ? fund.treffer : 0;
      const nae = fund && fund.bedeutung ? `<span class="treffer-zahl naehe-zahl dok-treffer" data-naehe="${fund.w.toFixed(3)}" title="Nähe zur Frage — eine Rangfolge, keine Prozent">🧠 ${fund.w.toFixed(2).replace('.', ',')}</span>` : '';
      return `<div class="dok${WAHL.has(d.id) ? ' gewaehlt' : ''}" data-id="${d.id}"${fund && fund.bedeutung ? ' data-bedeutung' + (fund.schwach ? ' data-schwach' : '') : ''}>${nae}${tr ? `<span class="treffer-zahl dok-treffer" data-treffer="${tr}" title="Treffer in diesem Dokument">🔎${tr}</span>` : ''}
        <button class="dok-hoch" data-hoch title="Ganz nach oben" aria-label="Ganz nach oben">↑</button>
        <button class="dok-haken" data-haken title="Auswählen (mehrere teilen oder verschieben)" aria-label="Auswählen" aria-pressed="${WAHL.has(d.id)}">${WAHL.has(d.id) ? '✓' : ''}</button>
        <button class="dok-bild" data-auf style="background-image:url('${d.thumb || ''}')" title="Öffnen">
          <span class="marken">${v ? `<span class="marke-klein ki">🤖 ${v} zu prüfen</span>` : ''}${d.quelle === 'foto' ? '<span class="marke-klein">📷 Foto</span>' : ''}${d.uebersetzung ? `<span class="marke-klein">🌐 ${h((d.uebersetzung.von || '').toUpperCase())}→${h((d.uebersetzung.nach || '').toUpperCase())}${d.uebersetzung.gegenprobe ? ' Gegenprobe' : ''}</span>` : ''}${d.ausgefuellt ? `<span class="marke-klein">↩ ausgefüllt aus ${h((d.ausgefuellt.aus || '').toUpperCase())}</span>` : ''}</span></button>
        <div class="dok-info"><div class="dok-name" data-kein-ue title="${h(d.name)}">${nm(d.name)}</div>
          <div class="dok-meta">${d.pages.length} Seite${d.pages.length === 1 ? '' : 'n'} · ${d.fields.length} Feld${d.fields.length === 1 ? '' : 'er'}${EINST.sortierung === 'groesse' && _groesse.has(d.id) ? ' · ' + mbText(_groesse.get(d.id)) : ''}${ord && S.aktOrdner === 'alle' ? ' · 🗂️ ' + nm(ord.name) : ''}</div>${(EINST.sortierung === 'erstellt' || S.von || S.bis) ? '<div class="dok-meta dok-erstellt" data-erstellt="' + tagVon(d.createdAt) + '">' + (d.createdAt ? h('erstellt ' + tagText(tagVon(d.createdAt))) : h('ohne Erstellungsdatum')) + '</div>' : ''}${pruefMarke(d)}${fund ? (fund.bedeutung ? bedeutungZeile(fund) : fundZeilen(fund)) : ''}</div>
        <div class="dok-akt"><button data-auf title="Öffnen">✏️</button><button data-verschieben title="In Ordner verschieben">🗂️</button><button data-kopie title="Duplizieren (z. B. als Vorlage)">⧉</button><button data-teilen title="Teilen mit … (E-Mail, Messenger …)">📤</button><button data-loeschen title="Löschen">🗑</button></div></div>`;
  }
  /* Pfeil nach oben (Klaus 2026-09-27: „neben dem Markierenpunkt noch ein Pfeil nach oben … komplett
     einmal bis nach oben scrollen. Sonst muss ich die ganzen Dokumente wieder nach oben scrollen").
     Er steht an jeder Karte links neben dem Auswahl-Punkt, aber erst, wenn die Seite ein Stück
     heruntergerollt ist (html.gerollt) — ganz oben hätte er nichts zu tun. */
  function ganzNachOben() { window.scrollTo({ top: 0, behavior: 'smooth' }); }
  const gerolltPruefen = () => document.documentElement.classList.toggle('gerollt', window.scrollY > 160);
  window.addEventListener('scroll', gerolltPruefen, { passive: true });
  function kartenBinden(g, FUND) {
    g.querySelectorAll('.dok').forEach(el => {
      const id = el.dataset.id;
      const fund = el.hasAttribute('data-bedeutung') ? (S.bedeutungFund && S.bedeutungFund.get(id)) : FUND.get(id);
      // Aus der Suche geöffnet: die Fundstellen kommen mit und werden auf der Seite markiert
      // Im Auswahl-Modus wählt ein Tipp, statt zu öffnen — wie bei einer Bilderauswahl
      const auf = () => { if (WAHL_AN) wahlUmschalten(id); else oeffneDok(id, fund); };
      el.querySelectorAll('[data-auf]').forEach(b => b.onclick = auf);
      const fz = el.querySelector('[data-fundzeilen]'); if (fz) fz.onclick = auf;
      el.querySelector('[data-haken]').onclick = () => { WAHL_AN = true; wahlUmschalten(id); };
      el.querySelector('[data-hoch]').onclick = ganzNachOben;
      const pk = el.querySelector('[data-pruef]'); if (pk) pk.onclick = () => pruefDialog(id);
      const tk = el.querySelector('[data-teilen]'); if (tk) tk.onclick = () => teilenDocs([id]);   // Platzhalter, kein Ausstieg
      ziehenBinden(el, id);
      el.querySelector('[data-verschieben]').onclick = () => verschieben(id);
      el.querySelector('[data-kopie]').onclick = () => duplizieren(id);
      el.querySelector('[data-loeschen]').onclick = () => loeschen(id);
    });
  }
  // „gefunden wegen …": woran die Suche das Dokument erkannt hat (höchstens drei Zeilen)
  function fundZeilen(r) {
    const z = [], gesehen = new Set();
    for (const f of r.funde) {
      const key = f.art + '|' + (f.page != null ? f.page : '') + '|' + (f.feldId || '') + '|' + f.text; if (gesehen.has(key)) continue; gesehen.add(key);
      const wo = f.art === 'name' ? 'Im Namen' : f.art === 'ordner' ? 'Im Ordnernamen' : f.art === 'feld' ? (f.label ? 'Feld' : 'Feld auf Seite ' + (f.page + 1)) : 'Auf Seite ' + (f.page + 1);
      z.push(`<div class="fund-zeile"><span class="fund-wo" data-art="${f.art}">${h(wo)}</span>${f.art === 'feld' && f.label ? ' ' + nm('„' + f.label + '"') : ''} <span class="fund-text" data-kein-ue>${h(f.text)}</span></div>`);
    }
    const mehr = z.length - 3;
    return `<div class="dok-fund" data-fundzeilen>${z.slice(0, 3).join('')}${mehr > 0 ? `<div class="fund-zeile"><span class="fund-wo" data-art="mehr">${h('und ' + mehr + ' weitere Fundstellen')}</span></div>` : ''}</div>`;
  }
  // Solange der Seitentext noch erfasst wird, sagt die Suche das — sonst sähe „nichts gefunden" endgültig aus.
  function suchStand() {
    const offen = S.docs.filter(d => !TEXTE.has(d.id)).length;
    return offen ? `<div class="hinweis such-stand" data-suchstand>${h('Seitentext wird noch erfasst: ' + (S.docs.length - offen) + ' von ' + S.docs.length + ' Dokumenten')}</div>` : '';
  }

  /* ---------- Suche, Stufe 2: nach Bedeutung (Klaus 2026-09-26) ----------
     „Semantische Suche, Embedding-Modell runterladen mit Ladebalken und Ladezustandsanzeige."
     Modell und Rechnung aus Sage (vendor/sbkim/03_embedding.js, 04_match.js — byte-1:1, dort
     pflegen), dasselbe Modell wie in PWA Toolpoint. FREIWILLIG: erst auf Knopfdruck, und der
     Dialog sagt VORHER, was aus dem Netz kommt. Aus dem Netz kommt nur das Modell (jsDelivr,
     Hugging Face); die Dokumente werden auf dem Gerät eingeordnet und verlassen es nicht.
     Die Zerlegung und Rangfolge stehen in assets/bedeutung.js. */
  const BED = { zustand: 'aus', stand: { prozent: null, geladen: 0, gesamt: 0, datei: '' }, text: '', vek: new Map(), dateien: new Map(), ergebnis: null, fehler: '', ordnet: null };
  S.bedeutungFund = new Map();
  const mb = n => (n / 1048576).toFixed(1).replace('.', ',');
  function skriptLaden(src) {
    return new Promise((res, rej) => {
      const el = document.createElement('script'); el.src = src; el.async = true;
      el.onload = () => res(); el.onerror = () => rej(new Error('Datei fehlt: ' + src.split('?')[0]));
      document.head.appendChild(el);
    });
  }
  async function modulLaden() {
    if (!window.SbkimEmbedding) await skriptLaden('vendor/sbkim/03_embedding.js?v=1');
    if (!window.SbkimMatch) await skriptLaden('vendor/sbkim/04_match.js?v=1');
    if (!window.SbkimEmbedding || !window.SbkimMatch) throw new Error('Modul 03/04 nicht geladen');
  }
  // Die Zustandsanzeige unter dem Suchfeld: aus · lädt (Balken, Prozent, MB) · ordnet ein · bereit · Fehler
  function bedeutungZeichnen() {
    const l = $('bedeutungLeiste'); if (!l) return;
    l.dataset.bedZustand = BED.zustand;
    const z = BED.zustand, st = BED.stand;
    let html = '';
    if (z === 'aus') html = `<button class="knopf klein" type="button" data-bed-an>🧠 Suche nach Bedeutung einschalten</button><span class="bed-t">findet auch Dokumente, in denen andere Wörter stehen</span>`;
    else if (z === 'laedt') {
      const p = st.prozent;
      html = `<span class="bed-t" data-bed-text>${h(p == null ? 'Sprachmodell wird geladen …' : 'Sprachmodell wird geladen … ' + Math.floor(p) + ' %')}</span>`
        + (st.gesamt ? `<span class="bed-mb" data-bed-mb>${h(mb(st.geladen) + ' / ' + mb(st.gesamt) + ' MB')}</span>` : '')
        + `<div class="fortschritt${p == null ? ' laeuft' : ''}" data-bed-balken role="progressbar" aria-valuemin="0" aria-valuemax="100"${p == null ? '' : ` aria-valuenow="${Math.floor(p)}"`}><i style="width:${p == null ? 100 : p.toFixed(1)}%"></i></div>`;
    } else if (z === 'ordnet') {
      const o = BED.ordnet;
      const p = o && o.gesamt ? Math.min(100, o.fertig / o.gesamt * 100) : 0;
      const sek = ms => (ms / 1000).toFixed(1).replace('.', ',');
      const min = ms => ms < 60000 ? 'unter 1' : String(Math.round(ms / 60000));
      html = o
        ? `<span class="bed-t" data-bed-text>${'Wird eingeordnet: ' + nm(o.name) + h(' · Seite ' + o.seite + ' von ' + o.seiten)}</span>`
          + `<span class="bed-mb" data-bed-zeit>${h('Dokument ' + o.dok + ' von ' + o.doks + ' · ' + (o.msSeite == null ? 'Zeit je Seite wird gemessen …' : '≈ ' + sek(o.msSeite) + ' s je Seite · noch ≈ ' + min(o.restMs) + ' min'))}</span>`
        : `<span class="bed-t" data-bed-text>${h('Dokumente werden geprüft …')}</span>`;
      html += `<div class="fortschritt" data-bed-balken role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.floor(p)}"><i style="width:${p.toFixed(1)}%"></i></div>`;
      if (o) html += `<span class="bed-t bed-klein" data-bed-schon>${h('Suchen geht schon — was eingeordnet ist, wird gefunden.')}</span>`;
    } else if (z === 'bereit') html = `<span class="bed-t" data-bed-text>🧠 ${h('Suche nach Bedeutung an · ' + BED.vek.size + ' Dokumente eingeordnet')}</span><button class="knopf klein" type="button" data-bed-mehr>⚙️</button>`;
    else html = `<span class="bed-t bed-fehler" data-bed-text>⚠️ ${'Suche nach Bedeutung ging nicht:'} <span data-kein-ue>${h(BED.fehler)}</span></span><button class="knopf klein" type="button" data-bed-nochmal>↻ Nochmal</button><button class="knopf klein" type="button" data-bed-mehr>⚙️</button>`;
    l.innerHTML = html;
    const b = sel => l.querySelector(sel);
    if (b('[data-bed-an]')) b('[data-bed-an]').onclick = bedeutungDialog;
    if (b('[data-bed-mehr]')) b('[data-bed-mehr]').onclick = bedeutungDialog;
    if (b('[data-bed-nochmal]')) b('[data-bed-nochmal]').onclick = () => bedeutungStarten();
  }
  function bedeutungDialog() {
    const an = BED.zustand !== 'aus';
    dialog(`<h2>🧠 Suche nach Bedeutung</h2>
      <p>Die Wortsuche findet, was wörtlich dasteht. Die Suche nach Bedeutung findet auch Dokumente, in denen <b>andere Wörter</b> stehen — „Kündigung" findet den Brief, in dem „Vertrag beenden" steht.</p>
      <p><b>Was dafür aus dem Netz kommt:</b> einmalig ein Sprachmodell (multilingual-e5-small, rund 30 MB) von jsDelivr und Hugging Face. Der Balken zeigt, wie viel schon da ist. Danach liegt es im Speicher dieses Browsers.</p>
      <p><b>Was NICHT ins Netz geht:</b> deine Dokumente. Sie werden auf diesem Gerät eingeordnet.</p>
      <p class="hinweis">Eingeordnet werden <b>alle Seiten</b>, Satz für Satz. Bei einem langen Handbuch dauert das — die Leiste zeigt die Seite und die gemessene Zeit, und nach einer Unterbrechung geht es an derselben Stelle weiter. Suchen geht schon währenddessen.</p>
      <p class="hinweis">Gezeigt wird, was höchstens ${String(BD.ABSTAND).replace('.', ',')} hinter dem besten Treffer liegt (nie unter ${String(BD.NAEHE_MIN).replace('.', ',')}), höchstens ${BD.MAX_ZEIGEN} Dokumente. Bei Fragen aus mehreren Wörtern zählen die Wörter mit.</p>
      ${an ? `<p data-bed-dlgstand>${'Stand:'} <b>${h({ laedt: 'lädt', ordnet: 'ordnet ein', bereit: 'bereit', fehler: 'Fehler' }[BED.zustand] || BED.zustand)}</b></p>` : ''}
      <div class="zeile">${an ? '<button class="knopf gefahr" data-bed-aus>Ausschalten</button>' : '<button class="knopf primaer" data-bed-laden>⬇️ Modell laden</button>'}<button class="knopf" data-x>Schließen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      const la = d.querySelector('[data-bed-laden]'); if (la) la.onclick = () => { zu(); EINST.bedeutung = true; einstSpeichern(); bedeutungStarten(); };
      const au = d.querySelector('[data-bed-aus]'); if (au) au.onclick = () => { zu(); bedeutungAus(); };
    });
  }
  function bedeutungAus() {
    EINST.bedeutung = false; einstSpeichern();
    BED.zustand = 'aus'; BED.ergebnis = null; BED.fehler = ''; S.bedeutungFund = new Map(); BED._lauf = null;
    bedeutungZeichnen(); if ($('sc-bib').classList.contains('on')) zeichneBibliothek();
  }
  let _bedFort = null;
  function bedeutungStarten() {
    if (BED._lauf) return BED._lauf;
    BED.zustand = 'laedt'; BED.fehler = ''; BED.dateien = new Map(); BED.stand = { prozent: null, geladen: 0, gesamt: 0, datei: '' }; bedeutungZeichnen();
    if (!_bedFort) {
      _bedFort = ev => {
        if (BED.zustand !== 'laedt') return;
        BED.stand = BD.ladeStand(BED.dateien, (ev && ev.detail) || {});
        bedeutungZeichnen();
      };
      window.addEventListener('sbkim:embedding-progress', _bedFort);
    }
    const lauf = BED._lauf = (async () => {
      await modulLaden();
      await window.SbkimEmbedding.init();
      if (BED._lauf !== lauf) return;
      BED.zustand = 'ordnet'; BED.ordnet = null; if (!BED.msStueck && EINST.bedMsStueck) { BED.msStueck = EINST.bedMsStueck; BED.gemessen = 32; } bedeutungZeichnen();
      await vektorenNachholen();
      if (BED._lauf !== lauf) return;
      BED.zustand = 'bereit'; BED.ergebnis = null; bedeutungZeichnen();
      if ($('sc-bib').classList.contains('on')) zeichneBibliothek();
    })().catch(e => {
      if (BED._lauf !== lauf) return;
      BED.zustand = 'fehler'; BED.fehler = String((e && e.message) || e).slice(0, 200); BED._lauf = null; bedeutungZeichnen();
    });
    return lauf;
  }
  /* Jedes Dokument einordnen — ALLE Seiten (seit 2026-09-26 ohne Deckel). Unverändert
     Eingeordnetes kommt aus dem Speicher. Gespeichert wird in Blöcken zu VEK_BLOCK Abschnitten
     (DB-Schlüssel id#00000 …, Kopf unter id mit sig und fertig): wird die App geschlossen,
     geht es beim nächsten Start an derselben Stelle weiter. Die Anzeige nennt Dokument, Seite
     und die GEMESSENE Zeit je Seite — geschätzt wird erst, wenn etwas gemessen ist. */
  const VEK_BLOCK = 64;
  const blockId = (id, b) => id + '#' + String(b).padStart(5, '0');
  async function vektorenAusSpeicher() {
    if (BED.speicherGelesen) return;
    let alle = []; try { alle = await DB.all('vektoren'); } catch (_) {}
    const koepfe = new Map(), bloecke = new Map();
    for (const r of alle) {
      const i = r.id.indexOf('#');
      if (i < 0) koepfe.set(r.id, r);
      else { const id = r.id.slice(0, i); if (!bloecke.has(id)) bloecke.set(id, new Map()); bloecke.get(id).set(+r.id.slice(i + 1), r.st || []); }
    }
    for (const [id, k] of koepfe) {
      if (!k.sig || !k.n || BED.vek.has(id)) continue;   // alte Fassung (ein Eintrag mit st) wird neu eingeordnet
      const st = [], bs = bloecke.get(id) || new Map();
      for (let b = 0; bs.has(b); b++) st.push(...bs.get(b));   // nur lückenlos — ein fehlender Block wird neu gerechnet
      BED.vek.set(id, { id, sig: k.sig, n: k.n, st: st.slice(0, k.n) });
    }
    BED.speicherGelesen = true;
  }
  let _vekLauf = null, _vekNochmal = false;
  function vektorenNachholen() {
    if (_vekLauf) { _vekNochmal = true; return _vekLauf; }
    _vekLauf = (async () => {
      do {
        _vekNochmal = false;
        await texteNachholen();
        await vektorenAusSpeicher();
        const plan = [];
        for (const d of S.docs.slice()) {
          const st = BD.stuecke(d, TEXTE.get(d.id) ? TEXTE.get(d.id) : null);
          const sig = BD.signatur(st), alt = BED.vek.get(d.id);
          if (!st.length) { if (alt) { BED.vek.delete(d.id); DB.vektorenWeg(d.id).catch(() => {}); } continue; }
          const ab = alt && alt.sig === sig ? Math.min(alt.st.length, st.length) : 0;
          if (ab < st.length) plan.push({ d, st, sig, ab });
        }
        const da = new Set(S.docs.map(d => d.id)); for (const id of [...BED.vek.keys()]) if (!da.has(id)) BED.vek.delete(id);
        const gesamt = plan.reduce((n, x) => n + x.st.length - x.ab, 0);
        let fertig = 0;
        for (let i = 0; i < plan.length; i++) {
          const { d, st, sig, ab } = plan[i];
          let e = BED.vek.get(d.id);
          if (!ab || !e || e.sig !== sig) {
            e = { id: d.id, sig, n: st.length, st: [] }; BED.vek.set(d.id, e);
            try { await DB.vektorenWeg(d.id); await DB.put('vektoren', { id: d.id, sig, n: st.length, fertig: 0 }); } catch (_) {}
          }
          for (let k = e.st.length; k < st.length; k += 16) {
            if (BED.zustand === 'aus' || BED.zustand === 'fehler') return;
            const teil = st.slice(k, k + 16), t0 = performance.now();
            const vs = await window.SbkimEmbedding.embedPassageBatch(teil.map(x => x.text));
            const ms = (performance.now() - t0) / teil.length;
            BED.msStueck = BED.msStueck ? BED.msStueck * 0.8 + ms * 0.2 : ms; BED.gemessen = (BED.gemessen || 0) + teil.length;
            teil.forEach((x, j) => e.st.push({ page: x.page, text: x.text, box: x.box, v: vs[j] }));
            fertig += teil.length;
            const n = e.st.length;
            if (n % VEK_BLOCK === 0 || n === st.length) {
              const b = Math.floor((n - 1) / VEK_BLOCK);
              try {
                await DB.put('vektoren', { id: blockId(d.id, b), st: e.st.slice(b * VEK_BLOCK, (b + 1) * VEK_BLOCK) });
                await DB.put('vektoren', { id: d.id, sig, n: st.length, fertig: n });
              } catch (_) {}
              BED.ergebnis = null;
            }
            const letzte = e.st[n - 1];
            BED.ordnet = { dok: i + 1, doks: plan.length, name: d.name, seite: letzte && letzte.page != null ? letzte.page + 1 : 1, seiten: d.pages.length || 1, fertig, gesamt,
              msSeite: BED.gemessen >= 32 ? BED.msStueck * st.length / Math.max(1, d.pages.length) : null,
              restMs: BED.gemessen >= 32 ? BED.msStueck * (gesamt - fertig) : null };
            if (BED.zustand === 'ordnet') bedeutungZeichnen();
          }
          BED.ergebnis = null;
          if (BED.zustand === 'ordnet' && String(S.suche || '').trim() && $('sc-bib').classList.contains('on')) zeichneBibliothek();
        }
        if (BED.gemessen >= 32) { EINST.bedMsStueck = Math.round(BED.msStueck * 10) / 10; einstSpeichern(); }
      } while (_vekNochmal);
    })().finally(() => { _vekLauf = null; });
    return _vekLauf;
  }
  // Die Frage einordnen und rangieren. Nur die LETZTE Frage zählt (wer weitertippt, überholt).
  let _bedFrage = null, _bedUhr = null;
  function bedeutungSuchen() {
    const q = String(S.suche || '').trim();
    if (!q || !bedeutungSucht() || _bedFrage === q) return;
    _bedFrage = q; clearTimeout(_bedUhr);
    _bedUhr = setTimeout(async () => {
      try {
        let fassungen = [q];
        try { const v = window.SbkimMatch.expandQuerySimple(q); if (Array.isArray(v) && v.length) fassungen = v.slice(0, 4); } catch (_) {}
        const qv = await Promise.all(fassungen.map(f => window.SbkimEmbedding.embedQuery(f)));
        if (String(S.suche || '').trim() !== q) return;
        const wa = wortAnteil(q);
        BED.ergebnis = { frage: q, woerter: wa ? wa.anzahl : 0, r: BD.rangliste(qv, BED.vek, window.SbkimMatch.match, { wortAnteil: wa }) };
      } catch (e) { BED.ergebnis = { frage: q, fehler: String((e && e.message) || e) }; }
      finally { if (_bedFrage === q) _bedFrage = null; }
      if ($('sc-bib').classList.contains('on')) zeichneBibliothek();
    }, 300);
  }
  // Gesucht wird, sobald das Modell da ist — auch während noch eingeordnet wird.
  const bedeutungSucht = () => BED.zustand === 'bereit' || (BED.zustand === 'ordnet' && BED.vek.size > 0);
  /* Lange Fragen: wie viele der Suchwörter stehen im Abschnitt? Gezählt werden Wörter ab vier
     Buchstaben und Daten (Füllwörter wie „der", „und" tragen nichts), und erst ab ZWEI solchen
     Wörtern — ein einzelnes Wort ist Sache der Wortsuche. Gleiche Angleichung wie die Wortsuche. */
  const _vorbereitet = new WeakMap();
  function wortAnteil(q) {
    const toks = SU.anfrage(q).filter(t => t.datum || t.k.length >= 4);
    if (toks.length < 2) return null;
    const fn = text => {
      let b = _vorbereitet.get(toks); if (!b) { b = new Map(); _vorbereitet.set(toks, b); }
      let v = b.get(text); if (!v) { v = SU.bereite(text); b.set(text, v); }
      let n = 0; for (const t of toks) if (SU.trifft(t, v)) n++;
      return n / toks.length;
    };
    fn.anzahl = toks.length;
    return fn;
  }
  // Unter den Wort-Treffern: was NUR nach Bedeutung passt.
  function bedeutungZusatz(FUND, imOrdner) {
    S.bedeutungFund = new Map();
    const q = String(S.suche || '').trim();
    if (BED.zustand === 'aus' || !q) return { html: '', docs: [] };
    if (!bedeutungSucht()) return { html: `<div class="hinweis bed-kopf" data-bed-wartet>${'🧠 Die Suche nach Bedeutung kommt dazu, sobald das Modell bereit ist.'}</div>`, docs: [] };
    const e = BED.ergebnis;
    if (!e || e.frage !== q) { bedeutungSuchen(); return { html: `<div class="hinweis bed-kopf" data-bed-sucht>${'🧠 Suche nach Bedeutung …'}</div>`, docs: [] }; }
    if (e.fehler) return { html: `<div class="hinweis bed-kopf" data-bed-fehler>⚠️ ${'Suche nach Bedeutung ging nicht:'} <span data-kein-ue>${h(e.fehler)}</span></div>`, docs: [] };
    const nochNicht = BED.zustand === 'ordnet' ? `<div class="hinweis bed-grenze" data-bed-nochnicht>${h('Noch wird eingeordnet — was danach dazukommt, wird mitgefunden.')}</div>` : '';
    const liste = (rs, schwach) => {
      const docs = [];
      for (const r of rs || []) {
        if (FUND.has(r.id)) continue;
        const d = S.docs.find(x => x.id === r.id); if (!d || !imOrdner(d)) continue;
        const st = r.stueck;
        S.bedeutungFund.set(d.id, { bedeutung: true, schwach, w: r.w, anteil: r.anteil, woerter: e.woerter, funde: [{ art: 'bedeutung', wort: q, page: st.page, text: st.text.length > 160 ? st.text.slice(0, 159) + '…' : st.text, boxen: st.box ? [st.box] : [] }] });
        docs.push(d);
      }
      return docs;
    };
    const komma = x => String(x).replace('.', ',');
    const grenze = `<div class="hinweis bed-grenze" data-bed-grenze>${h('Gezeigt: höchstens ' + komma(e.r.abstand) + ' hinter dem besten Treffer, nie unter ' + komma(e.r.min) + ' · höchstens ' + e.r.max + ' · die Zahl ist eine Rangfolge, keine Prozent')}</div>`;
    let docs = liste(e.r.gezeigt, false);
    if (docs.length) return { html: `<div class="bed-kopf" data-bed-kopf>${'🧠 Nach Bedeutung ähnlich — ohne die gesuchten Wörter'}</div>` + docs.map(d => karte(d, S.bedeutungFund.get(d.id))).join('') + grenze + nochNicht, docs };
    docs = liste(e.r.schwach, true);
    if (docs.length) return { html: `<div class="bed-kopf" data-bed-schwach>${'🧠 Nichts liegt klar nah — die nächsten, mit schwacher Nähe:'}</div>` + docs.map(d => karte(d, S.bedeutungFund.get(d.id))).join('') + grenze + nochNicht, docs };
    return { html: `<div class="hinweis bed-kopf" data-bed-nichts>${'🧠 Nach Bedeutung passt kein weiteres Dokument.'}</div>` + grenze + nochNicht, docs };
  }
  function bedeutungZeile(fund) {
    const f = fund.funde[0];
    const wo = (f.page == null ? 'Nach Bedeutung, im Namen oder in den Feldern' : 'Nach Bedeutung, Seite ' + (f.page + 1)) + (fund.anteil > 0 && fund.woerter ? ' · ' + Math.round(fund.anteil * fund.woerter) + ' von ' + fund.woerter + ' Suchwörtern' : '');
    return `<div class="dok-fund" data-fundzeilen><div class="fund-zeile"><span class="fund-wo" data-art="bedeutung"${fund.anteil > 0 ? ' data-woerter="' + fund.anteil.toFixed(2) + '"' : ''}>${h(wo)}</span> <span class="fund-text" data-kein-ue>${h(f.text)}</span></div></div>`;
  }

  /* ---------- Seitentext für die Suche ----------
     Je Seite die Textstücke mit ihrer Lage in Prozent der angezeigten Seite (wie die Felder),
     damit eine Fundstelle markiert werden kann. Liegt im Fach „texte", getrennt von den Docs:
     die Bibliothek lädt die Docs bei jedem Öffnen, den Text braucht nur die Suche.
     Gescannte Seiten ohne Textebene tragen nichts bei (Texterkennung: später, Stufe 4). */
  const TEXTE = new Map();   // id → vorbereiteter Seitentext (SU.vorbereiten)
  const r2 = v => Math.round(v * 100) / 100;
  async function seitenText(pdf) {
    const seiten = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const items = [];
      try {
        const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 1 });
        const tc = await p.getTextContent();
        for (const t of tc.items) {
          if (!t.str || !t.str.trim()) continue;
          const tr = pdfjsLib.Util.transform(vp.transform, t.transform); const fh = Math.hypot(tr[2], tr[3]) || Math.abs(t.height) || 8;
          items.push([t.str, r2(tr[4] / vp.width * 100), r2((tr[5] - fh) / vp.height * 100), r2(Math.max(0.3, t.width * vp.scale / vp.width * 100)), r2(fh * 1.2 / vp.height * 100)]);
        }
      } catch (_) {}
      seiten.push(items);
    }
    return seiten;
  }
  async function textAblegen(id, seiten) { try { await DB.put('texte', { id, v: 1, seiten }); TEXTE.set(id, SU.vorbereiten(seiten)); } catch (_) {} }
  let _nachholen = null;
  function texteNachholen() {
    if (_nachholen) return _nachholen;
    _nachholen = (async () => {
      try { for (const r of await DB.all('texte')) if (!TEXTE.has(r.id)) TEXTE.set(r.id, SU.vorbereiten(r.seiten)); } catch (_) {}
      let neu = false;
      for (const d of S.docs.slice()) {
        if (TEXTE.has(d.id)) continue;
        const b = await DB.getFile(d.id); if (!b) continue;
        let pdf = null;
        try { pdf = await pdfjsLib.getDocument({ data: b.slice(0) }).promise; await textAblegen(d.id, await seitenText(pdf)); neu = true; }
        catch (_) { TEXTE.set(d.id, []); }   // unlesbar: nicht bei jedem Öffnen neu versuchen
        finally { if (pdf) { try { pdf.destroy(); } catch (_) {} } }
        if (S.suche && $('sc-bib').classList.contains('on')) zeichneBibliothek();
      }
      if (neu && S.suche && $('sc-bib').classList.contains('on')) zeichneBibliothek();
    })().finally(() => { _nachholen = null; });
    return _nachholen;
  }

  async function neuerOrdner() {
    const n = await eingabe('Neuer Ordner', 'Name des Ordners', ''); if (!n) return null;
    const o = { id: uid(), name: n, createdAt: jetzt() }; await DB.put('folders', o);
    S.aktOrdner = o.id; await ladeBibliothek(); return o;
  }
  async function verschieben(id) {
    const ids = Array.isArray(id) ? id : [id];
    const ds = ids.map(i => S.docs.find(x => x.id === i)).filter(Boolean); if (!ds.length) return;
    const d = ds[0];
    dialog(`<h2>In Ordner verschieben</h2><p class="hinweis">${ds.length === 1 ? `„${nm(d.name)}"` : `${ds.length} Dokumente`}</p>
      ${S.ordner.map(o => `<button class="wahl" data-o="${o.id}"><b>🗂️ ${nm(o.name)}</b></button>`).join('')}
      <button class="wahl" data-o=""><b>Ohne Ordner</b></button><button class="wahl" data-neu><b>＋ Neuer Ordner …</b></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (dl, zu) => {
      dl.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => { zu(); await inOrdner(ds.map(x => x.id), b.dataset.o || null); });
      dl.querySelector('[data-neu]').onclick = async () => { zu(); const o = await neuerOrdner(); if (o) await inOrdner(ds.map(x => x.id), o.id); };
      dl.querySelector('[data-x]').onclick = zu;
    });
  }
  /* ---------- Teilen, Auswahl, Ziehen auf einen Ordner (Klaus 2026-09-27) ----------
     „sodass man am schnellsten von einem Ort zum Teilen kommt, wenn man fertig ist" · „durch ein
     dauerhaftes Klick soll ein kleines Kästchen oben angehen … Klick, Klick, Klick, wie bei
     Bilderauswahl … auch mit ziehen sollen gleich mehrere selektiert werden" · „fest andrücken und
     ziehen" auf einen Ordner (die Technik aus Mein Rezeptbuch: langer Druck, ein Schattenbild folgt
     dem Finger, darunter wird per elementFromPoint gesucht). */
  const WAHL = new Set(); let WAHL_AN = false;
  const LANGDRUCK_MS = 450, ZIEH_PX = 10;
  /* Überstreichen nimmt eine Karte erst nach kurzem VERWEILEN dazu (wie VERWEIL_MS in den WorkFlohs,
     assets/wfpdf/auswahl.js). Die Ordner stehen oben: wer von einer Karte zum Ordner gleitet, fährt
     über andere Karten — die sollen nicht mitkommen. 250 ms sind gewählt, nicht am Tablet gemessen. */
  const VERWEIL_MS = 250;
  function wahlUmschalten(id) {
    if (WAHL.has(id)) WAHL.delete(id); else WAHL.add(id);
    if (!WAHL.size) WAHL_AN = false;
    wahlMarken(); wahlLeiste();
  }
  function wahlEnde() { WAHL.clear(); WAHL_AN = false; wahlMarken(); wahlLeiste(); }
  function wahlMarken() {
    document.querySelectorAll('#dokGitter .dok[data-id]').forEach(el => {
      const an = WAHL.has(el.dataset.id); el.classList.toggle('gewaehlt', an);
      const hk = el.querySelector('[data-haken]'); if (hk) { hk.textContent = an ? '✓' : ''; hk.setAttribute('aria-pressed', String(an)); }
    });
    $('dokGitter').classList.toggle('wahl-an', WAHL_AN);
  }
  function wahlLeiste() {
    const l = $('wahlLeiste'); if (!l) return;
    for (const id of [...WAHL]) if (!S.docs.some(d => d.id === id)) WAHL.delete(id);
    if (!WAHL_AN && !WAHL.size) { l.hidden = true; l.innerHTML = ''; $('dokGitter').classList.remove('wahl-an'); return; }
    l.hidden = false;
    const n = WAHL.size, alle = (S.sicht || []).length;
    l.innerHTML = `<b data-wahl-zahl="${n}">✓ ${n} ausgewählt</b>
      ${alle && n < alle ? '<button class="knopf klein" data-wahl-alle>Alle</button>' : ''}
      <button class="knopf klein primaer" data-wahl-teilen${n ? '' : ' disabled'}>📤 Teilen</button>
      <button class="knopf klein" data-wahl-verschieben${n ? '' : ' disabled'}>🗂️ Verschieben</button>
      <button class="knopf klein" data-wahl-loeschen${n ? '' : ' disabled'}>🗑 Löschen</button>
      <button class="knopf klein" data-wahl-ende>✕ Fertig</button>
      <span class="hinweis wahl-tipp">Tippen wählt · lange drücken und ziehen wählt mehrere · auf einen Ordner oben ziehen verschiebt</span>`;
    const q = s => l.querySelector(s);
    if (q('[data-wahl-alle]')) q('[data-wahl-alle]').onclick = () => { for (const d of S.sicht || []) WAHL.add(d.id); wahlMarken(); wahlLeiste(); };
    q('[data-wahl-teilen]').onclick = () => teilenDocs([...WAHL]);
    q('[data-wahl-verschieben]').onclick = () => verschieben([...WAHL]);
    q('[data-wahl-loeschen]').onclick = () => loeschenMehrere([...WAHL]);
    q('[data-wahl-ende]').onclick = wahlEnde;
    $('dokGitter').classList.toggle('wahl-an', WAHL_AN);
  }
  async function inOrdner(ids, folderId) {
    let n = 0;
    for (const id of ids) { const d = S.docs.find(x => x.id === id); if (!d || (d.folderId || null) === folderId) continue; d.folderId = folderId; await DB.put('docs', d); n++; }
    const o = S.ordner.find(x => x.id === folderId);
    toast(`🗂️ ${n} verschoben`);
    WAHL.clear(); WAHL_AN = false;
    await ladeBibliothek();
  }
  // Langer Druck (Finger) oder Mauszug: wählt, sammelt beim Ziehen weitere Karten ein, und wer auf
  // einem Ordner oben loslässt, verschiebt alles Gewählte dorthin.
  let ZG = null, klickSperre = false;
  function ziehenBinden(el, id) {
    el.addEventListener('contextmenu', e => { if (ZG) e.preventDefault(); });
    el.addEventListener('pointerdown', e => {
      if (e.button || e.target.closest('.dok-akt,[data-haken],[data-hoch],[data-fundzeilen] a')) return;
      if (ZG) ziehAus();
      ZG = { id, el, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, maus: e.pointerType === 'mouse', aktiv: false };
      ZG.timer = setTimeout(() => { if (ZG && !ZG.aktiv) ziehStart(); }, LANGDRUCK_MS);
    });
  }
  function ziehStart() {
    ZG.aktiv = true; clearTimeout(ZG.timer);
    WAHL_AN = true; WAHL.add(ZG.id); wahlMarken(); wahlLeiste();
    try { navigator.vibrate && navigator.vibrate(15); } catch (_) {}
    const g = document.createElement('div'); g.className = 'zieh-geist'; g.id = 'ziehGeist';
    ZG.geist = g; document.body.appendChild(g); ziehGeist();
    document.body.classList.add('zieht');
  }
  function ziehGeist() { if (!ZG || !ZG.geist) return; ZG.geist.textContent = `📄 ${WAHL.size} · auf einen Ordner ziehen`; ZG.geist.style.left = (ZG.x + 14) + 'px'; ZG.geist.style.top = (ZG.y + 14) + 'px'; }
  function ziehZiel() {
    document.querySelectorAll('.ordner-chip.ziel').forEach(c => c.classList.remove('ziel'));
    if (ZG.geist) ZG.geist.style.display = 'none';
    const el = document.elementFromPoint(ZG.x, ZG.y);
    if (ZG.geist) ZG.geist.style.display = '';
    const chip = el && el.closest('.ordner-chip');
    ZG.ziel = chip && (chip.hasAttribute('data-neu') || (chip.dataset.o && chip.dataset.o !== 'alle')) ? chip : null;
    if (ZG.ziel) ZG.ziel.classList.add('ziel');
    // Über eine Karte gezogen: sie kommt dazu
    const karte = el && el.closest('#dokGitter .dok[data-id]');
    if (karte !== ZG.kand) {
      clearTimeout(ZG.verweil); ZG.kand = karte;
      if (karte && !WAHL.has(karte.dataset.id)) ZG.verweil = setTimeout(() => {
        if (!ZG || ZG.kand !== karte) return;
        WAHL.add(karte.dataset.id); wahlMarken(); wahlLeiste(); ziehGeist();
      }, VERWEIL_MS);
    }
  }
  let _rollen = null;
  function ziehRollen() {
    clearInterval(_rollen); _rollen = null; if (!ZG || !ZG.aktiv) return;
    const rand = 60, h = window.innerHeight, v = ZG.y < rand ? -12 : ZG.y > h - rand ? 12 : 0;
    if (v) _rollen = setInterval(() => { window.scrollBy(0, v); if (ZG) ziehZiel(); }, 30);
  }
  function ziehAus() {
    if (!ZG) return; clearTimeout(ZG.timer); clearTimeout(ZG.verweil); clearInterval(_rollen); _rollen = null;
    if (ZG.geist) ZG.geist.remove();
    document.querySelectorAll('.ordner-chip.ziel').forEach(c => c.classList.remove('ziel'));
    document.body.classList.remove('zieht'); ZG = null;
  }
  document.addEventListener('pointermove', e => {
    if (!ZG) return; ZG.x = e.clientX; ZG.y = e.clientY;
    if (!ZG.aktiv) {
      if (Math.hypot(e.clientX - ZG.x0, e.clientY - ZG.y0) > ZIEH_PX) { if (ZG.maus) ziehStart(); else { ziehAus(); return; } }
      else return;
    }
    e.preventDefault(); ziehGeist(); ziehZiel(); ziehRollen();
  });
  // Der Finger darf die Seite nicht rollen, solange gezogen wird (Rezeptbuch: touchmove, nicht passiv)
  document.addEventListener('touchmove', e => { if (ZG && ZG.aktiv && e.cancelable) e.preventDefault(); }, { passive: false });
  document.addEventListener('pointerup', async () => {
    if (!ZG) return;
    const war = ZG.aktiv, ziel = ZG.ziel; ziehAus();
    if (!war) return;
    klickSperre = true; setTimeout(() => { klickSperre = false; }, 400);
    if (!ziel) return;
    const ids = [...WAHL];
    if (ziel.hasAttribute('data-neu')) { const o = await neuerOrdner(); if (o) await inOrdner(ids, o.id); }
    else await inOrdner(ids, ziel.dataset.o === 'ohne' ? null : ziel.dataset.o);
  });
  document.addEventListener('pointercancel', () => ziehAus());
  // Nach dem Ziehen feuert oft noch ein Klick — er darf weder öffnen noch abwählen
  document.addEventListener('click', e => { if (klickSperre && e.target.closest('#dokGitter,.ordner-leiste')) { e.preventDefault(); e.stopPropagation(); klickSperre = false; } }, true);

  /* Teilen: ein oder mehrere Dokumente als PDF an eine App geben (Mail, Messenger, Drive …).
     Mit Einträgen geht das feste PDF hinaus (die Einträge fest auf der Seite), ohne das Original.
     Teilen verlangt einen frischen Tipp; wird es nach dem Bauen verweigert, steht „📤 Jetzt teilen …" da. */
  function nimmEintraege(d) { return d.fields.some(f => f.value !== undefined && f.value !== null && f.value !== '' && f.value !== false); }
  async function teilenDocs(ids) {
    ids = ids.filter(Boolean); if (!ids.length) return;
    if (S.doc && ids.includes(S.doc.id)) await speichernJetzt();
    const fb = ids.length > 1 ? fortschritt('Dateien werden vorbereitet') : null;
    const dateien = [], hinweise = [], namen = new Set();
    try {
      for (let i = 0; i < ids.length; i++) {
        if (fb) fb.setze(i / ids.length, 'Dokument ' + (i + 1) + ' von ' + ids.length);
        const offen = S.doc && S.doc.id === ids[i];
        const d = offen ? S.doc : (S.docs.find(x => x.id === ids[i]) || await DB.get('docs', ids[i]));
        const bytes = offen ? S.bytes : await DB.getFile(ids[i]);
        if (!d || !bytes) { hinweise.push('„' + (d ? d.name : ids[i]) + '" hat keine Datei mehr — übersprungen.'); continue; }
        const m = nimmEintraege(d) ? 'fest' : 'original';
        const r = await ausgabeBytes(d, bytes, m);
        let name = dateiName(d.name) + '.pdf', k = 2; while (namen.has(name.toLowerCase())) name = dateiName(d.name) + ' (' + (k++) + ').pdf';
        namen.add(name.toLowerCase()); dateien.push({ name, bytes: r.bytes, m });
      }
    } catch (e) { if (fb) fb.zu(); console.error(e); return toast('⚠️ Teilen fehlgeschlagen: ' + (e.message || e)); }
    if (fb) fb.zu();
    if (!dateien.length) return toast('⚠️ ' + (hinweise[0] || 'Nichts zu teilen.'));
    const titel = dateien.length === 1 ? dateien[0].name.replace(/\.pdf$/, '') : dateien.length + ' PDFs';
    const files = dateien.map(f => new File([f.bytes], f.name, { type: 'application/pdf' }));
    window.__wfpdfTeilen = { ids, dateien: dateien.map(f => ({ name: f.name, groesse: f.bytes.length, m: f.m })) };
    let teilbar = false; try { teilbar = !!(navigator.canShare && navigator.canShare({ files })); } catch (_) {}
    if (teilbar && !hinweise.length) {
      try { await navigator.share({ files, title: titel }); window.__wfpdfTeilen.geteilt = true; return; }
      catch (e) { if (e && e.name === 'AbortError') return; /* verweigert (Tipp verbraucht) → Knopf unten */ }
    }
    const zipNamen = () => (S.ordner.find(o => o.id === S.aktOrdner) || {}).name || 'Workfloh PDF';
    dialog(`<h2>📤 Teilen</h2>
      <ul>${dateien.map(f => `<li><b>${nm(f.name)}</b> · ${mbText(f.bytes.length)}${f.m === 'fest' ? ' · mit Einträgen' : ''}</li>`).join('')}</ul>
      ${hinweise.map(x => '<p class="hinweis">' + h(x) + '</p>').join('')}
      ${teilbar ? '' : '<p class="hinweis" data-nicht-teilbar>Dieses Gerät kann hier nicht direkt teilen — herunterladen und dann versenden.</p>'}
      <div class="zeile">${teilbar ? '<button class="knopf primaer" data-teilen-jetzt>📤 Jetzt teilen …</button>' : ''}<button class="knopf" data-dl>⬇ ${dateien.length > 1 ? 'Als ZIP herunterladen' : 'Herunterladen'}</button><button class="knopf" data-x>Schließen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      if (d.querySelector('[data-teilen-jetzt]')) d.querySelector('[data-teilen-jetzt]').onclick = () => navigator.share({ files, title: titel }).then(() => { window.__wfpdfTeilen.geteilt = true; zu(); }).catch(() => {});
      d.querySelector('[data-dl]').onclick = () => {
        if (dateien.length === 1) laden(dateien[0].name, dateien[0].bytes);
        else laden(dateiName(zipNamen()) + '.zip', WFP.Zip.zip(dateien.map(f => ({ name: f.name, bytes: f.bytes }))), 'application/zip');
      };
    });
  }
  async function duplizieren(id) {
    const d = await DB.get('docs', id); const b = await DB.getFile(id); if (!d || !b) return;
    const n = JSON.parse(JSON.stringify(d)); n.id = uid(); n.name = d.name + ' (Kopie)'; n.createdAt = n.updatedAt = jetzt();
    n.fields.forEach(f => f.id = uid());
    await DB.putFile(n.id, b); await DB.put('docs', n); toast('⧉ Kopie angelegt'); ladeBibliothek();
  }
  async function loeschen(id) {
    const d = S.docs.find(x => x.id === id); if (!d) return;
    if (!await frage('Dokument löschen?', `<p>„${nm(d.name)}" mit ${d.fields.length} Feldern wird aus diesem Browser gelöscht. Das lässt sich nicht rückgängig machen.</p>`, 'Löschen')) return;
    await DB.del('docs', id); await DB.del('files', id); toast('🗑 gelöscht'); ladeBibliothek();
  }

  /* Mehrere auf einmal löschen (Klaus 2026-09-27: „Löschen ist auch eine Option"). Eine Frage für alle,
     mit der Zahl und den Namen — nie still. Gelöscht wird Dokument für Dokument wie beim Einzel-Löschen. */
  async function loeschenMehrere(ids) {
    const docs = ids.map(id => S.docs.find(x => x.id === id)).filter(Boolean); if (!docs.length) return;
    const liste = docs.slice(0, 8).map(d => `<li>${nm(d.name)}</li>`).join('') + (docs.length > 8 ? `<li>… und ${docs.length - 8} weitere</li>` : '');
    if (!await frage(`${docs.length} Dokumente löschen?`, `<p>Diese Dokumente werden aus diesem Browser gelöscht. Das lässt sich nicht rückgängig machen.</p><ul>${liste}</ul>`, 'Löschen')) return;
    for (const d of docs) { await DB.del('docs', d.id); await DB.del('files', d.id); WAHL.delete(d.id); }
    WAHL_AN = false; WAHL.clear();
    toast(`🗑 ${docs.length} gelöscht`); ladeBibliothek();
  }

  /* ---------- Import ---------- */
  const istPdf = f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const istBild = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(f.name);
  const istStand = f => /\.json$/i.test(f.name) || f.type === 'application/json';

  // Foto verkleinern statt abweisen (Lehre aus den Rezeptbüchern): die Kamera
  // entscheidet die Auflösung, nicht der Nutzer. Lange Kante ≤ 2400 px, JPEG.
  // Seit 2026-09-25: das Blatt im Foto wird gesucht und auf A4 gerade gezogen
  // (assets/blatt.js) — ein Brief vom Amt soll ausgedruckt so groß sein wie
  // vorher. Beide Fassungen werden behalten, damit man umschalten kann.
  async function bildNormalisieren(file) {
    let bmp = null;
    try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) {
      const url = URL.createObjectURL(file);
      try { bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Bild „' + file.name + '" lässt sich nicht lesen')); i.src = url; }); }
      finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    }
    const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
    const f = Math.min(1, 2400 / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.round(w0 * f); c.height = Math.round(h0 * f);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    const BL = window.WFP && WFP.Blatt;
    if (!BL) { const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.88)); return { bytes: new Uint8Array(await blob.arrayBuffer()), vorschau: c.toDataURL('image/jpeg', 0.5) }; }
    const fund = BL.finden(c);
    const fassung = async cv => ({ bytes: new Uint8Array(await (await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.88))).arrayBuffer()), vorschau: cv.toDataURL('image/jpeg', 0.5), seite: cv.width > cv.height ? [BL.A4.h, BL.A4.w] : [BL.A4.w, BL.A4.h] });
    const ganz = await fassung(BL.aufA4(c));
    const gerade = fund.sicher ? await fassung(BL.entzerren(c, fund.ecken, fund.quer)) : null;
    const b = Object.assign({}, gerade || ganz, { blatt: { erkannt: !!gerade, grund: fund.grund || '', anteil: Math.round(fund.anteil * 100) / 100 }, fassungen: { gerade, ganz }, gewaehlt: gerade ? 'gerade' : 'ganz' });
    window.__wfpdfBlatt = { erkannt: !!gerade, grund: fund.grund || '', ecken: fund.ecken, quelle: [c.width, c.height] };
    return b;
  }

  async function seitenInfo(pdf) {
    const pages = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 1 });
      pages.push({ w: vp.width, h: vp.height, t: vp.transform.slice(), rot: p.rotate || 0 });
    }
    return pages;
  }
  async function vorschaubild(pdf) {
    const p = await pdf.getPage(1); const v1 = p.getViewport({ scale: 1 }); const vp = p.getViewport({ scale: 260 / v1.width });
    const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    await p.render({ canvasContext: x, viewport: vp }).promise;
    return c.toDataURL('image/jpeg', 0.7);
  }
  // Vorhandene Formularfelder des PDFs übernehmen — die sind echt, keine Vorschläge.
  async function vorhandeneFelder(pdf) {
    const out = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const p = await pdf.getPage(n); const vp = p.getViewport({ scale: 1 });
      let an = []; try { an = await p.getAnnotations(); } catch (_) {}
      for (const a of an) {
        if (a.subtype !== 'Widget' || !a.rect) continue;
        let type = null;
        if (a.fieldType === 'Tx') type = 'text'; else if (a.fieldType === 'Btn' && (a.checkBox || a.radioButton)) type = 'check';
        if (!type) continue;
        const r = vp.convertToViewportRectangle(a.rect);
        const x0 = Math.min(r[0], r[2]), y0 = Math.min(r[1], r[3]), x1 = Math.max(r[0], r[2]), y1 = Math.max(r[1], r[3]);
        let val = a.fieldValue;
        if (type === 'check') val = !!(val && val !== 'Off' && val !== a.exportValue + '_off');
        out.push({ id: uid(), page: n - 1, type, label: String(a.alternativeText || a.fieldName || '').slice(0, 60), mehrzeilig: !!a.multiLine,
          x: x0 / vp.width * 100, y: y0 / vp.height * 100, w: (x1 - x0) / vp.width * 100, h: (y1 - y0) / vp.height * 100,
          value: type === 'check' ? val : (typeof val === 'string' ? val : ''), herkunft: 'pdf', geprueft: true });
      }
    }
    return out;
  }
  async function neuesDok(name, bytes, quelle, folderId, original) {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const d = { id: uid(), name, folderId: folderId || null, quelle, createdAt: jetzt(), updatedAt: jetzt(),
      pages: await seitenInfo(pdf), thumb: await vorschaubild(pdf), fields: await vorhandeneFelder(pdf) };
    const text = await seitenText(pdf);
    try { pdf.destroy(); } catch (_) {}
    await DB.putFile(d.id, bytes); await DB.put('docs', d); await textAblegen(d.id, text);
    // Was von außen kommt (PDF, Foto), wird beim Einlesen geprüft — eigene Ausgaben (Übersetzung, Teil) nicht
    if (EINGANG_QUELLEN.includes(quelle)) eingangPruefen(d.id, original ? original.name : name + '.pdf', original ? original.bytes : bytes);
    return d;
  }
  // Ein abgelegtes Dokument mit neuem Inhalt: Kennung, Ordner und Anlagedatum bleiben
  async function dokErsetzen(alt, name, bytes) {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const d = Object.assign({}, alt, { name: name || alt.name, updatedAt: jetzt(), pruefung: undefined,
      pages: await seitenInfo(pdf), thumb: await vorschaubild(pdf), fields: await vorhandeneFelder(pdf) });
    const text = await seitenText(pdf);
    try { pdf.destroy(); } catch (_) {}
    await DB.putFile(d.id, bytes); await DB.put('docs', d); await textAblegen(d.id, text);
    if (EINGANG_QUELLEN.includes(d.quelle)) eingangPruefen(d.id, d.name + '.pdf', bytes);
    return d;
  }
  let _persistGefragt = false;

  /* ---------- Prüfung beim Einlesen (assets/eingang.js, Klaus 2026-10-01) ----------
     „Schon wenn ich ein Foto mache, kann das ja passieren. Oder Importdatei." Jede PDF,
     jedes Foto, jeder Scan und jede Arbeitsstand-Datei geht nach dem Ablegen im Hintergrund
     durch den Prüfkern des Auslieferungsprüfers. Ein Fund wird MARKIERT, nicht entfernt:
     das Original bleibt, wie es kam, und der Dialog sagt, was jetzt zu tun ist (beim
     Absender nachfragen). Eine Prüfung nach der anderen — zwei Texterkennungen zugleich
     brächten ein Tablet ins Schwitzen. */
  const EINGANG_QUELLEN = ['pdf', 'foto'];
  const PRUEF = { laufend: new Set(), kette: Promise.resolve(), fertig: 0 };
  function eingangPruefen(id, name, bytes) {
    if (!window.WFP || !WFP.Eingang) return;
    const b = new Uint8Array(bytes).slice(0);
    PRUEF.laufend.add(id);
    PRUEF.kette = PRUEF.kette.then(async () => {
      const r = await WFP.Eingang.pruefen(name, b);
      const d = await DB.get('docs', id);
      if (!d) { PRUEF.laufend.delete(id); PRUEF.fertig++; return; }   // inzwischen gelöscht
      d.pruefung = r; await DB.put('docs', d);
      // Dasselbe Objekt behalten, nur die Angabe setzen: andere Stellen (Suche, Einordnen) halten es in der Hand
      const e = S.docs.find(x => x.id === id); if (e) e.pruefung = r;
      if (S.doc && S.doc.id === id) S.doc.pruefung = r;  // sonst überschriebe das nächste Speichern den Befund
      // Erst JETZT als fertig austragen: vorher stand ein „fertig" da, während der Befund noch fehlte
      // (die Probe las unter Last null — gemessen in der vollen npm-test-Kette, 2026-10-01).
      PRUEF.laufend.delete(id); PRUEF.fertig++;
      markeErneuern(id);
      // Ein Fenster genügt: kommen beim Einlesen eines Ordners mehrere Funde, trägt jede Karte ihre Marke
      // Nie über einen offenen Dialog legen (Übersetzen, Ordner …): dort tippt gerade jemand.
      // Der Befund bleibt an der Karte stehen („⚠ Verdächtiger Inhalt — ansehen").
      if (r.stand === 'warnung' && !document.querySelector('.dlg')) pruefDialog(id);
    }).catch(e => { PRUEF.laufend.delete(id); markeErneuern(id); console.error(e); });
    markeErneuern(id);
  }
  /* Nur die Marke an DER einen Karte erneuern — nie die ganze Bibliothek neu zeichnen: mitten in
     einer Suche stünde die Liste sonst halb da (gemessen: die Bedeutungs-Suche verlor einen Treffer),
     und am Tablet spränge sie unter dem Finger. Steht die Karte (noch) nicht da, zeichnet das
     nächste Zeichnen sie ohnehin mit der richtigen Marke. */
  function markeErneuern(id) {
    const k = document.querySelector(`.dok[data-id="${id}"]`), d = S.docs.find(x => x.id === id);
    if (!k || !d) return;
    const alt = k.querySelector('.dok-pruefung'); if (alt) alt.remove();
    const html = pruefMarke(d); if (!html) return;
    const metas = k.querySelectorAll(':scope .dok-meta'), nach = metas[metas.length - 1];
    if (nach) nach.insertAdjacentHTML('afterend', html); else k.insertAdjacentHTML('beforeend', html);
    const pk = k.querySelector('[data-pruef]'); if (pk) pk.onclick = () => pruefDialog(id);
  }
  function pruefMarke(d) {
    const p = d.pruefung;
    if (PRUEF.laufend.has(d.id)) return '<div class="dok-pruefung" data-pruefung="laeuft">⏳ Wird auf versteckte Anweisungen geprüft …</div>';
    if (!p) return '';
    if (p.stand === 'warnung') return '<button class="dok-pruefung warn" data-pruef data-pruefung="warnung">⚠ Verdächtiger Inhalt — ansehen</button>';
    if (p.stand === 'ungeprueft') return '<button class="dok-pruefung" data-pruef data-pruefung="ungeprueft">? Nicht ganz geprüft</button>';
    return '';
  }
  async function pruefDialog(id) {
    const d = (S.doc && S.doc.id === id) ? S.doc : S.docs.find(x => x.id === id) || await DB.get('docs', id);
    if (!d || !d.pruefung) return;
    const p = d.pruefung;
    try { await WFP.Eingang.bereit(); } catch (_) {}
    const arten = [...new Set(p.funde.map(f => f.kennung))];
    const tun = [];
    for (const k of arten) for (const x of WFP.Eingang.wasTun(k)) if (!tun.includes(x)) tun.push(x);
    const zeit = p.zeit ? new Date(p.zeit).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : '';
    const kopf = p.stand === 'warnung' ? '⚠ Verdächtiger Inhalt' : p.stand === 'ungeprueft' ? '? Nicht ganz geprüft' : '✓ Beim Einlesen nichts Verdächtiges gefunden';
    dialog(`<h2>${h(kopf)}</h2>
      <p class="pruef-name" data-kein-ue>${h(d.name)}</p>
      ${p.funde.length ? `<p>Beim Einlesen geprüft. Gefunden:</p><ul class="pruef-funde" data-pruef-funde>${p.funde.map(f => `<li data-kennung="${h(f.kennung)}"><b>${h(WFP.Eingang.NAME[f.kennung] || f.kennung)}</b><br><span data-kein-ue>${h(f.satz)}</span></li>`).join('')}</ul>` : ''}
      ${p.markiert ? `<figure class="pruef-markiert" data-pruef-markiert><img alt="Die Stelle im Bild, rot umrandet" src="${h(p.markiert)}"><figcaption>Die Stelle im Bild, rot umrandet. Das ist eine Kopie — das Original bleibt unverändert.</figcaption></figure>` : ''}
      ${tun.length ? `<div class="pruef-tun" data-was-tun><p><b>Was jetzt tun</b></p><ol>${tun.map(x => '<li data-kein-ue>' + h(x) + '</li>').join('')}</ol></div>` : ''}
      ${p.stand === 'warnung' ? '<p class="hinweis" data-pruef-original>Nichts wurde entfernt: das Dokument steht unverändert in der Bibliothek. Vor dem Übersetzen oder dem Erkennen mit KI: beim Absender nachfragen, was es mit dieser Stelle auf sich hat.</p>' : ''}
      ${p.hinweise && p.hinweise.length ? `<details class="pruef-grenzen"><summary>Was geprüft wurde</summary><ul>${p.hinweise.map(x => '<li data-kein-ue>' + h(x) + '</li>').join('')}</ul></details>` : ''}
      <p class="hinweis">Geprüft <span data-kein-ue>${h(zeit)}</span> auf diesem Gerät, ohne Netz. Die Sätze der Prüfung stehen auf Deutsch.</p>
      <div class="zeile">${p.markiert ? '<button class="knopf" data-markiert-laden>⬇ Markierte Kopie speichern</button>' : ''}<button class="knopf rot" data-x>OK</button></div>`,
      (dl, zu) => {
        dl.querySelector('[data-x]').onclick = zu;
        const ml = dl.querySelector('[data-markiert-laden]');
        if (ml) ml.onclick = () => fetch(p.markiert).then(r => r.blob()).then(b => laden(dateiName(d.name) + '-markiert.jpg', b, 'image/jpeg'));
      });
  }

  /* ---------- Arbeitsstand: Datei zum Weiterarbeiten ----------
     Der Browserspeicher gehört zu genau EINEM Browser (DeX-Chrome und
     Tablet-Chrome sind zwei) und ist weg, wenn Browserdaten gelöscht werden.
     Die Arbeitsstand-Datei trägt PDF + Felder + Einträge und lässt sich überall
     wieder einlesen. */
  const STAND_FORMAT = 'workfloh-pdf-arbeitsstand';
  function zuB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function ausB64(b) { const s = atob(b); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
  function standDatei(doc, bytes) {
    const inhalt = JSON.stringify({ format: STAND_FORMAT, version: 1, gesichert: jetzt(), doc, pdf: zuB64(bytes) });
    return new File([inhalt], dateiName(doc.name) + '.workfloh.json', { type: 'application/json' });
  }
  async function staendeEinlesen(dateien) {
    const neu = [], fehler = [];
    for (const f of dateien) {
      try {
        const j = JSON.parse(await f.text());
        if (!j || j.format !== STAND_FORMAT || !j.doc || !j.pdf || !Array.isArray(j.doc.fields)) throw new Error('keine Workfloh-PDF-Arbeitsdatei');
        const d = j.doc, bytes = ausB64(j.pdf);
        const vorhanden = await DB.get('docs', d.id);
        let hinweis = '';
        if (vorhanden && String(vorhanden.updatedAt || '') > String(d.updatedAt || '')) {
          d.id = uid(); d.name = d.name + ' (Arbeitsstand ' + new Date(j.gesichert || d.updatedAt).toLocaleDateString('de-DE') + ')';
          hinweis = ' · im Browser lag ein neuerer Stand, deshalb als Kopie';
        } else if (vorhanden) hinweis = ' · Stand im Browser ersetzt';
        if (d.folderId && !S.ordner.some(o => o.id === d.folderId)) d.folderId = null;
        delete d.pruefung;                                  // ein Befund aus einer fremden Datei wird nicht geglaubt
        await DB.putFile(d.id, bytes); await DB.put('docs', d);
        eingangPruefen(d.id, d.name + '.pdf', bytes);
        neu.push({ d, hinweis });
      } catch (e) { fehler.push(f.name + ': ' + (e.message || e)); }
    }
    await ladeBibliothek();
    if (fehler.length) dialog(`<h2>Arbeitsstand nicht eingelesen</h2><ul>${fehler.map(x => '<li>' + h(x) + '</li>').join('')}</ul><div class="zeile"><button class="knopf rot" data-x>OK</button></div>`, (d, zu) => d.querySelector('[data-x]').onclick = zu);
    if (neu.length === 1) { toast('📂 Arbeitsstand „' + neu[0].d.name + '" eingelesen' + neu[0].hinweis); oeffneDok(neu[0].d.id); }
    else if (neu.length) toast('📂 ' + neu.length + ' Arbeitsstände eingelesen');
  }
  async function speichernDialog() {
    await speichernJetzt();
    const zeit = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    let dauerhaft = null; try { dauerhaft = navigator.storage && navigator.storage.persisted ? await navigator.storage.persisted() : null; } catch (_) {}
    dialog(`<h2>💾 Gespeichert</h2>
      <p>✓ <b>In diesem Browser gespeichert (${zeit} Uhr).</b> Du findest das Dokument in der Bibliothek und kannst jederzeit weitermachen.</p>
      <p class="hinweis">Der Browserspeicher gilt nur für <b>diesen</b> Browser${dauerhaft === true ? ' (vom Browser als dauerhaft bestätigt)' : ''}. Ein anderer Browser (z.&nbsp;B. DeX und Tablet) sieht ihn nicht, und „Browserdaten löschen" löscht ihn mit.</p>
      <p><b>Sicher weiterarbeiten:</b> Arbeitsstand als Datei aufs Gerät legen. Sie enthält das PDF, alle Felder und Einträge. Später über „📄 PDF oder Bild" wieder einlesen — auch in einem anderen Browser.</p>
      <div class="zeile"><button class="knopf" data-x>Schließen</button><button class="knopf rot" data-dl>⬇ Arbeitsstand als Datei sichern</button></div>`,
      (d, zu) => {
        d.querySelector('[data-x]').onclick = zu;
        const b = d.querySelector('[data-dl]');
        b.onclick = () => { const f = standDatei(S.doc, S.bytes); laden(f.name, f, 'application/json'); toast('⬇ ' + f.name + ' gespeichert'); zu(); };
        if (navigator.canShare) { try { const f = standDatei(S.doc, S.bytes); if (navigator.canShare({ files: [f] })) { b.insertAdjacentHTML('beforebegin', '<button class="knopf" data-teilen>📤 Teilen …</button>'); d.querySelector('[data-teilen]').onclick = () => navigator.share({ files: [f], title: S.doc.name }).catch(() => {}); } } catch (_) {} }
      });
  }
  async function importDateien(dateien, ordnerName, opt) {
    opt = opt || {};
    const staende = Array.from(dateien || []).filter(istStand);
    if (staende.length) { await staendeEinlesen(staende); dateien = Array.from(dateien).filter(f => !istStand(f)); if (!dateien.length) return []; }
    const liste = Array.from(dateien || []).filter(f => istPdf(f) || istBild(f)).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'de', { numeric: true }));
    const uebrig = (dateien ? dateien.length : 0) - liste.length;
    if (!liste.length) { toast('Keine PDF- oder Bilddatei gefunden.'); return []; }
    if (!_persistGefragt) { _persistGefragt = true; DB.persist(); }
    let folderId = (S.ordner.some(o => o.id === S.aktOrdner)) ? S.aktOrdner : null;
    if (ordnerName) {
      let o = S.ordner.find(x => x.name === ordnerName);
      if (!o) { o = { id: uid(), name: ordnerName, createdAt: jetzt() }; if (opt.bereich) o.bereich = opt.bereich; await DB.put('folders', o); }
      folderId = o.id;
    }
    const fb = liste.length > 1 ? fortschritt('Dokumente einlesen') : null;
    const neu = [], fehler = [];
    for (let i = 0; i < liste.length; i++) {
      const f = liste[i]; if (fb) fb.setze(i / liste.length, f.name);
      try {
        let bytes, quelle = 'pdf', original = null;
        if (istPdf(f)) bytes = new Uint8Array(await f.arrayBuffer());
        else { original = { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }; const b = await bildNormalisieren(f); bytes = await EX.bilderZuPdf([b]); quelle = 'foto'; }
        neu.push(await neuesDok(f.name.replace(/\.[^.]+$/, ''), bytes, quelle, folderId, original));
      } catch (e) {
        console.error(e);
        fehler.push(f.name + ': ' + (/password/i.test(e && e.name + e.message) ? 'passwortgeschützt' : (e.message || e)));
      }
    }
    if (fb) fb.zu();
    if (folderId) S.aktOrdner = folderId;
    await ladeBibliothek(); hops();
    if (fehler.length) dialog(`<h2>Nicht alles ließ sich einlesen</h2><ul>${fehler.map(x => '<li>' + h(x) + '</li>').join('')}</ul><div class="zeile"><button class="knopf rot" data-x>OK</button></div>`, (d, zu) => d.querySelector('[data-x]').onclick = zu);
    const msg = neu.length + ' Dokument' + (neu.length === 1 ? '' : 'e') + ' eingelesen' + (uebrig > 0 ? ' · ' + uebrig + ' andere Dateien übersprungen' : '');
    if (opt.still) { toast(msg); return neu; }
    if (neu.length > 1) toast(msg, { text: '🤖 Felder erkennen', tun: () => erkennenDialog(neu.map(d => d.id)) });
    else if (neu.length === 1) { toast(msg); oeffneDok(neu[0].id); }
    return neu;
  }

  /* ---------- Scannen: Foto → PDF (assets/scanner.js, Klaus 2026-09-26) ----------
     Ersetzt die frühere Aufnahme-Liste: jedes Foto bekommt Zuschnitt mit Ecken zum
     Nachziehen, Filter, Drehen, Texterkennung und änderbaren Text. Drei Wege führen
     hinein: „📷 Scannen" in der Bibliothek, „Brief fotografieren" beim Übersetzen und
     „Seite fotografieren" beim Anhängen. */
  function scanStarten(ziel, start) {
    const titel = ziel === 'uebersetzung' ? 'Brief fotografieren' : ziel === 'anhang' ? 'Seiten fotografieren und anhängen' : 'Scannen';
    const fertigText = ziel === 'uebersetzung' ? 'Weiter zum Übersetzen' : ziel === 'anhang' ? 'Seiten anhängen' : 'PDF erstellen';
    /* Aus der Bibliothek gescannt: jedes fertige PDF landet hier, auch beim Herunterladen und
       Teilen (Klaus 2026-09-27). Wer danach noch einmal ablegt, ersetzt DASSELBE Dokument. */
    const ablegen = async (bytes, info) => {
      const alt = info.id ? await DB.get('docs', info.id) : null;
      if (alt) { await dokErsetzen(alt, info.name, bytes); await ladeBibliothek(); return alt.id; }
      const folderId = S.ordner.some(o => o.id === S.aktOrdner) ? S.aktOrdner : null;
      const doc = await neuesDok(info.name, bytes, 'foto', folderId);
      await ladeBibliothek(); return doc.id;
    };
    return WFP.Scanner.oeffnen({ titel, fertigText, start, toast, dialog, frage, fortschritt, laden,
      ablegen: ziel === 'uebersetzung' || ziel === 'anhang' ? null : ablegen,
      fertig: async (bytes, info) => {
        if (ziel === 'uebersetzung') { await ueFotoAblegen(bytes); return; }
        if (ziel === 'anhang' && S.doc) { await seitenAnhaengen([bytes]); return; }
        const id = await ablegen(bytes, info);
        hops(); oeffneDok(id);
      } });
  }

  /* ---------- Editor ---------- */
  // Öffnen ist asynchron (PDF laden): wer inzwischen zurück tippt oder ein anderes
  // Dokument öffnet, darf nicht von einem verspäteten Öffnen überholt werden.
  let _oeffnenNr = 0;
  async function oeffneDok(id, fund) {
    const nr = ++_oeffnenNr;
    S.funde = []; S.fundIdx = -1;
    // Aus der Bibliothek-Suche geöffnet: dieselben Wörter stehen im Suchfeld des Dokuments
    $('edSuche').value = fund ? String(S.suche || '') : ''; zeichneSuchZahl();
    const d = await DB.get('docs', id); const b = await DB.getFile(id);
    if (nr !== _oeffnenNr) return;
    if (!d || !b) { toast('⚠️ Dokument nicht gefunden'); return; }
    if (S.pdf) { try { S.pdf.destroy(); } catch (_) {} }
    S.doc = d; S.bytes = b; S.sel = null; S.platzieren = null; S.zoom = 1;
    S.modus = d.fields.length && !offeneVorschlaege(d) ? 'ausfuellen' : 'bearbeiten';
    let pdf;
    try { pdf = await pdfjsLib.getDocument({ data: b.slice(0) }).promise; }
    catch (e) { if (nr === _oeffnenNr) toast('⚠️ PDF lässt sich nicht öffnen: ' + (e.message || e)); return; }
    if (nr !== _oeffnenNr || S.doc !== d) { try { pdf.destroy(); } catch (_) {} return; }
    S.pdf = pdf;
    $('sc-bib').classList.remove('on'); $('sc-ed').classList.add('on');
    $('edName').value = d.name; $('kopfSub').setAttribute('data-kein-ue', ''); $('kopfSub').textContent = d.name;
    history.pushState({ ed: 1 }, '', '#dok');
    zeichneSeiten(); zeichneModus();
    if (fund && fund.bedeutung) {
      // Nach Bedeutung gefunden: kein Wort zum Suchen — markiert wird der Abschnitt, der am nächsten lag
      S.funde = fundMarken(fund); S.fundIdx = S.funde.length ? 0 : -1; funde_neu_zeichnen(); zeichneSuchZahl();
      if (S.funde.length) { springeZuFund(0); toast('🧠 Der ähnlichste Abschnitt ist markiert — antippen blendet ihn aus'); }
    } else if (fund) {
      await imDokSuchen(S.suche, true);
      if (S.funde.length) toast('🔎 ' + S.funde.length + ' Fundstellen markiert — antippen blendet sie aus');
    }
  }
  /* Im Dokument suchen: dieselbe Rechnung wie die Bibliothek (assets/suche.js), nur für dieses
     Dokument. Fehlt der Seitentext noch, wird er jetzt aus dem offenen PDF erfasst. */
  async function imDokSuchen(q, stumm) {
    const d = S.doc; if (!d) return;
    const toks = SU.anfrage(q);
    if (toks.length && !TEXTE.has(d.id) && S.pdf) await textAblegen(d.id, await seitenText(S.pdf));
    if (S.doc !== d) return;
    const ordn = S.ordner.find(x => x.id === d.folderId);
    const r = toks.length ? SU.sucheDok(Object.assign({}, d, { ordner: ordn ? ordn.name : '' }), TEXTE.get(d.id) || null, toks) : null;
    S.funde = fundMarken(r).sort((a, b) => a.page - b.page || a.y - b.y || a.x - b.x);
    S.fundIdx = S.funde.length ? 0 : -1;
    funde_neu_zeichnen(); zeichneSuchZahl();
    if (S.funde.length) springeZuFund(0);
    else if (toks.length && !stumm) toast('🔎 Kein Treffer in diesem Dokument');
  }
  function funde_neu_zeichnen() {
    document.querySelectorAll('#seiten .fund').forEach(e => e.remove());
    document.querySelectorAll('#seiten .seite').forEach(el => { const lage = el.querySelector('.lage'); if (lage) zeichneFunde(+el.dataset.i, lage); });
  }
  function zeichneSuchZahl() {
    const z = $('edSuchZahl'); if (!z) return;
    const q = SU.anfrage($('edSuche').value);
    z.textContent = !q.length ? '' : S.funde.length ? (Math.max(0, S.fundIdx) + 1) + ' / ' + S.funde.length : 'kein Treffer';
  }
  function springeZuFund(i) {
    if (!S.funde.length) return;
    S.fundIdx = (i + S.funde.length) % S.funde.length;
    const m = S.funde[S.fundIdx];
    document.querySelectorAll('#seiten .fund.akt').forEach(e => e.classList.remove('akt'));
    const el = document.querySelector(`#seiten .fund[data-fund="${m.id}"]`) || document.querySelector(`.seite[data-i="${m.page}"]`);
    if (el) { el.classList.add('akt'); setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60); }
    zeichneSuchZahl();
  }
  // Aus den Funden der Suche die Markierungen für die Seiten (Feld und Seitentext; der Name hat keine Stelle)
  function fundMarken(fund) {
    const out = [];
    if (!fund) return out;
    for (const f of fund.funde) for (const b of f.boxen || []) if (f.page != null && b) out.push({ id: uid(), page: f.page, x: b.x, y: b.y, w: b.w, h: b.h, wort: f.wort, art: f.art });
    return out;
  }
  function zeichneFunde(i, lage) {
    for (const m of S.funde || []) {
      if (m.page !== i) continue;
      const el = document.createElement('div'); el.className = 'fund' + (S.funde[S.fundIdx] === m ? ' akt' : ''); el.dataset.fund = m.id; el.dataset.art = m.art;
      el.setAttribute('data-kein-ue', '');   // der Titel ist schon übersetzt (T) und trägt das Suchwort des Nutzers
      el.style.left = (m.x - 0.4) + '%'; el.style.top = (m.y - 0.3) + '%'; el.style.width = (m.w + 0.8) + '%'; el.style.height = (m.h + 0.6) + '%';
      el.title = T('Gefunden wegen') + ' „' + m.wort + '" — ' + T('antippen blendet es aus');
      // Ein Tipp nimmt die Markierung weg — nur diese; das Feld darunter bleibt, wie es war
      const weg = e => { e.preventDefault(); e.stopPropagation(); S.funde = S.funde.filter(x => x.id !== m.id); el.remove(); S.fundIdx = Math.min(S.fundIdx, S.funde.length - 1); zeichneSuchZahl(); };
      el.addEventListener('pointerdown', e => e.stopPropagation());
      el.addEventListener('click', weg);
      lage.appendChild(el);
    }
  }
  async function schliesseEditor(ohneHistory) {
    _oeffnenNr++;
    await speichernJetzt();
    $('sc-ed').classList.remove('on'); $('sc-bib').classList.add('on');
    $('kopfSub').removeAttribute('data-kein-ue'); $('kopfSub').textContent = 'Formulare einlesen · Felder setzen · übersetzen · PDF ausgeben';
    if (S.beob) { S.beob.disconnect(); S.beob = null; }
    S.doc = null; S.sel = null; S.funde = []; S.fundIdx = -1; $('edSuche').value = '';
    if (!ohneHistory && location.hash === '#dok') history.back();
    ladeBibliothek();
  }
  let _st = null;
  function speichern() { if (!S.doc) return; S.doc.updatedAt = jetzt(); clearTimeout(_st); _st = setTimeout(speichernJetzt, 350); }
  async function speichernJetzt() { clearTimeout(_st); _st = null; if (S.doc) { try { await DB.put('docs', S.doc); } catch (e) { toast('⚠️ Speichern fehlgeschlagen: ' + e.message); } } }

  let _rzBreite = 0;   // Breite beim letzten Zeichnen (siehe resize)
  function seitenBreite() { const fl = $('edFlaeche'); return Math.round(Math.min(fl.clientWidth - 24, 920) * S.zoom); }
  function zeichneSeiten() {
    const box = $('seiten'); box.innerHTML = '';
    if (S.beob) S.beob.disconnect();
    S.beob = new IntersectionObserver(eintraege => { for (const e of eintraege) if (e.isIntersecting) seiteRendern(+e.target.dataset.i); }, { root: $('edFlaeche'), rootMargin: '800px 0px' });
    const bw = seitenBreite(); _rzBreite = bw;
    S.doc.pages.forEach((p, i) => {
      const el = document.createElement('div'); el.className = 'seite'; el.dataset.i = i;
      el.style.width = bw + 'px'; el.style.height = Math.round(bw * p.h / p.w) + 'px';
      el.innerHTML = `<span class="seite-nr">Seite ${i + 1} / ${S.doc.pages.length}</span><canvas></canvas><div class="lage"></div>`;
      const lage = el.querySelector('.lage');
      lage.addEventListener('pointerdown', e => {
        if (e.target !== lage) return;
        if (S.platzieren) { feldSetzen(i, e, lage); return; }
        if (S.sel) { S.sel = null; markiere(); zeichneFuss(); }
      });
      box.appendChild(el); S.beob.observe(el);
      zeichneFelder(i);
    });
  }
  const _gerendert = new Map();
  async function seiteRendern(i) {
    const el = document.querySelector(`.seite[data-i="${i}"]`); if (!el || !S.pdf) return;
    const key = el.clientWidth + ':' + S.doc.id; if (_gerendert.get(el) === key) return; _gerendert.set(el, key);
    try {
      const p = await S.pdf.getPage(i + 1); const v1 = p.getViewport({ scale: 1 });
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      const vp = p.getViewport({ scale: el.clientWidth / v1.width * dpr });
      const c = el.querySelector('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      await p.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
    } catch (e) { _gerendert.delete(el); console.error(e); }
  }
  function zoom(f) { S.zoom = clamp(S.zoom * f, 0.5, 3); zeichneSeiten(); }

  function feldText(f) {
    if (f.type === 'datum') return EX.datumText(f.value);
    return String(f.value == null ? '' : f.value);
  }
  function qrSvg(text) {
    try { const q = qrcode(0, 'M'); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 2, margin: 0, scalable: true }); }
    catch (_) { return '<span class="qrleer">zu lang für einen QR-Code</span>'; }
  }
  function zeichneFelder(i) {
    const lage = document.querySelector(`.seite[data-i="${i}"] .lage`); if (!lage) return;
    lage.innerHTML = '';
    for (const f of S.doc.fields) if (f.page === i) lage.appendChild(feldElement(f));
    zeichneFunde(i, lage);
    markiere();
  }
  function feldElement(f) {
    const el = document.createElement('div');
    el.className = 'feld' + (!f.geprueft ? ' ki' : '') + (f.type === 'check' ? ' check-feld' : '') + ((f.type === 'check' ? f.value : f.value !== '' && f.value != null) ? ' hatwert' : '');
    el.dataset.id = f.id;
    el.setAttribute('data-kein-ue', '');   // Bezeichnung und Eintrag gehören dem Nutzer
    el.style.left = f.x + '%'; el.style.top = f.y + '%'; el.style.width = f.w + '%'; el.style.height = f.h + '%';
    if (f.decken) el.style.backgroundColor = f.decken;
    const hoehePx = () => el.getBoundingClientRect().height || 20;
    if (S.modus === 'ausfuellen') {
      if (f.type === 'check') {
        el.innerHTML = `<span class="kreuz">${f.value ? '✓' : ''}</span>`;
        el.onclick = () => { f.value = !f.value; el.querySelector('.kreuz').textContent = f.value ? '✓' : ''; speichern(); };
        el.title = f.label || T('Kästchen');
      } else if (f.type === 'unterschrift') {
        el.innerHTML = f.value ? `<img class="usbild" src="${h(f.value)}" alt="Unterschrift">` : '<span class="usleer">' + h(T('✒️ hier unterschreiben')) + '</span>';
        el.onclick = () => unterschreiben(f);
        el.title = f.label || T('Unterschrift');
      } else if (f.type === 'qr') {
        el.innerHTML = `<div class="qrbild">${f.value ? qrSvg(f.value) : '<span class="qrleer">' + h(T('QR-Inhalt unten eingeben')) + '</span>'}</div>`;
        el.onclick = () => { S.sel = f.id; markiere(); zeichneFuss(); };
      } else {
        const inp = document.createElement(f.mehrzeilig ? 'textarea' : 'input');
        if (!f.mehrzeilig) inp.type = f.type === 'datum' ? 'date' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : f.type === 'tel' ? 'tel' : 'text';
        inp.value = f.value || ''; inp.placeholder = ''; inp.title = f.label || T(TYPEN[f.type].name); inp.setAttribute('aria-label', f.label || T(TYPEN[f.type].name));
        inp.oninput = () => { f.value = inp.value; speichern(); };
        inp.onblur = () => speichernJetzt();
        inp.onfocus = () => { S.sel = f.id; markiere(); };
        requestAnimationFrame(() => { const hp = hoehePx(); inp.style.fontSize = Math.max(9, Math.min(f.mehrzeilig ? 16 : 22, hp * (f.mehrzeilig ? 0.34 : 0.62))) + 'px'; });
        el.appendChild(inp);
        if (f.type !== 'datum') linkFeld(f, inp, el);
      }
      return el;
    }
    // Bearbeiten
    let inhalt = '';
    if (f.type === 'check') inhalt = `<span class="kreuz">${f.value ? '✓' : ''}</span>`;
    else if (f.type === 'qr') inhalt = `<div class="qrbild">${f.value ? qrSvg(f.value) : '<span class="qrleer">QR</span>'}</div>`;
    else if (f.type === 'unterschrift') inhalt = f.value ? `<img class="usbild" src="${h(f.value)}" alt="">` : '';
    else inhalt = `<span class="wert${f.mehrzeilig ? ' mz' : ''}">${h(feldText(f))}</span>`;
    el.innerHTML = inhalt + `<span class="etikett">${!f.geprueft ? '🤖 ' : ''}${h(f.label || T(TYPEN[f.type].name))}</span><span class="griff" title="${h(T('Größe ändern'))}"></span>`;
    requestAnimationFrame(() => { const w = el.querySelector('.wert'); if (w) w.style.fontSize = Math.max(8, Math.min(20, hoehePx() * (f.mehrzeilig ? 0.34 : 0.6))) + 'px'; });
    el.addEventListener('pointerdown', e => ziehen(e, f, el, e.target.classList.contains('griff') ? 'groesse' : 'bewegen'));
    return el;
  }
  /* E-Mail · Telefon · Internet (Klaus 2026-09-26): steht im Feld eine E-Mail, eine Internetadresse
     (www…, …de) oder eine Telefonnummer, wird der TEXT selbst zum Link — blau, unterstrichen,
     ein Tipp öffnet Mailprogramm, Telefon oder Browser, ✏️ daneben zum Ändern. Beim Drucken schwarz.
     Datum, Name, PLZ und Straße bleiben Text. Gleiche Regeln wie in den WorkFlohs (ovLinkZiel). */
  function linkZiel(typ, v) {
    v = String(v || '').trim(); if (!v) return '';
    const mail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/, web = u => { if (/\s/.test(u)) return ''; const w = /^https?:\/\//i.test(u) ? u : 'https://' + u; return /^https?:\/\/[^\/\s]+\.[^\/\s]+/i.test(w) ? w : ''; };
    if (typ === 'email') return mail.test(v) ? 'mailto:' + v : '';
    if (typ === 'url') return web(v);
    if (typ === 'tel') { const n = v.replace(/[^\d+]/g, ''); return n.replace(/\D/g, '').length >= 3 ? 'tel:' + n : ''; }
    if (typ === 'kdnr') return '#kunde:' + encodeURIComponent(v);     // führt zu allem unter dieser Kundennummer
    if (typ === 'artnr') return '#artikel:' + encodeURIComponent(v);
    if (mail.test(v)) return 'mailto:' + v;
    if (!/[\s@]/.test(v) && /^(https?:\/\/|www\.)/i.test(v)) return web(v);
    if (!/[\s@]/.test(v) && /^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(v)) return web(v);
    // Zahlen NICHT (Klaus 2026-09-26): eine Kunden- oder Auftragsnummer ist kein Anruf.
    // Telefonnummern werden nur in Feldern der Art „Telefon" zum Link.
    return '';
  }
  function linkFeld(f, inp, el) {
    const a = document.createElement('a'); a.className = 'flink';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'flinkedit'; b.textContent = '✏️'; b.title = T('Ändern');
    const zeige = () => {
      const z = linkZiel(f.type, inp.value);
      if (z && document.activeElement !== inp) {
        const art = z.startsWith('mailto:') ? 'email' : z.startsWith('tel:') ? 'tel' : z.startsWith('#kunde:') ? 'kdnr' : z.startsWith('#artikel:') ? 'artnr' : 'url';
        a.dataset.link = art; a.title = T(art === 'email' ? 'E-Mail schreiben' : art === 'tel' ? 'Anrufen' : art === 'kdnr' ? 'Alles zu dieser Kundennummer' : art === 'artnr' ? 'Alles zu dieser Artikelnummer' : 'Im Browser öffnen');
        if (art === 'url') { a.target = '_blank'; a.rel = 'noopener'; } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
        a.href = z; a.textContent = inp.value.trim(); a.style.fontSize = inp.style.fontSize || ''; el.classList.add('verlinkt');
      } else { a.removeAttribute('href'); el.classList.remove('verlinkt'); }
    };
    a.addEventListener('click', e => { e.stopPropagation(); if (S.modus !== 'ausfuellen' || !a.getAttribute('href')) { e.preventDefault(); return; }
      if (a.dataset.link === 'kdnr' || a.dataset.link === 'artnr') { e.preventDefault(); nummerOeffnen(a.dataset.link, inp.value.trim()); } });
    b.addEventListener('click', e => { e.stopPropagation(); e.preventDefault(); el.classList.remove('verlinkt'); inp.focus(); try { const n = inp.value.length; inp.setSelectionRange(n, n); } catch (_) {} });
    inp.addEventListener('focus', () => el.classList.remove('verlinkt'));
    inp.addEventListener('blur', zeige);
    el.appendChild(a); el.appendChild(b); zeige(); requestAnimationFrame(zeige);
  }
  /* Kunden-/Artikelnummer antippen (Klaus 2026-09-26): zeigt jedes Dokument, das dieselbe Nummer trägt.
     Eine Kundenverwaltung oder Warenwirtschaft kann sich später einhängen:
     window.WF_KUNDE_OEFFNEN(nr) bzw. window.WF_ARTIKEL_OEFFNEN(nr) — liefert sie nicht false, übernimmt sie. */
  function nrGleich(a, b) { a = String(a || '').trim().toLowerCase(); return !!a && a === String(b || '').trim().toLowerCase(); }
  function dokeMitNummer(art, nr) {   // das offene Dokument zählt mit seinem AKTUELLEN Stand, nicht dem der Bibliothek
    const alle = S.docs.filter(d => !S.doc || d.id !== S.doc.id).concat(S.doc ? [S.doc] : []);
    return alle.filter(d => (d.fields || []).some(f => f.type === art && nrGleich(f.value, nr)));
  }
  function nummerOeffnen(art, nr) {
    const hook = window[art === 'kdnr' ? 'WF_KUNDE_OEFFNEN' : 'WF_ARTIKEL_OEFFNEN'];
    if (typeof hook === 'function') { try { if (hook(nr) !== false) return; } catch (_) {} }
    speichernJetzt();
    const treffer = dokeMitNummer(art, nr);
    dialog(`<h2>${art === 'kdnr' ? '🔢 Kundennummer' : '🏷️ Artikelnummer'} <span data-kein-ue>${h(nr)}</span></h2>
      <p>${h(T('Dokumente mit dieser Nummer'))}: <b data-anzahl>${treffer.length}</b></p>
      ${treffer.map(d => `<button class="wahl" data-dok="${d.id}"><b>${nm(d.name)}</b><span>${d.id === (S.doc && S.doc.id) ? h(T('dieses Dokument')) : d.pages.length + ' ' + h(T('Seiten'))}</span></button>`).join('')}
      <p style="color:var(--gedaempft,#666)">${h(T('Eine Kundenverwaltung oder Warenwirtschaft ist noch nicht angebunden — gezeigt wird, wo die Nummer vorkommt.'))}</p>
      <div class="zeile"><button class="knopf" data-x>${h(T('Schließen'))}</button></div>`, (dl, zu) => {
      dl.querySelector('[data-x]').onclick = zu;
      dl.querySelectorAll('[data-dok]').forEach(b => b.onclick = () => { zu(); if (!S.doc || b.dataset.dok !== S.doc.id) oeffneDok(b.dataset.dok); });
    });
  }
  function ziehen(e, f, el, art) {
    if (S.modus !== 'bearbeiten') return;
    e.preventDefault(); e.stopPropagation();
    S.sel = f.id; S.platzieren = null; markiere(); zeichneFuss();
    const lage = el.parentElement.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, f0 = { x: f.x, y: f.y, w: f.w, h: f.h };
    let bewegt = false;
    try { el.setPointerCapture(e.pointerId); } catch (_) {}
    const mv = ev => {
      const dx = (ev.clientX - sx) / lage.width * 100, dy = (ev.clientY - sy) / lage.height * 100;
      if (!bewegt && Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 4) return; bewegt = true;
      if (art === 'bewegen') { f.x = clamp(f0.x + dx, 0, 100 - f.w); f.y = clamp(f0.y + dy, 0, 100 - f.h); el.style.left = f.x + '%'; el.style.top = f.y + '%'; }
      else { f.w = clamp(f0.w + dx, 1, 100 - f.x); f.h = clamp(f0.h + dy, 0.8, 100 - f.y); el.style.width = f.w + '%'; el.style.height = f.h + '%'; }
    };
    const up = () => {
      el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      if (bewegt) { f.geprueft = f.geprueft || false; speichern(); zeichneFelder(f.page); zeichneBand(); }
    };
    el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  }
  function markiere() { document.querySelectorAll('.feld').forEach(el => el.classList.toggle('sel', el.dataset.id === S.sel)); }
  function feldSetzen(seite, e, lage) {
    const r = lage.getBoundingClientRect(); const t = S.platzieren; const [w, hh] = GROESSE[t];
    const hKorr = t === 'check' || t === 'qr' ? w * S.doc.pages[seite].w / S.doc.pages[seite].h : hh;   // quadratisch
    const x = clamp((e.clientX - r.left) / r.width * 100 - (t === 'check' || t === 'qr' ? w / 2 : 1), 0, 100 - w);
    const y = clamp((e.clientY - r.top) / r.height * 100 - hKorr / 2, 0, 100 - hKorr);
    const n = S.doc.fields.filter(f => f.type === t).length + 1;
    const f = { id: uid(), page: seite, type: t, label: TYPEN[t].name + ' ' + n, x, y, w, h: hKorr, value: t === 'check' ? false : '', herkunft: 'hand', geprueft: true, mehrzeilig: false };
    S.doc.fields.push(f); S.sel = f.id; S.platzieren = null; document.querySelectorAll('.seite').forEach(s => s.classList.remove('platzieren'));
    zeichneFelder(seite); zeichneFuss(); speichern();
    setTimeout(() => { const i = $('eigLabel'); if (i) { i.focus(); i.select(); } }, 30);
  }
  function platzierenStart(t) {
    S.platzieren = S.platzieren === t ? null : t;
    document.querySelectorAll('.seite').forEach(s => s.classList.toggle('platzieren', !!S.platzieren));
    zeichneFuss();
    if (S.platzieren) toast('Tippe auf die Stelle im Dokument, an die das ' + TYPEN[t].name + '-Feld soll.');
  }

  function zeichneModus() {
    $('mBearbeiten').classList.toggle('on', S.modus === 'bearbeiten');
    $('mAusfuellen').classList.toggle('on', S.modus === 'ausfuellen');
    $('seiten').classList.toggle('ausfuellen', S.modus === 'ausfuellen');
    S.platzieren = null; document.querySelectorAll('.seite').forEach(s => s.classList.remove('platzieren'));
    S.doc.pages.forEach((_, i) => zeichneFelder(i));
    zeichneBand(); zeichneFuss();
  }
  function zeichneBand() {
    const b = $('vorschlagBand'); const n = offeneVorschlaege(S.doc);
    if (!n) { b.hidden = true; return; }
    b.hidden = false;
    b.innerHTML = `<span>🤖 <b>${n} Vorschl${n === 1 ? 'ag' : 'äge'} zu prüfen.</b><span class="lang"> Orange gestrichelt = noch nicht geprüft. Position, Bezeichnung und Art bitte kontrollieren.</span></span>
      <button class="knopf" data-alle>✓ Alle übernehmen</button><button class="knopf gefahr" data-weg>✕ Alle verwerfen</button>`;
    b.querySelector('[data-alle]').onclick = () => { S.doc.fields.forEach(f => f.geprueft = true); speichern(); zeichneModus(); toast('✓ Alle Vorschläge übernommen'); };
    b.querySelector('[data-weg]').onclick = async () => {
      if (!await frage('Vorschläge verwerfen?', `<p>${n} nicht geprüfte Felder werden entfernt. Selbst gesetzte und übernommene Felder bleiben.</p>`, 'Verwerfen')) return;
      S.doc.fields = S.doc.fields.filter(f => f.geprueft); S.sel = null; speichern(); zeichneModus();
    };
  }
  function zeichneFuss() {
    const fuss = $('edFuss'); const f = S.doc.fields.find(x => x.id === S.sel);
    if (S.modus === 'ausfuellen') {
      let html = `<div class="werkzeug"><span class="hinweis">✍️ In die Felder tippen und schreiben. Kästchen antippen zum Ankreuzen, Unterschriftsfeld antippen zum Unterschreiben. Gespeichert wird laufend; 💾 Speichern sichert zusätzlich als Datei.${S.doc.fields.length ? '' : ' Noch keine Felder — unter „Felder bearbeiten" setzen oder erkennen lassen.'}</span></div>`;
      if (f && f.type === 'qr') html += `<div class="eigenschaften"><label class="eig" style="flex:1">Inhalt des QR-Codes (Text oder Internetadresse)<input id="eigWert" value="${h(f.value || '')}"></label></div>`;
      fuss.innerHTML = html;
      if ($('eigWert')) $('eigWert').oninput = e => { f.value = e.target.value; speichern(); const el = document.querySelector(`.feld[data-id="${f.id}"] .qrbild`); if (el) el.innerHTML = f.value ? qrSvg(f.value) : ''; };
      return;
    }
    let html = `<div class="werkzeug"><span class="titel">Feld setzen:</span>${Object.entries(TYPEN).map(([k, t]) => `<button class="knopf${S.platzieren === k ? ' an' : ''}" data-t="${k}">${t.ico} ${t.name}</button>`).join('')}
      <button class="knopf" id="fussSeite">＋ Seite</button><button class="knopf" id="fussText">📄 Erkannter Text</button></div>`;
    if (S.platzieren) html += `<div class="werkzeug"><span class="hinweis">👆 Tippe jetzt auf die Stelle im Dokument. <button class="knopf klein" id="platzAbbr">Abbrechen</button></span></div>`;
    if (f) {
      html += `<div class="eigenschaften">
        ${!f.geprueft ? `<div class="ki-hinweis">🤖 Vorschlag der Erkennung — passt es? <button class="knopf klein blau" id="eigOk">✓ Passt</button></div>` : ''}
        <label class="eig" style="flex:1;min-width:160px">Bezeichnung<input id="eigLabel" value="${h(f.label || '')}"></label>
        <label class="eig">Art<select id="eigTyp">${Object.entries(TYPEN).map(([k, t]) => `<option value="${k}"${k === f.type ? ' selected' : ''}>${t.name}</option>`).join('')}</select></label>
        ${f.type === 'unterschrift' ? `<button class="knopf" id="eigUnterschr">✒️ ${f.value ? 'Neu unterschreiben' : 'Unterschreiben'}</button>${f.value ? '<button class="knopf" id="eigUsWeg">Unterschrift entfernen</button>' : ''}`
          : f.type === 'check' ? `<label class="eig eig-haken"><input type="checkbox" id="eigWertC"${f.value ? ' checked' : ''}> angekreuzt</label>`
          : f.type === 'datum' ? `<label class="eig">Inhalt<input type="date" id="eigWert" value="${h(f.value || '')}"></label>`
          : `<label class="eig" style="flex:1;min-width:160px">${f.type === 'qr' ? 'Inhalt des QR-Codes' : 'Inhalt (vorbelegt)'}<input id="eigWert" value="${h(f.value || '')}"></label>`}
        ${f.type === 'text' ? `<label class="eig eig-haken"><input type="checkbox" id="eigMz"${f.mehrzeilig ? ' checked' : ''}> mehrzeilig</label>` : ''}
        <button class="knopf" id="eigKopie" title="Feld kopieren">⧉ Kopie</button><button class="knopf gefahr" id="eigDel">🗑 Löschen</button></div>`;
    }
    // Kein Erklärsatz ohne gewähltes Feld (Klaus 2026-09-27: „erklärt sich von alleine").
    fuss.innerHTML = html;
    fuss.querySelectorAll('[data-t]').forEach(b => b.onclick = () => platzierenStart(b.dataset.t));
    $('fussSeite').onclick = seiteDialog; $('fussText').onclick = erkannterText;
    if ($('platzAbbr')) $('platzAbbr').onclick = () => platzierenStart(S.platzieren);
    if (!f) return;
    const neu = () => { zeichneFelder(f.page); zeichneBand(); };
    if ($('eigOk')) $('eigOk').onclick = () => { f.geprueft = true; speichern(); neu(); zeichneFuss(); };
    $('eigLabel').oninput = e => { f.label = e.target.value; f.geprueft = true; speichern(); const t = document.querySelector(`.feld[data-id="${f.id}"] .etikett`); if (t) t.textContent = f.label || TYPEN[f.type].name; };
    $('eigLabel').onchange = () => { neu(); };
    $('eigTyp').onchange = e => {
      const alt = f.type; f.type = e.target.value; f.geprueft = true;
      if (f.type === 'check') { f.value = false; f.mehrzeilig = false; } else if (alt === 'check' || alt === 'unterschrift' || f.type === 'unterschrift') f.value = '';
      if (f.type === 'datum' && !/^\d{4}-\d{2}-\d{2}$/.test(f.value || '')) f.value = '';
      speichern(); neu(); zeichneFuss();
    };
    if ($('eigWert')) $('eigWert').oninput = e => { f.value = e.target.value; speichern(); neu(); };
    if ($('eigWertC')) $('eigWertC').onchange = e => { f.value = e.target.checked; speichern(); neu(); };
    if ($('eigUnterschr')) $('eigUnterschr').onclick = () => unterschreiben(f);
    if ($('eigUsWeg')) $('eigUsWeg').onclick = () => { f.value = ''; speichern(); neu(); zeichneFuss(); };
    if ($('eigMz')) $('eigMz').onchange = e => { f.mehrzeilig = e.target.checked; speichern(); neu(); };
    $('eigKopie').onclick = () => { const n = Object.assign({}, f, { id: uid(), y: clamp(f.y + f.h + 0.6, 0, 100 - f.h), geprueft: true, herkunft: 'hand' }); S.doc.fields.push(n); S.sel = n.id; speichern(); zeichneFelder(f.page); zeichneFuss(); };
    $('eigDel').onclick = () => feldLoeschen(f);
  }
  /* Unterschrift mit Stift oder Finger. Gespeichert als PNG (durchsichtig,
     auf die Striche zugeschnitten) — im PDF wird sie als Bild eingesetzt. */
  function unterschreiben(f) {
    dialog(`<h2>✒️ ${f.label ? nm(f.label) : 'Unterschrift'}</h2>
      <p class="hinweis">Mit dem Stift oder dem Finger in das Feld schreiben.</p>
      <canvas class="us-flaeche" id="usFlaeche"></canvas>
      <div class="zeile"><button class="knopf" data-neu>Löschen</button><button class="knopf" data-x>Abbrechen</button><button class="knopf rot" data-ok>✓ Übernehmen</button></div>`,
      (d, zu) => {
        const c = d.querySelector('#usFlaeche'), dpr = Math.min(window.devicePixelRatio || 1, 3);
        const breite = Math.min(d.clientWidth - 8, 720), hoehe = Math.round(breite / Math.max(2, Math.min(6, f.w / f.h * S.doc.pages[f.page].w / S.doc.pages[f.page].h)));
        c.style.width = breite + 'px'; c.style.height = Math.max(120, hoehe) + 'px';
        c.width = Math.round(breite * dpr); c.height = Math.round(Math.max(120, hoehe) * dpr);
        const x = c.getContext('2d'); x.scale(dpr, dpr); x.lineCap = 'round'; x.lineJoin = 'round'; x.strokeStyle = '#0b1a52';
        let zieht = false, letzte = null, striche = 0;
        const pos = e => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
        c.addEventListener('pointerdown', e => { e.preventDefault(); zieht = true; letzte = pos(e); try { c.setPointerCapture(e.pointerId); } catch (_) {} x.beginPath(); x.arc(letzte[0], letzte[1], 1.1, 0, 7); x.fillStyle = '#0b1a52'; x.fill(); striche++; });
        c.addEventListener('pointermove', e => {
          if (!zieht) return; e.preventDefault();
          const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
          for (const ev of pts.length ? pts : [e]) {
            const p = pos(ev); const druck = ev.pointerType === 'pen' && ev.pressure > 0 ? ev.pressure : 0.5;
            x.lineWidth = 1.2 + druck * 2.6; x.beginPath(); x.moveTo(letzte[0], letzte[1]); x.lineTo(p[0], p[1]); x.stroke(); letzte = p;
          }
        });
        const ende = () => { zieht = false; };
        c.addEventListener('pointerup', ende); c.addEventListener('pointercancel', ende);
        d.querySelector('[data-neu]').onclick = () => { x.clearRect(0, 0, c.width, c.height); striche = 0; };
        d.querySelector('[data-x]').onclick = zu;
        d.querySelector('[data-ok]').onclick = () => {
          f.value = striche ? zuschneiden(c) : ''; f.geprueft = true; speichern(); zu();
          zeichneFelder(f.page); zeichneBand(); zeichneFuss();
        };
      });
  }
  function zuschneiden(c) {
    const x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
    for (let y = 0; y < c.height; y++) for (let i = 0; i < c.width; i++) if (d[(y * c.width + i) * 4 + 3] > 8) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 < 0) return '';
    const r = 6, w = x1 - x0 + 1 + 2 * r, hh = y1 - y0 + 1 + 2 * r;
    const o = document.createElement('canvas'); o.width = w; o.height = hh;
    o.getContext('2d').drawImage(c, x0 - r, y0 - r, w, hh, 0, 0, w, hh);
    return o.toDataURL('image/png');
  }
  function feldLoeschen(f) {
    const i = S.doc.fields.indexOf(f); if (i < 0) return;
    S.doc.fields.splice(i, 1); S.sel = null; speichern(); zeichneFelder(f.page); zeichneBand(); zeichneFuss();
    toast('🗑 Feld „' + (f.label || TYPEN[f.type].name) + '" gelöscht', { text: 'Rückgängig', tun: () => { S.doc.fields.splice(i, 0, f); S.sel = f.id; speichern(); zeichneFelder(f.page); zeichneBand(); zeichneFuss(); } });
  }
  function erkannterText() {
    const t = S.doc.pages.map((p, i) => p.text ? `— Seite ${i + 1} —\n${p.text}` : '').filter(Boolean).join('\n\n');
    dialog(`<h2>📄 Erkannter Text</h2>${t ? `<textarea readonly>${h(t)}</textarea>` : '<p class="hinweis">Noch kein Text erkannt. Den Text liefert die KI-Erkennung (🤖 Felder erkennen → mit KI).</p>'}
      <div class="zeile">${t ? '<button class="knopf" data-k>Kopieren</button>' : ''}<button class="knopf rot" data-x>Schließen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      if (d.querySelector('[data-k]')) d.querySelector('[data-k]').onclick = () => navigator.clipboard.writeText(t).then(() => toast('📋 kopiert')).catch(() => { d.querySelector('textarea').select(); document.execCommand('copy'); toast('📋 kopiert'); });
    });
  }

  /* ---------- Seite anhängen ---------- */
  function seiteDialog() {
    dialog(`<h2>＋ Seite anhängen</h2><p class="hinweis">Die neuen Seiten kommen hinter Seite ${S.doc.pages.length}. Vorhandene Felder bleiben, wo sie sind.</p>
      <button class="wahl" data-d><b>📄 PDF oder Bild wählen</b><span>eine oder mehrere Dateien</span></button>
      <button class="wahl" data-k><b>📷 Seite fotografieren</b></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      d.querySelector('[data-d]').onclick = () => { zu(); $('inAnhang').click(); };
      d.querySelector('[data-k]').onclick = () => { zu(); scanStarten('anhang', 'kamera'); };
    });
  }
  async function dateienAnhaengen(files) {
    const teile = [];
    for (const f of Array.from(files || [])) {
      try { if (istPdf(f)) teile.push(new Uint8Array(await f.arrayBuffer())); else if (istBild(f)) teile.push(await EX.bilderZuPdf([await bildNormalisieren(f)])); }
      catch (e) { toast('⚠️ ' + f.name + ': ' + (e.message || e)); }
    }
    if (teile.length) await seitenAnhaengen(teile);
  }
  async function seitenAnhaengen(teile) {
    try {
      const { PDFDocument } = PDFLib;
      const basis = await PDFDocument.load(S.bytes, { ignoreEncryption: true });
      for (const t of teile) { const q = await PDFDocument.load(t, { ignoreEncryption: true }); const kopien = await basis.copyPages(q, q.getPageIndices()); kopien.forEach(p => basis.addPage(p)); }
      const neu = await basis.save();
      const pdf = await pdfjsLib.getDocument({ data: neu.slice(0) }).promise;
      const info = await seitenInfo(pdf);
      const alt = S.doc.pages.length;
      S.doc.pages = S.doc.pages.map((p, i) => Object.assign({}, info[i], { text: p.text })).concat(info.slice(alt));
      await DB.putFile(S.doc.id, neu); S.bytes = neu;
      if (S.pdf) { try { S.pdf.destroy(); } catch (_) {} }
      S.pdf = pdf; await speichernJetzt(); zeichneSeiten();
      toast('＋ ' + (info.length - alt) + ' Seite(n) angehängt');
      setTimeout(() => { const el = document.querySelector(`.seite[data-i="${alt}"]`); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 60);
    } catch (e) { toast('⚠️ Anhängen fehlgeschlagen: ' + (e.message || e)); }
  }

  /* ---------- Zuschneiden (Klaus 2026-10-06) ----------
     „Es soll nur ein Button hinzukommen, zuschneiden. Und dann kann man das Dokument
     zuschneiden, ausrichten und auf die Größe anpassen, die gewünscht ist."
     Jede Seite des offenen Dokuments wird als Bild gezeichnet und im Scanner geöffnet
     (Ecken ziehen, drehen, Seitengröße). „Übernehmen" speichert ein ZWEITES Dokument
     „<Name> (zugeschnitten)" im selben Ordner; das Original bleibt, wie es war (Klaus
     2026-10-06: „Originaldokument sollte dabei als Original bleiben"). Die Felder werden
     kopiert; sie stehen in Prozent der Seite, ob sie noch sitzen, sagt der Hinweis danach. */
  const ZUSCHNITT_KANTE = 2400;
  async function seiteZuschneiden() {
    if (!S.doc || !S.pdf) return;
    await speichernJetzt();
    const doc = S.doc, pdf = S.pdf;
    const fb = fortschritt('Seiten werden vorbereitet');
    const dateien = [];
    try {
      for (let n = 1; n <= pdf.numPages; n++) {
        fb.setze((n - 1) / pdf.numPages, 'Seite ' + n + ' von ' + pdf.numPages);
        const p = await pdf.getPage(n); const v1 = p.getViewport({ scale: 1 });
        const vp = p.getViewport({ scale: ZUSCHNITT_KANTE / Math.max(v1.width, v1.height) });
        const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
        const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
        await p.render({ canvasContext: g, viewport: vp }).promise;
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
        dateien.push(new File([blob], doc.name + ' - Seite ' + String(n).padStart(2, '0') + '.jpg', { type: 'image/jpeg' }));
      }
    } catch (e) { fb.zu(); toast('⚠️ ' + (e.message || e)); return; }
    fb.zu();
    window.__wfpdfZuschnitt = { seiten: dateien.length };
    return WFP.Scanner.oeffnen({ titel: 'Zuschneiden', fertigText: 'Übernehmen', dateien, name: doc.name,
      toast, dialog, frage, fortschritt, laden, ablegen: null,
      fertig: async bytes => {
        // Das Original bleibt unberührt; der Zuschnitt wird ein ZWEITES Dokument im selben
        // Ordner, gleich gespeichert, mit frischem Vorschaubild (Klaus 2026-10-06).
        const name = doc.name + ' (zugeschnitten)';
        const neu = await neuesDok(name, bytes, 'zuschnitt', doc.folderId);
        const vorher = (doc.fields || []).length;
        neu.fields = (doc.fields || []).filter(f => f.page < neu.pages.length)
          .map(f => Object.assign({}, f, { id: uid() }));
        if (doc.pruefung) neu.pruefung = doc.pruefung;   // derselbe Inhalt, derselbe Befund
        await DB.put('docs', neu);
        window.__wfpdfZuschnitt.fertig = { id: neu.id, original: doc.id, seiten: neu.pages.length, felder: neu.fields.length };
        await oeffneDok(neu.id);
        const weg = vorher - neu.fields.length;
        toast('✂️ Zugeschnitten und als neues Dokument gespeichert — das Original bleibt'
          + (neu.fields.length ? '. Bitte prüfen, ob die Felder noch sitzen' + (weg ? ' (' + weg + ' auf entfernten Seiten weggelassen)' : '') : ''));
      } });
  }

  /* ---------- Erkennung ---------- */
  async function erkennenDialog(ids) {
    const mehrere = ids.length > 1;
    const namen = {};
    if (mehrere) for (const id of ids) { try { const d = S.doc && S.doc.id === id ? S.doc : await DB.get('docs', id); namen[id] = d && d.name; } catch (_) {} }
    const a = ER.ANBIETER[EINST.anbieter];
    dialog(`<h2>🤖 Formularfelder erkennen</h2>
      ${mehrere ? `<p><b>In welchen Dokumenten?</b> Tippe die an, die erkannt werden sollen — nur diese gehen an die KI. <button class="knopf klein" data-alle>Alle</button></p><div class="erk-liste">${ids.map(id => `<label class="erk-dok"><input type="checkbox" data-dok="${h(id)}"> ${nm(namen[id] || id)}</label>`).join('')}</div><p class="hinweis" data-zahl>Noch kein Dokument gewählt.</p>` : ''}
      <p>Erkannte Felder sind <b>Vorschläge</b>: sie erscheinen orange gestrichelt, bis du sie prüfst. Noch nicht geprüfte Vorschläge aus einem früheren Durchgang werden dabei ersetzt.</p>
      <button class="wahl" data-off><b>🔍 Ohne Internet erkennen</b><span>Findet Linien, Eingabe-Rahmen, graue Eingabeflächen und Kästchen im Seitenbild. Bei digitalen PDFs kommt die Beschriftung aus dem Text daneben.</span></button>
      <button class="wahl" data-ki><b>🤖 Mit KI erkennen — ${h(a.label)}</b><span>${kiBereit()
        ? `Jede Seite wird als Bild an ${h(a.label)} geschickt, mit den offline gefundenen Stellen nummeriert markiert. Die KI benennt sie, sortiert Falsches aus und ergänzt Fehlendes. Die Positionen der markierten Stellen bleiben exakt.`
        : 'Noch kein Schlüssel eingetragen — tippen, um ihn in den Einstellungen einzutragen.'}</span></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      const gewaehlt = () => mehrere ? [...d.querySelectorAll('[data-dok]')].filter(c => c.checked).map(c => c.dataset.dok) : ids;
      if (mehrere) {
        const zahl = () => { const n = gewaehlt().length; d.querySelector('[data-zahl]').textContent = n ? n + ' von ' + ids.length + ' Dokumenten gewählt.' : 'Noch kein Dokument gewählt.'; d.querySelector('[data-off]').disabled = d.querySelector('[data-ki]').disabled = !n; };
        d.querySelectorAll('[data-dok]').forEach(c => c.onchange = zahl);
        d.querySelector('[data-alle]').onclick = () => { const alle = gewaehlt().length < ids.length; d.querySelectorAll('[data-dok]').forEach(c => c.checked = alle); zahl(); };
        zahl();
      }
      d.querySelector('[data-off]').onclick = () => { const w = gewaehlt(); if (!w.length) return toast('Kein Dokument gewählt.'); zu(); erkenneViele(w, false); };
      d.querySelector('[data-ki]').onclick = async () => {
        const w = gewaehlt(); if (!w.length) return toast('Kein Dokument gewählt.');
        ids = w; zu();
        if (!kiBereit()) { einstellungen(); return; }
        if (!EINST.kiOk[EINST.anbieter]) {
          const ok = await frage('Seiten an die KI senden?', `<p>Die Seiten ${mehrere ? 'der ' + ids.length + ' gewählten Dokumente ' : ''}werden als Bild an <b>${h(a.label)}</b> übertragen (Verarbeitung: ${h(a.region)}). Enthalten sie persönliche Angaben, gehen diese mit.</p><p class="hinweis">Diese Frage kommt je Anbieter einmal. Ohne Bestätigung verlässt nichts das Gerät.</p>`, 'Senden');
          if (!ok) return; EINST.kiOk[EINST.anbieter] = true; einstSpeichern();
        }
        erkenneViele(ids, true);
      };
    });
  }
  async function erkenneViele(ids, mitKi) {
    const fb = fortschritt(mitKi ? 'KI erkennt Felder …' : 'Felder werden erkannt …');
    let gesamt = 0; const fehler = [];
    for (let k = 0; k < ids.length; k++) {
      const offen = S.doc && S.doc.id === ids[k];
      try {
        const d = offen ? S.doc : await DB.get('docs', ids[k]); const b = offen ? S.bytes : await DB.getFile(ids[k]);
        const r = await erkenneDok(d, b, mitKi, (a, t, b) => fb.setze((k + a) / ids.length, (ids.length > 1 ? `Dokument ${k + 1}/${ids.length} · ` : '') + t, b == null ? undefined : (k + b) / ids.length));
        gesamt += r.neu; if (r.fehler) fehler.push(d.name + ': ' + r.fehler);
        if (!offen) await DB.put('docs', d);
      } catch (e) { fehler.push(String(e.message || e)); }
    }
    fb.zu();
    if (S.doc && ids.includes(S.doc.id)) { S.modus = 'bearbeiten'; await speichernJetzt(); zeichneModus(); } else ladeBibliothek();
    if (fehler.length) dialog(`<h2>Hinweise zur Erkennung</h2><ul>${fehler.map(x => '<li>' + h(x) + '</li>').join('')}</ul><p class="hinweis">Was offline gefunden wurde, ist trotzdem eingetragen.</p><div class="zeile"><button class="knopf rot" data-x>OK</button></div>`, (d, zu) => d.querySelector('[data-x]').onclick = zu);
    toast(gesamt ? `🤖 ${gesamt} Feld${gesamt === 1 ? '' : 'er'} vorgeschlagen — bitte prüfen` : 'Keine neuen Felder gefunden. Felder lassen sich von Hand setzen.');
    if (gesamt) hops();
  }
  function typAusLabel(f) {
    const l = (f.label || '').toLowerCase();
    if (f.type !== 'text') return f.type;
    if (/unterschrift|signatur|signature/.test(l)) return 'unterschrift';
    if (/datum|geburtstag|geb\.|date\b/.test(l)) return 'datum';
    if (/kunden\s*-?\s*(nr|nummer)|\bkd\.?\s*-?\s*nr|kundennr/.test(l)) return 'kdnr';
    if (/artikel\s*-?\s*(nr|nummer)|\bart\.?\s*-?\s*nr|artikelnr/.test(l)) return 'artnr';
    if (/e-?mail/.test(l)) return 'email';
    if (/telefon|\btel\b|tel\.|handy|mobil|phone|fax/.test(l)) return 'tel';
    if (/internet|webseite|homepage|url\b|www/.test(l)) return 'url';
    return 'text';
  }
  // Was schon IN einem erkannten Feld steht, wird zum Feldwert; die Hintergrundfarbe
  // deckt den gedruckten Text später ab, damit sich nichts doppelt überlagert.
  function inhaltUebernehmen(felder, items, ctx, W, H) {
    for (const f of felder) {
      const px = Math.max(0, Math.round(f.x / 100 * W)), py = Math.max(0, Math.round(f.y / 100 * H));
      const pw = Math.max(1, Math.round(f.w / 100 * W)), ph = Math.max(1, Math.round(f.h / 100 * H));
      let img; try { img = ctx.getImageData(px, py, Math.min(pw, W - px), Math.min(ph, H - py)); } catch (_) { continue; }
      const dd = img.data, iw = img.width, ih = img.height;
      if (f.type === 'check') {
        let dunkel = 0, n = 0; const r = Math.round(Math.min(iw, ih) * 0.22);
        for (let y = r; y < ih - r; y++) for (let x = r; x < iw - r; x++) { const i = (y * iw + x) * 4; n++; if (dd[i] * 0.3 + dd[i + 1] * 0.59 + dd[i + 2] * 0.11 < 110) dunkel++; }
        if (n && dunkel / n > 0.08) f.angekreuzt = true;
        continue;
      }
      let sr = 0, sg = 0, sb = 0, n = 0;
      for (let i = 0; i < dd.length; i += 16) { const l = dd[i] * 0.3 + dd[i + 1] * 0.59 + dd[i + 2] * 0.11; if (l > 150) { sr += dd[i]; sg += dd[i + 1]; sb += dd[i + 2]; n++; } }
      const hex = v => ('0' + Math.round(v).toString(16)).slice(-2);
      if (n) f.decken = '#' + hex(sr / n) + hex(sg / n) + hex(sb / n);
      if (typeof f.inhalt === 'string' && f.inhalt) continue;       // KI hat schon gelesen
      const lab = String(f.label || '').toLowerCase().replace(/[:\s]+$/, '');
      const drin = items.filter(t => t.str.trim() && t.x + t.w / 2 > f.x && t.x + t.w / 2 < f.x + f.w && t.y + t.h / 2 > f.y && t.y + t.h / 2 < f.y + f.h
        && t.str.trim().toLowerCase().replace(/[:\s]+$/, '') !== lab
        && !/:\s*$/.test(t.str.replace(/[_.…]{3,}/g, '')));   // „Ausweis-Nr.:" und „Aktenzeichen: ____" sind Beschriftungen, kein Eintrag
      if (!drin.length) continue;
      drin.sort((a, b) => Math.abs(a.y - b.y) > a.h * 0.5 ? a.y - b.y : a.x - b.x);
      let txt = '', letzt = null;
      for (const t of drin) { txt += letzt ? (Math.abs(t.y - letzt.y) > letzt.h * 0.5 ? '\n' : ' ') : ''; txt += t.str.trim(); letzt = t; }
      f.inhalt = txt.replace(/ +/g, ' ').trim();
      if (/^\p{L}$/u.test(f.inhalt)) delete f.inhalt;   // ein einzelner Buchstabe (Wappen, Logo) ist kein Eintrag
    }
  }

  async function erkenneDok(d, bytes, mitKi, melde) {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    d.fields = d.fields.filter(f => f.geprueft);           // alte, ungeprüfte Vorschläge ersetzen
    let neu = 0, fehler = '';
    const seiten = Math.min(pdf.numPages, 40);
    for (let i = 0; i < seiten; i++) {
      melde(i / seiten, `Seite ${i + 1} von ${pdf.numPages}`);
      const p = await pdf.getPage(i + 1); const v1 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: 1400 / v1.width });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d', { willReadFrequently: true }); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: x, viewport: vp }).promise;
      let felder = EINST.linien !== false ? ER.linienErkennung(x.getImageData(0, 0, c.width, c.height)) : [];
      if (mitKi) {
        try {
          // Kandidaten nummeriert ins Bild — schon geprüfte Felder nicht noch einmal fragen
          const iouV = (a, b) => { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const s = ix * iy; return s / (a.w * a.h + b.w * b.h - s || 1); };
          const alt = d.fields.filter(f => f.page === i);
          const kand = (EINST.linien !== false ? felder : ER.linienErkennung(x.getImageData(0, 0, c.width, c.height)))
            .filter(k => !alt.some(v => iouV(v, k) > 0.25)).slice(0, 150);
          melde((i + 0.1) / seiten, `Seite ${i + 1} von ${pdf.numPages} · KI liest die Seite …`, (i + 0.95) / seiten);
          const antwort = await ER.kiAnfrage(kiCfg(), ER.markiertesBild(c, kand), ER.promptMitKandidaten(kand));
          const r = ER.kiAuswerten(antwort, { w: c.width, h: c.height });
          if (r.text && d.pages[i]) d.pages[i].text = r.text;
          felder = ER.zusammenfuehren(r.felder, kand, r.kein);
        } catch (e) { const m = String(e.message || e); fehler = (fehler ? fehler + ' · ' : '') + 'Seite ' + (i + 1) + ': ' + m; if (/401|Schlüssel/.test(m)) mitKi = false; }
      }
      // Beschriftung aus der Textebene (digitale PDFs)
      try {
        const tc = await p.getTextContent();
        const items = tc.items.map(t => {
          const tr = pdfjsLib.Util.transform(vp.transform, t.transform); const fh = Math.hypot(tr[2], tr[3]);
          return { str: t.str, x: tr[4] / c.width * 100, y: (tr[5] - fh) / c.height * 100, w: t.width * vp.scale / c.width * 100, h: fh / c.height * 100 };
        });
        ER.beschrifte(felder, items);
        // Übersetztes Dokument: unter der Übersetzung liegt der Originaltext abgedeckt —
        // er ist kein Inhalt eines Feldes und darf nicht als Eintrag gelesen werden.
        if (d.uebersetzung) { felder.forEach(f => { delete f.inhalt; delete f.angekreuzt; }); items.length = 0; }
        inhaltUebernehmen(felder, items, x, c.width, c.height);
        // schon vorhandene, noch leere Felder lesen ihren Inhalt ebenfalls
        const leer = d.fields.filter(f => f.page === i && f.type !== 'unterschrift' && f.type !== 'qr' && !f.value);
        inhaltUebernehmen(leer, items, x, c.width, c.height);
        for (const f of leer) {
          if (f.type === 'check') { if (f.angekreuzt) f.value = true; }
          else if (f.inhalt) { f.value = f.inhalt; f.decken = f.decken || '#ffffff'; if (f.inhalt.includes('\n')) f.mehrzeilig = true; }
          else delete f.decken;
          delete f.inhalt; delete f.angekreuzt;
        }
        if (!d.pages[i].text && items.length) d.pages[i].text = tc.items.map(t => t.str + (t.hasEOL ? '\n' : ' ')).join('').trim();
      } catch (_) {}
      const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const s = ix * iy; return s / (a.w * a.h + b.w * b.h - s || 1); };
      const vorhanden = d.fields.filter(f => f.page === i);
      let nr = 0;
      for (const f of felder) {
        if (vorhanden.some(v => iou(v, f) > 0.25)) continue;
        // Frei gesetzte KI-Felder, die ein schon vorhandenes Feld doppeln, fallen weg:
        // gleiche Bezeichnung auf derselben Seite, oder dicht daneben/darüber (dann traf die KI die Beschriftung)
        const norm = t => String(t || '').toLowerCase().replace(/[^a-zäöüß0-9]+/g, '');
        if (f.quelle === 'ki' && !f.eingerastet && vorhanden.concat(felder.filter(g => g !== f && (g.quelle !== 'ki' || g.eingerastet))).some(v => {
          if (f.label && norm(f.label) === norm(v.label) && (v.type === 'check') === (f.type === 'check')) return true;
          const mx = (f.x + f.w / 2) - (v.x + v.w / 2), my = (f.y + f.h / 2) - (v.y + v.h / 2);
          if (f.type === 'check' || v.type === 'check') return f.type === v.type && Math.abs(mx) < 2 && Math.abs(my) < 1.5;
          const ov = Math.min(f.x + f.w, v.x + v.w) - Math.max(f.x, v.x);
          return ov > 0.5 * Math.min(f.w, v.w) && Math.abs(my) < 2.5;
        })) continue;
        nr++;
        const typ = typAusLabel(f);
        vorhanden.push(f);
        d.fields.push({ id: uid(), page: i, type: typ, label: f.label || (typ === 'check' ? 'Kästchen ' : 'Feld ') + (i + 1) + '.' + nr,
          x: f.x, y: f.y, w: f.w, h: f.h, value: typ === 'check' ? false : '', mehrzeilig: typ === 'text' && f.h > 4.5,
          herkunft: f.quelle === 'ki' ? 'ki' : 'erkennung', geprueft: false });
        const nf = d.fields[d.fields.length - 1];
        if (typ === 'check') { if (f.inhalt === true || f.angekreuzt) nf.value = true; }
        else if (typeof f.inhalt === 'string' && f.inhalt && typ !== 'unterschrift') { nf.value = f.inhalt; nf.decken = f.decken || '#ffffff'; if (f.inhalt.includes('\n')) nf.mehrzeilig = true; }
        neu++;
      }
    }
    if (pdf.numPages > seiten) fehler = (fehler ? fehler + ' · ' : '') + `nur die ersten ${seiten} von ${pdf.numPages} Seiten untersucht`;
    try { pdf.destroy(); } catch (_) {}
    d.updatedAt = jetzt();
    return { neu, fehler };
  }

  /* ---------- Export ---------- */
  // Seitengröße nennen: ausgedruckt soll ein Brief so groß sein wie das Papier
  function formatText(d) {
    const p = d && d.pages && d.pages[0]; if (!p) return '';
    const mm = v => Math.round(v / 72 * 25.4);
    const w = mm(p.w), hh = mm(p.h), a4 = (Math.abs(w - 210) <= 1 && Math.abs(hh - 297) <= 1) ? 'A4 hoch' : (Math.abs(w - 297) <= 1 && Math.abs(hh - 210) <= 1) ? 'A4 quer' : '';
    return `📏 Seitengröße: ${a4 ? a4 + ' · ' : ''}${w} × ${hh} mm — die Ausgabe behält sie. Beim Drucken „Tatsächliche Größe / 100 %" wählen, nicht „An Seite anpassen", dann ist der Ausdruck so groß wie das Original, mit demselben Rand.`;
  }
  // Die Ausgabe-Bytes eines Dokuments — EINE Stelle für den Einzel-Export und die Ordner-Ausgabe
  async function ausgabeBytes(doc, bytes, m) {
    if (m === 'original') return { bytes, hinweise: [] };
    // Kyrillische Einträge (oder ein Formular zum Ausfüllen auf Russisch) brauchen
    // eine Unicode-Schrift — die Standardschrift machte daraus „?".
    const kyr = !!(doc.uebersetzung && doc.uebersetzung.nach === 'ru') || doc.fields.some(f => typeof f.value === 'string' && /[^\u0000-\u024F\u2000-\u206F€]/.test(f.value));
    let schrift = null; if (kyr) { try { schrift = await UE.schriftLaden('vendor/'); } catch (_) {} }
    return EX.exportieren(doc, bytes, m, { schrift, unicodeFelder: !!(doc.uebersetzung && doc.uebersetzung.nach === 'ru') });
  }
  /* Einen ganzen Ordner ausgeben (Klaus 2026-09-26: „dass der Ordner als Ganzes mit den
     integrierten PDFs freigegeben werden kann"). Reihenfolge = die gewählte Sortierung.
     Drei Wege: ZIP (ein Ordner, jede Datei einzeln), alle Dateien teilen, oder zu EINEM PDF
     zusammenfügen — das holt z. B. die übersetzten Teile eines Handbuchs wieder in ein Buch. */
  async function ordnerAusgabe(o) {
    const docs = sortiere(S.docs.filter(d => d.folderId === o.id));
    if (!docs.length) return toast('Der Ordner ist leer.');
    const seiten = docs.reduce((n, d) => n + d.pages.length, 0);
    dialog(`<h2>📤 Ordner ausgeben</h2>
      <p><b>${nm(o.name)}</b> · ${docs.length} Dokument${docs.length === 1 ? '' : 'e'} · ${seiten} Seiten</p>
      <p class="hinweis">Reihenfolge wie in der Bibliothek (${h(SORTIERUNG[EINST.sortierung])}):</p>
      <ol class="hinweis aus-liste" data-liste>${docs.map(d => `<li>${nm(d.name)}</li>`).join('')}</ol>
      <label>Jedes Dokument als <select data-m><option value="fest">festes PDF (Einträge fest auf der Seite)</option><option value="ausfuellbar">ausfüllbares PDF</option><option value="vorlage">leere ausfüllbare Vorlage</option><option value="original">Original, unverändert</option></select></label>
      <button class="wahl" data-weg="zip"><b>🗜 Als ZIP-Datei (ein Ordner)</b><span>Eine Datei mit allen PDFs darin, benannt wie der Ordner. Zum Verschicken, Ablegen, Sichern.</span></button>
      ${navigator.canShare ? '<button class="wahl" data-weg="teilen"><b>📤 Alle Dateien teilen</b><span>Alle PDFs auf einmal an eine App geben (Mail, Messenger, Drive …). Manche Apps nehmen nur eine Datei — dann die ZIP-Datei nehmen.</span></button>' : ''}
      <button class="wahl" data-weg="eins"><b>📚 Zu einem PDF zusammenfügen</b><span>Alle Seiten hintereinander in EINEM PDF, in der Reihenfolge oben — z. B. die übersetzten Teile eines Handbuchs wieder als ein Buch. Ausfüllbare Felder werden dabei fest.</span></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      d.querySelectorAll('[data-weg]').forEach(b => b.onclick = async () => {
        const weg = b.dataset.weg, m = weg === 'eins' && d.querySelector('[data-m]').value !== 'original' ? 'fest' : d.querySelector('[data-m]').value;
        zu();
        const fb = fortschritt('Ordner „' + o.name + '" wird ausgegeben');
        try {
          const zusatz = { fest: '', ausfuellbar: ' (ausfuellbar)', vorlage: ' (Vorlage)', original: '' }[m];
          const dateien = [], hinweise = [];
          const eins = weg === 'eins' ? await PDFLib.PDFDocument.create() : null;
          for (let i = 0; i < docs.length; i++) {
            fb.setze(i / docs.length, 'Dokument ' + (i + 1) + ' von ' + docs.length);
            const bytes = await DB.getFile(docs[i].id);
            if (!bytes) { hinweise.push('„' + docs[i].name + '" hat keine Datei mehr — übersprungen.'); continue; }
            const r = await ausgabeBytes(docs[i], bytes, m);
            if (eins) { const q = await PDFLib.PDFDocument.load(r.bytes, { ignoreEncryption: true }); (await eins.copyPages(q, q.getPageIndices())).forEach(p => eins.addPage(p)); }
            else dateien.push({ name: dateiName(docs[i].name) + zusatz + '.pdf', bytes: r.bytes });
          }
          fb.setze(0.95, 'Datei wird gebaut …');
          let aus;
          if (eins) aus = [{ name: dateiName(o.name) + '.pdf', bytes: await eins.save(), typ: 'application/pdf' }];
          else if (weg === 'zip') aus = [{ name: dateiName(o.name) + '.zip', bytes: WFP.Zip.zip(dateien), typ: 'application/zip' }];
          else aus = dateien.map(f => Object.assign({ typ: 'application/pdf' }, f));
          fb.zu();
          window.__wfpdfOrdnerAusgabe = { weg, m, dateien: aus.map(f => ({ name: f.name, groesse: f.bytes.length })) };
          if (weg !== 'teilen') laden(aus[0].name, aus[0].bytes, aus[0].typ);
          const files = aus.map(f => new File([f.bytes], f.name, { type: f.typ }));
          let teilbar = false; try { teilbar = !!(navigator.canShare && navigator.canShare({ files })); } catch (_) {}
          // Teilen braucht einen frischen Tipp — nach dem Bauen ist der erste verbraucht.
          dialog(`<h2>📤 ${weg === 'teilen' ? 'Bereit zum Teilen' : 'Gespeichert'}</h2>
            <ul>${aus.map(f => `<li><b>${nm(f.name)}</b> · ${mbText(f.bytes.length)}</li>`).join('')}</ul>
            ${hinweise.map(x => '<p class="hinweis">' + h(x) + '</p>').join('')}
            ${weg === 'teilen' && !teilbar ? '<p class="hinweis">Dieses Gerät kann diese Dateien nicht zusammen teilen — bitte „🗜 Als ZIP-Datei" nehmen.</p>' : ''}
            <div class="zeile">${teilbar ? '<button class="knopf primaer" data-teilen>📤 Jetzt teilen …</button>' : ''}<button class="knopf" data-x>Schließen</button></div>`, (d2, zu2) => {
            d2.querySelector('[data-x]').onclick = zu2;
            if (d2.querySelector('[data-teilen]')) d2.querySelector('[data-teilen]').onclick = () => navigator.share({ files, title: o.name }).catch(() => {});
          });
        } catch (e) { fb.zu(); console.error(e); toast('⚠️ Ordner-Ausgabe fehlgeschlagen: ' + (e.message || e)); }
      });
    });
  }
  function exportDialog() {
    const n = offeneVorschlaege(S.doc);
    dialog(`<h2>⬇ PDF ausgeben</h2>
      ${n ? `<p class="ki-hinweis">🤖 ${n} Vorschläge sind noch nicht geprüft. Sie werden mit ausgegeben.</p>` : ''}
      <button class="wahl" data-m="fest"><b>📄 Festes PDF</b><span>Die eingetragenen Inhalte werden Teil der Seite. Zum Verschicken, Ablegen, Drucken.</span></button>
      <button class="wahl" data-m="ausfuellbar"><b>📝 Ausfüllbares PDF</b><span>Echte PDF-Formularfelder, vorbelegt mit deinen Einträgen. Der Empfänger kann sie ändern und speichern. Ausfüllen geht in Adobe Acrobat Reader oder Chrome am Computer; die PDF-Anzeige von „Dateien" oder Google Drive am Handy zeigt oft nur die Kästchen — dafür gibt es die HTML-Fassung.</span></button>
      <button class="wahl" data-m="vorlage"><b>📝 Leere ausfüllbare Vorlage</b><span>Echte Formularfelder, alle leer. Der Empfänger füllt selbst aus.</span></button>
      <button class="wahl" data-m="html"><b>🌐 Zum Ausfüllen im Browser (HTML)</b><span>Eine Datei, die sich in jedem Browser öffnet und dort ausfüllen lässt — auch wo die PDF-Anzeige keine Formularfelder kann. Danach im Browser „Als PDF speichern".</span></button>
      <button class="wahl" data-m="druck"><b>🖨 Ansehen / Drucken</b><span>Öffnet das feste PDF in der PDF-Anzeige des Geräts.</span></button>
      ${rueckwegMoeglich(S.doc) ? `<button class="wahl" data-rueckweg><b>↩ Einträge ins Original (${h((S.doc.uebersetzung.von || '').toUpperCase())})</b><span>Die Einträge zurückübersetzen und in eine Kopie des Originals „${h(S.doc.uebersetzung.von.toUpperCase())}" an dieselben Stellen setzen.</span></button>` : ''}
      <p class="hinweis" data-format>${formatText(S.doc)}</p>
      <p class="hinweis">QR-Codes stehen in allen Fassungen als festes Bild auf der Seite. Datum, E-Mail und Internetadresse sind im ausfüllbaren PDF gewöhnliche Textfelder.</p>
      <div class="zeile"><button class="knopf" data-x>Schließen</button></div>`, (d, zu) => {
      d.querySelector('[data-x]').onclick = zu;
      if (d.querySelector('[data-rueckweg]')) d.querySelector('[data-rueckweg]').onclick = () => { zu(); rueckwegDialog(S.doc.id); };
      d.querySelectorAll('[data-m]').forEach(b => b.onclick = async () => {
        const m = b.dataset.m; b.disabled = true;
        try {
          await speichernJetzt();
          if (m === 'html') {
            const html = await WFP.HtmlExport.htmlFormular(S.doc, S.bytes);
            const name = dateiName(S.doc.name) + ' (zum Ausfuellen).html';
            laden(name, new TextEncoder().encode(html), 'text/html');
            if (navigator.canShare) { try { const file = new File([html], name, { type: 'text/html' }); if (navigator.canShare({ files: [file] })) (d.querySelectorAll('[data-teilen]').forEach(x => x.remove()), b.insertAdjacentHTML('afterend', '<button class="knopf" data-teilen>📤 Teilen …</button>'), b.nextElementSibling.onclick = () => navigator.share({ files: [file], title: S.doc.name }).catch(() => {})); } catch (_) {} }
            // Ohne Felder ist darin nichts auszufüllen — das nicht still als Erfolg melden (Klaus 2026-09-25)
            if (!S.doc.fields.length) toast('⚠️ HTML gespeichert — aber dieses Dokument hat keine Felder, darin lässt sich nichts ausfüllen. Erst „🔍 Felder erkennen" oder Felder setzen, dann neu ausgeben.');
            else toast('✅ HTML gespeichert — im Browser öffnen, ausfüllen, dann „Als PDF speichern".');
            return;
          }
          const { bytes, hinweise } = await ausgabeBytes(S.doc, S.bytes, m === 'druck' ? 'fest' : m);
          const zusatz = { fest: '', ausfuellbar: ' (ausfuellbar)', vorlage: ' (Vorlage)', druck: '' }[m];
          if (m === 'druck') {
            const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
            const w = window.open(url, '_blank'); if (!w) laden(dateiName(S.doc.name) + '.pdf', bytes);
            setTimeout(() => URL.revokeObjectURL(url), 120000);
          } else {
            const name = dateiName(S.doc.name) + zusatz + '.pdf';
            laden(name, bytes);
            if (navigator.canShare) { try { const file = new File([bytes], name, { type: 'application/pdf' }); if (navigator.canShare({ files: [file] })) (d.querySelectorAll('[data-teilen]').forEach(x => x.remove()), b.insertAdjacentHTML('afterend', '<button class="knopf" data-teilen>📤 Teilen …</button>'), b.nextElementSibling.onclick = () => navigator.share({ files: [file], title: S.doc.name }).catch(() => {})); } catch (_) {} }
          }
          toast('✅ ' + (m === 'druck' ? 'PDF geöffnet' : 'PDF gespeichert') + (hinweise.length ? ' · ' + hinweise.join(' ') : ''));
          hops();
        } catch (e) { console.error(e); toast('⚠️ Ausgabe fehlgeschlagen: ' + (e.message || e)); }
        finally { b.disabled = false; }
      });
    });
  }


  /* ---------- Übersetzen (DE · RU · EN) ----------
     Seitenweise, nach JEDER Seite gespeichert (IndexedDB, Fach files, Kennung
     ue:<dok>:<von>-<nach>): ein Abbruch kostet höchstens eine Seite, ein zweiter
     Lauf setzt dort fort. Jede Seite wird auf DERSELBEN Seite übersetzt —
     Seiten- und Zeilenumbrüche des Originals bleiben (Wunsch Klaus 2026-09-25). */
  const jobId = (id, von, nach, rueck) => 'ue:' + id + ':' + von + '-' + nach + (rueck ? ':rueck' : '');
  async function jobLesen(id) { try { const r = await DB.get('files', id); return r && r.job || null; } catch (_) { return null; } }
  const sprachWahl = (name, wert) => `<select data-${name}>${Object.entries(UE.SPRACHEN).map(([k, v]) => `<option value="${k}"${k === wert ? ' selected' : ''}>${h(v)}</option>`).join('')}</select>`;

  // Eigener Bereich (Wunsch Klaus 2026-09-25): Originale und Ergebnisse liegen in
  // eigenen 🌐-Ordnern, damit sich nichts mit bearbeiteten Formularen mischt.
  // Die Ergebnis-Ordner hängen an der Kennung des Quell-Ordners (o.ziele), nicht am
  // Namen: jeder Ordner lässt sich umbenennen, ohne dass Ergebnisse woanders landen.
  // Ergebnisse gehören zum STAMM-Ordner (Klaus 2026-09-26): eine ausgefüllte Kopie liegt in
  // „Beispiele · ausgefüllt (aus EN)"; übersetzt man sie, gehört das Ergebnis nach
  // „Beispiele · RU" neben „Beispiele · EN" — nicht in einen dritten Ordner
  // „Beispiele · ausgefüllt (aus EN) · RU". Gefolgt wird der Kennung (o.quelle), nicht dem Namen.
  function stammOrdner(q) {
    let n = 0;
    while (q && q.quelle && n++ < 10) { const p = S.ordner.find(x => x.id === q.quelle); if (!p) break; q = p; }
    return q;
  }
  function abkoemmling(x, o) { let n = 0; while (x && x.quelle && n++ < 10) { if (x.quelle === o.id) return true; x = S.ordner.find(y => y.id === x.quelle); } return false; }
  async function ergebnisOrdner(d, schluessel, zusatz) {
    let q = stammOrdner(S.ordner.find(x => x.id === d.folderId));
    if (!q) { q = { id: uid(), name: d.name, bereich: 'uebersetzung', createdAt: jetzt() }; d.folderId = q.id; await DB.put('docs', d); await DB.put('folders', q); S.ordner.push(q); }
    q.ziele = q.ziele || {};
    let o = S.ordner.find(x => x.id === q.ziele[schluessel]);
    if (!o) {
      o = { id: uid(), name: q.name + ' · ' + zusatz, bereich: 'uebersetzung', quelle: q.id, createdAt: jetzt() };
      await DB.put('folders', o); S.ordner.push(o);
      q.ziele[schluessel] = o.id; await DB.put('folders', q);
    }
    return o;
  }
  function uebersetzenStart() {
    const quellen = S.ordner.filter(o => S.docs.some(d => d.folderId === o.id && !d.uebersetzung));
    dialog(`<h2>🌐 Übersetzen</h2>
      <p>Ein eigener Bereich: die Originale kommen in einen eigenen, frei benannten Ordner (z. B. „Handbücher", „Verträge"), die Übersetzungen in eigene Ordner je Sprache. Nichts mischt sich mit deinen bearbeiteten Formularen, und das Original bleibt unberührt.</p>
      <button class="wahl" data-uo><b>🗂️ Ordner vom Gerät übersetzen</b><span>Alle PDFs eines Ordners, beliebig viele Seiten. Jede Seite wird einzeln übersetzt und sofort gespeichert.</span></button>
      <button class="wahl" data-ud><b>📄 Einzelne PDFs oder Bilder übersetzen</b><span>Eine oder mehrere PDF-Dateien oder Fotos (JPG, PNG) wählen. Bei Fotos wird das Blatt gesucht und auf A4 gerade gezogen.</span></button>
      <button class="wahl" data-ubsp><b>📘 Beispiele zum Ausprobieren</b><span>Das Benutzerhandbuch dieser App (14 Seiten mit Bildern, Tabellen, Kästen, Querformat und einer gescannten Seite) und ein erfundenes Amtsformular. Übersetzen testen, ohne eigene Dokumente zu nehmen. Sie landen im Ordner „Beispiele".</span></button>
      <button class="wahl" data-uk><b>📷 Brief fotografieren</b><span>Papierbrief (z. B. vom Amt) Seite für Seite aufnehmen. Das Blatt wird auf A4 gerade gezogen — ausgedruckt wieder so groß wie das Papier. Die Texterkennung liest ihn auf dem Gerät.</span></button>
      ${quellen.length ? `<p style="margin-top:12px"><b>… oder einen Ordner, der schon hier liegt:</b></p>${quellen.map(o => `<button class="wahl" data-o="${o.id}"><b>${o.bereich === 'uebersetzung' ? '🌐 ' : '🗂️ '}${nm(o.name)}</b><span>${S.docs.filter(d => d.folderId === o.id && !d.uebersetzung).length} Dokumente</span></button>`).join('')}` : ''}
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (dl, zu) => {
      dl.querySelector('[data-x]').onclick = zu;
      dl.querySelector('[data-uo]').onclick = () => { zu(); $('inUeOrdner').click(); };
      dl.querySelector('[data-ud]').onclick = () => { zu(); $('inUeDateien').click(); };
      dl.querySelector('[data-ubsp]').onclick = async () => { zu(); const d = await beispieleLaden(); if (d.length) uebersetzenDialog(d.map(x => x.id), true); };
      dl.querySelector('[data-uk]').onclick = () => { zu(); scanStarten('uebersetzung', 'kamera'); };
      dl.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { zu(); S.aktOrdner = b.dataset.o; zeichneBibliothek(); uebersetzenDialog(S.docs.filter(d => d.folderId === b.dataset.o && !d.uebersetzung).map(d => d.id), true); });
    });
  }
  /* Beispiele zum Ausprobieren (Klaus 2026-09-25): das Benutzerhandbuch und ein erfundenes
     Amtsformular liegen unter beispiele/ (gebaut von tools/handbuch-bauen.mjs). Übersetzen
     testen, ohne eigene Dokumente zu nehmen. Schon eingelesene werden nicht doppelt angelegt;
     der Worker legt die PDFs beim ersten Abruf in den Vorrat, danach gehen sie offline. */
  const BEISPIELE = [
    { datei: 'beispiele/Workfloh-PDF-Benutzerhandbuch.pdf', name: 'Workfloh-PDF-Benutzerhandbuch' },
    { datei: 'beispiele/Beispiel-Amtsformular-Bewohnerparkausweis.pdf', name: 'Beispiel-Amtsformular-Bewohnerparkausweis' }];
  async function beispieleLaden(nur) {
    let ordnerName = 'Beispiele';
    if (S.ordner.some(o => o.name === ordnerName && o.bereich !== 'uebersetzung')) ordnerName += ' (Workfloh PDF)';
    const imOrdner = () => { const o = S.ordner.find(x => x.name === ordnerName && x.bereich === 'uebersetzung'); return o ? S.docs.filter(d => d.folderId === o.id && !d.uebersetzung) : []; };
    const gewollt = BEISPIELE.filter(b => !nur || b.name === nur);
    const fehlt = gewollt.filter(b => !imOrdner().some(d => d.name === b.name));
    if (fehlt.length) {
      let dateien;
      try {
        dateien = await Promise.all(fehlt.map(async b => {
          const r = await fetch(b.datei); if (!r.ok) throw new Error(r.status);
          return new File([await r.blob()], b.name + '.pdf', { type: 'application/pdf' });
        }));
      } catch (e) { toast('Die Beispiele ließen sich nicht laden — beim ersten Mal braucht es Internet.'); return []; }
      await importDateien(dateien, ordnerName, { still: true, bereich: 'uebersetzung' });
    }
    const da = imOrdner(); const o = S.ordner.find(x => x.name === ordnerName && x.bereich === 'uebersetzung');
    if (o) { S.aktOrdner = o.id; zeichneBibliothek(); }
    return gewollt.map(b => da.find(d => d.name === b.name)).filter(Boolean);
  }
  async function ueEinlesen(dateien, ordnerName) {
    const pdfs = Array.from(dateien || []).filter(f => istPdf(f) || istBild(f));
    if (!pdfs.length) return toast('Keine PDF- oder Bilddatei gefunden.');
    let name = await eingabe('Ordner benennen', 'Name für diesen Übersetzungs-Ordner (z. B. Handbücher, Verträge) — später änderbar', ordnerName || '');
    if (!name) return;
    // Nie in einen gewöhnlichen Ordner mischen: gleicher Name → eigener Zusatz
    if (S.ordner.some(o => o.name === name && o.bereich !== 'uebersetzung')) name += ' (Übersetzung)';
    const neu = await importDateien(pdfs, name, { still: true, bereich: 'uebersetzung' });
    if (neu && neu.length) uebersetzenDialog(neu.map(d => d.id), true);
  }

  // Fotografierter Brief → eigener Übersetzungs-Ordner (frei benannt), dann Übersetzen-Fenster
  async function ueFotoAblegen(bytes) {
    const stempel = new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    let name = await eingabe('Ordner benennen', 'Name für den Übersetzungs-Ordner (z. B. Briefe vom Amt) — später änderbar', 'Briefe');
    if (!name) return;
    if (S.ordner.some(o => o.name === name && o.bereich !== 'uebersetzung')) name += ' (Übersetzung)';
    let o = S.ordner.find(x => x.name === name && x.bereich === 'uebersetzung');
    if (!o) { o = { id: uid(), name, bereich: 'uebersetzung', createdAt: jetzt() }; await DB.put('folders', o); }
    const doc = await neuesDok('Brief ' + stempel, bytes, 'foto', o.id);
    S.aktOrdner = o.id; await ladeBibliothek(); hops();
    uebersetzenDialog([doc.id], true);
  }
  /* „In Chrome öffnen" (Klaus 2026-09-25): im installierten App-Fenster fehlt oft
     ⋮ → „Übersetzen", und die Adresse der App kennt kaum jemand. Die Adresse trägt
     Dokumente und Sprachen mit; der Chrome-Tab öffnet damit denselben Übersetzer
     wieder (Rückweg), und das Ergebnis wird ein PDF wie hier — nicht die übersetzte
     App-Oberfläche. Auf Android über „Teilen" (siehe inChromeOeffnen), anderswo ein
     neuer Tab. */
  // lage: { ids, von, nach } (Seiten übersetzen) oder { rueck: id } (Einträge ins Original)
  function chromeTabAdresse(l) {
    const u = new URL(location.pathname, location.origin);
    if (l.rueck) u.searchParams.set('rueck', l.rueck);
    else { u.searchParams.set('ue', l.ids.join(',')); u.searchParams.set('von', l.von); u.searchParams.set('nach', l.nach); }
    u.searchParams.set('weg', 'chrome');
    return { url: u.href };
  }
  const leer = l => !l.rueck && !(l.ids && l.ids.length);
  /* Direkt hinüberspringen geht aus der installierten App NICHT: der Geltungsbereich
     ist „./", und Android gibt jede Adresse unter /Workflow-PDF/ an die App zurück — auch
     einen intent an Chrome, und auch „Chrome starten" ohne Adresse blitzte am Tablet nur
     weiß auf (Klaus 2026-09-25, dreimal gemessen). Was trägt, hat Klaus gefunden:
     „Teilen" → Chrome wählen. Das ist jetzt der Weg des Knopfes. */
  const istAndroid = () => /Android/i.test(navigator.userAgent);
  // Im installierten App-Fenster TEILEN, sobald Teilen geht — auch wenn der Browser sich nicht
  // als Android ausgibt: im Samsung-DeX-Modus meldet Chrome ein Linux-Gerät, und dort blitzte
  // „In Chrome öffnen" (window.open) nur kurz auf (Klaus 2026-09-26). Aus dem App-Fenster führt
  // KEIN Sprung hinaus, weil jede Adresse unter /Workflow-PDF/ zur App gehört.
  const imFenster = () => matchMedia('(display-mode: standalone)').matches;
  const teilenWeg = () => istAndroid() || (imFenster() && !!navigator.share);
  // Auf Android ist der Knopf „Teilen" — der Name sagt deshalb, WOHIN (Klaus 2026-09-25:
  // „nicht, dass die dann überlegen, was soll ich denn für ein Übersetzungsprogramm nehmen").
 const chromeKnopf = () => teilenWeg() ? '🌐 Mit Browser öffnen zum Übersetzen' : '🌐 In Chrome öffnen';
  // Der Weg, der am Tablet trägt (Klaus: „das Kopieren funktioniert"): kopieren + einfügen.
  function chromeHinweis(url, kopiert) {
    dialog(`<h2>In Chrome öffnen</h2><p data-chromehinweis>${kopiert ? '✅ Die Adresse liegt in der Zwischenablage. ' : ''}So geht es: 1. Chrome öffnen · 2. oben in die Adresszeile tippen · 3. lange drücken und „Einfügen" · 4. öffnen. Die Dokumente sind dort da, der Übersetzer öffnet sich von selbst.</p>
      <p class="hinweis">Direkt hinüberspringen geht aus der installierten App nicht: Android schickt jede Adresse dieser App an die App zurück.</p>
      <input readonly data-adr style="width:100%;font-size:12px;padding:6px;border:1px solid #bbb;border-radius:6px">
      <div class="zeile"><button class="knopf" data-kopie>📋 Nochmal kopieren</button><button class="knopf rot" data-hinok>OK</button></div>`, (d, zu) => {
      const f = d.querySelector('[data-adr]'); f.value = url; f.onfocus = () => f.select();
      d.querySelector('[data-kopie]').onclick = async () => { try { await navigator.clipboard.writeText(url); toast('📋 Adresse kopiert.'); } catch (_) { f.focus(); } };
      d.querySelector('[data-hinok]').onclick = zu;
    });
  }

  async function inChromeOeffnen(l, vorher) {
    if (leer(l)) return toast('Kein Dokument gewählt.');
    const a = chromeTabAdresse(l);
    window.__wfpdfChromeTab = a;   // für die Probe
    if (!teilenWeg()) {
      if (vorher) try { await vorher(); } catch (_) {}
      try { await speichernJetzt(); } catch (_) {}
      window.open(a.url, '_blank', 'noopener'); return;
    }
    // Android: „Teilen" SOFORT aus dem Tipp heraus (danach erlaubt der Browser es nicht
    // mehr); Anhalten und Speichern laufen, während das Teilen-Fenster offen ist.
    let teilen = null;
    if (navigator.share) {
      try { teilen = navigator.share({ title: 'Workfloh PDF · mit dem Browser öffnen zum Übersetzen', url: a.url }); toast('Im Teilen-Fenster den Browser „Chrome" wählen — kein anderes Übersetzungsprogramm. Dort ⋮ → „Übersetzen".'); }
      catch (e) { teilen = Promise.reject(e); }
    }
    if (vorher) try { await vorher(); } catch (_) {}
    try { await speichernJetzt(); } catch (_) {}
    if (teilen) {
      try { await teilen; return; }
      catch (e) { if (e && e.name === 'AbortError') return; }   // selbst abgebrochen: nichts tun
    }
    // Kein Teilen möglich: Adresse kopieren + Anleitung (Klaus: „das Kopieren funktioniert")
    let kopiert = false;
    try { await navigator.clipboard.writeText(a.url); kopiert = true; } catch (_) {}
    chromeHinweis(a.url, kopiert);
  }
  function chromeTabKnoepfe(el, lage, vorher) {   // lage() → { ids, von, nach } oder { rueck }
    const k = (txt, titel) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'knopf klein'; b.textContent = txt; b.title = titel; b.style.cssText = 'padding:6px 10px;border:1px solid #999;border-radius:8px;background:#fff;font-size:13px'; el.appendChild(b); return b; };
    k(chromeKnopf(), teilenWeg() ? 'Öffnet das Teilen-Fenster — dort Chrome wählen. Dann ⋮ → „Übersetzen", das Ergebnis wird ein PDF wie hier.' : 'Öffnet dieselben Dokumente im Chrome-Browser. Dort ⋮ → „Übersetzen" — das Ergebnis wird ein PDF wie hier.').onclick = () => inChromeOeffnen(lage(), vorher);
    if (navigator.share && !teilenWeg()) k('📤 Teilen …', 'Teilen mit Chrome oder einem anderen Browser').onclick = async () => {
      const l = lage(); if (leer(l)) return toast('Kein Dokument gewählt.');
      try { await navigator.share({ title: 'Workfloh PDF · Übersetzen', url: chromeTabAdresse(l).url }); } catch (_) {}
    };
    k('📋 Adresse kopieren', 'Adresse in die Zwischenablage, dann in Chrome einfügen').onclick = async () => {
      const l = lage(); if (leer(l)) return toast('Kein Dokument gewählt.');
      const url = chromeTabAdresse(l).url;
      try { await navigator.clipboard.writeText(url); toast('📋 Adresse kopiert — in Chrome oben einfügen.'); } catch (_) { await eingabe('Adresse', 'Kopieren und in Chrome einfügen', url); }
    };
  }
  // Aus der App hierher geteilt: ein Band sagt, wie das Ergebnis in die App kommt
  // (Klaus 2026-09-26, am Tablet geprüft: zurück in der App ⟳ tippen, dann ist es da).
  function zurueckBand() {
    if (document.querySelector('[data-zurueckband]')) return;
    const b = document.createElement('div'); b.setAttribute('data-zurueckband', '');
    b.style.cssText = 'position:sticky;top:0;z-index:50;background:#fff3cd;border-bottom:1px solid #e6d9a8;padding:8px 12px;font-size:14px';
    b.innerHTML = '<b>Aus der App in Chrome geöffnet.</b> Wenn du fertig bist: zurück in die App und dort oben <b>⟳ (Aktualisieren)</b> tippen — dann ist das Ergebnis auch dort.';
    document.body.prepend(b);
  }
  // Beim Start: Aufruf aus „In Chrome öffnen" → Übersetzer mit denselben Dokumenten wieder öffnen.
  async function chromeTabRueckweg() {
    const q = new URLSearchParams(location.search);
    if (q.has('rueck')) {   // „↩ Einträge ins Original" aus der App in Chrome geöffnet
      const id = q.get('rueck');
      const u = new URL(location.href); ['rueck', 'weg'].forEach(n => u.searchParams.delete(n)); history.replaceState(null, '', u.pathname + u.search + u.hash);
      if (!(S.docs.some(d => d.id === id) || await DB.get('docs', id))) return toast('⚠️ Das Dokument ist in diesem Browser nicht da — hier ist der Speicher getrennt von der App. Die Einträge in der App mit „📱 Übersetzer im Browser" oder „🤖 KI" zurückholen.');
      S.ausApp = true; zurueckBand();
      return rueckwegDialog(id, { chromeTab: true });
    }
    if (!q.has('ue')) return;
    const ids = String(q.get('ue') || '').split(',').filter(Boolean), von = q.get('von'), nach = q.get('nach');
    const u = new URL(location.href); ['ue', 'von', 'nach', 'weg'].forEach(n => u.searchParams.delete(n)); history.replaceState(null, '', u.pathname + u.search + u.hash);
    if (UE.SPRACHEN[von] && UE.SPRACHEN[nach] && von !== nach) { EINST.ueVon = von; EINST.ueNach = nach; einstSpeichern(); }
    const da = []; for (const id of ids) if (S.docs.some(d => d.id === id) || await DB.get('docs', id)) da.push(id);
    if (!da.length) return toast('⚠️ Die Dokumente sind in diesem Browser nicht da — hier ist der Speicher getrennt von der App. Das PDF hier einlesen und „🌐 Übersetzen" tippen.');
    S.ausApp = true; zurueckBand();
    uebersetzenDialog(da, true, { chromeTab: true });
  }
  /* Eine Übersetzung trägt ZWEI Textschichten: das Original (weiß abgedeckt) und die
     Übersetzung darüber. Sie noch einmal zu übersetzen liest beide — heraus kam „Модель
     городаCity Model city" (Klaus 2026-09-25, „[EN] [EN]"). Übersetzt wird deshalb immer
     das ORIGINAL; fehlt es, sagt die App das, statt gemischten Text zu bauen. */
  async function originalVon(d) {
    let q = d, n = 0;
    while (q && q.uebersetzung && q.uebersetzung.quelle && n++ < 5) {
      const o = S.docs.find(x => x.id === q.uebersetzung.quelle) || await DB.get('docs', q.uebersetzung.quelle);
      if (!o || !await DB.getFile(o.id)) return null;
      q = o;
    }
    return q;
  }
  /* Große Dokumente VOR dem Übersetzen in Teile schneiden (Klaus 2026-09-26: „vorher
     messen … in wie viele Teile … rechnerisch nachweisbar … Teil 1 zum Übersetzen,
     Teil 2, Teil 3"). Die Rechnung steht in UE.teilPlan, hier nur Anzeige und Schnitt.
     Die Teile sind eigene Dokumente in „<Ordner> · Teile"; ihre Übersetzungen landen
     alle im selben Ergebnis-Ordner wie die des ganzen Dokuments („<Ordner> · RU"). */
  const _groesse = new Map();
  async function dateiGroesse(id) { if (!_groesse.has(id)) { const b = await DB.getFile(id); _groesse.set(id, b ? b.length : 0); } return _groesse.get(id); }
  const zeitText = p => EINST.ueMsSeite ? 'Zuletzt gemessen: ' + (EINST.ueMsSeite / 1000).toFixed(1).replace('.', ',') + ' s je Seite → ein Teil mit ' + p.jeTeil + ' Seiten etwa ' + Math.max(1, Math.round(EINST.ueMsSeite * p.jeTeil / 60000)) + ' min.' : 'Zeit je Seite: noch nicht gemessen — nach dem ersten Teil steht sie hier.';
  async function teilPlanZeigen(dl, g, zu) {
    const box = dl.querySelector('[data-teilplan]'); if (!box) return;
    const gross = [];
    for (const d of g) { if (d.teilVon || d.uebersetzung) continue; const p = UE.teilPlan(await dateiGroesse(d.id), d.pages.length); if (p.noetig) gross.push({ d, p }); }
    box.innerHTML = gross.map(({ d, p }) => `<div class="teilplan" data-plan="${h(d.id)}" style="background:#fff3cd;padding:8px;border-radius:8px;margin:6px 0">
      <b>📚 ${nm(d.name)}: ${p.seiten} Seiten — in Teilen übersetzen?</b>
      <p class="hinweis" style="margin:4px 0">Ein Lauf über alle Seiten dauert lange, und bricht der Übersetzer ab, fehlt der Rest. In Teilen geht jeder Teil für sich, und jedes Ergebnis ist ein eigenes, kleineres PDF. Vorher gerechnet:</p>
      <ul class="hinweis" data-rechnung style="margin:2px 0 6px 18px;padding:0">${p.rechnung.map(r => '<li>' + h(r) + '</li>').join('')}</ul>
      <p class="hinweis" data-zeit style="margin:2px 0">${zeitText(p)}</p>
      <label style="font-weight:400">Seiten je Teil <input type="number" min="1" max="${p.seiten}" value="${p.jeTeil}" data-jeteil style="width:5em"></label>
      <button class="knopf klein" data-teilen="${h(d.id)}">✂️ In ${p.teile.length} Teile aufteilen</button>
    </div>`).join('');
    box.querySelectorAll('[data-plan]').forEach(el => {
      const d = gross.find(x => x.d.id === el.dataset.plan).d, inp = el.querySelector('[data-jeteil]'), knopf = el.querySelector('[data-teilen]');
      const neuRechnen = async () => {
        const p = UE.teilPlan(await dateiGroesse(d.id), d.pages.length, +inp.value || 0);
        el.querySelector('[data-rechnung]').innerHTML = p.rechnung.map(r => '<li>' + h(r) + '</li>').join('');
        knopf.textContent = '✂️ In ' + p.teile.length + ' Teile aufteilen';
        el.querySelector('[data-zeit]').textContent = zeitText(p);
        return p;
      };
      inp.oninput = neuRechnen;
      knopf.onclick = async () => { const p = await neuRechnen(); zu(); const teile = await teileAnlegen(d, p); if (teile && teile.length) uebersetzenDialog(teile.map(x => x.id), false, { gewaehlt: [teile[0].id] }); };
    });
  }
  async function teileAnlegen(d, plan) {
    const bytes = await DB.getFile(d.id); if (!bytes) { toast('⚠️ Die Datei fehlt.'); return null; }
    // Schon mit denselben Grenzen geschnitten? Dann dieselben Teile nehmen, nichts doppelt.
    const da = (await DB.all('docs')).filter(x => x.teilVon && x.teilVon.quelle === d.id);
    const gleich = plan.teile.map(t => da.find(x => x.teilVon.von === t.von && x.teilVon.bis === t.bis && x.teilVon.n === plan.teile.length));
    if (gleich.every(Boolean)) { toast('📚 Diese ' + plan.teile.length + ' Teile gibt es schon — sie werden genommen.'); return gleich; }
    const fb = fortschritt('„' + d.name + '" wird in ' + plan.teile.length + ' Teile geschnitten');
    try {
      const { PDFDocument } = PDFLib;
      const quelle = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const ziel = await ergebnisOrdner(d, 'teile', 'Teile');
      const out = [];
      for (const t of plan.teile) {
        fb.setze((t.nr - 1) / plan.teile.length, 'Teil ' + t.nr + ' von ' + plan.teile.length + ' · Seiten ' + t.von + '–' + t.bis);
        const neu = await PDFDocument.create();
        const kopien = await neu.copyPages(quelle, Array.from({ length: t.seiten }, (_, i) => t.von - 1 + i));
        kopien.forEach(k => neu.addPage(k));
        const b = await neu.save();
        const nd = await neuesDok(d.name + ' — Teil ' + t.nr + ' von ' + plan.teile.length + ' (S. ' + t.von + '–' + t.bis + ')', b, 'teil', ziel.id);
        nd.teilVon = { quelle: d.id, nr: t.nr, n: plan.teile.length, von: t.von, bis: t.bis, geschaetztMB: +t.mb.toFixed(2), gemessenMB: +(b.length / 1048576).toFixed(2) };
        await DB.put('docs', nd); out.push(nd);
      }
      fb.zu(); await ladeBibliothek();
      window.__wfpdfTeile = out.map(x => x.teilVon);
      toast('✂️ ' + out.length + ' Teile liegen in „' + ziel.name + '". Teil 1 ist zum Übersetzen gewählt.');
      return out;
    } catch (e) { fb.zu(); console.error(e); toast('⚠️ Aufteilen fehlgeschlagen: ' + (e.message || e) + ' — das Original ist unverändert.'); return null; }
  }
  async function uebersetzenDialog(ids, alleGewaehlt, opt) {
    opt = opt || {};
    const docs = [], ersetzt = [], ohneOriginal = [];
    for (const id of ids) {
      let d = S.docs.find(x => x.id === id) || await DB.get('docs', id); if (!d) continue;
      if (d.uebersetzung) {
        const o = await originalVon(d);
        if (!o) { ohneOriginal.push(d); continue; }
        if (!ids.includes(o.id)) ersetzt.push({ von: d.name, nach: o.name, sprache: d.uebersetzung.gegenprobe ? d.uebersetzung.nach : d.uebersetzung.von });
        d = o;
      }
      if (!docs.some(x => x.id === d.id)) docs.push(d);
    }
    // Die Ausgangssprache ist die des Originals — sonst stünde „von: Deutsch" vor einem Umweg über Russisch.
    const vonVorgabe = ersetzt.length && UE.SPRACHEN[ersetzt[0].sprache] ? ersetzt[0].sprache : EINST.ueVon;
    if (!docs.length) return toast('⚠️ „' + (ohneOriginal[0] ? ohneOriginal[0].name : '') + '" ist selbst eine Übersetzung, und ihr Original liegt nicht mehr hier. Eine Übersetzung noch einmal zu übersetzen mischt beide Sprachen — bitte das Original einlesen und das übersetzen.');
    const mehrere = docs.length > 1; const a = ER.ANBIETER[EINST.anbieter];
    dialog(`<h2>🌐 Übersetzen</h2>${opt.chromeTab ? `<p class="hinweis" data-ausapp style="background:#fff3cd;padding:8px;border-radius:8px"><b>Aus der App in Chrome geöffnet.</b> Tippe „🌐 Mit Chrome übersetzen", danach in Chrome ⋮ → „Übersetzen" → ${h(UE.SPRACHEN[EINST.ueNach] || '')}. Das Ergebnis wird ein PDF wie in der App und liegt in der Bibliothek.</p>` : ''}
      <p class="hinweis">Jede Seite wird auf derselben Seite übersetzt: Bilder, Grafiken und Aufbau des Originals bleiben, nur der Text wird an seiner Stelle ersetzt — in der Farbe des Originals. Gescannte Seiten liest die Texterkennung (OCR) auf dem Gerät. Seitenumbrüche bleiben, das Original bleibt unberührt. Die Ergebnisse kommen in eigene Ordner je Sprache („… · RU"), getrennt von den Originalen; alle Ordner lassen sich umbenennen.</p>
      ${ersetzt.length ? `<p class="hinweis" data-ersetzt style="background:#e8f0fe;padding:8px;border-radius:8px">${ersetzt.map(e => `„${nm(e.von)}" ist selbst eine Übersetzung — übersetzt wird ihr <b>Original</b> „${nm(e.nach)}" (${h(UE.SPRACHEN[e.sprache] || e.sprache)}). So entsteht sauberer Text statt zweier Sprachen übereinander.`).join('<br>')}</p>` : ''}
      ${ohneOriginal.length ? `<p class="hinweis" data-ohneoriginal>Weggelassen: ${ohneOriginal.map(d => '„' + nm(d.name) + '"').join(', ')} — selbst eine Übersetzung, das Original liegt nicht mehr hier.</p>` : ''}
      ${mehrere ? `<p><b>Welche Dokumente?</b> <button class="knopf klein" data-alle>Alle</button></p>` : ''}
      <div class="erk-liste">${docs.map((d, i) => `<label class="erk-dok"><input type="checkbox" data-dok="${h(d.id)}"${(opt.gewaehlt ? opt.gewaehlt.includes(d.id) : !mehrere || (alleGewaehlt && !d.uebersetzung)) ? ' checked' : ''}> ${nm(d.name)} <span class="hinweis">· ${d.pages.length} S.${d.uebersetzung ? ' · schon eine Übersetzung' : ''}${!d.uebersetzung ? ' · ' + (d.fields.filter(f => f.geprueft).length ? d.fields.filter(f => f.geprueft).length + ' Felder kommen übersetzt mit' : 'keine Felder') : ''}</span>${!d.uebersetzung && !d.fields.filter(f => f.geprueft).length ? ` <button class="knopf klein" data-feld="${h(d.id)}" title="Rahmen zum Ausfüllen (Text, Datum, Kästchen, Unterschrift) im Original setzen — sie kommen dann übersetzt mit">✏️ erst Felder setzen</button>` : ''}</label>`).join('')}</div>
      <p class="hinweis">Formular zum Ausfüllen (z. B. vom Amt)? Die Rahmen zum Ausfüllen am besten <b>im Original</b> setzen („✏️ erst Felder setzen", oder „🔍 Felder erkennen") — dann kommen sie übersetzt an dieselbe Stelle mit. Nach dem Ausfüllen holt „⬇ PDF ausgeben → ↩ Einträge ins Original" die Einträge zurück.</p>
      <div class="ue-sprachen"><div><label>von</label>${sprachWahl('von', vonVorgabe)}</div><div class="ue-pfeil">→</div><div><label>nach</label>${sprachWahl('nach', EINST.ueNach)}</div></div>
      <label style="font-weight:400"><input type="checkbox" data-rueck${EINST.ueRueck !== false ? ' checked' : ''}> Gegenprobe: danach zurück in die Ausgangssprache übersetzen und daneben ablegen</label>
      <label style="font-weight:400" title="Aus: Bilder, Fotos und Zeichnungen bleiben wie im Original. An: Text in größeren Bildern wird gelesen und übersetzt darübergelegt — die Texterkennung hält dabei manchmal Kanten oder Muster eines Fotos für Buchstaben."><input type="checkbox" data-bilder${EINST.ueBilder ? ' checked' : ''}> Text in Bildern mitübersetzen (sonst bleiben Bilder unverändert)</label>
      <p class="hinweis" data-zahl></p>
      <div data-teilplan></div>
      <button class="wahl" data-weg="browser"><b>📱 Übersetzer im Browser</b><span data-bstat>prüfe …</span></button>
      <button class="wahl" data-weg="chrome"><b>🌐 Mit Chrome übersetzen (Google)</b><span>Kostenlos, ohne Schlüssel und ohne Kontingent. Die App zeigt den Text jeder Seite unten an, du tippst einmal in Chrome ⋮ → „Übersetzen" — danach läuft es Seite für Seite von selbst. Der Text geht dabei an Google.${matchMedia('(display-mode: standalone)').matches ? ' Die App läuft gerade im eigenen Fenster — dort fehlt „Übersetzen" oft. Dann „' + chromeKnopf() + '" (darunter)' + (teilenWeg() ? ': im Teilen-Fenster Chrome wählen, dort öffnet sich derselbe Übersetzer. Zurück in der App oben ⟳ tippen.' : ': derselbe Übersetzer öffnet sich in Chrome.') : ''}</span></button>
      ${matchMedia('(display-mode: standalone)').matches ? '<div class="zeile" data-tabreihe style="flex-wrap:wrap;gap:6px;margin:-4px 0 8px"></div>' : ''}
      <button class="wahl" data-weg="ki"><b>🤖 Mit KI — ${h(a.label)}</b><span>${kiBereit() ? `Der Text jeder Seite (nicht das Bild) geht an ${h(a.label)}. Kostet je Seite, abgerechnet über deinen Schlüssel. Vor dem ersten Senden wird gefragt.` : 'Noch kein Schlüssel eingetragen — tippen, um ihn in den Einstellungen einzutragen.'}</span></button>
      <details class="ue-mess"><summary>🔎 Messen: was kann dieses Gerät?</summary><div data-mess class="hinweis">Tippen auf „Jetzt messen".</div><button class="knopf klein" data-messen>Jetzt messen</button></details>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (dl, zu) => {
      const gewaehlt = () => docs.filter(d => { const c = dl.querySelector(`[data-dok="${CSS.escape(d.id)}"]`); return c && c.checked; });
      const von = () => dl.querySelector('[data-von]').value, nach = () => dl.querySelector('[data-nach]').value;
      const stat = async () => {
        const g = gewaehlt(), seiten = g.reduce((n, d) => n + d.pages.length, 0);
        const gleich = von() === nach();
        dl.querySelector('[data-zahl]').textContent = gleich ? 'Ausgangs- und Zielsprache sind gleich.' : g.length ? `${g.length} Dokument${g.length === 1 ? '' : 'e'} · ${seiten} Seiten` : 'Noch kein Dokument gewählt.';
        dl.querySelectorAll('[data-weg]').forEach(b => b.disabled = !g.length || gleich);
        await teilPlanZeigen(dl, g, zu);
        const bs = dl.querySelector('[data-bstat]'); const v = await UE.browserVerfuegbar(von(), nach());
        bs.textContent = { fehlt: 'Dieser Browser hat keinen eingebauten Übersetzer (Translator). Dann bleibt die KI mit eigenem Schlüssel.', unavailable: `${UE.SPRACHEN[von()]} → ${UE.SPRACHEN[nach()]} kann der eingebaute Übersetzer nicht.`,
          downloadable: 'Kostenlos, auf dem Gerät. Das Sprachpaket wird beim ersten Mal geladen (einmalig, Internet nötig).', downloading: 'Das Sprachpaket wird gerade geladen …',
          available: 'Kostenlos, läuft auf dem Gerät — der Text verlässt das Gerät nicht.' }[v] || String(v);
        if (v === 'fehlt' || v === 'unavailable') dl.querySelector('[data-weg="browser"]').disabled = true;
      };
      dl.querySelectorAll('[data-dok]').forEach(c => c.onchange = stat);
      dl.querySelectorAll('[data-feld]').forEach(b => b.onclick = e => { e.preventDefault(); zu(); oeffneDok(b.dataset.feld); toast('✏️ Rahmen setzen: oben die Art wählen (Text, Datum, Kästchen, Unterschrift …), dann auf die Stelle tippen. Danach „🌐 Übersetzen" am Ordner.'); });
      dl.querySelector('[data-von]').onchange = dl.querySelector('[data-nach]').onchange = stat;
      if (dl.querySelector('[data-alle]')) dl.querySelector('[data-alle]').onclick = () => { const alle = gewaehlt().length < docs.length; dl.querySelectorAll('[data-dok]').forEach(c => c.checked = alle); stat(); };
      stat();
      if (dl.querySelector('[data-tabreihe]')) chromeTabKnoepfe(dl.querySelector('[data-tabreihe]'), () => ({ ids: gewaehlt().map(d => d.id), von: von(), nach: nach() }));
      if (opt.chromeTab) { const cb = dl.querySelector('[data-weg="chrome"]'); cb.style.outline = '3px solid #E0231B'; cb.scrollIntoView({ block: 'center' }); }
      dl.querySelector('[data-messen]').onclick = async () => { dl.querySelector('[data-mess]').innerHTML = '…'; dl.querySelector('[data-mess]').innerHTML = await messen(gewaehlt()); };
      dl.querySelector('[data-x]').onclick = zu;
      dl.querySelectorAll('[data-weg]').forEach(b => b.onclick = async () => {
        const g = gewaehlt(); if (!g.length) return toast('Kein Dokument gewählt.');
        EINST.ueVon = von(); EINST.ueNach = nach(); EINST.ueRueck = dl.querySelector('[data-rueck]').checked; EINST.ueBilder = dl.querySelector('[data-bilder]').checked; einstSpeichern();
        const weg = b.dataset.weg;
        let u;
        try { u = await uebersetzerErzeugen(weg, EINST.ueVon, EINST.ueNach, EINST.ueRueck, b, zu, g.map(d => d.id)); }
        catch (e) { toast('⚠️ Übersetzer lässt sich nicht starten: ' + (e.message || e)); b.disabled = false; return; }
        if (!u) return;
        zu();
        uebersetzeViele(g.map(d => d.id), EINST.ueVon, EINST.ueNach, u.hin, u.zurueck, weg);
      });
    });
  }

  /* Übersetzer erzeugen — EINE Stelle für Hinweg, Gegenprobe und Rückweg der Einträge.
     Browser: aus dem Tipp heraus (ein Sprachpaket darf nur aus einer Nutzer-Geste
     geladen werden). KI: Freigabe je Anbieter einmal. null = abgebrochen. */
  // lage: die Dokumente (Liste von Kennungen) oder ein fertiges { rueck: id } für „In Chrome öffnen"
  async function uebersetzerErzeugen(weg, von, nach, mitRueck, knopf, zu, ids) {
    if (weg === 'chrome') {   // keine Gegenprobe: Chrome übersetzt nur in EINE Richtung zugleich
      const opt = {};
      const lage = Array.isArray(ids) ? (ids.length ? { ids, von, nach } : null) : ids;
      // Android, installiertes App-Fenster: dort gibt es ⋮ → „Übersetzen" nicht (Klaus
      // 2026-09-25: „ich kann von da aus nur abbrechen"). Die Fläche wäre eine Sackgasse —
      // also gleich der Weg, der trägt: Teilen-Fenster → Chrome.
      if (lage && imFenster() && teilenWeg()) { if (zu) zu(); await inChromeOeffnen(lage); return null; }
      if (lage && matchMedia('(display-mode: standalone)').matches) opt.tab = el => chromeTabKnoepfe(el, () => lage, () => { if (hin.halt) hin.halt(); });
      const hin = UE.chromeUebersetzer(von, nach, opt);
      return { hin, zurueck: null };
    }   // keine Gegenprobe: Chrome übersetzt nur in EINE Richtung zugleich
    if (weg === 'browser') {
      const sp = knopf && knopf.querySelector('span');
      if (knopf) knopf.disabled = true; if (sp) sp.textContent = 'Übersetzer wird vorbereitet …';
      const hin = await UE.browserUebersetzer(von, nach, p => { if (sp) sp.textContent = 'Sprachpaket lädt … ' + Math.round(p * 100) + ' %'; });
      const zurueck = mitRueck ? await UE.browserUebersetzer(nach, von) : null;
      return { hin, zurueck };
    }
    if (zu) zu();
    if (!kiBereit()) { einstellungen(); return null; }
    const a = ER.ANBIETER[EINST.anbieter]; const okKey = 'ue:' + EINST.anbieter;
    if (!EINST.kiOk[okKey]) {
      const ok = await frage('Text an die KI senden?', `<p>Der Text der gewählten Seiten wird an <b>${h(a.label)}</b> übertragen (Verarbeitung: ${h(a.region)}) und dort übersetzt. Enthält er persönliche Angaben, gehen diese mit. Abgerechnet wird über deinen Schlüssel.</p><p class="hinweis">Diese Frage kommt je Anbieter einmal. Ohne Bestätigung verlässt nichts das Gerät.</p>`, 'Senden');
      if (!ok) return null; EINST.kiOk[okKey] = true; einstSpeichern();
    }
    const cfg = { anbieter: EINST.anbieter, schluessel: EINST.schluessel[EINST.anbieter], modell: EINST.uebModell[EINST.anbieter] };
    return { hin: UE.kiUebersetzer(cfg, von, nach), zurueck: mitRueck ? UE.kiUebersetzer(cfg, nach, von) : null };
  }

  /* Felder mitnehmen (Klaus 2026-09-25: deutsches Behördenformular → auf Russisch
     ausfüllen → Einträge zurück ins deutsche Formular). Seiten und Maße bleiben beim
     Übersetzen gleich, also passen die Prozent-Lagen 1:1. Übersetzt werden die
     Beschriftung und Text-Einträge; Datum, E-Mail, Internetadresse, QR, Unterschrift
     und Kästchen gehen unverändert mit. quellFeld merkt das Feld im Original. */
  const OHNE_UEBERSETZUNG = new Set(['datum', 'email', 'tel', 'url', 'kdnr', 'artnr', 'qr', 'unterschrift', 'check']);
  async function felderUebersetzen(felder, uebersetzer, mitLabel) {
    const texte = [], ziel = [];
    const neu = felder.map(f => Object.assign(JSON.parse(JSON.stringify(f)), { id: uid(), quellFeld: f.quellFeld || f.id }));
    neu.forEach(f => {
      if (mitLabel && f.label) { ziel.push([f, 'label']); texte.push(UE.zeichenNormal(f.label)); }
      if (!OHNE_UEBERSETZUNG.has(f.type) && typeof f.value === 'string' && f.value.trim()) { ziel.push([f, 'value']); texte.push(UE.zeichenNormal(f.value)); }
    });
    if (texte.length) {
      const out = await uebersetzer(texte);
      out.forEach((t, i) => { const [f, k] = ziel[i]; f[k] = UE.zeichenNormal(t); });
    }
    return neu;
  }

  function rueckwegMoeglich(d) { return !!(d && d.uebersetzung && !d.uebersetzung.gegenprobe && d.uebersetzung.quelle); }
  // Rückweg: die Einträge des übersetzten Dokuments übersetzt in eine KOPIE des Originals
  async function rueckwegDialog(id, opt) {
    opt = opt || {};
    const fenster = matchMedia('(display-mode: standalone)').matches;
    await speichernJetzt();
    const d = await DB.get('docs', id); if (!rueckwegMoeglich(d)) return toast('Dieses Dokument ist keine Übersetzung eines Originals hier.');
    const src = await DB.get('docs', d.uebersetzung.quelle);
    if (!src || !await DB.getFile(src.id)) return toast('⚠️ Das Original „' + (d.name || '') + '" liegt nicht mehr in diesem Browser.');
    const von = d.uebersetzung.nach, nach = d.uebersetzung.von;           // zurück: z. B. RU → DE
    const eintraege = d.fields.filter(f => f.type === 'check' ? f.value : String(f.value || '').trim()).length;
    const a = ER.ANBIETER[EINST.anbieter];
    dialog(`<h2>↩ Einträge ins Original (${h(UE.SPRACHEN[nach])})</h2>
      <p>Die <b>${eintraege}</b> Einträge aus „${nm(d.name)}" werden ins ${h(UE.NAME_DE[nach] || nach)}e übersetzt und in eine <b>Kopie</b> des Originals „${nm(src.name)}" eingesetzt — an dieselbe Stelle. Das Original und die Übersetzung bleiben unverändert.</p>
      <p class="hinweis">Datum, E-Mail, Internetadresse, Unterschrift und Kästchen werden übernommen, nicht übersetzt. Bitte die Einträge danach prüfen — Namen und Adressen bleiben in der Regel stehen, aber jede Übersetzung kann sich irren.</p>
      <button class="wahl" data-weg="browser"><b>📱 Übersetzer im Browser</b><span data-bstat>prüfe …</span></button>
      ${opt.chromeTab ? `<p class="hinweis" data-ausapp style="background:#fff3cd;padding:8px;border-radius:8px"><b>Aus der App in Chrome geöffnet.</b> Tippe „🌐 Mit Chrome übersetzen", danach in Chrome ⋮ → „Übersetzen" → ${h(UE.SPRACHEN[nach])}. Die ausgefüllte Kopie liegt danach in der Bibliothek.</p>` : ''}
      <button class="wahl" data-weg="chrome"><b>🌐 Mit Chrome übersetzen (Google)</b><span>Kostenlos. Die Einträge erscheinen unten, du tippst in Chrome ⋮ → „Übersetzen" und wählst ${h(UE.NAME_DE[nach])}. Der Text geht dabei an Google.${fenster ? ' Die App läuft gerade im eigenen Fenster — dort gibt es ⋮ → „Übersetzen" nicht. Dann „' + chromeKnopf() + '" (darunter): dieselben Einträge öffnen sich in Chrome.' : ''}</span></button>
      ${fenster ? '<div class="zeile" data-tabreihe style="flex-wrap:wrap;gap:6px;margin:-4px 0 8px"></div>' : ''}
      <button class="wahl" data-weg="ki"><b>🤖 Mit KI — ${h(a.label)}</b><span>${kiBereit() ? `Nur die Einträge (nicht die Seiten) gehen an ${h(a.label)}. Vor dem ersten Senden wird gefragt.` : 'Noch kein Schlüssel eingetragen — tippen, um ihn einzutragen.'}</span></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, async (dl, zu) => {
      dl.querySelector('[data-x]').onclick = zu;
      const v = await UE.browserVerfuegbar(von, nach);
      dl.querySelector('[data-bstat]').textContent = v === 'fehlt' ? 'Dieser Browser hat keinen eingebauten Übersetzer.' : v === 'unavailable' ? `${UE.SPRACHEN[von]} → ${UE.SPRACHEN[nach]} kann er nicht.` : 'Kostenlos, auf dem Gerät.';
      if (v === 'fehlt' || v === 'unavailable') dl.querySelector('[data-weg="browser"]').disabled = true;
      if (dl.querySelector('[data-tabreihe]')) chromeTabKnoepfe(dl.querySelector('[data-tabreihe]'), () => ({ rueck: id }));
      if (opt.chromeTab) { const cb = dl.querySelector('[data-weg="chrome"]'); cb.style.outline = '3px solid #E0231B'; cb.scrollIntoView({ block: 'center' }); }
      dl.querySelectorAll('[data-weg]').forEach(b => b.onclick = async () => {
        let u;
        try { u = await uebersetzerErzeugen(b.dataset.weg, von, nach, false, b, zu, { rueck: id }); }
        catch (e) { toast('⚠️ Übersetzer lässt sich nicht starten: ' + (e.message || e)); b.disabled = false; return; }
        if (!u) return;
        zu();
        await rueckwegLaufen(d, src, von, nach, u.hin, b.dataset.weg);
      });
    });
  }
  async function rueckwegLaufen(d, src, von, nach, uebersetzer, weg) {
    const fb = fortschritt('Einträge ' + von.toUpperCase() + ' → ' + nach.toUpperCase());
    try {
      fb.setze(0.1, 'Einträge werden übersetzt …');
      // Felder, die es im Original gibt, behalten dessen Beschriftung; im übersetzten
      // Dokument neu gesetzte Felder bekommen eine übersetzte.
      const ausQuelle = d.fields.filter(f => f.quellFeld && src.fields.some(q => q.id === f.quellFeld));
      const neuGesetzt = d.fields.filter(f => !ausQuelle.includes(f));
      const [ueA, ueN] = [await felderUebersetzen(ausQuelle, uebersetzer, false), await felderUebersetzen(neuGesetzt, uebersetzer, true)];
      const felder = [];
      for (const q of src.fields) {
        const i = ausQuelle.findIndex(f => f.quellFeld === q.id);
        if (i < 0) { felder.push(Object.assign(JSON.parse(JSON.stringify(q)), { id: uid() })); continue; }
        const f = ueA[i];
        felder.push(Object.assign(JSON.parse(JSON.stringify(q)), { id: uid(), x: f.x, y: f.y, w: f.w, h: f.h, value: f.value, mehrzeilig: f.mehrzeilig || q.mehrzeilig, decken: f.decken || q.decken, geprueft: true }));
      }
      ueN.forEach(f => { delete f.quellFeld; f.geprueft = true; felder.push(f); });
      fb.setze(0.8, 'Kopie des Originals wird angelegt …');
      const bytes = await DB.getFile(src.id);
      const ziel = await ergebnisOrdner(src, 'aus:' + von, 'ausgefüllt (aus ' + von.toUpperCase() + ')');
      const n = JSON.parse(JSON.stringify(src));
      Object.assign(n, { id: uid(), name: src.name + ' [ausgefüllt, aus ' + von.toUpperCase() + ']', folderId: ziel.id, createdAt: jetzt(), updatedAt: jetzt(), fields: felder,
        ausgefuellt: { aus: von, sprache: nach, uebersetzung: d.id, quelle: src.id, weg, am: jetzt() } });
      delete n.uebersetzung;
      await DB.putFile(n.id, bytes); await DB.put('docs', n);
      fb.zu();
      await ladeBibliothek();
      const st = uebersetzer.stat || {};
      window.__wfpdfRueckweg = { id: n.id, felder: felder.length, zeichen: st.zeichen || 0 };
      toast('↩ ' + felder.filter(f => f.type === 'check' ? f.value : String(f.value || '').trim()).length + ' Einträge ins Original übertragen — bitte prüfen. Liegt in „' + ziel.name + '".');
      oeffneDok(n.id);
    } catch (e) { fb.zu(); console.error(e); toast('⚠️ Übertragen fehlgeschlagen: ' + (e.message || e) + ' — nichts wurde verändert.'); }
    finally { try { uebersetzer.zu && uebersetzer.zu(); } catch (_) {} }
  }

  // Ein-Tipp-Messung für Klaus' Tablet: gibt es den Übersetzer, welche Paare, hat das PDF Text?
  async function messen(docs) {
    const z = [];
    z.push('<b>Browser:</b> ' + nm(navigator.userAgent.replace(/^Mozilla\/5\.0 /, '')));
    z.push('<b>Läuft als App (installiert):</b> ' + (matchMedia('(display-mode: standalone)').matches ? 'ja' : 'nein'));
    z.push('<b>Übersetzer im Browser (Translator):</b> ' + (UE.browserDa() ? 'vorhanden' : 'nicht vorhanden'));
    if (UE.browserDa()) {
      const paare = [['de', 'ru'], ['ru', 'de'], ['de', 'en'], ['en', 'de'], ['ru', 'en'], ['en', 'ru']];
      for (const [a, b] of paare) z.push('&nbsp;· ' + a.toUpperCase() + '→' + b.toUpperCase() + ': ' + h(await UE.browserVerfuegbar(a, b)));
    }
    for (const d of docs.slice(0, 5)) {
      try {
        const bytes = await DB.getFile(d.id); const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
        const n = Math.min(3, pdf.numPages); let mitText = 0, abs = 0;
        for (let i = 1; i <= n; i++) { const r = await UE.bloecke(await pdf.getPage(i)); if (r.bloecke.length) mitText++; abs += r.bloecke.length; }
        try { pdf.destroy(); } catch (_) {}
        z.push(`<b>${nm(d.name)}:</b> ${mitText} von ${n} geprüften Seiten mit Textebene (${abs} Absätze)${mitText ? '' : ' — vermutlich gescannt: der Text wird beim Übersetzen per Texterkennung (OCR, auf dem Gerät) gelesen'}`);
      } catch (e) { z.push(`<b>${nm(d.name)}:</b> nicht lesbar (${h(e.message || e)})`); }
    }
    if (performance.memory) z.push('<b>Speicher der Seite:</b> ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB belegt, Grenze ' + (performance.memory.jsHeapSizeLimit / 1048576).toFixed(0) + ' MB');
    return z.join('<br>');
  }

  async function uebersetzeViele(ids, von, nach, hin, zurueck, weg) {
    let abbruch = false; const stopp = () => { abbruch = true; if (hin && hin.halt) hin.halt(); };
    if (hin) hin.beimHalt = () => { abbruch = true; };
    let stand = 0, standText = '';   // Tempo-Limit: sichtbar warten statt stehenzubleiben
    if (hin) hin.meldeWarten = (ms, v, n) => fb.setze(stand, (standText || 'Erste Seite') + ' · Anbieter bremst (Tempo-Limit), warte ' + Math.round(ms / 1000) + ' s — Versuch ' + v + ' von ' + n);   // „⏹ Abbrechen" auf der Chrome-Fläche
    const fb = fortschritt('Übersetzung ' + von.toUpperCase() + ' → ' + nach.toUpperCase(), stopp);
    const bericht = []; const t0 = Date.now();
    let schrift = null;
    try { schrift = await UE.schriftLaden('vendor/'); } catch (e) { fb.zu(); toast('⚠️ ' + (e.message || e)); return; }
    for (let k = 0; k < ids.length && !abbruch; k++) {
      const d = S.docs.find(x => x.id === ids[k]) || await DB.get('docs', ids[k]); if (!d) continue;
      const vor = ids.length > 1 ? `Dokument ${k + 1}/${ids.length} · ` : '';
      const zeile = { name: d.name, seiten: d.pages.length, hinweise: [] };
      try {
        const bytes = await DB.getFile(d.id);
        const jid = jobId(d.id, von, nach);
        const alt = await jobLesen(jid);
        const ohneVor = (hin.stat && hin.stat.ohne) || 0;
        const neuVor = (hin.stat && hin.stat.neustarts) || 0, zerVor = (hin.stat && hin.stat.zerlegt) || 0;
        const r = await UE.lauf({ bytes, uebersetzer: hin, stand: alt, abbruch: () => abbruch, ocr: { basis: 'vendor/', von, bilder: !!EINST.ueBilder },
          speichere: st => DB.put('files', { id: jid, job: st }),
          melde: (i, n, info) => { stand = (k + i / n) / ids.length; standText = info.text ? vor + info.text : `${vor}Seite ${i} von ${n}${info.neu ? ' · ' + (info.ms / info.neu / 1000).toFixed(1) + ' s je Seite' : ''}`; fb.setze(stand, standText); } });
        zeile.ocr = r.ocrSeiten;
        if (r.ocrFehler) zeile.hinweise.push('Texterkennung für gescannte Seiten nicht verfügbar (' + r.ocrFehler + ') — diese Seiten bleiben unübersetzt.');
        zeile.ms = r.ms; zeile.neu = r.neu; zeile.fertig = r.fertig;
        if (r.neu) { EINST.ueMsSeite = Math.round(r.ms / r.neu); einstSpeichern(); }
        const neuN = ((hin.stat && hin.stat.neustarts) || 0) - neuVor, zerN = ((hin.stat && hin.stat.zerlegt) || 0) - zerVor;
        if (neuN || zerN) zeile.hinweise.push(`Der Übersetzer im Browser ist unterwegs ${neuN} Mal neu gestartet worden${zerN ? ' und hat ' + zerN + ' lange Absätze Satz für Satz übersetzt' : ''}${r.fehler ? '' : ' — danach lief es weiter'}.`);
        if (weg === 'chrome' && k === 0 && EINST.ueRueck) zeile.hinweise.push('Eine Gegenprobe gibt es auf dem Chrome-Weg nicht — Chrome übersetzt die Seite immer nur in eine Sprache.');
        if (weg === 'chrome' && hin.stat.ohne > ohneVor) zeile.hinweise.push((hin.stat.ohne - ohneVor) + ' Absatz/Absätze hat Chrome nicht übersetzt — sie stehen im Original da.');
        if (r.fehler && !abbruch) zeile.hinweise.push('Der Übersetzer hat abgebrochen: ' + r.fehler + (/Tempo-Limit/.test(r.fehler) ? ' — dein Konto beim Anbieter erlaubt nur wenige Anfragen je Minute; die App hat über zwei Minuten gewartet. Später fortsetzen, das Limit beim Anbieter erhöhen (Mistral: Admin → Limits) oder „🌐 Mit Chrome übersetzen" nehmen (ohne Limit).' : /429|Kontingent/.test(r.fehler) ? ' — das Kontingent des Anbieters ist für den Moment erschöpft; später erneut starten.' : ''));
        // Teilergebnis: fertige Seiten übersetzt, der Rest im Original — damit das
        // bisher Übersetzte zu SEHEN ist (vorher stand es nur im Speicher).
        const teil = r.abgebrochen || !!r.fehler;
        if (teil && !r.fertig) { zeile.hinweise.push('Noch keine Seite übersetzt — es gibt kein Teilergebnis.'); zeile.ohneErgebnis = true; bericht.push(zeile); break; }
        const altTeile = (await DB.all('docs')).filter(x => x.teil && x.uebersetzung && x.uebersetzung.quelle === d.id && x.uebersetzung.nach === nach && !x.uebersetzung.gegenprobe);
        for (const x of altTeile) { await DB.del('docs', x.id); await DB.del('files', x.id); }
        fb.setze((k + 1) / ids.length, vor + 'PDF wird gebaut …');
        const nameNeu = d.name + ' [' + nach.toUpperCase() + (teil ? ', Teil ' + r.fertig + ' von ' + r.n : '') + ']';
        const out = await UE.pdfBauen(bytes, r.stand.seiten, schrift, { titel: nameNeu, nach });
        const zielO = await ergebnisOrdner(d, nach, nach.toUpperCase());
        const neu = await neuesDok(nameNeu, out.bytes, 'uebersetzung', zielO.id);
        zeile.ordner = zielO.name; zeile.neuId = neu.id;
        neu.uebersetzung = { von, nach, quelle: d.id, weg, am: jetzt() };
        if (teil) {
          neu.teil = { fertig: r.fertig, n: r.n };
          await DB.put('docs', neu);
          zeile.teil = true; zeile.groesse = out.bytes.length; zeile.hinweise.push(...out.hinweise);
          zeile.hinweise.push(`Teilübersetzung: ${r.fertig} von ${r.n} Seiten. „🌐 Übersetzen" mit denselben Sprachen setzt fort und ersetzt dieses Teil-PDF durch das vollständige.`);
          bericht.push(zeile); break;
        }
        // Felder des Originals kommen mit — übersetzt, an derselben Stelle (Formular auf Russisch ausfüllen)
        const mit = (d.fields || []).filter(f => f.geprueft);
        if (mit.length) {
          try { neu.fields = await felderUebersetzen(mit, hin, true); zeile.felder = mit.length; }
          catch (e) { zeile.hinweise.push('Die Felder ließen sich nicht übersetzen (' + (e.message || e) + ') — bitte im übersetzten Dokument neu erkennen.'); }
        }
        await DB.put('docs', neu);
        zeile.groesse = out.bytes.length; zeile.hinweise.push(...out.hinweise);
        if (zurueck) {
          const rid = jobId(d.id, von, nach, true);
          const rs = await UE.rueck(r.stand, zurueck, { stand: await jobLesen(rid), abbruch: () => abbruch,
            speichere: st => DB.put('files', { id: rid, job: st }),
            melde: (i, n) => fb.setze((k + i / n) / ids.length, `${vor}Gegenprobe ${nach.toUpperCase()} → ${von.toUpperCase()} · Seite ${i} von ${n}`) });
          if (rs.seiten.some(s => s && !s.u)) { zeile.hinweise.push('Gegenprobe angehalten — ein neuer Lauf setzt sie fort.'); bericht.push(zeile); break; }
          const ro = await UE.pdfBauen(bytes, rs.seiten, schrift, { titel: d.name + ' [' + nach.toUpperCase() + '→' + von.toUpperCase() + ' Gegenprobe]', nach: von });
          const gpO = await ergebnisOrdner(d, 'gp:' + nach + '-' + von, 'Gegenprobe ' + nach.toUpperCase() + '→' + von.toUpperCase());
          const gp = await neuesDok(d.name + ' [' + nach.toUpperCase() + '→' + von.toUpperCase() + ' Gegenprobe]', ro.bytes, 'uebersetzung', gpO.id);
          gp.uebersetzung = { von: nach, nach: von, quelle: d.id, weg, gegenprobe: true, am: jetzt() }; await DB.put('docs', gp);
          await DB.del('files', rid);
        }
        await DB.del('files', jid);
      } catch (e) { console.error(e); zeile.hinweise.push('Fehler: ' + (e.message || e) + ' — bisher Übersetztes ist gespeichert, ein neuer Lauf setzt fort.'); }
      bericht.push(zeile);
    }
    fb.zu();
    try { if (hin && hin.zu) hin.zu(); if (zurueck && zurueck.zu) zurueck.zu(); } catch (_) {}
    await ladeBibliothek();
    const st = [hin && hin.stat, zurueck && zurueck.stat].filter(Boolean);
    const zeichen = st.reduce((n, s) => n + s.zeichen, 0), tokE = st.reduce((n, s) => n + (s.tokenEin || 0), 0), tokA = st.reduce((n, s) => n + (s.tokenAus || 0), 0);
    const neuS = bericht.reduce((n, z) => n + (z.neu || 0), 0);
    window.__wfpdfBericht = { bericht, zeichen, tokE, tokA, ms: Date.now() - t0, speicherMB: performance.memory ? performance.memory.usedJSHeapSize / 1048576 : null };
    dialog(`<h2>🌐 Übersetzung ${abbruch ? 'angehalten' : bericht.some(z => z.teil) ? 'unvollständig — Teilergebnis liegt bereit' : bericht.some(z => z.ohneErgebnis) ? 'abgebrochen — noch nichts übersetzt' : 'fertig'}</h2>
      <ul>${bericht.map(z => `<li><b>${nm(z.name)}</b> · ${z.fertig != null ? z.fertig + ' von ' + z.seiten + ' Seiten' : ''}${z.neu ? ' · ' + (z.ms / z.neu / 1000).toFixed(1) + ' s je neu übersetzter Seite' : ''}${z.groesse ? ' · Ergebnis ' + (z.groesse >= 1048576 ? (z.groesse / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(z.groesse / 1024)) + ' KB') : ''}${z.ordner ? ' · liegt in „' + nm(z.ordner) + '"' : ''}${z.felder ? ' · ' + z.felder + ' Felder übersetzt mitgenommen' : ''}${z.neuId ? ` <button class="knopf klein" data-oeffne="${h(z.neuId)}">${z.teil ? '👁 Teilübersetzung öffnen' : '✏️ Öffnen: Felder setzen / ausfüllen'}</button>` : ''}${z.hinweise.length ? '<ul>' + z.hinweise.map(x => '<li class="hinweis">' + h(x) + '</li>').join('') + '</ul>' : ''}</li>`).join('')}</ul>
      ${S.ausApp && !abbruch && !matchMedia('(display-mode: standalone)').matches ? '<p class="hinweis" data-zurueckapp><b>Zurück in die App:</b> die Übersetzung liegt hier in der Bibliothek. In der App oben <b>⟳ (Aktualisieren)</b> tippen — dann liest sie denselben Speicher neu und zeigt sie. Diesen Chrome-Tab kannst du danach schließen. Fehlt sie dort, „⬇ PDF" hier im Tab ausgeben.</p>' : ''}
      <p class="hinweis">Gemessen: ${neuS} Seiten in ${((Date.now() - t0) / 1000).toFixed(0)} s · ${zeichen.toLocaleString('de-DE')} Zeichen übersetzt${tokE || tokA ? ` · ${tokE.toLocaleString('de-DE')} Token hin, ${tokA.toLocaleString('de-DE')} Token zurück (${h(hin.stat.modell || '')}) — den Preis je Token nennt der Anbieter` : ''}${performance.memory ? ' · Speicher ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : ''}.</p>
      <div class="zeile"><button class="knopf rot" data-x>OK</button></div>`, (dl, zu) => { dl.querySelector('[data-x]').onclick = zu; dl.querySelectorAll('[data-oeffne]').forEach(b => b.onclick = () => { zu(); oeffneDok(b.dataset.oeffne); }); });
    if (!abbruch) hops();
  }

  /* ---------- Einstellungen, Hilfe ---------- */
  /* ---------- Sprache der App (Klaus 2026-09-26) ----------
     Übersetzt wird offline in assets/sprache.js. Hier nur die Wahl. */
  function spracheWaehlen() {
    const SP = WFP.Sprache;
    dialog(`<h2>🗣 Sprache der App</h2>
      <p class="hinweis">Knöpfe, Hinweise und Erklärungen erscheinen in der gewählten Sprache — ohne Internet. Deine Dokumente, Ordner und Feldnamen bleiben, wie sie sind.</p>
      <div class="sprach-liste">${SP.SPRACHEN.map(x => `<button class="wahl${x.code === SP.lang ? ' on' : ''}" data-sp="${x.code}" lang="${x.code}"${x.rtl ? ' dir="rtl"' : ''}><b data-kein-ue>${h(x.name)}</b></button>`).join('')}</div>
      <label class="haken"><input type="checkbox" data-tipps${SP.tipps ? ' checked' : ''}> Hinweise beim Zeigen auf Knöpfe (Tooltips) anzeigen</label>
      <div class="zeile"><button class="knopf rot" data-x>Fertig</button></div>`, (d, zu) => {
      d.querySelectorAll('[data-sp]').forEach(b => b.onclick = () => {
        SP.setzen(b.dataset.sp);
        d.querySelectorAll('[data-sp]').forEach(x => x.classList.toggle('on', x === b));
      });
      d.querySelector('[data-tipps]').onchange = e => SP.tippsSetzen(e.target.checked);
      d.querySelector('[data-x]').onclick = zu;
    });
  }
  /* Spracheingabe fürs Suchfeld (Klaus 2026-09-26, Laufbalken 2026-09-27).
     Der Baustein steht in assets/sprechen.js (byte-1:1 auch in den WorkFlohs): Laufbalken mit
     Strichen, solange Sprache ankommt, Pünktchen in den Pausen, und der Text steht schon beim
     Sprechen im Feld. Gesucht wird, sobald die Aufnahme zu Ende ist — die Suche nach Bedeutung
     rechnet, und sie soll nicht bei jedem halben Wort neu anfangen.
     Die Erkennung schickt die Aufnahme an den Browser-Hersteller (Chrome: Google) — das steht am Knopf. */
  const MIC_LANG = { de: 'de-DE', en: 'en-US', ru: 'ru-RU', ar: 'ar-SA' };
  function spracheingabe() {
    const k = $('bibMic'), feld = $('bibSuche'); if (!k || !feld || !window.WFSprechen) return;
    let erstes = true;
    WFSprechen.anhaengen({ knopf: k, nach: $('bibForm'), feld,
      sprache: () => { if (erstes) { toast('🎤 Ich höre zu … (die Aufnahme geht zur Erkennung an Google)'); erstes = false; } return MIC_LANG[(WFP.Sprache && WFP.Sprache.lang) || 'de'] || 'de-DE'; },
      text: (t, fertig) => { feld.value = t; if (fertig) { S.suche = t; zeichneBibliothek(); } },
      meldung: toast });
  }
  function spracheKnopf() { const b = $('btnSprache'); if (b && WFP.Sprache) b.querySelector('span').textContent = WFP.Sprache.SPRACHEN.find(x => x.code === WFP.Sprache.lang).kurz; }
  document.addEventListener('wfp-sprache', () => {
    spracheKnopf();
    // Die Felder auf der Seite sind geschützt und wurden beim Bauen übersetzt — neu bauen.
    if (S.doc && $('sc-ed').classList.contains('on')) { try { for (let i = 0; i < S.doc.pages.length; i++) zeichneFelder(i); zeichneFuss(); } catch (_) {} }
  });

  /* 🔐 BIBLIOTHEK SICHERN UND ZURÜCKHOLEN (Klaus 2026-10-02: „Workflow soll dasselbe bekommen.
     Dieselbe Sicherung." · „Tief im Browser-Speicher, ohne dass gelöscht wird").
     Zwei Dinge, und beide stehen in EINEM Dialog:
     1 · die Sicherungsdatei — alle Ordner, Dokumente und PDFs, verschlüsselt mit einem eigenen
         Passwort (assets/sicherung.js + das Schloss assets/schluesseltresor.js, byte-1:1 aus
         kim-hub-company). Das Passwort wird nirgends gespeichert. Zurückholen fügt hinzu,
         überschreibt nie.
     2 · der dauerhafte Speicher — navigator.storage.persist(). Die Zusage gibt der BROWSER, nicht
         die App; ob er sie gegeben hat, steht da, statt still angenommen zu werden.
     Die Erinnerung über der Liste erscheint, wenn eigene Dokumente da sind (die Beispiele zählen
     nicht) und die letzte Sicherung fehlt oder älter als 14 Tage ist. „Später" gilt für diesen Besuch. */
  const SICH_ZULETZT = 'wfpdf_sicherung_zuletzt', SICH_SPAETER = 'wfpdf_sicherung_spaeter';
  const lsLies = (k, ss) => { try { return (ss ? sessionStorage : localStorage).getItem(k); } catch (_) { return null; } };
  const lsSetz = (k, v, ss) => { try { (ss ? sessionStorage : localStorage).setItem(k, v); } catch (_) {} };
  const BEISPIEL_NAMEN = ['Workfloh-PDF-Benutzerhandbuch', 'Beispiel-Amtsformular-Bewohnerparkausweis'];
  const eigeneDocs = () => S.docs.filter(d => !BEISPIEL_NAMEN.includes(d.name));
  const DAUER_TEXT = {
    ja: '✅ Der Browser hat dauerhafte Speicherung zugesagt: er löscht diese Daten nicht von selbst, wenn Platz knapp wird. Löschen kann sie weiter, wer die Browserdaten löscht — dagegen hilft nur die Sicherungsdatei.',
    nein: '⚠️ Dauerhafte Speicherung ist NICHT zugesagt: der Browser darf diese Daten bei Platzmangel löschen. Tippe auf „Dauerhaft speichern lassen" — manche Browser sagen erst zu, wenn die App installiert ist oder öfter benutzt wurde.',
    unbekannt: 'Dieser Browser gibt keine Auskunft, ob er dauerhaft speichert. Die Sicherungsdatei ist der sichere Weg.'
  };
  async function dauerStand() { try { if (!navigator.storage || !navigator.storage.persisted) return 'unbekannt'; return (await navigator.storage.persisted()) ? 'ja' : 'nein'; } catch (_) { return 'unbekannt'; } }
  async function dauerBitten() { try { if (!navigator.storage || !navigator.storage.persist) return 'unbekannt'; return (await navigator.storage.persist()) ? 'ja' : 'nein'; } catch (_) { return 'unbekannt'; } }
  const SICH_FEHLER = {
    'passwort': 'Das Passwort passt nicht zu dieser Sicherung.',
    'fassung': 'Diese Sicherung stammt aus einer anderen Fassung der App und lässt sich hier nicht öffnen.',
    'keine-sicherung': 'Diese Datei ist keine Sicherung von Workfloh PDF.',
    'schloss-fehlt': 'Das Schloss (Verschlüsselung) ist nicht geladen — die Seite einmal neu laden.'
  };
  function sicherungErinnerung() {
    const el = $('sicherungErinnerung'); if (!el) return;
    const SI = WFP.Sicherung;
    const n = eigeneDocs().length, zuletzt = lsLies(SICH_ZULETZT);
    if (!SI || !SI.erinnernNoetig(n, zuletzt, lsLies(SICH_SPAETER, true) === '1')) { el.hidden = true; el.innerHTML = ''; return; }
    const tage = SI.tageSeit(zuletzt);
    el.innerHTML = `<span>🔐 ${isFinite(tage) ? 'Die letzte Sicherung ist ' + Math.floor(tage) + ' Tage alt.' : 'Für deine Dokumente gibt es noch keine Sicherung.'} Löscht jemand die Browserdaten, sind sie sonst weg.</span>`
      + '<button class="knopf klein rot" data-sich-jetzt>Jetzt sichern</button><button class="knopf klein" data-sich-spaeter>Später</button>';
    el.hidden = false;
    el.querySelector('[data-sich-jetzt]').onclick = sicherungDialog;
    el.querySelector('[data-sich-spaeter]').onclick = () => { lsSetz(SICH_SPAETER, '1', true); sicherungErinnerung(); };
  }
  function sicherungDialog() {
    const SI = WFP.Sicherung;
    const zuletzt = lsLies(SICH_ZULETZT);
    dialog(`<h2>🔐 Bibliothek sichern</h2>
      <p class="hinweis">Alle Ordner, Dokumente (mit Feldern und Einträgen) und PDF-Dateien in <b>eine Datei</b>, verschlüsselt mit einem eigenen Passwort. In der Datei steht kein lesbarer Text. Nicht mit dabei: KI-Schlüssel und Einstellungen.</p>
      <p class="hinweis" data-sich-zuletzt>${zuletzt ? 'Letzte Sicherung: ' + h(new Date(zuletzt).toLocaleDateString('de-DE')) + '.' : 'Noch keine Sicherung erstellt.'}</p>
      <h3 style="margin:12px 0 0;font-size:1rem">Sicherung erstellen</h3>
      <label>Passwort (mindestens ${SI ? SI.MIN_PW : 8} Zeichen)</label><input type="password" id="siPw1" autocomplete="new-password">
      <label>Passwort noch einmal</label><input type="password" id="siPw2" autocomplete="new-password">
      <p class="hinweis">⚠️ Das Passwort wird nirgends gespeichert. Wer es vergisst, bekommt die Sicherung nicht mehr auf.</p>
      <div class="zeile" style="justify-content:flex-start"><button class="knopf rot" id="siErstellen">⬇ Sicherung erstellen</button></div>
      <p class="hinweis" id="siErg" data-sich-ergebnis></p>
      <h3 style="margin:12px 0 0;font-size:1rem">Sicherung zurückholen</h3>
      <p class="hinweis">Fügt hinzu, was fehlt. Vorhandene Dokumente bleiben, wie sie sind.</p>
      <label>Sicherungsdatei</label><input type="file" id="siDatei" accept=".json,application/json">
      <label>Passwort der Sicherung</label><input type="password" id="siPwZ" autocomplete="off">
      <div class="zeile" style="justify-content:flex-start"><button class="knopf" id="siZurueck">⬆ Zurückholen</button></div>
      <p class="hinweis" id="siZErg" data-sich-zurueck></p>
      <h3 style="margin:12px 0 0;font-size:1rem">Speicher des Browsers</h3>
      <p class="hinweis" id="siDauer" data-dauer="?">…</p>
      <div class="zeile" style="justify-content:flex-start"><button class="knopf" id="siDauerKnopf">📌 Dauerhaft speichern lassen</button></div>
      <div class="zeile"><button class="knopf" data-x>Schließen</button></div>`, (d, zu) => {
      const q = s => d.querySelector(s);
      const dauerZeigen = st => { const p = q('#siDauer'); p.dataset.dauer = st; p.textContent = DAUER_TEXT[st]; };
      dauerStand().then(dauerZeigen);
      q('#siDauerKnopf').onclick = async () => dauerZeigen(await dauerBitten());
      q('[data-x]').onclick = zu;
      q('#siErstellen').onclick = async () => {
        const e = q('#siErg'), p1 = q('#siPw1').value, p2 = q('#siPw2').value;
        if (!SI) { e.textContent = SICH_FEHLER['schloss-fehlt']; return; }
        if (p1.length < SI.MIN_PW) { e.textContent = 'Das Passwort braucht mindestens ' + SI.MIN_PW + ' Zeichen.'; return; }
        if (p1 !== p2) { e.textContent = 'Die beiden Passwörter sind nicht gleich.'; return; }
        e.textContent = 'Verschlüssele … (das dauert einige Sekunden)';
        try {
          const r = await SI.verschliessen(p1, DB);
          const tag = new Date().toISOString().slice(0, 10);
          laden('Workfloh-PDF-Sicherung-' + tag + '.json', new TextEncoder().encode(JSON.stringify(r.datei)), 'application/json');
          lsSetz(SICH_ZULETZT, r.datei.erstellt);
          q('#siPw1').value = q('#siPw2').value = '';
          e.textContent = `✅ Gesichert: ${r.docs} Dokument(e) in ${r.ordner} Ordner(n).` + (r.ohneDatei ? ` ${r.ohneDatei} Dokument(e) hatten keine Datei und fehlen darin.` : '') + ' Die Datei liegt im Download-Ordner — am besten zusätzlich woanders ablegen.';
          q('[data-sich-zuletzt]').textContent = 'Letzte Sicherung: ' + new Date(r.datei.erstellt).toLocaleDateString('de-DE') + '.';
          dauerZeigen(await dauerBitten());
          sicherungErinnerung();
        } catch (err) { e.textContent = '⚠️ ' + (SICH_FEHLER[err && err.message] || 'Die Sicherung ließ sich nicht erstellen: ' + (err && err.message || err)); }
      };
      q('#siZurueck').onclick = async () => {
        const e = q('#siZErg'), f = q('#siDatei').files[0], pw = q('#siPwZ').value;
        if (!SI) { e.textContent = SICH_FEHLER['schloss-fehlt']; return; }
        if (!f) { e.textContent = 'Bitte zuerst die Sicherungsdatei wählen.'; return; }
        if (!pw) { e.textContent = 'Bitte das Passwort der Sicherung eingeben.'; return; }
        e.textContent = 'Entschlüssele …';
        let datei; try { datei = JSON.parse(await f.text()); } catch (_) { e.textContent = '⚠️ ' + SICH_FEHLER['keine-sicherung']; return; }
        try {
          const inhalt = await SI.oeffnen(pw, datei);
          const r = await SI.zusammenfuehren(DB, inhalt);
          for (const x of r.neu) if (EINGANG_QUELLEN.includes(x.doc.quelle)) eingangPruefen(x.doc.id, x.doc.name + '.pdf', x.bytes);
          q('#siPwZ').value = '';
          e.textContent = `✅ ${r.dazu} Dokument(e) dazu, ${r.schonDa} schon da` + (r.ordnerDazu ? `, ${r.ordnerDazu} Ordner dazu` : '') + '.' + (r.ohneDatei ? ` ${r.ohneDatei} Dokument(e) ohne Datei wurden übersprungen.` : '');
          await ladeBibliothek();
        } catch (err) { e.textContent = '⚠️ ' + (SICH_FEHLER[err && err.message] || 'Zurückholen ging nicht: ' + (err && err.message || err)); }
      };
    });
  }

  function einstellungen() {
    const opt = Object.entries(ER.ANBIETER).map(([k, a]) => `<option value="${k}"${k === EINST.anbieter ? ' selected' : ''}>${h(a.label)}</option>`).join('');
    dialog(`<h2>⚙️ Einstellungen</h2>
      <h3 style="margin:10px 0 0;font-size:1rem">KI-Felderkennung (freiwillig)</h3>
      <p class="hinweis">Ohne KI funktionieren Import, Linien-Erkennung, Felder setzen und Export vollständig offline. Mit eigenem Schlüssel (BYOK) erkennt die KI auch Beschriftungen und Text. Standard ist Mistral mit Verarbeitung in der EU.</p>
      <label>Anbieter</label><select id="stAnb">${opt}</select>
      <label>Schlüssel <a id="stKonsole" target="_blank" rel="noopener" style="font-weight:400">— Schlüssel beim Anbieter holen ↗</a></label><input type="password" id="stKey" autocomplete="off" placeholder="nur in diesem Browser gespeichert">
      <label>Modell für die Felderkennung (leer = Vorgabe)</label><input type="text" id="stMod" placeholder="" data-kein-ue>
      <label>Modell für die Übersetzung (leer = Vorgabe)</label><input type="text" id="stUebMod" placeholder="" data-kein-ue>
      <div class="zeile" style="justify-content:flex-start"><button class="knopf" id="stTest">🔌 Verbindung testen</button><span class="hinweis" id="stTestErg"></span></div>
      <p class="hinweis">Der Schlüssel liegt unverschlüsselt im Speicher dieses Browsers (localStorage) und wird nur an den gewählten Anbieter geschickt.</p>
      <h3 style="margin:14px 0 0;font-size:1rem">Sprache der App</h3>
      <div class="zeile" style="justify-content:flex-start"><button class="knopf" id="stSprache">🗣 Sprache und Hinweise …</button></div>
      <h3 style="margin:14px 0 0;font-size:1rem">Erkennung</h3>
      <label style="font-weight:400"><input type="checkbox" id="stLin"${EINST.linien !== false ? ' checked' : ''}> Linien, Rahmen und Kästchen im Seitenbild suchen (offline)</label>
      <h3 style="margin:14px 0 0;font-size:1rem">Speicher</h3>
      <p class="hinweis" id="stSpeicher">…</p>
      <div class="zeile" style="justify-content:flex-start"><button class="knopf" id="stSicherung">🔐 Bibliothek sichern und zurückholen …</button></div>
      <p class="hinweis"><a href="impressum.html" target="_blank" rel="noopener">Impressum &amp; Datenschutz</a></p>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button><button class="knopf rot" data-ok>Speichern</button></div>`, (d, zu) => {
      const anb = d.querySelector('#stAnb'), key = d.querySelector('#stKey'), mod = d.querySelector('#stMod'), kon = d.querySelector('#stKonsole');
      const tmp = { schluessel: Object.assign({}, EINST.schluessel), modell: Object.assign({}, EINST.modell), uebModell: Object.assign({}, EINST.uebModell) };
      const umod = d.querySelector('#stUebMod');
      let akt = anb.value;
      const zeige = () => { const a = ER.ANBIETER[anb.value]; key.value = tmp.schluessel[anb.value] || ''; mod.value = tmp.modell[anb.value] || ''; mod.placeholder = a.modell; umod.value = tmp.uebModell[anb.value] || ''; umod.placeholder = UE.KI_TEXTMODELL[anb.value] || a.modell; kon.href = a.konsole; akt = anb.value; };
      const merke = () => { tmp.schluessel[akt] = key.value.trim(); tmp.modell[akt] = mod.value.trim(); tmp.uebModell[akt] = umod.value.trim(); };
      anb.onchange = () => { merke(); zeige(); d.querySelector('#stTestErg').textContent = ''; };
      zeige();
      d.querySelector('#stSprache').onclick = spracheWaehlen;
      d.querySelector('#stSicherung').onclick = () => { zu(); sicherungDialog(); };
      d.querySelector('#stTest').onclick = async () => {
        merke(); const e = d.querySelector('#stTestErg'); e.textContent = 'prüfe …';
        try { const m = await ER.kiTest({ anbieter: anb.value, schluessel: tmp.schluessel[anb.value], modell: tmp.modell[anb.value] }); e.textContent = '✅ Verbindung steht (' + m + ')'; }
        catch (err) { e.textContent = '⚠️ ' + (err.message || err); }
      };
      if (navigator.storage && navigator.storage.estimate) navigator.storage.estimate().then(async est => {
        const pers = navigator.storage.persisted ? await navigator.storage.persisted() : false;
        d.querySelector('#stSpeicher').textContent = `Belegt: ${(est.usage / 1048576).toFixed(1)} MB. ${pers ? 'Der Browser hat dauerhafte Speicherung zugesagt.' : 'Dauerhafte Speicherung ist nicht zugesagt — der Browser darf bei Platzmangel löschen. Wichtige Ergebnisse als PDF sichern.'}`;
      }); else d.querySelector('#stSpeicher').textContent = 'Keine Angabe vom Browser.';
      d.querySelector('[data-x]').onclick = zu;
      d.querySelector('[data-ok]').onclick = () => { merke(); EINST.anbieter = anb.value; EINST.schluessel = tmp.schluessel; EINST.modell = tmp.modell; EINST.uebModell = tmp.uebModell; EINST.linien = d.querySelector('#stLin').checked; einstSpeichern(); zu(); toast('⚙️ gespeichert'); };
    });
  }
  function installHinweis(fertig) {
    dialog(`<h2>📲 ${fertig ? 'Workfloh PDF ist installiert' : 'Als App installieren'}</h2>
      ${fertig ? '' : `<p>Chrome bietet die Installation gerade nicht von selbst an. So geht es von Hand:</p>
      <ol><li>Chrome-Menü <b>⋮</b> oben rechts öffnen</li><li><b>„App installieren"</b> oder <b>„Zum Startbildschirm hinzufügen"</b> wählen</li><li>Bestätigen</li></ol>
      <p class="hinweis">Steht dort <b>„Workfloh PDF öffnen"</b>, ist die App schon installiert.</p>`}
      <p><b>Wo die App liegt:</b> in der <b>App-Liste</b> des Tablets (vom Startbildschirm nach oben wischen, „Workfloh PDF" suchen). Aufs Startbild kommt sie nur, wenn der Samsung-Startbildschirm das zulässt: Einstellungen → Startbildschirm → <b>„Neue Apps zum Startbildschirm hinzufügen"</b>. Sonst in der App-Liste lange drücken und aufs Startbild ziehen.</p>
      <p class="hinweis">DeX und Tablet-Modus haben getrennte Chrome-Installationen: eine in DeX installierte App erscheint im DeX-App-Menü, nicht zwingend im Tablet-Modus.</p>
      <div class="zeile"><button class="knopf rot" data-x>OK</button></div>`, (d, zu) => d.querySelector('[data-x]').onclick = zu);
  }
  /* 🎬 Erklärvideo (Klaus 2026-09-28): liegt auf der Webseite (Workfloh-PDF-Page, gleiche Adresse),
     wird erst auf Tipp geladen und steht NICHT im Offline-Vorrat (sw.js lässt .mp4 durch).
     Offline sagt der Dialog das, statt ein leeres Video zu zeigen. Arabisch gibt es nicht → Englisch. */
  const WEBSEITE = 'https://lausiklauskn-png.github.io/Workfloh-PDF-Page/';
  /* Hochkant (Klaus 2026-09-28: „wenn es hochkant geht, dann da weitermachen, wo das Querformat aufgehört hat,
     ohne Verzögerung"): hochkant läuft dasselbe GANZE Video hochkant (workfloh-pdf-hochvoll*.mp4). Jede Szene
     ist dort auf die Länge des Querformats gebracht — gleiche Sekunden, gleiche Musik. Nach dem Start lädt die
     andere Lage verborgen und stumm mit; gedreht wird nur umgeschaltet (Zeit übernehmen, zeigen, weiter).
     Nicht im Vollbild (dort dreht der Browser selbst). */
  const LAGE_HOCH = window.matchMedia ? matchMedia('(orientation: portrait)') : null;
  const istHoch = () => !!(LAGE_HOCH && LAGE_HOCH.matches);
  /* Zwei Teile (Klaus 2026-10-06): das Erklärvideo und, angehängt, der kurze Film „Versteckte Befehle erkennen"
     (assets/neu-befehle-quer|hoch[-en|-ru].mp4 auf der Webseite, 26 s). Er läuft von selbst, wenn das
     Erklärvideo zu Ende ist, und hat einen eigenen Knopf. Das Erklärvideo selbst ist unverändert. */
  /* Kapitel des kurzen Films (Klaus 2026-10-06: „zu welcher Szene man springen kann … anhalten, um sie zu studieren").
     Gleiche Sekunden wie window.KAPITEL in Workfloh-PDF-Page/video/neu-befehle.html (dort auch assets/kapitel-neu-befehle.json). */
  const KAPITEL_NEU = [[4.5, 'Der Täter'], [16, 'Die KI gehorcht'], [22, 'Trick 1'], [30, 'Trick 2'], [38.3, 'Trick 3'], [47.8, 'Der Schutz'], [56.1, 'Überblick']];
  function videoFuer(lang, hoch, teil) {
    const sp = ['de', 'en', 'ru'].includes(lang) ? lang : 'en', zus = sp === 'de' ? '' : '-' + sp;
    if (teil === 'neu') return { sp, hoch: !!hoch, teil, ersatz: sp !== lang, src: WEBSEITE + 'assets/neu-befehle-' + (hoch ? 'hoch' : 'quer') + zus + '.mp4',
      poster: WEBSEITE + 'assets/poster-neu-befehle-' + (hoch ? 'hoch' : 'quer') + '-' + sp + '.jpg' };
    const art = hoch ? 'hochvoll' : 'quer';
    return { sp, hoch: !!hoch, teil: 'haupt', ersatz: sp !== lang, src: WEBSEITE + 'assets/workfloh-pdf-' + art + zus + '.mp4',
      poster: WEBSEITE + 'assets/poster-' + (hoch ? 'hochvoll-' : '') + sp + '.jpg' };
  }
  function erklaervideo() {
    const lang = (window.WFP && WFP.Sprache && WFP.Sprache.lang) || 'de';
    const v = videoFuer(lang, istHoch());
    const offline = navigator.onLine === false;
    const zu0 = dialog(`<h2>🎬 Erklärvideo</h2>
      ${v.ersatz ? '<p class="hinweis" data-ersatz>Das Video gibt es auf Deutsch, Englisch und Russisch — hier läuft die englische Fassung.</p>' : ''}
      <p class="hinweis" data-offline ${offline ? '' : 'hidden'}>Ohne Internet lässt sich das Video nicht laden. Es liegt auf der Webseite und wird nicht auf dem Gerät gespeichert.</p>
      ${offline ? '' : `<div class="zeile" data-teile><button class="knopf" data-teil="haupt" aria-pressed="true">▶ Erklärvideo</button><button class="knopf" data-teil="neu" aria-pressed="false">▶ Neu: Versteckte Befehle</button></div>
      <div class="zeile" data-kapitel hidden style="justify-content:flex-start;margin-top:4px">${KAPITEL_NEU.map(([s, n]) => `<button class="knopf" data-ab="${s}"><b>${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}</b> ${n}</button>`).join('')}</div>
      <div data-buehne><video data-erklaer controls playsinline preload="metadata" poster="${v.poster}" src="${v.src}"></video></div>`}
      <div class="pruef-neu" data-neu><b>Neu, als kurzer Film nach dem Erklärvideo: versteckte Befehle erkennen.</b> Im Hintergrund prüft Workflow PDF jede eingelesene Datei — mit den Prüfungen aus dem Auslieferungsprüfer und dem Sende-Prüfer, auf diesem Gerät und ohne Internet. Unsichtbarer Text im PDF, blasse Schrift im Foto, Anweisungen an eine KI und Text in den Bildpunkten werden rot markiert, nicht gelöscht. Zum Ausprobieren: Hilfe (?) → „🛡 Versteckte Befehle erkennen".</div>
      <p class="hinweis"><a href="${WEBSEITE}" target="_blank" rel="noopener">Alle Kapitel und das Video hochkant auf der Webseite</a></p>
      <div class="zeile"><button class="knopf rot" data-x>Schließen</button></div>`, (d, zu) => {
      let vid = d.querySelector('video'), zweit = null, teil = 'haupt';
      const masse = (el, hoch) => { el.style.cssText = 'border-radius:10px;background:#000;margin:0 auto;' + (el.hidden ? 'display:none;' : 'display:block;') + (hoch ? 'width:auto;max-width:100%;height:min(62vh,640px);aspect-ratio:9/16' : 'width:100%'); };
      if (vid) masse(vid, v.hoch);
      const vorbereiten = () => {   // die andere Lage lädt still mit
        if (zweit || !vid || !vid.isConnected) return;
        const n = videoFuer(lang, !istHoch(), teil);
        zweit = document.createElement('video');
        zweit.playsInline = true; zweit.controls = true; zweit.preload = 'auto'; zweit.muted = true; zweit.hidden = true; zweit.src = n.src;
        zweit.setAttribute('data-erklaer', ''); masse(zweit, n.hoch);
        vid.after(zweit);
      };
      // auf dem Dialog statt am Element: vid und zweit tauschen beim Drehen, und ein Teilwechsel legt zweit neu an
      d.addEventListener('playing', e => { if (e.target === vid) vorbereiten(); }, true);
      const teilWechseln = (neuTeil, starten) => {
        if (!vid || !vid.isConnected) return;
        teil = neuTeil;
        d.querySelectorAll('[data-teil]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.teil === teil)));
        const kap = d.querySelector('[data-kapitel]'); if (kap) kap.hidden = teil !== 'neu';
        if (zweit) { zweit.pause(); zweit.removeAttribute('src'); zweit.load(); zweit.remove(); zweit = null; }
        const n = videoFuer(lang, istHoch(), teil);
        masse(vid, n.hoch); vid.poster = n.poster; vid.src = n.src;
        if (starten) vid.play().catch(() => {});
      };
      d.querySelectorAll('[data-teil]').forEach(b => b.onclick = () => { if (b.dataset.teil !== teil) teilWechseln(b.dataset.teil, true); });
      // Kapitel: an die Stelle springen und abspielen (anhalten geht mit dem Video selbst)
      d.querySelectorAll('[data-ab]').forEach(b => b.onclick = () => {
        if (!vid || !vid.isConnected) return;
        if (teil !== 'neu') teilWechseln('neu', false);
        const ab = +b.dataset.ab, los = () => { vid.currentTime = ab; vid.play().catch(() => {}); };
        if (vid.readyState >= 1) los(); else vid.addEventListener('loadedmetadata', los, { once: true });
      });
      // Angeheftet: ist das Erklärvideo zu Ende, läuft der kurze Film von selbst weiter (nicht im Vollbild — dort schaltet der Nutzer)
      d.addEventListener('ended', e => { if (e.target === vid && teil === 'haupt' && !(document.fullscreenElement || document.webkitFullscreenElement)) teilWechseln('neu', true); }, true);
      const drehen = () => {
        if (!vid || !vid.isConnected) { ende(); return; }   // mit Esc oder Tipp daneben geschlossen
        if (document.fullscreenElement || document.webkitFullscreenElement) return;
        const n = videoFuer(lang, istHoch(), teil);
        if (vid.getAttribute('src') === n.src) { masse(vid, n.hoch); return; }
        const t = vid.currentTime, lief = !vid.paused;
        if (zweit && zweit.getAttribute('src') === n.src) {
          const alt = vid, neu = zweit;
          neu.muted = alt.muted; neu.volume = alt.volume;
          const zeigen = () => {
            neu.hidden = false; masse(neu, n.hoch); alt.pause(); alt.muted = true; alt.hidden = true; masse(alt, !n.hoch);
            vid = neu; zweit = alt;
            if (lief) vid.play().catch(() => {});
          };
          const setzen = () => { if (Math.abs(neu.currentTime - t) < 0.05) zeigen(); else { neu.addEventListener('seeked', zeigen, { once: true }); neu.currentTime = t; } };
          if (neu.readyState >= 1) setzen(); else neu.addEventListener('loadedmetadata', setzen, { once: true });
          return;
        }
        masse(vid, n.hoch); vid.poster = n.poster; vid.src = n.src;   // noch nichts vorgeladen: Quelle tauschen, Stelle übernehmen
        vid.addEventListener('loadedmetadata', () => { vid.currentTime = t; if (lief) vid.play().catch(() => {}); }, { once: true });
      };
      if (LAGE_HOCH) LAGE_HOCH.addEventListener('change', drehen);
      document.addEventListener('fullscreenchange', drehen);
      const ende = () => { if (LAGE_HOCH) LAGE_HOCH.removeEventListener('change', drehen); document.removeEventListener('fullscreenchange', drehen); };
      d.querySelector('[data-x]').onclick = () => { ende(); d.querySelectorAll('video').forEach(e => { e.pause(); e.removeAttribute('src'); e.load(); }); zu(); };
      if (vid) vid.addEventListener('error', () => { d.querySelector('[data-offline]').hidden = false; d.querySelectorAll('video').forEach(e => e.remove()); ende(); });
    });
    return zu0;
  }
  function hilfe() {
    dialog(`<h2>So geht's</h2><ol>
      <li><b>Einlesen:</b> PDF oder Bild wählen, 📷 Scannen oder einen ganzen Ordner einlesen. Dateien lassen sich auch auf die Seite ziehen. Bei Fotos wird das Blatt gesucht und auf A4 gerade gezogen — ausgedruckt („Tatsächliche Größe / 100 %") so groß wie das Papier.</li>
      <li><b>Felder erkennen:</b> 🤖 findet Linien, Rahmen, graue Eingabeflächen und Kästchen — offline oder mit KI. Das sind Vorschläge (orange gestrichelt).</li>
      <li><b>Prüfen und korrigieren:</b> unter „✏️ Felder bearbeiten" Felder verschieben, am roten Punkt vergrößern, Bezeichnung und Art ändern. „✓ Passt" bestätigt einen Vorschlag.</li>
      <li><b>Eigene Felder:</b> Art wählen (Text, Datum, Kästchen, E-Mail, Internetadresse, QR-Code, Unterschrift) und auf die Stelle tippen.</li>
      <li><b>Ausfüllen:</b> unter „✍️ Ausfüllen" direkt in die Felder schreiben; ein Unterschriftsfeld antippen und mit Stift oder Finger unterschreiben.</li>
      <li><b>Speichern:</b> geschieht laufend im Browser. 💾 Speichern legt zusätzlich eine Arbeitsdatei aufs Gerät — über „📄 PDF oder Bild" wieder einlesen und weitermachen, auch in einem anderen Browser.</li>
      <li><b>Ausgeben:</b> festes PDF, ausfüllbares PDF oder leere ausfüllbare Vorlage.</li>
      <li><b>Übersetzen:</b> in der Bibliothek „🌐 Übersetzen" — Deutsch, Russisch, Englisch in jede Richtung. Jede Seite wird auf <i>derselben</i> Seite übersetzt, Seitenumbrüche bleiben. Das Ergebnis liegt als neues Dokument im selben Ordner, das Original bleibt unberührt. Mit Gegenprobe (Rückübersetzung) daneben. <b>Kostenlos ohne Schlüssel:</b> „🌐 Mit Chrome übersetzen" — die App zeigt den Text unten an, du tippst in Chrome ⋮ → „Übersetzen" (der Text geht an Google). Läuft die App installiert im eigenen Fenster und fehlt dort „Übersetzen": „🌐 In Chrome öffnen" — derselbe Übersetzer öffnet sich in Chrome mit denselben Dokumenten, das Ergebnis liegt danach auch in der App.</li></ol>
      <p class="hinweis">Alles bleibt in diesem Browser (DeX-Chrome und Tablet-Chrome sind zwei getrennte Browser). Ins Netz geht nur, was du ausdrücklich an eine KI schickst.</p>
      <p>Das ausführliche <b>Benutzerhandbuch</b> und ein <b>Beispiel-Formular</b> (erfundene Daten) liegen der App bei — hier unten öffnen, oder unter „🌐 Übersetzen → 📘 Beispiele zum Ausprobieren". Sie landen im Ordner „Beispiele".</p>
      <div class="zeile"><button class="knopf" data-hb>📘 Handbuch öffnen</button><button class="knopf" data-bsp>📄 Beispiel-Formular</button><button class="knopf rot" data-x>Verstanden</button></div>
      <h3>🛡 Versteckte Befehle erkennen</h3>
      <p>Eine Datei kann Text tragen, den Sie nicht sehen: hellgrau auf weiß, winzig, unsichtbar im PDF oder in den Bildpunkten versteckt. Eine KI liest ihn trotzdem — und hält ihn womöglich für einen Auftrag („Ignoriere alle Anweisungen …"). <b>Workflow PDF prüft jede Datei schon beim Einlesen</b>, auf diesem Gerät und ohne Internet, mit derselben Prüfung wie der Auslieferungsprüfer und der Sende-Prüfer. Was es findet, wird <b>rot markiert, nicht gelöscht</b>: Sie sehen die Stelle und fragen beim Absender nach.</p>
      <p class="hinweis">Zum Ausprobieren (erfundene Inhalte) — einlesen, und die Warnung erscheint:</p>
      <div class="zeile"><button class="knopf" data-test-bild>🧪 Bild mit blasser Anweisung</button><button class="knopf" data-test-pdf>🧪 PDF mit unsichtbarem Text</button></div>
      <p class="hinweis">Das Bild selbst herunterladen und über „Importieren" einlesen: <a data-test-laden href="beispiele/Testbild-versteckte-Anweisung.png" download>⬇ Testbild</a></p>
      <p class="hinweis">Das <b>Erklärvideo</b> liegt auf der Webseite und braucht Internet.</p>
      <div class="zeile"><button class="knopf" data-video>🎬 Erklärvideo</button></div>
      <p class="hinweis"><a data-webseite href="${WEBSEITE}" target="_blank" rel="noopener">Alle Kapitel und das Video hochkant auf der Webseite</a></p>`, (d, zu) => {
        d.querySelector('[data-x]').onclick = zu;
        d.querySelector('[data-video]').onclick = () => { zu(); erklaervideo(); };
        const oeffne = nur => async () => { zu(); const x = await beispieleLaden(nur); if (x[0]) oeffneDok(x[0].id); };
        d.querySelector('[data-hb]').onclick = oeffne(BEISPIELE[0].name);
        d.querySelector('[data-bsp]').onclick = oeffne(BEISPIELE[1].name);
        const test = (datei, name, typ) => async () => {
          zu();
          try { const r = await fetch(datei); if (!r.ok) throw new Error(r.status);
            await importDateien([new File([await r.blob()], name, { type: typ })], 'Beispiele', { still: true });
          } catch (e) { toast('Die Testdatei ließ sich nicht laden — beim ersten Mal braucht es Internet.'); }
        };
        d.querySelector('[data-test-bild]').onclick = test('beispiele/Testbild-versteckte-Anweisung.png', 'Testbild versteckte Anweisung.png', 'image/png');
        d.querySelector('[data-test-pdf]').onclick = test('beispiele/Testdatei-unsichtbarer-Text.pdf', 'Testdatei unsichtbarer Text.pdf', 'application/pdf');
      });
  }

  /* ---------- Verdrahtung ---------- */
  function start() {
    $('inDatei').onchange = e => { importDateien(e.target.files); e.target.value = ''; };
    $('inOrdner').onchange = e => { const fs = Array.from(e.target.files || []); const n = fs[0] && fs[0].webkitRelativePath ? fs[0].webkitRelativePath.split('/')[0] : null; importDateien(fs, n); e.target.value = ''; };
    $('btnScan').onclick = () => scanStarten('neu');
    $('inAnhang').onchange = e => { dateienAnhaengen(e.target.files); e.target.value = ''; };
    $('btnUebersetzen').onclick = uebersetzenStart;
    $('inUeOrdner').onchange = e => { const fs = Array.from(e.target.files || []); const n = fs[0] && fs[0].webkitRelativePath ? fs[0].webkitRelativePath.split('/')[0] : null; ueEinlesen(fs, n); e.target.value = ''; };
    $('inUeDateien').onchange = e => { ueEinlesen(e.target.files, null); e.target.value = ''; };
    $('btnEinst').onclick = einstellungen; $('btnHilfe').onclick = hilfe; $('btnVideo').onclick = erklaervideo;
    // Suche: beim Tippen UND beim Absenden. Die Lupe der Bildschirmtastatur sendet das Formular ab
    // (vorher war das Feld ohne Formular — die Lupe tat nichts). Absenden schließt die Tastatur,
    // damit die Treffer zu sehen sind; compositionend fängt Tastaturen, die ein Wort erst am Ende
    // übergeben (Samsung-Tastatur mit Wortvorschlägen).
    const suchen = () => { S.suche = $('bibSuche').value; zeichneBibliothek(); };
    $('bibSuche').oninput = suchen;
    $('bibSuche').addEventListener('compositionend', suchen);
    $('bibForm').onsubmit = e => {
      e.preventDefault(); suchen(); $('bibSuche').blur();
      const g = $('dokGitter'); if (g && g.scrollIntoView) g.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    spracheingabe();
    /* Sichtbarer Schieberegler (Klaus 2026-09-27): unter der Feldarten-Leiste und den Ordner-Knöpfen,
       damit man auf kleinen Handys sieht, dass noch mehr folgt. Baustein: assets/schieber.js
       (byte-1:1 auch in den WorkFlohs). Er erscheint nur, wenn die Leiste wirklich überläuft. */
    if (window.WFSchieber) { WFSchieber.an($('ordnerLeiste')); WFSchieber.beobachte($('edFuss'), '.werkzeug'); }
    // Im Dokument: beim Tippen suchen (kurz verzögert, ein langes PDF kostet Zeit), Lupe/▼ = nächster Treffer
    let _eds = null, _edq = '';
    $('edSuche').oninput = () => { clearTimeout(_eds); _eds = setTimeout(() => { _edq = $('edSuche').value; imDokSuchen(_edq); }, 250); };
    $('edSuchForm').onsubmit = async e => {
      e.preventDefault(); clearTimeout(_eds);
      if ($('edSuche').value !== _edq || !S.funde.length) { _edq = $('edSuche').value; await imDokSuchen(_edq); } else springeZuFund(S.fundIdx + 1);
      $('edSuche').blur();
    };
    $('edSuchZurueck').onclick = () => springeZuFund(S.fundIdx - 1);
    $('btnSprache').onclick = spracheWaehlen; spracheKnopf();
    // Installieren: eigener Knopf, damit es nicht vom Chrome-Menü abhängt.
    // Läuft die App schon installiert (eigenes Fenster), bleibt er verborgen.
    const installiert = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    let _inst = null;
    if (!installiert()) $('btnInstall').hidden = false;
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); _inst = e; if (!installiert()) $('btnInstall').hidden = false; });
    window.addEventListener('appinstalled', () => { _inst = null; $('btnInstall').hidden = true; installHinweis(true); });
    // ⟳ Hard-Reload: Vorrat des Service-Workers weg, Worker abmelden, mit geänderter Adresse neu laden.
    // Nur eine geänderte Adresse ist für den HTTP-Cache eine andere Datei. IndexedDB (deine Dokumente) bleibt unberührt.
    $('btnNeu').onclick = async () => {
      $('btnNeu').disabled = true; toast('Neueste Fassung wird geladen …');
      try { await speichernJetzt(); } catch (_) {}
      try { if (window.caches) for (const k of await caches.keys()) await caches.delete(k); } catch (_) {}
      try { if (navigator.serviceWorker) for (const r of await navigator.serviceWorker.getRegistrations()) await r.unregister(); } catch (_) {}
      const u = new URL(location.href); u.searchParams.set('neu', Date.now().toString(36)); location.replace(u.href);
    };
    if (new URLSearchParams(location.search).has('neu')) { const u = new URL(location.href); u.searchParams.delete('neu'); history.replaceState(null, '', u.pathname + u.search + u.hash); }
    $('btnInstall').onclick = async () => {
      if (_inst) { _inst.prompt(); try { await _inst.userChoice; } catch (_) {} _inst = null; return; }
      installHinweis(false);
    };
    $('flohKnopf').onclick = () => { hops(); if (S.doc) schliesseEditor(); };
    $('edZurueck').onclick = () => schliesseEditor();
    $('edName').oninput = e => { S.doc.name = e.target.value.trim() || 'Dokument'; $('kopfSub').textContent = S.doc.name; speichern(); };
    $('mBearbeiten').onclick = () => { S.modus = 'bearbeiten'; zeichneModus(); };
    $('mAusfuellen').onclick = () => { S.modus = 'ausfuellen'; S.sel = null; zeichneModus(); };
    $('edErkennen').onclick = () => erkennenDialog([S.doc.id]);
    $('edZuschneiden').onclick = () => seiteZuschneiden();
    $('edExport').onclick = exportDialog;
    $('edTeilen').onclick = () => teilenDocs([S.doc.id]);
    $('edSpeichern').onclick = speichernDialog;
    // Beim Schließen oder Wechseln der App sofort sichern — sonst ginge verloren,
    // was in den letzten 0,35 s getippt wurde (Befund Klaus 2026-09-25).
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') speichernJetzt(); });
    window.addEventListener('pagehide', () => speichernJetzt());
    $('zMinus').onclick = () => zoom(1 / 1.2); $('zPlus').onclick = () => zoom(1.2);
    window.addEventListener('popstate', () => { if (S.doc && location.hash !== '#dok') schliesseEditor(true); });
    // Nur neu zeichnen, wenn sich die BREITE ändert. Die Bildschirmtastatur macht
    // das Fenster nur niedriger — ein Neuzeichnen würde das Feld wegwerfen, in
    // das gerade getippt wird (Befund Klaus 2026-09-25 am Tablet).
    let _rz = null;
    window.addEventListener('resize', () => {
      if (!S.doc) return; clearTimeout(_rz);
      _rz = setTimeout(() => { if (!S.doc) return; const b = seitenBreite(); if (b === _rzBreite) return; _rzBreite = b; zeichneSeiten(); }, 250);
    });
    document.addEventListener('keydown', e => {
      if (!S.doc || S.modus !== 'bearbeiten' || $('modals').children.length) return;
      if (/INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
      const f = S.doc.fields.find(x => x.id === S.sel);
      if (e.key === 'Escape') { S.sel = null; if (S.platzieren) platzierenStart(S.platzieren); markiere(); zeichneFuss(); return; }
      if (!f) return;
      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); feldLoeschen(f); return; }
      const st = e.shiftKey ? 1 : 0.2; const d = { ArrowLeft: [-st, 0], ArrowRight: [st, 0], ArrowUp: [0, -st], ArrowDown: [0, st] }[e.key];
      if (d) { e.preventDefault(); f.x = clamp(f.x + d[0], 0, 100 - f.w); f.y = clamp(f.y + d[1], 0, 100 - f.h); speichern(); zeichneFelder(f.page); }
    });
    // Ziehen & Ablegen auf die Bibliothek
    let ablage = null, tiefe = 0;
    const hatDateien = e => e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files');
    document.addEventListener('dragenter', e => { if (!hatDateien(e)) return; tiefe++; if (!ablage) { ablage = document.createElement('div'); ablage.className = 'ablage'; ablage.textContent = S.doc ? 'Loslassen = als Seiten anhängen' : 'Loslassen zum Einlesen'; document.body.appendChild(ablage); } });
    document.addEventListener('dragleave', () => { if (--tiefe <= 0 && ablage) { ablage.remove(); ablage = null; tiefe = 0; } });
    document.addEventListener('dragover', e => { if (hatDateien(e)) e.preventDefault(); });
    document.addEventListener('drop', e => { if (!hatDateien(e)) return; e.preventDefault(); tiefe = 0; if (ablage) { ablage.remove(); ablage = null; } if (S.doc) dateienAnhaengen(e.dataTransfer.files); else importDateien(e.dataTransfer.files); });

    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    bedeutungZeichnen();
    ladeBibliothek().then(() => { if (EINST.bedeutung) bedeutungStarten(); }).then(chromeTabRueckweg).then(geteiltUebernehmen).then(oeffnenMitEmpfangen).catch(e => toast('⚠️ Speicher nicht verfügbar: ' + (e.message || e)));
    window.__wfpdf = { eingang: { PRUEF, pruefDialog, eingangPruefen }, beispieleLaden, S, EINST, suche: { TEXTE, texteNachholen, zeichneBibliothek }, bedeutung: { BED, bedeutungStarten, bedeutungAus, vektorenNachholen, bedeutungZeichnen }, typAusLabel, nummerOeffnen, erkenneDok, importDateien, oeffneDok, einstSpeichern, uebersetzeViele, ergebnisOrdner, geteiltUebernehmen,
      // für tests/sprache.mjs: jeden Dialog einmal öffnen und seine Texte nachschlagen
      dlg: { neuerOrdner, verschieben, teilenDocs, wahlEnde, WAHL, wahlUmschalten, loeschen, speichernDialog, scanStarten, seiteDialog, erkannterText, erkennenDialog, exportDialog, uebersetzenStart, uebersetzenDialog, rueckwegDialog, einstellungen, installHinweis, hilfe, erklaervideo, videoFuer, spracheWaehlen, unterschreiben, chromeHinweis, zurueckBand, toast, zeichneFuss, platzierenStart, ordnerAusgabe, bedeutungDialog, sicherungDialog, sicherungErinnerung } };   // für die Probe
  }
  /* ---------- Aus einer anderen App geteilt (Klaus 2026-10-06) ----------
     Android zeigt Workfloh PDF in der Teilen-Liste, sobald die App installiert ist (share_target
     im Manifest). Der Worker legt die Dateien in den Vorrat „workfloh-pdf-geteilt" und leitet auf
     ./?geteilt=1 weiter; hier werden sie abgeholt, eingelesen und der Vorrat geleert. Auf dem
     Desktop kommt „Öffnen mit" über launchQueue (file_handlers). Nie still: kommt nichts an, steht
     das da. */
  async function geteiltUebernehmen() {
    const q = new URLSearchParams(location.search), g = q.get('geteilt');
    if (g === null) return;
    q.delete('geteilt'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    if (g === 'fehler') { toast('⚠️ Die geteilte Datei kam nicht an. Bitte noch einmal teilen.'); return; }
    if (g === '0') { toast('Es kam keine Datei an. Workfloh PDF nimmt PDFs und Bilder.'); return; }
    let dateien = [];
    try {
      const c = await caches.open('workfloh-pdf-geteilt');
      for (const k of await c.keys()) {
        const r = await c.match(k); if (!r) continue;
        const b = await r.blob(); let name = 'Datei';
        try { name = decodeURIComponent(r.headers.get('X-Name') || 'Datei'); } catch (_) {}
        dateien.push(new File([b], name, { type: b.type || r.headers.get('Content-Type') || '' }));
        await c.delete(k);
      }
    } catch (_) {}
    if (!dateien.length) { toast('⚠️ Die geteilte Datei kam nicht an. Bitte noch einmal teilen.'); return; }
    await importDateien(dateien);
  }
  function oeffnenMitEmpfangen() {
    if (!('launchQueue' in window)) return;
    window.launchQueue.setConsumer(async p => {
      if (!p || !p.files || !p.files.length) return;
      const fs = []; for (const h of p.files) { try { fs.push(await h.getFile()); } catch (_) {} }
      if (fs.length) importDateien(fs);
    });
  }
  start();
})();
