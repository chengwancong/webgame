import {mainHandBonusLabel} from '../content/ui-labels.ts';
import {damageZoneSchema} from '../contracts/damage-zones.ts';
import type {CharacterState,Stats} from '../contracts/index.ts';
import {mainHandAffinity,weaponAffinityNames} from './weapon-skills.ts';
import {weaponAffinityPower} from '../content/skill-weapons.ts';
import {ownedCrystalSources} from './crystal-progress.ts';
import {resolvedHardmodeGrowth,hardmodeGrowth} from './hardmode-growth.ts';
// 伤害乘区（docs/build-depth-design.md §2）：加算池 [+] 全部相加，每个 [×] 单独相乘。
// 这里只登记角色层面的常驻来源；技能层面的乘区（觉醒、武器盘方阵、召唤石光环）由 resolveProgressionSkill 继续相乘。
/** tags 为空：对所有技能生效；否则只对带其中任一标签的技能生效。 */
export type DamageZone={id:string;label:string;kind:'add'|'mult';pool?:'type'|'mult';value:number;tags?:string[]};
export const zoneApplies=(z:DamageZone,tags?:readonly string[])=>!z.tags?.length||(tags??[]).some(t=>z.tags!.includes(t));
/** 同一来源的区合并：[+] 相加，[×] 相乘。 */
export function addZone(zones:DamageZone[],zone:DamageZone){damageZoneSchema.parse(zone);const old=zones.find(z=>z.id===zone.id);if(!old){zones.push({...zone});return zones;}old.value=Math.round((zone.kind==='add'?old.value+zone.value:old.value*zone.value)*1000)/1000;return zones;}
/** 星潮之力：每击败一座岛的首领，永久获得一个独立乘区（泰拉瑞亚式“打过首领就变强”）。 */
export const islandPower=[1.3,1.35,1.4,1.45,1.5,1.6];
export const islandPowerNames=['风栖之力','雾铃之力','赤炉之力','霜镜之力','沉星之力','龙眠之力'];
/** 裂星潮开启：世界与角色一起升阶（泰拉瑞亚困难模式）。星核：裂星潮后的 6 处收集点，每处一个 ×1.1。 */
export const hardmodePower=2,starCorePower=1.1;
export function characterDamageZones(s:Pick<CharacterState,'level'|'starsea'>&Partial<Pick<CharacterState,'gear'|'equipment'>>,stats:Stats):DamageZone[]{
 const zones:DamageZone[]=[{id:'mastery',label:'等级精通',kind:'add',value:Math.round(.03*(s.level-1)*100)/100}];
 // 武器亲和：主手倾向的系别（武技／法术）获得一个独立 [×]；不匹配的技能照常可用，只是没有这一区。
 const affinity=s.gear&&s.equipment?mainHandAffinity({gear:s.gear,equipment:s.equipment}):null;if(affinity)zones.push({id:'weapon-affinity',label:mainHandBonusLabel+' · '+weaponAffinityNames[affinity],kind:'mult',value:weaponAffinityPower,tags:[affinity]});
 for(const z of stats.zones??[])zones.push(z);
 s.starsea?.bosses.forEach(map=>{const n=Number(map.replace('ss-map-boss-',''))-1;if(islandPower[n])zones.push({id:'island-'+(n+1),label:islandPowerNames[n],kind:'mult',value:islandPower[n]});});
 if(s.starsea?.hardmode)zones.push({id:'hardmode',label:'裂星潮',kind:'mult',value:hardmodePower});
 const cores=ownedCrystalSources(s,'core').length;if(cores)zones.push({id:'star-cores',label:'星核 ×'+cores,kind:'mult',value:Math.round(starCorePower**Math.min(cores,hardmodeGrowth.coreBaseCount)*1000)/1000});
 const growth=resolvedHardmodeGrowth(s);if(growth.axisMultiplier>1)zones.push({id:'hardmode-sources',label:'裂星潮共鸣',kind:'mult',value:growth.axisMultiplier});
 return zones;
}
/** 不传 tags 时只折算通用区（角色面板的通用 [+]/[×]）；传入技能标签时折算该技能实际生效的全部区。 */
export function foldZones(zones:DamageZone[],tags?:readonly string[]){for(const z of zones)damageZoneSchema.parse(z);zones=zones.filter(z=>tags?zoneApplies(z,tags):!z.tags?.length);return {damageAdd:Math.round(zones.filter(z=>(z.pool??(z.kind==='add'?'type':'mult'))==='type').reduce((n,z)=>n+z.value,0)*1000)/1000,damageMult:Math.round(zones.filter(z=>(z.pool??(z.kind==='add'?'type':'mult'))==='mult').reduce((n,z)=>n*z.value,1)*1000)/1000};}
/** 技能伤害 = 攻击 × 技能系数 × 技能等级成长 × (1+Σ[+]) × Π[×]。基础伤害 14 对应系数 1.0。 */
export const skillCoefficientBase=14;
