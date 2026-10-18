import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import '../packages/content/open-world/index.ts';
import {validateResponse,type Snapshot,type Permit,type FieldCamps} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Plane gates require real isolated PostgreSQL');
const schema='qa_plane_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
let app=createApp(pool,{testLogin:true,dungeons:false});
const gate=worldTables.planeGates.find(g=>g.id==='ow-wind-plane-nest-cave')!,region=gate.region;
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function player(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'plane_'+randomUUID().replaceAll('-','').slice(0,12)}});expect(login.statusCode).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const created=(await request('character',{name:'位面入口验收'})).json(),lease=(await request('control',{client_id:randomUUID()})).json().lease_id;
 const snapshot=async()=>{const r=await request('character');expect(r.statusCode,r.body).toBe(200);return validateResponse('character',r.json()) as Snapshot;};
 const permitResponse=await request('permit',{lease_id:lease,region});expect(permitResponse.statusCode,permitResponse.body).toBe(200);const permit=permitResponse.json() as Permit;
 /** Place the server's last trusted observer, as if the hero had walked there `ago` ms earlier. */
 const observer=(p:{x:number;y:number}|null,ago=60000)=>pool.query("UPDATE ow_permits SET private_data=CASE WHEN $1::jsonb IS NULL THEN private_data-'fieldObserver' ELSE jsonb_set(private_data,'{fieldObserver}',$1::jsonb) END WHERE id=$2",[p&&JSON.stringify({...p,at:Date.now()-ago}),permit.id]);
 const report=async(p:{x:number;y:number})=>{const r=await request('field/camps',{lease_id:lease,permit_id:permit.id,position:p});expect(r.statusCode,r.body).toBe(200);return validateResponse('field/camps',r.json()) as FieldCamps;};
 const interact=async(id:string)=>request('plane/interact',{command_id:randomUUID(),revision:(await snapshot()).revision,lease_id:lease,permit_id:permit.id,gate:id});
 return {id:created.id,snapshot,report,observer,interact};
}
const state=(view:FieldCamps|Snapshot,id=gate.id)=>('world_view' in view?view.world_view:view.worldView)!.planeGates.find(g=>g.id===id);
it('discovers a gate only from a trusted nearby observer, persists it across restart and keeps other characters hidden',async()=>{
 const a=await player(),b=await player();
 const far=await a.report({x:gate.returnX+40,y:gate.returnY});expect(far.discovered).toEqual([]);expect(state(far)).toEqual({id:gate.id,state:'hidden',clears:0});
 // A jump of 40 cells in no time is not trusted: no discovery from the claimed position.
 await a.observer({x:gate.x+40,y:gate.y},0);const jump=await a.report({x:gate.x,y:gate.y});expect(jump.discovered).toEqual([]);expect(state(jump)!.state).toBe('hidden');
 await a.observer({x:gate.x+20,y:gate.y});const near=await a.report({x:gate.x+1,y:gate.y});
 expect(near.discovered).toEqual([gate.id]);expect(state(near)).toEqual({id:gate.id,state:'open',clears:0});
 expect((await a.report({x:gate.x+1,y:gate.y})).discovered).toEqual([]);
 const stored=(await pool.query("SELECT state->'world'->'planes' p FROM ow_characters WHERE id=$1",[a.id])).rows[0].p;expect(stored[gate.id]).toMatchObject({found:true,clears:0});
 expect(state(await b.snapshot())!.state).toBe('hidden');
 await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();
 expect(state(await a.snapshot())!.state).toBe('open');
},60000);
it('interact uses only the server-side trusted observer: missing, stale and far observers are refused',async()=>{
 const c=await player(),other=worldTables.planeGates.find(g=>g.id==='ow-wind-plane-nest-maze')!;
 await c.observer(null);expect((await c.interact(gate.id)).json().code).toBe('PLANE_GATE_FAR');
 await c.observer({x:gate.x,y:gate.y},10000);expect((await c.interact(gate.id)).json().code).toBe('PLANE_GATE_FAR');
 await c.observer({x:gate.x+gate.interactRadius+1,y:gate.y},0);expect((await c.interact(gate.id)).json().code).toBe('PLANE_GATE_FAR');
 await c.observer({x:gate.x,y:gate.y},0);expect((await c.interact('missing-gate')).json().code).toBe('PLANE_GATE');
 const ok=await c.interact(gate.id);expect(ok.statusCode,ok.body).toBe(200);
 const snap=await c.snapshot();expect(state(snap)!.state).toBe('open');expect(state(snap,other.id)!.state).toBe('hidden');
},60000);
