// Build the current workspace in its own tree so Windows preview watchers
// cannot hold asset directories that the normal atomic publishers replace.
import {cp,mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import {resolve,join} from 'node:path';
const root=resolve(import.meta.dirname,'..'),dir=resolve(root,process.env.AW_COPY_REVIEW_DIR??'docs/reviews/copy-voice-20261009');
const host=JSON.parse(await readFile(join(dir,'host.json'),'utf8'));
const source=await mkdtemp(join(host.work,'production-source-'));
const excluded=new Set(['node_modules','.qa','.git','dist','.vite','.vite-copy']);
for(const folder of ['apps','packages','assets','config','tools','tests','docs'])await cp(join(root,folder),join(source,folder),{recursive:true,dereference:true,filter:path=>!path.slice(root.length+1).split(/[\\/]/).some(part=>excluded.has(part))});
for(const file of ['package.json','pnpm-lock.yaml','tsconfig.json'])await cp(join(root,file),join(source,file));
await symlink(join(root,'node_modules'),join(source,'node_modules'),'junction');
const result={source,output:host.production,command:'pnpm build --outDir '+host.production};
await writeFile(join(dir,'build-location.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
