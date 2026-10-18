import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import type {CharacterState,Snapshot} from '../packages/contracts/index.ts';
import {resolveBuild} from '../packages/rules/index.ts';
import {renderSkills} from '../apps/web/src/skills-panel.ts';
const character=(patch:Partial<CharacterState>={}):Snapshot=>{const s:CharacterState={id:'ui-skill-state',name:'技能界面检查',revision:1,build:1,level:1,xp:0,gold:0,material:0,gear:[],equipment:{},skills:['cut'],skillRanks:{cut:1,bolt:1,ward:1},skillBooks:{},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]},...patch};return {...s,...resolveBuild(s),rewards:[],capacity:24};};
const view=(snapshot=character(),patch:Partial<Parameters<typeof renderSkills>[0]>={})=>({snapshot,skillFocus:'cut',skillCategory:'martial' as const,processing:false,blocked:false,lastError:'',skillOperation:'' as const,skillOperationId:'',skillStatus:'' as const,skillMessage:'',...patch});
const action=(html:string,name:string)=>html.match(new RegExp(`<button[^>]*data-action="${name}"[^>]*>`))?.[0]??'';
describe('skills shared UI lifecycle',()=>{
 it('keeps numerical parameters in details while retaining descriptive cards and four loadout slots',()=>{
  const html=renderSkills(view()),library=html.split('<aside class="skill-detail"')[0],cut=character().skillAccess.find(q=>q.id==='cut')!.current!;expect(library).not.toContain('skill-card-metrics');expect(library).not.toContain('伤害强度');expect(library).not.toContain('冷却');expect(library).toContain('近距离斩击');expect(html).toContain(`data-effect-value="damage">${cut.damage}</span>`);expect(html).toContain(`data-effect-value="cooldown">${Number((cut.cooldown/30).toFixed(2))}秒</span>`);expect(html).toContain(`<div class="ui-stat-tile"><dt>伤害</dt><dd class="ui-number">${cut.damage}</dd></div>`);expect(html).toContain('<summary>详细数值</summary>');expect(html.match(/class="loadout-step /g)).toHaveLength(4);expect(action(html,'skill-up')).toBe('');expect(action(html,'skill-down')).toBe('');
  const inactive=renderSkills(view(character(),{skillFocus:'whirl'}));expect(inactive).toContain('data-effect-value="damage"');expect(inactive).toContain('data-effect-value="cooldown">2.5秒</span>');
  const support=renderSkills(view(character(),{skillCategory:'support',skillFocus:'haste'}));expect(support).toContain('data-effect-value="cost">20</span>');expect(support).not.toContain('data-effect-value="damage"');
  const snapshot=character();snapshot.skillAccess=[];expect(renderSkills(view(snapshot))).toContain('技能数值待同步');
 });
 it('keeps level activation and book activation separate, without upgrade controls',()=>{
  const level=renderSkills(view(character(),{skillFocus:'whirl'}));expect(level).toContain('等级激活');expect(action(level,'skill-activate')).toContain('disabled');expect(action(level,'skill-upgrade')).toBe('');
  const book=renderSkills(view(character({skillBooks:{ember:1}}),{skillFocus:'ember',skillCategory:'spell'}));expect(book).toContain('技能书激活');expect(book).toContain('data-resource="ember"');expect(book).not.toContain('当前角色等级');expect(action(book,'skill-activate')).not.toContain('disabled');expect(action(book,'skill-upgrade')).toBe('');
 });
 it('uses server upgrade quotes and keeps loadout actions independent from upgrade affordability',()=>{
  const html=renderSkills(view(character()));expect(html).toContain('升级消耗');expect(html).toContain('ui-cost--compact');expect(html).toContain('持有 0');expect(html).toContain('还缺 60');expect(html).toContain('ui-cost__owned');expect(action(html,'skill-upgrade')).toContain('disabled');expect(action(html,'save-skills')).toBe('');expect(action(html,'skill-activate')).toBe('');
 });
 it('uses bottom slots for locating, with immediate equip and unequip actions only in details',()=>{
  const snapshot=character({skills:['cut','bolt']});
  const equipped=renderSkills(view(snapshot));
  expect(equipped).toContain('data-action="skill-locate" data-id="cut"');
  expect(equipped).toContain('aria-label="查看穿云箭');
  expect(action(equipped,'skill-unequip')).not.toContain('disabled');
  expect(equipped).not.toContain('skill-remove');expect(equipped).not.toContain('name="skill"');expect(equipped).not.toContain('保存装配');
  const available=renderSkills(view(snapshot,{skillFocus:'ward',skillCategory:'support'}));
  expect(action(available,'skill-equip')).not.toContain('disabled');
  expect(action(available,'skill-unequip')).toBe('');
  expect(action(renderSkills(view()),'skill-unequip')).toContain('disabled');
  const full=character({skills:['cut','bolt','ward','haste'],skillRanks:{cut:1,bolt:1,ward:1,haste:1,whirl:1}});
  expect(action(renderSkills(view(full,{skillFocus:'whirl'})),'skill-equip')).toContain('disabled');
  expect(action(renderSkills(view(snapshot,{skillLocked:true})),'skill-unequip')).toContain('disabled');
 });
 it('compares resolved current and next ranks, with honest previews for skills without numeric growth',()=>{
  const snapshot=character(),quote=snapshot.skillAccess.find(q=>q.id==='cut')!;
  quote.current!.damage=101;quote.next!.damage=137;
  const html=renderSkills(view(snapshot));expect(html).toContain('<h3 class="ui-section-title"><span>升级到 Lv.2</span></h3>');expect(html).toContain('<dd class="ui-number">101</dd>');expect(html).toMatch(/ui-stat--delta[\s\S]*?伤害强度[\s\S]*?aria-label="101 到 137"/);expect(html.match(/skill-upgrade-changes[\s\S]*?<\/ul>/)?.[0]).not.toContain('冷却');
  const support=renderSkills(view(character({skillRanks:{cut:1,haste:1}}),{skillCategory:'support',skillFocus:'haste'}));expect(support).not.toContain('本次升级数值不变。');expect(support).toContain('提升移动速度');expect(support).not.toContain('data-effect-value="damage"');
  quote.current=null;const unknown=renderSkills(view(snapshot));expect(unknown).toContain('data-lifecycle="syncing"');expect(unknown).not.toContain('skill-effect-comparison');
 });
 it('shows max rank without a misleading next quote',()=>{
  const html=renderSkills(view(character({skillRanks:{cut:5}})));expect(html).toContain('data-lifecycle="max"');expect(html).not.toContain('升级消耗');expect(action(html,'skill-upgrade')).toContain('disabled');expect(action(html,'skill-activate')).toBe('');
 });
 it('treats missing quotes as unknown and blocks writes while leaving recovery usable',()=>{
  const snapshot=character();snapshot.skillAccess.find(q=>q.id==='cut')!.cost=null;const unknown=renderSkills(view(snapshot));expect(unknown).toContain('data-lifecycle="syncing"');expect(action(unknown,'skill-upgrade')).toContain('disabled');expect(unknown).not.toContain('本次无需消耗资源');
  const blocked=renderSkills(view(character(),{blocked:true,skillStatus:'pending',skillMessage:'操作结果待确认'}));expect(action(blocked,'skill-upgrade')).toContain('disabled');expect(action(blocked,'skill-unequip')).toContain('disabled');expect(action(blocked,'recover')).not.toContain('disabled');expect(blocked).not.toContain('data-ui="resource-cost"');
 });
 it('uses shared controls and semantic colors/type without another page palette',()=>{
  const html=renderSkills(view());expect(html).toContain('data-ui="tabs"');expect(html).toContain('data-ui="status"');expect(action(html,'skill-upgrade')).toContain('ui-button--primary');expect(action(html,'skill-unequip')).toContain('ui-button--secondary');
  const css=readFileSync(new URL('../apps/web/src/skills-panel.css',import.meta.url),'utf8');expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?)\(/);expect(css).not.toMatch(/font-size\s*:\s*\d/);expect(css).not.toMatch(/var\(--(?:book-|ink|accent|danger|line\b)/);
 });
});
