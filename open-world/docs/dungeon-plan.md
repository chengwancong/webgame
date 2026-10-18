# 深渊行者 - 主线副本设计方案

> 基于现有游戏架构的完整主线副本系统设计
> 策划/数值：AI设计师 | 前端需求：待交付GPT

---

## 第一部分：策划数值设计（后端）

### 一、副本架构总览

当前游戏已有区域：
- 城镇 (town) - 安全区
- 苍风原野 (meadow) - Lv1-5
- 苍风原野·首领 (meadow-boss) 
- 迷雾森林 (forest) - Lv6-10
- 迷雾森林·首领 (forest-boss)
- 赤岩裂谷 (rift) - Lv11-15
- 赤岩裂谷·首领 (rift-boss)

**扩展计划：新增3个主线章节（共6章）**

```
第1章：苍风原野 [已有] → Lv1-5
第2章：迷雾森林 [已有] → Lv6-10  
第3章：赤岩裂谷 [已有] → Lv11-15
第4章：冰封雪域 [新增] → Lv16-20
第5章：暗影深渊 [新增] → Lv21-25
第6章：龙骨荒漠 [新增] → Lv26-30
```

---

### 二、副本数值体系

#### 1. 玩家成长曲线

| 等级 | 基础HP | 基础攻击 | 基础防御 | 法力值 | 技能点 |
|------|--------|----------|----------|--------|--------|
| 1 | 100 | 15 | 5 | 100 | 3 |
| 5 | 180 | 25 | 10 | 140 | 5 |
| 10 | 300 | 40 | 18 | 200 | 8 |
| 15 | 450 | 60 | 28 | 280 | 12 |
| 20 | 650 | 85 | 40 | 380 | 16 |
| 25 | 900 | 115 | 55 | 500 | 20 |
| 30 | 1200 | 150 | 75 | 650 | 25 |

**成长公式：**
```
HP = 100 + (level - 1) × 38
攻击 = 15 + (level - 1) × 4.5
防御 = 5 + (level - 1) × 2.3
法力 = 100 + (level - 1) × 18
```

#### 2. 怪物模板系统

**普通小怪（按章节）**

| 章节 | 等级 | HP倍率 | 攻击倍率 | 经验 | 金币 |
|------|------|--------|----------|------|------|
| 1章 | 1-5 | 0.8 | 0.7 | 15-25 | 3-8 |
| 2章 | 6-10 | 1.0 | 0.8 | 30-50 | 8-15 |
| 3章 | 11-15 | 1.2 | 0.9 | 55-90 | 15-25 |
| 4章 | 16-20 | 1.4 | 1.0 | 95-140 | 25-40 |
| 5章 | 21-25 | 1.6 | 1.1 | 150-220 | 40-60 |
| 6章 | 26-30 | 1.8 | 1.2 | 230-320 | 60-90 |

**精英怪：**
- HP = 普通怪 × 4
- 攻击 = 普通怪 × 1.5
- 经验 = 普通怪 × 5
- 金币 = 普通怪 × 3
- 必掉1件蓝装

**BOSS：**
- HP = 玩家同级HP × 8-12
- 攻击 = 玩家同级攻击 × 1.2-1.8
- 经验 = 500-1500（根据章节）
- 金币 = 100-500
- 必掉1件紫装 + 技能书（首次）

---

### 三、章节详细设计

#### 第4章：冰封雪域 (Lv16-20)

**地图：frozen_tundra.json**
```json
{
  "id": "tundra",
  "name": "冰封雪域",
  "subtitle": "刺骨寒风，冰霜覆盖的荒原",
  "width": 80,
  "height": 80,
  "theme": "ice",
  "recommended_level": 16,
  "next": "abyss",
  "requireBoss": "rift-boss"
}
```

**怪物配置：**

1. **冰霜狼** (frost_wolf)
   - 类型：melee, 速度3.2
   - HP：650 (Lv16), 攻击：75
   - 技能：冰冻撕咬（减速30%，3秒）
   - 刷新：群体5-8只

