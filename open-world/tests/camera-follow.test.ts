import {describe,expect,it} from 'vitest';
import {newFollow,stepFollow} from '../apps/web/src/camera-follow.ts';

const run=(state:ReturnType<typeof newFollow>,frames:number,fn:(i:number)=>[number,number],opt={reduced:false,bossNear:false})=>{let out={x:0,y:0,push:0};for(let i=0;i<frames;i++){const [x,y]=fn(i);out=stepFollow(state,x,y,16.7,opt);}return out;};

describe('camera follow (UX-A05)',()=>{
 it('starts locked on the hero and never lags more than a few pixels when standing still',()=>{
  const s=newFollow(),o=run(s,120,()=>[100,50]);
  expect(Math.hypot(o.x-100,o.y-50)).toBeLessThan(0.5);expect(o.push).toBe(0);
 });
 it('looks ahead of a moving hero but stays bounded',()=>{
  const s=newFollow(),o=run(s,180,i=>[i*4,0]);// 240 px/s
  const hero=179*4;expect(o.x).toBeGreaterThan(hero-10);expect(o.x-hero).toBeLessThan(75);
 });
 it('settles back on the hero after stopping',()=>{
  const s=newFollow();run(s,120,i=>[i*4,0]);const o=run(s,240,()=>[119*4,0]);
  expect(Math.abs(o.x-119*4)).toBeLessThan(1);
 });
 it('snaps instead of gliding across a teleport',()=>{
  const s=newFollow();run(s,30,()=>[0,0]);const o=stepFollow(s,2000,900,16.7,{reduced:false,bossNear:false});
  expect(o.x).toBe(2000);expect(o.y).toBe(900);
 });
 it('pushes in near a boss, eases out afterwards, and stays at 0 when reduced',()=>{
  const s=newFollow();let o=run(s,240,()=>[0,0],{reduced:false,bossNear:true});
  expect(o.push).toBeGreaterThan(0.05);expect(o.push).toBeLessThanOrEqual(0.0601);
  o=run(s,300,()=>[0,0],{reduced:false,bossNear:false});expect(o.push).toBeLessThan(0.003);
  const r=newFollow();o=run(r,60,i=>[i,0],{reduced:true,bossNear:true});expect(o).toEqual({x:59,y:0,push:0});
 });
});
