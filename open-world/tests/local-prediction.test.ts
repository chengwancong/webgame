import {it,expect,describe} from 'vitest';
import {LocalPrediction} from '../apps/web/src/local-prediction.ts';
import {walkable} from '../packages/simulation/navigation.ts';
import type {Region} from '../packages/content/index.ts';

const SPEED=6;
/** 模拟一条链路：本地按键 → 服务端 latency 毫秒后才开始/停止移动，快照每 interval 毫秒到达；缓冲位置再晚 buffer 毫秒。 */
function link({press=[0,600] as [number,number],latency=120,interval=100,buffer=130,until=1400}={}){
 const p=new LocalPrediction(),shown:number[]=[],truth=(t:number)=>SPEED/1000*Math.max(0,Math.min(t,press[1]+latency)-(press[0]+latency));
 for(let t=0;t<=until;t+=16){
  // Runtime calls accept only when a new authoritative sequence arrives.
  if(t%interval<16)p.accept({x:truth(t),y:0},t);
  p.setEnabled(true);p.setInput(t>=press[0]&&t<press[1]?1:0,0);
  shown.push(p.position(SPEED,null,t,{x:truth(t-buffer),y:0}).x);
 }
 return {shown,final:truth(until)};
}

describe('FP6 LocalPrediction',()=>{
 it('没有手动输入时与改动前一致：原样返回缓冲位置',()=>{
  const p=new LocalPrediction();p.accept({x:3,y:4},0);p.setEnabled(true);
  for(let t=16;t<200;t+=16){p.accept({x:3+t/100,y:4},t);expect(p.position(SPEED,null,t,{x:2+t/100,y:4})).toEqual({x:2+t/100,y:4});}
 });
 it('按下即动：第一帧就按移速推进，不等快照',()=>{
  const p=new LocalPrediction();p.accept({x:0,y:0},0);p.setEnabled(true);p.position(SPEED,null,0,{x:0,y:0});
  p.setInput(1,0);const pos=p.position(SPEED,null,16,{x:0,y:0});
  expect(pos.x).toBeGreaterThan(.08);expect(pos.y).toBeCloseTo(0,5);
 });
 it('持续移动时保持领先缓冲位置，不被慢慢拉回到延迟',()=>{
  const {shown}=link();const t=560/16|0,buffered=SPEED/1000*Math.max(0,560-130-120);
  expect(shown[t]-buffered).toBeGreaterThan(SPEED*.2);
 });
 it('松手后不往回拉：显示位置单调不减，最终与服务端一致',()=>{
  const {shown,final}=link();
  for(let i=1;i<shown.length;i++)expect(shown[i]).toBeGreaterThanOrEqual(shown[i-1]-1e-3);
  expect(shown.at(-1)).toBeCloseTo(final,2);
 });
 it('短点按也不回弹',()=>{
  const {shown,final}=link({press:[0,80]});
  for(let i=1;i<shown.length;i++)expect(shown[i]).toBeGreaterThanOrEqual(shown[i-1]-1e-3);
  expect(shown.at(-1)).toBeCloseTo(final,2);
 });
 it('大偏差（瞬移/击退）直接采用服务端位置',()=>{
  const p=new LocalPrediction();p.accept({x:0,y:0},0);p.setEnabled(true);p.setInput(1,0);
  p.position(SPEED,null,0,{x:0,y:0});p.position(SPEED,null,16,{x:0,y:0});
  p.accept({x:10,y:5},32);const pos=p.position(SPEED,null,32,{x:0,y:0});
  expect(pos.x).toBeCloseTo(10,0);expect(pos.y).toBeCloseTo(5,0);
 });
 it('禁用（死亡/被控）时立即回到缓冲位置，恢复后从缓冲位置起跑',()=>{
  const p=new LocalPrediction();p.accept({x:0,y:0},0);p.setEnabled(true);p.setInput(1,0);
  for(let t=0;t<=160;t+=16)p.position(SPEED,null,t,{x:0,y:0});
  p.setEnabled(false);expect(p.position(SPEED,null,176,{x:.2,y:0})).toEqual({x:.2,y:0});
  p.setEnabled(true);const pos=p.position(SPEED,null,192,{x:.3,y:0});
  expect(pos.x).toBeGreaterThan(.3);expect(pos.x).toBeLessThan(.3+SPEED/1000*16+.05);
 });
 it('松手后服务端一直在动（自动模式接管）时超时向缓冲位置收敛并回到跟随',()=>{
  const p=new LocalPrediction();p.accept({x:0,y:0},0);p.setEnabled(true);p.setInput(1,0);
  for(let t=0;t<=160;t+=16)p.position(SPEED,null,t,{x:0,y:0});
  p.setInput(0,0);let pos={x:0,y:0};
  for(let t=176;t<=1200;t+=16){p.accept({x:-t/100,y:0},t);pos=p.position(SPEED,null,t,{x:-t/100+1,y:0});}
  expect(pos).toEqual({x:-1200/100+1,y:0});
 });
 it('reset 后回到跟随',()=>{
  const p=new LocalPrediction();p.accept({x:0,y:0},0);p.setEnabled(true);p.setInput(1,0);p.position(SPEED,null,0,{x:0,y:0});p.position(SPEED,null,16,{x:0,y:0});
  p.reset();p.setInput(0,0);expect(p.position(SPEED,null,32,{x:7,y:7})).toEqual({x:7,y:7});
 });
 it('100ms 快照之间匀速前进，不随收包周期忽快忽慢',()=>{
  const p=new LocalPrediction(),speeds:number[]=[];p.setEnabled(true);p.setInput(1,0);let previous=0;
  for(let t=0;t<=4000;t+=16){
   if(t%100<16)p.accept({x:SPEED*Math.max(0,t-120)/1000,y:0},t);
   const point=p.position(SPEED,null,t,{x:SPEED*Math.max(0,t-250)/1000,y:0});
   if(t>1500)speeds.push((point.x-previous)/.016);previous=point.x;
  }
  expect(Math.min(...speeds)).toBeGreaterThan(5.98);
  expect(Math.max(...speeds)).toBeLessThan(6.02);
 });
 it('顶着薄墙移动时预测和校正都不能穿过地形',()=>{
  const region={width:20,height:20,obstacles:[{x:5,y:2,w:.1,h:16}]} as Region;
  const server={x:4.64,y:10},p=new LocalPrediction();p.setEnabled(true);p.setInput(1,0);
  for(let t=0;t<=1600;t+=16){
   if(t%100<16)p.accept(server,t);
   const point=p.position(SPEED,region,t,server);
   expect(walkable(region,point,.35)).toBe(true);
   expect(point.x).toBeLessThanOrEqual(4.65);
  }
  expect(server).toEqual({x:4.64,y:10});
 });
 it('消费传入的真实人物半径，而不是用更小的预测碰撞体',()=>{
  const region={width:20,height:20,obstacles:[{x:5,y:2,w:.1,h:16}]} as Region;
  const server={x:4.39,y:10},p=new LocalPrediction();p.accept(server,0);p.setEnabled(true);p.setInput(1,0);
  for(let t=0;t<=240;t+=16){const point=p.position(SPEED,region,t,server,.6);expect(walkable(region,point,.6)).toBe(true);expect(point.x).toBeLessThanOrEqual(4.4);}
 });
 it('快照中断时停止外推，平滑回到权威缓冲位置；新快照后可以恢复',()=>{
  const p=new LocalPrediction();p.accept({x:0,y:0},0);p.setEnabled(true);p.setInput(1,0);const shown:number[]=[];
  for(let t=0;t<=1000;t+=16)shown.push(p.position(SPEED,null,t,{x:0,y:0}).x);
  expect(Math.max(...shown)).toBeLessThanOrEqual(SPEED*.25);
  expect(shown.at(-1)).toBe(0);
  p.accept({x:2,y:0},1024);const resumed=p.position(SPEED,null,1040,{x:2,y:0});expect(resumed.x).toBeGreaterThan(2);
 });
 it('同一渲染时刻多次读取不会使镜头与人物取到不同位置',()=>{
  const p=new LocalPrediction();p.accept({x:1,y:2},0);p.setEnabled(true);p.setInput(1,0);
  const point=p.position(SPEED,null,16,{x:1,y:2});expect(p.position(SPEED,null,16,{x:1,y:2})).toEqual(point);
 });
});
