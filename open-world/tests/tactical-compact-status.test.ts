import {describe,expect,it} from 'vitest';
import {compactActionState,compactStatusDetail,compactStatusDetailHtml,compactStatusHtml,isCompactHudDetail} from '../apps/web/src/tactical/compact-status.ts';
import type {TacticalEncounterView} from '../apps/web/src/tactical/contract.ts';

function view():TacticalEncounterView{
 return {
  source:'sandbox',encounterId:'compact-test',revision:1,ruleVersion:'test',protocolVersion:'test',
  node:{name:'测试节点',objective:'击败敌人',enemyGroup:'守卫'},round:1,phase:'awaiting',actorId:'hero',actionToken:'action-1',
  board:{width:1,height:1,cells:[]},
  units:[{id:'hero',side:'hero',name:'行者',cell:{x:0,y:0},footprint:1,alive:true,hp:{current:84,max:120},shield:0,
   resource:{label:'蓝量',current:30,max:80},statuses:[],art:{kind:'hero-native',assetId:'hero'},tier:'normal'}],
  budget:{moveUsed:false,mainActionUsed:false,ended:false,moveSteps:3},abilities:[],legalMoves:[],
  pet:{familyId:'wind-free',runtimeId:'ss-pet-wind-free-young',name:'风铃',conditionText:'主角移动后提供辅助',
   status:'ready',statusText:'辅助就绪',remainingInWindow:1},
  control:{mode:'manual',phase:'awaiting',pendingManual:false,deadlineAtMs:null,warningMs:10000,serverNowMs:0,
   autoReason:null,canRequestAuto:true,canRequestManual:false},result:null,intents:[],unsupported:[],
 };
}

