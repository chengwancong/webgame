import {spawnSync} from 'node:child_process';import {join} from 'node:path';import {group} from './pipeline.mjs';
// Rebuild final r2 sources only; do not rerun r2-setup against a completed progress file.
for(const args of [['r2-inventory.mjs'],['r2-native.mjs'],['r2-paint.mjs'],['r2-probe.mjs'],['r2-export.mjs'],['r2-finish.mjs'],['r2-silhouette-check.mjs'],['r2-budget.mjs'],['r2-report.mjs']]){const r=spawnSync(process.execPath,[join(group,args[0]),...args.slice(1)],{stdio:'inherit'});if(r.status!==0)throw Error(args[0]+' failed '+r.status);}
