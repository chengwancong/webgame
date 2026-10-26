import {describe,expect,it} from 'vitest';
import {hudAbilities,hudAbilityShortcut,hudAbilitySlotsHtml,hudAbilityInfoHtml,hudAbilityContext,hudActorId,idleMoveSelection,shouldPreviewIdleMove} from '../apps/web/src/tactical/hud.ts';
import {initialSelection} from '../apps/web/src/tactical/selection.ts';
import type {TacticalAbilityView,TacticalEncounterView} from '../apps/web/src/tactical/contract.ts';

const ability=(id:string,category:TacticalAbilityView['category'],slot:number):TacticalAbilityView=>({
 id,category,slot,label:id,iconSrc:null,migration:'supported',available:true,reason:null,
 cost:null,cooldown:null,rangeText:null,description:'选择一个目标',
});

function view():TacticalEncounterView{
 return {
  source:'sandbox',encounterId:'hud-test',revision:1,ruleVersion:'test',protocolVersion:'test',
  node:{name:'测试节点',objective:'击败敌人',enemyGroup:'守卫'},round:1,phase:'awaiting',actorId:'hero',actionToken:'action-1',
  board:{width:4,height:4,cells:[]},
  units:[
   {id:'hero',side:'hero',name:'行者',cell:{x:1,y:1},footprint:1,alive:true,hp:{current:100,max:100},shield:0,
    resource:null,statuses:[],art:{kind:'hero-native',assetId:'hero'},tier:'normal'},
   {id:'enemy',side:'enemy',name:'守卫',cell:{x:3,y:1},footprint:1,alive:true,hp:{current:50,max:50},shield:0,
    resource:null,statuses:[],art:{kind:'starsea-atlas',assetId:'guard'},tier:'normal'},
  ],
  budget:{moveUsed:false,mainActionUsed:false,ended:false,moveSteps:3},
  abilities:[ability('basic','basic',0),...Array.from({length:4},(_,i)=>ability(`skill-${i+1}`,'skill',i))],
  legalMoves:[{cell:{x:2,y:1},cost:1,path:[{x:1,y:1},{x:2,y:1}]}],pet:null,
  control:{mode:'manual',phase:'awaiting',pendingManual:false,deadlineAtMs:null,warningMs:10000,serverNowMs:0,
   autoReason:null,canRequestAuto:true,canRequestManual:false},result:null,intents:[],unsupported:[],
 };
}

const buttons=(html:string)=>[...html.matchAll(/<button\b[^>]*>/g)].map(match=>match[0]);

describe('tactical HUD current actor',()=>{
 it('does not highlight a stale hero ID during the enemy phase',()=>{
  const v=view();v.phase='enemy';
  expect(v.actorId).toBe('hero');
  expect(hudActorId(v)).toBeNull();
 });

 it('does not infer an executor from a resolving snapshot',()=>{
  const v=view();v.phase='resolving';
  expect(hudActorId(v)).toBeNull();
  v.actorId='enemy';
  expect(hudActorId(v)).toBeNull();
 });

 it('keeps a live, explicitly published enemy actor and clears ended/dead actors',()=>{
  const v=view();v.phase='enemy';v.actorId='enemy';
  expect(hudActorId(v)).toBe('enemy');
  v.units[1].alive=false;
  expect(hudActorId(v)).toBeNull();
  v.units[1].alive=true;v.phase='ended';
  expect(hudActorId(v)).toBeNull();
  v.phase='settling';
  expect(hudActorId(v)).toBeNull();
 });
});

