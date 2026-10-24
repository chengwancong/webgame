/**
 * 隔离 fixture（仅预览页使用，不接 World、存档、掉落或奖励）。
 *
 * 它在浏览器内扮演「服务端」：移动可达/夹角/额度借用 packages/simulation/tactical/board.ts，
 * 宠物辅助上限借用 support.ts，手动/托管/超时状态机借用 control.ts。伤害、射程、视线、敌方行动、
 * 托管策略、冷却都是写死的样例值，不是正式规则，界面上一律标注「fixture」。
 * 生产实现必须换成服务端 TacticalSource，前端组件不感知差别。
 */
import {freshTacticalBudget,spendTacticalAction,tacticalPath,tacticalReachable} from '../../../../packages/simulation/tactical/board.ts';
import type {TacticalActionBudget,TacticalBoard} from '../../../../packages/simulation/tactical/board.ts';
import {claimTacticalSupport,freshSupportLedger} from '../../../../packages/simulation/tactical/support.ts';
import type {TacticalSupportLedger} from '../../../../packages/simulation/tactical/support.ts';
import {beginAwait,beginEnemyTurn,beginResolving,completeResolving,endTacticalControl,newTacticalControl,
 requestAuto,requestManual,resolveTimeout,tacticalControlView} from '../../../../packages/simulation/tactical/control.ts';
import type {TacticalControlEvent,TacticalControlState} from '../../../../packages/simulation/tactical/control.ts';
import {TacticalSourceError,cellKey,sameCell} from './contract.ts';
import type {TacticalAbilityView,TacticalCell,TacticalCellView,TacticalCommand,TacticalControlCommand,TacticalDenial,
 TacticalEncounterHandle,TacticalEncounterIntent,TacticalEncounterView,TacticalEvent,TacticalForecast,TacticalIntentView,
 TacticalPreview,TacticalPreviewRequest,
 TacticalPush,TacticalReceipt,TacticalResultView,TacticalSource,TacticalUnitView} from './contract.ts';

export const fixtureScenarios=['default','timeout','defeat','load-error','conflict','version','empty','intents'] as const;
export type FixtureScenario=typeof fixtureScenarios[number];
export type FixtureOptions={scenario:FixtureScenario;waitMs:number;warningMs:number;
 /** 服务端时钟相对本机的偏移，用来证明界面只按服务端时间基准显示倒计时。 */
 skewMs:number;latencyMs:number;
 /** 动作节奏倍率（测试用 0 以外的小值加速）。 */
 pace:number};
export const defaultFixtureOptions:FixtureOptions={scenario:'default',waitMs:60_000,warningMs:10_000,skewMs:4_000,latencyMs:120,pace:1};

/** fixture 样例数值：全部不是正式数值，只为驱动界面状态。 */
export const FIXTURE={
 board:{width:9,height:7},moveSteps:3,heroStart:{x:1,y:3},
 blockers:[{x:2,y:1,dressing:'tree'},{x:3,y:2,dressing:'rocks'},{x:3,y:3,dressing:'rocks'},{x:2,y:4,dressing:'boulder'},{x:4,y:6,dressing:'boulder'}],
 hazard:{x:5,y:4},
 enemies:[{id:'enemy-a',name:'暮界刀兵 甲',cell:{x:6,y:2}},{id:'enemy-b',name:'暮界刀兵 乙',cell:{x:7,y:4}}],
 heroHp:120,enemyHp:40,basicDamage:18,cleaveDamage:12,enemyDamage:14,enemyMoveSteps:2,petShield:10,petLimitPerRound:1,
 defeat:{heroHp:30,enemyDamage:22},
 timing:{stepMs:220,moveTailMs:300,abilityMs:750,endMs:160,enemyGapMs:700,autoDelayMs:900,settleMs:1500,tickMs:200},
} as const;

const chebyshev=(a:TacticalCell,b:TacticalCell)=>Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
type Unit={id:string;side:'hero'|'enemy';name:string;cell:TacticalCell;hp:number;maxHp:number;shield:number;alive:boolean};
type PendingEvent=TacticalEvent extends infer E?E extends TacticalEvent?Omit<E,'id'|'seq'|'atMs'>&{id?:string;atMs?:number}:never:never;
const petReason:Record<string,string>={limit:'本回合已辅助过（每回合 1 次，fixture 上限）',condition:'辅助条件未满足',
 duplicate:'同一动作不重复触发',recursive:'辅助不会再次触发辅助',turn:'不在本回合的触发窗口'};

