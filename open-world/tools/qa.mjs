import {spawn} from 'node:child_process';
import {mkdir,writeFile,open,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {startDatabase,stopChild,waitFor,root,registerApi} from './runtime.mjs';
import {browserCheck} from './browser-check.mjs';
import {capacityCheck} from './capacity.mjs';
import {backupCheck} from './backup.mjs';
import {renderPressure} from './render-pressure.mjs';
import {sourceVersion} from './source-version.mjs';
const evidence=resolve(root,'../docs/reviews/open-world');await mkdir(evidence,{recursive:true});
let database,server,current,browser,closing=false;const report={ok:false,started:new Date().toISOString(),source:await sourceVersion(),checks:[]};
async function cleanup(){if(closing)return;closing=true;const errors=[];for(const action of [async()=>{if(browser)await browser.close();},()=>stopChild(current),()=>stopChild(server),async()=>{if(database)report.cleanup=await database.stop();}]){try{await action();}catch(e){errors.push(String(e));}}if(errors.length){report.ok=false;report.cleanup_errors=errors;process.exitCode=1;}await writeFile(evidence+'/qa-result.json',JSON.stringify(report,null,2));}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{report.interrupted=signal;await cleanup();process.exit(130);});
async function run(args,env={}){const childEnv={...process.env,...env};if(Object.hasOwn(env,'ELECTRON_RUN_AS_NODE')&&env.ELECTRON_RUN_AS_NODE==='')delete childEnv.ELECTRON_RUN_AS_NODE;current=spawn(process.execPath,args,{cwd:root,env:childEnv,stdio:'inherit',windowsHide:true});const code=await new Promise(r=>current.once('exit',r));current=undefined;if(code!==0)throw Error('Command failed: '+args.join(' '));report.checks.push(args.join(' '));}
try{
 await run(['tools/world-graybox.mjs']);
 await run(['tools/build-ui-tokens.mjs','--check']);
 await run(['--import','tsx','tools/spine/cli.ts','check','--out='+resolve(evidence,'numeric-spine-check')]);
 await run(['node_modules/typescript/bin/tsc','--noEmit']);await run(['node_modules/tsx/dist/cli.mjs','tools/validate-content.ts']);await run(['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts']);database=await startDatabase({temporary:true});
 await run(['node_modules/vitest/vitest.mjs','run'],{AW_DATABASE_URL:database.dsn});
 const log=await open(resolve(database.work,'api.log'),'w');server=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn,AW_API_PORT:'8611'},stdio:['ignore',log.fd,log.fd]});await log.close();await registerApi(database,server);await waitFor('http://127.0.0.1:8611/api/health',server);
 report.browser=await browserCheck('http://127.0.0.1:8611/',evidence,b=>browser=b);report.capacity=await capacityCheck('http://127.0.0.1:8611/');report.backup=await backupCheck(database);// ELECTRON_RUN_AS_NODE 会让 electron cli 以纯 Node 启动，require('electron') 拿不到 app；
// Windows 即使空值仍可能启用该模式；桌面调用以空值请求 run 从环境对象删除此键。
await run(['node_modules/electron/cli.js','apps/desktop/main.cjs'],{AW_DESKTOP_SMOKE:'1',AW_DESKTOP_SCREENSHOT:evidence+'/desktop.png',ELECTRON_RUN_AS_NODE:''});await run(['node_modules/vite/bin/vite.js','build','--config','apps/web/vite.config.ts','--mode','qa','--outDir',database.work+'/render-build']);await stopChild(server);server=spawn(process.execPath,['--import','tsx',resolve(root,'apps/api/src/main.ts')],{cwd:root,env:{...process.env,AW_DATABASE_URL:database.dsn,AW_API_PORT:'8611',AW_STATIC_ROOT:database.work+'/render-build'},stdio:'ignore'});await registerApi(database,server);await waitFor('http://127.0.0.1:8611/api/health',server);report.render=await renderPressure('http://127.0.0.1:8611',30000);report.ok=true;
 if(!report.render.target_met)throw Error('Render pressure exceeds the recorded frame-time target');
 report.source_after=await sourceVersion();if(report.source_after.sha256!==report.source.sha256)throw Error('Source changed during QA; rerun against a stable source version');
}catch(e){report.ok=false;report.error=String(e);if(e.cleanup)report.cleanup=e.cleanup;console.error(e);process.exitCode=1;}finally{await cleanup();console.log(JSON.stringify({ok:report.ok,error:report.error,cleanup:report.cleanup}));}
