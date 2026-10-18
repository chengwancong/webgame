import type {Skill} from '../../../../packages/contracts/index.ts';
import {escapeHtml as esc} from './primitives.ts';

const isNumber=(text:string)=>/^[+-]?\d+(?:\.\d+)?(?:%|‰)?$/.test(text);
const tokens=(text:string)=>text.match(/[+-]?\d+(?:\.\d+)?(?:%|‰)?|[A-Za-z_]+|[^\d]/gu)??[];

/** Text alignment only: preserve complete descriptions, never interpret their formulas. */
export function highlightEffectNumbers(before:string,after:string){
 const a=tokens(before),b=tokens(after),sameA=new Set<number>(),sameB=new Set<number>();
 // Hirschberg alignment keeps memory linear even for long effect descriptions.
 const row=(a0:number,a1:number,b0:number,b1:number,reverse=false)=>{
  let previous=new Uint32Array(b1-b0+1),current=new Uint32Array(b1-b0+1);
  for(let i=0;i<a1-a0;i++){
   current[0]=0;
   for(let j=1;j<=b1-b0;j++)current[j]=a[reverse?a1-i-1:a0+i]===b[reverse?b1-j:b0+j-1]?previous[j-1]+1:Math.max(previous[j],current[j-1]);
   [previous,current]=[current,previous];
  }
  return previous;
 };
 const align=(a0:number,a1:number,b0:number,b1:number)=>{
  if(a0===a1||b0===b1)return;
  if(a1-a0===1){for(let j=b0;j<b1;j++)if(a[a0]===b[j]){sameA.add(a0);sameB.add(j);break;}return;}
  const middle=(a0+a1)>>>1,left=row(a0,middle,b0,b1),right=row(middle,a1,b0,b1,true);
  let split=0,best=-1;
  for(let j=0;j<=b1-b0;j++){const score=left[j]+right[b1-b0-j];if(score>best){best=score;split=j;}}
  align(a0,middle,b0,b0+split);align(middle,a1,b0+split,b1);
 };
 if(before===after){a.forEach((_,i)=>sameA.add(i));b.forEach((_,i)=>sameB.add(i));}else align(0,a.length,0,b.length);
 const render=(parts:string[],same:Set<number>)=>parts.map((part,i)=>isNumber(part)?`<span class="effect-number num${same.has(i)?'':' is-changed'}">${esc(part)}</span>`:esc(part)).join('');
 return {before:render(a,sameA),after:render(b,sameB)};
}

type NumericField='damage'|'range'|'radius'|'cooldown'|'cost'|'windup'|'duration'|'pull'|'projectiles'|'projectileSpread';
const time=(ticks:number)=>`${Number((ticks/30).toFixed(2))}秒`;
const value=(skill:Skill,key:NumericField)=>skill[key]??(key==='projectiles'?1:0);
const effectName=(kind:Skill['kind'])=>kind==='heal'?'回复生命':kind==='shield'?'获得护盾':'伤害强度';

