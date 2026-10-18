import {it,expect} from 'vitest';
import {battleResultHtml} from '../apps/web/src/battle-result-panel.ts';
import {combatFatalHitHtml,combatAdviceHtml} from '../apps/web/src/combat-review-view.ts';
import {gearAffixes,gearSetChanges,SetBonusTooltip} from '../apps/web/src/components/gear-metadata.ts';
import {taskPanel} from '../apps/web/src/task-panel.ts';
import {initialTaskUI} from '../apps/web/src/task-model.ts';
import * as skillView from '../apps/web/src/skills-panel.ts';
import {damageBreakdown} from '../apps/web/src/damage-breakdown-model.ts';
const {renderSkills}=skillView;
import {hits} from '../tools/copy-voice-scan.ts';
import {makeGear,resolveBuild} from '../packages/rules/index.ts';
import type {BattleResult,CombatReview,StageKeyProgress,TaskEntry,TaskView,Snapshot} from '../packages/contracts/index.ts';

const result=(success=false):BattleResult=>({permit_id:crypto.randomUUID(),region:'ss-map-boss-1',cycle:1,success,first_clear:false,unlocked_regions:[],totals:{gold:0,xp:0,material:0},materials:{},books:{},gear:[],pending_gear:0,delivery:'inventory',history_complete:true});
const key={scope:'stage:4',stage:4,dungeon:'field-mist-1',materials:6,required:25,obtained:false,choices:[]} as StageKeyProgress;
const fatal={enemy:'逐风幼牙',skill:'普通攻击',damage:12,damageType:'物理',statuses:['减速'],hint:'它会贴近你再出手',kind:'melee' as const};
const review:CombatReview={fatal,recent:[],advice:[{label:'控场技能',target:'skills'},{label:'加生存天赋',target:'survival'},{label:'强化护甲',target:'forge',focus:'armor'}]};
it('compacts a confirmed zero-reward result and removes redundant headings',()=>{
 const html=battleResultHtml({region:'ss-map-boss-1',outcome:'failure'},result(),'ready','拾星港','',false,0,review,key);
 expect(html).toContain('is-empty');expect(html).toContain('这次没带回东西');
 for(const text of ['整备再战','凯旋而归','返回地点','本次挑战','普通首领 0/6','雾铃树穴钥匙碎片'])expect(html).not.toContain(text);
 expect(html).toContain('data-action="result-retry"');expect(html).toContain('data-action="result-return"');
});
it('keeps a key only when its stage belongs to this dungeon, and acknowledges actual first clear',()=>{
 const data={...result(true),first_clear:true,totals:{gold:20,xp:40,material:0}};
 const html=battleResultHtml({region:'meadow',outcome:'success',keyStage:4},data,'ready','拾星港','',false,0,undefined,key);
 expect(html).toContain('首次通关奖励已领取');expect(html).toContain('6 / 25');expect(html).not.toContain('is-empty');
 const unrelated=battleResultHtml({region:'meadow',outcome:'success',keyStage:1},{...data,first_clear:false},'ready','拾星港','',false,0,undefined,key);
 expect(unrelated).not.toContain('review-key');expect(unrelated).not.toContain('首次通关奖励已领取');
});
it('uses registered hand-drawn illustrations and retains advice destinations',()=>{
 const hit=combatFatalHitHtml(fatal),buttons=combatAdviceHtml(review.advice);
 expect(hit).toContain('review-fatal__art');expect(hit).toContain('物理招式');expect(hit).toContain('减速');
 expect(buttons.match(/class="review-advice__art"/g)).toHaveLength(3);
 for(const id of ['skills','survival','forge:armor'])expect(buttons).toContain('data-id="'+id+'"');
});
it('keeps affix values while removing internal tier labels and explains lost set pieces',()=>{
 const gear={...makeGear(0,'copy-polish'),affixes:[{id:'a',stat:'attack',value:3,name:'攻击',description:'攻击 +3',tier:1 as const}]};
 const original=JSON.stringify(gear),html=gearAffixes(gear);expect(html.replace(/<[^>]+>/g,'')).toContain('攻击 +3');expect(html).not.toContain('>T1<');expect(JSON.stringify(gear)).toBe(original);
 const before={setId:'set-sword-standard',setName:'割裂',count:1,total:6,activeBonuses:[]},after={...before,count:0};
 const changed=gearSetChanges([before],[after]);expect(changed).toContain('套装 割裂：');expect(changed).toContain('换上后失去 1 件（1/6 → 0/6）');
 expect(SetBonusTooltip({name:'割裂',bonuses:[]} as any,{...before,artStage:1})).not.toContain('造型');
});
const goal='回港整理应答名录，确认契约与召唤石的记录用途。';
const entry=(patch:Partial<TaskEntry>={}):TaskEntry=>({id:'current:q',taskId:'q',typeId:'side',typeName:'支线',title:'解读旧航约',state:'active',goal,current:0,total:1,summary:goal,story:null,area:'霜镜岛',place:goal,regionId:'ss-map-port',tags:[],reward:{gold:1800,material:0,xp:0},goalAt:null,claimedAt:null,chain:[],note:'前往发现点或人物身边接取。',source:'current',...patch});
function task(patch:Partial<TaskEntry>={},pending=false){const ui=initialTaskUI(),row=entry(patch);if(pending){ui.states.q='pending';ui.views.current.status='pending';}return taskPanel({ui,data:{characterId:crypto.randomUUID(),revision:0,ruleset_version:'test',types:[],current:[row],archive:[]} as TaskView,processing:false,blocked:false});}
it('shows the goal once, resolves the real map and hides empty relationship blocks',()=>{
 const html=task();expect(html.split(goal)).toHaveLength(2);expect(html).toContain('拾星港');
 for(const text of ['独立任务，无前后任务','前往发现点或人物身边接取','desk-story','desk-chain'])expect(html).not.toContain(text);
 expect(task({regionId:null,area:null})).not.toContain('class="desk-place"');
});
it('retains a distinct authored background and clearly names the pending tab',()=>{
 const background='旧航约上的符记正在回应港口的信号。';const html=task({summary:background},true);
 expect(html).toContain(background);expect(html).toContain('领奖核对');expect(html).toContain('领取已发出，核对后会移入档案');expect(html.split(goal)).toHaveLength(2);
});
it('provides visible public help for the weapon-school label',()=>{
 const gear=makeGear(0,'weapon'),s:any={id:'school',name:'检查',revision:0,build:0,level:1,xp:0,gold:0,material:0,gear:[gear],equipment:{weapon:gear.id},skills:['cut'],skillRanks:{cut:1},progress:{kills:0,regions:['town'],bosses:[],safe:'town',tasks:[]}};
 const snapshot={...s,...resolveBuild(s),capacity:60,rewards:[]} as Snapshot;
 const html=renderSkills({snapshot,skillFocus:'cut',skillCategory:('skillBookTabs' in skillView?'all':'melee') as Parameters<typeof renderSkills>[0]['skillCategory'],processing:false,blocked:false,lastError:'',skillOperation:'',skillOperationId:'',skillStatus:'',skillMessage:''});
 const school=html.slice(html.indexOf('class="ui-caption skill-school"'));expect(school).toContain('ui-help__text');expect(school).toContain('连击释放剑气');
});
it('rejects the newly banned visible words without rejecting level bands or equipment names',()=>{
 for(const text of ['武技亲和','最低造型','T1','T2','T3'])expect(hits(text).length).toBeGreaterThan(0);
 expect(hits('Lv 38–41 · 割裂')).toEqual([]);
});

it('renames old frozen display metadata without changing its value or scope',()=>{
 const stats:any={hp:100,attack:20,armor:5,speed:6,mana:100,regen:5,effects:[],zones:[{id:'weapon-affinity',label:'武器亲和 · 武技',kind:'mult',value:1.14,tags:['martial']}]};
 const old=JSON.stringify(stats),row=damageBreakdown(stats,[],null).independent[0];expect(row.label).toBe('主手加成');expect(row.value).toBe(1.14);expect(JSON.stringify(stats)).toBe(old);
});
