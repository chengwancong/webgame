import type { SkillDefinition, SkillDatabase, SkillTree } from '../contracts/skill-system';
import { allSkills } from './skills-complete';

/**
 * 构建完整的技能数据库
 * 包含索引、技能树等
 */

export const skillDatabase: SkillDatabase = {
  byCategory: {
    melee: [],
    ranged: [],
    control: [],
    support: [],
    summon: [],
    aura: [],
    utility: []
  },
  byId: {},
  byLevel: {},
  trees: []
};

// 构建分类索引
allSkills.forEach(skill => {
  skillDatabase.byCategory[skill.category].push(skill);
  skillDatabase.byId[skill.id] = skill;
  
  const level = skill.unlock.level;
  if (!skillDatabase.byLevel[level]) {
    skillDatabase.byLevel[level] = [];
  }
  skillDatabase.byLevel[level].push(skill);
});

// 定义技能树
skillDatabase.trees = [
  {
    id: 'warrior',
    name: '战士',
    description: '近战专精，高爆发高生存',
    icon: 'warrior',
    masteryBonus: [
      {
        pointsRequired: 10,
        bonus: { attack: 0.1, armor: 0.05 },
        description: '攻击力+10%，护甲+5%'
      },
      {
        pointsRequired: 20,
        bonus: { attack: 0.2, critChance: 0.1 },
        description: '攻击力+20%，暴击率+10%'
      },
      {
        pointsRequired: 30,
        bonus: { attack: 0.3, lifeSteal: 0.15 },
        description: '攻击力+30%，生命偷取+15%'
      }
    ],
    nodes: [
      { skillId: 'basic_slash', position: { x: 0, y: 0 }, tier: 1, connections: ['power_strike', 'whirlwind'] },
      { skillId: 'power_strike', position: { x: -1, y: 1 }, tier: 2, connections: ['execute'], requiredPoints: 5 },
      { skillId: 'whirlwind', position: { x: 1, y: 1 }, tier: 2, connections: ['blade_storm'] },
      { skillId: 'charge', position: { x: 0, y: 2 }, tier: 3, connections: ['cyclone'] },
      { skillId: 'execute', position: { x: -1, y: 3 }, tier: 4, connections: ['devastate'], requiredPoints: 15 },
      { skillId: 'blade_storm', position: { x: 1, y: 3 }, tier: 4, connections: [] },
      { skillId: 'cyclone', position: { x: 0, y: 4 }, tier: 5, connections: [] },
      { skillId: 'devastate', position: { x: -1, y: 5 }, tier: 6, connections: [], requiredPoints: 25 }
    ]
  },
  {
    id: 'ranger',
    name: '游侠',
    description: '远程攻击，高机动性',
    icon: 'ranger',
    masteryBonus: [
      {
        pointsRequired: 10,
        bonus: { attack: 0.08, critChance: 0.05 },
        description: '攻击力+8%，暴击率+5%'
      },
      {
        pointsRequired: 20,
        bonus: { attack: 0.15, critMultiplier: 0.3 },
        description: '攻击力+15%，暴击伤害+30%'
      },
      {
        pointsRequired: 30,
        bonus: { attack: 0.25, speed: 0.15 },
        description: '攻击力+25%，移动速度+15%'
      }
    ],
    nodes: [
      { skillId: 'magic_arrow', position: { x: 0, y: 0 }, tier: 1, connections: ['multi_shot', 'ice_arrow'] },
      { skillId: 'multi_shot', position: { x: -1, y: 1 }, tier: 2, connections: ['explosive_arrow'] },
      { skillId: 'ice_arrow', position: { x: 1, y: 1 }, tier: 2, connections: ['poison_arrow'] },
      { skillId: 'piercing_shot', position: { x: 0, y: 2 }, tier: 3, connections: ['snipe'], requiredPoints: 10 },
      { skillId: 'rain_of_arrows', position: { x: -1, y: 3 }, tier: 4, connections: ['meteor'] },
      { skillId: 'snipe', position: { x: 1, y: 3 }, tier: 4, connections: ['barrage'] },
      { skillId: 'meteor', position: { x: -1, y: 5 }, tier: 6, connections: [], requiredPoints: 25 },
      { skillId: 'black_hole', position: { x: 0, y: 5 }, tier: 6, connections: [], requiredPoints: 25 }
    ]
  },
  {
    id: 'mage',
    name: '法师',
    description: '控制与辅助专精',
    icon: 'mage',
    masteryBonus: [
      {
        pointsRequired: 10,
        bonus: { manaRegen: 5, cooldownReduction: 0.1 },
        description: '能量回复+5，冷却缩减+10%'
      },
      {
        pointsRequired: 20,
        bonus: { damageMultiplier: 0.2, manaRegen: 10 },
        description: '技能伤害+20%，能量回复+10'
      },
      {
        pointsRequired: 30,
        bonus: { damageMultiplier: 0.4, cooldownReduction: 0.2 },
        description: '技能伤害+40%，冷却缩减+20%'
      }
    ],
    nodes: [
      { skillId: 'frost_nova', position: { x: 0, y: 0 }, tier: 1, connections: ['frost_field', 'ice_wall'] },
      { skillId: 'frost_field', position: { x: -1, y: 1 }, tier: 2, connections: ['time_warp'] },
      { skillId: 'ice_wall', position: { x: 1, y: 1 }, tier: 2, connections: ['entangle'] },
      { skillId: 'time_warp', position: { x: -1, y: 3 }, tier: 4, connections: ['temporal_prison'], requiredPoints: 15 },
      { skillId: 'silence', position: { x: 1, y: 3 }, tier: 4, connections: ['mass_confusion'] },
      { skillId: 'temporal_prison', position: { x: -1, y: 5 }, tier: 6, connections: [], requiredPoints: 25 }
    ]
  },
  {
    id: 'summoner',
    name: '召唤师',
    description: '召唤生物战斗',
    icon: 'summoner',
    masteryBonus: [
      {
        pointsRequired: 10,
        bonus: { mana: 50 },
        description: '最大能量+50'
      },
      {
        pointsRequired: 20,
        bonus: { mana: 100 },
        description: '召唤物伤害+25%，最大能量+100'
      },
      {
        pointsRequired: 30,
        bonus: { mana: 150 },
        description: '召唤物生命+50%，最大能量+150'
      }
    ],
    nodes: [
      { skillId: 'wolf_companion', position: { x: 0, y: 0 }, tier: 1, connections: ['skeleton_warrior'] },
      { skillId: 'skeleton_warrior', position: { x: 0, y: 1 }, tier: 2, connections: ['ice_golem', 'lightning_totem'] },
      { skillId: 'ice_golem', position: { x: -1, y: 2 }, tier: 3, connections: ['demon_lord'], requiredPoints: 10 },
      { skillId: 'fire_elemental', position: { x: 1, y: 2 }, tier: 3, connections: ['holy_guardian'] },
      { skillId: 'demon_lord', position: { x: -1, y: 4 }, tier: 5, connections: ['army_of_dead'], requiredPoints: 20 },
      { skillId: 'phoenix', position: { x: 1, y: 5 }, tier: 6, connections: [], requiredPoints: 25 }
    ]
  },
  {
    id: 'paladin',
    name: '圣骑士',
    description: '光环与辅助',
    icon: 'paladin',
    masteryBonus: [
      {
        pointsRequired: 10,
        bonus: { armor: 0.15, hp: 0.1 },
        description: '护甲+15%，生命+10%'
      },
      {
        pointsRequired: 20,
        bonus: { armor: 0.3, damageReduction: 0.1 },
        description: '护甲+30%，伤害减免+10%'
      },
      {
        pointsRequired: 30,
        bonus: { armor: 0.5, hp: 0.2 },
        description: '护甲+50%，生命+20%'
      }
    ],
    nodes: [
      { skillId: 'shield', position: { x: 0, y: 0 }, tier: 1, connections: ['heal', 'regeneration_aura'] },
      { skillId: 'regeneration_aura', position: { x: -1, y: 1 }, tier: 2, connections: ['power_aura'] },
      { skillId: 'power_aura', position: { x: -1, y: 2 }, tier: 3, connections: ['holy_fire_aura'], requiredPoints: 10 },
      { skillId: 'haste', position: { x: 1, y: 1 }, tier: 2, connections: ['fortify'] },
      { skillId: 'divine_shield', position: { x: 0, y: 4 }, tier: 5, connections: ['resurrection'], requiredPoints: 20 },
      { skillId: 'fanaticism', position: { x: -1, y: 5 }, tier: 6, connections: [], requiredPoints: 25 }
    ]
  }
];

