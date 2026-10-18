> 历史任务草案，未采用的整数百分比词缀设计。禁止据此生成运行数据或接入接口；当前实现见 ../gear-affixes.md。

# 后端任务文档 - 装备词缀&套装系统

**目标：** 实现装备词缀、套装、品质系统的核心逻辑和数据结构  
**预计工作量：** 5-7天  
**负责人：** Claude

---

## 📋 任务概述

需要完成装备系统的核心改造，支持：
- 装备品质系统（普通/魔法/稀有/传说）
- 词缀系统（随机属性）
- 套装系统（多件激活加成）
- 掉落算法（加权随机）
- 套装加成计算

---

## 🎯 核心目标

### 数据模型设计
- 扩展Gear类型定义
- 创建词缀池和套装配置
- 设计数据库Schema

### 游戏逻辑实现
- 词缀生成算法
- 套装检测和加成计算
- 掉落品质权重系统

### API接口
- 装备列表（包含词缀和套装信息）
- 套装详情查询
- 装备对比数据

---

## 📦 第一步：类型定义

### 文件：`packages/contracts/index.ts`

```typescript
// 装备品质
export type GearQuality = 'common' | 'magic' | 'rare' | 'legendary';

// 词缀定义
export type GearAffix = {
  id: string;
  name: string;
  tier: 1 | 2 | 3;  // 1=顶级，3=普通
  stat: keyof Stats | 'special';
  value: number;
  description: string;  // 完整描述，如"暴击率 +15%"
}

// 扩展Stats类型，添加新属性
export type Stats = {
  hp: number;
  attack: number;
  armor: number;
  speed: number;
  mana: number;
  regen: number;
  effects: Effect[];
  
  // 新增属性
  critChance?: number;      // 暴击率（百分比）
  critMultiplier?: number;  // 暴击倍率
  lifesteal?: number;       // 吸血（百分比）
  cdr?: number;             // 冷却缩减（百分比）
  dodge?: number;           // 闪避率（百分比）
  block?: number;           // 格挡率（百分比）
  penetration?: number;     // 护甲穿透
}

// 扩展Gear类型
export type Gear = {
  id: string;
  base: string;
  slot: Slot;
  level: number;
  stars: number;
  locked: boolean;
  
  // 基础属性
  attack: number;
  armor: number;
  hp: number;
  
  // 新增字段
  quality: GearQuality;
  name: string;  // 显示名称（品质前缀 + 基础名称）
  
  // 词缀系统
  affixes: GearAffix[];
  
  // 套装系统
  setId?: string;
  setName?: string;
}

// 套装加成
export type SetBonus = {
  pieces: 2 | 3 | 4 | 6;
  description: string;
  stats?: Partial<Stats>;
  special?: string;  // 特殊效果ID
}

// 套装定义
export type GearSet = {
  id: string;
  name: string;
  pieces: string[];  // 基础装备ID列表
  bonuses: SetBonus[];
}

// 玩家快照中的套装状态
export type EquippedSetInfo = {
  setId: string;
  setName: string;
  count: number;     // 已装备件数
  total: number;     // 总件数
  activeBonuses: number[];  // 已激活的加成件数（如[2, 4]）
}
```

---

## 📦 第二步：内容定义

### 文件：`packages/content/affixes.ts`

