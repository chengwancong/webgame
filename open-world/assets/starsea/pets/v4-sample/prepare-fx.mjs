import {readFile,writeFile} from 'node:fs/promises';import {group} from './pipeline.mjs';import {join} from 'node:path';
for(const f of ['effects.mjs','fx-renderer.js']){let s=await readFile(join(group,'../v3',f),'utf8');s=s.replaceAll('pets/v3','pets/v4-sample').replaceAll('96','128').replace('width:768','width:1024').replace('alpha:.6','alpha:.85');await writeFile(join(group,f),s);}
await writeFile(join(group,'flows.mjs'),"import {flows as all} from '../v3/flows.mjs'; export const flows=all.filter(f=>['ember','glacier','arcanum'].includes(f.id));\n");
