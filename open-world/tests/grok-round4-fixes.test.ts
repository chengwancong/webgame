import {describe,expect,it,vi} from 'vitest';
import {FeedLog,FEED_TTL,GAIN_MERGE_MS} from '../apps/web/src/ui/feed-log.ts';
import {ToastQueue,toastText} from '../apps/web/src/ui/toast-queue.ts';

const apiMock=vi.hoisted(()=>vi.fn());
vi.mock('../apps/web/src/network.ts',()=>({api:apiMock}));
const {ProgressionController}=await import('../apps/web/src/progression-controller.ts');

describe('Grok 第四轮复测修复',()=>{
 it('连续战报的金币/经验合并成一行，超时后淡出', ()=>{
  const feed=new FeedLog();
  feed.gain(5,10,0);feed.gain(7,12,1000);feed.gain(1,1,1500);
  expect(feed.visible(1500)).toEqual(['获得 13 金币 · 23 经验']);
  feed.gain(2,3,1500+GAIN_MERGE_MS+1);
  expect(feed.visible(1500+GAIN_MERGE_MS+1)).toHaveLength(2);
  expect(feed.visible(1500+GAIN_MERGE_MS+1+FEED_TTL)).toEqual([]);
 });
 it('拾取等其他行打断合并，最多保留 3 行', ()=>{
  const feed=new FeedLog();
  feed.gain(1,1,0);feed.push('拾取 青锋长剑',10);feed.gain(1,1,20);feed.push('拾取 2 件装备',30);
  expect(feed.visible(30)).toEqual(['拾取 2 件装备','获得 1 金币 · 1 经验','拾取 青锋长剑']);
 });
 it('施放失败提示 replace：同 key 只换文案，不累计 ×N（BUG-76）', ()=>{
  const q=new ToastQueue();
  for(let i=0;i<5;i++)q.push('技能仍在冷却。',i,{key:'cast-failure',replace:true});
  q.push('能量不足。',6,{key:'cast-failure',replace:true});
  const shown=q.visible(6);expect(shown).toHaveLength(1);expect(toastText(shown[0])).toBe('能量不足。');
  q.push('连接中断',0,{key:'connection'});q.push('连接中断',150,{key:'connection'});
  expect(toastText(q.visible(150).find(x=>x.key==='connection')!)).toBe('连接中断　×2');
 });
 it('养成默认分区只在当前可见分区里选，报价与面板条目一致（BUG-88）', async ()=>{
  const op=(target:string)=>({id:'weapon.level:'+target,label:'提升武器等级',action:{op:'weapon.level',target},cost:{gold:20,material:1,items:{}},enabled:true,reason:''});
  const view={revision:3,sections:[
   {id:'grid',name:'武器盘',description:'',items:[{id:'grid-0',name:'主手',description:'',status:'',operations:[{...op('x'),id:'grid.assign:x',action:{op:'grid.assign',target:'x',slot:0}}]}]},
   {id:'weapons',name:'武器成长',description:'',items:[{id:'w1',name:'青锋长剑',description:'',status:'',operations:[op('w1')]}]}]};
  apiMock.mockReset().mockImplementation(async (path:string,body?:{action:unknown})=>path==='progression'?view:{revision:3,action:body!.action,cost:{gold:20,material:1,items:{}},enabled:true,reason:''});
  const controller=new ProgressionController(()=>{},vi.fn(),()=>false,()=>['weapons']);
  await controller.load();
  expect(controller.ui.section).toBe('weapons');
  expect(controller.ui.preview?.action).toEqual({op:'weapon.level',target:'w1'});
 });
});
