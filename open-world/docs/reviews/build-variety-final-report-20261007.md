# 流派丰富度 R0–R8 最终交付报告

当前发布：client **0.11.11** / protocol **28** / rules **ow-52** / db **15** / assets **world-art-20261006-v23-build-variety**。

执行依据：handoff §0/§5.1，R1开始在用户M1基线0.11.3/26/ow-44/db15上递增。表内R0/RS历史版本只记录历史证据，未回退当前版本。用户统一试玩在各批自验收后进行。

## 批次、文件与验收

|批次/提交|主要改动|玩家路径与测试证据|client/protocol/rules/db|
|---|---|---|---|
|R0 e946e31|rules/item-power、API重铸：固定值不按阶段放大、重铸保留阶段|T1/T8比较、原实例字段保留、真实重铸与幂等；[R0证据](build-variety-r0-20261006/README.md)|历史0.11.1/25/ow-42/15|
|RS 19112f9|skills-expanded/skill-weapons、vfx-profiles、图标管线：77技能、元素/状态补全|七武器实际新技能命中/状态/前摇/资源；[RS证据](build-variety-rs-20261006/README.md)|历史0.11.2/25/ow-43/15；随后用户M1基线0.11.3/26/ow-44|
|R1 fd395a3|stats.json登记、damage-zones分池、规则收集|四旧角色300帧轨迹一致、登记/池/单位校验；[R1证据](build-variety-r1-20261006/README.md)|0.11.4/26/ow-45/15|
|R2 c6580b9|contracts/effects、simulation/conditions/effect-state、25连携规则、触发事件/上界跳过|旧连携轨迹、上界必暴击/几率、七武器可见路径；[R2证据](build-variety-r2-20261006/README.md)|0.11.5/26/ow-46/15|
|R3 a67f95d|effect-atoms50、新触发/动作、冻结/易伤/叠层/DOT暴击/自身状态|逐原子真实执行与18000tick/24动作预算、可见状态；[R3证据](build-variety-r3-20261006/README.md)|0.11.6/26/ow-47/15|
|R4 aae4d75|gear-affixes/main-stats/build-parts、公共Tips：24新副属性及部位主属性|真实发放/领取/穿戴/Tip/刷新、旧metadata字段保留；[R4证据](build-variety-r4-20261006/README.md)|0.11.7/26/ow-48/15|
|R5 3325c02|set-effects/unified-sets、18身份2+4、旧6套适配|真实4+2、最低造型阶段、总投射预算、旧规则读取；[R5证据](build-variety-r5-20261006/README.md)|0.11.8/26/ow-49/15|
|R6 31607fc|60威能/aspect-sources/skill-patches/charges、41铭纹/拓片、强化/单槽重铸事务与UI|七机制、真实重铸15强化、同部位拓印/分解、幂等/重启；[R6证据](build-variety-r6-20261006/README.md)|0.11.9/27/ow-50/15|
|R7 4a3da76|90潮印、私有run-augments/冻结basis、DungeonService/公共三选一|完整3轮/同档换组/刷新重连/准备换段/首领结算；realPG四项含受控IV半血第四轮；[R7证据](build-variety-r7-20261006/README.md)|0.11.10/28/ow-51/15|
|R8 6e31100|source-stat-multipliers、专属数值、环刃自动接近、balance17/反截尾、CharacterPanel/DamageBreakdown实际统计|17擅长项落带、234定位样本、旧帧/预算/阶段状态、完整回归及可见全路径；[R8证据](build-variety-r8-20261006/README.md)|0.11.11/28/ow-52/15|

所有数据库检查串行 `--no-file-parallelism`、一次一项重任务。当前浏览器验收使用可见Chrome1280×720；没有新无头浏览器验收。

## 最终机制与内容

内容校验的运行时数量：77技能、50原子、18新套装身份（保留旧6套）、60新威能（旧154仍可读）、90潮印（40银/35金/15棱彩）、41拓片。六机制与充能、状态/自身增益/计数器、上界覆盖/未覆盖跳过、真实effect_triggered和规则统计均有执行器及测试。

