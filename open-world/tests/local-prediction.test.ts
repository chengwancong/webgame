import {it,expect,describe} from 'vitest';
import {LocalPrediction} from '../apps/web/src/local-prediction.ts';

const SPEED=6;
/** 模拟一条链路：本地按键 → 服务端 latency 毫秒后才开始/停止移动，快照每 interval 毫秒到达；缓冲位置再晚 buffer 毫秒。 */
function link({press=[0,600] as [number,number],latency=120,interval=100,buffer=130,until=1400}={}){
 const p=new LocalPrediction(),shown:number[]=[],truth=(t:number)=>SPEED/1000*Math.max(0,Math.min(t,press[1]+latency)-(press[0]+latency));
 let server=0;
 for(let t=0;t<=until;t+=16){
  if(t%interval<16)server=truth(t);
  p.accept({x:server,y:0},t);p.setEnabled(true);p.setInput(t>=press[0]&&t<press[1]?1:0,0);
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
});
