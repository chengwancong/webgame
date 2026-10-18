import {craftingKeyProof,craftingNonGoldHash,deriveGoldPrices,verifyGoldPrices} from './crafting-pricing.ts';
import '../../packages/content/open-world/index.ts';
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {homedir} from 'node:os';
import {stageKeyPools} from '../../apps/api/src/stage-key-pools.ts';
import {dungeonContent} from '../../packages/content/dungeons.ts';
import {regionById} from '../../packages/content/index.ts';
import {versions} from '../../packages/contracts/index.ts';
import {craftRecipes,craftMaterials,craftFacilities} from '../../packages/content/crafting.ts';
import {starseaKillReward} from '../../apps/api/src/economy.ts';
import {standardState,resolvePlayer} from './player.ts';
import {benchSample} from './bench.ts';
import {applyCraft} from '../../packages/rules/crafting.ts';
import {ensureProgression} from '../../packages/rules/deep-progression.ts';
import {resolveBuild} from '../../packages/rules/index.ts';
import {compareVerdict} from '../../packages/rules/stat-comparison.ts';
import {storyFeatureUnlocked} from '../../packages/rules/story-campaign.ts';
const seeds=[41,42,43],median=(xs:number[])=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const sourceFiles=['apps/api/src/stage-key-pools.json','packages/content/dungeons.json','packages/content/open-world/production.json','config/json/crafting.json','tools/spine/data/spine-flow.json'];
export async function sources(){return Object.fromEntries(await Promise.all(sourceFiles.map(async path=>{const raw=await readFile(path,'utf8');return [path,hash(path.endsWith('/production.json')?JSON.stringify(JSON.parse(raw).dungeons):raw)];})));}
function random(seed:number){let s=seed>>>0;const float=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296);return {float,int:(min:number,max:number)=>min+Math.floor(float()*(max-min))};}
function cycle(stage:number){
 const definition=dungeonContent.definitions.find(d=>d.numericStage===stage)??dungeonContent.definitions.find(d=>d.hardmode?.numericStage===stage);assert(definition,'阶段缺少地城 '+stage);
 const sources:('elite'|'rare'|'chest')[]=[],monsters:NonNullable<ReturnType<typeof regionById>['spawns'][number]['monster']>[]= [];
 for(const id of definition.stages){const region=regionById(id);for(const spawn of region.spawns){if(spawn.monster)monsters.push(spawn.monster);if(!spawn.boss&&(spawn.elite||spawn.monster?.rank==='rare'))sources.push(spawn.monster?.rank==='rare'?'rare':'elite');}for(const chest of region.keyChests??[])sources.push('chest');}
 assert(sources.length>0,'阶段没有真实钥匙来源 '+stage);return {dungeon:definition.id,sources,monsters};
}
export function keyThresholdDraws(required:number,materials:Record<'elite'|'rare'|'chest',number>,cycle:readonly ('elite'|'rare'|'chest')[]){let total=0,n=0;while(total<required){total+=materials[cycle[n%cycle.length]];n++;assert(n<=required*4,'钥匙材料来源无进展');}return n;}
async function once(path:string){try{await access(path);throw Error('本阶段已留档，禁止重复推导或验证：'+path);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}}
export async function applyCraftingGold(out:string){
 const target=join(out,'gold-apply.json');await once(target);
 const runtime=join(homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies');
 execFileSync(join(runtime,'node/bin/node.exe'),['tools/spine/crafting-gold.mjs',out,join(runtime,'node/node_modules')],{stdio:'inherit',windowsHide:true});
 execFileSync(join(runtime,'python/python.exe'),['-X','utf8','tools/config-export.py'],{stdio:'inherit',windowsHide:true});
 await writeFile(target,JSON.stringify({sources:await sources()},null,2)+'\n');
}
export async function deriveCraftingFlow(out:string){
 const target=join(out,'derivation.json');await once(target);await mkdir(out,{recursive:true});
 const flow=JSON.parse(await readFile('tools/spine/data/spine-flow.json','utf8'));
 const stages=stageKeyPools.map(pool=>{const c=cycle(pool.stage),draws=keyThresholdDraws(pool.required,pool.materialsPerSource,c.sources),goldPerCycle=c.monsters.reduce((n,m)=>n+starseaKillReward(pool.level,m.rank,pool.level).gold,0),elites=c.sources.filter(k=>k==='elite').length,cyclesPerMinute=pool.basis.elitePerMinute/Math.max(1,elites);return {stage:pool.stage,level:pool.level,sourceCycle:c.sources,dungeon:c.dungeon,required:pool.required,probability:pool.dropProbability,drawsAtBackstop:draws,exactBackstop:Math.pow(1-pool.dropProbability,draws),goldPerMinute:goldPerCycle*cyclesPerMinute,phase:flow.stages.find((s:any)=>s.index===pool.stage)};});
 const chapters=Array.from({length:6},(_,i)=>{const stagesInChapter=stages.slice(i*3,i*3+3),island=['ss-map-wind','ss-map-mist','ss-map-forge','ss-map-frost','ss-map-rift','ss-map-dragon'][i],recipes=craftRecipes.filter(r=>r.island===island&&['gear','accessory'].includes(r.category)&&!r.id.startsWith('forge-legacy')),fee=recipes.reduce((n,r)=>n+r.baseCost.gold,0)/recipes.length,income=stagesInChapter.reduce((n,s)=>n+s.goldPerMinute*(s.phase.push+s.phase.farm),0),facility=craftFacilities.find(f=>f.id==='forge'&&f.level===Math.min(6,i+2))!.cost.gold,pattern=craftRecipes.filter(r=>r.island===island&&r.category==='pattern');const patternFee=pattern.length?pattern.reduce((n,r)=>n+r.baseCost.gold,0)/pattern.length:0,craftSpend=7.5*fee+3*patternFee+3*facility;return {chapter:i+1,incomeEstimate:income,crafts:7.5,patternCrafts:3,facilityUpgrades:3,craftSpend,otherBudget:.5*income,remainderRatio:(income*.5-craftSpend)/income,scope:'当前地城来源频率的预算投影；其他系统35%强化+15%技能为设计预算，不能冒称自然存档实测'};});
 const result={versions,seeds,sources:await sources(),nonGoldHash:await craftingNonGoldHash(),goldPlan:deriveGoldPrices(chapters),keyProof:await craftingKeyProof(stages),stages,chapters,exactEqualStageBackstop:stages.reduce((n,s)=>n+s.exactBackstop,0)/stages.length,method:'按当前声明房间顺序，精英/稀有后开箱，重复本阶段来源；精确计算达到阈值前所有随机抽取均失败的概率。含纯刷级路径只会进一步降低保底占比。',adjustment:'按2026-10-15裁决只调整三类金币至章收入30%；钥匙规则、来源与池不回退，11.64%仅记现状。'};
 await writeFile(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({phase:'推导',exactEqualStageBackstop:result.exactEqualStageBackstop,chapters:chapters.map(c=>({chapter:c.chapter,remainderRatio:c.remainderRatio}))}));return result;
}
function craftedState(stage:number,level:number,seed:number){
 const base=standardState(level),candidate=structuredClone(base),p=ensureProgression(candidate),maxLevel=stage>1?stageKeyPools[stage-2].level:0,unlocked=storyFeatureUnlocked(candidate,'forge');candidate.gold=100000000;for(const m of craftMaterials)p.materials[m.id]=9999;
 const rows=craftRecipes.filter(r=>['gear','accessory'].includes(r.category)&&r.output.kind==='gear'&&(r.output.level??1)<=maxLevel&&candidate.starsea?.islands.includes(r.island!));
 const chosen=['weapon','armor','accessory'].flatMap(slot=>{const options=rows.filter(r=>r.options.slots?.includes(slot)).sort((a,b)=>(b.output.level??1)-(a.output.level??1));return options[0]?[options[0]]:[];}),changes:string[]=[],rng=random(seed);
 if(unlocked)for(const r of chosen){ensureProgression(candidate).recipes.push(r.id);const action={op:'craft' as const,recipe:r.id,...(r.options.tendencies?{tendency:'martial'}:{})},gain=applyCraft(candidate,action,{atForge:true,storyUnlocked:true,reason:'',maxCraftLevel:maxLevel},rng),gear=gain.gear![0],before=resolveBuild(candidate).stats,previous=candidate.equipment[gear.slot];candidate.equipment[gear.slot]=gear.id;const after=resolveBuild(candidate).stats;if(compareVerdict(before,after)==='weaker'||compareVerdict(before,after)==='even')candidate.equipment[gear.slot]=previous;else changes.push(gear.base);}
 return {base,candidate,changes,unlocked,maxLevel};
}
export async function verifyCraftingFlow(out:string){
 const target=join(out,'validation.json');await once(target);const derivation=JSON.parse(await readFile(join(out,'derivation.json'),'utf8'));const applied=JSON.parse(await readFile(join(out,'gold-apply.json'),'utf8'));assert.deepEqual(await sources(),applied.sources,'应用后输入变化');assert.equal(await craftingNonGoldHash(),derivation.nonGoldHash,'只允许修改指定金币');for(const [file,value]of Object.entries(derivation.sources))if(file!=='config/json/crafting.json')assert.equal(applied.sources[file],value,'非制作来源变化 '+file);const keyProof=await craftingKeyProof(derivation.stages),chapterGold=verifyGoldPrices(derivation);
 const perStage:any[]=[],sampleCount=10000,combat:any[]=[];
 for(const row of derivation.stages){
  const counts=seeds.map(seed=>{const rng=random(seed*1009+row.stage);let backstop=0,total=0;for(let sample=0;sample<sampleCount;sample++){let material=0,n=0;while(true){material+=stageKeyPools[row.stage-1].materialsPerSource[row.sourceCycle[n%row.sourceCycle.length] as 'elite'|'rare'|'chest'];n++;if(rng.float()<row.probability)break;if(material>=row.required){backstop++;break;}}total+=n;}return {seed,backstop:backstop/sampleCount,meanDraws:total/sampleCount};});perStage.push({stage:row.stage,exact:row.exactBackstop,samples:counts});
  for(const seed of seeds){const level=Math.max(1,Math.min(60,Math.round(row.phase.level))),states=craftedState(row.stage,level,seed),b=resolvePlayer('crafting-before-'+row.stage,states.base),a=resolvePlayer('crafting-after-'+row.stage,states.candidate),hp=b.build.stats.hp;
   const beforeD=benchSample(b,'dense',seed,hp),afterD=benchSample(a,'dense',seed,hp),beforeE=benchSample(b,'EHP',seed,hp),afterE=benchSample(a,'EHP',seed,hp);
   for(const sample of [beforeD,afterD])assert(sample.value&&sample.totalDamage>0&&Object.values(sample.casts).reduce((n,v)=>n+v,0)>0&&!sample.failed,'伤害样本失败，禁止静默过滤 '+row.stage+'/'+seed);
   combat.push({stage:row.stage,seed,level,requested:b.build.skills.map(s=>s.id),beforeExecuted:beforeD.executed,afterExecuted:afterD.executed,beforeD:beforeD.value,afterD:afterD.value,beforeE:beforeE.value,afterE:afterE.value,casts:{before:beforeD.casts,after:afterD.casts},changes:states.changes,forgeUnlocked:states.unlocked,maxCraftLevel:states.maxLevel,timeReduction:Math.max(0,1-beforeD.value!/afterD.value!)});
  }
  console.log('制作验证阶段 '+row.stage+'/24');
 }
 const backstop=median(seeds.map(seed=>perStage.reduce((n,s)=>n+s.samples.find((r:any)=>r.seed===seed).backstop,0)/perStage.length)),reductions=perStage.map(s=>median(combat.filter(r=>r.stage===s.stage).map(r=>r.timeReduction))),timeReduction=median(reductions),maxTimeReduction=Math.max(...reductions),keyAccepted=keyProof.accepted;
 const result={versions,seeds,sampleCountPerStageAndSeed:sampleCount,sourceHashes:applied.sources,backstop,exactBackstop:derivation.exactEqualStageBackstop,keyAccepted,timeReduction,maxTimeReduction,timeAccepted:timeReduction<=.05,keyProof,chapterGold,goldAccepted:chapterGold.every((c:any)=>c.remainderRatio>=.15&&c.remainderRatio<=.25),perStage,combat,hardBlock:keyAccepted?null:{section:'交接第7节第4种',reason:'钥匙规则、来源、池或制作产物不满足不回退检查。'},scope:'24阶段等权。配对战斗消费同一当前标准人、技能等级、种子与执行器，给予已通过阶段三件可选制作品后按既有服务端换装总评选择。开荒等待模型将清图加速视为来源加速，未冒称完整自然养成；金币为明确标注的预算投影。'};
 await writeFile(target,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({phase:'验证',backstop,timeReduction,maxTimeReduction,goldAccepted:result.goldAccepted,hardBlock:result.hardBlock}));return result;
}