潮印选择/换组沿用真实command_id回执；私有种子/权重/入场目录冻结，公开只发当前三卡/已选/次数。重建从原入场值开始，保留本场资源、冷却、状态、充能及已消费不朽；跨段不重置这些运行计数，不复制旧场景导航或复活敌人。I–III是当前正式层级范围；IV额外轮次用隔离声明目录验证，不冒称当前正式开放IV。

界面使用奶白浅金公共组件。潮印和伤害构成各有三示意方案，功能版已经接真实数据，版式待用户选不阻塞。人物详细属性显示本场构筑与实际触发伤害/次数，hit毒注明已包含，多段/地面预算不重复计数。

## 平衡、种子、样本与限制

[最终17构筑表](build-variety-r8-20261006/final-balance-verified/summary.md)及[输入与逐样本](build-variety-r8-20261006/final-balance-verified/result.json)：seed41/73/107，153场景/种子组合、255真实战斗，擅长项0.888–1.191倍中位；无三项同时前三、无失败、无生存截尾。实际模板、合法主手/激活、2+4、核心及一次声明偏好潮印，不暗中筛掉技能。Solo显示1技能限制。

单体为三个独立90/50/20%初始生命30秒首领窗口，窗口内不恢复目标；耗尽则拒绝DPS结论。生存统一8秒后逐秒翻倍压力与高生命精英，计真实死亡。此固定压力竞技场只证明这些声明场景，不代表自然地城TTD、PvP、获取速度或所有玩家的最优三轮选卡分布。旧有限生命靶/截尾及每轮变化均保留，并另做相同修正场景的改前对照；[数值修改](build-variety-r8-20261006/content-adjustments.json)、[校准历史](build-variety-r8-20261006/calibration-history.json)。

234真实同武器组/同攻击技能对照：火箭CD120，30直伤+9燃烧；相对旧毒箭28含毒为raider -9.20%、guard +4.33%，三rank一致，均≤10%。[对照表与限制](build-variety-r8-20261006/skill-options.md)。暗影之握正式仍11/恐惧30，以下仅备选：

|方案|普通raider秒伤|控制覆盖率|
|---|---:|---:|
|现行11/恐惧30|49.19|21.81%|
|11/恐惧90|46.60|60.12%|
|18/恐惧60|80.43|43.70%|
|22/恐惧30|98.38|21.81%|
|石化15/90参照|45.93|43.52%|

恐惧实际移动目标与首领免疫仍运行，覆盖率不能只按配置帧数相除。用户决定正式定位前不应用暗影备选。

标准人当前再测360（60级单体/四目标×3种子），numeric-flow及两张表重算；地城设计平均DPS1.25/EHP1.10。装备/养成时点、自然掉率/材料、人类操作与额外BD分布仍未实测校准；本流派任务的复算不能充当开放世界numeric-flow§9/§10整体验收。钥匙严格当前阶段地城，跨阶段提前与15%目标继续取消。

## 测试与玩家路径

完整串行回归153文件1368通过/2既有跳过，tsc --noEmit、内容校验退出0；[最终回归记录](build-variety-r8-release-20261006/regression.json)。定向测量/面板/合法装配/上界及机制154断言、参数162断言通过。旧角色/装备/Stats/装配技能/300帧trace四组SHA均未变，只更新未装配的新火箭预览CD；[不变量](build-variety-r8-20261006/legacy-fixture-invariants.json)。原失败日志保留，没有删除失败案例或用错误HP基线掩盖。

[发布构建](build-variety-r8-20261006/build-polished/build.json) passed=true，生产/QA构建及恢复服务全部0，health=0.11.11/28/ow-52/db15，前后源码SHA一致。当前正式四表4账号/4角色/222回执/222流水数量和哈希原样，已有装备实例保留。

[R8同角色完整可见链路](build-variety-r8-20261006/player-path/result.json) ok=true：新技能野外实战→受控发放池下实际击杀掉落→拾取→新主属性/副属性/铭纹/威能头盔实际穿戴→三次潮印与同档换组→人物本场非零统计→刷新重连→准备换段→真实首领结算返城，原装备逐字段保留。面板截图见[真实统计](build-variety-r8-20261006/player-path/actual-rule-telemetry.png)。[正式登录与持久审计](build-variety-r8-20261006/live/result.json) ok=true，health/content/client一致，新当前库四表原行保留、仅新增4个审计回执；R4真实新装备/Tip，RS/R2七武器新技能野外，R6真实铭纹/重铸/强化，R7完整副本与重连的原路径均有日志/截图/本地视频。

