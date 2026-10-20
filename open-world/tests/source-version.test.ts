import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
// @ts-expect-error Native audit tool has no TS declarations.
import {sourceVersion} from '../tools/source-version.mjs';
it('includes changed gameplay configuration while ignoring generated browser output',async()=>{
 const prefix=join(tmpdir(),'aw-source-version-'),root=await mkdtemp(prefix);
 try{
  for(const dir of ['apps/web/dist','apps/web/public','packages','tests','tools','config/json'])await mkdir(join(root,dir),{recursive:true});
  for(const file of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json'])await writeFile(join(root,file),'{}');
  await writeFile(join(root,'config/json/tasks.json'),'{"goal":"before"}');
  const before=await sourceVersion({projectRoot:root,diagnostics:true});
  expect(Object.keys(before.fingerprints).some(p=>p.replaceAll('\\','/')==='config/json/tasks.json')).toBe(true);
  await writeFile(join(root,'apps/web/dist/build.js'),'generated');await writeFile(join(root,'apps/web/public/art.png'),'art');
  expect((await sourceVersion({projectRoot:root})).sha256).toBe(before.sha256);
  await writeFile(join(root,'config/json/tasks.json'),'{"goal":"after"}');
  const after=await sourceVersion({projectRoot:root});expect(after.sha256).not.toBe(before.sha256);expect(after.file_count).toBe(before.file_count);
 }finally{
  if(!resolve(root).startsWith(resolve(prefix)))throw Error('Unexpected test workspace');
  await rm(root,{recursive:true,force:true});
 }
});
