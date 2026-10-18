import {readFile,writeFile} from 'node:fs/promises';
import {createMechanismAspects,mechanismAspectIds} from './mechanisms.ts';
import {newAspectSchema} from '../../packages/content/aspects.ts';
const file='packages/content/aspects.json',raw=JSON.parse(await readFile(file,'utf8')),before=newAspectSchema.array().parse(raw),generated=createMechanismAspects(before),next=raw.map((a:any)=>mechanismAspectIds.has(a.id)?generated.find(r=>r.id===a.id):a);
newAspectSchema.array().parse(next);
if(process.argv.includes('--apply'))await writeFile(file,JSON.stringify(next,null,2)+'\n');
console.log(JSON.stringify({applied:process.argv.includes('--apply'),aspects:next.length,removed:before.flatMap(a=>a.parts.rules).filter(r=>r.id.startsWith('pacing-aspect-')).length}));
