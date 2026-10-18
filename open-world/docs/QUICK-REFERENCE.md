# 🎮 深渊行者 - 快速参考卡

## 📂 文件位置速查

### 怪物系统
```
packages/content/monsters.ts          # 怪物模板定义
```

### 地图配置
```
packages/content/maps/tundra.json          # 第4章主地图
packages/content/maps/tundra-boss.json     # 冰霜女王BOSS房
packages/content/maps/abyss.json           # 第5章主地图
packages/content/maps/abyss-boss.json      # 深渊之主BOSS房
packages/content/maps/dragonbone.json      # 第6章主地图
packages/content/maps/dragonbone-boss.json # 远古龙王BOSS房
```

### 技能系统
```
packages/content/skill-system.ts       # 技能类型定义
packages/content/skills-complete.ts    # 79个技能实现
packages/content/skill-database.ts     # 技能树系统
apps/web/public/skills-complete-data.json  # JSON数据
```

### 文档
```
docs/chapters-monsters-complete.md     # 完整配置文档
docs/CONFIGURATION-COMPLETE.md         # 配置完成报告
docs/ui-design-system.md               # UI设计规范
```

### 可视化工具
```
apps/web/chapters-config-tool.html     # 关卡配置工具
apps/web/skill-config-tool.html        # 技能配置工具
```

---

## 🐉 怪物速查表

| ID | 名称 | 行为 | 等级 | HP | 攻击 | 技能 |
|---|------|------|------|----|----|------|
| **第4章** |
| `frost_wolf` | 冰霜狼 | melee | 16-17 | 180 | 22 | 冰冻撕咬 |
| `snow_ranger` | 雪地游侠 | ranged | 17-18 | 160 | 26 | 寒冰箭 |
| `ice_elemental` | 冰元素 | shaman | 18-19 | 150 | 30 | 冰锥术 |
| `frost_giant` | 霜巨人⭐ | guard | 19-20 | 320 | 35 | 冰霜践踏 |
| **第5章** |
| `shadow_stalker` | 暗影潜行者 | assassin | 21-22 | 220 | 32 | 背刺 |
| `bone_mage` | 骸骨法师 | shaman | 22-23 | 200 | 38 | 白骨之矛 |
| `abomination` | 憎恶缝合怪 | guard | 23-24 | 450 | 40 | 死亡爆炸 |
| `shadow_lord` | 暗影领主⭐ | summoner | 24-25 | 420 | 45 | 召唤亡灵 |
| **第6章** |
| `dragon_whelp` | 幼龙 | charger | 26-27 | 280 | 42 | 火焰吐息 |
| `dragon_guard` | 龙人守卫 | guard | 27-28 | 350 | 48 | 盾击 |
| `dragon_priest` | 龙祭司⭐ | shaman | 28-29 | 320 | 55 | 龙之祝福 |

---

## 👑 BOSS速查表

### 冰霜女王·艾莎 (Lv20, 8000 HP)
```typescript
ID: 'frost_queen'
Art: 'frost_queen'
形态: 3个
核心技能: 暴风雪 (6格AOE, 持续5秒)
关键机制: 红圈预警 → 躲避
```

### 深渊之主·莫格斯 (Lv25, 15000 HP)
```typescript
ID: 'abyss_lord'
Art: 'abyss_lord'
形态: 3个
核心技能: 黑暗仪式 (5秒施法, 可打断)
关键机制: 打断施法 + 躲避虚空领域
```

### 远古龙王·巴哈姆特 (Lv30, 30000 HP)
```typescript
ID: 'ancient_dragon_king'
Art: 'ancient_dragon_king'
形态: 4个
核心技能: 毁灭吐息 (终极技, 必杀)
关键机制: 掩体系统 (4个掩体岩石)
```

---

## 🗺️ 地图速查表

| 地图ID | 名称 | 尺寸 | 怪物数 | 特殊机制 |
|--------|------|------|--------|----------|
| `tundra` | 冰封雪域 | 64×64 | 20 | - |
| `tundra-boss` | 冰霜王座 | 48×48 | 1 | 空旷AOE战 |
| `abyss` | 暗影深渊 | 64×64 | 20 | 4个光明祭坛 |
| `abyss-boss` | 深渊祭坛 | 48×48 | 1 | 4个光明祭坛 |
| `dragonbone` | 龙骨荒漠 | 72×72 | 20 | 龙骨地标 |
| `dragonbone-boss` | 龙王陵墓 | 64×64 | 1 | 4个掩体岩石 |

---

## 💻 代码示例

### 生成怪物
```typescript
import { getMonsterTemplate, createMonsterSpawn } from '@content/monsters';

const template = getMonsterTemplate('frost_wolf');
const spawn = createMonsterSpawn(template, 16, { x: 20, y: 50 });

// 结果: { id: 'frost_wolf_20_50', kind: 'melee', hp: 180, attack: 22, ... }
```

### 获取地图
```typescript
import { regionById } from '@content/index';

const tundra = regionById('tundra');
console.log(tundra.spawns); // 20个怪物spawn点
```

### 查询技能
```typescript
import { allSkills, getSkillsByCategory } from '@content/skills-complete';

const meleeSkills = getSkillsByCategory('melee'); // 15个近战技能
const skill = allSkills.find(s => s.id === 'frost_blade');
```

---

## 🎯 关键数值

### 怪物HP倍率
```
第4章: 180-410 HP  (基准)
第5章: 220-565 HP  (+38%)
第6章: 280-450 HP  (+12%)
```

### BOSS HP
```
第4章: 8,000 HP
第5章: 15,000 HP  (×1.88)
第6章: 30,000 HP  (×2.00)
```

### 技能冷却（30Hz ticks）
```
普通技能: 120-180 ticks (4-6秒)
精英技能: 240 ticks (8秒)
BOSS核心: 240-360 ticks (8-12秒)
BOSS终极: 600 ticks (20秒)
```

---

## 🔧 常用命令

### 查看配置工具
```bash
# 浏览器打开
http://127.0.0.1:8612/chapters-config-tool.html
http://127.0.0.1:8612/skill-config-tool.html
```

### 运行游戏
```bash
cd g:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world
pnpm dev
```

---

## ⚠️ 重要提醒

### 预警系统必须实现
- ✅ 红色光圈 (AOE预警)
- ✅ 蓝色光圈 (控制预警)
- ✅ 屏幕倒计时 (致命技能)
- ✅ 蓄力条 (可打断技能)

### 掩体系统必须实现
- ✅ 射线碰撞检测
- ✅ 4个掩体位置固定
- ✅ 掩体无法破坏
- ✅ 躲在后方完全免疫

### 光明祭坛（第5章）
- ✅ 可激活/冷却机制
- ✅ 提供短暂庇护
- ✅ 视觉效果（光柱）

---

## 📊 数据统计

```
新增怪物: 11种
新增BOSS: 3个
新增地图: 6个
总技能数: 79个
文档页数: 500+ 行
配置时间: 2026-09-30
```

---

## 🎮 工具链接

- **关卡配置工具:** `apps/web/chapters-config-tool.html`
- **技能配置工具:** `apps/web/skill-config-tool.html`
- **怪物验收页面:** `apps/web/monster-art-qa.html`
- **UI展示页面:** `apps/web/ui-v2-showcase.html`

---

**快速参考 v1.0**  
**更新日期: 2026-09-30**
