import {beforeAll,afterAll,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {Pool} from 'pg';
import {createApp} from '../apps/api/src/app.ts';
import {migrate} from '../apps/api/src/database.ts';
import {worldTables} from '../packages/content/world-tables.ts';
import {bountyRow,bountyNeed,countBountyKill} from '../packages/rules/bounty.ts';
import {taskViewSchema} from '../packages/contracts/tasks.ts';
const dsn=process.env.AW_DATABASE_URL;if(!dsn)throw Error('Requires isolated real PostgreSQL');
const schema='qa_bounty_journal_'+randomUUID().replaceAll('-',''),owner=new Pool({connectionString:dsn}),pool=new Pool({connectionString:dsn,options:'-c search_path='+schema,max:4}),app=createApp(pool,{testLogin:true,dungeons:false});
const outpost=worldTables.waypoints.find(w=>w.kind==='outpost'&&w.region==='ss-map-wind')!;
beforeAll(async()=>{await owner.query('CREATE SCHEMA '+schema);await migrate(pool);await app.ready();});
afterAll(async()=>{await app.close();await pool.end();await owner.query('DROP SCHEMA '+schema+' CASCADE');await owner.end();});
async function actor(){
 const login=await app.inject({method:'POST',url:'/api/session/login',payload:{username:'bj_'+randomUUID().slice(0,8)}}),cookie=String(login.headers['set-cookie']).split(';')[0];
 const req=(path:string,body?:unknown)=>app.inject({method:body===undefined?'GET':'POST',url:'/api/'+path,headers:{cookie},payload:body as any});
 const initial=(await req('character',{name:'悬赏任务页回归'})).json(),s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[initial.id])).rows[0].state;
 s.level=20;s.starsea.features.push('bounty');s.starsea.waypoints.push(outpost.id);await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,s.id]);
 const lease=(await req('control',{client_id:randomUUID()})).json().lease_id;
 const command=async(path:string,extra:object)=>{const current=(await req('character')).json(),body={command_id:randomUUID(),revision:current.revision,lease_id:lease,...extra},result=await req(path,body);return {body,result};};
 const board=await command('bounty/board',{region:outpost.region,position:{x:outpost.x,y:outpost.y}});expect(board.result.statusCode).toBe(200);
 return {id:s.id,req,command,offers:board.result.json().snapshot.starsea.bounties};
}
it('projects only accepted current instances with the formal title, goal, actual progress and variable reward',async()=>{
 const p=await actor();expect((await p.req('tasks')).json().current.filter((x:any)=>x.typeId==='bounty')).toHaveLength(0);
 for(const b of p.offers)expect((await p.command('bounty/accept',{instance:b.instance})).result.statusCode).toBe(200);
 const view=(await p.req('tasks')).json();taskViewSchema.parse(view);
 const rows=view.current.filter((x:any)=>x.typeId==='bounty');expect(rows).toHaveLength(3);
 for(const b of p.offers){const source=bountyRow(b.task)!,row=rows.find((x:any)=>x.bountyInstance===b.instance);expect(row).toMatchObject({taskId:b.task,title:source.title,goal:source.goal,state:'active',current:0,total:bountyNeed(source),regionId:outpost.region,reward:{gold:source.reward_gold,xp:0,material:source.reward_material??0}});}
 expect((await p.command('bounty/abandon',{instance:p.offers[0].instance})).result.statusCode).toBe(200);
 expect((await p.req('tasks')).json().current.filter((x:any)=>x.typeId==='bounty')).toHaveLength(2);
});
it('task-page claiming reuses bounty settlement once and archives its actual kill goal, not one quest step',async()=>{
 const p=await actor(),b=p.offers.find((b:any)=>!bountyRow(b.task)!.elite)!,source=bountyRow(b.task)!;
 await p.command('bounty/accept',{instance:b.instance});
 // Controlled server-confirmed kill-rule inputs isolate settlement semantics;
 // not a GUI combat / natural-acquisition claim.
 const s=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state,camp=worldTables.camps.find(c=>c.zone===outpost.zone)!;
 for(let i=0;i<bountyNeed(source);i++)countBountyKill(s.starsea,{source:camp.id+':1:'+i,template:source.cond_value,elite:false,xp:10});
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[s,p.id]);
 const ready=(await p.req('tasks')).json().current.find((x:any)=>x.bountyInstance===b.instance);expect(ready?.state).toBe('ready');expect(ready.current).toBe(bountyNeed(source));
 const before=(await p.req('character')).json(),claimed=await p.command('task/claim',{task:b.task,instance:b.instance});expect(claimed.result.statusCode,claimed.result.body).toBe(200);
 expect((await p.req('task/claim',claimed.body)).json()).toEqual(claimed.result.json());
 const after=(await p.req('character')).json();expect(after.gold-before.gold).toBe(source.reward_gold);expect(after.progress.tasks).not.toContain(b.task);
 const view=(await p.req('tasks')).json(),archive=view.archive.filter((x:any)=>x.taskId===b.task);expect(view.current.some((x:any)=>x.bountyInstance===b.instance)).toBe(false);expect(archive).toHaveLength(1);
 expect(archive[0]).toMatchObject({state:'archived',total:bountyNeed(source),current:bountyNeed(source),reward:{gold:source.reward_gold,xp:bountyNeed(source)*5,material:0}});
 expect((await p.command('task/claim',{task:b.task,instance:b.instance})).result.statusCode).not.toBe(200);
 expect((await pool.query('SELECT count(*)::int n FROM ow_ledger WHERE character=$1 AND command=$2',[p.id,claimed.body.command_id])).rows[0].n).toBe(1);
 // Advance only this owned QA slot's cooldown to exercise the normal board
 // refill/accept/claim protocol for a second instance of the same stable ID.
 const nextState=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 nextState.starsea.bounties.find((x:any)=>x.instance===b.instance).cooldownUntil=Date.now()-1;
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[nextState,p.id]);
 const board=await p.command('bounty/board',{region:outpost.region,position:{x:outpost.x,y:outpost.y}});
 const next=board.result.json().snapshot.starsea.bounties.find((x:any)=>x.task===b.task&&x.instance!==b.instance);expect(next).toBeTruthy();
 await p.command('bounty/accept',{instance:next.instance});
 const active=(await pool.query('SELECT state FROM ow_characters WHERE id=$1',[p.id])).rows[0].state;
 for(let i=0;i<bountyNeed(source);i++)countBountyKill(active.starsea,{source:camp.id+':2:'+i,template:source.cond_value,elite:false,xp:10});
 await pool.query('UPDATE ow_characters SET state=$1 WHERE id=$2',[active,p.id]);
 expect((await p.command('task/claim',{task:b.task,instance:b.instance})).result.statusCode).not.toBe(200);
 const second=await p.command('task/claim',{task:b.task,instance:next.instance});expect(second.result.statusCode,second.result.body).toBe(200);
 const repeated=(await p.req('tasks')).json().archive.filter((x:any)=>x.taskId===b.task);expect(repeated).toHaveLength(2);expect(new Set(repeated.map((x:any)=>x.id)).size).toBe(2);
 expect(repeated.every((x:any)=>x.regionId===outpost.region)).toBe(true);expect(new Set(repeated.map((x:any)=>x.bountyInstance))).toEqual(new Set([b.instance,next.instance]));
});
