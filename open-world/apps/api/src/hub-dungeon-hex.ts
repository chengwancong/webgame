import type {CharacterState} from '../../../packages/contracts/index.ts';
import {attachHexAffixes,type FrozenHexLoot} from './hex-loot.ts';

/** Success-only first-clear guarantee, scoped to items acquired in this run.
 * Existing common HEX keeps its rune and only gains the guaranteed magic tier.
 * There is no player-facing upgrade command and no quality/identity reroll. */
export function applyHubGateHexGuarantee(character:CharacterState,runGearIds:ReadonlySet<string>,policy:FrozenHexLoot,context:{region:string;target:string},random?:()=>number){
 const rank={common:0,magic:1,rare:2,legendary:3},highest=character.gear.filter(g=>runGearIds.has(g.id)&&g.origin?.kind==='random'&&g.quality!=='common'&&['weapon','armor','helmet','boots','accessory','ring'].includes(g.slot)).sort((a,b)=>rank[b.quality]-rank[a.quality]||a.id.localeCompare(b.id))[0];
 const previous=highest?.hex,candidate=highest?structuredClone(highest):undefined;if(candidate)delete candidate.hex;
 // Restrict an existing carrier to its original rune; the standard HEX helper
 // still enforces magic level/prerequisites and owns the one-time pity ledger.
 const guaranteePolicy=previous?{...policy,catalogue:policy.catalogue.filter(id=>id===previous.rune)}:policy;
 const granted=attachHexAffixes(character,candidate?[candidate]:[],{kind:'mistBoss',...context,first:true},guaranteePolicy,random);
 if(!highest||!candidate?.hex||!granted.length)return undefined;
 if(!previous||rank[previous.tier]<rank.magic)highest.hex=candidate.hex;
 return {gear:highest,addedHex:!previous};
}
