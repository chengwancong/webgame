import {execFileSync} from 'node:child_process';
for(const [tool,args]of [['tools/apply-monster-curve.ts',['--apply']],['tools/apply-world-monster-templates.ts',[]],['tools/apply-world-tier-curve.ts',['--apply']],['tools/build-stage-key-pools.ts',[]]])execFileSync(process.execPath,['--import','tsx',tool,...args],{stdio:'inherit',windowsHide:true});