// 工具函数
export function getSkillById(id: string): SkillDefinition | undefined {
  return skillDatabase.byId[id];
}

export function getSkillsByCategory(category: string): SkillDefinition[] {
  return skillDatabase.byCategory[category as keyof typeof skillDatabase.byCategory] || [];
}

export function getSkillsByLevel(level: number): SkillDefinition[] {
  return skillDatabase.byLevel[level] || [];
}

export function getSkillTree(id: string): SkillTree | undefined {
  return skillDatabase.trees.find(tree => tree.id === id);
}

export function validateSkillPrerequisites(skillId: string, unlockedSkills: string[]): boolean {
  const skill = getSkillById(skillId);
  if (!skill || !skill.unlock.prerequisite) return true;
  
  return skill.unlock.prerequisite.every(prereq => unlockedSkills.includes(prereq));
}

export function getAvailableSkills(playerLevel: number, unlockedSkills: string[]): SkillDefinition[] {
  return allSkills.filter(skill => {
    // 检查等级要求
    if (skill.unlock.level > playerLevel) return false;
    
    // 检查前置技能
    if (!validateSkillPrerequisites(skill.id, unlockedSkills)) return false;
    
    // 检查是否已解锁
    if (unlockedSkills.includes(skill.id)) return false;
    
    return true;
  });
}

// 统计信息
export const skillStats = {
  total: allSkills.length,
  byCategory: Object.entries(skillDatabase.byCategory).reduce((acc, [key, skills]) => {
    acc[key] = skills.length;
    return acc;
  }, {} as Record<string, number>),
  byLevel: Object.keys(skillDatabase.byLevel).length,
  trees: skillDatabase.trees.length
};

console.log('技能系统统计:', skillStats);
