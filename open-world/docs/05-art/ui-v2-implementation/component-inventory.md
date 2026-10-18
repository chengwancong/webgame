# 深渊行者 UI V2 控件盘点表

创建日期：2026-09-29
状态：初始盘点

## 一、控件分类统计

### A. 基础面板（Frames）
| ID | 名称 | 出现位置 | 需要图片 | 处理方式 |
|---|---|---|---|---|
| panel-modal | 大型模态面板 | inventory, skills | ⚠️ | CSS圆角+边框，可选角装饰 |
| panel-hud | 紧凑HUD面板 | hud左侧状态栏 | ⚠️ | CSS半透明背景 |
| panel-content | 深色内容区 | inventory物品区 | ❌ | CSS纯色填充 |
| panel-header | 标题栏 | 所有面板 | ⚠️ | CSS+可选装饰 |
| divider-h | 水平分隔线 | components | ❌ | CSS 1px线 |
| overlay-mask | 遮罩层 | - | ❌ | CSS rgba |

### B. 按钮（Buttons）
| ID | 名称 | 状态 | 出现位置 | 需要图片 | 尺寸估算 |
|---|---|---|---|---|---|
| btn-primary | 主要按钮 | 5态 | components | ✅ | ~120×40 |
| btn-secondary | 次要按钮 | 5态 | components | ✅ | ~120×40 |
| btn-danger | 危险按钮 | 5态 | components | ✅ | ~120×40 |
| btn-icon | 图标按钮 | 5态 | hud右上 | ✅ | ~40×40 |
| btn-close | 关闭按钮 | 3态 | 面板右上 | ✅ | ~32×32 |
| btn-tab | 标签按钮 | 3态 | inventory分类 | ✅ | ~80×36 |

**状态**：默认、悬停、按下、禁用、焦点（+选中for tabs）

### C. 输入控件（Inputs）
| ID | 名称 | 出现位置 | 需要图片 | 处理方式 |
|---|---|---|---|---|
| toggle-mode | 模式切换 | hud底部 | ✅ | 三态切换图标 |
| checkbox | 复选框 | components | ✅ | 勾选框24×24 |
| slider | 滑块 | components | ✅ | 轨道+滑块 |
| dropdown | 下拉选择 | - | ⚠️ | CSS+箭头图标 |

### D. 物品槽（Slots）
| ID | 名称 | 出现位置 | 需要图片 | 尺寸估算 |
|---|---|---|---|---|
| slot-item | 物品槽底 | inventory | ✅ | 56×56 |
| slot-equipment | 装备槽 | inventory左侧 | ✅ | 64×64 |
| slot-skill | 技能槽 | skills, hud | ✅ | 56×56 |
| slot-empty | 空槽提示 | - | ⚠️ | 图标叠加 |

**标记**：
- 选中边框（杏金色）
- 已装备标记
- 锁定图标
- 数量角标
- 强化等级角标
- 品质底色（可选）

### E. 状态条（Bars）
| ID | 名称 | 出现位置 | 需要图片 | 处理方式 |
|---|---|---|---|---|
| bar-health | 生命条 | hud, components | ⚠️ | CSS渐变填充 |
| bar-mana | 灵力条 | hud, components | ⚠️ | CSS渐变填充 |
| bar-exp | 经验条 | hud | ⚠️ | CSS填充 |
| bar-bg | 状态条底 | - | ⚠️ | CSS半透明 |

### F. 图标（Icons）

#### F1. 装备图标（已有，需验证V2风格）
| ID | 名称 | 当前状态 |
|---|---|---|
| gear-bow | 弓 | ✅ 批次B已生成 |
| gear-blade | 剑 | ✅ 已有 |
| gear-lance | 矛 | ❌ 待确认是否为武器 |
| gear-shield | 盾 | ✅ 已有 |
| gear-coat | 护甲 | ✅ 已有 |

#### F2. 技能图标（已有，需验证）
| ID | 名称 | 当前状态 |
|---|---|---|
| skill-whirl | 旋风斩 | ✅ 已有24×24 |
| skill-lance | 星矛 | ✅ 批次B已生成48×48 |
| skill-bolt | 闪电箭 | ✅ 已有 |
| skill-chain | 锁链 | ✅ 已有 |
| skill-cut | 斩击 | ✅ 已有 |
| skill-frost | 寒冰 | ✅ 已有 |
| skill-ward | 护身印 | ✅ 已有 |
| skill-mend | 回春 | ❌ 待确认 |

