// 数值来源已迁到 tools/spine；standard/SCHEDULE仅提供当前规则的期望装配。
// 标准人属性规划：用真实规则（resolveBuild）构造 1–60 级“标准人”，所有养成按期望进度投入，
// 旧留一法与报表代码保留历史参考；直接执行此文件只核验主干来源，不再写旧模型。
// 期望进度SCHEDULE仍用于构造装配；当前DPS/施法基线读取spine-player真实测量，
// 新测量使用 pnpm spine:bench -- --player，新输出由tools/spine发布。
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gearBases,instantiateGearTemplate,resolveBuild} from '../packages/rules/index.ts';
import {applyItemPower,stageForItemLevel,qualityMaxRank} from '../packages/rules/item-power.ts';
import {collectionEquipment,equipmentRuntime} from '../packages/content/equipment-runtime.ts';
import {ensureProgression} from '../packages/rules/deep-progression.ts';
import {progressionConfig as cfg,talentDefinitions,paragonDefinitions,aspectDefinitions,progressionGearTemplates} from '../packages/content/deep-progression.ts';
import {generateAffixes,gearAffixConfig,maxAffixTierForItemLevel} from '../packages/rules/affix-generator.ts';
import {assignMainStat} from '../packages/rules/main-stats.ts';
import {effectAtomById} from '../packages/content/effect-atoms.ts';
import {ratioAffixStats} from '../packages/contracts/affix-units.ts';
import {statRegistry} from '../packages/contracts/stats.ts';
import {skillTags} from '../packages/content/skill-tags.ts';
import {skillCatalog} from '../packages/content/index.ts';
import {armorMitigation} from '../packages/rules/combat-numerics.ts';
import {monsterLevelValues} from '../packages/rules/monster-stats.ts';
import {monsterContent} from '../packages/content/monsters.ts';
import {bossLevels} from '../packages/content/starsea/index.ts';
import {versions,type CharacterState,type Gear,type GearAffix,type GearQuality,type Slot} from '../packages/contracts/index.ts';
import {expectedCharacter} from './starsea-balance-model.ts';
import {dungeonSpawns} from '../packages/rules/dungeon-build.ts';
import {dungeonContent} from '../packages/content/dungeons.ts';
import {regionById} from '../packages/content/index.ts';
import {phaseAcquisitionAt,minutesAtLevel} from './world-stage-schedule.ts';
import {crystalSources} from '../packages/rules/crystal-progress.ts';

const root=fileURLToPath(new URL('..',import.meta.url));
const out=path.join(root,'.design/standard-player-20261005');
let measured:any; // 仅保留旧报表函数的延迟读取；装配标准人不读取任何旧实测模型。
const LEVELS=Array.from({length:60},(_,k)=>k+1);
const clamp=(v:number,lo:number,hi:number)=>Math.max(lo,Math.min(hi,v));
const beaten=(L:number)=>bossLevels.filter(b=>L>b).length;

