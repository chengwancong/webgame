# 前端任务文档 - 装备词缀&套装系统

**目标：** 重构装备UI，支持词缀、套装、品质显示  
**预计工作量：** 3-4天  
**依赖：** 后端已完成词缀&套装数据结构

---

## 📋 任务概述

需要重构装备相关的所有UI组件，支持新的装备系统特性：
- 装备品质（普通/魔法/稀有/传说）用不同颜色区分
- 显示装备词缀列表
- 显示套装名称和件数进度
- 装备对比面板
- 套装加成提示

---

## 🎨 设计规范

### 品质颜色
```typescript
const qualityColors = {
  common: '#9e9e9e',    // 灰色
  magic: '#2196f3',     // 蓝色
  rare: '#ffeb3b',      // 黄色
  legendary: '#ff9800', // 橙色
};
```

### 词缀层级颜色
```typescript
const affixTierColors = {
  1: '#ff9800', // T1(顶级) - 橙色
  2: '#2196f3', // T2(优秀) - 蓝色
  3: '#9e9e9e', // T3(普通) - 灰色
};
```

---

## 📦 数据结构（后端提供）

### Gear类型
```typescript
type Gear = {
  id: string;
  base: string;        // 基础装备ID
  slot: 'weapon' | 'armor' | 'accessory' | 'core';
  level: number;
  stars: number;       // 强化等级
  locked: boolean;
  
  // 新增字段
  quality: 'common' | 'magic' | 'rare' | 'legendary';
  name: string;        // 显示名称（带品质前缀）
  
  // 基础属性
  attack: number;
  armor: number;
  hp: number;
  
  // 词缀系统
  affixes?: GearAffix[];
  
  // 套装系统
  setId?: string;
  setName?: string;
  setCount?: number;   // 已装备的套装件数
  setTotal?: number;   // 套装总件数
}

type GearAffix = {
  id: string;
  name: string;        // 显示名称，如"暴击"
  tier: 1 | 2 | 3;     // 词缀品质
  description: string; // 完整描述，如"暴击率 +15%"
  value: number;       // 数值
}

type SetBonus = {
  pieces: number;      // 需要件数（2/3/4）
  description: string; // 效果描述
  active: boolean;     // 当前是否激活
}
```

---

## 🛠️ 需要创建的组件

### 1. GearCard 组件（重构）

**文件：** `apps/web/src/components/GearCard.tsx`

```tsx
import React from 'react';
import type { Gear } from '../types';

interface GearCardProps {
  gear: Gear;
  onClick?: () => void;
  selected?: boolean;
  showComparison?: boolean;
}

export function GearCard({ gear, onClick, selected, showComparison }: GearCardProps) {
  const qualityColor = {
    common: '#9e9e9e',
    magic: '#2196f3',
    rare: '#ffeb3b',
    legendary: '#ff9800',
  }[gear.quality];
  
  const affixTierColor = (tier: number) => ({
    1: '#ff9800',
    2: '#2196f3',
    3: '#9e9e9e',
  }[tier]);

  return (
    <div 
      className={`gear-card ${selected ? 'selected' : ''}`}
      onClick={onClick}
      style={{ borderColor: qualityColor }}
    >
      {/* 品质角标 */}
      <div className="quality-badge" style={{ background: qualityColor }}>
        {gear.quality === 'legendary' && '★'}
      </div>
      
      {/* 装备图标 */}
      <div className="gear-icon">
        <img src={`/assets/gear/${gear.base}.png`} alt={gear.name} />
        {gear.locked && <div className="lock-icon">🔒</div>}
      </div>
      
      {/* 装备名称 */}
      <h4 className="gear-name" style={{ color: qualityColor }}>
        {gear.name}
      </h4>
      
      {/* 强化等级 */}
      {gear.stars > 0 && (
        <div className="gear-stars">+{gear.stars}</div>
      )}
      
      {/* 基础属性 */}
      <div className="gear-stats">
        {gear.attack > 0 && <div>⚔️ 攻击 +{gear.attack}</div>}
        {gear.armor > 0 && <div>🛡️ 护甲 +{gear.armor}</div>}
        {gear.hp > 0 && <div>❤️ 生命 +{gear.hp}</div>}
      </div>
      
      {/* 词缀列表 */}
      {gear.affixes && gear.affixes.length > 0 && (
        <div className="gear-affixes">
          <div className="affix-header">词缀</div>
          {gear.affixes.map(affix => (
            <div 
              key={affix.id} 
              className={`affix tier-${affix.tier}`}
              style={{ color: affixTierColor(affix.tier) }}
            >
              <span className="affix-name">{affix.name}</span>
              <span className="affix-value">{affix.description}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* 套装信息 */}
      {gear.setId && (
        <div className="gear-set">
          <div className="set-name">{gear.setName}</div>
          <div className="set-progress">
            ({gear.setCount}/{gear.setTotal})
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### 2. GearComparison 组件（新建）

**文件：** `apps/web/src/components/GearComparison.tsx`

```tsx
import React from 'react';
import type { Gear } from '../types';

