> 历史讨论稿，不能作为当前装备接口实现。旧整数百分比示例未上线；当前唯一生成器、单位合同和强化公式见 [装备口径](gear-affixes.md)。

# 深渊行者 - 前后端任务分工方案

**目的：** 明确区分前端（GPT负责）和后端（Claude负责）的开发任务  
**原则：** 前端负责UI/UX/视觉/交互，后端负责逻辑/数据/规则/平衡

---

## 🎨 前端职责（GPT）

### 核心范围
- **UI组件开发** - HTML/CSS/React组件
- **视觉效果** - 动画、粒子、特效
- **交互逻辑** - 点击、拖拽、快捷键
- **布局响应式** - 适配不同分辨率
- **美术集成** - Spine动画、图片资源

### 不涉及
- ❌ 游戏规则逻辑
- ❌ 数值计算
- ❌ 数据库操作
- ❌ API接口设计

---

## ⚙️ 后端职责（Claude）

### 核心范围
- **游戏核心逻辑** - TypeScript战斗系统
- **数据模型设计** - Schema、类型定义
- **API接口** - Fastify路由、验证
- **数据库操作** - PostgreSQL增删改查
- **规则与平衡** - 数值设计、掉落表

### 不涉及
- ❌ CSS样式
- ❌ UI组件结构
- ❌ 视觉特效
- ❌ 响应式布局

---

## 📦 优先级 1：新手引导系统

### 前端任务（GPT）

#### 1.1 教程遮罩组件
```typescript
// apps/web/src/components/Tutorial.tsx
export function TutorialOverlay({ step }: { step: TutorialStep }) {
  return (
    <div className="tutorial-overlay">
      <div className="tutorial-spotlight" style={{ /* 高亮目标元素 */ }} />
      <div className="tutorial-card">
        <h3>{step.title}</h3>
        <p>{step.description}</p>
        <button onClick={step.onNext}>下一步</button>
      </div>
    </div>
  );
}
```

**文件：**
- `apps/web/src/components/Tutorial.tsx` - 教程组件
- `apps/web/src/tutorial.css` - 教程样式
- `apps/web/src/components/TutorialArrow.tsx` - 箭头指示器

**工作量：** 2-3天

---

### 后端任务（Claude）

#### 1.2 教程进度追踪
```typescript
// packages/contracts/index.ts
export type TutorialProgress = {
  completed: string[];  // 已完成的教程步骤ID
  current: string;      // 当前步骤
  skipped: boolean;     // 是否跳过教程
}

// 数据库表
CREATE TABLE tutorial_progress (
  player_id UUID PRIMARY KEY REFERENCES players(id),
  completed TEXT[] DEFAULT '{}',
  current TEXT DEFAULT 'welcome',
  skipped BOOLEAN DEFAULT false,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**文件：**
- `packages/contracts/index.ts` - 类型定义
- `apps/server/src/routes/tutorial.ts` - API路由
- `apps/server/migrations/XXX_tutorial_progress.sql` - 数据库迁移

**工作量：** 1-2天

---

## 📦 优先级 2：装备词缀&套装系统

### 前端任务（GPT）

#### 2.1 装备卡片UI重构
```typescript
// apps/web/src/components/GearCard.tsx
export function GearCard({ gear }: { gear: Gear }) {
  const qualityColor = {
    common: '#9e9e9e',
    magic: '#2196f3',
    rare: '#ffeb3b',
    legendary: '#ff9800',
  }[gear.quality];

  return (
    <div className="gear-card" style={{ borderColor: qualityColor }}>
      <div className="gear-icon">{/* 图标 */}</div>
      <h4 style={{ color: qualityColor }}>{gear.name}</h4>
      
      {/* 主属性 */}
      <div className="gear-stats">
        <span>攻击 +{gear.attack}</span>
        <span>护甲 +{gear.armor}</span>
      </div>
      
      {/* 词缀列表 */}
      <div className="gear-affixes">
        {gear.affixes?.map(affix => (
          <div key={affix.id} className={`affix tier-${affix.tier}`}>
            {affix.name} +{affix.value}
          </div>
        ))}
      </div>
      
      {/* 套装提示 */}
      {gear.setId && (
        <div className="gear-set">
          套装：{gear.setName} ({gear.setCount}/3)
        </div>
      )}
    </div>
  );
}
```

**文件：**
- `apps/web/src/components/GearCard.tsx` - 装备卡片
- `apps/web/src/components/GearComparison.tsx` - 装备对比面板
- `apps/web/src/components/SetBonus.tsx` - 套装加成显示
- `apps/web/src/gear.css` - 装备样式

**工作量：** 3-4天

---

### 后端任务（Claude）

#### 2.2 词缀系统核心
```typescript
// packages/content/affixes.ts
export type GearAffix = {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  stat: keyof Stats | 'special';
  value: number;
  weight: number;  // 掉落权重
}

