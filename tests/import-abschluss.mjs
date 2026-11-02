// Real browser + IndexedDB. The native receipt adapter is deliberately absent:
// this checks the ordinary importer boundary it needs, including async failure.
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
const photo=Array.from(await readFile(resolve(root,'tests/eingang-vorlagen/Vorlage-H0-Foto-sauber.jpg')));
let browser,checks=0;
const ok=(name,value)=>{assert.ok(value,name);checks++;console.log('PASS '+name);};
try{
  const executablePath=process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined);
  browser=await chromium.launch({executablePath,args:['--no-sandbox']});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/,r=>r.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/`);await page.waitForFunction(()=>window.__wfpdf);
  const normal=await page.evaluate(async bytes=>{
    const [d]=await __wfpdf.importDateien([new File([new Uint8Array(bytes)],'normal.pdf',{type:'application/pdf'})],null,{still:true});
    const saved=await WFP.DB.get('docs',d.id),data=await WFP.DB.getFile(d.id);
    return {id:d.id,saved:!!saved,pruefung:!!saved.pruefung,bytes:Array.from(new Uint8Array(data))};
  },bytes);
  ok('ordinary import works without the hook and remains manually checked',normal.saved&&!normal.pruefung&&normal.bytes.join()===bytes.join());
  await page.evaluate(bytes=>{
    window.importWrites=[];window.hookEntered=false;window.importFinished=false;
    const put=WFP.DB.put;WFP.DB.put=async function(store,obj){importWrites.push({store,id:obj.id});return put.call(this,store,obj);};
    window.importPromise=__wfpdf.importDateien([new File([new Uint8Array(bytes)],'reserved.pdf',{type:'application/pdf'})],null,{still:true,
      async vorSpeichern(d,source){
        window.hookEntered=true;window.hookSource={bytes:Array.from(source.bytes),original:source.original};
        await new Promise(r=>window.finishHook=r);d.id='native-reserved-1';d.proHerkunft={id:'eingang-17',sha256:'fixture'};
      }
    }).then(result=>{window.importResult=result;window.importFinished=true;});
  },bytes);
  await page.waitForFunction(()=>window.hookEntered||window.importFinished);
  ok('hook is called before any document write',await page.evaluate(()=>hookEntered&&importWrites.length===0));
  ok('async hook holds the importer until reservation has completed',await page.evaluate(()=>!importFinished&&typeof finishHook==='function'));
  ok('hook sees the exact PDF and no fabricated original',await page.evaluate(bytes=>hookSource.original===null&&hookSource.bytes.join()===bytes.join(),bytes));
  await page.evaluate(async()=>{finishHook();await importPromise;});
  const reserved=await page.evaluate(async()=>{
    const docs=await WFP.DB.all('docs'),files=await WFP.DB.all('files'),text=await WFP.DB.get('texte','native-reserved-1');
    return {docs,files:files.map(f=>f.id),writes:importWrites,text:!!text,result:importResult.map(d=>d.id)};
  });
  ok('reserved identity is used by files, document, text and returned result',reserved.docs.length===2&&reserved.files.includes('native-reserved-1')&&reserved.text&&reserved.result.join()==='native-reserved-1'&&reserved.writes.every(w=>w.id==='native-reserved-1'));
  ok('origin metadata remains on the normal stored document',reserved.docs.some(d=>d.id==='native-reserved-1'&&d.proHerkunft?.id==='eingang-17'));
  await page.reload();await page.waitForFunction(()=>window.__wfpdf);
  ok('reserved identity and origin survive a fresh page',await page.evaluate(async()=>{const d=await WFP.DB.get('docs','native-reserved-1');return d?.proHerkunft?.id==='eingang-17'&&!!await WFP.DB.getFile(d.id);}));
  const aborted=await page.evaluate(async bytes=>{
    const before=await Promise.all(['docs','files','texte'].map(s=>WFP.DB.keys(s)));
    const result=await __wfpdf.importDateien([new File([new Uint8Array(bytes)],'aborted.pdf',{type:'application/pdf'})],null,{still:true,async vorSpeichern(){await Promise.resolve();throw Error('reservation-denied');}});
    return {before,after:await Promise.all(['docs','files','texte'].map(s=>WFP.DB.keys(s))),result:result.length};
  },bytes);
  ok('rejected reservation writes no PDF, document or text and reports no success',aborted.result===0&&JSON.stringify(aborted.before)===JSON.stringify(aborted.after));
  const image=await page.evaluate(async photo=>{
    const [d]=await __wfpdf.importDateien([new File([new Uint8Array(photo)],'camera.jpg',{type:'image/jpeg'})],null,{still:true,async vorSpeichern(doc,source){
      if(!source.original||source.original.name!=='camera.jpg'||Array.from(source.original.bytes).join()!==photo.join())throw Error('missing-photo');
      await Promise.resolve();doc.id='native-photo-2';doc.proHerkunft={id:'photo-2'};
    }});
    if(!d)return null;const f=await WFP.DB.get('files',d.id+'~original'),pdf=await WFP.DB.getFile(d.id);
    return {id:d.id,source:d.quelle,original:Array.from(f.bytes),pdf:new TextDecoder().decode(new Uint8Array(pdf).slice(0,5)),checked:!!d.pruefung};
  },photo);
  ok('photo uses the normal PDF conversion and keeps its byte-exact original under the reserved identity',image?.id==='native-photo-2'&&image.source==='foto'&&image.original.join()===photo.join()&&image.pdf==='%PDF-'&&!image.checked);
  ok('no uncaught browser error',errors.length===0);
  console.log(`${checks} import checks passed`);
}catch(e){console.error('FAIL '+e.stack);process.exitCode=1;}
finally{await browser?.close();await new Promise(r=>server.close(r));}
