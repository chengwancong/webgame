# 深渊行者资源清单

更新日期：2026-09-29
状态：Phase 0-1 审计完成

## 一、UI资源清单

### 1.1 技能图标（Skills）

| ID | 文件 | 尺寸 | 状态 | 来源 | 用途 | 备注 |
|---|---|---|---|---|---|---|
| bolt | skill-bolt.png | 24×24 | ✅ 直接使用 | pockie_media/skills | 穿云箭 | 远程直线 |
| chain | skill-chain.png | 24×24 | ✅ 直接使用 | pockie_media/skills | 连锁闪电 | 传导伤害 |
| cleave | skill-cleave.png | 24×24 | ✅ 直接使用 | pockie_media/skills | - | - |
| cut | skill-cut.png | 24×24 | ✅ 直接使用 | pockie_media/skills/power_strike | 斩击 | 近战单体 |
| ember | skill-ember.png | 24×24 | ✅ 直接使用 | pockie_media/skills | - | 燃烧DOT |
| frost | skill-frost.png | 24×24 | ✅ 直接使用 | pockie_media/skills | 寒霜阵 | 区域持续 |
| **lance** | skill-lance.png | 24×24 | ✅ 映射已修复 | 实际文件存在 | 星矛 | 穿刺 |
| mend | skill-mend.png | 24×24 | ✅ 直接使用 | pockie_media/skills | 治疗 | 回复生命 |
| nova | skill-nova.png | 24×24 | ✅ 直接使用 | pockie_media/skills | - | AOE爆发 |
| rush | skill-rush.png | 24×24 | ✅ 直接使用 | pockie_media/skills | - | 冲刺 |
| ward | skill-ward.png | 24×24 | ✅ 直接使用 | pockie_media/skills | 护身印 | 护盾 |
| whirl | skill-whirl.png | 24×24 | ✅ 直接使用 | pockie_media/skills/whirlwind | 旋风斩 | 近战AOE |

**问题**：所有技能图标均为24×24，但目标显示尺寸为48-56px。需要：
- ⚠️ 查找高分辨率原图
- ⚠️ 或按统一画风重绘/制作替代
- ⚠️ 放大和滤镜不等于获得新细节

### 1.2 装备图标（Gear）

| ID | 文件 | 尺寸 | Trimmed | 状态 | 来源 | 用途 | 备注 |
|---|---|---|---|---|---|---|---|
| blade | gear-blade.png | 42×74 | ✅ | ✅ 直接使用 | pockie_items/sword_iron | 铁刃 | 武器 |
| **bow** | gear-bow.png | 42×74 | ✅ | ✅ 映射已修复 | 实际文件存在 | 穿云弓 | 武器 |
| charm | gear-charm.png | 42×42 | ✅ | ✅ 直接使用 | pockie_items | 护符 | 饰品 |
| coat | gear-coat.png | 42×42 | ✅ | ✅ 直接使用 | pockie_items/chest_leather | 皮甲 | 护甲 |
| core | gear-core.png | 42×42 | ✅ | ✅ 直接使用 | pockie_items | 核心 | 核心 |
| shield | gear-shield.png | 42×42 | ✅ | ✅ 直接使用 | pockie_items | 盾牌 | 护甲 |

**状态**：所有装备图标映射完整，无文字回退。尺寸在32-56px显示范围内合理。

### 1.3 系统图标（System）

| ID | 文件 | 用途 | 状态 | 备注 |
|---|---|---|---|---|
| bag | sys-bag.png | 背包入口 | ✅ | - |
| build | sys-build.png | 构筑入口 | ✅ | - |
| close | sys-close.png | 关闭 | ✅ | - |
| death | sys-death.png | 死亡 | ✅ | - |
| goal | sys-goal.png | 目标 | ✅ | - |
| gold | sys-gold.png | 金币 | ✅ | - |
| settings | sys-settings.png | 设置 | ✅ | - |
| target | sys-target.png | 目标 | ✅ | - |
| xp | sys-xp.png | 经验 | ✅ | - |

### 1.4 UI组件

| ID | 文件 | 尺寸 | 状态 | 九宫格 | 备注 |
|---|---|---|---|---|---|
| btn-primary | btn-primary.png | 99×28 | ✅ | 8 18 | 3状态（default/hover/pressed） |
| btn-secondary | btn-secondary.png | 58×22 | ✅ | - | 3状态 |
| close | close-*.png | 22×20 | ✅ | - | 3状态 |
| hero-portrait | hero-portrait.png | - | ✅ | - | 角色头像 |
| item-slot | item-slot.png | 26×26 | ✅ | - | 物品槽底板 |
| panel-frame | panel-frame.png | 130×177 | ⚠️ 已弃用 | 26 20 20 20 | R1改用细线边框 |
| portrait-frame | portrait-frame.png | 303×322 | ✅ | - | 大头像框 |

**R1变更**：`panel-frame.png` 九宫格边框已被细线+圆角+backdrop-filter替代，减轻视觉权重。

## 二、场景资源清单

### 2.1 角色（Characters）

| ID | 来源 | 动画 | 朝向 | 锚点 | 状态 | 适配项 |
|---|---|---|---|---|---|---|
| hero | pockie_media | idle, walk, attack | 左右 | 脚底居中 | ✅ 使用中 | 需验证锚点一致性 |

