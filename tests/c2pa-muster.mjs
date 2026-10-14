/*
 * c2pa-muster.mjs — erfundene Dateien mit Herkunftsnachweis (C2PA) für die Probe,
 * im Test gebaut statt eingecheckt. Übernommen aus Auslieferung-Pruefer/tests/anhang-muster.mjs
 * (Klaus 2026-10-14): dort pflegen, hier nachziehen. Alle Namen erfunden, nie echte Kundendateien.
 */
import zlib from "node:zlib";

const TAB = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b) => { let c = -1; for (const x of b) c = TAB[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const be32 = (n) => Buffer.from([n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255]);

function chunk(typ, daten) {
  const t = Buffer.from(typ, "latin1"); const d = Buffer.from(daten);
  return Buffer.concat([be32(d.length), t, d, be32(crc(Buffer.concat([t, d])))]);
}
/** echtes, lesbares PNG (w×h, rot-blau), optional mit tEXt und Anhängsel */
export function png({ w = 16, h = 12, text = null, hinten = null } = {}) {
  const roh = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const o = y * (w * 3 + 1) + 1 + x * 3; roh[o] = 200; roh[o + 2] = x * 12; }
  const ihdr = Buffer.concat([be32(w), be32(h), Buffer.from([8, 2, 0, 0, 0])]);
  const teile = [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), chunk("IHDR", ihdr)];
  if (text) teile.push(chunk("tEXt", Buffer.from(text, "latin1")));
  teile.push(chunk("IDAT", zlib.deflateSync(roh)), chunk("IEND", Buffer.alloc(0)));
  if (hinten) teile.push(Buffer.from(hinten));
  return Buffer.concat(teile);
}
/** JPEG-Gerüst: SOI, APP1-Exif mit GPS-Verweis in IFD0, SOS, EOI, Anhängsel.

  teile.push(seg(0xDA, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0x12, 0x34]), Buffer.from([0xFF, 0xD9]));
  return Buffer.concat(teile);
}

/* Herkunftsnachweis (C2PA, Klaus 2026-10-14): ein erfundener Nachweis — Boxen
 * (JUMBF) mit CBOR darin, ein Zertifikat mit erfundenen Namen. Die Unterschrift
 * ist Füllstoff: der Prüfer rechnet sie ohnehin nicht nach. */
function cborEnc(x) {
  const kopf = (art, n) => n < 24 ? Buffer.from([art << 5 | n]) : n < 256 ? Buffer.from([art << 5 | 24, n])
    : n < 65536 ? Buffer.from([art << 5 | 25, n >> 8, n & 255]) : Buffer.concat([Buffer.from([art << 5 | 26]), be32(n)]);
  if (x === null) return Buffer.from([0xF6]);
  if (typeof x === "number") return kopf(0, x);
  if (typeof x === "string") { const s = Buffer.from(x, "utf8"); return Buffer.concat([kopf(3, s.length), s]); }
  if (Buffer.isBuffer(x)) return Buffer.concat([kopf(2, x.length), x]);
  if (Array.isArray(x)) return Buffer.concat([kopf(4, x.length), ...x.map(cborEnc)]);
  const k = Object.keys(x);
  return Buffer.concat([kopf(5, k.length), ...k.flatMap((s) => [/^\d+$/.test(s) ? kopf(0, +s) : cborEnc(s), cborEnc(x[s])])]);
}
const box = (typ, d) => Buffer.concat([be32(8 + d.length), Buffer.from(typ, "latin1"), d]);
const jumb = (label, kinder) => box("jumb", Buffer.concat([
  box("jumd", Buffer.concat([Buffer.alloc(16, 0x11), Buffer.from([3]), Buffer.from(label + "\0", "latin1")])), ...kinder]));