/** 标准人期望进度（设计假设）。每项都是“到达 L 级时，普通玩家已投入到的程度”。 */
export const LEGACY_SCHEDULE={
 gearLag:2,                                   // 穿戴装备物品等级 = L − 2
 legendary:(L:number)=>L<21?0:L<27?1:L<32?2:L<37?3:L<45?5:6, // 传奇件数（§3.5 期望持有）
 rare:(L:number)=>L<8?1:L<15?2:L<21?4:6,      // 稀有及以上件数（含传奇）
 affixSamples:2000,                          // 词缀按真实随机生成器（gear-affixes.json）的期望值计入
 enhance:[2,4,6,7,8,9,11,12],                 // 各装备阶段期望强化等级（按品质封顶）；武器强化 c01 通关（L≥9）开放
 setPieces:(L:number)=>L<21?0:L<37?2:4,       // 同家族件数（普通搭配不追 6 件）
 codexRank:(L:number)=>L<33?1:L<40?2:L<47?3:L<55?4:5, // 威能法典等级（c05 通关前穿戴传奇按 1 级生效）
 skillRank:(L:number)=>Math.min(5,1+Math.floor(L/6)),
 skillAwaken:(L:number)=>L>=38,              // 五级技能全部“强攻”
 talentClaims:(L:number)=>2*beaten(L)+(L>=45?6:0), // 声望领奖次数（每次 +1 天赋点）
 weaponLevel:(L:number)=>L<9?1:Math.min([50,75,100,125,150,150][LEGACY_SCHEDULE.weaponUncap(L)],1+2*(L-8)),
 weaponUncap:(L:number)=>L<33?0:L<42?1:L<52?2:3,
 gridWeapons:(L:number)=>L<22?0:Math.min(8,2+Math.floor((L-22)/3)), // 副武器格数（c03 通关开放）
 omega:(L:number)=>L>=30,                    // 高难掉落方阵苍风剑入盘
 primal:(L:number)=>L>=40,                   // 团队掉落神话星辰刃入盘
 summonLevel:(L:number)=>L<28?0:Math.min([50,80,110,140,170,200][LEGACY_SCHEDULE.summonUncap(L)],1+3*(L-27)),
 summonUncap:(L:number)=>L<40?0:L<48?1:L<56?2:3,
 awakening:(L:number)=>L<20?0:Math.min(10,1+Math.floor((L-20)/3)),
 characterUncap:(L:number)=>L<50?0:L<60?1:2,
 paragonNodes:(L:number)=>L<50?0:Math.min(48,1+5*(L-50)),
 glyphLevel:(L:number)=>L<50?0:Math.min(21,1+2*(L-50)),
 collection:(L:number)=>[...(beaten(L)>=6?['bestiary-6']:[]),...(L>=50?['codex-30']:[])],
 lifeCrystals:(L:number)=>2*beaten(L),
 starCores:(L:number)=>L<=37?0:Math.min(6,L-37),
};

/** W3 acquisitions occur at the deterministic stage clear clock; this changes
 * real items, ranks and sets, never post-multiplies measured combat power. */
export function phaseScheduled(atMinutes?:number){
 const at=(L:number)=>phaseAcquisitionAt(atMinutes??minutesAtLevel(L));
 return {...LEGACY_SCHEDULE,
  legendary:(L:number)=>at(L).legendary,rare:(L:number)=>at(L).rare,setPieces:(L:number)=>at(L).setPieces,
  skillRank:(L:number)=>at(L).skillRank,codexRank:(L:number)=>at(L).codexRank,omega:(L:number)=>at(L).omega,
  enhanceRank:(L:number)=>at(L).enhance,weaponUncap:(L:number)=>at(L).weaponUncap,summonUncap:(L:number)=>at(L).summonUncap,
  starCores:(L:number)=>L<38?0:Math.min(crystalSources('core').length,6+Math.max(0,at(L).stage-18)),
  weaponLevel:(L:number)=>Math.min(LEGACY_SCHEDULE.weaponLevel(L),[50,75,100][at(L).weaponUncap]),
  summonLevel:(L:number)=>Math.min(LEGACY_SCHEDULE.summonLevel(L),[50,80,110][at(L).summonUncap]),
 };
}
export const SCHEDULE=phaseScheduled();

