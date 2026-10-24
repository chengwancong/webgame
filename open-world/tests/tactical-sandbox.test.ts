/**
 * 战棋沙盒前端适配（TAC-B1 冻结契约）。SandboxSource 的 fetch 直接转给进程内的真实沙盒路由
 * （registerTacticalSandbox + Fastify inject），投影、事件、预览与错误都是服务端原样输出，不手写假投影。
 * 只在 Node 里跑，不起浏览器。
 */
import Fastify from 'fastify';
import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {registerTacticalSandbox,type TacticalSandboxOptions} from '../apps/api/src/tactical-sandbox.ts';
import type {TacticalEvent as WireEvent,TacticalProjection} from '../packages/contracts/tactical.ts';
import {tacticalBoards} from '../packages/content/tactical-content.ts';
import {SandboxSource,wireCommandId} from '../apps/web/src/tactical/sandbox-source.ts';
import {commandToAction,eventsToView,fallbackMeta,projectionToView} from '../apps/web/src/tactical/sandbox-wire.ts';
import type {TacticalCommand,TacticalEncounterView,TacticalPush} from '../apps/web/src/tactical/contract.ts';

const normal=tacticalBoards.find(b=>b.difficulty==='normal')!;
const docMock={hidden:false,addEventListener:vi.fn(),removeEventListener:vi.fn()};
if(typeof (globalThis as any).document==='undefined')Object.defineProperty(globalThis,'document',{value:docMock,writable:true,configurable:true});

const running:ReturnType<typeof Fastify>[]=[];
type Call={method:string;url:string;body:any;status:number};
function harness(options:Partial<TacticalSandboxOptions>={}){
 const app=Fastify({logger:false});running.push(app);
 let at=1000,serial=0,tick=()=>{};
 registerTacticalSandbox(app,{env:{TACTICAL_SANDBOX:'1'},now:()=>at,makeId:()=>`sandbox-${++serial}`,makeSeed:()=>37,
  schedule:cb=>{tick=cb;return ()=>{};},...options});
 const calls:Call[]=[];
 vi.spyOn(globalThis,'fetch').mockImplementation((async(input:string,init?:RequestInit)=>{
  const method=init?.method??'GET',body=init?.body?JSON.parse(String(init.body)):undefined;
  const r=await app.inject({method:method as 'GET'|'POST',url:input,...(body?{payload:body}:{})});
  calls.push({method,url:input,body,status:r.statusCode});
  return new Response(r.body,{status:r.statusCode,headers:{'content-type':'application/json'}});
 }) as any);
 const src=new SandboxSource();
 const raw=async(id:string)=>(await app.inject({url:`/api/tactical/sandbox/${id}`})).json() as TacticalProjection;
 return {app,src,calls,raw,setNow:(n:number)=>{at=n;},tick:()=>tick()};
}
const cmd=(view:TacticalEncounterView,body:Partial<TacticalCommand>&{kind:TacticalCommand['kind']},id='cmd-1'):TacticalCommand=>
 ({commandId:id,encounterId:view.encounterId,expectedRevision:view.revision,actionToken:view.actionToken??'',...body} as TacticalCommand);

beforeEach(()=>{docMock.hidden=false;});
afterEach(async()=>{vi.restoreAllMocks();vi.useRealTimers();for(const app of running.splice(0))await app.close();});