```typescript
import type { GearAffix, Stats } from '../contracts/index.ts';

// 词缀池定义
export type AffixTemplate = Omit<GearAffix, 'value' | 'description'> & {
  valueRange: [number, number];  // 数值范围
  weight: number;  // 掉落权重
  format: string;  // 描述格式，如"{name} +{value}%"
}

export const affixPool: AffixTemplate[] = [
  // T1 顶级词缀（稀有）
  {
    id: 'lifesteal',
    name: '吸血',
    tier: 1,
    stat: 'lifesteal',
    valueRange: [6, 12],
    weight: 3,
    format: '吸血 +{value}%',
  },
  {
    id: 'crit_damage',
    name: '暴击伤害',
    tier: 1,
    stat: 'critMultiplier',
    valueRange: [40, 80],
    weight: 4,
    format: '暴击伤害 +{value}%',
  },
  {
    id: 'cooldown_heavy',
    name: '急速',
    tier: 1,
    stat: 'cdr',
    valueRange: [15, 25],
    weight: 5,
    format: '冷却缩减 +{value}%',
  },
  
  // T2 优秀词缀（常见）
  {
    id: 'crit_chance',
    name: '暴击',
    tier: 2,
    stat: 'critChance',
    valueRange: [10, 20],
    weight: 10,
    format: '暴击率 +{value}%',
  },
  {
    id: 'attack_bonus',
    name: '力量',
    tier: 2,
    stat: 'attack',
    valueRange: [15, 35],
    weight: 12,
    format: '攻击 +{value}',
  },
  {
    id: 'armor_bonus',
    name: '坚韧',
    tier: 2,
    stat: 'armor',
    valueRange: [10, 25],
    weight: 12,
    format: '护甲 +{value}',
  },
  {
    id: 'hp_bonus',
    name: '活力',
    tier: 2,
    stat: 'hp',
    valueRange: [50, 120],
    weight: 10,
    format: '生命 +{value}',
  },
  {
    id: 'dodge',
    name: '敏捷',
    tier: 2,
    stat: 'dodge',
    valueRange: [8, 15],
    weight: 8,
    format: '闪避率 +{value}%',
  },
  
  // T3 普通词缀（很常见）
  {
    id: 'speed',
    name: '迅捷',
    tier: 3,
    stat: 'speed',
    valueRange: [5, 12],
    weight: 15,
    format: '移速 +{value}%',
  },
  {
    id: 'mana_bonus',
    name: '智慧',
    tier: 3,
    stat: 'mana',
    valueRange: [20, 40],
    weight: 15,
    format: '灵力 +{value}',
  },
  {
    id: 'regen',
    name: '回复',
    tier: 3,
    stat: 'regen',
    valueRange: [3, 8],
    weight: 18,
    format: '灵力回复 +{value}',
  },
  {
    id: 'penetration',
    name: '穿透',
    tier: 3,
    stat: 'penetration',
    valueRange: [5, 12],
    weight: 12,
    format: '护甲穿透 +{value}',
  },
];

// 品质对应的词缀数量
export const affixCountByQuality: Record<GearQuality, number> = {
  common: 0,
  magic: 1,
  rare: 2,
  legendary: 3,
};

// 词缀层级权重（品质越高，高层级词缀概率越大）
export const affixTierWeights: Record<GearQuality, Record<number, number>> = {
  common: { 1: 0, 2: 0, 3: 0 },
  magic: { 1: 5, 2: 30, 3: 65 },
  rare: { 1: 15, 2: 50, 3: 35 },
  legendary: { 1: 40, 2: 45, 3: 15 },
};
```

---

### 文件：`packages/content/gear-sets.ts`