2. **雪地游侠** (snow_ranger)
   - 类型：ranged, 速度2.8, 射程10
   - HP：520, 攻击：68
   - 技能：冰箭（命中减速）
   - 刷新：2-3只配合狼群

3. **冰元素** (ice_elemental)
   - 类型：summoner, 速度2.5
   - HP：800, 攻击：60
   - 技能：召唤冰晶（2只小怪）
   - 刷新：单独或2只

4. **霜巨人** (frost_giant) - **精英**
   - 类型：charger, 速度3.5
   - HP：2600, 攻击：110
   - 技能：冰霜践踏（范围5格，眩晕1秒）
   - 刷新：地图3只

**BOSS：冰霜女王 (frost_queen)**

```typescript
{
  id: 'frost_queen',
  name: '冰霜女王·艾莎',
  level: 20,
  hp: 8000,
  attack: 120,
  defense: 45,
  behavior: 'shaman',
  
  skills: [
    {
      id: 'ice_lance',
      name: '冰枪突刺',
      type: 'projectile',
      damage: 150,
      range: 12,
      cooldown: 90, // 3秒
      windup: 15, // 0.5秒前摇
      特性: '穿透型，命中减速50%'
    },
    {
      id: 'blizzard',
      name: '暴风雪',
      type: 'zone',
      damage: 25,
      range: 10,
      radius: 6,
      cooldown: 240, // 8秒
      duration: 150, // 持续5秒
      windup: 30, // 1秒前摇
      特性: '全场AOE，持续伤害+减速'
    },
    {
      id: 'ice_prison',
      name: '寒冰牢笼',
      type: 'single',
      damage: 0,
      range: 15,
      cooldown: 300, // 10秒
      duration: 90, // 冰冻3秒
      windup: 20,
      特性: '定身玩家，需要移动破解'
    },
    {
      id: 'summon_wolves',
      name: '唤狼',
      type: 'summon',
      count: 3,
      cooldown: 450, // 15秒
      触发: '血量70%和40%时各召唤一次'
    }
  ],
  
  phases: [
    {
      phase: 1,
      hp_range: '100%-70%',
      pattern: '冰枪为主，偶尔暴风雪'
    },
    {
      phase: 2,
      hp_range: '70%-40%',
      trigger: '召唤3只冰霜狼',
      pattern: '增加寒冰牢笼，暴风雪频率提升'
    },
    {
      phase: 3,
      hp_range: '40%-0%',
      trigger: '再次召唤3只狼',
      pattern: '所有技能CD减半，狂暴'
    }
  ],
  
  rewards: {
    xp: 1200,
    gold: 300,
    guaranteed: [
      {type: 'gear', quality: 'rare', slot: 'weapon', name: '冰霜女王的权杖'},
      {type: 'skillbook', skill: 'ice_nova', name: '技能书：冰霜新星'}
    ],
    drops: [
      {type: 'gear', quality: 'rare', rate: 0.3},
      {type: 'material', item: '冰晶碎片', count: 10, rate: 1.0}
    ]
  }
}
```

#### 第5章：暗影深渊 (Lv21-25)

**地图：shadow_abyss.json**
```json
{
  "id": "abyss",
  "name": "暗影深渊",
  "subtitle": "黑暗侵蚀，亡灵复苏之地",
  "width": 96,
  "height": 96,
  "theme": "dark",
  "recommended_level": 21,
  "next": "dragonbone",
  "requireBoss": "tundra-boss",
  "环境机制": "黑暗侵蚀（每30秒扣除最大HP的2%）"
}
```

**怪物配置：**

1. **暗影潜行者** (shadow_stalker)
   - 类型：assassin, 速度5.5（超快）
   - HP：680, 攻击：105
   - 特性：隐身接近，暴击率50%
   - 刷新：单独2-3只

