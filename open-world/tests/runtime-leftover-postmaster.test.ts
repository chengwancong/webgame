import {it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
// @ts-expect-error Native runtime utility has no TypeScript declarations.
import {leftoverQaPostmaster,root} from '../tools/runtime.mjs';
function fakeRun(dir:string,run:string,pidLine='77464'){
 const data=join(dir,run,'data');mkdirSync(data,{recursive:true});
 writeFileSync(join(data,'postmaster.pid'),`${pidLine}\n${data}\n1791461110\n`);return data;
}
it('treats a leftover QA postmaster.pid as stopped only when pg_ctl says no server and the PID is not postgres',()=>{
 const dir=mkdtempSync(join(tmpdir(),'aw-leftover-pg-')),qaBase=join(dir,'.qa');
 try{
  const data=fakeRun(qaBase,'run-U6OCtu'),calls:string[]=[];
  const status=(d:string)=>{calls.push(d);return 3;};
  expect(leftoverQaPostmaster(data,{qaBase,status,name:()=>''})).toBe(true);
  expect(leftoverQaPostmaster(data,{qaBase,status,name:()=>'C:\\Windows\\node.exe'})).toBe(true);
  expect(leftoverQaPostmaster(data,{qaBase,status,name:()=>'postgres.exe'})).toBe(false);
  expect(leftoverQaPostmaster(data,{qaBase,status,name:()=>'postgres'})).toBe(false);
  expect(leftoverQaPostmaster(data,{qaBase,status,name:()=>{throw Error('identity unavailable');}})).toBe(false);
  for(const code of [0,1,4,null])expect(leftoverQaPostmaster(data,{qaBase,status:()=>code,name:()=>''})).toBe(false);
  expect(leftoverQaPostmaster(data,{qaBase,status:()=>{throw Error('pg_ctl missing');},name:()=>''})).toBe(false);
  expect(leftoverQaPostmaster(fakeRun(qaBase,'run-bad','not-a-pid'),{qaBase,status,name:()=>''})).toBe(false);
  // Outside .qa (including the persistent dev database) is never judged, not even probed.
  calls.length=0;
  expect(leftoverQaPostmaster(fakeRun(dir,'.runtime/dev'),{qaBase,status,name:()=>''})).toBe(false);
  expect(leftoverQaPostmaster(qaBase,{qaBase,status,name:()=>''})).toBe(false);
  expect(leftoverQaPostmaster(join(root,'.runtime/dev/data'),{qaBase:join(root,'.runtime'),status,name:()=>''})).toBe(false);
  expect(calls).toEqual([]);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