interface GearComparisonProps {
  current: Gear | null;  // 当前装备的
  candidate: Gear;       // 候选装备
  onEquip: () => void;
  onClose: () => void;
}

export function GearComparison({ current, candidate, onEquip, onClose }: GearComparisonProps) {
  const compareStat = (currentValue: number, newValue: number) => {
    const diff = newValue - currentValue;
    if (diff > 0) return <span className="stat-up">+{diff} ↑</span>;
    if (diff < 0) return <span className="stat-down">{diff} ↓</span>;
    return <span className="stat-same">—</span>;
  };

  return (
    <div className="gear-comparison-modal">
      <div className="comparison-panel">
        <button className="close-btn" onClick={onClose}>✕</button>
        
        <h3>装备对比</h3>
        
        <div className="comparison-grid">
          {/* 左侧：当前装备 */}
          <div className="current-gear">
            <div className="label">当前装备</div>
            {current ? (
              <GearCard gear={current} />
            ) : (
              <div className="empty-slot">未装备</div>
            )}
          </div>
          
          {/* 中间：对比箭头 */}
          <div className="comparison-arrow">→</div>
          
          {/* 右侧：候选装备 */}
          <div className="candidate-gear">
            <div className="label">候选装备</div>
            <GearCard gear={candidate} />
          </div>
        </div>
        
        {/* 属性对比 */}
        {current && (
          <div className="stat-comparison">
            <h4>属性变化</h4>
            <div className="stat-row">
              <span>攻击</span>
              {compareStat(current.attack, candidate.attack)}
            </div>
            <div className="stat-row">
              <span>护甲</span>
              {compareStat(current.armor, candidate.armor)}
            </div>
            <div className="stat-row">
              <span>生命</span>
              {compareStat(current.hp, candidate.hp)}
            </div>
          </div>
        )}
        
        {/* 操作按钮 */}
        <div className="comparison-actions">
          <button className="btn-cancel" onClick={onClose}>取消</button>
          <button className="btn-equip" onClick={onEquip}>装备</button>
        </div>
      </div>
    </div>
  );
}
```

---

### 3. SetBonusTooltip 组件（新建）

**文件：** `apps/web/src/components/SetBonusTooltip.tsx`

```tsx
import React from 'react';
import type { SetBonus } from '../types';

interface SetBonusTooltipProps {
  setName: string;
  bonuses: SetBonus[];
}

