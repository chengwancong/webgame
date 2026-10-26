import {describe,it,expect} from 'vitest';
import {regionById} from '../packages/content/index.ts';
import {hudContext,hudModeBlocked,autoStatusHtml,hudStatusHtml,questTrackerHtml} from '../apps/web/src/hud-context.ts';
import type {TaskView} from '../packages/contracts/index.ts';
describe('HUD context and action boundaries',()=>{
 it('uses configured peaceful maps, without treating field spawn checkpoints as safe',()=>{
  expect(hudContext(regionById('town'))).toBe('home');expect(hudContext(regionById('meadow'))).toBe('field');expect(hudContext(regionById('meadow-boss'))).toBe('field');
  expect(hudContext(regionById('town'),true)).toBe('dungeon');expect(hudContext(regionById('meadow'),false,true)).toBe('result');
 });
 const options={blocked:false,processing:false,hp:100,full:true,context:'field' as const};
 it('keeps manual and semi available on a full field bag, while disallowing auto',()=>{
  expect(hudModeBlocked('manual',options)).toBe(false);expect(hudModeBlocked('semi',options)).toBe(false);expect(hudModeBlocked('auto',options)).toBe(true);
  expect(hudModeBlocked('auto',{...options,context:'dungeon'})).toBe(false);expect(hudModeBlocked('manual',{...options,hp:0})).toBe(true);
 });
 it('shows auto status instead of a mode switch: running, takeover, or stopped with resume (doc 27 R1)',()=>{
  const field={...options,context:'field' as const,full:false},dungeon={...field,context:'dungeon' as const};
  for(const o of [field,dungeon]){expect(autoStatusHtml('auto',false,o)).toContain('自动中');expect(autoStatusHtml('auto',true,o)).toContain('接管中');expect(autoStatusHtml('auto',false,o)).not.toContain('data-action');}
  const stopped=autoStatusHtml('semi',false,field);expect(stopped).toContain('已停止');expect(stopped).toContain('data-action="auto-resume"');expect(stopped).not.toMatch(/data-action="auto-resume"[^>]*disabled/);
  expect(autoStatusHtml('semi',false,{...field,full:true})).toMatch(/data-action="auto-resume"[^>]*disabled/);
  for(const context of ['home','result'] as const)expect(autoStatusHtml('auto',false,{...options,context})).toBe('');
  expect(autoStatusHtml('semi',false,field)).not.toContain('hud-mode');
 });
 const bag={gear:Array.from({length:24},()=>({})) as any[],capacity:24};
 it('never generates a return-to-town action from full inventory in an active dungeon',()=>{
  const dungeon=hudStatusHtml(bag,'dungeon',false,'背包已满');expect(dungeon).toContain('副本继续');expect(dungeon).toContain('data-id="bag"');expect(dungeon).not.toContain('camp-sort');
  expect(hudStatusHtml(bag,'field')).toContain('camp-sort');const home=hudStatusHtml(bag,'home');expect(home).toContain('整理');expect(home).not.toContain('全自动已停止');
 });
 it('uses supplied task progress and distinguishes unrecorded progress from zero',()=>{
  const task={current:[{id:'task:a',typeName:'支线',title:'测试追踪',goal:'与同伴交谈',note:'',current:null,total:null,state:'active'}]} as unknown as TaskView;
  const html=questTrackerHtml(task);expect(html).toContain('hud-task-open');expect(html).toContain('测试追踪');expect(html).not.toContain('null');expect(html).not.toContain('0/');
  task.current[0].current=2;task.current[0].total=3;expect(questTrackerHtml(task)).toContain('2/3');
 });
 it('no longer shows the retired homecoming main line in the tracker',()=>{
  const html=questTrackerHtml(undefined);expect(html).not.toContain('主线');expect(html).not.toContain('story-npc');
 });
});
