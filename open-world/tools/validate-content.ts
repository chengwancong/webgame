import {craftMaterials,craftRecipes} from '../packages/content/crafting.ts';
import {effectAtoms} from '../packages/content/effect-atoms.ts';
import {checkWorldResourceWiring} from './check-world-resource-wiring.ts';
checkWorldResourceWiring({metadataOnly:process.argv.includes('--metadata-only')});
import {skillTagNames as registeredTags} from '../packages/content/skill-tags.ts';
import {comboEffectRules} from '../packages/content/weapon-combos.ts';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {vfxProfiles} from '../apps/web/src/vfx-profiles.ts';
import {statRegistry,statDefinitionSchema} from '../packages/contracts/stats.ts';
import {starseaFactions} from '../packages/content/starsea/reputation.ts';
import {regionById,regions,skillCatalog,skillCategories,starterSkills,skillBookRewards,equipmentItems} from '../packages/content/index.ts';
import {skillSchema} from '../packages/contracts/index.ts';
import {challengeContent} from '../packages/content/progression-challenges.ts';
import {appearanceContent} from '../packages/content/appearance.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import {actorCatalog} from '../packages/asset-manifest/actors.ts';
import {progressionConfig,aspectDefinitions,talentDefinitions,paragonDefinitions,glyphDefinitions,progressionGearTemplates} from '../packages/content/deep-progression.ts';
import {gearBases} from '../packages/rules/index.ts';
import {slotForEquipmentPart} from '../packages/contracts/gear-slots.ts';
const catalog={actors:actorCatalog};
for(const r of regions)for(const s of r.spawns)if(!s.monster)throw Error('Missing resolved monster identity '+r.id+'/'+s.id);
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
// The source mirror has manifests/JSON but intentionally no bitmap payloads.
// Explicit opt-in preserves full byte verification for normal local validation.
const metadataOnly=process.argv.includes('--metadata-only');
if(metadataOnly)console.log('Metadata-only artwork validation: binary payload checks excluded');
const artworkHash=(asset:{path:string;sha256:string})=>{
 if(!/^[0-9a-f]{64}$/.test(asset.sha256))throw Error('Invalid artwork digest '+asset.path);
 return metadataOnly?asset.sha256:createHash('sha256').update(readFileSync(new URL('../apps/web/public'+asset.path,import.meta.url))).digest('hex');
};
import uiManifest from '../packages/asset-manifest/ui.v2.json';
const inventoryArtIds=['item-tonic-attack','item-tonic-hp','item-skill-book',...progressionConfig.materials.filter(m=>craftMaterials.some(d=>d.id===m.id&&['endgame','legacy'].includes(d.kind))||m.id.startsWith('rubbing-')).map(m=>'item-material-'+m.id)];
const inventoryArtHashes=new Set<string>();
for(const id of inventoryArtIds){
 const asset=(uiManifest.assets as Record<string,{kind:string;path:string;size:number[];sha256:string}>)[id];
 if(!asset||asset.kind!=='item'||asset.size.join(',')!=='256,256')throw Error('Missing inventory artwork '+id);
 const sha=artworkHash(asset);
 if(sha!==asset.sha256||inventoryArtHashes.has(sha))throw Error('Invalid or shared inventory artwork '+id);inventoryArtHashes.add(sha);
}
const equipmentLibrary=JSON.parse(readFileSync(new URL('../assets/ui-source/v2/equipment-handdrawn/catalog.json',import.meta.url),'utf8')) as {items:{id:string;sha256:string}[]};
const equipmentEntries=new Map(equipmentLibrary.items.map(item=>[item.id,item])),equipmentArtHashes=new Set<string>();
if(equipmentEntries.size!==324||equipmentLibrary.items.length!==324)throw Error('Expected 54 equipment sets / 324 unique art IDs');
for(const series of ['standard','omega','primal'])for(const direction of ['sword','hammer','axe','staff','hidden','wand'])for(const tier of [1,2,3])for(const slot of ['weapon','armor','helmet','boots','necklace','ring']){
 const id=`gear-${series}-${direction}-t${tier}-${slot}`,entry=equipmentEntries.get(id),asset=(uiManifest.assets as Record<string,{kind:string;path:string;size:number[];sha256:string}>)[id];
 if(!entry||!asset||asset.kind!=='gear'||asset.path!==`/art/ui-v2/equipment-handdrawn/${id}.png`||asset.size.join(',')!=='256,256')throw Error('Missing formal equipment artwork '+id);
 const digest=artworkHash(asset);
 if(digest!==asset.sha256||digest!==entry.sha256)throw Error('Equipment artwork hash mismatch '+id);
 if(equipmentArtHashes.has(digest))throw Error('Shared equipment artwork '+id);equipmentArtHashes.add(digest);
}
const ids=new Set<string>();
for(const r of regions){if(ids.has(r.id))throw Error('Duplicate region '+r.id);ids.add(r.id);if(!walkable(r,r.safe)||!walkable(r,r.portal))throw Error('Invalid safe point');const spawns=new Set<string>();for(const m of r.spawns){if(!walkable(r,m))throw Error('Blocked spawn '+m.id);if(spawns.has(m.id))throw Error('Duplicate spawn');spawns.add(m.id);if(!(m.art in catalog.actors))throw Error('Missing art '+m.art);}}
for(const r of regions)if(r.next&&!ids.has(r.next))throw Error('Missing connection '+r.next);
const skillIds=new Set<string>();
const skillArtHashes=new Set<string>();
for(const skill of skillCatalog){const asset=(uiManifest.assets as Record<string,{kind:string;path:string;sha256:string}>)['skill-'+skill.id];if(!asset||asset.kind!=='skill')throw Error('Missing formal skill artwork '+skill.id);if(skillArtHashes.has(asset.sha256))throw Error('Shared skill artwork '+skill.id);skillArtHashes.add(asset.sha256);if(!metadataOnly)readFileSync(new URL('../apps/web/public'+asset.path,import.meta.url));}
for(const sk of skillCatalog){skillSchema.parse(sk);if((sk.category==='melee'||sk.category==='ranged')!==(sk.weapons.length>0))throw Error('武技必须且只有武技绑定主手武器 '+sk.id);if(!sk.mechanics)throw Error('Missing declared skill mechanics '+sk.id);if(skillIds.has(sk.id)||!(sk.category in skillCategories)||!Number.isInteger(sk.unlockLevel)||sk.unlockLevel<1)throw Error('Invalid skill progression '+sk.id);skillIds.add(sk.id);}
for(const sk of skillCatalog)if(sk.activation&&(!Number.isInteger(sk.activation.quantity)||sk.activation.quantity<1||!skillBookRewards.some(reward=>reward.skill===sk.id)))throw Error('Invalid book activation '+sk.id);
for(const source of skillBookRewards)if(!regions.some(region=>region.id===source.boss&&region.boss)||!skillCatalog.some(sk=>sk.id===source.skill&&sk.activation?.type==='book')||source.quantity<1)throw Error('Invalid skill book reward');
if(starterSkills.length<1||starterSkills.length>4||new Set(starterSkills).size!==starterSkills.length||starterSkills.some(id=>!skillCatalog.some(sk=>sk.id===id&&!sk.activation&&(!sk.weapons?.length||sk.weapons.includes('sword')))))throw Error('Invalid starter skills');
const mechanisms=new Set(['single','area','projectile','zone','shield','heal','dash','chain']);for(const s of skillCatalog){if(!mechanisms.has(s.kind))throw Error('Unknown effect');if(s.cooldown<=0||s.cost<0||s.windup<0||s.duration<0)throw Error('Invalid skill '+s.id);}
// Parse configuration at import, then validate references across content catalogs.
for(const catalog of [progressionConfig.materials,progressionConfig.summons,progressionConfig.factions,aspectDefinitions,talentDefinitions,paragonDefinitions,glyphDefinitions]){
 const seen=new Set<string>();for(const entry of catalog){if(seen.has(entry.id))throw Error('Duplicate progression ID '+entry.id);seen.add(entry.id);}
}
for(const faction of starseaFactions){if(!progressionConfig.factions.some(f=>f.id===faction.id))throw Error('Unknown Starsea reputation faction '+faction.id);for(const map of faction.maps)if(!regions.some(r=>r.id===map))throw Error('Unknown Starsea reputation map '+map);}
const materialIds=new Set(progressionConfig.materials.map(m=>m.id));
for(const table of Object.values(progressionConfig.rewards))for(const material of Object.keys(table))if(!materialIds.has(material))throw Error('Unknown growth reward material '+material);
for(const def of progressionConfig.summons)if(!regions.some(r=>r.id===def.region))throw Error('Unknown progression region '+def.region);
for(const def of progressionConfig.factions)if(!regions.some(r=>r.id===def.id&&!r.boss))throw Error('Unknown reputation faction '+def.id);
for(const aspect of aspectDefinitions)for(const modifier of aspect.modifiers)if(modifier.skill&&!skillIds.has(modifier.skill))throw Error('Unknown aspect skill '+modifier.skill);
for(const node of paragonDefinitions)for(const required of node.requires)if(!paragonDefinitions.some(n=>n.id===required))throw Error('Unknown paragon dependency '+required);
const gearIds=new Set([...gearBases.map(g=>g.base),...progressionGearTemplates.map(g=>g.base)]);
for(const item of equipmentItems){
 const asset=(uiManifest.assets as Record<string,{kind:string;path:string}>)[item.iconId];
 if(!asset||asset.kind!=='gear'||asset.path!==`/art/ui-v2/equipment-handdrawn/${item.iconId}.png`)throw Error('Item icon is not registered: '+item.id);
 if(item.runtimeBase){const base=gearBases.find(g=>g.base===item.runtimeBase);if(!base||base.slot!==slotForEquipmentPart(item.part)||base.setId!==item.setId||base.requiredLevel===undefined)throw Error('Incompatible runtime equipment definition: '+item.id);}
}
for(const recipe of craftRecipes)for(const id of Object.keys(recipe.baseCost.materials))if(!craftMaterials.some(m=>m.id===id))throw Error('制作材料不存在 '+id);
for(const [id,actor] of Object.entries(catalog.actors)){
 if(actor.runtimeKind==='native'){
  if(!actor.nativeProfile?.startsWith('/art/'))throw Error('Missing native actor profile '+id);
  if(!metadataOnly){const profile=JSON.parse(readFileSync(new URL('../apps/web/public'+actor.nativeProfile,import.meta.url),'utf8'));
   if(profile.id&&profile.id!==id){const origin=actor.nativeSourceIdentity&&catalog.actors[actor.nativeSourceIdentity];if(!origin||origin.nativeProfile!==actor.nativeProfile||profile.id!==actor.nativeSourceIdentity)throw Error('Native actor profile identity differs '+id);}}
  if(!(actor.fps>0)||!Object.keys(actor.actions).length)throw Error('Missing native actor actions '+id);
  continue;
 }
 const texture=actor.texture??id;
 const atlasPath=actor.runtimeKind==='atlas'?actor.atlasFile:'/art/'+texture+'.json',imagePath=actor.runtimeKind==='atlas'?actor.atlasImage:'/art/'+texture+'.png';
 if(!atlasPath?.startsWith('/art/')||!imagePath?.startsWith('/art/'))throw Error('Missing declared actor atlas '+id);
 if(!(actor.fps>0))throw Error('Invalid animation FPS '+id);
 if(!Object.keys(actor.actions).length)throw Error('Missing actor actions '+id);
 if(!metadataOnly){const atlas=JSON.parse(readFileSync(new URL('../apps/web/public'+atlasPath,import.meta.url),'utf8'));
  for(const [action,count] of Object.entries(actor.actions))for(let i=0;i<count;i++){const frame=actor.actionFrames?.[action]?.[i]??action+'_'+i;if(!atlas.frames[frame])throw Error('Missing animation frame '+id+'/'+frame);}}
 if(!metadataOnly)readFileSync(new URL('../apps/web/public'+imagePath,import.meta.url));
}
console.log(JSON.stringify({ok:true,regions:regions.length,skills:skillCatalog.length,actors:Object.keys(catalog.actors).length,progression:{aspects:aspectDefinitions.length,talents:talentDefinitions.length,paragon:paragonDefinitions.length,recipes:craftRecipes.length}}));
import {worldTables,validateWorldGeometry} from '../packages/content/world-tables.ts';
import graybox from '../.design/open-world-m0/graybox.json';
import starseaAssetManifest from '../packages/asset-manifest/starsea.v1.json';
import windArtManifest from '../packages/asset-manifest/open-world.v1.json';
import fiveArtManifest from '../packages/asset-manifest/open-world-five.v1.json';
import {fieldRegionIds} from '../packages/content/open-world/index.ts';
import producedWorld from '../packages/content/open-world/production.json';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {conditions as worldConditions} from '../packages/content/task-tables.ts';
import {monsterContent as worldMonsterContent} from '../packages/content/monsters.ts';
import type {Region} from '../packages/content/index.ts';
// M1 table/geometry boundary: this is the technical prototype only. Production
// islands are validated separately until their authored world rows are migrated.
validateWorldGeometry(worldTables,[...fieldRegionIds.map(regionById),...regions],{templates:new Set(worldMonsterContent.templates.map(t=>t.id)),resources:new Set([...starseaAssetManifest.assets,...windArtManifest.assets,...fiveArtManifest.assets].map(a=>a.id)),dungeons:new Set(dungeonContent.definitions.map(d=>d.id)),events:new Set(worldTables.events.map(e=>e.definition)),loot:new Set(JSON.parse(readFileSync(new URL('../apps/api/src/field-loot.json',import.meta.url),'utf8')).tables.map((t:{id:string})=>t.id)),conditions:new Set(worldConditions.map(c=>c.target))});
console.log(JSON.stringify({productionIslands:producedWorld.islands.map((w:any)=>w.report)}));

