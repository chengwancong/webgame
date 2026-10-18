import assert from 'node:assert/strict';
import {World} from '../packages/simulation/index.ts';
import {statsSchema,skillSchema,versions,type Stats,type Skill,type Spawn,type Mode,type Vec} from '../packages/contracts/index.ts';
import {permitsWeapon} from '../packages/contracts/weapons.ts';
import {skillWeapons} from '../packages/content/skill-weapons.ts';
import type {Region} from '../packages/content/index.ts';
import {resolveMonsterContent,type MonsterContent} from '../packages/content/monsters.ts';
export type BuildBenchmarkInput={instrument?:{created?:(world:World)=>void;beforeStep?:(world:World)=>void;afterStep?:(world:World)=>void};requestedSkills:string[];skillRanks:Record<string,number>;build:{stats:Stats;skills:Skill[]};region:Region;spawns:Spawn[];seed:number;maxTicks:number;mode:Mode;stopWhen:'clear'|'death'|'window';goal?:'all_targets'|'final_boss';approachTargets?:boolean;monsterCatalogue?:MonsterContent;initialHpRatio?:number;pressure?:{startTick:number;interval:number;multiplier:number};route?:{everyTicks:number;points:Vec[]}};
/** Consume the server-resolved build and declared encounter as supplied. No
 * synthetic healing, mana refill, silent weapon bypass or target reset. */