## 存档验收结论与协作边界

**开发期已按用户授权清档，备份可追溯。** 2026-10-07用户直接确认2026-10-06 22:24由Claude执行整库清档，先做整库备份。开发期没有真实玩家，旧角色携带旧星潮海章节链进度，与新任务系统冲突，用户选择清档不写迁移。此前授权待核硬阻塞已解除。

当前正式库保持清档后状态，不恢复或覆盖旧数据，不增加迁移。旧正式存档项按用户指定的“开发期用户授权清档，备份完整可追溯（267/148/1910/1910，哈希与R4审计一致）”结案。之后的存档一致性只针对清档后的新库；新建角色完整路径和清档后已有角色服务重启/构建前后一致性已有通过证据，详见[授权后的存档验收](build-variety-save-acceptance-20261007.md)。原dump保留，备份SHA-256再次只读核对一致；隔离恢复副本早已清理（140946921→0字节）。当前活动的其它M1 QA隔离库保留。

handoff§5已补开发期授权例外：用户明确授权的清档不违反保留要求；以后再遇旧存档兼容，先询问用户能否清档，不先写迁移。未授权不得清档；用户要求保留时再确认保留方案。流派交接项按新口径全部完成，无硬阻塞。

Claude M1的精英词缀、悬赏、营地、世界层级、传送、world/quest Excel等保留工作区且不纳入本批提交；共享simulation/contracts/main等只暂存本任务hunk。检验对象是包含用户既有M1的当前工作区，未声称孤立SHA不带该基线也能运行。原允许的界面数值调优写入默认裁决日志，不删除确认内容。

## 附：最终串行回归逐文件结果

