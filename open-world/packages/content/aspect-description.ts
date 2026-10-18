const mechanismNames:Record<string,string>={'ember-burn':'燃烧强化','burning-hit':'燃烧追击','ember-shield':'余烬护盾','cold-hit':'寒冷追击','frost-guard':'寒霜反击','dash-strike':'位移强化','moving-evasion':'移动闪避','crowd-area':'群敌增伤','whirl-armor':'旋风破甲','whirl-guard':'旋风护体','bleeding-hit':'群敌流血追击','crowd-evasion':'群敌闪避','tempo-recovery':'节拍恢复','mana-shield':'耗蓝护盾','block-counter':'格挡反击','shield-guard':'护盾减伤','healthy-hit':'高生命追击','opening-critical':'先手暴伤','elite-shield':'猎杀护盾','dash-nova':'落点冲击','block-shield':'格挡护盾','kill-refund':'连杀恢复'};
const actionNames:Record<string,string>={status:'燃烧强化',spread:'余火扩散',nova:'破盾爆发',buff:'节拍强化',cooldown:'猎杀恢复'};
import type {EffectRule, EffectAction} from '../contracts/effects.ts';
import type {Condition} from '../contracts/conditions.ts';
import type {NewAspect} from './aspect-description-types.ts';
import {statLabels} from '../contracts/stats.ts';
import {expandedSkills} from './skills-expanded.ts';
import atomCatalogue from './effect-atoms.json';

