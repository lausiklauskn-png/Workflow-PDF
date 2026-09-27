/* Workfloh PDF — sichtbarer Schieberegler unter waagerecht rollenden Leisten (Klaus 2026-09-27).
   „noch einen Schieberegler. Und zwar so, dass man ihn anfassen kann mit einem Viereck oder wie
   auch immer, sodass man sieht, dass da ein Schieberegler ist. Bei kleineren Handys ist sonst nicht
   zu erkennen, dass da noch mehr folgt."

   HOST-NEUTRAL: keine Abhängigkeit von der App. Wird byte-1:1 in die WorkFlohs kopiert
   (assets/wfpdf/schieber.js) — nur hier ändern, dann dort neu kopieren.

   Was er tut:
   - Unter die Leiste kommt eine Schiene mit einem GRIFF (Viereck mit drei Rillen). Der Griff ist so
     breit, wie viel von der Leiste zu sehen ist, und steht dort, wo man gerade ist.
   - Griff ziehen rollt die Leiste; auf die Schiene tippen springt dorthin. Die Leiste selbst lässt
     sich weiter mit dem Finger wischen — der Griff läuft mit.
   - Passt alles hinein, ist die Schiene WEG (hidden). Ein Griff, der nichts bewegt, wäre ein toter Knopf.
   - Die dünne Bildlaufleiste des Browsers wird an der Leiste ausgeblendet — zwei Anzeigen für
     dieselbe Sache wären eine zu viel.

   Nutzung:
     WFSchieber.an(leiste)                     eine Leiste
     WFSchieber.beobachte(wurzel, 'selektor')  alle passenden Leisten, auch später neu gezeichnete
   Farbe: CSS-Variable --wfsch (sonst --accent, sonst --rot, sonst Rot). */
(function (g) {
  'use strict';
  const GRIFF_MIN = 44;                     // so breit mindestens — ein Finger muss ihn treffen
  const STIL = `
.wfsch-leiste{scrollbar-width:none}
.wfsch-leiste::-webkit-scrollbar{display:none}
.wfsch{position:relative;flex:0 0 100%;width:100%;box-sizing:border-box;height:22px;margin:2px 0 4px;touch-action:none;cursor:pointer;user-select:none;-webkit-user-select:none}
.wfsch[hidden]{display:none!important}
.wfsch-schiene{position:absolute;left:0;right:0;top:8px;height:6px;border-radius:3px;background:rgba(127,127,127,.22)}
.wfsch-griff{position:absolute;top:1px;height:20px;border-radius:7px;box-sizing:border-box;
  background:var(--wfsch,var(--accent,var(--rot,#E0231B)));box-shadow:0 1px 4px rgba(0,0,0,.28),inset 0 1px 0 rgba(255,255,255,.35);
  display:flex;align-items:center;justify-content:center;gap:3px;cursor:grab;touch-action:none}
.wfsch-griff i{display:block;width:2px;height:10px;border-radius:1px;background:rgba(255,255,255,.85)}
.wfsch.zieht .wfsch-griff{cursor:grabbing;filter:brightness(1.08)}`;
  function stilEinmal(doc) {
    if (doc.getElementById('wfsch-stil')) return;
    const s = doc.createElement('style'); s.id = 'wfsch-stil'; s.textContent = STIL; doc.head.appendChild(s);
  }

  function an(leiste) {
    if (!leiste || leiste._wfsch) return leiste && leiste._wfsch;
    const doc = leiste.ownerDocument; stilEinmal(doc);
    leiste.classList.add('wfsch-leiste');
    const bahn = doc.createElement('div'); bahn.className = 'wfsch'; bahn.hidden = true;
    bahn.setAttribute('role', 'scrollbar'); bahn.setAttribute('aria-orientation', 'horizontal');
    bahn.setAttribute('aria-label', 'Leiste verschieben — es folgen weitere Knöpfe');
    bahn.innerHTML = '<div class="wfsch-schiene"></div><div class="wfsch-griff"><i></i><i></i><i></i></div>';
    leiste.insertAdjacentElement('afterend', bahn);
    const griff = bahn.lastChild;

    const mass = () => {
      const voll = leiste.scrollWidth, sicht = leiste.clientWidth, breit = bahn.clientWidth;
      const weg = voll - sicht;
      return { weg, breit, gw: Math.max(GRIFF_MIN, Math.min(breit, breit * sicht / Math.max(1, voll))) };
    };
    const zeichne = () => {
      if (!leiste.isConnected) { stop(); return; }
      const ueber = leiste.scrollWidth - leiste.clientWidth > 1;
      if (bahn.hidden === ueber) bahn.hidden = !ueber;
      if (!ueber) return;
      const m = mass(); const anteil = m.weg > 0 ? leiste.scrollLeft / m.weg : 0;
      griff.style.width = m.gw + 'px';
      griff.style.left = Math.round((m.breit - m.gw) * Math.min(1, Math.max(0, anteil))) + 'px';
      bahn.setAttribute('aria-valuenow', String(Math.round(anteil * 100)));
    };
    const rolleAuf = (x) => {                                   // x = linke Kante des Griffs in der Bahn
      const m = mass(); const frei = m.breit - m.gw;
      leiste.scrollLeft = frei > 0 ? Math.min(1, Math.max(0, x / frei)) * m.weg : 0;
      zeichne();
    };

    let fass = null;                                            // Abstand Finger ↔ linke Griffkante
    bahn.addEventListener('pointerdown', (e) => {
      if (bahn.hidden) return;
      e.preventDefault();
      const r = bahn.getBoundingClientRect(), gl = griff.offsetLeft, gw = griff.offsetWidth;
      const x = e.clientX - r.left;
      fass = (x >= gl && x <= gl + gw) ? x - gl : gw / 2;      // daneben getippt: Griff mittig unter den Finger
      rolleAuf(x - fass);
      try { bahn.setPointerCapture(e.pointerId); } catch (_) {}
      bahn.classList.add('zieht');
    });
    bahn.addEventListener('pointermove', (e) => {
      if (fass === null) return;
      rolleAuf(e.clientX - bahn.getBoundingClientRect().left - fass);
    });
    const los = () => { fass = null; bahn.classList.remove('zieht'); };
    bahn.addEventListener('pointerup', los); bahn.addEventListener('pointercancel', los);

    leiste.addEventListener('scroll', zeichne, { passive: true });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(zeichne) : null;
    if (ro) { ro.observe(leiste); ro.observe(bahn); }
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(zeichne) : null;
    if (mo) mo.observe(leiste, { childList: true, subtree: true, characterData: true });
    const win = doc.defaultView; if (win) win.addEventListener('resize', zeichne);
    function stop() { if (ro) ro.disconnect(); if (mo) mo.disconnect(); if (win) win.removeEventListener('resize', zeichne); if (bahn.isConnected) bahn.remove(); }

    leiste._wfsch = { bahn, griff, zeichne, stop };
    zeichne(); (win && win.requestAnimationFrame ? win.requestAnimationFrame(zeichne) : setTimeout(zeichne, 16));
    return leiste._wfsch;
  }

  function beobachte(wurzel, selektor) {
    if (!wurzel) return;
    const suche = () => wurzel.querySelectorAll(selektor).forEach(el => { if (!el._wfsch) an(el); });
    suche();
    if (typeof MutationObserver === 'function') new MutationObserver(suche).observe(wurzel, { childList: true, subtree: true });
  }

  g.WFSchieber = { an, beobachte, GRIFF_MIN };
})(typeof window !== 'undefined' ? window : globalThis);
