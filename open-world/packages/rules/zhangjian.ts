// M17 杖剑借鉴 Z1–Z4 的规则层：出战方案、元素克制、部位强化视图、宠物、探索度。
// 服务端照这里的函数改存档、出视图；前端只读视图。设计见 docs/hub-portal-rework-20261021/modules/M17-zhangjian-z1-z4.md。
import type {CharacterState,Spawn,Stats} from '../contracts/index.ts';
import type {DamageType} from '../contracts/skill-mechanics.ts';
import type {ChartRegionId} from '../contracts/hub.ts';
import {rankSlots,type Loadout,type LoadoutView,type PetsView,type PetView,type RegionExploreView,type SlotsView,type RankSlot,type PetFlow} from '../contracts/zhangjian.ts';
import {skillCatalog} from '../content/index.ts';
import {talentDefinitions} from '../content/deep-progression.ts';
import {hubChartContent,hubNodeById} from '../content/hub-chart.ts';
import {hubElements,hubExplore,petContent,petFamilyById} from '../content/zhangjian.ts';
import {numericStat} from '../contracts/stats.ts';
import {ensureProgression,talentPoints} from './deep-progression.ts';
import {changeMainHand,rememberWeaponSkills,skillWeaponAllowed} from './skill-weapon-access.ts';
import {skillSlotCount} from './skill-recovery.ts';
import {gearMaxRank,gearUpgradeCost} from './item-power.ts';
import {petElement,petForm,petXpNext,petActiveRatio,petPassives,slotRank,wornInSlot,resonanceTier,RESONANCE_STEPS,RESONANCE_PER_TIER} from './zhangjian-build.ts';
import type {HubState} from './hub-state.ts';
import {slotNames,elementNames} from './zhangjian-view.ts';
export {slotNames,elementNames,elementHint} from './zhangjian-view.ts';

const defaultNames=['方案一','方案二','方案三'];