2. **骸骨法师** (bone_mage)
   - 类型：artillery, 速度2.5, 射程11
   - HP：750, 攻击：95
   - 技能：暗影箭（穿透），死亡诅咒（降低治疗）
   - 刷新：后排2-4只

3. **憎恶缝合怪** (abomination)
   - 类型：guard, 速度1.5（慢但肉）
   - HP：1800, 攻击：90
   - 特性：死亡爆炸（范围3格，伤害150）
   - 刷新：坦克型，2只

4. **暗影领主** (shadow_lord) - **精英**
   - 类型：summoner, 速度3.0
   - HP：3200, 攻击：125
   - 技能：召唤3只暗影潜行者，传送（15秒CD）
   - 刷新：地图4只

**BOSS：深渊之主·莫格斯**

```typescript
{
  id: 'abyss_lord',
  name: '深渊之主·莫格斯',
  level: 25,
  hp: 12000,
  attack: 145,
  defense: 60,
  behavior: 'summoner',
  
  特殊机制: '黑暗领域 - 战斗区域持续扣血，需站在光明祭坛恢复',
  
  skills: [
    {
      id: 'soul_drain',
      name: '灵魂汲取',
      type: 'projectile',
      damage: 180,
      effect: '吸取伤害50%转化为自身HP',
      cooldown: 120
    },
    {
      id: 'dark_ritual',
      name: '黑暗仪式',
      type: 'summon',
      count: 6,
      unit: 'skeleton_warrior',
      cooldown: 360,
      windup: 60, // 可打断！
      特性: '2秒前摇，打断可取消召唤'
    },
    {
      id: 'void_zone',
      name: '虚空领域',
      type: 'zone',
      damage: 40,
      radius: 5,
      count: 3, // 同时3个区域
      duration: 180,
      cooldown: 240
    },
    {
      id: 'death_mark',
      name: '死亡印记',
      type: 'debuff',
      effect: '标记玩家，5秒后爆炸造成300伤害',
      cooldown: 180,
      应对: '远离队友，分散站位'
    }
  ],
  
  mechanics: [
    {
      trigger: '战斗开始',
      effect: '场地生成4个光明祭坛，站上恢复HP并移除黑暗侵蚀'
    },
    {
      trigger: '血量60%和30%',
      effect: 'BOSS进入无敌状态，必须击杀召唤的6只骷髅才能解除'
    },
    {
      trigger: '狂暴计时8分钟',
      effect: 'BOSS攻击力+100%，技能CD减半'
    }
  ]
}
```

#### 第6章：龙骨荒漠 (Lv26-30) - 最终章

**地图：dragonbone_desert.json**
```json
{
  "id": "dragonbone",
  "name": "龙骨荒漠",
  "subtitle": "龙族陨落之地，远古之力苏醒",
  "width": 128,
  "height": 128,
  "theme": "desert_dragon",
  "recommended_level": 26,
  "final_chapter": true
}
```

**BOSS：远古龙王·巴哈姆特**

```typescript
{
  id: 'dragon_king',
  name: '远古龙王·巴哈姆特',
  level: 30,
  hp: 20000,
  attack: 180,
  defense: 85,
  behavior: 'boss',
  
  四阶段战斗: [
    {
      phase: 1,
      hp: '100%-75%',
      name: '地面形态',
      skills: ['龙息', '横扫', '践踏'],
      特点: '近战为主'
    },
    {
      phase: 2,
      hp: '75%-50%',
      name: '飞行形态',
      skills: ['俯冲轰炸', '火焰雨', '龙卷风'],
      特点: '远程压制，需要躲避'
    },
    {
      phase: 3,
      hp: '50%-25%',
      name: '狂怒形态',
      summon: '4只龙人守卫',
      skills: ['龙王怒吼（全屏AOE）', '连续龙息'],
      特点: '必须先清小怪'
    },
    {
      phase: 4,
      hp: '25%-0%',
      name: '灭世形态',
      ultimate: '毁灭吐息（蓄力5秒，秒杀技）',
      应对: '打断或躲到掩体后',
      特点: '所有技能混合使用'
    }
  ],
  
  rewards: {
    xp: 3000,
    gold: 1000,
    guaranteed: [
      {type: 'gear', quality: 'legendary', slot: 'weapon', name: '龙王之怒'},
      {type: 'gear', quality: 'legendary', slot: 'armor', name: '龙鳞铠甲'},
      {type: 'skillbook', skill: 'dragon_breath', name: '技能书：龙息术'},
      {type: 'achievement', name: '屠龙勇士'}
    ]
  }
}
```