**待筛选**：从现有资源中选择动作完整、比例一致的一组角色。

### 2.2 敌人（Enemies）

| 类型 | 来源 | 状态 | 备注 |
|---|---|---|---|
| melee | pockie_media | ✅ 使用中 | 近战 |
| ranged | pockie_media | ✅ 使用中 | 远程 |
| charger | pockie_media | ✅ 使用中 | 冲锋 |
| shaman | pockie_media | ✅ 使用中 | 咒术 |

**待完成**：统一描边、色温、脚底锚点和阴影。精英通过轮廓/附属造型区分。

### 2.3 环境素材（Environment）

#### 当前实现（R1）
- **地面**：程序生成，统一色板 #66775B（地形）/ #B3A181（道路）
- **障碍物**：程序生成几何 + 分层绘制
  - 树木：深棕树干 + 三层渐变树冠 + 地面阴影
  - 建筑：石墙 + 暖色屋顶 + 明亮窗户 + 地面阴影
- **地标**：程序生成符号
  - 安全点：道路暖色 + 三角标记
  - 传送门：魔法青玉色 + 放射线
  - 首领入口：危险朱砂色 + 双圈

#### 待引入（Phase 3+）
- ⚠️ 草地/泥地/石路图块（需斜视角模块化拼接）
- ⚠️ 树木/岩石/断墙/石柱/门/灯精灵
- ⚠️ 营地建筑与首领入口地标
- ⚠️ 地面影子/交互标记/掉落物品

**要求**：
1. 统一斜视角（与现有角色匹配）
2. 统一光照方向（左上光源）
3. 模块化拼接能力
4. 许可可用于发布
5. 不得混用多套风格不同的免费资源

### 2.4 特效（Effects）

#### 当前实现（R1）
- 简单圆点/轮廓/线条
- 颜色变化 + 伤害数字

#### 待完成（Phase 2+）
- ⚠️ 6个样板技能的完整表现：
  - 前摇（蓄力）
  - 释放（出手）
  - 轨迹（飞行/扩散）
  - 命中（打击反馈）
  - 消散（结束）
- ⚠️ 友方与敌方不同形状语言
- ⚠️ 限制累计亮度与覆盖面积
- ⚠️ 危险圈始终可见（不被玩家特效覆盖）

## 三、字体资源

| 字体 | 文件 | 用途 | 状态 | 许可 |
|---|---|---|---|---|
| Noto Sans SC | NotoSansSC.ttf | 正文/数字/提示 | ✅ 使用中 | SIL OFL |

**标题字体**：待制作/选择一种有明确奇幻气质、字形可读的标题处理。

**尺寸规范**（1280×720基准）：
- 标题：22-28px
- 正文：14-16px
- 次要信息：12-13px

## 四、色板系统（R1已应用）

| Token | 颜色 | 用途 |
|---|---|---|
| --hud-bg | #182724 | 深墨青底 |
| --panel-inner | #1f2e2b | 面板内层 |
| --ink | #E8DFC8 | 主文字 |
| --ink-dim | #9BA89F | 次要文字 |
| --accent | #B79252 | 古铜强调 |
| --danger | #D8624B | 朱砂危险 |
| --ok | #7fae7a | 安全/成功 |
| --terrain | #66775B | 林地绿 |
| --road | #B3A181 | 风化砂石 |
| --magic | #6AB7A4 | 青玉魔法 |

## 五、缺项与优先级

### P0 - 阻塞发布
- 无（所有使用中的资源ID均有映射）

### P1 - 影响视觉一致性
- ⚠️ 技能图标高分辨率版本（当前24×24，目标48-56px）
- ⚠️ 角色与敌人统一锚点、描边、色温
- ⚠️ 战斗特效完整表现语言

### P2 - 增强沉浸感
- ⚠️ 环境素材图集（草地/树木/建筑）
- ⚠️ 标题字体
- ⚠️ 场景构图优化

### P3 - 长期优化
- ⚠️ 多分辨率适配验证
- ⚠️ 动画过渡优化
- ⚠️ 音效资源（当前audio:noAudio）

## 六、资源来源记录

### 已使用来源
1. **pockie_media** (skills, characters)
   - 许可：待确认
   - 风格：Q版卡通，24×24小图标
   - 状态：已导入并使用

2. **pockie_items** (gear)
   - 许可：待确认
   - 风格：偏写实装备，42-78px
   - 状态：已导入并使用

### 待引入来源
- ⚠️ 环境图块集（需选择/制作）
- ⚠️ 高分辨率技能图标（需查找原图或重绘）
- ⚠️ 标题字体（需选择有许可的奇幻字体）

## 七、构建与验证

### 资源构建流程
1. 原始素材 → `assets/imported/`
2. 处理脚本 → `tools/build_assets.py`
3. 输出清单 → `packages/asset-manifest/ui.json`
4. 最终资源 → `apps/web/public/art/`

### 验证检查
- ✅ TypeScript 编译通过
- ✅ 所有ID映射完整
- ✅ 无文字回退
- ⚠️ 需运行时验证实际显示效果

---

**下一步**：运行 `npm run dev`，在浏览器中验证bow和lance图标显示正常，地面统一，树木分层，HUD简化。然后继续Phase 2特效和Phase 3完整场景。