#### F3. 系统图标（部分已有）
| ID | 名称 | 当前状态 | 需要V2版本 |
|---|---|---|---|
| icon-bag | 背包 | ✅ sys-bag.png | ⚠️ 需V2风格 |
| icon-build | 构筑 | ✅ sys-build.png | ⚠️ 需V2风格 |
| icon-goal | 目标 | ✅ sys-goal.png | ⚠️ 需V2风格 |
| icon-settings | 设置 | ❌ | ✅ 需制作 |
| icon-close | 关闭 | ✅ close-*.png | ⚠️ 需V2风格 |
| icon-lock | 锁定 | ❌ | ✅ 需制作 |
| icon-unlock | 解锁 | ❌ | ✅ 需制作 |
| icon-gold | 金币 | ❌ | ✅ 需制作 |
| icon-material | 材料 | ❌ | ✅ 需制作 |
| icon-info | 信息 | ❌ | ✅ 需制作 |
| icon-warning | 警告 | ❌ | ✅ 需制作 |
| icon-success | 成功 | ❌ | ✅ 需制作 |
| icon-error | 错误 | ❌ | ✅ 需制作 |

### G. 装饰（Decorations）
| ID | 名称 | 出现位置 | 需要图片 |
|---|---|---|---|
| deco-star | 星芒装饰 | components标题 | ✅ |
| deco-compass | 罗盘装饰 | 可选 | ⚠️ |
| deco-corner | 面板角装饰 | 可选 | ⚠️ |

### H. 特殊组件
| ID | 名称 | 出现位置 | 需要图片 | 处理方式 |
|---|---|---|---|---|
| portrait-frame | 头像框 | hud左上 | ✅ | 64×64框+内容 |
| portrait-hero | 角色头像 | hud | ✅ | 已有hero-portrait.png |
| minimap-frame | 小地图框 | hud右上 | ⚠️ | CSS圆形裁切+边框 |
| minimap-marker | 地图标记 | minimap | ✅ | 小图标集 |
| tooltip-bg | 提示框底 | - | ⚠️ | CSS+箭头 |
| badge-number | 数字徽标 | 多处 | ⚠️ | CSS圆形+文字 |

## 二、优先级分类

### P0 - 立即制作（阻塞展示页）
1. btn-primary（5态）
2. btn-secondary（5态）  
3. btn-danger（5态）
4. btn-close（3态）
5. slot-item（含标记）
6. slot-skill（含标记）
7. checkbox（2态）
8. toggle-mode（3态）
9. panel-modal基础样式

### P1 - 核心界面（阻塞游戏接入）
1. 所有系统图标（V2风格）
2. 装备和技能图标验证
3. portrait-frame
4. minimap-frame
5. 状态条样式
6. tooltip基础

### P2 - 完整性（批次2-3）
1. 装饰元素
2. 特殊状态
3. 动画过渡
4. 响应式调整

## 三、处理策略汇总

### 需要切图的位图资源（✅标记）
- 按钮全状态
- 槽位底+标记
- 系统图标
- 装饰元素
- 头像框

### CSS/引擎绘制（❌或⚠️标记）
- 简单面板底（圆角+渐变）
- 分隔线
- 遮罩层
- 状态条填充
- 纯色背景
- 简单边框

### 动态生成（运行时）
- 所有文字
- 数值
- 冷却遮罩
- 比较结果
- 状态提示

## 四、V2特征检查清单

每个组件必须符合：
- [ ] 午夜蓝#1A2332或石板蓝#2D3E54底色
- [ ] 暖米白#FFF8E7文字
- [ ] 杏金色#FFB65C主操作/选中
- [ ] 轻巧面板（非厚重边框）
- [ ] 清楚留白
- [ ] 简洁字形
- [ ] 大而清晰的图标
- [ ] 无V1古铜雕花、铆钉

## 五、测量记录（待实际测量后填写）

组件源图坐标和尺寸将在实际打开图片测量后记录。

**下一步**：
1. 实际测量components.png中的按钮尺寸
2. 提取可独立使用的图标
3. 创建母版文件
4. 开始P0组件制作