describe('compact tactical HUD projection',()=>{
 it('keeps real health and mana in accessible meters without permanently printing their numbers',()=>{
  const html=compactStatusHtml(view());
  expect(html).toContain('aria-label="生命 84/120"');
  expect(html).toContain('aria-label="蓝量 30/80"');
  expect(html).toContain('aria-valuenow="84"');
  expect(html).toContain('aria-valuemax="120"');
  expect(html).not.toContain('ui-meter__value');
  expect(html).not.toContain(' title='); // Controller-owned hover/focus/tap details must not open a second native tooltip.
  expect(html.replace(/<[^>]*>/g,'')).not.toMatch(/84|120|30|80/);
  expect(compactStatusDetail(view(),'vitals')?.rows).toContainEqual({label:'蓝量',value:'30 / 80'});
 });

 it('does not invent a resource or a hero when the projection omits them',()=>{
  const v=view();v.units[0].resource=null;
  expect(compactStatusHtml(v)).not.toContain('data-vital="mana"');
  expect(compactStatusDetail(v,'vitals')?.rows.some(row=>row.label==='蓝量')).toBe(false);
  expect(compactStatusDetail(v,'vitals')?.notes).toContain('本场未提供蓝量数据。');
  v.units=[];
  expect(compactStatusHtml(v)).not.toContain('data-detail="vitals"');
  expect(compactStatusDetailHtml(v,'vitals')).toBe('');
  expect(compactActionState(v,'move')).toBe('waiting');
 });

 it('projects independent movement and main-action budgets without spending either',()=>{
  const v=view();v.budget.moveUsed=true;
  const before=structuredClone(v),html=compactStatusHtml(v);
  expect(compactActionState(v,'move')).toBe('spent');
  expect(compactActionState(v,'main')).toBe('available');
  expect(html).toContain('tb-compact-slash');
  expect(html).not.toContain('data-icon="check"');
  expect(html).not.toMatch(/data-action="(?:move|ability|end)"/);
  expect(v).toEqual(before);
  expect(compactStatusDetail(v,'main')?.notes.join('')).toContain('普攻与技能共享一次主行动');
 });

 it('does not advertise unused allowances as available outside the manual hero window',()=>{
  const v=view();
  expect(compactActionState(v,'move')).toBe('available');
  expect(compactActionState(v,'move',true)).toBe('waiting');
  for(const patch of [
   {phase:'enemy',actorId:'enemy'},
   {phase:'resolving'},
   {phase:'ended'},
   {actorId:null},
  ] as Partial<TacticalEncounterView>[]){
   expect(compactActionState({...v,...patch},'main')).toBe('waiting');
  }
  v.control.mode='auto';
  expect(compactActionState(v,'move')).toBe('waiting');
  expect(compactStatusDetail(v,'move')?.rows[0].value).toContain('由托管执行');
  v.control.mode='manual';v.budget.ended=true;
  expect(compactActionState(v,'main')).toBe('waiting');
  v.budget.ended=false;v.units[0].alive=false;
  expect(compactActionState(v,'main')).toBe('waiting');
 });

 it('uses the actual pet portrait and source status without assuming a shield effect',()=>{
  const v=view(),html=compactStatusHtml(v);
  expect(html).toContain('data-pet-runtime="ss-pet-wind-free-young"');
  expect(html).toContain('class="tb-compact-pet" data-state="ready"');
  expect(html).not.toContain('data-icon="armor"');
  expect(compactStatusDetail(v,'pet')).toEqual({title:'风铃',rows:[
   {label:'当前状态',value:'辅助就绪'},{label:'当前窗口剩余次数',value:'1'},
  ],notes:['主角移动后提供辅助']});
  v.pet!.status='spent';v.pet!.statusText='本窗口已辅助';v.pet!.remainingInWindow=0;
  expect(compactStatusHtml(v)).toContain('class="tb-compact-pet" data-state="spent"');
  expect(compactStatusDetail(v,'pet')?.rows).toContainEqual({label:'当前窗口剩余次数',value:'0'});
  v.pet!.remainingInWindow=null;
  expect(compactStatusDetail(v,'pet')?.rows).toHaveLength(1);
  v.pet=null;
  expect(compactStatusHtml(v)).not.toContain('data-detail="pet"');
  expect(compactStatusDetailHtml(v,'pet')).toBe('');
 });

 it('preserves unknown pet conditions and current real shield/status details without granting anything',()=>{
  const v=view();v.pet!.status='unconfigured';v.pet!.statusText='尚未配置';v.pet!.conditionText=null;
  expect(compactStatusHtml(v)).toContain('class="tb-compact-pet" data-state="unconfigured"');
  expect(compactStatusDetail(v,'pet')?.notes).toEqual(['本场尚未提供辅助条件。']);
  v.units[0].shield=12;v.units[0].statuses=[{id:'slow',label:'减速',remaining:'一次行动',tone:'debuff'}];
  expect(compactStatusDetail(v,'vitals')?.rows).toContainEqual({label:'当前护盾',value:'12'});
  expect(compactStatusDetail(v,'vitals')?.rows).toContainEqual({label:'减速',value:'一次行动'});
 });

 it('escapes projection text and connects only the selected informational button to details',()=>{
  const v=view();v.pet!.name='<img src=x>';v.pet!.conditionText='"触发" & 条件';
  const html=compactStatusHtml(v,{activeDetail:'pet',detailId:'hud-info'});
  expect(html).toContain('aria-controls="hud-info"');
  expect(html.match(/aria-expanded="true"/g)).toHaveLength(1);
  expect(html).not.toContain('<img src=x>');
  expect(compactStatusDetailHtml(v,'pet')).toContain('&lt;img src=x&gt;');
  expect(compactStatusDetailHtml(v,'pet')).toContain('&quot;触发&quot; &amp; 条件');
  expect(isCompactHudDetail('pet')).toBe(true);
  expect(isCompactHudDetail('move')).toBe(true);
  expect(isCompactHudDetail('ability')).toBe(false);
  expect(isCompactHudDetail(null)).toBe(false);
 });
});
