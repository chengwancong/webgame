# 深渊行者 - 前端开发需求文档

> 给 GPT 的开发任务清单
> 基于策划提供的数值设计，实现3个新主线副本

---

## 任务概览

为"深渊行者"游戏添加3个新的主线副本章节：
- 第4章：冰封雪域 (Lv16-20)
- 第5章：暗影深渊 (Lv21-25)  
- 第6章：龙骨荒漠 (Lv26-30)

---

## 任务1：创建地图文件

### 需要创建的文件

在 `packages/content/maps/` 目录下创建6个地图JSON文件：

#### 1.1 冰封雪域·普通 - `tundra.json`

```json
{
  "type": "map",
  "version": "1.10",
  "tiledversion": "1.12.2",
  "orientation": "orthogonal",
  "renderorder": "right-down",
  "width": 80,
  "height": 80,
  "tilewidth": 32,
  "tileheight": 32,
  "infinite": false,
  "properties": [
    {"name": "id", "type": "string", "value": "tundra"},
    {"name": "name", "type": "string", "value": "冰封雪域"},
    {"name": "subtitle", "type": "string", "value": "刺骨寒风，冰霜覆盖的荒原"},
    {"name": "theme", "type": "string", "value": "ice"},
    {"name": "next", "type": "string", "value": "abyss"},
    {"name": "requireBoss", "type": "string", "value": "rift-boss"},
    {"name": "boss", "type": "bool", "value": false},
    {"name": "auto", "type": "bool", "value": true}
  ],
  "layers": [
    {
      "id": 1,
      "name": "spawns",
      "type": "objectgroup",
      "visible": true,
      "objects": [
        {
          "id": 1,
          "name": "frost_wolf_1",
          "type": "spawn",
          "x": 1024,
          "y": 1024,
          "width": 32,
          "height": 32,
          "properties": [
            {"name": "id", "type": "string", "value": "wolf_1"},
            {"name": "kind", "type": "string", "value": "melee"},
            {"name": "name", "type": "string", "value": "冰霜狼"},
            {"name": "hp", "type": "int", "value": 650},
            {"name": "attack", "type": "int", "value": 75},
            {"name": "elite", "type": "bool", "value": false},
            {"name": "boss", "type": "bool", "value": false},
            {"name": "art", "type": "string", "value": "xiaolang"}
          ]
        },
        {
          "id": 2,
          "name": "frost_wolf_2",
          "type": "spawn",
          "x": 1088,
          "y": 1024,
          "width": 32,
          "height": 32,
          "properties": [
            {"name": "id", "type": "string", "value": "wolf_2"},
            {"name": "kind", "type": "string", "value": "melee"},
            {"name": "name", "type": "string", "value": "冰霜狼"},
            {"name": "hp", "type": "int", "value": 650},
            {"name": "attack", "type": "int", "value": 75},
            {"name": "elite", "type": "bool", "value": false},
            {"name": "boss", "type": "bool", "value": false},
            {"name": "art", "type": "string", "value": "xiaolang"}
          ]
        },
        {
          "id": 3,
          "name": "snow_ranger",
          "type": "spawn",
          "x": 1536,
          "y": 1280,
          "width": 32,
          "height": 32,
          "properties": [
            {"name": "id", "type": "string", "value": "ranger_1"},
            {"name": "kind", "type": "string", "value": "ranged"},
            {"name": "name", "type": "string", "value": "雪地游侠"},
            {"name": "hp", "type": "int", "value": 520},
            {"name": "attack", "type": "int", "value": 68},
            {"name": "elite", "type": "bool", "value": false},
            {"name": "boss", "type": "bool", "value": false},
            {"name": "art", "type": "string", "value": "huoqiang"}
          ]
        },
        {
          "id": 4,
          "name": "frost_giant",
          "type": "spawn",
          "x": 2048,
          "y": 1536,
          "width": 32,
          "height": 32,
          "properties": [
            {"name": "id", "type": "string", "value": "giant_1"},
            {"name": "kind", "type": "string", "value": "charger"},
            {"name": "name", "type": "string", "value": "霜巨人"},
            {"name": "hp", "type": "int", "value": 2600},
            {"name": "attack", "type": "int", "value": 110},
            {"name": "elite", "type": "bool", "value": true},
            {"name": "boss", "type": "bool", "value": false},
            {"name": "art", "type": "string", "value": "duyanjuren"}
          ]
        }
      ]
    },
    {
      "id": 2,
      "name": "landmarks",
      "type": "objectgroup",
      "visible": true,
      "objects": [
        {
          "id": 10,
          "name": "安全点",
          "type": "landmark",
          "x": 512,
          "y": 512,
          "width": 64,
          "height": 64,
          "properties": [
            {"name": "kind", "type": "string", "value": "safe"}
          ]
        },
        {
          "id": 11,
          "name": "传送门",
          "type": "landmark",
          "x": 512,
          "y": 640,
          "width": 64,
          "height": 64,
          "properties": [
            {"name": "kind", "type": "string", "value": "portal"}
          ]
        },
        {
          "id": 12,
          "name": "首领入口",
          "type": "landmark",
          "x": 2304,
          "y": 2304,
          "width": 64,
          "height": 64,
          "properties": [
            {"name": "kind", "type": "string", "value": "bossPortal"}
          ]
        }
      ]
    },
    {
      "id": 3,
      "name": "obstacles",
      "type": "objectgroup",
      "visible": true,
      "objects": [
        {
          "id": 20,
          "name": "wall",
          "type": "obstacle",
          "x": 0,
          "y": 0,
          "width": 2560,
          "height": 32
        },
        {
          "id": 21,
          "name": "wall",
          "type": "obstacle",
          "x": 0,
          "y": 0,
          "width": 32,
          "height": 2560
        },
        {
          "id": 22,
          "name": "wall",
          "type": "obstacle",
          "x": 2528,
          "y": 0,
          "width": 32,
          "height": 2560
        },
        {
          "id": 23,
          "name": "wall",
          "type": "obstacle",
          "x": 0,
          "y": 2528,
          "width": 2560,
          "height": 32
        }
      ]
    }
  ]
}
```

