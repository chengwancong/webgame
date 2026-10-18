import {randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import type {createApp} from '../../apps/api/src/app.ts';
import {World} from '../../packages/simulation/index.ts';
import {regionById} from '../../packages/content/index.ts';
import {worldTables} from '../../packages/content/world-tables.ts';
import {resolveBuild} from '../../packages/rules/index.ts';
import type {CharacterState,Snapshot,Permit,Spawn,Vec} from '../../packages/contracts/index.ts';
export async function currentCampPlayer(app:ReturnType<typeof createApp>,pool:Pool){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'cycle_'+randomUUID().replaceAll('-','').slice(0,18)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>{const r=await app.inject({url:'/api/'+path,method:body===undefined?'GET':'POST',headers:{cookie},payload:body as any});return {status:r.statusCode,body:r.json()};};
 let snapshot=(await request('character',{name:'营地周期验收'})).body as Snapshot;const id=snapshot.id,lease=(await request('control',{client_id:randomUUID()})).body.lease_id;
 const state=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState;state.level=9;state.gear.find(g=>g.id===state.equipment.weapon)!.attack=10000;state.gear.find(g=>g.id===state.equipment.armor)!.armor=10000;await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[state,id]);snapshot=(await request('character')).body;
 const region='ss-map-wind',camp=worldTables.camps.find(c=>c.region===region&&c.pack.every(p=>p.rank==='normal'))!,permit=(await request('permit',{lease_id:lease,region})).body as Permit;
 async function near(position:Vec){const r=await request('field/camps',{lease_id:lease,permit_id:permit.id,position:{x:position.x,y:position.y}});if(r.status!==200)throw Error(JSON.stringify(r));return r.body as {camps:{id:string;cycle:number;spawns:Spawn[]}[]};}
 const current=async(position:Vec={x:camp.x,y:camp.y})=>(await near(position)).camps.find(c=>c.id===camp.id)!;
 async function kill(spawns:Spawn[]){const stored=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[id])).rows[0].state as CharacterState,build=resolveBuild(stored),world=new World(regionById(region),build.stats,build.resolvedSkills,spawns,[],41);world.hero.position={x:camp.x-5,y:camp.y};world.setMode('auto');const began=Date.now();for(let i=0;i<900&&world.enemies.some(e=>e.alive)&&world.hero.hp>0;i++)world.step();if(world.kills.length!==spawns.length||world.hero.hp<=0)throw Error('Controlled real camp did not clear');await new Promise(r=>setTimeout(r,Math.max(0,world.tick/30*1000-(Date.now()-began))));const payload={command_id:randomUUID(),revision:snapshot.revision,lease_id:lease,permit_id:permit.id,build:permit.build,sequence:permit.sequence+1,from_tick:permit.from_tick,to_tick:permit.from_tick+world.tick,kills:world.kills.map(k=>({...k,tick:k.tick+permit.from_tick})),position:world.hero.position};const result=await request('combat/report',payload);if(result.status===200){snapshot=result.body.snapshot;permit.sequence++;permit.from_tick=payload.to_tick;}return {result,payload,world};}
 const trust=()=>pool.query("UPDATE ow_permits SET private_data=jsonb_set(private_data,'{fieldObserver,at}','0') WHERE id=$1",[permit.id]);
 const ageClear=()=>pool.query("UPDATE ow_camp_cycles SET cleared_at=now()-interval '91 seconds' WHERE character=$1 AND camp=$2 AND cleared_at IS NOT NULL",[id,camp.id]);
 const far=worldTables.camps.find(c=>c.region===region&&Math.hypot(c.x-camp.x,c.y-camp.y)>40&&Math.abs(Math.floor(c.x/32)-Math.floor(camp.x/32))<=2&&Math.abs(Math.floor(c.y/32)-Math.floor(camp.y/32))<=2)!;
 return {id,lease,request,camp,permit,current,near,kill,trust,ageClear,far,get snapshot(){return snapshot;}};
}
