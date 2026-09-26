/* Workfloh PDF — Felderkennung.
   Drei Quellen, und jede liefert nur VORSCHLÄGE, die der Nutzer prüft:
   1. vorhandene Formularfelder im PDF (pdf.js-Annotationen) — die sind echt
   2. Linien-Erkennung offline: Unterstriche, Eingabe-Rahmen, Kästchen im Seitenbild
   3. KI (BYOK, nur nach Bestätigung): Seitenbild an den gewählten Anbieter
   Die KI trifft Koordinaten nur ungefähr. Deshalb rasten KI-Felder an erkannte
   Linien und Kästchen ein, wo welche in der Nähe liegen.
   Alle Koordinaten in Prozent der angezeigten Seite (0..100, y nach unten). */
(function () {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---------- 2. Linien-Erkennung (offline) ---------- */
  function linienErkennung(imgData) {
    const W = imgData.width, H = imgData.height, px = imgData.data;
    const dark = new Uint8Array(W * H);
    for (let i = 0, j = 0; i < dark.length; i++, j += 4) {
      const a = px[j + 3];
      const l = a < 20 ? 255 : (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114);
      dark[i] = l < 150 ? 1 : 0;
    }
    // a) waagerechte Läufe
    const minRun = Math.round(W * 0.05), maxRun = Math.round(W * 0.88);
    const runs = [];
    for (let y = 0; y < H; y++) {
      let x = 0; const row = y * W;
      while (x < W) {
        if (!dark[row + x]) { x++; continue; }
        const x0 = x; while (x < W && dark[row + x]) x++;
        // kleine Lücken (≤2 px, z. B. gestrichelte Scan-Linien) überbrücken
        while (x < W - 3 && !dark[row + x] && (dark[row + x + 1] || dark[row + x + 2])) { x++; while (x < W && dark[row + x]) x++; }
        const len = x - x0;
        if (len >= minRun) runs.push({ y, x0, x1: x });
      }
    }
    // b) übereinanderliegende Läufe zu Linien bündeln
    const lines = [];
    const offen = [];
    for (const r of runs) {
      let hit = null;
      for (const L of offen) {
        if (r.y - L.y1 <= 1) {
          const ov = Math.min(L.x1, r.x1) - Math.max(L.x0, r.x0);
          if (ov > 0.8 * Math.min(L.x1 - L.x0, r.x1 - r.x0)) { hit = L; break; }
        }
      }
      if (hit) { hit.y1 = r.y; hit.x0 = Math.min(hit.x0, r.x0); hit.x1 = Math.max(hit.x1, r.x1); }
      else { const L = { y0: r.y, y1: r.y, x0: r.x0, x1: r.x1 }; offen.push(L); lines.push(L); }
      for (let i = offen.length - 1; i >= 0; i--) if (r.y - offen[i].y1 > 1) offen.splice(i, 1);
    }
    const dick = Math.max(6, Math.round(W * 0.005));
    const echte = lines.filter(L => (L.y1 - L.y0 + 1) <= dick && (L.x1 - L.x0) <= maxRun);
    echte.sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0);

    const felder = [];
    const benutzt = new Set();
    // c) Rahmen: zwei Linien gleicher Breite, dazwischen ein Eingabebereich
    for (let i = 0; i < echte.length; i++) {
      if (benutzt.has(i)) continue;
      const A = echte[i];
      for (let j = i + 1; j < echte.length; j++) {
        if (benutzt.has(j)) continue;
        const B = echte[j];
        const gap = B.y0 - A.y1;
        if (gap > W * 0.3) break;
        if (gap < W * 0.012) continue;
        if (Math.abs(A.x0 - B.x0) < W * 0.012 && Math.abs(A.x1 - B.x1) < W * 0.012) {
          // senkrechte Kanten prüfen: links und rechts muss es dunkel sein
          const kante = (x) => { let n = 0; for (let y = A.y1 + 1; y < B.y0; y++) { let d = 0; for (let k = -2; k <= 2; k++) { const xx = x + k; if (xx >= 0 && xx < W && dark[y * W + xx]) d = 1; } n += d; } return n / Math.max(1, B.y0 - A.y1 - 1); };
          if (kante(A.x0) > 0.7 && kante(A.x1 - 1) > 0.7) {
            benutzt.add(i); benutzt.add(j);
            felder.push({ type: 'text', x: (A.x0 + 3) / W * 100, y: (A.y1 + 2) / H * 100, w: (A.x1 - A.x0 - 6) / W * 100, h: (gap - 3) / H * 100, quelle: 'rahmen' });
            break;
          }
        }
      }
    }
    // d) Unterstriche: Feld darüber
    const hDef = 2.0, hMin = 1.1, hMax = 2.6;
    for (let i = 0; i < echte.length; i++) {
      if (benutzt.has(i)) continue;
      const L = echte[i];
      let h = hDef;
      for (let j = i - 1; j >= 0; j--) {          // nächste Linie darüber, die sich überlappt
        const P = echte[j];
        const ov = Math.min(L.x1, P.x1) - Math.max(L.x0, P.x0);
        if (ov > 0 && P.y1 < L.y0) { h = clamp((L.y0 - P.y1) / H * 100 - 0.4, hMin, hMax); break; }
      }
      felder.push({ type: 'text', x: L.x0 / W * 100, y: L.y0 / H * 100 - h, w: (L.x1 - L.x0) / W * 100, h, quelle: 'linie', linie: L.y0 / H * 100 });
    }
    // e) Kästchen über Zusammenhangs-Komponenten
    felder.push(...kaestchen(dark, W, H));
    // f) grau hinterlegte Eingabeflächen (viele Behörden- und Kanzlei-Formulare
    //    zeichnen keine Linie, sondern eine hellgraue Fläche — Befund Klaus 2026-09-25)
    const fl = flaechen(px, W, H);
    // Eine Linie am Rand einer Fläche ist deren Kante, kein eigenes Feld
    const innerhalb = (f, g) => f.x >= g.x - 1 && f.x + f.w <= g.x + g.w + 1 && f.y + f.h >= g.y - 1.2 && f.y <= g.y + g.h + 1.2;
    const rest = felder.filter(f => !fl.some(g => innerhalb(f, g) && (f.type !== 'check' || g.type === 'check')));
    const alle = rest.concat(fl).filter(f => f.w > 0.5 && f.h > 0.3 && f.y >= 0);
    // Ein Rahmen, in dem schon zwei oder mehr Felder liegen, ist ein Kasten UM Felder
    // (z. B. „Nur von der Behörde auszufüllen") — kein eigenes Eingabefeld. Sonst las die
    // App seine Beschriftungen als Inhalt und legte sie doppelt über die echten Felder
    // (Befund Klaus 2026-09-26).
    const drin = (g, f) => g.x >= f.x - 0.5 && g.x + g.w <= f.x + f.w + 0.5 && g.y >= f.y - 0.5 && g.y + g.h <= f.y + f.h + 0.5;
    return alle.filter(f => f.type === 'check' || alle.filter(g => g !== f && g.type !== 'check' && drin(g, f)).length < 2);
  }

  /* Hellgraue, fast gleichmäßig gefüllte Rechtecke. Gesucht wird über
     Zusammenhangs-Komponenten auf einer Grau-Maske; dunkle Schrift in der
     Fläche (ausgefüllte Formulare) zählt mit, damit sie die Fläche nicht zerteilt. */
  function flaechen(px, W, H) {
    const N = W * H, art = new Uint8Array(N);   // 1 = grau, 2 = dunkel
    for (let i = 0, j = 0; i < N; i++, j += 4) {
      const r = px[j], g = px[j + 1], b = px[j + 2];
      const l = r * 0.299 + g * 0.587 + b * 0.114, sat = Math.max(r, g, b) - Math.min(r, g, b);
      art[i] = l < 150 ? 2 : (l >= 170 && l <= 247 && sat < 40) ? 1 : 0;
    }
    const seen = new Uint8Array(N), out = [];
    const stack = new Int32Array(Math.min(N, 4e6));
    for (let start = 0; start < N; start++) {
      if (art[start] !== 1 || seen[start]) continue;
      let sp = 0; stack[sp++] = start; seen[start] = 1;
      let minx = W, maxx = 0, miny = H, maxy = 0, grau = 0;
      while (sp > 0) {
        const p = stack[--sp]; const x = p % W, y = (p - x) / W;
        if (art[p] === 1) grau++;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        for (let k = 0; k < 4; k++) {
          const q = k === 0 ? (x > 0 ? p - 1 : -1) : k === 1 ? (x < W - 1 ? p + 1 : -1) : k === 2 ? p - W : p + W;
          if (q < 0 || q >= N || seen[q]) continue;
          // dunkle Punkte nur mitnehmen, wenn sie an Grau grenzen (Schrift IN der Fläche)
          if (art[q] === 1 || (art[q] === 2 && art[p] === 1)) { seen[q] = 1; if (sp < stack.length) stack[sp++] = q; }
        }
      }
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (bw > W * 0.95 || bh > H * 0.4) continue;                 // Seitenhintergrund, Fotos
      if (bh < H * 0.006 || bw < W * 0.012) continue;
      if (grau / (bw * bh) < 0.6) continue;                         // keine gefüllte Fläche
      // Füllgrad prüfen: innen muss es überwiegend grau sein (kein grauer Rahmen)
      let g2 = 0, t2 = 0;
      for (let y = miny + Math.floor(bh * 0.25); y <= maxy - Math.floor(bh * 0.25); y += 2)
        for (let x = minx + Math.floor(bw * 0.1); x <= maxx - Math.floor(bw * 0.1); x += 2) { t2++; if (art[y * W + x]) g2++; }
      if (t2 && g2 / t2 < 0.8) continue;
      const ar = bw / bh, quadr = ar > 0.7 && ar < 1.45 && bw < W * 0.05;
      if (!quadr && bw < W * 0.04) continue;
      out.push({ type: quadr ? 'check' : 'text', x: minx / W * 100, y: miny / H * 100, w: bw / W * 100, h: bh / H * 100, quelle: 'flaeche' });
    }
    return out;
  }

  function kaestchen(dark, W, H) {
    const seen = new Uint8Array(W * H);
    const out = [];
    const sMin = Math.max(6, Math.round(W * 0.008)), sMax = Math.round(W * 0.036);
    const stack = new Int32Array(W * H > 4e6 ? 4e6 : W * H);
    for (let start = 0; start < dark.length; start++) {
      if (!dark[start] || seen[start]) continue;
      let sp = 0; stack[sp++] = start; seen[start] = 1;
      let minx = W, maxx = 0, miny = H, maxy = 0, n = 0, zuGross = false;
      while (sp > 0) {
        const p = stack[--sp]; n++;
        const x = p % W, y = (p - x) / W;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (maxx - minx > sMax * 1.5 || maxy - miny > sMax * 1.5) zuGross = true;
        const nb = [p - 1, p + 1, p - W, p + W];
        for (let k = 0; k < 4; k++) {
          const q = nb[k];
          if (q < 0 || q >= dark.length) continue;
          if (k === 0 && x === 0) continue; if (k === 1 && x === W - 1) continue;
          if (dark[q] && !seen[q]) { seen[q] = 1; if (sp < stack.length) stack[sp++] = q; }
        }
      }
      if (zuGross) continue;
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (bw < sMin || bh < sMin || bw > sMax || bh > sMax) continue;
      const ar = bw / bh; if (ar < 0.75 || ar > 1.33) continue;
      const kante = (x0, y0, x1, y1) => {       // Anteil dunkler Punkte entlang einer Kante (±1 px)
        let d = 0, t = 0;
        if (y0 === y1) { for (let x = x0; x <= x1; x++) { t++; if (dark[y0 * W + x] || dark[Math.min(H - 1, y0 + (y0 === miny ? 1 : -1)) * W + x]) d++; } }
        else { for (let y = y0; y <= y1; y++) { t++; if (dark[y * W + x0] || dark[y * W + Math.min(W - 1, Math.max(0, x0 + (x0 === minx ? 1 : -1)))]) d++; } }
        return d / t;
      };
      if (kante(minx, miny, maxx, miny) < 0.8 || kante(minx, maxy, maxx, maxy) < 0.8) continue;
      if (kante(minx, miny, minx, maxy) < 0.8 || kante(maxx, miny, maxx, maxy) < 0.8) continue;
      let innen = 0, it = 0;
      const ix0 = minx + Math.ceil(bw * 0.3), ix1 = maxx - Math.ceil(bw * 0.3), iy0 = miny + Math.ceil(bh * 0.3), iy1 = maxy - Math.ceil(bh * 0.3);
      for (let y = iy0; y <= iy1; y++) for (let x = ix0; x <= ix1; x++) { it++; if (dark[y * W + x]) innen++; }
      if (it && innen / it > 0.2) continue;
      out.push({ type: 'check', x: minx / W * 100, y: miny / H * 100, w: bw / W * 100, h: bh / H * 100, quelle: 'kaestchen' });
    }
    return out;
  }

  /* ---------- Beschriftung aus der Textebene (nur digitale PDFs) ---------- */
  function beschrifte(felder, textItems) {
    if (!textItems || !textItems.length) return;
    for (const f of felder) {
      if (f.label) continue;
      const cy = f.y + f.h / 2;
      let best = null, bd = 1e9;
      for (const t of textItems) {
        const s = (t.str || '').trim(); if (!s || /^[_.\s…-]+$/.test(s)) continue;
        const tcy = t.y + t.h / 2;
        if (Math.abs(tcy - cy) < Math.max(1.4, f.h * 0.7) && t.x + t.w <= f.x + 1.5) {
          const d = f.x - (t.x + t.w); if (d < 28 && d < bd) { bd = d; best = s; }
        }
      }
      if (!best) {
        for (const t of textItems) {
          const s = (t.str || '').trim(); if (!s || /^[_.\s…-]+$/.test(s)) continue;
          const ov = Math.min(f.x + f.w, t.x + t.w) - Math.max(f.x, t.x);
          const d = f.y - (t.y + t.h);
          if (ov > 0 && d >= -0.3 && d < 3 && d < bd) { bd = d; best = s; }
        }
      }
      if (best && f.type === 'check' && best.replace(/[^A-Za-zÄÖÜäöüß]/g, '').length <= 5) {
        // „Ja" / „Nein" allein sagt nichts: die Frage links in derselben Zeile davorsetzen
        const cy2 = f.y + f.h / 2; let frage = null, fx = -1;
        for (const t of textItems) {
          const q = (t.str || '').trim(); if (!/[?:]$/.test(q) || q.length < 4) continue;
          if (Math.abs(t.y + t.h / 2 - cy2) < Math.max(1.4, f.h * 0.8) && t.x + t.w < f.x && t.x > fx) { fx = t.x; frage = q; }
        }
        if (frage) best = frage.replace(/[?:\s]+$/, '') + ': ' + best;
      }
      if (best) f.label = best.replace(/[_.:…\s]+$/, '').slice(0, 60);
    }
  }

  /* ---------- 3. KI ---------- */
  const ANBIETER = {
    mistral: { label: 'Mistral (EU · Paris)', region: 'EU', kind: 'openai', base: 'https://api.mistral.ai/v1', modell: 'pixtral-large-latest', konsole: 'https://console.mistral.ai/api-keys' },
    anthropic: { label: 'Anthropic (Claude · USA)', region: 'USA', kind: 'anthropic', base: 'https://api.anthropic.com/v1/messages', modell: 'claude-sonnet-5', konsole: 'https://console.anthropic.com/settings/keys' },
    openai: { label: 'OpenAI (USA)', region: 'USA', kind: 'openai', base: 'https://api.openai.com/v1', modell: 'gpt-4o', konsole: 'https://platform.openai.com/api-keys' }
  };

  const PROMPT = 'Du siehst eine Seite eines Formulars oder Dokuments. Finde jede Stelle, an der jemand etwas eintragen, ankreuzen oder unterschreiben soll. '
    + 'Gib den EINGABEBEREICH an (die Linie, das leere Kästchen, den leeren Rahmen), NICHT die Beschriftung daneben. '
    + 'Antworte AUSSCHLIESSLICH mit JSON in genau dieser Form, ohne weiteren Text: '
    + '{"text":"der gesamte gedruckte Text der Seite","felder":[{"typ":"text|datum|kaestchen|email|internetadresse|unterschrift","bezeichnung":"kurze Beschriftung aus dem Formular","x":0,"y":0,"b":0,"h":0}]} '
    + 'x und y sind die linke obere Ecke des Eingabebereichs in Prozent der Bildbreite bzw. Bildhöhe (0 bis 100), b und h Breite und Höhe in Prozent. '
    + 'Ein Textfeld auf einer Linie reicht von der Linie etwa 2 Prozent nach oben. Erfinde keine Felder, wo kein Eingabebereich sichtbar ist, und trage niemals gedruckte Inhalte als Feldwert ein. Gibt es keine Felder, ist die Liste leer.';

  /* Kandidaten nummeriert ins Bild zeichnen: die KI muss dann nur noch sagen,
     WAS an Stelle 3 hingehört — die Position kommt aus dem Bild selbst. Das ist
     genauer, als die KI Koordinaten schätzen zu lassen (Befund Klaus 2026-09-25:
     „setzt sie alle auf den Haufen"). */
  function markiertesBild(canvas, kand) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d'); x.drawImage(canvas, 0, 0);
    const W = c.width, H = c.height, fs = Math.max(12, Math.round(W / 90));
    x.font = 'bold ' + fs + 'px sans-serif'; x.textBaseline = 'top';
    kand.forEach((k, i) => {
      const bx = k.x / 100 * W, by = k.y / 100 * H, bw = k.w / 100 * W, bh = k.h / 100 * H;
      x.strokeStyle = '#e0231b'; x.lineWidth = 2; x.strokeRect(bx, by, bw, bh);
      const t = String(i + 1), tw = x.measureText(t).width + 6;
      x.fillStyle = '#e0231b'; x.fillRect(bx, by, tw, fs + 4); x.fillStyle = '#fff'; x.fillText(t, bx + 3, by + 2);
    });
    return c.toDataURL('image/jpeg', 0.85);
  }
  function promptMitKandidaten(kand) {
    if (!kand.length) return PROMPT;
    return 'Du siehst eine Seite eines Formulars. Rot umrandet und nummeriert sind Stellen, die eine Bilderkennung als mögliche Eingabefelder gefunden hat (' + kand.length + ' Stück). '
      + 'Aufgabe: 1) Sage für JEDE Nummer, ob dort wirklich etwas eingetragen oder angekreuzt wird, und wenn ja, welche Beschriftung aus dem Formular dazugehört und welche Art es ist. '
      + 'Bei Ja/Nein-Kästchen nenne die Frage mit, z. B. "Unfallzeugen: Ja". '
      + '2) Liste zusätzlich Eingabestellen, die NICHT rot markiert sind (die Koordinaten müssen die Eingabefläche selbst treffen, z. B. die graue Fläche oder den Platz über der Linie — NIE die gedruckte Beschriftung daneben oder darüber), mit Koordinaten in Prozent der Bildbreite und -höhe (0 bis 100, linke obere Ecke). '
      + 'Antworte AUSSCHLIESSLICH mit JSON in dieser Form: '
      + '{"text":"der gesamte gedruckte Text der Seite","felder":[{"nr":1,"typ":"text|datum|kaestchen|email|internetadresse|unterschrift","bezeichnung":"...","inhalt":""}],"keinFeld":[5],"zusaetzlich":[{"typ":"text","bezeichnung":"...","x":0,"y":0,"b":0,"h":0}]} '
      + 'Steht in einem Eingabefeld bereits etwas (ausgefüllt, gestempelt, angekreuzt), gib es unter "inhalt" wortgetreu wieder (bei Kästchen true/false); die Beschriftung des Feldes gehört NICHT in "inhalt".';
  }

  async function fehlerText(resp) {
    let t = ''; try { t = await resp.text(); } catch (_) {}
    let m = t; try { const j = JSON.parse(t); m = (j.error && (j.error.message || j.error.type)) || j.message || t; } catch (_) {}
    if (resp.status === 401) return 'Schlüssel ungültig (401). ' + String(m).slice(0, 160);
    if (resp.status === 429) return 'Zu viele Anfragen oder Kontingent erschöpft (429). ' + String(m).slice(0, 160);
    return 'Fehler ' + resp.status + ': ' + String(m).slice(0, 220);
  }

  async function kiAnfrage(cfg, bildDataUrl, prompt) {
    prompt = prompt || PROMPT;
    const a = ANBIETER[cfg.anbieter]; if (!a) throw new Error('Unbekannter KI-Anbieter');
    const key = (cfg.schluessel || '').trim(); if (!key) throw new Error('Kein Schlüssel für ' + a.label + ' hinterlegt');
    const modell = (cfg.modell || '').trim() || a.modell;
    if (a.kind === 'anthropic') {
      const b64 = bildDataUrl.split(',')[1];
      const resp = await fetch(a.base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: modell, max_tokens: 12000, messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } }, { type: 'text', text: prompt }] }] }) });
      if (!resp.ok) throw new Error(await fehlerText(resp));
      const j = await resp.json(); return (j.content || []).map(c => c.text || '').join('');
    }
    const resp = await fetch(a.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: modell, max_tokens: 12000, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: bildDataUrl } }] }] }) });
    if (!resp.ok) throw new Error(await fehlerText(resp));
    const j = await resp.json(); return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  }

  /* Kurzer Verbindungstest (Text, wenige Token) — sagt, ob Schlüssel und Modell angenommen werden. */
  async function kiTest(cfg) {
    const a = ANBIETER[cfg.anbieter]; const key = (cfg.schluessel || '').trim();
    if (!key) throw new Error('Kein Schlüssel eingetragen');
    const modell = (cfg.modell || '').trim() || a.modell;
    if (a.kind === 'anthropic') {
      const r = await fetch(a.base, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model: modell, max_tokens: 10, messages: [{ role: 'user', content: 'Antworte nur mit: OK' }] }) });
      if (!r.ok) throw new Error(await fehlerText(r)); return modell;
    }
    const r = await fetch(a.base + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: modell, max_tokens: 10, messages: [{ role: 'user', content: 'Antworte nur mit: OK' }] }) });
    if (!r.ok) throw new Error(await fehlerText(r)); return modell;
  }

  function kiAuswerten(text, bild) {
    const s = String(text || '');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error('Die KI hat kein lesbares Ergebnis geliefert.');
    let j; try { j = JSON.parse(s.slice(a, b + 1)); } catch (e) { throw new Error('Die KI-Antwort war kein gültiges JSON.'); }
    const arr = (Array.isArray(j) ? j : (j.felder || j.fields || [])).concat(Array.isArray(j.zusaetzlich) ? j.zusaetzlich : []);
    // Einheit der Koordinaten: Prozent wie verlangt — manche Modelle liefern aber
    // Pixel des Bildes oder Promille. Einmal für die ganze Antwort entscheiden.
    let maxX = 0, maxY = 0;
    for (const f of arr) { const w = +(f.b ?? f.w ?? f.breite) || 0, h = +(f.h ?? f.hoehe) || 0; if (Number.isFinite(+f.x)) maxX = Math.max(maxX, +f.x + w); if (Number.isFinite(+f.y)) maxY = Math.max(maxY, +f.y + h); }
    let fx = 1, fy = 1;
    if (maxX > 101 || maxY > 101) {
      const passtInsBild = bild && maxX <= bild.w * 1.02 && maxY <= bild.h * 1.02;
      if (passtInsBild && (maxX > 1001 || maxY > 1001 || Math.max(bild.w, bild.h) <= 1001)) { fx = 100 / bild.w; fy = 100 / bild.h; }   // Pixel
      else { fx = fy = 0.1; }                                                                                                          // Promille
    }
    const typ = t => { t = String(t || '').toLowerCase(); if (/kaest|kästch|check|box|kreuz/.test(t)) return 'check'; if (/datum|date/.test(t)) return 'datum'; if (/unterschr|sign/.test(t)) return 'unterschrift'; if (/mail/.test(t)) return 'email'; if (/internet|url|web|link/.test(t)) return 'url'; return 'text'; };
    const out = [];
    for (const f of arr) {
      const t0 = typ(f.typ || f.type), lab0 = String(f.bezeichnung || f.label || '').trim().slice(0, 60);
      const nr = parseInt(f.nr, 10);
      const inh = f.inhalt == null ? '' : (typeof f.inhalt === 'boolean' ? f.inhalt : String(f.inhalt).trim().slice(0, 2000));
      if (Number.isFinite(nr) && nr > 0) { out.push({ nr, type: t0, label: lab0 || (/unterschrift|sign/i.test(String(f.typ)) ? 'Unterschrift' : ''), inhalt: inh, quelle: 'ki' }); continue; }
      let x = +f.x * fx, y = +f.y * fy, w = +(f.b ?? f.w ?? f.breite) * fx, h = +(f.h ?? f.hoehe) * fy;
      if (![x, y, w, h].every(Number.isFinite)) continue;
      if (x <= 1 && y <= 1 && w <= 1 && h <= 1) { x *= 100; y *= 100; w *= 100; h *= 100; }   // Anteile statt Prozent
      x = clamp(x, 0, 99); y = clamp(y, 0, 99); w = clamp(w, 0.8, 100 - x); h = clamp(h, 0.6, 100 - y);
      const t = typ(f.typ || f.type);
      const lab = String(f.bezeichnung || f.label || '').trim().slice(0, 60);
      out.push({ type: t, x, y, w, h, label: lab || (/unterschrift|sign/i.test(String(f.typ)) ? 'Unterschrift' : ''), inhalt: inh, quelle: 'ki' });
    }
    const kein = (Array.isArray(j.keinFeld) ? j.keinFeld : []).map(n => parseInt(n, 10)).filter(Number.isFinite);
    return { felder: out, kein, text: typeof j.text === 'string' ? j.text.slice(0, 40000) : '' };
  }

  /* KI-Felder an erkannte Linien/Kästchen einrasten; übrige Linienfelder dazulegen. */
  function zusammenfuehren(ki, linien, kein) {
    // Nummerierte Antworten übernehmen die Lage des Kandidaten
    const kand = linien.slice(), weg = new Set();
    (kein || []).forEach(n => { if (kand[n - 1]) weg.add(kand[n - 1]); });
    const benannt = [];
    for (const k of ki.filter(k => k.nr)) {
      const c = kand[k.nr - 1]; if (!c || weg.has(c) || benannt.some(b => b.q === c)) continue;
      benannt.push({ q: c, f: Object.assign({}, c, { type: c.type === 'check' ? 'check' : k.type === 'check' ? 'text' : k.type, label: k.label || c.label, inhalt: k.inhalt, quelle: 'ki', eingerastet: true }) });
    }
    ki = ki.filter(k => !k.nr).concat(benannt.map(b => b.f));
    linien = linien.filter(l => !weg.has(l) && !benannt.some(b => b.q === l));
    const frei = linien.slice();
    const nimm = f => { const i = frei.indexOf(f); if (i >= 0) frei.splice(i, 1); };
    for (const k of ki) {
      if (k.type === 'check') {
        let best = null, bd = 3;
        for (const l of frei) { if (l.type !== 'check') continue; const d = Math.hypot((l.x + l.w / 2) - (k.x + k.w / 2), (l.y + l.h / 2) - (k.y + k.h / 2)); if (d < bd) { bd = d; best = l; } }
        if (best) { Object.assign(k, { x: best.x, y: best.y, w: best.w, h: best.h, eingerastet: true }); nimm(best); }
        continue;
      }
      let best = null, bd = 3.2;
      for (const l of frei) {
        if (l.type === 'check') continue;
        const ov = Math.min(k.x + k.w, l.x + l.w) - Math.max(k.x, l.x);
        if (ov < 0.4 * Math.min(k.w, l.w)) continue;
        const d = Math.abs((k.y + k.h) - (l.y + l.h));
        if (d < bd) { bd = d; best = l; }
      }
      if (best) { Object.assign(k, { x: best.x, y: best.y, w: best.w, h: best.h, eingerastet: true }); nimm(best); }
    }
    const iou = (a, b) => { const ix = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)), iy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)); const i = ix * iy; return i / (a.w * a.h + b.w * b.h - i || 1); };
    const rest = frei.filter(l => !ki.some(k => iou(k, l) > 0.15));
    return ki.concat(rest);
  }

  window.WFP = window.WFP || {};
  window.WFP.Erkennung = { linienErkennung, beschrifte, ANBIETER, kiAnfrage, kiAuswerten, kiTest, zusammenfuehren, markiertesBild, promptMitKandidaten, PROMPT };
})();
