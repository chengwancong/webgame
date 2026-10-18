import {createHash} from 'node:crypto';
import {versions} from '../packages/contracts/index.ts';
type NumericVersions={client:string;protocol:number;rules:string;assets:string;db:number};
export function auditMeasuredModel(model:{meta:{versions:NumericVersions;measurement?:{samples:number;hitAoeSamples?:number}};rows:{level:number;full:{dps1:number;ehp:number;hitAoe?:number}}[]},current:NumericVersions=versions){
 for(const key of ['client','protocol','rules','assets','db'] as const)if(model.meta.versions[key]!==current[key])throw Error('Stale numeric model '+key+': measured '+model.meta.versions[key]+', current '+current[key]+'. Rerun actual standard measurements before deriving content.');
 if(model.rows.length!==60||model.rows.some((r,i)=>r.level!==i+1||![r.full.dps1,r.full.ehp,r.full.hitAoe].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>0))||model.meta.measurement?.samples!==360||model.meta.measurement.hitAoeSamples!==60)throw Error('Numeric model requires all60 actual rows,360 DPS samples and60 noncritical AOE samples');
 return {versions:structuredClone(model.meta.versions),levels:60,dpsSamples:360,hitAoeSamples:60};
}
export function auditNumericFlow(flow:{versions:NumericVersions;modelSha256:string;stages:{index:number;bossHp:number;bossDps:number}[]},modelBytes:Uint8Array,current:NumericVersions=versions){
 const model=JSON.parse(Buffer.from(modelBytes).toString('utf8'));auditMeasuredModel(model,current);
 const actual=createHash('sha256').update(modelBytes).digest('hex');if(flow.modelSha256!==actual)throw Error('Numeric flow refers to a different measured model. Rerun numeric-flow-sim.py before deriving walls.');
 for(const key of ['client','protocol','rules','assets','db'] as const)if(flow.versions[key]!==model.meta.versions[key])throw Error('Numeric flow/model version mismatch '+key);
 if(flow.stages.length!==24||flow.stages.some((s,i)=>s.index!==i+1||![s.bossHp,s.bossDps].every(v=>Number.isFinite(v)&&v>0)))throw Error('Numeric flow requires all24 ordered positive wall stages');
 return {versions:structuredClone(flow.versions),modelSha256:actual,stages:24};
}
/** 主干模型明确是13个实测点；中间等级为推导插值，不能冒称60点实测。 */
export function auditSpinePlayer(model:{versions:NumericVersions;points:{level:number;D1:number;DN:number;EHP:number;AV:number}[]},current:NumericVersions=versions){
 for(const key of ['client','protocol','rules','assets','db'] as const)if(model.versions[key]!==current[key])throw Error('Stale spine model '+key);
 if(model.points.map(p=>p.level).join(',')!=='1,5,10,15,20,25,30,35,40,45,50,55,60'||model.points.some(p=>![p.D1,p.DN,p.EHP].every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(p.AV)||p.AV<0||p.AV>1))throw Error('Spine model requires13 actual positive points');return {versions:model.versions,actualPoints:13,seeds:[41,42,43],interpolation:'logarithmic; not additional actual measurements'};
}
