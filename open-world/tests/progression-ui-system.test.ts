import {describe,it,expect,vi} from 'vitest';
import {ProgressionController} from '../apps/web/src/progression-controller.ts';
const apiMock=vi.hoisted(()=>vi.fn());
vi.mock('../apps/web/src/network.ts',()=>({api:apiMock}));
import type {CharacterState} from '../packages/contracts/index.ts';
import {makeGear,ensureProgression,progressionView,previewProgressionAction} from '../packages/rules/index.ts';
import {renderProgression,progressionCost} from '../apps/web/src/progression-panel.ts';
import type {ProgressionUI} from '../apps/web/src/progression-controller.ts';
import {renderChallenges,type ChallengeUI} from '../apps/web/src/progression-challenges.ts';
import {renderAppearance} from '../apps/web/src/appearance-panel.ts';
import type {AppearanceUI} from '../apps/web/src/appearance-controller.ts';
import {appearanceView} from '../packages/rules/appearance.ts';

function state():CharacterState{const gear=[makeGear(0,crypto.randomUUID())];return{id:crypto.randomUUID(),name:'界面测试',revision:3,build:1,level:1,xp:0,gold:100,material:10,gear,equipment:{weapon:gear[0].id},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]}};}
const challenge:ChallengeUI={tab:'high',loading:false,busy:false,error:'',message:'',tiers:{},roles:{}};
function progression(){const s=state();ensureProgression(s);const view=progressionView(s),item=view.sections.find(x=>x.id==='weapons')!.items[0],operation=item.operations[0];const ui:ProgressionUI={view,section:'weapons',item:item.id,operation:operation.id,preview:previewProgressionAction(s,operation.action),loading:false,previewLoading:false,busy:false,error:'',message:'',status:''};return{s,ui};}
const disabled=(html:string,action:string)=>new RegExp(`<button[^>]*data-action="${action}"[^>]*disabled`).test(html);
describe('progression shared UI states',()=>{
 it('distinguishes an unknown owned currency from a real zero balance',()=>{const {ui}=progression(),view=ui.view!;view.currencies=view.currencies.filter(x=>x.id!=='gold');const unknown=progressionCost({gold:20,material:0,items:{}},view);expect(unknown).toContain('data-availability="unknown"');expect(unknown).toContain('持有 —');view.currencies.push({id:'gold',name:'金币',amount:0,source:'测试'});const zero=progressionCost({gold:20,material:0,items:{}},view);expect(zero).toContain('data-availability="short"');expect(zero).toContain('持有 0');});
 it('never confirms or presents a stale quote as current',()=>{const {s,ui}=progression();ui.preview!.revision--;const html=renderProgression(ui,challenge,'grid',false,s.gear);expect(html).toContain('读取中…');expect(html).not.toContain('data-ui="resource-cost"');expect(disabled(html,'progression-run')).toBe(true);});
 it('uses the selected group when the previous section has not caught up',()=>{const {s,ui}=progression();const html=renderProgression(ui,challenge,'aspects',false,s.gear);expect(html).toContain('传奇威能法典');expect(html).not.toContain('主手</b>');expect(html).not.toContain('读取中…');});
 it('keeps pending writes visibly blocked and hides the old price',()=>{const {s,ui}=progression();ui.status='pending';ui.message='操作结果待确认';const html=renderProgression(ui,challenge,'grid',true,s.gear);expect(disabled(html,'progression-run')).toBe(true);expect(html).toContain('data-action="recover"');expect(html).not.toContain('data-ui="resource-cost"');});
 it('新消耗品预览明确报价一瓶，旧专业菜单不再承载使用操作',()=>{const {s}=progression();s.progression!.consumables.tonic_attack=1;const before=structuredClone(s),preview=previewProgressionAction(s,{op:'consumable.use',target:'tonic_attack'});expect(preview.enabled).toBe(true);expect(preview.cost.items).toEqual({tonic_attack:1});expect(s).toEqual(before);expect(progressionView(s).sections.some(section=>section.id==='professions')).toBe(false);});
 it('provides error recovery before a challenge view exists',()=>{const html=renderChallenges({...challenge,error:'连接中断'},false);expect(html).toContain('data-ui="state"');expect(html).toContain('data-action="challenge-refresh"');expect(html).not.toContain('data-action="challenge-run"');});
 it('blocks saving an appearance when its preview is stale',()=>{const s=state(),view=appearanceView(s);const ui:AppearanceUI={view,draft:{head:view.catalog[0].id},preview:{...view,revision:view.revision-1},slot:'head',loading:false,previewLoading:false,busy:false,error:'',message:'',status:'',action:'idle',facing:1,playing:true};const html=renderAppearance(ui,true,false);expect(disabled(html,'appearance-save')).toBe(true);expect(html).toContain('data-ui="tabs"');expect(html).toContain('data-ui="status"');});
 it('keeps seven permanent thumbnail controls across part changes and former expansion flags',()=>{const s=state(),view=appearanceView(s);const ui:AppearanceUI={view,draft:{},preview:view,slot:'head',loading:false,previewLoading:false,busy:false,error:'',message:'',status:'',action:'idle',facing:1,playing:true,loadoutOpen:true};for(const slot of ['head','body'] as const){ui.slot=slot;const html=renderAppearance(ui,false,false);expect(html.match(/class="slot appearance-thumbnail"/g)).toHaveLength(7);expect(html).toContain('七部位当前搭配');expect(html).not.toContain('<dl id="appearance-loadout"');}ui.loadoutOpen=false;expect(renderAppearance(ui,false,false).match(/class="slot appearance-thumbnail"/g)).toHaveLength(7);});
});

