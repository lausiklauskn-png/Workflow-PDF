/* Workfloh PDF — Blatt im Foto finden und auf A4 gerade ziehen.
   Host-neutral (nur Canvas), wird byte-1:1 in die WorkFlohs kopiert.

   Ein Brief vom Amt kommt auf Papier, wird fotografiert und später wieder
   ausgedruckt — dann soll er so groß sein wie vorher, mit seinem Rand. Deshalb:
   - das Blatt (hell) wird vom Hintergrund (Tisch) getrennt,
   - seine vier Ecken werden gesucht (auch schräg / perspektivisch),
   - das Blatt wird auf das Seitenverhältnis von A4 entzerrt; die Seite im PDF
     ist danach GENAU A4 (595,28 × 841,89 pt, hoch oder quer).
   Der ganze Bogen ist die Seite: der Rand des Papiers bleibt der Rand.
   Unsicher erkannt → es wird NICHT geschnitten, sondern das Foto unverändert
   auf die Seite gelegt, und das wird gesagt. Lieber ein Tisch am Rand als ein
   abgeschnittener Absender. */
(function () {
  'use strict';
  const A4 = { w: 595.28, h: 841.89 };
  const KLEIN = 400;           // Erkennung auf verkleinertem Bild (lange Kante)
  const DPI = 200;             // Ausgabe: A4 mit 200 dpi = 1654 × 2339 px

  function grau(canvas) {
    const f = Math.min(1, KLEIN / Math.max(canvas.width, canvas.height));
    const w = Math.max(1, Math.round(canvas.width * f)), h = Math.max(1, Math.round(canvas.height * f));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data; const g = new Uint8Array(w * h), sat = new Uint8Array(w * h);
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const r = d[i], gg = d[i + 1], b = d[i + 2];
      g[j] = (r * 299 + gg * 587 + b * 114) / 1000;
      sat[j] = Math.max(r, gg, b) - Math.min(r, gg, b);
    }
    return { g, sat, w, h, f };
  }
  function otsu(g) {
    const hist = new Array(256).fill(0); for (let i = 0; i < g.length; i++) hist[g[i]]++;
    let sum = 0; for (let t = 0; t < 256; t++) sum += t * hist[t];
    let sB = 0, wB = 0, best = 0, schwelle = 127;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; const wF = g.length - wB; if (!wF) break;
      sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF; const v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; schwelle = t; }
    }
    return schwelle;
  }
  // Größte zusammenhängende helle Fläche (Papier: hell UND wenig bunt)
  function groessteFlaeche(m, w, h) {
    const lab = new Int32Array(w * h), q = new Int32Array(w * h); let beste = null, n = 0;
    for (let s = 0; s < m.length; s++) {
      if (!m[s] || lab[s]) continue; n++; let kopf = 0, fuss = 0; q[fuss++] = s; lab[s] = n; let groesse = 0;
      while (kopf < fuss) {
        const p = q[kopf++]; groesse++; const x = p % w, y = (p - x) / w;
        if (x > 0 && m[p - 1] && !lab[p - 1]) { lab[p - 1] = n; q[fuss++] = p - 1; }
        if (x < w - 1 && m[p + 1] && !lab[p + 1]) { lab[p + 1] = n; q[fuss++] = p + 1; }
        if (y > 0 && m[p - w] && !lab[p - w]) { lab[p - w] = n; q[fuss++] = p - w; }
        if (y < h - 1 && m[p + w] && !lab[p + w]) { lab[p + w] = n; q[fuss++] = p + w; }
      }
      if (!beste || groesse > beste.groesse) beste = { n, groesse };
    }
    return beste ? { lab, n: beste.n, groesse: beste.groesse } : null;
  }
  function huelle(pts) {
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const kr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const u = [], l = [];
    for (const p of pts) { while (l.length >= 2 && kr(l[l.length - 2], l[l.length - 1], p) <= 0) l.pop(); l.push(p); }
    for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (u.length >= 2 && kr(u[u.length - 2], u[u.length - 1], p) <= 0) u.pop(); u.push(p); }
    u.pop(); l.pop(); return l.concat(u);
  }
  const flaeche = q => { let a = 0; for (let i = 0; i < q.length; i++) { const p = q[i], r = q[(i + 1) % q.length]; a += p[0] * r[1] - r[0] * p[1]; } return Math.abs(a) / 2; };
  // Vier Ecken: für mehrere Drehwinkel die äußersten Hüllpunkte, das größte Viereck gewinnt
  function vierEcken(h) {
    let best = null;
    for (let gr = 0; gr < 90; gr += 3) {
      const q = [];
      for (const k of [45, 135, 225, 315]) {
        const a = (gr + k) * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a);
        let bp = h[0], bv = -Infinity; for (const p of h) { const v = p[0] * dx + p[1] * dy; if (v > bv) { bv = v; bp = p; } }
        q.push(bp);
      }
      const A = flaeche(q); if (!best || A > best.A) best = { q, A };
    }
    // Reihenfolge: oben links, oben rechts, unten rechts, unten links (Bildschirm)
    const q = best.q.slice(); const mx = q.reduce((s, p) => s + p[0], 0) / 4, my = q.reduce((s, p) => s + p[1], 0) / 4;
    q.sort((a, b) => Math.atan2(a[1] - my, a[0] - mx) - Math.atan2(b[1] - my, b[0] - mx));   // im Uhrzeigersinn ab links oben
    let start = 0, m = Infinity; q.forEach((p, i) => { if (p[0] + p[1] < m) { m = p[0] + p[1]; start = i; } });
    return { ecken: [0, 1, 2, 3].map(i => q[(start + i) % 4]), A: best.A };
  }

  /* Sucht das Blatt. Ergebnis: { sicher, ecken:[[x,y]×4] in Pixeln des Quell-Canvas,
     quer:boolean, anteil (Blatt / Bild), grund } */
  function finden(canvas) {
    const { g, sat, w, h, f } = grau(canvas);
    const t = otsu(g);
    const m = new Uint8Array(w * h); for (let i = 0; i < m.length; i++) m[i] = g[i] > t && sat[i] < 60 ? 1 : 0;
    const gf = groessteFlaeche(m, w, h);
    const ganz = [[0, 0], [canvas.width, 0], [canvas.width, canvas.height], [0, canvas.height]];
    if (!gf) return { sicher: false, ecken: ganz, quer: canvas.width > canvas.height, anteil: 1, grund: 'kein helles Blatt gefunden' };
    // Randpunkte der Fläche (nur die Kante, das reicht für die Hülle)
    const pts = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x; if (gf.lab[p] !== gf.n) continue;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || gf.lab[p - 1] !== gf.n || gf.lab[p + 1] !== gf.n || gf.lab[p - w] !== gf.n || gf.lab[p + w] !== gf.n) pts.push([x + 0.5, y + 0.5]);
    }
    const hu = huelle(pts); if (hu.length < 4) return { sicher: false, ecken: ganz, quer: canvas.width > canvas.height, anteil: 1, grund: 'Blattrand zu klein' };
    const { ecken, A } = vierEcken(hu);
    const anteil = gf.groesse / (w * h), fuellung = gf.groesse / Math.max(1, A);
    // Liegt das Blatt am ganzen Bildrand an, ist nichts zu schneiden
    const amRand = ecken.filter(p => p[0] < 2 || p[1] < 2 || p[0] > w - 2 || p[1] > h - 2).length;
    let sicher = true, grund = '';
    if (anteil < 0.15) { sicher = false; grund = 'Blatt zu klein im Bild'; }
    else if (fuellung < 0.85) { sicher = false; grund = 'Blattrand nicht eindeutig'; }
    else if (amRand >= 3) { sicher = false; grund = 'Blatt füllt schon das ganze Bild'; }
    const s = 1 / f;
    const e = sicher ? ecken.map(p => [p[0] * s, p[1] * s]) : ganz;
    const seite = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const breite = (seite(e[0], e[1]) + seite(e[3], e[2])) / 2, hoehe = (seite(e[0], e[3]) + seite(e[1], e[2])) / 2;
    return { sicher, ecken: e, quer: breite > hoehe, anteil, grund };
  }

  // Homographie: bildet die 4 Zielecken (Rechteck) auf die 4 Quellecken ab
  function homographie(von, nach) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = von[i], [u, v] = nach[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {   // Gauß mit Pivot
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) { if (r === c) continue; const k = A[r][c] / A[c][c]; for (let j = c; j < 8; j++) A[r][j] -= k * A[c][j]; b[r] -= k * b[c]; }
    }
    return b.map((v, i) => v / A[i][i]).concat(1);
  }

  /* Zieht das Blatt gerade auf A4. Ergebnis: Canvas in A4-Seitenverhältnis. */
  function entzerren(canvas, ecken, quer) {
    const W = Math.round((quer ? A4.h : A4.w) / 72 * DPI), H = Math.round((quer ? A4.w : A4.h) / 72 * DPI);
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const ox = out.getContext('2d');
    const src = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height); const sd = src.data, sw = canvas.width, sh = canvas.height;
    const ziel = ox.createImageData(W, H); const zd = ziel.data;
    const Hm = homographie([[0, 0], [W, 0], [W, H], [0, H]], ecken);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x + 0.5, py = y + 0.5; const n = Hm[6] * px + Hm[7] * py + Hm[8];
        let u = (Hm[0] * px + Hm[1] * py + Hm[2]) / n - 0.5, v = (Hm[3] * px + Hm[4] * py + Hm[5]) / n - 0.5;
        if (u < 0) u = 0; if (v < 0) v = 0; if (u > sw - 1) u = sw - 1; if (v > sh - 1) v = sh - 1;
        const x0 = u | 0, y0 = v | 0, x1 = Math.min(x0 + 1, sw - 1), y1 = Math.min(y0 + 1, sh - 1), fx = u - x0, fy = v - y0;
        const i00 = (y0 * sw + x0) * 4, i10 = (y0 * sw + x1) * 4, i01 = (y1 * sw + x0) * 4, i11 = (y1 * sw + x1) * 4, o = (y * W + x) * 4;
        for (let k = 0; k < 3; k++) zd[o + k] = (sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx) * (1 - fy) + (sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx) * fy;
        zd[o + 3] = 255;
      }
    }
    ox.putImageData(ziel, 0, 0);
    return out;
  }

  /* Legt ein Foto ohne Schnitt auf A4 (eingepasst, mittig, weißer Rand) —
     die Rückfalllinie, wenn das Blatt nicht sicher erkannt ist. */
  function aufA4(canvas) {
    const quer = canvas.width > canvas.height;
    const W = Math.round((quer ? A4.h : A4.w) / 72 * DPI), H = Math.round((quer ? A4.w : A4.h) / 72 * DPI);
    const out = document.createElement('canvas'); out.width = W; out.height = H; const x = out.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const f = Math.min(W / canvas.width, H / canvas.height); const w = canvas.width * f, h = canvas.height * f;
    x.drawImage(canvas, (W - w) / 2, (H - h) / 2, w, h);
    return out;
  }

  window.WFP = window.WFP || {};
  window.WFP.Blatt = { finden, entzerren, aufA4, A4, DPI };
})();
