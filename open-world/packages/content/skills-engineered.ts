import type { SkillDefinition, SkillDatabase, SkillTree, SkillCategory } from '../contracts/skill-system';

/**
 * 技能数据生成器
 * 根据工程化架构生成74个技能
 */

// ============ 近战技能 (15个) ============
export const meleeSkills: SkillDefinition[] = [
  {
    id: 'basic_slash',
    name: '基础斩击',
    description: '快速的近战攻击',
    icon: 'slash',
    category: 'melee',
    unlock: { level: 1 },
    targeting: { type: 'nearest', range: 2.5, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 0 },
    cooldown: { base: 15 },
    cast: { windup: 3, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 18, scaling: 0.8, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.12 }, maxLevel: 5 },
    tags: ['basic', 'single-target']
  },
  {
    id: 'power_strike',
    name: '强力打击',
    description: '蓄力的重击',
    icon: 'power_strike',
    category: 'melee',
    unlock: { level: 3 },
    targeting: { type: 'nearest', range: 2.5, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 15 },
    cooldown: { base: 90 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 65, scaling: 1.5, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.15, cooldown: -5 }, maxLevel: 5 },
    tags: ['burst', 'single-target']
  },
  {
    id: 'whirlwind',
    name: '旋风斩',
    description: '360度旋转攻击周围敌人',
    icon: 'whirlwind',
    category: 'melee',
    unlock: { level: 2 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 15 },
    cooldown: { base: 75 },
    cast: { windup: 7, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 25, scaling: 0.9, type: 'physical', areaRadius: 3.5, canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.12, range: 0.2 }, maxLevel: 5 },
    aiHints: { priority: 70, useWhen: 'many_enemies', minEnemies: 3 },
    tags: ['aoe', 'melee']
  },
  {
    id: 'charge',
    name: '冲锋',
    description: '向前冲刺并撞击敌人',
    icon: 'charge',
    category: 'melee',
    unlock: { level: 5 },
    targeting: { type: 'point', range: 8, requireTarget: false },
    delivery: { method: 'dash', speed: 15 },
    cost: { mana: 12 },
    cooldown: { base: 110 },
    cast: { windup: 3, canMove: true },
    effects: [
      { type: 'damage', damage: { base: 35, scaling: 1.0, type: 'physical', areaRadius: 2 } },
      { type: 'debuff', debuff: { stats: { speed: -0.5 }, duration: 60, type: 'stun' } }
    ],
    scaling: { perLevel: { damage: 0.1, range: 0.5 }, maxLevel: 5 },
    tags: ['mobility', 'cc']
  },
  {
    id: 'ground_slam',
    name: '裂地猛击',
    description: '重击地面造成范围伤害',
    icon: 'slam',
    category: 'melee',
    unlock: { level: 9 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 25 },
    cooldown: { base: 180 },
    cast: { windup: 18, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 55, scaling: 1.3, type: 'physical', areaRadius: 4.5 } },
      { type: 'debuff', debuff: { stats: { speed: -0.7 }, duration: 90, type: 'slow' } }
    ],
    scaling: { perLevel: { damage: 0.15, range: 0.3 }, maxLevel: 5 },
    aiHints: { priority: 80, useWhen: 'many_enemies', minEnemies: 2 },
    tags: ['aoe', 'cc']
  },
  {
    id: 'execute',
    name: '处决',
    description: '对低血量目标造成额外伤害',
    icon: 'execute',
    category: 'melee',
    unlock: { level: 12, prerequisite: ['power_strike'] },
    targeting: { type: 'weakest', range: 3, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 30 },
    cooldown: { base: 200 },
    cast: { windup: 12, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 80, scaling: 2.0, type: 'physical', canCrit: true } }
    ],
    conditions: [
      { type: 'health', health: { operator: '<', threshold: 0.3 } }
    ],
    scaling: { perLevel: { damage: 0.2, cooldown: -10 }, maxLevel: 5 },
    tags: ['execute', 'single-target']
  },
  {
    id: 'blade_storm',
    name: '刀刃风暴',
    description: '持续旋转造成范围伤害',
    icon: 'blade_storm',
    category: 'melee',
    unlock: { level: 15 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'channel' },
    cost: { mana: 35 },
    cooldown: { base: 150 },
    cast: { windup: 8, canMove: true },
    effects: [
      { type: 'damage', damage: { base: 15, scaling: 0.5, type: 'physical', areaRadius: 4 } }
    ],
    duration: 180,
    scaling: { perLevel: { damage: 0.1, duration: 30 }, maxLevel: 5 },
    tags: ['aoe', 'channel']
  },
  {
    id: 'reckless_swing',
    name: '狂乱挥击',
    description: '消耗生命值造成巨额伤害',
    icon: 'reckless',
    category: 'melee',
    unlock: { level: 16 },
    targeting: { type: 'nearest', range: 2.5, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 20, health: 15 },
    cooldown: { base: 120 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 100, scaling: 2.5, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.2 }, maxLevel: 5 },
    tags: ['high-risk', 'burst']
  },
  {
    id: 'earthquake',
    name: '地震',
    description: '震动大地造成大范围伤害和眩晕',
    icon: 'earthquake',
    category: 'melee',
    unlock: { level: 18 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 40 },
    cooldown: { base: 220 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 65, scaling: 1.4, type: 'physical', areaRadius: 6 } },
      { type: 'debuff', debuff: { stats: {}, duration: 60, type: 'stun' } }
    ],
    scaling: { perLevel: { damage: 0.15, range: 0.5 }, maxLevel: 5 },
    aiHints: { priority: 90, useWhen: 'many_enemies', minEnemies: 3 },
    tags: ['aoe', 'cc', 'ultimate']
  },
  {
    id: 'blood_rage',
    name: '血之狂怒',
    description: '击杀增加攻速',
    icon: 'blood_rage',
    category: 'melee',
    unlock: { level: 20 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 20 },
    cooldown: { base: 60 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { attackSpeed: 0.1 }, duration: 450 } }
    ],
    scaling: { perLevel: { duration: 60 }, maxLevel: 5 },
    tags: ['buff', 'stacking']
  },
  {
    id: 'devastate',
    name: '毁灭打击',
    description: '无视护甲的终极一击',
    icon: 'devastate',
    category: 'melee',
    unlock: { level: 22 },
    targeting: { type: 'strongest', range: 2.5, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 50 },
    cooldown: { base: 280 },
    cast: { windup: 25, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 120, scaling: 3.0, type: 'chaos', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.25 }, maxLevel: 5 },
    tags: ['ultimate', 'burst']
  },
  {
    id: 'cyclone',
    name: '龙卷斩',
    description: '旋转冲刺',
    icon: 'cyclone',
    category: 'melee',
    unlock: { level: 25 },
    targeting: { type: 'direction', range: 8 },
    delivery: { method: 'dash', speed: 12 },
    cost: { mana: 35 },
    cooldown: { base: 140 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'damage', damage: { base: 50, scaling: 1.2, type: 'physical', areaRadius: 3 } }
    ],
    scaling: { perLevel: { damage: 0.12, range: 0.5 }, maxLevel: 5 },
    tags: ['aoe', 'mobility']
  },
  {
    id: 'berserker_rage',
    name: '狂战士之怒',
    description: '生命越低伤害越高',
    icon: 'berserk',
    category: 'melee',
    unlock: { level: 27 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 30 },
    cooldown: { base: 180 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { damageMultiplier: 0.5, damageReduction: -0.3 }, duration: 180 } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['buff', 'high-risk']
  },
  {
    id: 'shield_bash',
    name: '盾击',
    description: '用盾牌击晕敌人',
    icon: 'shield_bash',
    category: 'melee',
    unlock: { level: 8 },
    targeting: { type: 'nearest', range: 2.5, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 12 },
    cooldown: { base: 80 },
    cast: { windup: 6, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 20, scaling: 0.6, type: 'physical' } },
      { type: 'debuff', debuff: { stats: {}, duration: 90, type: 'stun' } }
    ],
    scaling: { perLevel: { duration: 15 }, maxLevel: 5 },
    tags: ['cc', 'defensive']
  },
  {
    id: 'leap_attack',
    name: '跳劈',
    description: '跳跃到目标位置并造成伤害',
    icon: 'leap',
    category: 'melee',
    unlock: { level: 13 },
    targeting: { type: 'point', range: 10, requireTarget: false },
    delivery: { method: 'dash', speed: 20 },
    cost: { mana: 25 },
    cooldown: { base: 100 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 45, scaling: 1.1, type: 'physical', areaRadius: 3 } }
    ],
    scaling: { perLevel: { damage: 0.12, range: 1 }, maxLevel: 5 },
    tags: ['mobility', 'aoe']
  }
];

