import {craftMaterials} from './crafting.ts';
import {legacyProgressionGear} from './legacy-progression-gear.ts';
import {progressionNodeValues} from './spine-controls.ts';
import fieldKillTalents from './field-kill-talents.json';
import {talentTrees,talentTreeNodes} from './talent-trees.ts';
import {inscriptionRubbings} from './inscription-rubbings.ts';
import {effectAtomById} from './effect-atoms.ts';
import {newAspects} from './aspects.ts';
import {buildSourcePartsSchema} from '../contracts/build-sources.ts';
import {weaponTypeSchema} from '../contracts/weapons.ts';
import {statRegistry} from '../contracts/stats.ts';
import {skillTagNames,type SkillTag} from './skill-tags.ts';
import {z} from 'zod';
import {gearSlotSchema} from '../contracts/gear-slots.ts';
import {collectionWeaponSkills} from './equipment-runtime.ts';
import legacyGear from '../rules/gear-bases.json';
import raw from './deep-progression.json';
import {skillCatalog} from './index.ts';
import {comboAspectSources} from './weapon-combos.ts';
const n=z.number().nonnegative().finite(),i=z.number().int().nonnegative(),id=z.string().min(1);
const cost=z.object({gold:i,material:i}).strict();
const record=z.record(id,i);
export const deepProgressionConfigSchema=z.object({professionsRewards:z.object({reputationGold:i,reputationSummonShards:i,donationRep:i.positive(),fullInventoryFragments:i.positive()}).strict(),paragonXp:z.object({base:i.min(600),perLevel:i}).strict(),weaponCaps:z.array(i.positive()).length(6),weaponFactors:z.array(n.positive()).length(6),summonCaps:z.array(i.positive()).length(6),characterCaps:z.array(i.positive()).length(6),caps:z.object({attack:n,skill:n,omegaAttack:n,omegaSkill:n,hp:n,armor:n,crit:n,talent:n,aura:n}).strict(),costs:z.object({weaponLevel:cost,reset:cost,imprint:cost,talent:cost,paragon:cost,glyph:cost,summon:cost,awakening:cost,skillAwakening:cost,donation:cost,characterUncap:cost,weaponUncap:cost,extract:cost,gather:cost,recipeLearn:cost,recipeCraft:cost}).strict(),uncapDuplicates:z.array(i).length(5),uncapFragments:z.array(i).length(5),characterShards:z.array(i).length(5),reputationThresholds:z.array(i).length(5),factions:z.array(z.object({id,name:id}).strict()),weaponSkills:z.array(z.object({base:id,skills:z.array(z.object({type:z.enum(['attack','skill','hp','armor','crit','omegaAttack','omegaSkill']),value:n}).strict()).min(1).max(2)}).strict()),summons:z.array(z.object({id,name:id,stat:z.enum(['attack','skill','hp','armor']),value:n,region:id}).strict()),rewards:z.object({world:record,elite:record,boss:record,high:record,nightmare:record,raid:record,season:record}).strict(),materials:z.array(z.object({id,name:id,source:id}).strict())}).strict().superRefine((v,c)=>{for(const xs of [v.weaponCaps,v.weaponFactors,v.summonCaps,v.characterCaps,v.reputationThresholds])if(xs.some((x,k)=>k>0&&x<xs[k-1]))c.addIssue({code:'custom',message:'Progression curves must be monotonic'});});
export const progressionConfig=deepProgressionConfigSchema.parse({...raw,materials:[...craftMaterials.filter(m=>m.id!=='enhance_stone').map(m=>({id:m.id,name:m.name,source:m.sources.join('；')})),...inscriptionRubbings.map(r=>({id:r.id,name:(effectAtomById.get(r.atomId)!.name)+'铭纹拓片 · '+({weapon:'武器',armor:'衣服',helmet:'头盔',boots:'鞋子',accessory:'项链',ring:'戒指'} as Record<string,string>)[r.slot],source:'分解对应部位的铭纹装备'}))],weaponSkills:[...raw.weaponSkills,...collectionWeaponSkills]});
// Every modifier maps to a field consumed by the battle runtime. No free-form effect strings.
export const modifierSchema=z.object({stat:z.enum(statRegistry.filter(s=>s.modifier).map(s=>s.id) as [string,...string[]]),value:n,skill:id.optional(),
 /** tagDamage：按技能标签生效的独立 [×] 乘区，乘数为 1+value；zone 为乘区来源 id。 */
 tags:z.array(id).min(1).optional(),zone:id.optional()}).strict().refine(m=>m.stat!=='tagDamage'||m.tags&&m.zone,'tagDamage 需要 tags 与 zone');