```typescript
import type { GearSet } from '../contracts/index.ts';

export const gearSets: GearSet[] = [
  // 狂战士套装（近战输出）
  {
    id: 'berserker',
    name: '狂战士',
    pieces: ['berserker_weapon', 'berserker_armor', 'berserker_accessory'],
    bonuses: [
      {
        pieces: 2,
        description: '攻击速度 +15%',
        stats: { speed: 0.9 },  // 速度0.9 = 快15%
      },
      {
        pieces: 3,
        description: '生命值低于50%时，伤害 +50%',
        special: 'berserker_rage',
      },
    ]
  },
  
  // 守护者套装（坦克）
  {
    id: 'guardian',
    name: '守护者',
    pieces: ['guardian_weapon', 'guardian_armor', 'guardian_core'],
    bonuses: [
      {
        pieces: 2,
        description: '护甲 +30',
        stats: { armor: 30 },
      },
      {
        pieces: 3,
        description: '受到伤害时有20%几率获得护盾',
        special: 'guardian_shield',
      },
    ]
  },
  
  // 元素使套装（魔法）
  {
    id: 'elementalist',
    name: '元素使',
    pieces: ['elementalist_weapon', 'elementalist_accessory', 'elementalist_core'],
    bonuses: [
      {
        pieces: 2,
        description: '冷却缩减 +15%',
        stats: { cdr: 15 },
      },
      {
        pieces: 3,
        description: '技能伤害 +25%',
        special: 'spell_power',
      },
    ]
  },
  
  // 暗影套装（刺客）
  {
    id: 'shadow',
    name: '暗影',
    pieces: ['shadow_weapon', 'shadow_armor', 'shadow_accessory'],
    bonuses: [
      {
        pieces: 2,
        description: '暴击率 +15%',
        stats: { critChance: 15 },
      },
      {
        pieces: 3,
        description: '暴击伤害 +50%',
        stats: { critMultiplier: 2.5 },
      },
    ]
  },
  
  // 圣光套装（辅助/治疗）
  {
    id: 'radiant',
    name: '圣光',
    pieces: ['radiant_weapon', 'radiant_armor', 'radiant_core'],
    bonuses: [
      {
        pieces: 2,
        description: '生命回复 +10%',
        special: 'life_regeneration',
      },
      {
        pieces: 3,
        description: '治疗效果 +40%',
        special: 'healing_power',
      },
    ]
  },
  
  // 迅捷套装（速度流）
  {
    id: 'swift',
    name: '迅捷',
    pieces: ['swift_weapon', 'swift_armor', 'swift_accessory'],
    bonuses: [
      {
        pieces: 2,
        description: '移动速度 +20%',
        stats: { speed: 0.8 },
      },
      {
        pieces: 3,
        description: '闪避率 +15%',
        stats: { dodge: 15 },
      },
    ]
  },
];

// 根据基础装备ID查找所属套装
export function findSetByBase(baseId: string): GearSet | undefined {
  return gearSets.find(set => set.pieces.includes(baseId));
}

// 获取套装详情
export function getSetInfo(setId: string): GearSet | undefined {
  return gearSets.find(set => set.id === setId);
}
```

---

### 文件：`packages/content/gear-bases.ts`

```typescript
// 基础装备定义（添加套装关联）
export type GearBase = {
  id: string;
  name: string;
  slot: Slot;
  unlockLevel: number;
  baseStats: {
    attack: number;
    armor: number;
    hp: number;
  };
  setId?: string;  // 所属套装ID
}

export const gearBases: GearBase[] = [
  // 狂战士套装装备
  { id: 'berserker_weapon', name: '狂战之刃', slot: 'weapon', unlockLevel: 5, baseStats: { attack: 35, armor: 0, hp: 0 }, setId: 'berserker' },
  { id: 'berserker_armor', name: '狂战之甲', slot: 'armor', unlockLevel: 5, baseStats: { attack: 0, armor: 25, hp: 80 }, setId: 'berserker' },
  { id: 'berserker_accessory', name: '狂战之戒', slot: 'accessory', unlockLevel: 5, baseStats: { attack: 15, armor: 10, hp: 40 }, setId: 'berserker' },
  
  // 守护者套装装备
  { id: 'guardian_weapon', name: '守护之锤', slot: 'weapon', unlockLevel: 6, baseStats: { attack: 25, armor: 0, hp: 0 }, setId: 'guardian' },
  { id: 'guardian_armor', name: '守护之铠', slot: 'armor', unlockLevel: 6, baseStats: { attack: 0, armor: 45, hp: 120 }, setId: 'guardian' },
  { id: 'guardian_core', name: '守护之心', slot: 'core', unlockLevel: 6, baseStats: { attack: 0, armor: 20, hp: 80 }, setId: 'guardian' },
  
  // 元素使套装装备
  { id: 'elementalist_weapon', name: '元素法杖', slot: 'weapon', unlockLevel: 7, baseStats: { attack: 40, armor: 0, hp: 0 }, setId: 'elementalist' },
  { id: 'elementalist_accessory', name: '元素护符', slot: 'accessory', unlockLevel: 7, baseStats: { attack: 20, armor: 5, hp: 30 }, setId: 'elementalist' },
  { id: 'elementalist_core', name: '元素精华', slot: 'core', unlockLevel: 7, baseStats: { attack: 15, armor: 10, hp: 50 }, setId: 'elementalist' },
  
  // ...更多套装装备
  
  // 普通装备（不属于套装）
  { id: 'iron_sword', name: '铁剑', slot: 'weapon', unlockLevel: 1, baseStats: { attack: 20, armor: 0, hp: 0 } },
  { id: 'leather_armor', name: '皮甲', slot: 'armor', unlockLevel: 1, baseStats: { attack: 0, armor: 15, hp: 50 } },
  // ...更多普通装备
];
```

