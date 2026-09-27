/* Workfloh PDF — Spracheingabe mit Laufbalken (Klaus 2026-09-27).
   „Beim Einsprechen sollte wie bei dir und bei ChatGPT ein Laufbalken sein mit Pünktchen und
   senkrechten Strichen … und der Text wird gleich ausgegeben, so wie er eingesprochen wird."

   HOST-NEUTRAL: keine Abhängigkeit von der App. Wird byte-1:1 in die WorkFlohs kopiert
   (assets/wfpdf/sprechen.js) — nur hier ändern, dann dort neu kopieren.

   Was der Balken zeigt, und was NICHT:
   - Striche, solange die Spracherkennung Sprache hört und Text liefert; Pünktchen in den Pausen.
   - Er misst NICHT die Lautstärke am Mikrofon. Dafür bräuchte es einen zweiten Mikrofon-Zugriff
     (getUserMedia) neben der Spracherkennung, und auf Android greifen die beiden um dasselbe
     Mikrofon — die Erkennung bräche ab. Der Balken folgt deshalb dem, was die Erkennung meldet:
     Sprache erkannt (onspeechstart/-end) und neuer Text (onresult). Das ist die ehrliche Anzeige
     „es kommt etwas an", kein Pegel.
   - Die Aufnahme geht zur Erkennung an den Browser-Hersteller (Chrome: Google). Das sagt der Knopf.

   Nutzung:
     WFSprechen.anhaengen({ knopf, nach, sprache: () => 'de-DE',
       text(t, fertig) { … }, meldung(s) { … } })
   text() kommt bei JEDEM Zwischenstand (fertig=false) und einmal am Ende (fertig=true). */
