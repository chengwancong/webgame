import {migrateCraftProgression,migrateCraftMaterials} from './crafting-migration.ts';
import {craftConsumables,craftPolicy,craftText,craftCodex,craftMaterialById} from '../content/crafting.ts';
import {activeCraftConsumables} from './crafting-consumables.ts';
import {effectAtomById} from '../content/effect-atoms.ts';
import {newAspectById} from '../content/aspects.ts';
import {rollInscription,inscriptionRubbings,imprintInscription} from './inscriptions.ts';
import {inscriptionConfig} from '../content/inscriptions.ts';
import {assignMainStat} from './main-stats.ts';
import {statRegistry} from '../contracts/stats.ts';
import {starseaFactionByMap,starseaFactionById} from '../content/starsea/reputation.ts';
import {starseaRegionOpen} from './starsea.ts';
import {changeMainHand,gearWeaponType} from './skill-weapon-access.ts';
import type {CharacterState,Stats,Skill,Receipt,Gear} from '../contracts/index.ts';
import {versions} from '../contracts/index.ts';
import {progressionActionSchema,progressionStateSchema,type ProgressionAction,type ProgressionCost,type ProgressionView,type ProgressionPreview} from '../contracts/deep-progression.ts';
import {progressionConfig as cfg,talentTrees,talentTreeNames,talentTreeDescriptions,talentZoneNames,aspectDefinitions,talentDefinitions,paragonDefinitions,glyphDefinitions,skillAwakeningDefinitions,awakeningDefinitions,collectionDefinitions,progressionGearTemplates,type Modifier} from '../content/deep-progression.ts';
import {skillCatalog,settings,regions} from '../content/index.ts';
import {resolveBuild,gearBases,makeGearByBase} from './index.ts';
import {collectionEquipment,equipmentStage,equipmentRuntime} from '../content/equipment-runtime.ts';
import {equipmentClassification,getEquipmentSetName} from '../content/equipment-catalog.ts';
import {generateGearAffixes} from './affix-generator.ts';
import {addZone} from './damage-zones.ts';
import {skillTagNames} from '../content/skill-tags.ts';
import {applyItemPower} from './item-power.ts';
import {starseaIslands,starseaBossMaps,islandBand} from '../content/starsea/index.ts';
import {storyProgressionFeature,storyFeatureUnlocked,storyFeatureReason} from './story-campaign.ts';
import {storyFeatures} from '../content/story-campaign.ts';
export class ProgressionError extends Error{constructor(public code:'progression_invalid'|'progression_blocked',message:string){super(message);}}
function requireRule(ok:unknown,message:string):asserts ok{if(!ok)throw new ProgressionError('progression_blocked',message);}
function invalid(message:string):never{throw new ProgressionError('progression_invalid',message);}
const free=():ProgressionCost=>({gold:0,material:0,items:{}});
const cost=(v:{gold:number;material:number},factor=1,items:Record<string,number>={}):ProgressionCost=>({gold:Math.ceil(v.gold*factor),material:Math.ceil(v.material*factor),items});
let discoveryTemplates:Map<string,string[]>|undefined;
function discoveryKey(entry:string){
 const colon=entry.indexOf(':');if(colon<0)return undefined;
 const region=entry.slice(0,colon),source=entry.slice(colon+1);
 discoveryTemplates??=new Map(regions.map(r=>[r.id,r.spawns.map(m=>m.id).sort((a,b)=>b.length-a.length)]));
 const template=discoveryTemplates.get(region)?.find(id=>source===id||source.endsWith(':'+id));
 return template?region+':'+template:undefined;
}
export function ensureProgression(s:CharacterState){
 migrateCraftProgression(s);
 const parsed=progressionStateSchema.parse(s.progression??{});s.progression=s.progression?Object.assign(s.progression,parsed):parsed;const p=s.progression;
 for(const {id}of craftPolicy.professions)p.crafting.professions[id]??={level:1,xp:0};
 // The equipped main hand is authoritative when old equipment commands switch it.
 p.weaponGrid[0]=s.equipment.weapon??null;for(let k=1;k<9;k++)if(p.weaponGrid[k]&&p.weaponGrid[k]===p.weaponGrid[0])p.weaponGrid[k]=null;
 for(const g of s.gear)if(g.slot==='weapon')p.weapons[g.id]??={level:1,uncap:0};
 // 2026-10-07 天赋四树：旧三系天赋 id 与专精直接清除（开发期清档），点数全部返还。
 delete p.specializations;for(const id of Object.keys(p.talents)){const t=talentDefinitions.find(x=>x.id===id);if(!t||!p.talents[id])delete p.talents[id];else p.talents[id]=Math.min(t.max,p.talents[id]);}
 // Removed inventory instances cannot leave phantom bonuses behind.
 const owned=new Set(s.gear.map(g=>g.id));p.weaponGrid=p.weaponGrid.map(id=>id&&owned.has(id)?id:null);
 for(const id of Object.keys(p.weapons))if(!owned.has(id))delete p.weapons[id];
 for(const id of Object.keys(p.imprints))if(!owned.has(id))delete p.imprints[id];
 // A bestiary tracks finite published templates, never renewable spawn instances.
 // Fold legacy region:region:cycle:template keys without changing earned rewards.
 p.discoveries=[...new Set(p.discoveries.map(discoveryKey).filter((key):key is string=>!!key))];
 return p;
}
export function isProgressionGearReferenced(s:CharacterState,id:string){return !!s.progression?.weaponGrid.includes(id);}
const lookupGear=(s:CharacterState,id:string|undefined)=>s.gear.find(g=>g.id===id)??invalid('装备不存在');
const faction=(region:string)=>starseaFactionByMap.get(region)?.id??region.replace(/-boss$/,'');
function progressionBossCleared(s:CharacterState,region:string){if(!s.starsea)return s.progress.bosses.includes(region+'-boss');const f=starseaFactionById.get(region)??starseaFactionByMap.get(region);return Boolean(f&&s.starsea.bosses.includes(starseaBossMaps[f.chapter-1]));}
const reputationRewards=(rank:number)=>({gold:rank*cfg.professionsRewards.reputationGold,summonShards:rank*cfg.professionsRewards.reputationSummonShards,rareArmor:rank===2});
const reputationRank=(s:CharacterState,id:string)=>cfg.reputationThresholds.filter(n=>(s.progression?.reputation[id]??0)>=n).length-1;
const talentUsed=(s:CharacterState)=>Object.values(s.progression!.talents).reduce((a,b)=>a+b,0);
const maxTalentPoints=60;
export function talentPoints(s:CharacterState){return Math.min(maxTalentPoints,Math.min(50,Math.max(0,s.level-1))+s.progression!.reputationClaims.length);}
function exclusiveTaken(s:CharacterState,t:typeof talentDefinitions[number]){return t.exclusive?talentDefinitions.find(x=>x.exclusive&&x.id!==t.id&&x.branch===t.branch&&x.tier===t.tier&&(s.progression!.talents[x.id]??0)>0):undefined;}
function talentTierUnlocked(s:CharacterState,t:typeof talentDefinitions[number]){return talentDefinitions.filter(x=>x.branch===t.branch&&x.tier<t.tier).reduce((sum,x)=>sum+(s.progression!.talents[x.id]??0),0)>=t.required;}
function gearOutput(s:CharacterState,base:string){
 requireRule(s.gear.length<settings.capacity,'背包满了，先整理背包');const template=progressionGearTemplates.find(g=>g.base===base);
 const g:Gear=template?{id:crypto.randomUUID(),base:template.base,name:template.name,slot:'weapon',attack:template.attack,armor:0,effect:'none',rank:0,locked:false,quality:base.startsWith('primal')?'legendary':'rare',affixes:[]}:makeGearByBase(base,crypto.randomUUID());
 const collection=collectionEquipment(base);if(collection){g.quality=equipmentRuntime.craftQuality;g.affixes=[];}
 if(s.starsea&&collection)applyItemPower(g,Math.min(s.level,islandBand(collection.tier*2,s.starsea.hardmode)[1]));
 if(collection){const inscription=rollInscription(g);if(inscription)g.inscription=inscription;assignMainStat(g,g.ilvl??g.requiredLevel??1);g.affixes=generateGearAffixes(g,collection.tier);}
 if(g.quality==='legendary'){if(g.base==='primal-blade')g.aspectId='aspect-mythic-1';else assignGearAspect(g,0,s.level)}
 s.gear.push(g);ensureProgression(s);return g;
}
const itemWallet=(s:CharacterState,id:string)=>craftConsumables.some(item=>item.id===id)?s.progression!.consumables:s.progression!.materials;
function available(s:CharacterState,c:ProgressionCost){return s.gold>=c.gold&&s.material>=c.material&&Object.entries(c.items).every(([id,n])=>(itemWallet(s,id)[id]??0)>=n);}
function charge(s:CharacterState,c:ProgressionCost){requireRule(available(s,c),'资源不足');s.gold-=c.gold;s.material-=c.material;for(const[id,n]of Object.entries(c.items)){const wallet=itemWallet(s,id);wallet[id]=(wallet[id]??0)-n;}}
// All conditions and mutations execute on a copy. The application commits only a successful command.
function perform(s:CharacterState,a:ProgressionAction):ProgressionCost{
 const gate=storyProgressionFeature(a.op,a.slot);if(gate)requireRule(storyFeatureUnlocked(s,gate),storyFeatureReason(s,gate));
 const p=ensureProgression(s),target=a.target??'',value=a.value??'';let c=free();
 switch(a.op){
 case 'grid.assign':{const g=lookupGear(s,target);requireRule(g.slot==='weapon','武器盘仅可装备武器');requireRule(a.slot!==undefined&&a.slot<9,'请选择合法武器盘格子');if(a.slot===0)for(let k=1;k<9;k++)if(p.weaponGrid[k]===g.id)p.weaponGrid[k]=null;requireRule(!p.weaponGrid.some((id,k)=>id===g.id&&k!==a.slot),'同一件武器只能放进一格');p.weaponGrid[a.slot]=g.id;if(a.slot===0)changeMainHand(s,g.id);break;}
 case 'grid.clear':requireRule(a.slot!==undefined&&a.slot<9,'请选择合法武器盘格子');requireRule(a.slot>0,'主手不能卸下');p.weaponGrid[a.slot]=null;break;
 case 'weapon.level':{const g=lookupGear(s,target);requireRule(g.slot==='weapon','仅武器可升级');const w=p.weapons[g.id];requireRule(w.level<cfg.weaponCaps[w.uncap],'已达当前等级上限，请先突破');c=cost(cfg.costs.weaponLevel,w.level);w.level++;break;}
 case 'weapon.uncap':{const g=lookupGear(s,target),w=p.weapons[g.id];requireRule(g.slot==='weapon'&&w,'仅武器可突破');requireRule(w.uncap<5,'已达五星');requireRule(w.level>=cfg.weaponCaps[w.uncap],'须达到当前等级上限');const duplicates=s.gear.filter(x=>x.base===g.base&&x.id!==g.id&&!x.locked&&!Object.values(s.equipment).includes(x.id)&&!p.weaponGrid.includes(x.id)).slice(0,cfg.uncapDuplicates[w.uncap]);requireRule(duplicates.length===cfg.uncapDuplicates[w.uncap],`需${cfg.uncapDuplicates[w.uncap]}把同种未锁定、未装备武器`);c=cost(cfg.costs.weaponUncap,w.uncap+1,{omega_fragment:cfg.uncapFragments[w.uncap],...(w.uncap>=3?{boss_essence:2}:{}),...(w.uncap===4?{gold_moon:2,legendary_essence:2}:{})});const ids=new Set(duplicates.map(g=>g.id));s.gear=s.gear.filter(g=>!ids.has(g.id));w.uncap++;break;}
 case 'aspect.extract':{const g=lookupGear(s,target),aspect=aspectDefinitions.find(x=>x.id===(value||g.aspectId));requireRule(aspect&&g.aspectId===aspect.id,'只能萃取装备自身携带的威能');requireRule(g.quality==='legendary','萃取需要传奇装备');requireRule(!g.locked&&!Object.values(s.equipment).includes(g.id)&&!p.weaponGrid.includes(g.id),'装备已锁定或已装备');requireRule(aspect.slots.includes(g.slot),'装备槽位不支持该威能');requireRule(s.level>=aspect.requiredLevel,'角色等级不足');requireRule(!aspect.id.includes('mythic')||progressionBossCleared(s,starseaFactionByMap.get(starseaBossMaps.at(-1)!)!.id),'须击败龙骨山谷领主');const next=Math.min(5,1+g.rank);requireRule(next>(p.codex[aspect.id]??0),'法典已拥有同级或更强威能');c=cost(cfg.costs.extract,next);p.codex[aspect.id]=next;s.gear=s.gear.filter(x=>x.id!==g.id);delete p.weapons[g.id];delete p.imprints[g.id];break;}
 case 'inscription.imprint':{requireRule(storyFeatureUnlocked(s,'forge'),storyFeatureReason(s,'forge'));const g=lookupGear(s,target),rubbing=inscriptionRubbings.find(r=>r.id===value);requireRule(rubbing,'拓片不存在');requireRule(g.slot===rubbing.slot,'拓片需要同一部位');requireRule((p.materials[value]??0)>=1,'缺少对应铭纹拓片');g.inscription=imprintInscription(g.slot,{slot:rubbing.slot,atomId:rubbing.atomId,tier:rubbing.tier});c={gold:inscriptionConfig.imprint.gold,material:inscriptionConfig.imprint.material,items:{[value]:1}};break;}
 case 'aspect.imprint':{const g=lookupGear(s,target),aspect=aspectDefinitions.find(x=>x.id===value);requireRule(aspect&&p.codex[value],'请先萃取解锁法典');requireRule(aspect.slots.includes(g.slot),'目标装备槽位不兼容');requireRule(p.imprints[g.id]!==value,'已刻印此威能');c=cost(cfg.costs.imprint,p.codex[value]);p.imprints[g.id]=value;break;}
 case 'talent.learn':{const t=talentDefinitions.find(x=>x.id===target);requireRule(t,'天赋不存在');requireRule(!exclusiveTaken(s,t),`同层只能选择一个：已选择${exclusiveTaken(s,t)?.name}`);requireRule((p.talents[target]??0)<t.max,'天赋已满');requireRule(talentUsed(s)<talentPoints(s),'天赋点不足');requireRule(talentTierUnlocked(s,t),`需在前置层投入${t.required}点`);c=cost(cfg.costs.talent);p.talents[target]=(p.talents[target]??0)+1;break;}
 case 'talent.reset':requireRule(talentUsed(s)>0,'尚无已投入天赋');c=cost(cfg.costs.reset);p.talents={};break;
 case 'paragon.learn':{const n=paragonDefinitions.find(x=>x.id===target);requireRule(n,'巅峰节点不存在');requireRule(s.level>=50,'50级解锁巅峰');requireRule(!p.paragon.includes(target),'节点已激活');requireRule(p.paragon.length<1+p.paragonLevel,'巅峰点不足');requireRule(n.requires.every(id=>p.paragon.includes(id)),'先激活相邻前置节点');c=cost(cfg.costs.paragon);p.paragon.push(target);break;}
 case 'glyph.unlock':{requireRule(glyphDefinitions.some(x=>x.id===target),'雕文不存在');requireRule(s.level>=50,'50级解锁雕文');requireRule(!p.glyphs[target],'雕文已解锁');c=cost(cfg.costs.glyph,1,{glyph_dust:10});p.glyphs[target]=1;break;}
 case 'glyph.level':requireRule(p.glyphs[target]&&p.glyphs[target]<21,'雕文未解锁或已满级');c=cost(cfg.costs.glyph,p.glyphs[target],{glyph_dust:5*p.glyphs[target]});p.glyphs[target]++;break;
 case 'glyph.slot':{const node=paragonDefinitions.find(x=>x.id===target),glyph=glyphDefinitions.find(x=>x.id===value);requireRule(node?.socket&&p.paragon.includes(target),'插槽节点尚未激活');requireRule(glyph&&p.glyphs[value],'雕文未解锁');requireRule(node.board===glyph.board,'雕文须匹配盘面');requireRule(p.glyphSlots[target]!==value,'雕文已镶嵌');p.glyphSlots[target]=value;break;}
 case 'summon.unlock':{const def=cfg.summons.find(x=>x.id===target);requireRule(def,'召唤石不存在');requireRule(!p.summons[target],'已拥有召唤石');requireRule(progressionBossCleared(s,def.region),'须击败对应区域首领');c=cost(cfg.costs.summon,1,{summon_shard:10});p.summons[target]={level:1,uncap:0};break;}
 case 'summon.level':{const stone=p.summons[target];requireRule(stone,'未拥有召唤石');requireRule(stone.level<cfg.summonCaps[stone.uncap],'已达等级上限');c=cost(cfg.costs.summon,Math.ceil(stone.level/5));stone.level++;break;}
 case 'summon.uncap':{const stone=p.summons[target];requireRule(stone&&stone.uncap<5,'未拥有或已达五星');requireRule(stone.level===cfg.summonCaps[stone.uncap],'须达到当前等级上限');c=cost(cfg.costs.summon,stone.uncap+1,{summon_shard:10*(stone.uncap+1),...(stone.uncap>=3?{boss_essence:3}:{}),...(stone.uncap===4?{gold_moon:5,legendary_essence:1}:{})});stone.uncap++;break;}
 case 'summon.slot':requireRule(p.summons[target],'未拥有召唤石');requireRule(value==='main'||value==='friend','光环槽位不合法');requireRule(p.summonSlots[value==='main'?'friend':'main']!==target,'同一召唤石不能占两槽');requireRule(p.summonSlots[value]!==target,'已装备此召唤石');p.summonSlots[value]=target;break;
 case 'character.uncap':requireRule(p.characterUncap<5,'角色已达五星');requireRule(s.level>=cfg.characterCaps[p.characterUncap],'须达到当前角色等级上限');c=cost(cfg.costs.characterUncap,p.characterUncap+1,{character_shard:cfg.characterShards[p.characterUncap],...(p.characterUncap>=1?{boss_essence:p.characterUncap}:{}),...(p.characterUncap===4?{gold_moon:20,legendary_essence:3}:{})});p.characterUncap++;break;
 case 'awakening.level':requireRule(p.awakening<10,'觉醒已满级');requireRule(s.level>=20,'20级解锁觉醒');c=cost(cfg.costs.awakening,p.awakening+1,{awakening_crystal:5*(p.awakening+1)});p.awakening++;break;
 case 'awakening.choose':requireRule(a.slot!==undefined&&a.slot<p.awakening,'觉醒层尚未解锁');requireRule(awakeningDefinitions.some(x=>x.id===target),'觉醒选项不存在');requireRule(!p.awakeningChoices[String(a.slot)],'该层已选择');p.awakeningChoices[String(a.slot)]=target;break;
 case 'skill.awaken':requireRule((s.skillRanks[target]??0)>=5,'技能达到五级方可觉醒');requireRule(!p.skillAwakenings[target],'该技能已觉醒');requireRule(skillAwakeningDefinitions.some(x=>x.id===value),'觉醒分支不存在');c=cost(cfg.costs.skillAwakening,1,{awakening_crystal:10});p.skillAwakenings[target]=value;break;
 case 'reputation.donate':requireRule(false,'材料上交暂未开放');break;
 case 'reputation.claim':{requireRule(cfg.factions.some(x=>x.id===target),'势力不存在');const rank=Number(value);requireRule(Number.isInteger(rank)&&rank>=1&&rank<=4,'声望阶级不合法');requireRule(reputationRank(s,target)>=rank,'声望尚未达标');const claim=target+':'+rank;requireRule(!p.reputationClaims.includes(claim),'声望奖励已领取');p.reputationClaims.push(claim);const reward=reputationRewards(rank);s.gold+=reward.gold;p.materials.summon_shard=(p.materials.summon_shard??0)+reward.summonShards;if(reward.rareArmor)gearOutput(s,'coat').quality='rare';break;}
 case 'consumable.use':{const item=craftConsumables.find(c=>c.id===target);requireRule(item,craftText.consumableUnknown);requireRule((p.consumables[target]??0)>0,craftText.consumableMissing);requireRule(!craftConsumables.some(c=>c.group===item.group&&(p.buffs[c.id!]??0)>0),craftText.consumableActive);c.items[target]=1;p.buffs[target]=item.kills!;break;}
 case 'collection.claim':{const d=collectionDefinitions.find(x=>x.id===target);requireRule(d,'收集奖励不存在');requireRule(!p.collectionClaims.includes(target),'奖励已领取');const required=d.required;const amount=d.kind==='codex'?Object.keys(p.codex).length:new Set(s.progress.bosses.map(faction)).size;requireRule(required>0&&amount>=required,`需收集${required}项`);p.collectionClaims.push(target);s.gold+=d.required*20;p.materials.gold_moon=(p.materials.gold_moon??0)+1;break;}
 default:invalid('未知养成命令');
 }
 return c;
}
export function quoteProgressionAction(s:CharacterState,input:ProgressionAction){const action=progressionActionSchema.parse(input),copy=structuredClone(s);let c=free();try{c=perform(copy,action);requireRule(available(s.progression?s:({...s,progression:ensureProgression(structuredClone(s))}),c),'资源不足');return {action,cost:c,enabled:true,reason:'',next:copy};}catch(error){if(error instanceof ProgressionError)return {action,cost:c,enabled:false,reason:error.message,next:structuredClone(s)};throw error;}}
export function applyProgressionAction(s:CharacterState,input:ProgressionAction):Receipt['delta']{const a=progressionActionSchema.parse(input),copy=structuredClone(s);ensureProgression(copy);const before=structuredClone(copy),c=perform(copy,a);requireRule(available(before,c),'资源不足');charge(copy,c);ensureProgression(copy);copy.build++;if(s.progression)copy.progression=Object.assign(s.progression,copy.progression);Object.assign(s,copy);const materials:Record<string,number>={};for(const id of new Set([...Object.keys(before.progression!.materials),...Object.keys(copy.progression!.materials)])){const n=(copy.progression!.materials[id]??0)-(before.progression!.materials[id]??0);if(n)materials[id]=n;}const reputation:Record<string,number>={};for(const id of Object.keys(copy.progression!.reputation)){const n=(copy.progression!.reputation[id]??0)-(before.progression!.reputation[id]??0);if(n)reputation[id]=n;}return {gold:s.gold-before.gold,xp:0,material:s.material-before.material,progression:{materials,reputation}};}
export function previewProgressionAction(s:CharacterState,a:ProgressionAction):ProgressionPreview{const quote=quoteProgressionAction(s,a),before=resolveBuild(s).stats,after=quote.enabled?resolveBuild(quote.next).stats:before;return {revision:s.revision,ruleset_version:versions.rules,action:quote.action,cost:quote.cost,enabled:quote.enabled,reason:quote.reason,summary:quote.enabled?'可以执行':quote.reason,before:{attack:before.attack,hp:before.hp,armor:before.armor},after:{attack:after.attack,hp:after.hp,armor:after.armor}};}
export function awardProgression(s:CharacterState,meta:{region:string;boss:boolean;elite:boolean;source?:'world'|'high'|'nightmare'|'raid'|'season';sourceId?:string;level?:number},rewardConfig=cfg.rewards){
 const p=ensureProgression(s),materials:Record<string,number>={},reputation:Record<string,number>={};
 const add=(values:Record<string,number>)=>{for(const[id,n]of Object.entries(migrateCraftMaterials({...values}))){const before=p.materials[id]??0,stack=craftMaterialById.get(id)?.stack,amount=stack?Math.max(0,Math.min(n,stack-before)):n;if(amount){p.materials[id]=before+amount;materials[id]=(materials[id]??0)+amount;}}};
 const source=meta.source??'world';add(rewardConfig.world);if(meta.elite)add(rewardConfig.elite);if(meta.boss)add(rewardConfig.boss);if(source!=='world')add(rewardConfig[source]);
 const region=faction(meta.region);if(cfg.factions.some(x=>x.id===region)){const n=meta.boss?30:meta.elite?5:1;p.reputation[region]=(p.reputation[region]??0)+n;reputation[region]=n;}
 const discovery=meta.sourceId?discoveryKey(meta.region+':'+meta.sourceId):undefined;
 if(discovery&&!p.discoveries.includes(discovery))p.discoveries.push(discovery);
 for(const id of Object.keys(p.buffs))if(p.buffs[id]>0)p.buffs[id]--;
 // Deterministic, earned challenge loot. No unrevealed candidates or RNG are published.
 if(meta.boss&&(source==='high'||source==='raid')){const base=source==='raid'?'primal-blade':(['forest','tundra'].includes(region)?'omega-bow':'omega-blade');if(s.gear.length<settings.capacity)gearOutput(s,base);else add({omega_fragment:cfg.professionsRewards.fullInventoryFragments});}
 return {materials,reputation};
}
function glyphRadius(rank:number){return rank>=15?4:2;}
function modifiers(s:CharacterState):Modifier[]{const p=ensureProgression(s),mods:Modifier[]=[];
 for(const t of talentDefinitions)if(p.talents[t.id])mods.push(...t.modifiers.map(m=>({...m,value:m.value*p.talents[t.id]})));
 for(const n of paragonDefinitions)if(p.paragon.includes(n.id)){let boost=1;for(const[socketId,glyphId]of Object.entries(p.glyphSlots)){const socket=paragonDefinitions.find(x=>x.id===socketId),lv=p.glyphs[glyphId]??0;if(socket&&socket.board===n.board&&Math.abs(n.x-socket.x)+Math.abs(n.y-socket.y)<=glyphRadius(lv))boost+=lv*.05;}mods.push(...n.modifiers.map(m=>({...m,value:m.value*boost})));}
 const equipped=new Set(Object.values(s.equipment));const chosen=new Map<string,{id:string;rank:number}>();
 for(const[gId,aId]of Object.entries(p.imprints))if(equipped.has(gId)){const a=aspectDefinitions.find(x=>x.id===aId);if(!a)continue;const family=a.id.startsWith('aspect-')&&!a.id.includes('skill')&&!a.id.includes('mythic')&&!a.id.includes('build')&&!a.id.includes('combo')?'generic-'+((Number(a.id.slice(7))-1)%8):a.id;const rank=p.codex[a.id]??0;if(rank>(chosen.get(family)?.rank??0))chosen.set(family,{id:a.id,rank});}
 // 穿戴中的传奇装备自带威能直接生效（至少按法典 1 级计），萃取/刻印用于把威能转移到其他装备。
 for(const g of s.gear)if(equipped.has(g.id)&&g.quality==='legendary'&&g.aspectId&&!p.imprints[g.id]){const a=aspectDefinitions.find(x=>x.id===g.aspectId);if(!a)continue;const family=a.id.startsWith('aspect-')&&!a.id.includes('skill')&&!a.id.includes('mythic')&&!a.id.includes('build')&&!a.id.includes('combo')?'generic-'+((Number(a.id.slice(7))-1)%8):a.id;const rank=Math.max(1,p.codex[a.id]??0);if(rank>(chosen.get(family)?.rank??0))chosen.set(family,{id:a.id,rank});}
 const bonus=Math.max(0,...collectionDefinitions.filter(d=>d.kind==='codex'&&p.collectionClaims.includes(d.id)).map(d=>d.bonus));
 for(const {id,rank}of chosen.values()){const a=aspectDefinitions.find(x=>x.id===id)!;mods.push(...a.modifiers.map(m=>({...m,value:m.stat==='projectiles'?m.value:m.value*(1+(rank-1)*.1)*(1+bonus)})));}
 for(const selected of Object.values(p.awakeningChoices)){const d=awakeningDefinitions.find(x=>x.id===selected);if(d)mods.push(d.modifier);}
 const all=p.characterUncap*.15+p.awakening*.03;for(const stat of ['attack','hp','armor','mana'] as const)mods.push({stat,value:all});
 for(const item of activeCraftConsumables(s))if(item.stat&&statRegistry.some(stat=>stat.id===item.stat&&stat.modifier))mods.push({stat:item.stat,value:item.value!});
 const craftingBonus=craftCodex.filter(d=>p.crafting.claims.includes(d.id)).reduce((n,d)=>n+d.bonus,0)+(p.collectionClaims.includes('craft-8')?craftPolicy.legacyCollectionBonus:0);
 if(craftingBonus)for(const stat of craftPolicy.codexStats)mods.push({stat,value:craftingBonus});
 for(const d of collectionDefinitions)if(d.kind!=='codex'&&p.collectionClaims.includes(d.id))mods.push({stat:'attack',value:d.bonus},{stat:'hp',value:d.bonus});
 return mods;
}
export function progressionMultipliers(s:CharacterState){const p=ensureProgression(s),v={attack:0,skill:0,hp:0,armor:0,crit:0,omegaAttack:1,omegaSkill:1,auraAttack:0,auraSkill:0,auraHp:0,auraArmor:0};
 for(const id of p.weaponGrid){const g=s.gear.find(x=>x.id===id);if(!g)continue;const w=p.weapons[g.id]??{level:1,uncap:0},def=progressionGearTemplates.find(x=>x.base===g.base)??cfg.weaponSkills.find(x=>x.base===g.base);if(!def)continue;const f=(.1+.9*w.level/150)*cfg.weaponFactors[w.uncap]/3;
 for(const sk of def.skills){if(sk.type==='omegaAttack'||sk.type==='omegaSkill')v[sk.type]*=1+sk.value*f;else v[sk.type]+=sk.value*f;}}
 for(const key of ['attack','skill','hp','armor','crit'] as const)v[key]=Math.min(cfg.caps[key],v[key]);v.omegaAttack=Math.min(cfg.caps.omegaAttack,v.omegaAttack);v.omegaSkill=Math.min(cfg.caps.omegaSkill,v.omegaSkill);
 for(const[slot,id]of Object.entries(p.summonSlots)){const stone=p.summons[id!],def=cfg.summons.find(x=>x.id===id);if(!stone||!def)continue;const bonus=Math.min(cfg.caps.aura,def.value*(.1+.9*stone.level/200)*(1+stone.uncap*.2)/2)*(slot==='friend'?.5:1);const key=({attack:'auraAttack',skill:'auraSkill',hp:'auraHp',armor:'auraArmor'} as const)[def.stat];v[key]+=bonus;}
 return v;
}
export function collectProgressionParts(s:CharacterState){const p=ensureProgression(s),main=p.weaponGrid[0]&&s.gear.find(g=>g.id===p.weaponGrid[0]),weapon=main?p.weapons[main.id]:undefined;return {mods:modifiers(s),mult:progressionMultipliers(s),mainAttack:main&&weapon?Math.round(main.attack*(weapon.level-1)*.01*(1+weapon.uncap*.1)):0};}
export function resolveProgressionStats(s:CharacterState,base:Stats,parts=collectProgressionParts(s)):Stats{const out={...base,effects:[...base.effects]},mult=parts.mult,mods=parts.mods;const percentages:Record<string,number>={};
 for(const m of mods)if(!m.skill&&statRegistry.some(s=>s.id===m.stat&&s.progression!=='skill'))percentages[m.stat]=(percentages[m.stat]??0)+m.value;
 for(const key of statRegistry.filter(s=>s.modifier&&s.progression==='multiply').map(s=>s.id) as ('hp'|'attack'|'armor'|'speed'|'mana'|'regen')[])out[key]=Math.round(out[key]*(1+Math.min(3,percentages[key]??0)));
 out.attack+=parts.mainAttack;
 out.attack=Math.round(out.attack*(1+mult.attack)*mult.omegaAttack*(1+mult.auraAttack));out.hp=Math.round(out.hp*(1+mult.hp)*(1+mult.auraHp));out.armor=Math.round(out.armor*(1+mult.armor)*(1+mult.auraArmor));
 for(const key of statRegistry.filter(s=>s.modifier&&s.progression==='add').map(s=>s.id) as ('critChance'|'critMultiplier'|'lifesteal'|'cdr'|'dodge'|'penetration')[])if(percentages[key]||key==='critChance'&&mult.crit)out[key]=(out[key]??(key==='critMultiplier'?1.5:0))+(percentages[key]??0)+(key==='critChance'?mult.crit:0);
 if(mods.some(m=>m.stat==='effectChain'&&m.value>0)&&!out.effects.includes('chain'))out.effects.push('chain');
 const tagged=mods.filter(m=>m.stat==='tagDamage'&&m.tags&&m.zone);if(tagged.length){out.zones=[...(out.zones??[])];for(const m of tagged){const a=aspectDefinitions.find(x=>x.id===m.zone);addZone(out.zones,{id:m.zone!,label:a?.name??talentZoneNames[m.zone!]??m.zone!,kind:'mult',value:Math.round((1+m.value)*1000)/1000,tags:m.tags});}}
 const execute=mods.filter(m=>m.stat==='executeBonus').reduce((n,m)=>n+m.value,0);if(execute){out.executeBonus=execute;out.executeThreshold=.2;}
 return out;
}
export function resolveProgressionSkill(s:CharacterState,skill:Skill,parts=collectProgressionParts(s)):Skill{const p=ensureProgression(s),out=structuredClone(skill),mult=parts.mult,mods=[...parts.mods];const awakening=skillAwakeningDefinitions.find(x=>x.id===p.skillAwakenings[skill.id]);if(awakening)mods.push(...awakening.modifiers.map(m=>({...m,skill:skill.id})));let damage=0,radius=0,cooldown=0,mana=0,projectileModifier=false;
 for(const m of mods){if(m.skill&&m.skill!==skill.id)continue;switch(m.stat){case 'skillDamage':damage+=m.value;break;case 'skillRadius':radius+=m.value;break;case 'skillCooldown':cooldown+=m.value;break;case 'skillCost':mana+=m.value;break;case 'pull':out.pull=(out.pull??0)+m.value;break;case 'projectiles':if(out.kind==='projectile'){projectileModifier=true;out.projectiles=Math.max(out.projectiles??1,Math.min(5,Math.round(m.value)));out.projectileSpread??=.18;}break;}}
 // Retain invested weapon/talent budgets. Existing projectile modifiers used
 // 60% per arrow; convert that budget to a total before the executor splits it.
 // Base multi-shot itself splits its original budget, without this modifier.
 const factor=(1+mult.skill)*mult.omegaSkill*(1+mult.auraSkill)*(1+Math.min(2,damage)),count=projectileModifier?out.projectiles??1:1,split=projectileModifier&&count>1?.6:1;
 out.damage=Math.round(out.damage*factor*split)*count;
 for(const effect of out.mechanics?.statuses??[])if(effect.total!==undefined&&['burn','poison','regen'].includes(effect.kind))effect.total=Math.round(effect.total*factor*split)*count;
 out.radius*=1+Math.min(2,radius);out.range*=1+Math.min(1,radius/2);
 if(out.mechanics?.projectile?.explosionRadius)out.mechanics.projectile.explosionRadius=out.radius;
 const skillReduction=Math.max(0,Math.min(.75,cooldown)),statsReduction=out.resolution?.statsCooldownReduction??0,baseCooldown=out.resolution?.baseCooldown??out.cooldown,effective=Math.min(.75,1-(1-skillReduction)*(1-statsReduction));
 out.cooldown=Math.max(1,Math.round(baseCooldown*(1-effective)));
 if(out.resolution)out.resolution={...out.resolution,skillCooldownReduction:skillReduction,effectiveCooldownReduction:effective,finalCooldown:out.cooldown};
 out.cost=Math.max(0,Math.round(out.cost*(1-Math.min(.75,mana))));return out;
}
export function progressionLevelCap(s:CharacterState){return Math.max(s.level,cfg.characterCaps[s.progression?.characterUncap??0]);}
export function progressionView(s:CharacterState):ProgressionView{
 const copy=structuredClone(s),p=ensureProgression(copy),sections:ProgressionView['sections']=[];
 const op=(label:string,action:ProgressionAction)=>{const q=quoteProgressionAction(copy,action);return {id:[action.op,action.target,action.value,action.slot].filter(x=>x!==undefined).join(':'),label,action:q.action,cost:q.cost,enabled:q.enabled,reason:q.reason};};
 type Item=ProgressionView['sections'][number]['items'][number];
 const section=(id:string,name:string,description:string,items:Item[])=>sections.push({id,name,description,items});
 section('grid','武器盘','主手吃满属性，副武器只给技能；一件武器只能占一格。',Array.from({length:9},(_,slot)=>{const g=copy.gear.find(g=>g.id===p.weaponGrid[slot]);return {id:'grid-'+slot,name:slot===0?'主手':'副武器 '+slot,description:g?g.name+' · 普通加成与方阵加成各算一份':'选择背包中的武器',status:g?`Lv${p.weapons[g.id]?.level??1} ★${p.weapons[g.id]?.uncap??0}`:'空槽',operations:[...copy.gear.filter(g=>g.slot==='weapon'&&g.id!==p.weaponGrid[slot]).map(g=>op('装备 '+g.name,{op:'grid.assign',target:g.id,slot})),...(slot>0&&g?[op('卸下',{op:'grid.clear',slot})]:[])]};}));
 section('weapons','武器成长','可升到 150 级、突破 5 星；同种武器能当材料，锁定和在盘上的不会被吃掉。',copy.gear.filter(g=>g.slot==='weapon').map(g=>{const w=p.weapons[g.id];const def=progressionGearTemplates.find(x=>x.base===g.base)??cfg.weaponSkills.find(x=>x.base===g.base);return {id:g.id,name:g.name,description:'武器技能：'+(def?.skills.map(sk=>sk.type+' '+Math.round(sk.value*100)+'%（满级五星）').join('、')??'无武器技能')+'；来源：野外、制造、高难首领',status:`Lv${w.level}/${cfg.weaponCaps[w.uncap]} · ★${w.uncap}/5`,operations:[op('提升武器等级',{op:'weapon.level',target:g.id}),op('上限突破',{op:'weapon.uncap',target:g.id})]};}));
 section('inscriptions','铭纹拓印','使用同部位拓片覆盖铭纹，重铸不会改变铭纹。',inscriptionRubbings.filter(r=>(p.materials[r.id]??0)>0).map(r=>({id:r.id,name:effectAtomById.get(r.atomId)!.name+'铭纹拓片',description:'仅用于'+({weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指'} as Record<string,string>)[r.slot]+'部位的小型铭纹',status:'持有 '+p.materials[r.id],operations:copy.gear.filter(g=>g.slot===r.slot).map(g=>op('拓印 '+g.name,{op:'inscription.imprint',target:g.id,value:r.id}))})));
 section('aspects','传奇威能法典','萃取消耗传奇装备，永久法典可重复刻印。相同通用威能取最高等级。',aspectDefinitions.map(a=>({id:a.id,name:a.name,description:a.description+'；来源：'+a.source+'；需Lv'+a.requiredLevel,status:p.codex[a.id]?`已收录 Lv${p.codex[a.id]}/5`:'未收录',operations:[...copy.gear.filter(g=>g.quality==='legendary'&&g.aspectId===a.id).map(g=>op('萃取 '+g.name,{op:'aspect.extract',target:g.id,value:a.id})),...(p.codex[a.id]?copy.gear.filter(g=>a.slots.includes(g.slot)).map(g=>op('刻印 '+g.name,{op:'aspect.imprint',target:g.id,value:a.id})):[])]})));
 const effectLabels:Record<string,string>={attack:'攻击增幅（%）',hp:'生命增幅（%）',armor:'防御增幅（%）',lifesteal:'吸血（%）',skillCooldown:'技能冷却降低（%）',skillDamage:'技能伤害增幅（%）',mana:'能量增幅（%）',regen:'回能增幅（%）',skillCost:'技能消耗降低（%）',skillRadius:'技能范围增幅（%）',critChance:'暴击率（%）',critMultiplier:'暴击伤害增幅（%）',speed:'移动速度增幅（%）',dodge:'闪避率（%）',penetration:'穿透（%）',executeBonus:'低血斩杀增伤（%）',effectChain:'启用连锁伤害',projectiles:'射击数量'};
 // 未在旧表中的属性按注册表的显示方式补全单位，避免出现英文键或错误百分号。
 const effectOf=(m:Modifier)=>{const def=statRegistry.find(x=>x.id===m.stat);if(m.stat==='tagDamage')return {stat:m.stat,label:(m.tags??[]).map(t=>skillTagNames[t as keyof typeof skillTagNames]??t).join('／')+'技能伤害增幅（%）',value:Math.round(m.value*10000)/100};if(effectLabels[m.stat]||!def)return {stat:m.stat,label:effectLabels[m.stat]??m.stat,value:['projectiles','effectChain'].includes(m.stat)?m.value:Math.round(m.value*10000)/100};return def.display==='percent'?{stat:m.stat,label:def.name+'（%）',value:Math.round(m.value*10000)/100}:{stat:m.stat,label:def.name+(def.display==='seconds'?'（秒）':def.display==='multiplier'?'（倍）':''),value:m.value};};
 const effectText=(m:Modifier)=>{const e=effectOf(m),name=e.label.replace(/（[^）]*）/,'');return m.stat==='effectChain'?'启用连锁伤害':/降低/.test(name)?name+' '+e.value+'%':name+' +'+e.value+(e.label.includes('（%）')?'%':e.label.includes('（秒）')?' 秒':e.label.includes('（倍）')?' 倍':'');};
 // 2026-10-07 天赋四树全部开放：本树投入 0/5/10/15/20 点解锁下一层；第 4 层二选一，第 5 层关键天赋多选一。
 const reset=op('重置天赋',{op:'talent.reset'});
 for(const branch of talentTrees){
  section('talents-'+branch,talentTreeNames[branch]+'天赋',`${talentTreeDescriptions[branch]}等级与声望奖励提供天赋点，四棵树共用。`,talentDefinitions.filter(t=>t.branch===branch).map(t=>{
   const learn=op('投入 1 点',{op:'talent.learn',target:t.id}),rank=p.talents[t.id]??0;
   return {id:t.id,name:t.name,description:[...(t.parts?.rules.map(r=>r.description)??[]),...t.modifiers.map(effectText)].join('，').replace(/^/,t.max>1?'每级 ':''),status:rank+'/'+t.max,state:rank>0?'learned' as const:learn.enabled?'available' as const:'locked' as const,rank,max:t.max,tier:t.tier,tierUnlocked:talentTierUnlocked(copy,t),...(t.exclusive?{exclusive:true}:{}),effects:[...t.modifiers.map(effectOf),...(t.parts?.rules.map(r=>({stat:r.id,label:r.name+'伤害增幅（%）',value:Math.round((r.action.type==='buff'?(r.action.mods.damageMult??0):'ratio' in r.action?r.action.ratio:0)*100)}))??[])],operations:[learn,...(talentUsed(copy)>0?[reset]:[])]};
  }));
 }
 for(const talentSection of sections.filter(section=>section.id.startsWith('talents-')))talentSection.points={available:Math.max(0,talentPoints(copy)-talentUsed(copy)),total:talentPoints(copy)};
 section('paragon','巅峰盘','点亮巅峰节点，强化角色并镶嵌雕文。50级开放，每级获得1点。',paragonDefinitions.map(n=>{
  const learn=op('激活节点',{op:'paragon.learn',target:n.id}),glyph=glyphDefinitions.find(g=>g.id===p.glyphSlots[n.id]);
  return {id:n.id,name:n.name,description:n.requires.length?'需要先点亮相邻节点。':'从这个节点开始点亮巅峰盘。',effects:n.modifiers.map(m=>({stat:m.stat,label:effectLabels[m.stat]??'属性增幅（%）',value:Math.round(m.value*10000)/100})),status:p.paragon.includes(n.id)?'已激活':'未激活',state:p.paragon.includes(n.id)?'learned' as const:learn.enabled?'available' as const:'locked' as const,requires:n.requires,x:n.x,y:n.y,board:n.board,socket:n.socket,...(glyph?{slottedGlyph:{id:glyph.id,name:glyph.name,rank:p.glyphs[glyph.id]??1}}:{}),operations:[learn,...(n.socket?glyphDefinitions.filter(g=>g.board===n.board).map(g=>op('镶嵌 '+g.name,{op:'glyph.slot',target:n.id,value:g.id})):[])]};
 }));
 section('glyphs','雕文','强化插槽周围的巅峰节点，最高 21 级；15 级起范围变大。',glyphDefinitions.map(g=>{
  const unlock=op('解锁雕文',{op:'glyph.unlock',target:g.id}),rank=p.glyphs[g.id]??0;
  return {id:g.id,name:g.name,description:'匹配巅峰盘'+(g.board+1)+'，在插槽周围2格（15级4格）提升节点。',status:rank?'Lv'+rank+'/21':'未解锁',rank,max:21,state:rank?'learned' as const:unlock.enabled?'available' as const:'locked' as const,board:g.board,radius:glyphRadius(rank),operations:[unlock,op('升级雕文',{op:'glyph.level',target:g.id})]};
 }));
 section('summons','召唤石','击败对应领主后用召唤碎片唤醒，主光环与友方半效光环独立生效。',cfg.summons.map(d=>({id:d.id,name:d.name,description:`${d.stat} 加护，满级五星 +${d.value*100}%；来源：${d.region} 首领`,status:p.summons[d.id]?`Lv${p.summons[d.id].level}/${cfg.summonCaps[p.summons[d.id].uncap]} ★${p.summons[d.id].uncap} · ${p.summonSlots.main===d.id?'主召':p.summonSlots.friend===d.id?'友召':'未装备'}`:'未拥有',operations:p.summons[d.id]?[op('提升等级',{op:'summon.level',target:d.id}),op('突破召唤石',{op:'summon.uncap',target:d.id}),op('设为主召',{op:'summon.slot',target:d.id,value:'main'}),op('设为友召',{op:'summon.slot',target:d.id,value:'friend'})]:[op('唤醒召唤石',{op:'summon.unlock',target:d.id})]})));
 const stageMetadata=(rank:number,max:number,enabled:boolean,prefix:string)=>({rank,max,state:rank===max?'learned' as const:enabled?'available' as const:'locked' as const,stages:Array.from({length:max},(_,n)=>({id:String(n+1),label:max===1?prefix:prefix+(n+1),state:n<rank?'learned' as const:n===rank&&enabled?'available' as const:'locked' as const}))});
 const uncap=op('角色突破',{op:'character.uncap'}),awakening=op('提升觉醒等级',{op:'awakening.level'});
 section('character','角色突破与觉醒','突破提升等级上限10级与基础属性15%；觉醒每级全属性3%，每层三选一。',[
  {id:'uncap',name:'角色突破',description:'达到当前等级上限后，可用角色碎片、首领精华与终局稀有材料突破。',status:`★${p.characterUncap}/5 · 等级上限${progressionLevelCap(copy)}`,...stageMetadata(p.characterUncap,5,uncap.enabled,'★'),operations:[uncap]},
  {id:'awakening',name:'觉醒等级',description:'20级开启，精英/噩梦掉落觉醒结晶。',status:'Lv'+p.awakening+'/10',...stageMetadata(p.awakening,10,awakening.enabled,'Lv'),operations:[awakening]},
  ...Array.from({length:10},(_,slot)=>{const operations=awakeningDefinitions.map(d=>op(d.name,{op:'awakening.choose',target:d.id,slot})),choice=awakeningDefinitions.find(d=>d.id===p.awakeningChoices[slot]);return {id:'awakening-'+slot,name:'觉醒第'+(slot+1)+'层',description:'本层三选一，所选属性持续生效。',status:choice?.name??(slot<p.awakening?'可选择':'未解锁'),...stageMetadata(choice?1:0,1,operations.some(o=>o.enabled),'觉醒分支'),operations};})
 ]);
 section('skill-awakening','技能觉醒','技能升到五级时选一个永久分支，改变伤害、范围或冷却。',skillCatalog.map(sk=>{
  const operations=skillAwakeningDefinitions.map(d=>op(d.name,{op:'skill.awaken',target:sk.id,value:d.id})),chosen=skillAwakeningDefinitions.find(d=>d.id===p.skillAwakenings[sk.id]);
  return {id:sk.id,name:sk.name,description:'需技能等级5；'+skillAwakeningDefinitions.map(d=>d.name+'：'+d.description).join('；'),status:chosen?.name??'未觉醒',...stageMetadata(chosen?1:0,1,operations.some(o=>o.enabled),'永久分支'),operations};
 }));
 const reputationNames=['中立','友善','尊敬','崇敬','崇拜'];
 section('reputation','区域声望','野外/精英/首领战斗增加声望；奖励额外天赋点与图纸购买资格。',[...cfg.factions].sort((a,b)=>copy.starsea?(starseaFactionById.get(a.id)?.chapter??Infinity)-(starseaFactionById.get(b.id)?.chapter??Infinity):0).map(f=>{
  const island=copy.starsea?starseaFactionById.get(f.id):undefined,canEarn=island?starseaRegionOpen(copy.starsea!,island.maps[0]):copy.progress.regions.includes(f.id);
  const rank=reputationRank(copy,f.id),currentValue=p.reputation[f.id]??0,nextValue=cfg.reputationThresholds[rank+1]??null;
  const operations=cfg.reputationThresholds.slice(1).map((_,index)=>op('领取'+reputationNames[index+1]+'奖励',{op:'reputation.claim',target:f.id,value:String(index+1)}));
  return {id:f.id,name:island?.name??f.name,description:`在${island?.island??f.name}击败怪物可提升声望，首领给得最多。达到尊敬可领取稀有护甲。`,status:reputationNames[rank]+' · '+currentValue,rank,max:cfg.reputationThresholds.length-1,currentValue,nextValue,progressRatio:nextValue===null?1:Math.min(1,currentValue/nextValue),state:p.reputationClaims.filter(id=>id.startsWith(f.id+':')).length===operations.length?'learned' as const:canEarn||currentValue>0||operations.some(o=>o.enabled)?'available' as const:'locked' as const,rewardTiers:operations.map((operation,index)=>{
   const tier=index+1,reward=reputationRewards(tier),claimed=p.reputationClaims.includes(f.id+':'+tier);
   return {rank:tier,name:reputationNames[tier],required:cfg.reputationThresholds[tier],state:claimed?'learned' as const:operation.enabled?'available' as const:'locked' as const,rewards:[{name:'金币',value:String(reward.gold)},{name:'召唤碎片',value:String(reward.summonShards)},{name:'天赋点额度',value:`1（总量最多${maxTalentPoints}点）`},...(reward.rareArmor?[{name:'稀有护甲',value:'1件'}]:[])]};
  }),operations};
 }));
 section('collection','收集奖励','永久收集奖励需主动领取，法典加成按已领取最高档生效。',collectionDefinitions.map(d=>({id:d.id,name:d.name,description:`收集 ${d.kind} ${d.required} 项，奖励金币与金月；加成 +${d.bonus*100}%`,status:p.collectionClaims.includes(d.id)?'已领取':'未领取',operations:[op('领取收集奖励',{op:'collection.claim',target:d.id})]})));
 const labels:Record<string,string>={skillDamage:'技能伤害',skillRadius:'技能范围',skillCooldown:'技能冷却降低',skillCost:'技能消耗降低',critChance:'暴击率',critMultiplier:'暴击伤害',lifesteal:'吸血',penetration:'穿透',executeBonus:'低血斩杀增伤',effectChain:'连锁伤害',projectiles:'多重射击',omegaAttack:'方阵攻刃',omegaSkill:'方阵必杀',attack:'攻击',hp:'生命',armor:'防御',speed:'移动速度',mana:'能量',regen:'回能',dodge:'闪避',mining:'采矿',herbalism:'采药',skinning:'剥皮',smithing:'锻造',alchemy:'炼金',enchanting:'附魔',codex:'法典',bosses:'区域首领',recipes:'本专业配方',skill:'必杀刃',crit:'技巧',cdr:'冷却降低'};
 for(const section of sections)for(const item of section.items){for(const key of Object.keys(labels).sort((a,b)=>b.length-a.length)){const token=new RegExp('\\b'+key+'\\b','g');item.description=item.description.replace(token,labels[key]);item.status=item.status.replace(token,labels[key]);}item.description=item.description.replaceAll('paragon-','巅峰节点 ');}
 const m=progressionMultipliers(copy);return {revision:s.revision,ruleset_version:versions.rules,state:p,currencies:[{id:'gold',name:'金币',amount:copy.gold,source:'野外、首领与挑战奖励'},{id:'material',name:'强化石',amount:copy.material,source:'野外与挑战奖励'},...cfg.materials.map(x=>({...x,amount:p.materials[x.id]??0}))],summary:[{name:'武器攻击加成',value:'+'+(m.attack*100).toFixed(1)+'%'},{name:'方阵攻击',value:m.omegaAttack.toFixed(2)+' 倍'},{name:'武器技能伤害加成',value:'+'+(m.skill*100).toFixed(1)+'%'},{name:'方阵技能伤害',value:m.omegaSkill.toFixed(2)+' 倍'},{name:'天赋点',value:`${talentPoints(copy)-talentUsed(copy)}/${talentPoints(copy)}`} ,{name:'巅峰点',value:String(Math.max(0,1+p.paragonLevel-p.paragon.length))}],sections};
}
// The API owns the private random draw; existing legendary saves use deterministic index 0.
// 传奇威能：未指定随机序号时用装备 id 哈希，保证同一件装备总是同一个威能；三分之二概率落在构筑威能（按标签 [×]）。
export type AspectIssueDefinition={id:string;slots:readonly Gear['slot'][];requiredLevel:number;dropEnabled?:boolean;weapons?:readonly import('../contracts/weapons.ts').WeaponType[]};
export function assignGearAspect(g:Gear,rollIndex=0,level=100,includeMythic=false,definitions:readonly AspectIssueDefinition[]=aspectDefinitions):Gear{if(g.quality!=='legendary'||g.aspectId)return g;const weapon=gearWeaponType(g),pool=definitions.filter(a=>a.dropEnabled!==false&&a.slots.includes(g.slot)&&a.requiredLevel<=level&&(includeMythic||!a.id.includes('mythic'))&&(g.slot!=='weapon'||!a.weapons?.length||!!weapon&&a.weapons.includes(weapon)));const roll=Math.abs(Math.floor(rollIndex))||[...g.id].reduce((h,ch)=>(h*31+ch.charCodeAt(0))>>>0,7),build=pool.filter(a=>a.id.startsWith('aspect-build-'));const from=build.length&&!pool.some(a=>newAspectById.has(a.id))&&roll%3!==2?build:pool;if(from.length)g.aspectId=from[Math.floor(roll/3)%from.length].id;return g;}


export function applyParagonXp(s:CharacterState,amount:number){if(s.level<50||amount<=0)return;const p=ensureProgression(s);p.paragonXp+=Math.floor(amount);while(p.paragonXp>=cfg.paragonXp.base+p.paragonLevel*cfg.paragonXp.perLevel){p.paragonXp-=cfg.paragonXp.base+p.paragonLevel*cfg.paragonXp.perLevel;p.paragonLevel++;s.build++;}}