---

## 📦 第三步：核心逻辑

### 文件：`packages/simulation/affix-generator.ts`

```typescript
import type { GearAffix, GearQuality } from '../contracts/index.ts';
import { affixPool, affixCountByQuality, affixTierWeights, type AffixTemplate } from '../content/affixes.ts';

// 加权随机选择
function weightedRandom<T extends { weight: number }>(items: T[], rng: () => number): T {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = rng() * totalWeight;
  
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  
  return items[items.length - 1];
}

// 生成词缀
export function generateAffixes(
  quality: GearQuality,
  level: number,
  seed: number
): GearAffix[] {
  const count = affixCountByQuality[quality];
  if (count === 0) return [];
  
  // 简单的伪随机数生成器（基于种子）
  let rngState = seed;
  const rng = () => {
    rngState = (rngState * 9301 + 49297) % 233280;
    return rngState / 233280;
  };
  
  const result: GearAffix[] = [];
  const used = new Set<string>();
  const tierWeights = affixTierWeights[quality];
  
  for (let i = 0; i < count; i++) {
    // 选择层级
    const tierRoll = rng() * 100;
    let tier: 1 | 2 | 3 = 3;
    let cumulative = 0;
    for (const [t, weight] of Object.entries(tierWeights)) {
      cumulative += weight;
      if (tierRoll <= cumulative) {
        tier = Number(t) as 1 | 2 | 3;
        break;
      }
    }
    
    // 筛选可用词缀
    const available = affixPool.filter(a => 
      a.tier === tier && !used.has(a.id)
    );
    
    if (available.length === 0) continue;
    
    // 加权随机选择
    const template = weightedRandom(available, rng);
    used.add(template.id);
    
    // 生成数值
    const [min, max] = template.valueRange;
    const value = Math.round(min + rng() * (max - min));
    
    // 构造词缀
    result.push({
      id: template.id,
      name: template.name,
      tier: template.tier,
      stat: template.stat,
      value,
      description: template.format.replace('{value}', String(value)),
    });
  }
  
  return result;
}
```

---

### 文件：`packages/simulation/set-calculator.ts`

