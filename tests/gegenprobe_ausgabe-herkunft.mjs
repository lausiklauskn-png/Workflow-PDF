import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('..',import.meta.url))),source=await readFile(join(root,'assets/app.js'),'utf8');
const cases=[
 ['aktuelles statt ausgegebenes Dokument','return (AUSGABE_QUELLEN.get(file) || []).slice();','return S.doc ? [S.doc.id] : [];','each ordinary shared file keeps its actual source'],
 ['falsche Quelle bei Mehrfachauswahl',"ausgabeDatei(f.bytes, f.name, 'application/pdf', [f.quelle])","ausgabeDatei(f.bytes, f.name, 'application/pdf', [ids[0]])",'each ordinary shared file keeps its actual source'],
 ['Aufrufer ändert gespeicherte Zuordnung','return (AUSGABE_QUELLEN.get(file) || []).slice();','return AUSGABE_QUELLEN.get(file) || [];','caller cannot mutate the remembered source'],
 ['Arbeitsstand verliert Quelle',"return ausgabeDatei(inhalt, dateiName(doc.name) + '.workfloh.json', 'application/json', [doc.id]);","return new File([inhalt], dateiName(doc.name) + '.workfloh.json', {type:'application/json'});",'working-state file has its source'],
 ['Sammel-PDF verliert Quellen','quellen.push(docs[i].id);',';','combined PDF names every contributing document']
];
const run=where=>spawnSync(process.execPath,[join(root,'tests/ausgabe-herkunft.mjs')],{env:{...process.env,WURZEL:where},encoding:'utf8',timeout:90000});
const baseline=run(root);if(baseline.status!==0||!baseline.stdout.includes('10 output-provenance checks passed'))throw Error('Baseline not green: '+baseline.stdout+baseline.stderr);
const copy=await mkdtemp(join(tmpdir(),'wfp-output-counter-'));
try{
 await cp(root,copy,{recursive:true,filter:p=>!['node_modules','.git'].includes(basename(p))});
 for(const [name,anchor,replacement,assertion] of cases){
  if(source.split(anchor).length!==2)throw Error('No unique anchor: '+name);
  await writeFile(join(copy,'assets/app.js'),source.replace(anchor,()=>replacement));
  const r=run(copy);
  if(r.status===0||!r.stderr.includes('AssertionError')||!r.stderr.includes(assertion))throw Error('Not caught at expected assertion: '+name+'\n'+r.stdout+r.stderr);
  console.log('GEFANGEN '+name);
 }
 console.log('5 Ausgabe-Gegenproben erkannt.');
}finally{await rm(copy,{recursive:true,force:true});}
