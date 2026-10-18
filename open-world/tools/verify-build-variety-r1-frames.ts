import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {resolveBuild,makeGearByBase,ensureProgression} from '../packages/rules/index.ts';
import {World} from '../packages/simulation/index.ts';
import {skillCatalog,type Region} from '../packages/content/index.ts';
import {statRegistry} from '../packages/contracts/stats.ts';
import {talentDefinitions,paragonDefinitions} from '../packages/content/deep-progression.ts';
import {versions,statusEffectSchema,type CharacterState,type Stats} from '../packages/contracts/index.ts';

const referenceRoot=process.cwd()+'/.qa/r1-rs-reference';
const referenceRules=await import(pathToFileURL(referenceRoot+'/packages/rules/index.ts').href);
const referenceSimulation=await import(pathToFileURL(referenceRoot+'/packages/simulation/index.ts').href);
const referenceContent=await import(pathToFileURL(referenceRoot+'/packages/content/index.ts').href);
const provenance=JSON.parse(await readFile(referenceRoot+'/provenance.json','utf8'));
assert.equal(provenance.commit,'19112f9');assert.equal(provenance.missing.length,0);
const sourceFiles=[...provenance.files.filter((f:any)=>['packages/contracts/','packages/content/','packages/rules/','packages/simulation/'].some(p=>f.file.startsWith(p))).map((f:any)=>f.file),'packages/contracts/stats.ts','packages/contracts/conditions.ts','packages/contracts/damage-zones.ts','packages/content/stats.json'];
async function sourceSnapshot(){const hashes:Record<string,string>={};for(const file of sourceFiles)hashes[file]=createHash('sha256').update(await readFile(file)).digest('hex');return hashes;}
const sourceBefore=await sourceSnapshot();
assert.deepEqual(skillCatalog,referenceContent.skillCatalog,'Skill definitions drifted from accepted RS');
const selected=process.env.AW_R1_SKILLS?.split(',');
const skills=selected?skillCatalog.filter(s=>selected.includes(s.id)):skillCatalog;
if(!selected)assert.equal(skills.length,83);
const seeds=[41,73],ticks=600;
const region:Region={id:'r1-frame-reference',name:'R1逐帧对照',subtitle:'',theme:'meadow',width:60,height:40,safe:{x:10,y:10},portal:{x:4,y:4},obstacles:[],spawns:[],landmarks:[],boss:false,auto:false};
const target={id:'target',name:'耐久靶',x:11.6,y:10,hp:10000000,attack:0,kind:'melee' as const,boss:false,elite:false,art:'raider'};
const sha=(data:unknown)=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
// Only new metadata is omitted. Numeric attributes, resolved skills and events
// must match exactly; no tolerance is used for any damage or timing field.
const numeric=(value:unknown):any=>Array.isArray(value)?value.map(numeric):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([key])=>key!=='pool'&&key!=='conditional').map(([key,x])=>[key,numeric(x)])):value;
function stateFor(id:string,rich:boolean):CharacterState{
 const skill=skillCatalog.find(s=>s.id===id)!,weapon=skill.weapons?.[0]??'sword';
 const base=weapon==='bow'?'bow':`standard-${weapon}-t1-weapon`;
 const gear=makeGearByBase(base,'11111111-1111-4111-8111-111111111111');
 gear.affixes=rich?statRegistry.filter(s=>s.affix).map((s,i)=>({id:'fixture-'+i,stat:s.id as any,value:s.unit==='ratio'?.03:3,name:s.name,tier:3,description:s.name})):[];
 const state:CharacterState={id:'r1-controlled',name:'受控授予',revision:1,build:1,level:rich?50:15,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:[id],skillRanks:{[id]:rich?5:1},progress:{safe:'town',regions:['town'],bosses:[],tasks:[],kills:0}};
 ensureProgression(state);
 if(rich){state.progression!.talents=Object.fromEntries(talentDefinitions.map(t=>[t.id,t.max]));state.progression!.paragon=paragonDefinitions.map(p=>p.id);}
 return state;
}
function run(Engine:typeof World,build:ReturnType<typeof resolveBuild>,id:string,seed:number){
 assert.deepEqual(build.resolvedSkills.map(s=>s.id),[id],'Requested skill was filtered from executed build');
 // Explicit measurement overrides isolate output without changing attack,
 // armor, crit, multipliers, cooldowns, effects, or resolved skill parameters.
 const stats:Stats={...build.stats,hp:1000000,mana:1000000,regen:0};
 const world=new Engine(structuredClone(region),stats,structuredClone(build.resolvedSkills),[structuredClone(target)],[],seed);
 world.setMode('manual');world.hero.hp=stats.hp*.5;world.enemies[0].cooldown=1000000;
 if(id==='cleanse')world.applyStatus('hero',statusEffectSchema.parse({kind:'slow',duration:900,strength:.2,scope:'hit',cleanse:true}),'target','slow_field');
 const events:unknown[]=[],frames:unknown[]=[];
 for(let i=0;i<ticks;i++){
  if(world.tick>=(world.cooldowns[id]??0)&&world.tick>=world.hero.actionUntil)world.cast(id,world.enemies[0]);
  world.step();events.push(...JSON.parse(JSON.stringify(world.events)));
  frames.push({tick:world.tick,hp:world.hero.hp,mana:world.hero.mana,shield:world.hero.shield,position:{...world.hero.position},targetHp:world.enemies[0].hp,targetPosition:{...world.enemies[0].position}});
 }
 const casts=(events as any[]).filter(e=>e.type==='cast_started'&&e.skill===id).length;
 assert(casts>0,id+' had no executed cast');
 return {events:numeric(events),frames,casts,hits:(events as any[]).filter(e=>e.type==='hit_resolved'&&e.sourceId==='hero').length};
}
const rows:any[]=[],raw:any[]=[],failures:any[]=[];
for(const skill of skills)for(const rich of [false,true])for(const seed of seeds){
 const state=stateFor(skill.id,rich),before=structuredClone(state.gear),a=referenceRules.resolveBuild(structuredClone(state)),b=resolveBuild(structuredClone(state));
 assert.equal(b.stats.conditional?.length??0,0,'R1 must leave the conditional channel empty');
 const baseline=run(referenceSimulation.World,a,skill.id,seed),current=run(World,b,skill.id,seed);
 let error='';try{assert.deepEqual(numeric(b),numeric(a));assert.deepEqual(current,baseline);const copy=structuredClone(state);resolveBuild(copy);assert.deepEqual(copy.gear,before);}catch(e){error=String(e);failures.push({id:skill.id,rich,seed,error});}
 rows.push({id:skill.id,weapon:b.stats.weapon,profile:rich?'all-legacy-affixes-and-progression':'base',rank:state.skillRanks[skill.id],seed,ticks,casts:current.casts,hits:current.hits,baselineSha256:sha(baseline),currentSha256:sha(current),equal:!error});
 raw.push({state,baselineBuild:numeric(a),currentBuild:numeric(b),baseline,current});
}
const out='docs/reviews/build-variety-r1-20261006/frames-77';await mkdir(out,{recursive:true});
const sourceAfter=await sourceSnapshot();assert.deepEqual(sourceAfter,sourceBefore,'Sources changed during frame comparison; discard this measurement');
const bytes=Buffer.from(JSON.stringify(raw)),compressed=gzipSync(bytes);
await writeFile(out+'/traces.json.gz',compressed);
const report={ok:failures.length===0,baselineCommit:'19112f9',versions,skills:skills.map(s=>s.id),sampleCount:rows.length,seeds,ticks,sourceBefore,sourceAfter,provenance,rows,failures,trace:{path:'traces.json.gz',bytes:bytes.length,gzipBytes:compressed.length,sha256:createHash('sha256').update(bytes).digest('hex')},limitations:['Controlled activation and skill ranks; not natural progression.','No starsea state or quest mutations; later quest/art dependencies explicitly recorded in provenance.','HP/mana measurement overrides are identical in both runs.','New pool and empty conditional metadata excluded; all numeric and frame values compared exactly.']};
await writeFile(out+'/result.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({ok:report.ok,skills:skills.length,sampleCount:rows.length,failures:failures.map(f=>({id:f.id,rich:f.rich,seed:f.seed,error:f.error.slice(0,600)}))}));
if(!report.ok)process.exitCode=1;