// ---------- Z1 元素 ----------
export function nodeElements(nodeId:string){const n=hubNodeById.get(nodeId);if(!n)return undefined;return hubElements.nodes[nodeId]??hubElements.regions[n.region];}
/** 服务端生成副本怪物后调用：给本节点所有带战斗模板的怪挂上航区弱点。 */
export function applyRegionWeakness<T extends Pick<Spawn,'monster'>>(spawns:T[],nodeId:string):T[]{const el=nodeElements(nodeId);if(!el)return spawns;for(const e of spawns)if(e.monster)e.monster={...e.monster,weakness:{type:el.weakness,bonus:hubElements.weaknessBonus}};return spawns;}
export function skillDamageType(id:string){return skillCatalog.find(s=>s.id===id)?.mechanics?.damageType as DamageType|undefined;}
/** 一组技能 + 上阵宠物流派能打出的元素（去重，物理在内）。 */
export function elementsOf(skills:string[],petFlow?:PetFlow){const out=new Set<DamageType>();for(const id of skills){const t=skillDamageType(id);if(t&&t!=='pure')out.add(t);}if(petFlow)out.add(petElement(petFlow));return [...out];}
function activePetFlow(s:Pick<CharacterState,'pets'>,lineup=s.pets?.lineup,flows?:Record<string,PetFlow>){const id=lineup?.active;if(!id)return undefined;return flows?.[id]??s.pets?.owned[id]?.flow;}
export function currentElements(s:CharacterState){return elementsOf(s.skills,activePetFlow(s));}
export function resistOf(stats:Stats,type:DamageType){return type==='physical'||type==='pure'?0:numericStat(stats,'allResist')+numericStat(stats,type+'Resist');}
// ---------- Z1 出战方案 ----------
export function snapshotLoadout(s:CharacterState,name:string):Loadout{
 const p=ensureProgression(s),lineup=s.pets?.lineup??{active:null,support:[]},flows:Record<string,PetFlow>={};
 for(const id of [lineup.active,...lineup.support])if(id&&s.pets?.owned[id])flows[id]=s.pets.owned[id].flow;
 return {name,equipment:Object.fromEntries(rankSlots.flatMap(slot=>s.equipment[slot]?[[slot,s.equipment[slot]!]]:[])),weaponGrid:[...p.weaponGrid],skills:[...s.skills],talents:{...p.talents},pets:{active:lineup.active,support:[...lineup.support],flows}};
}
function same(a:Loadout,b:Loadout){const strip=(l:Loadout)=>JSON.stringify({...l,name:'',equipment:Object.fromEntries(Object.entries(l.equipment).sort()),talents:Object.fromEntries(Object.entries(l.talents).filter(([,v])=>v>0).sort())});return strip(a)===strip(b);}
export function loadoutDirty(s:CharacterState){const l=s.loadouts;if(!l)return false;const saved=l.slots[l.active];return !saved||!same(saved,snapshotLoadout(s,saved.name));}
/** 首次打开方案时把当前配置存进方案一。 */
export function ensureLoadouts(s:CharacterState){if(!s.loadouts){s.loadouts={active:0,slots:[snapshotLoadout(s,defaultNames[0]),null,null]};return true;}return false;}
export function saveLoadout(s:CharacterState,index:number,name?:string){ensureLoadouts(s);const l=s.loadouts!;l.slots[index]=snapshotLoadout(s,name??l.slots[index]?.name??defaultNames[index]);l.active=index;}
export function renameLoadout(s:CharacterState,index:number,name:string){ensureLoadouts(s);const slot=s.loadouts!.slots[index];if(slot)slot.name=name;else s.loadouts!.slots[index]={...snapshotLoadout(s,name),equipment:{},skills:[],talents:{},pets:{active:null,support:[],flows:{}},weaponGrid:undefined};}
/** 切换方案：逐项装回，装不回的列进 skipped。天赋免费改（M17 Z1）。装备穿上后由调用方补词缀节点。 */
export function applyLoadout(s:CharacterState,index:number):{skipped:string[];equipped:string[]}{
 ensureLoadouts(s);const l=s.loadouts!.slots[index];if(!l)return {skipped:['这个方案还是空的'],equipped:[]};
 const skipped:string[]=[],equipped:string[]=[],p=ensureProgression(s);
 for(const slot of rankSlots){const id=l.equipment[slot];if(s.equipment[slot]===id)continue;const g=id?s.gear.find(g=>g.id===id):undefined;
  if(id&&!g){skipped.push(slotNames[slot]+'那件装备已不在背包');continue;}
  if(g&&s.level<(g.requiredLevel??1)){skipped.push(slotNames[slot]+'需要角色等级 '+g.requiredLevel);continue;}
  if(slot==='weapon'){if(g)for(let i=1;i<p.weaponGrid.length;i++)if(p.weaponGrid[i]===g.id)p.weaponGrid[i]=null;changeMainHand(s,g?.id);}else if(g)s.equipment[slot]=g.id;else delete s.equipment[slot];
  if(g)equipped.push(g.id);}
 if(l.weaponGrid)for(let i=1;i<p.weaponGrid.length;i++){const id=l.weaponGrid[i];p.weaponGrid[i]=id&&s.gear.some(g=>g.id===id)&&id!==s.equipment.weapon?id:null;}
 const skills=[...new Set(l.skills)].filter(id=>(s.skillRanks[id]??0)>0&&skillWeaponAllowed(s,id)).slice(0,skillSlotCount(s));
 if(skills.length<l.skills.length)skipped.push('有 '+(l.skills.length-skills.length)+' 个技能用不了（武器不对或未激活）');
 if(skills.length){s.skills=skills;rememberWeaponSkills(s);}
 const total=Object.values(l.talents).reduce((n,v)=>n+v,0),valid=Object.entries(l.talents).every(([id,v])=>{const t=talentDefinitions.find(t=>t.id===id);return t&&v<=t.max;});
 if(valid&&total<=talentPoints(s))p.talents={...l.talents};else skipped.push('天赋点数不够，保留当前天赋');
 if(s.pets){const owned=(id:string|null)=>id&&s.pets!.owned[id]?id:null;s.pets.lineup={active:owned(l.pets.active),support:l.pets.support.filter(id=>owned(id)&&id!==l.pets.active)};for(const [id,flow] of Object.entries(l.pets.flows))if(s.pets.owned[id])s.pets.owned[id].flow=flow;}
 s.loadouts!.active=index;s.build++;return {skipped,equipped};
}
export function loadoutView(s:CharacterState,stats:Stats,switchBlock?:string):LoadoutView{
 const l=s.loadouts??{active:0,slots:[snapshotLoadout(s,defaultNames[0]),null,null]};
 const resist=Object.fromEntries((['fire','cold','lightning','arcane','shadow','poison'] as const).map(t=>[t,resistOf(stats,t)]));
 return {active:l.active,dirty:s.loadouts?loadoutDirty(s):false,current:{elements:currentElements(s),resist},canSwitch:!switchBlock,...(switchBlock?{switchBlock}:{}),
  slots:l.slots.map((x,index)=>x?{index,name:x.name,empty:false,elements:elementsOf(x.skills,activePetFlow(s,x.pets,x.pets.flows)),skills:x.skills,pet:x.pets.active?petFamilyById.get(x.pets.active)?.name??null:null}:{index,name:defaultNames[index],empty:true,elements:[],skills:[],pet:null})};
}

