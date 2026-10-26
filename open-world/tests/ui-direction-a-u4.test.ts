import {describe,expect,it} from 'vitest';
import {readFileSync} from 'node:fs';
import {GrowthFeedbackTracker,growthFrameValue,growthNumberHtml} from '../apps/web/src/ui/growth-feedback.ts';
import {u4QaCases,u4CraftingFixture,u4SkillSnapshot} from '../apps/web/src/u4-qa-samples.ts';
import {renderSkills} from '../apps/web/src/skills-panel.ts';
import {CraftingPanel} from '../apps/web/src/components/CraftingPanel.ts';
import {craftRecipes} from '../packages/content/crafting.ts';

describe('direction A growth panels',()=>{
 it('keeps card art before the name and ranks at a distinct corner, with one primary action',()=>{
  const html=renderSkills({snapshot:u4SkillSnapshot(),skillFocus:'cut',skillCategory:'martial',processing:false,blocked:false,lastError:'',skillOperation:'',skillOperationId:'',skillStatus:'',skillMessage:''});
  expect(html).toContain('hub-hero-card skill-hero');expect(html).toContain('skill-rank-badge');expect(html).toContain('data-upgradeable="true"');
  expect(html.indexOf('ui-node__art')).toBeLessThan(html.indexOf('skill-card-copy'));
  expect(html.match(/ui-button--primary/g)).toHaveLength(1);
 });
 it('uses only existing recipe IDs and quality wells for workshop outputs',()=>{
  const {snapshot,ui}=u4CraftingFixture();expect(craftRecipes.some(r=>r.id===ui.recipe)).toBe(true);
  const html=CraftingPanel(snapshot,ui,false);expect(html).toContain('craft-recipe hub-card-row');expect(html).toContain('craft-material-pills');expect(html).toContain('bag-item-well quality-rare');expect(html.match(/ui-button--primary/g)).toHaveLength(1);
 });
 it('all static cases render without server-side rules imports',()=>{
  for(const sample of u4QaCases){expect(sample.render()).toContain('role="dialog"');expect(sample.render().match(/ui-button--primary/g)?.length??0).toBeLessThanOrEqual(1);}
  expect(readFileSync(new URL('../apps/web/src/u4-qa-samples.ts',import.meta.url),'utf8')).not.toContain('packages/rules/index');
 });
 it('count feedback preserves actual zero, escapes keys, and ends at the authoritative value',()=>{
  expect(growthNumberHtml('a"<',0,true)).toContain('data-growth-value="0"');expect(growthNumberHtml('a"<',0)).toContain('a&quot;&lt;');
  expect(growthFrameValue(3,8,0,560)).toBe(3);expect(growthFrameValue(3,8,560,560)).toBe(8);expect(growthFrameValue(3,8,900,560)).toBe(8);
  const css=readFileSync(new URL('../apps/web/src/ui/growth-feedback.css',import.meta.url),'utf8');expect(css).toContain('prefers-reduced-motion');expect(css).toContain('[data-motion-reduced=true]');
 });
 it('retains the pre-write rank through pending snapshot refreshes and celebrates only once after confirmation',()=>{
  const tracker=new GrowthFeedbackTracker();
  expect(tracker.observe('skill:cut',1,false)).toBeUndefined();
  expect(tracker.observe('skill:cut',2,false,true)).toBeUndefined();
  expect(tracker.observe('skill:cut',2,true)).toBe(1);
  expect(tracker.observe('skill:cut',2,true)).toBeUndefined();
  expect(tracker.observe('new-character:cut',2,true)).toBeUndefined();
  expect(tracker.observe('skill:cut',1,true)).toBeUndefined();
 });
});
