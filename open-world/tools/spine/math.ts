/** 数值主干交接 M3/M6：纯计算层；不得用这些预测替代 World 实测。 */
export const spineScenes = ['single', 'clear', 'elite', 'survival', 'safety'] as const;
export type SpineScene = typeof spineScenes[number];
export type BenchMetrics = {D1:number; DN:number; B3:number; EHP:number; AV:number};
export type SpineAnchor = BenchMetrics & {r50:number};
/** 删失TTD只有下界；不能将两个120秒下界当成相同的真实寿命。 */
export function ttdReduction(base:{ttd:number;censored:boolean},next:{ttd:number;censored:boolean}){
 positive(base.ttd,'基线TTD');positive(next.ttd,'词缀TTD');
 if(base.censored||next.censored)return {observed:null,functional:false,lowerBound:base.censored&&!next.censored?1-next.ttd/base.ttd:null,upperBound:!base.censored&&next.censored?1-next.ttd/base.ttd:null};
 const observed=1-next.ttd/base.ttd;return {observed,functional:Math.abs(observed)<.01,lowerBound:observed,upperBound:observed};
}
/** B3末端1秒线性结算：逐帧中点积分，稳态常量输入的归一面积为T-0.5秒。
 * 原始三秒伤害单独保留；这个连续统计量只用于测量台映射/求解。 */
export function continuousBurstWindow(damageFrames:Record<string,number>,ticks:number){
 if(!Number.isInteger(ticks)||ticks<=0)throw Error('窗口需要正整数帧');
 const taperTicks=Math.min(30,ticks),effectiveTicks=ticks-taperTicks/2;
 let weightedDamage=0;for(const [frame,amount] of Object.entries(damageFrames)){const t=Number(frame);if(!Number.isInteger(t)||t<1||!Number.isFinite(amount)||amount<0)throw Error('非法伤害帧');if(t>ticks)continue;const weight=Math.max(0,Math.min(1,(ticks-(t-.5))/taperTicks));weightedDamage+=amount*weight;}
 return {weightedDamage,taperTicks,effectiveTicks,value:weightedDamage/(effectiveTicks/30)};
}
function positive(value:number, name:string){if(!Number.isFinite(value)||value<=0)throw Error(name+' 必须为有限正数');return value;}
export function median(values:readonly number[]){
 if(!values.length||values.some(v=>!Number.isFinite(v)))throw Error('中位数需要非空有限样本');
 const sorted=[...values].sort((a,b)=>a-b),i=Math.floor(sorted.length/2);
 return sorted.length%2?sorted[i]:(sorted[i-1]+sorted[i])/2;
}
export function validateMetrics(value:BenchMetrics){
 for(const key of ['D1','DN','B3','EHP'] as const)positive(value[key],key);
 if(!Number.isFinite(value.AV)||value.AV<0||value.AV>1)throw Error('AV 必须在 0–1 之间');
 return value;
}
export function eliteSeconds(d1:number,b3:number,hp:number){
 positive(d1,'D1');positive(b3,'B3');positive(hp,'精英生命');
 return hp<=3*b3?hp/b3:3+(hp-3*b3)/d1;
}
export function mapBench(value:BenchMetrics,anchor:SpineAnchor):Record<SpineScene,number>{
 validateMetrics(value);validateMetrics(anchor);positive(anchor.r50,'r50');
 const hp=15*anchor.D1;
 return {single:value.D1/anchor.D1,clear:value.DN/anchor.DN,
  elite:eliteSeconds(anchor.D1,anchor.B3,hp)/eliteSeconds(value.D1,value.B3,hp),
  survival:value.EHP/anchor.EHP,safety:(1-anchor.AV+.02)/(1-value.AV+.02)};
}
export function scenarioParameters(anchor:SpineAnchor){
 validateMetrics(anchor);positive(anchor.r50,'r50');
 return {single:{hp:45*anchor.D1,seconds:180},clear:{count:12,hpEach:anchor.DN,seconds:120},
  elite:{hp:15*anchor.D1,seconds:120},survival:{attackers:3,seconds:120,rawDps:(seconds:number)=>{if(!Number.isFinite(seconds)||seconds<0)throw Error('时间无效');return anchor.r50*(1+seconds/15);}},safety:{attackers:4,seconds:60}};
}
export function powerIndex(ratios:Record<SpineScene,number>,weights:Record<SpineScene,number>){
 if(spineScenes.some(s=>!Number.isFinite(weights[s])||weights[s]<0)||Math.abs(spineScenes.reduce((n,s)=>n+weights[s],0)-1)>1e-9)throw Error('权重必须非负且合计为1');
 return spineScenes.reduce((sum,scene)=>sum+weights[scene]*Math.log(positive(ratios[scene],scene)),0);
}
export function normalizeToBand(old:number,observed:number,groupMedian:number,band:number,elasticity:number,step:number){
 positive(old,'旧值');positive(observed,'实测');positive(groupMedian,'组中位数');positive(step,'步长');
 if(!Number.isFinite(elasticity)||Math.abs(elasticity)<1e-9)throw Error('缺少有效实测弹性，不允许估计');
 if(!Number.isFinite(band)||band<0||band>=1)throw Error('预算带无效');
 const lo=groupMedian*(1-band),hi=groupMedian*(1+band),edge=Math.max(lo,Math.min(hi,observed));
 if(edge===observed)return {value:old,edge,changed:false};
 const raw=old*(edge/observed)**(1/elasticity),value=Number((Math.round(raw/step)*step).toFixed(4));
 positive(value,'归一值');return {value,edge,changed:value!==old};
}
/** 不滤掉失败样本；每种子先除以八构筑中位数，再取种子中位数。 */
export function officialRatios(rows:readonly {build:string;seed:number;scene:SpineScene;score:number|null}[],builds:readonly string[],seeds:readonly number[]){
 if(builds.length!==8||new Set(builds).size!==8||[...seeds].sort((a,b)=>a-b).join(',')!=='41,42,43')throw Error('官方口径必须为8构筑、固定种子41/42/43');
 if(rows.length!==8*3*5)throw Error('官方场景需要完整120个样本');
 const cells=new Map<string,number>();
 for(const row of rows){
  const key=[row.build,row.seed,row.scene].join('/');
  if(cells.has(key)||!builds.includes(row.build)||!seeds.includes(row.seed)||!spineScenes.includes(row.scene)||row.score===null)throw Error('未知、重复或失败样本：'+key);
  cells.set(key,positive(row.score,'场景得分'));
 }
 return builds.map(build=>({build,ratios:Object.fromEntries(spineScenes.map(scene=>[scene,median(seeds.map(seed=>{
  const denominator=median(builds.map(id=>cells.get([id,seed,scene].join('/'))!));
  return cells.get([build,seed,scene].join('/'))!/denominator;
 }))])) as Record<SpineScene,number>}));
}
