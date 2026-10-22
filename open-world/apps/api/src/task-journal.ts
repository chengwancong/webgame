import type {CharacterState} from '../../../packages/contracts/index.ts';
import {versions} from '../../../packages/contracts/index.ts';
import type {TaskEntry,TaskJournal,TaskView} from '../../../packages/contracts/tasks.ts';
import {taskDefinitions,taskTypes,type TaskDefinition} from '../../../packages/content/tasks.ts';
import {resolveBossAccess} from '../../../packages/rules/boss-access.ts';
import {rewards} from './economy.ts';
import {storyChapter} from '../../../packages/content/story-campaign.ts';
import {storyHas} from '../../../packages/rules/story-campaign.ts';
import {applyXp} from '../../../packages/rules/index.ts';
import {currentQuests} from './quest-journal.ts';
export function journal(s:CharacterState):TaskJournal{return s.taskJournal??={completed:{},archive:[]};}
export function taskProgress(s:CharacterState,d:TaskDefinition){if(d.condition.kind==='story'){const chapter=storyChapter(d.condition.chapter)!,current=chapter.phases.filter(p=>storyHas(s,chapter.id+':'+p.id)).length+(storyHas(s,chapter.id+':boss')?1:0);return {current,total:chapter.phases.length+1};}return d.condition.kind==='kills'?{current:Math.min(s.progress.kills,d.condition.required),total:d.condition.required}:{current:s.progress.bosses.includes(d.condition.boss)?1:0,total:1};}
export function completionState(s:CharacterState){return Object.fromEntries(taskDefinitions.map(d=>{const p=taskProgress(s,d);return [d.id,p.current>=p.total];}));}
export function recordTaskCompletions(s:CharacterState,before:Record<string,boolean>,at:string){const state=journal(s);for(const d of taskDefinitions){const p=taskProgress(s,d);if(!before[d.id]&&p.current>=p.total&&!Object.hasOwn(state.completed,d.id))state.completed[d.id]=at;}}
function currentEntry(s:CharacterState,d:TaskDefinition):TaskEntry{
 const progress=taskProgress(s,d),ready=progress.current>=progress.total;
 const note=d.condition.kind==='boss'&&!ready?resolveBossAccess(s.progress)[d.condition.boss]?.message??d.note??'':ready?d.noteReady??'':d.note??'';
 const chapter=d.condition.kind==='story'?storyChapter(d.condition.chapter):undefined,goal=chapter?ready?d.goalReady||d.goal:chapter.phases.find(p=>!storyHas(s,chapter.id+':'+p.id))?.objective||d.goalFinal||d.goalReady||d.goal:d.goal;
 return {id:'current:'+d.id,taskId:d.id,typeId:d.typeId,typeName:taskTypes.find(t=>t.id===d.typeId)?.name??d.typeId,title:d.title,state:ready?'ready':'active',goal,...progress,summary:d.summary,story:d.story,area:d.area,place:d.place,regionId:d.regionId,tags:[...d.tags],reward:d.reward??{gold:rewards.taskGold,material:rewards.taskMaterial,xp:0},goalAt:s.taskJournal?.completed[d.id]??null,claimedAt:null,chain:structuredClone(d.chain),note,source:'current'};
}
export function resolveTasks(s:CharacterState):TaskView{
 const archive=s.taskJournal?.archive??[];
 if(s.starsea)return {characterId:s.id,revision:s.revision,ruleset_version:versions.rules,types:structuredClone(taskTypes.filter(t=>['guide','side','bounty','main'].includes(t.id)).map(t=>t.id==='main'?{...t,enabled:false}:t)),current:currentQuests(s),archive:structuredClone(archive)};
 return {characterId:s.id,revision:s.revision,ruleset_version:versions.rules,types:structuredClone(taskTypes.filter(t=>!["guide","bounty"].includes(t.id))),current:taskDefinitions.filter(d=>!s.progress.tasks.includes(d.id)&&(!d.requires||storyHas(s,d.requires))).map(d=>currentEntry(s,d)),archive:structuredClone(archive)};
}
export function claimTask(s:CharacterState,id:string,commandId:string,at:string):TaskEntry|undefined{
 const d=taskDefinitions.find(t=>t.id===id);if(!d)return;
 const entry=currentEntry(s,d);if(entry.state!=='ready'||s.progress.tasks.includes(id))return;
 const state=journal(s);if(state.archive.some(r=>r.taskId===id))return;
 const archived:TaskEntry={...structuredClone(entry),id:'archive:'+commandId,state:'archived',claimedAt:at,source:'confirmed',note:'奖励已确认领取。'};
 s.progress.tasks.push(id);s.gold+=entry.reward!.gold;s.material+=entry.reward!.material;if(entry.reward!.xp)applyXp(s,entry.reward!.xp);state.archive.push(archived);return archived;
}
type LegacyReceipt={receipt:{revision:number;delta:{gold:number;material:number;xp:number};snapshot:{progress?:{tasks?:string[]}}};created:Date|string|null};
export function migrateTaskJournal(s:CharacterState,receipts:LegacyReceipt[]){
 const state=journal(s);
 for(const id of s.progress.tasks){if(state.archive.some(r=>r.taskId===id))continue;
  const d=taskDefinitions.find(t=>t.id===id);
  const index=receipts.findIndex(row=>row.receipt.snapshot.progress?.tasks?.includes(id));
  const hit=receipts[index],prior=receipts[index-1],old=prior?.receipt.snapshot.progress?.tasks;
  const added=hit?.receipt.snapshot.progress?.tasks?.filter(task=>!old?.includes(task));
  // A consecutive, single-task transition proves this command's reward. Do not
  // infer a historical payment from the current reward table or a later snapshot.
  const proof=hit&&prior&&old&&hit.receipt.revision===prior.receipt.revision+1&&added?.length===1&&added[0]===id;
  const delta=proof?hit.receipt.delta:null;
  const valid=delta&&[delta.gold,delta.material,delta.xp].every(n=>Number.isInteger(n)&&n>=0);
  state.completed[id]??=null;
  state.archive.push({id:'legacy:'+id,taskId:id,typeId:d?.typeId??'legacy',typeName:taskTypes.find(t=>t.id===d?.typeId)?.name??'历史未分类',title:d?.title??id,state:'archived',goal:null,current:null,total:null,summary:null,story:null,area:null,place:null,regionId:null,tags:[],reward:valid?{gold:delta.gold,material:delta.material,xp:delta.xp}:null,goalAt:null,claimedAt:proof&&hit.created?new Date(hit.created).toISOString():null,chain:null,note:'旧记录未保存的内容显示为未记录。',source:valid?'legacy-receipt':'legacy-unrecorded'});
 }
}
