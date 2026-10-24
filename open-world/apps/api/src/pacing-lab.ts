import type {FastifyInstance} from 'fastify';
import type {Pool} from 'pg';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {z} from 'zod';
import assert from 'node:assert/strict';
import {World} from '../../../packages/simulation/index.ts';
import {resolveBuild,xpThreshold} from '../../../packages/rules/index.ts';
import {resolveMonsterSpawn} from '../../../packages/rules/monster-stats.ts';
import {activeNewAspects} from '../../../packages/rules/aspect-sources.ts';
import {getEquippedSets} from '../../../packages/simulation/set-calculator.ts';
import {versions,skillSchema,type CharacterState,type Spawn} from '../../../packages/contracts/index.ts';
import {permitsWeapon} from '../../../packages/contracts/weapons.ts';
import {pacingOverrideSchema,type PacingOverride,type PacingScene} from '../../../packages/contracts/pacing.ts';
import {pacingLabStartSchema,pacingLabViewSchema,pacingLabSuggestionSchema,type PacingLabTrial,type PacingLabView} from '../../../packages/contracts/pacing-lab.ts';
import {pacingSettings,pacingBuildTargets} from '../../../packages/content/pacing-targets.ts';
import lab from '../../../packages/content/pacing-lab.json';
import type {Region} from '../../../packages/content/index.ts';
import {starseaKillReward} from './economy.ts';
type Who={account:string;session:string};
type Context={pool:Pool;identity:(req:any)=>Promise<Who>;state:(pool:Pool,who:Who)=>Promise<CharacterState>;fail:(code:string,message:string,status?:number)=>never};
export type PacingLabOptions={isolated:true;tickMs?:number;ticksPerStep?:number;reportPath?:string};
type Running={world:World;spawns:Spawn[];result:PacingLabTrial;began:number;level:number;hardmode:boolean};
type Session={overrides:PacingOverride;active?:Running;history:PacingLabTrial[];touched:number};
/** Ephemeral simulations have no permit and no reward/character write owner.
 * This module intentionally receives no write, award, receipt or transaction. */
