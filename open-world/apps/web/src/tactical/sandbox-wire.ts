/**
 * 战棋沙盒线格式 → 界面视图（TAC-B1 冻结契约 packages/contracts/tactical.ts）。
 *
 * 只做字段映射与中文展示名，不做任何规则计算：可达格与路径取 reachable，意图格/直线取 cells/line，
 * 伤害、击杀、剩余生命取服务端事件与预览。服务端没给的（射程文字、技能范围格）就不显示。
 * 中文名称表只是展示层（契约里只有 ID）；正式版名称以后由内容目录下发。
 */
import type {TacticalAction,TacticalEvent as WireEvent,TacticalIntent,TacticalProjection,TacticalUnit} from '../../../../packages/contracts/tactical.ts';
import {tacticalAbilityArt} from './ability-art.ts';
import type {
 TacticalAbilityView,TacticalCell,TacticalCellView,TacticalCommand,TacticalControlCommand,TacticalDenial,
 TacticalEncounterView,TacticalEvent,TacticalForecast,TacticalIntentView,TacticalPreview,TacticalPreviewRequest,
 TacticalStatusView,TacticalUnitView,
} from './contract.ts';

export type SandboxHeroWire={id:'sword'|'hidden';name:string;basicSkillId:string;skillIds:string[]};
export type SandboxBoardWire={id:string;name:string;difficulty:'normal'|'elite'|'boss';width:number;height:number};
export type SandboxCatalogWire={
 boards:SandboxBoardWire[];heroes:SandboxHeroWire[];expiresAfterMs:number;
 orchestration:{target:string[];position:string[];guard:string[];
  defaults:{priority:string[];target:string;position:string;guard:'on'|'off'}};
};
export type SandboxPreviewWire={kills:number;damage:number;expectedDamageTaken:number;remainingHp:number;events:WireEvent[];projection:TacticalProjection};
export type SandboxReceiptWire={revision:number;events:WireEvent[];projection:TacticalProjection};

/** 映射时用到的目录信息；目录未取到时退回 T3 测试英雄表。 */
export type SandboxMeta={boards:Map<string,SandboxBoardWire>;basic:Map<string,string>};
export const fallbackMeta=():SandboxMeta=>({boards:new Map(),basic:new Map([['sword','cut'],['hidden','throwing_knife']])});
export function metaFromCatalog(c:SandboxCatalogWire):SandboxMeta{
 return {boards:new Map(c.boards.map(b=>[b.id,b])),basic:new Map(c.heroes.map(h=>[h.id,h.basicSkillId]))};
}

// ── 展示名 ───────────────────────────────────────────────────
export const SKILL_LABEL:Record<string,string>={cut:'斩击',whirl:'回旋斩',ward:'护身',vortex_blade:'旋涡刃',
 throwing_knife:'飞刀',fan_of_knives:'刀扇',venom_needle:'毒针',toxic_bomb:'毒雾弹'};
const SKILL_DESC:Record<string,string>={cut:'相邻单体普攻',whirl:'自身周围 8 格',ward:'自身护盾，持续到下次行动开始',
 vortex_blade:'把 2 格内敌人拉到身边再造成伤害',throwing_knife:'直线 4 格，命中第一个单位，需要视线',
 fan_of_knives:'正前方 3 条射线，各命中第一个',venom_needle:'直线穿透并使目标中毒',toxic_bomb:'射程 4，3×3 毒区持续 2 轮'};
const KIND_NAME:Record<string,string>={hero:'主角',melee:'刀兵',ranged:'铳手',charger:'冲锋兽',shaman:'祭司',guard:'盾卫',
 assassin:'刺客',summoner:'召唤师',artillery:'炮手',swarm:'小怪',boss:'风栖首领'};
const HERO_NAME:Record<string,string>={sword:'剑士',hidden:'暗器手'};
const STATUS:Record<string,{label:string;tone:TacticalStatusView['tone']}>={poison:{label:'中毒',tone:'debuff'},curse:{label:'诅咒',tone:'debuff'},
 stunned:{label:'眩晕',tone:'debuff'},exhausted:{label:'力竭',tone:'debuff'},ward:{label:'护身',tone:'buff'},frost:{label:'冰冻',tone:'debuff'}};
const ZONE:Record<string,string>={poison:'毒区',fire:'火焰',frost:'冰霜'};
const INTENT_LABEL:Record<TacticalIntent['type'],string>={grid:'格子攻击',chase:'追击',lock:'锁定',buff:'辅助',summon:'召唤','charge-windup':'蓄力冲锋','move-only':'仅移动'};
const EFFECT_LABEL:Record<string,string>={heal:'治疗',shield:'加盾',curse:'诅咒',summon:'召唤',charge:'冲锋','artillery-mark':'炮击预告',
 'boss-mark':'大招预告','boss-blast':'大招',stun:'眩晕',frost:'冰冻',teleport:'闪现',protect:'掩护'};
