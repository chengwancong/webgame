import {strict as assert} from 'node:assert';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {World,type CombatEvent} from '../packages/simulation/index.ts';
import {skillCatalog,type Region} from '../packages/content/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {versions,statusEffectSchema,type CharacterState,type Spawn} from '../packages/contracts/index.ts';
import {sourceVersion} from './source-version.mjs';
const output='docs/skill-repair-20261003',seed=41;
await mkdir(output,{recursive:true});
const fingerprints=async()=>Object.fromEntries(await Promise.all(['packages/content/skills-expanded.ts','packages/content/index.ts','packages/simulation/index.ts','packages/rules/index.ts','packages/rules/deep-progression.ts','packages/content/chapter-combat.ts','packages/contracts/index.ts','packages/contracts/skill-mechanics.ts','packages/simulation/skill-runtime.ts'].map(async path=>[path,createHash('sha256').update(await readFile(path)).digest('hex')])));
const before=await fingerprints(),sourceBefore=await sourceVersion();
const region:Region={id:'skill-budget-controlled',theme:'meadow',name:'受控数值场',subtitle:'',width:80,height:60,safe:{x:10,y:10},portal:{x:4,y:4},obstacles:[],spawns:[],landmarks:[],boss:false,auto:false};
const enemy=(id='target',x=12,y=10):Spawn=>({id,x,y,name:id,hp:100000,attack:0,kind:'ranged',elite:false,boss:false,art:'raider'});
const rows=[];
for(const definition of skillCatalog){
 const s:CharacterState={id:'controlled_'+definition.id,name:'受控授予',level:20,revision:1,build:1,xp:0,gold:100000,material:0,gear:[],equipment:{},skills:[definition.id],skillRanks:{[definition.id]:1},skillBooks:{},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};
 const built=resolveBuild(s);assert.deepEqual(built.resolvedSkills.map(sk=>sk.id),s.skills,'Requested build mismatch');
 const skill=built.resolvedSkills[0],spawns=skill.mechanics!.targeting==='direction'?[]:[enemy()],stats={...built.stats,regen:0},w=new World(region,stats,built.resolvedSkills,spawns,[],seed);w.setMode('manual');w.enemies.forEach(e=>e.cooldown=100000);w.hero.hp=Math.floor(stats.hp*.5);
 if(skill.mechanics!.cleanse)w.applyStatus('hero',statusEffectSchema.parse({kind:'slow',duration:90,strength:.3,scope:'hit',cleanse:true}),'target','controlled-debuff');
 if(skill.mechanics!.restoreMana)w.hero.mana=stats.mana*.7;
 const start={hp:w.hero.hp,mana:w.hero.mana,position:{...w.hero.position}},point=skill.mechanics!.targeting==='direction'?{x:16,y:10}:skill.mechanics!.targeting==='ground'?{x:12,y:10}:undefined;
 assert(w.cast(skill.id,w.enemies[0],point),skill.id+': '+w.lastCastFailure);const cooldown=w.cooldowns[skill.id];assert(!w.cast(skill.id,w.enemies[0],point),'duplicate cast was accepted');
 const events:CombatEvent[]=[];for(let tick=0;tick<2;tick++){w.step();events.push(...w.events);}const restored=World.restore(JSON.parse(JSON.stringify(w.exportCheckpoint())));for(let tick=0;tick<900;tick++){w.step();restored.step();events.push(...w.events);}
 assert(isDeepStrictEqual(w.exportCheckpoint(),restored.exportCheckpoint()),skill.id+' checkpoint diverged');
 const damage=events.filter(e=>e.type==='hit_resolved'&&e.id==='target'),heals=events.filter(e=>e.type==='healed'),mana=events.filter(e=>e.type==='resource_restored'),stateEvents=events.filter(e=>e.type==='status_changed');
 assert(events.some(e=>e.type==='cast_released'&&e.skill===skill.id),skill.id+' failed to release');
 assert(damage.length||heals.length||stateEvents.length||events.some(e=>e.type==='shielded')||w.hero.position.x!==start.position.x,skill.id+' produced no capability');
 const boundary=new World(region,stats,built.resolvedSkills,spawns,[],seed);boundary.setMode('manual');boundary.hero.hp=0;assert(!boundary.cast(skill.id,boundary.enemies[0],point));
 boundary.hero.hp=stats.hp;if(skill.cost){boundary.hero.mana=0;assert(!boundary.cast(skill.id,boundary.enemies[0],point));assert.equal(boundary.hero.mana,0);}boundary.hero.mana=stats.mana;boundary.cooldowns[skill.id]=100;assert(!boundary.cast(skill.id,boundary.enemies[0],point));
 const nextState=structuredClone(s);nextState.skillRanks[skill.id]=2;const next=resolveBuild(nextState).resolvedSkills[0];
 rows.push({id:skill.id,name:skill.name,requested:s.skills,executed:built.resolvedSkills.map(sk=>sk.id),mode:'controlled-grant',rank:1,current:skill,next,success:true,restoreEqual:true,castCount:events.filter(e=>e.type==='cast_started').length,releaseCount:events.filter(e=>e.type==='cast_released').length,hitCount:damage.length,direct:damage.filter(e=>e.category==='direct').reduce((n,e)=>n+(e.amount??0),0),dot:damage.filter(e=>e.category==='periodic').reduce((n,e)=>n+(e.amount??0),0),healing:heals.reduce((n,e)=>n+(e.amount??0),0),manaRestored:mana.reduce((n,e)=>n+(e.amount??0),0),shield:events.filter(e=>e.type==='shielded').reduce((n,e)=>n+(e.amount??0),0),costOnce:start.mana-w.hero.mana+mana.reduce((n,e)=>n+(e.amount??0),0),cooldownTicks:cooldown,statusKinds:[...new Set(stateEvents.map(e=>e.status))],end:{hp:w.hero.hp,mana:w.hero.mana,position:w.hero.position},boundaries:['dead','cooldown',...(skill.cost?['resource']:[])],events});
}
const after=await fingerprints(),sourceAfter=await sourceVersion();assert.deepEqual(after,before);assert.equal(sourceAfter.sha256,sourceBefore.sha256);
const report={ok:true,versions,at:new Date().toISOString(),sourceBefore,sourceAfter,fingerprints:{before,after},seed,tickRate:30,ticks:902,samples:rows.length,mode:'controlled-grant, one cast, no mana regeneration, no equipment, level 20',limitations:['受控授予与自然获取分开；此场只验证能力和预算，不代替实机及联网验收。','没有重做经济、武器盘或怪物曲线。','单目标扇形会有合法落空；每跳预算与单次总量分别登记。'],skills:rows};
await writeFile(output+'/current-source-matrix.json',JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,versions,skills:rows.length,output:output+'/current-source-matrix.json'}));
