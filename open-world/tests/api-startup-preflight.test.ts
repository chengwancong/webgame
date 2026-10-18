import {it,expect} from 'vitest';
import {mkdir,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve,sep} from 'node:path';
// @ts-expect-error Plain Node service module is consumed without TS declarations.
import {validateApiSource} from '../tools/api-source-guard.mjs';

it('rejects syntax and content errors before restarting the healthy API',async()=>{
 const base=resolve('.qa');await mkdir(base,{recursive:true});
 const root=await mkdtemp(join(base,'api-preflight-'));if(!root.startsWith(base+sep))throw Error('Unsafe fixture path');
 try{
  const directory=join(root,'apps/api/src');await mkdir(directory,{recursive:true});
  const entry=join(directory,'main.ts'),app=join(directory,'app.ts'),dependency=join(directory,'dependency.ts');
  await writeFile(entry,'export {};');await writeFile(app,"import './dependency.ts';");await writeFile(dependency,'export const value=1;');
  expect((await validateApiSource(root)).ok).toBe(true);
  await writeFile(dependency,'export const value={broken:)};');
  const syntax=await validateApiSource(root);expect(syntax.ok).toBe(false);expect(syntax.diagnostics).toContain('dependency.ts');
  await writeFile(dependency,"throw Error('invalid monster configuration');");
  const content=await validateApiSource(root);expect(content.ok).toBe(false);expect(content.diagnostics).toContain('invalid monster configuration');
  await writeFile(dependency,'export const value=1;');await writeFile(entry,'const startup=(;');
  expect((await validateApiSource(root)).ok).toBe(false);
  await writeFile(entry,'export {};');expect((await validateApiSource(root)).ok).toBe(true);
 }finally{if(!resolve(root).startsWith(base+sep))throw Error('Fixture escaped QA directory');await rm(root,{recursive:true,force:true});}
},20000);
