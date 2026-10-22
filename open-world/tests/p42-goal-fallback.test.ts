import {it,expect} from 'vitest';
import {taskDefinitions} from '../packages/content/tasks.ts';
import {storyChapter} from '../packages/content/story-campaign.ts';
import {resolveTasks} from '../apps/api/src/task-journal.ts';
import {standardState} from '../tools/spine/player.ts';
const stories=taskDefinitions.filter(t=>t.condition.kind==='story');
it('P42 retains authored phase goals and final/report navigation for all six chapters',()=>{
 expect(stories).toHaveLength(6);expect(new Set(stories.map(t=>t.goal)).size).toBe(6);
 for(const d of stories){const c=storyChapter((d.condition as {chapter:string}).chapter)!,s=standardState(50);delete s.starsea;s.progress.tasks=[];s.story={version:1,legacyAccess:true,events:{},choices:{}};if(d.requires)s.story.events[d.requires]='qa';
  const goal=()=>resolveTasks(s).current.find(t=>t.taskId===d.id)!.goal;
  for(const p of c.phases){expect(goal()).toBe(p.objective);s.story.events[c.id+':'+p.id]='qa';}
  expect(goal()).toBe(d.goalFinal);s.story.events[c.id+':boss']='qa';expect(goal()).toBe(d.goalReady);
 }
});
it('P42 empty or missing stage/final/report goals fall back to the six authored base goals, without mutating character state',()=>{
 for(const d of stories){const c=storyChapter((d.condition as {chapter:string}).chapter)!,p=c.phases[0],old={objective:p.objective,final:d.goalFinal,ready:d.goalReady};
  const s=standardState(50);delete s.starsea;s.progress.tasks=[];s.story={version:1,legacyAccess:true,events:{},choices:{}};if(d.requires)s.story.events[d.requires]='qa';const before=structuredClone(s);
  try{p.objective='';d.goalFinal='';d.goalReady='';expect(resolveTasks(s).current.find(t=>t.taskId===d.id)!.goal).toBe(d.goal);d.goalFinal=undefined;d.goalReady=undefined;expect(resolveTasks(s).current.find(t=>t.taskId===d.id)!.goal).toBe(d.goal);expect(s).toEqual(before);}
  finally{p.objective=old.objective;d.goalFinal=old.final;d.goalReady=old.ready;}
 }
});
