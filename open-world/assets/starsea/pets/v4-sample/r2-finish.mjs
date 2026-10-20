import {spawnSync} from 'node:child_process';import {join} from 'node:path';import {group} from './pipeline.mjs';
for(const f of ['r2-transforms.mjs','r2-ornament-check.mjs','r2-partition.mjs','r2-pack.mjs','r2-build-preview.mjs','r2-verify.mjs','r2-audit.mjs']){const r=spawnSync(process.execPath,[join(group,f)],{stdio:'inherit'});if(r.status!==0)throw Error(f+' failed '+r.status);}