describe('progression operation controller',()=>{
 it('skips disabled previews and rejects an old response after selection changes',async()=>{
  const {ui}=progression(),controller=new ProgressionController(()=>{},vi.fn(),()=>false);Object.assign(controller.ui,ui);
  const item=ui.view!.sections.find(s=>s.id==='weapons')!.items[0];item.operations[0].enabled=true;item.operations[1].enabled=false;
  let resolve!:(value:unknown)=>void;apiMock.mockReset().mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const pending=controller.handle('progression-operation',item.operations[0].id);await controller.handle('progression-operation',item.operations[1].id);
  expect(apiMock).toHaveBeenCalledTimes(1);expect(controller.ui.previewLoading).toBe(false);expect(controller.ui.preview).toBeUndefined();resolve(ui.preview);await pending;expect(controller.ui.preview).toBeUndefined();
 });
 it('requires confirmation for reset and rejects confirmation after a revision change',async()=>{
  const {s,ui}=progression();s.level=20;s.gold=1000;s.progression!.talents={'damage-edge':1};ui.view=progressionView(s);ui.section='talents-damage';ui.item='damage-edge';ui.operation='';ui.preview=undefined;
  const write=vi.fn(),controller=new ProgressionController(()=>{},write,()=>false);Object.assign(controller.ui,ui);apiMock.mockReset().mockResolvedValue(previewProgressionAction(s,{op:'talent.reset'}));
  await controller.handle('progression-run','talent.reset');expect(controller.ui.resetConfirm?.id).toBe('talent.reset');expect(write).not.toHaveBeenCalled();controller.ui.view!.revision++;await controller.handle('progression-reset-confirm','talent.reset');expect(write).not.toHaveBeenCalled();
 });
});

describe('talent tree rendering compatibility',()=>{
 it('draws the tree with learn actions for a fresh character, without any specialization step',()=>{const {s,ui}=progression();s.level=2;ui.view=progressionView(s);ui.section='talents-damage';ui.item='damage-edge';ui.operation='';ui.preview=undefined;const html=renderProgression(ui,challenge,'talents',false,s.gear);expect(html).not.toContain('talent-introduction');expect(html).toContain('class="talent-tree"');expect(html).not.toContain('专精');expect(html).toContain('投入 1 点');});
 it('falls back to the original list when metadata is absent',()=>{const {s,ui}=progression();s.level=2;ui.view=progressionView(s);ui.section='talents-damage';ui.item='damage-edge';for(const item of ui.view!.sections.find(s=>s.id===ui.section)!.items){delete item.tier;delete item.state;delete item.rank;delete item.max;delete item.effects;}const html=renderProgression(ui,challenge,'talents',false,s.gear);expect(html).not.toContain('class="talent-tree"');expect(html).toContain('progression-entry');expect(html).toContain('锋锐');});
});

describe('progression selection during a quote request',()=>{
 it('does not submit the newly selected operation when an earlier run quote completes',async()=>{
  const {ui}=progression(),write=vi.fn(),controller=new ProgressionController(()=>{},write,()=>false);Object.assign(controller.ui,ui);
  const item=ui.view!.sections.find(s=>s.id==='weapons')!.items[0],first=item.operations[0],second=item.operations[1];first.enabled=second.enabled=true;
  let resolve!:(value:unknown)=>void;apiMock.mockReset().mockImplementationOnce(()=>new Promise(r=>{resolve=r;})).mockResolvedValue({...ui.preview,action:first.action,enabled:true});
  const run=controller.handle('progression-run',second.id);await controller.handle('progression-operation',first.id);resolve({...ui.preview,action:second.action,enabled:true});await run;expect(write).not.toHaveBeenCalled();expect(controller.ui.operation).toBe(first.id);
 });
 it('falls back for partially populated talent metadata instead of rendering missing ranks',()=>{const {s,ui}=progression();ui.section='talents-damage';ui.item='damage-edge';delete ui.view!.sections.find(s=>s.id===ui.section)!.items[1].rank;const html=renderProgression(ui,challenge,'talents',false,s.gear);expect(html).not.toContain('class="talent-tree"');expect(html).not.toContain('undefined/');});
});
