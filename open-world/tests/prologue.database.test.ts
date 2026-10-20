import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {poolFor,migrate} from '../apps/api/src/database.ts';
import {createApp} from '../apps/api/src/app.ts';
import {prologueConfig} from '../packages/content/starsea/prologue.ts';
import type {Snapshot} from '../packages/contracts/index.ts';
// 开场「坠星觉醒」的存档部分：三选一只发一次初始武器，看完/跳过只标记完成（docs/opening-hook-design.md O1/O2）。
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Real PostgreSQL required');
const pool=poolFor(dsn),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{await migrate(pool);await app.ready();});afterAll(async()=>{await app.close();await pool.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'pl_'+randomUUID().replaceAll('-','').slice(0,24)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 const s=(await request('character',{name:'坠星验收'})).body as Snapshot,lease=(await request('control',{client_id:randomUUID()})).body.lease_id as string;
 const send=async(body:{weapon?:string;finish?:boolean},command=randomUUID())=>{const now=(await request('character')).body as Snapshot;return request('prologue',{command_id:command,revision:now.revision,lease_id:lease,...body});};
 return {request,s,lease,send};
}
const weaponOf=(s:Snapshot)=>s.gear.find(g=>g.id===s.equipment.weapon)!;
it('new characters start the prologue pending with the default sword kit',async()=>{
 const p=await player();expect(p.s.starsea!.prologue).toEqual({done:false});expect(weaponOf(p.s).base).toBe('standard-sword-t1-weapon');expect(p.s.skills).toEqual(prologueConfig.families.sword.starterSkills);
});
it('the echo choice swaps the starter weapon and kit once, at the same power',async()=>{
 const p=await player(),sword=weaponOf(p.s),command=randomUUID(),first=await p.send({weapon:'staff'},command);expect(first.status,JSON.stringify(first.body)).toBe(200);
 const s=first.body.snapshot as Snapshot,staff=weaponOf(s);
 expect(staff.id).toBe(sword.id);expect(staff.base).toBe('standard-staff-t1-weapon');expect(staff.quality).toBe(sword.quality);expect(staff.attack).toBe(sword.attack);expect(staff.affixes.map(a=>[a.stat,a.value])).toEqual(sword.affixes.map(a=>[a.stat,a.value]));
 expect(s.gear).toHaveLength(p.s.gear.length);expect(s.skills).toEqual(['staff_strike']);expect(s.resolvedSkills.map(k=>k.id)).toEqual(['staff_strike']);expect(s.build).toBe(p.s.build+1);
 expect(s.starsea!.prologue).toEqual({weapon:'staff',done:false});
 // 同一操作编号重放得到同一回执；同一选择再提交不改动；换选被拒绝。
 const replay=(await p.request('prologue',{command_id:command,revision:p.s.revision,lease_id:p.lease,weapon:'staff'}));expect(replay.body).toEqual(first.body);
 const same=await p.send({weapon:'staff'});expect(same.status).toBe(200);expect(weaponOf(same.body.snapshot)).toEqual(staff);expect(same.body.snapshot.build).toBe(s.build);
 const other=await p.send({weapon:'hidden'});expect(other.status).toBe(409);expect(other.body.code).toBe('PROLOGUE');
 const done=await p.send({finish:true});expect(done.status).toBe(200);expect(done.body.snapshot.starsea.prologue).toEqual({weapon:'staff',done:true});
 const again=await p.send({finish:true});expect(again.status).toBe(200);expect(again.body.snapshot.starsea.prologue).toEqual({weapon:'staff',done:true});
 expect((await p.send({weapon:'staff'})).status).toBe(409);
 const final=(await p.request('character')).body as Snapshot;expect(final.gear.filter(g=>g.slot==='weapon')).toHaveLength(p.s.gear.filter(g=>g.slot==='weapon').length);expect(final.xp).toBe(0);expect(final.gold).toBe(p.s.gold);
});
it('skipping without a choice keeps the sword',async()=>{
 const p=await player(),done=await p.send({finish:true});expect(done.status).toBe(200);const s=done.body.snapshot as Snapshot;
 expect(s.starsea!.prologue).toEqual({weapon:'sword',done:true});expect(weaponOf(s)).toEqual(weaponOf(p.s));expect(s.skills).toEqual(p.s.skills);expect(s.build).toBe(p.s.build);
});
it('GROW-03 persists authored landing overrides through the real quest/permit/receipt path',async()=>{
 const p=await player();expect((await p.send({finish:true})).status).toBe(200);
 const permit=await p.request('permit',{lease_id:p.lease,region:'ss-map-wind'});expect(permit.status,JSON.stringify(permit.body)).toBe(200);
 const before=(await p.request('character')).body as Snapshot;
 const input={command_id:randomUUID(),revision:before.revision,lease_id:p.lease,op:'start',task:'ss-c01-t01',region:'ss-map-wind'};
 const started=await p.request('quest',input);expect(started.status,JSON.stringify(started.body)).toBe(200);
 expect(started.body.snapshot.starsea.wave.spawns.map((m:any)=>[m.hp,m.attack])).toEqual([[680,12],[680,12]]);
 const permitData=(await pool.query('SELECT data FROM ow_permits WHERE id=$1',[permit.body.id])).rows[0].data;
 expect(permitData.spawns.filter((m:any)=>m.id.startsWith('q:ss-c01-t01:')).map((m:any)=>[m.hp,m.attack])).toEqual([[680,12],[680,12]]);
 const saved=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.s.id])).rows[0].state;
 expect(saved.starsea.wave.spawns.map((m:any)=>[m.hp,m.attack])).toEqual([[680,12],[680,12]]);
 expect(saved.gold).toBe(before.gold);expect(saved.xp).toBe(before.xp);
 expect((await p.request('quest',input)).body).toEqual(started.body);
 expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[p.s.id,input.command_id])).rows[0].n).toBe(1);
 expect((await p.request('character')).body.starsea.wave).toEqual(saved.starsea.wave);
});
it('the hidden kit is usable with its weapon',async()=>{
 const p=await player(),r=await p.send({weapon:'hidden',finish:true});expect(r.status).toBe(200);const s=r.body.snapshot as Snapshot;
 expect(weaponOf(s).base).toBe('standard-hidden-t1-weapon');expect(s.resolvedSkills.map(k=>k.id)).toEqual(['throwing_knife']);expect(s.skillRecovery?.sealed).toContain('fan_of_knives');// 群攻招封存，落点求生后找回
});
it('characters from before the prologue are treated as done and get nothing',async()=>{
 const p=await player();await pool.query("UPDATE ow_characters SET state=state #- '{starsea,prologue}' WHERE id=$1",[p.s.id]);
 const before=(await p.request('character')).body as Snapshot;expect(before.starsea!.prologue).toBeUndefined();
 for(const body of [{weapon:'staff'},{finish:true}]){const r=await p.send(body);expect(r.status).toBe(409);expect(r.body.code).toBe('PROLOGUE');}
 const after=(await p.request('character')).body as Snapshot;expect(after.gear).toEqual(before.gear);expect(after.revision).toBe(before.revision);
});
it('a character who already changed kit cannot swap the starter weapon',async()=>{
 const p=await player();await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{level}','2') WHERE id=$1",[p.s.id]);
 const r=await p.send({weapon:'hidden'});expect(r.status).toBe(409);expect(weaponOf((await p.request('character')).body).base).toBe('standard-sword-t1-weapon');
});