type Field={key:NumericField;label:string;format:(n:number)=>string;always?:boolean};
const fieldsFor=(current:Skill):Field[]=>[
  {key:'damage',label:effectName(current.kind),format:String},
  {key:'range',label:'施放距离',format:n=>`${n}格`},
  {key:'radius',label:'作用半径',format:n=>`${n}格`},
  {key:'cooldown',label:'冷却',format:time,always:true},
  {key:'cost',label:'施放能量',format:String,always:true},
  {key:'windup',label:'前摇',format:time},
  {key:'duration',label:'持续时间',format:time},
  {key:'pull',label:'牵引距离',format:n=>`${n}格`},
  {key:'projectiles',label:'投射物数量',format:n=>`${n}个`},
  {key:'projectileSpread',label:'散射角',format:n=>`${n}弧度`},
];
function extra(s:Skill){
  const m=s.mechanics,rows:Record<string,{label:string;text:string}>={};if(!m)return rows;
  const add=(key:string,label:string,text:string)=>rows[key]={label,text};
  if(m.schedule){add('hits','命中次数',String(m.schedule.hits));add('hitInterval','段间隔',time(m.schedule.interval));add('channel','施法占用',time(m.schedule.interval*(m.schedule.hits-1)));}
  if(m.zone){add('zoneMode','区域结算',m.zone.mode==='burst'?'一次爆发':`${m.zone.hits}次 · ${time(m.zone.interval)}间隔`);add('zoneBudget','伤害分布',m.zone.budget==='total'?'整招总伤害':'每段伤害');if(m.zone.pullSpeed)add('pullSpeed','每秒牵引',`${m.zone.pullSpeed}格`);}
  if(m.projectile){add('collisionRadius','弹体半径',`${m.projectile.collisionRadius}格`);if(m.projectile.penetrations)add('pierce','后续贯穿',`${m.projectile.penetrations}个目标`);if(m.projectile.explosionRadius)add('explosionRadius','爆炸半径',`${m.projectile.explosionRadius}格`);if(m.projectile.turnRate)add('tracking','追踪转向',`${Math.round(m.projectile.turnRate*30*180/Math.PI)}°/秒`);}
  if(m.execute)add('execute','低血增伤',`生命≤${m.execute.threshold*100}%时 +${m.execute.bonus*100}%`);
  if(m.penetration)add('penetration','本体穿甲',`${m.penetration*100}%`);
  if(m.restoreMana)add('manaRestore','恢复能量',String(m.restoreMana));
  if(m.cleanse)add('cleanse','净化数量',`${m.cleanse.count}项可清除减益`);
  const labels:Record<string,string>={burn:'燃烧',poison:'中毒',slow:'减速',stun:'眩晕',silence:'沉默',petrify:'石化',fear:'恐惧',root:'束缚',blind:'失手概率',time_stop:'时间停滞',attack_up:'攻击提升',speed_up:'移速提升',armor_down:'护甲降低',counter:'格挡反击',immunity:'伤害免疫',guardian:'一次免死',regen:'持续治疗',bleed:'流血',freeze:'冰冻',vulnerable:'易伤',shock:'感电易伤'};
  for(const effect of m.statuses){const key=effect.kind,label=labels[key];add(key+'Time',label+'时间',time(effect.duration));
   if(['slow','blind','attack_up','speed_up','armor_down'].includes(key))add(key+'Strength',label,`${Number((effect.strength*100).toFixed(2))}%`);
   if(effect.total!==undefined){add(key+'Total',label+'总量',String(effect.total));add(key+'Ticks','结算次数',String(Math.floor(effect.duration/(effect.interval??effect.duration))));add(key+'Interval','结算间隔',time(effect.interval??effect.duration));}
   if(effect.hpDrainRatio)add(key+'Drain','每秒生命代价',`${effect.hpDrainRatio*100}%（最低保留1）`);
   if(effect.reviveRatio)add(key+'Revive','复起生命',`${effect.reviveRatio*100}% · 本场1次`);
   if(effect.immunityTypes)add(key+'Types','免疫类型',effect.immunityTypes.map(t=>({physical:'物理',fire:'火焰',cold:'冰冷',lightning:'闪电',arcane:'奥术',shadow:'暗影',poison:'毒性',pure:'纯伤'}[t])).join('、'));
   add(key+'End','解除条件',`${effect.breakOnDamage?'受伤 / ':''}${effect.cleanse?'净化 / ':''}${effect.removeWithSource?'来源死亡 / ':''}到期或目标死亡`);
  }
  if(m.statuses.length)add('stacking','叠加规则','同源刷新；增益和控制取最高；持续伤害按来源独立');
  if(s.resolution&&(s.resolution.skillCooldownReduction||s.resolution.statsCooldownReduction||s.resolution.effectiveCooldownReduction)){add('skillCdr','技能冷却贡献',`${Number((s.resolution.skillCooldownReduction*100).toFixed(1))}%`);add('statsCdr','属性冷却贡献',`${Number((s.resolution.statsCooldownReduction*100).toFixed(1))}%`);add('effectiveCdr','最终有效降低',`${Number((s.resolution.effectiveCooldownReduction*100).toFixed(1))}%（上限${s.resolution.cooldownCap*100}%）`);}
  return rows;
 }
