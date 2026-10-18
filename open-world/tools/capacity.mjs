import {randomUUID} from 'node:crypto';
import {cpus,totalmem} from 'node:os';
export async function capacityCheck(url,count=100,rounds=10){
 url=url.replace(/\/$/,'');const players=[],latency=[];let failures=0;
 async function request(cookie,path,body){const start=performance.now();const r=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();if(path==='combat/report')latency.push(performance.now()-start);if(!r.ok){failures++;throw Error(path+':'+data.code);}return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
 for(let i=0;i<count;i++){const session=await request('','session/login',{username:'cap_'+randomUUID().replaceAll('-','').slice(0,20)}),cookie=session.cookie;const state=(await request(cookie,'character',{name:'容量验证'})).data;const lease=(await request(cookie,'control',{client_id:randomUUID()})).data.lease_id;const permit=(await request(cookie,'permit',{lease_id:lease,region:'meadow'})).data;players.push({cookie,state,lease,permit,sequence:0,tick:0,build:permit.build});}
 for(let n=0;n<rounds;n++){await new Promise(r=>setTimeout(r,2000));await Promise.all(players.map(async p=>{
 const from=p.tick,to=from+60,ids=p.permit.spawns.slice(n*2,n*2+2);const report={command_id:randomUUID(),revision:p.state.revision,lease_id:p.lease,permit_id:p.permit.id,build:p.build,sequence:++p.sequence,from_tick:from,to_tick:to,kills:ids.map(m=>({source_id:m.id,tick:to-1}))};
 const receipt=(await request(p.cookie,'combat/report',report)).data;p.state=receipt.snapshot;p.tick=to;
 if(p.state.build!==p.build){p.permit=(await request(p.cookie,'permit',{lease_id:p.lease,region:'meadow'})).data;p.build=p.permit.build;}
 if(n%5===0)await request(p.cookie,'control/renew',{lease_id:p.lease});
 }));}
 const sorted=latency.sort((a,b)=>a-b);return {sessions:count,rounds,interval_ms:2000,reports:latency.length,failures,p50_ms:sorted[Math.floor(sorted.length*.5)],p95_ms:sorted[Math.floor(sorted.length*.95)],max_ms:sorted.at(-1),environment:{cpu:cpus()[0].model,logical_cpus:cpus().length,memory_bytes:totalmem(),node:process.version},limits:['Loopback including HTTP, validation, private reward creation and PostgreSQL commit','Not a four-core/eight-GB deployment benchmark','No renderer/player-understanding claim']};
}
