import {randomInt} from 'node:crypto';
import type {CharacterState} from '../contracts/index.ts';
import {fieldGatherRequestSchema,type GatherDelta} from '../contracts/crafting.ts';
import {worldTables} from '../content/world-tables.ts';
import {craftGathering,craftMaterialById,craftText} from '../content/crafting.ts';
import {worldPhaseVisible} from './world-phase.ts';
import {starseaRegionOpen} from './starsea.ts';
import {ensureProgression} from './deep-progression.ts';
import {CraftError,craftingXp,ensureCrafting} from './crafting.ts';
import type {z} from 'zod';
export function gatherMaterial(s:CharacterState,v:z.infer<typeof fieldGatherRequestSchema>,int=randomInt):GatherDelta{
 const node=worldTables.objects.find(n=>n.id===v.node&&n.region===v.region&&n.kind==='gather');
 if(!node||!worldPhaseVisible(s,node)||s.dungeon?.instance||s.dungeon?.pendingResult||!(s.starsea?starseaRegionOpen(s.starsea,v.region):s.progress.regions.includes(v.region))||s.field?.region!==v.region||s.lastRegion&&s.lastRegion!==v.region)throw new CraftError('GATHER_PLACE',craftText.gatherPlace);
 if(Math.hypot(v.position.x-node.x,v.position.y-node.y)>2)throw new CraftError('GATHER_FAR',craftText.gatherFar);
 if(s.field.gathered.includes(node.id))throw new CraftError('GATHER_DONE',craftText.gatherDone);
 const material=craftMaterialById.get(node.material!);if(!material||!['ore','plant'].includes(material.kind))throw new CraftError('GATHER_PLACE',craftText.gatherMaterial);
 const p=ensureProgression(s),level=ensureCrafting(s).professions.gathering.level,amount=int(craftGathering.min,craftGathering.max+1)+Math.floor(level/craftGathering.bonusEvery),before=p.materials[material.id]??0;
 const gained=Math.max(0,Math.min(amount,material.stack-before));
 if(gained===0)throw new CraftError('CRAFT_MATERIAL',craftText.stackFull);
 p.materials[material.id]=before+gained;s.field.gathered.push(node.id);const profession=craftingXp(s,'gathering',craftGathering.xp);
 return {materials:{[material.id]:gained},node:{id:node.id,gathered:true},professions:{gathering:profession}};
}
