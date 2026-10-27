import {describe,expect,it} from 'vitest';
import {ClientMovementDriver,type ClientMovementContext} from '../apps/web/src/client-movement-driver.ts';
import type {ClientMovementView} from '../packages/contracts/client-movement.ts';
import type {Region} from '../packages/content/index.ts';
const region:Region={id:'client-move-test',name:'移动',subtitle:'',theme:'meadow',width:40,height:40,safe:{x:10,y:10},portal:{x:4,y:4},landmarks:[],obstacles:[],spawns:[],boss:false,auto:false};
const context:ClientMovementContext={region,speed:6,radius:.35};
const view=(change:Partial<ClientMovementView>={}):ClientMovementView=>({epoch:'run:1:map',revision:0,ack:0,owner:'server',position:{x:10,y:10},...change});
const conditions={alive:true,blocked:false,connected:true};
function driver(){const d=new ClientMovementDriver();d.sync(view(),{x:10,y:10},0,conditions);return d;}

describe('client-owned movement driver',()=>{
 it('moves locally and ignores old normal server positions while owning movement',()=>{
  const d=driver();d.direction({x:1,y:0},0);expect(d.active).toBe(true);
  expect(d.advance(100,context).x).toBeCloseTo(10.6);expect(d.position.y).toBe(10);
  d.sync(view({owner:'client'}),{x:10,y:10},100,conditions);
  expect(d.advance(200,context).x).toBeCloseTo(11.2);expect(d.moving).toBe(true);expect(d.facing).toBe(1);
 });
 it('reports changes immediately, coalesces constant movement and keeps it alive at 750ms',()=>{
  const d=driver();d.direction({x:1,y:0},0);d.advance(16,context);const first=d.takeReport(16)!;
  expect(first).toMatchObject({seq:1,active:true});expect(first.direction.x).toBeCloseTo(1);expect(first.direction.y).toBe(0);
  for(let t=32;t<=736;t+=16){d.direction({x:1,y:0},t);d.advance(t,context);expect(d.takeReport(t)).toBeUndefined();}
  d.advance(766,context);expect(d.takeReport(766)?.seq).toBe(2);
  d.direction({x:0,y:1},767);d.advance(783,context);expect(d.takeReport(783)?.direction.y).toBeCloseTo(1);
 });
 it('stops immediately, holds for 1.5s, then waits for release acknowledgement before handing off',()=>{
  const d=driver();d.direction({x:1,y:0},0);d.advance(100,context);d.takeReport(100);
  d.direction({x:0,y:0},110);const stop=d.takeReport(110)!;expect(stop.direction).toEqual({x:0,y:0});expect(stop.active).toBe(false);expect(d.moving).toBe(false);
  const position=d.position;expect(d.advance(300,context)).toEqual(position);
  expect(d.takeReport(1609)?.release).not.toBe(true);
  const release=d.takeReport(1610)!;expect(release).toMatchObject({active:false,release:true});expect(d.active).toBe(true);
  d.sync(view({owner:'server',ack:release.seq-1}),{x:9,y:10},1700,conditions);expect(d.active).toBe(true);expect(d.position).toEqual(position);
  d.sync(view({owner:'server',ack:release.seq}),{x:10.7,y:10},1800,conditions);
  expect(d.active).toBe(false);expect(d.handoffPosition).toEqual(position);expect(d.position).toEqual(position);
  expect(d.advance(1816,context)).toEqual({x:10.7,y:10});
 });
 it('new input supersedes an outstanding release and ignores its late acknowledgement',()=>{
  const d=driver();d.direction({x:1,y:0},0);d.advance(100,context);d.direction({x:0,y:0},100);
  const release=d.takeReport(1600)!;d.direction({x:-1,y:0},1610);d.advance(1626,context);const fresh=d.takeReport(1626)!;
  expect(fresh.seq).toBeGreaterThan(release.seq);expect(fresh.active).toBe(true);
  d.sync(view({ack:release.seq,owner:'server'}),{x:10,y:10},1640,conditions);expect(d.active).toBe(true);expect(d.facing).toBe(-1);
 });
 it('uses local navigation for click-to-walk and zero keyboard input does not cancel its path',()=>{
  const map:Region={...region,obstacles:[{x:12,y:9,w:1,h:2}]},ctx={...context,region:map};const d=driver();
  expect(d.go({x:15,y:10},ctx,0)).toBe(true);let reports=0;
  for(let t=16;t<=3000;t+=16){d.direction({x:0,y:0},t);const p=d.advance(t,ctx);expect(p.x<=11.650001||p.x>=13.349999||p.y<=8.650001||p.y>=11.349999).toBe(true);if(d.takeReport(t))reports++;}
  expect(d.position.x).toBeCloseTo(15,4);expect(d.position.y).toBeCloseTo(10,4);expect(d.moving).toBe(false);expect(reports).toBeGreaterThan(2);
 });
 it('does not report requested velocity through a wall',()=>{
  const d=new ClientMovementDriver(),ctx={...context,region:{...region,obstacles:[{x:11,y:2,w:.1,h:30}]}};
  d.sync(view(),{x:10.64,y:10},0,conditions);d.direction({x:1,y:0},0);
  for(let t=16;t<=500;t+=16)d.advance(t,ctx);
  expect(d.position.x).toBeLessThanOrEqual(10.65);expect(d.takeReport(500)?.direction).toEqual({x:0,y:0});expect(d.active).toBe(true);
 });
 it('uses the supplied nearby bodies and reports a stopped pose at a solid unit',()=>{
  const d=driver(),ctx={...context,bodies:()=>[{id:'near-enemy',position:{x:11,y:10},radius:.5}]};d.direction({x:1,y:0},0);
  for(let t=16;t<=500;t+=16)d.advance(t,ctx);
  expect(Math.hypot(d.position.x-11,d.position.y-10)).toBeGreaterThanOrEqual(.85-1e-6);expect(d.takeReport(500)?.direction.x).toBe(0);
 });
 it('a correction revision resets position and an older revision cannot pull it back',()=>{
  const d=driver();d.direction({x:1,y:0},0);d.advance(100,context);
  d.sync(view({revision:1}),{x:5,y:8},120,conditions);expect(d.position).toEqual({x:5,y:8});expect(d.active).toBe(false);
  d.sync(view({revision:0}),{x:10,y:10},130,conditions);expect(d.position).toEqual({x:5,y:8});
  d.direction({x:0,y:1},140);d.advance(156,context);expect(d.takeReport(156)?.revision).toBe(1);
 });
 it.each([{alive:false,blocked:false,connected:true},{alive:true,blocked:true,connected:true},{alive:true,blocked:false,connected:false}])('cancels local movement and cannot restart under %j',flags=>{
  const d=driver();d.go({x:15,y:10},context,0);d.advance(100,context);d.sync(view(),{x:10.3,y:10},120,flags);
  d.direction({x:1,y:0},130);expect(d.go({x:20,y:10},context,130)).toBe(false);expect(d.active).toBe(false);expect(d.takeReport(130)).toBeUndefined();
 });
 it('keeps only the newest failed report and retries without making a new sequence',()=>{
  const d=driver();d.direction({x:1,y:0},0);d.advance(16,context);const first=d.takeReport(16)!;
  d.reportFailed(first);expect(d.takeReport(17)).toEqual(first);
  d.reportFailed(first);d.direction({x:0,y:1},20);d.advance(36,context);const second=d.takeReport(36)!;
  expect(second.seq).toBeGreaterThan(first.seq);expect(second.direction.y).toBeCloseTo(1);
  d.reportFailed(first);expect(d.takeReport(37)).toBeUndefined();
 });
 it('a new epoch discards old paths, reports and sequence space',()=>{
  const d=driver();d.go({x:15,y:10},context,0);d.advance(100,context);const report=d.takeReport(100)!;d.reportFailed(report);
  d.sync(view({epoch:'run:2:map',ack:3}),{x:8,y:9},120,conditions);expect(d.active).toBe(false);expect(d.position).toEqual({x:8,y:9});expect(d.takeReport(130)).toBeUndefined();
  d.direction({x:1,y:0},140);d.advance(156,context);expect(d.takeReport(156)).toMatchObject({epoch:'run:2:map',seq:4});
  d.reset();expect(d.active).toBe(false);expect(d.takeReport(1000)).toBeUndefined();
 });
});
