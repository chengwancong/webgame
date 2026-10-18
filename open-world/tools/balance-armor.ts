import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';
import {versions} from '../packages/contracts/index.ts';
import {armorMitigation,armorRuleSchema,combatNumerics} from '../packages/rules/combat-numerics.ts';
import recordedV2 from '../tests/fixtures/combat-numerics-v2.json';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {scaleWorldGear,dropProfileFor} from '../apps/api/src/economy.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {campaignCharacter} from './campaign-model.ts';
import {measureDungeon} from './dungeon-model.ts';
import {sourceVersion} from './source-version.mjs';

const sourceBefore=await sourceVersion(),old={version:2 as const,armor:armorRuleSchema.parse(recordedV2.armor)},seeds=[11,23,47];
const curve=[9,36,144].flatMap(hit=>[0,4,10,20,40,60,80,100,160,162,200,648,1000].map(armor=>({hit,armor,before:armorMitigation(hit,armor,old.armor),after:armorMitigation(hit,armor)})));
const thresholds=[.25,.5,.75,.9].map(reduction=>({reduction,armorPerHit:combatNumerics.armor.damageFactor/combatNumerics.armor.ratingScale*reduction/(1-reduction)}));
const rows=[];
for(const seed of seeds)for(const id of ['trial-meadow','trial-dragonbone','high-meadow','high-dragonbone'])for(const fixture of ['starter','armor-40','armor-80']){
 const definition=dungeonContent.definitions.find(d=>d.id===id);assert(definition,'Unknown diagnostic dungeon '+id);
 const state=campaignCharacter('melee');state.level=definition.level;
 state.skills=['cut','whirl','ward','mend'];state.skillRanks=Object.fromEntries(state.skills.map(skill=>[skill,3]));
 for(const gear of state.gear)gear.rank=3;
 if(fixture!=='starter'){
  // Actual dragonbone base scaling and legal tier-3 affixes, explicitly granted for diagnosis.
  state.gear[1]=scaleWorldGear(state.gear[1],dropProfileFor('dragonbone'));state.gear[1].rank=5;
  const armorAffix=(value:number)=>({id:'diagnostic-armor',name:'护甲',stat:'armor',value,tier:3 as const,description:'护甲 +'+value});
  const setArmor=(gear:typeof state.gear[number],value:number)=>{gear.quality='rare';gear.affixes=[armorAffix(value),{id:'diagnostic-hp',name:'生命',stat:'hp',value:26,tier:2,description:'生命 +26'}];};
  if(fixture==='armor-40')setArmor(state.gear[1],16);
  else{state.equipment.accessory='accessory';state.equipment.core='fire-core';for(const gear of state.gear.filter(g=>Object.values(state.equipment).includes(g.id)))setArmor(gear,14);}
  assert.equal(resolveBuild(state).stats.armor,fixture==='armor-40'?40:80);
 }
 const before=measureDungeon(definition,[structuredClone(state)],1,seed,old),after=measureDungeon(definition,[structuredClone(state)],1,seed);
 assert.deepEqual(before.actors.map(a=>a.stats),after.actors.map(a=>a.stats));assert.deepEqual(before.actors.map(a=>a.skills),after.actors.map(a=>a.skills));
 rows.push({id,seed,fixture,before,after});
}
const sourceAfter=await sourceVersion();assert.equal(sourceBefore.sha256,sourceAfter.sha256,'Source changed during comparison');
const report={versions,source:sourceBefore,sourceAfter,reference:{game:'Path of Exile 1',revision:'3.16.0',url:'https://www.pathofexile.com/forum/view-thread/3186390',anchor:'10,000 armour vs 2,000 physical hit = 50% reduction',localRatingScale:combatNumerics.armor.ratingScale,localReductionCap:combatNumerics.armor.maxReduction},curve,thresholds,seeds,fixtures:'Controlled rank-3 melee skills and +3 starter equipment; entry levels for challenges. Armor-40/80 use granted dragonbone-scaled coat +5 and legal tier-3 armor affixes (16 on coat; 14 on each of four worn items); rare items each also have +26 HP. Granted skill ranks and gear; no random gear or natural acquisition claim. Same builds, seed, goals and monster configuration, only armor profile changes.',limits:'Armor curve and solo automatic combat diagnostics. Current game armor applies to incoming damage generally; this is not a copy of PoE physical/elemental/DoT taxonomy. Percentage-point reduction gains diminish; EHP gains against a fixed hit are linear before the cap. No human win-rate claim.',rows};
const out=process.argv.find(a=>a.startsWith('--out='))?.slice(6)??'../docs/reviews/open-world/armor-reference-20261003/comparison.json';await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2));
console.log(JSON.stringify({out,versions,sourceStable:true,samples:rows.length,summary:['starter','armor-40','armor-80'].map(fixture=>{const sample=rows.filter(r=>r.fixture===fixture);return{fixture,beforeWins:sample.filter(r=>r.before.success).length,afterWins:sample.filter(r=>r.after.success).length,samples:sample.length};})},null,2));
