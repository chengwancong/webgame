import fs from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
/** Stage this task's delta relative to its saved working-tree start. Existing
 * unstaged work is excluded from the index and never changed on disk. */
const files=process.argv.slice(2),base='.runtime/audio-vfx-baseline';
for(const file of files){const saved=base+'/'+file.replaceAll('/','__');if(!fs.existsSync(saved))throw Error('No saved task baseline for '+file);const path='open-world/'+file,index=execFileSync('git',['show',':'+path],{maxBuffer:32*1024*1024}),temp=base+'/index-'+file.replaceAll('/','__');fs.writeFileSync(temp,index);
 const normalized=path=>fs.readFileSync(path,'utf8').replaceAll('\r\n','\n');fs.writeFileSync(temp,normalized(temp));fs.writeFileSync(temp+'.base',normalized(saved));fs.writeFileSync(temp+'.final',normalized(file));
 const merged=spawnSync('git',['merge-file','-p',resolve(temp),resolve(temp+'.base'),resolve(temp+'.final')],{encoding:'buffer',maxBuffer:32*1024*1024});if(merged.status!==0){fs.writeFileSync(temp+'.conflict',merged.stdout);throw Error('Task/index overlap needs explicit patch review: '+file);}
 fs.writeFileSync(temp+'.review',merged.stdout);const blob=execFileSync('git',['hash-object','-w','--stdin'],{input:merged.stdout}).toString().trim();execFileSync('git',['update-index','--cacheinfo','100644',blob,path]);fs.copyFileSync(file,saved);console.log('Staged task delta: '+file);
}
