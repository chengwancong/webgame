import type {CharacterState} from '../contracts/index.ts';
import {craftingStateSchema} from '../contracts/crafting-state.ts';
import {craftRecipeMigration,craftPolicy,craftPatterns,craftRecipes} from '../content/crafting.ts';
/** 旧材料按 1:1 合并；删除旧键作为幂等标记，不改钱包、装备、配方和回执。 */
export function migrateCraftMaterials(materials:Record<string,number>){
 for(const [before,after]of [['ore','wind_ore'],['herb','wind_herb'],['leather','wind_part']] as const){
  if(Object.hasOwn(materials,before)){
   materials[after]=(materials[after]??0)+materials[before];
   delete materials[before];
  }
 }
 return materials;
}

export function migrateCraftProgression(s:CharacterState){
 const p=s.progression as unknown as {materials?:Record<string,number>;recipes?:string[];professions?:{craft?:string;craftLevel?:number;craftXp?:number;gatherLevel?:number;gatherXp?:number};crafting?:unknown}|undefined;
 if(!p)return;
 if(p.materials)migrateCraftMaterials(p.materials);
 const state=craftingStateSchema.parse(p.crafting??{}),old=p.professions;
 if(old){
  state.legacyProfessions??=Object.fromEntries(Object.entries(old).filter(([,value])=>value!==undefined));
  if(old.craft&&(state.professions[old.craft]?.level??1)<=(old.craftLevel??1))state.professions[old.craft]={level:Math.min(100,old.craftLevel??1),xp:old.craftXp??0};
  if((state.professions.gathering?.level??1)<=(old.gatherLevel??1))state.professions.gathering={level:Math.min(100,old.gatherLevel??1),xp:old.gatherXp??0};
  delete p.professions;
 }
 for(const {id} of craftPolicy.professions)state.professions[id]??={level:1,xp:0};
 for(const alias of craftRecipeMigration)if(p.recipes?.includes(alias.from)){
  if(!p.recipes.includes(alias.to))p.recipes.push(alias.to);
  const pattern=craftRecipes.find(r=>r.id===alias.to)?.output.pattern;
  if(pattern&&!state.patterns.includes(pattern))state.patterns.push(pattern);
  if(pattern&&alias.aspect)state.patternAspects[pattern]??=alias.aspect;
 }
 for(const id of p.recipes??[])if(id.startsWith('forge-')&&craftPatterns.some(pattern=>pattern.id===id.slice(6))&&!state.patterns.includes(id.slice(6)))state.patterns.push(id.slice(6));
 p.crafting=state;
}