**关键点：**
- 怪物配置：至少30-50只小怪分散在地图
- 精英怪：3-5只
- 安全点：起始位置 (x: 512, y: 512)
- 传送门：返回城镇
- 首领入口：通往BOSS房间

#### 1.2 冰封雪域·首领 - `tundra-boss.json`

```json
{
  "type": "map",
  "width": 48,
  "height": 48,
  "properties": [
    {"name": "id", "type": "string", "value": "tundra-boss"},
    {"name": "name", "type": "string", "value": "冰霜王座"},
    {"name": "subtitle", "type": "string", "value": "冰霜女王的领域"},
    {"name": "theme", "type": "string", "value": "ice_boss"},
    {"name": "boss", "type": "bool", "value": true},
    {"name": "auto", "type": "bool", "value": false}
  ],
  "layers": [
    {
      "name": "spawns",
      "type": "objectgroup",
      "objects": [
        {
          "id": 1,
          "name": "frost_queen",
          "type": "spawn",
          "x": 768,
          "y": 768,
          "properties": [
            {"name": "id", "type": "string", "value": "boss_frost_queen"},
            {"name": "kind", "type": "string", "value": "shaman"},
            {"name": "name", "type": "string", "value": "冰霜女王·艾莎"},
            {"name": "hp", "type": "int", "value": 8000},
            {"name": "attack", "type": "int", "value": 120},
            {"name": "elite", "type": "bool", "value": false},
            {"name": "boss", "type": "bool", "value": true},
            {"name": "art", "type": "string", "value": "samannvwu"}
          ]
        }
      ]
    },
    {
      "name": "landmarks",
      "type": "objectgroup",
      "objects": [
        {
          "id": 10,
          "name": "入口",
          "type": "landmark",
          "x": 256,
          "y": 768,
          "properties": [
            {"name": "kind", "type": "string", "value": "safe"}
          ]
        }
      ]
    }
  ]
}
```

