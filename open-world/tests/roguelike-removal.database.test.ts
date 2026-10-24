import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,writeFileSync,existsSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,relative} from 'node:path';
import {Pool} from 'pg';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {hasRetiredDungeonData} from '../apps/api/src/dungeon-service.ts';
import {resolveDungeonContent} from '../packages/content/dungeons.ts';
import raw from '../packages/content/dungeons.json';
import {regionById,registerDungeonRegion} from '../packages/content/index.ts';
import {World} from '../packages/simulation/index.ts';
import type {DungeonView} from '../packages/contracts/dungeons.ts';

// Real HTTP + WS + PG, restricted to a disposable schema and authored fixture regions.
// Combat kills are produced by World; the client never sends kill/clear or reward claims.
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Use tools/vitest-tempdb.mjs for removal database acceptance');
const schema='qa_no_run_picks_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
const source=structuredClone(raw) as any;
const stageIds=['qa-no-picks-first','qa-no-picks-second'];
for(const [index,id]of stageIds.entries())registerDungeonRegion({...structuredClone(regionById('meadow')),id,name:'局外构筑推进夹具',width:24,height:24,obstacles:[],safe:{x:10,y:10},portal:{x:18,y:10},boss:index===1,spawns:[{id:`target-${index}`,name:'推进验证敌人',kind:'melee',x:12,y:10,hp:20,attack:1,boss:index===1,elite:false,art:'raider'}]},'meadow');
source.definitions.push({id:'qa-no-run-picks',name:'无局内强化推进验收',kind:'normal',profiles:['realtime'],area:'meadow',stages:stageIds,policy:{party:{min:1,max:1,roles:{},defaultRole:'damage'},normalGoals:{killCount:1,eliteCount:0},enemyScale:{hp:1,attack:1},timeLimitSeconds:120,retention:{enabled:true,seconds:60},entryCost:{gold:37,material:4}}});
const content=resolveDungeonContent(source),makeApp=()=>createApp(pool,{campaign:'legacy',testLogin:true,dungeons:content});
let app=makeApp(),origin='';const sockets:WebSocket[]=[];
async function listen(){await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+((app.server.address() as {port:number}).port);}
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await listen();});
afterAll(async()=>{for(const socket of sockets)socket.close();await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function until(check:()=>boolean|Promise<boolean>,timeout=15000){const limit=Date.now()+timeout;while(!await check()){if(Date.now()>limit)throw Error('No-picks dungeon flow timed out');await new Promise(r=>setTimeout(r,30));}}
async function player(){
 const username='qa_no_picks_'+randomUUID().slice(0,8),login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as never});
 const created=await request('character',{name:'局外构筑PG验收'});expect(created.statusCode,created.body).toBe(200);const id=created.json().id;
 const saved=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 delete saved.story;delete saved.starsea;saved.level=50;saved.gold=100000;saved.material=1000;saved.progress.regions=['town','meadow'];saved.skills=['cut'];saved.skillRanks={cut:1};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[saved,id]);
 const lease=(await request('control',{client_id:randomUUID()})).json().lease_id;
 return {id,username,cookie,request,lease,command:(op:string,extra:object={})=>request('dungeons/command',{command_id:randomUUID(),lease_id:lease,op,...extra})};
}
async function connect(p:Awaited<ReturnType<typeof player>>,id:string){
 let frame:DungeonView|undefined;const errors:string[]=[];
 const socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+id+'/live',{headers:{cookie:p.cookie}});sockets.push(socket);
 socket.on('message',raw=>{const message=JSON.parse(String(raw));if(message.type==='state'){frame=message.instance;expectNoRunPicks(message.instance);}else if(message.type==='error')errors.push(message.message);});
 await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));await until(()=>!!frame);
 return {socket,errors,get frame(){return frame!;}};
}
function expectNoRunPicks(value:unknown){
 const prohibited=new Set(['augments','augmentRounds','augmentPolicy','augmentExtra','augmentCatalog','augment_id','offer_version']);
 function walk(item:unknown){if(Array.isArray(item)){for(const row of item)walk(row);}else if(item&&typeof item==='object')for(const [key,child]of Object.entries(item)){expect(prohibited.has(key),'retired field '+key).toBe(false);walk(child);}}
 walk(value);
}
it('rejects retired choose/reroll commands as unknown input without touching the run, character or receipts',async()=>{
 const p=await player(),created=await p.command('create',{dungeon_id:'qa-no-run-picks'});expect(created.statusCode,created.body).toBe(200);const id=created.json().instance.id;
 const before=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,characterBefore=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 const receiptsBefore=(await pool.query('SELECT count(*)::int n FROM ow_dungeon_commands WHERE character=$1',[p.id])).rows[0].n;
 for(const op of ['augment.choose','augment.reroll']){const r=await p.command(op,{instance_id:id,augment_id:'retired',offer_version:1});expect(r.statusCode,r.body).toBe(400);expect(r.json().code).toBe('INPUT');}
 expect((await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data).toEqual(before);
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state).toEqual(characterBefore);
 expect((await pool.query('SELECT count(*)::int n FROM ow_dungeon_commands WHERE character=$1',[p.id])).rows[0].n).toBe(receiptsBefore);
 expect((await app.inject({url:'/api/health'})).statusCode).toBe(200);expectNoRunPicks(created.json().instance);expectNoRunPicks(before);
 expect((await p.command('leave',{instance_id:id})).statusCode).toBe(200);
});
it('clears the first segment and enters the second through real commands with the same frozen build and no pick gate',async()=>{
 const p=await player(),created=await p.command('create',{dungeon_id:'qa-no-run-picks'});expect(created.statusCode,created.body).toBe(200);const id=created.json().instance.id,live=await connect(p,id);
 expect((await p.command('ready',{instance_id:id})).statusCode).toBe(200);const started=await p.command('start',{instance_id:id});expect(started.statusCode,started.body).toBe(200);const frozen=structuredClone(started.json().instance.self.frozen);
 live.socket.send(JSON.stringify({type:'input',input:{seq:1,kind:'mode',mode:'auto'}}));
 await until(()=>live.frame.checkpoint);expect(live.frame.stage).toBe(0);expect(live.frame.objectives.every(o=>o.completed)).toBe(true);expectNoRunPicks(live.frame);
 const savedBefore=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,old=World.restore(savedBefore.battle);old.focusPlayer(p.id);const counters=structuredClone(old.effectStats);
 expect((await p.command('ready',{instance_id:id})).statusCode).toBe(200);const next=await p.command('next',{instance_id:id});expect(next.statusCode,next.body).toBe(200);expect(next.json().instance.stage).toBe(1);expect(next.json().instance.self.frozen).toEqual(frozen);expectNoRunPicks(next.json().instance);
 const saved=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data;expectNoRunPicks(saved);expect(saved.stageBattles).toHaveLength(1);const world=World.restore(saved.battle);world.focusPlayer(p.id);for(const [rule,count]of Object.entries(counters))expect(world.effectStats[rule]?.count).toBeGreaterThanOrEqual(count.count);
 await until(()=>live.frame.status==='success');const result=await p.request('dungeons/'+id+'/result');expect(result.statusCode,result.body).toBe(200);expectNoRunPicks(result.json());expect(live.errors).toEqual([]);
},30000);
it('restores a current checkpoint with its original entry build instead of resolving a changed character again',async()=>{
 const p=await player(),created=await p.command('create',{dungeon_id:'qa-no-run-picks'}),id=created.json().instance.id,live=await connect(p,id);
 await p.command('ready',{instance_id:id});const started=await p.command('start',{instance_id:id});expect(started.statusCode,started.body).toBe(200);live.socket.send(JSON.stringify({type:'input',input:{seq:1,kind:'mode',mode:'auto'}}));await until(()=>live.frame.checkpoint);
 const before=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,entry=structuredClone(before.members[0].frozen);live.socket.close();await app.close();
 const character=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;character.level=99;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[character,p.id]);
 app=makeApp();await listen();const resumed=await connect(p,id);expect(resumed.frame.self!.frozen).toEqual(entry);expectNoRunPicks(resumed.frame);
 const stored=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data;expect(stored.members[0].frozen).toEqual(entry);expectNoRunPicks(stored);await p.command('leave',{instance_id:id});
},30000);
it('quarantines an old checkpoint without executing it, writing characters, or erasing its retained data',async()=>{
 const p=await player(),createInput={command_id:randomUUID(),lease_id:p.lease,op:'create',dungeon_id:'qa-no-run-picks'},created=await p.request('dungeons/command',createInput);expect(created.statusCode,created.body).toBe(200);const id=created.json().instance.id;await app.close();
 // This backup is an in-memory copy of our own disposable fixture, not a live save migration.
 const backup=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,legacy={...structuredClone(backup),augments:{legacy:{}}};
 await pool.query('UPDATE ow_dungeons SET data=$1 WHERE id=$2',[legacy,id]);const characterBefore=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 const legacyReceipt=created.json();legacyReceipt.instance.definition.policy.augments={enabled:true};await pool.query('UPDATE ow_dungeon_commands SET response=$1 WHERE character=$2 AND command=$3',[legacyReceipt,p.id,createInput.command_id]);
 expect(hasRetiredDungeonData(legacy)).toBe(true);expect(hasRetiredDungeonData(backup)).toBe(false);app=makeApp();await listen();
 const result=await p.request('dungeons/'+id+'/result');expect(result.statusCode,result.body).toBe(409);expect(result.json().code).toBe('DUNGEON_RETIRED');expect(result.json()).not.toHaveProperty('instance');
 const replay=await p.request('dungeons/command',createInput);expect(replay.statusCode,replay.body).toBe(409);expect(replay.json().code).toBe('DUNGEON_RETIRED');
 expect((await pool.query('SELECT response FROM ow_dungeon_commands WHERE character=$1 AND command=$2',[p.id,createInput.command_id])).rows[0].response).toEqual(legacyReceipt);
 expect((await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data).toEqual(legacy);
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state).toEqual(characterBefore);expect((await app.inject({url:'/api/health'})).statusCode).toBe(200);
});
it('the explicit QA maintenance plan is read-only and apply backs up before freeing only owned instance membership',async()=>{
 const p=await player(),created=await p.command('create',{dungeon_id:'qa-no-run-picks'});expect(created.statusCode,created.body).toBe(200);const id=created.json().instance.id;await app.close();
 const raw=(await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data,legacy={...raw,augments:{legacy:{}}};await pool.query('UPDATE ow_dungeons SET data=$1 WHERE id=$2',[legacy,id]);
 const characterBefore=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state,awardsBefore=(await pool.query('SELECT * FROM ow_dungeon_awards WHERE character=$1 ORDER BY source',[p.id])).rows,receiptsBefore=(await pool.query('SELECT * FROM ow_dungeon_commands WHERE character=$1 ORDER BY command',[p.id])).rows;
 const folder=mkdtempSync(join(tmpdir(),'qa-retire-')),ownerFile=join(folder,'owner.json'),backup=join(folder,'backup.json'),url=new URL(dsn!);url.searchParams.set('options','-c search_path='+schema);
 writeFileSync(ownerFile,JSON.stringify({username:p.username,characterId:p.id,ownershipSource:'fresh disposable PG test fixture'}),{mode:0o600});
 const execute=(args:string[])=>JSON.parse(execFileSync(process.execPath,['tools/roguelike-retire-instances.mjs','--owner',ownerFile,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,AW_DATABASE_URL:url.href}}));
 try{
  const plan=execute([]);expect(plan).toMatchObject({mode:'plan',instanceCount:1,characterWrites:0,rewardWrites:0});expect(plan.instances).toEqual([id]);expect(existsSync(backup)).toBe(false);expect((await pool.query('SELECT data FROM ow_dungeons WHERE id=$1',[id])).rows[0].data).toEqual(legacy);
  const applied=execute(['--apply','--api-stopped','--backup',backup]);expect(applied).toMatchObject({mode:'apply',instanceCount:1,backupWritten:true,characterWrites:0,rewardWrites:0});
  const archived=JSON.parse(readFileSync(backup,'utf8'));expect(archived.instances[0].data).toEqual(legacy);expect(archived.members.every((member:{character:string})=>member.character===p.id)).toBe(true);
  expect((await pool.query('SELECT status FROM ow_dungeons WHERE id=$1',[id])).rows[0].status).toBe('closed');expect((await pool.query('SELECT active FROM ow_dungeon_members WHERE instance=$1',[id])).rows.every(row=>row.active===false)).toBe(true);
  expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state).toEqual(characterBefore);expect((await pool.query('SELECT * FROM ow_dungeon_awards WHERE character=$1 ORDER BY source',[p.id])).rows).toEqual(awardsBefore);expect((await pool.query('SELECT * FROM ow_dungeon_commands WHERE character=$1 ORDER BY command',[p.id])).rows).toEqual(receiptsBefore);
 }finally{const child=relative(tmpdir(),folder);if(!/^qa-retire-[^\\/]+$/.test(child))throw Error('Refusing unsafe temporary backup cleanup');rmSync(folder,{recursive:true,force:true});app=makeApp();await listen();}
 const fresh=await p.command('create',{dungeon_id:'qa-no-run-picks'});expect(fresh.statusCode,fresh.body).toBe(200);expect(fresh.json().instance.id).not.toBe(id);await p.command('leave',{instance_id:fresh.json().instance.id});
},30000);
