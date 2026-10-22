import type {CharacterState,TaskEntry} from '../../../packages/contracts/index.ts';
import {tasks,steps,taskTypes,chapters} from '../../../packages/content/task-tables.ts';
import {starseaView,starseaTracked,type QuestCompletion} from '../../../packages/rules/starsea.ts';
import {bountyRow,bountyNeed,bountyXpShare,type Bounty} from '../../../packages/rules/bounty.ts';
import {worldTables} from '../../../packages/content/world-tables.ts';
export function questEntry(s:CharacterState,id:string):TaskEntry{
 const row=tasks.find(t=>t.id===id&&t.campaign==='starsea');if(!row)throw Error('Unknown quest '+id);
 const run=s.starsea?.quests[id],total=row.type==='bounty'?bountyNeed(row):steps.filter(st=>st.task===id).length,chapter=chapters.find(c=>c.id===row.chapter);
 const zone=row.type==='bounty'?worldTables.zones.find(z=>z.id===row.zone):undefined;
 return {id:'current:'+id,taskId:id,typeId:row.type,typeName:taskTypes.find(t=>t.id===row.type)?.name??row.type,title:row.title,state:run?'active':'available',goal:row.goal,current:run?.step??0,total:Math.max(1,total),summary:row.summary??row.goal,story:row.story??null,area:zone?.name??chapter?.island??null,place:zone?.name??row.place??row.goal,regionId:zone?.region??steps.find(st=>st.task===id)?.map??null,tags:[...row.tags,...(row.series?.startsWith('isle-')&&row.type==='side'?['岛屿故事']:[])],reward:{xp:s.starsea?.hardmode?row.reward_xp_hardmode??row.reward_xp??0:row.reward_xp??0,gold:row.reward_gold??0,material:0},goalAt:null,claimedAt:null,chain:tasks.filter(t=>t.id===row.pre||t.pre===id).map(t=>({taskId:t.id,title:t.title})),note:run?'完成后会自动发放奖励。':'前往发现点或人物身边接取。',source:'current',tracked:starseaTracked(s)===id,abandonable:row.type!=='guide'&&row.abandonable!==false,series:row.series,thread:row.thread};
}
function bountyEntry(b:Bounty):TaskEntry|undefined{
 const row=bountyRow(b.task);if(!row||b.acceptedAt===undefined||b.cooldownUntil!==undefined)return;
 const zone=worldTables.zones.find(z=>z.id===b.zone),total=bountyNeed(row);
 return {id:'current-bounty:'+b.instance,taskId:row.id,bountyInstance:b.instance,typeId:'bounty',typeName:taskTypes.find(t=>t.id==='bounty')!.name,title:row.title,state:b.progress>=total?'ready':'active',goal:row.goal,current:Math.min(b.progress,total),total,summary:row.summary??row.goal,story:row.story??null,area:zone?.name??null,place:zone?.name??null,regionId:zone?.region??null,tags:[...row.tags],reward:{gold:row.reward_gold??0,material:row.reward_material??0,xp:Math.round(b.xp*bountyXpShare)},goalAt:null,claimedAt:null,chain:[],note:'',source:'current',abandonable:true};
}
export function currentQuests(s:CharacterState){const view=starseaView(s);if(!view)return [];return [...view.quests.map(q=>questEntry(s,q.id)),...view.available.map(q=>questEntry(s,q.task)),...(s.starsea?.bounties??[]).flatMap(b=>{const row=bountyEntry(b);return row?[row]:[];})];}
export function archiveQuestCompletions(s:CharacterState,completed:QuestCompletion[],command:string,at:string){s.taskJournal??={completed:{},archive:[]};for(const c of completed){const row=tasks.find(t=>t.id===c.id)!;if(row.type!=='bounty'&&s.taskJournal.archive.some(e=>e.taskId===c.id))continue;const entry=questEntry(s,c.id);s.taskJournal.completed[c.id]??=at;s.taskJournal.archive.push({...entry,id:'archive:'+command+':'+c.id,state:'archived',...(c.bountyInstance?{bountyInstance:c.bountyInstance}:{}),...(c.choice?{choice:c.choice}:{}),current:entry.total,reward:{gold:c.gold,xp:c.xp,material:0},goalAt:at,claimedAt:at,note:'奖励已确认领取。',source:'confirmed'});}}