```typescript
import type { Gear, EquippedSetInfo, Stats } from '../contracts/index.ts';
import { gearSets, findSetByBase } from '../content/gear-sets.ts';

// 计算已装备的套装状态
export function calculateEquippedSets(equipped: Gear[]): EquippedSetInfo[] {
  const setCounts = new Map<string, { setName: string; count: number; total: number }>();
  
  for (const gear of equipped) {
    if (!gear.setId) continue;
    
    const existing = setCounts.get(gear.setId);
    if (existing) {
      existing.count++;
    } else {
      const set = gearSets.find(s => s.id === gear.setId);
      if (set) {
        setCounts.set(gear.setId, {
          setName: set.name,
          count: 1,
          total: set.pieces.length,
        });
      }
    }
  }
  
  const result: EquippedSetInfo[] = [];
  for (const [setId, info] of setCounts) {
    const set = gearSets.find(s => s.id === setId);
    if (!set) continue;
    
    const activeBonuses = set.bonuses
      .filter(b => info.count >= b.pieces)
      .map(b => b.pieces);
    
    result.push({
      setId,
      setName: info.setName,
      count: info.count,
      total: info.total,
      activeBonuses,
    });
  }
  
  return result;
}

// 应用套装加成到属性
export function applySetBonuses(baseStats: Stats, equipped: Gear[]): Stats {
  const result = { ...baseStats };
  const setInfos = calculateEquippedSets(equipped);
  
  for (const setInfo of setInfos) {
    const set = gearSets.find(s => s.id === setInfo.setId);
    if (!set) continue;
    
    for (const bonus of set.bonuses) {
      if (setInfo.count >= bonus.pieces && bonus.stats) {
        // 应用属性加成
        for (const [key, value] of Object.entries(bonus.stats)) {
          if (key in result && typeof value === 'number') {
            (result as any)[key] += value;
          }
        }
      }
    }
  }
  
  return result;
}

// 应用词缀加成到属性
export function applyAffixBonuses(baseStats: Stats, gear: Gear): Stats {
  const result = { ...baseStats };
  
  for (const affix of gear.affixes) {
    if (affix.stat === 'special') continue;
    
    const key = affix.stat as keyof Stats;
    if (key in result) {
      const current = result[key];
      if (typeof current === 'number') {
        (result as any)[key] = current + affix.value;
      }
    }
  }
  
  return result;
}
```

---

### 文件：`packages/simulation/gear-generator.ts`

```typescript
import type { Gear, GearQuality } from '../contracts/index.ts';
import { gearBases } from '../content/gear-bases.ts';
import { generateAffixes } from './affix-generator.ts';

// 品质掉落权重
const qualityWeights: Record<GearQuality, number> = {
  common: 50,
  magic: 30,
  rare: 15,
  legendary: 5,
};

// 品质名称前缀
const qualityPrefixes: Record<GearQuality, string> = {
  common: '',
  magic: '附魔',
  rare: '精良',
  legendary: '传说',
};

// 生成装备
export function generateGear(
  baseId: string,
  level: number,
  seed: number,
  forceQuality?: GearQuality
): Gear {
  const base = gearBases.find(b => b.id === baseId);
  if (!base) throw new Error(`Unknown gear base: ${baseId}`);
  
  // 确定品质
  let quality: GearQuality = forceQuality ?? 'common';
  if (!forceQuality) {
    const roll = (seed % 100);
    let cumulative = 0;
    for (const [q, weight] of Object.entries(qualityWeights)) {
      cumulative += weight;
      if (roll < cumulative) {
        quality = q as GearQuality;
        break;
      }
    }
  }
  
  // 生成词缀
  const affixes = generateAffixes(quality, level, seed);
  
  // 构造装备
  const prefix = qualityPrefixes[quality];
  const name = prefix ? `${prefix}的${base.name}` : base.name;
  
  return {
    id: crypto.randomUUID(),
    base: baseId,
    slot: base.slot,
    level,
    stars: 0,
    locked: false,
    quality,
    name,
    attack: base.baseStats.attack,
    armor: base.baseStats.armor,
    hp: base.baseStats.hp,
    affixes,
    setId: base.setId,
    setName: base.setId ? gearSets.find(s => s.id === base.setId)?.name : undefined,
  };
}
```

---

## 📦 第四步：数据库迁移

### 文件：`apps/server/migrations/009_gear_affixes_sets.sql`

