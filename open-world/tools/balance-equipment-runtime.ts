import {writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {World} from '../packages/simulation/index.ts';
import {regionById,starterSkills} from '../packages/content/index.ts';
import {storyChapters} from '../packages/content/story-campaign.ts';
import {collectionGearSets,collectionGearTemplates,collectionEquipment} from '../packages/content/equipment-runtime.ts';
import {gearBases,makeGearByBase,instantiateGearTemplate,upgradeCost} from '../packages/rules/index.ts';
import {equipmentDropRules,dropProfileFor,scaleWorldGear,gearTemplatesForRegion,worldGearTemplates} from '../apps/api/src/economy.ts';
import {generateAffixes} from '../packages/rules/affix-generator.ts';
import {resolveMeasuredBuild} from './measured-build.ts';
import {versions,type CharacterState} from '../packages/contracts/index.ts';

const rows:object[]=[],seeds=[11,47,101],regions=['meadow','tundra','dragonbone'];
for(const area of regions){
 const tier=equipmentDropRules.tiers[area],level=storyChapters.find(chapter=>chapter.id===area)!.level,profile=dropProfileFor(area),region=regionById(area+'-boss');
 const cases=[{id:'legacy-four',bases:['blade','coat','charm','shield']},...collectionGearSets.filter(set=>collectionEquipment(set.pieces[0])!.tier===tier).map(set=>({id:set.id,bases:[...set.pieces,'shield']}))];
 for(const loadout of cases)for(const rank of [0,5]){
  const gear=loadout.bases.map((base,index)=>{const template=gearBases.find(gear=>gear.base===base)!;return {...instantiateGearTemplate(scaleWorldGear(template,profile),base+'-'+index),rank};});
  const spawn=region.spawns.find(spawn=>spawn.boss)!;
  for(const quality of ['common','rare'] as const)for(const seed of seeds){
   const actualGear=gear.map(item=>{let state=seed+['weapon','armor','helmet','boots','accessory','ring','core'].indexOf(item.slot)*1000;const random={float:()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;},int:(min:number,max:number)=>min+Math.floor(random.float()*(max-min))};return {...item,quality,affixes:generateAffixes(quality,profile.maxAffixTier,random)};});
   const character:CharacterState={id:'measurement',name:loadout.id,revision:0,build:1,level,xp:0,gold:0,material:0,gear:actualGear,equipment:Object.fromEntries(actualGear.map(gear=>[gear.slot,gear.id])),skills:[...starterSkills],skillRanks:Object.fromEntries(starterSkills.map(id=>[id,1])),progress:{kills:0,regions:['town',area],bosses:[],safe:'town',tasks:[]}};
   const build=resolveMeasuredBuild(character);
   const world=new World(region,build.stats,build.resolvedSkills,[{...spawn,id:area+':1:boss'}],[],seed);world.hero.position={x:spawn.x-2,y:spawn.y};world.radius=20;world.setMode('auto');
   for(let ticks=0;ticks<2700&&world.hero.hp>0&&world.enemies.some(enemy=>enemy.alive);ticks++)world.step();
   rows.push({area,tier,level,loadout:loadout.id,rank,quality,seed,gear:actualGear.map(gear=>({base:gear.base,slot:gear.slot,rank:gear.rank,affixes:gear.affixes})),skills:build.resolvedSkills.map(skill=>({id:skill.id,damage:skill.damage})),stats:build.stats,win:world.enemies.every(enemy=>!enemy.alive),seconds:Number((world.tick/30).toFixed(2)),remainingHp:world.hero.hp});
  }
 }
}
const summaries=regions.flatMap(area=>[0,5].flatMap(rank=>['common','rare'].map(quality=>{const sample=rows.filter((row:any)=>row.area===area&&row.rank===rank&&row.quality===quality) as any[],legacy=sample.filter(row=>row.loadout==='legacy-four'),current=sample.filter(row=>row.loadout!=='legacy-four');return {area,rank,quality,legacy:{wins:legacy.filter(row=>row.win).length,samples:legacy.length,minSeconds:Math.min(...legacy.map(row=>row.seconds)),maxSeconds:Math.max(...legacy.map(row=>row.seconds))},collection:{wins:current.filter(row=>row.win).length,samples:current.length,minSeconds:Math.min(...current.map(row=>row.seconds)),maxSeconds:Math.max(...current.map(row=>row.seconds)),attackRange:[Math.min(...current.map(row=>row.stats.attack)),Math.max(...current.map(row=>row.stats.attack))],armorRange:[Math.min(...current.map(row=>row.stats.armor)),Math.max(...current.map(row=>row.stats.armor))]}};})));
const acquisition=regions.map(area=>{const pool=gearTemplatesForRegion(worldGearTemplates(gearBases),area),totalWeight=pool.reduce((sum,template)=>sum+(collectionEquipment(template.base)?equipmentDropRules.seriesWeights[collectionEquipment(template.base)!.series]:1),0),harmonic=[1,2,3,4,5,6].reduce((sum,value)=>sum+1/value,0);return {area,tier:equipmentDropRules.tiers[area],templates:pool.length,collectionTemplates:pool.filter(template=>collectionEquipment(template.base)).length,expectedEquipmentDropsForSixPieceSet:Object.fromEntries(Object.entries(equipmentDropRules.seriesWeights).map(([series,weight])=>[series,Math.round(6*harmonic/(weight*6/totalWeight))])),targetedCrafting:true};});
const budget=[0,1,2,3,4].reduce((total,rank)=>{const cost=upgradeCost(rank);return {gold:total.gold+cost.gold,material:total.material+cost.material};},{gold:0,material:0});
const out=resolve('../docs/reviews/open-world/equipment-runtime-20261004');await mkdir(out,{recursive:true});
await writeFile(resolve(out,'balance.json'),JSON.stringify({versions,policy:'controlled common and rare comparison at official chapter entry levels; same starter skills, seeds, slot-based affix RNG, boss placement, and retained legacy core in both cohorts; existing primary reinforcement rule retained',limitSeconds:90,seeds,samples:rows.length,summaries,acquisition,reinforcementToRank5PerItem:budget,limitations:'Common affix-free gear is not a complete late-game build. Rare affixes use the region ceiling and deterministic sample seeds. Learned professions, active play, multiplayer and endgame weapon training are covered by separate runtime tests, not inferred from this measurement.',rows},null,2)+'\n');
console.log(JSON.stringify({samples:rows.length,summaries,acquisition}));
