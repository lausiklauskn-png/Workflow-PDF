/* Workfloh PDF — Oberfläche.
   Muster aus Mein-WorkFloh (Originaldokument-Modus): Felder liegen in Prozent
   über der echten Seite, „Felder bearbeiten" setzt und verschiebt sie,
   „Ausfüllen" schreibt hinein. Dokumente liegen lokal (IndexedDB), in Ordnern.
   Ins Netz geht nur, was der Nutzer ausdrücklich an eine KI schickt. */
(function () {
  'use strict';
  const { DB, Erkennung: ER, Export: EX, Uebersetzung: UE } = WFP;
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.min.js';
  if (qrcode.stringToBytesFuncs && qrcode.stringToBytesFuncs['UTF-8']) qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  const $ = id => document.getElementById(id);
  const h = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const jetzt = () => new Date().toISOString();

  const TYPEN = {
    text: { name: 'Text', ico: '📝' }, datum: { name: 'Datum', ico: '📅' }, check: { name: 'Kästchen', ico: '☑️' },
    email: { name: 'E-Mail', ico: '✉️' }, url: { name: 'Internetadresse', ico: '🔗' }, qr: { name: 'QR-Code', ico: '▦' }, unterschrift: { name: 'Unterschrift', ico: '✒️' }
  };
  const GROESSE = { text: [28, 2.2], datum: [16, 2.2], email: [28, 2.2], url: [28, 2.2], check: [2.6, 1.9], qr: [14, 10], unterschrift: [30, 4.5] };

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
    zoom: 1, platzieren: null, aufnahme: [], aufnahmeZiel: null, beob: null };

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
    zeichneBibliothek();
  }
  function offeneVorschlaege(d) { return (d.fields || []).filter(f => !f.geprueft).length; }
  function zeichneBibliothek() {
    const anz = id => S.docs.filter(d => id === 'alle' ? true : id === 'ohne' ? !d.folderId || !S.ordner.some(o => o.id === d.folderId) : d.folderId === id).length;
    let html = `<button class="ordner-chip${S.aktOrdner === 'alle' ? ' on' : ''}" data-o="alle">Alle<span class="anz">${anz('alle')}</span></button>`;
    for (const o of S.ordner) html += `<button class="ordner-chip${S.aktOrdner === o.id ? ' on' : ''}" data-o="${o.id}">${o.bereich === 'uebersetzung' ? '🌐 ' : '🗂️ '}${h(o.name)}<span class="anz">${anz(o.id)}</span></button>`;
    if (S.ordner.length && anz('ohne')) html += `<button class="ordner-chip${S.aktOrdner === 'ohne' ? ' on' : ''}" data-o="ohne">Ohne Ordner<span class="anz">${anz('ohne')}</span></button>`;
    html += `<button class="ordner-chip" data-neu>＋ Ordner</button>`;
    const ol = $('ordnerLeiste'); ol.innerHTML = html;
    ol.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { S.aktOrdner = b.dataset.o; zeichneBibliothek(); });
    ol.querySelector('[data-neu]').onclick = neuerOrdner;

    const akt = $('ordnerAktionen'); const o = S.ordner.find(x => x.id === S.aktOrdner);
    const sicht = S.docs.filter(d => S.aktOrdner === 'alle' ? true : S.aktOrdner === 'ohne' ? !d.folderId || !S.ordner.some(x => x.id === d.folderId) : d.folderId === S.aktOrdner);
    akt.innerHTML = (sicht.length ? `<button class="knopf" data-ueb>🌐 Übersetzen${sicht.length > 1 ? ' — Dokumente wählen' : ''}</button><button class="knopf" data-erk>🤖 Felder erkennen${sicht.length > 1 ? ' — Dokumente wählen' : ''}</button>` : '')
      + (o ? `<button class="knopf" data-ren>✎ Ordner umbenennen</button><button class="knopf gefahr" data-del>🗑 Ordner löschen</button>` : '');
    const q = s => akt.querySelector(s);
    if (q('[data-erk]')) q('[data-erk]').onclick = () => erkennenDialog(sicht.map(d => d.id));
    if (q('[data-ueb]')) q('[data-ueb]').onclick = () => uebersetzenDialog(sicht.filter(d => !d.uebersetzung).map(d => d.id).concat(sicht.filter(d => d.uebersetzung).map(d => d.id)));
    if (q('[data-ren]')) q('[data-ren]').onclick = async () => { const n = await eingabe('Ordner umbenennen', 'Name', o.name); if (!n) return; o.name = n; await DB.put('folders', o); ladeBibliothek(); };
    if (q('[data-del]')) q('[data-del]').onclick = async () => {
      if (!await frage('Ordner löschen?', `<p>Der Ordner „${h(o.name)}" wird gelöscht. Die ${anz(o.id)} Dokumente darin bleiben erhalten und stehen danach unter „Ohne Ordner".</p>`, 'Ordner löschen')) return;
      for (const d of S.docs.filter(d => d.folderId === o.id)) { d.folderId = null; await DB.put('docs', d); }
      await DB.del('folders', o.id); S.aktOrdner = 'alle'; ladeBibliothek();
    };

    const g = $('dokGitter');
    if (!sicht.length) {
      g.innerHTML = `<div class="leer"><b>Noch keine Dokumente${o ? ' in diesem Ordner' : ''}.</b><br>Oben ein PDF oder Bild wählen, ein Formular fotografieren oder einen ganzen Ordner einlesen. Du kannst Dateien auch einfach hierher ziehen.</div>`;
      return;
    }
    g.innerHTML = sicht.map(d => {
      const v = offeneVorschlaege(d), ord = S.ordner.find(x => x.id === d.folderId);
      return `<div class="dok" data-id="${d.id}">
        <button class="dok-bild" data-auf style="background-image:url('${d.thumb || ''}')" title="Öffnen">
          <span class="marken">${v ? `<span class="marke-klein ki">🤖 ${v} zu prüfen</span>` : ''}${d.quelle === 'foto' ? '<span class="marke-klein">📷 Foto</span>' : ''}${d.uebersetzung ? `<span class="marke-klein">🌐 ${h((d.uebersetzung.von || '').toUpperCase())}→${h((d.uebersetzung.nach || '').toUpperCase())}${d.uebersetzung.gegenprobe ? ' Gegenprobe' : ''}</span>` : ''}${d.ausgefuellt ? `<span class="marke-klein">↩ ausgefüllt aus ${h((d.ausgefuellt.aus || '').toUpperCase())}</span>` : ''}</span></button>
        <div class="dok-info"><div class="dok-name" title="${h(d.name)}">${h(d.name)}</div>
          <div class="dok-meta">${d.pages.length} Seite${d.pages.length === 1 ? '' : 'n'} · ${d.fields.length} Feld${d.fields.length === 1 ? '' : 'er'}${ord && S.aktOrdner === 'alle' ? ' · 🗂️ ' + h(ord.name) : ''}</div></div>
        <div class="dok-akt"><button data-auf title="Öffnen">✏️</button><button data-verschieben title="In Ordner verschieben">🗂️</button><button data-kopie title="Duplizieren (z. B. als Vorlage)">⧉</button><button data-loeschen title="Löschen">🗑</button></div></div>`;
    }).join('');
    g.querySelectorAll('.dok').forEach(el => {
      const id = el.dataset.id;
      el.querySelectorAll('[data-auf]').forEach(b => b.onclick = () => oeffneDok(id));
      el.querySelector('[data-verschieben]').onclick = () => verschieben(id);
      el.querySelector('[data-kopie]').onclick = () => duplizieren(id);
      el.querySelector('[data-loeschen]').onclick = () => loeschen(id);
    });
  }
  async function neuerOrdner() {
    const n = await eingabe('Neuer Ordner', 'Name des Ordners', ''); if (!n) return null;
    const o = { id: uid(), name: n, createdAt: jetzt() }; await DB.put('folders', o);
    S.aktOrdner = o.id; await ladeBibliothek(); return o;
  }
  async function verschieben(id) {
    const d = S.docs.find(x => x.id === id); if (!d) return;
    dialog(`<h2>In Ordner verschieben</h2><p class="hinweis">„${h(d.name)}"</p>
      ${S.ordner.map(o => `<button class="wahl" data-o="${o.id}"><b>🗂️ ${h(o.name)}</b></button>`).join('')}
      <button class="wahl" data-o=""><b>Ohne Ordner</b></button><button class="wahl" data-neu><b>＋ Neuer Ordner …</b></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (dl, zu) => {
      dl.querySelectorAll('[data-o]').forEach(b => b.onclick = async () => { d.folderId = b.dataset.o || null; await DB.put('docs', d); zu(); ladeBibliothek(); });
      dl.querySelector('[data-neu]').onclick = async () => { zu(); const o = await neuerOrdner(); if (o) { d.folderId = o.id; await DB.put('docs', d); ladeBibliothek(); } };
      dl.querySelector('[data-x]').onclick = zu;
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
    if (!await frage('Dokument löschen?', `<p>„${h(d.name)}" mit ${d.fields.length} Feldern wird aus diesem Browser gelöscht. Das lässt sich nicht rückgängig machen.</p>`, 'Löschen')) return;
    await DB.del('docs', id); await DB.del('files', id); toast('🗑 gelöscht'); ladeBibliothek();
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
  function fassungWaehlen(b, welche) { const v = b.fassungen && b.fassungen[welche]; if (!v) return; Object.assign(b, v); b.gewaehlt = welche; }

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
  async function neuesDok(name, bytes, quelle, folderId) {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const d = { id: uid(), name, folderId: folderId || null, quelle, createdAt: jetzt(), updatedAt: jetzt(),
      pages: await seitenInfo(pdf), thumb: await vorschaubild(pdf), fields: await vorhandeneFelder(pdf) };
    try { pdf.destroy(); } catch (_) {}
    await DB.putFile(d.id, bytes); await DB.put('docs', d);
    return d;
  }
  let _persistGefragt = false;

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
        await DB.putFile(d.id, bytes); await DB.put('docs', d);
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
    const liste = Array.from(dateien || []).filter(f => istPdf(f) || istBild(f)).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, 'de'));
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
        let bytes, quelle = 'pdf';
        if (istPdf(f)) bytes = new Uint8Array(await f.arrayBuffer());
        else { const b = await bildNormalisieren(f); bytes = await EX.bilderZuPdf([b]); quelle = 'foto'; }
        neu.push(await neuesDok(f.name.replace(/\.[^.]+$/, ''), bytes, quelle, folderId));
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

  /* ---------- Kamera: mehrere Seiten sammeln ---------- */
  async function kameraBild(file, ziel) {
    if (!file) return;
    try {
      const b = await bildNormalisieren(file);
      if (!S.aufnahme.length) S.aufnahmeUe = ziel === 'uebersetzung';   // kein alter Merker aus einer abgebrochenen Aufnahme
      if (ziel === 'anhang' && S.doc) { await seitenAnhaengen([await EX.bilderZuPdf([b])]); return; }
      S.aufnahme.push(b); aufnahmeDialog();
    } catch (e) { toast('⚠️ ' + (e.message || e)); }
  }
  let _aufZu = null;
  function aufnahmeDialog() {
    if (_aufZu) _aufZu();
    _aufZu = dialog(`<h2>📷 Formular fotografieren</h2>
      <p class="hinweis">Blatt gerade und gut beleuchtet aufnehmen. Weitere Seiten einfach dazunehmen.</p>
      <div class="aufnahme-bilder">${S.aufnahme.map((b, i) => `<div style="background-image:url('${b.vorschau}')"><button data-weg="${i}" title="Seite entfernen">✕</button>${b.fassungen && b.fassungen.gerade ? `<button class="blatt-um" data-um="${i}" title="Zwischen gerade gezogenem Blatt und ganzem Foto umschalten">${b.gewaehlt === 'gerade' ? '✂ Blatt · A4' : '▢ ganzes Foto'}</button>` : `<span class="blatt-um" title="${h((b.blatt && b.blatt.grund) || '')}">▢ Blatt nicht erkannt</span>`}</div>`).join('')}</div>
      <p class="hinweis">Das Blatt wird im Foto gesucht und auf <b>A4</b> gerade gezogen — ausgedruckt (Drucker auf „Tatsächliche Größe / 100 %") ist es so groß wie das Papier, mit seinem Rand. Wird der Rand nicht sicher erkannt, bleibt das ganze Foto auf A4 und nichts wird abgeschnitten. Tipp: Blatt auf einen dunklen Untergrund legen.</p>
      <div class="zeile"><button class="knopf" data-x>Verwerfen</button><button class="knopf" data-mehr>📷 Weitere Seite</button><button class="knopf rot" data-ok>✓ Dokument erstellen (${S.aufnahme.length} Seite${S.aufnahme.length === 1 ? '' : 'n'})</button></div>`,
      (d, zu) => {
        d.querySelectorAll('[data-um]').forEach(b => b.onclick = () => { const a = S.aufnahme[+b.dataset.um]; fassungWaehlen(a, a.gewaehlt === 'gerade' ? 'ganz' : 'gerade'); aufnahmeDialog(); });
        d.querySelectorAll('[data-weg]').forEach(b => b.onclick = () => { S.aufnahme.splice(+b.dataset.weg, 1); if (S.aufnahme.length) aufnahmeDialog(); else { zu(); _aufZu = null; } });
        d.querySelector('[data-x]').onclick = () => { S.aufnahme = []; S.aufnahmeUe = false; zu(); _aufZu = null; };
        d.querySelector('[data-mehr]').onclick = () => { S.aufnahmeZiel = S.aufnahmeUe ? 'uebersetzung' : 'neu'; $('inKamera').click(); };
        d.querySelector('[data-ok]').onclick = async () => {
          zu(); _aufZu = null;
          const bilder = S.aufnahme; S.aufnahme = []; const fuerUe = S.aufnahmeUe; S.aufnahmeUe = false;
          try {
            const bytes = await EX.bilderZuPdf(bilder);
            if (fuerUe) { await ueFotoAblegen(bytes); return; }
            const folderId = S.ordner.some(o => o.id === S.aktOrdner) ? S.aktOrdner : null;
            const name = 'Foto-Formular ' + new Date().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
            const doc = await neuesDok(name, bytes, 'foto', folderId);
            await ladeBibliothek(); hops(); oeffneDok(doc.id);
          } catch (e) { toast('⚠️ ' + (e.message || e)); }
        };
      });
  }

  /* ---------- Editor ---------- */
  // Öffnen ist asynchron (PDF laden): wer inzwischen zurück tippt oder ein anderes
  // Dokument öffnet, darf nicht von einem verspäteten Öffnen überholt werden.
  let _oeffnenNr = 0;
  async function oeffneDok(id) {
    const nr = ++_oeffnenNr;
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
    $('edName').value = d.name; $('kopfSub').textContent = d.name;
    history.pushState({ ed: 1 }, '', '#dok');
    zeichneSeiten(); zeichneModus();
  }
  async function schliesseEditor(ohneHistory) {
    _oeffnenNr++;
    await speichernJetzt();
    $('sc-ed').classList.remove('on'); $('sc-bib').classList.add('on');
    $('kopfSub').textContent = 'Formulare einlesen · Felder setzen · PDF ausgeben';
    if (S.beob) { S.beob.disconnect(); S.beob = null; }
    S.doc = null; S.sel = null;
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
    markiere();
  }
  function feldElement(f) {
    const el = document.createElement('div');
    el.className = 'feld' + (!f.geprueft ? ' ki' : '') + (f.type === 'check' ? ' check-feld' : '') + ((f.type === 'check' ? f.value : f.value !== '' && f.value != null) ? ' hatwert' : '');
    el.dataset.id = f.id;
    el.style.left = f.x + '%'; el.style.top = f.y + '%'; el.style.width = f.w + '%'; el.style.height = f.h + '%';
    if (f.decken) el.style.backgroundColor = f.decken;
    const hoehePx = () => el.getBoundingClientRect().height || 20;
    if (S.modus === 'ausfuellen') {
      if (f.type === 'check') {
        el.innerHTML = `<span class="kreuz">${f.value ? '✓' : ''}</span>`;
        el.onclick = () => { f.value = !f.value; el.querySelector('.kreuz').textContent = f.value ? '✓' : ''; speichern(); };
        el.title = f.label || 'Kästchen';
      } else if (f.type === 'unterschrift') {
        el.innerHTML = f.value ? `<img class="usbild" src="${h(f.value)}" alt="Unterschrift">` : '<span class="usleer">✒️ hier unterschreiben</span>';
        el.onclick = () => unterschreiben(f);
        el.title = f.label || 'Unterschrift';
      } else if (f.type === 'qr') {
        el.innerHTML = `<div class="qrbild">${f.value ? qrSvg(f.value) : '<span class="qrleer">QR-Inhalt unten eingeben</span>'}</div>`;
        el.onclick = () => { S.sel = f.id; markiere(); zeichneFuss(); };
      } else {
        const inp = document.createElement(f.mehrzeilig ? 'textarea' : 'input');
        if (!f.mehrzeilig) inp.type = f.type === 'datum' ? 'date' : f.type === 'email' ? 'email' : f.type === 'url' ? 'url' : 'text';
        inp.value = f.value || ''; inp.placeholder = ''; inp.title = f.label || TYPEN[f.type].name; inp.setAttribute('aria-label', f.label || TYPEN[f.type].name);
        inp.oninput = () => { f.value = inp.value; speichern(); };
        inp.onblur = () => speichernJetzt();
        inp.onfocus = () => { S.sel = f.id; markiere(); };
        requestAnimationFrame(() => { const hp = hoehePx(); inp.style.fontSize = Math.max(9, Math.min(f.mehrzeilig ? 16 : 22, hp * (f.mehrzeilig ? 0.34 : 0.62))) + 'px'; });
        el.appendChild(inp);
      }
      return el;
    }
    // Bearbeiten
    let inhalt = '';
    if (f.type === 'check') inhalt = `<span class="kreuz">${f.value ? '✓' : ''}</span>`;
    else if (f.type === 'qr') inhalt = `<div class="qrbild">${f.value ? qrSvg(f.value) : '<span class="qrleer">QR</span>'}</div>`;
    else if (f.type === 'unterschrift') inhalt = f.value ? `<img class="usbild" src="${h(f.value)}" alt="">` : '';
    else inhalt = `<span class="wert${f.mehrzeilig ? ' mz' : ''}">${h(feldText(f))}</span>`;
    el.innerHTML = inhalt + `<span class="etikett">${!f.geprueft ? '🤖 ' : ''}${h(f.label || TYPEN[f.type].name)}</span><span class="griff" title="Größe ändern"></span>`;
    requestAnimationFrame(() => { const w = el.querySelector('.wert'); if (w) w.style.fontSize = Math.max(8, Math.min(20, hoehePx() * (f.mehrzeilig ? 0.34 : 0.6))) + 'px'; });
    el.addEventListener('pointerdown', e => ziehen(e, f, el, e.target.classList.contains('griff') ? 'groesse' : 'bewegen'));
    return el;
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
    } else if (!S.platzieren) html += `<div class="werkzeug"><span class="hinweis">Feld antippen, um es zu ändern · ziehen zum Verschieben · roter Punkt ändert die Größe · Entf löscht.</span></div>`;
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
    dialog(`<h2>✒️ ${h(f.label || 'Unterschrift')}</h2>
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
      d.querySelector('[data-k]').onclick = () => { zu(); S.aufnahmeZiel = 'anhang'; $('inKamera').click(); };
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

  /* ---------- Erkennung ---------- */
  async function erkennenDialog(ids) {
    const mehrere = ids.length > 1;
    const namen = {};
    if (mehrere) for (const id of ids) { try { const d = S.doc && S.doc.id === id ? S.doc : await DB.get('docs', id); namen[id] = d && d.name; } catch (_) {} }
    const a = ER.ANBIETER[EINST.anbieter];
    dialog(`<h2>🤖 Formularfelder erkennen</h2>
      ${mehrere ? `<p><b>In welchen Dokumenten?</b> Tippe die an, die erkannt werden sollen — nur diese gehen an die KI. <button class="knopf klein" data-alle>Alle</button></p><div class="erk-liste">${ids.map(id => `<label class="erk-dok"><input type="checkbox" data-dok="${h(id)}"> ${h(namen[id] || id)}</label>`).join('')}</div><p class="hinweis" data-zahl>Noch kein Dokument gewählt.</p>` : ''}
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
    if (/e-?mail/.test(l)) return 'email';
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
        && t.str.trim().toLowerCase().replace(/[:\s]+$/, '') !== lab);
      if (!drin.length) continue;
      drin.sort((a, b) => Math.abs(a.y - b.y) > a.h * 0.5 ? a.y - b.y : a.x - b.x);
      let txt = '', letzt = null;
      for (const t of drin) { txt += letzt ? (Math.abs(t.y - letzt.y) > letzt.h * 0.5 ? '\n' : ' ') : ''; txt += t.str.trim(); letzt = t; }
      f.inhalt = txt.replace(/ +/g, ' ').trim();
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
            toast('✅ HTML gespeichert — im Browser öffnen, ausfüllen, dann „Als PDF speichern".');
            return;
          }
          // Kyrillische Einträge (oder ein Formular zum Ausfüllen auf Russisch) brauchen
          // eine Unicode-Schrift — die Standardschrift machte daraus „?".
          const kyr = !!(S.doc.uebersetzung && S.doc.uebersetzung.nach === 'ru') || S.doc.fields.some(f => typeof f.value === 'string' && /[^\u0000-\u024F\u2000-\u206F€]/.test(f.value));
          let schrift = null; if (kyr) { try { schrift = await UE.schriftLaden('vendor/'); } catch (_) {} }
          const { bytes, hinweise } = await EX.exportieren(S.doc, S.bytes, m === 'druck' ? 'fest' : m, { schrift, unicodeFelder: !!(S.doc.uebersetzung && S.doc.uebersetzung.nach === 'ru') });
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
  async function ergebnisOrdner(d, schluessel, zusatz) {
    let q = S.ordner.find(x => x.id === d.folderId);
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
      <button class="wahl" data-uk><b>📷 Brief fotografieren</b><span>Papierbrief (z. B. vom Amt) Seite für Seite aufnehmen. Das Blatt wird auf A4 gerade gezogen — ausgedruckt wieder so groß wie das Papier. Die Texterkennung liest ihn auf dem Gerät.</span></button>
      ${quellen.length ? `<p style="margin-top:12px"><b>… oder einen Ordner, der schon hier liegt:</b></p>${quellen.map(o => `<button class="wahl" data-o="${o.id}"><b>${o.bereich === 'uebersetzung' ? '🌐 ' : '🗂️ '}${h(o.name)}</b><span>${S.docs.filter(d => d.folderId === o.id && !d.uebersetzung).length} Dokumente</span></button>`).join('')}` : ''}
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, (dl, zu) => {
      dl.querySelector('[data-x]').onclick = zu;
      dl.querySelector('[data-uo]').onclick = () => { zu(); $('inUeOrdner').click(); };
      dl.querySelector('[data-ud]').onclick = () => { zu(); $('inUeDateien').click(); };
      dl.querySelector('[data-uk]').onclick = () => { zu(); S.aufnahmeZiel = 'uebersetzung'; S.aufnahmeUe = true; $('inKamera').click(); };
      dl.querySelectorAll('[data-o]').forEach(b => b.onclick = () => { zu(); S.aktOrdner = b.dataset.o; zeichneBibliothek(); uebersetzenDialog(S.docs.filter(d => d.folderId === b.dataset.o && !d.uebersetzung).map(d => d.id), true); });
    });
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
     App-Oberfläche. Auf Android erzwingt die intent-Adresse die Chrome-App; anderswo
     kennt der Browser das Schema nicht und würde wegnavigieren, dort also ein neuer Tab. */
  function chromeTabAdresse(ids, von, nach) {
    const u = new URL(location.pathname, location.origin);
    u.searchParams.set('ue', ids.join(',')); u.searchParams.set('von', von); u.searchParams.set('nach', nach); u.searchParams.set('weg', 'chrome');
    const intent = 'intent://' + u.host + u.pathname + u.search + '#Intent;scheme=' + u.protocol.replace(':', '') + ';package=com.android.chrome;S.browser_fallback_url=' + encodeURIComponent(u.href) + ';end';
    return { url: u.href, intent };
  }
  const istAndroid = () => /Android/i.test(navigator.userAgent);
  function chromeTabKnoepfe(el, lage, vorher) {   // lage() → { ids, von, nach }
    const k = (txt, titel) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'knopf klein'; b.textContent = txt; b.title = titel; b.style.cssText = 'padding:6px 10px;border:1px solid #999;border-radius:8px;background:#fff;font-size:13px'; el.appendChild(b); return b; };
    k('🌐 In Chrome öffnen', 'Öffnet dieselben Dokumente im Chrome-Browser. Dort ⋮ → „Übersetzen" — das Ergebnis wird ein PDF wie hier.').onclick = async () => {
      const l = lage(); if (!l.ids.length) return toast('Kein Dokument gewählt.');
      const a = chromeTabAdresse(l.ids, l.von, l.nach);
      window.__wfpdfChromeTab = a;   // für die Probe
      if (vorher) try { await vorher(); } catch (_) {}
      try { await speichernJetzt(); } catch (_) {}
      if (istAndroid()) location.href = a.intent; else window.open(a.url, '_blank', 'noopener');
    };
    if (navigator.share) k('📤 Teilen …', 'Teilen mit Chrome oder einem anderen Browser').onclick = async () => {
      const l = lage(); if (!l.ids.length) return toast('Kein Dokument gewählt.');
      try { await navigator.share({ title: 'Workfloh PDF · Übersetzen', url: chromeTabAdresse(l.ids, l.von, l.nach).url }); } catch (_) {}
    };
    k('📋 Adresse kopieren', 'Adresse in die Zwischenablage, dann in Chrome einfügen').onclick = async () => {
      const l = lage(); if (!l.ids.length) return toast('Kein Dokument gewählt.');
      const url = chromeTabAdresse(l.ids, l.von, l.nach).url;
      try { await navigator.clipboard.writeText(url); toast('📋 Adresse kopiert — in Chrome oben einfügen.'); } catch (_) { await eingabe('Adresse', 'Kopieren und in Chrome einfügen', url); }
    };
  }
  // Beim Start: Aufruf aus „In Chrome öffnen" → Übersetzer mit denselben Dokumenten wieder öffnen.
  async function chromeTabRueckweg() {
    const q = new URLSearchParams(location.search); if (!q.has('ue')) return;
    const ids = String(q.get('ue') || '').split(',').filter(Boolean), von = q.get('von'), nach = q.get('nach');
    const u = new URL(location.href); ['ue', 'von', 'nach', 'weg'].forEach(n => u.searchParams.delete(n)); history.replaceState(null, '', u.pathname + u.search + u.hash);
    if (UE.SPRACHEN[von] && UE.SPRACHEN[nach] && von !== nach) { EINST.ueVon = von; EINST.ueNach = nach; einstSpeichern(); }
    const da = []; for (const id of ids) if (S.docs.some(d => d.id === id) || await DB.get('docs', id)) da.push(id);
    if (!da.length) return toast('⚠️ Die Dokumente sind in diesem Browser nicht da — hier ist der Speicher getrennt von der App. Das PDF hier einlesen und „🌐 Übersetzen" tippen.');
    S.ausApp = true;
    uebersetzenDialog(da, true, { chromeTab: true });
  }
  async function uebersetzenDialog(ids, alleGewaehlt, opt) {
    opt = opt || {};
    const docs = [];
    for (const id of ids) { const d = S.docs.find(x => x.id === id) || await DB.get('docs', id); if (d) docs.push(d); }
    const mehrere = docs.length > 1; const a = ER.ANBIETER[EINST.anbieter];
    dialog(`<h2>🌐 Übersetzen</h2>${opt.chromeTab ? `<p class="hinweis" data-ausapp style="background:#fff3cd;padding:8px;border-radius:8px"><b>Aus der App in Chrome geöffnet.</b> Tippe „🌐 Mit Chrome übersetzen", danach in Chrome ⋮ → „Übersetzen" → ${h(UE.SPRACHEN[EINST.ueNach] || '')}. Das Ergebnis wird ein PDF wie in der App und liegt in der Bibliothek.</p>` : ''}
      <p class="hinweis">Jede Seite wird auf derselben Seite übersetzt: Bilder, Grafiken und Aufbau des Originals bleiben, nur der Text wird an seiner Stelle ersetzt — in der Farbe des Originals. Gescannte Seiten liest die Texterkennung (OCR) auf dem Gerät. Seitenumbrüche bleiben, das Original bleibt unberührt. Die Ergebnisse kommen in eigene Ordner je Sprache („… · RU"), getrennt von den Originalen; alle Ordner lassen sich umbenennen.</p>
      ${mehrere ? `<p><b>Welche Dokumente?</b> <button class="knopf klein" data-alle>Alle</button></p>` : ''}
      <div class="erk-liste">${docs.map((d, i) => `<label class="erk-dok"><input type="checkbox" data-dok="${h(d.id)}"${!mehrere || (alleGewaehlt && !d.uebersetzung) ? ' checked' : ''}> ${h(d.name)} <span class="hinweis">· ${d.pages.length} S.${d.uebersetzung ? ' · schon eine Übersetzung' : ''}${!d.uebersetzung ? ' · ' + (d.fields.filter(f => f.geprueft).length ? d.fields.filter(f => f.geprueft).length + ' Felder kommen übersetzt mit' : 'keine Felder') : ''}</span>${!d.uebersetzung && !d.fields.filter(f => f.geprueft).length ? ` <button class="knopf klein" data-feld="${h(d.id)}" title="Rahmen zum Ausfüllen (Text, Datum, Kästchen, Unterschrift) im Original setzen — sie kommen dann übersetzt mit">✏️ erst Felder setzen</button>` : ''}</label>`).join('')}</div>
      <p class="hinweis">Formular zum Ausfüllen (z. B. vom Amt)? Die Rahmen zum Ausfüllen am besten <b>im Original</b> setzen („✏️ erst Felder setzen", oder „🔍 Felder erkennen") — dann kommen sie übersetzt an dieselbe Stelle mit. Nach dem Ausfüllen holt „⬇ PDF ausgeben → ↩ Einträge ins Original" die Einträge zurück.</p>
      <div class="ue-sprachen"><div><label>von</label>${sprachWahl('von', EINST.ueVon)}</div><div class="ue-pfeil">→</div><div><label>nach</label>${sprachWahl('nach', EINST.ueNach)}</div></div>
      <label style="font-weight:400"><input type="checkbox" data-rueck${EINST.ueRueck !== false ? ' checked' : ''}> Gegenprobe: danach zurück in die Ausgangssprache übersetzen und daneben ablegen</label>
      <p class="hinweis" data-zahl></p>
      <button class="wahl" data-weg="browser"><b>📱 Übersetzer im Browser</b><span data-bstat>prüfe …</span></button>
      <button class="wahl" data-weg="chrome"><b>🌐 Mit Chrome übersetzen (Google)</b><span>Kostenlos, ohne Schlüssel und ohne Kontingent. Die App zeigt den Text jeder Seite unten an, du tippst einmal in Chrome ⋮ → „Übersetzen" — danach läuft es Seite für Seite von selbst. Der Text geht dabei an Google.${matchMedia('(display-mode: standalone)').matches ? ' Die App läuft gerade im eigenen Fenster — dort fehlt „Übersetzen" oft. Dann „🌐 In Chrome öffnen" (darunter): derselbe Übersetzer öffnet sich in Chrome.' : ''}</span></button>
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
        EINST.ueVon = von(); EINST.ueNach = nach(); EINST.ueRueck = dl.querySelector('[data-rueck]').checked; einstSpeichern();
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
  async function uebersetzerErzeugen(weg, von, nach, mitRueck, knopf, zu, ids) {
    if (weg === 'chrome') {   // keine Gegenprobe: Chrome übersetzt nur in EINE Richtung zugleich
      const opt = {};
      if (ids && ids.length && matchMedia('(display-mode: standalone)').matches) opt.tab = el => chromeTabKnoepfe(el, () => ({ ids, von, nach }), () => { if (hin.halt) hin.halt(); });
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
  const OHNE_UEBERSETZUNG = new Set(['datum', 'email', 'url', 'qr', 'unterschrift', 'check']);
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
  async function rueckwegDialog(id) {
    await speichernJetzt();
    const d = await DB.get('docs', id); if (!rueckwegMoeglich(d)) return toast('Dieses Dokument ist keine Übersetzung eines Originals hier.');
    const src = await DB.get('docs', d.uebersetzung.quelle);
    if (!src || !await DB.getFile(src.id)) return toast('⚠️ Das Original „' + (d.name || '') + '" liegt nicht mehr in diesem Browser.');
    const von = d.uebersetzung.nach, nach = d.uebersetzung.von;           // zurück: z. B. RU → DE
    const eintraege = d.fields.filter(f => f.type === 'check' ? f.value : String(f.value || '').trim()).length;
    const a = ER.ANBIETER[EINST.anbieter];
    dialog(`<h2>↩ Einträge ins Original (${h(UE.SPRACHEN[nach])})</h2>
      <p>Die <b>${eintraege}</b> Einträge aus „${h(d.name)}" werden ins ${h(UE.NAME_DE[nach] || nach)}e übersetzt und in eine <b>Kopie</b> des Originals „${h(src.name)}" eingesetzt — an dieselbe Stelle. Das Original und die Übersetzung bleiben unverändert.</p>
      <p class="hinweis">Datum, E-Mail, Internetadresse, Unterschrift und Kästchen werden übernommen, nicht übersetzt. Bitte die Einträge danach prüfen — Namen und Adressen bleiben in der Regel stehen, aber jede Übersetzung kann sich irren.</p>
      <button class="wahl" data-weg="browser"><b>📱 Übersetzer im Browser</b><span data-bstat>prüfe …</span></button>
      <button class="wahl" data-weg="chrome"><b>🌐 Mit Chrome übersetzen (Google)</b><span>Kostenlos. Die Einträge erscheinen unten, du tippst in Chrome ⋮ → „Übersetzen" und wählst ${h(UE.NAME_DE[nach])}. Der Text geht dabei an Google.</span></button>
      <button class="wahl" data-weg="ki"><b>🤖 Mit KI — ${h(a.label)}</b><span>${kiBereit() ? `Nur die Einträge (nicht die Seiten) gehen an ${h(a.label)}. Vor dem ersten Senden wird gefragt.` : 'Noch kein Schlüssel eingetragen — tippen, um ihn einzutragen.'}</span></button>
      <div class="zeile"><button class="knopf" data-x>Abbrechen</button></div>`, async (dl, zu) => {
      dl.querySelector('[data-x]').onclick = zu;
      const v = await UE.browserVerfuegbar(von, nach);
      dl.querySelector('[data-bstat]').textContent = v === 'fehlt' ? 'Dieser Browser hat keinen eingebauten Übersetzer.' : v === 'unavailable' ? `${UE.SPRACHEN[von]} → ${UE.SPRACHEN[nach]} kann er nicht.` : 'Kostenlos, auf dem Gerät.';
      if (v === 'fehlt' || v === 'unavailable') dl.querySelector('[data-weg="browser"]').disabled = true;
      dl.querySelectorAll('[data-weg]').forEach(b => b.onclick = async () => {
        let u;
        try { u = await uebersetzerErzeugen(b.dataset.weg, von, nach, false, b, zu); }
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
    z.push('<b>Browser:</b> ' + h(navigator.userAgent.replace(/^Mozilla\/5\.0 /, '')));
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
        z.push(`<b>${h(d.name)}:</b> ${mitText} von ${n} geprüften Seiten mit Textebene (${abs} Absätze)${mitText ? '' : ' — vermutlich gescannt: der Text wird beim Übersetzen per Texterkennung (OCR, auf dem Gerät) gelesen'}`);
      } catch (e) { z.push(`<b>${h(d.name)}:</b> nicht lesbar (${h(e.message || e)})`); }
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
        const r = await UE.lauf({ bytes, uebersetzer: hin, stand: alt, abbruch: () => abbruch, ocr: { basis: 'vendor/', von },
          speichere: st => DB.put('files', { id: jid, job: st }),
          melde: (i, n, info) => { stand = (k + i / n) / ids.length; standText = info.text ? vor + info.text : `${vor}Seite ${i} von ${n}${info.neu ? ' · ' + (info.ms / info.neu / 1000).toFixed(1) + ' s je Seite' : ''}`; fb.setze(stand, standText); } });
        zeile.ocr = r.ocrSeiten;
        if (r.ocrFehler) zeile.hinweise.push('Texterkennung für gescannte Seiten nicht verfügbar (' + r.ocrFehler + ') — diese Seiten bleiben unübersetzt.');
        zeile.ms = r.ms; zeile.neu = r.neu; zeile.fertig = r.fertig;
        if (weg === 'chrome' && k === 0 && EINST.ueRueck) zeile.hinweise.push('Eine Gegenprobe gibt es auf dem Chrome-Weg nicht — Chrome übersetzt die Seite immer nur in eine Sprache.');
        if (weg === 'chrome' && hin.stat.ohne > ohneVor) zeile.hinweise.push((hin.stat.ohne - ohneVor) + ' Absatz/Absätze hat Chrome nicht übersetzt — sie stehen im Original da.');
        if (r.fehler && !abbruch) zeile.hinweise.push('Der Übersetzer hat abgebrochen: ' + r.fehler + (/Tempo-Limit/.test(r.fehler) ? ' — dein Konto beim Anbieter erlaubt nur wenige Anfragen je Minute; die App hat über zwei Minuten gewartet. Später fortsetzen, das Limit beim Anbieter erhöhen (Mistral: Admin → Limits) oder „🌐 Mit Chrome übersetzen" nehmen (ohne Limit).' : /429|Kontingent/.test(r.fehler) ? ' — das Kontingent des Anbieters ist für den Moment erschöpft; später erneut starten.' : ''));
        // Teilergebnis: fertige Seiten übersetzt, der Rest im Original — damit das
        // bisher Übersetzte zu SEHEN ist (vorher stand es nur im Speicher).
        const teil = r.abgebrochen || !!r.fehler;
        if (teil && !r.fertig) { zeile.hinweise.push('Noch keine Seite übersetzt — es gibt kein Teilergebnis.'); bericht.push(zeile); break; }
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
    dialog(`<h2>🌐 Übersetzung ${abbruch ? 'angehalten' : bericht.some(z => z.teil) ? 'unvollständig — Teilergebnis liegt bereit' : 'fertig'}</h2>
      <ul>${bericht.map(z => `<li><b>${h(z.name)}</b> · ${z.fertig != null ? z.fertig + ' von ' + z.seiten + ' Seiten' : ''}${z.neu ? ' · ' + (z.ms / z.neu / 1000).toFixed(1) + ' s je neu übersetzter Seite' : ''}${z.groesse ? ' · Ergebnis ' + (z.groesse >= 1048576 ? (z.groesse / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(z.groesse / 1024)) + ' KB') : ''}${z.ordner ? ' · liegt in „' + h(z.ordner) + '"' : ''}${z.felder ? ' · ' + z.felder + ' Felder übersetzt mitgenommen' : ''}${z.neuId ? ` <button class="knopf klein" data-oeffne="${h(z.neuId)}">${z.teil ? '👁 Teilübersetzung öffnen' : '✏️ Öffnen: Felder setzen / ausfüllen'}</button>` : ''}${z.hinweise.length ? '<ul>' + z.hinweise.map(x => '<li class="hinweis">' + h(x) + '</li>').join('') + '</ul>' : ''}</li>`).join('')}</ul>
      ${S.ausApp && !abbruch && !matchMedia('(display-mode: standalone)').matches ? '<p class="hinweis" data-zurueckapp><b>Zurück in die App:</b> die Übersetzung liegt hier in der Bibliothek. Die installierte App liest denselben Speicher und zeigt sie beim nächsten Öffnen — diesen Chrome-Tab kannst du dann schließen. Fehlt sie dort, „⬇ PDF" hier im Tab ausgeben.</p>' : ''}
      <p class="hinweis">Gemessen: ${neuS} Seiten in ${((Date.now() - t0) / 1000).toFixed(0)} s · ${zeichen.toLocaleString('de-DE')} Zeichen übersetzt${tokE || tokA ? ` · ${tokE.toLocaleString('de-DE')} Token hin, ${tokA.toLocaleString('de-DE')} Token zurück (${h(hin.stat.modell || '')}) — den Preis je Token nennt der Anbieter` : ''}${performance.memory ? ' · Speicher ' + (performance.memory.usedJSHeapSize / 1048576).toFixed(0) + ' MB' : ''}.</p>
      <div class="zeile"><button class="knopf rot" data-x>OK</button></div>`, (dl, zu) => { dl.querySelector('[data-x]').onclick = zu; dl.querySelectorAll('[data-oeffne]').forEach(b => b.onclick = () => { zu(); oeffneDok(b.dataset.oeffne); }); });
    if (!abbruch) hops();
  }

  /* ---------- Einstellungen, Hilfe ---------- */
  function einstellungen() {
    const opt = Object.entries(ER.ANBIETER).map(([k, a]) => `<option value="${k}"${k === EINST.anbieter ? ' selected' : ''}>${h(a.label)}</option>`).join('');
    dialog(`<h2>⚙️ Einstellungen</h2>
      <h3 style="margin:10px 0 0;font-size:1rem">KI-Felderkennung (freiwillig)</h3>
      <p class="hinweis">Ohne KI funktionieren Import, Linien-Erkennung, Felder setzen und Export vollständig offline. Mit eigenem Schlüssel (BYOK) erkennt die KI auch Beschriftungen und Text. Standard ist Mistral mit Verarbeitung in der EU.</p>
      <label>Anbieter</label><select id="stAnb">${opt}</select>
      <label>Schlüssel <a id="stKonsole" target="_blank" rel="noopener" style="font-weight:400">— Schlüssel beim Anbieter holen ↗</a></label><input type="password" id="stKey" autocomplete="off" placeholder="nur in diesem Browser gespeichert">
      <label>Modell für die Felderkennung (leer = Vorgabe)</label><input type="text" id="stMod" placeholder="">
      <label>Modell für die Übersetzung (leer = Vorgabe)</label><input type="text" id="stUebMod" placeholder="">
      <div class="zeile" style="justify-content:flex-start"><button class="knopf" id="stTest">🔌 Verbindung testen</button><span class="hinweis" id="stTestErg"></span></div>
      <p class="hinweis">Der Schlüssel liegt unverschlüsselt im Speicher dieses Browsers (localStorage) und wird nur an den gewählten Anbieter geschickt.</p>
      <h3 style="margin:14px 0 0;font-size:1rem">Erkennung</h3>
      <label style="font-weight:400"><input type="checkbox" id="stLin"${EINST.linien !== false ? ' checked' : ''}> Linien, Rahmen und Kästchen im Seitenbild suchen (offline)</label>
      <h3 style="margin:14px 0 0;font-size:1rem">Speicher</h3>
      <p class="hinweis" id="stSpeicher">…</p>
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
  function hilfe() {
    dialog(`<h2>So geht's</h2><ol>
      <li><b>Einlesen:</b> PDF oder Bild wählen, ein Papierformular fotografieren oder einen ganzen Ordner einlesen. Dateien lassen sich auch auf die Seite ziehen. Bei Fotos wird das Blatt gesucht und auf A4 gerade gezogen — ausgedruckt („Tatsächliche Größe / 100 %") so groß wie das Papier.</li>
      <li><b>Felder erkennen:</b> 🤖 findet Linien, Rahmen, graue Eingabeflächen und Kästchen — offline oder mit KI. Das sind Vorschläge (orange gestrichelt).</li>
      <li><b>Prüfen und korrigieren:</b> unter „✏️ Felder bearbeiten" Felder verschieben, am roten Punkt vergrößern, Bezeichnung und Art ändern. „✓ Passt" bestätigt einen Vorschlag.</li>
      <li><b>Eigene Felder:</b> Art wählen (Text, Datum, Kästchen, E-Mail, Internetadresse, QR-Code, Unterschrift) und auf die Stelle tippen.</li>
      <li><b>Ausfüllen:</b> unter „✍️ Ausfüllen" direkt in die Felder schreiben; ein Unterschriftsfeld antippen und mit Stift oder Finger unterschreiben.</li>
      <li><b>Speichern:</b> geschieht laufend im Browser. 💾 Speichern legt zusätzlich eine Arbeitsdatei aufs Gerät — über „📄 PDF oder Bild" wieder einlesen und weitermachen, auch in einem anderen Browser.</li>
      <li><b>Ausgeben:</b> festes PDF, ausfüllbares PDF oder leere ausfüllbare Vorlage.</li>
      <li><b>Übersetzen:</b> in der Bibliothek „🌐 Übersetzen" — Deutsch, Russisch, Englisch in jede Richtung. Jede Seite wird auf <i>derselben</i> Seite übersetzt, Seitenumbrüche bleiben. Das Ergebnis liegt als neues Dokument im selben Ordner, das Original bleibt unberührt. Mit Gegenprobe (Rückübersetzung) daneben. <b>Kostenlos ohne Schlüssel:</b> „🌐 Mit Chrome übersetzen" — die App zeigt den Text unten an, du tippst in Chrome ⋮ → „Übersetzen" (der Text geht an Google). Läuft die App installiert im eigenen Fenster und fehlt dort „Übersetzen": „🌐 In Chrome öffnen" — derselbe Übersetzer öffnet sich in Chrome mit denselben Dokumenten, das Ergebnis liegt danach auch in der App.</li></ol>
      <p class="hinweis">Alles bleibt in diesem Browser (DeX-Chrome und Tablet-Chrome sind zwei getrennte Browser). Ins Netz geht nur, was du ausdrücklich an eine KI schickst.</p>
      <div class="zeile"><button class="knopf rot" data-x>Verstanden</button></div>`, (d, zu) => d.querySelector('[data-x]').onclick = zu);
  }

  /* ---------- Verdrahtung ---------- */
  function start() {
    $('inDatei').onchange = e => { importDateien(e.target.files); e.target.value = ''; };
    $('inOrdner').onchange = e => { const fs = Array.from(e.target.files || []); const n = fs[0] && fs[0].webkitRelativePath ? fs[0].webkitRelativePath.split('/')[0] : null; importDateien(fs, n); e.target.value = ''; };
    $('inKamera').onchange = e => { const f = e.target.files && e.target.files[0]; const ziel = S.aufnahmeZiel; S.aufnahmeZiel = null; e.target.value = ''; kameraBild(f, ziel); };
    $('inAnhang').onchange = e => { dateienAnhaengen(e.target.files); e.target.value = ''; };
    $('btnUebersetzen').onclick = uebersetzenStart;
    $('inUeOrdner').onchange = e => { const fs = Array.from(e.target.files || []); const n = fs[0] && fs[0].webkitRelativePath ? fs[0].webkitRelativePath.split('/')[0] : null; ueEinlesen(fs, n); e.target.value = ''; };
    $('inUeDateien').onchange = e => { ueEinlesen(e.target.files, null); e.target.value = ''; };
    $('btnEinst').onclick = einstellungen; $('btnHilfe').onclick = hilfe;
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
    $('edExport').onclick = exportDialog;
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
      _rz = setTimeout(() => { const b = seitenBreite(); if (b === _rzBreite) return; _rzBreite = b; zeichneSeiten(); }, 250);
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
    ladeBibliothek().then(chromeTabRueckweg).catch(e => toast('⚠️ Speicher nicht verfügbar: ' + (e.message || e)));
    window.__wfpdf = { S, EINST, erkenneDok, importDateien, oeffneDok, einstSpeichern, uebersetzeViele };   // für die Probe
  }
  start();
})();