// ---------- Z2 部位强化 ----------
export function slotUpgradeQuote(s:CharacterState,slot:RankSlot,legacy:(rank:number)=>{gold:number;material:number}){
 const g=wornInSlot(s,slot),rank=slotRank(s,slot);if(!g)return {rank,cap:0,cost:null,block:'先在这个部位穿上装备'};
 const cap=gearMaxRank(g,5);if(rank>=cap)return {rank,cap,cost:null,block:rank>=15?'已强化到满级':'本件品质最多 +'+cap+'，换更好的装备才能继续'};
 return {rank,cap,cost:gearUpgradeCost({rank,ilvl:g.ilvl},legacy)};
}
export function slotsView(s:CharacterState,legacy:(rank:number)=>{gold:number;material:number}):SlotsView{
 const r=resonanceTier(s),next=RESONANCE_STEPS.find(n=>r.lowest<n);
 return {slots:rankSlots.map(slot=>{const q=slotUpgradeQuote(s,slot,legacy),g=wornInSlot(s,slot);return {slot,rank:q.rank,gearId:g?.id??null,gearCap:q.cap,effective:Math.min(q.rank,q.cap),cost:q.cost,...(q.block?{block:q.block}:{})};}),
  resonance:{tier:r.tier,lowest:r.lowest,next:next?{rank:next,missing:rankSlots.filter(slot=>slotRank(s,slot)<next).length}:null,bonusPercent:Math.round(r.tier*RESONANCE_PER_TIER*100)}};
}

// ---------- Z3 宠物 ----------
const regionName=(id:ChartRegionId)=>hubChartContent.regions.find(r=>r.id===id)?.name??id;
export function petSource(familyId:string){const f=petFamilyById.get(familyId)!;return regionName(f.region)+(f.tier==='free'?'关口首通':f.tier==='light'?'探索度 100%':'狩猎与关口都首通');}
/** 发放宠物（幂等）。第一只自动上阵。返回是否新得。 */
export function grantPet(s:CharacterState,familyId:string){const f=petFamilyById.get(familyId);if(!f)throw Error('未知宠物 '+familyId);s.pets??={owned:{},lineup:{active:null,support:[]}};if(s.pets.owned[familyId])return false;s.pets.owned[familyId]={level:1,xp:0,flow:'blade'};if(!s.pets.lineup.active)s.pets.lineup.active=familyId;else if(s.pets.lineup.support.length<2)s.pets.lineup.support.push(familyId);s.build++;return true;}
/** 副本结算：上阵 100%、助阵 supportShare 的角色经验；不超过角色等级与上限。 */
export function grantPetXp(s:CharacterState,runXp:number){const p=s.pets;if(!p||runXp<=0)return [] as {family:string;level:number}[];const ups:{family:string;level:number}[]=[];
 const give=(id:string,share:number)=>{const own=p.owned[id];if(!own)return;const cap=Math.min(petContent.levelCap,Math.max(1,s.level));own.xp+=Math.floor(runXp*share);const before=own.level;while(own.level<cap&&own.xp>=petXpNext(own.level)){own.xp-=petXpNext(own.level);own.level++;}if(own.level>=cap)own.xp=Math.min(own.xp,petXpNext(own.level)-1);if(own.level>before){ups.push({family:id,level:own.level});s.build++;}};
 if(p.lineup.active)give(p.lineup.active,1);for(const id of p.lineup.support)if(id!==p.lineup.active)give(id,petContent.supportShare);return ups;}
export function setPetLineup(s:CharacterState,active:string|null,support:string[]){const p=s.pets;if(!p)throw Error('还没有宠物');const ids=[active,...support].filter(Boolean) as string[];if(new Set(ids).size!==ids.length)throw Error('同一只宠物不能占两个位置');if(ids.some(id=>!p.owned[id]))throw Error('阵容里有没拥有的宠物');p.lineup={active,support:[...support]};s.build++;}
export function setPetFlow(s:CharacterState,family:string,flow:PetFlow){const own=s.pets?.owned[family];if(!own)throw Error('没有这只宠物');own.flow=flow;s.build++;}
export function petView(familyId:string,own:{level:number;xp:number;flow:PetFlow}):PetView{const f=petFamilyById.get(familyId)!,form=petForm(own.level),ratio=petActiveRatio(f,own.level),passives=petPassives(f,own.level);
 const statName:Record<string,string>={hpPercent:'最大生命',attackPercent:'攻击',armorPercent:'护甲',critChance:'暴击率'};
 return {family:f.id,name:f.name,island:f.island,tier:f.tier,level:own.level,xp:own.xp,xpNext:petXpNext(own.level),form,flow:own.flow,element:petElement(own.flow),runtime:f.runtime+'-'+form,
  activeLine:'每 '+petContent.activeEvery/30+' 秒 · '+elementNames[petElement(own.flow)]+'伤害 '+Math.round(ratio*100)+'%',passiveLine:passives.map(p=>(statName[p.stat]??p.stat)+' +'+Math.round(p.value*1000)/10+'%').join('，')};}