(function (g) {
  'use strict';
  const SAEULEN = 40, TAKT = 110;          // 40 Stellen im Balken, alle 110 ms eine neue
  const STILLE_ENDE = 2600;                // so lange nach dem letzten Text ohne neue Sprache → fertig
  const NICHTS_ENDE = 8000;                // so lange ganz ohne Text → aufhören
  const STIL = `
.wfs-balken{display:flex;align-items:center;gap:10px;margin:6px 0 4px;padding:6px 8px 6px 12px;border-radius:22px;background:rgba(224,35,27,.07);border:1px solid rgba(224,35,27,.25)}
.wfs-balken[hidden]{display:none!important}
.wfs-status{font-size:.82rem;white-space:nowrap;color:#b3170f}
.wfs-spur{flex:1;display:flex;align-items:center;justify-content:flex-end;gap:2px;height:28px;overflow:hidden;min-width:0}
.wfs-spur i{flex:0 0 3px;display:block;border-radius:2px;background:#E0231B;transition:height .09s linear}
.wfs-spur i.pt{height:3px!important;opacity:.45}
.wfs-fertig{border:0;border-radius:16px;padding:6px 12px;background:#E0231B;color:#fff;font-weight:600;cursor:pointer;font-size:.85rem}
@media (prefers-reduced-motion:reduce){.wfs-spur i{transition:none}}`;
  let stilDa = false;
  function stilEinmal(doc) {
    if (stilDa || doc.getElementById('wfs-stil')) { stilDa = true; return; }
    const s = doc.createElement('style'); s.id = 'wfs-stil'; s.textContent = STIL; doc.head.appendChild(s); stilDa = true;
  }

  function fehlerText(e) {
    return e === 'not-allowed' || e === 'service-not-allowed' ? '🎤 Das Mikrofon ist für diese Seite nicht erlaubt.'
      : e === 'no-speech' ? '🎤 Nichts gehört — bitte näher am Gerät sprechen.'
      : e === 'network' ? '🎤 Die Spracherkennung braucht Internet und kam nicht durch.'
      : e === 'audio-capture' ? '🎤 Kein Mikrofon gefunden.'
      : '🎤 Mit dem Mikrofon ging es gerade nicht — bitte tippen.';
  }

  function anhaengen(opt) {
    const W = opt.fenster || g, doc = W.document, k = opt.knopf;
    if (!k) return null;
    const SR = W.SpeechRecognition || W.webkitSpeechRecognition;
    if (!SR) { k.disabled = true; k.title = 'Spracheingabe kann dieser Browser nicht — bitte tippen'; return null; }
    k.title = 'Sprechen statt tippen — die Aufnahme geht zur Erkennung an den Browser-Hersteller (Chrome: Google)';
    stilEinmal(doc);

    // Der Balken: Status · Spur · Fertig. Er steht unter dem Suchfeld und nur, solange zugehört wird.
    const balken = doc.createElement('div');
    balken.className = 'wfs-balken'; balken.hidden = true; balken.setAttribute('data-wfs', '');
    balken.setAttribute('role', 'status'); balken.setAttribute('aria-live', 'polite');
    balken.innerHTML = '<span class="wfs-status">🎤 Ich höre zu …</span><div class="wfs-spur" aria-hidden="true"></div><button type="button" class="wfs-fertig" title="Aufnahme beenden">Fertig</button>';
    const spur = balken.querySelector('.wfs-spur');
    for (let i = 0; i < SAEULEN; i++) { const s = doc.createElement('i'); s.className = 'pt'; spur.appendChild(s); }
    const nach = opt.nach || k.parentNode;
    nach.parentNode.insertBefore(balken, nach.nextSibling);

    let r = null, uhr = null, fertigTxt = '', zwischen = '', letzterText = 0, beginn = 0, spricht = false, staerke = 0, abgeschickt = false;
    const jetzt = () => (W.performance && W.performance.now ? W.performance.now() : Date.now());

    function saeule() {
      const t = jetzt(), seit = t - letzterText;
      let h = 0;                                     // 0 = Pünktchen
      if (letzterText && seit < 380) h = 0.3 + 0.7 * staerke;
      else if (spricht && seit < 1400) h = 0.22 + 0.1 * Math.random();
      staerke *= 0.82;
      const el = spur.firstElementChild; spur.appendChild(el);   // die Spur läuft nach links
      if (h > 0) { el.className = 'st'; el.style.height = Math.round(4 + 24 * Math.min(1, h * (0.75 + 0.25 * Math.random()))) + 'px'; }
      else { el.className = 'pt'; el.style.height = ''; }
      balken.dataset.striche = spur.querySelectorAll('i.st').length;
      // von selbst fertig: nach einer Pause, wenn schon Text da ist — oder wenn gar nichts kommt
      if (fertigTxt || zwischen) { if (!spricht && seit > STILLE_ENDE) stop(); }
      else if (t - beginn > NICHTS_ENDE) stop();
    }
    function textJetzt() { return (fertigTxt + ' ' + zwischen).replace(/\s+/g, ' ').trim(); }
    function aus() {
      if (uhr) W.clearInterval(uhr); uhr = null; r = null; spricht = false;
      balken.hidden = true; k.classList.remove('hoert'); k.setAttribute('aria-pressed', 'false');
      for (const el of spur.children) { el.className = 'pt'; el.style.height = ''; }
      balken.dataset.striche = 0;
      const t = textJetzt();
      if (t && !abgeschickt) { abgeschickt = true; opt.text && opt.text(t, true); }
    }
    function stop() { if (!r) return; try { r.stop(); } catch (_) { aus(); } }
    function start() {
      const rec = new SR();
      rec.lang = (opt.sprache && opt.sprache()) || 'de-DE';
      rec.interimResults = true; rec.continuous = true; rec.maxAlternatives = 1;
      fertigTxt = ''; zwischen = ''; letzterText = 0; staerke = 0; spricht = false; abgeschickt = false; beginn = jetzt();
      rec.onspeechstart = rec.onsoundstart = () => { spricht = true; };
      rec.onspeechend = rec.onsoundend = () => { spricht = false; };
      rec.onresult = ev => {
        const vorher = textJetzt().length;
        let z = '';
        for (let i = ev.resultIndex || 0; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) fertigTxt += ' ' + t; else z += ' ' + t;
        }
        zwischen = z;
        const neu = textJetzt();
        if (neu.length !== vorher) { staerke = Math.min(1, staerke + 0.4 + Math.abs(neu.length - vorher) / 14); letzterText = jetzt(); spricht = true; }
        if (neu && opt.text) opt.text(neu, false);
      };
      rec.onerror = ev => { const e = (ev && ev.error) || ''; if (e !== 'aborted' && !(e === 'no-speech' && textJetzt())) opt.meldung && opt.meldung(fehlerText(e)); };
      rec.onend = aus;
      try { rec.start(); } catch (_) { opt.meldung && opt.meldung(fehlerText('')); return; }
      r = rec;
      balken.hidden = false; k.classList.add('hoert'); k.setAttribute('aria-pressed', 'true');
      uhr = W.setInterval(saeule, TAKT);
    }
    k.onclick = () => { if (r) stop(); else start(); };
    balken.querySelector('.wfs-fertig').onclick = stop;
    return { balken, laeuft: () => !!r, stop };
  }

  g.WFSprechen = { anhaengen, fehlerText, SAEULEN, TAKT, STILLE_ENDE, NICHTS_ENDE };
})(typeof window !== 'undefined' ? window : globalThis);
