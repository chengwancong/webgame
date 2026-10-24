import type {TacticalUnit,TacticalKind} from '../packages/contracts/tactical.ts';
import {tacticalBoards} from '../packages/content/tactical-content.ts';
import {createTacticalEncounter,type TacticalEncounterState} from '../packages/simulation/tactical/encounter.ts';
import {revealEnemyIntents} from '../packages/simulation/tactical/enemy-ai.ts';
import type {Resolution} from '../packages/simulation/tactical/runtime.ts';
export function enemy(id:string,kind:TacticalKind,x:number,y:number,patch:Partial<TacticalUnit>={}):TacticalUnit{
 return {id,kind,side:'enemy',cell:{x,y},hp:100,maxHp:100,shield:0,statuses:[],cooldowns:{},eliteAffixes:[],facing:{x:0,y:-1},activeFromRound:1,flags:[],...patch};
}
export function battle(enemies:TacticalUnit[],patch:Partial<TacticalEncounterState>={}):TacticalEncounterState{
 const s=createTacticalEncounter({battleId:'test-battle',boardId:tacticalBoards[0].id,heroId:'sword',seed:123});
 s.board={width:10,height:10,blocked:[]};s.units=[{...s.units[0],cell:{x:4,y:4}},...enemies];s.difficulty='elite';Object.assign(s,patch);revealEnemyIntents(s);return s;
}
export function resolution(state:TacticalEncounterState,sourceId='hero'):Resolution{return {state,events:[],sourceId,actionId:'test-action'};}