const n=(v:number)=>String(Number(v.toFixed(4)));
export const percent=(v:number)=>n(v*100)+'%';
export const seconds=(v:number)=>n(v/30)+'秒';
const statusNames:Record<string,string>={burn:'燃烧',freeze:'冰冻',slow:'减速',bleed:'流血',armor_down:'破甲',shock:'感电',poison:'中毒',blind:'致盲',stun:'眩晕',silence:'沉默',fear:'恐惧',petrify:'石化',root:'定身',regen:'持续回复',immunity:'免疫',time_stop:'时停',vulnerable:'易伤'};
const skillNames:Record<string,string>={...Object.fromEntries(expandedSkills.map(s=>[s.id,s.name])),whirl:'旋风',throwing_knife:'飞刀',fan_of_knives:'扇刃'};
const tagNames:Record<string,string>={area:'范围',single:'单体',melee:'近战',projectile:'投射物',dot:'持续伤害',dash:'位移',chain:'传导'};
const weaponNames:Record<string,string>={sword:'剑',hammer:'锤',axe:'斧',bow:'弓',staff:'法杖',hidden:'暗器',wand:'魔杖'};
const statNames:Record<string,string>={damageMult:'伤害',damageAdd:'伤害',critMultiplier:'暴击伤害',damageReduction:'减伤',dodge:'闪避',cooldownRecovery:'冷却恢复速度'};
const statusName=(s:string)=>statusNames[s]??s;
const damageNames:Record<string,string>={physical:'物理',cold:'冰霜',fire:'火焰',lightning:'雷电',arcane:'奥术',shadow:'暗影',poison:'毒素',pure:'真实'};
export function describeCondition(c:Condition,center:'self'|'target'='self'):string{
 switch(c.kind){
 case 'target_status':return '目标处于'+c.statuses.map(statusName).join('或')+(c.minStacks===undefined?'':'至少'+c.minStacks+'层');
 case 'skill':return (c.skills?.map(s=>skillNames[s]??s).join('、')??c.tags?.map(s=>tagNames[s]??s).join('、')??c.weapons?.map(s=>weaponNames[s]??s).join('、')??c.damageTypes?.join('、')??'最长冷却')+'技能';
 case 'target_rank':return c.ranks.map(r=>({normal:'普通敌人',elite:'精英',boss:'首领'})[r]).join('或');
 case 'target_hp':case 'self_hp':return (c.kind==='target_hp'?'目标':'你的')+'生命'+({gte:'至少',gt:'高于',lte:'不高于',lt:'低于'})[c.op]+percent(c.value);
 case 'crowd':return (center==='self'?'你':'目标')+'周围'+(c.radius??4)+'格内敌人'+({gte:'至少',gt:'多于',lte:'不超过',lt:'少于'})[c.op]+c.value+'个';
 case 'combat_time':return '进入战斗'+({gte:'至少',gt:'超过',lte:'不超过',lt:'不足'})[c.op]+n(c.value)+'秒';
 case 'distance':return '与目标距离'+({gte:'至少',gt:'超过',lte:'不超过',lt:'不足'})[c.op]+n(c.value)+'格';
 case 'cast_hits':return '本次技能命中'+({gte:'至少',gt:'超过',lte:'不超过',lt:'不足'})[c.op]+n(c.value)+'个目标';
 case 'self_state':return ({shield:'持盾时',moving:(c.value??0)===0?'移动时':'连续移动超过'+n(c.value??0)+'秒时',still:'站定至少'+n(c.value??0)+'秒时',buff:'节拍强化就绪时',mana:'能量至少'+percent(c.value??0)+'时',kills:'近期击杀至少'+n(c.value??0)+'个敌人时',manaSpent:'累计消耗至少'+n(c.value??0)+'点能量时'})[c.state];
 case 'all':return c.conditions.map(child=>describeCondition(child,center)).join('且');
 case 'any':return c.conditions.map(child=>describeCondition(child,center)).join('或');
 case 'not':return '未满足「'+describeCondition(c.condition,center)+'」';
 }
}
function actionText(a:EffectAction,passive:boolean):string{
 switch(a.type){
 case 'amplify':return '伤害增加'+percent(a.ratio)+(a.against.length?'，仅对'+a.against.map(statusName).join('或')+'目标':'');
 case 'reduce':return '受到伤害减少'+percent(a.ratio);
 case 'spread':return '把你施加的'+a.statuses.map(statusName).join('、')+'扩散给'+n(a.radius)+'格内最多'+a.count+'个敌人';
 case 'shield':return '护盾取现有值与'+({maxHp:'最大生命',maxMana:'最大能量',attack:'攻击',hit:'本次命中伤害',shield:'护盾',armor:'护甲',cost:'能量消耗'})[a.ref]+percent(a.ratio)+'的较高值，至少持续'+seconds(a.duration);
 case 'nova':return '对'+(a.at==='target'&&a.radius===0&&a.maxTargets===1?'攻击者':(a.at==='self'?'你周围':'目标周围')+n(a.radius)+'格敌人')+'造成'+({shield:'本次护盾的历史最高值',hit:'本次命中伤害',attack:'攻击',maxHp:'目标最大生命',maxMana:'最大能量',armor:'护甲',cost:'能量消耗'})[a.ref]+percent(a.ratio)+'的'+({physical:'物理',cold:'冰霜',fire:'火焰',lightning:'雷电',arcane:'奥术',shadow:'暗影',poison:'毒素',pure:'真实'})[a.damageType]+'伤害'+(a.status?'，施加'+statusName(a.status.kind)+' '+seconds(a.status.duration)+''+(a.status.strength?'（强度'+percent(a.status.strength)+'）':''):'');
 case 'status':return '施加'+statusName(a.status)+' '+seconds(a.duration)+(a.strength?'，强度'+percent(a.strength):'')+(a.ratio?'，附加伤害'+percent(a.ratio):'');
 case 'refund':return a.mode==='longest'?'当前冷却最长的技能返还剩余冷却'+percent(a.fraction??0):'当前技能冷却缩短'+seconds(a.ticks??0);
 case 'cooldown':return (a.mode==='all'?'所有技能':'其他技能')+'冷却'+(a.reset?'全部重置':a.fraction?'缩短'+percent(a.fraction):'缩短'+seconds(a.ticks??0));
 case 'buff':if(a.flags?.immortal&&a.mods.reviveRatio!==undefined)return '免于死亡，并恢复'+percent(a.mods.reviveRatio)+'最大生命';return Object.entries(a.mods).map(([k,v])=>(statNames[k]??statLabels[k]??k)+'增加'+percent(v)).join('，')+(a.flags?.forceCrit?'，必定暴击':'')+(a.consume?'，作用于'+({nextCast:'下一次施法',nextHit:'下一次直接命中',nextMelee:'下一次近战命中'})[a.consume]:'')+(passive?'':'，持续'+seconds(a.duration))+'，最多'+a.maxStacks+'层'+(a.echoOnConsume?'，消耗后'+seconds(a.echoOnConsume.delay)+'重放'+percent(a.echoOnConsume.ratio)+'伤害':'');
 case 'shards':return '发出'+a.count+'枚碎片，每枚造成'+percent(a.ratio)+'伤害，射程'+n(a.range)+'格';
 case 'echo':return seconds(a.delay)+'后重放'+(a.skill==='slot1'?'第一栏技能':'当前技能')+'，造成'+percent(a.ratio)+'伤害'+(a.retarget?'，重新选择目标':'');
 case 'heal':return '回复'+percent(a.ratio)+({maxHp:'最大生命',maxMana:'最大能量',hit:'本次命中伤害',shield:'护盾',armor:'护甲',attack:'攻击',cost:'能量消耗'})[a.ref]+(a.overflowShield?'，溢出回复的'+percent(a.overflowShield)+'转为护盾':'');
 case 'mana':return '回复'+percent(a.ratio)+'最大能量'+(a.flat?'及'+n(a.flat)+'点能量':'');
 case 'field':return '形成'+n(a.radius)+'格'+(a.orbit?'环绕领域':'领域')+'，持续'+seconds(a.duration)+'，每'+seconds(a.interval)+'造成'+percent(a.ratio)+'的'+damageNames[a.damageType]+'伤害'+(a.projectiles?'，共'+a.projectiles+'枚环绕体':'')+(a.pull?'，牵引强度'+n(a.pull):'');
 case 'detonate':return '引爆'+a.statuses.map(statusName).join('、')+'，造成剩余持续伤害的'+percent(a.ratio)+(a.radius?'，半径'+n(a.radius)+'格':'')+(a.remove?'，消耗对应状态':'，保留对应状态');
 case 'extend':return '延长'+(a.statuses?.map(statusName).join('、')??a.buff??'增益')+seconds(a.duration)+'，最多'+seconds(a.max)+(a.maxMode==='bonus'?'额外时长':'总时长');
 case 'arc':return '传导到最多'+a.count+'个目标，射程'+n(a.range)+'格，伤害'+percent(a.ratio)+'，每次传导保留'+percent(a.decay)+'伤害';
 default:throw Error('尚无中文描述生成器：'+String((a as {type:string}).type));
 }
}
export function describeAspectRule(rule:EffectRule):string{
 const trigger=({passive:'',hit:'命中时',crit:'暴击时',kill:'击杀时',dash:'位移后',hurt:'受击时',block:'格挡时',dodge:'闪避时',shield_break:'护盾破裂时',shield_gain:'获得护盾时',kill_elite:'击杀精英或首领时',cast:'施放时',status_apply:'施加状态时',zone_end:'领域结束时',low_hp:'低生命时',lethal:'承受致命伤害时',combat_start:'进入战斗时',mana_empty:'能量耗尽时',nth:'每'+n(rule.every??1)+'次'+({hit:'命中',cast:'施法',crit:'暴击',kill:'击杀'})[rule.count??'hit']+'时',moved:'每移动'+n(rule.every??1)+'格时',interval:(rule.startReady?'进入战斗立即就绪，之后':'')+'每'+seconds(rule.every??0),mana_spent:'每累计消耗'+n(rule.every??0)+'点能量时'} as Record<string,string>)[rule.trigger];
 if(trigger===undefined)throw Error('尚无中文触发描述：'+rule.trigger);
 const center=rule.trigger==='hit'||rule.trigger==='kill'?'target':'self';
 const condition=rule.when.map(c=>describeCondition(c,center)).join('且'),filter=[rule.filter.skills?.map(s=>skillNames[s]??s).join('、'),rule.filter.statusKinds?.map(statusName).join('或'),rule.filter.categories?.map(c=>({direct:'直接命中',periodic:'持续伤害',derived:'追加伤害'})[c]).join('或')].filter(Boolean).join('的');
 return [condition,filter,trigger].filter(Boolean).join('，')+'：'+actionText(rule.action,rule.trigger==='passive').replace('本次命中伤害',rule.trigger==='block'?'格挡抵消的护甲减免前伤害':'本次命中伤害')+([rule.chance===1?'':'触发率'+percent(rule.chance),rule.icd===0?'':'触发间隔'+seconds(rule.icd)].filter(Boolean).length?'（'+[rule.chance===1?'':'触发率'+percent(rule.chance),rule.icd===0?'':'触发间隔'+seconds(rule.icd)].filter(Boolean).join('，')+'）':'')+(rule.maxTriggers?'，本局最多触发'+rule.maxTriggers+'次':'')+'。';
}
/** 唯一描述来源。内容写入、推导与测试共用参数，禁用手写平衡文案。 */
export function generateAspectDescription(aspect:NewAspect):string{
 const p=aspect.parts,lines:string[]=[];
 if(p.flags?.dotCrit)lines.push('燃烧可以暴击，使用你暴击率的50%。');
 for(const [stat,value]of Object.entries(p.statMultipliers??{}))lines.push((statLabels[stat]??statNames[stat]??stat)+'变为原来的'+percent(value!)+ '。');
 for(const c of p.conversions??[])lines.push('移速加成的'+percent(c.ratio)+'转为伤害加成，永久与临时移速分别计算。');
 for(const s of p.stats)lines.push((statLabels[s.stat]??s.stat)+'增加'+(s.value<1?percent(s.value):n(s.value))+'。');
 for(const c of p.conditional)lines.push(describeCondition(c.when)+'：'+(statLabels[c.stat??'damageAdd']??c.stat??'伤害')+(c.perStillSecond?'每秒增加':'增加')+percent(c.value)+(c.max!==undefined?'，最多'+percent(c.max):'')+'。');
 for(const z of p.zones)lines.push(z.label+(z.kind==='mult'?'变为原来的'+percent(z.value):'增加'+percent(z.value))+'。');
 for(const atom of p.atoms)lines.push('获得'+(atomCatalogue.find(a=>a.id===atom.id)?.name??'对应效果')+'，强度'+n(atom.tier)+'档。');
 for(const [status,value]of Object.entries(p.statusMultipliers??{}))lines.push(statusName(status)+'效果变为原来的'+percent(value!)+'。');
 for(const [stat,value]of Object.entries(p.statOverrides??{}))lines.push((statLabels[stat]??stat)+'设为'+n(value!)+'。');
 for(const [status,o]of Object.entries(p.statusOverrides??{}))if(o)lines.push(statusName(status)+'最多'+o.maxStacks+'层，'+(o.stackMode==='independent'?'各层独立计时':'重复施加刷新时长')+(o.onStacks?'；达到'+o.onStacks.at+'层后消耗'+o.onStacks.consume+'层，转为'+statusName(o.onStacks.convert)+seconds(o.onStacks.duration):'')+'。');
 if(p.loadoutLimit)lines.push('仅保留前'+p.loadoutLimit+'栏技能。');
 for(const patch of p.slotPatches)for(const op of patch.ops)if(op.path==='damage'&&op.op==='mul')lines.push('第'+(patch.slot+1)+'栏技能的'+(patch.scalePeriodicBudget?'命中及持续伤害':'伤害')+'变为原来的'+percent(op.value as number)+'。');
 for(const patch of p.patches){
  const skills=patch.skills?.map(s=>skillNames[s]??s).join('、')??'对应技能';
  for(const op of patch.ops){
   if(op.path==='mechanics.schedule'&&op.op==='set'){const v=op.value as {hits:number;interval:number;followCaster:boolean;interruptOnMove:boolean};lines.push(skills+'分为'+v.hits+'段，每段间隔'+seconds(v.interval)+(v.followCaster?'，跟随你移动':'，固定在释放位置')+(v.interruptOnMove?'，移动会打断':'，移动不会打断')+'。');}
   else if(op.path==='damage'&&op.op==='mul')lines.push(skills+'的'+(patch.scalePeriodicBudget?'命中及持续伤害':'伤害')+'变为原来的'+percent(op.value as number)+'。');
   else if(op.path==='mechanics.projectile.orbit'&&op.op==='set'){const v=op.value as {duration:number;radius:number;interval:number;speed:number};lines.push(skills+'环绕'+seconds(v.duration)+'，轨道半径'+n(v.radius)+'格，每'+seconds(v.interval)+'可接触一次，每秒转动'+n(v.speed*30)+'弧度。');}
   else if(op.path==='mechanics.projectile.collisionRadius')lines.push(skills+'接触半径'+n(op.value as number)+'格。');
   else if(op.path==='weapons')lines.push(skills+'可用剑、锤、斧释放。');
   else if(op.path==='mechanics.targeting')lines.push(skills+'以你为中心。');
   else if(op.path==='projectiles')lines.push(skills+'发射'+n(op.value as number)+'枚投射物。');
   else if(op.path==='projectileSpread')lines.push(skills+'投射物夹角'+n(op.value as number)+'弧度。');
   else if(op.path==='radius'||op.path==='range')lines.push(skills+(op.path==='radius'?'半径':'射程')+(op.op==='mul'?'变为原来的'+percent(op.value as number):n(op.value as number)+'格')+'。');
   else if(op.path==='mechanics.projectile.returns')lines.push(skills+(op.value?'投射物会返回。':'投射物不再返回。'));
   else if(op.path==='cooldown'||op.path==='duration'||op.path==='windup')lines.push(skills+({cooldown:'冷却',duration:'持续时间',windup:'施放前摇'})[op.path]+(op.op==='mul'?'变为原来的'+percent(op.value as number):seconds(op.value as number))+'。');
   else throw Error('尚无补丁中文描述：'+op.path);
  }
 }
 for(const o of p.overrides){
  if(o.target==='atom-chill'&&o.set?.['action.onStacks.duration']!==undefined)lines.push('寒蚀冰冻持续'+seconds(o.set['action.onStacks.duration'] as number)+'。');
  else if(o.target==='atom-shatter'&&o.mul?.['action.radius']!==undefined)lines.push('碎冰范围变为原来的'+percent(o.mul['action.radius'])+'。');
  else if(o.target==='atom-detonate'&&o.set?.icd!==undefined)lines.push('引爆触发间隔'+seconds(o.set.icd as number)+'。');
  else throw Error('尚无覆盖中文描述：'+o.target);
 }
 return lines.concat(p.rules.map(describeAspectRule)).join('');
}
export function refreshAspectDescriptions(aspects:NewAspect[],ids:ReadonlySet<string>){
 for(const aspect of aspects)if(ids.has(aspect.id)){
  for(const rule of aspect.parts.rules){rule.description=describeAspectRule(rule);rule.name=aspect.name+' · '+(rule.id.split('-').slice(-2).join('-') in mechanismNames?mechanismNames[rule.id.split('-').slice(-2).join('-')]:actionNames[rule.action.type]??'节拍强化');}
  aspect.description=generateAspectDescription(aspect);
 }
}
export function describeBuildSourceParts(parts:NewAspect['parts']){return generateAspectDescription({parts} as NewAspect);}