export function petsView(s:CharacterState):PetsView{const owned=s.pets?.owned??{};
 return {owned:Object.entries(owned).map(([id,o])=>petView(id,o)),lineup:s.pets?.lineup??{active:null,support:[]},
  catalog:petContent.families.map(f=>({family:f.id,name:f.name,island:f.island,tier:f.tier,status:owned[f.id]?'owned' as const:'locked' as const,source:petSource(f.id)}))};}
/** 关口首通发的常见档宠物（内部档位名 free）。 */
export function gatePet(region:ChartRegionId){return petContent.families.find(f=>f.region===region&&f.tier==='free')?.id;}
export function explorePet(region:ChartRegionId){return petContent.families.find(f=>f.region===region&&f.tier==='light')?.id;}
/** 传说档：该航区狩猎节点与关口都已首通后发（先后顺序不限，后完成的那次发）。 */
export function huntPet(region:ChartRegionId,cleared:Record<string,unknown>){return cleared[`${region}-hunt`]&&cleared[`${region}-gate`]?petContent.families.find(f=>f.region===region&&f.tier==='heavy')?.id:undefined;}

// ---------- Z4 探索度 ----------
export const cacheId=(nodeId:string)=>'cache:'+nodeId;
export function exploreState(h:HubState){return h.explore??{caches:[],doors:[],keys:[]};}
/** 钥匙来源：关口首通。服务端在首通时调用。 */
export function gateKey(nodeId:string){return (Object.entries(hubExplore.keys) as [ChartRegionId,{name:string;from:string}][]).find(([,k])=>k.from===nodeId)?.[0];}
export function regionCaches(region:ChartRegionId){return hubChartContent.nodes.filter(n=>n.region===region&&n.kind!=='gate').map(n=>cacheId(n.id));}
export function regionDoors(region:ChartRegionId){return hubExplore.regions[region]?.doors??[];}
export function regionExplore(h:HubState,region:ChartRegionId):RegionExploreView{
 const x=exploreState(h),pts=hubExplore.points,nodes=hubChartContent.nodes.filter(n=>n.region===region),caches=regionCaches(region),doors=regionDoors(region);
 const n=nodes.filter(n=>h.chart.cleared[n.id]).length,c=caches.filter(id=>x.caches.includes(id)).length,d=doors.filter(door=>x.doors.includes(door.id)).length;
 const score=n*pts.node+c*pts.cache+d*pts.door,total=nodes.length*pts.node+caches.length*pts.cache+doors.length*pts.door,percent=total?Math.floor(score*100/total):0;
 const milestones=hubExplore.milestones.map(m=>({percent:m.percent,reached:percent>=m.percent,reward:m.reward}));
 return {score,total,percent,parts:{nodes:[n,nodes.length],caches:[c,caches.length],doors:[d,doors.length]},milestones,lockedByKey:doors.filter(door=>!x.doors.includes(door.id)&&!x.keys.includes(door.key)).length,dockBonus:dockExploreBonus(percent)};
}
export function dockExploreBonus(percent:number){return hubExplore.milestones.filter(m=>percent>=m.percent).reduce((n,m)=>Math.max(n,m.dockBonus),0);}
export function nodeExploreFields(h:HubState,nodeId:string){const n=hubNodeById.get(nodeId);if(!n)return {};const x=exploreState(h),door=regionDoors(n.region).find(d=>d.node===nodeId);
 return {...(n.kind!=='gate'?{cache:{found:x.caches.includes(cacheId(nodeId))}}:{}),...(door?{door:{id:door.id,key:door.key,keyName:hubExplore.keys[door.key]?.name??door.key,keyOwned:x.keys.includes(door.key),opened:x.doors.includes(door.id)}}:{}),...(nodeElements(nodeId)?{elements:nodeElements(nodeId)!}:{})};}
/** 秘藏位置：按节点 id 定种子，在离主路 offPath 格的可走格里选一处（服务端传入候选格）。 */
export function pickCacheCell<T>(nodeId:string,candidates:T[]){if(!candidates.length)return undefined;let h=2166136261;for(const ch of nodeId)h=Math.imul(h^ch.charCodeAt(0),16777619)>>>0;return candidates[h%candidates.length];}
