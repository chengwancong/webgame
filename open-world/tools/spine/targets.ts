/** 目标冲突只依据来源优先级和明确文档日期，不以文件修改时间裁决。 */
export type SpineTarget={key:string;levels:string;value:number;unit:string;source:'用户'|'文档'|'实测';reference:string;locked:boolean;date:string};
export function resolveTargets(rows:readonly SpineTarget[]){
 const groups=new Map<string,SpineTarget[]>(),selected:SpineTarget[]=[],conflicts:{key:string;levels:string;chosen:SpineTarget;candidates:SpineTarget[]}[]=[];
 for(const row of rows){
  if(!row.key||!row.levels||!row.reference||!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||!Number.isFinite(row.value))throw Error('目标字段缺失或数值无效');
  if(row.locked&&row.source!=='用户')throw Error('只有用户目标可以锁定');
  const key=row.key+'/'+row.levels;groups.set(key,[...(groups.get(key)??[]),row]);
 }
 const priority={'用户':0,'文档':1,'实测':2};
 for(const candidates of groups.values()){
  if(new Set(candidates.map(r=>r.unit)).size>1)throw Error('目标单位冲突，须先显式换算：'+candidates[0].key);
  const locked=candidates.filter(r=>r.locked);
  if(new Set(locked.map(r=>r.value)).size>1)throw Error('硬阻塞1：锁定目标冲突 '+candidates[0].key);
  const sorted=[...candidates].sort((a,b)=>Number(b.locked)-Number(a.locked)||priority[a.source]-priority[b.source]||b.date.localeCompare(a.date));
  const chosen=sorted[0];
  const ambiguous=sorted.filter(r=>r.locked===chosen.locked&&priority[r.source]===priority[chosen.source]&&r.date===chosen.date);
  if(new Set(ambiguous.map(r=>r.value)).size>1)throw Error('同日同优先级目标冲突，须在裁决文件指定来源：'+chosen.key);
  selected.push(chosen);
  if(new Set(candidates.map(r=>r.value)).size>1)conflicts.push({key:chosen.key,levels:chosen.levels,chosen,candidates});
 }
 return {selected,conflicts};
}