export function registerPacingLab(app:FastifyInstance,ctx:Context,options:PacingLabOptions){
 assert(options.isolated===true,'Pacing lab requires an explicit isolated environment');
 const sessions=new Map<string,Session>(),allowed=new Set(z.string().array().parse(pacingSettings.get('whitelist'))),tickMs=options.tickMs??100,ticksPerStep=options.ticksPerStep??3;
 assert(tickMs>=1&&ticksPerStep>=1&&ticksPerStep<=30,'Invalid trial scheduler');
 let reference:any=null;if(options.reportPath)void readFile(options.reportPath,'utf8').then(s=>{const v=JSON.parse(s);if(v.versions.rules===versions.rules){reference=v;void readFile(resolve(dirname(options.reportPath!),'combat/bd-measurements.json'),'utf8').then(s=>{const combat=JSON.parse(s);if(combat.versions.rules===versions.rules)reference.medians=combat.medians;}).catch(()=>{});}}).catch(()=>{});
 const authorize=async(req:any)=>{const who=await ctx.identity(req),name=(await ctx.pool.query('SELECT username FROM ow_accounts WHERE id=$1',[who.account])).rows[0]?.username;if(!allowed.has(name))ctx.fail('PACING_ACCESS','此处未开放试玩。',403);const state=await ctx.state(ctx.pool,who);let session=sessions.get(who.session);if(!session){session={overrides:{monsterHp:1,monsterAttack:1},history:[],touched:Date.now()};sessions.set(who.session,session);}session.touched=Date.now();return {who,state,session};};
 const finish=(session:Session,status:PacingLabTrial['status'])=>{const run=session.active;if(!run||run.result.status!=='running')return;run.result.status=status;session.history=[structuredClone(run.result),...session.history].slice(0,10);};
 const timer=setInterval(()=>{for(const [id,session] of sessions){if(Date.now()-session.touched>15*60*1000){sessions.delete(id);continue;}const run=session.active;if(!run||run.result.status!=='running')continue;
  for(let n=0;n<ticksPerStep&&run.result.status==='running';n++){
   const w=run.world;if(run.result.scene==='safety'&&w.tick%240===0){const points=[{x:18,y:18},{x:23,y:18},{x:23,y:23},{x:18,y:23}];w.go(points[Math.floor(w.tick/240)%4]);}
   if(run.result.scene==='survival'&&w.tick>=240){const factor=2**(1+Math.floor((w.tick-240)/30));w.enemies.forEach(e=>{e.attack=run.spawns.find(s=>s.id===e.id)!.attack*factor;});}
   w.step();for(const e of w.events){if(e.type==='cast_started'&&e.id===w.playerId&&e.skill)run.result.casts[e.skill]=(run.result.casts[e.skill]??0)+1;if(e.type==='cast_failed'&&e.id===w.playerId&&e.reason)run.result.failures[e.reason]=(run.result.failures[e.reason]??0)+1;if(e.type==='hit_resolved'&&e.id===w.playerId)run.result.incomingHits++;else if(e.type==='hit_resolved'&&w.enemies.some(a=>a.id===e.id))run.result.damage+=e.amount??0;}
   run.result.tick=w.tick;run.result.elapsedSeconds=w.tick/30;run.result.wallSeconds=(performance.now()-run.began)/1000;run.result.kills=w.kills.length;run.result.targetHp=w.enemies.reduce((sum,e)=>sum+e.hp,0);
   run.result.expectedXp=w.kills.reduce((sum,k)=>{const spawn=run.spawns.find(s=>s.id===k.source_id)!;return sum+starseaKillReward(spawn.monster!.level,spawn.monster!.rank,run.level,lab.rewardRegion,run.hardmode).xp;},0);
   const seconds=Math.max(1/30,run.result.elapsedSeconds);run.result.killsPerMinute=run.result.kills*60/seconds;run.result.xpPerHour=run.result.expectedXp*3600/seconds;
   if(!w.enemies.some(e=>e.alive)){run.result.clearSeconds=run.result.elapsedSeconds;finish(session,'won');}else if(w.hero.hp<=0)finish(session,'lost');else if(w.tick>=lab.maxTicks)finish(session,'timeout');
  }
 }},tickMs);timer.unref();app.addHook('onClose',async()=>{clearInterval(timer);sessions.clear();});
 const view=(state:CharacterState,session:Session):PacingLabView=>{
  const active=activeNewAspects(state),sets=getEquippedSets(state.gear.filter(g=>Object.values(state.equipment).includes(g.id))),matched=pacingBuildTargets.find(row=>active.some(a=>a.definition.id===row.profile!.aspect)&&sets.some(s=>s.setId===row.profile!.four&&s.count>=4));
  const trial=session.active?structuredClone(session.active.result):null;if(trial&&state.level<50&&trial.xpPerHour>0)trial.nextLevelSeconds=Math.max(0,xpThreshold(state.level)-state.xp)/trial.xpPerHour*3600;
  return pacingLabViewSchema.parse({enabled:true,characterId:state.id,level:state.level,paragonNodes:state.progression?.paragon.length??0,currentRevision:state.revision,currentSkills:state.skills,currentRanks:state.skillRanks,versions,overrides:session.overrides,trial,history:session.history,detectedName:matched?((lab.displayNames as Record<string,string>)[matched.id]??matched.name):null,referenceNote:'历史参考样本：Lv 50；已撤销局内强化，旧测量不代表当前构筑',hints:matched?Object.entries(lab.scenes).map(([scene,item])=>({scene,name:item.name,targetRatio:matched[scene as PacingScene],measuredRatio:reference?.matrix.find((r:any)=>r.bd===matched.id)?.ratios[scene]??null})):[]});
 };
 app.get('/api/pacing/view',async req=>{const {state,session}=await authorize(req);return view(state,session);});
 app.post('/api/pacing/overrides',async req=>{const {state,session}=await authorize(req);session.overrides=pacingOverrideSchema.parse(req.body);return view(state,session);});
 app.post('/api/pacing/start',async req=>{
  const {state,session}=await authorize(req),input=pacingLabStartSchema.parse(req.body);if(session.active?.result.status==='running')ctx.fail('PACING_RUNNING','这一场还在进行。');if(state.dungeon?.instance)ctx.fail('PACING_LOCATION','先返回港口再试玩。');if(input.revision!==state.revision)ctx.fail('REVISION','技能和装备已变更。');
  const copy=structuredClone(state),resolved=resolveBuild(copy);if(JSON.stringify(input.requestedSkills)!==JSON.stringify(state.skills)||JSON.stringify(resolved.resolvedSkills.map(s=>s.id))!==JSON.stringify(input.requestedSkills)||input.requestedSkills.some(id=>input.skillRanks[id]!==state.skillRanks[id]))ctx.fail('PACING_BUILD','技能列表已变更，请重新读取。');
  if(resolved.resolvedSkills.some(s=>!Array.isArray(s.weapons)||!permitsWeapon(s.weapons,resolved.stats.weapon??null)))ctx.fail('PACING_BUILD','主手武器不支持所选技能。');
  const scene=lab.scenes[input.scene],overrides=structuredClone(session.overrides),spawns=Array.from({length:scene.count},(_,i)=>resolveMonsterSpawn({id:'trial-'+i,template:lab.template,level:lab.level,rank:scene.rank as 'normal'|'elite'|'boss',x:22+i%4*.8,y:19+Math.floor(i/4)*.8},undefined,{hp:scene.hp*overrides.monsterHp,attack:scene.attack*overrides.monsterAttack,armor:1})),world=new World(structuredClone(lab.region) as Region,resolved.stats,resolved.resolvedSkills,spawns,[],lab.seed);world.setMode('auto');
  const result:PacingLabTrial={id:randomUUID(),scene:input.scene,status:'running',versions,seed:lab.seed,tick:0,elapsedSeconds:0,wallSeconds:0,kills:0,targets:spawns.length,targetHp:spawns.reduce((n,s)=>n+s.hp,0),initialHp:spawns.reduce((n,s)=>n+s.hp,0),clearSeconds:null,damage:0,incomingHits:0,casts:Object.fromEntries(input.requestedSkills.map(id=>[id,0])),failures:{},expectedXp:0,killsPerMinute:0,xpPerHour:0,nextLevelSeconds:null,targetSeconds:null,frozen:{characterId:state.id,revision:state.revision,overrides,requestedSkills:input.requestedSkills,executedSkills:resolved.resolvedSkills.map(s=>s.id),skillRanks:Object.fromEntries(input.requestedSkills.map(id=>[id,state.skillRanks[id]])),stats:structuredClone(resolved.stats),skills:resolved.resolvedSkills.map(s=>skillSchema.parse(structuredClone(s)))}};
  const active=activeNewAspects(state),sets=getEquippedSets(state.gear.filter(g=>Object.values(state.equipment).includes(g.id))),matched=pacingBuildTargets.find(row=>active.some(a=>a.definition.id===row.profile!.aspect)&&sets.some(s=>s.setId===row.profile!.four&&s.count>=4));if(['single','clear','elite'].includes(input.scene)&&matched&&reference?.medians?.[input.scene])result.targetSeconds=1/(reference.medians[input.scene]*matched[input.scene])*overrides.monsterHp;
  session.active={world,spawns,result,began:performance.now(),level:state.level,hardmode:Boolean(state.starsea?.hardmode)};return view(state,session);
 });
 app.post('/api/pacing/stop',async req=>{const {state,session}=await authorize(req);finish(session,'stopped');return view(state,session);});
 app.post('/api/pacing/export',async req=>{const {state,session}=await authorize(req),trial=session.active?.result??null;return pacingLabSuggestionSchema.parse({kind:'pacing-target-suggestion',requiresConfirmation:true,notApplied:true,requiresTargetSelection:true,targetSource:'config/excel/节奏目标.xlsx',versions,characterId:state.id,overrides:trial?.frozen.overrides??session.overrides,pendingOverrides:session.overrides,trial,history:session.history,candidate:{sheet:'升级段里程碑',field:'bossKillSeconds',value:trial?.clearSeconds??null,targetId:null,scene:trial?.scene??null,level:lab.level}});});
}
