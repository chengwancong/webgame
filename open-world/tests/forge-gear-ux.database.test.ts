import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
const pool=new Pool({connectionString:process.env.AW_DATABASE_URL,max:2});
const app=createApp(pool,{testLogin:true,dungeons:false});
beforeAll(async()=>{if(!process.env.AW_DATABASE_URL)throw Error('Requires isolated PostgreSQL');await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();});
async function actor(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'forge_ux_'+randomUUID().slice(0,8)}});
 const cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const created=await req('character',{name:'工坊核查'});expect(created.statusCode,created.body).toBe(200);
 return {req,snapshot:created.json() as Snapshot,id:created.json().id as string};
}
it('F3 snapshot projects legacy main stats from the same tip source without migrating saved items',async()=>{
 const a=await actor();const raw=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[a.id])).rows[0].state as CharacterState;
 expect(raw.gear.every(g=>!g.mainStat)).toBe(true);
 for(const g of a.snapshot.gear){expect(g.mainStat).toBeDefined();const tip=await a.req('gear/'+g.id+'/tip');expect(tip.statusCode,tip.body).toBe(200);expect(g.mainStat!.value).toBe(tip.json().attributes.base[g.mainStat!.stat]);}
 expect((await pool.query('SELECT state FROM ow_characters WHERE id=$1',[a.id])).rows[0].state.gear).toEqual(raw.gear);
});
it('one upgrade spends its exact quote once, survives replay and refreshes the next cost',async()=>{
 const a=await actor();const raw=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[a.id])).rows[0].state as CharacterState;
 raw.starsea!.prologue={done:true,weapon:'sword'};raw.starsea!.location={map:'ss-map-port',x:19,y:20};raw.starsea!.features.push('forge');
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[raw,a.id]);
 const before=(await a.req('slots')).json().slots.find((s:any)=>s.slot==='weapon');expect(before.cost).toBeTruthy();
 raw.gold=before.cost.gold;raw.material=before.cost.material;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[raw,a.id]);
 const control=await a.req('control',{client_id:randomUUID()});expect(control.statusCode,control.body).toBe(200);
 const command={slot:'weapon',command_id:randomUUID()},up=await a.req('slot/upgrade',command);expect(up.statusCode,up.body).toBe(200);
 const after=(await a.req('character')).json() as Snapshot;expect(after.gold).toBe(0);expect(after.material).toBe(0);
 const next=(await a.req('slots')).json().slots.find((s:any)=>s.slot==='weapon');expect(next.rank).toBe(before.rank+1);expect(next.cost.gold).toBeGreaterThan(0);expect(next.cost.material).toBeGreaterThan(0);
 const {slotAvailability}=await import('../apps/web/src/hub/slot-upgrade-panel.ts');expect(slotAvailability(next,after).canUpgrade).toBe(false);
 const receipt=await a.req('receipt/'+command.command_id);expect(receipt.statusCode,receipt.body).toBe(200);expect(receipt.json().snapshot.gold).toBe(0);
 expect((await a.req('slot/upgrade',command)).statusCode).toBe(200);expect((await a.req('slots')).json().slots.find((s:any)=>s.slot==='weapon').rank).toBe(next.rank);
 const rejected=await a.req('slot/upgrade',{...command,command_id:randomUUID()});expect(rejected.statusCode).toBe(409);expect((await a.req('character')).json().gold).toBe(0);
});
