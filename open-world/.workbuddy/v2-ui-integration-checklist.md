# V2 UI 交付整改 - 实际接入清单

## 核查结果（2026-09-29）

### 工程现状
- **项目路径**: `/Users/chengmocong/Documents/ChatGPT/abyss-walker-rewrite/open-world/`
- **Web 应用**: `apps/web/` - Phaser + TypeScript
- **现有 UI 资源**: 43 个 PNG 文件（旧版魔兽风格）
- **V2 标准图**: 4 张完整设计稿（1672×941，现代卡通奇幻）
- **验收结论**: 不通过 - 实测 V2 元素为 0，V2 资源加载为 0

### 旧版资源清单（需替换）
**按钮类**:
- `btn-primary.png` / `btn-primary-hover.png` / `btn-primary-pressed.png` (1031/1080/1013 bytes)
- `btn-secondary.png` / `btn-secondary-hover.png` / `btn-secondary-pressed.png` (309/1452/321 bytes)

**面板框架**:
- `panel-frame.png` (1829 bytes) - 九宫格边框，当前为旧版银灰色

**槽位**:
- `item-slot.png` (146 bytes) - 装备/物品槽背景

**图标** (部分已补齐，但风格不统一):
- 技能图标: skill-bolt/chain/cleave/cut/ember/frost/lance 等
- 装备图标: gear-blade/bow/charm/coat/core/shield 等
- 系统图标: sys-bag/build/goal/settings 等

### CSS 当前样式分析

**色彩体系** (style.css:6-21):
```css
--hud-bg:#243641;           /* 旧版深蓝灰 */
--panel-inner:#2a4252;      /* 旧版内容区 */
--ink:#F4E8D0;              /* 米色文字 */
--accent:#E3AC45;           /* 金色强调 */

/* V2 色值已定义但未使用 */
--v2-midnight:#1A2332;      /* 午夜蓝 */
--v2-slate:#2D3E54;         /* 石板蓝 */
--v2-cream:#FFF8E7;         /* 奶油白 */
--v2-gold:#FFB65C;          /* 杏金色 */
--v2-magic:#49D2FF;         /* 魔法蓝 */
--v2-coral:#FF6B5B;         /* 珊瑚红 */
```

**组件引用**:
- `.plate` 使用 `panel-frame.png` 九宫格边框 (line 55)
- `button.primary` 使用 `btn-primary*.png` 三态图 (line 37-39)
- `.skill-slot` / `.entry` 硬编码背景色和边框 (line 112-149)
- `.minimap canvas` 尺寸为 150×150（验收报告指出溢出 12px）

### V2 标准图组件对照

#### 01-gameplay-hud.png 覆盖:
- [x] 角色状态面板（左上）- `#vitals` 
- [x] 目标追踪面板（左上）- `#tracker`
- [x] 小地图（右上）- `#minimapbox`
- [x] 技能栏（底部中央）- `#skillbar`
- [x] 系统入口（右下）- `#sysbar`
- [x] 模式切换（左下）- `#modebar`

#### 02-inventory-equipment.png 覆盖:
- [ ] 背包面板框架
- [ ] 装备槽位 UI
- [ ] 物品卡片
- [ ] 标签页切换
- [ ] 属性对比提示

#### 03-skill-build.png 覆盖:
- [ ] 技能构筑面板
- [ ] 技能库列表
- [ ] 装配槽位
- [ ] 技能详情卡片

#### 04-component-standard.png 覆盖:
- [ ] 按钮标准（主要/次要/禁用）
- [ ] 输入框
- [ ] 选择框
- [ ] 面板标题栏
- [ ] 关闭按钮
- [ ] 分隔线
- [ ] 标签页

## 接入计划

### 第一阶段：资源准备
1. 从 V2 标准图切图提取按钮、边框、槽位
2. 补齐缺失的技能和装备图标（V2 风格）
3. 建立可维护的母版体系（Figma/Sketch）
4. 验证所有切图的尺寸和透明度

### 第二阶段：共享组件重构
1. Button 组件 - V2 主要/次要按钮
2. Panel 组件 - V2 午夜蓝边框和背景
3. Tabs 组件 - V2 标签页
4. ItemSlot / SkillSlot - V2 槽位样式
5. Input / Select - V2 表单控件

### 第三阶段：逐模块游戏接入
A. 背包与装备（首个完整示范）
B. 技能构筑
C. HUD（角色状态、追踪、小地图）
D. 小地图尺寸修正（150→140）
E. 模式切换与自动设置
F. 目标与任务
G. 出行与区域选择
H. 设置
I. 登录与创建角色
J. 通用反馈（提示、通知）

### 第四阶段：构建与验收
1. 构建流程整改
2. 控件展示页整改
3. 四尺寸实机验收
4. 报告与清理

## 当前状态
- [x] 核查现有工程
- [x] 建立实际接入清单
- [ ] 资源与母版整改
- [ ] 共享组件整改
- [ ] 游戏接入
- [ ] 构建与验收

## 下一步
开始**资源与母版整改**：从 V2 标准图提取按钮、面板边框、槽位等基础组件资源。
