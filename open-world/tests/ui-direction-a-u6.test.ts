import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {tacticalEncounterHtml,tacticalResultHtml} from '../apps/web/src/tactical/presentation.ts';
import type {TacticalResultView} from '../apps/web/src/tactical/contract.ts';

const result=(patch:Partial<TacticalResultView>={}):TacticalResultView=>({outcome:'victory',receiptId:'qa',rewards:[],rewardsNote:'战棋沙盒 · 不发奖，不写角色存档。',nodeCompleted:true,returnLabel:'返回探索',...patch});
describe('direction A tactical presentation',()=>{
 it('uses the shared ribbon and exact resource pills including zero, with one primary action',()=>{
  const html=tacticalResultHtml(result({rewards:[{label:'金币',amount:'0'},{label:'经验',amount:'150'},{label:'强化石',amount:'2'}]}));
  expect(html).toContain('data-ui="ribbon-title"');
  expect(html).toContain('data-tone="victory"');
  expect(html).toContain('aria-label="金币 0"');
  expect(html.match(/data-ui="resource-pill"/g)).toHaveLength(3);
  expect(html.match(/ui-button--primary/g)).toHaveLength(1);
  expect(html).not.toContain('暂无掉落');
  expect(html).not.toContain('grade-');
  expect(html).not.toContain('ui-ribbon__stars');
 });
 it('preserves untyped rewards, non-numeric quantities and unsafe integers without inventing qualities',()=>{
  const html=tacticalResultHtml(result({rewards:[{label:'材料 <未鉴定>',amount:'待确认'},{label:'金币',amount:'9007199254740993'}]}));
  expect(html).toContain('data-ui="reward-reveal"');
  expect(html).toContain('材料 &lt;未鉴定&gt;');
  expect(html).toContain('待确认');
  expect(html).toContain('9007199254740993');
  expect(html).not.toContain('data-ui="resource-pill"');
  expect(html).not.toMatch(/quality-(magic|rare|legendary)/);
  expect(html).not.toContain('NEW');
  expect(html).not.toContain('HEX');
 });
 it('keeps sandbox empty results truthful and returning actions busy',()=>{
  const html=tacticalResultHtml(result({outcome:'retreat',nodeCompleted:false}),true);
  expect(html).toContain('data-tone="retreat"');
  expect(html).toContain('战棋沙盒 · 不发奖，不写角色存档。');
  expect(html).not.toContain('data-ui="reward-reveal"');
  expect(html).toContain('aria-busy="true"');
  expect(html).toContain('data-focus="result-return"');
 });
 it('adds an existing icon to the encounter card and escapes supplied node names',()=>{
  const html=tacticalEncounterHtml('刀兵 <2>','风栖·近岸刀兵');
  expect(html).toContain('data-icon="swords"');
  expect(html).toContain('刀兵 &lt;2&gt;');
  expect(html).toContain('风栖·近岸刀兵');
 });
 it('keeps the original U6 section limited to sidebars and overlays, with both motion opt-outs',()=>{
  // The later, user-requested battlefield redesign has its own projection/scene tests.
  // Preserve the scope of this historical U6 assertion instead of absorbing every later section.
  const source=readFileSync(new URL('../apps/web/src/tactical/tactical.css',import.meta.url),'utf8');
  const start=source.indexOf('/* U6 Direction A:'),end=source.indexOf('/* Sandbox setup',start);
  expect(start).toBeGreaterThanOrEqual(0);expect(end).toBeGreaterThan(start);
  const css=source.slice(start,end);
  expect(css).not.toMatch(/\.tb-(?:board|cell|actor|grid|dressing|plate)[\s.{:#]/);
  expect(css).toContain('--size-ui-qa-stage-height');
  expect(css).toContain('overflow-y:auto');
  expect(css).toContain('@media(prefers-reduced-motion:reduce)');
  expect(css).toContain('[data-motion-reduced=true]');
  expect(css).not.toMatch(/#[0-9a-f]{3,8}\b/i);
 });
});
