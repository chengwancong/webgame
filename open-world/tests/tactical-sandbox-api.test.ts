import Fastify from 'fastify';
import {afterEach,describe,expect,it} from 'vitest';
import {registerTacticalSandbox,type TacticalSandboxOptions} from '../apps/api/src/tactical-sandbox.ts';
import {TacticalProjectionSchema,type TacticalAction,type TacticalProjection} from '../packages/contracts/tactical.ts';
import {tacticalBoards} from '../packages/content/tactical-content.ts';
import {chooseTacticalPlan} from '../packages/simulation/tactical/autopilot.ts';

const normal=tacticalBoards.find(board=>board.difficulty==='normal')!;
const boss=tacticalBoards.find(board=>board.difficulty==='boss')!;
const running:ReturnType<typeof Fastify>[]=[];
function fixture(options:Partial<TacticalSandboxOptions>={}){
 const app=Fastify({logger:false});running.push(app);
 let at=1000,serial=0,tick=()=>{},disposed=false;
 registerTacticalSandbox(app,{env:{TACTICAL_SANDBOX:'1'},now:()=>at,makeId:()=>`sandbox-${++serial}`,makeSeed:()=>37,
  schedule:callback=>{tick=callback;return ()=>{disposed=true;};},...options});
 const read=(id:string)=>app.inject({method:'GET',url:`/api/tactical/sandbox/${id}`});
 const create=async(boardId=normal.id,heroId:'sword'|'hidden'='sword',seed?:number)=>{
  const result=await app.inject({method:'POST',url:'/api/tactical/sandbox',payload:{boardId,heroId,...(seed===undefined?{}:{seed})}});
  expect(result.statusCode,result.body).toBe(200);return TacticalProjectionSchema.parse(result.json());
 };
 const act=(projection:TacticalProjection,action:TacticalAction,command_id=`command-${++serial}`)=>app.inject({method:'POST',url:`/api/tactical/sandbox/${projection.battleId}/act`,payload:{command_id,revision:projection.revision,action}});
 return {app,create,act,read,setNow:(next:number)=>{at=next;},tick:()=>tick(),disposed:()=>disposed};
}
afterEach(async()=>{for(const app of running.splice(0))await app.close();});
const positionAndVitals=(projection:TacticalProjection)=>projection.units.map(unit=>({id:unit.id,cell:unit.cell,hp:unit.hp,shield:unit.shield,cooldowns:unit.cooldowns,statuses:unit.statuses.map(status=>({id:status.id,amount:status.amount,remaining:status.remaining}))}));

