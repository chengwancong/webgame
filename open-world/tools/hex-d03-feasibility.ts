/** D02b-1 + D04 audit drafts only. These are NOT published rune definitions or tuned values.
 * Missing design parameters are deliberately left missing. Non-stacking buff maxStacks=1
 * is a schema fixture; a schema pass does not approve any quality's full behavior.
 */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {effectRuleSchema} from '../packages/contracts/effects.ts';
import {statusEffectSchema} from '../packages/contracts/skill-mechanics.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {hexRunes} from '../packages/content/hex-runes.ts';
import {skillSchema,versions} from '../packages/contracts/index.ts';
import type {Spawn} from '../packages/contracts/index.ts';
const buff=(duration:number|undefined,mods:object={},flags?:object)=>({type:'buff',duration,maxStacks:1,mods,...(flags?{flags}:{})});
const status=(status:string,duration:number,strength?:number)=>({type:'status',status,duration,...(strength===undefined?{}:{strength})});
const dot=['burn','poison','bleed'];
const draft:Record<string,any>={
 A1:hexRunes[0].tiers.common.rules[0],
 A2:{trigger:'nth',every:5,count:'hit',action:{type:'nova',radius:2.5,ratio:.6,damageType:'physical'}},
 A3:{trigger:'crit',chance:.4,icd:90,action:{type:'shards',count:4,ratio:.25,range:8}},
 A4:{trigger:'cast',chance:.12,icd:240,action:{type:'echo',ratio:.5,delay:30,retarget:false}},
 A5:{trigger:'kill',action:{...buff(300,{damageMult:.03}),maxStacks:5}},
 A6:{trigger:'interval',every:300,action:{type:'field',at:'self',radius:3,duration:90,interval:30,ratio:.25,damageType:'shadow'}},
 D1:{trigger:'hit',icd:30,when:[{kind:'self_state',state:'shield'}],action:{type:'nova',ref:'shield',ratio:.2,radius:3}},
 D2:{trigger:'hurt',icd:300,when:[{kind:'self_hp',op:'lt',value:.5}],action:{type:'heal',ratio:.05,ref:'maxHp',overflowShield:1}},
 D3:{trigger:'lethal',icd:1800,action:buff(60,{}, {surviveAtOne:true})},
 D4:{trigger:'block',icd:30,action:{type:'nova',at:'self',radius:2,ratio:.8,ref:'attack'}},
 D5:{trigger:'dodge',icd:120,action:{type:'shield',ratio:.06,ref:'maxHp',duration:90}},
 D6:{trigger:'low_hp',icd:600,when:[{kind:'self_hp',op:'lt',value:.3}],action:buff(180,{damageReduction:.2})},
 C1:{trigger:'hurt',chance:.4,icd:90,action:status('slow',60,.3)},
 C2:{trigger:'cast',chance:.25,icd:360,action:{type:'nova',at:'self',radius:3.5,ratio:.3,damageType:'cold',status:{kind:'freeze',duration:30,strength:0,scope:'hit',cleanse:true}}},
 C3:{trigger:'interval',every:360,action:{type:'field',at:'target',radius:4,pull:.6,duration:90,ratio:.15,damageType:'shadow',interval:30}},
 C4:{trigger:'crit',icd:180,action:status('silence',30)},
 C5:{trigger:'nth',every:10,when:[{kind:'not',condition:{kind:'target_rank',ranks:['boss']}}],action:status('petrify',30)},
 C6:{trigger:'kill_elite',action:{type:'spread',statuses:['fear'],radius:6,count:3}},
 M1:{trigger:'cast',icd:120,action:buff(60,{speedPercent:.2})},
 M2:{trigger:'dash',action:{type:'field',at:'path',radius:1.5,duration:120,interval:30,damageType:'fire',ratio:.2,statuses:['burn']}},
 M3:{trigger:'moved',every:2,icd:30,action:{...buff(60,{damageAdd:.02}),maxStacks:5}},
 M4:{trigger:'dash',action:{type:'nova',at:'self',radius:3,ratio:.5,ref:'attack',status:{kind:'slow',duration:30,strength:.3,scope:'hit',cleanse:true}}},
 M5:{trigger:'dash',icd:300,action:{...buff(120,{}, {forceCrit:true}),consume:'nextHit'}},
 M6:{trigger:'hurt',icd:1200,when:[{kind:'self_hp',op:'lt',value:.35}],action:{type:'blink',distance:6,direction:'away_from_enemies'}},
 R1:{trigger:'kill',action:{type:'mana',ratio:.06,ref:'maxMana'}},
 R2:{trigger:'crit',icd:150,action:{type:'cooldown',mode:'random',ticks:30}},
 R3:{trigger:'mana_empty',icd:1200,action:{type:'mana',ratio:.3,ref:'maxMana'}},
 R4:{trigger:'kill',action:{type:'heal',ratio:.03,ref:'maxHp'}},
 R5:{trigger:'nth',every:6,count:'cast',action:{...buff(240,{}, {freeCost:true}),consume:'nextCast'}},
 R6:{trigger:'kill_elite',action:{type:'refund',mode:'longest',fraction:.3}},
 S1:{trigger:'hit',icd:180,when:[{kind:'target_status',statuses:dot}],action:{type:'detonate',statuses:dot,ratio:.5,remove:false,budget:'perTarget'}},
 S2:{trigger:'hit',chance:.2,icd:150,action:status('vulnerable',90,.12)},
 S3:{trigger:'passive',action:{type:'amplify',against:['vulnerable','armor_down','shock'],ratio:.1}},
 S4:{trigger:'kill',when:[{kind:'target_status',statuses:dot}],action:{type:'spread',statuses:dot,radius:5,count:2}},
 S5:{trigger:'status_apply',filter:{statusKinds:['burn','poison']},action:{type:'extend',statuses:['burn','poison'],duration:30,max:120,maxMode:'bonus'}},
 S6:{trigger:'hit',when:[{kind:'target_status',statuses:['freeze']}],action:{type:'nova',ref:'attack',ratio:1,radius:3,damageType:'cold'}},
};
const document=await readFile(new URL('../docs/hex-gear-20261019/d03-mechanism-catalog.md',import.meta.url),'utf8');
const rulings=await readFile(new URL('../docs/hex-gear-20261019/d04-feasibility-rulings.md',import.meta.url),'utf8');
const rows=[...document.matchAll(/^\| ([ADCMRS][1-6]) \| ([a-z-]+) \| ([^|]+) \|/gm)];
assert.equal(rows.length,36);assert.deepEqual(rows.map(r=>r[1]).sort(),Object.keys(draft).sort());
const rules:Record<string,any>={};
const schemaAudit=rows.map(([,id,slug,name])=>{
 const input={id:'audit-'+slug,name:name.trim(),description:'D02b-1 audit only',source:'hex-'+slug,tier:1,chance:1,icd:0,filter:{},when:[],scale:[],vfxKey:'hex/'+slug,...draft[id]};
 const result=effectRuleSchema.safeParse(input);if(result.success)rules[id]=result.data;
 return {id,slug,schemaAccepted:result.success,scope:'common action draft only; higher qualities NOT certified',issues:result.success?[]:result.error.issues.map(i=>({path:i.path.join('.'),message:i.message})),input};
});
function world(id:string,actionPatch?:object){
 const rule=effectRuleSchema.parse({...structuredClone(rules[id]),chance:1,...(actionPatch?{action:{...rules[id].action,...actionPatch}}:{})});
 const spawns:Spawn[]=[0,1].map(i=>({id:'probe-'+i,kind:'melee',name:'audit',x:10+i*2,y:10,hp:1000,attack:0,boss:false,elite:false,art:'raider'}));
 const skill=skillSchema.parse({id:'qa-strike',name:'audit strike',description:'fixture',kind:'single',damage:100,range:2,radius:1,cooldown:60,cost:0,windup:0,duration:1,projectiles:1});
 const w=new World({...regionById('meadow'),obstacles:[],safe:{x:8,y:10}},{hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules:[rule]},[skill],spawns,[],7);w.mode='manual';return {w,rule,skill};
}
// Event construction is deliberately separate from semantic proof below. An emitted
// event can still hide a no-op or wrong effect (D3, S6, C6 demonstrate that).
const eventProbes=Object.keys(rules).map(id=>{
 const {w,rule,skill}=world(id);
 if(rule.trigger==='passive')return {id,scope:'passive modifier',effectTriggered:null,limitation:'No active effect_triggered contract; needs damage comparison, not a fabricated event'};
 w.hero.hp=200;w.hero.mana=0;w.hero.shield=100;w.hero.shieldUntil=1000;w.cooldowns[skill.id]=60;
 for(const kind of ['burn','poison','bleed','freeze','vulnerable','fear'] as const)w.applyStatus('probe-0',statusEffectSchema.parse({kind,duration:90,strength:kind==='vulnerable'?.1:0,scope:'hit',cleanse:true,...(dot.includes(kind)?{interval:30,total:100,damageType:kind==='poison'?'poison':'physical'}:{})}),'fixture','qa-'+kind);
 const carried=[...w.statuses];
 if(rule.trigger==='nth'&&rule.count==='cast')for(let n=0;n<rule.every!;n++)(w as any).fireEffects('cast',w.enemies[0],100,skill,carried,0,true);
 else if(['hit','crit','nth'].includes(rule.trigger))for(let n=0;n<(rule.every??1);n++)(w as any).comboHit(w.enemies[0],100,{category:'direct',damageType:'physical',skill},'physical',true,carried);
 else if(id==='S5')w.applyStatus('probe-0',statusEffectSchema.parse({kind:'burn',duration:90,interval:30,total:100,damageType:'fire',strength:0,scope:'hit',cleanse:true}),'hero','audit-new-burn');
 else (w as any).fireEffects(rule.trigger,w.enemies[0],100,skill,carried,100);
 const count=w.effectStats[rule.id]?.count??0;
 assert.equal(count,1,id+' event dispatch');
 return {id,scope:'controlled chance=1 event fixture, NOT full behavior certification',effectTriggered:count};
});
const observed:any[]=[];
{
 const {w,rule}=world('A2');for(let n=0;n<5;n++)(w as any).comboHit(w.enemies[0],100,undefined,'physical',false,[]);
 assert.equal(w.effectStats[rule.id]?.count,1);assert.equal(w.enemies[0].hp,940);
 observed.push({id:'A2-common',effectTriggered:1,damage:60,matchesDraft:true,scope:'controlled nth-hit event fixture; no TTK claim'});
}
for(const radius of [undefined,3]){
 const {w,rule}=world('S1',radius===undefined?undefined:{radius});
 w.applyStatus('probe-0',statusEffectSchema.parse({kind:'burn',duration:90,interval:30,total:100,strength:0,scope:'hit',cleanse:true,damageType:'fire'}),'hero','qa-dot');
 (w as any).fireEffects('hit',w.enemies[0],100,undefined,[...w.statuses]);
 assert.equal(w.effectStats[rule.id]?.count,1);assert.equal(w.enemies[0].hp,950);
 assert.equal(w.enemies[1].hp,1000);
 observed.push({id:radius===undefined?'S1-common':'S1-radius-probe',effectTriggered:1,damage:w.enemies.map(e=>1000-e.hp),dotStillPresent:w.hasStatus('probe-0','burn'),matchesDraft:true,scope:'D04 opt-in perTarget budget; full candidate quality probes in hex-d04-samples.test.ts'});
}
{
 const {w,rule}=world('S6');w.applyStatus('probe-0',statusEffectSchema.parse({kind:'freeze',duration:30,strength:0,scope:'hit',cleanse:true}),'hero','qa-freeze');
 (w as any).fireEffects('hit',w.enemies[0],100,undefined,[...w.statuses]);
 assert.equal(w.effectStats[rule.id]?.count,1);assert.equal(w.enemies[0].hp,900);
 observed.push({id:'S6-common-nova-only',effectTriggered:1,damage:100,freezeRemoved:!w.hasStatus('probe-0','freeze'),matchesDraft:false,limitation:'This single-action draft omits the second status_remove rule; N7b is verified separately, not a full S6 catalogue entry'});
}
{
 const {w,rule}=world('D3');(w as any).hurt(2000,'qa-lethal',{category:'direct',damageType:'physical',sourceId:'probe-0'});
 assert.equal(w.effectStats[rule.id]?.count,1);assert.equal(w.hero.hp,1);
 observed.push({id:'D3-common',effectTriggered:1,heroHp:1,matchesDraft:true,scope:'standalone surviveAtOne; duration/ICD/recovery verified in hex-p0-capabilities.test.ts'});
}
{
 const {w,rule}=world('C6');(w as any).fireEffects('kill_elite',w.enemies[0],100,undefined,[]);
 assert.equal(w.effectStats[rule.id]?.count,1);assert.equal(w.statuses.length,0);
 observed.push({id:'C6-common',effectTriggered:1,statusesApplied:0,matchesDraft:false,limitation:'spread copies an existing carried status; it does not create fear on an unfeared kill'});
}
const report={version:'D02b-1+D04',at:new Date().toISOString(),runtimeVersions:versions,designSHA256:createHash('sha256').update(document).digest('hex'),rulingsSHA256:createHash('sha256').update(rulings).digest('hex'),auditOnly:true,metadataDefaults:'chance=1/icd=0 where omitted, singleton buff maxStacks=1 are audit scaffolding, not approved publishing parameters',count:schemaAudit.length,schemaAccepted:schemaAudit.filter(x=>x.schemaAccepted).length,schemaRejected:schemaAudit.filter(x=>!x.schemaAccepted).length,schemaAudit,eventProbes,observed,remaining:'Common drafts only. D6 instant-heal and S6 status_remove secondary rules omitted from this one-action audit; C6 seed fear duration missing; other full-quality definitions/assets/TTK/publication/GUI remain separate acceptance work.'};
if(process.argv[2])await writeFile(process.argv[2],JSON.stringify(report,null,2));
console.log(JSON.stringify({count:report.count,schemaAccepted:report.schemaAccepted,schemaRejected:report.schemaRejected,rejected:schemaAudit.filter(x=>!x.schemaAccepted).map(({id,issues})=>({id,issues})),eventProbes,observed,remaining:report.remaining}));
