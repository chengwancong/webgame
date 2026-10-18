import type {Stats,Skill} from '../../../packages/contracts/index.ts';
import type {Condition} from '../../../packages/contracts/conditions.ts';
import {statLabels,numericStat} from '../../../packages/contracts/stats.ts';
import {skillTagLabel} from '../../../packages/content/skill-tags.ts';
import {comboToEffect} from '../../../packages/contracts/effects.ts';
import {formatBig} from '../../../packages/content/big-number.ts';
import {mainHandBonusLabel} from '../../../packages/content/ui-labels.ts';
export type RuleTelemetry=Record<string,{count:number;damage:number}>;
export type BreakdownRow={id:string;label:string;value:number;unit:'percent'|'multiple'|'damage';detail?:string};
const rankNames={normal:'普通',elite:'精英',boss:'首领'},statusNames:Record<string,string>={burn:'燃烧',poison:'中毒',slow:'迟缓',stun:'眩晕',silence:'沉默',petrify:'石化',fear:'恐惧',root:'定身',blind:'致盲',time_stop:'时停',bleed:'流血',shock:'感电',freeze:'冰冻',vulnerable:'易伤'};
const opNames={lt:'低于',lte:'不高于',gt:'高于',gte:'不低于'};
export function conditionDescription(c:Condition):string{
 switch(c.kind){
  case 'all':return c.conditions.map(conditionDescription).join('，且');case 'any':return c.conditions.map(conditionDescription).join('，或');case 'not':return '未满足：'+conditionDescription(c.condition);
  case 'target_rank':return '目标为'+c.ranks.map(r=>rankNames[r]).join('、');
  case 'target_status':return '目标处于'+c.statuses.map(s=>statusNames[s]??s).join('、')+(c.minStacks?'，至少'+c.minStacks+'层':'');
  case 'skill':return c.tags?.length?'作用于'+skillTagLabel(c.tags):c.damageTypes?.length?'作用于'+c.damageTypes.map(t=>({physical:'物理',fire:'火焰',cold:'冰霜',lightning:'闪电',poison:'毒素',arcane:'奥术',shadow:'暗影',pure:'纯粹'} as Record<string,string>)[t]).join('、')+'技能':c.longest?'冷却最长的技能':'符合条件的技能';
  case 'self_state':{const label=({shield:'持有护盾',moving:'持续移动',still:'保持静止',mana:'剩余能量',buff:'持有增益',kills:'近期击杀',manaSpent:'已消耗能量'} as Record<string,string>)[c.state];return label+(c.value===undefined?'':'达到 '+(c.state==='mana'?Math.round(c.value*100)+'%':c.value+(['moving','still'].includes(c.state)?' 秒':c.state==='manaSpent'?' 点':'')));}
  default:{const labels={target_hp:'目标生命',self_hp:'自身生命',distance:'目标距离',crowd:'周围目标数',combat_time:'交战时间',cast_hits:'本次命中数'},hp=['target_hp','self_hp'].includes(c.kind);return labels[c.kind]+opNames[c.op]+(hp?Math.round(c.value*100)+'%':c.value+(c.kind==='distance'?' 格':c.kind==='combat_time'?' 秒':''));}
 }
}
/** Read-only projection of resolved parameters and actual rule counters. */
export function damageBreakdown(stats:Stats,skills:Skill[],telemetry:RuleTelemetry|null,sourceNames:Record<string,string>={}){
 const zones=stats.zones??[],types:BreakdownRow[]=zones.filter(z=>(z.pool??(z.kind==='add'?'type':'mult'))==='type').map(z=>({id:z.id,label:z.id==='weapon-affinity'?mainHandBonusLabel:z.label,value:z.value,unit:'percent',...(z.tags?.length?{detail:skillTagLabel(z.tags)}:{detail:'全部技能'})})),independent:BreakdownRow[]=zones.filter(z=>(z.pool??(z.kind==='add'?'type':'mult'))==='mult').map(z=>({id:z.id,label:z.id==='weapon-affinity'?mainHandBonusLabel:z.label,value:z.value,unit:'multiple',...(z.tags?.length?{detail:skillTagLabel(z.tags)}:{detail:'全部技能'})}));
 const conditional:BreakdownRow[]=(stats.conditional??[]).filter(c=>c.pool==='cond').map(c=>({id:c.id,label:statLabels[c.stat??c.id.replace(/^stat-/,'')]??'条件伤害加成',value:c.value,unit:'percent',detail:conditionDescription(c.when)}));
 const registered=stats.rules??stats.combos?.map(comboToEffect)??[];
 for(const rule of registered){if(rule.trigger!=='passive'||rule.action.type!=='amplify')continue;const action=rule.action,layered=!!(action.selfHpSteps||action.perCrowd),details=rule.when.map(conditionDescription);
  if(rule.filter.tags?.length)details.push('作用于'+skillTagLabel(rule.filter.tags));
  if(rule.filter.damageTypes?.length)details.push(conditionDescription({kind:'skill',damageTypes:rule.filter.damageTypes}));
  if(rule.filter.statusKinds?.length)details.push('作用于'+rule.filter.statusKinds.map(s=>statusNames[s]??s).join('、')+'伤害');
  if(rule.filter.categories?.length)details.push('作用于'+rule.filter.categories.map(c=>({direct:'直接',periodic:'持续',derived:'触发'} as const)[c]).join('、')+'伤害');
  if(rule.filter.skills?.length)details.push('作用于'+rule.filter.skills.map(id=>skills.find(s=>s.id===id)?.name??'指定技能').join('、'));
  if(action.against.length)details.push('目标处于'+action.against.map(s=>statusNames[s]??s).join('、'));
  if(action.selfHpSteps)details.push('每损失'+Math.round(action.selfHpSteps*100)+'%生命计一层，最多'+(action.maxSteps??9)+'层');
  if(action.perCrowd)details.push('周围每个目标计一层，最多'+(action.crowdCap??10)+'层');
  if(layered)details.push('各层加成一起生效');
  independent.push({id:rule.id,label:rule.name+(layered?' · 每层加成':''),value:layered?(action.perCrowd??action.ratio):1+action.ratio,unit:layered?'percent':'multiple',detail:details.join('；')||'全部技能'});
 }
 const rules=telemetry===null?null:[...new Set([...registered.map(r=>r.id),...Object.keys(telemetry)])].map(id=>{const rule=registered.find(r=>r.id===id),actual=telemetry[id],source=rule?.source??'',label=sourceNames[source]??(/^(aspect-|set-|aug-|atom-)/.test(source)?'装备效果':source);return {id,name:rule?.name??'先前的装备效果',source:label,count:actual?.count??0,damage:actual?.damage??0};}).sort((a,b)=>b.damage-a.damage||b.count-a.count||a.name.localeCompare(b.name));
 return {types,conditional,independent,critical:{chance:numericStat(stats,'critChance'),multiplier:numericStat(stats,'critMultiplier')},vulnerableBonus:numericStat(stats,'vulnerableBonus'),skills:skills.filter(s=>s.damage>0).map(s=>{
  const m=s.mechanics,perTick=m?.zone?.budget==='per_tick',details=[skillTagLabel(s.tags??[])];
  if(m?.zone)details.push((perTick?'每次命中的伤害':'地面效果总伤害')+'，共'+m.zone.hits+'段');
  else if(m?.schedule)details.push('共'+m.schedule.hits+'次命中');
  if((s.projectiles??1)>1)details.push(s.projectiles+'枚飞行物');
  for(const status of m?.statuses??[]){if(status.total===undefined||!['burn','poison','bleed'].includes(status.kind))continue;
   if(status.kind==='poison'&&status.scope==='hit')details.push('命中造成的中毒已计入总伤害');
   else if(status.scope==='hit'||status.scope==='zone')details.push((status.scope==='hit'?'命中':'地面')+'附加'+statusNames[status.kind]+'伤害 '+formatBig(status.total));
  }
  return {id:s.id,label:s.name+(perTick?' · 每段':''),value:s.damage,unit:'damage' as const,detail:details.filter(Boolean).join('；')};
 }),rules};
}