for(const stat of statRegistry)statDefinitionSchema.parse(stat);
console.log('Registered stats:',statRegistry.length);

for(const rule of comboEffectRules){effectRuleSchema.parse(rule);if(!vfxProfiles[rule.vfxKey])throw Error("Unregistered rule VFX "+rule.id);}

for(const rule of comboEffectRules){for(const id of rule.filter.skills??[])if(!skillIds.has(id))throw Error("Unknown rule skill "+id);for(const tag of rule.filter.tags??[])if(!(tag in registeredTags))throw Error("Unknown rule tag "+tag);}

for(const rule of effectAtoms){effectRuleSchema.parse(rule);if(!vfxProfiles[rule.vfxKey])throw Error("Unregistered atom VFX "+rule.id);}
console.log("Effect atoms:",effectAtoms.length);

import {setEffects} from '../packages/content/set-effects.ts';
import {resolveAtomParts} from '../packages/rules/atom-parts.ts';
for(const set of setEffects)for(const part of [set.two,set.four]){resolveAtomParts(part.atoms.map(a=>({...a,source:set.id})));for(const rule of part.rules){effectRuleSchema.parse(rule);if(!vfxProfiles[rule.vfxKey])throw Error('Unregistered set VFX '+rule.id);}}
console.log('Unified set identities:',setEffects.length);

