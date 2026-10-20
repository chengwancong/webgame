import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Gear,GearTip,GrowthPreview,Snapshot} from '../packages/contracts/index.ts';
import {invalidatePreviews} from '../apps/web/src/preview-guard.ts';
import {forgetGearDetails,loadGearDetails} from '../apps/web/src/components/GearDetails.ts';

/** 前端补丁复测（FE-01～08）：没有 DOM 库，用最小桩节点验证终态。 */
function fakeNode(gearId:string){
 const attrs:Record<string,string>={'aria-busy':'true'};
 return {dataset:{gear:gearId,previewContext:'forge'} as Record<string,string>,innerHTML:'',setAttribute:(k:string,v:string)=>{attrs[k]=v;},getAttribute:(k:string)=>attrs[k],attrs};
}
const snapshot=(revision:number)=>({revision,gold:500,material:50,equipment:{}}) as unknown as Snapshot;
const gear={id:'g1',base:'blade',slot:'weapon',name:'青锋长剑',affixes:[],effect:'none'} as unknown as Gear;
const quote=(revision:number)=>({revision,gear_id:'g1',cost:{gold:10,material:2},max:false,salvage:{allowed:true,material:3}}) as unknown as GrowthPreview;
const tip=(revision:number)=>({revision,gear:{id:'g1'},primary_attribute:'attack',attributes:{effective:{},base:{},enhancement:{}},comparison:{}}) as unknown as GearTip;
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};

describe('FE-01 报价读取一定有终态',()=>{
 let node=fakeNode('g1');
 const mount=()=>{node=fakeNode('g1');(globalThis as unknown as {document:unknown}).document={querySelector:(selector:string)=>selector==='#preview'?node:null,querySelectorAll:()=>[]};};
 afterEach(()=>{forgetGearDetails();delete (globalThis as {document?:unknown}).document;});

 it('正常返回：节点结束读取并标记 ready',async()=>{
  mount();loadGearDetails(gear,snapshot(5),{busy:false,preview:async()=>quote(5),tip:async()=>tip(5),error:()=>{}});await flush();
  expect(node.attrs['aria-busy']).toBe('false');expect(node.dataset.state).toBe('ready');
 });
 it('令牌被回执作废、面板没重绘：用最新快照续载，不停在读取中',async()=>{
  mount();const preview=vi.fn(async()=>quote(6)),current=vi.fn(()=>snapshot(6));
  loadGearDetails(gear,snapshot(5),{busy:false,preview,tip:async()=>tip(6),error:()=>{},current});
  invalidatePreviews();await flush();await flush();
  expect(node.attrs['aria-busy']).toBe('false');expect(current).toHaveBeenCalled();
 });
 it('服务端 revision 与本地快照不一致：先请求同步，反复不一致则给出带重试的失败态',async()=>{
  mount();const resync=vi.fn();
  loadGearDetails(gear,snapshot(5),{busy:false,preview:async()=>quote(9),tip:async()=>tip(9),error:()=>{},resync});await flush();
  expect(resync).toHaveBeenCalledTimes(1);
  for(let i=0;i<3;i++){mount();loadGearDetails(gear,snapshot(5),{busy:false,preview:async()=>quote(9),tip:async()=>tip(9),error:()=>{},resync});await flush();}
  expect(resync.mock.calls.length).toBeLessThanOrEqual(2);
  expect(node.dataset.state).toBe('error');expect(node.innerHTML).toContain('gear-preview-retry');expect(node.attrs['aria-busy']).toBe('false');
 });
 it('请求失败：显示可重试的失败态并释放读取状态',async()=>{
  mount();const error=vi.fn();
  loadGearDetails(gear,snapshot(5),{busy:false,preview:async()=>{throw new Error('服务器响应超时');},tip:async()=>tip(5),error});await flush();
  expect(node.dataset.state).toBe('error');expect(node.attrs['aria-busy']).toBe('false');expect(node.innerHTML).toContain('服务器响应超时');expect(node.innerHTML).toContain('gear-preview-retry');expect(error).toHaveBeenCalled();
 });
 it('晚到的旧装备响应不覆盖新选择',async()=>{
  mount();let release:(q:GrowthPreview)=>void=()=>{};
  loadGearDetails(gear,snapshot(5),{busy:false,preview:()=>new Promise<GrowthPreview>(r=>{release=r;}),tip:async()=>tip(5),error:()=>{}});
  const other=fakeNode('g2');node=other;invalidatePreviews();release(quote(5));await flush();
  expect(other.attrs['aria-busy']).toBe('true');
 });
});

