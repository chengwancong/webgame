import {worldTables} from '../content/world-tables.ts';
import type {CharacterState} from '../contracts/index.ts';
/** Stable authored source IDs, shared by pickup, private key rewards and the
 * standard schedule. Registration and arbitrary prefixes do not grant power. */
export function crystalSources(kind:'core'|'life'){
 const chapters=new Map(worldTables.islands.map(row=>[row.region,row.chapter]));return worldTables.objects.filter(row=>row.kind===kind).sort((a,b)=>Number(a.id.endsWith('-deep'))-Number(b.id.endsWith('-deep'))||(chapters.get(a.region)??Infinity)-(chapters.get(b.region)??Infinity)||a.id.localeCompare(b.id));
}
export function ownedCrystalSources(s:Pick<CharacterState,'starsea'>,kind:'core'|'life'){
 const sources=crystalSources(kind).map(row=>row.id),known=new Set(sources);
 // Historical frozen keys used these exact numbered aliases. Resolve them
 // without rewriting saved fields or counting the same source twice.
 return [...new Set((s.starsea?.crystals??[]).flatMap(id=>{if(known.has(id))return [id];const old=kind==='core'?/^core-key-([1-9]\d*)$/.exec(id):null,index=old?Number(old[1])-1:-1;return index>=0&&index<sources.length?[sources[index]]:[];}))];
}
export function grantCoreSources(s:CharacterState,total:number,sourceIds:readonly string[]){
 if(!s.starsea)throw Error('星核需要星潮海角色');if(!Number.isInteger(total)||total<0)throw Error('星核目标数量无效');const owned=new Set(s.starsea.crystals),sources=[...new Set(sourceIds)];let count=sources.filter(id=>owned.has(id)).length;
 for(const id of sources){if(count>=Math.min(total,sources.length))break;if(!owned.has(id)){s.starsea.crystals.push(id);owned.add(id);count++;}}
}
