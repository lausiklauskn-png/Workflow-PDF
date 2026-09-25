/* Workfloh PDF — baut die zwei ERFUNDENEN Beispiel-Dateien unter beispiele/.
   Zum Testen der Übersetzung ohne eigene Daten (Klaus 2026-09-25). Alles erfunden:
   Gerät, Firma, Stadt, Adressen. Kein Byte ins Netz; die gescannte Seite wird im
   Browser auf eine Leinwand gezeichnet und als Bild eingebettet.
   Aufruf:  node tools/beispiele-bauen.mjs     (braucht playwright-core) */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const W = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const srv = http.createServer((q, r) => { const f = path.join(W, decodeURIComponent(new URL(q.url, 'http://x').pathname)); if (!f.startsWith(W) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end('<!doctype html><meta charset="utf-8">'); return; } r.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const exe = ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(fs.existsSync);
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/leer`);
await page.addScriptTag({ url: '/vendor/pdf-lib.min.js' });

const erg = await page.evaluate(async () => {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;
  const DATUM = new Date('2026-09-25T12:00:00Z');
  const A4 = [595.28, 841.89];
  const farbe = h => rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);
  const zeilen = (f, t, gr, breite) => { const w = t.split(' '), z = []; let a = ''; for (const x of w) { const n = a ? a + ' ' + x : x; if (f.widthOfTextAtSize(n, gr) > breite && a) { z.push(a); a = x; } else a = n; } if (a) z.push(a); return z; };

  /* ---------- 1. Benutzerhandbuch ---------- */
  const pdf = await PDFDocument.create();
  const R = await pdf.embedFont(StandardFonts.Helvetica), B = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ROT = farbe('#b3261e'), GRAU = farbe('#555555'), SCHWARZ = farbe('#111111');
  let p, y, nr = 0;
  const neu = titel => { p = pdf.addPage(A4); nr++; y = 780; if (titel) { p.drawText(titel, { x: 56, y, size: 20, font: B, color: ROT }); y -= 12; p.drawLine({ start: { x: 56, y }, end: { x: 539, y }, thickness: 1.2, color: ROT }); y -= 26; }
    p.drawText('Floh-Brüher 3000 · Benutzerhandbuch', { x: 56, y: 36, size: 8, font: R, color: GRAU }); p.drawText('Seite ' + nr, { x: 505, y: 36, size: 8, font: R, color: GRAU }); };
  const absatz = (t, o = {}) => { const gr = o.gr || 10.5, f = o.fett ? B : R, x = o.x || 56, br = o.br || 483; for (const z of zeilen(f, t, gr, br)) { p.drawText(z, { x, y, size: gr, font: f, color: o.farbe || SCHWARZ }); y -= gr * 1.4; } y -= o.nach == null ? 6 : o.nach; };
  const kasten = (kopf, text, grund, schrift) => { const f = 10, z = zeilen(R, text, f, 450), h = 26 + z.length * f * 1.4 + 8; p.drawRectangle({ x: 56, y: y - h + 12, width: 483, height: h, color: farbe(grund) }); p.drawText(kopf, { x: 68, y: y - 4, size: 11, font: B, color: farbe(schrift) }); let yy = y - 22; for (const s of z) { p.drawText(s, { x: 68, y: yy, size: f, font: R, color: farbe(schrift) }); yy -= f * 1.4; } y -= h + 10; };
  const tabelle = (kopf, reihen, breiten) => { const gr = 9.5; const x0 = 56; const zeile = (werte, fett, grund) => { const zs = werte.map((w, i) => zeilen(fett ? B : R, w, gr, breiten[i] - 10)); const h = Math.max(...zs.map(z => z.length)) * gr * 1.35 + 8; if (grund) p.drawRectangle({ x: x0, y: y - h + 12, width: breiten.reduce((a, b) => a + b), height: h, color: farbe(grund) }); let x = x0; zs.forEach((z, i) => { z.forEach((s, k) => p.drawText(s, { x: x + 5, y: y - k * gr * 1.35, size: gr, font: fett ? B : R, color: SCHWARZ })); x += breiten[i]; }); p.drawLine({ start: { x: x0, y: y - h + 12 }, end: { x: x0 + breiten.reduce((a, b) => a + b), y: y - h + 12 }, thickness: 0.6, color: GRAU }); y -= h; }; zeile(kopf, true, '#e3e3e3'); reihen.forEach(r => zeile(r, false)); y -= 14; };

  // Seite 1: Titel
  p = pdf.addPage(A4); nr++;
  p.drawRectangle({ x: 0, y: 600, width: A4[0], height: 242, color: ROT });
  p.drawText('Floh-Brüher 3000', { x: 56, y: 750, size: 36, font: B, color: rgb(1, 1, 1) });
  p.drawText('Kaffeevollautomat für den Haushalt', { x: 56, y: 715, size: 16, font: R, color: rgb(1, 1, 1) });
  p.drawText('Benutzerhandbuch · Bitte vor dem ersten Gebrauch lesen und aufbewahren.', { x: 56, y: 630, size: 11, font: R, color: rgb(1, 1, 1) });
  // Gerät als Zeichnung
  p.drawRectangle({ x: 200, y: 260, width: 195, height: 270, color: farbe('#333a40') });
  p.drawRectangle({ x: 215, y: 470, width: 165, height: 45, color: farbe('#8fd3ff') });
  p.drawText('12:30  ☕', { x: 260, y: 487, size: 14, font: R, color: SCHWARZ }).catch?.(() => {});
  p.drawCircle({ x: 297, y: 420, size: 22, color: farbe('#c9c9c9') });
  p.drawRectangle({ x: 270, y: 300, width: 55, height: 60, color: farbe('#efe3cf') });
  p.drawText('Modell FB-3000 · Ausgabe 09/2026 · Musterwerk GmbH (erfunden)', { x: 56, y: 150, size: 10, font: R, color: GRAU });
  return 'weiter';
}).catch(e => 'FEHLER ' + e.message);
console.log(erg);
await browser.close(); srv.close();