import {ToastQueue,COUNT_GAP_MS,COUNT_CAP} from '../apps/web/src/ui/toast-queue.ts';
import {CraftingPanel} from '../apps/web/src/components/CraftingPanel.ts';
import {combatReviewHtml} from '../apps/web/src/combat-review-view.ts';
import type {CombatReview,CraftingView} from '../packages/contracts/index.ts';

describe('FE-02 提示条不堆叠',()=>{
 it('同键失败提示 replace 不累加；短时间内重复推送也不刷出 ×N',()=>{
  const q=new ToastQueue(),at=(t:number,replace=false)=>q.push('走近目标后交互',t,{key:'interact-hint',replace});
  at(0,true);at(10,true);at(20,true);expect(q.visible(30).map(t=>t.count)).toEqual([1]);
  const r=new ToastQueue();r.push('a',0,{key:'k'});r.push('a',COUNT_GAP_MS/2,{key:'k'});expect(r.visible(COUNT_GAP_MS/2)[0].count).toBe(1);
  r.push('a',COUNT_GAP_MS*2,{key:'k'});expect(r.visible(COUNT_GAP_MS*2)[0].count).toBe(2);
 });
 it('计数有上限',()=>{
  const q=new ToastQueue();for(let i=0;i<COUNT_CAP+30;i++)q.push('a',i*COUNT_GAP_MS*2,{key:'k'});
  expect(q.visible((COUNT_CAP+30)*COUNT_GAP_MS*2).find(t=>t.key==='k')!.count).toBe(COUNT_CAP);
 });
});

describe('FE-06/07 制作页文案',()=>{
 const recipe={id:'repair-starter-weapon',name:'修复刻纹武器',profession:'smithing',category:'repair',island:'ss-map-wind',levelRequired:1,known:true,facilityRequired:{id:'forge',level:1},options:{slots:['weapon']},baseCost:{gold:10,materials:{wind_ore:4}},unlockHint:'',cost:{gold:10,materials:{}}};
 const view={recipes:[recipe],professions:[{id:'smithing',level:3,xp:0,xpNext:10,fineChance:0},{id:'alchemy',level:1,xp:0,xpNext:10,fineChance:0},{id:'gathering',level:1,xp:0,xpNext:10,fineChance:0}],facilities:[{id:'forge',name:'锻炉',level:1,maxLevel:3,appearanceTier:1,effects:[]}],atForge:true,forgeReason:'',materials:[],refine:[],masterwork:{unlocked:true,maxLevel:5,reason:''},codex:[]} as unknown as CraftingView;
 const preview={action:{op:'craft',recipe:recipe.id},enabled:true,reason:'',bagFull:false,cost:{gold:10,materials:{}},output:{kind:'gear',name:'刻纹短刃',icon:'gear-不存在',count:1,quality:'rare',level:4}};
 const html=(p:unknown)=>CraftingPanel({gold:100,material:0,gear:[],progression:{materials:{wind_ore:9}}} as unknown as Snapshot,{tab:'craft',view,filter:{profession:'smithing',island:'',showUnknown:true,query:''},patternFilter:{profession:'smithing',island:'',showUnknown:true,query:''},recipe:recipe.id,options:{count:1,slot:'weapon'},preview:p,previewLoading:false,busy:false} as never,false);
 it('产出名称不拼“（岛名款）”，地区单独成行',()=>{
  const out=html(preview);expect(out).toContain('刻纹短刃');expect(out).not.toMatch(/款）/);expect(out).toContain('产地');
 });
 it('专业页签区分熟练等级与已会配方数；设施短词不被拆开',()=>{
  const out=html(preview);expect(out).toContain('熟练 3 级');expect(out).toContain('已会 1/1');expect(out).toContain('<span class="craft-atom">锻炉 1 级</span>');
 });
 it('产出图标缺失时用正式资源兜底，不留空图',()=>{
  expect(html(preview)).toMatch(/<img src="[^"]+\.png"/);expect(html(undefined)).toMatch(/craft-detail-icon"><img src="[^"]+\.png"/);
 });
});

describe('FE-08 战斗回顾区分最近受击与更早伤害',()=>{
 const base={fatal:null,advice:[],recent:['被 A 命中 12','被 B 命中 9']} as CombatReview;
 it('有合计时分开标注；旧记录不编造合计',()=>{
  const out=combatReviewHtml({...base,totalTaken:100,omittedTaken:79,source:'server'});
  expect(out).toContain('最近受击 2 次');expect(out).toContain('更早伤害');expect(out).toContain('79');expect(out).toContain('100');
  const old=combatReviewHtml(base);expect(old).not.toContain('更早伤害');expect(old).not.toContain('本场累计承受伤害');
 });
});
