import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {applySpinePlan,type SpineChange} from './apply.ts';
import {hexRuneCatalogSchema,type HexRune} from '../../packages/content/hex-runes.ts';
import {describeAspectRule} from '../../packages/content/aspect-description.ts';
import {hexPolicyContentSchema} from '../../packages/content/hex-policy.ts';
import {hexLootContentSchema} from '../../apps/api/src/hex-loot.ts';
import {gearBases} from '../../packages/rules/index.ts';
import {worldGearTemplates,gearTemplatesForRegion,dropWeight,dropProfileFor,equipmentDropRules} from '../../apps/api/src/economy.ts';
import fieldLoot from '../../apps/api/src/field-loot.json';
const runesFile='packages/content/hex-runes.json',bytes=await readFile(runesFile);
assert.equal(createHash('sha256').update(bytes).digest('hex'),'60afa252d4eed6525c82841a6dfd7be4340e3e57a78ee94377bcee20dde44e53','D13 applies exactly once to the reviewed D12 source');
const runes=JSON.parse(bytes.toString('utf8')) as HexRune[],before=JSON.parse(await readFile('apps/api/src/hex-loot.json','utf8')).policy;
assert.equal(before.version,1,'D13 loot conversion must not be applied twice');
const templates=gearTemplatesForRegion(worldGearTemplates(gearBases),'ss-map-mist'),weights=templates.map(t=>({t,w:dropWeight(t.base,'ss-map-mist',equipmentDropRules)}));
const share=weights.filter(x=>x.t.slot!=='core').reduce((n,x)=>n+x.w,0)/weights.reduce((n,x)=>n+x.w,0);
const eligible=(id:string)=>{const t=fieldLoot.tables.find(t=>t.id===id)!;return (t.gear[0]+t.gear[1])/2*Object.entries(t.quality).filter(([q])=>q!=='common').reduce((n,[,w])=>n+w,0)/Object.values(t.quality).reduce((n,w)=>n+w,0)*share;};
const boss=dropProfileFor('ss-map-mist').boss;
const expected={elite:eligible('field-elite'),event:eligible('field-event'),dungeonChest:eligible('field-chest'),dungeonBoss:boss.gearPercent/100*(1-boss.quality.common/Object.values(boss.quality).reduce((n,w)=>n+w,0))*share,rare:eligible('field-rare')};
const after=structuredClone(before);after.version=2;after.expectedEligible=expected;after.eligibleTemplateShare=share;after.baselineExpected={};
for(const key of Object.keys(expected) as (keyof typeof expected)[]){after.baselineExpected[key]=before.sources[key];after.sources[key]=Math.min(1,before.sources[key]/expected[key]);}
const basis='Claude D13 §2.5 scale ×0.5, §6 resonanceMin=2. No trigger/ICD/radius/duration adjustment.';
const changes:SpineChange[]=[];
for(const [i,r] of runes.entries())for(const [quality,t] of Object.entries(r.tiers))for(const [j,rule]of t.rules.entries()){
 const adjusted=structuredClone(rule);
 for(const path of rule.scale){
  const keys=path.split('.').map(k=>/^\d+$/.test(k)?Number(k):k);let parent:any=adjusted;for(const k of keys.slice(0,-1))parent=parent[k];
  const key=keys.at(-1)!,value=parent[key];parent[key]=value*.5;
  changes.push({file:runesFile,path:[i,'tiers',quality,'rules',j,...keys],before:value,after:value*.5,basis});
 }
 if(rule.scale.length)changes.push({file:runesFile,path:[i,'tiers',quality,'rules',j,'description'],before:rule.description,after:describeAspectRule(adjusted),basis:'Regenerate the description from the exact D13 parameters'});
}
changes.push({file:'packages/content/hex-policy.json',path:['policy'],before:null,after:{version:1,resonanceMin:2,resonanceMultiplier:1.1,damageMultiplierCap:.6,damageReductionCap:.35,cooldownReductionCap:.4,recoveryPerSecondCap:.08,manaRefundCap:.6,invulnerabilitySharedTicks:600,invulnerabilityMaxTicks:240},basis:'D10 §5.1/5.2 hard caps; D13 §6.1 threshold2'});
changes.push({file:'apps/api/src/hex-loot.json',path:['policy'],before,after,basis:'D13 §2.2 p_affix=min(1,p_previous/E[eligible gear]); actual frozen field tables, regional weighted non-core pool and boss quality distribution. '+JSON.stringify({share,expected})});
console.log(await applySpinePlan('.',changes,{[runesFile]:hexRuneCatalogSchema,'packages/content/hex-policy.json':hexPolicyContentSchema,'apps/api/src/hex-loot.json':hexLootContentSchema},{apply:process.argv.includes('--apply'),output:'docs/reviews/numeric-spine-20261013/HEX-B08-20261021'}));
console.log(JSON.stringify({eligibleTemplateShare:share,expectedEligible:expected,previous:after.baselineExpected,perEligibleItem:after.sources,mechanismFieldChanges:changes.length-2}));
