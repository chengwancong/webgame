import {meleeSkills,rangedSkills} from './skills-engineered';
// 接续 skills-engineered.ts，添加控制、辅助、召唤、光环和工具类技能

import type { SkillDefinition } from '../contracts/skill-system';

// ============ 控制技能 (12个) ============
export const controlSkills: SkillDefinition[] = [
  {
    id: 'frost_nova',
    name: '冰霜新星',
    description: '冰冻周围所有敌人',
    icon: 'frost_nova',
    category: 'control',
    unlock: { level: 3 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 18 },
    cooldown: { base: 150 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 32, scaling: 0.8, type: 'cold', areaRadius: 5 } },
      { type: 'debuff', debuff: { stats: {}, duration: 90, type: 'freeze' } }
    ],
    scaling: { perLevel: { damage: 0.12, duration: 15 }, maxLevel: 5 },
    aiHints: { priority: 75, useWhen: 'many_enemies', minEnemies: 2 },
    tags: ['aoe', 'cc', 'cold']
  },
  {
    id: 'frost_field',
    name: '寒霜领域',
    description: '持续减速区域',
    icon: 'frost_field',
    category: 'control',
    unlock: { level: 5 },
    targeting: { type: 'point', range: 9 },
    delivery: { method: 'instant' },
    cost: { mana: 20 },
    cooldown: { base: 180 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 8, scaling: 0.3, type: 'cold', areaRadius: 3 } },
      { type: 'debuff', debuff: { stats: { speed: -0.5 }, duration: 120, type: 'slow' } }
    ],
    duration: 120,
    scaling: { perLevel: { duration: 30, range: 0.3 }, maxLevel: 5 },
    tags: ['zone', 'cc', 'cold']
  },
  {
    id: 'time_warp',
    name: '时间扭曲',
    description: '大幅减缓敌人行动',
    icon: 'time_warp',
    category: 'control',
    unlock: { level: 10 },
    targeting: { type: 'point', range: 10 },
    delivery: { method: 'instant' },
    cost: { mana: 30 },
    cooldown: { base: 200 },
    cast: { windup: 12, canMove: false },
    effects: [
      { type: 'debuff', debuff: { stats: { speed: -0.7, attackSpeed: -0.7 }, duration: 150, type: 'slow' } }
    ],
    duration: 150,
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['zone', 'cc', 'ultimate']
  },
  {
    id: 'gravity_well',
    name: '重力陷阱',
    description: '拉拽并减速敌人',
    icon: 'gravity',
    category: 'control',
    unlock: { level: 13 },
    targeting: { type: 'point', range: 9 },
    delivery: { method: 'instant' },
    cost: { mana: 28 },
    cooldown: { base: 160 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 15, scaling: 0.5, type: 'physical', areaRadius: 3.5 } },
      { type: 'debuff', debuff: { stats: { speed: -0.8 }, duration: 120, type: 'root' } }
    ],
    duration: 120,
    scaling: { perLevel: { damage: 0.08, duration: 20 }, maxLevel: 5 },
    tags: ['zone', 'cc']
  },
  {
    id: 'entangle',
    name: '藤蔓缠绕',
    description: '束缚敌人无法移动',
    icon: 'entangle',
    category: 'control',
    unlock: { level: 15 },
    targeting: { type: 'point', range: 8 },
    delivery: { method: 'instant' },
    cost: { mana: 26 },
    cooldown: { base: 140 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 20, scaling: 0.6, type: 'physical', areaRadius: 4 } },
      { type: 'debuff', debuff: { stats: { speed: -1.0 }, duration: 90, type: 'root' } }
    ],
    scaling: { perLevel: { duration: 15 }, maxLevel: 5 },
    tags: ['aoe', 'cc']
  },
  {
    id: 'fear',
    name: '恐惧术',
    description: '使敌人恐惧逃跑',
    icon: 'fear',
    category: 'control',
    unlock: { level: 17 },
    targeting: { type: 'point', range: 10 },
    delivery: { method: 'instant' },
    cost: { mana: 32 },
    cooldown: { base: 180 },
    cast: { windup: 12, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 25, scaling: 0.7, type: 'shadow', areaRadius: 5 } },
      { type: 'debuff', debuff: { stats: { damageMultiplier: -0.2 }, duration: 120, type: 'fear' } }
    ],
    scaling: { perLevel: { duration: 20 }, maxLevel: 5 },
    tags: ['aoe', 'cc']
  },
  {
    id: 'petrify',
    name: '石化',
    description: '石化敌人，免疫伤害但无法行动',
    icon: 'petrify',
    category: 'control',
    unlock: { level: 21 },
    targeting: { type: 'nearest', range: 8, requireTarget: true },
    delivery: { method: 'instant' },
    cost: { mana: 40 },
    cooldown: { base: 240 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'debuff', debuff: { stats: { speed: -1.0, damageReduction: 1.0 }, duration: 90, type: 'stun' } }
    ],
    scaling: { perLevel: { duration: 15 }, maxLevel: 5 },
    tags: ['single-target', 'cc']
  },
  {
    id: 'silence',
    name: '沉默',
    description: '禁止敌人释放技能',
    icon: 'silence',
    category: 'control',
    unlock: { level: 18 },
    targeting: { type: 'point', range: 9 },
    delivery: { method: 'instant' },
    cost: { mana: 30 },
    cooldown: { base: 160 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 10, scaling: 0.4, type: 'shadow', areaRadius: 5 } },
      { type: 'debuff', debuff: { stats: {}, duration: 150, type: 'silence' } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['aoe', 'cc']
  },
  {
    id: 'ice_wall',
    name: '冰墙',
    description: '创造阻挡的冰墙',
    icon: 'ice_wall',
    category: 'control',
    unlock: { level: 12 },
    targeting: { type: 'point', range: 8 },
    delivery: { method: 'instant' },
    cost: { mana: 25 },
    cooldown: { base: 180 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 0, scaling: 0, type: 'cold', areaRadius: 2 } }
    ],
    duration: 180,
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['zone', 'terrain']
  },
  {
    id: 'stun_trap',
    name: '眩晕陷阱',
    description: '放置陷阱，触发后眩晕',
    icon: 'trap',
    category: 'control',
    unlock: { level: 11 },
    targeting: { type: 'point', range: 6 },
    delivery: { method: 'instant' },
    cost: { mana: 20 },
    cooldown: { base: 120 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'damage', damage: { base: 30, scaling: 0.8, type: 'physical', areaRadius: 2.5 } },
      { type: 'debuff', debuff: { stats: {}, duration: 60, type: 'stun' } }
    ],
    scaling: { perLevel: { damage: 0.1, duration: 10 }, maxLevel: 5 },
    tags: ['trap', 'cc']
  },
  {
    id: 'mass_confusion',
    name: '群体混乱',
    description: '混乱敌人攻击队友',
    icon: 'confusion',
    category: 'control',
    unlock: { level: 22 },
    targeting: { type: 'point', range: 10 },
    delivery: { method: 'instant' },
    cost: { mana: 45 },
    cooldown: { base: 240 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'debuff', debuff: { stats: {}, duration: 150, type: 'fear' } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['aoe', 'cc', 'ultimate']
  },
  {
    id: 'temporal_prison',
    name: '时间牢笼',
    description: '时间停止，完全定身',
    icon: 'prison',
    category: 'control',
    unlock: { level: 28 },
    targeting: { type: 'point', range: 10 },
    delivery: { method: 'instant' },
    cost: { mana: 60 },
    cooldown: { base: 360 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'debuff', debuff: { stats: { speed: -1.0, attackSpeed: -1.0 }, duration: 120, type: 'stun' } }
    ],
    scaling: { perLevel: { duration: 20 }, maxLevel: 5 },
    tags: ['ultimate', 'cc']
  }
];