export const SYSTEMS=[
 ['level','等级','角色等级属性表 + 等级精通（每级 +3% 加算增伤）'],
 ['gearBase','装备白值','六件装备主属性：物品等级阶段倍率 × 品质倍率'],
 ['enhance','装备强化','每级 +8% 主属性（按品质封顶 5/8/10/12）'],
 ['affix','装备词缀','魔法属性：攻击/暴击/生命/暴伤/标签增伤等'],
 ['set','套装','同家族 2/4 件：属性 + 标签 [×] 乘区'],
 ['aspect','传奇威能','穿戴传奇自带威能，法典等级每级 +10%'],
 ['skillRank','技能等级','每级技能系数 +12%（金币）'],
 ['skillAwaken','技能觉醒','五级技能永久分支（强攻 +30% 技能伤害）'],
 ['talent','天赋','等级点 + 声望点，先点伤害树（武技精通、斩杀），再点防御树，余点进辅助树'],
 ['reputation','声望（天赋点）','声望领奖额外天赋点；去掉后天赋点减少'],
 ['weaponGrowth','武器成长','主手武器等级/星级：攻击成长 + 武器技能系数'],
 ['grid','武器盘副武器','副武器格武器技能（含方阵/神话武器的 Ω 乘区）'],
 ['summon','召唤石','主召全额光环 + 友召半额光环'],
 ['awakening','角色觉醒','每级全属性 +3%，每层三选一'],
 ['uncap','角色突破','每星全属性 +15%，提升等级上限'],
 ['paragon','巅峰盘','50 级后每级获得巅峰点'],
 ['glyph','雕文','放大插槽半径内巅峰节点'],
 ['collection','收集奖励','六域行者/法典档位'],
 ['island','岛屿之力','击败六岛首领，各一个独立乘区 ×1.3–1.6'],
 ['hardmode','裂星潮','裂星潮后 ×2 乘区'],
 ['cores','星核','裂星潮后每处 ×1.1'],
 ['life','生命星晶','每处最大生命 +5%'],
] as const;
export type SystemId=typeof SYSTEMS[number][0];

const slots:Slot[]=['weapon','armor','helmet','boots','accessory','ring'];
const mixed=['sword','hammer','axe','staff','hidden','wand'];
const artTier=(ilvl:number)=>[...equipmentRuntime.stages].filter(s=>s.requiredLevel<=ilvl).sort((a,b)=>b.tier-a.tier)[0]?.tier??equipmentRuntime.stages[0].tier;
let uid=0;const id=(p:string)=>p+'-'+(++uid).toString(16).padStart(8,'0');

function template(slot:Slot,family:string,ilvl:number,series='standard'){
 return gearBases.find(g=>g.slot===slot&&collectionEquipment(g.base)?.tier===artTier(ilvl)&&collectionEquipment(g.base)?.series===series&&collectionEquipment(g.base)?.family===family)
  ??gearBases.find(g=>g.slot===slot&&collectionEquipment(g.base)?.tier===artTier(ilvl)&&collectionEquipment(g.base)?.series==='standard')!;
}
/** 词缀取真实随机生成器的期望：每个属性的值 = 出现概率 × 平均数值（固定值按阶段倍率放大）。 */
const affixCache=new Map<string,{stat:string;value:number}[]>();
function expectedAffixes(g:Gear,maxTier:number){
 const q=g.quality,context={slot:g.slot,exclude:g.mainStat?.stat??(g.attack>0?'attack':g.armor>0?'armor':undefined)},key=[q,maxTier,context.slot,context.exclude].join(':');if(affixCache.has(key))return affixCache.get(key)!;
 let seed=12345;const next=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 const random={int:(min:number,max:number)=>min+Math.floor(next()*(max-min)),float:next},sum=new Map<string,number>(),N=SCHEDULE.affixSamples;
 for(let i=0;i<N;i++)for(const a of generateAffixes(q,maxTier,random,gearAffixConfig,context))sum.set(a.stat,(sum.get(a.stat)??0)+a.value);
 const res=[...sum].map(([stat,v])=>({stat,value:v/N}));affixCache.set(key,res);return res;
}
function affixes(g:Gear,ilvl:number):GearAffix[]{
 const scale=stageForItemLevel(ilvl).scale;
 return expectedAffixes(g,maxAffixTierForItemLevel(ilvl)).map((a,k)=>({id:'affix_'+a.stat+'_'+k,name:a.stat,stat:a.stat,value:statRegistry.find(r=>r.id===a.stat)?.stageScaled?a.value*scale:a.value,tier:1,description:''} as GearAffix));
}
/** 普通搭配的传奇威能：偶数件对上技能标签的构筑威能，奇数件为通用威能（“一半对上”）。 */
function aspectFor(g:Gear,index:number,L:number,tags:Set<string>,skills:string[]){
 const fits=aspectDefinitions.filter(a=>!a.legacy&&a.dropEnabled&&a.slots.includes(g.slot)&&a.requiredLevel<=L&&(!a.weapons?.length||a.weapons.includes('sword')));
 const build=fits.filter(a=>a.parts?.patches.some(p=>(p.skills??[]).some(id=>skills.includes(id))||(p.tags??[]).some(tag=>tags.has(tag)))||a.parts?.atoms.some(ref=>effectAtomById.get(ref.id)?.filter?.tags?.some(tag=>tags.has(tag))));
 return (index%2===0&&build.length?build[index%build.length]:fits[index%fits.length])?.id;
}

