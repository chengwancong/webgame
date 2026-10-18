import {spawn} from 'node:child_process';
import {readFile,writeFile,open} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import {Pool} from 'pg';
import assert from 'node:assert/strict';
import {root,freePort,stopChild,waitFor,registerApi} from '../runtime.mjs';
const out=resolve(root,'docs/reviews/pacing-tool-20261010/P5'),parent=JSON.parse(await readFile(resolve(root,'docs/reviews/pacing-tool-20261010/P4-gui/host.json'),'utf8')),owned=JSON.parse(await readFile(resolve(parent.work,'owner.json'),'utf8'));
assert(owned.temporary&&owned.owner===parent.ownerPid&&relative(resolve(root,'.qa'),parent.work).startsWith('run-'),'Only the current owned temporary cluster may host production QA');
const owner=new Pool({connectionString:parent.dsn}),database='pacing_tls',backend=await freePort(),port=await freePort(),url='https://127.0.0.1:'+port,dsn=parent.dsn.replace('/postgres','/'+database);let api,closing=false,proxy;
async function serve(){const log=await open(resolve(out,'https-api.log'),'a'),p=spawn(process.execPath,['--import','tsx','apps/api/src/main.ts'],{cwd:root,env:{...process.env,NODE_ENV:'production',AW_DATABASE_URL:dsn,AW_API_PORT:String(backend),AW_ORIGINS:url,AW_STATIC_ROOT:parent.production,AW_TEST_LOGIN:'0',AW_FIELD_QA:'0',AW_PACING_LAB:'0',AW_ISOLATED:'1'},stdio:['ignore',log.fd,log.fd,'ipc'],windowsHide:true});await log.close();await waitFor('http://127.0.0.1:'+backend+'/api/health',p);await registerApi({work:parent.work},p,'pacingTlsApi');return p;}
async function stop(){if(closing)return;closing=true;if(proxy){proxy.closeAllConnections();await new Promise(r=>proxy.close(r));}await stopChild(api);await owner.query('DROP DATABASE '+database);await owner.end();await writeFile(resolve(out,'production-host-cleanup.json'),JSON.stringify({stopped:true,temporaryDatabaseDropped:true,formalDatabaseTouched:false}));}
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>void stop().then(()=>process.exit()));
try{
 await owner.query('CREATE DATABASE '+database);api=await serve();await registerApi({work:parent.work},{pid:process.pid},'pacingTlsHost');
 proxy=https.createServer({key:await readFile(resolve(parent.work,'tls/server-key.pem')),cert:await readFile(resolve(parent.work,'tls/server-cert.pem'))},(req,res)=>{const upstream=http.request({hostname:'127.0.0.1',port:backend,path:req.url,method:req.method,headers:req.headers},reply=>{res.writeHead(reply.statusCode??502,reply.headers);reply.pipe(res);});upstream.on('error',()=>{res.writeHead(502);res.end('Temporary backend restarting');});req.pipe(upstream);});
 proxy.on('upgrade',(req,socket,head)=>{const upstream=net.connect(backend,'127.0.0.1',()=>{upstream.write(req.method+' '+req.url+' HTTP/1.1\r\n'+Object.entries(req.headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');if(head.length)upstream.write(head);socket.pipe(upstream);upstream.pipe(socket);});upstream.on('error',()=>socket.destroy());socket.on('error',()=>upstream.destroy());});
 await new Promise(r=>proxy.listen(port,'127.0.0.1',r));await writeFile(resolve(out,'production-host.json'),JSON.stringify({url,backend,port,dsn,ownerPid:process.pid,parentWork:parent.work,certificate:'temporary self-signed loopback certificate; browser trust exception is scoped to QA context only'},null,2));await writeFile(resolve(out,'production-control.json'),'{"reload":0,"stop":false}');console.log('PACING_PRODUCTION_HTTPS '+url);let revision=0;
 while(!closing){const control=JSON.parse(await readFile(resolve(out,'production-control.json'),'utf8'));if(control.stop)break;if(control.reload!==revision){await stopChild(api);api=await serve();revision=control.reload;console.log('PACING_TLS_API_RELOADED '+revision);}await new Promise(r=>setTimeout(r,500));}
}finally{await stop();}
