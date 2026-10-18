import {mkdir,readFile,writeFile,unlink,access} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {root} from './runtime.mjs';

const folder=join(root,'.runtime/service'),configFile=join(folder,'config.json'),enabled=join(folder,'enabled');
const id=createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0,12);
const startupDir=join(process.env.APPDATA,'Microsoft/Windows/Start Menu/Programs/Startup');
const startup=join(startupDir,`AbyssWalker-${id}.vbs`),launcher=join(folder,'launch.vbs');
const taskName=`AbyssWalker-${id}`;
const action=process.argv[2]??'status',delay=ms=>new Promise(r=>setTimeout(r,ms));
const exists=async path=>{try{await access(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const installed=async()=>{if(!await exists(configFile))return false;const config=JSON.parse(await readFile(configFile,'utf8'));if(config.root!==root)throw Error('Service config belongs to another checkout');return config;};
const vb=s=>'"'+s.replaceAll('"','""')+'"';
function serviceTask(action){const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',join(root,'tools/windows-service-task.ps1'),'-Action',action,'-TaskName',taskName];if(action==='install')args.push('-Launcher',launcher);const result=spawnSync('powershell.exe',args,{encoding:'utf8',windowsHide:true,timeout:15000});if(result.error||result.status!==0)throw Error('Windows service task ('+action+', bounded 15s): '+(result.error?.message||result.stderr||result.stdout||'helper failed').trim());return JSON.parse(result.stdout.trim());}
async function request(path='/status',method='GET'){
 try{
  const state=JSON.parse(await readFile(join(folder,'state.json'),'utf8'));if(state.root!==root)throw Error('Service state belongs to another checkout');
  const response=await fetch(`http://127.0.0.1:${state.port}${path}`,{method,headers:{authorization:`Bearer ${state.token}`},signal:AbortSignal.timeout(2500)});
  if(!response.ok)throw Error('Service control returned '+response.status);return await response.json();
 }catch(e){if(e.code==='ENOENT'||e.cause?.code==='ECONNREFUSED'||e.name==='TimeoutError'||e.name==='AbortError')return null;throw e;}
}
async function autostart(){
 await mkdir(startupDir,{recursive:true});await writeFile(enabled,'enabled\n');
 // The outer host restarts even a crashed supervisor, and always hides its window.
 const config=await installed();const command=`"${config.node}" "${join(root,'tools/windows-service-runner.mjs')}"`;
 const contents=`Option Explicit\r\nDim shell, files, code\r\nSet shell = CreateObject("WScript.Shell")\r\nSet files = CreateObject("Scripting.FileSystemObject")\r\nDo While files.FileExists(${vb(enabled)})\r\n  code = shell.Run(${vb(command)}, 0, True)\r\n  If Not files.FileExists(${vb(enabled)}) Then WScript.Quit 0\r\n  WScript.Sleep 1000\r\nLoop\r\n`;
 await writeFile(launcher,contents);serviceTask('install');
 // Scheduler owns the host, so its lifetime is independent of the Codex terminal.
 await writeFile(startup,`CreateObject("WScript.Shell").Run ${vb(`schtasks.exe /Run /TN "${taskName}"`)}, 0, False\r\n`);
}
async function start(){
 if(!await installed())throw Error('Install first: pnpm service:install');await autostart();
 if(!await request()){
  serviceTask('start');
 }
 for(let n=0;n<180;n++){
  const state=await request();if(state?.phase==='running'){console.log('Running: http://127.0.0.1:8612/');console.log('Login autostart:',startup);return;}
  await delay(250);
 }
 throw Error('Service did not become ready; inspect '+join(folder,'stdout.log')+' and stderr.log');
}
async function stop(){
 await unlink(enabled).catch(e=>{if(e.code!=='ENOENT')throw e;});
 await unlink(startup).catch(e=>{if(e.code!=='ENOENT')throw e;});
 serviceTask('disable');
 const state=await request('/stop','POST');if(!state)return;
 for(let n=0;n<180;n++){if(!await request())return;await delay(250);}
 throw Error('Service stop not verified; data and ownership files retained');
}
if(action==='install'){
 const prior=await installed();await mkdir(folder,{recursive:true});
 const env={...prior?.env};for(const name of ['AW_PG_BIN','AW_DATABASE_URL','AW_TEST_LOGIN'])if(process.env[name]!==undefined)env[name]=process.env[name];
 await stop();await writeFile(configFile,JSON.stringify({root,node:process.execPath,env},null,2)+'\n');await start();
}else if(action==='start')await start();
else if(action==='restart'){
 if(!await installed())throw Error('Service is not installed');await stop();await start();
}else if(action==='stop'||action==='uninstall'){
 if(!await installed())throw Error('Service is not installed');await stop();if(action==='uninstall')await unlink(configFile);
 if(action==='uninstall')serviceTask('remove');
 console.log(action==='stop'?'Stopped; login autostart disabled until start.':'Uninstalled; data and logs retained.');
}else if(action==='status'){
 console.log('Installed:',Boolean(await installed()));console.log('Login autostart:',await exists(startup));console.log('Supervisor:',await request()??'not running');
 console.log('Windows task:',serviceTask('status'));
 for(const url of ['http://127.0.0.1:8612/','http://127.0.0.1:8612/api/health'])try{console.log(url,(await fetch(url,{signal:AbortSignal.timeout(2500)})).status);}catch{console.log(url,'unavailable');}
 console.log('Data:',join(root,'.runtime/dev/data'));console.log('Logs:',folder);
}else throw Error('Use install, start, restart, stop, status or uninstall.');