---

### 四、装备掉落体系

#### 装备品质与概率

| 品质 | 颜色 | 基础属性 | 词缀数 | 掉落率 |
|------|------|----------|--------|--------|
| 普通 | 灰色 | 1条 | 0 | 60% |
| 魔法 | 蓝色 | 2条 | 1 | 30% |
| 稀有 | 紫色 | 3条 | 2-3 | 9% |
| 传说 | 金色 | 4条 | 3-4 | 1% |

#### 装备分布

**第1章（Lv1-5）：**
- 普通装备为主
- BOSS必掉1件蓝装

**第2章（Lv6-10）：**
- 蓝装开始常见
- 精英怪必掉蓝装
- BOSS掉落：1紫 + 1蓝

**第3章（Lv11-15）：**
- 紫装概率提升至15%
- BOSS掉落：1紫 + 1蓝 + 金币300

**第4-6章：**
- 紫装常见
- 金装开始出现
- 终章BOSS必掉2件金装

---

### 五、经济系统

#### 金币获取

| 来源 | 金币量 | 频率 |
|------|--------|------|
| 普通怪 | 3-15 | 每只 |
| 精英怪 | 30-60 | 较少 |
| BOSS | 200-1000 | 每次 |
| 宝箱 | 50-200 | 地图散落 |
| 出售装备 | 价值×0.4 | 主动 |

#### 金币消耗

| 项目 | 价格 | 说明 |
|------|------|------|
| 技能升级 | 100-1000 | 按等级递增 |
| 装备强化 | 50-500 | 按品质 |
| 传送 | 10 | 快速旅行 |
| 复活 | 50 | 战斗中复活 |
| 药水 | 10-50 | 消耗品 |

---

## 第二部分：前端需求文档（交付GPT）

### 需求概述

为"深渊行者"游戏实现3个新的主线副本章节及相关UI/UX改进。

### 前端实现清单

#### 1. 地图文件创建

需要创建以下Tiled地图JSON文件：

**文件列表：**
```
packages/content/maps/tundra.json          # 冰封雪域·普通
packages/content/maps/tundra-boss.json     # 冰封雪域·首领
packages/content/maps/abyss.json           # 暗影深渊·普通
packages/content/maps/abyss-boss.json      # 暗影深渊·首领
packages/content/maps/dragonbone.json      # 龙骨荒漠·普通
packages/content/maps/dragonbone-boss.json # 龙骨荒漠·首领
```

**地图规格参考：**
```json
{
  "type": "map",
  "width": 80,
  "height": 80,
  "tilewidth": 32,
  "tileheight": 32,
  "properties": [
    {"name": "id", "type": "string", "value": "tundra"},
    {"name": "name", "type": "string", "value": "冰封雪域"},
    {"name": "subtitle", "type": "string", "value": "刺骨寒风..."},
    {"name": "theme", "type": "string", "value": "ice"},
    {"name": "next", "type": "string", "value": "abyss"},
    {"name": "boss", "type": "bool", "value": false},
    {"name": "auto", "type": "bool", "value": true}
  ],
  "layers": [
    {
      "name": "spawns",
      "type": "objectgroup",
      "objects": [
        {
          "name": "frost_wolf",
          "type": "spawn",
          "x": 1024, "y": 1024,
          "properties": [
            {"name": "id", "value": "wolf_1"},
            {"name": "kind", "value": "melee"},
            {"name": "hp", "value": 650},
            {"name": "attack", "value": 75},
            {"name": "elite", "value": false},
            {"name": "art", "value": "frost_wolf"}
          ]
        }
      ]
    },
    {
      "name": "landmarks",
      "type": "objectgroup",
      "objects": [
        {
          "name": "安全点",
          "type": "landmark",
          "x": 512, "y": 512,
          "properties": [
            {"name": "kind", "value": "safe"}
          ]
        }
      ]
    }
  ]
}
```