describe('tactical HUD abilities',()=>{
 it('keeps the basic attack plus all four skills, even when the source does not put the basic first',()=>{
  const v=view();
  v.abilities=[v.abilities[1],v.abilities[2],v.abilities[0],v.abilities[3],v.abilities[4],ability('extra-skill','skill',4)];
  const before=structuredClone(v);
  expect(hudAbilities(v).map(a=>a?.id)).toEqual(['basic','skill-1','skill-2','skill-3','skill-4']);
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true);
  expect(buttons(html)).toHaveLength(5);
  expect(html).toContain('data-id="skill-4"');
  expect(html).not.toContain('data-id="extra-skill"');
  expect(v).toEqual(before);
 });

 it('assigns B to the basic attack and 1–4 to equipped skills only',()=>{
  const v=view();
  expect(hudAbilityShortcut(v,'B')?.id).toBe('basic');
  expect(hudAbilityShortcut(v,'b')?.id).toBe('basic');
  expect(['1','2','3','4'].map(key=>hudAbilityShortcut(v,key)?.id)).toEqual(['skill-1','skill-2','skill-3','skill-4']);
  for(const key of ['0','5','M','ArrowLeft','11',''])expect(hudAbilityShortcut(v,key)).toBeNull();
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true);
  expect(buttons(html).map(button=>button.match(/aria-keyshortcuts="([^"]+)"/)?.[1])).toEqual(['B','1','2','3','4']);
 });

 it('renders missing slots as unavailable placeholders without inventing skills or commands',()=>{
  const v=view();v.abilities=[];
  expect(hudAbilities(v)).toEqual([null,null,null,null,null]);
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true);
  expect(html).toContain('未配置普通攻击');
  expect(html.match(/aria-label="未装配技能"/g)).toHaveLength(4);
  expect(buttons(html)).toHaveLength(0);
  expect(html).not.toContain('data-action="ability"');
  expect(hudAbilityShortcut(v,'B')).toBeNull();
  expect(hudAbilityShortcut(v,'4')).toBeNull();
 });

 it('turns every spent attack into a focusable read-only detail entry even if source availability is stale',()=>{
  const v=view();v.budget.mainActionUsed=true;
  expect(v.abilities.every(a=>a.available)).toBe(true);
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true);
  expect(buttons(html)).toHaveLength(5);
  expect(buttons(html).every(button=>button.includes('data-action="ability-info"')&&button.includes('data-skill-available="false"'))).toBe(true);
  expect(buttons(html).every(button=>!/\sdisabled(?:\s|>)/.test(button))).toBe(true);
  expect(html).not.toContain('data-action="ability"');
  expect(html).toContain('不可施放：主行动已使用，查看技能详情');
  expect(html).toContain('主行动已使用');
  expect(html).toContain('已出手');
 });

 it('retains explicit unsupported/unavailable states and the outer input lock',()=>{
  const v=view();
  v.abilities[1].migration='unsupported';
  v.abilities[2].available=false;v.abilities[2].reason='蓝量不足';
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true),shown=buttons(html);
  expect(shown[0]).toContain('data-action="ability"');
  expect(shown[0]).toContain('data-skill-available="true"');
  expect(shown[1]).toContain('data-action="ability-info"');
  expect(shown[2]).toContain('data-action="ability-info"');
  expect(shown[1]).not.toMatch(/\sdisabled(?:\s|>)/);
  expect(shown[2]).not.toMatch(/\sdisabled(?:\s|>)/);
  expect(html).toContain('尚未开放');
  expect(html).toContain('蓝量不足');
  const locked=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),false);
  expect(buttons(locked).every(button=>button.includes('data-action="ability-info"'))).toBe(true);
  expect(locked).not.toContain('data-action="ability"');
  expect(locked).toContain('当前不能施放');
 });

 it('never emits a cast action for unavailable skills with an empty reason or an in-flight command',()=>{
  const v=view(),selection=initialSelection({x:1,y:1});
  v.abilities[1].available=false;v.abilities[1].reason='';
  const emptyReason=buttons(hudAbilitySlotsHtml(v,selection,true))[1];
  expect(emptyReason).toContain('data-action="ability-info"');
  expect(emptyReason).toContain('不可施放：当前不可用');
  const submitting={...selection,submitting:{commandId:'pending',encounterId:v.encounterId,expectedRevision:1,
   actionToken:'action-1',kind:'end-activation' as const}};
  expect(hudAbilitySlotsHtml(v,submitting,true)).not.toContain('data-action="ability"');
 });

 it('links an opened read-only skill detail without masquerading as a selected attack',()=>{
  const v=view();v.abilities[1].available=false;v.abilities[1].reason='蓝量不足';
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true,'skill-1'),button=buttons(html)[1];
  expect(button).toContain('data-action="ability-info"');
  expect(button).toContain('aria-expanded="true"');
  expect(button).toContain('aria-controls="tb-hud-detail"');
  expect(button).toContain('aria-pressed="false"');
  expect(button).not.toContain(' title=');
  expect(buttons(html)[0]).not.toContain('aria-controls=');
 });

 it('escapes source text and image attributes rather than inserting executable markup',()=>{
  const v=view(),a=v.abilities[1];
  a.id='skill-"quoted';a.label='<b>技能</b>';a.description='"描述" & 说明';
  a.cost='<img src=x>';a.iconSrc='/art/example.png" onerror="alert(1)';
  const html=hudAbilitySlotsHtml(v,initialSelection({x:1,y:1}),true);
  expect(html).toContain('data-id="skill-&quot;quoted"');
  expect(html).toContain('&lt;b&gt;技能&lt;/b&gt;');
  expect(html).toContain('&quot;描述&quot; &amp; 说明');
  expect(html).toContain('&lt;img src=x&gt;');
  expect(html).not.toContain('<b>技能</b>');
  expect(html).not.toContain('" onerror="');
  expect(html).toContain('src="/art/example.png&quot; onerror=&quot;alert(1)"');
 });
});

