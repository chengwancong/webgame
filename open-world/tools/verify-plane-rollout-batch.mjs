import {spawnSync} from 'node:child_process';
import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
const root=resolve(import.meta.dirname,'..'),batch=process.argv[2];
if(!['R1','R2','R3','R4','R6'].includes(batch))throw Error('用法：node tools/verify-plane-rollout-batch.mjs R1|R2|R3|R4|R6');
const commands=[
 ['node tools/build-plane-rollout-art.mjs --batch='+batch,['tools/build-plane-rollout-art.mjs','--batch='+batch]],
 ['node tools/verify-plane-rollout-art.mjs --batch='+batch,['tools/verify-plane-rollout-art.mjs','--batch='+batch]],
 ['node tools/verify-plane-rollout-art.mjs --allow-pending',['tools/verify-plane-rollout-art.mjs','--allow-pending']],
 ['node tools/verify-plane-prop-art.mjs',['tools/verify-plane-prop-art.mjs']],
 ['node tools/verify-plane-kit-art.mjs --allow-pending',['tools/verify-plane-kit-art.mjs','--allow-pending']],
 ['npx tsx tools/verify-plane-prop-runtime.ts',['node_modules/tsx/dist/cli.mjs','tools/verify-plane-prop-runtime.ts']],
 ['npx vitest run tests/plane-scenes.test.ts',['node_modules/vitest/vitest.mjs','run','tests/plane-scenes.test.ts']],
 ['npx vitest run tests/plane-layouts.test.ts',['node_modules/vitest/vitest.mjs','run','tests/plane-layouts.test.ts']],
 ['npx tsx tools/check-world-resource-wiring.ts',['node_modules/tsx/dist/cli.mjs','tools/check-world-resource-wiring.ts']],
];
const checks=[];const dir=resolve(root,'docs/reviews/plane-art-20261018');await mkdir(dir,{recursive:true});
for(const [command,args] of commands){const start=Date.now(),r=spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});checks.push({command,exitCode:r.status,seconds:(Date.now()-start)/1000});await writeFile(resolve(dir,`rollout-${batch}-checks.json`),JSON.stringify({passed:checks.every(c=>c.exitCode===0),checks},null,2)+'\n');if(r.status!==0){console.error(command+'\n'+r.stdout+'\n'+r.stderr);process.exit(r.status??1);}console.log(command+'：通过');}