|测试|实际结果|
|---|---|
|`tests/story.database.test.ts`|通过：4 tests|
|`tests/dungeon-instance.database.test.ts`|通过：20 tests|
|`tests/equipment-runtime.database.test.ts`|通过：7 tests|
|`tests/build-variety-r3.test.ts`|通过：77 tests|
|`tests/build-variety-r7.database.test.ts`|通过：4 tests|
|`tests/starsea-reputation.database.test.ts`|通过：1 test|
|`tests/database.test.ts`|通过：39 tests|
|`tests/campaign-balance.test.ts`|通过：8 tests \| 2 skipped|
|`tests/starsea-respawn.database.test.ts`|通过：6 tests|
|`tests/api-startup-preflight.test.ts`|通过：1 test|
|`tests/progression-challenges.test.ts`|通过：6 tests|
|`tests/field-camps.database.test.ts`|通过：10 tests|
|`tests/first-chapter-combat.test.ts`|通过：12 tests|
|`tests/tasks.database.test.ts`|通过：6 tests|
|`tests/quest-v2.database.test.ts`|通过：2 tests|
|`tests/skill-mechanisms.test.ts`|通过：114 tests|
|`tests/deep-progression-api.test.ts`|通过：9 tests|
|`tests/progression-ui-fix.test.ts`|通过：7 tests|
|`tests/weapon-story.database.test.ts`|通过：3 tests|
|`tests/build-variety-r2.test.ts`|通过：48 tests|
|`tests/appearance-api.test.ts`|通过：7 tests|
|`tests/build-variety-r7.test.ts`|通过：95 tests|
|`tests/progression-ui-system.test.ts`|通过：14 tests|
|`tests/build-variety-r6.database.test.ts`|通过：1 test|
|`tests/deep-progression-rules.test.ts`|通过：22 tests|
|`tests/equipment-runtime.test.ts`|通过：8 tests|
|`tests/battle-result.database.test.ts`|通过：3 tests|
|`tests/story-encounter.test.ts`|通过：4 tests|
|`tests/world-navigation.test.ts`|通过：6 tests|
|`tests/field-recovery.database.test.ts`|通过：3 tests|
|`tests/simulation.test.ts`|通过：24 tests|
|`tests/item-affix-power.database.test.ts`|通过：1 test|
|`tests/world-warehouse.test.ts`|通过：3 tests|
|`tests/build-variety-r6.test.ts`|通过：74 tests|
|`tests/starsea-events.database.test.ts`|通过：2 tests|
|`tests/pool-resilience.database.test.ts`|通过：2 tests|
|`tests/test-login.test.ts`|通过：2 tests|
|`tests/progression-layouts.test.ts`|通过：5 tests|
|`tests/starsea-balance-model.test.ts`|通过：3 tests|
|`tests/build-variety-r4.database.test.ts`|通过：1 test|
|`tests/world-checkpoint.test.ts`|通过：4 tests|
|`tests/build-variety-builds.test.ts`|通过：19 tests|
|`tests/ui-graphics.test.ts`|通过：11 tests|
|`tests/world-tables.test.ts`|通过：2 tests|
|`tests/starsea-collision.test.ts`|通过：5 tests|
|`tests/build-variety-r4.test.ts`|通过：15 tests|
|`tests/vfx-v2.test.ts`|通过：5 tests|
|`tests/build-variety-rs.test.ts`|通过：30 tests|
|`tests/vfx-presence.test.ts`|通过：3 tests|
|`tests/build-variety-r5.test.ts`|通过：27 tests|
|`tests/world-camps.test.ts`|通过：5 tests|
|`tests/combat-event-feedback.test.ts`|通过：4 tests|
|`tests/starsea-reputation.test.ts`|通过：12 tests|
|`tests/build-variety-r6-review.test.ts`|通过：6 tests|
|`tests/build-variety-r1.test.ts`|通过：55 tests|
|`tests/vfx-art.test.ts`|通过：6 tests|
|`tests/build-variety-frozen-attributes.test.ts`|通过：9 tests|
|`tests/bag-ui.test.ts`|通过：14 tests|
|`tests/zone-roam.test.ts`|通过：3 tests|
|`tests/weapon-story-flow.test.ts`|通过：11 tests|
|`tests/skills-ui-system.test.ts`|通过：8 tests|
|`tests/build-variety-r4-review.test.ts`|通过：7 tests|
|`tests/effect-attachments.test.ts`|通过：4 tests|
|`tests/build-variety-orbit-auto.test.ts`|通过：1 test|
|`tests/weapon-combos.test.ts`|通过：14 tests|
|`tests/zone-guide.test.ts`|通过：1 test|
|`tests/balance-integrity.test.ts`|通过：9 tests|
|`tests/wardrobe-icon-content.test.ts`|通过：4 tests|
|`tests/gear-ui.test.ts`|通过：7 tests|
|`tests/build-variety-r7-review.test.ts`|通过：4 tests|
|`tests/world-aoi.test.ts`|通过：6 tests|
|`tests/skill-progression.test.ts`|通过：9 tests|
|`tests/elite-affixes.test.ts`|通过：3 tests|
|`tests/service-log-rotation.test.ts`|通过：1 test|
|`tests/drop-progression.test.ts`|通过：4 tests|
|`tests/starsea-build-depth.test.ts`|通过：5 tests|
|`tests/appearance-rules.test.ts`|通过：9 tests|
|`tests/world-sprint.test.ts`|通过：6 tests|
|`tests/starsea-boss-pressure.test.ts`|通过：3 tests|
|`tests/skill-approach.test.ts`|通过：11 tests|
|`tests/build-variety-r8-measurement.test.ts`|通过：5 tests|
|`tests/starsea-boss-enrage.test.ts`|通过：3 tests|
|`tests/build-variety-r6-issuance-review.test.ts`|通过：5 tests|
|`tests/level-stats.test.ts`|通过：4 tests|
|`tests/lightning-arrow-vfx.test.ts`|通过：3 tests|
|`tests/build-variety-replace-build.test.ts`|通过：5 tests|
|`tests/build-variety-r5-review.test.ts`|通过：3 tests|
|`tests/build-variety-benchmark.test.ts`|通过：4 tests|
|`tests/item-affix-power.test.ts`|通过：3 tests|
|`tests/build-variety-augment-offers.test.ts`|通过：7 tests|
|`tests/combat-collision.test.ts`|通过：13 tests|
|`tests/blizzard-vfx.test.ts`|通过：2 tests|
|`tests/monster-model.test.ts`|通过：8 tests|
|`tests/build-variety-stage-continuity.test.ts`|通过：2 tests|
|`tests/mini-native-renderer.test.ts`|通过：9 tests|
|`tests/story-npc-art.test.ts`|通过：7 tests|
|`tests/quest-v2.test.ts`|通过：8 tests|
|`tests/enemy-vfx.test.ts`|通过：7 tests|
|`tests/skill-effect-comparison.test.ts`|通过：6 tests|
|`tests/build-variety-skill-patches.test.ts`|通过：18 tests|
|`tests/ui-tokens.test.ts`|通过：5 tests|
|`tests/equipment-names.test.ts`|通过：4 tests|
|`tests/progression-combat.test.ts`|通过：4 tests|
|`tests/world-tier.test.ts`|通过：2 tests|
|`tests/combat-permit.test.ts`|通过：7 tests|
|`tests/telegraph-polish.test.ts`|通过：4 tests|
|`tests/ui-components.test.ts`|通过：4 tests|
|`tests/build-variety-dungeon-policy.test.ts`|通过：4 tests|
|`tests/api-source-guard.test.ts`|通过：1 test|
|`tests/build-variety-atom-parts.test.ts`|通过：6 tests|
|`tests/starsea-dialogue.test.ts`|通过：2 tests|
|`tests/dungeon-content.test.ts`|通过：3 tests|
|`tests/gameres-motion-timing.test.ts`|通过：3 tests|
|`tests/build-variety-damage-breakdown.test.ts`|通过：10 tests|
|`tests/projectile-emitter.test.ts`|通过：5 tests|
|`tests/build-variety-r3-review.test.ts`|通过：4 tests|
|`tests/hud-art-layout.test.ts`|通过：15 tests|
|`tests/inventory-ui-system.test.ts`|通过：5 tests|
|`tests/skill-effects.test.ts`|通过：8 tests|
|`tests/build-variety-results.test.ts`|通过：5 tests|
|`tests/world-numbers.test.ts`|通过：7 tests|
|`tests/build-variety-skill-charges.test.ts`|通过：6 tests|
|`tests/hero-appearance.test.ts`|通过：4 tests|
|`tests/build-variety-r6-item-rules.test.ts`|通过：3 tests|
|`tests/build-variety-inscriptions.test.ts`|通过：7 tests|
|`tests/hit-feedback.test.ts`|通过：5 tests|
|`tests/build-variety-effect-descriptions.test.ts`|通过：5 tests|
|`tests/world-exploration.test.ts`|通过：4 tests|
|`tests/mini-native-loading.test.ts`|通过：3 tests|
|`tests/ground-zone-vfx.test.ts`|通过：3 tests|
|`tests/native-skin-composition.test.ts`|通过：3 tests|
|`tests/bounty.test.ts`|通过：1 test|
|`tests/build-variety-stat-conversions.test.ts`|通过：4 tests|
|`tests/combat-audio.test.ts`|通过：2 tests|
|`tests/build-variety-single-reroll.test.ts`|通过：4 tests|
|`tests/build-variety-augment-panel.test.ts`|通过：5 tests|
|`tests/travel-browser.test.ts`|通过：6 tests|
|`tests/build-variety-build-sources.test.ts`|通过：2 tests|
|`tests/ice-vfx.test.ts`|通过：3 tests|
|`tests/shield-feedback.test.ts`|通过：5 tests|
|`tests/hud-context.test.ts`|通过：6 tests|
|`tests/world-inventory.test.ts`|通过：3 tests|
|`tests/story-gates-ui.test.ts`|通过：3 tests|
|`tests/wardrobe-renderer.test.ts`|通过：6 tests|
|`tests/ground-loot.test.ts`|通过：3 tests|
|`tests/build-variety-set-stage-ui.test.ts`|通过：3 tests|
|`tests/battle-result-controller.test.ts`|通过：2 tests|
|`tests/objective.test.ts`|通过：2 tests|
|`tests/boss-entry.test.ts`|通过：3 tests|
|`tests/world-chunks.test.ts`|通过：1 test|
|`tests/preview-guard.test.ts`|通过：4 tests|
|`tests/hero-death-playback.test.ts`|通过：2 tests|
|`tests/field-readiness.test.ts`|通过：1 test|
