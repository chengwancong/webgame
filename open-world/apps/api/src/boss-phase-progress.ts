import type {CharacterState,Spawn} from '../../../packages/contracts/index.ts';
import {starseaBossMaps,starseaIslands,starseaMap,hardmodeBossLevels} from '../../../packages/content/starsea/index.ts';
/** The encounter's frozen monster level chooses the phase, even when this kill opens the tide. */
export function bossPhaseProgress(s:CharacterState,region:string,spawns:Spawn[]){
 const index=starseaBossMaps.indexOf(region);if(index<0)return undefined;
 const bosses=spawns.filter(m=>m.boss);if(!bosses.length||bosses.some(m=>!m.monster||!Number.isFinite(m.monster.level)))return undefined;
 const tide=spawns.some(m=>m.boss&&m.monster&&m.monster.level>=hardmodeBossLevels[index]),done=tide?s.world?.hardmodeBosses??[]:s.starsea?.bosses??[],remaining=starseaBossMaps.flatMap((id,i)=>done.includes(id)?[]:[starseaMap(starseaIslands[i]).name]);
 return {phase:tide?'tide' as const:'normal' as const,completed:starseaBossMaps.length-remaining.length,total:starseaBossMaps.length,remaining};
}