export class FixtureServer{
 readonly id:string;private control:TacticalControlState;private revision=0;private seq=0;private round=1;private actionSerial=0;
 private units:Unit[];private budget:TacticalActionBudget=freshTacticalBudget();private ledger:TacticalSupportLedger;
 private events:TacticalEvent[]=[];private receipts=new Map<string,TacticalReceipt>();
 private listeners=new Set<(push:TacticalPush)=>void>();private timers=new Set<ReturnType<typeof setTimeout>>();
 private ticker:ReturnType<typeof setInterval>;private enemyTurn=false;private enemyActor:string|null=null;
 private settle:'settling'|'ended'|null=null;private result:TacticalResultView|null=null;
 private autoAtMs:number|null=null;private autoReason:'manual-timeout'|'player'|null=null;private cleaveUsedRound:number|null=null;
 private heroDamage:number;private enemyDamage:number;
 constructor(readonly options:FixtureOptions,serial:number){
  this.id=`fx-enc-${serial}`;
  const defeat=options.scenario==='defeat';
  this.heroDamage=FIXTURE.basicDamage;this.enemyDamage=defeat?FIXTURE.defeat.enemyDamage:FIXTURE.enemyDamage;
  const heroHp=defeat?FIXTURE.defeat.heroHp:FIXTURE.heroHp;
  this.units=[{id:'hero',side:'hero',name:'星海旅人',cell:{...FIXTURE.heroStart},hp:heroHp,maxHp:FIXTURE.heroHp,shield:0,alive:true},
   ...FIXTURE.enemies.map(e=>({id:e.id,side:'enemy' as const,name:e.name,cell:{...e.cell},hp:FIXTURE.enemyHp,maxHp:FIXTURE.enemyHp,shield:0,alive:true}))];
  this.ledger=freshSupportLedger(this.roundKey());
  this.control=newTacticalControl(this.id,this.now(),{waitMs:options.waitMs,warningMs:Math.min(options.warningMs,options.waitMs)});
  this.ticker=setInterval(()=>this.tick(),FIXTURE.timing.tickMs);
  this.startHeroTurn();
 }
 now(){return Date.now()+this.options.skewMs;}
 private ms(value:number){return Math.max(1,Math.round(value*this.options.pace));}
 private roundKey(){return `${this.id}:r${this.round}`;}
 private heroTurnId(){return `${this.roundKey()}:hero`;}
 private enemyTurnId(){return `${this.roundKey()}:enemy`;}
 private hero(){return this.units[0];}
 private enemies(){return this.units.filter(u=>u.side==='enemy'&&u.alive);}
 private later(fn:()=>void,ms:number){const t=setTimeout(()=>{this.timers.delete(t);fn();},this.ms(ms));this.timers.add(t);}
 destroy(){clearInterval(this.ticker);for(const t of this.timers)clearTimeout(t);this.timers.clear();this.listeners.clear();}
 subscribe(listener:(push:TacticalPush)=>void){this.listeners.add(listener);return ()=>{this.listeners.delete(listener);};}

 private commit(pending:PendingEvent[]){
  const at=this.now(),fresh=pending.map(p=>({...p,id:p.id??`${this.id}:ev:${this.seq+1}`,seq:++this.seq,atMs:p.atMs??at}) as TacticalEvent);
  this.events.push(...fresh);this.revision++;
  const push={events:fresh,view:this.view()};
  for(const l of [...this.listeners])l(push);
  return fresh;
 }
 private controlEvents(events:TacticalControlEvent[]):PendingEvent[]{
  return events.map(e=>({id:e.id,atMs:e.atMs,actionId:null,kind:'control',change:e.kind}));
 }

 // ── 回合流程 ───────────────────────────────────────────────
 private startHeroTurn(){
  this.enemyTurn=false;this.enemyActor=null;this.budget=freshTacticalBudget();this.ledger=freshSupportLedger(this.roundKey());
  const t=beginAwait(this.control,this.heroTurnId(),this.budget,this.now());this.control=t.state;
  this.commit([{actionId:null,kind:'turn',phase:'hero',round:this.round},...this.controlEvents(t.events)]);
  this.afterAwait();
 }
 private afterAwait(){this.autoAtMs=this.control.mode==='auto'&&this.control.phase==='awaiting'?this.now()+this.ms(FIXTURE.timing.autoDelayMs):null;}
 private tick(){
  if(this.settle)return;
  const c=this.control;
  if(c.phase==='awaiting'&&c.mode==='manual'&&c.waiting&&this.now()>=c.waiting.deadlineAtMs){
   const t=resolveTimeout(c,this.now());
   if(t.events.length){this.control=t.state;this.autoReason='manual-timeout';this.commit(this.controlEvents(t.events));this.afterAwait();}
   return;
  }
  if(c.phase==='awaiting'&&c.mode==='auto'&&this.autoAtMs!==null&&this.now()>=this.autoAtMs){this.autoAtMs=null;this.autoStep();}
 }

