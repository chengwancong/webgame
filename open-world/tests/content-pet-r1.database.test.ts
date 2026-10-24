import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool,type PoolClient} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate,transaction} from '../apps/api/src/database.ts';
import {validateResponse,type CharacterState} from '../packages/contracts/index.ts';
import type {PetView,PetsView,LoadoutView} from '../packages/contracts/zhangjian.ts';
import {petBuildParts} from '../packages/rules/zhangjian-build.ts';
import rows from './fixtures/build-variety-r1/legacy-builds.json';

// Run through tools/vitest-tempdb.mjs. Never fall back to a persistent service DSN.
const dsn=process.env.AW_DATABASE_URL;
if(!dsn)throw Error('Requires isolated PostgreSQL via tools/vitest-tempdb.mjs');
const pool=new Pool({connectionString:dsn,max:4}),app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{
 const data=String((await pool.query('SHOW data_directory')).rows[0].data_directory).replaceAll('\\','/');
 if(!/\/\.qa\/run-[^/]+\/data\/?$/.test(data))throw Error('Pet R1 tests require an owned temporary .qa/run-*/data database');
 await migrate(pool);await app.ready();
});
afterAll(async()=>{await app.close();await pool.end();});

async function actor(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'pet_r1_'+randomUUID().slice(0,8)}});
 expect(login.statusCode,login.body).toBe(200);
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const created=await req('character',{name:'宠物临时库'});expect(created.statusCode,created.body).toBe(200);
 const s=created.json() as CharacterState,base=structuredClone(rows[0].state) as unknown as CharacterState;
 s.gear=base.gear;s.equipment=base.equipment;s.skills=['cut'];s.skillRanks={cut:3};s.level=30;
 s.starsea!.prologue={done:true,weapon:'sword'};s.starsea!.location={map:'ss-map-port',x:14,y:20};
 s.pets={owned:{'wind-free':{level:1,xp:0,flow:'blade'},'wind-light':{level:1,xp:0,flow:'blade'},'wind-heavy':{level:1,xp:0,flow:'blade'}},lineup:{active:'wind-free',support:[]}};
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const control=await req('control',{client_id:randomUUID()});expect(control.statusCode,control.body).toBe(200);
 // Let ordinary migration/normalization finish before assertions compare stored state.
 expect((await req('pets')).statusCode).toBe(200);
 return {id:s.id,req,state:async()=>(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[s.id])).rows[0].state as CharacterState};
}
async function locked(id:string,fn:(s:CharacterState,c:PoolClient)=>void|Promise<void>){
 await transaction(pool,async c=>{const s=(await c.query('SELECT state FROM ow_characters WHERE id=$1 FOR UPDATE',[id])).rows[0].state as CharacterState;await fn(s,c);await c.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,id]);});
}
function pet(view:PetsView,family:string):PetView{const found=view.owned.find(p=>p.family===family);expect(found).toBeDefined();return found!;}
async function commandRows(id:string,command:string){
 const r=await pool.query('SELECT (SELECT count(*)::int FROM ow_receipts WHERE character=$1 AND command=$2) AS receipts,(SELECT count(*)::int FROM ow_ledger WHERE character=$1 AND command=$2) AS ledger',[id,command]);
 return r.rows[0];
}