// ============ 辅助技能 (10个) ============
export const supportSkills: SkillDefinition[] = [
  {
    id: 'shield',
    name: '护盾术',
    description: '吸收伤害的护盾',
    icon: 'shield',
    category: 'support',
    unlock: { level: 1 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 15 },
    cooldown: { base: 240 },
    cast: { windup: 1, canMove: true },
    effects: [
      { type: 'shield', shield: { amount: 45, duration: 150, absorbType: 'all' } }
    ],
    scaling: { perLevel: { damage: 10 }, maxLevel: 5 },
    tags: ['defensive', 'shield']
  },
  {
    id: 'heal',
    name: '治疗术',
    description: '恢复生命值',
    icon: 'heal',
    category: 'support',
    unlock: { level: 4 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 25 },
    cooldown: { base: 270 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'heal', heal: { base: 35, scaling: 0 } }
    ],
    scaling: { perLevel: { damage: 8 }, maxLevel: 5 },
    tags: ['healing']
  },
  {
    id: 'haste',
    name: '加速术',
    description: '提升移动和攻击速度',
    icon: 'haste',
    category: 'support',
    unlock: { level: 9 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 20 },
    cooldown: { base: 180 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { speed: 0.3, attackSpeed: 0.3 }, duration: 180 } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['buff', 'mobility']
  },
  {
    id: 'invulnerability',
    name: '无敌',
    description: '短暂免疫所有伤害',
    icon: 'invul',
    category: 'support',
    unlock: { level: 12 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 40 },
    cooldown: { base: 360 },
    cast: { windup: 1, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { damageReduction: 1.0 }, duration: 60 } }
    ],
    scaling: { perLevel: { duration: 10 }, maxLevel: 5 },
    tags: ['defensive', 'ultimate']
  },
  {
    id: 'berserk',
    name: '狂暴',
    description: '提升攻击降低防御',
    icon: 'berserk',
    category: 'support',
    unlock: { level: 14 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 30 },
    cooldown: { base: 240 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { attack: 0.5, armor: -0.3 }, duration: 180 } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['buff', 'offensive']
  },
  {
    id: 'fortify',
    name: '铁壁',
    description: '大幅提升护甲',
    icon: 'fortify',
    category: 'support',
    unlock: { level: 18 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 25 },
    cooldown: { base: 200 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { armor: 0.6 }, duration: 150 } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['buff', 'defensive']
  },
  {
    id: 'divine_shield',
    name: '神圣护盾',
    description: '巨额护盾',
    icon: 'divine_shield',
    category: 'support',
    unlock: { level: 22 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 50 },
    cooldown: { base: 360 },
    cast: { windup: 1, canMove: true },
    effects: [
      { type: 'shield', shield: { amount: 150, duration: 180, absorbType: 'all' } }
    ],
    scaling: { perLevel: { damage: 30 }, maxLevel: 5 },
    tags: ['shield', 'defensive', 'ultimate']
  },
  {
    id: 'resurrection',
    name: '重生',
    description: '死亡时自动复活',
    icon: 'resurrection',
    category: 'support',
    unlock: { level: 25 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 60 },
    cooldown: { base: 600 },
    cast: { windup: 1, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: {}, duration: 300 } }
    ],
    scaling: { perLevel: { duration: 60 }, maxLevel: 5 },
    tags: ['ultimate', 'revive']
  },
  {
    id: 'mana_shield',
    name: '能量护盾',
    description: '伤害优先消耗能量',
    icon: 'mana_shield',
    category: 'support',
    unlock: { level: 21 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 30 },
    cooldown: { base: 240 },
    cast: { windup: 5, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: {}, duration: 180 } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['defensive', 'mana']
  },
  {
    id: 'blood_pact',
    name: '血之契约',
    description: '消耗生命提升伤害',
    icon: 'blood_pact',
    category: 'support',
    unlock: { level: 19 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 0, health: 30 },
    cooldown: { base: 300 },
    cast: { windup: 10, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { damageMultiplier: 0.8 }, duration: 240 } }
    ],
    scaling: { perLevel: { duration: 40 }, maxLevel: 5 },
    tags: ['buff', 'high-risk']
  }
];

