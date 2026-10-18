// 任务页：类型目录与任务定义来自 config/excel/任务.xlsx（「任务类型」与「任务」页签中 进入任务页=是 的行）。
import type {TaskType} from '../contracts/tasks.ts';
import {taskTypes as typeRows,tasks} from './task-tables.ts';
import {storyChapter} from './story-campaign.ts';
export const taskTypes:TaskType[]=typeRows.map(({_row,...t})=>t as TaskType);
export type TaskDefinition={id:string;typeId:string;title:string;goal:string;summary:string;story:string;regionId:string;area:string;place:string;tags:string[];condition:{kind:'kills';required:number}|{kind:'boss';boss:string}|{kind:'story';chapter:string};requires?:string;reward?:{gold:number;material:number;xp:number};chain:{taskId:string;title:string}[];
 /** 任务页提示（任务.xlsx 进行中提示 / 可领取提示 / 报告目标 / 首领目标）。 */
 note?:string;noteReady?:string;goalReady?:string;goalFinal?:string};
const fail=(msg:string):never=>{throw Error('配置表 任务.xlsx：'+msg);};
// Starsea v2 owns its accepted steps and confirmed archives through
// currentQuests/archiveQuestCompletions. Legacy aggregate goals remain here.
const journal=tasks.filter(t=>t.journal&&t.campaign!=='starsea');
function condition(t:typeof tasks[number]):TaskDefinition['condition']{
 if(t.cond_kind==='kills')return {kind:'kills',required:t.cond_count??fail(`任务 ${t.id} 缺少条件数量`)};
 if(t.cond_kind==='boss')return {kind:'boss',boss:t.cond_value??fail(`任务 ${t.id} 缺少首领地区`)};
 if(t.cond_kind==='story')return {kind:'story',chapter:t.cond_value??fail(`任务 ${t.id} 缺少章节`)};
 return fail(`进入任务页的任务 ${t.id} 缺少完成条件`);
}
export const taskDefinitions:TaskDefinition[]=journal.map(t=>{
 const cond=condition(t),chapter=cond.kind==='story'?storyChapter(cond.chapter)??fail(`任务 ${t.id} 的章节 ${cond.chapter} 不存在`):undefined;
 const hasReward=t.reward_gold!==undefined||t.reward_material!==undefined||t.reward_xp!==undefined;
 const chain=[...journal.filter(x=>x.id===t.pre),...journal.filter(x=>x.pre===t.id)].map(x=>({taskId:x.id,title:x.title}));
 return {id:t.id,typeId:t.type,title:t.title,goal:t.goal,
  summary:t.summary??(chapter?chapter.intro.map(l=>l.text).join('\n'):fail(`任务 ${t.id} 缺少任务页简介`)),
  story:t.story??(chapter?chapter.returnDialogue.map(l=>l.speaker+'：'+l.text).join('\n'):fail(`任务 ${t.id} 缺少任务页剧情`)),
  regionId:t.region??fail(`任务 ${t.id} 缺少地区ID`),area:t.area??fail(`任务 ${t.id} 缺少地区名`),place:t.place??fail(`任务 ${t.id} 缺少地点`),tags:[...t.tags],condition:cond,
  ...(t.show_when?{requires:t.show_when}:{}),...(hasReward?{reward:{gold:t.reward_gold??0,material:t.reward_material??0,xp:t.reward_xp??0}}:{}),chain,
  ...(t.note?{note:t.note}:{}),...(t.note_ready?{noteReady:t.note_ready}:{}),...(t.goal_ready?{goalReady:t.goal_ready}:{}),...(t.goal_final?{goalFinal:t.goal_final}:{})};
});
