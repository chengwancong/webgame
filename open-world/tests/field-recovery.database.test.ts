import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import type {Snapshot,Gear,SalvageBatchPreview} from '../packages/contracts/index.ts';
import {validateResponse} from '../packages/contracts/index.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{campaign:'legacy',testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'fr_'+randomUUID().replaceAll('-','').slice(0,24)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const s=(await request('character',{name:'整理验收'})).body as Snapshot,lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 s.gear=s.gear.slice(0,2);
 const extra=(name:string,patch:Partial<Gear>={})=>{const g={...s.gear[0],id:randomUUID(),name,locked:false,quality:'common' as const,rank:0,affixes:[],aspectId:undefined,...patch};s.gear.push(g);return g;};
 const common=extra('普通待分解'),rare=extra('稀有待分解',{quality:'rare'}),locked=extra('锁定',{locked:true}),ranked=extra('强化',{rank:1}),legendary=extra('传奇',{quality:'legendary'}),aspect=extra('威能',{aspectId:'aspect-test'}),grid=extra('武器盘');
 const hexCommon=extra('普通词缀',{origin:{kind:'random'},hex:{rune:'hex-aftershock',tier:'common'}}),hexMagic=extra('魔法词缀',{quality:'magic',origin:{kind:'random'},hex:{rune:'hex-aftershock',tier:'magic'}});
 ensureProgression(s).weaponGrid[1]=grid.id;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const reward={id:randomUUID(),source_id:'fixture-pending',region:'meadow',position:{x:5,y:8},gear:{...common,id:randomUUID(),name:'待领取装备'}};await pool.query('INSERT INTO ow_rewards(id,character,source,data,claimed) VALUES($1,$2,$3,$4,false)',[reward.id,s.id,'fixture-pending',reward]);
 return {request,s,lease,common,rare,hexCommon,hexMagic,protected:[...s.gear.slice(0,2),locked,ranked,legendary,aspect,grid,hexCommon,hexMagic]};
}
it('previews protected equipment, commits exact selected items once, and preserves wallet and pending loot',async()=>{
 const p=await player(),before=(await p.request('character')).body as Snapshot,quote=validateResponse('gear/salvage-batch/preview',(await p.request('gear/salvage-batch/preview')).body) as SalvageBatchPreview;
 expect(quote.gear.map(g=>g.id)).toEqual([p.common.id,p.rare.id]);expect(quote.protectedCount).toBe(p.protected.length);
 const body={command_id:randomUUID(),revision:quote.revision,lease_id:p.lease,gear_ids:quote.gear.map(g=>g.id)},done=await p.request('gear/salvage-batch',body);
 expect(done.status).toBe(200);expect(done.body.snapshot.gear.map((g:Gear)=>g.id)).toEqual(p.protected.map(g=>g.id));
 expect(done.body.snapshot.material).toBe(before.material+quote.material);expect(done.body.snapshot.gold).toBe(before.gold);expect(before.rewards).toHaveLength(1);expect(done.body.snapshot.rewards).toEqual(before.rewards);
 expect((await p.request('gear/salvage-batch',body)).body).toEqual(done.body);
 expect((await pool.query('SELECT count(*)::integer n FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,body.command_id])).rows[0].n).toBe(1);
});
it('rejects protected, missing, duplicate, and stale selections without partial deletion or material awards',async()=>{
 const p=await player(),before=(await p.request('character')).body;
 const audit=async()=>({state:(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state,counts:(await pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1) receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1) ledger',[p.s.id])).rows[0]});
 const stored=await audit();
 const unchanged=async()=>{const after=(await p.request('character')).body;expect(after.hexCooldowns.observedAt).toBeGreaterThanOrEqual(before.hexCooldowns.observedAt);expect({...after,hexCooldowns:{...after.hexCooldowns,observedAt:before.hexCooldowns.observedAt}}).toEqual(before);expect(await audit()).toEqual(stored);};
 for(const g of p.protected){const r=await p.request('gear/salvage-batch',{command_id:randomUUID(),revision:before.revision,lease_id:p.lease,gear_ids:[p.common.id,g.id]});expect(r.body.code).toBe('PROTECTED');await unchanged();}
 for(const [ids,revision,code] of [[[p.common.id,randomUUID()],before.revision,'GEAR'],[[p.common.id,p.common.id],before.revision,'INPUT'],[[p.common.id],before.revision+1,'REVISION']] as const){const r=await p.request('gear/salvage-batch',{command_id:randomUUID(),revision,lease_id:p.lease,gear_ids:ids});expect(r.body.code).toBe(code);await unchanged();}
});
it('P50 explicit individual HEX salvage still commits exactly once',async()=>{
 const p=await player(),before=(await p.request('character')).body;
 const input={command_id:randomUUID(),revision:before.revision,lease_id:p.lease,gear_id:p.hexCommon.id},done=await p.request('gear/salvage',input);
 expect(done.status).toBe(200);validateResponse('gear/salvage',done.body);
 expect(done.body.snapshot.gear.some((g:Gear)=>g.id===p.hexCommon.id)).toBe(false);
 expect(done.body.snapshot.gear.find((g:Gear)=>g.id===p.hexMagic.id)).toEqual(before.gear.find((g:Gear)=>g.id===p.hexMagic.id));
 expect(done.body.snapshot.material-before.material).toBe(done.body.delta.material);expect(done.body.delta.material).toBeGreaterThan(0);
 expect((await p.request('gear/salvage',input)).body).toEqual(done.body);
 expect((await pool.query('SELECT count(*)::integer n FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rows[0].n).toBe(1);
});
it('records town as the return point across reloads without losing inventory or pending drops',async()=>{
 const p=await player();p.s.progress.safe='meadow';p.s.progress.safePoint='归途路碑';await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[p.s,p.s.id]);
 const before=(await p.request('character')).body,body={command_id:randomUUID(),revision:before.revision,lease_id:p.lease,region:'town',point:''},done=await p.request('safe',body);
 expect(done.status).toBe(200);const after=(await p.request('character')).body;expect(after.progress.safe).toBe('town');expect(after.progress.safePoint).toBeUndefined();expect(after.gear).toEqual(before.gear);expect(after.rewards).toEqual(before.rewards);expect(after.gold).toBe(before.gold);expect((await p.request('safe',body)).body).toEqual(done.body);
});
