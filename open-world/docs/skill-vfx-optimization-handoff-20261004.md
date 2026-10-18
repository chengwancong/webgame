# 技能特效优化交接任务单

核对时间：2026-10-04。由 Claude 静态审查源码与已有验收证据后整理，**尚未进实机逐个看画面**，所以第 0 阶段要先补齐真实画面基线。

给执行 agent 的任务：**把正式战斗里的技能特效从“程序线条为主体、素材为点缀”改为“已登记 Spine 特效库素材为主体、程序图形只画判定范围”，同时修掉挂点跳变、预算误裁剪和重复实现问题。每批交付真实战斗录像和逐技能对照，并经用户看图确认后才算通过。**

工作目录：`G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world`。先读 [AGENTS.md](../../AGENTS.md)、[项目.md](../../项目.md)，以及本目录的 [skill-vfx-v2.md](skill-vfx-v2.md)、[enemy-vfx.md](enemy-vfx.md)、[combat-contact-and-effects.md](combat-contact-and-effects.md)、[skill-repair-handoff-20261003.md](skill-repair-handoff-20261003.md)。核对工作区已有改动，保留其他任务的修改。

---

## 一、现状（已核实）

| # | 事实 | 位置 |
|---|---|---|
| F1 | 正式战斗只用 `combat-vfx.ts` 的 `SkillEffects`（由 `scene.ts:12` 导入）。 | `apps/web/src/scene.ts:12` |
| F2 | `skill-effects.ts` 也导出同名的 `SkillEffects` / `preloadSkillEffects`，但正式场景**没有使用**；`tests/skill-effects.test.ts` 测的正是这份旧实现，所以测试通过不代表线上特效正确。 | `apps/web/src/skill-effects.ts`、`tests/skill-effects.test.ts:3` |
| F3 | 另有 `skill-effects-before.ts`、`combat-vfx-before-polish.ts`、`combat-vfx-before-enemy.ts`、`vfx-profiles-before-enemy.ts`、`enemy-vfx-drawing-before-polish.ts`，只供 QA 对照页使用，容易被误改。 | `combat-art-qa.ts:6`、`monster-vfx-qa.ts:10` |
| F4 | 当前表现的主体是 Phaser `Graphics` 程序绘制（`ribbon / ring / sigil / polygon / sparks`，见 `vfx-drawing.ts`）。素材只是叠加层，而且透明度很低：刀光 `alpha*.6`、治疗/护盾 `alpha*.7`、护盾常驻 `alpha*.22`。正式素材只有 SP33 的 11 组 126 帧（`skill-fx.json`），加上 v2 新增的少量图集（`vfx-v2.json`）。 | `combat-vfx.ts:296-311, 386-391` |
| F5 | 用户 2026-10-03 指定 `Q版日式手游SPINE特效300套` 为现成特效库（Spine 3.7.93，约 300 套，含 `.json/.atlas/.png`），要求优先复用。目前只有 Starsea 流程把其中 30 个效果做了 `native-layer-adaptation` 序列帧（`public/art/starsea/vfx/clips.json`），并且只在 `starsea-vfx-preview.ts` 预览页使用，**没有接入战斗**。 | `apps/web/src/starsea-vfx-preview.ts` |
| F6 | v2 验收的 `coverage.json` 里 89 个配置**全部**是 `implemented-awaiting-visual-review`。`result.json` 也写明 13 个参考技能以外“不代表用户认可美术”。 | `docs/reviews/open-world/vfx-v2-20261001/` |
| F7 | 机制缺口导致特效没有真实事件可以消费：箭雨、陨石持续时间为 0，没有伤害；火球没有范围爆炸；怪物死亡爆炸不会触发。这些已列在 `skill-repair-handoff-20261003.md`，归技能修复任务处理。 | `coverage.json.knownPlayerMechanicsGaps` |

## 二、已发现的具体缺陷

**P1 · 视觉主体错位**：见 F4/F5。程序线条（深色描边 + 主色 + 高光三层线）与 Q 版手绘角色、场景风格不一致，大概率就是“特效有问题”的主要来源。

**P1 · 刀光挂点跳变**：`combat-vfx.ts:297` 写的是 `point = age<8 ? weapon(实时) : f.point(首帧冻结)`。第 8 tick 时刀光会从当前武器位置瞬移回出招位置；角色出招时如果在移动，跳动就很明显。应改为：释放时把世界坐标锁定在**命中/释放帧**的挂点，或者在整个 recovery 窗口内持续跟随，二选一，不能中途切换。