function zertifikat(aussteller, inhaber) {
  const name = (s) => { const b = Buffer.from(s, "utf8"); return Buffer.concat([Buffer.from([6, 3, 0x55, 4, 0x0A, 0x0C, b.length]), b]); };
  return Buffer.concat([Buffer.from([0x30, 0x82, 0, 0]), name(aussteller), Buffer.from([0x17, 13]), Buffer.from("260101000000Z", "latin1"),
    Buffer.from([0x17, 13]), Buffer.from("270101000000Z", "latin1"), name(inhaber)]);
}
export const C2PA_PROGRAMM = "Bildwerk Beispiel";
export const C2PA_UNTERSCHRIEBEN = "Beispiel Werkstatt GmbH";
/** die JUMBF-Bytes eines Nachweises (KI-erzeugt, erstellt) */
export function c2paNachweis({ programm = C2PA_PROGRAMM, ki = true } = {}) {
  const aktionen = cborEnc({ actions: [{ action: "c2pa.created", when: "2026-10-01T10:00:00Z",
    softwareAgent: { name: "Pinsel-Modell 3" },
    digitalSourceType: "http://cv.iptc.org/newscodes/digitalsourcetype/" + (ki ? "trainedAlgorithmicMedia" : "digitalCapture") }] });
  const claim = cborEnc({ "dc:title": "eule.png", claim_generator_info: [{ name: programm, version: "1.0" }] });
  const sig = cborEnc([cborEnc({ "33": [zertifikat("Beispiel Zertifizierung AG", C2PA_UNTERSCHRIEBEN)] }), {}, null, Buffer.alloc(8)]);
  return jumb("c2pa", [jumb("urn:uuid:00000000-0000-4000-8000-000000000001", [
    jumb("c2pa.assertions", [jumb("c2pa.actions.v2", [box("cbor", aktionen)])]),
    jumb("c2pa.claim.v2", [box("cbor", claim)]),
    jumb("c2pa.signature", [box("cbor", sig)])])]);
}
/** JPEG-Gerüst mit dem Nachweis in APP11; `teile` > 1 teilt ihn auf mehrere Segmente */
export function jpegC2pa({ teile = 1, kaputt = false } = {}) {
  let j = c2paNachweis(); if (kaputt) j = Buffer.concat([j.subarray(0, 40), Buffer.alloc(8)]);
  const seg = (m, d) => Buffer.concat([Buffer.from([0xFF, m]), Buffer.from([(d.length + 2) >> 8, (d.length + 2) & 255]), d]);
  const out = [Buffer.from([0xFF, 0xD8])], schritt = Math.ceil(j.length / teile);
  for (let k = 0, z = 1; k < j.length; k += schritt, z++) {
    const stueck = j.subarray(k, k + schritt);
    const kopf = Buffer.concat([Buffer.from("JP", "latin1"), Buffer.from([0, 1]), be32(z)]);
    out.push(seg(0xEB, k === 0 ? Buffer.concat([kopf, stueck]) : Buffer.concat([kopf, j.subarray(0, 8), stueck])));
  }
  out.push(seg(0xDA, Buffer.from([1, 1, 0, 0, 63, 0])), Buffer.from([0x12, 0x34]), Buffer.from([0xFF, 0xD9]));
  return Buffer.concat(out);
}
/** PNG mit dem Nachweis im caBX-Block */
export function pngC2pa() {
  const b = png(), iend = b.length - 12;
  return Buffer.concat([b.subarray(0, iend), chunk("caBX", c2paNachweis()), b.subarray(iend)]);
}
/** PDF mit dem Nachweis als angehängte Datei (AFRelationship /C2PA_Manifest)
 *  und einem Bild-Strom, in dessen Daten zufällig „/JS" und „/AA" stehen
 *  (Klaus 2026-10-14: so entstand ein falscher JavaScript-Befund). */
export function pdfC2pa({ nachweis = true } = {}) {
  const j = c2paNachweis(), bild = Buffer.from("xx/JS yy/AA zz/Launch qq", "latin1");
  const teile = ["%PDF-1.7\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R" + (nachweis ? " /AF [5 0 R]" : "") + " >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n",
    "3 0 obj\n<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /Length " + bild.length + " >>\nstream\n"];
  const out = [Buffer.from(teile.join(""), "latin1"), bild, Buffer.from("\nendstream\nendobj\n", "latin1")];
  if (nachweis) {
    out.push(Buffer.from("4 0 obj\n<< /Type /EmbeddedFile /Subtype /application#2Fc2pa /Length " + j.length + " >>\nstream\n", "latin1"), j,
      Buffer.from("\nendstream\nendobj\n5 0 obj\n<< /Type /Filespec /F (manifest.c2pa) /UF (manifest.c2pa) /AFRelationship /C2PA_Manifest /EF << /F 4 0 R >> >>\nendobj\n", "latin1"));
  }
  out.push(Buffer.from("trailer << /Root 1 0 R >>\n%%EOF\n", "latin1"));
  return Buffer.concat(out);
}

/** Wie pdfC2pa, aber mit EINER leeren Seite (Workflow PDF liest nur PDFs mit Seiten ein).
 *  Eigene Ergänzung, nicht aus dem Auslieferungsprüfer. */
export function pdfC2paSeite({ nachweis = true } = {}) {
  const roh = pdfC2pa({ nachweis }).toString("latin1")
    .replace("<< /Type /Pages /Kids [] /Count 0 >>", "<< /Type /Pages /Kids [6 0 R] /Count 1 >>")
    .replace("trailer <<", "6 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] >>\nendobj\ntrailer <<");
  return Buffer.from(roh, "latin1");
}
