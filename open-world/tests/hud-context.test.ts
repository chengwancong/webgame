import {describe,it,expect} from 'vitest';
import {regionById} from '../packages/content/index.ts';
import {hudContext,hudModeBlocked,combatModeHtml,hudStatusHtml,questTrackerHtml} from '../apps/web/src/hud-context.ts';
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
 it('shows the mode control only in dungeons, as an A1 menu button; field and town are manual only',()=>{
  const dungeon={...options,context:'dungeon' as const},closed=combatModeHtml('semi',false,dungeon);
  expect(closed).toContain('hud-mode-toggle');expect(closed).toContain('class="entry hud-mode-current"');expect(closed).toContain('半自动');expect(closed).not.toContain('data-action="mode"');
  const open=combatModeHtml('semi',true,dungeon);expect(open.match(/data-action="mode"/g)).toHaveLength(3);expect(open.match(/aria-current="true"/g)).toHaveLength(1);
  for(const context of ['field','home','result'] as const)expect(combatModeHtml('semi',true,{...options,context})).toBe('');
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