describe('真实沙盒：目录与开局',()=>{
 it('读目录：五张棋盘、sword/hidden、编排默认值；开局请求体是驼峰 + 整数 seed + guard on/off',async()=>{
  const h=harness();
  const catalog=await h.src.loadCatalog();
  expect(catalog.boards).toHaveLength(5);
  expect(catalog.heroes.map(x=>x.id).sort()).toEqual(['hidden','sword']);
  expect(catalog.orchestration.defaults.guard).toMatch(/^(on|off)$/);
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37,orchestration:{priority:['whirl'],target:'lowest-hp',position:null,guard:false}});
  expect(h.calls.at(-1)!.body).toEqual({boardId:normal.id,heroId:'sword',seed:37,orchestration:{priority:['whirl'],guard:'off',target:'lowest-hp'}});
  expect(view).toMatchObject({source:'sandbox',revision:0,phase:'awaiting',pet:null,result:null});
  expect(view.node.objective).toContain('战棋沙盒 · 不发奖');
  expect(view.units.find(u=>u.side==='hero')).toMatchObject({name:'剑士',hp:{current:100,max:100}});
  expect(view.legalMoves.length).toBeGreaterThan(0);
  expect(view.abilities.find(a=>a.id==='cut')?.category).toBe('basic');
  expect(view.abilities.find(a=>a.id==='whirl')?.category).toBe('skill');
  expect(view.actionToken).not.toBeNull();
  expect(view.control).toMatchObject({mode:'manual',canRequestAuto:true,canRequestManual:false});
  expect(view.control.deadlineAtMs! - view.control.serverNowMs).toBe(60_000);
 });

 it('意图来自服务端 cells/line，序号 = sequence+1；可达格与路径照搬 reachable',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const raw=await h.raw(view.encounterId);
  expect(view.intents.map(i=>i.order)).toEqual(raw.intents.map(i=>i.sequence+1));
  for(const [i,intent] of view.intents.entries()){
   const w=raw.intents[i];
   if(w.hidden){expect(intent).toMatchObject({hidden:true,label:'?',cells:[],damage:null});continue;}
   expect(intent.cells).toEqual(w.cells);
   expect(intent.line).toEqual(w.line.length?w.line:null);
  }
  expect(view.legalMoves).toEqual(raw.reachable);
 });

 it('429 容量满、404 过期：不可重试的明确错误',async()=>{
  const h=harness({maxEncounters:1});await h.src.loadCatalog();
  await h.src.create({boardId:normal.id,heroId:'sword'});
  await expect(h.src.create({boardId:normal.id,heroId:'sword'})).rejects.toMatchObject({code:'load-failed',retryable:false});
  await expect(h.src.load('missing')).rejects.toMatchObject({code:'not-found',retryable:false});
 });
});

