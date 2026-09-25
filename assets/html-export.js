/* Workfloh PDF — Ausgabe als HTML zum Ausfüllen im Browser.
   Jede Seite wird als Bild eingebettet, die Felder liegen als echte Eingabefelder
   darüber (in Prozent, wie im Editor). Die Datei ist eigenständig: kein Netz, keine
   App nötig. Im Browser: ausfüllen → „Als PDF speichern" (Druckdialog) oder
   „Ausgefüllt speichern" (dieselbe HTML-Datei mit den Einträgen). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  async function htmlFormular(doc, bytes) {
    const pdf = await pdfjsLib.getDocument({ data: bytes.slice(0) }).promise;
    const seiten = [];
    for (let i = 0; i < pdf.numPages; i++) {
      const p = await pdf.getPage(i + 1); const v1 = p.getViewport({ scale: 1 });
      const vp = p.getViewport({ scale: 1600 / v1.width });
      const c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      await p.render({ canvasContext: x, viewport: vp }).promise;
      seiten.push({ bild: c.toDataURL('image/jpeg', 0.85), w: v1.width, h: v1.height });
    }
    try { pdf.destroy(); } catch (_) {}
    const felder = seiten.map(() => []);
    for (const f of doc.fields) {
      if (!felder[f.page]) continue;
      const st = `left:${f.x}%;top:${f.y}%;width:${f.w}%;height:${f.h}%;font-size:${Math.min(1.6, (f.h / 100 * seiten[f.page].h) * (f.mehrzeilig ? 0.3 : 0.62) / seiten[f.page].w * 100).toFixed(3)}cqw` + (f.decken && /^#[0-9a-f]{6}$/i.test(f.decken) ? `;background:${f.decken}` : '');
      const t = esc(f.label || '');
      const wert = f.type === 'datum' ? WFP.Export.datumText(f.value) : f.value;
      if (f.type === 'check') felder[f.page].push(`<input type="checkbox" class="f k" style="${st}" title="${t}"${f.value ? ' checked' : ''}>`);
      else if (f.type === 'unterschrift') felder[f.page].push(`<div class="f u" style="${st}" title="${t}">${/^data:image\/png;base64,/.test(f.value || '') ? `<img src="${f.value}" alt="">` : ''}</div>`);
      else if (f.type === 'qr') { let img = ''; try { const q = qrcode(0, 'M'); q.addData(String(f.value || '')); q.make(); img = f.value ? `<img src="${q.createDataURL(4, 0)}" alt="">` : ''; } catch (_) {} felder[f.page].push(`<div class="f q" style="${st}">${img}</div>`); }
      else if (f.mehrzeilig) felder[f.page].push(`<textarea class="f t m" style="${st}" title="${t}">${esc(wert)}</textarea>`);
      else felder[f.page].push(`<input class="f t" style="${st}" title="${t}" value="${esc(wert)}">`);
    }
    const s0 = seiten[0] || { w: 595.28, h: 841.89 };
    return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(doc.name || 'Formular')}</title><style>
@page{size:${s0.w}pt ${s0.h}pt;margin:0}
body{margin:0;background:#e8e8ea;font-family:Helvetica,Arial,sans-serif}
.leiste{position:sticky;top:0;z-index:5;display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px;background:#fff;border-bottom:3px solid #e0231b}
.leiste button{font:inherit;font-size:16px;padding:10px 14px;border-radius:10px;border:2px solid #e0231b;background:#fff;color:#e0231b;cursor:pointer}
.leiste button.an{background:#e0231b;color:#fff}.leiste span{font-size:13px;color:#555}
.seite{position:relative;margin:12px auto;max-width:1000px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,.2);container-type:inline-size}
.seite>img.hg{display:block;width:100%;height:auto}
.f{position:absolute;box-sizing:border-box;margin:0;border:1px solid rgba(29,78,216,.45);background:rgba(29,78,216,.07);color:#001;font:inherit;padding:0 .3cqw;outline:none}
.f:focus{border-color:#1d4ed8;background:rgba(29,78,216,.12)}
.m{resize:none;line-height:1.2}
.k{appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;padding:0}
.k:checked{background:center/80% no-repeat url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Cpath d='M1.5 5.2 4 7.6 8.6 2.2' fill='none' stroke='%23001' stroke-width='1.6'/%3E%3C/svg%3E")}
.u img,.q img{width:100%;height:100%;object-fit:contain}
@media print{body{background:#fff}.leiste{display:none}.seite{margin:0;max-width:none;width:100%;box-shadow:none;break-after:page}.f{border-color:transparent}.f:not([style*="background:#"]):not(:checked){background-color:transparent}}
</style></head><body>
<div class="leiste"><button class="an" id="druck">🖨 Als PDF speichern</button><button id="sichern">💾 Ausgefüllt speichern</button>
<span>Felder antippen und ausfüllen. „Als PDF speichern" öffnet den Druckdialog — dort „Als PDF speichern" wählen.</span></div>
${seiten.map((s, i) => `<div class="seite" style="aspect-ratio:${s.w}/${s.h}"><img class="hg" src="${s.bild}" alt="Seite ${i + 1}">${felder[i].join('')}</div>`).join('\n')}
<script>
document.getElementById('druck').onclick=function(){window.print();};
document.getElementById('sichern').onclick=function(){
  document.querySelectorAll('input.f').forEach(function(e){if(e.type==='checkbox'){if(e.checked)e.setAttribute('checked','');else e.removeAttribute('checked');}else e.setAttribute('value',e.value);});
  document.querySelectorAll('textarea.f').forEach(function(e){e.textContent=e.value;});
  var b=new Blob(['<!DOCTYPE html>\\n'+document.documentElement.outerHTML],{type:'text/html'});
  var a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=(document.title||'Formular')+' (ausgefuellt).html';document.body.appendChild(a);a.click();a.remove();
};
<\/script></body></html>`;
  }

  window.WFP = window.WFP || {};
  window.WFP.HtmlExport = { htmlFormular };
})();