#### 1.3-1.6 其他地图

按照同样的格式创建：
- `abyss.json` - 暗影深渊·普通 (96x96)
- `abyss-boss.json` - 暗影深渊·首领
- `dragonbone.json` - 龙骨荒漠·普通 (128x128)
- `dragonbone-boss.json` - 龙骨荒漠·首领

**怪物配置参考：**

暗影深渊怪物：
```
shadow_stalker: kind=assassin, hp=680, attack=105, art=wushi
bone_mage: kind=artillery, hp=750, attack=95, art=kuloufashi
abomination: kind=guard, hp=1800, attack=90, art=duyanjuren
```

龙骨荒漠怪物：
```
dragon_whelp: kind=melee, hp=900, attack=125, art=xiaolang
dragon_guard: kind=charger, hp=1200, attack=135, art=dijinglieshou
dragon_king: kind=boss, hp=20000, attack=180, art=chilongwang (BOSS)
```

---

## 任务2：注册新地图

修改 `packages/content/index.ts`：

```typescript
// 在文件顶部添加导入
import tundraMap from './maps/tundra.json';
import tundraBossMap from './maps/tundra-boss.json';
import abyssMap from './maps/abyss.json';
import abyssBossMap from './maps/abyss-boss.json';
import dragonboneMap from './maps/dragonbone.json';
import dragonboneBossMap from './maps/dragonbone-boss.json';

// 修改 regions 数组
export const regions: Region[] = [
  townMap,
  meadowMap, meadowBossMap,
  forestMap, forestBossMap,
  riftMap, riftBossMap,
  tundraMap, tundraBossMap,           // 新增
  abyssMap, abyssBossMap,             // 新增
  dragonboneMap, dragonboneBossMap    // 新增
].map(parseMap);
```

---

## 任务3：UI增强 - BOSS血条

创建文件 `apps/web/src/boss-ui.css`：

```css
/* BOSS血条 */
.boss-health-container {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 50;
  background: linear-gradient(135deg, #1a1f2eee, #0f141fee);
  border: 2px solid #ff4444;
  border-radius: 16px;
  padding: 16px 24px;
  min-width: 500px;
  box-shadow: 0 8px 32px rgba(255, 68, 68, 0.3);
  opacity: 0;
  transition: opacity 0.5s;
}

.boss-health-container.visible {
  opacity: 1;
}

.boss-header {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.boss-portrait {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 3px solid #ff4444;
  background: linear-gradient(135deg, #ff6b6b, #ff4444);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 0 20px rgba(255, 68, 68, 0.5);
}

.boss-info {
  flex: 1;
}

.boss-name {
  font-size: 20px;
  font-weight: 800;
  color: #ffe4e4;
  text-shadow: 0 2px 8px rgba(255, 68, 68, 0.8);
  margin-bottom: 4px;
}

.boss-health-bar {
  position: relative;
  width: 100%;
  height: 32px;
  background: linear-gradient(90deg, #2a1a1a, #1a0a0a);
  border: 2px solid #ff4444;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.8);
}

.boss-hp-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(90deg, #ff6b6b, #ff4444, #cc0000);
  transition: width 0.3s ease-out;
  box-shadow: 0 0 16px rgba(255, 68, 68, 0.8);
}

.boss-hp-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #fff;
  font-weight: 700;
  font-size: 14px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
  z-index: 1;
}

.boss-phase {
  margin-top: 8px;
  font-size: 12px;
  color: #ffaaaa;
  text-align: center;
  font-weight: 600;
}

.boss-phase.warning {
  color: #ffcc00;
  animation: pulse 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

在 `apps/web/src/presentation.ts` 中添加BOSS血条逻辑：

```typescript
// 在 export function render() 函数中添加

