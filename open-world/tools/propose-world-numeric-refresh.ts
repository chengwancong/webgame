// 数值来源已迁到 tools/spine；此入口校验并复用主干已应用计划。
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {auditNumericFlow} from './numeric-source-audit.ts';
import {tierFourBasis,deriveEndgameTiers} from './apply-world-tier-curve.ts';
type Pool={stage:number;level:number;dropProbability:number;required:number;materialsPerSource:{elite:number;rare:number;chest:number};choices:unknown[];basis:{elitePerMinute:number;lambdaPerMinute:number;targetMinutes:number;materialTargetMinutes:number};[key:string]:unknown};
type Stage={index:number;level:number;lam:number;push:number};
type SourceBasis={stage:number;elitePerMinute:number;samples:{kills:number;seconds:number;completed?:boolean;survived?:boolean}[]};
export function proposeTierCalibration(raw:unknown,target:{bossHp:number;bossDps:number},basis:ReturnType<typeof tierFourBasis>){
 const desired={hp:target.bossHp/basis.bossHp,attack:target.bossDps/basis.rawDps};
 try{return {valid:true as const,content:deriveEndgameTiers(raw,target,basis),desired,error:null};}
 catch(error){return {valid:false as const,content:null,desired,error:String(error),limits:'The measured provisional story-boss reference cannot produce a monotone tier4. Keep the exact stage24 target; declare/calibrate the actual field-boss reference before formal adoption. No coefficient clamp or weakened schema is used.'};}
}
export function proposeKeyPoolRefresh<T extends {pools:Pool[]}>(source:T,stages:readonly Stage[],bases:readonly SourceBasis[]){
 if(source.pools.length!==24||stages.length!==24||bases.length!==24||new Set(bases.map(b=>b.stage)).size!==24)throw Error('Numeric refresh requires all24 existing pools, targets and actual source bases');
 const result=structuredClone(source),changes=[];
 for(const [i,pool]of result.pools.entries()){
  const stage=stages[i],basis=bases.find(b=>b.stage===stage.index);
  if(stage.index!==i+1||pool.stage!==stage.index||!basis||!basis.samples.length||![stage.level,stage.lam,stage.push,basis.elitePerMinute,pool.materialsPerSource.elite].every(v=>Number.isFinite(v)&&v>0)||basis.samples.some(s=>!Number.isFinite(s.kills)||s.kills<0||!Number.isFinite(s.seconds)||s.seconds<=0))throw Error('Missing actual positive source or matching stage '+pool.stage);
  const rate=basis.samples.reduce((n,s)=>n+s.kills,0)/basis.samples.reduce((n,s)=>n+s.seconds,0)*60;
  if(Math.abs(rate/basis.elitePerMinute-1)>1e-9)throw Error('Source rate disagrees with actual sample denominator '+pool.stage);
  const before={level:pool.level,dropProbability:pool.dropProbability,required:pool.required,basis:structuredClone(pool.basis)};
  pool.level=Math.ceil(stage.level);pool.dropProbability=1-Math.exp(-stage.lam/rate);pool.required=Math.max(1,Math.ceil(stage.push*1.4*rate*pool.materialsPerSource.elite));
  pool.basis={elitePerMinute:rate,lambdaPerMinute:stage.lam,targetMinutes:stage.push,materialTargetMinutes:stage.push*1.4};
  changes.push({stage:pool.stage,before,after:{level:pool.level,dropProbability:pool.dropProbability,required:pool.required,basis:structuredClone(pool.basis)},sourceSamples:basis.samples.length,failedSourceSamples:basis.samples.filter(s=>s.completed===false||s.survived===false).length});
 }
 return {content:result,changes,limits:['Only measured elite source frequency is available in this controlled basis. Natural chest/rare rates and mixed material throughput require the subsequent production dungeon recalibration.','Existing choice IDs, outputs, weights, private loot and source-material declarations are preserved. No formal private pool is written by this proposal.']};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const {legacySpineEntry}=await import('./spine/legacy.ts');await legacySpineEntry('propose-world-numeric-refresh');
}