 // ── 校验（与 preview 共用；预览不改任何状态） ─────────────────
 private board(exclude:string):TacticalBoard{
  return {width:FIXTURE.board.width,height:FIXTURE.board.height,blocked:FIXTURE.blockers.map(b=>({x:b.x,y:b.y})),
   occupied:this.units.filter(u=>u.alive&&u.id!==exclude).map(u=>({...u.cell}))};
 }
 private inside(c:TacticalCell){return Number.isInteger(c.x)&&Number.isInteger(c.y)&&c.x>=0&&c.y>=0&&c.x<FIXTURE.board.width&&c.y<FIXTURE.board.height;}
 private blocker(c:TacticalCell){return FIXTURE.blockers.some(b=>b.x===c.x&&b.y===c.y);}
 private heroTurnOpen(){return !this.settle&&!this.enemyTurn&&this.control.phase==='awaiting'&&!this.budget.ended;}
 private denyMove(to:TacticalCell):TacticalDenial|{path:TacticalCell[]}{
  if(!this.heroTurnOpen())return {code:'not-your-turn',message:'现在不能操作。'};
  if(this.budget.moveUsed)return {code:'used',message:'本回合的移动已用。'};
  const hero=this.hero();
  if(!this.inside(to)||sameCell(to,hero.cell))return {code:'invalid-target',message:'无法选择这个目标。'};
  if(this.blocker(to))return {code:'blocked',message:'无法通行'};
  if(this.units.some(u=>u.alive&&u.id!=='hero'&&sameCell(u.cell,to)))return {code:'occupied',message:'已被占用'};
  const board=this.board('hero'),path=tacticalPath(board,hero.cell,to,FIXTURE.moveSteps);
  if(path)return {path};
  if(chebyshev(hero.cell,to)<=FIXTURE.moveSteps&&this.cornerCut(board,hero.cell,to))return {code:'corner',message:'斜向两侧须可通行，不能穿过夹角。'};
  const far=tacticalPath(board,hero.cell,to,FIXTURE.board.width*FIXTURE.board.height);
  if(far)return {code:'out-of-budget',message:`目标超出范围（需要${far.length-1}步，本次最多${FIXTURE.moveSteps}步）`};
  return {code:'unreachable',message:'当前无法到达这里。'};
 }
 /** 目标与某个「步数还够」的可达格斜向相邻，且那一步因夹角被禁止。 */
 private cornerCut(board:TacticalBoard,from:TacticalCell,to:TacticalCell){
  const free=(c:TacticalCell)=>this.inside(c)&&!board.blocked.some(b=>sameCell(b,c))&&!board.occupied.some(b=>sameCell(b,c));
  const sources=[{cell:from,cost:0},...tacticalReachable(board,from,FIXTURE.moveSteps-1)];
  return sources.some(s=>Math.abs(s.cell.x-to.x)===1&&Math.abs(s.cell.y-to.y)===1&&
   (!free({x:to.x,y:s.cell.y})||!free({x:s.cell.x,y:to.y})));
 }
 private sight(from:TacticalCell,to:TacticalCell){
  const steps=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y))*4;
  for(let i=1;i<steps;i++){
   const x=Math.round(from.x+(to.x-from.x)*i/steps),y=Math.round(from.y+(to.y-from.y)*i/steps);
   if((x!==from.x||y!==from.y)&&(x!==to.x||y!==to.y)&&this.blocker({x,y}))return false;
  }
  return true;
 }
 private abilityDefs(){
  const cleaveReady=this.cleaveUsedRound===null||this.round>=this.cleaveUsedRound+2;
  return [
   {id:'fx-basic',slot:0,label:'普通攻击',iconSrc:'/art/ui-v2/skill-handdrawn/skill-cut.png',category:'basic',migration:'supported',
    available:true,reason:null,cost:'占用本回合技能额度',cooldown:null,rangeText:'相邻 1 格（含斜向）',
    description:'对一个相邻敌人造成伤害。fixture 固定 18 点。',range:1,area:'single',ready:true},
   {id:'fx-cleave',slot:1,label:'横扫',iconSrc:'/art/ui-v2/skill-handdrawn/skill-cleave.png',category:'skill',migration:'supported',
    available:cleaveReady,reason:cleaveReady?null:'冷却中（fixture：使用后隔一回合）',cost:'占用本回合技能额度',
    cooldown:cleaveReady?'使用后冷却 1 回合（fixture）':'冷却中，下下回合可用（fixture）',rangeText:'2 格内、需视线；十字 5 格',
    description:'对目标格及上下左右造成伤害。fixture 每个目标 12 点。',range:2,area:'plus',ready:cleaveReady},
   {id:'legacy-fireball',slot:2,label:'火球术',iconSrc:'/art/ui-v2/skill-handdrawn/skill-fireball.png',category:'skill',migration:'unsupported',
    available:false,reason:'尚未迁移到回合制',cost:null,cooldown:null,rangeText:null,description:'旧实时技能，回合制规则尚未定义。',range:0,area:'single',ready:false},
   {id:'legacy-barrier',slot:3,label:'屏障',iconSrc:'/art/ui-v2/skill-handdrawn/skill-barrier.png',category:'skill',migration:'unsupported',
    available:false,reason:'尚未迁移到回合制',cost:null,cooldown:null,rangeText:null,description:'旧实时技能，回合制规则尚未定义。',range:0,area:'single',ready:false},
  ] as const;
 }
 private area(def:{area:'single'|'plus'},target:TacticalCell){
  return (def.area==='plus'?[[0,0],[1,0],[-1,0],[0,1],[0,-1]]:[[0,0]]).map(([dx,dy])=>({x:target.x+dx,y:target.y+dy})).filter(c=>this.inside(c));
 }
 private rangeCells(range:number){
  const hero=this.hero().cell,cells:TacticalCell[]=[];
  for(let y=0;y<FIXTURE.board.height;y++)for(let x=0;x<FIXTURE.board.width;x++)if((x!==hero.x||y!==hero.y)&&chebyshev(hero,{x,y})<=range)cells.push({x,y});
  return cells;
 }
 private denyAbility(abilityId:string,target:TacticalCell){
  const def=this.abilityDefs().find(a=>a.id===abilityId);
  if(!def)return {ok:false as const,denial:{code:'invalid-target',message:'无法选择这个目标。'} as TacticalDenial};
  if(!this.heroTurnOpen())return {ok:false as const,denial:{code:'not-your-turn',message:'现在不能操作。'} as TacticalDenial};
  if(def.migration!=='supported')return {ok:false as const,denial:{code:'unsupported',message:'这个技能尚未迁移到回合制。'} as TacticalDenial};
  if(this.budget.mainActionUsed)return {ok:false as const,denial:{code:'used',message:'本回合的技能已用。'} as TacticalDenial};
  if(!def.ready)return {ok:false as const,denial:{code:'used',message:def.reason??'冷却中'} as TacticalDenial};
  const hero=this.hero().cell;
  if(!this.inside(target)||sameCell(target,hero))return {ok:false as const,denial:{code:'invalid-target',message:'无法选择这个目标。'} as TacticalDenial};
  if(chebyshev(hero,target)>def.range)return {ok:false as const,denial:{code:'out-of-range',message:'目标超出范围'} as TacticalDenial};
  if(!this.sight(hero,target))return {ok:false as const,denial:{code:'sight',message:'目标被遮挡'} as TacticalDenial};
  const affected=this.area(def,target),targets=this.enemies().filter(e=>affected.some(c=>sameCell(c,e.cell)));
  if(def.area==='single'&&!targets.length)return {ok:false as const,denial:{code:'invalid-target',message:'无法选择这个目标。'} as TacticalDenial};
  return {ok:true as const,def,affected,targets};
 }
 /** fixture 寻路：沿共享原型的合法路径走向「与某个目标相邻」的最近格，截到本次步数。已相邻或无路时返回 null。 */
 private approach(unitId:string,targets:TacticalCell[],steps:number):TacticalCell[]|null{
  const unit=this.units.find(u=>u.id===unitId)!;
  if(targets.some(t=>chebyshev(t,unit.cell)<=1))return null;
  const board=this.board(unitId),limit=FIXTURE.board.width*FIXTURE.board.height;
  let best:TacticalCell[]|null=null;
  for(const t of targets)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
   const goal={x:t.x+dx,y:t.y+dy};
   if((dx||dy)&&this.inside(goal)&&!this.blocker(goal)&&!board.occupied.some(o=>sameCell(o,goal))){
    const path=tacticalPath(board,unit.cell,goal,limit);if(path&&(!best||path.length<best.length))best=path;
   }
  }
  if(!best||best.length<2)return null;
  return best.slice(0,Math.min(best.length,steps+1));
 }

 // ── 只读预览 ───────────────────────────────────────────────
 preview(request:TacticalPreviewRequest):TacticalPreview{
  if(request.kind==='move'){
   const r=this.denyMove(request.to);if('code' in r)return {ok:false,denial:r};
   const forecast=this.buildForecast([],[]);
   return {ok:true,kind:'move',destination:{...request.to},path:r.path,steps:r.path.length-1,notes:['这是移动预览，尚未执行。','一次移动不可拆成技能前后两段。'],forecast};
  }
  const r=this.denyAbility(request.abilityId,request.target);if(!r.ok)return {ok:false,denial:r.denial};
  const damage=r.def.id==='fx-basic'?this.heroDamage:FIXTURE.cleaveDamage;
  const kills=r.targets.filter(t=>t.hp-damage<=0).map(t=>t.id);
  const dmgMap=r.targets.map(t=>({unitId:t.id,amount:Math.min(damage,t.hp+t.shield)}));
  const forecast=this.buildForecast(kills,dmgMap);
  return {ok:true,kind:'ability',abilityId:r.def.id,target:{...request.target},rangeCells:this.rangeCells(r.def.range),affectedCells:r.affected,
   targets:r.targets.map(t=>t.id),known:[{label:'影响',value:`影响${r.affected.length}格`},{label:'命中单位',value:r.targets.length?r.targets.map(t=>t.name).join('、'):'范围内暂无敌人'},
    {label:'伤害',value:`每个目标 ${damage}（fixture 固定值）`}],
   uncertain:['部分结果将在行动时确定。','暴击、闪避与抗性尚未接入。'],notes:['普攻也占用本回合的技能额度。'],forecast};
 }

 // ── 指令 ───────────────────────────────────────────────────
 actionToken(){return this.heroTurnOpen()?`${this.heroTurnId()}:${this.control.sequence}`:null;}
 submit(command:TacticalCommand):TacticalReceipt{
  const prior=this.receipts.get(command.commandId);if(prior)return prior;
  if(command.encounterId!==this.id)throw new TacticalSourceError('not-found','暂时没能载入战场',false);
  if(command.expectedRevision!==this.revision||command.actionToken!==this.actionToken())throw new TacticalSourceError('stale-revision','同步完成后再继续操作。');
  const receipt=this.run(command,'manual');this.receipts.set(command.commandId,receipt);return receipt;
 }
 private run(command:TacticalCommand,controller:'manual'|'auto'):TacticalReceipt{
  const deny=(denial:TacticalDenial):TacticalReceipt=>({commandId:command.commandId,accepted:false,revision:this.revision,events:[],denial});
  if(command.kind==='retreat'){
   if(!this.heroTurnOpen()||this.control.mode!=='manual')return deny({code:'not-your-turn',message:'现在不能操作。'});
   const events=this.finish('retreat');return {commandId:command.commandId,accepted:true,revision:this.revision,events};
  }
  if(!this.heroTurnOpen())return deny({code:'not-your-turn',message:'现在不能操作。'});
  if(this.control.mode!==controller)return deny({code:'not-your-turn',message:'当前由托管控制。'});
  if(this.control.waiting&&this.now()>=this.control.waiting.deadlineAtMs){
   // 迟到的手动指令不能抢在超时之前：先落超时，再拒绝。
   this.tick();return deny({code:'not-your-turn',message:'等待超时，已转为托管'});
  }
  const hero=this.hero(),actionId=`${this.id}:act:${++this.actionSerial}`,pending:PendingEvent[]=[];let duration:number;
  if(command.kind==='move'){
   const r=this.denyMove(command.to);if('code' in r)return deny(r);
   this.budget=spendTacticalAction(this.budget,'move');
   this.control=beginResolving(this.control,{actionId,ownerTurnId:this.heroTurnId(),actor:'hero',controller},this.now()).state;
   hero.cell={...command.to};pending.push({actionId,kind:'move',unitId:'hero',path:r.path});
   duration=(r.path.length-1)*FIXTURE.timing.stepMs+FIXTURE.timing.moveTailMs;
  }else if(command.kind==='ability'){
   const r=this.denyAbility(command.abilityId,command.target);if(!r.ok)return deny(r.denial);
   this.budget=spendTacticalAction(this.budget,r.def.category==='basic'?'basic':'skill');
   if(r.def.id==='fx-cleave')this.cleaveUsedRound=this.round;
   this.control=beginResolving(this.control,{actionId,ownerTurnId:this.heroTurnId(),actor:'hero',controller},this.now()).state;
   pending.push({actionId,kind:'ability',unitId:'hero',abilityId:r.def.id,label:r.def.label,target:{...command.target}});
   const damage=r.def.id==='fx-basic'?this.heroDamage:FIXTURE.cleaveDamage;
   for(const t of r.targets)pending.push(...this.hurt(t,'hero',damage,actionId));
   duration=FIXTURE.timing.abilityMs;
  }else{
   this.budget=spendTacticalAction(this.budget,'end');
   this.control=beginResolving(this.control,{actionId,ownerTurnId:this.heroTurnId(),actor:'hero',controller},this.now()).state;
   pending.push({actionId,kind:'end-activation',unitId:'hero'});duration=FIXTURE.timing.endMs;
  }
  this.autoAtMs=null;
  const events=this.commit(pending);
  this.later(()=>this.completeHero(actionId),duration);
  return {commandId:command.commandId,accepted:true,revision:this.revision,events};
 }
 private hurt(target:Unit,sourceId:string,amount:number,actionId:string):PendingEvent[]{
  const absorbed=Math.min(target.shield,amount);target.shield-=absorbed;target.hp=Math.max(0,target.hp-(amount-absorbed));
  const out:PendingEvent[]=[{actionId,kind:'damage',unitId:target.id,sourceId,amount,absorbed,hpAfter:target.hp}];
  if(target.hp<=0){target.alive=false;out.push({actionId,kind:'defeated',unitId:target.id});}
  return out;
 }
 private completeHero(actionId:string){
  if(this.settle)return;
  const t=completeResolving(this.control,actionId,this.budget,this.now());this.control=t.state;
  if(t.events.length)this.autoReason=null;
  if(!this.enemies().length){this.commit(this.controlEvents(t.events));this.finish('victory');return;}
  this.commit(this.controlEvents(t.events));
  if(this.control.phase==='awaiting')this.afterAwait();else this.startEnemyTurn();
 }

 // ── fixture 敌方脚本（不是正式 AI） ────────────────────────
 private startEnemyTurn(){
  this.enemyTurn=true;
  const t=beginEnemyTurn(this.control,this.enemyTurnId(),this.now());this.control=t.state;
  this.commit([{actionId:null,kind:'turn',phase:'enemy',round:this.round}]);
  this.later(()=>this.nextEnemy(0),FIXTURE.timing.enemyGapMs);
 }
 private nextEnemy(index:number){
  if(this.settle)return;
  const hero=this.hero();if(!hero.alive){this.finish('defeat');return;}
  const enemy=this.units.filter(u=>u.side==='enemy')[index];
  if(!enemy){this.round++;this.startHeroTurn();return;}
  if(!enemy.alive){this.nextEnemy(index+1);return;}
  if(this.control.phase==='boundary')this.control=beginEnemyTurn(this.control,this.enemyTurnId(),this.now()).state;
  const actionId=`${this.id}:act:${++this.actionSerial}`;
  this.control=beginResolving(this.control,{actionId,ownerTurnId:this.enemyTurnId(),actor:'enemy',controller:'enemy'},this.now()).state;
  this.enemyActor=enemy.id;const pending:PendingEvent[]=[];let duration=FIXTURE.timing.enemyGapMs;
  if(chebyshev(enemy.cell,hero.cell)>1){
   const path=this.approach(enemy.id,[hero.cell],FIXTURE.enemyMoveSteps);
   if(path){
    enemy.cell={...path[path.length-1]};pending.push({actionId,kind:'move',unitId:enemy.id,path});
    duration+=(path.length-1)*FIXTURE.timing.stepMs+FIXTURE.timing.moveTailMs;
   }
  }
  if(chebyshev(enemy.cell,hero.cell)<=1){
   pending.push({actionId,kind:'ability',unitId:enemy.id,abilityId:'fx-enemy-slash',label:'暮界斩',target:{...hero.cell}});
   pending.push(...this.hurt(hero,enemy.id,this.enemyDamage,actionId));
   const claim=claimTacticalSupport(this.ledger,{ownerTurnId:this.roundKey(),rootActionId:actionId,effectGroup:'wind-guard',origin:'enemy',conditionMet:hero.alive},FIXTURE.petLimitPerRound);
   if(claim.claimed){
    this.ledger=claim.ledger;hero.shield+=FIXTURE.petShield;
    pending.push({actionId,kind:'pet-assist',petRuntimeId:'ss-pet-wind-free-young',rootActionId:actionId,label:'风护',effect:`护盾 +${FIXTURE.petShield}（fixture）`},
     {actionId,kind:'shield',unitId:'hero',sourceId:'pet',added:FIXTURE.petShield,total:hero.shield});
   }else if(claim.reason&&hero.alive){
    pending.push({actionId,kind:'pet-skipped',petRuntimeId:'ss-pet-wind-free-young',rootActionId:actionId,reason:petReason[claim.reason]??claim.reason});
   }
   duration+=FIXTURE.timing.abilityMs;
  }
  if(!pending.length)pending.push({actionId,kind:'end-activation',unitId:enemy.id});
  this.commit(pending);
  this.later(()=>{
   if(this.settle)return;
   const t=completeResolving(this.control,actionId,null,this.now());this.control=t.state;this.enemyActor=null;
   if(t.events.length)this.autoReason=null;
   this.commit(this.controlEvents(t.events));
   if(!hero.alive){this.finish('defeat');return;}
   this.nextEnemy(index+1);
  },duration);
 }

 // ── fixture 托管策略：与手动走同一条指令路径 ──────────────────
 private autoStep(){
  if(this.control.mode!=='auto'||!this.heroTurnOpen())return;
  const hero=this.hero(),token=this.actionToken()!,base={commandId:`${this.id}:auto:${this.actionSerial+1}`,encounterId:this.id,expectedRevision:this.revision,actionToken:token};
  let command:TacticalCommand|null=null;
  if(!this.budget.mainActionUsed){
   const cleave=this.abilityDefs()[1];
   if(cleave.ready){
    const best=this.rangeCells(cleave.range).map(c=>({c,r:this.denyAbility(cleave.id,c)})).find(x=>x.r.ok&&x.r.targets.length>=2);
    if(best)command={...base,kind:'ability',abilityId:cleave.id,target:best.c};
   }
   if(!command){const t=this.enemies().find(e=>chebyshev(e.cell,hero.cell)<=1);if(t)command={...base,kind:'ability',abilityId:'fx-basic',target:{...t.cell}};}
  }
  if(!command&&!this.budget.moveUsed){
   const path=this.approach('hero',this.enemies().map(e=>e.cell),FIXTURE.moveSteps);
   if(path)command={...base,kind:'move',to:path[path.length-1]};
  }
  command??={...base,kind:'end-activation'};
  this.run(command,'auto');
 }

 control_(command:TacticalControlCommand):TacticalReceipt{
  const prior=this.receipts.get(command.commandId);if(prior)return prior;
  const t=command.op==='request-auto'?requestAuto(this.control,this.now()):requestManual(this.control,this.now());
  this.control=t.state;
  if(command.op==='request-auto'&&t.events.some(e=>e.kind==='auto-applied'))this.autoReason='player';
  if(t.events.some(e=>e.kind==='manual-applied'))this.autoReason=null;
  const events=t.events.length?this.commit(this.controlEvents(t.events)):[];
  if(this.control.phase==='awaiting')this.afterAwait();
  const receipt={commandId:command.commandId,accepted:true,revision:this.revision,events};
  this.receipts.set(command.commandId,receipt);return receipt;
 }

 private finish(outcome:TacticalResultView['outcome']):TacticalEvent[]{
  this.settle='settling';this.autoAtMs=null;
  const first=this.commit([]);
  this.later(()=>{
   const t=endTacticalControl(this.control,this.now());this.control=t.state;this.settle='ended';
   this.result={outcome,receiptId:`${this.id}:result`,rewards:[],nodeCompleted:outcome==='victory',
    rewardsNote:'隔离预览不发放奖励；正式奖励只由服务端结算回执显示。',returnLabel:outcome==='defeat'?'返回拾星港':'返回探索'};
   this.commit([...this.controlEvents(t.events),{actionId:null,kind:'result',outcome}]);
  },FIXTURE.timing.settleMs);
  return first;
 }

 // ── fixture 意图构建（不是正式 AI，只为驱动意图界面样例）─────────
 private buildIntents():TacticalIntentView[]{
  // ?scenario=intents：静态展示七种意图类型各一
  if(this.options.scenario==='intents')return this.buildIntentsShowcase();
  if(this.enemyTurn||this.settle)return [];
  const hero=this.hero();if(!hero.alive)return [];
  const intents:TacticalIntentView[]=[];let order=1;
  for(const enemy of this.units.filter(u=>u.side==='enemy'&&u.alive)){
   if(enemy.id==='enemy-a'){
    // 追击型：接近主角
    const reachCells:import('./contract.ts').TacticalCell[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
     const c={x:enemy.cell.x+dx,y:enemy.cell.y+dy};
     if((dx||dy)&&c.x>=0&&c.y>=0&&c.x<FIXTURE.board.width&&c.y<FIXTURE.board.height)reachCells.push(c);
    }
    intents.push({unitId:enemy.id,order:order++,type:'chase',cells:reachCells,targetId:'hero',line:null,
     damage:{kind:'amount',value:this.enemyDamage},fizzled:false,hidden:false,label:`追击 · ${this.enemyDamage}`});
   }else if(enemy.id==='enemy-b'){
    // 锁定型：从敌人位置到主角的直线
    const line:import('./contract.ts').TacticalCell[]=[];
    const dx=Math.sign(hero.cell.x-enemy.cell.x),dy=Math.sign(hero.cell.y-enemy.cell.y);
    let cx=enemy.cell.x+dx,cy=enemy.cell.y+dy;
    while(cx>=0&&cy>=0&&cx<FIXTURE.board.width&&cy<FIXTURE.board.height){
     line.push({x:cx,y:cy});if(cx===hero.cell.x&&cy===hero.cell.y)break;cx+=dx;cy+=dy;
    }
    const fizzled=FIXTURE.blockers.some(b=>{const idx=line.findIndex(c=>c.x===b.x&&c.y===b.y);return idx>=0&&idx<line.findIndex(c=>c.x===hero.cell.x&&c.y===hero.cell.y);});
    intents.push({unitId:enemy.id,order:order++,type:'lock',cells:[],targetId:'hero',line,
     damage:{kind:'amount',value:this.enemyDamage},fizzled,hidden:false,label:`锁定 · ${this.enemyDamage}${fizzled?' · 落空':''}`});
   }
  }
  return intents;
 }
 /** intents 场景：静态展示七种意图类型各一（含 fizzled 与 hidden）。 */
 private buildIntentsShowcase():TacticalIntentView[]{
  return [
   {unitId:'enemy-a',order:1,type:'grid',cells:[{x:3,y:2},{x:4,y:2},{x:3,y:3}],targetId:null,line:null,damage:{kind:'amount',value:12},fizzled:false,hidden:false,label:'格子型 · 12'},
   {unitId:'enemy-b',order:2,type:'chase',cells:[{x:5,y:3},{x:6,y:3},{x:5,y:4}],targetId:'hero',line:null,damage:{kind:'amount',value:8},fizzled:false,hidden:false,label:'追击型 · 8'},
   {unitId:'enemy-c',order:3,type:'lock',cells:[],targetId:'hero',line:[{x:7,y:2},{x:6,y:2},{x:5,y:2},{x:4,y:2},{x:3,y:2}],damage:{kind:'tier',tier:'heavy'},fizzled:false,hidden:false,label:'锁定型 · 重'},
   {unitId:'enemy-d',order:4,type:'buff',cells:[],targetId:null,line:null,damage:null,fizzled:false,hidden:false,label:'增益型'},
   {unitId:'enemy-e',order:5,type:'summon',cells:[{x:5,y:5}],targetId:null,line:null,damage:null,fizzled:false,hidden:false,label:'召唤型'},
   {unitId:'enemy-f',order:6,type:'chase',cells:[],targetId:'hero',line:null,damage:{kind:'amount',value:10},fizzled:true,hidden:false,label:'追击型 · 落空'},
   {unitId:'enemy-g',order:7,type:'move-only',cells:[],targetId:null,line:null,damage:null,fizzled:false,hidden:true,label:'?'},
  ];
 }
 /** fixture 结果预测：粗略样例数值，不是正式规则。 */
 private buildForecast(kills:string[],dmgMap:{unitId:string;amount:number}[]):import('./contract.ts').TacticalForecast{
  const hero=this.hero();
  const intents=this.buildIntents();
  const totalEnemyDmg=intents.filter(i=>i.targetId==='hero'&&!i.fizzled&&i.damage?.kind==='amount').reduce((s,i)=>s+(i.damage as {kind:'amount';value:number}).value,0);
  return {kills,damage:dmgMap,heroHpAfterIntents:Math.max(0,hero.hp-totalEnemyDmg),heroMaxHp:FIXTURE.heroHp};
 }
 // ── 投影 ───────────────────────────────────────────────────
 view():TacticalEncounterView{
  const now=this.now(),cv=tacticalControlView(this.control,now);
  const phase:TacticalEncounterView['phase']=this.settle??(this.enemyTurn?'enemy':this.control.phase==='awaiting'?'awaiting':'resolving');
  const manualAwait=phase==='awaiting'&&this.control.mode==='manual';
  const cells:TacticalCellView[]=[];
  for(let y=0;y<FIXTURE.board.height;y++)for(let x=0;x<FIXTURE.board.width;x++){
   const b=FIXTURE.blockers.find(c=>c.x===x&&c.y===y),hazard=x===FIXTURE.hazard.x&&y===FIXTURE.hazard.y;
   cells.push({x,y,walkable:!b,blocksSight:!!b,revealed:true,dressing:b?.dressing??null,
    hazard:hazard?{label:'样例地面区',detail:'fixture 样例：只展示危险格样式，无规则效果。'}:null});
  }
  const units:TacticalUnitView[]=this.units.map(u=>({id:u.id,side:u.side,name:u.name,cell:{...u.cell},footprint:1,alive:u.alive,
   hp:{current:u.hp,max:u.maxHp},shield:u.side==='hero'?u.shield:null,resource:null,
   statuses:u.side==='hero'&&u.shield>0?[{id:'wind-guard',label:'风护护盾',remaining:null,tone:'buff'}]:[],
   art:u.side==='hero'?{kind:'hero-native',assetId:'mini-hero/navy'}:{kind:'starsea-atlas',assetId:'ss-mon-dusk-blade'},tier:'normal'}));
  const used=(this.ledger.counts['wind-guard']??0);
  const abilities:TacticalAbilityView[]=this.abilityDefs().map(({range:_r,area:_a,ready:_d,...a})=>({...a,
   available:a.available&&a.migration==='supported'&&manualAwait&&!this.budget.mainActionUsed,
   reason:a.migration!=='supported'?a.reason:!a.available?a.reason:this.budget.mainActionUsed?'本回合的技能已用':!manualAwait?'现在不能操作':null}));
  return {source:'fixture',encounterId:this.id,revision:this.revision,ruleVersion:'fixture-rules-0',protocolVersion:'draft-view-0',
   node:{name:'雾港外礁 · 样例遭遇',objective:'击败全部敌人（fixture 目标）',enemyGroup:'暮界刀兵 ×2'},round:this.round,phase,
   actorId:this.enemyTurn?this.enemyActor:this.settle?null:'hero',actionToken:manualAwait?this.actionToken():null,
   board:{width:FIXTURE.board.width,height:FIXTURE.board.height,cells},units,
   budget:{moveUsed:this.budget.moveUsed,mainActionUsed:this.budget.mainActionUsed,ended:this.budget.ended,moveSteps:FIXTURE.moveSteps},
   abilities,legalMoves:manualAwait&&!this.budget.moveUsed&&!this.budget.ended?tacticalReachable(this.board('hero'),this.hero().cell,FIXTURE.moveSteps):[],
   pet:{familyId:'xiaoyuniguai',runtimeId:'ss-pet-wind-free-young',name:'风绒·幼年',conditionText:'主角受到攻击后（fixture 条件）',
    status:used>=FIXTURE.petLimitPerRound?'spent':'ready',statusText:used>=FIXTURE.petLimitPerRound?'本回合已辅助':'满足条件时自动辅助',
    remainingInWindow:Math.max(0,FIXTURE.petLimitPerRound-used)},
   control:{mode:cv.mode,phase:cv.phase,pendingManual:cv.pendingManual,deadlineAtMs:cv.deadlineAtMs,warningMs:this.control.policy.warningMs,
    serverNowMs:now,autoReason:cv.mode==='auto'?this.autoReason:null,canRequestAuto:cv.mode==='manual'&&cv.phase!=='ended',
    canRequestManual:cv.mode==='auto'&&!cv.pendingManual&&cv.phase!=='ended'},
   result:this.result,intents:this.buildIntents(),
   unsupported:['行动顺序','正式伤害与命中','冷却规则','正式宠物效果','撤退后果','奖励结算','断线补发事件']};
 }
 eventsSince(seq:number){return this.events.filter(e=>e.seq>seq);}
}

