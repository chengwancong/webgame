import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {versions,type CharacterState,type GearQuality} from '../../packages/contracts/index.ts';
import {newStarseaState} from '../../packages/rules/starsea.ts';
import {gearBases,instantiateGearTemplate} from '../../packages/rules/index.ts';
import {applyItemPower} from '../../packages/rules/item-power.ts';
import {attachHexAffixes,freezeHexLoot,type HexAffixSource} from '../../apps/api/src/hex-loot.ts';
import {worldGearTemplates,gearTemplatesForRegion,dropWeight,pickRegionalGearTemplate,rollGearQuality,rollGearDrop,dropProfileFor,equipmentDropRules} from '../../apps/api/src/economy.ts';
import fieldLoot from '../../apps/api/src/field-loot.json';
const policy=freezeHexLoot()!;assert.equal(policy.version,2);
const count=100000,seed=20261021;let state=seed,serial=0;
const random=()=>{state=(Math.imul(state,1664525)+1013904223)>>>0;return state/4294967296;};
const int=(min:number,max:number)=>min+Math.floor(random()*(max-min));
const uuid=()=>`00000000-0000-4000-8000-${(++serial).toString(16).padStart(12,'0')}`;
const character:CharacterState={id:uuid(),name:'D13 deterministic cohort',revision:0,build:1,level:15,xp:0,gold:0,material:0,gear:[],equipment:{},skills:['cut','whirl'],skillRanks:{cut:1,whirl:1},progress:{kills:0,regions:[],bosses:[],safe:'town',tasks:[]},starsea:newStarseaState(),hex:{awardedTasks:[],pity:{q01:true,q03:true}}};
character.starsea!.done=['HEX-Q01'];character.starsea!.quests={};
const templates=worldGearTemplates(gearBases),region='ss-map-mist',rows=[];
const pool=gearTemplatesForRegion(templates,region),ends:number[]=[];let total=0;
for(const t of pool){total+=dropWeight(t.base,region);ends.push(total);}
function atWeight(value:number){let lo=0,hi=ends.length-1;while(lo<hi){const mid=(lo+hi)>>1;if(value<ends[mid])hi=mid;else lo=mid+1;}return pool[lo];}
// Preparing the frozen distribution avoids rescanning the catalogue a million
// times. Verify every possible integer draw against the production selector.
for(let draw=0;draw<total;draw++)assert.equal(atWeight(draw).base,pickRegionalGearTemplate(templates,region,equipmentDropRules,()=>draw).base);
const cases:{name:string;kind:HexAffixSource['kind'];table?:string;target?:string;first?:boolean;expected:number}[]=[
 {name:'elite',kind:'elite',table:'field-elite',expected:policy.baselineExpected!.elite},
 {name:'event',kind:'event',table:'field-event',expected:policy.baselineExpected!.event},
 {name:'first-event',kind:'event',table:'field-event',first:true,expected:policy.baselineExpected!.event*policy.sources.firstEventMultiplier},
 {name:'dungeonChest',kind:'dungeonChest',table:'field-chest',target:'field-mist-1',expected:policy.baselineExpected!.dungeonChest},
 {name:'dungeonBoss',kind:'dungeonBoss',target:'field-mist-1',expected:policy.baselineExpected!.dungeonBoss},
 {name:'rare',kind:'rare',table:'field-rare',target:'ow-mist-rare1',expected:policy.baselineExpected!.rare}
];
for(const test of cases){
 let gearCount=0,eligible=0,hexCount=0,core=0;const tiers:Record<string,number>={},runes:Record<string,number>={};
 for(let trial=0;trial<count;trial++){
  const qualities:GearQuality[]=[];
  if(test.table){
   const table=fieldLoot.tables.find(t=>t.id===test.table)!;
   for(let n=int(table.gear[0],table.gear[1]+1);n>0;n--)qualities.push(rollGearQuality(Object.assign({common:0,magic:0,rare:0,legendary:0},table.quality),int));
  }else{const quality=rollGearDrop({boss:true,elite:false},dropProfileFor(region),false,int);if(quality)qualities.push(quality);}
  const gear=qualities.map(quality=>{
   const template=atWeight(int(0,total)),g=instantiateGearTemplate(template,uuid(),quality,[]);
   g.origin={kind:'random'};applyItemPower(g,15);return g;
  });
  gearCount+=gear.length;eligible+=gear.filter(g=>g.slot!=='core'&&g.quality!=='common').length;core+=gear.filter(g=>g.slot==='core').length;
  attachHexAffixes(character,gear,{region,kind:test.kind,target:test.target,first:test.first},policy,random);
  for(const g of gear)if(g.hex){
   assert.notEqual(g.slot,'core');assert.notEqual(g.quality,'common');assert.equal(g.origin?.kind,'random');
   hexCount++;tiers[g.hex.tier]=(tiers[g.hex.tier]??0)+1;runes[g.hex.rune]=(runes[g.hex.rune]??0)+1;
  }
 }
 const actual=hexCount/count,relativeError=(actual-test.expected)/test.expected,passed=Math.abs(relativeError)<=.05;
 const row={source:test.name,encounters:count,gearCount,eligible,excludedCore:core,hexCount,expectedPerEncounter:test.expected,actualPerEncounter:actual,relativeError,passed,tiers,runes};rows.push(row);console.log(JSON.stringify(row));
}
const files=['apps/api/src/hex-loot.json','apps/api/src/hex-loot.ts','apps/api/src/field-loot.json','apps/api/src/drop-profiles.json','apps/api/src/equipment-drop-rules.json','packages/content/hex-runes.json'];
const hashes=Object.fromEntries(await Promise.all(files.map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const report={at:new Date().toISOString(),versions,seed,algorithm:'32-bit LCG 1664525/1013904223',scope:'100000 encounters per source; prepared template distribution exhaustively verified against production selector for every integer draw; actual quality generator and attachment selector. Controlled level15 cohort; excludes one-time guarantees. Not natural one-hour pacing or GUI evidence.',frozenPolicy:policy,hashes,rows,passed:rows.every(r=>r.passed)};
const output=process.argv[2];if(output)await writeFile(output,JSON.stringify(report,null,2)+'\n');
assert.ok(report.passed,'D13 one-pass expected-count audit failed; report residuals, do not sweep or silently retune');
