import {describe,expect,it} from 'vitest';
import {treasureChaseGoal,treasureChaseStatus,withTreasureChaseMarker,type TreasureChase} from '../apps/web/src/treasure-chase-view.ts';
import {minimapMainTarget,type MapMarker} from '../apps/web/src/ui/minimap-data.ts';
import {hubHudHtml} from '../apps/web/src/hub/hub-hud.ts';

const chase=(patch:Partial<TreasureChase>={}):TreasureChase=>({chestId:'box-1',enemyId:'mimic-1',phase:'running',position:{x:12,y:10},intercept:{x:18,y:14},remainingSeconds:15,interceptions:1,...patch});

describe('treasure chase direction and HUD',()=>{
 it('points running players ahead at the published interception point',()=>{
  const state=chase(),before=structuredClone(state);
  expect(treasureChaseGoal(state)).toEqual({x:18,y:14,label:'抢到前方，截住宝箱怪'});expect(state).toEqual(before);
 });
 it('falls back to the actual target when no interception point is published',()=>{
  expect(treasureChaseGoal(chase({intercept:undefined}))).toEqual({x:12,y:10,label:'追上宝箱怪，夺回宝物'});
  expect(treasureChaseGoal(undefined)).toBeUndefined();
 });
 it.each(['waking','staggered','cornered'] as const)('guides %s toward the actual mimic, not its old route',phase=>{
  expect(treasureChaseGoal(chase({phase}))).toMatchObject({x:12,y:10});
 });
 it('shows only the published interception count and phase state',()=>{
  expect(treasureChaseStatus(chase({phase:'waking',interceptions:0}))).toEqual({label:'宝箱苏醒',tone:'neutral'});
  expect(treasureChaseStatus(chase({phase:'staggered',interceptions:2}))).toEqual({label:'喘息中 · 堵截 2 次',tone:'info'});
  expect(treasureChaseStatus(chase({phase:'cornered',interceptions:3}))).toEqual({label:'已堵住 · 堵截 3 次',tone:'success'});
 });
 it('adds one shared status badge without new controls or replacing the objective',()=>{
  const objective={kind:'open-chests' as const,text:'夺回宝物',progress:{done:2,total:5},timeLeft:88};
  const html=hubHudHtml({objective,chase:chase({phase:'staggered',interceptions:2})});
  expect(html).toContain('夺回宝物');expect(html).toContain('2/5');expect(html).toContain('88s');expect(html).toContain('喘息中 · 堵截 2 次');
  expect(html.match(/data-treasure-chase-state/g)).toHaveLength(1);expect(html).toContain('data-ui="status"');expect(html).not.toContain('<button');
  expect(hubHudHtml({objective})).not.toContain('data-treasure-chase-state');
 });
});

describe('treasure chase radar priority',()=>{
 const markers:MapMarker[]=[{id:'npc',name:'营地同伴',x:1,y:1,main:false},{id:'quest',name:'附近任务',x:2,y:2,main:true},{id:'activity',name:'附近活动',x:3,y:3,main:false,question:true}];
 it('keeps all original markers intact and selects the chase ahead of a closer quest',()=>{
  const before=structuredClone(markers),withChase=withTreasureChaseMarker(markers,chase());
  expect(withChase).toHaveLength(markers.length+1);expect(withChase.slice(1)).toEqual(before);expect(markers).toEqual(before);
  expect(minimapMainTarget(withChase,n=>n,{x:0,y:0})?.marker.id).toBe('treasure-chase:mimic-1');
 });
 it('returns the normal closest main marker after the chase ends',()=>{
  const without=withTreasureChaseMarker(markers,undefined);expect(without).toEqual(markers);
  expect(minimapMainTarget(without,n=>n,{x:0,y:0})?.marker.id).toBe('quest');
 });
 it('preserves nearest-target behavior at the default priority and ignores question marks',()=>{
  const goals:MapMarker[]=[{name:'far',x:9,y:0,main:true},{name:'question',x:0,y:0,main:true,question:true,priority:-2},{name:'near',x:3,y:0,main:true}];
  expect(minimapMainTarget(goals,n=>n,{x:0,y:0})?.marker.name).toBe('near');
  expect(minimapMainTarget([],n=>n,{x:0,y:0})).toBeUndefined();
 });
});