export function SetBonusTooltip({ setName, bonuses }: SetBonusTooltipProps) {
  return (
    <div className="set-bonus-tooltip">
      <h4 className="set-title">{setName}</h4>
      <div className="bonus-list">
        {bonuses.map((bonus, index) => (
          <div 
            key={index} 
            className={`bonus-item ${bonus.active ? 'active' : 'inactive'}`}
          >
            <div className="bonus-pieces">
              ({bonus.pieces}件)
            </div>
            <div className="bonus-description">
              {bonus.description}
            </div>
            {bonus.active && <span className="active-mark">✓</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. GearFilter 组件（增强）

**文件：** `apps/web/src/components/GearFilter.tsx`

```tsx
import React from 'react';

interface GearFilterProps {
  qualityFilter: string;
  slotFilter: string;
  onQualityChange: (quality: string) => void;
  onSlotChange: (slot: string) => void;
}

export function GearFilter({ qualityFilter, slotFilter, onQualityChange, onSlotChange }: GearFilterProps) {
  const qualities = [
    { value: '', label: '全部品质' },
    { value: 'legendary', label: '传说', color: '#ff9800' },
    { value: 'rare', label: '稀有', color: '#ffeb3b' },
    { value: 'magic', label: '魔法', color: '#2196f3' },
    { value: 'common', label: '普通', color: '#9e9e9e' },
  ];
  
  const slots = [
    { value: '', label: '全部槽位' },
    { value: 'weapon', label: '武器' },
    { value: 'armor', label: '护甲' },
    { value: 'accessory', label: '饰品' },
    { value: 'core', label: '核心' },
  ];

  return (
    <div className="gear-filter">
      <div className="filter-group">
        <label>品质筛选</label>
        <div className="quality-buttons">
          {qualities.map(q => (
            <button
              key={q.value}
              className={`filter-btn ${qualityFilter === q.value ? 'active' : ''}`}
              onClick={() => onQualityChange(q.value)}
              style={q.color ? { borderColor: q.color } : {}}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
      
      <div className="filter-group">
        <label>槽位筛选</label>
        <select value={slotFilter} onChange={e => onSlotChange(e.target.value)}>
          {slots.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
```

---

## 🎨 CSS样式

**文件：** `apps/web/src/gear.css`

```css
/* 装备卡片 */
.gear-card {
  position: relative;
  background: linear-gradient(180deg, #1a2a35, #0f1a25);
  border: 2px solid #3a5a6f;
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.gear-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

.gear-card.selected {
  border-width: 3px;
  box-shadow: 0 0 20px currentColor;
}

/* 品质角标 */
.quality-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
}

/* 装备图标 */
.gear-icon {
  position: relative;
  width: 80px;
  height: 80px;
  margin: 0 auto 12px;
  background: linear-gradient(135deg, #2a4a5f, #1a3a4f);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gear-icon img {
  max-width: 70%;
  max-height: 70%;
}

.lock-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 16px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
}

/* 装备名称 */
.gear-name {
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  margin-bottom: 8px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.8);
}

/* 强化等级 */
.gear-stars {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(255, 215, 0, 0.2);
  border: 1px solid #ffd700;
  color: #ffd700;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

/* 基础属性 */
.gear-stats {
  background: rgba(10, 20, 30, 0.6);
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  color: #d4e6f5;
}

.gear-stats > div {
  display: flex;
  justify-content: space-between;
  padding: 2px 0;
}

/* 词缀列表 */
.gear-affixes {
  background: rgba(10, 20, 30, 0.8);
  border: 1px solid #2a4a5f;
  border-radius: 6px;
  padding: 8px;
  margin-bottom: 8px;
}

.affix-header {
  font-size: 11px;
  font-weight: 700;
  color: #7a9aaf;
  text-transform: uppercase;
  margin-bottom: 6px;
  letter-spacing: 0.05em;
}

.affix {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
  font-weight: 600;
}

.affix.tier-1 {
  color: #ff9800;
}

.affix.tier-2 {
  color: #2196f3;
}

.affix.tier-3 {
  color: #9e9e9e;
}

.affix-name::before {
  content: '• ';
  margin-right: 4px;
}

/* 套装信息 */
.gear-set {
  background: linear-gradient(135deg, rgba(156, 39, 176, 0.2), rgba(103, 58, 183, 0.2));
  border: 1px solid #9c27b0;
  border-radius: 6px;
  padding: 6px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.set-name {
  font-size: 12px;
  font-weight: 700;
  color: #ce93d8;
}

.set-progress {
  font-size: 12px;
  font-weight: 600;
  color: #ba68c8;
}

/* 装备对比面板 */
.gear-comparison-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.comparison-panel {
  background: linear-gradient(180deg, #1a2a35, #0f1a25);
  border: 2px solid #3a6a8f;
  border-radius: 16px;
  padding: 24px;
  max-width: 800px;
  width: 90vw;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  background: none;
  border: none;
  color: #7a9aaf;
  font-size: 24px;
  cursor: pointer;
  transition: color 0.2s;
}

.close-btn:hover {
  color: #d4e6f5;
}

.comparison-grid {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 24px;
  align-items: center;
  margin: 24px 0;
}

.label {
  font-size: 14px;
  font-weight: 700;
  color: #b8d4e8;
  text-align: center;
  margin-bottom: 12px;
}

.empty-slot {
  aspect-ratio: 3/4;
  background: rgba(10, 20, 30, 0.6);
  border: 2px dashed #3a5a6f;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #7a9aaf;
  font-size: 14px;
}

.comparison-arrow {
  font-size: 32px;
  color: #5da3d5;
  font-weight: bold;
}

/* 属性对比 */
.stat-comparison {
  background: rgba(10, 20, 30, 0.6);
  border: 1px solid #2a4a5f;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
}

.stat-comparison h4 {
  font-size: 14px;
  font-weight: 700;
  color: #b8d4e8;
  margin-bottom: 12px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  font-size: 14px;
  color: #d4e6f5;
  border-bottom: 1px solid rgba(42, 74, 95, 0.3);
}

.stat-row:last-child {
  border-bottom: none;
}

.stat-up {
  color: #4caf50;
  font-weight: 600;
}

.stat-down {
  color: #f44336;
  font-weight: 600;
}

.stat-same {
  color: #9e9e9e;
}

/* 对比按钮 */
.comparison-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  margin-top: 24px;
}

.btn-cancel, .btn-equip {
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-cancel {
  background: #37474f;
  border: 1px solid #546e7a;
  color: #cfd8dc;
}

.btn-cancel:hover {
  background: #455a64;
}

.btn-equip {
  background: linear-gradient(135deg, #ffd088, #ffb65c);
  border: 2px solid #ffe4a1;
  color: #2a1a0f;
}

.btn-equip:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 182, 92, 0.6);
}

/* 套装加成提示 */
.set-bonus-tooltip {
  background: linear-gradient(180deg, #1a1a2e, #0f0f1a);
  border: 2px solid #9c27b0;
  border-radius: 12px;
  padding: 16px;
  min-width: 280px;
}

.set-title {
  font-size: 16px;
  font-weight: 800;
  color: #ce93d8;
  margin-bottom: 12px;
  text-align: center;
}

.bonus-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.bonus-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 6px;
  background: rgba(156, 39, 176, 0.1);
  border: 1px solid transparent;
}

.bonus-item.active {
  background: rgba(156, 39, 176, 0.3);
  border-color: #9c27b0;
}

.bonus-item.inactive {
  opacity: 0.5;
}

.bonus-pieces {
  font-size: 12px;
  font-weight: 700;
  color: #ba68c8;
  white-space: nowrap;
}

.bonus-description {
  flex: 1;
  font-size: 13px;
  color: #d4e6f5;
}

.active-mark {
  color: #4caf50;
  font-size: 16px;
  font-weight: bold;
}

/* 装备筛选 */
.gear-filter {
  background: rgba(10, 20, 30, 0.6);
  border: 1px solid #2a4a5f;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.filter-group {
  margin-bottom: 12px;
}

.filter-group:last-child {
  margin-bottom: 0;
}

.filter-group label {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: #b8d4e8;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.quality-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 6px 16px;
  border-radius: 20px;
  background: #1a3a4f;
  border: 2px solid #3a5a6f;
  color: #b8d4e8;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn.active {
  background: linear-gradient(135deg, #5da3d5, #3a7a9f);
  border-color: currentColor;
  color: #fff;
}

.filter-btn:hover:not(.active) {
  background: #2a4a5f;
  border-color: #5a7a8f;
}

.filter-group select {
  width: 100%;
  padding: 8px 12px;
  background: #1a3a4f;
  border: 1px solid #3a5a6f;
  border-radius: 6px;
  color: #d4e6f5;
  font-size: 14px;
  cursor: pointer;
}

.filter-group select:focus {
  outline: none;
  border-color: #5da3d5;
}

/* 响应式 */
@media (max-width: 768px) {
  .comparison-grid {
    grid-template-columns: 1fr;
    gap: 16px;
  }
  
  .comparison-arrow {
    transform: rotate(90deg);
  }
  
  .quality-buttons {
    flex-direction: column;
  }
  
  .filter-btn {
    width: 100%;
  }
}
```

---

## 📝 集成说明

### 在背包面板中使用

```tsx
// apps/web/src/presentation.ts 或相关文件

function renderBagPanel(view: PresentationModel) {
  const [qualityFilter, setQualityFilter] = useState('');
  const [slotFilter, setSlotFilter] = useState('');
  const [selectedGear, setSelectedGear] = useState<Gear | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  
  const filteredGear = view.snapshot.gear.filter(g => {
    if (qualityFilter && g.quality !== qualityFilter) return false;
    if (slotFilter && g.slot !== slotFilter) return false;
    return true;
  });
  
  const handleEquip = (gear: Gear) => {
    const current = view.snapshot.gear.find(g => 
      g.slot === gear.slot && g.id !== gear.id
    );
    
    if (current) {
      // 显示对比面板
      setSelectedGear(current);
      setShowComparison(true);
    } else {
      // 直接装备
      view.onAction('equip', gear.id);
    }
  };

  return `
    <div class="bag-panel">
      <GearFilter 
        qualityFilter={qualityFilter}
        slotFilter={slotFilter}
        onQualityChange={setQualityFilter}
        onSlotChange={setSlotFilter}
      />
      
      <div class="gear-grid">
        ${filteredGear.map(gear => `
          <GearCard 
            gear={gear}
            onClick={() => handleEquip(gear)}
            selected={gear.id === view.selected}
          />
        `).join('')}
      </div>
      
      ${showComparison ? `
        <GearComparison
          current={selectedGear}
          candidate={/* 当前选中的gear */}
          onEquip={() => {
            view.onAction('equip', /* gear.id */);
            setShowComparison(false);
          }}
          onClose={() => setShowComparison(false)}
        />
      ` : ''}
    </div>
  `;
}
```

---

## ✅ 验收标准

### 功能完整性
- [ ] 装备卡片正确显示品质颜色
- [ ] 词缀列表正确显示，颜色根据层级区分
- [ ] 套装名称和件数正确显示
- [ ] 装备对比面板功能正常
- [ ] 属性对比正确计算并显示增减
- [ ] 筛选功能正常工作

### 视觉效果
- [ ] 所有过渡动画流畅
- [ ] 悬停效果明显
- [ ] 颜色对比度足够（可读性）
- [ ] 响应式布局在各种分辨率下正常

### 性能
- [ ] 大量装备（50+）时不卡顿
- [ ] 筛选操作即时响应

---

## 🔗 API接口参考

后端已提供以下接口（详见后端文档）：

```typescript
// 获取装备列表（已包含词缀和套装信息）
GET /api/gear

// 装备物品
POST /api/gear/equip
{
  gearId: string;
}

// 获取套装加成详情
GET /api/gear/sets/:setId
```

---

## 💡 注意事项

1. **不要修改数据结构** - 所有类型定义由后端提供，前端只负责展示
2. **保持与现有UI风格一致** - 使用项目中已有的颜色、字体、间距规范
3. **确保无障碍访问** - 添加适当的aria标签
4. **性能优化** - 使用虚拟滚动处理大量装备列表
5. **移动端适配** - 确保在小屏幕上也能正常使用

---

## 📞 遇到问题？

如果遇到以下情况，请反馈给后端：

- 数据结构不符合预期
- 缺少必要的字段
- API返回错误
- 需要新增API端点

**文档版本：1.0**  
**创建时间：2026年9月30日**
