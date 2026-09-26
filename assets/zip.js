/* Workfloh PDF — ZIP-Datei bauen, ohne Bibliothek (Klaus 2026-09-26: „den Ordner als
   Ganzes mit den integrierten PDFs freigeben"). Nur „gespeichert" (keine Kompression):
   PDFs sind ohnehin gepackt, und so bleibt es klein und prüfbar. Dateinamen in UTF-8
   (Bit 11), damit Umlaute und „–" heil ankommen. Läuft im Browser und in Node. */
(function () {
  'use strict';
  const TAB = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TAB[n] = c >>> 0; }
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = TAB[(c ^ u8[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  // Zeit im DOS-Format (lokale Zeit, 2-Sekunden-Schritte)
  function dosZeit(d) {
    const t = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const j = Math.max(0, d.getFullYear() - 1980);
    return { t, d: (j << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
  }
  // Doppelte Namen bekommen „ (2)", „ (3)" — sonst überschreibt beim Entpacken eine Datei die andere.
  function eindeutig(namen) {
    const gesehen = new Map();
    return namen.map(n => {
      const k = n.toLowerCase(); const z = gesehen.get(k) || 0; gesehen.set(k, z + 1);
      if (!z) return n;
      const p = n.lastIndexOf('.'); return p > 0 ? n.slice(0, p) + ' (' + (z + 1) + ')' + n.slice(p) : n + ' (' + (z + 1) + ')';
    });
  }
  // dateien: [{ name, bytes: Uint8Array }] → Uint8Array (ZIP)
  function zip(dateien, jetzt) {
    const enc = new TextEncoder(); const zt = dosZeit(jetzt || new Date());
    const namen = eindeutig(dateien.map(f => f.name));
    const teile = [], zentral = []; let pos = 0;
    dateien.forEach((f, i) => {
      const name = enc.encode(namen[i]), daten = f.bytes, crc = crc32(daten);
      const k = new DataView(new ArrayBuffer(30));
      k.setUint32(0, 0x04034b50, true); k.setUint16(4, 20, true); k.setUint16(6, 0x0800, true); k.setUint16(8, 0, true);
      k.setUint16(10, zt.t, true); k.setUint16(12, zt.d, true); k.setUint32(14, crc, true);
      k.setUint32(18, daten.length, true); k.setUint32(22, daten.length, true); k.setUint16(26, name.length, true); k.setUint16(28, 0, true);
      teile.push(new Uint8Array(k.buffer), name, daten);
      const z = new DataView(new ArrayBuffer(46));
      z.setUint32(0, 0x02014b50, true); z.setUint16(4, 20, true); z.setUint16(6, 20, true); z.setUint16(8, 0x0800, true); z.setUint16(10, 0, true);
      z.setUint16(12, zt.t, true); z.setUint16(14, zt.d, true); z.setUint32(16, crc, true);
      z.setUint32(20, daten.length, true); z.setUint32(24, daten.length, true); z.setUint16(28, name.length, true);
      z.setUint32(42, pos, true);
      zentral.push(new Uint8Array(z.buffer), name);
      pos += 30 + name.length + daten.length;
    });
    const zLaenge = zentral.reduce((n, x) => n + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, dateien.length, true); e.setUint16(10, dateien.length, true);
    e.setUint32(12, zLaenge, true); e.setUint32(16, pos, true);
    const alles = [...teile, ...zentral, new Uint8Array(e.buffer)];
    const out = new Uint8Array(alles.reduce((n, x) => n + x.length, 0)); let o = 0;
    for (const x of alles) { out.set(x, o); o += x.length; }
    return out;
  }
  const W = typeof window !== 'undefined' ? window : globalThis;
  (W.WFP = W.WFP || {}).Zip = { zip, crc32, eindeutig };
})();
