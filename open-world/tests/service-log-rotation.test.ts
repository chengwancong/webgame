import {it,expect} from 'vitest';
import {mkdtempSync,openSync,closeSync,writeSync,readFileSync,statSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
// @ts-expect-error Native service utility has no TypeScript declarations.
import {rotateServiceLog} from '../tools/service-log-rotation.mjs';
it('rotates a log while append-only parent and inherited child writers stay open',()=>{
 const dir=mkdtempSync(join(tmpdir(),'aw-log-rotation-')),path=join(dir,'stdout.log'),fd=openSync(path,'a');
 try{
  writeSync(fd,'original log\n');expect(rotateServiceLog(path,4)).toBe(true);expect(readFileSync(path+'.previous','utf8')).toBe('original log\n');
  writeSync(fd,'parent\n');const child=spawnSync(process.execPath,['-e',"process.stdout.write('child\\n')"],{stdio:['ignore',fd,'pipe'],windowsHide:true});expect(child.status).toBe(0);
  expect(readFileSync(path,'utf8')).toBe('parent\nchild\n');expect(statSync(path).size).toBe(13);expect(rotateServiceLog(path,20)).toBe(false);
 }finally{closeSync(fd);rmSync(dir,{recursive:true,force:true});}
});
