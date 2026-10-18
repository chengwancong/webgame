import source from '../content/hardmode-growth.json';
import {z} from 'zod';
import type {CharacterState} from '../contracts/index.ts';
import {ownedCrystalSources} from './crystal-progress.ts';
import {getEquippedSets} from '../simulation/set-calculator.ts';
import {aspectDefinitions} from '../content/deep-progression.ts';
export const hardmodeGrowth=z.object({coreBaseCount:z.number().int().nonnegative(),coreAdvancedCount:z.number().int().positive(),codexStartRank:z.number().int().positive(),codexFullRank:z.number().int().positive(),setPieces:z.number().int().positive(),powerLog:z.object({cores:z.number().nonnegative(),codex:z.number().nonnegative(),set:z.number().nonnegative()}).strict()}).strict().refine(v=>v.codexFullRank>v.codexStartRank).parse(source);
/** Every extra contribution requires an owned source. Both damage and life
 * consume the same fractions; the derivation tool applies no extra multiplier. */
export function resolvedHardmodeGrowth(s:Pick<CharacterState,'starsea'>&Partial<Pick<CharacterState,'gear'|'equipment'|'progression'>>){
 if(!s.starsea?.hardmode)return {axisMultiplier:1,sources:[] as {id:string;fraction:number}[]};
 const c=hardmodeGrowth,worn=(s.gear??[]).filter(g=>Object.values(s.equipment??{}).includes(g.id)),p=s.progression;
 const known=new Set(aspectDefinitions.map(a=>a.id)),ranks=worn.flatMap(g=>{const id=p?.imprints[g.id]??(g.quality==='legendary'?g.aspectId:undefined);return id&&known.has(id)?[p?.codex[id]??1]:[];});
 const sources=[{id:'cores',fraction:Math.min(1,Math.max(0,ownedCrystalSources(s,'core').length-c.coreBaseCount)/c.coreAdvancedCount)},{id:'codex',fraction:Math.min(1,Math.max(0,Math.max(0,...ranks)-c.codexStartRank)/(c.codexFullRank-c.codexStartRank))},{id:'set',fraction:getEquippedSets(worn).some(set=>set.count>=c.setPieces)?1:0}];
 return {sources,axisMultiplier:Math.exp(sources.reduce((sum,row)=>sum+c.powerLog[row.id as keyof typeof c.powerLog]*row.fraction/2,0))};
}