type Off=ReadonlySet<SystemId>;
export function standard(L:number,off:Off=new Set(),atMinutes?:number):CharacterState{
 const schedule=atMinutes===undefined?SCHEDULE:phaseScheduled(atMinutes);
 uid=0;
 const c=expectedCharacter(L),on=(s:SystemId)=>!off.has(s);
 const ilvl=Math.max(1,L-schedule.gearLag),stage=stageForItemLevel(ilvl),nLeg=schedule.legendary(L),nRare=Math.max(nLeg,schedule.rare(L)),setN=on('set')?schedule.setPieces(L):0;
 const tags=new Set(c.skills.flatMap(sk=>skillTags(skillCatalog.find(x=>x.id===sk)!)));
 c.gear=slots.map((slot,i)=>{
  const clock=atMinutes??minutesAtLevel(L),phase=phaseAcquisitionAt(clock);
  const q:GearQuality=i<nLeg?'legendary':i<nRare?'rare':phase.stage===0?'common':'magic';
  // Stage set bundles are standard-series equipment. Omega acquisition belongs
  // to the separately scheduled grid weapon and does not replace worn gear.
  const g=applyItemPower(instantiateGearTemplate(template(slot,i<setN?'sword':mixed[i],ilvl,'standard'),id('g'),q),ilvl);
  const mains=gearAffixConfig.mainStats.filter(row=>row.slot===slot),common=[...mains].sort((a,b)=>b.weight-a.weight)[0],offset=common?mains.slice(0,mains.indexOf(common)).reduce((sum,row)=>sum+row.weight,0):0;
  assignMainStat(g,ilvl,{int:(min,max)=>Math.min(max-1,Math.max(min,offset)),float:()=>.5});
  if(on('affix'))g.affixes=affixes(g,ilvl);
  g.rank=on('enhance')?Math.min(qualityMaxRank[q],schedule.enhanceRank(L)):0;
  if(!on('gearBase')){g.attack=0;g.armor=0;delete g.mainStat;}
  if(q==='legendary'&&on('aspect'))g.aspectId=aspectFor(g,i,L,tags,c.skills);
  return g;
 });
 c.equipment=Object.fromEntries(c.gear.map(g=>[g.slot,g.id]));
 const p=ensureProgression(c),main=c.gear[0];
 // 武器成长 + 武器盘
 p.weapons[main.id]=on('weaponGrowth')?{level:schedule.weaponLevel(L),uncap:schedule.weaponUncap(L)}:{level:1,uncap:0};
 if(on('grid')){
  const extra:Gear[]=[];
  if(schedule.primal(L))extra.push(gridWeapon('primal-blade'));
  if(schedule.omega(L)&&schedule.gridWeapons(L)>0)extra.push(gridWeapon('omega-blade'));
  for(const fam of ['hammer','axe','staff','hidden','wand','sword','hammer','axe'])extra.push(Object.assign(applyItemPower(instantiateGearTemplate(template('weapon',fam,ilvl),id('w'),'rare'),ilvl),{}));
  const n=schedule.gridWeapons(L);
  for(const [k,w] of extra.slice(0,n).entries()){c.gear.push(w);p.weaponGrid[k+1]=w.id;}
  ensureProgression(c);
  const lv=on('weaponGrowth')?Math.max(1,Math.floor(schedule.weaponLevel(L)/2)):1;
  for(const k of p.weaponGrid.slice(1))if(k)p.weapons[k]={level:lv,uncap:0};
 }
 function gridWeapon(base:string):Gear{const t=progressionGearTemplates.find(x=>x.base===base)!;return {id:id('w'),base:t.base,name:t.name,slot:'weapon',attack:t.attack,armor:0,effect:'none',rank:0,locked:false,quality:base.startsWith('primal')?'legendary':'rare',affixes:[]} as Gear;}
 // 技能
 for(const sk of c.skills)c.skillRanks[sk]=on('skillRank')?schedule.skillRank(L):1;
 if(on('skillAwaken')&&schedule.skillAwaken(L)&&schedule.skillRank(L)>=5)for(const sk of c.skills)p.skillAwakenings[sk]='power';
 // 法典等级：穿戴传奇的威能
 for(const g of c.gear)if(g.aspectId)p.codex[g.aspectId]=schedule.codexRank(L);
 // 天赋：伤害树＋防御树，按层顺序点满
 const claims=on('reputation')?schedule.talentClaims(L):0;
 p.reputationClaims=Array.from({length:claims},(_,k)=>cfg.factions[k%6].id+':'+(1+Math.floor(k/6)));
 if(on('talent')){
  let points=Math.min(60,Math.min(50,Math.max(0,L-1))+claims);
  // 2026-10-07 天赋四树：先点伤害树（剑系只取武技精通）、再点防御树，按层点满；二选一与关键天赋取每层第一个。
  for(const branch of ['damage','defense','support'] as const)for(const t of talentDefinitions.filter(t=>t.branch===branch&&t.id!=='damage-spell'&&(!t.exclusive||t===talentDefinitions.find(x=>x.branch===branch&&x.tier===t.tier)))){const n=Math.min(points,t.max);if(!n)break;p.talents[t.id]=n;points-=n;}
 }
 // 召唤石：已击败岛屿对应的召唤石，主召/友召取攻击、技能类最高
 const sl=schedule.summonLevel(L);
 if(on('summon')&&sl>0){
  const owned=cfg.summons.slice(0,beaten(L));
  for(const d of owned)p.summons[d.id]={level:sl,uncap:schedule.summonUncap(L)};
  const ranked=[...owned].sort((a,b)=>(+(b.stat!=='hp'&&b.stat!=='armor'))-(+(a.stat!=='hp'&&a.stat!=='armor'))||b.value-a.value);
  p.summonSlots={main:ranked[0]?.id??null,friend:ranked[1]?.id??null} as typeof p.summonSlots;
 }
 if(on('awakening')){p.awakening=schedule.awakening(L);p.awakeningChoices=Object.fromEntries(Array.from({length:p.awakening},(_,k)=>[String(k),['attack','skill','defense'][k%3]]));}
 if(on('uncap'))p.characterUncap=schedule.characterUncap(L);
 if(on('paragon')){const n=schedule.paragonNodes(L);p.paragonLevel=Math.max(0,n-1);p.paragon=paragonDefinitions.slice(0,n).map(x=>x.id);
  if(on('glyph')&&schedule.glyphLevel(L)>0){p.glyphs['glyph-warrior']=schedule.glyphLevel(L);if(p.paragon.includes('paragon-11'))p.glyphSlots['paragon-11']='glyph-warrior';}}
 if(on('collection'))p.collectionClaims=schedule.collection(L);
 // 星潮海：岛屿之力、裂星潮、星核、生命星晶（expectedCharacter 已按等级写入首领与裂星潮）
 const st=c.starsea!;
 if(!on('island'))st.bosses=[];
 if(!on('hardmode'))st.hardmode=false;
 st.crystals=[...(on('life')?crystalSources('life').slice(0,schedule.lifeCrystals(L)).map(row=>row.id):[]),...(on('cores')?crystalSources('core').slice(0,schedule.starCores(L)).map(row=>row.id):[])];
 if(!on('level'))c.level=1; // 等级属性与等级精通按 1 级计；技能、天赋已按真实等级写入
 return c;
}

