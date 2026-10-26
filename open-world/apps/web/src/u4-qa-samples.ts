import type {Snapshot,SkillAccess,CraftingView} from '../../../packages/contracts/index.ts';
import {progressionStateSchema,type ProgressionView} from '../../../packages/contracts/deep-progression.ts';
import {skillCatalog} from '../../../packages/content/index.ts';
import {glyphDefinitions,talentDefinitions,paragonDefinitions,progressionConfig,aspectDefinitions,collectionDefinitions} from '../../../packages/content/deep-progression.ts';
import {craftRecipes,craftFacilities,craftCodex} from '../../../packages/content/crafting.ts';
import {renderSkills} from './skills-panel.ts';
import {renderProgression} from './progression-panel.ts';
import {renderChallenges,type ChallengeUI} from './progression-challenges.ts';
import {challengeContent} from '../../../packages/content/progression-challenges.ts';
import {CraftingPanel,craftingTabsHtml} from './components/CraftingPanel.ts';
import type {CraftingUI} from './crafting-controller.ts';
import {panelHeaderHtml} from './ui-components.ts';
import {hydrateGrowthFeedback} from './ui/growth-feedback.ts';

// Read-only renderer fixtures use public content IDs; no rules entrypoint or API writes.
export function u4SkillSnapshot(rank=1):Snapshot{
 const skillAccess:SkillAccess[]=skillCatalog.map((skill,i)=>({id:skill.id,unlocked:i<4,unlockLevel:skill.unlockLevel,activated:i<4,rank:i===0?rank:i<4?1:0,max:false,eligible:i<8,activation:{type:'level',required:skill.unlockLevel,current:20},action:i<4?'upgrade':'activate',cost:{gold:60,material:0},affordable:i<8,blocked:i<8?'':'level',current:i<4?skill:null,next:skill}));
 return {id:'u4-qa-character',name:'静态验收',revision:1,build:1,level:20,xp:0,gold:1200,material:20,gear:[],equipment:{},skills:[skillCatalog[0].id],skillRanks:{[skillCatalog[0].id]:rank},skillBooks:{},progress:{kills:0,regions:['town','meadow'],bosses:[],safe:'town',tasks:[]},stats:{weapon:'sword',combos:[]},skillAccess,rewards:[],capacity:24,progression:progressionStateSchema.parse({materials:{wind_ore:8,stardust:20}})} as unknown as Snapshot;
}
const shell=(panel:string,title:string,body:string)=>`<section class="panel panel-wide" data-panel="${panel}" role="dialog" aria-label="${title}">${panelHeaderHtml(title)}${body}</section>`;
const skillSample=(rank:number,success=false)=>shell('skills','技能',renderSkills({snapshot:u4SkillSnapshot(rank),skillFocus:skillCatalog[0].id,skillCategory:'martial',processing:false,blocked:false,lastError:'',skillOperation:success?'upgrade':'',skillOperationId:success?skillCatalog[0].id:'',skillStatus:success?'success':'',skillMessage:success?'升级已确认。':''}));
export function u4ProgressionView():ProgressionView{
 return {revision:1,ruleset_version:'qa',state:progressionStateSchema.parse({}),currencies:[{id:'gold',name:'金币',amount:1200,source:'静态样例'},{id:'material',name:'强化石',amount:20,source:'静态样例'}],summary:[],sections:[{id:'glyphs',name:'雕文',description:'雕文强化进度',items:glyphDefinitions.map((g,i)=>({...g,description:'公开雕文样例，仅展示状态。',status:i===0?'已解锁':'待解锁',state:i===0?'learned':'available',rank:i===0?2:0,max:21,radius:3,operations:[{id:'glyph-'+g.id,label:i===0?'升级':'解锁',action:{op:i===0?'glyph.level':'glyph.unlock',target:g.id},cost:{gold:80,material:0,items:{}},enabled:true,reason:''}]}))}]};
}
export function u4CraftingFixture():{snapshot:Snapshot;ui:CraftingUI}{
 const snapshot=u4SkillSnapshot(),recipes=craftRecipes.filter(r=>r.profession==='smithing').slice(0,16).map(({output,...recipe})=>({...recipe,known:true}));
 const facilities=craftFacilities.filter(f=>f.level===1).map(f=>({id:f.id as 'forge'|'jewel'|'alchemy'|'enchant',name:f.name,level:f.level,maxLevel:6 as const,appearanceTier:1 as const,effects:f.effects,next:null}));
 const view:CraftingView={revision:1,ruleset_version:'qa',atForge:true,forgeReason:'',materials:[],professions:[{id:'smithing',name:'锻造',level:20,xp:35,xpNext:100,fineChance:.05}],recipes,patterns:[],codex:craftCodex.slice(0,4).map(c=>({id:c.id,name:c.name,required:craftRecipes.filter(r=>r.island===c.island).length,current:1,bonus:c.description,claimed:false})),facilities,refine:[{from:'wind_ore',to:'stardust',inputCount:2,outputCount:1},{from:'stardust',to:'wind_ore',inputCount:2,outputCount:1}],masterwork:{unlocked:true,reason:'',maxLevel:5},stageKey:null};
 snapshot.gear=[{id:'u4-qa-weapon',base:'standard-sword-t1-weapon',name:'铁心短剑',slot:'weapon',attack:10,armor:0,effect:'none',rank:0,locked:false,quality:'rare',affixes:[]}];
 const recipe=recipes[0];
 const ui:CraftingUI={tab:'craft',view,filter:{profession:'smithing',island:'',showUnknown:false,query:''},patternFilter:{profession:'smithing',island:'',showUnknown:false,query:''},recipe:recipe.id,options:{count:1},masterworkGear:'',refineFrom:'wind_ore',exchangeTo:'wind_ore',times:1,previewLoading:false,loading:false,busy:false,message:'',error:'',status:'',preview:{revision:1,action:{op:'craft',recipe:recipe.id},enabled:true,reason:'',cost:recipe.baseCost,output:{kind:'gear',name:recipe.name,icon:'sys-build',count:1,quality:'rare'},bagFull:false}};
 return {snapshot,ui};
}
const progressionLabels={'talents-damage':'伤害天赋',paragon:'巅峰盘',character:'突破觉醒','skill-awakening':'技能觉醒',summons:'召唤石',reputation:'区域声望',aspects:'威能法典',collection:'收集奖励'};
type Section=ProgressionView['sections'][number];
function progressionSample(id:keyof typeof progressionLabels){
 const view=u4ProgressionView(),operation=(target:string,op:Section['items'][number]['operations'][number]['action']['op']='talent.learn')=>[{id:op+':'+target,label:'投入',action:{op,target},cost:{gold:80,material:1,items:{}},enabled:true,reason:''}];
 let items:Section['items'];
 if(id==='talents-damage')items=talentDefinitions.filter(t=>t.branch==='damage').map((t,i)=>({id:t.id,name:t.name,description:'公开天赋节点样例',status:i<3?'已投入':'可投入',state:i<3?'learned':'available',tier:t.tier,tierUnlocked:t.tier<3,rank:i<3?1:0,max:t.max,exclusive:t.exclusive,effects:t.modifiers.map(m=>({stat:m.stat,label:m.stat,value:m.value})),operations:operation(t.id)}));
 else if(id==='paragon')items=paragonDefinitions.filter(n=>n.board===0).map((n,i)=>({...n,description:'公开巅峰节点样例',status:i<3?'已点亮':'可点亮',state:i<3?'learned':'available',operations:operation(n.id,'paragon.learn')}));
 else if(id==='reputation')items=progressionConfig.factions.slice(0,4).map(f=>({id:f.id,name:f.name,description:'击败本地怪物积累声望。',status:'友善 · 150',state:'available',rank:1,max:4,currentValue:150,nextValue:300,progressRatio:.5,rewardTiers:[{rank:1,name:'友善',required:100,state:'learned',rewards:[]},{rank:2,name:'尊敬',required:300,state:'available',rewards:[]}],operations:operation(f.id,'reputation.claim')}));
 else if(id==='summons')items=progressionConfig.summons.slice(0,4).map((d,i)=>({id:d.id,name:d.name,description:'公开召唤石加护样例',status:i===0?'Lv. 2':'未拥有',state:i===0?'learned':'available',rank:i===0?2:0,max:200,operations:operation(d.id,i===0?'summon.level':'summon.unlock')}));
 else if(id==='aspects')items=aspectDefinitions.slice(0,5).map(a=>({id:a.id,name:a.name,description:a.description,status:'已收录 Lv. 1',state:'learned',rank:1,max:5,operations:[]}));
 else if(id==='collection')items=collectionDefinitions.slice(0,5).map(c=>({id:c.id,name:c.name,description:'收集奖励样例',status:'未领取',state:'available',operations:operation(c.id,'collection.claim')}));
 else items=(id==='character'?[{id:'uncap',name:'角色突破'},{id:'awakening',name:'觉醒等级'}]:skillCatalog.slice(0,4)).map((x,i)=>({id:x.id,name:x.name,description:'已有成长阶段的静态样例',status:'进度 1 / 5',state:'available',rank:1,max:5,stages:Array.from({length:5},(_,n)=>({id:String(n+1),label:'阶段 '+(n+1),state:n===0?'learned':n===1?'available':'locked'})),operations:operation(x.id,id==='character'?(i===0?'character.uncap':'awakening.level'):'skill.awaken')}));
 const section:Section={id,name:progressionLabels[id],description:'静态验收样例',items,...(id.startsWith('talents-')?{points:{available:3,total:6}}:{})};view.sections=[section];
 const item=items[0],op=item?.operations[0],group=id.startsWith('talents-')?'talents':id==='collection'?'aspects':id==='skill-awakening'?'character':id;
 return shell('progression','养成',renderProgression({view,section:id,item:item?.id??'',operation:op?.id??'',loading:false,previewLoading:false,busy:false,message:'',error:'',status:'',...(op?{preview:{revision:1,ruleset_version:'qa',action:op.action,cost:op.cost,enabled:true,reason:'',summary:'静态报价',before:{attack:100,hp:200,armor:20},after:{attack:105,hp:200,armor:20}}}:{})},{tab:'high',loading:false,busy:false,error:'',message:'',tiers:{},roles:{}},group,false));
}
function craftSample(tab:CraftingUI['tab']){
 const {snapshot,ui}=u4CraftingFixture();ui.tab=tab;
 if(tab==='pattern'){
  ui.view!.recipes=craftRecipes.filter(r=>r.category==='pattern').slice(0,6).map(({output,...r})=>({...r,known:true}));
  const r=ui.view!.recipes[0];ui.recipe=r.id;ui.preview={revision:1,action:{op:'craft',recipe:r.id},enabled:true,reason:'',cost:r.baseCost,output:{kind:'gear',name:r.name,icon:'sys-build',quality:'legendary',count:1},bagFull:false};
 }
 if(tab==='masterwork'){ui.masterworkGear=snapshot.gear[0].id;ui.preview={revision:1,action:{op:'masterwork.apply',gear:ui.masterworkGear},enabled:true,reason:'',cost:{gold:80,materials:{wind_ore:3}},output:{kind:'masterwork',name:snapshot.gear[0].name,icon:'gear-'+snapshot.gear[0].base,count:1,statChanges:[{label:'攻击',before:'10',after:'12'}]},bagFull:false};}
 return shell('forge','拾星港工坊',craftingTabsHtml(ui)+CraftingPanel(snapshot,ui,false));
}
function challengeSample(tab:ChallengeUI['tab']){
 const {season,limits}=challengeContent;
 const ui:ChallengeUI={tab,loading:false,busy:false,error:'',message:'',tiers:{},roles:{},view:{revision:1,ruleset_version:'qa',entries:challengeContent.entries.map(e=>({id:e.id,name:e.name,kind:e.kind,description:e.description,level:e.level,eligible:true,reason:'',used:0,limit:e.kind==='raid'?limits.raidWeekly:limits.highDaily,maxTier:challengeContent.nightmare.maxTier,stages:e.stages,reward:`金币 ${e.reward.gold} · 经验 ${e.reward.xp}`})),bestTier:3,season:{id:season.id,name:season.name,start:season.start,end:season.end,active:true,xp:300,rewards:season.rewards.map(r=>({...r,claimed:false,eligible:r.xp<=300}))},leaderboard:[{name:'静态验收队员',tier:3,ticks:300}],lobbies:[]}};
 return shell('progression','挑战赛季',`<div class="progression-workspace">${renderChallenges(ui,false)}</div>`);
}
export const u4QaCases:{id:string;label:string;render:()=>string;mount?:(root:HTMLElement)=>void}[]=[
 {id:'u4-skills',label:'U4 技能三态',render:()=>skillSample(1),mount:hydrateGrowthFeedback},
 {id:'u4-skill-upgrade',label:'U4 升级反馈',render:()=>skillSample(2,true),mount:root=>{const first=root.querySelector<HTMLElement>('[data-growth-key="u4-qa-character:skill:'+skillCatalog[0].id+'"]');if(first){first.dataset.growthValue='1';hydrateGrowthFeedback(root);first.dataset.growthValue='2';hydrateGrowthFeedback(root);}}},
 {id:'u4-glyphs',label:'U4 雕文养成',render:()=>{const view=u4ProgressionView(),item=view.sections[0].items[0],op=item.operations[0];return shell('progression','养成',renderProgression({view,section:'glyphs',item:item.id,operation:op.id,loading:false,previewLoading:false,busy:false,message:'',error:'',status:'',preview:{revision:1,ruleset_version:'qa',action:op.action,cost:op.cost,enabled:true,reason:'',summary:'静态升级报价',before:{attack:100,hp:200,armor:20},after:{attack:105,hp:200,armor:20}}},{tab:'high',loading:false,busy:false,error:'',message:'',tiers:{},roles:{}},'paragon',false));},mount:hydrateGrowthFeedback},
 {id:'u4-craft',label:'U4 工坊制作',render:()=>{const {snapshot,ui}=u4CraftingFixture();return shell('forge','拾星港工坊',craftingTabsHtml(ui)+CraftingPanel(snapshot,ui,false));},mount:hydrateGrowthFeedback},
 {id:'u4-refine',label:'U4 提纯兑换',render:()=>craftSample('refine'),mount:hydrateGrowthFeedback},
 {id:'u4-pattern',label:'U4 图样',render:()=>craftSample('pattern'),mount:hydrateGrowthFeedback},
 {id:'u4-masterwork',label:'U4 精工',render:()=>craftSample('masterwork'),mount:hydrateGrowthFeedback},
 ...(['talents-damage','paragon','character','skill-awakening','summons','reputation','aspects','collection'] as const).map(id=>({id:'u4-'+id,label:'U4 '+progressionLabels[id],render:()=>progressionSample(id),mount:hydrateGrowthFeedback})),
 ...(['high','nightmare','raid','season'] as const).map(tab=>({id:'u4-challenge-'+tab,label:'U4 '+({high:'高难挑战',nightmare:'噩梦挑战',raid:'团队挑战',season:'赛季排名'}[tab]),render:()=>challengeSample(tab),mount:hydrateGrowthFeedback})),
 {id:'u4-facilities',label:'U4 工坊设施',render:()=>{const {snapshot,ui}=u4CraftingFixture();ui.tab='facility';return shell('forge','拾星港工坊',craftingTabsHtml(ui)+CraftingPanel(snapshot,ui,false));},mount:hydrateGrowthFeedback}
];
