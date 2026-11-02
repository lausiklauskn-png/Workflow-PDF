// Deliberate defects in disposable copies; no production source is modified.
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,basename} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=await readFile(join(root,'assets/app.js'),'utf8');
const hook="if (typeof vorSpeichern === 'function') await vorSpeichern(d, { bytes, original });";
const cases=[
  ['missing hook',hook,';',/hook is called before any document write/],
  ['unawaited reservation',hook,"if (typeof vorSpeichern === 'function') vorSpeichern(d, { bytes, original });",/hook is called before any document write|async hook holds/],
  ['premature file write',hook,`await DB.putFile(d.id, bytes); ${hook}`,/hook is called before any document write/],
  ['missing photo original',hook,"if (typeof vorSpeichern === 'function') await vorSpeichern(d, { bytes, original: null });",/photo uses the normal PDF conversion/],
  ['working state bypasses reservation',"if (typeof opt.vorSpeichern === 'function') await opt.vorSpeichern(d, { bytes, original: null });",';',/working-state import awaits/],
  ['working state returns no receipt','if (!dateien.length) return staendeNeu;','if (!dateien.length) return [];',/working-state import awaits/]
];
let failed=0;const copy=await mkdtemp(join(tmpdir(),'wfp-import-counter-'));
function run(where){return spawnSync(process.execPath,[join(root,'tests/import-abschluss.mjs')],{env:{...process.env,WURZEL:where},encoding:'utf8',timeout:90000});}
try{
 const baseline=run(root);if(baseline.status!==0)throw Error('Baseline failed: '+baseline.stdout+baseline.stderr);
 await cp(root,copy,{recursive:true,filter:p=>!['node_modules','.git'].includes(basename(p))});
 for(const [name,anchor,replacement,expected] of cases){
   if(source.split(anchor).length!==2)throw Error('Missing unique anchor: '+name);
   await writeFile(join(copy,'assets/app.js'),source.replace(anchor,()=>replacement));
   const r=run(copy);const caught=r.status!==0&&expected.test(r.stderr);
   console.log((caught?'PASS caught ':'FAIL missed/wrong reason ')+name);if(!caught){failed++;console.log(r.stdout+r.stderr);}
 }
 if(failed)process.exitCode=1;
}finally{await rm(copy,{recursive:true,force:true});}
