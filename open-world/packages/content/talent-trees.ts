/** 天赋节点的修饰在 deep-progression.ts 中经 modifierSchema 校验。 */
type Modifier={stat:string;value:number;tags?:string[];zone?:string};
/**
 * 2026-10-07 天赋四树（取消专精，四棵树全部开放）。每棵树 5 层，本树投入 0/5/10/15/20 点解锁下一层；
 * 第 4 层二选一，第 5 层关键天赋（同树多选一）。60 点上限下最多点出 2 个关键天赋。
 * 每级数值按“1 点 ≈ 2% 同类收益”定标，与旧三系天赋的总预算一致；整体由平衡推导复核。
 */
export const talentTrees=['damage','defense','support','special'] as const;
export type TalentTree=typeof talentTrees[number];
export const talentTreeNames:Record<TalentTree,string>={damage:'伤害',defense:'防御',support:'辅助',special:'特殊'};
export const talentTreeDescriptions:Record<TalentTree,string>={damage:'攻击、暴击与武技／法术精通，关键天赋三选一。',defense:'生命、护甲、抗性与减伤，关键天赋三选一。',support:'冷却、能量、施法速度与击杀续航。',special:'异常状态几率、持续伤害与对受控目标。'};
export const talentTierRequired=[0,5,10,15,20] as const;
/** 天赋精通乘区的显示名，供 tagDamage 的 zone 查询。 */
export const talentZoneNames:Record<string,string>={'talent-martial-mastery':'天赋 · 武技精通','talent-spell-mastery':'天赋 · 法术精通'};
type Node={id:string;name:string;tier:1|2|3|4|5;max:number;modifiers:Modifier[];exclusive?:true};
const n=(id:string,name:string,tier:Node['tier'],max:number,...modifiers:Modifier[]):Node=>({id,name,tier,max,modifiers,...(tier>=4?{exclusive:true as const}:{})});
const nodes:Record<TalentTree,Node[]>={
 damage:[
  n('damage-edge','锋锐',1,5,{stat:'attack',value:.02}),n('damage-crit','致命',1,5,{stat:'critChance',value:.01}),
  n('damage-martial','武技精通',2,3,{stat:'tagDamage',value:.04,tags:['martial'],zone:'talent-martial-mastery'}),n('damage-spell','法术精通',2,3,{stat:'tagDamage',value:.04,tags:['spell'],zone:'talent-spell-mastery'}),
  n('damage-brutal','暴伤',3,3,{stat:'critMultiplier',value:.06}),n('damage-pierce','穿透',3,3,{stat:'penetration',value:.04}),
  n('damage-hunt','猎杀残血',4,3,{stat:'vsLow',value:.08}),n('damage-first','先发制人',4,3,{stat:'vsHealthy',value:.08}),
  n('damage-execute','斩杀',5,1,{stat:'executeBonus',value:1}),n('damage-resonance','元素共鸣',5,1,{stat:'effectChain',value:1}),n('damage-multishot','多重射击',5,1,{stat:'projectiles',value:3})
 ],
 defense:[
  n('defense-vigor','体魄',1,5,{stat:'hp',value:.02}),n('defense-plate','铁甲',1,5,{stat:'armor',value:.03}),
  n('defense-resist','元素抗性',2,3,{stat:'allResist',value:.03}),n('defense-block','格挡',2,3,{stat:'blockChance',value:.03}),
  n('defense-reduce','伤害减免',3,3,{stat:'damageReduction',value:.02}),n('defense-leech','生命偷取',3,3,{stat:'lifesteal',value:.01}),
  n('defense-thorns','荆棘',4,3,{stat:'thorns',value:.4}),n('defense-mend','受治疗',4,3,{stat:'healingReceived',value:.08}),
  n('defense-tenacity','坚韧',5,1,{stat:'damageReduction',value:.06},{stat:'hp',value:.1}),n('defense-reap','击杀回血',5,1,{stat:'lifeOnKill',value:.02}),n('defense-guardian','守护',5,1,{stat:'allResist',value:.1},{stat:'blockChance',value:.08})
 ],
 support:[
  n('support-haste','冷却缩减',1,5,{stat:'skillCooldown',value:.02}),n('support-mana','能量',1,5,{stat:'mana',value:.03}),
  n('support-cast','施法速度',2,3,{stat:'castSpeed',value:.03}),n('support-stride','移速',2,3,{stat:'speed',value:.02}),
  n('support-reach','技能范围',3,3,{stat:'skillRadius',value:.03}),n('support-thrift','技能消耗',3,3,{stat:'skillCost',value:.03}),
  n('support-siphon','击杀回灵',4,3,{stat:'manaOnKill',value:3}),n('support-reset','击杀减冷却',4,3,{stat:'cooldownOnKill',value:.1})
 ],
 special:[
  n('special-ignite','点燃几率',1,5,{stat:'igniteChance',value:.02}),n('special-chill','冰缓几率',1,5,{stat:'chillChance',value:.02}),
  n('special-afflict','感电／中毒／流血',2,3,{stat:'shockChance',value:.02},{stat:'poisonChance',value:.02},{stat:'bleedChance',value:.02}),n('special-linger','状态持续',2,3,{stat:'statusDuration',value:.06}),
  n('special-dotcrit','持续伤害暴击',3,3,{stat:'dotCrit',value:.04}),n('special-expose','易伤',3,3,{stat:'vulnerableBonus',value:.05}),
  n('special-control','对受控伤害',4,3,{stat:'vsControlled',value:.08}),n('special-bane','强敌克星',4,3,{stat:'vsElite',value:.05},{stat:'vsBoss',value:.05})
 ]
};
export const talentTreeNodes=talentTrees.flatMap(branch=>nodes[branch].map(node=>({...node,branch,required:talentTierRequired[node.tier-1]})));
