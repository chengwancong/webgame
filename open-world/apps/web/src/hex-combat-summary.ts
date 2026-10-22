import {publicHexRunes} from '../../../packages/content/hex-runes.ts';
import type {HexCombatStats} from '../../../packages/contracts/hex-combat-stats.ts';
const names=new Map(publicHexRunes.map(r=>[r.id,r.name]));
/** One-line toast text for a finished activity; empty when there is nothing honest to say. */
export function hexActivityNotice(stats?:HexCombatStats|null):string{
 if(!stats||stats.coverage==='unavailable'||!Array.isArray(stats.rules)||!stats.rules.length)return '';
 const parts=[...stats.rules].sort((a,b)=>b.triggers-a.triggers).slice(0,2).map(r=>`${names.get(r.rune)||r.rune||r.rule} 触发${r.triggers}次${r.share===null||r.share===undefined?'':`（直接伤害占比${Math.round(r.share*1000)/10}%）`}`);
 return '词缀战绩：'+parts.join(' · ')+(stats.coverage==='partial'?'（部分统计）':'');
}