const SERIAL='甲乙丙丁戊己庚辛';

const round=(n:number)=>Math.round(n);
const unitNames=(units:TacticalUnit[],heroId:string)=>{
 const names=new Map<string,string>(),count=new Map<string,number>(),seen=new Map<string,number>();
 for(const u of units)count.set(u.kind,(count.get(u.kind)??0)+1);
 for(const u of units){
  if(u.side==='hero'){names.set(u.id,HERO_NAME[heroId]??'主角');continue;}
  const base=(u.eliteAffixes.length?'精英':'')+(KIND_NAME[u.kind]??u.kind);
  const i=seen.get(u.kind)??0;seen.set(u.kind,i+1);
  names.set(u.id,(count.get(u.kind)??0)>1?`${base} ${SERIAL[i]??i+1}`:base);
 }
 return names;
};

// ── 投影 ─────────────────────────────────────────────────────
export function projectionToView(p:TacticalProjection,meta:SandboxMeta=fallbackMeta()):TacticalEncounterView{
 const names=unitNames(p.units,p.heroId),board=meta.boards.get(p.boardId);
 const blocked=new Set(p.board.blocked.map(c=>c.x+','+c.y));
 const zoneAt=new Map<string,{label:string;detail:string}>();
 for(const z of p.zones)for(const c of z.cells)zoneAt.set(c.x+','+c.y,{label:ZONE[z.kind]??z.kind,detail:`回合末在区内受 ${round(z.damage)} 点伤害，剩 ${z.remaining} 轮`});
 const cells:TacticalCellView[]=[];
 for(let y=0;y<p.board.height;y++)for(let x=0;x<p.board.width;x++){
  const k=x+','+y,b=blocked.has(k);
  cells.push({x,y,walkable:!b,blocksSight:b,revealed:true,hazard:zoneAt.get(k)??null,dressing:b?'rocks':null});
 }
 const units:TacticalUnitView[]=p.units.map(u=>({id:u.id,side:u.side,name:names.get(u.id)!,cell:{...u.cell},footprint:1,alive:u.hp>0,
  hp:{current:round(u.hp),max:round(u.maxHp)},shield:u.shield>0?round(u.shield):null,resource:null,
  statuses:u.statuses.map(t=>({id:t.id,label:STATUS[t.id]?.label??t.id,remaining:t.remaining?`${t.remaining} 回合`:null,tone:STATUS[t.id]?.tone??'neutral'})),
  art:u.side==='hero'?{kind:'hero-native',assetId:'mini-hero/navy'}:{kind:'starsea-atlas',assetId:'ss-mon-dusk-blade'},
  tier:u.kind==='boss'?'boss':u.eliteAffixes.length?'elite':'normal'}));
 const basic=meta.basic.get(p.heroId);
 const abilities:TacticalAbilityView[]=p.skills.map((s,i)=>({id:s.id,slot:i,label:SKILL_LABEL[s.id]??s.id,iconSrc:tacticalAbilityArt(s.id),
  category:s.id===basic?'basic':'skill',migration:'supported',available:s.available,reason:s.reason??null,cost:'主行动',
  cooldown:s.cooldown?`冷却 ${s.cooldown}`:null,rangeText:null,description:SKILL_DESC[s.id]??''}));
 const c=p.control,mode=c?.mode??p.controlMode,ended=!!p.outcome||p.phase==='ended';
 const controlPhase=ended?'ended':c?.phase??'awaiting';
 const intents:TacticalIntentView[]=p.intents.map(i=>({unitId:i.sourceId,order:i.sequence+1,type:i.type,
  cells:i.hidden?[]:i.cells.map(x=>({...x})),targetId:i.hidden?null:i.targetId??null,line:i.hidden||!i.line.length?null:i.line.map(x=>({...x})),
  damage:i.hidden||!i.damage?null:{kind:'amount',value:round(i.damage)},
  ...(i.hidden||!i.tier||i.tier==='normal'?{}:{tier:i.tier}),
  fizzled:!!i.fizzled,hidden:!!i.hidden,
  label:i.hidden?'?':i.effect&&EFFECT_LABEL[i.effect]&&i.effect!=='attack'?EFFECT_LABEL[i.effect]:INTENT_LABEL[i.type]}));
 const manualTurn=!ended&&mode==='manual'&&controlPhase==='awaiting';
 return {
  source:'sandbox',encounterId:p.battleId,revision:p.revision??0,ruleVersion:'tac-b1',protocolVersion:'tac-b1',
  node:{name:board?.name??p.boardId,objective:'击败全部敌人（战棋沙盒 · 不发奖）',enemyGroup:{normal:'普通遭遇',elite:'精英遭遇',boss:'首领遭遇'}[p.difficulty]},
  round:p.round,phase:ended?'ended':controlPhase==='enemy'?'enemy':controlPhase==='resolving'?'resolving':'awaiting',
  actorId:units.find(u=>u.side==='hero')?.id??null,actionToken:manualTurn?p.ownerTurnId:null,
  board:{width:p.board.width,height:p.board.height,cells},units,
  budget:{moveUsed:p.budget.moveUsed,mainActionUsed:p.budget.mainActionUsed,ended:p.budget.ended,moveSteps:null},
  abilities,legalMoves:manualTurn&&!p.budget.moveUsed?p.reachable.map(r=>({cell:{...r.cell},cost:r.cost,path:r.path.map(x=>({...x}))})):[],
  intents,pet:null,
  control:{mode,phase:controlPhase,pendingManual:c?.pendingManual??false,deadlineAtMs:c?.deadlineAtMs??null,warningMs:10_000,
   serverNowMs:c?.serverNowMs??Date.now(),autoReason:null,canRequestAuto:!ended&&mode==='manual',canRequestManual:!ended&&mode==='auto'&&!(c?.pendingManual)},
  result:p.outcome?{outcome:p.outcome==='win'?'victory':'defeat',receiptId:null,rewards:[],rewardsNote:'战棋沙盒 · 不发奖，不写角色存档。',
   nodeCompleted:false,returnLabel:'结束本场'}:null,
  unsupported:['宠物辅助（沙盒未接）'],
 };
}

