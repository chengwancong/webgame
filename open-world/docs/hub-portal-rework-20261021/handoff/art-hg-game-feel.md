# 交接：界面游戏感（方向 A「明亮卡牌」）美术 ART-HG

> 2026-10-24 Claude（总策划）写给 Codex/GPT。
>
> 依据：`../planning-bd-v1/22-ui-direction-a-plan.md`，以及对照页 `../planning-bd-v1/21-ui-game-feel-compare.html` 中的方向 A。用户已选定方向 A：保留奶白浅金，表达改成厚、亮、图。
>
> 已有、不要重画：
> - E7 装饰件 `hub-ui/ui-ornaments.*`（品质格框、流光、花饰、分隔线、角花、尖角、提示条底）；
> - 评价章 `hub-fun/grade-s/a/b.png`；
> - 金币、星晶 / 星核、强化石图标。
>
> 分工：你出图、导出、登记；接线由 Claude 做。先出图，不等前端。

## 0. 执行方式、技术要求、硬阻塞

与 `art-hb-port-hex.md` §0、§3、§5 **完全相同**，只替换以下几点：
- 顺序：**R0 → G1 → G2 → G3 → G4 → G5 → R9**；
- 进度文件 `art-hg-progress.md`，决策日志 `art-hg-decisions.md`，本地目录 `.runtime/art-hg/`；
- 协作中心任务行 `ART-HG`：没有就新增一行，开工改「进行中」，完成改「待接线」；
- 本批运行时文件合计不超过 6MB；
- 图集统一输出到 `apps/web/public/art/hub-ui/ui-ceremony.{png,json}`，格式照 `ui-ornaments.json`（`frames` + 九宫格切片值）。G5 空状态插画单独输出 `hub-ui/empty-states.{png,json}`。

画风基准（R0 拼基准板 `.runtime/art-hg/baseline.png`，不提交）：
- 把 `ui-ornaments.png`、`grade-*.png`、`items-chibi/` 中 6 个道具，与对照页方向 A 的截图放在一起；
- 新件要和 E7 装饰件同属一个"奶白浅金、手绘厚涂、柔和深描边、左上光"的体系；
- 不要金属浮雕、皮革、铜钉。

## 1. 批次清单

### G1 缎带标题底（A34）
- [ ] `ribbon-victory`（胜利金）、`ribbon-retreat`（撤退灰蓝）、`ribbon-unlock`（解锁浅金）三条。
- [ ] 规格：源 720×120，九宫格横向可拉伸，左右是燕尾或卷边，中间留空放字。
- [ ] 中段高度约 72px，适配 34px 粗体加描边的文字；上沿要有亮边，下沿要有一条深色厚边，和方向 A 的按钮底边一致。

### G2 星级星（A35）
- [ ] `star-on`、`star-off`，各 96×96。亮星为金黄色加白高光；暗星为奶灰色加浅描边，不要纯灰。
- [ ] `star-flash-0…5`：点亮时的闪光，6 帧，128×128。

### G3 角标与经验图标（A36）
- [ ] `badge-new`（红底白字"NEW"，倾斜放置）、`badge-hex`（紫底白字"HEX"），各 96×48。白色描边，字形手绘，不要用系统字体。
- [ ] `icon-exp`：经验图标 128×128，和金币图标同画风。建议用"绿色宝珠加星"，避免出现字母。

### G4 结算背景（A37）
- [ ] `ceremony-rays`：放射光底，800×800，浅金到透明，可以缓慢旋转使用；中心不要太亮，以免压住缎带上的字。
- [ ] `ceremony-sparkle-0…7`：星屑或彩带粒子，8 种，每个 32×32 到 48×48，金、白、浅蓝三色。

### G5 空状态插画（A38）
- [ ] 6 张，每张 320×240，透明底：`empty-bag`（空背包）、`empty-commission`（空委托板）、`empty-loot`（空宝箱）、`empty-pet`（空宠物小窝）、`state-offline`（断开的星门或船锚）、`state-loading`（罗盘）。
- [ ] 画风和港口建筑原稿、`items-chibi/` 一致。画面安静不搞笑，留出下方放一行字的空间。

### R9 收尾
- [ ] 总览 `.runtime/art-hg/overview.png`：按对照页方向 A 拼一张"通关结算"示例（缎带、星级、资源胶囊、四张品质卡用 E7 框、两个按钮），再拼一张空状态示例。不提交。
- [ ] 跑 `npx tsc --noEmit -p .`、`pnpm config:check`，以及清单相关单测（`--maxWorkers=1 --no-file-parallelism`）。
- [ ] 进度文件末尾写「接线清单」：
  - G1 / G2 / G4 → U1 结算的 `ribbonTitleHtml` 和 `ceremony.css`；
  - G3 → `resourcePillHtml`、`rewardRevealHtml`；
  - G5 → `stateBlockHtml`；
  - 并写出每件的九宫格切片值。
- [ ] 协作中心改「待接线」，留言一行：`ART-HG 界面游戏感美术已出，接线清单见 handoff/art-hg-progress.md`。

## 2. 默认裁决（ART-HB §4 的 D-H2…D-H8 同样适用，另加以下几条）

| # | 问题 | 默认 |
|---|---|---|
| D-G1 | 缎带太华丽，和 E7 花饰抢 | 以 E7 为准，宁可更素；缎带只保留轮廓、亮边、底边三要素 |
| D-G2 | 金色在奶白底上发灰 | 提高饱和度，加深色描边，不改底色 |
| D-G3 | 角标手写字不清楚 | 先保证 48px 高度下能认出字，再考虑手绘感 |
| D-G4 | 空状态插画显得悲伤 | 改成"等待中"的安静氛围，例如船停在港口，不出现哭脸 |

## 3. 完成定义

- G1–G5 全部出图并登记；
- 总览图看过并写一句自检；
- 校验和单测通过；
- 没有图片进入 Git；
- 协作中心已更新。
