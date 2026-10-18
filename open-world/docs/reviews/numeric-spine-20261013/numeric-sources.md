# 数值来源与过期输入

以下原始扫描保留S0时点，schema版本不等于测量规则版本。当前唯一数值写入口为tools/spine/apply.ts；目标来自config/excel/节奏目标.xlsx → config/json/spine-targets.json，运行前使用pnpm spine:check检查源漂移与残留预算问题。

当前主干模型：tools/spine/data/spine-anchor.json保留S2八构筑L50冻结锚点；spine-player.json来自S7/correction-2/final-player真实13点+10平价配置；stat-weights.json来自S2的207组配对扰动；spine-flow.json来自经验分段推导。地城/世界来源为S7/correction-2/world/world-summary.json。V3预算来自S7/V3/budget/audit-summary.json，不能用初始绝对值审计替代。各模型带规则版本、提交号和原始文件路径/哈希；版本声明升号与实际重测分别记载。

归一、旋钮、怪物、世界、经验、钥匙和RATE计划均通过apply白名单及真实schema。旧主写入口已转为主干来源复核，以下旧模型保留作历史证据，不作为当前派生依据。

## 模型输入

| 文件 | 版本戳 | 是否过期 |
|---|---|---|
| .design/standard-player-20261005/model.json | {"client":"0.11.21","protocol":32,"rules":"ow-62","assets":"world-art-20261007-v24-world-runtime","db":16} | 是 |
| .design/starsea-balance-20261005/model.json | {"client":"0.10.19","protocol":23,"rules":"ow-37","assets":"world-art-20261005-v21-collision","db":13} | 是 |
| .design/numeric-flow-20261006/flow.json | {"client":"0.11.21","protocol":32,"rules":"ow-62","assets":"world-art-20261007-v24-world-runtime","db":16} | 是 |
| docs/reviews/open-world-m2-m4/W3/key-source-basis.json | {"client":"0.11.14","protocol":30,"rules":"ow-55","assets":"world-art-20261007-v24-world-runtime","db":16} | 是 |
| docs/reviews/open-world-m2-m4/W3/stage-aoe-hits.json | {"client":"0.11.14","protocol":30,"rules":"ow-55","assets":"world-art-20261007-v24-world-runtime","db":16} | 是 |

## 数值文件与写入者

