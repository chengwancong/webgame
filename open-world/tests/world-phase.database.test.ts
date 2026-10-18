import {reviewPath} from './review-path.ts';
import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {npcPositions,npcs} from '../packages/content/task-tables.ts';
import {conditionGroups} from '../packages/rules/quest-conditions.ts';
import {generateProductionIsland} from '../tools/build-production-islands.ts';
import {registerProducedWorld,type ProducedWorld} from '../packages/content/open-world/index.ts';
import {twoZoneIsland,catalogues} from './fixtures/production-island.ts';
import {validateResponse,type Snapshot,type Permit,type FieldCamps} from '../packages/contracts/index.ts';

const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('World phases require real isolated PostgreSQL');
const schema='qa_phase_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4});
let app=createApp(pool,{testLogin:true,dungeons:false});
const sizes=Object.fromEntries(Object.entries(worldTables).filter(([k])=>k!=='source').map(([k,rows])=>[k,(rows as unknown[]).length]));
const npcCount=npcPositions.length,target='phase-fixture-after',before=conditionGroups.get(target),condition={_row:1,target,group:1,kind:'level' as const,value:'5',path:'fallback' as const};
const table=twoZoneIsland(),camp=table.camps[0],region=table.islands[0].region,waypoint=table.waypoints[1],npc=npcs.find(n=>n.campaign==='starsea'&&!npcPositions.some(p=>p.npc===n.id))!.id;
beforeAll(async()=>{
 await owner.query('CREATE SCHEMA '+schema);await migrate(pool);
 camp.until=target;waypoint.when=target;
 table.outposts.push({_row:4,id:'phase-fixture-outpost',region,zone:camp.zone,x:camp.x,y:camp.y,name:'战后前哨',resource:waypoint.resource,waypoint:waypoint.id,when:target});
 table.objects.push({_row:4,id:'phase-fixture-object',region,zone:camp.zone,x:camp.x+2,y:camp.y,name:'战后物件',kind:'clue',resource:waypoint.resource,when:target});
 table.merchants.push({_row:4,id:'phase-fixture-merchant',region,zone:camp.zone,x:camp.x+3,y:camp.y,npc,name:'战后商人',resource:waypoint.resource,service:'补给',when:target});
 const produced=generateProductionIsland(table,table.islands[0],catalogues);registerProducedWorld(produced as unknown as ProducedWorld);
 for(const [key,rows]of Object.entries(table))if(key!=='source')(worldTables[key as keyof typeof worldTables] as unknown[]).push(...rows as unknown[]);
 npcPositions.push({_row:4,id:'phase-fixture-npc',npc,map:region,x:camp.x+3,y:camp.y,when:target});
 conditionGroups.set(target,new Map([[1,[condition]]]));await app.ready();
});
afterAll(async()=>{
 await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();
 for(const [key,n]of Object.entries(sizes))(worldTables[key as keyof typeof worldTables] as unknown[]).splice(n);npcPositions.splice(npcCount);
 if(before)conditionGroups.set(target,before);else conditionGroups.delete(target);
});
async function player(level:number){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'phase_'+randomUUID().replaceAll('-','').slice(0,12)}});expect(login.statusCode).toBe(200);const cookie=String(login.headers['set-cookie']).split(';')[0];
 const request=async(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const created=(await request('character',{name:'世界相位验收'})).json();await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{level}',$1::jsonb) WHERE id=$2",[String(level),created.id]);
 const lease=(await request('control',{client_id:randomUUID()})).json().lease_id;
 const snapshot=async()=>{const response=await request('character');expect(response.statusCode,response.body).toBe(200);return validateResponse('character',response.json()) as Snapshot;};
 const permit=async()=>{const response=await request('permit',{lease_id:lease,region});expect(response.statusCode,response.body).toBe(200);return response.json() as Permit;};
 const near=async(p:Permit)=>{const response=await request('field/camps',{lease_id:lease,permit_id:p.id,position:{x:camp.x,y:camp.y}});expect(response.statusCode,response.body).toBe(200);return validateResponse('field/camps',response.json()) as FieldCamps;};
 return {id:created.id,lease,request,snapshot,permit,near};
}
it('changes one character phase by editing its condition, isolates two character views, preserves reconnect and never regenerates removed camps',async()=>{
 const low=await player(1),high=await player(8),lowPermit=await low.permit(),highPermit=await high.permit();
 const lowView=await low.near(lowPermit),highView=await high.near(highPermit);
 expect(lowView.camps.map(c=>c.id)).toContain(camp.id);expect(highView.camps.map(c=>c.id)).not.toContain(camp.id);
 expect(lowView.world_view!.outposts.map(o=>o.id)).not.toContain(table.outposts[0].id);expect(highView.world_view!.outposts.map(o=>o.id)).toContain(table.outposts[0].id);
 const one=await high.snapshot();expect(one.worldView!.objects).toContainEqual(expect.objectContaining({id:table.objects[0].id}));expect(one.worldView!.merchants).toHaveLength(1);
 expect(one.starseaView!.npcPositions.filter(n=>n.npc===npc)).toEqual([{npc,map:region,x:camp.x+3,y:camp.y}]);
 expect(JSON.stringify(one.worldView)).not.toContain('until');expect(JSON.stringify(one.worldView)).not.toContain('"when"');
 expect((await pool.query('SELECT count(*)::int n FROM ow_camp_cycles WHERE character=$1 AND camp=$2',[high.id,camp.id])).rows[0].n).toBe(0);
 condition.value='9';const edited=await high.snapshot();expect(edited.worldView!.outposts.filter(p=>p.region===region)).toEqual([]);expect(edited.worldView!.waypoints).not.toContain(waypoint.id);
 condition.value='5';expect((await high.snapshot()).worldView).toEqual(one.worldView);
 await pool.query("UPDATE ow_characters SET state=jsonb_set(state,'{level}','8') WHERE id=$1",[low.id]);
 expect((await low.near(lowPermit)).camps.map(c=>c.id)).not.toContain(camp.id);expect((await low.permit()).spawns.some(m=>m.id.startsWith(camp.id+':'))).toBe(false);
 expect((await pool.query('SELECT count(*)::int n FROM ow_camp_cycles WHERE character=$1 AND camp=$2',[low.id,camp.id])).rows[0].n).toBe(1);
 await app.close();app=createApp(pool,{testLogin:true,dungeons:false});await app.ready();
 expect((await high.snapshot()).worldView).toEqual(one.worldView);expect((await high.snapshot()).starseaView!.npcPositions).toEqual(one.starseaView!.npcPositions);expect(await high.near(highPermit)).toEqual(highView);
 await mkdir(reviewPath('docs/reviews/open-world-m2-m4/W2'),{recursive:true});await writeFile(reviewPath('docs/reviews/open-world-m2-m4/W2/world-phase.json'),JSON.stringify({passed:true,realPostgres:true,production:true,scope:'Controlled levels; real create/login/permit/snapshot/camp-stream and app restart. Configuration changes use the shared condition target owner; no live database mutation.',checks:['same-character condition edit','two independent phases','new outpost/waypoint/objects/merchant/NPC visible','no private conditions in public phase','removed camp never creates another cycle','reconnect cannot resurrect removed camp','app restart returns identical phase and NPC positions']},null,2)+'\n');
},30000);
