import {randomInt} from 'node:crypto';
import type {Gear} from '../contracts/index.ts';
import {gearAffixConfig,generateGearAffixes,type AffixRandom} from './affix-generator.ts';
import {reinforcementRules} from '../content/reinforcement.ts';
const random:AffixRandom={int:randomInt,float:Math.random};
/** Only called after incrementing rank inside a deduplicated command. It never
 * backfills previous nodes, rerolls a primary, or rewrites unrelated affixes. */
export function reinforceAffixNode(g:Gear,rng:AffixRandom=random){if(!reinforcementRules.nodes.includes(g.rank))return;const cap=reinforcementRules.affixCaps[g.quality],rule=gearAffixConfig.quality[g.quality];
 if(g.affixes.length<cap){const used=new Set(g.affixes.map(a=>a.stat)),config={...gearAffixConfig,pool:gearAffixConfig.pool.filter(a=>!used.has(a.stat)),quality:{...gearAffixConfig.quality,[g.quality]:{...rule,count:[1,1] as [number,number],tiers:rule.tiers.length?rule.tiers:[1 as const]}}},rolled=generateGearAffixes(g,3,rng,config);if(rolled.length){const a=rolled[0];a.id='node-'+g.rank+'-'+a.stat;g.affixes.push(a);g.affixNode={rank:g.rank,kind:'opened',affixId:a.id};return;}}
 const choices=g.affixes.map((a,index)=>({a,index})).filter(({a})=>a.tier<3&&gearAffixConfig.pool.some(p=>p.stat===a.stat&&p.tier===a.tier+1));if(!choices.length){g.affixNode={rank:g.rank,kind:'max'};return;}const {a,index}=choices[rng.int(0,choices.length)],tier=(a.tier+1) as 2|3,config={...gearAffixConfig,pool:gearAffixConfig.pool.filter(p=>p.stat===a.stat&&p.tier===tier),quality:{...gearAffixConfig.quality,[g.quality]:{count:[1,1] as [number,number],tiers:[tier]}}},rolled=generateGearAffixes({...g,ilvl:undefined},3,rng,config)[0];if(!rolled)throw Error('Missing promotion pool');const scaled=g.ilvl===undefined?rolled:scalePromotion(rolled,g.ilvl);g.affixes[index]={...scaled,id:a.id,value:Math.max(a.value,scaled.value)};if(g.affixes[index].value===a.value)g.affixes[index].description=a.description;g.affixNode={rank:g.rank,kind:'promoted',affixId:a.id};}
import {scaleItemAffixes} from './item-power.ts';
const scalePromotion=(a:Gear['affixes'][number],ilvl:number)=>scaleItemAffixes([a],ilvl)[0];