**P1 · 关键层被装饰预算裁掉**：前摇 `pool.graphics(key, …, false)`（`combat-vfx.ts:270`）、治疗/护盾主体 `decor:true`（`:311`）、地面区域碎片 `decor:true`（`:351`）都算“非关键”。满屏时，玩家前摇提示和护盾主体会先消失。分级规则应为：判定范围、施法主体、命中主帧、护盾/治疗主体属于关键层；只有碎屑、粒子、重复地面碎片属于装饰层。

**P2 · AOE 受击堆叠**：每次 `hit_resolved` 都会生成一份完整受击（圆盘 + 最多 14 粒子 + 一张 `48+power*12` 的 impact 图），范围技能打 10 个怪就叠 10 份。应加入同一 `castId` 的受击合并或数量上限：前 N 个完整播放，其余只播主帧。

**P2 · 屏幕震动过频**：`p.power===3` 的玩家技能（cleave、ground_slam、execute、meteor 等）每次命中都会触发震动，间隔只有 8 tick。应当只给 boss 技能和玩家大招保留震动，并允许在减少动态模式下关闭（已有 `reduced`）。

**P2 · 重复实现与测试错位**：见 F2/F3。

## 三、执行阶段

### 阶段 0 · 真实画面基线（先做，不改代码）

1. 按 AGENTS.md 启动本机服务，打开 `combat-art-qa.html`（只在 QA 构建中提供）。对 55 个玩家技能、14 个怪物技能、20 个 BOSS 技能逐个用 0.25 倍慢放录像并截取关键帧（前摇、释放、命中、收尾）。
2. 产出 `docs/reviews/open-world/vfx-baseline-20261004/`，包含 `matrix.json` 和截图。每条记录技能 ID、family、当前使用的素材、问题标签（`风格不符 / 挂点错 / 跳变 / 被裁剪 / 过暗 / 过亮遮挡 / 太小 / 时序不对 / 无事件`）。
3. **把矩阵和截图拼成总览图交给用户，请用户标出最在意的问题，再进入阶段 2。** 第 1 阶段可以并行进行。

### 阶段 1 · 收敛为单一实现

- 删除 `skill-effects.ts` 的 `SkillEffects` 类，只保留 `skill-fx-layout.ts` 里仍被 `combat-vfx.ts` 使用的纯函数。把 `tests/skill-effects.test.ts` 中仍有意义的用例（去重、暂停、死亡清理、换 World、弹体坐标）改写为针对 `combat-vfx.ts`。
- 所有 `*-before*.ts` 移到 `apps/web/src/qa/legacy/`，只允许 QA 入口导入。新增一条 lint 或测试，断言 `scene.ts` 的依赖图里不包含 `legacy/`。
- 验收：`pnpm typecheck`、`pnpm test` 通过，正式构建产物中不再出现旧类。

### 阶段 2 · 正确性修复（不换素材）

逐项修复第二节的缺陷：刀光挂点、预算分级、AOE 受击合并、震动策略。每项补充针对 `combat-vfx.ts` 的单测，例如：
- 刀光在 0..life 内位置连续，相邻帧位移不超过阈值；
- 预算打满时，关键层节点数不减少；
- 10 目标 AOE 的受击节点数不超过上限。

### 阶段 3 · 接入 300 套 Spine 特效库（主体）

**方案选择**：沿用 Starsea 已验证的“Spine → 逐帧烘焙序列帧图集”流程（`native-layer-adaptation`），**不引入 Spine 运行时**。原因：库文件是 Spine 3.7，与 Phaser 4.2 的官方 spine 插件（4.x 格式）不兼容；而且序列帧方案可以复用现有 `VfxPool` 和 `sprite()` 路径。