export const affixPool: GearAffix[] = [
  { id: 'crit', name: '暴击', tier: 2, stat: 'critChance', value: 15, weight: 10 },
  { id: 'lifesteal', name: '吸血', tier: 1, stat: 'lifesteal', value: 8, weight: 3 },
  { id: 'cooldown', name: '冷却', tier: 2, stat: 'cdr', value: 10, weight: 8 },
  // ...更多词缀
];

// 词缀生成算法
export function generateAffixes(
  quality: GearQuality,
  level: number
): GearAffix[] {
  const count = { common: 0, magic: 1, rare: 2, legendary: 3 }[quality];
  // 加权随机抽取
  // ...
}

// packages/content/sets.ts
export type GearSet = {
  id: string;
  name: string;
  pieces: string[];  // 基础装备ID列表
  bonuses: {
    pieces: 2 | 3 | 4 | 6;
    effect: string;
    stats?: Partial<Stats>;
    special?: string;  // 特殊效果ID
  }[];
}

export const gearSets: GearSet[] = [
  {
    id: 'berserker',
    name: '狂战士',
    pieces: ['berserker_weapon', 'berserker_armor', 'berserker_accessory'],
    bonuses: [
      { pieces: 2, effect: '攻击速度 +15%', stats: { speed: 0.9 }},
      { pieces: 3, effect: '低血量时伤害 +50%', special: 'berserker_rage' },
    ]
  },
  // ...更多套装
];
```

**文件：**
- `packages/content/affixes.ts` - 词缀定义
- `packages/content/sets.ts` - 套装定义
- `packages/contracts/index.ts` - 更新Gear类型
- `packages/simulation/stats.ts` - 套装加成计算
- `apps/server/src/loot.ts` - 掉落生成逻辑
- `apps/server/migrations/XXX_gear_affixes.sql` - 数据库升级

**工作量：** 5-7天

---

## 📦 优先级 3：反馈系统强化

### 前端任务（GPT）

#### 3.1 飘字系统
```typescript
// apps/web/src/components/FloatingText.tsx
export function FloatingText({ 
  value, 
  type, 
  position 
}: { 
  value: number | string;
  type: 'damage' | 'heal' | 'crit' | 'level_up';
  position: Vec;
}) {
  const style = {
    damage: { color: '#ff5555', size: 24, animation: 'bounce' },
    crit: { color: '#ffaa00', size: 32, animation: 'explode' },
    heal: { color: '#55ff55', size: 20, animation: 'fade' },
    level_up: { color: '#ffd700', size: 40, animation: 'zoom' },
  }[type];

  return (
    <div 
      className={`floating-text floating-${type}`}
      style={{
        left: position.x,
        top: position.y,
        color: style.color,
        fontSize: style.size,
        animation: `${style.animation} 0.8s ease-out`,
      }}
    >
      {type === 'crit' && '💥'} {value}
    </div>
  );
}
```

#### 3.2 粒子效果系统
```typescript
// apps/web/src/effects/ParticleSystem.ts
export class ParticleEmitter {
  emit(type: 'hit' | 'crit' | 'level_up', position: Vec) {
    const config = {
      hit: { count: 5, texture: 'spark', speed: 2 },
      crit: { count: 20, texture: 'star', speed: 4 },
      level_up: { count: 50, texture: 'light', speed: 3 },
    }[type];
    
    // 使用Phaser粒子系统
    // ...
  }
}
```

#### 3.3 屏幕震动
```typescript
// apps/web/src/effects/ScreenShake.ts
export function screenShake(intensity: number, duration: number) {
  const camera = scene.cameras.main;
  camera.shake(duration, intensity * 0.01);
}
```

**文件：**
- `apps/web/src/components/FloatingText.tsx`
- `apps/web/src/effects/ParticleSystem.ts`
- `apps/web/src/effects/ScreenShake.ts`
- `apps/web/src/floating-text.css`

**工作量：** 4-5天

---

### 后端任务（Claude）

#### 3.4 战斗事件增强
```typescript
// packages/simulation/index.ts
export type CombatEvent = {
  type: 'hit' | 'crit' | 'heal' | 'miss' | 'level_up' | 'loot_drop';
  id: string;
  position: Vec;
  amount?: number;
  isCrit?: boolean;
  skill?: string;
  tick: number;
}