| 文件 | 写入工具 | 模型输入 |
|---|---|---|
| packages/content/deep-progression.json | tools/accept-deep-progression.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/equipment-catalog.json | tools/activate-equipment-catalog.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/dungeons.json | tools/apply-dungeon-walls.ts | .design/numeric-flow-20261006/flow.json、.design/standard-player-20261005/model.json |
| packages/content/monsters.json | tools/apply-monster-curve.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json、docs/reviews/open-world-m2-m4/W3/stage-aoe-hits.json |
| packages/content/monsters.json | tools/apply-world-monster-templates.ts | docs/reviews/open-world-m2-m4/W3/world-monster-templates.json |
| packages/content/world-monster-template-spec.json | tools/apply-world-monster-templates.ts | docs/reviews/open-world-m2-m4/W3/world-monster-templates.json |
| packages/content/world-tiers.json | tools/apply-world-tier-curve.ts | .design/numeric-flow-20261006/flow.json |
| packages/content/inscription-rubbings.json | tools/build-inscription-rubbings.mjs | docs/reviews/build-variety-r6-20261006/inscription-art/result.json |
| packages/content/legacy-progression-gear.json | tools/build-legacy-key-gear.ts | 代码常量或配置；未声明测量版本 |
| packages/content/stage-key-gear-spec.json | tools/build-legacy-key-gear.ts | 代码常量或配置；未声明测量版本 |
| packages/content/appearance.json | tools/build-mini-hero.mjs | 代码常量或配置；未声明测量版本 |
| config/json/world.json | tools/build-production-islands.ts | config/json/world.json |
| packages/content/field-dungeon-stages.json | tools/build-production-islands.ts | config/json/world.json |
| packages/content/open-world/production.json | tools/build-production-islands.ts | config/json/world.json |
| apps/api/src/stage-key-pools.json | tools/build-stage-key-pools.ts | docs/reviews/open-world-m2-m4/W3/key-source-basis.json、.design/numeric-flow-20261006/flow.json |
| packages/content/starsea/campaign.json | tools/build-starsea-campaign.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/monsters.json | tools/build-w3-numeric-handoff.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json |
| packages/content/world-tiers.json | tools/build-w3-numeric-handoff.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json |
| apps/api/src/stage-key-pools.json | tools/build-w3-numeric-handoff.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json |
| packages/content/dungeons.json | tools/calibrate-hardmode-dungeons.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json、docs/reviews/open-world-m2-m4/W10/hardmode-wall-calibration.json |
| config/json/npcs.json | tools/check-world-resource-wiring.ts | config/json/npcs.json |
| packages/content/open-world/production.json | tools/check-world-resource-wiring.ts | config/json/npcs.json |
| apps/api/src/stage-key-pools.json | tools/copy-voice-host.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/world-tiers.json | tools/copy-voice-host.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/dungeons.json | tools/correct-wall-opening-pressure.mjs | 代码常量或配置；未声明测量版本 |
| config/json/world.json | tools/field-efficiency-probe.ts | .design/standard-player-20261005/efficiency.json、config/json/world.json |
| packages/content/monsters.json | tools/field-efficiency-probe.ts | .design/standard-player-20261005/efficiency.json、config/json/world.json |
| packages/content/gear-affixes.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/level-stats.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/monsters.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/combat-numerics.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/aspects.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/set-effects.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/effect-atoms.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/inscriptions.json | tools/measure-build-variety-preflight.ts | 代码常量或配置；未声明测量版本 |
| packages/content/stats.json | tools/measure-build-variety-r8-skill-options.ts | docs/reviews/build-variety-r8-20261006/skill-options.json |
| packages/content/level-stats.json | tools/measure-build-variety-r8-skill-options.ts | docs/reviews/build-variety-r8-20261006/skill-options.json |
| packages/content/monsters.json | tools/measure-build-variety-r8-skill-options.ts | docs/reviews/build-variety-r8-20261006/skill-options.json |
| packages/content/combat-numerics.json | tools/measure-build-variety-r8-skill-options.ts | docs/reviews/build-variety-r8-20261006/skill-options.json |
| packages/content/stats.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/augments.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/gear-affixes.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/level-stats.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/monsters.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/combat-numerics.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/aspects.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/set-effects.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/effect-atoms.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/inscriptions.json | tools/measure-build-variety.ts | 代码常量或配置；未声明测量版本 |
| packages/content/monsters.json | tools/measure-world-pack-growth.ts | docs/reviews/open-world-m2-m4/W3/pack-growth-current.json、.design/standard-player-20261005/model.json |
| packages/content/monsters.json | tools/propose-world-numeric-refresh.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json、docs/reviews/open-world-m2-m4/W3/key-source-basis.json、docs/reviews/open-world-m2-m4/W3/world-tier-basis.json |
| packages/content/world-tiers.json | tools/propose-world-numeric-refresh.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json、docs/reviews/open-world-m2-m4/W3/key-source-basis.json、docs/reviews/open-world-m2-m4/W3/world-tier-basis.json |
| apps/api/src/stage-key-pools.json | tools/propose-world-numeric-refresh.ts | .design/standard-player-20261005/model.json、.design/numeric-flow-20261006/flow.json、docs/reviews/open-world-m2-m4/W3/key-source-basis.json、docs/reviews/open-world-m2-m4/W3/world-tier-basis.json |
| packages/content/legacy-dungeon-calibration.json | tools/recalibrate-legacy-dungeons.ts | .design/standard-player-20261005/model.json |
| packages/content/dungeons.json | tools/recalibrate-legacy-dungeons.ts | .design/standard-player-20261005/model.json |
| packages/content/combat-numerics.json | tools/record-current-combat-fixtures.ts | 代码常量或配置；未声明测量版本 |
| packages/content/monsters.json | tools/record-w3-rank-feedback.ts | docs/reviews/open-world-m2-m4/W3/rank-feedback-review.json |
| packages/content/skills-extended.json | tools/record-w3-rank-feedback.ts | docs/reviews/open-world-m2-m4/W3/rank-feedback-review.json |
| packages/content/field-dungeon-stages.json | tools/retarget-island-dungeons.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/dungeons.json | tools/retarget-island-dungeons.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/open-world/production.json | tools/retarget-island-dungeons.mjs | 代码常量或配置；未声明测量版本 |
| config/json/world.json | tools/serve-world-w2-visible.ts | config/json/world.json |
| packages/content/open-world/production.json | tools/serve-world-w2-visible.ts | config/json/world.json |
| packages/content/dungeons.json | tools/serve-world-w3-visible.ts | config/json/world.json |
| config/json/world.json | tools/serve-world-w3-visible.ts | config/json/world.json |
| packages/content/open-world/production.json | tools/serve-world-w3-visible.ts | config/json/world.json |
| packages/content/encounter-balance.json | tools/starsea-balance-model.ts | .design/starsea-balance-20261005/model.json |
| packages/content/monsters.json | tools/starsea-balance-model.ts | .design/starsea-balance-20261005/model.json |
| packages/content/starsea/balance.json | tools/starsea-balance-model.ts | .design/starsea-balance-20261005/model.json |
| packages/content/island-enemy-frequency.json | tools/tune-island-enemy-frequency.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/monsters.json | tools/tune-island-enemy-frequency.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/stats.json | tools/verify-build-variety-r1-frames.ts | 代码常量或配置；未声明测量版本 |
| packages/content/deep-progression.json | tools/verify-progression-ui-redesign.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/deep-progression.json | tools/verify-progression-ui-system.mjs | 代码常量或配置；未声明测量版本 |
| packages/content/open-world/ow-graybox-wind.json | tools/world-graybox.mjs | .design/open-world-m0/graybox.json |
| config/json/world.json | tools/world-island-resource-usage.mjs | config/json/world.json、config/json/tasks.json、config/json/npcs.json |
| config/json/tasks.json | tools/world-island-resource-usage.mjs | config/json/world.json、config/json/tasks.json、config/json/npcs.json |
| config/json/npcs.json | tools/world-island-resource-usage.mjs | config/json/world.json、config/json/tasks.json、config/json/npcs.json |
| packages/content/open-world/production.json | tools/world-island-resource-usage.mjs | config/json/world.json、config/json/tasks.json、config/json/npcs.json |
| packages/content/monsters.json | tools/world-island-resource-usage.mjs | config/json/world.json、config/json/tasks.json、config/json/npcs.json |
| config/json/tasks.json | tools/world-m2-baseline.ts | config/json/tasks.json、config/json/npcs.json |
| config/json/npcs.json | tools/world-m2-baseline.ts | config/json/tasks.json、config/json/npcs.json |
| packages/content/dungeons.json | tools/world-m2-baseline.ts | config/json/tasks.json、config/json/npcs.json |
