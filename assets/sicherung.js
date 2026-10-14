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
   MIT seit 2026-10-14 (Klaus: „die Originale mitnehmen, die können später ja wieder geprüft werden …
   ein Vermerk im Dateinamen, dass sie original sind, also ‚ungeprüft‘"): das aufgehobene Originalfoto
   eines noch ungeprüften Dokuments (<id>~original). Sein Name trägt den Vermerk ORIGINAL_VERMERK vor der
   Endung — so steht im Prüfbericht und in jeder Meldung, dass es das Original und noch ungeprüft ist.

   Diese Datei trägt nur die Rechnung; Oberfläche und Erinnerung stehen in app.js.
   Die Speicher-Naht (`db`) wird hineingereicht, damit die Probe sie ohne Browser fragen kann. */
(function (welt) {
  'use strict';
  const ART = 'workfloh-pdf-sicherung', FASSUNG = 1;
  const ERINNERN_TAGE = 14, MIN_PW = 8;
  const ORIGINAL = '~original', ORIGINAL_VERMERK = ' (Original, „ungeprüft“)';
  /* „Foto.jpg" → „Foto (Original, „ungeprüft“).jpg" — die Endung bleibt hinten, ein zweites Mal kommt er nicht dazu. */
  function originalName(name) {
    const n = String(name || 'Original');
    if (n.includes(ORIGINAL_VERMERK)) return n;
    const m = /^(.*?)(\.[A-Za-z0-9]{1,5})$/.exec(n);
    return m && m[1] ? m[1] + ORIGINAL_VERMERK + m[2] : n + ORIGINAL_VERMERK;
  }

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
    const ordner = await db.all('folders'), docs = await db.all('docs'), dateien = [], originale = [];
    let ohne = 0;
    for (const d of docs) {
      const b = await alsBytes(await db.getFile(d.id));
      if (b) dateien.push({ id: d.id, b64: zuB64(b) }); else ohne++;
      const o = db.get ? await db.get('files', d.id + ORIGINAL) : null;
      const ob = o && await alsBytes(o.bytes);
      if (b && ob) originale.push({ id: d.id, name: originalName(o.name), b64: zuB64(ob) });
    }
    return { art: ART, fassung: FASSUNG, erstellt: new Date().toISOString(), ordner, docs, dateien, originale, ohneDatei: ohne };
  }
  function inhaltLesen(obj) {
    if (!obj || obj.art !== ART || !Array.isArray(obj.docs) || !Array.isArray(obj.ordner) || !Array.isArray(obj.dateien)) throw new Error('keine-sicherung');
    const dateien = new Map();
    for (const f of obj.dateien) if (f && typeof f.id === 'string' && typeof f.b64 === 'string') dateien.set(f.id, vonB64(f.b64));
    // Sicherungen von vor dem 2026-10-14 tragen keine Originale — dann ist die Liste leer, kein Fehler.
    const originale = new Map();
    for (const f of Array.isArray(obj.originale) ? obj.originale : []) if (f && typeof f.id === 'string' && typeof f.b64 === 'string') originale.set(f.id, { name: originalName(f.name), bytes: vonB64(f.b64) });
    return { ordner: obj.ordner, docs: obj.docs, dateien, originale, erstellt: obj.erstellt };
  }

  async function verschliessen(pw, db) {
    const T = schloss(); if (!T) throw new Error('schloss-fehlt');
    const inhalt = await inhaltBauen(db);
    const paket = await T.zu(pw, JSON.stringify(inhalt));
    return { datei: { art: ART, fassung: FASSUNG, erstellt: inhalt.erstellt, paket }, docs: inhalt.docs.length, ordner: inhalt.ordner.length, ohneDatei: inhalt.ohneDatei, originale: inhalt.originale.length };
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
    let ordnerDazu = 0, dazu = 0, schonDa = 0, ohneDatei = 0, originale = 0; const neu = [];
    for (const o of inhalt.ordner) if (o && o.id && !daO.has(o.id)) { await db.put('folders', o); daO.add(o.id); ordnerDazu++; }
    for (const d of inhalt.docs) {
      if (!d || !d.id) continue;
      if (daD.has(d.id)) { schonDa++; continue; }
      const b = inhalt.dateien.get(d.id);
      if (!b) { ohneDatei++; continue; }
      const k = Object.assign({}, d);
      delete k.pruefung;                                 // ein Befund aus einer Datei wird nicht geglaubt — geprüft wird auf Knopfdruck
      if (k.folderId && !daO.has(k.folderId)) k.folderId = null;
      await db.putFile(k.id, b); await db.put('docs', k);
      // Das Original kommt mit, NACH der Datei (putFile räumt nur Abgeleitetes weg, nicht das Original).
      const o = inhalt.originale && inhalt.originale.get(k.id);
      if (o) { await db.put('files', { id: k.id + ORIGINAL, name: o.name, bytes: o.bytes }); originale++; }
      daD.add(k.id); dazu++; neu.push({ doc: k, bytes: b });
    }
    return { dazu, schonDa, ordnerDazu, ohneDatei, originale, neu };
  }

  function tageSeit(iso, jetzt) { const z = Date.parse(iso || ''); return isNaN(z) ? Infinity : ((jetzt || Date.now()) - z) / 86400000; }
  function erinnernNoetig(anzahlDocs, zuletztIso, spaeter, jetzt) {
    return anzahlDocs > 0 && !spaeter && tageSeit(zuletztIso, jetzt) >= ERINNERN_TAGE;
  }

  welt.WFP = welt.WFP || {};
  welt.WFP.Sicherung = { ART, FASSUNG, ERINNERN_TAGE, MIN_PW, ORIGINAL_VERMERK, originalName, inhaltBauen, inhaltLesen, verschliessen, oeffnen, zusammenfuehren, tageSeit, erinnernNoetig, zuB64, vonB64 };
})(typeof window !== 'undefined' ? window : globalThis);