describe('read-only tactical skill details and context',()=>{
 it('shows only supplied skill facts inside a scrollable body and does not change the source',()=>{
  const v=view(),a=v.abilities[1];
  a.label='横扫';a.description='攻击前方目标';a.cost='蓝量 20';a.rangeText='前方 2 格';a.cooldown='冷却 2 次行动';
  a.available=false;a.reason='蓝量不足';
  const before=structuredClone(v),html=hudAbilityInfoHtml(v,a.id);
  expect(html).toContain('<div class="tb-compact-detail-content"><h3 class="tb-card-title">横扫</h3><div class="tb-compact-detail-scroll"');
  expect(html).toContain('tabindex="0" data-focus="hud-detail-scroll" data-scroll-key="ability:skill-1"');
  for(const text of ['攻击前方目标','蓝量 20','前方 2 格','冷却 2 次行动','不可施放：蓝量不足'])expect(html).toContain(text);
  expect(html).not.toContain('data-action="ability"');
  expect(v).toEqual(before);
 });

 it('omits unknown fields, respects an outer input lock, and does not invent an unknown skill',()=>{
  const v=view(),html=hudAbilityInfoHtml(v,'basic');
  for(const label of ['<dt>消耗</dt>','<dt>范围</dt>','<dt>冷却</dt>'])expect(html).not.toContain(label);
  expect(html).not.toContain('蓝量');
  expect(hudAbilityInfoHtml(v,'unknown')).toBe('');
  expect(hudAbilityInfoHtml(v,'basic',false)).toContain('不可施放：当前不能施放');
 });

 it('escapes every source field in detail markup while keeping short context as plain text',()=>{
  const v=view(),a=v.abilities[1];
  a.label='<b>横扫</b>';a.description='<img src=x onerror=alert(1)>';a.cost='"20" & 蓝量';
  a.rangeText='<前方>';a.cooldown='冷却 <2>';a.available=false;a.reason='<蓝量不足>';
  const html=hudAbilityInfoHtml(v,a.id);
  for(const text of ['<b>横扫</b>','<img src=x','<前方>','<蓝量不足>'])expect(html).not.toContain(text);
  expect(html).toContain('&lt;b&gt;横扫&lt;/b&gt;');
  expect(html).toContain('&quot;20&quot; &amp; 蓝量');
  const selection={...initialSelection({x:1,y:1}),command:'ability' as const,abilityId:a.id};
  expect(hudAbilityContext(v,selection)).toBe('<b>横扫</b> · "20" & 蓝量 · <前方> · 冷却 <2> · 不可施放：<蓝量不足>');
  expect(hudAbilityContext(v,selection)).not.toContain(a.description);
  expect(hudAbilityContext(v,initialSelection({x:1,y:1}))).toBe('');
  expect(hudAbilityContext(v,{...selection,abilityId:'unknown'})).toBe('');
 });
});

