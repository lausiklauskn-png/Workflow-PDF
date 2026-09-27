/* Workfloh PDF — Scannen: die Rechnung hinter dem Scan-Werkzeug (Klaus 2026-09-26).
   Keine Oberfläche, kein Speicher, kein Netz, kein DOM — läuft genauso in Node
   (tests/scan.mjs). Ein Bild ist hier {data: Uint8ClampedArray RGBA, width, height},
   also das, was ImageData auch ist.

   - Ecken: zwei Verfahren fragen, ihre Antworten vergleichen, entscheiden.
     Gemessen an 17 Testfotos mit von Hand geprüften Ecken (2026-09-26): das
     Scanic-Modell traf 14, blatt.js 10 — aber blatt.js lag bei 3 Fotos 11–27 %
     daneben und hielt sich für sicher. Eine einzelne Meinung reicht deshalb nicht:
     sind sich zwei Verfahren nicht einig, wird NICHT still geschnitten, sondern
     die Seite zum Prüfen markiert.
   - Entzerren: Homographie, bilinear. Ausgabe in jeder Größe (A4, Letter, wie das Blatt).
   - Filter: eigene Umsetzung (nicht kopiert). Der Hintergrund des Blatts wird
     geschätzt und herausgerechnet — so verschwinden Schatten und ungleiches Licht,
     statt nur heller oder dunkler zu werden.
   - Text ändern: Farben von Papier und Schrift in einem Kasten messen. */