```sql
-- 添加品质和套装字段到gear表
ALTER TABLE gear 
  ADD COLUMN IF NOT EXISTS quality TEXT DEFAULT 'common' CHECK (quality IN ('common', 'magic', 'rare', 'legendary')),
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS set_id TEXT,
  ADD COLUMN IF NOT EXISTS affixes JSONB DEFAULT '[]';

-- 更新现有装备为普通品质
UPDATE gear SET quality = 'common' WHERE quality IS NULL;
UPDATE gear SET display_name = base WHERE display_name IS NULL;
UPDATE gear SET affixes = '[]' WHERE affixes IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_gear_quality ON gear(quality);
CREATE INDEX IF NOT EXISTS idx_gear_set_id ON gear(set_id);

-- 创建套装状态缓存表（可选，用于性能优化）
CREATE TABLE IF NOT EXISTS player_set_status (
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  set_id TEXT NOT NULL,
  equipped_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (player_id, set_id)
);

CREATE INDEX IF NOT EXISTS idx_player_set_status ON player_set_status(player_id);
```

---

## 📦 第五步：API实现

### 文件：`apps/server/src/routes/gear.ts`

```typescript
import type { FastifyInstance } from 'fastify';
import type { Gear, EquippedSetInfo } from '../../../packages/contracts/index.ts';
import { calculateEquippedSets } from '../../../packages/simulation/set-calculator.ts';
import { gearSets } from '../../../packages/content/gear-sets.ts';
import { requireAuth } from '../auth.ts';

export async function gearRoutes(app: FastifyInstance) {
  // 获取装备列表（已包含套装信息）
  app.get('/api/gear', { preHandler: requireAuth }, async (req, reply) => {
    const playerId = req.session.playerId;
    
    // 查询装备
    const result = await app.pg.query<Gear & { is_equipped: boolean }>(
      `SELECT 
        g.*,
        EXISTS(
          SELECT 1 FROM player_equipped pe 
          WHERE pe.gear_id = g.id AND pe.player_id = $1
        ) as is_equipped
      FROM gear g
      WHERE g.player_id = $1
      ORDER BY g.quality DESC, g.level DESC`,
      [playerId]
    );
    
    const gear = result.rows.map(row => ({
      id: row.id,
      base: row.base,
      slot: row.slot,
      level: row.level,
      stars: row.stars,
      locked: row.locked,
      quality: row.quality,
      name: row.display_name,
      attack: row.attack,
      armor: row.armor,
      hp: row.hp,
      affixes: row.affixes,
      setId: row.set_id,
      setName: row.set_id ? gearSets.find(s => s.id === row.set_id)?.name : undefined,
    }));
    
    // 计算套装件数
    const equipped = gear.filter(g => row.is_equipped);
    const setInfos = calculateEquippedSets(equipped);
    
    // 为每件套装装备添加件数信息
    const gearWithSetCount = gear.map(g => {
      if (!g.setId) return g;
      
      const setInfo = setInfos.find(s => s.setId === g.setId);
      return {
        ...g,
        setCount: setInfo?.count ?? 0,
        setTotal: setInfo?.total ?? gearSets.find(s => s.id === g.setId)?.pieces.length ?? 0,
      };
    });
    
    return { gear: gearWithSetCount };
  });
  
  // 获取套装详情
  app.get<{ Params: { setId: string } }>(
    '/api/gear/sets/:setId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { setId } = req.params;
      const playerId = req.session.playerId;
      
      const set = gearSets.find(s => s.id === setId);
      if (!set) {
        return reply.code(404).send({ error: 'SET_NOT_FOUND', message: '套装不存在' });
      }
      
      // 查询已装备的套装件数
      const equipped = await app.pg.query<Gear>(
        `SELECT g.* FROM gear g
        INNER JOIN player_equipped pe ON pe.gear_id = g.id
        WHERE pe.player_id = $1 AND g.set_id = $2`,
        [playerId, setId]
      );
      
      const count = equipped.rows.length;
      const activeBonuses = set.bonuses
        .filter(b => count >= b.pieces)
        .map(b => ({
          pieces: b.pieces,
          description: b.description,
          active: true,
        }));
      
      const inactiveBonuses = set.bonuses
        .filter(b => count < b.pieces)
        .map(b => ({
          pieces: b.pieces,
          description: b.description,
          active: false,
        }));
      
      return {
        set: {
          id: set.id,
          name: set.name,
          count,
          total: set.pieces.length,
          bonuses: [...activeBonuses, ...inactiveBonuses],
        },
      };
    }
  );
  
  // 装备对比数据
  app.get<{ Querystring: { current?: string; candidate: string } }>(
    '/api/gear/compare',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { current, candidate } = req.query;
      const playerId = req.session.playerId;
      
      const candidateGear = await app.pg.query<Gear>(
        'SELECT * FROM gear WHERE id = $1 AND player_id = $2',
        [candidate, playerId]
      );
      
      if (candidateGear.rows.length === 0) {
        return reply.code(404).send({ error: 'GEAR_NOT_FOUND' });
      }
      
      let currentGear = null;
      if (current) {
        const result = await app.pg.query<Gear>(
          'SELECT * FROM gear WHERE id = $1 AND player_id = $2',
          [current, playerId]
        );
        currentGear = result.rows[0] ?? null;
      }
      
      // 计算属性差异
      const candidate = candidateGear.rows[0];
      const diff = currentGear ? {
        attack: candidate.attack - currentGear.attack,
        armor: candidate.armor - currentGear.armor,
        hp: candidate.hp - currentGear.hp,
      } : null;
      
      return {
        current: currentGear,
        candidate,
        diff,
      };
    }
  );
}
```