1. **检索与登记**：写 `tools/index-qban-vfx.mjs`，扫描 300 套素材，读取每套的骨骼版本、动画名、时长、画布尺寸、混合模式、主色调（取图集平均色），输出 `packages/asset-manifest/qban-vfx-index.json`，并记录原始路径和 sha256。
2. **选材矩阵**：按 `family × element` 给每个技能挑 1 个主素材和至多 1 个备选，写入 `packages/content/skill-vfx-map.json`，字段包括 `skillKey、stage(windup/release/flight/impact/zone/loop)、sourceId、animation、scale、tint、anchor、blend、timeScale`。同一机制允许共用素材，但同一职业页签里相邻技能不能撞图。**先出 12 个代表技能的选材对照图，请用户确认后再铺开。**
3. **烘焙**：扩展 Starsea 的导出器（Playwright + Chrome 逐帧渲染），输出 2048 图集，透明边裁切，记录真实锚点（地面类锚在脚底，飞行类锚在弹头中心，挂点类锚在发射点）。同一画布内保留原始时间线，并保证循环段可以无缝循环。
4. **运行时**：`combat-vfx.ts` 改为按 `skill-vfx-map.json` 查找素材，所有阶段都优先播放序列帧。程序图形只保留：
   - 判定范围细线 / 椭圆（与 `zone.radius`、`groundSize` 一致）；
   - 敌方预警（保持用户2026-10-04确认的「扩张填充」v2，见 `.design/telegraph-v2/approved-expanding-fill.png`，不能改）；
   - 链式闪电的连线（素材只放在端点）。
   找不到素材时报错并进入诊断，**不允许静默退回程序线条**。
5. **时序对齐**：素材的“爆点帧”对齐战斗 `cast_released` / `hit_resolved` 的 tick；前摇素材按 `windup` 拉伸或循环；收尾不得超过 `releaseTicks`，避免连招时尾迹堆积。

### 阶段 4 · 逐技能打磨与性能

- 尺寸以 `radius` 为准，地面类素材的视觉外沿与判定椭圆误差在 ±10% 以内；单体类素材按目标体型缩放（普通 / 精英 / 首领）。
- 混合：发光层使用 ADD，带颜色的主体使用 NORMAL，保证在雪地、草地上都看得清（沿用 v2 的规则）。
- 深度：地面层在单位脚下，竖立层按自身地面 y 排序，弹体按轨迹地面 y 排序。
- 性能：沿用 `vfxBudgets`，重测 20 敌 / 30 弹和 60 敌 / 100 弹两档，p95 帧时间不能比 v2 基线（17.8ms）差 10% 以上。新增图集按章节懒加载，首屏不加载全部 300 套。
- 减少动态模式：只播主帧、关闭震动和碎屑。

## 四、不许做的事（来自 AGENTS.md）

- 不改伤害、前摇、冷却、费用、成长、判定半径；特效只消费真实战斗事件。缺机制的技能（F7）只登记“等待机制”，**不允许用特效假装有范围伤害**。
- 不新画素材替代库里已有的合格素材；确认库中缺少合适素材才能制作，并记录原因。
- 不用贴图的透明边界代替程序判定边界。
- 不用一个固定屏幕偏移代替所有挂点；没有原始骨骼挂点的角色要标注为回退值。
- 不把静态预览当成动态验收，不把“配置已登记”当成“用户已认可”。
- 修改客户端后按 AGENTS.md 核对 `/api/health` 的版本一致性，用真实浏览器登录并进入野外战斗验证，保留存档。

## 五、交付与验收

每批交付：
1. 改动文件列表和版本号（client / assets 版本递增）。
2. `docs/reviews/open-world/vfx-qban-<日期>/`，包含逐技能前后对照截图、0.25 倍慢放录像、真实野外战斗录像，以及 `coverage.json`（状态区分 `registered / playing / user-approved`）。
3. 性能数据和预算命中率（`pool.stats()` 中的 `dropped`、`peakActive`）。
4. 测试：`pnpm typecheck && pnpm test && pnpm build`，加上新增的 vfx 单测。

完成标准：89 个配置全部为 `playing`，用户已对代表技能和其余技能分批确认（`user-approved`），F7 中的技能状态标为“等待机制”，而不是“完成”。

## 建议批次

| 批次 | 内容 | 预计规模 |
|---|---|---|
| B1 | 阶段 0 基线 + 阶段 1 收敛 | 小 |
| B2 | 阶段 2 四项缺陷修复 | 小 |
| B3 | 索引工具 + 12 个代表技能选材，请用户确认 | 中 |
| B4 | 烘焙管线 + 代表技能接入战斗 | 中 |
| B5 | 其余玩家技能铺开 | 大 |
| B6 | 怪物 / BOSS 技能 + 性能复测 | 中 |
