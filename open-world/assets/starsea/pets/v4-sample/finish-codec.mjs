import {spawnSync} from 'node:child_process';import {join} from 'node:path';import {group} from './pipeline.mjs';
for(const f of ['extend-codec.mjs','partition.mjs','pack-runtime.mjs','mounts.mjs','prepare-preview.mjs','verify-preview.mjs','audit.mjs','estimate.mjs']){const r=spawnSync(process.execPath,[join(group,f)],{stdio:'inherit'});if(r.status!==0)throw Error(f+' failed '+r.status);}
