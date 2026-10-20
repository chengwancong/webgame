import type {GearVerdict,Stats} from '../contracts/index.ts';
import {statDefinition,statRegistry,numericStat} from '../contracts/stats.ts';
/** Shared server-side comparison of the registered base and tagged pools. */
export function resolvedStatValue(stats:Stats,key:string){const def=statDefinition(key);return def?.pool==='type'?(stats.zones??[]).filter(z=>z.kind==='add'&&z.tags?.includes(def.tag!)).reduce((n,z)=>n+z.value,0):numericStat(stats,key);}
export function compareResolvedStats(current:Stats,equipped:Stats,extraKeys:string[]=[]){
 const keys=[...new Set(['attack','armor',...extraKeys,...statRegistry.filter(d=>resolvedStatValue(current,d.id)!==resolvedStatValue(equipped,d.id)).map(d=>d.id)])];
 return Object.fromEntries(keys.map(key=>{const before=resolvedStatValue(current,key),after=resolvedStatValue(equipped,key);return [key,{current:before,equipped:after,delta:after-before}];}));
}
/** “更偏输出”的属性：伤害、暴击、穿透、冷却、各类增伤。 */
const offenseWeights:Record<string,number>={attack:1,attackPercent:1,critChance:.8,critMultiplier:.5,penetration:.6,cdr:.5,physicalDamage:.7,fireDamage:.7,coldDamage:.7,lightningDamage:.7,arcaneDamage:.7,shadowDamage:.7,poisonDamage:.7,meleeDamage:.7,rangedDamage:.7,spellDamage:.7,areaDamage:.7,projectileDamage:.7,dotDamage:.7,skillDamage:.8,castSpeed:.4,areaSize:.2,executeBonus:.4,tagDamage:.5,dotCrit:.4,igniteChance:.3,chillChance:.3,shockChance:.3,poisonChance:.3,bleedChance:.3,statusDuration:.3,vsElite:.3,vsBoss:.3,vsControlled:.3,vsNear:.3,vsFar:.3,vsHealthy:.3,vsLow:.3};
/** “更偏续航”的属性：生命、护甲、抗性、闪避、减伤、吸血、回复。 */
const sustainWeights:Record<string,number>={hp:1,hpPercent:1,armor:1,armorPercent:1,regen:.6,regenPercent:.6,mana:.3,manaPercent:.3,speed:.3,speedPercent:.3,lifesteal:.8,lifeOnKill:.5,manaOnKill:.3,cooldownOnKill:.4,healingReceived:.6,allResist:.8,fireResist:.5,coldResist:.5,lightningResist:.5,arcaneResist:.5,shadowResist:.5,poisonResist:.5,dodge:.7,blockChance:.6,damageReduction:.9,thorns:.3};
const finite=(value:number)=>Number.isFinite(value)?value:0;
/** 把不同量纲的属性变化换算成同一把“百分点”尺子：比例类直接用百分数，数值类按自身基数取相对变化。 */
export function statPowerDelta(key:string,before:number,after:number){
 const delta=finite(after)-finite(before);
 if(!delta)return 0;
 if(statDefinition(key)?.unit==='ratio')return delta*100;
 return delta/Math.max(1,Math.abs(finite(before)))*100;
}
/** 换装总评：只看方向，不报数字。玩家看到的是「更强 / 更偏输出 / 更偏续航 / 较弱 / 差不多」。 */
export function compareVerdict(current:Stats,equipped:Stats):GearVerdict{
 let offense=0,sustain=0;
 for(const key of new Set([...Object.keys(offenseWeights),...Object.keys(sustainWeights)])){
  const power=statPowerDelta(key,resolvedStatValue(current,key),resolvedStatValue(equipped,key));
  if(!power)continue;
  offense+=power*(offenseWeights[key]??0);sustain+=power*(sustainWeights[key]??0);
 }
 const total=offense+sustain;
 if(Math.abs(total)<2)return 'even';
 if(total<0)return 'weaker';
 if(offense>sustain*1.4)return 'output';
 if(sustain>offense*1.4)return 'sustain';
 return 'stronger';
}