// ── 事件 ─────────────────────────────────────────────────────
const CONTROL_CHANGE:Record<string,Extract<TacticalEvent,{kind:'control'}>['change']>={'timeout-auto':'timeout-auto','auto-applied':'auto-applied',
 'manual-requested':'manual-requested','manual-applied':'manual-applied','manual-cancelled':'manual-cancelled',ended:'ended'};
/** 服务端每条事件的 resolutionId 唯一，直接作为去重 ID；GET 历史与指令回执里的同一事件 ID 相同。 */
export function eventsToView(raw:readonly WireEvent[],names:(id:string)=>string=id=>id):TacticalEvent[]{
 const out:TacticalEvent[]=[];const absorbed=new Map<string,number>();
 raw.forEach((e,seq)=>{
  const base={id:e.resolutionId,seq,actionId:e.actionId,atMs:0};
  const note=(text:string,unitId:string|null=e.targetId??null,id=base.id)=>out.push({...base,id,kind:'note',unitId,text});
  switch(e.type){
   case 'move':out.push({...base,kind:'move',unitId:e.targetId!,path:(e.cells?.length?e.cells:e.cell?[e.cell]:[]).map(c=>({...c}))});break;
   case 'pull':case 'teleport':
    if(e.cell)out.push({...base,kind:'move',unitId:e.targetId!,path:[{...e.cell}]});
    note(`${names(e.targetId??'')} 被${e.type==='pull'?'拉到身边':'闪现'}`,e.targetId??null,base.id+':note');break;
   case 'skill':out.push({...base,kind:'ability',unitId:e.sourceId,abilityId:e.cause,label:SKILL_LABEL[e.cause]??e.cause,target:e.cell?{...e.cell}:{x:0,y:0}});break;
   case 'shield-absorbed':absorbed.set(e.targetId!,(absorbed.get(e.targetId!)??0)+(e.amount??0));break;
   case 'damage':{
    const a=absorbed.get(e.targetId!)??0;absorbed.delete(e.targetId!);
    out.push({...base,kind:'damage',unitId:e.targetId!,sourceId:e.sourceId,amount:round((e.amount??0)+a),absorbed:round(a),hpAfter:-1});break;
   }
   case 'shield':out.push({...base,kind:'shield',unitId:e.targetId!,sourceId:e.sourceId,added:round(e.amount??0),total:round(e.amount??0)});break;
   case 'heal':note(`${names(e.targetId??'')} 恢复 ${round(e.amount??0)} 点生命`);break;
   case 'death':out.push({...base,kind:'defeated',unitId:e.targetId!});break;
   case 'round-start':out.push({...base,kind:'turn',phase:'hero',round:e.round});break;
   case 'outcome':out.push({...base,kind:'result',outcome:e.cause==='win'?'victory':'defeat'});break;
   case 'control':{const change=CONTROL_CHANGE[e.detail??''];if(change)out.push({...base,kind:'control',change});
    else if(e.cause==='scheduler-error')note(e.detail??'托管异常，已暂停托管',null);break;}
   case 'intent-fizzled':note(`${names(e.sourceId)} 的意图落空`,e.sourceId);break;
   case 'intent-downgraded':note(`${names(e.sourceId)} 本轮只移动（防必死保护）`,e.sourceId);break;
   case 'windup':note(`${names(e.sourceId)} 正在蓄力，下回合执行`,e.sourceId);break;
   case 'summon':note(`${names(e.sourceId)} 召来援军`,e.sourceId);break;
   case 'phase':note(`${names(e.targetId??'')} 进入第二阶段`);break;
   case 'status':note(`${names(e.targetId??'')} ${{curse:'被诅咒','charge-wall-stun':'撞墙眩晕','boss-exhausted':'力竭，受伤增加'}[e.cause]??e.cause}`);break;
   case 'zone-telegraph':note(`${names(e.sourceId)} 周围即将冻结`,e.sourceId);break;
  }
 });
 return out;
}
export const namesOf=(view:TacticalEncounterView|null)=>(id:string)=>view?.units.find(u=>u.id===id)?.name??id;