// ---- 度量 ----
const measuredRow=(L:number)=>{const model=JSON.parse(fs.readFileSync(path.join(root,'tools/spine/data/spine-player.json'),'utf8')),point=[...model.points].sort((a:any,b:any)=>Math.abs(a.level-L)-Math.abs(b.level-L))[0],source=typeof point.localSource==='string'?point.localSource:point.localSource.path,raw=JSON.parse(fs.readFileSync(source,'utf8')),row=raw.rows.find((r:any)=>r.axis==='D1'&&r.seed===42);return {level:L,dps1:{mean:point.D1,casts:row.casts},dpsN:{mean:point.DN}};};
export function metrics(c:CharacterState,L:number){
 const b=resolveBuild(c),s=b.stats,crit=Math.min(.5,s.critChance??0),mult=s.critMultiplier??1.5,critFactor=1+crit*(mult-1);
 const row=measuredRow(L),casts:Record<string,number>=row?.dps1?.casts??{};
 const skills=b.resolvedSkills.map(sk=>({id:sk.id,damage:sk.damage,cooldown:sk.cooldown,avg:sk.damage*critFactor}));
 const mon=monsterLevelValues('starsea',L,monsterContent),hitTaken=armorMitigation(Math.max(1,Math.round(mon.attack)),Math.max(0,s.armor)).damage;
 return {attack:s.attack,hp:s.hp,armor:s.armor,critChance:crit,critMultiplier:mult,damageAdd:s.damageAdd??0,damageMult:s.damageMult??1,
  lifesteal:s.lifesteal??0,penetration:s.penetration??0,cdr:s.cdr??0,mana:s.mana,regen:s.regen,speed:s.speed,
  skills,casts,ehp:s.hp*Math.max(1,Math.round(mon.attack))/Math.max(1,hitTaken),hitTaken,zones:(s.zones??[]).map(z=>({id:z.id,label:z.label,kind:z.kind,value:z.value,tags:z.tags}))};
}
/** 30 秒施放次数：基准实测次数按冷却比例折算（冷却越短，次数越多；ward 等护盾不计伤害）。 */
export function rotation(m:ReturnType<typeof metrics>,base:ReturnType<typeof metrics>){
 let total=0;for(const sk of m.skills){const b=base.skills.find(x=>x.id===sk.id);const n=(m.casts[sk.id]??0)*(b&&sk.cooldown>0?Math.max(1,b.cooldown)/Math.max(1,sk.cooldown):1);if(['ward','barrier'].includes(sk.id))continue;total+=n*sk.avg;}
 return total;
}

