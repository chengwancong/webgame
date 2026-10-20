/** D07 N0c acceptance probes only. Never imported by live content.
 * 600t buff lifetimes / radius and range in partial probes are test scaffolding,
 * not replacements for omitted design values or battle-lifetime semantics. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {effectRuleSchema,effectTriggers,type EffectRule} from '../packages/contracts/effects.ts';
import {skillSchema,versions} from '../packages/contracts/index.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
const document=await readFile(new URL('../docs/hex-gear-20261019/d07-headliner-and-hero-skill-runes.md',import.meta.url),'utf8');
const rows=[...document.matchAll(/^\| ((?:K|H|P|AB|G)\d+) \| ([a-z-]+) \| ([^|]+) \|/gm)];assert.equal(rows.length,34);
const buff=(mods:object,maxStacks=1,duration=600)=>({type:'buff',mods,maxStacks,duration});
const draft:Record<string,object[]>={
 K3:[{trigger:'revived',action:buff({damageMult:.08},3)}],
 H3:[{trigger:'interval',every:120,action:buff({maxHpPercent:.01},10)},{trigger:'hit',action:{type:'nova',ref:'maxHp',at:'target',radius:0,maxTargets:1,ratio:.04}}],
 H4:[{trigger:'out_of_combat',action:buff({attackSpeed:.6})}],
 H7:[{trigger:'kill',when:[{kind:'target_hp',op:'lt',value:.5}],action:buff({damageAdd:.02},20)}],
 H10:[{trigger:'passive',when:[{kind:'target_hp',op:'gte',value:1}],action:{...buff({damageMult:.2}),firstPerTarget:1}}],
 P3:[{trigger:'hit',icd:240,action:{type:'nova',ref:'maxHp',at:'target',radius:0,maxTargets:1,ratio:.05}}],
 P5:[{trigger:'crit',action:buff({critMultiplier:.02},10)},{trigger:'lethal',maxTriggers:1,when:[{kind:'self_state',state:'buff',id:'audit-P5-0',value:5}],action:{...buff({}),duration:90,flags:{surviveAtOne:true,forceCrit:true}}}],
 P10:[{trigger:'kill',action:buff({damageMult:.004},50,Infinity)}],
 P12:[{trigger:'hit',action:{...buff({attackSpeed:.04},5,180),stackMode:'independent'}}],
 P18:[{trigger:'out_of_combat',every:30,action:{type:'heal',ratio:.015,ref:'maxHp'}}],
 P20:[{trigger:'nth',every:3,count:'hit',action:{type:'shards',ratio:.2,count:1,range:8,ref:'attack'}}],
 G2:[{trigger:'hit',action:{type:'status',status:'mark',duration:120}},{trigger:'hit',action:{type:'detonate',statuses:['freeze'],ratio:.3,remove:true}}],
 G4:[{trigger:'interval',every:210,action:{type:'nova',at:'self',radius:2,ratio:.5,ref:'attack'}},{trigger:'interval',every:210,action:{type:'nova',at:'self',radius:4,ratio:.5,ref:'attack'}}],
 G5:[{trigger:'interval',every:240,action:{type:'arc',ratio:.2,count:3,range:4,damageType:'arcane',decay:1.2}}],
};
function input(id:string,index:number,fragment:object){return {id:`audit-${id}-${index}`,name:id,description:'D07 audit only',source:'audit-only',chance:1,icd:0,filter:{},when:[],scale:[],vfxKey:'hex/audit',...fragment};}
const parsed=(id:string,index=0)=>effectRuleSchema.parse(input(id,index,draft[id][index]));
const skill=skillSchema.parse({id:'qa-skill',name:'controlled',description:'fixture',kind:'single',damage:100,range:4,radius:1,cooldown:60,cost:0,windup:0,duration:1,mechanics:{damageType:'physical',targeting:'enemy',statuses:[]}});
function world(rules:EffectRule[]){const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},{hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules},[structuredClone(skill)],Array.from({length:6},(_,i)=>({id:'e'+i,name:'audit',kind:'melee',x:12+2*i,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'})),[],41);w.setMode('manual');for(const e of w.enemies)e.cooldown=100000;return w;}
const fire=(w:World,trigger:string)=>(w as any).fireEffects(trigger,w.enemies[0],100,skill);
const hit=(w:World,amount=100)=>(w as any).damage(w.enemies[0],amount,false,skill.id,{category:'direct',damageType:'physical',skill,scaled:true});
const observed:Record<string,unknown>={};
assert.equal(effectTriggers.includes('revived' as never),false);
observed.K3={result:'gap',assertion:'revived is a CombatEvent but not an EffectRule trigger; standalone last-stand also needs a dedicated interception event',missing:'N29 rescue/revive/survival events and per-battle stack lifetime'};
{
 assert.equal(effectRuleSchema.safeParse(input('H3',0,draft.H3[0])).success,false);
 const w=world([parsed('H3',1)]);w.enemies[0].elite=true;fire(w,'hit');assert.equal(w.enemies[0].hp,9600);
 observed.H3={result:'gap',assertion:'maxHpPercent buff unsupported; target-centred ref:maxHp uses elite target 10000, so 4% deals 400, not self 1000*4%=40, and exceeds the elite attack*3=300 cap',missing:'explicit HP owner and rank cap; N0b charge consumption hook; basic attack classification and run-lifetime maxHP growth'};
}
assert.equal(effectRuleSchema.safeParse(input('H4',0,draft.H4[0])).success,false);
observed.H4={result:'gap',assertion:'out_of_combat and attackSpeed buff modifier are not supported',missing:'N32 exit/re-entry detection, first-N attack charge refill and attack-rate modifier'};
{
 const w=world([parsed('H7')]);hit(w,10000);assert.equal(w.effectStats['audit-H7-0'].count,1);
 observed.H7={result:'gap',assertion:'kill condition target_hp<50% sees hp=0 after death, so it counts even a one-shot full-health target',missing:'pre-hit/pre-lethal HP semantics; persistent soul counter and consume-five operation. Do not silently treat every kill as below-half.'};
}
{
 const w=world([parsed('H10')]);hit(w);assert.equal(w.enemies[0].hp,9880);
 w.enemies[0].hp=10000;hit(w);assert.equal(w.enemies[0].hp,9900);
 observed.H10={result:'partial',assertion:'full-HP firstPerTarget damage bonus works once, even after target is healed full',firstDamage:120,repeatedDamage:100,missing:'0.5s basic attack delay (not generic stun), rare heal and actual-spend refund on one-shot'};
}
{
 const w=world([parsed('P3')]);fire(w,'hit');assert.equal(w.enemies[0].hp,9500);fire(w,'hit');assert.equal(w.enemies[0].hp,9500);
 observed.P3={result:'gap',assertion:'ICD240 works, but target-centred maxHp reference deals 500 (target HP), above attack*3 cap300; independent heal(ref:hit) is not 30% of this nova dealt damage',missing:'explicit HP owner/cap and dealt-damage-to-heal composition; target-dependent ICD modifier'};
}
{
 const w=world([parsed('P5'),parsed('P5',1)]);fire(w,'crit');assert.equal(w.selfBuffs[0].stacks,1);
 (w as any).hurt(2000,'basic-melee',{category:'direct',damageType:'pure'});assert.equal(w.hero.hp,1);
 observed.P5={result:'gap',assertion:'self_state buff only tests presence, not value=5; one rage stack already permits last-stand in this naive composition',missing:'self buff minStacks condition, consume-all rage and battle lifetime. Existing surviveAtOne is not a whole rage subsystem.'};
}
{
 assert.equal(effectRuleSchema.safeParse(input('P10',0,draft.P10[0])).success,false);
 const fragment=structuredClone(draft.P10[0]) as any;fragment.action.duration=600;
 const w=world([effectRuleSchema.parse(input('P10',0,fragment))]);for(let n=0;n<3;n++)fire(w,'kill');assert.equal((w as any).buffValue('damageMult'),.012);w.tick=600;assert.equal((w as any).buffValue('damageMult'),0);
 observed.P10={result:'partial',assertion:'ordinary kill stacking works but finite lifetime expires; no skill-only damage scope or weighted elite triple-stack under one global cap',missing:'run-lifetime stacks/weighted increments/skill-only damage'};
}
assert.equal(effectRuleSchema.safeParse(input('P12',0,draft.P12[0])).success,false);
observed.P12={result:'gap',assertion:'attackSpeed and independent buff stack lifetime are unsupported; SelfBuff stores one ends value for the stack group',missing:'per-stack expiry, attack-rate modifier and half-stack consumption'};
assert.equal(effectRuleSchema.safeParse(input('P18',0,draft.P18[0])).success,false);
observed.P18={result:'gap',assertion:'out_of_combat trigger absent; combat_time measures time since combat start, not time since last combat',missing:'N32 exit-combat/recent-hit timing; reuse internal combatAt/hurtAt only with explicit execution contract'};
{
 const w=world([parsed('P20')]);for(let n=0;n<12;n++)(w as any).comboHit(w.enemies[0],100,undefined,'physical',false,[]);
 assert.equal(w.effectStats['audit-P20-0'].count,4);assert.equal(w.projectiles.length,4);
 observed.P20={result:'gap',assertion:'nth3 fires four times in twelve hits, but static count emits only four projectiles; count does not grow after three triggers',missing:'per-rule trigger-count scaling, seeking/status/hit callbacks and rule-owned counter increment'};
}
{
 assert.equal(effectRuleSchema.safeParse(input('G2',0,draft.G2[0])).success,false);
 const w=world([parsed('G2',1)]);w.applyStatus('e0',{kind:'freeze',duration:120,strength:0,scope:'hit',cleanse:true});fire(w,'hit');
 assert.equal(w.enemies[0].hp,10000);assert.equal(w.hasStatus('e0','freeze'),false);
 observed.G2={result:'gap',assertion:'mark is not a status; a non-DOT proxy consumed by detonate deals zero, not 0.3 attack (proxy is a test only, not a design substitution)',missing:'neutral mark, attack-budget burst, HEX-owned cooldown callback and category counting'};
}
{
 const w=world([parsed('G4'),parsed('G4',1)]);fire(w,'interval');assert.equal(w.enemies[0].hp,9900);assert.equal(w.enemies[1].hp,9950);
 observed.G4={result:'gap',assertion:'two filled circles overlap: inner target takes100, outer target50; this does not implement an exclusive outer ring or directional sector',missing:'innerRadius/sector target selector and outer-only crit multiplier; double-nova approximation still needs exact geometry'};
}
{
 const w=world([parsed('G5')]);w.cooldowns[skill.id]=1000;const slots=w.skills.map(s=>s.id);fire(w,'interval');
 assert.deepEqual(w.enemies.map(e=>10000-e.hp),[0,20,24,29,0,0]);assert.equal(w.cooldowns[skill.id],1000);assert.deepEqual(w.skills.map(s=>s.id),slots);
 observed.G5={result:'partial',assertion:'interval arc uses independent timing, no new skill-bar entry, and damage grows20/24/29; however nearest initial target is excluded by arc semantics',missing:'initial projectile/target hit, each-bounce rule cooldown callback, final return shield; not yet a full gifted skill'};
}
const bindingProbe=effectRuleSchema.safeParse(input('K6',0,{trigger:'hit',filter:{skillSlot:1},action:{type:'heal',ratio:.03,ref:'maxHp'}}));
assert.equal(bindingProbe.success,false);
const extra:Record<string,string>={
 K1:'N30+N17 temporary seeded mechanism pool and shared collectible entity; no persistent third equipment slot.',
 K2:'N29 gap-reset streak/window thresholds; nth kill alone does not reset after a4s gap.',
 K4:'N28 contributor identity,5s assist window,resource-only rule dispatch and recursion boundary.',
 K5:'N17 shared pickup claims plus N29 rolling5s kill count; normal gear pickup is not a substitute.',
 K6:'N25 skillSlot filter and slot-carrying events absent; literal skill-ID filters would not follow loadout slots.',
 H1:'N23 rolling hit window and distinct-source count; global nth does not enforce3s or distinct sources.',
 H2:'N23 window plus slow-only immunity and end-of-buff forward dash.',
 H5:'N16 per-target count and cooldown, source-specific exposed vulnerability transfer.',
 H8:'N5 live companion with attack/shield selection and independent cast count.',
 P1:'N16 DOT layers partially exist; five-stack blood-rage/window and all-target expiry detonation still missing.',
 P2:'N16 per-target third hit plus rank-sensitive maxHP cap; global nth mixes targets.',
 P8:'N31 basic-attack-only immunity requires source classification; generic immunity blocks skill/environment too.',
 P9:'N17 run-lifetime stat pickup with caps and attraction, not gear inventory.',
 P14:'N24 facing-vector condition plus history of backstabbed targets; screenFacing alone is not backside angle.',
 AB1:'N25 slot-bound copyCast and side-projectile hit permissions; echo does not express every bound skill shape.',
 AB2:'N25 slot binding, inherited status and one extra kill-chain depth.',
 AB3:'N25 actual source dealt-damage conversion, rank multiplier and overflow cap.',
 AB4:'N25 bound duration lifecycle, basic-hit needle stacks and skill-end consumption.',
 G1:'N26 existing returning projectile primitives need outgoing/return damage separation and retrieval callback.',
 G3:'N5 summoned decoy, taunt and end/death explosion with controlled lifetime.',
};
assert.equal(Object.keys(observed).length,14);
const matrix=rows.map(([,id,slug,name])=>({id,slug,name:name.trim(),scope:'core acceptance only, full four-quality behavior not certified',fragments:(draft[id]??[]).map((f,i)=>{const value=input(id,i,f),p=effectRuleSchema.safeParse(value);return {input:value,schemaAccepted:p.success,issues:p.success?[]:p.error.issues.map(e=>({path:e.path.join('.'),message:e.message}))};}),probe:observed[id]??{result:'declared-new-capability',limitation:extra[id]}}));
assert.equal(matrix.filter(r=>r.fragments.length).length,14);
const report={version:'D07-1/N0c',at:new Date().toISOString(),designSHA256:createHash('sha256').update(document).digest('hex'),runtimeVersions:versions,auditOnly:true,count:34,matrix,binding:{skillSlotSupported:false,issues:bindingProbe.success?[]:bindingProbe.error.issues},remaining:'N23–N32 and shared N0b gaps; no formal catalogue, tuning, artwork or full quality release'};
const out=process.argv[2];if(!out)throw Error('Explicit evidence path required');
await writeFile(out,JSON.stringify(report,(_k,v)=>typeof v==='number'&&!Number.isFinite(v)?String(v):v,2));
console.log(JSON.stringify({count:matrix.length,probes:Object.keys(observed).length,results:Object.entries(observed).map(([id,probe])=>({id,...probe as object})),binding:report.binding}));
