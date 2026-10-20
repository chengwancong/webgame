import {it,expect,afterEach} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {sha} from '../tools/spine/io.ts';
import {readBudgetForCheck} from '../tools/spine/check.ts';
import {versions} from '../packages/contracts/index.ts';
const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true});});
async function fixture(change:(p:any,r:any)=>void=()=>{}){
 const dir=await mkdtemp(join(tmpdir(),'aw-budget-check-'));dirs.push(dir);
 const report={versions:{...versions},counts:{outside:7}},pointer:any={schemaVersion:1,suite:'budget',versions:{...versions},audit:{path:join(dir,'audit.json')},sourceLockSha256:sha('lock')};
 change(pointer,report);
 const body=JSON.stringify(report);pointer.audit.sha256=sha(body);
 await writeFile(pointer.audit.path,body);await writeFile(join(dir,'lock.json'),'lock');await writeFile(join(dir,'pointer.json'),JSON.stringify(pointer));
 return {dir,pointer,read:()=>readBudgetForCheck(join(dir,'pointer.json'),join(dir,'lock.json'))};
}
it('uses exact fresh budget evidence without declaring the old full suite rerun',async()=>{
 const f=await fixture(),result=await f.read();expect(result?.report.counts.outside).toBe(7);expect(result?.evidence.suite).toBe('budget');
});
it('keeps legacy selection available only when no current pointer exists',async()=>{
 const f=await fixture();expect(await readBudgetForCheck(join(f.dir,'absent.json'))).toBeNull();
});
it.each(['version','reportVersion','schema','count'] as const)('rejects invalid %s without fallback',async kind=>{
 const f=await fixture((p,r)=>{if(kind==='version')p.versions.rules='old';if(kind==='reportVersion')r.versions.rules='old';if(kind==='schema')p.schemaVersion=0;if(kind==='count')r.counts.outside=-1;});
 await expect(f.read()).rejects.toThrow();
});
it('rejects changed source lock and changed evidence bytes',async()=>{
 const f=await fixture();await writeFile(join(f.dir,'lock.json'),'new-lock');await expect(f.read()).rejects.toThrow('source lock');
 await writeFile(join(f.dir,'lock.json'),'lock');await writeFile(f.pointer.audit.path,'{}');await expect(f.read()).rejects.toThrow('evidence hash');
});
it('does not silently use old evidence when an explicit current report goes missing',async()=>{
 const f=await fixture();await rm(f.pointer.audit.path);await expect(f.read()).rejects.toThrow();
});
it('wires the numerical check into QA before builds or database startup',async()=>{
 const source=await readFile(new URL('../tools/qa.mjs',import.meta.url),'utf8');
 const gate=source.indexOf("await run(['--import','tsx','tools/spine/cli.ts','check'");
 expect(gate).toBeGreaterThan(0);
 expect(gate).toBeLessThan(source.indexOf("await run(['node_modules/typescript/bin/tsc'"));
 expect(source).toContain("if(code!==0)throw Error('Command failed:");
});
it('accepts an exact explicitly approved historical report without relabelling its version',async()=>{
 const f=await fixture((p,r)=>{p.versions.rules='ow-76';r.versions.rules='ow-76';});
 const hashes={source:sha('approved')};await writeFile(join(f.dir,'lock.json'),JSON.stringify({hashes}));
 const approval:any={budgetReferenceSha256:sha(await readFile(join(f.dir,'pointer.json'))),sourceHashesSha256:sha(JSON.stringify(hashes)),auditSha256:f.pointer.audit.sha256};
 const result=await readBudgetForCheck(join(f.dir,'pointer.json'),join(f.dir,'lock.json'),approval);
 expect(result?.acceptedHistorical).toBe(true);expect(result?.report.versions.rules).toBe('ow-76');
 await writeFile(f.pointer.audit.path,'{}');
 await expect(readBudgetForCheck(join(f.dir,'pointer.json'),join(f.dir,'lock.json'),approval)).rejects.toThrow('hash');
});
it('does not extend historical approval to a changed pointer, changed source lock or missing pointer',async()=>{
 const f=await fixture((p,r)=>{p.versions.rules='ow-76';r.versions.rules='ow-76';});
 const hashes={source:sha('approved')},lockPath=join(f.dir,'lock.json'),pointerPath=join(f.dir,'pointer.json');
 await writeFile(lockPath,JSON.stringify({hashes}));
 const approval:any={budgetReferenceSha256:sha(await readFile(pointerPath)),sourceHashesSha256:sha(JSON.stringify(hashes)),auditSha256:f.pointer.audit.sha256};
 await writeFile(lockPath,JSON.stringify({hashes:{different:'source'}}));
 await expect(readBudgetForCheck(pointerPath,lockPath,approval)).rejects.toThrow('Accepted budget');
 await writeFile(lockPath,JSON.stringify({hashes}));
 await writeFile(pointerPath,JSON.stringify({...f.pointer,unapproved:true}));
 await expect(readBudgetForCheck(pointerPath,lockPath,approval)).rejects.toThrow('Stale');
 await rm(pointerPath);await expect(readBudgetForCheck(pointerPath,lockPath,approval)).rejects.toThrow();
});
