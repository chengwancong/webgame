// 技能标签（docs/build-depth-design.md §3.1）：系别 / 形态 / 元素 / 方式。
// 标签由技能的分类、伤害类型、形态与状态统一推导，词缀、套装与威能都按标签生效。
// 2026-10-07 分系：melee/ranged 合为「武技」（依赖武器），spell 为「法术」（不限武器），support 为「辅助」。
export const skillTagNames={
 martial:'武技',spell:'法术',melee:'近战',ranged:'远程',
 physical:'物理',fire:'火焰',cold:'冰霜',lightning:'闪电',arcane:'奥术',shadow:'暗影',poison:'毒素',
 single:'单体',area:'范围',projectile:'投射物',dot:'持续',dash:'位移',chain:'传导',
} as const;
export type SkillTag=keyof typeof skillTagNames;
type TaggableSkill={category?:string;kind:string;damage:number;mechanics?:{damageType?:string;statuses?:{kind:string;scope?:string}[];execute?:unknown;zone?:{pullSpeed?:number}};pull?:number};
const elements=new Set(['physical','fire','cold','lightning','arcane','shadow','poison']);
const elementOf=(s:TaggableSkill)=>(s.mechanics?.damageType&&elements.has(s.mechanics.damageType)?s.mechanics.damageType:'physical') as SkillTag;
function methodTags(s:TaggableSkill){
 const method:SkillTag[]=s.kind==='single'?['single']:s.kind==='area'?['area']:s.kind==='projectile'?['projectile']:s.kind==='zone'?['area','dot']:s.kind==='dash'?['dash']:s.kind==='chain'?['chain']:[];
 if(s.mechanics?.statuses?.some(e=>['poison','burn','bleed'].includes(e.kind))&&!method.includes('dot'))method.push('dot');
 return method;
}
export function skillTags(s:TaggableSkill):SkillTag[]{
 if(s.damage<=0||['shield','heal'].includes(s.kind))return [];
 const element=elementOf(s);
 const school:SkillTag[]=s.category==='melee'||s.category==='ranged'?['martial',s.category]:['spell'];
 return [...school,element,...methodTags(s)];
}
/** 2026-10-07 之前冻结的构筑（分类为近战/远程/控制/辅助）继续用当时的推导，旧实例结果不变。 */
export function legacySkillTags(s:TaggableSkill):SkillTag[]{
 if(s.damage<=0||['shield','heal'].includes(s.kind))return [];
 const element=elementOf(s);
 const form:SkillTag=s.category==='melee'||s.kind==='dash'?'melee':s.category==='ranged'&&element==='physical'?'ranged':'spell';
 return [form,element,...methodTags(s)];
}
export const skillTagLabel=(tags:readonly string[])=>tags.map(t=>skillTagNames[t as SkillTag]??t).join(' · ');

// 展示用功能标签：只用于技能册筛选与说明，不参与乘区、补丁或连携匹配。
export const skillFunctionNames={control:'控制',execute:'斩杀',heal:'治疗',shield:'护盾',buff:'增益'} as const;
export type SkillFunction=keyof typeof skillFunctionNames;
const controlStatuses=new Set(['slow','stun','silence','petrify','fear','root','blind','time_stop','freeze']);
const buffStatuses=new Set(['attack_up','speed_up','counter','immunity','guardian','regen']);
/** 技能册筛选标签：元素 + 方式 + 功能（系别由页签表达，不重复）。 */
export function skillBrowseTags(s:TaggableSkill):(SkillTag|SkillFunction)[]{
 const combat=skillTags(s).filter(t=>!['martial','spell','melee','ranged'].includes(t));
 return [...combat,...(s.kind==='dash'&&!combat.includes('dash')?['dash' as const]:[]),...skillFunctions(s)];
}
export function skillFunctions(s:TaggableSkill):SkillFunction[]{
 const out:SkillFunction[]=[],statuses=s.mechanics?.statuses??[];
 if(statuses.some(x=>controlStatuses.has(x.kind)&&x.scope!=='self')||(s.pull??0)>0||(s.mechanics?.zone?.pullSpeed??0)>0)out.push('control');
 if(s.mechanics?.execute)out.push('execute');
 if(s.kind==='heal')out.push('heal');
 if(s.kind==='shield'&&!statuses.some(x=>x.scope==='self'&&buffStatuses.has(x.kind)))out.push('shield');
 if(statuses.some(x=>x.scope==='self'&&buffStatuses.has(x.kind)))out.push('buff');
 return out;
}