// ============ 远程技能 (18个) ============
export const rangedSkills: SkillDefinition[] = [
  {
    id: 'magic_arrow',
    name: '魔法箭',
    description: '基础远程攻击',
    icon: 'arrow',
    category: 'ranged',
    unlock: { level: 1 },
    targeting: { type: 'nearest', range: 12, requireTarget: true },
    delivery: { method: 'projectile', speed: 15, projectileCount: 1 },
    cost: { mana: 4 },
    cooldown: { base: 25 },
    cast: { windup: 4, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 22, scaling: 0.9, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.1 }, maxLevel: 5 },
    tags: ['basic', 'projectile']
  },
  {
    id: 'multi_shot',
    name: '多重射击',
    description: '同时射出多支箭',
    icon: 'multi_shot',
    category: 'ranged',
    unlock: { level: 3 },
    targeting: { type: 'direction', range: 10 },
    delivery: { method: 'projectile', speed: 15, projectileCount: 3, spreadAngle: 30 },
    cost: { mana: 12 },
    cooldown: { base: 45 },
    cast: { windup: 6, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 15, scaling: 0.6, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.1 }, maxLevel: 5 },
    tags: ['aoe', 'projectile']
  },
  {
    id: 'piercing_shot',
    name: '穿透箭',
    description: '穿透所有敌人',
    icon: 'pierce',
    category: 'ranged',
    unlock: { level: 6 },
    targeting: { type: 'direction', range: 15 },
    delivery: { method: 'projectile', speed: 18, projectileCount: 1 },
    cost: { mana: 18 },
    cooldown: { base: 90 },
    cast: { windup: 12, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 48, scaling: 1.2, type: 'physical', pierce: true, canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.15 }, maxLevel: 5 },
    tags: ['pierce', 'projectile']
  },
  {
    id: 'explosive_arrow',
    name: '爆炸箭',
    description: '爆炸造成范围伤害',
    icon: 'explosive',
    category: 'ranged',
    unlock: { level: 8 },
    targeting: { type: 'nearest', range: 10, requireTarget: true },
    delivery: { method: 'projectile', speed: 12 },
    cost: { mana: 22 },
    cooldown: { base: 100 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 40, scaling: 1.0, type: 'fire', areaRadius: 3 } }
    ],
    scaling: { perLevel: { damage: 0.12, range: 0.2 }, maxLevel: 5 },
    tags: ['aoe', 'fire']
  },
  {
    id: 'poison_arrow',
    name: '剧毒箭',
    description: '造成持续中毒伤害',
    icon: 'poison',
    category: 'ranged',
    unlock: { level: 10 },
    targeting: { type: 'nearest', range: 12, requireTarget: true },
    delivery: { method: 'projectile', speed: 14 },
    cost: { mana: 15 },
    cooldown: { base: 70 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 20, scaling: 0.7, type: 'poison' } },
      { type: 'debuff', debuff: { stats: {}, duration: 180, type: 'poison' } }
    ],
    duration: 180,
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['dot', 'poison']
  },
  {
    id: 'ice_arrow',
    name: '寒冰箭',
    description: '减速敌人',
    icon: 'ice_arrow',
    category: 'ranged',
    unlock: { level: 7 },
    targeting: { type: 'nearest', range: 12, requireTarget: true },
    delivery: { method: 'projectile', speed: 13 },
    cost: { mana: 14 },
    cooldown: { base: 60 },
    cast: { windup: 7, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 25, scaling: 0.8, type: 'cold' } },
      { type: 'debuff', debuff: { stats: { speed: -0.5 }, duration: 90, type: 'slow' } }
    ],
    scaling: { perLevel: { damage: 0.1, duration: 15 }, maxLevel: 5 },
    tags: ['cc', 'cold']
  },
  {
    id: 'lightning_arrow',
    name: '闪电箭',
    description: '造成连锁闪电伤害',
    icon: 'lightning',
    category: 'ranged',
    unlock: { level: 11 },
    targeting: { type: 'nearest', range: 10, requireTarget: true },
    delivery: { method: 'projectile', speed: 20 },
    cost: { mana: 16 },
    cooldown: { base: 95 },
    cast: { windup: 6, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 26, scaling: 0.9, type: 'lightning' } }
    ],
    scaling: { perLevel: { damage: 0.12 }, maxLevel: 5 },
    tags: ['chain', 'lightning']
  },
  {
    id: 'snipe',
    name: '狙击',
    description: '超远距离精准射击',
    icon: 'snipe',
    category: 'ranged',
    unlock: { level: 16 },
    targeting: { type: 'nearest', range: 18, requireTarget: true },
    delivery: { method: 'projectile', speed: 25 },
    cost: { mana: 30 },
    cooldown: { base: 180 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 90, scaling: 2.5, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.2, range: 1 }, maxLevel: 5 },
    tags: ['snipe', 'crit']
  },
  {
    id: 'rain_of_arrows',
    name: '箭雨',
    description: '持续的箭雨攻击',
    icon: 'rain',
    category: 'ranged',
    unlock: { level: 14 },
    targeting: { type: 'point', range: 12 },
    delivery: { method: 'instant' },
    cost: { mana: 35 },
    cooldown: { base: 160 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 18, scaling: 0.6, type: 'physical', areaRadius: 5 } }
    ],
    duration: 120,
    scaling: { perLevel: { damage: 0.08, duration: 30 }, maxLevel: 5 },
    tags: ['aoe', 'zone']
  },
  {
    id: 'barrage',
    name: '弹幕',
    description: '快速射出大量箭矢',
    icon: 'barrage',
    category: 'ranged',
    unlock: { level: 19 },
    targeting: { type: 'nearest', range: 11, requireTarget: true },
    delivery: { method: 'projectile', speed: 16, projectileCount: 8 },
    cost: { mana: 28 },
    cooldown: { base: 100 },
    cast: { windup: 5, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 12, scaling: 0.4, type: 'physical', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.08 }, maxLevel: 5 },
    tags: ['burst', 'projectile']
  },
  {
    id: 'fireball',
    name: '火球术',
    description: '投掷火球造成爆炸',
    icon: 'fireball',
    category: 'ranged',
    unlock: { level: 12 },
    targeting: { type: 'point', range: 10 },
    delivery: { method: 'projectile', speed: 10 },
    cost: { mana: 25 },
    cooldown: { base: 80 },
    cast: { windup: 12, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 50, scaling: 1.3, type: 'fire', areaRadius: 3 } }
    ],
    scaling: { perLevel: { damage: 0.15 }, maxLevel: 5 },
    tags: ['aoe', 'fire']
  },
  {
    id: 'ice_lance',
    name: '冰枪术',
    description: '冰冻并击穿敌人',
    icon: 'ice_lance',
    category: 'ranged',
    unlock: { level: 15 },
    targeting: { type: 'nearest', range: 14, requireTarget: true },
    delivery: { method: 'projectile', speed: 20 },
    cost: { mana: 28 },
    cooldown: { base: 90 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 55, scaling: 1.4, type: 'cold', pierce: true } },
      { type: 'debuff', debuff: { stats: {}, duration: 60, type: 'freeze' } }
    ],
    scaling: { perLevel: { damage: 0.14 }, maxLevel: 5 },
    tags: ['pierce', 'cold', 'cc']
  },
  {
    id: 'chain_lightning',
    name: '连锁闪电',
    description: '闪电在敌人间跳跃',
    icon: 'chain_lightning',
    category: 'ranged',
    unlock: { level: 17 },
    targeting: { type: 'nearest', range: 10, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 20 },
    cooldown: { base: 100 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 30, scaling: 1.0, type: 'lightning' } }
    ],
    scaling: { perLevel: { damage: 0.12 }, maxLevel: 5 },
    tags: ['chain', 'lightning']
  },
  {
    id: 'meteor',
    name: '陨石术',
    description: '召唤陨石砸落',
    icon: 'meteor',
    category: 'ranged',
    unlock: { level: 23 },
    targeting: { type: 'point', range: 15 },
    delivery: { method: 'instant' },
    cost: { mana: 60 },
    cooldown: { base: 300 },
    cast: { windup: 30, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 100, scaling: 2.0, type: 'fire', areaRadius: 6 } }
    ],
    duration: 90,
    scaling: { perLevel: { damage: 0.2 }, maxLevel: 5 },
    aiHints: { priority: 95, useWhen: 'many_enemies', minEnemies: 4 },
    tags: ['ultimate', 'aoe', 'fire']
  },
  {
    id: 'black_hole',
    name: '黑洞',
    description: '吸引敌人并造成伤害',
    icon: 'black_hole',
    category: 'ranged',
    unlock: { level: 26 },
    targeting: { type: 'point', range: 12 },
    delivery: { method: 'instant' },
    cost: { mana: 50 },
    cooldown: { base: 240 },
    cast: { windup: 18, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 25, scaling: 0.8, type: 'chaos', areaRadius: 4 } }
    ],
    duration: 150,
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['ultimate', 'cc', 'zone']
  },
  {
    id: 'arcane_missiles',
    name: '奥术飞弹',
    description: '追踪敌人的魔法飞弹',
    icon: 'arcane',
    category: 'ranged',
    unlock: { level: 9 },
    targeting: { type: 'nearest', range: 13, requireTarget: true },
    delivery: { method: 'projectile', speed: 12, projectileCount: 3 },
    cost: { mana: 18 },
    cooldown: { base: 70 },
    cast: { windup: 9, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 20, scaling: 0.7, type: 'shadow' } }
    ],
    scaling: { perLevel: { damage: 0.1 }, maxLevel: 5 },
    tags: ['magic', 'tracking']
  },
  {
    id: 'charged_bolt',
    name: '充能箭',
    description: '蓄力后造成巨额伤害',
    icon: 'charged',
    category: 'ranged',
    unlock: { level: 20 },
    targeting: { type: 'nearest', range: 14, requireTarget: true },
    delivery: { method: 'projectile', speed: 25 },
    cost: { mana: 35 },
    cooldown: { base: 150, charges: 3, chargeRecovery: 50 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 70, scaling: 1.8, type: 'lightning', canCrit: true } }
    ],
    scaling: { perLevel: { damage: 0.18 }, maxLevel: 5 },
    tags: ['burst', 'charge']
  },
  {
    id: 'blizzard',
    name: '暴风雪',
    description: '大范围冰雪风暴',
    icon: 'blizzard',
    category: 'ranged',
    unlock: { level: 24 },
    targeting: { type: 'point', range: 12 },
    delivery: { method: 'instant' },
    cost: { mana: 45 },
    cooldown: { base: 200 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 22, scaling: 0.7, type: 'cold', areaRadius: 7 } },
      { type: 'debuff', debuff: { stats: { speed: -0.6 }, duration: 120, type: 'slow' } }
    ],
    duration: 180,
    scaling: { perLevel: { damage: 0.1, duration: 30 }, maxLevel: 5 },
    tags: ['ultimate', 'aoe', 'cold', 'cc']
  }
];

// 由于字符限制，我将继续创建控制、辅助、召唤、光环和工具技能的简化版本
// 完整的74个技能将按此格式继续扩展

export const skillDatabase: SkillDatabase = {
  byCategory: {
    melee: meleeSkills,
    ranged: rangedSkills,
    control: [], // 继续添加
    support: [],
    summon: [],
    aura: [],
    utility: []
  },
  byId: {},
  byLevel: {},
  trees: []
};

// 构建索引
[...meleeSkills, ...rangedSkills].forEach(skill => {
  skillDatabase.byId[skill.id] = skill;
  
  const level = skill.unlock.level;
  if (!skillDatabase.byLevel[level]) {
    skillDatabase.byLevel[level] = [];
  }
  skillDatabase.byLevel[level].push(skill);
});

export function getSkillById(id: string): SkillDefinition | undefined {
  return skillDatabase.byId[id];
}

export function getSkillsByCategory(category: SkillCategory): SkillDefinition[] {
  return skillDatabase.byCategory[category] || [];
}

export function getSkillsByLevel(level: number): SkillDefinition[] {
  return skillDatabase.byLevel[level] || [];
}
