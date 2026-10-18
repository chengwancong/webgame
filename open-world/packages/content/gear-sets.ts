import type {GearSet, SetBonus} from '../contracts/index.ts';
import {collectionGearSets} from './equipment-runtime.ts';
import {unifiedGearSets,collectionSetIdentity} from './set-effects.ts';

// 套装加成定义
export const gearSets: GearSet[] = [
  ...unifiedGearSets,
  {
    id: 'berserker',
    name: '狂战士',
    pieces: ['berserker_weapon', 'berserker_armor', 'berserker_accessory'],
    bonuses: [
      { pieces: 2, description: '攻击力 +15', stats: { attack: 15 } },
      { pieces: 3, description: '暴击率 +12%, 暴击伤害 +50%', stats: { critChance: 0.12, critMultiplier: 0.5 } }
    ]
  },
  {
    id: 'guardian',
    name: '守护者',
    pieces: ['guardian_weapon', 'guardian_armor', 'guardian_core'],
    bonuses: [
      { pieces: 2, description: '护甲 +20', stats: { armor: 20 } },
      { pieces: 3, description: '最大生命 +15%, 受到伤害降低10%', stats: { hp: 0.15, damageReduction: 0.1 } }
    ]
  },
  {
    id: 'elementalist',
    name: '元素使',
    pieces: ['elementalist_weapon', 'elementalist_accessory', 'elementalist_core'],
    bonuses: [
      { pieces: 2, description: '攻击力 +10, 能量值 +30', stats: { attack: 10, mana: 30 } },
      { pieces: 3, description: '技能冷却时间 -20%, 能量回复 +5', stats: { cdr: 0.2, regen: 5 } }
    ]
  },
  {
    id: 'shadow',
    name: '暗影',
    pieces: ['shadow_weapon', 'shadow_armor', 'shadow_accessory'],
    bonuses: [
      { pieces: 2, description: '攻击力 +12, 移动速度 +1', stats: { attack: 12, speed: 1 } },
      { pieces: 3, description: '闪避率 +15%, 暴击率 +8%', stats: { dodge: 0.15, critChance: 0.08 } }
    ]
  },
  {
    id: 'radiant',
    name: '圣光',
    pieces: ['radiant_weapon', 'radiant_armor', 'radiant_core'],
    bonuses: [
      { pieces: 2, description: '攻击力 +8, 护甲 +15', stats: { attack: 8, armor: 15 } },
      { pieces: 3, description: '生命偷取 +10%, 能量回复 +8', stats: { lifesteal: 0.1, regen: 8 } }
    ]
  },
  {
    id: 'swift',
    name: '迅捷',
    pieces: ['swift_weapon', 'swift_armor', 'swift_accessory'],
    bonuses: [
      { pieces: 2, description: '移动速度 +2, 闪避率 +8%', stats: { speed: 2, dodge: 0.08 } },
      { pieces: 3, description: '攻击力 +18, 技能冷却时间 -15%', stats: { attack: 18, cdr: 0.15 } }
    ]
  }
];

// 根据套装ID查找套装定义
export const legacyGearSets:GearSet[]=[...collectionGearSets,...gearSets.filter(s=>!s.id.startsWith('set-'))];
export function getGearSet(id: string,legacy=false): GearSet | undefined {
  return (legacy?legacyGearSets:gearSets).find(set => set.id === (legacy?id:collectionSetIdentity(id)));
}

// 获取套装名称
export function getSetName(id: string): string {
  const set = getGearSet(id);
  return set?.name ?? '未知套装';
}