// ── 预览 ─────────────────────────────────────────────────────
/** 预览是暴击期望值，界面写明"预计"；目标格与伤害只取服务端事件，缺字段就不显示。 */
export function previewToView(raw:SandboxPreviewWire,request:TacticalPreviewRequest,current:TacticalEncounterView):TacticalPreview{
 const hero=current.units.find(u=>u.side==='hero');
 const enemiesAlive=current.units.filter(u=>u.side==='enemy'&&u.alive).map(u=>u.id);
 const after=new Map(raw.projection.units.map(u=>[u.id,u]));
 const heroDamage=new Map<string,number>();
 for(const e of raw.events)if(e.type==='damage'&&e.sourceId===hero?.id&&e.targetId)heroDamage.set(e.targetId,(heroDamage.get(e.targetId)??0)+(e.amount??0));
 const forecast:TacticalForecast={kills:enemiesAlive.filter(id=>(after.get(id)?.hp??1)<=0),
  damage:[...heroDamage].filter(([,a])=>a>0).map(([unitId,amount])=>({unitId,amount:round(amount)})),
  heroHpAfterIntents:round(raw.remainingHp),heroMaxHp:hero?.hp.max??100};
 const notes=['预计值按暴击期望估算，实际结果可能不同。'];
 if(request.kind==='move'){
  const m=current.legalMoves.find(l=>l.cell.x===request.to.x&&l.cell.y===request.to.y);
  return {ok:true,kind:'move',destination:{...request.to},path:m?.path??[{...request.to}],steps:m?.cost??0,notes,forecast};
 }
 const cellOf=(id:string)=>current.units.find(u=>u.id===id)?.cell;
 return {ok:true,kind:'ability',abilityId:request.abilityId,target:{...request.target},rangeCells:[],
  affectedCells:[...heroDamage.keys()].map(cellOf).filter((c):c is TacticalCell=>!!c),targets:[...heroDamage.keys()],
  known:[{label:'预计伤害合计',value:String(round(raw.damage))},{label:'预计击杀',value:`${raw.kills} 个`},{label:'预计承受伤害',value:String(round(raw.expectedDamageTaken))}],
  uncertain:['暴击按期望值计入'],notes,forecast};
}
/** 部分规则层报错是英文原文（如 "Unknown hero skill"），加中文前缀，原文保留便于反馈。 */
export const denialFromMessage=(message:string):TacticalDenial=>({code:'invalid-target',
 message:!message?'这个行动不合法。':/[一-鿿]/.test(message)?message:`这个行动不合法（${message}）`});

// ── 指令 ─────────────────────────────────────────────────────
/** 普攻（cut / throwing_knife）必须走独立的 basic 动作，其余技能用 skillId。 */
export function commandToAction(command:TacticalCommand,basicSkillId:string|undefined):TacticalAction{
 switch(command.kind){
  case 'move':return {type:'move',to:{...command.to}};
  case 'ability':return command.abilityId===basicSkillId?{type:'basic',target:{...command.target}}:{type:'skill',skillId:command.abilityId,target:{...command.target}};
  case 'end-activation':return {type:'end'};
  case 'retreat':throw Error('沙盒不支持撤退');
 }
}
export const controlToAction=(command:TacticalControlCommand):TacticalAction=>({type:'set-control-mode',mode:command.op==='request-auto'?'auto':'manual'});
