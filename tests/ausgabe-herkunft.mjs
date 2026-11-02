// Echte Ausgaben des Kerns. Nur das Betriebssystem-Teilen wird aufgezeichnet.
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {PDFDocument} from 'pdf-lib';
const root=resolve(process.env.WURZEL||fileURLToPath(new URL('..',import.meta.url)));
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.mjs':'text/javascript'};
const server=http.createServer(async(req,res)=>{try{
  const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=resolve(root,'.'+(name.endsWith('/')?name+'index.html':name));
  if(!file.startsWith(root+sep)||!(await stat(file)).isFile())throw Error('missing');
  res.setHeader('Content-Type',types[extname(file)]||'application/octet-stream');res.end(await readFile(file));
}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const pdf=await PDFDocument.create();pdf.addPage([250,300]);const bytes=Array.from(await pdf.save());
let browser,checks=0;
const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('PASS '+name);};
try{
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});
  const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.addInitScript(()=>{
    window.outputFiles=[];
    Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
    Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.outputFiles.push(...data.files);}});
  });
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.__wfpdf);
  const ids=await page.evaluate(async bytes=>{
    const docs=await __wfpdf.importDateien(['A','B'].map(n=>new File([new Uint8Array(bytes)],n+'.pdf',{type:'application/pdf'})),null,{still:true});
    return docs.map(d=>d.id);
  },bytes);
  await page.evaluate(async ids=>{await __wfpdf.dlg.teilenDocs([ids[1],ids[0]]);},ids);
  ok('each ordinary shared file keeps its actual source in output order',await page.evaluate(ids=>JSON.stringify(outputFiles.map(f=>__wfpdf.ausgabeHerkunft(f)))===JSON.stringify([[ids[1]],[ids[0]]]),ids));
  ok('source follows the produced File after another document becomes current',await page.evaluate(ids=>{__wfpdf.S.doc=__wfpdf.S.docs.find(d=>d.id===ids[0]);return __wfpdf.ausgabeHerkunft(outputFiles[0]).join()===ids[1];},ids));
  ok('caller cannot mutate the remembered source',await page.evaluate(ids=>{const result=__wfpdf.ausgabeHerkunft(outputFiles[0]);result[0]='changed';return __wfpdf.ausgabeHerkunft(outputFiles[0]).join()===ids[1];},ids));
  ok('another File with the same name is not assigned guessed provenance',await page.evaluate(()=>__wfpdf.ausgabeHerkunft(new File([outputFiles[0]],outputFiles[0].name,{type:outputFiles[0].type})).length===0));
  await page.evaluate(async ids=>{__wfpdf.S.doc=null;outputFiles=[];await __wfpdf.dlg.teilenDocs(['missing-document',ids[0]]);},ids);
  await page.locator('.dlg [data-teilen-jetzt]').click();
  ok('skipped source cannot shift the next file identity',await page.evaluate(ids=>outputFiles.length===1&&__wfpdf.ausgabeHerkunft(outputFiles[0]).join()===ids[0],ids));
  await page.evaluate(async id=>{document.querySelectorAll('.dlg-grund').forEach(n=>n.remove());outputFiles=[];await __wfpdf.oeffneDok(id);await __wfpdf.dlg.speichernDialog();},ids[0]);
  await page.locator('.dlg [data-teilen]').click();
  ok('working-state file has its source without changing its format',await page.evaluate(async id=>{const f=outputFiles[0],body=JSON.parse(await f.text());return __wfpdf.ausgabeHerkunft(f).join()===id&&body.format==='workfloh-pdf-arbeitsstand'&&body.doc.id===id;},ids[0]));
  await page.evaluate(()=>{document.querySelectorAll('.dlg-grund').forEach(n=>n.remove());outputFiles=[];__wfpdf.dlg.exportDialog();});
  await page.locator('.dlg [data-m="fest"]').click();
  await page.waitForSelector('.dlg [data-teilen]');
  await page.evaluate(id=>{window.exportSource=__wfpdf.S.doc;__wfpdf.S.doc=__wfpdf.S.docs.find(d=>d.id===id);},ids[1]);
  await page.locator('.dlg [data-teilen]').click();
  ok('prepared PDF export remains related to the exporting document',await page.evaluate(id=>outputFiles.length===1&&outputFiles[0].type==='application/pdf'&&__wfpdf.ausgabeHerkunft(outputFiles[0]).join()===id,ids[0]));
  await page.evaluate(async()=>{
    __wfpdf.S.doc=window.exportSource;document.querySelectorAll('.dlg-grund').forEach(n=>n.remove());outputFiles=[];
    for(const d of __wfpdf.S.docs){d.folderId='output-folder';await WFP.DB.put('docs',d);}
    __wfpdf.dlg.ordnerAusgabe({id:'output-folder',name:'Ausgabe-Probe'});
  });
  await page.locator('.dlg [data-weg="teilen"]').click();
  await page.waitForSelector('.dlg [data-teilen]');await page.locator('.dlg [data-teilen]').click();
  ok('folder shares map each file to its own source',await page.evaluate(ids=>outputFiles.length===2&&outputFiles.every(f=>__wfpdf.ausgabeHerkunft(f).join()===(f.name.startsWith('A')?ids[0]:ids[1])),ids));
  await page.evaluate(()=>{document.querySelectorAll('.dlg-grund').forEach(n=>n.remove());outputFiles=[];__wfpdf.dlg.ordnerAusgabe({id:'output-folder',name:'Ausgabe-Probe'});});
  await page.locator('.dlg [data-weg="eins"]').click();await page.waitForSelector('.dlg [data-teilen]');await page.locator('.dlg [data-teilen]').click();
  ok('combined PDF names every contributing document without a fabricated single source',await page.evaluate(ids=>outputFiles.length===1&&__wfpdf.ausgabeHerkunft(outputFiles[0]).length===2&&ids.every(id=>__wfpdf.ausgabeHerkunft(outputFiles[0]).includes(id)),ids));
  ok('no browser script errors',errors.length===0);
  console.log(checks+' output-provenance checks passed');
}finally{await browser?.close();await new Promise(r=>server.close(r));}
