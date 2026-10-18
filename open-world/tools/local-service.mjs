import {mkdir,writeFile,access,rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join,dirname} from 'node:path';
import {homedir} from 'node:os';
import {root} from './runtime.mjs';

if(process.platform==='win32'){await import('./windows-service.mjs');}
else {
if(process.platform!=='darwin')throw Error('Local services support macOS and Windows.');
const label='com.abysswalker.openworld.dev',domain=`gui/${process.getuid()}`,target=`${domain}/${label}`;
const plist=join(homedir(),'Library','LaunchAgents',label+'.plist'),logs=join(root,'.runtime','service');
const action=process.argv[2]??'status';
const call=(args,required=true)=>{const r=spawnSync('/bin/launchctl',args,{encoding:'utf8'});if(required&&r.status!==0)throw Error(r.stderr.trim()||r.stdout.trim()||'launchctl failed');return r;};
const exists=async path=>{try{await access(path);return true;}catch(e){if(e.code==='ENOENT')return false;throw e;}};
const installed=async()=>{if(!await exists(plist))return false;const r=spawnSync('/usr/bin/plutil',['-convert','json','-o','-',plist],{encoding:'utf8'});if(r.status!==0)throw Error('Cannot read existing service file');const p=JSON.parse(r.stdout);if(p.Label!==label||p.WorkingDirectory!==root)throw Error('Service belongs to another checkout; not replacing it');return true;};
async function unload(){
 const observed=call(['print',target],false);
 if(observed.status!==0)return;
 const pid=Number(observed.stdout.match(/^\s*pid = (\d+)/m)?.[1]);
 call(['bootout',target]);
 if(!pid)return;
 for(let n=0;n<350;n++){
  try{process.kill(pid,0);}catch(e){if(e.code==='ESRCH')return;throw e;}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error('Previous service did not finish stopping; not starting a second owner');
}
const xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
if(action==='install'){
 await installed();await mkdir(join(homedir(),'Library','LaunchAgents'),{recursive:true});await mkdir(logs,{recursive:true});
 const strings=[process.execPath,join(root,'tools','dev.mjs')].map(s=>`<string>${xml(s)}</string>`).join('');
 const contents=`<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array>${strings}</array>
<key>WorkingDirectory</key><string>${xml(root)}</string>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>ThrottleInterval</key><integer>10</integer>
<key>ExitTimeOut</key><integer>30</integer>
<key>AbandonProcessGroup</key><false/>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${xml(dirname(process.execPath))}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string></dict>
<key>StandardOutPath</key><string>${xml(join(logs,'stdout.log'))}</string>
<key>StandardErrorPath</key><string>${xml(join(logs,'stderr.log'))}</string>
</dict></plist>\n`;
 await unload();
 await writeFile(plist,contents,{mode:0o600});
 const lint=spawnSync('/usr/bin/plutil',['-lint',plist],{encoding:'utf8'});if(lint.status!==0)throw Error(lint.stdout||lint.stderr);
 call(['enable',target]);call(['bootstrap',domain,plist]);
 console.log('Installed login service:',plist);
}else if(action==='start'||action==='restart'){
 if(!await installed())throw Error('Install first: node tools/local-service.mjs install');
 if(action==='restart')await unload();
 call(['enable',target]);if(call(['print',target],false).status!==0)call(['bootstrap',domain,plist]);else call(['kickstart',target]);
 console.log('Started.');
}else if(action==='stop'||action==='uninstall'){
 if(!await installed())throw Error('Service is not installed');
 call(['disable',target]);await unload();
 if(action==='uninstall')await rm(plist);
 console.log(action==='stop'?'Stopped; login autostart disabled until start.':'Uninstalled; data and logs retained.');
}else if(action==='status'){
 console.log('Installed:',await installed());const r=call(['print',target],false);
 if(r.status===0)console.log(r.stdout.split('\n').filter(l=>/^\s*(state|pid|runs|last exit code|last terminating signal) =/.test(l)).join('\n'));else console.log('Not loaded.');
 for(const url of ['http://127.0.0.1:8612/','http://127.0.0.1:8612/api/health']){try{const r=await fetch(url,{signal:AbortSignal.timeout(3000)});console.log(url,r.status);}catch{console.log(url,'unavailable');}}
 console.log('Logs:',logs);
}else throw Error('Use install, start, restart, stop, status or uninstall.');
}
