/** N0b audit only: no runtime catalogue import or tuning apply.
 * Finite buff/shield durations used below are explicitly test scaffolding where D06
 * omits a duration. A parsed fragment is NOT a complete quality implementation. */
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {effectRuleSchema,effectTriggers,type EffectRule} from '../packages/contracts/effects.ts';
import {statusKindSchema,skillSchema,versions} from '../packages/contracts/index.ts';
import {conditionSchema} from '../packages/contracts/conditions.ts';
import {World} from '../packages/simulation/index.ts';
import {regionById} from '../packages/content/index.ts';
import {eliteAffixes} from '../packages/content/elite-affixes.ts';
const document=await readFile(new URL('../docs/hex-gear-20261019/d06-mayhem-inspired-mechanisms.md',import.meta.url),'utf8');
const rows=[...document.matchAll(/^\| (E-[ADCMRS]\d) \| ([a-z-]+) \| ([^|]+) \|/gm)];
assert.equal(rows.length,26);
const draft:Record<string,object[]>={
 'E-A3':[{trigger:'status_expire',action:{type:'nova',radius:2.5,ratio:.8,ref:'attack'}}],
 'E-A4':[{trigger:'interval',every:240,action:{type:'buff',duration:600,maxStacks:1,mods:{},consume:'nextHit'}},{trigger:'hit',when:[{kind:'self_state',state:'buff',id:'audit-E-A4-0'}],action:{type:'shards',count:3,range:8,ratio:.2,ref:'attack'}}],
 'E-A5':[{trigger:'cast',action:{type:'buff',duration:600,maxStacks:1,mods:{damageMult:.3},consume:'nextHit'}},{trigger:'hit',action:{type:'buff',duration:600,maxStacks:1,mods:{damageMult:.2},consume:'nextCast'}}],
 'E-D1':[{trigger:'lethal',maxTriggers:1,action:{type:'buff',duration:240,maxStacks:1,mods:{reviveRatio:.6},flags:{immortal:true,surviveAtOne:true}}}],
 'E-D3':[{trigger:'status_apply',filter:{statusKinds:['stun']},icd:60,action:{type:'shield',ratio:.05,ref:'maxHp',duration:60}}],
 'E-M3':[{trigger:'moved',every:10,action:{type:'heal',ratio:.01,ref:'maxHp'}}],
 'E-R2':[{trigger:'interval',every:360,action:{type:'cooldown',mode:'all',reset:true}}],
 'E-R3':[{trigger:'dot_tick',action:{type:'cooldown',mode:'random',ticks:6}},{trigger:'hit',icd:15,filter:{categories:['periodic'],statusKinds:['burn','poison']},action:{type:'cooldown',mode:'random',ticks:6}}],
 'E-R4':[{trigger:'nth',count:'kill',every:15,maxTriggers:1,action:{type:'buff',duration:Infinity,maxStacks:1,mods:{damageMult:.12,cooldownRecovery:.15}}}],
 'E-S1':[{trigger:'heal_received',action:{type:'nova',radius:3,ratio:.4,ref:'hit'}},{trigger:'shield_gain',action:{type:'nova',at:'self',radius:3,ratio:.5,ref:'shield'}}],
 'E-S3':[{trigger:'hit',action:{type:'status',status:'mark',duration:150}},{trigger:'basic_hit',action:{type:'nova',radius:0,ratio:.4,ref:'attack',damageType:'magic'}}],
};
function input(id:string,index:number,fragment:object){return {id:`audit-${id}-${index}`,name:id,description:'N0b controlled probe',source:'audit-only',chance:1,icd:0,filter:{},when:[],scale:[],vfxKey:'hex/audit',...fragment};}
function parsed(id:string,index=0){return effectRuleSchema.parse(input(id,index,draft[id][index]));}
const skill=skillSchema.parse({id:'qa-skill',name:'controlled spell',description:'test',kind:'single',damage:100,range:4,radius:1,cooldown:60,cost:0,windup:0,duration:1,mechanics:{damageType:'arcane',targeting:'enemy',statuses:[]}});
function world(rules:EffectRule[]){const w=new World({...regionById('meadow'),obstacles:[],safe:{x:10,y:10}},{hp:1000,attack:100,armor:0,speed:0,mana:100,regen:0,effects:[],rules},[structuredClone(skill)],[{id:'target',name:'audit',kind:'melee',x:12,y:10,hp:10000,attack:0,boss:false,elite:false,art:'raider'}],[],41);w.setMode('manual');w.enemies[0].cooldown=100000;return w;}
const observed:Record<string,unknown>={};
{
 const w=world([parsed('E-A4'),parsed('E-A4',1)]);
 (w as any).fireEffects('interval',w.enemies[0],100);assert.equal(w.selfBuffs.length,1);
 (w as any).damage(w.enemies[0],100,false,skill.id,{category:'direct',damageType:'arcane',skill,scaled:true});
 assert.equal(w.selfBuffs.length,0);assert.equal(w.projectiles.length,0);
 observed['E-A4']={result:'gap',assertion:'nextHit charge is consumed before hit rule matching; gated shards do not fire',projectiles:0,missing:'consume-to-action dispatch; no per-projectile slow or hit callback to rule ICD/HEX replication. Shards are radial, not target seeking; D06 permits visual approximation only.'};
}
{
 const w=world([parsed('E-A5')]);(w as any).fireEffects('cast',w.enemies[0],100,skill);
 const hp=w.enemies[0].hp;(w as any).damage(w.enemies[0],100,false,skill.id,{category:'direct',damageType:'arcane',skill,scaled:true});
 assert.equal(hp-w.enemies[0].hp,130);
 observed['E-A5']={result:'gap',assertion:'cast-nextHit buff also boosts the next spell skill by 30%, not exclusively a basic attack',damage:130,missing:'basic-attack vs skill classification and alternating sequence counter; existing cast/hit are not disjoint events'};
}
{
 const w=world([parsed('E-D1')]);(w as any).hurt(2000,'basic-melee',{category:'direct',damageType:'pure'});assert.equal(w.hero.hp,600);
 w.applyStatus('hero',{kind:'attack_up',duration:240,interval:30,hpDrainRatio:.08,strength:0,scope:'self',cleanse:false},'hero','audit-drain');
 for(let tick=30;tick<=240;tick+=30){w.tick=tick;(w as any).advanceStatuses();}
 assert.equal(w.hero.hp,1);
 observed['E-D1']={result:'gap',assertion:'real guardian revival reaches 60%; existing hpDrainRatio stops at 1, so failure cannot kill',hpAfterEightDrains:1,missing:'8s kill-goal latch, success cancellation/heal and fatal failure branch; no backpack cost introduced'};
}
{
 const w=world([parsed('E-D3')]);w.applyStatus('target',{kind:'stun',duration:30,strength:0,scope:'hit',cleanse:true});
 assert.equal(w.hero.shield,50);assert.equal(w.effectStats['audit-E-D3-0'].count,1);
 w.applyStatus('target',{kind:'stun',duration:30,strength:0,scope:'hit',cleanse:true});assert.equal(w.effectStats['audit-E-D3-0'].count,1);
 observed['E-D3']={result:'partial',assertion:'actual successful stun application grants 50 shield and respects 60t ICD',shield:50,missing:'formal shield duration/control-kind set; distinct-target per-battle counter and full-stack knockback'};
}
{
 const w=world([parsed('E-M3')]);w.hero.hp=500;w.effectMoved=10;w.effectsStarted=true;w.tick=1;(w as any).stepEffects();
 assert.equal(w.hero.hp,510);assert.equal(w.effectStats['audit-E-M3-0'].count,1);
 observed['E-M3']={result:'core-pass',assertion:'10 accumulated movement units heal 1% maxHp once',hp:510,missing:'rare recent-hurt 3s condition is absent; legendary overflowShield primitive exists but its cap must be declared'};
}
{
 const w=world([parsed('E-R2')]);w.effectsStarted=true;w.conditionClock.start=0;w.tick=360;w.cooldowns[skill.id]=1000;(w as any).stepEffects();
 assert.equal(w.cooldowns[skill.id],360);assert.equal(w.effectStats['audit-E-R2-0'].count,1);
 observed['E-R2']={result:'core-pass',assertion:'12s interval resets current remaining cooldown to zero',remaining:0,missing:'higher qualities need independent mana/buff assertions; not yet published'};
}
{
 assert.equal(effectTriggers.includes('dot_tick' as never),false);
 const w=world([parsed('E-R3',1)]);w.cooldowns[skill.id]=1000;
 w.applyStatus('target',{kind:'burn',duration:90,interval:30,total:90,damageType:'fire',strength:0,scope:'hit',cleanse:true});
 w.tick=30;(w as any).advanceStatuses();assert.equal(w.enemies[0].hp,9970);assert.equal(w.cooldowns[skill.id],1000);
 observed['E-R3']={result:'gap',assertion:'real burn tick damages target but does not dispatch hit-filtered cooldown reduction',dotDamage:30,cooldownUnchanged:true,missing:'N19 dot_tick; periodic skill-zone hits differ from status DOT ticks. Existing effectCooldown rounds 7.5/10.5 ticks to 8/11; retain that existing convention rather than invent a new rounding rule.'};
}
{
 assert.equal(effectRuleSchema.safeParse(input('E-R4',0,draft['E-R4'][0])).success,false);
 const candidate=structuredClone(draft['E-R4'][0]) as any;candidate.action.duration=600;
 const w=world([effectRuleSchema.parse(input('E-R4',0,candidate))]);for(let i=0;i<15;i++)(w as any).fireEffects('kill',w.enemies[0],100,skill,[],0,true);
 assert.equal((w as any).buffValue('damageMult'),.12);w.tick=600;assert.equal((w as any).buffValue('damageMult'),0);
 observed['E-R4']={result:'partial',assertion:'15 kills can trigger once, but finite buff expires; Infinity is schema-invalid',missing:'until-battle-end lifetime; second-stage +20 kills sequence and skill-only damage scope'};
}
{
 assert.equal(effectTriggers.includes('heal_received' as never),false);
 const w=world([]);w.hero.shield=100;w.hero.shieldUntil=1000;(w as any).observeShield();w.stats.rules=[parsed('E-S1',1)];w.hero.shield=150;(w as any).observeShield();
 assert.equal(w.enemies[0].hp,9925);
 observed['E-S1']={result:'gap',assertion:'shield_gain exists but its shield reference is total 150, not net gain 50; 50% nova deals 75 rather than 25',damage:75,missing:'heal_received event with actual healed/overflow amount; explicit gained/absorbed shield deltas'};
}
assert.equal(effectTriggers.includes('status_expire' as never),false);
observed['E-A3']={result:'gap',assertion:'status_expire absent from trigger schema; neither timed bomb attachment nor target-death early detonation is supplied',missing:'N11 target-bound delayed action, death callback, propagation depth; knockup maps only after N4 semantics'};
assert.equal(statusKindSchema.safeParse('mark').success,false);
assert.equal(effectTriggers.includes('basic_hit' as never),false);
observed['E-S3']={result:'gap',assertion:'neutral mark status and basic_hit classification are absent; N7e only identifies an already-declared applied kind',missing:'neutral timed stack/consume mark and basic-vs-skill classification; explicit elemental damage type instead of unsupported magic'};
const extra:Record<string,string>={
 'E-A1':'N9 partial reuse: field.orbit exists, but fixed speed .14 rad/tick, per-projectile hit cooldown, finite duration, no status/projectile-return hook.',
 'E-A2':'N10 target ranking/maxHP boss cap/delayed retarget absent; zone_end alone has no original bound target guarantee.',
 'E-D2':'N1 away blink exists; multi-action lethal ordering with heal, cleanse and decoy still needs D05/N3/N5.',
 'E-D4':'N12 runtime maxHP/bodyScale buff not supported; visual scale alone cannot satisfy collisions.',
 'E-D5':'N13 crowd condition already exists; reuse it, but per-enemy scaling reduce/retaliation and N4 still required.',
 'E-C1':'N14 no beam action; interval nova does not provide continuous target lock/line piercing/reset.',
 'E-C2':'N4 knockback missing; multiple one-shot threshold rules need exact crossing vs level-trigger semantics.',
 'E-C3':'N15 target identity selection/lifetime and authoritative bonus reward callback absent; never infer loot from client event.',
 'E-C4':'N16 independent armor_down stacks exist; no corresponding resistance-down semantics or neutral stack carrier.',
 'E-M1':'N1 only away_from_enemies exists; toward-group direction and boss phase trigger absent.',
 'E-M2':'N1 forward direction absent; 5s kill-window failure/success consequence and controlled immunity expiry callback absent.',
 'E-M4':'N17 effect-owned pickups, proximity claim and 10s expiry are not gear reward pickups.',
 'E-R1':'N18 manaCostMult unsupported; actual spend reference/cost increase and overflow conversion require explicit execution.',
 'E-S2':'N21 inspect real elite-affixes.json (not guessed names in monsters.json); selector/random lifetime and mapping unresolved.',
 'E-S4':'N22 buff alternate is deterministic rotation, not seed-derived weighted sampling without replacement.',
};
// Verify all four explicitly declared base gradients without claiming missing quality extras.
const qualityCoreProbes:unknown[]=[];
for(const [i,quality] of ['common','magic','rare','legendary'].entries()){
 const movement=effectRuleSchema.parse({...parsed('E-M3'),every:[10,9,8,7][i]}),m=world([movement]);
 m.hero.hp=500;m.effectMoved=movement.every!;m.effectsStarted=true;m.tick=1;(m as any).stepEffects();
 assert.equal(m.hero.hp,510);
 const shield=effectRuleSchema.parse({...parsed('E-D3'),action:{...parsed('E-D3').action,ratio:[.05,.06,.07,.08][i]}}),d=world([shield]);
 d.applyStatus('target',{kind:'stun',duration:30,strength:0,scope:'hit',cleanse:true});assert.equal(d.hero.shield,[50,60,70,80][i]);
 const reset=effectRuleSchema.parse({...parsed('E-R2'),every:[360,330,300,270][i]}),r=world([reset]);
 r.effectsStarted=true;r.tick=reset.every!;r.cooldowns[skill.id]=1000;(r as any).stepEffects();assert.equal(r.cooldowns[skill.id],r.tick);
 qualityCoreProbes.push({quality,movement:{distance:movement.every,hp:m.hero.hp},controlShield:{amount:d.hero.shield,duration:'60t test-only; design duration still needed'},reset:{interval:reset.every,remaining:0},scope:'base gradients only, rare/legendary additional behaviors NOT certified'});
}
assert.equal(conditionSchema.safeParse({kind:'crowd',radius:4,op:'gte',value:5}).success,true);
const matrix=rows.map(([,id,slug,name])=>({id,slug,name:name.trim(),scope:'common core fragments only; four-quality acceptance NOT complete',fragments:(draft[id]??[]).map((fragment,index)=>{const value=input(id,index,fragment),parsed=effectRuleSchema.safeParse(value);return {input:value,schemaAccepted:parsed.success,issues:parsed.success?[]:parsed.error.issues.map(i=>({path:i.path.join('.'),message:i.message}))};}),probe:observed[id]??{result:'declared-new-capability',limitation:extra[id]}}));
assert.equal(matrix.filter(row=>row.fragments.length>0).length,11);assert.equal(Object.keys(observed).length,11);
const report={version:'D06-1/N0b',at:new Date().toISOString(),designSHA256:createHash('sha256').update(document).digest('hex'),runtimeVersions:versions,auditOnly:true,scaffolding:'chance=1/icd=0 metadata defaults; omitted buff/shield durations use finite test fixtures; no tuned values or content publication',count:matrix.length,matrix,qualityCoreProbes,affixes:Object.entries(eliteAffixes).map(([id,data])=>({id,name:data.name})),remaining:'Full quality definitions, missing abilities, risk success/failure branches, TTK, formal source, art and GUI are not complete.'};
const out=process.argv[2];if(!out)throw Error('Explicit report path required');await writeFile(out,JSON.stringify(report,(_key,value)=>typeof value==='number'&&!Number.isFinite(value)?String(value):value,2));
console.log(JSON.stringify({count:matrix.length,checkedCoreMechanisms:Object.keys(observed).length,results:matrix.map(({id,probe})=>({id,...probe as object})),affixes:report.affixes}));
