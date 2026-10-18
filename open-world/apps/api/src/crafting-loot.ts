import {randomInt} from 'node:crypto';
import {z} from 'zod';
import raw from '../../../config/json/crafting-private.json';
import {craftMaterials,craftRecipes,craftSignatureRecipe} from '../../../packages/content/crafting.ts';
import {starseaIslands,starseaBossMaps} from '../../../packages/content/starsea/index.ts';
import {starseaFactionById} from '../../../packages/content/starsea/reputation.ts';
import {economyRegionOf} from '../../../packages/content/index.ts';
import type {CharacterState} from '../../../packages/contracts/index.ts';
import {ensureProgression} from '../../../packages/rules/deep-progression.ts';
import {craftBuffValue} from '../../../packages/rules/crafting-consumables.ts';
const drop=z.object({id:z.string(),chance:z.number().min(0).max(1),min:z.number().int().positive(),max:z.number().int().positive()}).refine(r=>r.min<=r.max);
export const craftingDrops=z.array(drop).parse(raw.drops);
export function freezeCraftingLoot(){return structuredClone({drops:craftingDrops,materials:craftMaterials,recipes:craftRecipes.filter(r=>r.category!=='pattern'&&!craftSignatureRecipe(r)).map(r=>({id:r.id,island:r.island}))});}
export type FrozenCraftingLoot=ReturnType<typeof freezeCraftingLoot>;
const random={float:()=>randomInt(0,1000000)/1000000,int:randomInt};
export function awardCraftingLoot(s:CharacterState,source:{region:string;kind:'normal'|'elite'|'boss'|'chest'|'rare';first?:boolean;dungeon?:boolean;tide?:boolean;worldTier?:number},frozen:FrozenCraftingLoot|undefined,rng=random){
 const result:{materials:Record<string,number>;recipes:string[]}={materials:{},recipes:[]};if(!frozen)return result;
 const parent=economyRegionOf(source.region),bossIndex=starseaBossMaps.indexOf(parent),legacy=starseaFactionById.get(parent.replace(/-boss$/,'')),island=bossIndex>=0?starseaIslands[bossIndex]:legacy?.maps.find(map=>starseaIslands.includes(map))??parent;
 if(!starseaIslands.includes(island))return result;
 const p=ensureProgression(s),materialBuff=craftBuffValue(s,'material');
 const give=(id:string,n:number)=>{const def=frozen.materials.find(m=>m.id===id);if(!def)throw Error('掉落材料未登记 '+id);const before=p.materials[id]??0,amount=Math.max(0,Math.min(n,def.stack-before));if(amount){p.materials[id]=before+amount;result.materials[id]=(result.materials[id]??0)+amount;}};
 const roll=(key:string,material=true)=>{const row=frozen.drops.find(r=>r.id===key);if(!row)throw Error('制作掉落来源缺失 '+key);if(rng.float()>=Math.min(1,row.chance*(1+(material?materialBuff:0))))return 0;const base=rng.int(row.min,row.max+1),scaled=base*(row.chance===1&&material?1+materialBuff:1);return Math.floor(scaled)+(rng.float()<scaled%1?1:0);};
 if(source.kind==='chest'){
  const rows=frozen.materials.filter(m=>m.island===island&&m.tier==='T1'),count=roll('chest');for(let n=0;n<count;n++)give(rows[rng.int(0,rows.length)].id,1);
 }else{
  const part=frozen.materials.find(m=>m.island===island&&m.kind==='part');if(part)give(part.id,roll(source.kind==='rare'?'elite':source.kind));
  if(source.dungeon&&source.kind==='boss'||source.kind==='rare'){const boss=frozen.materials.find(m=>m.island===island&&m.tier==='T2');if(boss)give(boss.id,roll(source.kind==='rare'?'rare-material':'boss-material'));}
 }
 if(source.kind==='chest'||source.kind==='rare'){
  const candidates=frozen.recipes.filter(r=>r.island===island&&!p.recipes.includes(r.id));
  if(candidates.length&&(source.kind==='rare'&&source.first||roll(source.kind==='rare'?'rare-recipe':'chest-recipe',false)>0)){const recipe=candidates[rng.int(0,candidates.length)].id;p.recipes.push(recipe);result.recipes.push(recipe);}
 }
 for(const key of [...(source.tide?['tide']:[]),...((source.worldTier??1)>=2?['world-tier']:[])]){
  const count=roll(key),endgame=frozen.materials.filter(m=>m.tier==='T3');if(count)give(endgame[rng.int(0,endgame.length)].id,count);
 }
 return result;
}