it('pets GET exposes the three executable R1 effects and retains the existing passives',async()=>{
 const a=await actor(),r=await a.req('pets');expect(r.statusCode,r.body).toBe(200);expect(()=>validateResponse('pets',r.json())).not.toThrow();
 const v=r.json() as PetsView,free=pet(v,'wind-free'),shield=pet(v,'wind-light'),chain=pet(v,'wind-heavy');
 expect(free.activeEffect).toEqual({kind:'single',intervalSeconds:2,dealsDamage:true,damageElement:'physical',damageRatios:[1.078],targetLimit:1});
 expect(shield.activeEffect).toEqual({kind:'shield',intervalSeconds:4,dealsDamage:false,damageElement:null,damageRatios:[],targetLimit:1,shieldPercent:4,durationSeconds:3});
 expect(shield.flowDescription).toBe('本技能不造成元素伤害；流派不改变护盾效果。');
 expect(chain.activeEffect).toMatchObject({kind:'chain',intervalSeconds:4,dealsDamage:true,damageElement:'physical',targetLimit:3});
 expect(chain.activeEffect!.damageRatios).toHaveLength(3);
 for(const [i,ratio] of [2.1333333333333333,1.4933333333333332,1.0453333333333332].entries())expect(chain.activeEffect!.damageRatios[i]).toBeCloseTo(ratio,10);
 expect(free.passiveLine).toBe('攻击 +3%，最大生命 +4%');expect(shield.passiveLine).toBe('攻击 +4%');expect(chain.passiveLine).toBe('攻击 +4%，暴击率 +3%');
});

it('lineup and flow commands persist once, replay exactly, and reject conflicting command IDs',async()=>{
 const a=await actor(),commands=[{op:'lineup',active:'wind-heavy',support:['wind-free','wind-light'],command_id:randomUUID()},{op:'flow',family:'wind-heavy',flow:'storm',command_id:randomUUID()}];
 for(const body of commands){
  const before=await a.state(),r=await a.req('pets',body);expect(r.statusCode,r.body).toBe(200);expect(()=>validateResponse('pets',r.json())).not.toThrow();
  const after=await a.state();expect(after.revision).toBe(before.revision+1);expect(after.build).toBe(before.build+1);
  expect((await a.req('pets',body)).json()).toEqual(r.json());expect(await a.state()).toEqual(after);expect(await commandRows(a.id,body.command_id)).toEqual({receipts:1,ledger:1});
  const altered=body.op==='flow'?{...body,flow:'ember'}:{...body,support:[]},conflict=await a.req('pets',altered);
  expect(conflict.statusCode,conflict.body).toBe(409);expect(conflict.json().code).toBe('COMMAND_CONFLICT');expect(await a.state()).toEqual(after);
 }
 const view=(await a.req('pets')).json() as PetsView;
 expect(view.lineup).toEqual({active:'wind-heavy',support:['wind-free','wind-light']});expect(pet(view,'wind-heavy').activeEffect?.damageElement).toBe('lightning');
});

it('support pets contribute only half passives and no active rules, including a support-only lineup',async()=>{
 const a=await actor();
 for(const active of ['wind-free',null]){
  const r=await a.req('pets',{op:'lineup',active,support:['wind-light','wind-heavy'],command_id:randomUUID()});expect(r.statusCode,r.body).toBe(200);
  const snapshot=await a.req('character');expect(snapshot.statusCode,snapshot.body).toBe(200);
  expect((snapshot.json().stats.rules??[]).filter((r:{id:string})=>r.id.startsWith('pet-')).map((r:{id:string})=>r.id)).toEqual(active?['pet-wind-free']:[]);
  const parts=petBuildParts(await a.state());expect(parts.stats.filter(p=>p.source==='pet:wind-light')).toEqual([{source:'pet:wind-light',phase:'main',stat:'attackPercent',value:0.02}]);
  expect(parts.stats.filter(p=>p.source==='pet:wind-heavy')).toEqual([{source:'pet:wind-heavy',phase:'main',stat:'attackPercent',value:0.02},{source:'pet:wind-heavy',phase:'main',stat:'critChance',value:0.015}]);
 }
});

