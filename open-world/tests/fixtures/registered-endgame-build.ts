import {standard} from '../../tools/standard-player-model.ts';
import {issueCombatGear,freezeItemRules} from '../../packages/rules/item-issuance.ts';
import {resolveBuild} from '../../packages/rules/index.ts';
import {gearSchema,type CharacterState} from '../../packages/contracts/index.ts';
import {worldProgressSchema} from '../../packages/contracts/open-world.ts';
import {starseaBossMaps} from '../../packages/content/starsea/index.ts';
import {randomUUID} from 'node:crypto';
/** Controlled already-progressed entrant. Every worn item uses the actual
 * issuance generator, not mean affixes or an arbitrary raw attack/HP grant. */
export function registeredEndgameEntrant(id:string){
 const base=standard(50,new Set(['affix'])),rules=freezeItemRules(),ids=new Map(base.gear.map(g=>[g.id,randomUUID()]));for(const g of base.gear)g.id=ids.get(g.id)!;base.equipment=Object.fromEntries(Object.entries(base.equipment).map(([slot,id])=>[slot,ids.get(id!)]));const p=base.progression!;p.weapons=Object.fromEntries(Object.entries(p.weapons).map(([id,state])=>[ids.get(id)!,state]));p.weaponGrid=p.weaponGrid.map(id=>id?ids.get(id)!:null);p.imprints=Object.fromEntries(Object.entries(p.imprints).map(([id,aspect])=>[ids.get(id)!,aspect]));let best:CharacterState|undefined,score=-Infinity;
 for(let seed=1;seed<=48;seed++){const s=structuredClone(base);s.id=id;let rng=seed>>>0;const next=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;},random={int:(min:number,max:number)=>min+Math.floor(next()*(max-min)),float:next};
  for(const g of s.gear.filter(g=>Object.values(s.equipment).includes(g.id)))issueCombatGear(g,g.ilvl??50,3,50,false,rules,random);
  for(const g of s.gear)gearSchema.parse(g);
  const b=resolveBuild(s),rating=b.resolvedSkills.filter(sk=>sk.damage>0).reduce((sum,sk)=>sum+sk.damage/Math.max(1,sk.cooldown),0)*b.stats.hp*(1+(b.stats.lifesteal??0)*100);if(rating>score){score=rating;best=s;}
 }
 const s=best!;s.revision=0;s.world=worldProgressSchema.parse({worldTier:4,hardmodeBosses:starseaBossMaps});return s;
}
