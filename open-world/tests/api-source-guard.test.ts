import {it,expect} from 'vitest';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error Plain Node service module is consumed without TS declarations.
import {apiSourceSignature,ApiSourceGuard} from '../tools/api-source-guard.mjs';
it('reloads after stable backend changes, but excludes frontend artwork and canceled edits',async()=>{
 const root=await mkdtemp(join(tmpdir(),'aw-source-guard-'));
 if(!root.startsWith(join(tmpdir(),'aw-source-guard-')))throw Error('Unexpected test workspace');
 try{
  for(const folder of ['apps/api/src','packages/contracts','packages/content','packages/rules','packages/simulation','apps/web/public'])await mkdir(join(root,folder),{recursive:true});
  const contract=join(root,'packages/contracts/index.ts');await writeFile(contract,'export const version=1;');
  const initial=await apiSourceSignature(root),guard=new ApiSourceGuard(initial);
  await writeFile(join(root,'apps/web/public/image.png'),'artwork');expect(await apiSourceSignature(root)).toBe(initial);
  await writeFile(contract,'export const version=2;');const changed=await apiSourceSignature(root);
  expect(guard.changed(changed)).toBe(false);expect(guard.changed(initial)).toBe(false);
  expect(guard.changed(changed)).toBe(false);expect(guard.changed(changed)).toBe(true);
  const restarted=new ApiSourceGuard(changed);expect(restarted.changed(changed)).toBe(false);
  await writeFile(join(root,'packages/content/map.json'),'{}');const content=await apiSourceSignature(root);
  expect(restarted.changed(content)).toBe(false);expect(restarted.changed(content)).toBe(true);
 }finally{await rm(root,{recursive:true,force:true});}
});
