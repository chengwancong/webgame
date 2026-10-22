import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {dungeonViewSchema} from '../packages/contracts/dungeons.ts';
import {standardState} from '../tools/spine/player.ts';
import {resolveBuild} from '../packages/rules/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real isolated PostgreSQL required');
const schema='qa_p27_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:6}),app=createApp(pool,{testLogin:true});let origin='';const sockets:WebSocket[]=[];
const ids=['nightmare-tundra','nightmare-abyss','nightmare-dragonbone'];
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+(app.server.address() as any).port;});
afterAll(async()=>{for(const s of sockets)s.close();await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function actor(model=false){
 const login=await fetch(origin+'/api/session/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({username:'p27_'+randomUUID().slice(0,8)})}),cookie=login.headers.get('set-cookie')!.split(';')[0];
 const req=async(path:string,body?:unknown)=>{const r=await fetch(origin+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{cookie,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json() as any};};
 const created=(await req('character',{name:'P27隔离验收'})).body;let s=created;
 if(model){const baseline=standardState(50),before=resolveBuild(baseline),map=new Map(baseline.gear.map(g=>[g.id,randomUUID()]));const remap=(value:any):any=>typeof value==='string'?map.get(value)??value:Array.isArray(value)?value.map(remap):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[map.get(k)??k,remap(v)])):value;s={...remap(baseline),id:created.id,name:created.name,revision:created.revision,build:created.build};const after=resolveBuild(s);for(const key of ['hp','attack','armor','mana','speed'] as const)expect(after.stats[key]).toBe(before.stats[key]);expect(after.resolvedSkills.map(k=>({id:k.id,damage:k.damage,cooldown:k.cooldown}))).toEqual(before.resolvedSkills.map(k=>({id:k.id,damage:k.damage,cooldown:k.cooldown})));}
 s.level=50;s.starsea.features=[...new Set([...s.starsea.features,'nightmare'])];s.progress.regions=['town','meadow','forest','rift','tundra','abyss','dragonbone'];s.gold=1000;s.material=100;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const lease=(await req('control',{client_id:randomUUID()})).body.lease_id,command=(op:string,extra:object={})=>req('dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...extra});
 return {id:s.id,req,command,cookie,lease};
}
async function connect(p:Awaited<ReturnType<typeof actor>>,id:string){
 const socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie:p.cookie}});sockets.push(socket);let frame:any;socket.on('message',raw=>{const r=JSON.parse(String(raw));if(r.type==='state')frame=dungeonViewSchema.parse(r.instance);});
 await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));const heartbeat=setInterval(()=>{if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify({type:'ping'}));void p.req('control/renew',{lease_id:p.lease});},5000);
 const deadline=Date.now()+5000;while(!frame&&Date.now()<deadline)await new Promise(r=>setTimeout(r,25));expect(frame).toBeTruthy();return {socket,get frame(){return frame;},close:()=>{clearInterval(heartbeat);socket.close();}};
}
async function begin(p:Awaited<ReturnType<typeof actor>>,entry:string){const made=await p.command('create',{dungeon_id:entry,tier:1});expect(made.status,JSON.stringify(made.body).slice(0,200)).toBe(200);const id=made.body.instance.id,peer=await connect(p,id);expect((await p.command('ready',{instance_id:id})).status).toBe(200);expect((await p.command('start',{instance_id:id})).status).toBe(200);return {id,peer};}
it('public entries and actual dungeon catalogue enforce level/region, with exact formal mappings and original entry retained',async()=>{
 const p=await actor(),s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;s.level=49;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 let catalogue=(await p.req('dungeons/catalog')).body.entries;expect(ids.every(id=>catalogue.find((r:any)=>r.definition.id===id).reason.includes('50'))).toBe(true);
 s.level=50;s.progress.regions=['town'];await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);catalogue=(await p.req('dungeons/catalog')).body.entries;expect(ids.every(id=>catalogue.find((r:any)=>r.definition.id===id).reason.includes('对应地区'))).toBe(true);
 s.progress.regions.push('tundra','abyss','dragonbone');await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);catalogue=(await p.req('dungeons/catalog')).body.entries;
 for(const id of ids){const row=catalogue.find((r:any)=>r.definition.id===id),declared=challengeContent.entries.find(e=>e.id===id)!;expect(row.eligible,row.reason).toBe(true);expect(row.definition).toMatchObject({name:declared.name,kind:'nightmare',stages:[declared.region],quota:{pool:'nightmare',period:'day',limit:5},policy:{monsterLevel:50,enemyScale:{hp:declared.hp,attack:declared.attack}}});}
 expect(catalogue.find((r:any)=>r.definition.id==='nightmare').definition.policy.enemyScale).toMatchObject({hp:54.2,attack:4.4});expect((await p.req('challenges')).body.entries.filter((r:any)=>ids.includes(r.id))).toHaveLength(3);
});
it('five actual starts across old and new entries consume one shared Beijing daily pool',async()=>{
 const p=await actor();for(const [index,id]of [...ids,'nightmare',ids[0]].entries()){const run=await begin(p,id);try{expect((await p.command('leave',{instance_id:run.id})).status).toBe(200);await p.command('return',{instance_id:run.id});const rows=(await p.req('dungeons/catalog')).body.entries.filter((r:any)=>r.definition.kind==='nightmare');expect(rows).toHaveLength(4);expect(rows.every((r:any)=>r.used===index+1&&r.limit===5)).toBe(true);}finally{run.peer.close();}}
 const rejected=await p.command('create',{dungeon_id:ids[1],tier:1});expect(rejected.status).toBe(409);expect(rejected.body.code).toBe('DUNGEON_LOCKED');expect(rejected.body.message).toContain('次数');
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;expect(Object.keys(s.challengeProgress.daily).filter(k=>k.startsWith('nightmare:'))).toHaveLength(1);expect(Object.values(s.challengeProgress.daily)).toContain(5);
},30000);
it('each published entry completes through actual server execution and persistent rewards are not repeated by result reads',async()=>{
 const p=await actor(true);
 for(const id of ids){const before=(await p.req('character')).body,entry=challengeContent.entries.find(e=>e.id===id)!,run=await begin(p,id);try{
  const until=Date.now()+45000;while(!['success','failed','abandoned','closed'].includes(run.peer.frame?.status)&&Date.now()<until)await new Promise(r=>setTimeout(r,100));
  const result=await p.req('dungeons/'+run.id+'/result');expect(result.status).toBe(200);expect(result.body.instance.outcome,JSON.stringify({id,status:result.body.instance.status,reason:result.body.instance.reason})).toBe('success');
  const after=(await p.req('character')).body;expect(after.gold-before.gold).toBe(entry.reward.gold);expect(after.material-before.material).toBe(entry.reward.material);
  const receiptsBefore=Number((await pool.query('SELECT count(*) n FROM ow_ledger WHERE character=$1',[p.id])).rows[0].n);await p.req('dungeons/'+run.id+'/result');await p.req('dungeons/'+run.id+'/result');expect(Number((await pool.query('SELECT count(*) n FROM ow_ledger WHERE character=$1',[p.id])).rows[0].n)).toBe(receiptsBefore);expect((await p.req('character')).body.gold).toBe(after.gold);
  expect((await pool.query('SELECT 1 FROM ow_dungeon_completions WHERE character=$1 AND instance=$2',[p.id,run.id])).rowCount).toBe(1);await p.command('return',{instance_id:run.id});
 }finally{run.peer.close();}}
},150000);