import {newAspects} from '../packages/content/aspects.ts';
import {inscriptionRubbings} from '../packages/content/inscription-rubbings.ts';
for(const aspect of newAspects){for(const rule of aspect.parts.rules){effectRuleSchema.parse(rule);if(!vfxProfiles[rule.vfxKey])throw Error('Unregistered aspect VFX '+rule.id);}for(const patch of aspect.parts.patches)for(const id of patch.skills??[])if(!skillIds.has(id))throw Error('Unknown patched skill '+id);}
console.log('New aspects:',newAspects.length,'Legacy aspects:',aspectDefinitions.filter(a=>a.legacy).length,'Inscription rubbings:',inscriptionRubbings.length);

import {augments} from '../packages/content/augments.ts';
import {rebuildFrozenAugmentBuild,freezeAugmentBasis} from '../packages/rules/frozen-augment-build.ts';
import {resolveBuild} from '../packages/rules/index.ts';
const augmentFixture={id:'00000000-0000-4000-8000-000000000001',name:'content-check',revision:1,build:1,level:50,xp:0,gold:0,material:0,gear:[],equipment:{},skills:['cut'],skillRanks:{cut:1},progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};
const augmentResolved=resolveBuild(augmentFixture),augmentBasis=freezeAugmentBasis(augmentFixture,{stats:augmentResolved.stats,skills:augmentResolved.resolvedSkills});
for(const augment of augments){rebuildFrozenAugmentBuild(augmentBasis,[augment.id],augments);for(const rule of augment.parts.rules){effectRuleSchema.parse(rule);if(!vfxProfiles[rule.vfxKey])throw Error('Unregistered augment VFX '+rule.id);}}
for(const [tier,count]of [['silver',40],['gold',35],['prismatic',15]] as const)if(augments.filter(a=>a.tier===tier).length!==count)throw Error('Augment tier count '+tier);
console.log('Run augments:',augments.length,'silver 40 / gold 35 / prismatic 15');