(function () {
  'use strict';
  const A4 = { w: 595.28, h: 841.89 }, LETTER = { w: 612, h: 792 };
  const A5 = { w: 419.53, h: 595.28 }, A6 = { w: 297.64, h: 419.53 };
  const DIN = { a4: A4, a5: A5, a6: A6 };
  // „Automatisch" (Klaus 2026-09-27): Seitenverhältnis wie DIN (√2, ± AUTO_TOLERANZ) → A4, sonst wie das Blatt.
  // A4, A5 und A6 haben DASSELBE Verhältnis — welche Größe das Papier hatte, zeigt ein Foto nicht.
  // Automatisch nimmt deshalb A4; wer A5 oder A6 fotografiert hat, wählt es.
  const AUTO_TOLERANZ = 0.08;
  const klemm = (v, a, b) => v < a ? a : v > b ? b : v;

  /* ---------- Ecken ---------- */
  // Reihenfolge immer: oben links, oben rechts, unten rechts, unten links.
  function sortiere(pts) {
    const p = pts.map(q => [q[0], q[1]]);
    const summe = q => q[0] + q[1], diff = q => q[0] - q[1];
    const tl = p.reduce((a, b) => summe(b) < summe(a) ? b : a), br = p.reduce((a, b) => summe(b) > summe(a) ? b : a);
    const tr = p.reduce((a, b) => diff(b) > diff(a) ? b : a), bl = p.reduce((a, b) => diff(b) < diff(a) ? b : a);
    return [tl, tr, br, bl];
  }
  // Scanic liefert {topLeft:{x,y},…}; hier sind Ecken [[x,y],…].
  function ausScanic(c) {
    if (!c || !c.topLeft) return null;
    const e = [c.topLeft, c.topRight, c.bottomRight, c.bottomLeft].map(p => [+p.x, +p.y]);
    return e.every(p => isFinite(p[0]) && isFinite(p[1])) ? e : null;
  }
  // Größter Abstand zweier entsprechender Ecken, in Prozent der Bilddiagonale.
  function abstand(a, b, w, h) {
    const d = Math.hypot(w, h) || 1;
    return Math.max(...a.map((p, i) => Math.hypot(p[0] - b[i][0], p[1] - b[i][1]))) / d * 100;
  }
  function flaeche(e) {
    let s = 0; for (let i = 0; i < 4; i++) { const a = e[i], b = e[(i + 1) % 4]; s += a[0] * b[1] - b[0] * a[1]; }
    return Math.abs(s) / 2;
  }
  // Ein Viereck taugt als Blatt, wenn es nicht verdreht ist (konvex, im Uhrzeigersinn) und nicht winzig.
  function taugt(e, w, h) {
    if (!e || e.length !== 4) return false;
    let vz = 0;
    for (let i = 0; i < 4; i++) {
      const a = e[i], b = e[(i + 1) % 4], c = e[(i + 2) % 4];
      const k = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (!k) return false; const s = Math.sign(k); if (vz && s !== vz) return false; vz = s;
    }
    return flaeche(e) >= w * h * 0.05;
  }
  const ganz = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];
  const EINIG = 4;   // Prozent der Diagonale: näher beieinander gelten zwei Antworten als dieselbe

  /* Entscheiden, welche Ecken gelten. Eingaben (jede darf fehlen):
     ml: {ecken, score}  — Scanic-Modell ·  klassisch: {ecken} — Scanic ohne Modell ·
     blatt: {sicher, ecken} — assets/blatt.js.
     Ergebnis: {ecken, quelle, sicher, grund}. sicher=false heißt: der Nutzer soll hinsehen. */
  function entscheiden(eing, w, h) {
    const ml = eing.ml && taugt(eing.ml.ecken, w, h) && !(eing.ml.score != null && eing.ml.score < 0.5) ? eing.ml.ecken : null;
    const kl = eing.klassisch && taugt(eing.klassisch.ecken, w, h) ? eing.klassisch.ecken : null;
    const bl = eing.blatt && eing.blatt.sicher && taugt(eing.blatt.ecken, w, h) ? eing.blatt.ecken : null;
    const einig = (a, b) => a && b && abstand(a, b, w, h) <= EINIG;
    if (ml) {
      if (einig(ml, bl)) return { ecken: ml, quelle: 'ml', sicher: true, grund: 'Modell und Blatterkennung sind sich einig' };
      if (einig(ml, kl)) return { ecken: ml, quelle: 'ml', sicher: true, grund: 'Modell und Kantenerkennung sind sich einig' };
      return { ecken: ml, quelle: 'ml', sicher: false, grund: bl || kl ? 'Die Verfahren sind sich nicht einig — bitte Ecken prüfen' : 'Nur das Modell hat ein Blatt gefunden — bitte Ecken prüfen' };
    }
    if (bl && einig(bl, kl)) return { ecken: bl, quelle: 'blatt', sicher: true, grund: 'Blatt- und Kantenerkennung sind sich einig' };
    if (bl) return { ecken: bl, quelle: 'blatt', sicher: false, grund: 'Nur die Blatterkennung hat ein Blatt gefunden — bitte Ecken prüfen' };
    if (kl) return { ecken: kl, quelle: 'klassisch', sicher: false, grund: 'Nur die Kantenerkennung hat ein Blatt gefunden — bitte Ecken prüfen' };
    return { ecken: ganz(w, h), quelle: 'ganz', sicher: false, grund: 'Kein Blattrand gefunden — das ganze Foto bleibt' };
  }

  /* ---------- Größe der Seite ---------- */
  // format: 'auto' | 'a4' | 'a5' | 'a6' | 'letter' | 'blatt' (Original: Seitenverhältnis wie das Papier, lange Seite wie A4)
  function seitenMass(ecken, format, dpi) {
    const s = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const br = (s(ecken[0], ecken[1]) + s(ecken[3], ecken[2])) / 2, ho = (s(ecken[0], ecken[3]) + s(ecken[1], ecken[2])) / 2;
    const quer = br > ho;
    let f = format;
    if (f === 'auto') { const r = Math.max(br, ho) / (Math.min(br, ho) || 1); f = Math.abs(r / Math.SQRT2 - 1) <= AUTO_TOLERANZ ? 'a4' : 'blatt'; }
    let pw, ph;
    if (f === 'letter') { pw = quer ? LETTER.h : LETTER.w; ph = quer ? LETTER.w : LETTER.h; }
    else if (f === 'blatt') { const lang = A4.h, v = Math.min(br, ho) / Math.max(br, ho || 1); if (quer) { pw = lang; ph = lang * v; } else { ph = lang; pw = lang * v; } }
    else { const d = DIN[f] || A4; if (!DIN[f]) f = 'a4'; pw = quer ? d.h : d.w; ph = quer ? d.w : d.h; }
    return { W: Math.max(1, Math.round(pw / 72 * dpi)), H: Math.max(1, Math.round(ph / 72 * dpi)), seite: [pw, ph], quer, format: f };
  }

  /* ---------- Entzerren ---------- */
  // Homographie, die die Ecken des Zielrechtecks auf die Quell-Ecken abbildet.
  function homographie(von, nach) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = von[i], [u, v] = nach[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) { if (r === c) continue; const k = A[r][c] / A[c][c]; for (let j = c; j < 8; j++) A[r][j] -= k * A[c][j]; b[r] -= k * b[c]; }
    }
    return b.map((v, i) => v / A[i][i]).concat(1);
  }
  function entzerren(src, ecken, W, H) {
    const sd = src.data, sw = src.width, sh = src.height;
    const zd = new Uint8ClampedArray(W * H * 4);
    const M = homographie([[0, 0], [W, 0], [W, H], [0, H]], ecken);
    for (let y = 0; y < H; y++) {
      const py = y + 0.5;
      for (let x = 0; x < W; x++) {
        const px = x + 0.5, n = M[6] * px + M[7] * py + M[8];
        let u = (M[0] * px + M[1] * py + M[2]) / n - 0.5, v = (M[3] * px + M[4] * py + M[5]) / n - 0.5;
        u = klemm(u, 0, sw - 1); v = klemm(v, 0, sh - 1);
        const x0 = u | 0, y0 = v | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = u - x0, fy = v - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, o = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) zd[o + k] = (sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx) * (1 - fy) + (sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx) * fy;
        zd[o + 3] = 255;
      }
    }
    return { data: zd, width: W, height: H };
  }
  // Viertel-Drehung im Uhrzeigersinn, n = 0…3
  function drehen(img, n) {
    n = ((n % 4) + 4) % 4; if (!n) return img;
    const { data: s, width: w, height: h } = img, W = n % 2 ? h : w, H = n % 2 ? w : h, d = new Uint8ClampedArray(W * H * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      let X, Y; if (n === 1) { X = h - 1 - y; Y = x; } else if (n === 2) { X = w - 1 - x; Y = h - 1 - y; } else { X = y; Y = w - 1 - x; }
      const i = (y * w + x) * 4, o = (Y * W + X) * 4; d[o] = s[i]; d[o + 1] = s[i + 1]; d[o + 2] = s[i + 2]; d[o + 3] = s[i + 3];
    }
    return { data: d, width: W, height: H };
  }

  /* ---------- Filter ---------- */
  function helligkeit(d, n) { const L = new Float32Array(n); for (let p = 0, i = 0; p < n; p++, i += 4) L[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; return L; }
  // Papier-Helligkeit an jeder Stelle: je Block das Hellste (Schrift ist dunkel, fällt so heraus),
  // danach geglättet und zurück auf volle Größe gezogen.
  function hintergrund(L, w, h) {
    const b = Math.max(8, Math.round(Math.min(w, h) / 36)), gw = Math.ceil(w / b), gh = Math.ceil(h / b);
    let g = new Float32Array(gw * gh);
    for (let gy = 0; gy < gh; gy++) for (let gx = 0; gx < gw; gx++) {
      // nicht das absolute Hellste (Glanzpunkte), sondern das 90. Perzentil des Blocks
      const werte = [];
      for (let y = gy * b; y < Math.min(h, gy * b + b); y += 2) for (let x = gx * b; x < Math.min(w, gx * b + b); x += 2) werte.push(L[y * w + x]);
      werte.sort((a, c) => a - c); g[gy * gw + gx] = werte[Math.floor(werte.length * 0.9)] || 0;
    }
    const glaette = (q, max) => {
      const r = new Float32Array(gw * gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        let s = max ? 0 : 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= gw || Y >= gh) continue;
          const v = q[Y * gw + X]; if (max) { if (v > s) s = v; } else { s += v; n++; }
        }
        r[y * gw + x] = max ? s : s / n;
      }
      return r;
    };
    g = glaette(g, true); g = glaette(g, false); g = glaette(g, false);
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = klemm((y + 0.5) / b - 0.5, 0, gh - 1), y0 = fy | 0, y1 = Math.min(y0 + 1, gh - 1), ty = fy - y0;
      for (let x = 0; x < w; x++) {
        const fx = klemm((x + 0.5) / b - 0.5, 0, gw - 1), x0 = fx | 0, x1 = Math.min(x0 + 1, gw - 1), tx = fx - x0;
        out[y * w + x] = (g[y0 * gw + x0] * (1 - tx) + g[y0 * gw + x1] * tx) * (1 - ty) + (g[y1 * gw + x0] * (1 - tx) + g[y1 * gw + x1] * tx) * ty;
      }
    }
    return out;
  }
  const FILTER = ['original', 'farbe', 'grau', 'dokument', 'sw'];
  /* modus: original · farbe (Farben bleiben, Schatten weg) · grau · dokument (Graustufen,
     weißes Papier, kräftige Schrift) · sw (hart schwarz-weiß).
     opt.hell, opt.kontrast: −100 … +100. Ändert img.data und gibt img zurück. */
  function filtern(img, modus, opt) {
    opt = opt || {};
    const { data: d, width: w, height: h } = img, n = w * h;
    if (modus && modus !== 'original') {
      const L = helligkeit(d, n), bg = hintergrund(L, w, h);
      for (let p = 0, i = 0; p < n; p++, i += 4) {
        const g = Math.max(bg[p], 30), norm = L[p] / g;   // 1 = Papier, kleiner = Schrift
        if (modus === 'farbe') {
          const f = 250 / g;
          for (let k = 0; k < 3; k++) d[i + k] = klemm(d[i + k] * f, 0, 255);
          // Schrift etwas kräftiger, ohne die Farbe zu nehmen
          if (norm < 0.9) { const t = Math.pow(klemm(norm / 0.9, 0, 1), 1.35) / (norm / 0.9 || 1); for (let k = 0; k < 3; k++) d[i + k] = klemm(d[i + k] * t, 0, 255); }
        } else if (modus === 'grau') {
          const v = klemm(norm * 250, 0, 255); d[i] = d[i + 1] = d[i + 2] = v;
        } else if (modus === 'dokument') {
          const t = klemm((norm - 0.5) / (0.9 - 0.5), 0, 1), v = 255 * Math.pow(t, 1.6); d[i] = d[i + 1] = d[i + 2] = v;
        } else if (modus === 'sw') {
          const v = norm < 0.8 ? 0 : 255; d[i] = d[i + 1] = d[i + 2] = v;
        }
      }
    }
    const hell = +opt.hell || 0, kon = +opt.kontrast || 0;
    if (hell || kon) {
      const k = kon >= 0 ? 1 + kon / 50 : 1 + kon / 125, b = hell * 1.28;
      for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = klemm((d[i + c] - 128) * k + 128 + b, 0, 255);
    }
    return img;
  }

  /* ---------- Text ändern ---------- */
  // Farbe des Papiers (hellste 30 %) und der Schrift (dunkelste 10 %) in einem Kasten.
  function textFarben(img, box) {
    const { data: d, width: w, height: h } = img;
    const x0 = klemm(Math.floor(box.x), 0, w - 1), y0 = klemm(Math.floor(box.y), 0, h - 1);
    const x1 = klemm(Math.ceil(box.x + box.w), x0 + 1, w), y1 = klemm(Math.ceil(box.y + box.h), y0 + 1, h);
    const px = [];
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * w + x) * 4; px.push([d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114, d[i], d[i + 1], d[i + 2]]); }
    if (!px.length) return { grund: [255, 255, 255], schrift: [0, 0, 0] };
    px.sort((a, b) => a[0] - b[0]);
    const mittel = arr => [1, 2, 3].map(k => Math.round(arr.reduce((s, q) => s + q[k], 0) / arr.length));
    // Papier: das MITTLERE Hell (45.–85. Perzentil), nicht das hellste — sonst wird die Deckfläche
    // auf einem Foto mit Schatten sichtbar heller als das Papier daneben (Klaus 2026-09-27).
    const hellst = px.slice(Math.floor(px.length * 0.45), Math.max(Math.floor(px.length * 0.45) + 1, Math.floor(px.length * 0.85))), dunkelst = px.slice(0, Math.max(1, Math.floor(px.length * 0.1)));
    return { grund: mittel(hellst), schrift: mittel(dunkelst) };
  }

  /* Lage einer erkannten Zeile auf der Seite (Klaus 2026-09-27: „die Textrahmen sind nicht
     stimmig"). Der Rahmen einer schrägen Zeile ist höher als die Schrift — wer ihn überdeckt,
     löscht die Nachbarzeilen mit. Gerechnet wird deshalb an der GRUNDLINIE, die Tesseract je
     Zeile liefert (samt Neigung), und an der Schrifthöhe (rowHeight, Unterlängen).
     Kalibriert an Arial: 40 px → rowHeight 38, 24 px → 20 (gemessen 2026-09-27). */
  const SCHRIFT_JE_ZEILENHOEHE = 1.1;
  function zeilenLage(z, W, H) {
    const [bx, by, bw, bh] = z.box.map((v, i) => v * (i % 2 ? H : W));
    let x0, y0, x1, y1, rh, tief;
    if (z.base && z.rh) {
      x0 = z.base[0] * W; y0 = z.base[1] * H; x1 = z.base[2] * W; y1 = z.base[3] * H;
      rh = z.rh * H; tief = Math.max(0, (z.desc || 0) * H);
    } else {   // ohne Grundlinie (alte Erkennung): unteres Fünftel des Rahmens, waagerecht
      x0 = bx; x1 = bx + bw; y0 = y1 = by + bh * 0.8; rh = bh * 0.85; tief = bh * 0.2;
    }
    if (!(x1 > x0)) { x0 = bx; x1 = bx + bw; }
    const winkel = Math.atan2(y1 - y0, x1 - x0), laenge = Math.hypot(x1 - x0, y1 - y0);
    const hoch = Math.max(rh - tief, rh * 0.6);
    return { x: x0, y: y0, winkel, laenge, hoch, tief, rh, fs: rh * SCHRIFT_JE_ZEILENHOEHE, mitte: (y0 + y1) / 2 };
  }
  // Schriftgröße für eine sauber gesetzte Kopie: Zeilen ähnlicher Höhe (± 30 % um den Median)
  // bekommen dieselbe Größe — die Messung schwankt von Zeile zu Zeile, das Blatt meist nicht.
  function kopieGroessen(lagen) {
    const rhs = lagen.map(l => l.rh).filter(v => v > 0).sort((a, b) => a - b);
    if (!rhs.length) return lagen.map(l => l.fs);
    const med = rhs[Math.floor(rhs.length / 2)];
    return lagen.map(l => Math.abs(l.rh - med) / med < 0.3 ? med * SCHRIFT_JE_ZEILENHOEHE : l.fs);
  }
  // Das Band, in dem die Schrift einer Zeile liegt, als Viereck (für das Überdecken)
  function zeilenBand(l, rand) {
    const r = rand == null ? l.rh * 0.12 : rand, c = Math.cos(l.winkel), s = Math.sin(l.winkel);
    const vor = -r, nach = l.laenge + r, oben = -(l.hoch + r), unten = l.tief + r;
    return [[vor, oben], [nach, oben], [nach, unten], [vor, unten]].map(([u, v]) => [l.x + u * c - v * s, l.y + u * s + v * c]);
  }

  /* ---------- Bild mit ChatGPT (Klaus 2026-09-27) ----------
     Ein Knopf gibt Seitenbild + kurzen Auftrag an ChatGPT; zurück kommt ein fertiges BILD. „Mach's nicht zu kompliziert" — der Auftrag ist bewusst so kurz, wie Klaus ihn
     selbst schreiben würde. */
  const BILD_SPRACHEN = { de: 'Deutsch', en: 'Englisch', ru: 'Russisch', uk: 'Ukrainisch', pl: 'Polnisch', tr: 'Türkisch', ar: 'Arabisch', fr: 'Französisch', es: 'Spanisch', it: 'Italienisch' };
  function bildAuftrag(o) {
    const sp = BILD_SPRACHEN[(o || {}).nach] || 'Deutsch';
    return `Extrahiere den Text aus diesem Bild, übersetze ihn auf ${sp} und füge ihn an derselben Stelle wieder in das Originalbild ein. Verbessere dabei die Bildqualität: Schrift gestochen scharf und gut lesbar, Unschärfe und Rauschen entfernt, Layout und Farben wie im Original. Gib mir das fertige Bild in möglichst hoher Auflösung zurück.`;
  }
  const API = { A4, A5, A6, LETTER, AUTO_TOLERANZ, FILTER, EINIG, sortiere, ausScanic, abstand, taugt, entscheiden, seitenMass, homographie, entzerren, drehen, filtern, hintergrund, textFarben, ganz, zeilenLage, kopieGroessen, zeilenBand, SCHRIFT_JE_ZEILENHOEHE, BILD_SPRACHEN, bildAuftrag };
  if (typeof window !== 'undefined') { window.WFP = window.WFP || {}; window.WFP.ScanBild = API; }
  if (typeof globalThis !== 'undefined') globalThis.__WFP_SCANBILD = API;
})();