#### 2. UI改进

**2.1 远行地图界面优化**

已完成原神风格，需要添加：
- 章节解锁动画
- 推荐等级显示
- 首次通关奖励预览
- 难度选择（普通/困难/噩梦）

**2.2 BOSS战UI**

需要新增：
```typescript
// BOSS血条组件
<div class="boss-health-bar">
  <div class="boss-portrait">[头像]</div>
  <div class="boss-info">
    <h3>冰霜女王·艾莎</h3>
    <div class="health-bar">
      <div class="hp-fill" style="width: 75%"></div>
      <span class="hp-text">6000 / 8000</span>
    </div>
    <div class="phase-indicator">阶段 2/3</div>
  </div>
</div>
```

**2.3 战斗警告系统**

```typescript
// 地面AOE预警
<div class="danger-zone" style="position: absolute; ...">
  <svg class="warning-circle" ...>
    <circle cx="50%" cy="50%" r="80" class="pulse-ring"/>
  </svg>
  <div class="countdown">2.5s</div>
</div>
```

**2.4 结算界面**

```typescript
<div class="dungeon-complete">
  <h2>副本完成！</h2>
  <div class="stats">
    <div>用时: 12:34</div>
    <div>击杀: 156</div>
    <div>死亡: 2</div>
  </div>
  <div class="rewards">
    <h3>奖励</h3>
    <div class="reward-grid">
      [装备卡片...]
      [金币图标] +300
      [经验条] +1200 XP
    </div>
  </div>
  <button class="primary">继续冒险</button>
</div>
```

#### 3. 动画与特效

**3.1 BOSS技能特效**

需要实现的Phaser特效：
- 冰枪投射轨迹（蓝色光束）
- 暴风雪粒子效果（雪花飘落）
- 寒冰牢笼（冰晶围绕玩家）
- 召唤法阵（地面光圈）

**示例代码框架：**
```typescript
// apps/web/src/effects.ts
export function createBlizzardEffect(scene: Phaser.Scene, x: number, y: number) {
  const particles = scene.add.particles('snowflake');
  const emitter = particles.createEmitter({
    x, y,
    speed: {min: 50, max: 100},
    scale: {start: 1, end: 0},
    alpha: {start: 0.8, end: 0},
    lifespan: 3000,
    blendMode: 'ADD'
  });
  
  return {
    stop: () => emitter.stop(),
    destroy: () => particles.destroy()
  };
}
```

#### 4. 声音效果

需要添加音效（如果有资源）：
- BOSS出场音效
- 技能释放音效
- 警告提示音
- 胜利音乐

---

## 第三部分：技术实现（集成方案）

### 步骤1：注册新地图

修改 `packages/content/index.ts`：

```typescript
import tundraMap from './maps/tundra.json';
import tundraBossMap from './maps/tundra-boss.json';
import abyssMap from './maps/abyss.json';
import abyssBossMap from './maps/abyss-boss.json';
import dragonboneMap from './maps/dragonbone.json';
import dragonboneBossMap from './maps/dragonbone-boss.json';

export const regions: Region[] = [
  townMap,
  meadowMap, meadowBossMap,
  forestMap, forestBossMap,
  riftMap, riftBossMap,
  tundraMap, tundraBossMap,      // 新增
  abyssMap, abyssBossMap,         // 新增
  dragonboneMap, dragonboneBossMap // 新增
].map(parseMap);
```

