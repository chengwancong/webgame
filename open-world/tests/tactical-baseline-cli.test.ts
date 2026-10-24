import {it,expect} from 'vitest';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

it('loads the TypeScript rule graph but refuses an unnamed measurement round',()=>{
 const run=spawnSync(process.execPath,['tools/tactical-baseline.mjs','--invalid'],{cwd:fileURLToPath(new URL('..',import.meta.url)),encoding:'utf8',windowsHide:true});
 expect(run.status).toBe(1);
 expect(run.stderr).toContain('Use --round initial | validation');
 expect(run.stdout).toBe('');
});
