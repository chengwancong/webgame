import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
export function windowsProcessInfo(pid,mode='one',{timeoutMs=10000}={}){
 if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid process ID');
 if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw Error('Native process helper timeout must be 1..10000ms');
 const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',join(import.meta.dirname,'windows-process-info.ps1'),'-ProcessId',String(pid),'-Mode',mode],{encoding:'utf8',windowsHide:true,timeout:timeoutMs,maxBuffer:1024*1024});
 if(result.error||result.status!==0)throw Error('Verified Windows process identity unavailable; no PID-only fallback: '+(result.error?.message||result.stderr.trim()||'helper exited '+result.status));
 try{return JSON.parse(result.stdout.trim());}catch{throw Error('Verified Windows process helper returned invalid JSON');}
}