// ============ 召唤技能 (10个) ============
export const summonSkills: SkillDefinition[] = [
  {
    id: 'wolf_companion',
    name: '狼灵召唤',
    description: '召唤狼灵战斗',
    icon: 'wolf',
    category: 'summon',
    unlock: { level: 5 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'summon' },
    cost: { mana: 30 },
    cooldown: { base: 300 },
    cast: { windup: 15, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'wolf', count: 1, duration: 300, inheritStats: 0.5 } }
    ],
    duration: 300,
    scaling: { perLevel: { duration: 60 }, maxLevel: 5 },
    tags: ['summon', 'pet']
  },
  {
    id: 'skeleton_warrior',
    name: '骷髅战士',
    description: '召唤骷髅战士',
    icon: 'skeleton',
    category: 'summon',
    unlock: { level: 8 },
    targeting: { type: 'point', range: 5 },
    delivery: { method: 'summon' },
    cost: { mana: 25 },
    cooldown: { base: 240 },
    cast: { windup: 12, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'skeleton', count: 2, duration: 240, inheritStats: 0.4 } }
    ],
    duration: 240,
    scaling: { perLevel: { duration: 40 }, maxLevel: 5 },
    tags: ['summon', 'undead']
  },
  {
    id: 'ice_golem',
    name: '冰霜傀儡',
    description: '召唤坚固的冰霜傀儡',
    icon: 'golem',
    category: 'summon',
    unlock: { level: 11 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'summon' },
    cost: { mana: 40 },
    cooldown: { base: 360 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'ice_golem', count: 1, duration: 360, inheritStats: 0.6 } }
    ],
    duration: 360,
    scaling: { perLevel: { duration: 60 }, maxLevel: 5 },
    tags: ['summon', 'tank']
  },
  {
    id: 'fire_elemental',
    name: '火焰元素',
    description: '召唤火焰元素',
    icon: 'fire_elem',
    category: 'summon',
    unlock: { level: 14 },
    targeting: { type: 'point', range: 6 },
    delivery: { method: 'summon' },
    cost: { mana: 45 },
    cooldown: { base: 300 },
    cast: { windup: 18, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'fire_elemental', count: 1, duration: 300, inheritStats: 0.7 } }
    ],
    duration: 300,
    scaling: { perLevel: { duration: 50 }, maxLevel: 5 },
    tags: ['summon', 'elemental']
  },
  {
    id: 'lightning_totem',
    name: '雷霆图腾',
    description: '放置攻击图腾',
    icon: 'totem',
    category: 'summon',
    unlock: { level: 17 },
    targeting: { type: 'point', range: 8 },
    delivery: { method: 'summon' },
    cost: { mana: 30 },
    cooldown: { base: 180 },
    cast: { windup: 10, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'totem', count: 1, duration: 240, inheritStats: 0.3 } }
    ],
    duration: 240,
    scaling: { perLevel: { duration: 40 }, maxLevel: 5 },
    tags: ['summon', 'stationary']
  },
  {
    id: 'shadow_clone',
    name: '影分身',
    description: '创造自己的分身',
    icon: 'clone',
    category: 'summon',
    unlock: { level: 19 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'summon' },
    cost: { mana: 35 },
    cooldown: { base: 240 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'clone', count: 1, duration: 180, inheritStats: 0.5 } }
    ],
    duration: 180,
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['summon', 'clone']
  },
  {
    id: 'holy_guardian',
    name: '圣光守卫',
    description: '召唤治疗型守卫',
    icon: 'guardian',
    category: 'summon',
    unlock: { level: 21 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'summon' },
    cost: { mana: 50 },
    cooldown: { base: 360 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'guardian', count: 1, duration: 360, inheritStats: 0.4 } }
    ],
    duration: 360,
    scaling: { perLevel: { duration: 60 }, maxLevel: 5 },
    tags: ['summon', 'support']
  },
  {
    id: 'demon_lord',
    name: '恶魔领主',
    description: '召唤强大的恶魔',
    icon: 'demon',
    category: 'summon',
    unlock: { level: 24 },
    targeting: { type: 'point', range: 6 },
    delivery: { method: 'summon' },
    cost: { mana: 70 },
    cooldown: { base: 480 },
    cast: { windup: 30, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'demon', count: 1, duration: 300, inheritStats: 0.8 } }
    ],
    duration: 300,
    scaling: { perLevel: { duration: 50 }, maxLevel: 5 },
    tags: ['summon', 'ultimate']
  },
  {
    id: 'army_of_dead',
    name: '亡灵军团',
    description: '召唤大量骷髅',
    icon: 'army',
    category: 'summon',
    unlock: { level: 27 },
    targeting: { type: 'point', range: 8 },
    delivery: { method: 'summon' },
    cost: { mana: 80 },
    cooldown: { base: 600 },
    cast: { windup: 40, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'skeleton', count: 10, duration: 240, inheritStats: 0.3 } }
    ],
    duration: 240,
    scaling: { perLevel: {}, maxLevel: 5 },
    tags: ['summon', 'ultimate', 'swarm']
  },
  {
    id: 'phoenix',
    name: '不死鸟',
    description: '召唤凤凰，死亡后重生',
    icon: 'phoenix',
    category: 'summon',
    unlock: { level: 29 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'summon' },
    cost: { mana: 60 },
    cooldown: { base: 420 },
    cast: { windup: 25, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'phoenix', count: 1, duration: 360, inheritStats: 0.6 } }
    ],
    duration: 360,
    scaling: { perLevel: { duration: 60 }, maxLevel: 5 },
    tags: ['summon', 'ultimate', 'revive']
  }
];

