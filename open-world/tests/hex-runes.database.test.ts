// @ts-nocheck
// Retired D11/D12 socket/choice specifications. D13 explicitly removed this
// protocol. Kept for history; current acceptance is tests/hex-affix*.test.ts.
import {beforeAll,afterAll,it as historicalIt,expect} from 'vitest';
const it=historicalIt.skip;
import {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import WebSocket from 'ws';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {receiptSchema,snapshotSchema,validateResponse,versions} from '../packages/contracts/index.ts';
import {rewards as economy} from '../apps/api/src/economy.ts';
import {newStarseaState} from '../packages/rules/starsea.ts';
import {makeHexGear} from '../packages/rules/hex-runes.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('HEX integration needs isolated real PostgreSQL');
const schema='qa_hex_'+randomUUID().replaceAll('-','');
const owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
const app=createApp(pool,{campaign:'legacy',testLogin:true,devCheckpoints:true});
let origin:string;
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.listen({host:'127.0.0.1',port:0});origin='http://127.0.0.1:'+(app.server.address() as {port:number}).port;});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function player(prefix='qa_'){
 const username=prefix+randomUUID().replaceAll('-','').slice(0,15);
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username}});
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,payload?:unknown)=>{const r=await app.inject({method:payload===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:payload as any});return {status:r.statusCode,body:r.json()};};
 const created=await request('character',{name:'样板测试'});expect(created.status).toBe(200);
 const id=created.body.id,lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;s.level=30;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);
 let revision=s.revision;
 const command=<T extends object>(extra:T)=>({command_id:randomUUID(),revision,lease_id:lease,...extra});
 const send=async(path:string,extra:object)=>{const body=command(extra),r=await request(path,body);if(r.status===200){validateResponse(path,r.body);revision=r.body.revision;}return {...r,input:body};};
 return {request,command,send,id,username,cookie,lease};
}
async function auditHex(id:string){
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state;
 const counts=(await pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1) receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1) ledger',[id])).rows[0];
 return {state,counts};
}
async function prepareHexQuestState(id:string,done:string[]=[]){
 const s=(await auditHex(id)).state;
 s.starsea=newStarseaState();Object.assign(s.starsea,{quests:{},tracked:null,done,islands:['ss-map-wind','ss-map-mist'],discovered:['ow-mist-z2'],prologue:{done:true}});
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);
}
it('D12 real API rejects locked slots, freezes four choices, and serializes competing picks into one gear/receipt/ledger',async()=>{
 const p=await player();await prepareHexQuestState(p.id);
 const grant=await p.send('dev/hex-grant',{base:'hex-aftershock',quality:'common'}),gear_id=grant.body.delta.gear[0].id;
 const locked=await p.send('hex/equip',{gear_id,slot:'hex1'});expect(locked.body.code).toBe('HEX_SLOT_LOCKED');
 const state=(await auditHex(p.id)).state;state.starsea.done.push('HEX-Q01');
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,p.id]);
 // Controlled completed-quest fixture; offer generation, choice commands and
 // all persistence/receipt guards below run through the real application.
 const trigger=await p.send('hex/equip',{gear_id,slot:'hex1'});expect(trigger.status).toBe(200);
 const offer=trigger.body.snapshot.hex.offers.find((o:any)=>o.task==='HEX-Q01');
 expect(offer.candidates).toHaveLength(4);expect(new Set(offer.candidates.map((c:any)=>c.playstyle)).size).toBe(4);
 const before=await auditHex(p.id),a=p.command({offer_id:offer.id,candidate_id:offer.candidates[0].id}),b=p.command({offer_id:offer.id,candidate_id:offer.candidates[1].id});
 const [left,right]=await Promise.all([p.request('hex/choose',a),p.request('hex/choose',b)]);
 const winner=left.status===200?left:right,loser=left.status===200?right:left,input=left.status===200?a:b;
 expect(winner.status).toBe(200);validateResponse('hex/choose',winner.body);expect(loser.body.code).toBe('REVISION');
 const after=await auditHex(p.id);
 expect(after.state.gear.length).toBe(before.state.gear.length+1);expect(after.state.gear.filter((g:any)=>g.id===input.candidate_id)).toHaveLength(1);
 expect(after.counts).toEqual({receipts:before.counts.receipts+1,ledger:before.counts.ledger+1});
 expect((await p.request('hex/choose',input)).body).toEqual(winner.body);expect(await auditHex(p.id)).toEqual(after);
 expect((await p.request('hex/choose',{...input,candidate_id:randomUUID()})).body.code).toBe('COMMAND_CONFLICT');
 const again=await p.request('hex/choose',{...p.command({offer_id:offer.id,candidate_id:offer.candidates[2].id}),revision:after.state.revision});
 expect(again.body.code).toBe('GEAR');expect(await auditHex(p.id)).toEqual(after);
});
it('D12 full inventory and forged candidate rejection preserve the frozen choice and allow a later legitimate pick',async()=>{
 const p=await player();await prepareHexQuestState(p.id,['HEX-Q01']);
 const grant=await p.send('dev/hex-grant',{base:'hex-footfall-heal',quality:'common'}),offer=grant.body.snapshot.hex.offers[0];
 const forged=await p.send('hex/choose',{offer_id:offer.id,candidate_id:randomUUID()});expect(forged.body.code).toBe('INPUT');
 const s=(await auditHex(p.id)).state;
 while(s.gear.length<60)s.gear.push(makeHexGear('hex-aftershock','common',randomUUID()));
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const before=await auditHex(p.id),full=await p.send('hex/choose',{offer_id:offer.id,candidate_id:offer.candidates[0].id});
 expect(full.body.code).toBe('CAPACITY');expect(await auditHex(p.id)).toEqual(before);
 const salvage=await p.send('gear/salvage',{gear_id:s.gear.at(-1).id});expect(salvage.status).toBe(200);
 const choose=await p.send('hex/choose',{offer_id:offer.id,candidate_id:offer.candidates[0].id});expect(choose.status).toBe(200);
 expect(choose.body.snapshot.hex.offers[0].candidates).toEqual(offer.candidates);
 expect(choose.body.snapshot.hex.offers[0].selected).toBe(offer.candidates[0].id);
});
it.each(['hex-footfall-heal','hex-control-to-shield','hex-cast-hit-relay','hex-void-rift','hex-mark-relay','hex-bee-volley'])('D11 %s common/magic persist through real API equip, replay and reconnect without issuing unavailable tiers',async base=>{
 const p=await player(),content=await p.request('content'),entry=content.body.hexRunes.find((r:any)=>r.id===base);
 expect(Object.keys(entry.tiers)).toEqual(['common','magic']);expect(entry.playstyle).toBeTruthy();expect(entry.flavor).toBeTruthy();
 for(const quality of ['common','magic']){
  const grant=await p.send('dev/hex-grant',{base,quality});expect(grant.status).toBe(200);
  const gear_id=grant.body.delta.gear[0].id,equip=await p.send('hex/equip',{gear_id,slot:'hex1'});expect(equip.status).toBe(200);
  const before=await auditHex(p.id);expect(before.state.equipment.hex1).toBe(gear_id);
  expect((await p.request('hex/equip',equip.input)).body).toEqual(equip.body);
  expect(await auditHex(p.id)).toEqual(before);
  const again=await app.inject({method:'POST',url:'/api/session/login',payload:{username:p.username}});
  expect(again.statusCode).toBe(200);
  const after=await auditHex(p.id);expect(after.state.gear).toEqual(before.state.gear);expect(after.state.equipment.hex1).toBe(gear_id);
 }
 const before=await auditHex(p.id),denied=await p.send('dev/hex-grant',{base,quality:'rare'});
 expect(denied.status).not.toBe(200);expect(await auditHex(p.id)).toEqual(before);
});
it('HEX-A04 parallel equip commands serialize revision and leave exactly one receipt and ledger',async()=>{
 const p=await player(),g=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'}),gear_id=g.body.delta.gear[0].id;
 const before=await auditHex(p.id),left=p.command({gear_id,slot:'hex1'}),right=p.command({gear_id,slot:'hex2'});
 const results=await Promise.all([p.request('hex/equip',left),p.request('hex/equip',right)]);
 const ok=results.find(r=>r.status===200)!,denied=results.find(r=>r.status!==200)!;
 expect(ok).toBeDefined();expect(denied.status).toBe(409);expect(denied.body.code).toBe('REVISION');
 const after=await auditHex(p.id);
 expect(after.state.revision).toBe(before.state.revision+1);expect(after.state.build).toBe(before.state.build+1);
 expect(after.state.gear).toEqual(before.state.gear);
 expect([after.state.equipment.hex1,after.state.equipment.hex2].filter(Boolean)).toEqual([gear_id]);
 expect(after.counts).toEqual({receipts:before.counts.receipts+1,ledger:before.counts.ledger+1});
 const winner=results[0].status===200?left:right,loser=winner===left?right:left;
 expect((await p.request('hex/equip',winner)).body).toEqual(ok.body);
 expect((await p.request('hex/equip',{...winner,slot:winner.slot==='hex1'?'hex2':'hex1'})).body.code).toBe('COMMAND_CONFLICT');
 expect((await p.request('hex/equip',loser)).body.code).toBe('REVISION');
 expect(await auditHex(p.id)).toEqual(after);
});
it('HEX-A04 parallel identical commands return one saved equip receipt without duplicate writes',async()=>{
 const p=await player(),g=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'magic'}),gear_id=g.body.delta.gear[0].id;
 const before=await auditHex(p.id),input=p.command({gear_id,slot:'hex1'});
 const responses=await Promise.all(Array.from({length:4},()=>p.request('hex/equip',input)));
 for(const response of responses){expect(response.status).toBe(200);expect(response.body).toEqual(responses[0].body);}
 const after=await auditHex(p.id);
 expect(after.state.revision).toBe(before.state.revision+1);expect(after.state.gear).toEqual(before.state.gear);
 expect(after.counts).toEqual({receipts:before.counts.receipts+1,ledger:before.counts.ledger+1});
});
it('HEX-A05 real dungeon lifecycle blocks equip move and unequip, preserves old receipts and unlocks after leave',async()=>{
 const p=await player();
 const a=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'}),b=await p.send('dev/hex-grant',{base:'hex-aftershock',quality:'common'});
 const first=a.body.delta.gear[0].id,second=b.body.delta.gear[0].id;
 const equipped=await p.send('hex/equip',{gear_id:first,slot:'hex1'});expect(equipped.status).toBe(200);
 const command=async(op:string,extra:object={})=>p.request('dungeons/command',{command_id:randomUUID(),lease_id:p.lease,op,...extra});
 const created=await command('create',{dungeon_id:'normal-meadow'});expect(created.status,JSON.stringify(created.body)).toBe(200);
 const instance=created.body.instance.id,socket=new WebSocket(origin.replace('http','ws')+'/api/dungeons/'+instance+'/live',{headers:{cookie:p.cookie}});
 const frame=new Promise<void>((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('No authenticated dungeon state')),10000);
  socket.on('message',raw=>{const data=JSON.parse(String(raw));if(data.type==='state'){clearTimeout(timer);resolve();}});
  socket.once('error',error=>{clearTimeout(timer);reject(error);});
 });
 try{
  await new Promise<void>((resolve,reject)=>{socket.once('open',resolve);socket.once('error',reject);});
  socket.send(JSON.stringify({type:'hello',lease_id:p.lease}));await frame;
  expect((await command('ready',{instance_id:instance})).status).toBe(200);
  const started=await command('start',{instance_id:instance});expect(started.status,JSON.stringify(started.body)).toBe(200);
  expect(started.body.instance.status).toBe('running');expect(started.body.instance.definition.policy.buildLocked).toBe(true);
  const before=await auditHex(p.id);
  for(const [path,extra]of [
   ['hex/equip',{gear_id:second,slot:'hex2'}],['hex/equip',{gear_id:first,slot:'hex2'}],['hex/unequip',{slot:'hex1'}],
  ] as const){
   const r=await p.request(path,{command_id:randomUUID(),lease_id:p.lease,revision:before.state.revision,...extra});
   expect(r.status).toBe(409);expect(r.body.code).toBe('DUNGEON_BUILD_LOCKED');
  }
  expect((await p.request('hex/equip',equipped.input)).body).toEqual(equipped.body);
  expect(await auditHex(p.id)).toEqual(before);
  expect((await command('leave',{instance_id:instance})).status).toBe(200);
  const afterLeave=await auditHex(p.id);
  const off=await p.request('hex/unequip',{command_id:randomUUID(),lease_id:p.lease,revision:afterLeave.state.revision,slot:'hex1'});
  expect(off.status,JSON.stringify(off.body)).toBe(200);expect(off.body.snapshot.equipment.hex1).toBeUndefined();
  expect(off.body.snapshot.gear.map((g:any)=>g.id)).toEqual(afterLeave.state.gear.map((g:any)=>g.id));
 }finally{socket.close();await command('leave',{instance_id:instance});}
},30000);
it.each(['common','magic','rare','legendary'] as const)('restores saved %s HEX gear and its receipt through a fresh API instance',async quality=>{
 const p=await player(),grant=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality});expect(grant.status).toBe(200);
 const gear=grant.body.delta.gear[0],equip=await p.send('hex/equip',{gear_id:gear.id,slot:'hex2'});expect(equip.status).toBe(200);
 const restored=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
 try{
  await restored.ready();
  const login=await restored.inject({method:'POST',url:'/api/session/login',payload:{username:p.username}});
  expect(login.statusCode).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
  const read=await restored.inject({method:'GET',url:'/api/character',headers:{cookie}});expect(read.statusCode).toBe(200);
  const snapshot=snapshotSchema.parse(read.json());
  expect(snapshot.id).toBe(p.id);expect(snapshot.revision).toBe(equip.body.revision);expect(snapshot.equipment.hex2).toBe(gear.id);
  expect(snapshot.gear.filter(g=>g.id===gear.id)).toEqual([gear]);
  const rules=snapshot.stats.rules?.filter(r=>r.source===gear.id);
  expect(rules).toEqual(equip.body.snapshot.stats.rules.filter((r:any)=>r.source===gear.id));
  expect(rules?.[0].action).toMatchObject({type:'arc',...(quality==='rare'?{status:{kind:'slow'}}:quality==='legendary'?{status:{kind:'shock'}}:{})});
  const receipt=await restored.inject({method:'GET',url:'/api/receipt/'+equip.input.command_id,headers:{cookie}});
  expect(receipt.statusCode).toBe(200);expect(receipt.json()).toEqual(equip.body);
  const denied=await restored.inject({method:'POST',url:'/api/dev/hex-grant',headers:{cookie},payload:p.command({base:'hex-chain-lightning',quality})});
  expect(denied.statusCode).toBe(404);
 }finally{await restored.close();}
});
it('publishes display-only HEX data and deduplicates grant/equip/move/unequip receipts',async()=>{
 const p=await player();const content=(await p.request('content')).body.hexRunes;
 expect(content[0].id).toBe('hex-chain-lightning');expect(content[0].tiers.rare.description).toContain('减速');expect(content[0].tiers.common).not.toHaveProperty('rules');
 const grant=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'});expect(grant.status).toBe(200);
 const gear=grant.body.delta.gear[0];expect((await p.request('dev/hex-grant',grant.input)).body).toEqual(grant.body);
 const equipped=await p.send('hex/equip',{gear_id:gear.id,slot:'hex1'});expect(equipped.status).toBe(200);
 expect(receiptSchema.parse(equipped.body).snapshot.equipment.hex1).toBe(gear.id);
 expect(equipped.body.snapshot.stats.rules.some((r:any)=>r.id==='hex-chain-lightning-c'&&r.source===gear.id)).toBe(true);
 expect((await p.request('hex/equip',equipped.input)).body).toEqual(equipped.body);
 expect((await p.request('hex/equip',{...equipped.input,slot:'hex2'})).body.code).toBe('COMMAND_CONFLICT');
 const moved=await p.send('hex/equip',{gear_id:gear.id,slot:'hex2'});expect(moved.status).toBe(200);
 expect(moved.body.revision).toBe(equipped.body.revision+1);expect(moved.body.snapshot.equipment.hex1).toBeUndefined();expect(moved.body.snapshot.equipment.hex2).toBe(gear.id);
 const off=await p.send('hex/unequip',{slot:'hex2'});expect(off.status).toBe(200);expect(off.body.snapshot.equipment.hex2).toBeUndefined();
 expect(off.body.snapshot.stats.rules?.some((r:any)=>r.id.startsWith('hex-'))??false).toBe(false);
 expect((await p.request('character')).body.gear.filter((g:any)=>g.id===gear.id)).toHaveLength(1);
 if(process.env.AW_HEX_EVIDENCE==='1')console.info('HEX_HTTP_EVIDENCE',JSON.stringify({equip:{path:'/api/hex/equip',request:equipped.input,response:{command_id:equipped.body.command_id,revision:equipped.body.revision,equipment:equipped.body.snapshot.equipment,rules:equipped.body.snapshot.stats.rules.filter((r:any)=>r.id.startsWith('hex-'))}},move:{request:moved.input,equipment:moved.body.snapshot.equipment},unequip:{request:off.input,equipment:off.body.snapshot.equipment}}));
});
it('rejects duplicate groups and unsupported modification without changing revision or inventory',async()=>{
 const p=await player(),a=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'}),b=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'rare'});
 const first=a.body.delta.gear[0].id,second=b.body.delta.gear[0].id;
 expect((await p.send('hex/equip',{gear_id:first,slot:'hex1'})).status).toBe(200);
 const before=(await p.request('character')).body;
 for(const [path,body,code] of [
  ['hex/equip',{gear_id:second,slot:'hex2'},'GEAR'],
  ['hex/equip',{gear_id:second,slot:'weapon'},'INPUT'],
  ['gear/equip',{gear_id:second},'GEAR'],
  ['gear/upgrade',{gear_id:second},'GEAR'],
  ['gear/reroll',{gear_id:second},'GEAR'],
  ['progression/action',{action:{op:'aspect.imprint',target:second,value:'aspect-1'}},'GEAR'],
 ] as const){const failed=await p.send(path,body);expect(failed.body.code).toBe(code);expect(failed.status).toBeLessThan(500);}
 const after=(await p.request('character')).body;expect(after.revision).toBe(before.revision);expect(after.gear).toEqual(before.gear);expect(after.gold).toBe(before.gold);
});
it('enforces revision, control lease and field build locks for both HEX operations',async()=>{
 const p=await player(),grant=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'}),gear_id=grant.body.delta.gear[0].id;
 const input=p.command({gear_id,slot:'hex1'});
 expect((await p.request('hex/equip',{...input,revision:input.revision-1})).body.code).toBe('REVISION');
 expect((await p.request('hex/equip',{...input,lease_id:randomUUID()})).body.code).toBe('CONTROL');
 await pool.query("INSERT INTO ow_field_activities(character,target,instance,status,data) VALUES($1,'hex-lock-test',$2,'running','{}')",[p.id,randomUUID()]);
 expect((await p.send('hex/equip',{gear_id,slot:'hex1'})).body.code).toBe('FIELD_BUILD_LOCKED');
 expect((await p.send('hex/unequip',{slot:'hex1'})).body.code).toBe('FIELD_BUILD_LOCKED');
 await pool.query("DELETE FROM ow_field_activities WHERE character=$1",[p.id]);
 expect((await p.request('character')).body.revision).toBe(input.revision);
});
it('rejects HEX equip and unequip while the character belongs to a build-locked dungeon',async()=>{
 const p=await player(),grant=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'}),gear_id=grant.body.delta.gear[0].id;
 const before=(await p.request('character')).body,instance=randomUUID();
 // Persist membership through real PostgreSQL; no simulated battle or mocked write barrier.
 await pool.query("INSERT INTO ow_dungeons(id,leader,status,data) VALUES($1,$2,'running',$3)",[instance,p.id,{definition:{policy:{buildLocked:true}}}]);
 await pool.query("INSERT INTO ow_dungeon_members(instance,character,active,data) VALUES($1,$2,true,'{}')",[instance,p.id]);
 try{
  expect((await p.send('hex/equip',{gear_id,slot:'hex1'})).body.code).toBe('DUNGEON_BUILD_LOCKED');
  expect((await p.send('hex/unequip',{slot:'hex1'})).body.code).toBe('DUNGEON_BUILD_LOCKED');
  const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
  expect(state.revision).toBe(before.revision);expect(state.equipment).toEqual(before.equipment);
 }finally{
  await pool.query('DELETE FROM ow_dungeon_members WHERE instance=$1',[instance]);
  await pool.query('DELETE FROM ow_dungeons WHERE id=$1',[instance]);
 }
});
it('restricts controlled grants to QA accounts and protects worn salvage',async()=>{
 expect(()=>createApp(pool,{production:true,devCheckpoints:true})).toThrow('Dev checkpoints cannot be enabled');
 const ordinary=await player('normal_');expect((await ordinary.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'})).status).toBe(403);
 const p=await player(),g=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'common'}),id=g.body.delta.gear[0].id;
 expect((await p.request('gear/'+id+'/tip')).body.code).toBe('GEAR');expect((await p.request('gear/'+id+'/preview')).body.code).toBe('GEAR');
 await p.send('hex/equip',{gear_id:id,slot:'hex2'});expect((await p.send('gear/salvage',{gear_id:id})).body.code).toBe('PROTECTED');
 await p.send('hex/unequip',{slot:'hex2'});const salvage=await p.send('gear/salvage',{gear_id:id});expect(salvage.status).toBe(200);expect(salvage.body.snapshot.gear.some((g:any)=>g.id===id)).toBe(false);
 expect((await p.request('gear/salvage',salvage.input)).body).toEqual(salvage.body);
});
it('keeps HEX lock toggles idempotent and refuses locked salvage without changing saved state',async()=>{
 const p=await player(),grant=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'rare'}),id=grant.body.delta.gear[0].id;
 const locked=await p.send('gear/lock',{gear_id:id});expect(locked.status).toBe(200);
 expect(locked.body.snapshot.gear.find((g:any)=>g.id===id).locked).toBe(true);
 expect((await p.request('gear/lock',locked.input)).body).toEqual(locked.body);
 const before=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 for(const path of ['gear/salvage','gear/salvage-batch']){
  const denied=await p.send(path,path.endsWith('batch')?{gear_ids:[id]}:{gear_id:id});
  expect(denied.status).toBe(409);expect(denied.body.code).toBe('PROTECTED');
 }
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state).toEqual(before);
 const unlock=await p.send('gear/lock',{gear_id:id});expect(unlock.status).toBe(200);
 expect(unlock.body.snapshot.gear.find((g:any)=>g.id===id).locked).toBe(false);
 const salvaged=await p.send('gear/salvage',{gear_id:id});expect(salvaged.status).toBe(200);
 expect(salvaged.body.delta.material).toBe(economy.salvageMaterial);
 expect((await p.request('gear/salvage',salvaged.input)).body).toEqual(salvaged.body);
 const after=(await p.request('character')).body;
 expect(after.material-before.material).toBe(economy.salvageMaterial);expect(after.gear.some((g:any)=>g.id===id)).toBe(false);
 expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[p.id,salvaged.input.command_id])).rows[0].n).toBe(1);
});
it('previews HEX bulk cleanup read-only and rechecks protection/revision before atomic settlement',async()=>{
 const p=await player(),ids:Record<string,string>={};
 for(const quality of ['common','magic','rare','legendary']){const g=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality});expect(g.status).toBe(200);ids[quality]=g.body.delta.gear[0].id;}
 await p.send('hex/equip',{gear_id:ids.magic,slot:'hex1'});
 await p.send('gear/lock',{gear_id:ids.rare});
 const audit=async()=>({state:(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state,counts:(await pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1) receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1) ledger',[p.id])).rows[0]});
 const before=await audit(),preview=await p.request('gear/salvage-batch/preview');expect(preview.status).toBe(200);
 expect(preview.body.gear.filter((g:any)=>Object.values(ids).includes(g.id)).map((g:any)=>g.id)).toEqual([ids.common]);
 expect(preview.body.material).toBe(preview.body.gear.length*economy.salvageMaterial);
 await p.request('gear/salvage-batch/preview');expect(await audit()).toEqual(before);
 for(const protectedId of [ids.magic,ids.rare,ids.legendary]){
  const denied=await p.send('gear/salvage-batch',{gear_ids:[ids.common,protectedId]});
  expect(denied.body.code).toBe('PROTECTED');expect(await audit()).toEqual(before);
 }
 const stale=p.command({gear_ids:[ids.common]});await p.send('gear/lock',{gear_id:ids.common});
 expect((await p.request('gear/salvage-batch',stale)).body.code).toBe('REVISION');
 expect((await p.send('gear/salvage-batch',{gear_ids:[ids.common]})).body.code).toBe('PROTECTED');
 await p.send('gear/lock',{gear_id:ids.common});await p.send('gear/lock',{gear_id:ids.rare});
 const ready=(await p.request('character')).body,settled=await p.send('gear/salvage-batch',{gear_ids:[ids.common,ids.rare]});
 expect(settled.status).toBe(200);expect(settled.body.delta.material).toBe(2*economy.salvageMaterial);
 expect((await p.request('gear/salvage-batch',settled.input)).body).toEqual(settled.body);
 const after=(await p.request('character')).body;
 expect(after.material-ready.material).toBe(2*economy.salvageMaterial);
 expect(after.gear.filter((g:any)=>Object.values(ids).includes(g.id)).map((g:any)=>g.id).sort()).toEqual([ids.magic,ids.legendary].sort());
 expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[p.id,settled.input.command_id])).rows[0].n).toBe(1);
});
it('allows explicit single legendary HEX salvage but never includes it in bulk cleanup',async()=>{
 const p=await player(),g=await p.send('dev/hex-grant',{base:'hex-chain-lightning',quality:'legendary'}),id=g.body.delta.gear[0].id;
 expect((await p.request('gear/salvage-batch/preview')).body.gear.some((g:any)=>g.id===id)).toBe(false);
 const before=(await p.request('character')).body,done=await p.send('gear/salvage',{gear_id:id});expect(done.status).toBe(200);
 expect((await p.request('gear/salvage',done.input)).body).toEqual(done.body);
 const after=(await p.request('character')).body;expect(after.material-before.material).toBe(economy.salvageMaterial);
 expect(after.gear.some((g:any)=>g.id===id)).toBe(false);
});
it.each(['common','magic','rare','legendary'] as const)('persists and restores both D05 %s samples equipped across the two HEX slots',async quality=>{
 const p=await player(),content=(await p.request('content')).body;
 expect(content.versions.protocol).toBe(versions.protocol);expect(content.versions.rules).toBe(versions.rules);
 const ids:string[]=[];
 for(const [index,base] of ['hex-aftershock','hex-detonation-sigil'].entries()){
  const publicEntry=content.hexRunes.find((r:any)=>r.id===base);expect(publicEntry).toBeDefined();
  expect(publicEntry.tiers[quality]).not.toHaveProperty('rules');
  const granted=await p.send('dev/hex-grant',{base,quality});expect(granted.status).toBe(200);
  const id=granted.body.delta.gear[0].id;ids.push(id);
  const equipped=await p.send('hex/equip',{gear_id:id,slot:index===0?'hex1':'hex2'});expect(equipped.status).toBe(200);
  expect((await p.request('hex/equip',equipped.input)).body).toEqual(equipped.body);
 }
 const before=(await p.request('character')).body,restored=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
 try{
  await restored.ready();const login=await restored.inject({method:'POST',url:'/api/session/login',payload:{username:p.username}});
  const cookie=String(login.headers['set-cookie']).split(';')[0],read=await restored.inject({method:'GET',url:'/api/character',headers:{cookie}});
  expect(read.statusCode).toBe(200);const snapshot=snapshotSchema.parse(read.json());
  expect(snapshot.equipment.hex1).toBe(ids[0]);expect(snapshot.equipment.hex2).toBe(ids[1]);
  expect(snapshot.revision).toBe(before.revision);
  const nova=snapshot.stats.rules?.find(r=>r.source===ids[0]&&r.action.type==='nova'),detonate=snapshot.stats.rules?.find(r=>r.source===ids[1]);
  expect(nova?.trigger).toBe('nth');expect(detonate?.action).toMatchObject({type:'detonate',budget:'perTarget',remove:['rare','legendary'].includes(quality)});
  expect(snapshot.stats.rules).toEqual(before.stats.rules);
 }finally{await restored.close();}
});
