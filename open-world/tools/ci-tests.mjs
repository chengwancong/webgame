// Shared local/Actions exclusion list; no browser probes or mock databases.
import {readFileSync,mkdtempSync} from 'node:fs';
import {spawnSync,execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
if(!process.env.AW_DATABASE_URL)throw Error('CI tests require an isolated real PostgreSQL database');
const excluded=JSON.parse(readFileSync(new URL('./ci-test-excludes.json',import.meta.url),'utf8'));
console.log('Binary asset test exclusions: '+excluded.join(', '));
const output=mkdtempSync(join(tmpdir(),'abyss-ci-'));
const env={...process.env,AW_CI_SOURCE_ONLY:'1',AW_REVIEW_ROOT:process.env.AW_REVIEW_ROOT??output,AW_CALENDAR_OUT:process.env.AW_CALENDAR_OUT??join(output,'calendar'),AW_LONG_TEST_TIMEOUT_MS:process.env.AW_LONG_TEST_TIMEOUT_MS??'1800000'};
if(process.platform==='win32'&&!env.AW_PYTHON)env.AW_PYTHON=execFileSync('python',['-c','import sys; print(sys.executable)'],{encoding:'utf8',windowsHide:true}).trim();
console.log('Test evidence: '+output);
const r=spawnSync(process.execPath,['node_modules/vitest/vitest.mjs','run','--maxWorkers=1','--no-file-parallelism',...excluded.flatMap(file=>['--exclude',file]),...process.argv.slice(2)],{cwd:root,env,stdio:'inherit',windowsHide:true});
if(r.error)throw r.error;process.exitCode=r.status??1;
