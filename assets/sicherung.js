/* Workfloh PDF — DIE BIBLIOTHEK SICHERN UND ZURÜCKHOLEN (Klaus 2026-10-02).
   „Workflow soll dasselbe bekommen. Dieselbe Sicherung." · „Ein JSON-Tresor, aber auch einen,
   der die temporären Dateien speichert. Tief im Browser-Speicher, ohne dass gelöscht wird."

   Dieselbe Sicherung wie im Sende-Prüfer (assets/sicherung.js dort):
   - alle Ordner, Dokumente (Felder, Einträge) und PDF-Dateien in EINE Datei,
     verschlüsselt mit einem EIGENEN Passwort — das Schloss ist assets/schluesseltresor.js,
     byte-1:1 aus kim-hub-company (AES-256-GCM, PBKDF2-SHA256 600 000 Runden);
   - in der Datei steht KEIN Klartext, nur Art, Fassung, Datum und das Paket;
   - das Passwort wird nirgends gespeichert;
   - Zurückholen FÜGT HINZU und überschreibt nichts (gleiche Kennung bleibt, wie sie ist).
   Nicht mit: KI-Schlüssel und Einstellungen (die gehören nicht in eine Datei, die
   herumgeschickt wird), Seitentext und Bedeutungs-Vektoren (die rechnet die App neu).

   Diese Datei trägt nur die Rechnung; Oberfläche und Erinnerung stehen in app.js.
   Die Speicher-Naht (`db`) wird hineingereicht, damit die Probe sie ohne Browser fragen kann. */
(function (welt) {
  'use strict';
  const ART = 'workfloh-pdf-sicherung', FASSUNG = 1;
  const ERINNERN_TAGE = 14, MIN_PW = 8;

  const schloss = () => welt.WERKSTATT_SCHLUESSEL;

  function zuB64(bytes) {
    const a = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let s = '';
    for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function vonB64(s) {
    const bin = atob(s), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return a;
  }
  async function alsBytes(b) {
    if (b == null) return null;
    if (b instanceof Uint8Array) return b;
    if (b instanceof ArrayBuffer) return new Uint8Array(b);
    if (ArrayBuffer.isView(b)) return new Uint8Array(b.buffer, b.byteOffset, b.byteLength);
    if (typeof Blob !== 'undefined' && b instanceof Blob) return new Uint8Array(await b.arrayBuffer());
    return null;
  }

  /* Inhalt bauen und lesen — ohne Verschlüsselung, einzeln prüfbar. */
  async function inhaltBauen(db) {
    const ordner = await db.all('folders'), docs = await db.all('docs'), dateien = [];
    let ohne = 0;
    for (const d of docs) {
      const b = await alsBytes(await db.getFile(d.id));
      if (b) dateien.push({ id: d.id, b64: zuB64(b) }); else ohne++;
    }
    return { art: ART, fassung: FASSUNG, erstellt: new Date().toISOString(), ordner, docs, dateien, ohneDatei: ohne };
  }
  function inhaltLesen(obj) {
    if (!obj || obj.art !== ART || !Array.isArray(obj.docs) || !Array.isArray(obj.ordner) || !Array.isArray(obj.dateien)) throw new Error('keine-sicherung');
    const dateien = new Map();
    for (const f of obj.dateien) if (f && typeof f.id === 'string' && typeof f.b64 === 'string') dateien.set(f.id, vonB64(f.b64));
    return { ordner: obj.ordner, docs: obj.docs, dateien, erstellt: obj.erstellt };
  }

  async function verschliessen(pw, db) {
    const T = schloss(); if (!T) throw new Error('schloss-fehlt');
    const inhalt = await inhaltBauen(db);
    const paket = await T.zu(pw, JSON.stringify(inhalt));
    return { datei: { art: ART, fassung: FASSUNG, erstellt: inhalt.erstellt, paket }, docs: inhalt.docs.length, ordner: inhalt.ordner.length, ohneDatei: inhalt.ohneDatei };
  }
  async function oeffnen(pw, datei) {
    const T = schloss(); if (!T) throw new Error('schloss-fehlt');
    if (!datei || datei.art !== ART) throw new Error('keine-sicherung');
    if (!T.istPaketForm(datei.paket)) throw new Error('keine-sicherung');
    if (datei.fassung !== FASSUNG || datei.paket.v !== 1) throw new Error('fassung');
    let text;
    try { text = await T.auf(pw, datei.paket); }
    catch (e) { throw new Error(e && e.message === 'fassung' ? 'fassung' : 'passwort'); }
    return inhaltLesen(JSON.parse(text));
  }

  /* Hinzufügen, nie überschreiben. Ein Dokument ohne seine Datei kommt nicht herein
     (es ließe sich nicht öffnen) — es wird gezählt und genannt. */
  async function zusammenfuehren(db, inhalt) {
    const daO = new Set((await db.all('folders')).map(o => o.id));
    const daD = new Set((await db.all('docs')).map(d => d.id));
    let ordnerDazu = 0, dazu = 0, schonDa = 0, ohneDatei = 0; const neu = [];
    for (const o of inhalt.ordner) if (o && o.id && !daO.has(o.id)) { await db.put('folders', o); daO.add(o.id); ordnerDazu++; }
    for (const d of inhalt.docs) {
      if (!d || !d.id) continue;
      if (daD.has(d.id)) { schonDa++; continue; }
      const b = inhalt.dateien.get(d.id);
      if (!b) { ohneDatei++; continue; }
      const k = Object.assign({}, d);
      delete k.pruefung;                                 // ein Befund aus einer Datei wird nicht geglaubt — neu prüfen
      if (k.folderId && !daO.has(k.folderId)) k.folderId = null;
      await db.putFile(k.id, b); await db.put('docs', k);
      daD.add(k.id); dazu++; neu.push({ doc: k, bytes: b });
    }
    return { dazu, schonDa, ordnerDazu, ohneDatei, neu };
  }

  function tageSeit(iso, jetzt) { const z = Date.parse(iso || ''); return isNaN(z) ? Infinity : ((jetzt || Date.now()) - z) / 86400000; }
  function erinnernNoetig(anzahlDocs, zuletztIso, spaeter, jetzt) {
    return anzahlDocs > 0 && !spaeter && tageSeit(zuletztIso, jetzt) >= ERINNERN_TAGE;
  }

  welt.WFP = welt.WFP || {};
  welt.WFP.Sicherung = { ART, FASSUNG, ERINNERN_TAGE, MIN_PW, inhaltBauen, inhaltLesen, verschliessen, oeffnen, zusammenfuehren, tageSeit, erinnernNoetig, zuB64, vonB64 };
})(typeof window !== 'undefined' ? window : globalThis);