### 步骤2：怪物模板配置

创建 `packages/content/monster-templates.ts`：

```typescript
export const monsterTemplates = {
  frost_wolf: {
    kind: 'melee' as const,
    baseHp: 650,
    baseAttack: 75,
    speed: 3.2,
    art: 'frost_wolf'
  },
  // ... 其他怪物
};

export function createMonster(
  template: keyof typeof monsterTemplates,
  id: string,
  position: Vec,
  level: number
): Spawn {
  const t = monsterTemplates[template];
  return {
    id,
    kind: t.kind,
    name: template,
    x: position.x,
    y: position.y,
    hp: Math.floor(t.baseHp * (1 + (level - 16) * 0.08)),
    attack: Math.floor(t.baseAttack * (1 + (level - 16) * 0.06)),
    elite: false,
    boss: false,
    art: t.art
  };
}
```

### 步骤3：BOSS技能系统

扩展 `packages/simulation/index.ts` 的 `World` 类：

```typescript
// 添加BOSS技能逻辑
private bossCast(boss: Entity, skillId: string) {
  const h = this.hero.position;
  
  switch(skillId) {
    case 'blizzard':
      // 创建全场AOE
      this.zones.push({
        id: this.serial++,
        position: h,
        radius: 6,
        damage: 25,
        life: 150,
        delay: 30, // 1秒预警
        enemy: true,
        slow: true
      });
      break;
      
    case 'ice_prison':
      // 冰冻玩家
      if (distance(boss.position, h) < 15) {
        this.hero.frozen = this.tick + 90;
        this.events.push({
          type: 'status_changed',
          id: 'hero',
          position: h,
          tick: this.tick
        });
      }
      break;
  }
}
```

### 步骤4：战利品系统

创建 `packages/content/loot-tables.ts`：

```typescript
export const bossLootTables = {
  frost_queen: {
    guaranteed: [
      {
        type: 'gear',
        base: 'staff',
        name: '冰霜女王的权杖',
        quality: 'rare',
        attack: 95,
        affixes: [
          {stat: 'cold_damage', value: 25},
          {stat: 'mana', value: 50}
        ]
      },
      {
        type: 'skillbook',
        skill: 'ice_nova',
        quantity: 1
      }
    ],
    drops: [
      {type: 'gold', min: 250, max: 350},
      {type: 'material', item: 'ice_shard', count: 10}
    ]
  }
};
```

---

## 开发优先级

### Phase 1：核心功能（2周）
- [x] 创建3个新地图JSON
- [x] 怪物模板系统
- [x] BOSS技能框架
- [ ] 基础UI（血条、警告）

### Phase 2：战斗体验（1周）
- [ ] BOSS技能特效
- [ ] 战斗音效
- [ ] 阶段转换动画

### Phase 3：奖励系统（1周）
- [ ] 装备掉落
- [ ] 技能书系统
- [ ] 结算界面

### Phase 4：优化打磨（1周）
- [ ] 数值平衡
- [ ] UI动画
- [ ] 成就系统

---

## 数据埋点需求

```typescript
// 需要追踪的数据
{
  dungeon_enter: {章节ID, 难度, 玩家等级},
  dungeon_complete: {章节ID, 用时, 死亡次数, 击杀数},
  boss_phase: {BOSS_ID, 阶段, 耗时},
  player_death: {位置, 死因, BOSS血量%},
  loot_obtained: {物品ID, 品质, 来源}
}
```

---

## 附件清单

1. **美术资源需求清单** (待补充)
   - 怪物Spine动画
   - 技能特效贴图
   - 地图tile素材

2. **音效资源需求清单** (待补充)
   - BOSS技能音效
   - 环境音效
   - 战斗音乐

---

**文档版本**: v1.0  
**创建日期**: 2026-09-30  
**负责人**: AI设计师 + GPT前端开发

