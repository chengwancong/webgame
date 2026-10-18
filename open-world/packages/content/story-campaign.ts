// 最后一条归途：章节、阶段、路线、对白与 NPC 全部来自 config/excel（任务.xlsx、章节.xlsx、NPC.xlsx、对话.xlsx）。
import type {StoryFeature} from '../contracts/story.ts';
import {tasks,chapters,features,npcs,stepsByTask,routesByTask,dialogueLines} from './task-tables.ts';
export type StoryWave={art:string;count:number;elite?:boolean};
export type StoryPhase={id:string;title:string;kind:'investigate'|'battle'|'choice'|'rescue'|'defend';objective:string;speaker:string;line:string;waves?:StoryWave[];seconds?:number;xp:number;spawnAt?:'clue'|'ally';allyLocked?:boolean};
export type StoryChapter={id:string;title:string;area:string;boss:string;npc:string;ally:string;level:number;intro:{speaker:string;text:string}[];returnDialogue:{speaker:string;text:string}[];progress?:{speaker:string;text:string}[];phases:StoryPhase[];routes:{id:string;name:string;description:string;waves:StoryWave[]}[];skills:string[];feature:StoryFeature;closeXp:number;bossSpeaker?:string;bossLine?:string;readyObjective?:string;readySpeaker?:string;readyLine?:string};
export type StoryNpc={id:string;name:string;role:string;setId:string;camp:{x:number;y:number};weapon:boolean;appear?:string;idle?:string;serviceFeature?:StoryFeature};
const fail=(msg:string):never=>{throw Error('配置表（最后一条归途）：'+msg);};
export const storyNpcs:StoryNpc[]=npcs.filter(n=>n.campaign==='homeward').map(n=>({id:n.id,name:n.name,role:n.role,setId:n.set_id??fail(`NPC ${n.id} 缺少外观套装`),camp:{x:n.x,y:n.y},weapon:n.weapon,...(n.appear?{appear:n.appear}:{}),...(n.idle?{idle:n.idle}:{}),...(n.service_feature?{serviceFeature:n.service_feature}:{})}));
/** 对白说话人填 NPC 表 ID 时显示名字，否则原样显示。 */
const speakerName=(id:string)=>storyNpcs.find(n=>n.id===id)?.name??(id==='player'?'你':id);
const lines=(group?:string)=>group?dialogueLines(group).map(l=>({speaker:speakerName(l.speaker),text:l.text})):[];
const kindOf={interact:'investigate',battle:'battle',choose:'choice',rescue:'rescue',defend:'defend'} as const;
export const storyChapters:StoryChapter[]=chapters.filter(c=>c.campaign==='homeward').sort((a,b)=>a.order-b.order).map(c=>{
 const task=tasks.find(t=>t.campaign==='homeward'&&t.chapter===c.id)??fail(`章节 ${c.id} 没有对应任务`);
 const phases=[...(stepsByTask.get(task.id)??[])].sort((a,b)=>a.seq-b.seq).map((r):StoryPhase=>{
  const kind=kindOf[r.op as keyof typeof kindOf]??fail(`任务 ${task.id} 步骤 ${r.seq}：归途不支持步骤类型 ${r.op}`);
  return {id:r.key,title:r.title??fail(`任务 ${task.id} 步骤 ${r.seq} 缺少阶段标题`),kind,objective:r.label,speaker:speakerName(r.speaker??''),line:r.line??'',xp:r.xp,...(r.waves?{waves:r.waves}:{}),...(r.seconds!==undefined?{seconds:r.seconds}:{}),...(r.spawn_at?{spawnAt:r.spawn_at}:{}),...(r.ally_locked?{allyLocked:true}:{})};
 });
 const routes=(routesByTask.get(task.id)??[]).map(r=>({id:r.id,name:r.name,description:r.description??'',waves:r.waves??[]}));
 return {id:c.id,title:c.title,area:c.map,boss:c.boss,npc:c.giver,ally:c.ally,level:c.level??1,feature:c.feature??fail(`章节 ${c.id} 缺少解锁功能`),skills:[...c.skills],closeXp:task.reward_xp??0,
  intro:lines(task.dialog_accept),returnDialogue:lines(task.dialog_complete),progress:lines(task.dialog_progress),phases,routes,
  bossSpeaker:c.boss_speaker,bossLine:c.boss_line,readyObjective:c.ready_objective,readySpeaker:c.ready_speaker,readyLine:c.ready_line};
});
export const storyFeatures:{id:StoryFeature;name:string;event:string;reason:string}[]=features.filter(f=>!f.event.startsWith('feature:')).map(f=>({id:f.id,name:f.name,event:f.event,reason:f.reason}));
/** 星潮海角色的功能未开放说明（章节.xlsx 功能解锁「星潮海未开放说明」）。 */
export const starseaFeatureReasons=Object.fromEntries(features.map(f=>[f.id,f.starsea_reason])) as Record<StoryFeature,string>;
export const storyChapter=(id:string)=>storyChapters.find(c=>c.id===id);
/** 营地闲聊：NPC 表「闲聊对白组」的第一句。 */
export const storyIdleLine=(id:string)=>{const n=storyNpcs.find(x=>x.id===id);return n?.idle?dialogueLines(n.idle)[0]?.text:undefined;};