describe('tactical HUD idle movement',()=>{
 it('uses only source-provided destinations without mutating the view, budget or selection',()=>{
  const v=view(),selection=initialSelection({x:1,y:1});
  const beforeView=structuredClone(v),beforeSelection=structuredClone(selection);
  expect(idleMoveSelection(v,selection)).toMatchObject({command:'move',target:null,preview:null,previewPending:false});
  expect(shouldPreviewIdleMove(v,selection,{x:2,y:1})).toBe(true);
  // This adjacent empty cell is not in the published legal set: no client pathfinding fallback.
  expect(shouldPreviewIdleMove(v,selection,{x:1,y:2})).toBe(false);
  expect(v).toEqual(beforeView);expect(selection).toEqual(beforeSelection);
  v.legalMoves=[];
  expect(idleMoveSelection(v,selection)).toBe(selection);
  expect(shouldPreviewIdleMove(v,selection,{x:2,y:1})).toBe(false);
 });

 it('does not automatically select movement while submitting, under auto, ended, offline or in a modal',()=>{
  const v=view(),selection=initialSelection({x:1,y:1});
  const submitting={...selection,submitting:{commandId:'pending',encounterId:v.encounterId,expectedRevision:1,
   actionToken:'action-1',kind:'end-activation' as const}};
  expect(idleMoveSelection(v,submitting)).toBe(submitting);
  expect(idleMoveSelection(v,selection,false)).toBe(selection);
  expect(shouldPreviewIdleMove(v,selection,{x:2,y:1},false)).toBe(false);
  const modal={...selection,confirmRetreat:true};
  expect(idleMoveSelection(v,modal)).toBe(modal);
  const selectingSkill={...selection,command:'ability' as const,abilityId:'skill-1'};
  expect(idleMoveSelection(v,selectingSkill)).toBe(selectingSkill);
  v.control.mode='auto';expect(idleMoveSelection(v,selection)).toBe(selection);
  v.control.mode='manual';v.budget.ended=true;expect(idleMoveSelection(v,selection)).toBe(selection);
  v.budget.ended=false;v.budget.moveUsed=true;expect(idleMoveSelection(v,selection)).toBe(selection);
  v.budget.moveUsed=false;v.phase='enemy';expect(idleMoveSelection(v,selection)).toBe(selection);
  v.phase='resolving';expect(idleMoveSelection(v,selection)).toBe(selection);
  v.phase='ended';expect(idleMoveSelection(v,selection)).toBe(selection);
 });

 it('keeps live-unit clicks as inspection instead of converting them into movement',()=>{
  const v=view(),selection=initialSelection({x:1,y:1});
  // Even if a source projection contains an occupied destination, the idle affordance must not steal unit inspection.
  v.legalMoves.push({cell:{x:3,y:1},cost:2,path:[{x:1,y:1},{x:2,y:1},{x:3,y:1}]});
  v.legalMoves.push({cell:{x:1,y:1},cost:0,path:[{x:1,y:1}]});
  expect(shouldPreviewIdleMove(v,selection,{x:3,y:1})).toBe(false);
  expect(shouldPreviewIdleMove(v,selection,{x:1,y:1})).toBe(false);
  v.units[1].alive=false;
  expect(shouldPreviewIdleMove(v,selection,{x:3,y:1})).toBe(true);
 });
});