const isMain=/standard-player-model.ts$/.test(process.argv[1]??"");
const rows=[];
if(isMain){const {legacySpineEntry}=await import('./spine/legacy.ts');await legacySpineEntry('standard-player-model');process.exit(0);}
if(isMain)for(const L of LEVELS){
 const row=measuredRow(L);if(!row)throw Error('missing measured row L'+L);
 const baseline=metrics(expectedCharacter(L),L),full=metrics(standard(L),L);
 const baseRot=rotation(baseline,baseline),fullRot=rotation(full,baseline);
 const scale=fullRot/baseRot,dps1=row.dps1.mean*scale,dpsN=row.dpsN.mean*scale;
 const ablation:Record<string,{attack:number;hp:number;armor:number;hit:number;rot:number;ehp:number}>={};
 for(const [sys] of SYSTEMS){const m=metrics(standard(L,new Set([sys as SystemId])),L);
  ablation[sys]={attack:full.attack/Math.max(1,m.attack),hp:full.hp/Math.max(1,m.hp),armor:(full.armor+1)/(m.armor+1),hit:full.skills[0].avg/Math.max(1e-9,m.skills[0].avg),rot:fullRot/Math.max(1e-9,rotation(m,baseline)),ehp:full.ehp/Math.max(1e-9,m.ehp)};}
 const s=SCHEDULE;
 rows.push({level:L,ilvl:Math.max(1,L-s.gearLag),stage:stageForItemLevel(Math.max(1,L-s.gearLag)).tier,
  schedule:{legendary:s.legendary(L),rare:Math.max(s.legendary(L),s.rare(L)),enhance:s.enhanceRank(L),setPieces:s.setPieces(L),codexRank:s.codexRank(L),skillRank:s.skillRank(L),skillAwaken:s.skillAwaken(L),
   talentPoints:Math.min(60,Math.min(50,Math.max(0,L-1))+s.talentClaims(L)),reputationClaims:s.talentClaims(L),weaponLevel:s.weaponLevel(L),weaponUncap:s.weaponUncap(L),gridWeapons:s.gridWeapons(L),omega:s.omega(L)&&s.gridWeapons(L)>0,primal:s.primal(L),
   summonLevel:s.summonLevel(L),summonUncap:s.summonUncap(L),summons:s.summonLevel(L)>0?beaten(L):0,awakening:s.awakening(L),characterUncap:s.characterUncap(L),paragonNodes:s.paragonNodes(L),glyphLevel:s.glyphLevel(L),collection:s.collection(L).join(' '),islands:beaten(L),hardmode:L>bossLevels.at(-1)!,lifeCrystals:s.lifeCrystals(L),starCores:s.starCores(L)},
  baseline:{...baseline,rot:baseRot,dps1:row.dps1.mean,dpsN:row.dpsN.mean},full:{...full,rot:fullRot,dps1,dpsN},ablation,
  monster:{current:monsterLevelValues('starsea',L,monsterContent)}});
}
if(isMain){
const meta={generated:new Date().toISOString(),versions,ranks:monsterContent.ranks,baselineSource:'.design/starsea-balance-20261005/model.json（'+measured.versions.rules+'，'+measured.measurement.strategy+'）',targets:measured.targets,systems:SYSTEMS.map(([id,name,desc])=>({id,name,desc})),bossLevels};
const dungeons=dungeonTable();
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'model.json'),JSON.stringify({meta,rows,dungeons},null,1));
const fmt=(n:number)=>n>=1e8?(n/1e8).toFixed(2)+'亿':n>=1e4?(n/1e4).toFixed(1)+'万':n.toFixed(0);
console.log('L  | 基准DPS  标准人DPS  倍数 | 攻击 基准→标准 | 生命 基准→标准');
for(const r of rows as any[])if([1,5,10,15,21,27,32,37,38,45,50,55,60].includes(r.level))console.log(`${String(r.level).padStart(2)} | ${fmt(r.baseline.dps1).padStart(7)} ${fmt(r.full.dps1).padStart(9)} ${(r.full.dps1/r.baseline.dps1).toFixed(2).padStart(6)} | ${r.baseline.attack}→${r.full.attack} | ${r.baseline.hp}→${r.full.hp}`);
}
/** 副本首领：真实 dungeonSpawns（星潮海世界线，最低档位，不含随机词缀），按阶段取首领与杂兵总量。 */
export function dungeonTable(){
 const tiers=[1,10,25,50,100];
 return dungeonContent.definitions.filter(d=>['trial','high','nightmare','raid'].includes(d.kind)).map(d=>{
  const out=(tier:number)=>d.stages.map((id,stage)=>{const sp=dungeonSpawns(regionById(id).spawns,d.policy,tier,stage,[],monsterContent,'starsea');const boss=sp.find(e=>e.boss);
   return {region:id,level:(boss??sp[0])?.monster?.level??null,bossHp:boss?.hp??0,bossAttack:boss?.attack??0,bossArmor:boss?.monster?.armor??0,adds:sp.filter(e=>!e.boss).length,addsHp:sp.filter(e=>!e.boss).reduce((n,e)=>n+e.hp,0)};});
  return {id:d.id,name:d.name,kind:d.kind,entryLevel:d.level,requires:d.requires,monsterLevel:d.policy.monsterLevel,party:d.policy.party.max,enemyScale:d.policy.enemyScale,tierRules:d.policy.tierRules,maxTier:d.policy.maxTier,
   tiers:(d.kind==='nightmare'?tiers.filter(t=>t<=d.policy.maxTier):[d.policy.minTier]).map(t=>({tier:t,stages:out(t)}))};});
}
