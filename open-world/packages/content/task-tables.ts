// 任务配置表加载器：读取 config/json，校验行格式与跨表引用，导出星潮海、归途、任务页数据。
// 运行时只依赖这个模块，不再直接读 story-campaign.ts、tasks.ts、starsea/campaign.json。
// 地图、地标、怪物等美术与规则资源的校验仍在 validate-content.ts 与 region 单测里。
// JSON 直接 import，服务端（tsx）与网页（Vite）共用同一份数据。
import tasksFile from '../../config/json/tasks.json';
import chaptersFile from '../../config/json/chapters.json';
import npcsFile from '../../config/json/npcs.json';
import dialogueFile from '../../config/json/dialogue.json';
import propsFile from '../../config/json/props.json';
import type {DialogueLine,TaskRow,StepRow,RouteRow,ChapterRow,FeatureRow,DefenseRow,NpcRow,LineRow,TriggerRow,PropRow} from '../contracts/task-tables.ts';
import * as s from '../contracts/task-tables.ts';
const fail=(where:string,msg:string)=>{throw Error(`配置表 ${where}：${msg}`);};
function load<T>(file:unknown,fileSchema:any,rowSchema:any,name:string):T[]{
 const data=fileSchema.parse(file);
 return data[name].map((raw:unknown,i:number)=>{
  try{return rowSchema.parse(raw);}
  catch(e){const row=(raw as {_row?:number})._row??i+1;fail(data.source+'/'+name+' 第'+row+'行',String(e));}
 });
}
const tasks=load<TaskRow>(tasksFile,s.tasksFileSchema,s.taskRowSchema,'tasks');
const steps=load<StepRow>(tasksFile,s.tasksFileSchema,s.stepRowSchema,'steps');
const routes=load<RouteRow>(tasksFile,s.tasksFileSchema,s.routeRowSchema,'routes');
const chapters=load<ChapterRow>(chaptersFile,s.chaptersFileSchema,s.chapterRowSchema,'chapters');
const features=load<FeatureRow>(chaptersFile,s.chaptersFileSchema,s.featureRowSchema,'features');
const defenses=load<DefenseRow>(chaptersFile,s.chaptersFileSchema,s.defenseRowSchema,'defenses');
const npcs=load<NpcRow>(npcsFile,s.npcsFileSchema,s.npcRowSchema,'npcs');
export const npcPositions=s.npcsFileSchema.parse(npcsFile).positions;
const lines=load<LineRow>(dialogueFile,s.dialogueFileSchema,s.lineRowSchema,'lines');
const triggers=load<TriggerRow>(dialogueFile,s.dialogueFileSchema,s.triggerRowSchema,'triggers');
const props=load<PropRow>(propsFile,s.propsFileSchema,s.propRowSchema,'props');
const taskTypes=load<s.TaskTypeRow>(tasksFile,s.tasksFileSchema,s.taskTypeRowSchema,'taskTypes');
export const conditions=s.tasksFileSchema.parse(tasksFile).conditions;
export const rumors=s.tasksFileSchema.parse(tasksFile).rumors;
export const skillRecoveryRows=s.tasksFileSchema.parse(tasksFile).skillRecovery;
export const questParameters:Record<string,any>=Object.fromEntries(s.tasksFileSchema.parse(tasksFile).parameters.map(p=>[p.id,p.value]));
// 索引
const taskById=new Map(tasks.map(t=>[t.id,t])),stepsByTask=new Map<string,StepRow[]>(),routesByTask=new Map<string,RouteRow[]>();
const chapterById=new Map(chapters.map(c=>[c.id,c])),npcById=new Map(npcs.map(n=>[n.id,n])),defenseById=new Map(defenses.map(d=>[d.id,d]));
const linesByGroup=new Map<string,LineRow[]>(),propById=new Map(props.map(p=>[p.id,p]));
for(const st of steps)(stepsByTask.get(st.task)??stepsByTask.set(st.task,[]).get(st.task)!).push(st);
for(const r of routes)(routesByTask.get(r.task)??routesByTask.set(r.task,[]).get(r.task)!).push(r);
for(const l of lines)(linesByGroup.get(l.group)??linesByGroup.set(l.group,[]).get(l.group)!).push(l);
// 跨表引用校验（文件名+行号报错）
for(const t of tasks){
 if(t.chapter&&!chapterById.has(t.chapter))fail('tasks.json 第'+t._row+'行',`章节 ${t.chapter} 不存在`);
 if(t.pre&&!taskById.has(t.pre))fail('tasks.json 第'+t._row+'行',`前置任务 ${t.pre} 不存在`);
 if(!taskTypes.some((tt:unknown)=>(tt as {id:string}).id===t.type))fail('tasks.json 第'+t._row+'行',`任务类型 ${t.type} 不存在`);
 if(t.accept_mode==='talk'&&(!t.accept_npc||!t.accept_map||!t.accept_landmark)&&stepsByTask.get(t.id)?.[0]?.op!=='talk')fail('tasks.json 第'+t._row+'行','accept_mode=talk 须填接取位置或首个talk步骤');
 if(t.accept_npc&&!npcById.has(t.accept_npc))fail('tasks.json 第'+t._row+'行',`接取NPC ${t.accept_npc} 不存在`);
 if(t.giver&&!npcById.has(t.giver))fail('tasks.json 第'+t._row+'行',`委托NPC ${t.giver} 不存在`);
 if(t.dialog_accept&&!linesByGroup.has(t.dialog_accept))fail('tasks.json 第'+t._row+'行',`接取对白组 ${t.dialog_accept} 不存在`);
 if(t.dialog_progress&&!linesByGroup.has(t.dialog_progress))fail('tasks.json 第'+t._row+'行',`进行中对白组 ${t.dialog_progress} 不存在`);
 if(t.dialog_complete&&!linesByGroup.has(t.dialog_complete))fail('tasks.json 第'+t._row+'行',`完成对白组 ${t.dialog_complete} 不存在`);
 // 预留值：运行时尚未实现，直接报错，避免配置看起来生效但游戏里没有表现。
 if(t.accept_mode==='arrive'&&t.campaign!=='starsea')fail('tasks.json 第'+t._row+'行','接取方式 arrive 目前只支持星潮海');
 if(t.accept_mode==='arrive'&&!t.dialog_accept)fail('tasks.json 第'+t._row+'行','接取方式 arrive 须填接取对白组');
 if(t.accept_mode==='step'&&[...(stepsByTask.get(t.id)??[])].sort((a,b)=>a.seq-b.seq)[0]?.op!=='talk')fail('tasks.json 第'+t._row+'行','接取方式 step 要求首个步骤是 talk');
}
for(const st of steps){
 if(!taskById.has(st.task))fail('steps.json 第'+st._row+'行',`任务 ${st.task} 不存在`);
 if(st.npc&&!npcById.has(st.npc))fail('steps.json 第'+st._row+'行',`NPC ${st.npc} 不存在`);
 if(st.prop&&!propById.has(st.prop))fail('steps.json 第'+st._row+'行',`道具 ${st.prop} 不存在`);
 if(st.defense&&!defenseById.has(st.defense))fail('steps.json 第'+st._row+'行',`守护配置 ${st.defense} 不存在`);
}
for(const r of routes)if(!taskById.has(r.task))fail('routes.json 第'+r._row+'行',`任务 ${r.task} 不存在`);
for(const c of chapters){
 if(!npcById.has(c.giver))fail('chapters.json 第'+c._row+'行',`委托NPC ${c.giver} 不存在`);
 if(!npcById.has(c.ally))fail('chapters.json 第'+c._row+'行',`同行NPC ${c.ally} 不存在`);
 if(c.unlock_npc&&!npcById.has(c.unlock_npc))fail('chapters.json 第'+c._row+'行',`入住NPC ${c.unlock_npc} 不存在`);
}
for(const n of npcs)if(n.idle&&!linesByGroup.has(n.idle))fail('npcs.json 第'+n._row+'行',`闲聊对白组 ${n.idle} 不存在`);
for(const tr of triggers){
 if(!taskById.has(tr.task))fail('triggers.json 第'+tr._row+'行',`任务 ${tr.task} 不存在`);
 if(!linesByGroup.has(tr.group))fail('triggers.json 第'+tr._row+'行',`对白组 ${tr.group} 不存在`);
 const where='dialogue.json/triggers 第'+tr._row+'行';
 if(taskById.get(tr.task)?.campaign!=='starsea')fail(where,'触发目前只支持星潮海任务');
 if((tr.event==='step_start'||tr.event==='wave_half')&&!(stepsByTask.get(tr.task)??[]).some(x=>x.seq===tr.step))fail(where,`任务 ${tr.task} 没有步骤 ${tr.step}`);
 if(tr.event==='wave_half'&&!['battle','defend','route_battle'].includes((stepsByTask.get(tr.task)??[]).find(x=>x.seq===tr.step)?.op??''))fail(where,'wave_half 只能挂在战斗步骤上');
 if(tr.event==='map_enter'&&!tr.map)fail(where,'map_enter 须填地图');
 // Trigger dialogue receives the server-evaluated condition targets.
 if(triggers.filter(x=>x.id===tr.id).length>1)fail(where,`触发ID ${tr.id} 重复`);
}
for(const r of skillRecoveryRows){
 const where='tasks.json/skillRecovery 第'+r._row+'行';
 if('task' in r&&r.task&&!taskById.has(r.task))fail(where,`任务 ${r.task} 不存在`);
 if(r.kind==='recovery'&&skillRecoveryRows.some(x=>x!==r&&x.kind==='recovery'&&x.family===r.family&&(x.order===r.order||x.skill===r.skill)))fail(where,`${r.family} 的找回次序或技能重复`);
 if(r.kind==='route'&&skillRecoveryRows.some(x=>x!==r&&x.kind==='route'&&x.family===r.family&&x.task===r.task&&x.choice===r.choice))fail(where,`${r.family} 在 ${r.task} 路线 ${r.choice} 重复`);
}
if(skillRecoveryRows.length&&!skillRecoveryRows.some(r=>r.kind==='slot'&&!r.task))fail('tasks.json/skillRecovery','缺少基础技能槽（slot 且任务为空）');
// 导出：原样导出供其他模块使用，后续再构建具体数据结构
export {taskTypes,tasks,steps,routes,chapters,features,defenses,npcs,lines,triggers,props};
export {taskById,stepsByTask,routesByTask,chapterById,npcById,defenseById,linesByGroup,propById};
/** 对白上下文：route 为本章所选路线槽位（a/b 等），routeName 替换 {route}，player 替换 {player}。 */
export type DialogueContext={route?:string;routeName?:string;player?:string;conditions?:string[]};
const lineVisible=(when:string|undefined,ctx:DialogueContext)=>!when||(when==='route'?Boolean(ctx.route):when==='route='+ctx.route)||Boolean(ctx.conditions?.includes(when!));
/** 按序号返回对白组；带「条件」的行只在上下文满足时出现。说话人保留 NPC 表 ID / player / narrator，显示名由调用方解析。 */
export function dialogueLines(group:string,ctx:DialogueContext={}):DialogueLine[]{
 const found=linesByGroup.get(group);if(!found)return [];
 const selected=[...new Set(found.map(l=>l.seq))].sort((a,b)=>a-b).flatMap(seq=>{const at=found.filter(l=>l.seq===seq),matching=at.filter(l=>l.when&&lineVisible(l.when,ctx));return matching.length?matching:at.filter(l=>!l.when);});
 return selected.map(l=>({speaker:l.name||l.speaker,text:l.text.replaceAll('{route}',ctx.routeName??'').replaceAll('{player}',ctx.player??'你')}));
}