function renderParameters(skill:Skill,current:Skill,next:Skill){
 const candidates=fieldsFor(current);
 const fields=candidates.filter(field=>field.always||(field.key==='projectiles'?value(current,field.key)>1||value(next,field.key)>1:value(current,field.key)>0||value(next,field.key)>0));
 const a=extra(current),b=extra(next),shown=extra(skill),keys=[...new Set([...Object.keys(a),...Object.keys(b)])];
 return `<p class="effect-parameters">${fields.map(field=>`<span>${field.label} <span class="effect-number num${value(current,field.key)!==value(next,field.key)?' is-changed':''}" data-effect-value="${field.key}">${esc(field.format(value(skill,field.key)))}</span></span>`).join('')}${keys.map(key=>`<span>${esc((a[key]??b[key]).label)} <span class="effect-number num${a[key]?.text!==b[key]?.text?' is-changed':''}" data-effect-value="${key}">${esc(shown[key]?.text??'—')}</span></span>`).join('')}</p>`;
}

export function renderSkillEffectSummary(skill:Skill){
 return `<section class="skill-effect"><p class="effect-description">${esc(skill.description)}</p>${renderParameters(skill,skill,skill)}</section>`;
}

export function renderSkillEffectComparison(current:Skill,next:Skill,rank:number){
 const description=highlightEffectNumbers(current.description,next.description);
 const block=(skill:Skill,role:'current'|'next',copy:string)=>`<section class="skill-effect" data-effect="${role}" aria-label="${role==='current'?'当前效果':'升级后效果'}"><h4>${role==='current'?'当前效果':'升级后效果'}<span class="effect-number num is-changed">Lv.${role==='current'?rank:rank+1}</span></h4><p class="effect-description">${copy}</p>${renderParameters(skill,current,next)}</section>`;
 return `<div class="skill-effect-comparison">${block(current,'current',description.before)}${block(next,'next',description.after)}</div>`;
}

export type SkillKeyStat={key:string;label:string;text:string};
/** 技能详情顶部的几个大数字：效果量、冷却、距离（或半径）、有消耗时的能量。数值均来自服务端已解析技能。 */
export function skillKeyStats(skill:Skill):SkillKeyStat[]{
 const out:SkillKeyStat[]=[];
 if(skill.damage>0)out.push({key:'damage',label:effectName(skill.kind).replace('强度',''),text:String(skill.damage)});
 out.push({key:'cooldown',label:'冷却',text:time(skill.cooldown)});
 if(skill.range>0)out.push({key:'range',label:'距离',text:`${skill.range}格`});else if(skill.radius>0)out.push({key:'radius',label:'半径',text:`${skill.radius}格`});
 if(skill.cost>0)out.push({key:'cost',label:'能量',text:String(skill.cost)});
 return out;
}
/** 升级前后真正变化的数值（基础参数与机制参数），只列出有变化的项。 */
export function skillUpgradeChanges(current:Skill,next:Skill):{label:string;before:string;after:string}[]{
 const rows=fieldsFor(current).filter(f=>value(current,f.key)!==value(next,f.key)).map(f=>({label:f.label,before:f.format(value(current,f.key)),after:f.format(value(next,f.key))}));
 const a=extra(current),b=extra(next);
 for(const key of new Set([...Object.keys(a),...Object.keys(b)]))if(a[key]?.text!==b[key]?.text)rows.push({label:(b[key]??a[key]).label,before:a[key]?.text??'—',after:b[key]?.text??'—'});
 return rows;
}