it('shield flow persists but does not add attack elements; loadout restores lineup and flows once',async()=>{
 const a=await actor();
 for(const body of [{op:'lineup',active:'wind-light',support:['wind-free','wind-heavy']},{op:'flow',family:'wind-light',flow:'storm'},{op:'flow',family:'wind-free',flow:'ember'},{op:'flow',family:'wind-heavy',flow:'venom'}]){
  const r=await a.req('pets',{...body,command_id:randomUUID()});expect(r.statusCode,r.body).toBe(200);
 }
 const before=await a.state(),savedPets=structuredClone(before.pets),save={op:'save',index:1,name:'稳过',command_id:randomUUID()},saved=await a.req('loadout',save);
 expect(saved.statusCode,saved.body).toBe(200);expect(()=>validateResponse('loadout',saved.json())).not.toThrow();
 const view=saved.json().loadout as LoadoutView;expect(view.current.elements).toEqual(['physical']);expect(view.slots[1].elements).toEqual(['physical']);expect(view.slots[1].pet).toBe('风芽鹿');
 const s=await a.state();expect(s.loadouts!.slots[1]!.pets).toEqual({...savedPets!.lineup,flows:{'wind-light':'storm','wind-free':'ember','wind-heavy':'venom'}});
 expect((await a.req('loadout',save)).json()).toEqual(saved.json());expect(await a.state()).toEqual(s);
 const changed=await a.req('pets',{op:'lineup',active:'wind-free',support:['wind-heavy'],command_id:randomUUID()});expect(changed.statusCode,changed.body).toBe(200);
 const flow=await a.req('pets',{op:'flow',family:'wind-light',flow:'shade',command_id:randomUUID()});expect(flow.statusCode,flow.body).toBe(200);
 const changedView=(await a.req('loadout')).json() as LoadoutView;expect(changedView.current.elements).toContain('fire');expect(changedView.slots[1].elements).toEqual(['physical']);
 const apply={op:'apply',index:1,command_id:randomUUID()},applied=await a.req('loadout',apply);expect(applied.statusCode,applied.body).toBe(200);expect(()=>validateResponse('loadout',applied.json())).not.toThrow();
 expect(applied.json().loadout.current.elements).toEqual(['physical']);expect(applied.json().result).toEqual({applied:1,skipped:[]});
 const after=await a.state();expect(after.pets).toEqual(savedPets);expect(after.gold).toBe(before.gold);expect(after.material).toBe(before.material);
 expect((await a.req('loadout',apply)).json()).toEqual(applied.json());expect(await a.state()).toEqual(after);expect(await commandRows(a.id,apply.command_id)).toEqual({receipts:1,ledger:1});
 const recovered=await a.req('character');expect(recovered.statusCode,recovered.body).toBe(200);expect(recovered.json().pets).toEqual(savedPets);
 const rules=recovered.json().stats.rules.filter((r:{id:string})=>r.id.startsWith('pet-'));expect(rules).toHaveLength(1);expect(rules[0]).toMatchObject({id:'pet-wind-light',source:'pet:wind-light',action:{type:'shield',ref:'maxHp',ratio:0.04,duration:90}});expect(rules[0].after).toBeUndefined();
 const publicPet=pet((await a.req('pets')).json(),'wind-light');expect(publicPet.element).toBe('lightning');expect(publicPet.activeEffect?.damageElement).toBeNull();expect(publicPet.activeEffect?.damageRatios).toEqual([]);
});

it('an active dungeon rejects fresh lineup, flow and apply commands without changing state or receipts',async()=>{
 const a=await actor(),saved=await a.req('loadout',{op:'save',index:1,command_id:randomUUID()});expect(saved.statusCode,saved.body).toBe(200);
 await locked(a.id,s=>{s.dungeon={instance:randomUUID(),pendingResult:null,returnRegion:'ss-map-port'};});
 const view=(await a.req('loadout')).json() as LoadoutView;expect(view.canSwitch).toBe(false);expect(view.switchBlock).toBe('副本中不能切换方案');
 const before=await a.state();
 for(const [path,payload,code] of [
  ['pets',{op:'lineup',active:'wind-light',support:['wind-free']},'PET'],
  ['pets',{op:'flow',family:'wind-free',flow:'storm'},'PET'],
  ['loadout',{op:'apply',index:1},'LOADOUT_LOCKED'],
 ] as const){
  const command_id=randomUUID(),r=await a.req(path,{...payload,command_id});expect(r.statusCode,r.body).toBe(409);expect(r.json().code).toBe(code);
  expect(await a.state()).toEqual(before);expect(await commandRows(a.id,command_id)).toEqual({receipts:0,ledger:0});
 }
});