describe('isolated tactical sandbox HTTP',()=>{
 it('is absent unless the explicit sandbox flag is 1 and exposes only graybox content',async()=>{
  const disabled=fixture({env:{TACTICAL_SANDBOX:'0'}});
  for(const url of ['/api/tactical/sandbox/catalog','/api/tactical/sandbox/missing','/api/tactical/sandbox/missing/preview'])expect((await disabled.app.inject({url})).statusCode).toBe(404);
  expect((await disabled.app.inject({method:'POST',url:'/api/tactical/sandbox',payload:{boardId:normal.id,heroId:'sword'}})).statusCode).toBe(404);
  const f=fixture(),catalog=await f.app.inject({url:'/api/tactical/sandbox/catalog'});
  expect(catalog.statusCode).toBe(200);expect(catalog.json().boards).toHaveLength(5);expect(catalog.json().heroes.map((hero:{id:string})=>hero.id).sort()).toEqual(['hidden','sword']);
  const created=await f.create();expect(created).toMatchObject({revision:0,seed:37,controlMode:'manual',control:{deadlineAtMs:61_000,remainingMs:60_000,timeoutDue:false}});
  expect(created).not.toHaveProperty('rngState');expect(created).not.toHaveProperty('characterId');expect(created).not.toHaveProperty('rewards');
  expect((await f.read(created.battleId)).headers['cache-control']).toBe('no-store');
  expect((await f.app.inject({method:'POST',url:'/api/tactical/sandbox',payload:{boardId:normal.id,heroId:'sword',characterId:'real-character'}})).statusCode).toBe(400);
 });

 it('runs real move, skill and end commands through enemy resolution and reaches both terminal outcomes',async()=>{
  const f=fixture();let projection=await f.create();
  const moved=await f.act(projection,{type:'move',to:projection.reachable[0].cell});expect(moved.statusCode,moved.body).toBe(200);
  projection=moved.json().projection;expect(projection.budget.moveUsed).toBe(true);
  const ward=await f.act(projection,{type:'skill',skillId:'ward'});expect(ward.statusCode,ward.body).toBe(200);projection=ward.json().projection;
  // Both allowances resolve the enemy phase automatically; explicit end on the following
  // turn follows the exact same round machine.
  expect(projection.round).toBe(2);
  const ended=await f.act(projection,{type:'end'});expect(ended.statusCode,ended.body).toBe(200);projection=ended.json().projection;expect(projection.round).toBe(3);
  expect(ended.json().events.some((event:{sourceId:string})=>event.sourceId!=='hero'&&event.sourceId!=='system')).toBe(true);
  for(let turns=0;turns<40&&!projection.outcome;turns++){
   const round=projection.round,plan=chooseTacticalPlan(projection);
   for(const action of plan.actions){
    if(projection.outcome||projection.round!==round)break;
    const result=await f.act(projection,action);expect(result.statusCode,result.body).toBe(200);projection=result.json().projection;
   }
  }
  expect(projection.outcome).toBe('win');expect(projection.control?.phase).toBe('ended');expect(()=>TacticalProjectionSchema.parse(projection)).not.toThrow();
  let doomed=await f.create(boss.id);
  for(let turns=0;turns<30&&!doomed.outcome;turns++){
   const result=await f.act(doomed,{type:'end'});expect(result.statusCode,result.body).toBe(200);doomed=result.json().projection;
  }
  expect(doomed.outcome).toBe('loss');expect(doomed.control?.phase).toBe('ended');expect(()=>TacticalProjectionSchema.parse(doomed)).not.toThrow();
 });

 it.each(tacticalBoards.map(board=>[board.id] as const))('accepts real manual HTTP plans to a terminal outcome on %s',async boardId=>{
  const f=fixture();let projection=await f.create(boardId,'sword',37);
  for(let turn=0;turn<60&&!projection.outcome;turn++){
   const round=projection.round,plan=chooseTacticalPlan(projection);
   for(const action of plan.actions){
    if(projection.outcome||projection.round!==round)break;
    const response=await f.act(projection,action);expect(response.statusCode,response.body).toBe(200);projection=TacticalProjectionSchema.parse(response.json().projection);
   }
  }
  expect(['win','loss']).toContain(projection.outcome);expect(projection.control?.phase).toBe('ended');
  expect(projection.events?.some(event=>event.cause==='scheduler-error')).toBe(false);
 },30_000);

 it.each(tacticalBoards.map(board=>[board.id] as const))('advances by background timer alone to a terminal outcome on %s',async boardId=>{
  const f=fixture(),initial=await f.create(boardId,'hidden',37),automatic=await f.act(initial,{type:'set-control-mode',mode:'auto'});
  expect(automatic.statusCode,automatic.body).toBe(200);
  // No read request is made during these ticks. Functional cases at one seed are distinct
  // from T8's measured 5 boards x 2 heroes x 10 seeds parameter baseline.
  for(let turn=0;turn<60;turn++){f.setNow(1000+(turn+1)*250);f.tick();}
  const projection=TacticalProjectionSchema.parse((await f.read(initial.battleId)).json());
  expect(['win','loss']).toContain(projection.outcome);expect(projection.control?.phase).toBe('ended');
  expect(projection.events?.some(event=>event.cause==='scheduler-error')).toBe(false);
 },30_000);

 it('replays immutable command receipts, rejects ID/body conflicts and stale/concurrent CAS writes',async()=>{
  const f=fixture(),initial=await f.create(),first=await f.act(initial,{type:'skill',skillId:'ward'},'same-command');
  expect(first.statusCode,first.body).toBe(200);f.setNow(20_000);
  const replay=await f.act(initial,{type:'skill',skillId:'ward'},'same-command');expect(replay.body).toBe(first.body);
  const conflict=await f.act(initial,{type:'end'},'same-command');expect(conflict.statusCode).toBe(409);expect(conflict.json().error).toBe('TACTICAL_COMMAND_CONFLICT');
  const stale=await f.act(initial,{type:'end'},'stale-command');expect(stale.statusCode).toBe(409);expect(stale.json().error).toBe('TACTICAL_REVISION');
  const current=(await f.read(initial.battleId)).json() as TacticalProjection;
  expect(current.control?.deadlineAtMs).toBe(first.json().projection.control.deadlineAtMs);
  const concurrent=await Promise.all([f.act(current,{type:'end'},'concurrent-a'),f.act(current,{type:'end'},'concurrent-b')]);
  expect(concurrent.map(response=>response.statusCode).sort()).toEqual([200,409]);
  expect((await f.read(initial.battleId)).json().revision).toBe(current.revision!+1);
 });

 it('preview and rejected input do not change state, deadline, expiry or the subsequent random stream',async()=>{
  const f=fixture(),left=await f.create(normal.id,'hidden',123),right=await f.create(normal.id,'hidden',123),before=await f.read(left.battleId);
  const a=await f.app.inject({url:`/api/tactical/sandbox/${left.battleId}/preview`}),b=await f.app.inject({url:`/api/tactical/sandbox/${left.battleId}/preview`});
  expect(a.statusCode,a.body).toBe(200);expect(b.body).toBe(a.body);expect(a.json()).toHaveProperty('remainingHp');expect(a.json()).toHaveProperty('kills');
  expect((await f.read(left.battleId)).body).toBe(before.body);
  const hero=left.units.find(unit=>unit.side==='hero')!,invalid=await f.act(left,{type:'move',to:hero.cell});expect(invalid.statusCode).toBe(400);
  expect((await f.read(left.battleId)).body).toBe(before.body);
  expect((await f.app.inject({url:`/api/tactical/sandbox/${left.battleId}/preview?move=-1,2`})).statusCode).toBe(400);
  let nextLeft=left,nextRight=right;
  for(let turn=0;turn<3&&!nextLeft.outcome;turn++){
   const round=nextLeft.round;
   for(const action of chooseTacticalPlan(nextLeft).actions){
    if(nextLeft.outcome||nextLeft.round!==round)break;
    const l=await f.act(nextLeft,action),r=await f.act(nextRight,action);expect(l.statusCode,l.body).toBe(200);expect(r.statusCode,r.body).toBe(200);
    nextLeft=l.json().projection;nextRight=r.json().projection;
    expect(positionAndVitals(nextLeft)).toEqual(positionAndVitals(nextRight));expect(nextLeft.round).toBe(nextRight.round);
   }
  }
  f.setNow(3_600_999);expect((await f.read(left.battleId)).statusCode).toBe(200);
  f.setNow(3_601_000);expect((await f.read(left.battleId)).statusCode).toBe(404);
 });

 it.each(['sword','hidden'] as const)('accepts the catalog basic skill ID in preview for %s',async heroId=>{
  const f=fixture(),projection=await f.create(normal.id,heroId,37),before=await f.read(projection.battleId),target=projection.units.find(unit=>unit.side==='enemy')!.cell;
  const skill=heroId==='sword'?'cut':'throwing_knife';
  const preview=await f.app.inject({url:`/api/tactical/sandbox/${projection.battleId}/preview?skill=${skill}&target=${target.x},${target.y}`});
  expect(preview.statusCode,preview.body).toBe(200);expect(preview.json().damage).toBeGreaterThan(0);
  expect((await f.read(projection.battleId)).body).toBe(before.body);
 });

 it('GET remains read-only when overdue, while the independent scheduler takes over and finishes without polling',async()=>{
  const f=fixture(),initial=await f.create();f.setNow(61_000);
  const overdue=(await f.read(initial.battleId)).json();expect(overdue).toMatchObject({revision:0,controlMode:'manual',round:1,control:{timeoutDue:true,deadlineAtMs:61_000}});
  const preview=await f.app.inject({url:`/api/tactical/sandbox/${initial.battleId}/preview`});expect(preview.statusCode,preview.body).toBe(200);
  expect((await f.read(initial.battleId)).json()).toEqual(overdue);
  f.tick();const automatic=(await f.read(initial.battleId)).json();
  expect(automatic.controlMode).toBe('auto');expect(automatic.revision).toBeGreaterThan(0);expect(automatic.round).toBeLessThanOrEqual(2);
  expect(automatic.events.some((event:{cause:string})=>event.cause==='manual-timeout')).toBe(true);
  for(let index=0;index<25;index++){f.setNow(61_000+(index+1)*250);f.tick();}
  const finished=(await f.read(initial.battleId)).json();expect(finished.outcome).toBe('win');expect(finished.control.phase).toBe('ended');
  const revision=finished.revision;f.tick();expect((await f.read(initial.battleId)).json().revision).toBe(revision);
 });

 it('explicit takeover preserves combat budget and repeated requests never extend its manual deadline',async()=>{
  const f=fixture(),initial=await f.create(),automatic=await f.act(initial,{type:'set-control-mode',mode:'auto'});expect(automatic.statusCode).toBe(200);
  f.tick();let projection=(await f.read(initial.battleId)).json() as TacticalProjection;
  const before=positionAndVitals(projection),budget=projection.budget;
  const takeover=await f.act(projection,{type:'set-control-mode',mode:'manual'});expect(takeover.statusCode,takeover.body).toBe(200);projection=takeover.json().projection;
  expect(positionAndVitals(projection)).toEqual(before);expect(projection.budget).toEqual(budget);expect(projection.controlMode).toBe('manual');
  const deadline=projection.control?.deadlineAtMs;f.setNow(20_000);
  const again=await f.act(projection,{type:'set-control-mode',mode:'manual'});expect(again.statusCode,again.body).toBe(200);expect(again.json().projection.control.deadlineAtMs).toBe(deadline);
  const revision=again.json().revision;f.tick();expect((await f.read(initial.battleId)).json().revision).toBe(revision);
 });

 it('a late manual write cannot erase its expired timer, and timer disposal releases all sessions',async()=>{
  const f=fixture(),initial=await f.create();f.setNow(61_000);
  const late=await f.act(initial,{type:'end'});expect(late.statusCode).toBe(409);expect(late.json()).toMatchObject({error:'TACTICAL_TIMEOUT',projection:{controlMode:'auto',round:1}});
  expect(late.json().projection.budget).toEqual(initial.budget);
  await f.app.close();expect(f.disposed()).toBe(true);expect(()=>f.tick()).not.toThrow();
 });

 it('contains a scheduler clock exception without losing the committed encounter',async()=>{
  let failClock=false;
  const f=fixture({now:()=>{if(failClock)throw Error('synthetic clock failure');return 1000;}}),projection=await f.create(),before=await f.read(projection.battleId);
  failClock=true;expect(()=>f.tick()).not.toThrow();failClock=false;
  expect((await f.read(projection.battleId)).body).toBe(before.body);
 });

 it('bounds encounter and command storage without evicting live receipts; expiry is creation-based',async()=>{
  const f=fixture({maxEncounters:1,maxCommandsPerEncounter:1}),initial=await f.create();
  const full=await f.app.inject({method:'POST',url:'/api/tactical/sandbox',payload:{boardId:normal.id,heroId:'sword'}});expect(full.statusCode).toBe(429);
  const first=await f.act(initial,{type:'skill',skillId:'ward'},'one-command');expect(first.statusCode).toBe(200);
  const exhausted=await f.act(first.json().projection,{type:'end'},'two-command');expect(exhausted.statusCode).toBe(429);
  const replay=await f.act(initial,{type:'skill',skillId:'ward'},'one-command');expect(replay.body).toBe(first.body);
  f.setNow(3_601_000);const replacement=await f.create();expect(replacement.battleId).not.toBe(initial.battleId);expect((await f.read(initial.battleId)).statusCode).toBe(404);
 });
});
