import {describe,it,expect} from 'vitest';
import {OverlayStack} from '../apps/web/src/ui/overlay-stack.ts';
import {ToastQueue,toastText} from '../apps/web/src/ui/toast-queue.ts';
import {layoutWorldLabels,hudReservedRects} from '../apps/web/src/ui/world-label-layout.ts';
import {objectivePhase,objectivePhaseCopy,type ObjectiveInput} from '../apps/web/src/objective-phase.ts';

describe('弹窗栈',()=>{
 it('结算层盖住时恢复连接仍可操作（BUG-19 一类）',()=>{
  const s=new OverlayStack();s.request({id:'recover',layer:'connection'});s.request({id:'result',layer:'result'});
  expect(s.top()?.id).toBe('recover');expect(s.accepts('recover')).toBe(true);expect(s.accepts('result')).toBe(false);
  s.close('recover');expect(s.accepts('result')).toBe(true);
 });
 it('战斗中信息卡排队、不暂停世界，脱战按顺序放出（BUG-47）',()=>{
  const s=new OverlayStack();s.setCombat(true);
  expect(s.request({id:'lv',layer:'card',pause:true})).toBe(false);s.request({id:'skill',layer:'card'});
  expect(s.top()).toBeUndefined();expect(s.pausesWorld()).toBe(false);expect(s.pending()).toBe(2);
  expect(s.setCombat(false).map(e=>e.id)).toEqual(['lv','skill']);expect(s.top()?.id).toBe('skill');expect(s.pausesWorld()).toBe(false);
 });
 it('同层后申请者在上；面板可暂停；切场景只留连接层',()=>{
  const s=new OverlayStack();s.request({id:'bag',layer:'panel',pause:true});s.request({id:'forge',layer:'panel'});s.request({id:'net',layer:'connection'});
  expect(s.pausesWorld()).toBe(true);s.close('net');expect(s.top()?.id).toBe('forge');
  s.request({id:'net',layer:'connection'});s.clearScene();expect(s.isOpen('bag')).toBe(false);expect(s.isOpen('net')).toBe(true);
 });
});

describe('Toast 队列',()=>{
 it('同文本合并 ×N，最多 3 条，挤掉最旧非 sticky',()=>{
  const q=new ToastQueue();q.push('连接中断',0,{kind:'error',sticky:true});q.push('铜 ×2',0);q.push('铜 ×2',100);q.push('获得 椒',0);q.push('获得 金',0);
  const v=q.visible(200);expect(v.map(t=>t.text)).toEqual(['连接中断','获得 椒','获得 金']);
  const q2=new ToastQueue();q2.push('铜 ×2',0);const t=q2.push('铜 ×2',100);expect(toastText(t)).toBe('铜 ×2　×2');
 });
 it('过期移除，error 更久；切场景清掉掉落提示（BUG-53）',()=>{
  const q=new ToastQueue();q.push('掉落',0,{kind:'loot'});q.push('失败',0,{kind:'error'});q.push('重连中',0,{sticky:true});
  expect(q.visible(4000).map(t=>t.text)).toEqual(['失败','重连中']);
  q.push('掉落2',4000);q.clearScene();expect(q.visible(4001).map(t=>t.text)).toEqual(['重连中']);q.clearAll();expect(q.visible(0)).toHaveLength(0);
 });
});

describe('世界标签避让',()=>{
 const label=(id:string,x:number,y:number,priority:number)=>({id,x,y,width:100,height:24,priority});
 it('冲突时低优先级上移，锚点 x 不变',()=>{
  const [a,b]=layoutWorldLabels([label('ore',640,400,1),label('npc',650,400,0)]);
  expect(b).toMatchObject({visible:true,y:400});expect(a).toMatchObject({visible:true,x:640,y:372});
 });
 it('上移档用完或进入 HUD 保留区就隐藏',()=>{
  const placed=layoutWorldLabels([0,1,2,3].map(i=>label('l'+i,640,400,i)));
  expect(placed.filter(p=>p.visible)).toHaveLength(3);expect(placed[3].visible).toBe(false);
  expect(layoutWorldLabels([label('hud',200,120,0)])[0].visible).toBe(false);
  expect(hudReservedRects).toHaveLength(4);
  const [front,loot]=layoutWorldLabels([label('front',640,400,0),{...label('loot',640,400,1),steps:0}]);expect(front.visible).toBe(true);expect(loot).toMatchObject({visible:false,x:640,y:400});
 });
});

describe('目标阶段',()=>{
 const base:ObjectiveInput={name:'格铎',island:'chilu',islandName:'赤炉',currentIsland:'chilu',distance:30,engageRadius:8,fighting:false,defeated:false};
 it('跨岛只写出航、不给箭头和距离（BUG-54）',()=>{
  const i={...base,currentIsland:'wuling'},p=objectivePhase(i);expect(p).toBe('voyage');
  expect(objectivePhaseCopy(p,i)).toEqual({line:'出航 · 前往赤炉',arrow:false,distance:undefined});
 });
 it('近身或交战后改为击败（BUG-24），带回滞',()=>{
  expect(objectivePhaseCopy(objectivePhase(base),base)).toMatchObject({line:'前往 · 格铎',arrow:true,distance:30});
  expect(objectivePhase({...base,distance:7})).toBe('engage');expect(objectivePhase({...base,fighting:true})).toBe('engage');
  expect(objectivePhase({...base,distance:12},'engage')).toBe('engage');expect(objectivePhase({...base,distance:13},'engage')).toBe('travel');
  expect(objectivePhaseCopy('engage',base).line).toBe('击败 · 格铎');expect(objectivePhase({...base,defeated:true})).toBe('done');
 });
});