// BOSS血条显示
const boss = w.enemies.find(e => e.boss && e.alive);
const bossBar = $('#boss-health-bar');

if (boss) {
  if (!bossBar.classList.contains('visible')) {
    bossBar.classList.add('visible');
  }
  
  const hpPercent = (boss.hp / boss.maxHp * 100).toFixed(1);
  const phase = boss.hp > boss.maxHp * 0.7 ? 1 : boss.hp > boss.maxHp * 0.4 ? 2 : 3;
  
  bossBar.innerHTML = `
    <div class="boss-header">
      <div class="boss-portrait">👑</div>
      <div class="boss-info">
        <div class="boss-name">${esc(boss.name)}</div>
      </div>
    </div>
    <div class="boss-health-bar">
      <div class="boss-hp-fill" style="width: ${hpPercent}%"></div>
      <span class="boss-hp-text">${boss.hp} / ${boss.maxHp}</span>
    </div>
    <div class="boss-phase ${phase === 3 ? 'warning' : ''}">
      阶段 ${phase}/3
    </div>
  `;
} else {
  bossBar.classList.remove('visible');
}
```

在 `apps/web/index.html` 中添加：

```html
<div id="boss-health-bar" class="boss-health-container"></div>
```

---

## 任务4：地面AOE预警

创建文件 `apps/web/src/danger-zones.ts`：

```typescript
export function renderDangerZones(world: World, container: HTMLElement) {
  // 清除旧的警告
  container.querySelectorAll('.danger-zone').forEach(el => el.remove());
  
  // 渲染新的警告区域
  world.zones.filter(z => z.enemy && z.delay > 0).forEach(zone => {
    const div = document.createElement('div');
    div.className = 'danger-zone';
    div.style.cssText = `
      position: absolute;
      left: ${zone.position.x * 32 - zone.radius * 32}px;
      top: ${zone.position.y * 32 - zone.radius * 32}px;
      width: ${zone.radius * 2 * 32}px;
      height: ${zone.radius * 2 * 32}px;
      pointer-events: none;
      z-index: 10;
    `;
    
    div.innerHTML = `
      <svg width="100%" height="100%" style="position: absolute;">
        <circle 
          cx="50%" 
          cy="50%" 
          r="${zone.radius * 32 - 10}" 
          fill="rgba(255, 68, 68, 0.2)"
          stroke="#ff4444"
          stroke-width="3"
          stroke-dasharray="10,5"
          class="pulse-ring"
        />
      </svg>
      <div class="countdown">${(zone.delay / 30).toFixed(1)}s</div>
    `;
    
    container.appendChild(div);
  });
}
```

CSS样式：

```css
.danger-zone {
  animation: danger-pulse 1s infinite;
}

.danger-zone .countdown {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #ff4444;
  font-size: 24px;
  font-weight: 800;
  text-shadow: 0 0 10px rgba(255, 68, 68, 0.8),
               0 2px 4px rgba(0, 0, 0, 0.8);
}

@keyframes danger-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.6;
    transform: scale(1.05);
  }
}

.pulse-ring {
  animation: ring-pulse 1s infinite;
}

@keyframes ring-pulse {
  0% {
    stroke-opacity: 1;
  }
  50% {
    stroke-opacity: 0.5;
  }
  100% {
    stroke-opacity: 1;
  }
}
```

---

## 任务5：副本完成界面

在 `apps/web/src/presentation.ts` 中添加：

```typescript
// 副本完成检测
if (view.panel === '' && w.region.boss && w.enemies.every(e => !e.alive || e.boss)) {
  const boss = w.enemies.find(e => e.boss);
  if (boss && !boss.alive) {
    view.panel = 'dungeon-complete';
  }
}