export function sampleCombatBuild(input:BuildBenchmarkInput){
 assert(input.requestedSkills.length>0,'Empty requested build');assert(new Set(input.requestedSkills).size===input.requestedSkills.length,'Duplicate requested skills');
 assert(Number.isSafeInteger(input.seed),'Seed must be an integer');assert(Number.isSafeInteger(input.maxTicks)&&input.maxTicks>0,'A declared positive combat budget is required');assert(input.spawns.length>0,'Encounter has no targets');
 if(input.goal==='final_boss')assert(input.spawns.some(s=>s.boss),'Final boss goal requires an actual boss');
 const stats=statsSchema.parse(structuredClone(input.build.stats)),skills=input.build.skills.map(s=>skillSchema.parse(structuredClone(s)));
 assert.deepEqual(skills.map(s=>s.id),input.requestedSkills,'Requested and executed skill lists differ');assert(stats.weapon!==undefined,'Resolved main-hand weapon must be explicit');
 for(const [index,s]of skills.entries()){assert(s.id in skillWeapons,'Unregistered requested skill: '+s.id);assert(Number.isInteger(input.skillRanks[s.id])&&input.skillRanks[s.id]>=1&&input.skillRanks[s.id]<=5,'Skill is not explicitly activated: '+s.id);assert(Array.isArray(input.build.skills[index].weapons),'Skill weapon allowance must be server resolved: '+s.id);assert(permitsWeapon(s.weapons??[],stats.weapon??null),'Incompatible resolved weapon: '+s.id);}
 if(input.initialHpRatio!==undefined)assert(input.initialHpRatio>0&&input.initialHpRatio<=1,'Invalid initial target HP ratio');
 if(input.pressure)assert(Number.isInteger(input.pressure.startTick)&&input.pressure.startTick>=0&&Number.isInteger(input.pressure.interval)&&input.pressure.interval>0&&input.pressure.multiplier>1&&Number.isFinite(input.pressure.multiplier),'Invalid common pressure schedule');
 const w=new World(structuredClone(input.region),stats,skills,structuredClone(input.spawns),[],input.seed);w.setMode(input.mode);
 if(input.monsterCatalogue)w.rules.monsters=resolveMonsterContent(structuredClone(input.monsterCatalogue));
 if(input.initialHpRatio!==undefined)for(const enemy of w.enemies)enemy.hp=enemy.maxHp*input.initialHpRatio;
 input.instrument?.created?.(w);
 const initialTargets=w.enemies.map(e=>({id:e.id,hp:e.hp,maxHp:e.maxHp,attack:e.attack})),pressureChanges:{tick:number;factor:number}[]=[];let pressureExponent=0;
 const casts:Record<string,number>=Object.fromEntries(skills.map(s=>[s.id,0])),failures:Record<string,number>={},damage={direct:0,periodic:0,derived:0},damageBySkill:Record<string,{direct:number;periodic:number;derived:number;hits:number}>={};
 let incomingDamage=0,incomingHits=0,kills=0,firstCast:number|null=null,clearTick:number|null=null,deathTick:number|null=null;
 for(let i=0;i<input.maxTicks;i++){
  if(input.route&&i%input.route.everyTicks===0)w.go(input.route.points[Math.floor(i/input.route.everyTicks)%input.route.points.length]);
  if(input.approachTargets&&i%30===0&&w.hero.hp>0){
   const target=w.closest();
   if(target){const distance=Math.hypot(target.position.x-w.hero.position.x,target.position.y-w.hero.position.y);
    if(distance>8&&!w.movementIntent().destination)w.go({...target.position});
    else if(distance<=8&&w.mode!=='auto')w.setMode('auto');
   }
  }
  if(input.pressure&&w.tick>=input.pressure.startTick){const exponent=1+Math.floor((w.tick-input.pressure.startTick)/input.pressure.interval);if(exponent!==pressureExponent){pressureExponent=exponent;const factor=input.pressure.multiplier**exponent;for(const enemy of w.enemies)enemy.attack=initialTargets.find(t=>t.id===enemy.id)!.attack*factor;pressureChanges.push({tick:w.tick,factor});}}
  input.instrument?.beforeStep?.(w);w.step();input.instrument?.afterStep?.(w);const enemyIds=new Set(w.enemies.map(e=>e.id));
  for(const e of w.events){if(e.type==='cast_started'&&e.id===w.playerId&&e.skill&&e.skill in casts){casts[e.skill]++;firstCast??=e.tick;}
   if(e.type==='cast_failed'&&e.id===w.playerId&&e.reason)failures[e.reason]=(failures[e.reason]??0)+1;
   if(e.type==='hit_resolved'&&e.amount!==undefined){if(enemyIds.has(e.id)&&e.category){damage[e.category]+=e.amount;const source=e.skill??'basic',row=damageBySkill[source]??={direct:0,periodic:0,derived:0,hits:0};row[e.category]+=e.amount;row.hits++;}else if(e.id===w.playerId){incomingDamage+=e.amount;incomingHits++;}}
   if(e.type==='entity_died'&&enemyIds.has(e.id))kills++;
  }
  const targets=input.goal==='final_boss'?w.enemies.filter(e=>e.boss&&e.reward):w.enemies;
  if(clearTick===null&&targets.length>0&&targets.every(e=>!e.alive))clearTick=w.tick;if(deathTick===null&&w.hero.hp<=0)deathTick=w.tick;
  if(deathTick!==null||input.stopWhen==='clear'&&clearTick!==null)break;
 }
 const totalDamage=damage.direct+damage.periodic+damage.derived,elapsed=w.tick/30,used=Object.values(casts).reduce((n,v)=>n+v,0),failed=used===0?'no_cast':totalDamage===0?'no_damage':input.stopWhen==='clear'&&clearTick===null?'not_cleared':input.stopWhen==='window'&&clearTick!==null?'window_target_exhausted':null;
 return {initialTargets,approachTargets:input.approachTargets??false,pressure:input.pressure??null,route:input.route??null,pressureChanges,versions,seed:input.seed,budgetTicks:input.maxTicks,mode:input.mode,stopWhen:input.stopWhen,goal:input.goal??'all_targets',requested:input.requestedSkills,executed:w.skills.map(s=>s.id),skillRanks:structuredClone(input.skillRanks),build:{stats,skills},targetParams:structuredClone(input.spawns),casts,failures,firstCast,kills,damage,damageBySkill,totalDamage,dps:elapsed>0?totalDamage/elapsed:0,incomingDamage,incomingHits,elapsed,clearSeconds:clearTick===null?null:clearTick/30,deathSeconds:deathTick===null?null:deathTick/30,survivalCensored:deathTick===null,failed,remaining:w.enemies.filter(e=>e.alive).map(e=>({id:e.id,hp:e.hp})),hero:{hp:w.hero.hp,mana:w.hero.mana},rules:structuredClone(w.effectStats)};
}
