// Compatibility entry; do not reset the generated starsea curve or template bases.
import {spawnSync} from 'node:child_process';
const result=spawnSync(process.execPath,['--import','tsx','tools/starsea-balance-model.ts',...process.argv.slice(2)],{stdio:'inherit',windowsHide:true});
process.exitCode=result.status??1;