describe('真实沙盒：行动、拒绝与冲突',()=>{
 it('移动：act 请求体符合契约，回执带本次事件，投影立即推给订阅者',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const pushes:TacticalPush[]=[];h.src.subscribe(view.encounterId,p=>pushes.push(p));
  const to=view.legalMoves.at(-1)!.cell;
  const r=await h.src.submit(cmd(view,{kind:'move',to},'cmd-lx.2'));
  expect(h.calls.at(-1)!.body).toEqual({command_id:'cmd-lx-2',revision:0,action:{type:'move',to}});
  expect(r.accepted).toBe(true);expect(r.revision).toBe(1);
  const move=r.events.find(e=>e.kind==='move');
  expect(move).toMatchObject({kind:'move',path:view.legalMoves.at(-1)!.path});
  expect(pushes).toHaveLength(1);
  expect(pushes[0].view.budget.moveUsed).toBe(true);
  expect(pushes[0].view.legalMoves).toEqual([]);
 });

 it('同一 commandId 重发只发一次请求',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const c=cmd(view,{kind:'move',to:view.legalMoves[0].cell},'dup');
  const before=h.calls.length;
  const [a,b]=await Promise.all([h.src.submit(c),h.src.submit(c)]);
  expect(a).toBe(b);expect(h.calls.length-before).toBe(1);
 });

 it('非法行动 400 → 拒绝回执（带服务端原话），不是断线',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const r=await h.src.submit(cmd(view,{kind:'ability',abilityId:'cut',target:{x:view.board.width-1,y:view.board.height-1}}));
  expect(h.calls.at(-1)).toMatchObject({status:400,body:{action:{type:'basic'}}});
  expect(r.accepted).toBe(false);expect(r.denial?.code).toBe('invalid-target');expect(r.denial?.message).toBeTruthy();
 });

 it('修订号过期 409 → 推送最新投影并报 stale-revision',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  // 另一个标签页先行动了一步，本页仍拿着 revision 0
  await h.app.inject({method:'POST',url:`/api/tactical/sandbox/${view.encounterId}/act`,payload:{command_id:'other-tab',revision:0,action:{type:'move',to:view.legalMoves[0].cell}}});
  const pushes:TacticalPush[]=[];h.src.subscribe(view.encounterId,p=>pushes.push(p));
  await expect(h.src.submit(cmd(view,{kind:'end-activation'},'b'))).rejects.toMatchObject({code:'stale-revision'});
  expect(pushes.at(-1)?.view.revision).toBe(1);
  expect(pushes.at(-1)?.events.some(e=>e.kind==='move')).toBe(true);
 });

 it('手动超时 409 TACTICAL_TIMEOUT → 拒绝说明 + 推送托管投影',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const pushes:TacticalPush[]=[];h.src.subscribe(view.encounterId,p=>pushes.push(p));
  h.setNow(1000+60_001);
  const r=await h.src.submit(cmd(view,{kind:'end-activation'}));
  expect(r.accepted).toBe(false);expect(r.denial?.message).toContain('托管');
  expect(pushes.at(-1)?.view.control.mode).toBe('auto');
  expect(pushes.at(-1)?.events.some(e=>e.kind==='control'&&e.change==='timeout-auto')).toBe(true);
 });

 it('结束行动 → 敌方结算事件全部映射，ID = resolutionId 且不重复',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const r=await h.src.submit(cmd(view,{kind:'end-activation'}));
  expect(r.accepted).toBe(true);
  const ids=r.events.map(e=>e.id);
  expect(new Set(ids).size).toBe(ids.length);
  const raw=await h.raw(view.encounterId);
  for(const id of ids)expect(raw.events!.some(e=>e.resolutionId===id)).toBe(true);
  expect(r.events.some(e=>e.kind==='turn')).toBe(true);
 });

 it('暗器手普攻 throwing_knife 走 basic，其他技能走 skill',()=>{
  const base={commandId:'c',encounterId:'e',expectedRevision:0,actionToken:'t'};
  expect(commandToAction({...base,kind:'ability',abilityId:'throwing_knife',target:{x:1,y:1}},'throwing_knife')).toEqual({type:'basic',target:{x:1,y:1}});
  expect(commandToAction({...base,kind:'ability',abilityId:'toxic_bomb',target:{x:1,y:1}},'throwing_knife')).toEqual({type:'skill',skillId:'toxic_bomb',target:{x:1,y:1}});
  expect(commandToAction({...base,kind:'end-activation'},'cut')).toEqual({type:'end'});
 });

 it('撤退在本地拒绝，不发请求；command_id 只留 [A-Za-z0-9_-]',async()=>{
  const h=harness();
  const r=await h.src.submit({commandId:'r',encounterId:'e',expectedRevision:0,actionToken:'t',kind:'retreat'});
  expect(r.denial?.code).toBe('unsupported');expect(h.calls).toHaveLength(0);
  expect(wireCommandId('end:1.a b')).toBe('end-1-a-b');
 });
});

describe('真实沙盒：预览',()=>{
 it('移动预览：路径取可达格；预测剩余生命来自服务端 remainingHp',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const m=view.legalMoves.at(-1)!;
  const p=await h.src.preview(view.encounterId,{kind:'move',to:m.cell});
  expect(h.calls.at(-1)!.url).toContain(`preview?move=${m.cell.x},${m.cell.y}`);
  expect(p.ok).toBe(true);
  if(p.ok&&p.kind==='move'){expect(p.path).toEqual(m.path);expect(p.forecast?.heroMaxHp).toBe(100);expect(p.notes.join()).toContain('期望');}
 });

 it('技能预览：列出预计伤害/击杀；非法 400 → denial',async()=>{
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const hero=view.units.find(u=>u.side==='hero')!;
  const ok=await h.src.preview(view.encounterId,{kind:'ability',abilityId:'ward',target:hero.cell});
  expect(ok.ok).toBe(true);
  if(ok.ok&&ok.kind==='ability')expect(ok.known.map(k=>k.label)).toContain('预计伤害合计');
  const bad=await h.src.preview(view.encounterId,{kind:'ability',abilityId:'cut',target:{x:view.board.width-1,y:view.board.height-1}});
  expect(bad).toMatchObject({ok:false,denial:{code:'invalid-target'}});
 });
});