// ============ 光环技能 (9个) ============
export const auraSkills: SkillDefinition[] = [
  {
    id: 'regeneration_aura',
    name: '回复光环',
    description: '持续回复生命',
    icon: 'regen_aura',
    category: 'aura',
    unlock: { level: 7 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 20 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'heal', heal: { base: 3, scaling: 0, overTime: true } }
    ],
    duration: 0,
    scaling: { perLevel: { damage: 1 }, maxLevel: 5 },
    tags: ['aura', 'healing', 'passive']
  },
  {
    id: 'power_aura',
    name: '力量光环',
    description: '提升攻击力',
    icon: 'power_aura',
    category: 'aura',
    unlock: { level: 10 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 20 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { attack: 0.2 }, duration: 0 } }
    ],
    duration: 0,
    scaling: { perLevel: {}, maxLevel: 5 },
    tags: ['aura', 'buff', 'passive']
  },
  {
    id: 'armor_aura',
    name: '铠甲光环',
    description: '提升护甲',
    icon: 'armor_aura',
    category: 'aura',
    unlock: { level: 11 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 20 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { armor: 0.3 }, duration: 0 } }
    ],
    duration: 0,
    scaling: { perLevel: {}, maxLevel: 5 },
    tags: ['aura', 'buff', 'passive']
  },
  {
    id: 'speed_aura',
    name: '迅捷光环',
    description: '提升移动速度',
    icon: 'speed_aura',
    category: 'aura',
    unlock: { level: 13 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 15 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { speed: 0.25 }, duration: 0 } }
    ],
    duration: 0,
    scaling: { perLevel: {}, maxLevel: 5 },
    tags: ['aura', 'buff', 'passive']
  },
  {
    id: 'thorns_aura',
    name: '荆棘光环',
    description: '反弹伤害',
    icon: 'thorns',
    category: 'aura',
    unlock: { level: 15 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 25 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'damage', damage: { base: 10, scaling: 0.3, type: 'physical', areaRadius: 8 } }
    ],
    duration: 0,
    scaling: { perLevel: { damage: 2 }, maxLevel: 5 },
    tags: ['aura', 'retaliation', 'passive']
  },
  {
    id: 'holy_fire_aura',
    name: '圣火光环',
    description: '火焰伤害光环',
    icon: 'holy_fire',
    category: 'aura',
    unlock: { level: 18 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 30 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'damage', damage: { base: 12, scaling: 0.4, type: 'fire', areaRadius: 9 } }
    ],
    duration: 0,
    scaling: { perLevel: { damage: 2 }, maxLevel: 5 },
    tags: ['aura', 'fire', 'passive']
  },
  {
    id: 'frost_aura',
    name: '冰霜光环',
    description: '减速光环',
    icon: 'frost_aura',
    category: 'aura',
    unlock: { level: 20 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 25 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'damage', damage: { base: 8, scaling: 0.3, type: 'cold', areaRadius: 9 } },
      { type: 'debuff', debuff: { stats: { speed: -0.4 }, duration: 30, type: 'slow' } }
    ],
    duration: 0,
    scaling: { perLevel: { damage: 1 }, maxLevel: 5 },
    tags: ['aura', 'cold', 'cc', 'passive']
  },
  {
    id: 'fanaticism',
    name: '狂热光环',
    description: '攻速和伤害光环',
    icon: 'fanaticism',
    category: 'aura',
    unlock: { level: 26 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 40 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { attackSpeed: 0.35, damageMultiplier: 0.2 }, duration: 0 } }
    ],
    duration: 0,
    scaling: { perLevel: {}, maxLevel: 5 },
    tags: ['aura', 'ultimate', 'passive']
  },
  {
    id: 'clarity_aura',
    name: '清明光环',
    description: '能量回复光环',
    icon: 'clarity',
    category: 'aura',
    unlock: { level: 16 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'aura' },
    cost: { mana: 15 },
    cooldown: { base: 0 },
    cast: { windup: 0, canMove: true },
    effects: [
      { type: 'resource', resource: { type: 'mana', amount: 5 } }
    ],
    duration: 0,
    scaling: { perLevel: { damage: 1 }, maxLevel: 5 },
    tags: ['aura', 'mana', 'passive']
  }
];

