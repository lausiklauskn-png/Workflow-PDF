/* Workfloh PDF — Speicher (IndexedDB).
   Vier Fächer: folders (Ordner), docs (Metadaten + Felder), files (die PDF-Bytes),
   texte (Seitentext mit Lage, für die Suche — seit Version 2, 2026-09-26).
   Die Bytes liegen getrennt, damit die Bibliothek schnell lädt, ohne jedes PDF
   mitzulesen. DB-Name ist app-eigen: github.io ist eine GETEILTE Adresse, und
   IndexedDB gehört dem Ursprung, nicht der App. Den Namen nie ändern. */
(function () {
  'use strict';
  const DB_NAME = 'WorkflohPDF1';
  const DB_VER = 2;
  let _db = null;

  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise((res, rej) => {
      const rq = indexedDB.open(DB_NAME, DB_VER);
      rq.onupgradeneeded = () => {
        const db = rq.result;
        if (!db.objectStoreNames.contains('folders')) db.createObjectStore('folders', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('texte')) db.createObjectStore('texte', { keyPath: 'id' });
      };
      rq.onsuccess = () => { _db = rq.result; res(_db); };
      rq.onerror = () => rej(rq.error);
    });
  }

  function tx(store, mode, fn) {
    return open().then(db => new Promise((res, rej) => {
      const t = db.transaction(store, mode);
      const st = t.objectStore(store);
      let out;
      const r = fn(st);
      if (r && 'onsuccess' in r) r.onsuccess = () => { out = r.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Speichern abgebrochen'));
    }));
  }

  const DB = {
    all: store => tx(store, 'readonly', st => st.getAll()),
    keys: store => tx(store, 'readonly', st => st.getAllKeys()),
    get: (store, id) => tx(store, 'readonly', st => st.get(id)),
    put: (store, obj) => tx(store, 'readwrite', st => st.put(obj)),
    // Der Seitentext hängt an den Bytes: wer sie ersetzt oder löscht, wirft ihn mit weg.
    // Die Suche erfasst ihn dann neu (app.js, texteNachholen) — ein veralteter Text
    // fände Dinge, die im PDF nicht mehr stehen.
    del: (store, id) => tx(store, 'readwrite', st => st.delete(id)).then(r => (store === 'files' ? tx('texte', 'readwrite', st => st.delete(id)).then(() => r) : r)),
    async putFile(id, bytes) { await DB.put('files', { id, bytes }); await tx('texte', 'readwrite', st => st.delete(id)); },
    async getFile(id) { const r = await DB.get('files', id); return r ? r.bytes : null; },
    async persist() {
      try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (_) {}
      return false;
    }
  };
  window.WFP = window.WFP || {};
  window.WFP.DB = DB;
})();