/** 浏览器内的传输层：模拟延迟、断线、丢回执与控制冲突。服务端（FixtureServer）断线期间照常运行。 */
export class FixtureSource implements TacticalSource{
 readonly kind='fixture' as const;
 server:FixtureServer|null=null;offline=false;private dropReceipt=false;private conflict:boolean;private loadFailures:number;
 private engagements=new Map<string,TacticalEncounterHandle>();private serial=0;private returned=new Map<string,{message:string}>();
 constructor(readonly options:FixtureOptions=defaultFixtureOptions){
  this.conflict=options.scenario==='conflict';this.loadFailures=options.scenario==='load-error'?1:0;
 }
 private async wire(){if(this.options.latencyMs>0)await new Promise(r=>setTimeout(r,this.options.latencyMs));else await Promise.resolve();if(this.offline)throw new TacticalSourceError('network','连接中断，正在恢复战场。');}
 private need(id:string){if(!this.server||this.server.id!==id)throw new TacticalSourceError('not-found','暂时没能载入战场',false);return this.server;}
 setOffline(value:boolean){this.offline=value;}
 dropNextReceipt(){this.dropReceipt=true;}
 conflictNext(){this.conflict=true;}
 async engage(intent:TacticalEncounterIntent){
  await this.wire();
  if(this.options.scenario==='empty')throw new TacticalSourceError('empty','附近没有可进入的遭遇。',false);
  const prior=this.engagements.get(intent.commandId);if(prior)return {...prior,alreadyActive:true};
  if(this.server&&!this.server.view().result)return {encounterId:this.server.id,node:this.server.view().node,alreadyActive:true};
  this.server?.destroy();this.server=new FixtureServer(this.options,++this.serial);
  const handle={encounterId:this.server.id,node:this.server.view().node,alreadyActive:false};
  this.engagements.set(intent.commandId,handle);return handle;
 }
 async load(id:string){
  await this.wire();
  if(this.options.scenario==='version')throw new TacticalSourceError('version-mismatch','战场版本已更新，请返回港口后重新进入。',false);
  if(this.loadFailures>0){this.loadFailures--;throw new TacticalSourceError('load-failed','暂时没能载入战场');}
  return this.need(id).view();
 }
 async preview(id:string,request:TacticalPreviewRequest){await this.wire();return this.need(id).preview(request);}
 async submit(command:TacticalCommand){
  await this.wire();
  if(this.conflict){this.conflict=false;throw new TacticalSourceError('control-conflict','这个角色正在另一处操作。');}
  const receipt=this.need(command.encounterId).submit(command);
  if(this.dropReceipt){this.dropReceipt=false;throw new TacticalSourceError('network','连接中断，正在恢复战场。');}
  return receipt;
 }
 async control(command:TacticalControlCommand){await this.wire();return this.need(command.encounterId).control_(command);}
 subscribe(id:string,listener:(push:TacticalPush)=>void){
  const server=this.need(id);return server.subscribe(push=>{if(!this.offline)listener(push);});
 }
 async returnToExplore(id:string,commandId:string){
  await this.wire();
  const prior=this.returned.get(commandId);if(prior)return prior;
  const server=this.need(id);if(!server.view().result)throw new TacticalSourceError('stale-revision','同步完成后再继续操作。');
  const result={message:'fixture：已离开棋盘。正式版由服务端回到星门副本/拾星港，本预览不接路由。'};
  this.returned.set(commandId,result);return result;
 }
 destroy(){this.server?.destroy();this.server=null;}
}

export function fixtureOptionsFromQuery(search:string):FixtureOptions{
 const q=new URLSearchParams(search),num=(k:string,d:number,min:number,max:number)=>{const v=Number(q.get(k));return Number.isFinite(v)&&q.has(k)?Math.min(max,Math.max(min,v)):d;};
 const scenario=(fixtureScenarios as readonly string[]).includes(q.get('scenario')??'')?q.get('scenario') as FixtureScenario:'default';
 const waitS=num('wait',scenario==='timeout'?15:60,3,600),warnS=num('warn',10,0,waitS);
 return {scenario,waitMs:waitS*1000,warningMs:warnS*1000,skewMs:num('skew',4000,-600000,600000),latencyMs:num('latency',120,0,5000),pace:num('pace',1,.05,4)};
}
export {cellKey};