// 在World类中添加暴击系统
class World {
  private rollCrit(damage: number): { damage: number; isCrit: boolean } {
    const critChance = this.stats.critChance ?? 0;
    const critMultiplier = this.stats.critMultiplier ?? 2.0;
    const isCrit = Math.random() < critChance / 100;
    
    return {
      damage: isCrit ? Math.round(damage * critMultiplier) : damage,
      isCrit,
    };
  }
  
  private damage(e: Entity, baseDamage: number) {
    const { damage, isCrit } = this.rollCrit(baseDamage);
    e.hp = Math.max(0, e.hp - damage);
    
    this.events.push({
      type: isCrit ? 'crit' : 'hit',
      id: e.id,
      position: { ...e.position },
      amount: damage,
      isCrit,
      tick: this.tick,
    });
    // ...
  }
}
```

**文件：**
- `packages/simulation/index.ts` - 战斗事件增强
- `packages/contracts/index.ts` - Stats类型添加暴击属性
- `packages/content/index.ts` - 暴击相关常量

**工作量：** 2-3天

---

## 📦 优先级 4：技能符文系统

### 前端任务（GPT）

#### 4.1 符文选择UI
```typescript
// apps/web/src/components/SkillRunePanel.tsx
export function SkillRunePanel({ 
  skill, 
  runes, 
  selected, 
  onSelect 
}: {
  skill: Skill;
  runes: SkillRune[];
  selected: string;
  onSelect: (runeId: string) => void;
}) {
  return (
    <div className="rune-panel">
      <h3>技能符文 - {skill.name}</h3>
      <div className="rune-grid">
        {runes.map(rune => (
          <div
            key={rune.id}
            className={`rune-card ${selected === rune.id ? 'active' : ''}`}
            onClick={() => onSelect(rune.id)}
          >
            <div className="rune-icon">{/* 符文图标 */}</div>
            <h4>{rune.name}</h4>
            <p>{rune.description}</p>
            {rune.unlockLevel > playerLevel && (
              <div className="locked">需要等级 {rune.unlockLevel}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

**文件：**
- `apps/web/src/components/SkillRunePanel.tsx`
- `apps/web/src/runes.css`

**工作量：** 2天

---

### 后端任务（Claude）

#### 4.2 符文系统核心
```typescript
// packages/content/runes.ts
export type SkillRune = {
  id: string;
  skillId: string;
  name: string;
  description: string;
  unlockLevel: number;
  modifier: {
    damageMultiplier?: number;
    rangeBonus?: number;
    cooldownMultiplier?: number;
    costMultiplier?: number;
    addEffect?: Effect;
    behaviorChange?: string;
  };
}

export const skillRunes: SkillRune[] = [
  {
    id: 'bolt_split',
    skillId: 'bolt',
    name: '分裂箭',
    description: '箭矢分裂为3支，单体伤害降至60%',
    unlockLevel: 5,
    modifier: {
      damageMultiplier: 0.6,
      behaviorChange: 'split_3',
    }
  },
  {
    id: 'bolt_pierce',
    skillId: 'bolt',
    name: '穿透箭',
    description: '箭矢穿透所有敌人',
    unlockLevel: 7,
    modifier: {
      addEffect: 'pierce',
    }
  },
  {
    id: 'whirl_bleed',
    skillId: 'whirl',
    name: '血旋风',
    description: '附加流血效果，持续5秒',
    unlockLevel: 6,
    modifier: {
      addEffect: 'bleed',
      cooldownMultiplier: 1.2,
    }
  },
  // ...每个技能3-5个符文
];

// packages/simulation/runes.ts
export function applyRuneModifier(
  skill: Skill, 
  rune: SkillRune
): Skill {
  return {
    ...skill,
    damage: Math.round(skill.damage * (rune.modifier.damageMultiplier ?? 1)),
    range: skill.range + (rune.modifier.rangeBonus ?? 0),
    cooldown: Math.round(skill.cooldown * (rune.modifier.cooldownMultiplier ?? 1)),
    cost: Math.round(skill.cost * (rune.modifier.costMultiplier ?? 1)),
    // ...应用其他修改
  };
}
```

**文件：**
- `packages/content/runes.ts` - 符文定义（36-60个符文）
- `packages/simulation/runes.ts` - 符文应用逻辑
- `packages/contracts/index.ts` - 符文类型定义
- `apps/server/src/routes/skills.ts` - 符文装备API
- `apps/server/migrations/XXX_skill_runes.sql` - 数据库

**工作量：** 5-7天

---

## 📦 优先级 5：任务&成就系统

### 前端任务（GPT）

#### 5.1 任务追踪UI
```typescript
// apps/web/src/components/QuestTracker.tsx
export function QuestTracker({ quests }: { quests: Quest[] }) {
  return (
    <div className="quest-tracker">
      <h3>任务</h3>
      {quests.map(quest => (
        <div key={quest.id} className="quest-item">
          <h4>{quest.title}</h4>
          {quest.objectives.map(obj => (
            <div key={obj.type} className="objective">
              <span>{obj.description}</span>
              <span className="progress">{obj.current}/{obj.required}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
```

#### 5.2 成就面板
```typescript
// apps/web/src/components/AchievementPanel.tsx
export function AchievementPanel({ achievements }: { achievements: Achievement[] }) {
  const categories = ['combat', 'exploration', 'collection', 'mastery'];
  
  return (
    <div className="achievement-panel">
      <div className="achievement-tabs">
        {categories.map(cat => (
          <button key={cat}>{categoryNames[cat]}</button>
        ))}
      </div>
      <div className="achievement-grid">
        {achievements.map(ach => (
          <div key={ach.id} className={`achievement ${ach.unlocked ? 'unlocked' : ''}`}>
            <div className="achievement-icon">{/* 图标 */}</div>
            <h4>{ach.title}</h4>
            <p>{ach.description}</p>
            <div className="progress-bar">
              <div style={{ width: `${ach.progress / ach.total * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**文件：**
- `apps/web/src/components/QuestTracker.tsx`
- `apps/web/src/components/QuestPanel.tsx`
- `apps/web/src/components/AchievementPanel.tsx`
- `apps/web/src/quest.css`

**工作量：** 3-4天

---

### 后端任务（Claude）

#### 5.3 任务系统核心
```typescript
// packages/content/quests.ts
export type Quest = {
  id: string;
  type: 'daily' | 'weekly' | 'story';
  title: string;
  description: string;
  objectives: QuestObjective[];
  rewards: QuestReward;
  prerequisites?: string[];  // 前置任务
  expiresAt?: Date;
}

export type QuestObjective = {
  type: 'kill' | 'collect' | 'reach' | 'survive' | 'enhance';
  target: string;
  required: number;
}

// 每日任务池
export const dailyQuestPool: Quest[] = [
  {
    id: 'daily_kill_10',
    type: 'daily',
    title: '每日狩猎',
    description: '击败10个敌人',
    objectives: [{ type: 'kill', target: 'any', required: 10 }],
    rewards: { gold: 500, xp: 200 },
  },
  // ...更多每日任务
];

// 成就定义
export const achievements: Achievement[] = [
  {
    id: 'first_blood',
    category: 'combat',
    title: '初战告捷',
    description: '击败第一个敌人',
    tier: 'bronze',
    total: 1,
  },
  {
    id: 'slayer_100',
    category: 'combat',
    title: '百人斩',
    description: '累计击败100个敌人',
    tier: 'silver',
    total: 100,
  },
  // ...更多成就（50-100个）
];
```

**文件：**
- `packages/content/quests.ts` - 任务定义
- `packages/content/achievements.ts` - 成就定义
- `apps/server/src/routes/quests.ts` - 任务API
- `apps/server/src/quest-refresh.ts` - 每日刷新逻辑
- `apps/server/src/achievement-tracker.ts` - 成就追踪
- `apps/server/migrations/XXX_quests_achievements.sql`

**工作量：** 5-6天

---

## 📦 优先级 6：战斗深度强化

### 前端任务（GPT）

#### 6.1 闪避指示器
```typescript
// apps/web/src/components/DodgeIndicator.tsx
export function DodgeIndicator({ 
  isActive, 
  cooldownPercent 
}: { 
  isActive: boolean;
  cooldownPercent: number;
}) {
  return (
    <div className={`dodge-indicator ${isActive ? 'active' : ''}`}>
      {isActive && <div className="perfect-window">完美闪避</div>}
      <div className="cooldown-arc" style={{ 
        strokeDashoffset: `${(1 - cooldownPercent) * 100}%` 
      }} />
    </div>
  );
}
```

#### 6.2 Combo提示
```typescript
// apps/web/src/components/ComboHint.tsx
export function ComboHint({ combo }: { combo: SkillCombo }) {
  return (
    <div className="combo-hint fade-in">
      <div className="combo-skills">
        {combo.trigger.map(skillId => (
          <img key={skillId} src={skillIcon(skillId)} alt="" />
        ))}
      </div>
      <div className="combo-effect">
        {combo.effect} +{combo.bonus * 100}%
      </div>
    </div>
  );
}
```

**文件：**
- `apps/web/src/components/DodgeIndicator.tsx`
- `apps/web/src/components/ComboHint.tsx`
- `apps/web/src/combat-indicators.css`

**工作量：** 2天

---

### 后端任务（Claude）

#### 6.3 闪避系统
```typescript
// packages/simulation/index.ts
class World {
  private dodgeCooldown = 0;
  private dodgeWindow = 0;
  
  dodge() {
    if (this.dodgeCooldown > this.tick) return false;
    if (this.hero.hp <= 0 || this.paused) return false;
    
    this.dodgeCooldown = this.tick + 60; // 2秒CD
    this.dodgeWindow = this.tick + 8;    // 8帧无敌
    this.hero.action = 'dodge';
    this.hero.actionUntil = this.tick + 15;
    
    return true;
  }
  
  private hurt(amount: number) {
    // 无敌帧检查
    if (this.dodgeWindow >= this.tick) {
      this.events.push({
        type: 'dodge_success',
        id: 'hero',
        position: { ...this.hero.position },
        tick: this.tick,
      });
      return;
    }
    
    // 完美闪避加成
    if (this.dodgeWindow + 5 >= this.tick) {
      this.hero.perfectDodgeBonus = this.tick + 90; // 3秒伤害加成
    }
    
    // ...原有伤害逻辑
  }
}
```

#### 6.4 Combo系统
```typescript
// packages/content/combos.ts
export type SkillCombo = {
  id: string;
  name: string;
  trigger: string[];  // 技能序列
  window: number;     // 窗口期（ticks）
  effect: 'stun' | 'burst' | 'heal';
  bonus: number;
}

export const skillCombos: SkillCombo[] = [
  {
    id: 'frost_bolt',
    name: '冰箭',
    trigger: ['frost', 'bolt'],
    window: 90,  // 3秒内
    effect: 'stun',
    bonus: 1.5,
  },
  {
    id: 'whirl_rush',
    name: '旋风突进',
    trigger: ['whirl', 'rush'],
    window: 60,
    effect: 'burst',
    bonus: 2.0,
  },
];

// packages/simulation/combo.ts
export class ComboTracker {
  private history: { skillId: string; tick: number }[] = [];
  
  recordCast(skillId: string, tick: number) {
    this.history.push({ skillId, tick });
    this.history = this.history.filter(h => tick - h.tick < 180); // 保留6秒内
  }
  
  checkCombo(tick: number): SkillCombo | null {
    for (const combo of skillCombos) {
      const recentCasts = this.history.filter(h => tick - h.tick <= combo.window);
      const sequence = recentCasts.map(h => h.skillId);
      
      if (this.matchesSequence(sequence, combo.trigger)) {
        return combo;
      }
    }
    return null;
  }
}
```

**文件：**
- `packages/simulation/index.ts` - 闪避逻辑
- `packages/content/combos.ts` - Combo定义
- `packages/simulation/combo.ts` - Combo追踪器
- `packages/contracts/index.ts` - 类型更新

**工作量：** 4-5天

---

## 🔄 协作流程

### 标准开发流程

#### 步骤1：后端先行（Claude）
```bash
# 1. 设计数据模型
packages/contracts/index.ts     # 类型定义
packages/content/xxx.ts         # 内容定义

# 2. 实现核心逻辑
packages/simulation/xxx.ts      # 游戏逻辑

# 3. 实现API
apps/server/src/routes/xxx.ts   # 接口
apps/server/migrations/xxx.sql  # 数据库

# 4. 输出前端接口文档
docs/api/xxx-api.md
```

#### 步骤2：前端跟进（GPT）
```bash
# 1. 基于类型定义开发组件
apps/web/src/components/Xxx.tsx

# 2. 实现UI逻辑
apps/web/src/xxx.css

# 3. 集成API调用
apps/web/src/xxx-api.ts
```

---

## 📋 任务清单模板

### 后端任务单（Claude）
```markdown
## [功能名称] - 后端任务

### 数据模型
- [ ] 类型定义 (`packages/contracts/index.ts`)
- [ ] 内容定义 (`packages/content/xxx.ts`)
- [ ] 数据库Schema (`migrations/xxx.sql`)

### 核心逻辑
- [ ] 游戏规则实现 (`packages/simulation/xxx.ts`)
- [ ] 数值计算
- [ ] 平衡性测试

### API接口
- [ ] 路由定义 (`apps/server/src/routes/xxx.ts`)
- [ ] 请求验证
- [ ] 错误处理

### 文档输出
- [ ] API文档 (`docs/api/xxx-api.md`)
- [ ] 前端集成说明
```

### 前端任务单（GPT）
```markdown
## [功能名称] - 前端任务

### UI组件
- [ ] 主组件 (`apps/web/src/components/Xxx.tsx`)
- [ ] 子组件
- [ ] 样式文件 (`apps/web/src/xxx.css`)

### 交互逻辑
- [ ] 事件处理
- [ ] 动画效果
- [ ] 响应式适配

### API集成
- [ ] 接口调用
- [ ] 错误处理
- [ ] 加载状态
```

---

## 🎯 推荐开始顺序

### 第一周：新手引导
1. **Claude:** 教程进度追踪（1天）
2. **GPT:** 教程遮罩组件（2-3天）
3. **测试:** 新手流失率对比

### 第二-三周：装备系统
1. **Claude:** 词缀&套装核心（5天）
2. **GPT:** 装备卡片UI（3天）
3. **测试:** Build多样性验证

### 第四周：反馈系统
1. **Claude:** 暴击系统（2天）
2. **GPT:** 飘字&粒子效果（4天）
3. **测试:** 打击感提升验证

---

## 📞 沟通约定

### Claude输出格式
```typescript
// 完成后端任务后，输出以下内容：

/**
 * 功能：装备词缀系统
 * 状态：✅ 已完成
 * 
 * 新增类型：
 * - GearAffix
 * - GearSet
 * 
 * API端点：
 * - GET /api/gear/affixes
 * - GET /api/gear/sets
 * 
 * 前端需要：
 * 1. 在GearCard组件中显示affixes数组
 * 2. 根据gear.quality设置边框颜色
 * 3. 显示套装件数进度 (setCount/setTotal)
 * 
 * 详见：docs/api/gear-api.md
 */
```

### GPT输出格式
```typescript
// 完成前端任务后，确认：

/**
 * 功能：装备卡片UI
 * 状态：✅ 已完成
 * 
 * 新增组件：
 * - GearCard.tsx
 * - GearComparison.tsx
 * - SetBonus.tsx
 * 
 * 需要后端配合：
 * - 确认Gear类型中affixes字段格式
 * - 套装数量计算是后端返回还是前端计算？
 * 
 * 截图：见附件
 */
```

---

**文档版本：1.0**  
**更新时间：2026年9月30日**