for(const row of worldTables.events){if(row.kind==='horde')for(const wave of row.waves)for(const pack of wave)if(pack.rank==='normal'&&worldMonsterContent.templates.find(t=>t.id===pack.template)?.role!=='swarm')throw Error('怪潮普通档须采用杂兵角色模板 '+row.id);}

for(const talent of talentDefinitions)for(const rule of talent.parts?.rules??[]){effectRuleSchema.parse(rule);if(!vfxProfiles[rule.vfxKey])throw Error('Unknown field talent VFX '+rule.id);}

// B2: every enemy move carries a player-facing hint; over-long hints fail, missing ones are listed.
import {monsterSkills,chapterBossSkills} from '../packages/content/chapter-combat.ts';
import {maxSkillHintChars} from '../packages/content/combat-hints.ts';
const hinted:{id:string;name:string;hint?:string}[]=[...Object.values(monsterSkills)];
for(const boss of Object.values(chapterBossSkills) as {skills?:{id:string;name:string;hint?:string}[]}[])for(const skill of boss.skills??[])hinted.push(skill);
for(const skill of hinted)if(skill.hint&&skill.hint.length>maxSkillHintChars)throw Error('招式说明超过 '+maxSkillHintChars+' 字：'+skill.id+' '+skill.hint);
const missing=hinted.filter(s=>!s.hint);
if(missing.length)console.warn('招式缺少行为说明 '+missing.length+' 条\n'+missing.map(s=>s.id+' · '+s.name).join('\n'));
console.log('Enemy move hints:',hinted.length-missing.length,'/',hinted.length,'缺',missing.length);

import '../packages/content/tactical-content.ts';