describe('真实沙盒：轮询去重',()=>{
 it('手动等待未到期不轮询；托管中按 resolutionId 只推新事件，不重播历史',async()=>{
  vi.useFakeTimers({toFake:['setTimeout','clearTimeout']});
  const h=harness();await h.src.loadCatalog();
  const view=await h.src.create({boardId:normal.id,heroId:'sword',seed:37});
  const pushes:TacticalPush[]=[];h.src.subscribe(view.encounterId,p=>pushes.push(p));
  const before=h.calls.length;
  await vi.advanceTimersByTimeAsync(6000);
  expect(h.calls.length).toBe(before);
  await h.src.control({commandId:'auto-1',encounterId:view.encounterId,op:'request-auto'});
  const afterControl=pushes.length;
  h.tick();
  await vi.advanceTimersByTimeAsync(2600);
  const fresh=pushes.slice(afterControl).flatMap(p=>p.events.map(e=>e.id));
  expect(fresh.length).toBeGreaterThan(0);
  expect(new Set(fresh).size).toBe(fresh.length);
  const seenBefore=new Set(pushes.slice(0,afterControl).flatMap(p=>p.events.map(e=>e.id)));
  for(const id of fresh)expect(seenBefore.has(id)).toBe(false);
  const n=pushes.length;
  await vi.advanceTimersByTimeAsync(1100);
  expect(pushes.slice(n).flatMap(p=>p.events)).toHaveLength(0);
 });
});

describe('线格式映射（单条）',()=>{
 const ev=(o:Partial<WireEvent>&{type:string}):WireEvent=>({battleId:'b',round:1,ownerTurnId:'t',actionId:'a',resolutionId:`a:r${Math.random()}`,sourceId:'hero',cause:'x',...o});
 it('护盾吸收并入随后的伤害；控制事件按 detail；胜负 → 结果',()=>{
  const out=eventsToView([ev({type:'shield-absorbed',targetId:'e1',amount:4}),ev({type:'damage',targetId:'e1',amount:5.5}),
   ev({type:'control',sourceId:'system',cause:'manual-timeout',detail:'timeout-auto'}),ev({type:'control',sourceId:'system',cause:'encounter',detail:'manual'}),
   ev({type:'outcome',cause:'win'}),ev({type:'heal',targetId:'e2',amount:6})]);
  expect(out[0]).toMatchObject({kind:'damage',unitId:'e1',amount:10,absorbed:4});
  expect(out[1]).toMatchObject({kind:'control',change:'timeout-auto'});
  expect(out[2]).toMatchObject({kind:'result',outcome:'victory'});
  expect(out[3]).toMatchObject({kind:'note'});
  expect(out).toHaveLength(4);
 });
 it('隐藏意图只显示"?"；毒区显示为危险格；结束局面写明不发奖',async()=>{
  const h=harness();await h.src.loadCatalog();
  const v=await h.src.create({boardId:normal.id,heroId:'hidden',seed:37});
  const raw=await h.raw(v.encounterId);
  const enemy=raw.units.find(u=>u.side==='enemy')!;
  raw.intents=[{id:'i1',sourceId:enemy.id,type:'grid',sequence:0,cells:[{x:1,y:1}],line:[],damage:9,tier:'lethal',range:1,move:0,executeRound:1,hidden:true}];
  raw.zones=[{id:'z',kind:'poison',sourceId:'hero',cells:[{x:2,y:2}],damage:4,remaining:2,activeFromRound:1,rootActionId:'a'}];
  raw.outcome='win';
  const view=projectionToView(raw,fallbackMeta());
  expect(view.intents[0]).toMatchObject({hidden:true,label:'?',cells:[],damage:null});
  expect(view.intents[0].tier).toBeUndefined();
  expect(view.board.cells.find(c=>c.x===2&&c.y===2)?.hazard?.label).toBe('毒区');
  expect(view.phase).toBe('ended');expect(view.result?.rewardsNote).toContain('不发奖');expect(view.result?.rewards).toEqual([]);
  expect(view.units.find(u=>u.side==='hero')?.name).toBe('暗器手');
 });
});
