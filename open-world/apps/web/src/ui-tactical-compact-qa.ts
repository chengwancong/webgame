/** Full-controller review fixtures. They never call an API or advance a battle. */
import {TacticalBoardController} from './tactical/controller.ts';
import {FixtureServer,defaultFixtureOptions} from './tactical/fixture-source.ts';
import {TacticalSourceError} from './tactical/contract.ts';
import type {TacticalCommand,TacticalControlCommand,TacticalEncounterView,TacticalSource} from './tactical/contract.ts';

export type TacticalCompactQaState='ready'|'move-spent'|'main-spent'|'low'|'long'|'missing'|'skill-context';

/** Values and resource/pet presence here are explicitly UI samples, not sandbox rules. */
export function tacticalCompactQaView(state:TacticalCompactQaState):TacticalEncounterView{
 const fixture=new FixtureServer({...defaultFixtureOptions,skewMs:0,latencyMs:0},7_200);
 let view:TacticalEncounterView;
 try{view=structuredClone(fixture.view());}finally{fixture.destroy();}
 view.encounterId=`compact-qa-${state}`;
 view.node={name:'紧凑战斗 HUD · 静态样例',objective:'仅检查界面状态，不执行战斗，不写存档。',enemyGroup:'只读样例'};
 view.control={...view.control,deadlineAtMs:null,serverNowMs:Date.now(),canRequestAuto:false,canRequestManual:false};
 const hero=view.units.find(unit=>unit.side==='hero')!;
 hero.hp={current:96,max:120};
 hero.resource={label:'蓝量',current:72,max:100};
 hero.shield=null;
 hero.statuses=[];
 if(view.pet){
  view.pet.conditionText='主角受到攻击后触发辅助（静态样例条件）。';
  view.pet.statusText='条件满足时自动辅助（静态样例）。';
 }
 if(state==='move-spent'){
  view.budget.moveUsed=true;
  view.legalMoves=[];
  if(view.pet){view.pet.status='not-met';view.pet.statusText='本次触发条件未满足（静态样例）。';}
 }
 if(state==='main-spent'){
  view.budget.mainActionUsed=true;
  view.abilities=view.abilities.map(ability=>ability.migration==='supported'?{...ability,available:false,reason:'本次主行动已使用（静态样例）。'}:ability);
  if(view.pet){view.pet.status='spent';view.pet.statusText='本触发窗口已辅助（静态样例）。';view.pet.remainingInWindow=0;}
 }
 if(state==='low'){
  hero.hp.current=12;
  hero.resource.current=4;
  hero.statuses=[{id:'qa-slow',label:'减速',remaining:'1 次行动',tone:'debuff'}];
  view.abilities=view.abilities.map(ability=>ability.id==='fx-cleave'?{...ability,available:false,cost:'蓝量 20（静态样例）',reason:'蓝量不足（静态样例）。',cooldown:null}:ability);
 }
 if(state==='skill-context'){
  view.abilities=view.abilities.map(ability=>ability.id==='fx-cleave'?{...ability,
   cost:'蓝量 20（界面样例）',rangeText:'前方扇形，最多覆盖三格（界面样例）',cooldown:'冷却 2 次行动（界面样例）',
   description:'检查技能上下文、只读详情与正文滚动；所有字段仅用于界面验收。'.repeat(6)}:ability);
 }
 if(state==='long'){
  hero.name='用于检查长名称和详情换行的星海旅人';
  hero.hp={current:12_345_678,max:23_456_789};
  hero.resource={label:'蓝量',current:1_234_567,max:2_345_678};
  hero.shield=1_234_567;
  hero.statuses=Array.from({length:8},(_,index)=>({id:`qa-state-${index}`,label:`较长的状态说明 ${index+1}`,remaining:'剩余 12 次行动（静态样例）',tone:index%2?'debuff' as const:'buff' as const}));
  if(view.pet){
   view.pet.name='用于检查长名称与状态详情换行的风绒伙伴';
   view.pet.status='unconfigured';
   view.pet.remainingInWindow=null;
   view.pet.conditionText='本样例用于检查较长的条件说明在详情区域内正确换行，并保持关闭按钮、标题与正文各自占位。'.repeat(4);
   view.pet.statusText='当前辅助规则尚未配置，本样例不代表能力已经接入战斗。';
  }
 }
 if(state==='missing'){
  hero.resource=null;
  view.pet=null;
  view.phase='enemy';
  view.actorId=view.units.find(unit=>unit.side==='enemy')?.id??null;
  view.actionToken=null;
  view.control.phase='enemy';
  view.legalMoves=[];
  view.unsupported=['蓝量与宠物数据缺失（静态样例；不补造）'];
 }
 return view;
}

/** Frozen projection: interaction can inspect UI, but cannot mutate even a local battle. */
class FrozenTacticalQaSource implements TacticalSource{
 readonly kind='fixture' as const;
 constructor(private readonly view:TacticalEncounterView){}
 async engage(){return {encounterId:this.view.encounterId,node:{...this.view.node},alreadyActive:false};}
 async load(){return structuredClone(this.view);}
 subscribe(){return ()=>{};}
 async preview(){return {ok:false as const,denial:{code:'unsupported' as const,message:'这是静态界面样例；可查看状态详情，不执行战斗。'}};}
 async submit(command:TacticalCommand){return {commandId:command.commandId,accepted:false,revision:this.view.revision,events:[],denial:{code:'unsupported' as const,message:'静态样例不会执行或消耗行动。'}};}
 async control(_command:TacticalControlCommand):Promise<never>{throw new TacticalSourceError('load-failed','静态样例不切换战斗控制。',false);}
 async returnToExplore(){return {message:'静态样例不修改探索状态。'};}
}

const states:{state:TacticalCompactQaState;label:string}[]=[
 {state:'ready',label:'HUD 样例 · 血蓝与就绪'},
 {state:'skill-context',label:'HUD 样例 · 技能上下文'},
 {state:'move-spent',label:'HUD 样例 · 移动已用'},
 {state:'main-spent',label:'HUD 样例 · 主行动已用'},
 {state:'low',label:'HUD 样例 · 低血低蓝'},
 {state:'long',label:'HUD 样例 · 长文与未配置'},
 {state:'missing',label:'HUD 样例 · 数据缺失'},
];

export const tacticalCompactQaCases=states.map(({state,label})=>({
 id:`tactical-compact-${state}`,label,presentation:'stage' as const,render:()=>'',
 mount(root:HTMLElement){
  const view=tacticalCompactQaView(state),source=new FrozenTacticalQaSource(view);
  const reduced=document.documentElement.dataset.motionReduced==='true'||matchMedia('(prefers-reduced-motion: reduce)').matches;
  const controller=new TacticalBoardController(root,source,{reducedMotion:reduced,...(state==='skill-context'?{reviewAbilityId:'fx-cleave'}:{})});
  void controller.start({commandId:`compact-qa-${state}`,nodeName:view.node.name,groupId:'readonly-qa'});
  return ()=>controller.destroy();
 },
}));
