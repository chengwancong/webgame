import type {Spawn} from '../contracts/index.ts';
import {eliteAffixSchema,type EliteAffix} from '../contracts/monsters.ts';
import {eliteAffixes} from '../content/elite-affixes.ts';

const pool=eliteAffixSchema.options;

/** Deterministic 32-bit hash → [0,1) stream, so a frozen cycle seed always rolls the same affixes. */
function stream(text:string){
 let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
 return ()=>{h=h+0x6d2b79f5|0;let t=Math.imul(h^h>>>15,1|h);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296;};
}

/** Distinct affixes for one elite: count within the world tier's `[min,max]`. */
export function rollEliteAffixes(range:readonly [number,number],seed:number,key:string,catalogue=eliteAffixes):EliteAffix[]{
 const [min,max]=range;if(!Number.isInteger(min)||!Number.isInteger(max)||min<0||max<min)throw Error('Invalid elite affix range');
 const frozenPool=Object.keys(catalogue) as EliteAffix[];const next=stream(seed+':'+key),count=Math.min(frozenPool.length,min+Math.floor(next()*(max-min+1))),left=[...frozenPool],picked:EliteAffix[]=[];
 while(picked.length<count)picked.push(left.splice(Math.floor(next()*left.length),1)[0]);
 return picked.sort((a,b)=>frozenPool.indexOf(a)-frozenPool.indexOf(b));
}

/** Freeze affixes into a resolved spawn: swift into its AI, frost nova as a skill
 * (first, so it is tried before the template skills), shield stays a runtime rule. */
export function applyEliteAffixes(spawn:Spawn,affixes:readonly EliteAffix[],catalogue=eliteAffixes):Spawn{
 if(!affixes.length||!spawn.monster)return spawn;
 const m=structuredClone(spawn.monster),ai=m.ai;
 if(affixes.includes('swift')){ai.speed=Math.round(ai.speed*catalogue.swift.speed*100)/100;ai.cooldown=Math.max(1,Math.round(ai.cooldown*catalogue.swift.cooldown));}
 if(affixes.includes('frost_nova')&&!m.skills.includes(catalogue.frost_nova.skill))m.skills=[catalogue.frost_nova.skill,...m.skills];
 for(const affix of ['summon_minions','teleport'] as const)if(affixes.includes(affix)&&!m.skills.includes(catalogue[affix].skill))m.skills=[catalogue[affix].skill,...m.skills];
 m.affixes=[...affixes];
 return {...spawn,name:affixes.map(a=>catalogue[a].name).join('·')+' '+spawn.name,monster:m};
}