// 副本完成界面
if (view.panel === 'dungeon-complete') {
  title = '副本完成！';
  const timeSpent = Math.floor(w.tick / 30);
  const minutes = Math.floor(timeSpent / 60);
  const seconds = timeSpent % 60;
  
  body = `
    <div class="dungeon-complete-content">
      <div class="victory-icon">🏆</div>
      <h2 class="victory-text">胜利！</h2>
      
      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-label">用时</div>
          <div class="stat-value">${minutes}:${seconds.toString().padStart(2, '0')}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">击杀</div>
          <div class="stat-value">${w.kills.length}</div>
        </div>
        <div class="stat-box">
          <div class="stat-label">等级</div>
          <div class="stat-value">${s.level}</div>
        </div>
      </div>
      
      <div class="rewards-section">
        <h3>奖励</h3>
        <div class="reward-cards">
          <div class="reward-card gold">
            <div class="reward-icon">💰</div>
            <div class="reward-text">+300 金币</div>
          </div>
          <div class="reward-card xp">
            <div class="reward-icon">⭐</div>
            <div class="reward-text">+1200 经验</div>
          </div>
        </div>
      </div>
      
      <div class="actions">
        <button class="primary" data-action="travel" data-id="town">返回城镇</button>
        <button data-action="panel" data-id="">继续探索</button>
      </div>
    </div>
  `;
}
```

CSS样式：

```css
.dungeon-complete-content {
  text-align: center;
  padding: 2rem;
}

.victory-icon {
  font-size: 80px;
  margin-bottom: 1rem;
  animation: bounce 1s infinite;
}

@keyframes bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.victory-text {
  font-size: 36px;
  color: #ffd700;
  text-shadow: 0 4px 8px rgba(255, 215, 0, 0.5);
  margin-bottom: 2rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-box {
  background: linear-gradient(135deg, #2a3441, #1a2431);
  border: 2px solid #38BDF8;
  border-radius: 12px;
  padding: 1rem;
}

.stat-label {
  font-size: 14px;
  color: #9BA5B0;
  margin-bottom: 0.5rem;
}

.stat-value {
  font-size: 28px;
  font-weight: 800;
  color: #38BDF8;
}

.rewards-section h3 {
  font-size: 20px;
  margin-bottom: 1rem;
  color: #E8EDF2;
}

.reward-cards {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.reward-card {
  background: linear-gradient(135deg, #2a3441, #1a2431);
  border: 2px solid #ffd700;
  border-radius: 12px;
  padding: 1.5rem;
  min-width: 150px;
}

.reward-icon {
  font-size: 48px;
  margin-bottom: 0.5rem;
}

.reward-text {
  font-size: 16px;
  font-weight: 600;
  color: #ffd700;
}
```

---

## 任务6：测试清单

完成开发后，请测试以下项目：

- [ ] 新地图可以正常进入
- [ ] 怪物正确生成并可战斗
- [ ] BOSS血条正确显示
- [ ] BOSS血量低于70%/40%时有阶段提示
- [ ] 地面AOE有红圈预警
- [ ] 击败BOSS后显示完成界面
- [ ] 完成界面数据正确（用时、击杀数）
- [ ] 可以从完成界面返回城镇
- [ ] 远行界面显示新章节
- [ ] 新章节需要通关前置BOSS才能解锁

---

## 开发提示

1. **复用现有怪物美术**：暂时使用现有的 art 资源（xiaolang, wushi等）
2. **地图大小建议**：普通副本 80x80 或更大，BOSS房 48x48
3. **怪物密度**：每1000格约放置10-15只怪物
4. **精英怪标识**：`elite: true` 会让怪物更强
5. **BOSS标识**：`boss: true` 会触发特殊UI

---

## 交付标准

1. ✅ 6个地图JSON文件已创建
2. ✅ 新地图已注册到 `index.ts`
3. ✅ BOSS血条UI已实现
4. ✅ 危险区域预警已实现
5. ✅ 副本完成界面已实现
6. ✅ 所有功能经过测试

---

**优先级**: 高  
**预计工时**: 8-12小时  
**难度**: 中等