---

### 文件：`apps/server/src/loot.ts`（修改掉落逻辑）

```typescript
import { generateGear } from '../../packages/simulation/gear-generator.ts';
import { gearBases } from '../../packages/content/gear-bases.ts';

// 修改战利品生成，使用新的装备生成器
export function generateLootGear(playerLevel: number, enemyKind: string, seed: number): Gear {
  // 根据玩家等级选择可掉落的装备基础
  const availableBases = gearBases.filter(b => b.unlockLevel <= playerLevel);
  const baseIndex = seed % availableBases.length;
  const base = availableBases[baseIndex];
  
  // 首领有更高几率掉落稀有装备
  let forceQuality = undefined;
  if (enemyKind === 'boss') {
    const roll = seed % 100;
    if (roll < 30) forceQuality = 'legendary';
    else if (roll < 60) forceQuality = 'rare';
  }
  
  return generateGear(base.id, playerLevel, seed, forceQuality);
}
```

---

## 📦 第六步：更新Snapshot计算

### 文件：`apps/server/src/character.ts`

```typescript
import { applySetBonuses, applyAffixBonuses } from '../../packages/simulation/set-calculator.ts';
import { calculateEquippedSets } from '../../packages/simulation/set-calculator.ts';

// 修改computeStats函数
export function computeStats(character: Character, equipped: Gear[]): Stats {
  let stats: Stats = {
    hp: 100 + character.level * 20,
    attack: 10 + character.level * 2,
    armor: 5 + character.level,
    speed: 6,
    mana: 100,
    regen: 10,
    effects: [],
    
    // 初始化新属性
    critChance: 5,
    critMultiplier: 2.0,
    lifesteal: 0,
    cdr: 0,
    dodge: 0,
    block: 0,
    penetration: 0,
  };
  
  // 应用装备基础属性
  for (const gear of equipped) {
    stats.attack += gear.attack;
    stats.armor += gear.armor;
    stats.hp += gear.hp;
    
    // 应用词缀加成
    stats = applyAffixBonuses(stats, gear);
  }
  
  // 应用套装加成
  stats = applySetBonuses(stats, equipped);
  
  return stats;
}

// 在生成Snapshot时添加套装信息
export function buildSnapshot(character: Character, equipped: Gear[]): Snapshot {
  const stats = computeStats(character, equipped);
  const setInfos = calculateEquippedSets(equipped);
  
  return {
    // ...其他字段
    stats,
    gear: equipped,
    sets: setInfos,  // 新增：套装状态
  };
}
```