export type Modifier=z.infer<typeof modifierSchema>;
const generic:Modifier[]=[{stat:'skillDamage',value:.4},{stat:'hp',value:.2},{stat:'regen',value:.3},{stat:'skillCooldown',value:.3},{stat:'lifesteal',value:.15},{stat:'armor',value:.3},{stat:'speed',value:.15},{stat:'attack',value:.2}];
const buildAspects:[string,string,SkillTag,number,'weapon'|'armor'|'accessory'|'core',number][]=[
 ['ember','余烬之心','dot',.25,'core',12],['pyre','焚心烈焰','fire',.2,'weapon',12],['rime','霜脉','cold',.2,'weapon',12],['storm','雷鸣之誓','lightning',.2,'weapon',12],
 ['arcane','奥能回响','arcane',.2,'core',17],['umbra','影噬','shadow',.2,'core',17],['venom','毒腺','poison',.2,'accessory',17],['bonecrush','碎骨','physical',.2,'weapon',12],
 ['split','分裂箭','projectile',.2,'accessory',12],['guillotine','断头台','single',.2,'weapon',17],['quake','震地','area',.2,'armor',12],['bladewind','刃风','melee',.2,'armor',17],
 ['hawkeye','鹰眼','ranged',.2,'accessory',17],['sage','秘法贤者','spell',.18,'armor',17],['blink','疾影突袭','dash',.3,'accessory',23],['arc','连锁闪电','chain',.3,'core',23],
];
const names=['锋芒','守御','聚能','迅击','饮血','铁壁','疾行','强袭'];
// 流派威能（packages/content/weapon-combos.ts）只携带连携规则，modifiers 为空；规则由 rules/weapon-combos.ts 解析。
export const legacyAspectDefinitions=z.array(z.object({id,name:id,description:id,slots:z.array(gearSlotSchema).min(1),requiredLevel:i.min(1),modifiers:z.array(modifierSchema),combo:z.boolean().optional(),source:id}).strict().refine(a=>a.modifiers.length>0||a.combo===true,'威能需要数值或连携规则')).parse([
 ...Array.from({length:80},(_,k)=>({id:'aspect-'+(k+1),name:names[k%8]+'威能·'+(Math.floor(k/8)+1),description:`${names[k%8]}强化，法典永久保存，效果取最高等级，同类威能不叠加`,slots:[(['weapon','armor','core','weapon','accessory','armor','accessory','weapon'] as const)[k%8]],requiredLevel:10+Math.floor(k/8)*2,modifiers:[{...generic[k%8],value:generic[k%8].value*(1+Math.floor(k/8)*.03)}],source:'传奇装备萃取'})),
 ...skillCatalog.slice(0,30).map((sk,k)=>({id:'aspect-skill-'+sk.id,name:sk.name+'专属威能',description:sk.id==='whirl'?'旋风半径提升至6格、伤害+80%、命中拖拽':sk.id==='bolt'?'五重扇形穿云箭，每支60%伤害':'指定技能伤害+40%、范围+30%',slots:['weapon'],requiredLevel:Math.max(15,sk.unlockLevel),modifiers:sk.id==='whirl'?[{stat:'skillDamage',value:.8,skill:sk.id},{stat:'skillRadius',value:6/sk.radius-1,skill:sk.id},{stat:'pull',value:1.5,skill:sk.id}]:sk.id==='bolt'?[{stat:'projectiles',value:5,skill:sk.id},{stat:'skillDamage',value:0,skill:sk.id}]:[{stat:'skillDamage',value:.4,skill:sk.id},{stat:'skillRadius',value:.3,skill:sk.id}],source:'传奇武器萃取'})),
 // 构筑威能（docs/build-depth-design.md §6）：每个只做一件事——让带某标签的技能获得一个独立 [×] 乘区。
 ...buildAspects.map(([key,name,tag,value,slot,requiredLevel])=>({id:'aspect-build-'+key,name,description:`${skillTagNames[tag]}技能伤害 [×]${(1+value).toFixed(2)}（法典等级每级再 +10%）`,slots:[slot],requiredLevel,modifiers:[{stat:'tagDamage' as const,value,tags:[tag],zone:'aspect-build-'+key}],source:'Lv'+requiredLevel+'+ 传奇装备随机携带'})),
 ...Array.from({length:10},(_,k)=>({id:'aspect-mythic-'+(k+1),name:'星辰神话·'+(k+1),description:'攻击与技能强度提升，需击败龙骨山谷领主',slots:['weapon','core'],requiredLevel:50,modifiers:[{stat:'attack',value:.3},{stat:'skillDamage',value:.3}],source:'龙骨领主解锁后传奇装备萃取'})),
  ...comboAspectSources.map(a=>({id:'aspect-combo-'+a.key,name:a.name,description:a.rule.description+'（法典等级每级效果 +10%，仅对应主手生效）',slots:[a.slot],requiredLevel:a.requiredLevel,modifiers:[],combo:true,source:'Lv'+a.requiredLevel+'+ 传奇装备随机携带'}))
]).map(aspect=>({...aspect,slots:[...new Set(aspect.slots.flatMap(slot=>slot==='armor'?['armor','helmet','boots'] as const:slot==='accessory'?['accessory','ring'] as const:[slot]))]}));
export const aspectDefinitions=[...legacyAspectDefinitions.map(a=>({...a,name:a.name+'（旧版）',legacy:true as const,dropEnabled:a.id==='aspect-build-split',weapons:[] as import('../contracts/weapons.ts').WeaponType[],parts:undefined as import('../contracts/build-sources.ts').BuildSourceParts|undefined})),...newAspects.map(a=>({...a,modifiers:[] as Modifier[],combo:false,source:'Lv'+a.requiredLevel+'+传奇装备萃取与法典刻印'}))];
export {talentTrees,talentTreeNames,talentTreeDescriptions,talentTierRequired,talentZoneNames,type TalentTree} from './talent-trees.ts';
// 2026-10-07 天赋四树取代三系专精；第 4 层与关键天赋带 exclusive（同树同层只能投一个节点）。
export const talentDefinitions=z.array(z.object({id,name:id,branch:z.enum(talentTrees),tier:i.min(1).max(5),max:i.positive().max(5),required:i,exclusive:z.literal(true).optional(),modifiers:z.array(modifierSchema),parts:buildSourcePartsSchema.optional()}).strict().refine(t=>t.modifiers.length>0||Boolean(t.parts?.rules.length),'Talent must have a real modifier or executable rule')).parse([...talentTreeNodes,...fieldKillTalents]);
export const paragonDefinitions=z.array(z.object({id,name:id,board:i.max(3),x:i,y:i,requires:z.array(id),modifiers:z.array(modifierSchema).min(1),socket:z.boolean()}).strict()).parse(Array.from({length:48},(_,k)=>({id:'paragon-'+k,name:'巅峰盘'+(Math.floor(k/12)+1)+'·'+(k%12===11?'雕文插槽':k%12===8?'稀有节点':'属性节点'),board:Math.floor(k/12),x:k%4,y:Math.floor(k%12/4),requires:k%12===0?(k===0?[]:['paragon-'+(k-1)]):['paragon-'+(k-1)],modifiers:[{stat:(['attack','hp','skillDamage','armor'] as const)[Math.floor(k/12)],value:k%12===8?.15:k%12===4?.05:.01}],socket:k%12===11})));
for(const node of [...talentDefinitions,...paragonDefinitions]){const values=progressionNodeValues[node.id];if(!values)continue;if(values.length!==node.modifiers.length)throw Error('主干节点修饰数量不一致 '+node.id);node.modifiers=node.modifiers.map((m,k)=>modifierSchema.parse({...m,value:values[k]}));}
// 雕文 id 保持不变（存档兼容），名称按巅峰盘主属性命名，不再对应职业。
export const glyphDefinitions=z.array(z.object({id,name:id,board:i.max(3)}).strict()).parse([{id:'glyph-warrior',name:'锋芒雕文',board:0},{id:'glyph-mage',name:'血脉雕文',board:1},{id:'glyph-ranger',name:'奥秘雕文',board:2},{id:'glyph-guardian',name:'守护雕文',board:3}]);
export const skillAwakeningDefinitions=[{id:'power',name:'强攻',description:'技能伤害+30%',modifiers:[{stat:'skillDamage',value:.3}]},{id:'swift',name:'疾速',description:'技能冷却-20%',modifiers:[{stat:'skillCooldown',value:.2}]},{id:'wide',name:'扩散',description:'技能半径+40%、射程+20%',modifiers:[{stat:'skillRadius',value:.4}]}] satisfies {id:string;name:string;description:string;modifiers:Modifier[]}[];
export const awakeningDefinitions=[{id:'attack',name:'攻击觉醒',modifier:{stat:'attack',value:.03}},{id:'defense',name:'防御觉醒',modifier:{stat:'armor',value:.06}},{id:'skill',name:'技能觉醒',modifier:{stat:'skillDamage',value:.03}}] satisfies {id:string;name:string;modifier:Modifier}[];
export const collectionDefinitions=[{id:'codex-30',name:'法典入门',kind:'codex',required:30,bonus:.05},{id:'codex-60',name:'法典大师',kind:'codex',required:60,bonus:.1},{id:'codex-90',name:'法典贤者',kind:'codex',required:90,bonus:.15},{id:'codex-120',name:'法典全知',kind:'codex',required:120,bonus:.2},{id:'bestiary-6',name:'六域行者',kind:'bosses',required:6,bonus:.03}];
export const progressionGearTemplates=legacyProgressionGear;