// ============ 工具技能 (5个) ============
export const utilitySkills: SkillDefinition[] = [
  {
    id: 'teleport',
    name: '传送',
    description: '瞬移到指定位置',
    icon: 'teleport',
    category: 'utility',
    unlock: { level: 12 },
    targeting: { type: 'point', range: 10 },
    delivery: { method: 'dash', speed: 999 },
    cost: { mana: 20 },
    cooldown: { base: 120 },
    cast: { windup: 1, canMove: false },
    effects: [
      { type: 'teleport', teleport: { range: 10, blink: true } }
    ],
    scaling: { perLevel: { range: 1, cooldown: -10 }, maxLevel: 5 },
    tags: ['mobility', 'escape']
  },
  {
    id: 'smoke_bomb',
    name: '烟雾弹',
    description: '降低敌人命中率',
    icon: 'smoke',
    category: 'utility',
    unlock: { level: 16 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 25 },
    cooldown: { base: 180 },
    cast: { windup: 3, canMove: true },
    effects: [
      { type: 'debuff', debuff: { stats: { attack: -0.8 }, duration: 120, type: 'blind' } }
    ],
    duration: 120,
    scaling: { perLevel: { duration: 20 }, maxLevel: 5 },
    tags: ['utility', 'debuff']
  },
  {
    id: 'mirror_image',
    name: '镜像',
    description: '创造虚假幻象',
    icon: 'mirror',
    category: 'utility',
    unlock: { level: 24 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'summon' },
    cost: { mana: 35 },
    cooldown: { base: 200 },
    cast: { windup: 8, canMove: false },
    effects: [
      { type: 'summon', summon: { unitType: 'illusion', count: 3, duration: 120, inheritStats: 0 } }
    ],
    duration: 120,
    scaling: { perLevel: { duration: 20 }, maxLevel: 5 },
    tags: ['utility', 'illusion']
  },
  {
    id: 'arcane_power',
    name: '奥术强化',
    description: '技能伤害翻倍但能量消耗翻倍',
    icon: 'arcane_power',
    category: 'utility',
    unlock: { level: 26 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 50 },
    cooldown: { base: 300 },
    cast: { windup: 10, canMove: true },
    effects: [
      { type: 'buff', buff: { stats: { damageMultiplier: 1.0 }, duration: 150 } }
    ],
    scaling: { perLevel: { duration: 30 }, maxLevel: 5 },
    tags: ['utility', 'buff', 'high-risk']
  },
  {
    id: 'overload',
    name: '超载',
    description: '全属性大幅提升',
    icon: 'overload',
    category: 'utility',
    unlock: { level: 30 },
    targeting: { type: 'self', range: 0 },
    delivery: { method: 'instant' },
    cost: { mana: 100 },
    cooldown: { base: 600 },
    cast: { windup: 20, canMove: false },
    effects: [
      { type: 'buff', buff: { stats: { attack: 0.5, armor: 0.5, speed: 0.5, cooldownReduction: 0.5 }, duration: 120 } }
    ],
    scaling: { perLevel: { duration: 20 }, maxLevel: 5 },
    tags: ['ultimate', 'buff']
  }
];

// 导出总计74个技能
export const allSkills: SkillDefinition[] = [
  ...meleeSkills,       // 15
  ...rangedSkills,      // 18
  ...controlSkills,     // 12
  ...supportSkills,     // 10
  ...summonSkills,      // 10
  ...auraSkills,        // 9
  ...utilitySkills      // 5
];

console.log(`Total skills: ${allSkills.length}`);