---

## ✅ 测试清单

### 单元测试

```typescript
// packages/simulation/__tests__/affix-generator.test.ts
describe('Affix Generator', () => {
  test('生成正确数量的词缀', () => {
    const affixes = generateAffixes('rare', 10, 12345);
    expect(affixes).toHaveLength(2);
  });
  
  test('传说品质倾向T1词缀', () => {
    const affixes = generateAffixes('legendary', 20, 54321);
    const t1Count = affixes.filter(a => a.tier === 1).length;
    expect(t1Count).toBeGreaterThan(0);
  });
  
  test('同一种子生成相同词缀', () => {
    const a1 = generateAffixes('rare', 10, 999);
    const a2 = generateAffixes('rare', 10, 999);
    expect(a1).toEqual(a2);
  });
});

// packages/simulation/__tests__/set-calculator.test.ts
describe('Set Calculator', () => {
  test('正确计算套装件数', () => {
    const equipped: Gear[] = [
      { /* berserker_weapon */ setId: 'berserker', /* ... */ },
      { /* berserker_armor */ setId: 'berserker', /* ... */ },
    ];
    
    const sets = calculateEquippedSets(equipped);
    expect(sets).toHaveLength(1);
    expect(sets[0].count).toBe(2);
    expect(sets[0].activeBonuses).toContain(2);
  });
  
  test('应用套装加成到属性', () => {
    const baseStats: Stats = { attack: 50, /* ... */ };
    const equipped: Gear[] = [/* 3件狂战士 */];
    
    const result = applySetBonuses(baseStats, equipped);
    expect(result.speed).toBeLessThan(baseStats.speed); // 速度提升
  });
});
```

---

## 📋 完成检查表

- [ ] 类型定义完成（contracts/index.ts）
- [ ] 词缀池定义（content/affixes.ts）
- [ ] 套装定义（content/gear-sets.ts）
- [ ] 词缀生成算法（simulation/affix-generator.ts）
- [ ] 套装计算逻辑（simulation/set-calculator.ts）
- [ ] 装备生成器（simulation/gear-generator.ts）
- [ ] 数据库迁移（migrations/009_gear_affixes_sets.sql）
- [ ] API路由（routes/gear.ts）
- [ ] 掉落逻辑更新（loot.ts）
- [ ] Snapshot计算更新（character.ts）
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 前端接口文档输出

---

## 📤 输出给前端

完成后，创建以下文档告知前端：

### `docs/api/gear-api.md`

```markdown
# 装备API文档

## GET /api/gear

获取玩家所有装备，包含词缀和套装信息。

### 响应
\`\`\`typescript
{
  gear: Gear[]  // 每件装备已包含setCount和setTotal字段
}
\`\`\`

## GET /api/gear/sets/:setId

获取套装详情。

### 响应
\`\`\`typescript
{
  set: {
    id: string;
    name: string;
    count: number;  // 已装备件数
    total: number;  // 总件数
    bonuses: {
      pieces: number;
      description: string;
      active: boolean;
    }[];
  }
}
\`\`\`

## GET /api/gear/compare?current={id}&candidate={id}

装备对比数据。

### 响应
\`\`\`typescript
{
  current: Gear | null;
  candidate: Gear;
  diff: {
    attack: number;
    armor: number;
    hp: number;
  } | null;
}
\`\`\`
```

---

**任务完成标准：**
1. 所有代码通过TypeScript类型检查
2. 单元测试覆盖率 > 80%
3. 集成测试通过
4. API文档完整
5. 前端可基于此文档开始开发

**预计完成时间：** 5-7天  
**文档版本：** 1.0  
**创建时间：** 2026年9月30日
