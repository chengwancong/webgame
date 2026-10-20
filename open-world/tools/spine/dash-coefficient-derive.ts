/** docs/progression-goal-plan.md §11.6：进港路 a 线冲刺技（破阵 rush、影袭 shadow_step）与刀刃风暴 blade_fury 的系数，推导一次。
 * 方法：按 §11.5 的技能栏，在当前系数下测密集 30 秒（种子 41/42/43 取中位数），用 damageBySkill 把总量拆到每个技能；
 * 伤害对系数按线性近似，解出让每个不达标的找回回到「下限 + 5 个百分点」所需的系数倍率。只推导、不写配置；验证用 skill-recovery-experience.ts。
 * 用法：node --import tsx tools/spine/dash-coefficient-derive.ts [--apply]
 * --apply：经主干写入层写进 skill-coefficients.json，证据留在 docs/reviews/numeric-spine-20261013/G11-dash-coefficients。 */
import '../../packages/content/open-world/index.ts';
import {standardState,resolvePlayer} from './player.ts';
import {benchSample,benchSeeds} from './bench.ts';
import {SCHEDULE} from '../standard-player-model.ts';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {spineSchemas} from './schemas.ts';
import coefficients from '../../packages/content/skill-coefficients.json';
import {skillCatalog} from '../../packages/content/index.ts';
if(process.argv.includes('--grow01')){
 if(process.argv.includes('--apply')||process.env.FREE_BASIC)throw Error('GROW-01 isolated derivation does not use legacy apply or FREE_BASIC');
 const index=process.argv.indexOf('--output');if(index<0||!process.argv[index+1])throw Error('GROW-01 requires --output evidence path');
 await (await import('./grow01-derive.ts')).deriveGrow01(process.argv[index+1]);
 process.exit(0);
}
/** FREE_BASIC=1：飞刀耗能 3 → 0，与斩击、杖击一致（只在内存里改，看能量是不是根因）。 */
if(process.env.FREE_BASIC){const k=skillCatalog.find(s=>s.id==='throwing_knife')!;k.cost=0;}
type Family='sword'|'hidden';
const MARGIN=.05;
const median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
/** 与 skill-recovery-experience.ts 的技能栏一致；只列含冲刺技或刀刃风暴的找回。 */
const steps:{family:Family;recovery:number;level:number;before:string[];after:string[];floor:number}[]=[
 {family:'sword',recovery:2,level:8,before:['cut','whirl','rush','ward'],after:['cut','whirl','vortex_blade','rush'],floor:.2},
 {family:'sword',recovery:3,level:11,before:['cut','whirl','vortex_blade','rush'],after:['cut','whirl','vortex_blade','leap_strike'],floor:.1},
 {family:'sword',recovery:4,level:15,before:['whirl','vortex_blade','cut','leap_strike'],after:['whirl','vortex_blade','leap_strike','blade_fury'],floor:.15},
 {family:'hidden',recovery:2,level:8,before:['throwing_knife','fan_of_knives','shadow_step','ward'],after:['throwing_knife','fan_of_knives','explosive_kunai','shadow_step'],floor:.2},
 {family:'hidden',recovery:3,level:13,before:['throwing_knife','fan_of_knives','shadow_step','explosive_kunai'],after:['death_lotus','fan_of_knives','shadow_step','explosive_kunai'],floor:.1},
 {family:'hidden',recovery:4,level:15,before:['fan_of_knives','explosive_kunai','death_lotus','shadow_step'],after:['night_veil','explosive_kunai','death_lotus','shadow_step'],floor:.15},
];
/** 一份技能栏的密集值，按技能拆开（中位种子那一次的占比乘中位值）。 */
function measure(family:Family,level:number,skills:string[],tag:string){
 const s=standardState(level,family);s.skills=[...skills];s.skillRanks=Object.fromEntries(skills.map(id=>[id,SCHEDULE.skillRank(level)]));s.progression!.skillAwakenings={};
 const p=resolvePlayer(tag,s);
 const runs=benchSeeds.map(seed=>{const r=benchSample(p,'dense',seed,p.build.stats.hp);if(!r.value||!r.totalDamage)throw Error('伤害样本失败 '+tag);return r;});
 const mid=runs.find(r=>r.value===median(runs.map(x=>x.value!)))!;
 const share:Record<string,number>={};for(const id of skills){const d=(mid.damageBySkill as Record<string,{direct:number;periodic:number;derived:number}>)[id];share[id]=(d?d.direct+d.periodic+d.derived:0)/mid.totalDamage!*mid.value!;}
 return {value:mid.value!,share};
}
const rows=steps.map(step=>{
 const b=measure(step.family,step.level,step.before,`${step.family}-r${step.recovery}-before`),a=measure(step.family,step.level,step.after,`${step.family}-r${step.recovery}-after`);
 return {...step,before:b,after:a,now:a.value/b.value-1};
});
const fix=(o:Record<string,number>)=>Object.fromEntries(Object.entries(o).map(([k,v])=>[k,Math.round(v)]));
for(const r of rows)console.log(JSON.stringify({family:r.family,recovery:r.recovery,now:+r.now.toFixed(3),floor:r.floor,before:Math.round(r.before.value),beforeShare:fix(r.before.share),after:Math.round(r.after.value),afterShare:fix(r.after.share)}));
/** 一个技能在某找回里的提速，随该技能倍率线性变化（其余技能不变）。 */
type Scale=Record<string,number>;
const value=(m:{value:number;share:Record<string,number>},k:Scale)=>m.value+Object.entries(m.share).reduce((n,[id,v])=>n+v*((k[id]??1)-1),0);
const ratio=(r:typeof rows[number],k:Scale)=>value(r.after,k)/value(r.before,k);
/** 解一个技能的倍率 x：让含它且不达标的找回回到 1 + floor + MARGIN（单调时用二分，取所有找回里最严的那个）。 */
function solve(skill:string,k:Scale,dir:'down'|'up'){
 let x=1;
 for(const r of rows){if(!(r.before.share[skill]||r.after.share[skill]))continue;const target=1+r.floor+MARGIN;if(ratio(r,{...k,[skill]:x})>=target)continue;
  let lo=dir==='down'?0:x,hi=dir==='down'?x:20;for(let i=0;i<60;i++){const mid=(lo+hi)/2,ok=ratio(r,{...k,[skill]:mid})>=target;if(dir==='down'){if(ok)lo=mid;else hi=mid;}else{if(ok)hi=mid;else lo=mid;}}
  const best=dir==='down'?lo:hi;if(ratio(r,{...k,[skill]:best})<target-1e-6)throw Error(`${skill} 向${dir==='down'?'下':'上'}调补不到 ${r.family} 找回 ${r.recovery}`);x=best;}
 return x;
}
const k:Scale={};
// 1) 破阵：只靠下调让剑找回 3 回到下限以上。
k.rush=solve('rush',k,'down');
// 2) 影袭：同是进港路 a 线送的冲刺技，过强原因相同（冲刺路径上的群伤），用同一下调倍率。单独下调补不到暗器找回 2（见 §11.6）。
k.shadow_step=k.rush;
// 3) 爆裂苦无：L8 时被能量卡住（30 秒只放 3 次），向上补到暗器找回 2 达标。
k.explosive_kunai=solve('explosive_kunai',k,'up');
// 4) 刀刃风暴：3 秒连段期间不能出别的招，向上补到剑找回 4 达标。
k.blade_fury=solve('blade_fury',k,'up');
const c=coefficients as Record<string,number>,round=(v:number)=>Math.round(v*100)/100;
console.log(JSON.stringify({margin:MARGIN,...Object.fromEntries(Object.entries(k).map(([id,x])=>[id,{before:c[id],factor:+x.toFixed(3),after:round(c[id]*x)}]))}));
for(const r of rows)console.log(JSON.stringify({family:r.family,recovery:r.recovery,now:+r.now.toFixed(3),predicted:+(ratio(r,k)-1).toFixed(3),floor:r.floor}));
if(process.env.FREE_BASIC&&process.argv.includes('--apply'))throw Error('FREE_BASIC 只用于对照，不能写入');
const basis:Record<string,string>={rush:'§11.6：剑找回 3 补到下限+5个百分点',shadow_step:'§11.6：与破阵同因（冲刺路径群伤），同倍率',explosive_kunai:'§11.6：L8 能量受限，暗器找回 2 补到下限+5个百分点',blade_fury:'§11.6：3 秒连段不能出招，剑找回 4 补到下限+5个百分点'};
const changes:SpineChange[]=Object.entries(k).map(([id,x])=>({file:'packages/content/skill-coefficients.json',path:[id],before:c[id],after:round(c[id]*x),basis:basis[id]+`（×${x.toFixed(3)}，规则 ow-73 密集 30 秒，种子 41/42/43 中位数）`}));
console.log(JSON.stringify(await applySpinePlan('.',changes,spineSchemas,{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/G11-dash-coefficients'})));
