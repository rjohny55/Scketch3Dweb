import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'examples/cmp170-fan-adapter');
const target=path.join(root,'apps/web/public/assets/demos/cmp170-fan-adapter');
const manifest=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
fs.mkdirSync(target,{recursive:true});
for(const name of ['manifest.json',manifest.files.project,manifest.files.mesh,manifest.files.preview]){
 if(path.basename(name)!==name)throw Error('Invalid demo filename');
 if(!fs.existsSync(path.join(source,name))){
  if(name===manifest.files.preview&&process.argv.includes('--allow-missing-preview'))continue;
  throw Error('Missing built-in demo asset: '+name);
 }
 fs.copyFileSync(path.join(source,name),path.join(target,name));
}
console.log('[stage-demo-assets] CMP 170 fan adapter staged');
