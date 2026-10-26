# 撤销潮印（去肉鸽）进度

依据：../planning-bd-v1/20-claude-remove-roguelike.md。基线提交 cadfaabe76ac6607f8fb8a19609bf283d46600c3。潮印整体撤销，装备 HEX 与 TAC-B1 不动。

- [x] R0 `721376af`：83 个直接引用文件已逐项盘点，并补齐无关键字的结算参数链；执行后回查新增依赖。
- [x] R1 `acfe1dbc`：选卡执行/门禁/字段删除；旧指令、真实跨段、隔离/备份维护PG通过。
- [x] R2 `acfe1dbc`：潮印目录/策略/契约删除；10本配置一致、内容/字段拒绝单测通过。
- [x] R3 `acfe1dbc`：机械删除面板/入口/倒计时/结算链；无潮印UI断言通过，原有修复与并行视觉改动未纳入。
- [x] R4：唯一采样 `8a5dfb21`，输入来源修复 `644f0d7d`（复用样本、无重采样），有效apply与唯一验证 `49aa2e23`；119场景检查完成，所有残差保留，无第三轮。
- [x] R5 `98e2fe20`：隔离发布检出tsc通过，34文件354项相关单测＋6文件25项临时PG全过，config:check 10本一致；版本0.11.57/protocol57/ow-97，assets/db19不变。
- [x] R6 `98e2fe20`：2026-10-24 19:14:43云发布成功；五项版本一致，19:19:35 curl＋既有WS真实跨段冒烟通过，协作中心通过指定脚本更新。

## R0 引用盘点

基线HEAD的五个指定目录按潮印/augment文本并补同名文件扫描，共 83 个文件。执行后回查增补隐藏依赖。

| 文件 | 处理 | 依据/保留原因 |
|---|---|---|
| apps/api/src/dungeon-service.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| apps/api/src/hub-dungeon-runtime.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| apps/api/src/pacing-lab.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| apps/web/src/augments-panel.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| apps/web/src/dungeon-controller.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| apps/web/src/main.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| apps/web/src/ui-system-showcase.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| apps/web/src/ui/primitives.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/asset-manifest/hub-fun.v1.json | 保留 | 历史静态美术来源与哈希登记；当前运行引用全部删除，图片不修改、不提交 |
| packages/content/augments.json | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| packages/content/augments.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| packages/content/dungeon-augments.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| packages/content/dungeons.json | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/content/dungeons.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/content/hub-dungeon-templates.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/contracts/dungeons.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/contracts/hub-dungeons.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/contracts/pacing.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/contracts/run-augments.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| packages/rules/augment-descriptions.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| packages/rules/frozen-augment-build.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| packages/rules/hub-port.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| packages/rules/run-augments.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| tests/build-variety-atom-parts.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-augment-offers.test.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| tests/build-variety-augment-panel.test.ts | 删除 | 仅服务局内随机潮印，不保留替代或开关 |
| tests/build-variety-dungeon-policy.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-frozen-attributes.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-r7-review.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-r7.database.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-r7.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-r8-measurement.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/build-variety-stage-continuity.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-art-wiring.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-b4-targets.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-dungeon-instance.database.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-dungeon-runtime.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-faction-freeze.database.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-outside.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-panels.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/hub-reward-model.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/numeric-spine-descriptions.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/pacing-completion.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/stage-key-ledger.database.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tests/stage-keys.database.test.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/_b4-list.txt | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/author-island-dungeons.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/build-variety-builds.json | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/build-variety-builds.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/hub-autopilot.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/measure-build-variety-preflight.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/measure-build-variety-standard.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/measure-build-variety.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/numeric-flow-sim.py | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/pacing/completion.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/pacing/diagnose-identity.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/pacing/inventory.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/pacing/measure.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/pacing/target-inputs.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/serve-world-w3-visible.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/apply.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/audit.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/content.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/create-verification-copy.py | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/data/content-audit.json | 保留 | 旧测量/接受基线证据，不改写为新规则已验证；新检查另记漂移与撤销状态 |
| tools/spine/data/sources.json | 保留 | 旧测量/接受基线证据，不改写为新规则已验证；新检查另记漂移与撤销状态 |
| tools/spine/data/spine-flow.json | 保留 | 带旧规则版本的历史派生模型；本期独立地城工具使用fresh标准人，不把它改标为新验证 |
| tools/spine/data/spine-known-deviations.json | 保留 | 旧测量/接受基线证据，不改写为新规则已验证；新检查另记漂移与撤销状态 |
| tools/spine/data/spine-source-lock.json | 保留 | 旧测量/接受基线证据，不改写为新规则已验证；新检查另记漂移与撤销状态 |
| tools/spine/descriptions.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/diagnose.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/hub-combat-measure.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/hub-reward-schema.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/hub-rewards.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/init-controls.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/player.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/preflight.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/prepare-json-own.py | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/report.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/schemas.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/spine/world.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/validate-content.ts | 改写 | 移除潮印字段、依赖或测量臂，保留其他行为/断言 |
| tools/verify-build-variety-augments-visible.mjs | 删除 | 仅服务局内随机潮印，不保留替代或开关 |

补充：battle-result-panel.ts 与 hub/hub-result-block.ts 的 hubChosenNames/chosenNames 为无augment关键字的潮印结算链，机械删除。config/json/pacing-targets.json 删除潮印体验，并同步源Excel正常导出；旧docs/reviews报告不动。

## 裁决

问题｜处理｜依据
本机只准tsc/单测/PG但R4需数值工具｜主干推导与验证在云端隔离容器串行执行，本机仅收汇总｜用户R4/R5与安全要求。
旧推导联动世界阶层怪物倍率｜本期固定世界阶层/野外/TAC-B1，只允许地城enemyScale差量经主干apply｜用户野外、战棋不动。
旧测量/锁含已撤销能力｜保留历史证据与哈希，新报告标注潮印已撤销，漂移不冒充全域新平衡通过｜用户历史报告不改写。
已有未提交改动｜保留并区分原断线恢复、build-guides及图片删除；仅提交本次机械删除/规则差量｜共享工作区边界。
旧副本存档与回执还含潮印字段｜只读隔离并拒绝恢复，不自动结算/退款；若要释放自有QA占位，用独立维护脚本先fsync备份、再只关闭实例与成员，不改角色/奖励/指令回执｜默认允许作废但必须先备份、限制库与身份。
云curl链路需要成员连接｜HTTP全部经curl，原生WebSocket仅负责已有hello/心跳/移动和auto输入；不使用浏览器或修改关卡状态｜现有副本ready/start要求live连接，仍验证真实清场与走通道。
取消开局选卡等待后自动寻宝与战斗导航互相拉扯｜寻宝自动模式先由既有World自动战斗处理存活敌人，再导航宝箱，不添加等待；手动交互规则不变｜实测45秒仍在箱0反复开箱中断且3敌存活，旧版先等待8秒隐式掩盖此问题；选择更直观的先战斗后拾取。

## 验证与提交

R0：已完整读取20号方案与交接。预计版本client0.11.57/protocol57/ow-97，assets/db不变；R5正式冻结。尚未运行数值推导/验证。

R4 执行前冻结：client **0.11.57** / protocol **57** / rules **ow-97**，assets **world-art-20261007-v24-world-runtime** / db **19**。主干入口、只允许地城HP/攻击叶子的深比较守卫、云端无网worker、13点构筑合法预检与范围单测均通过；容器先执行无测量的CLI --help依赖预检，成功后才写永久phase marker。尚未启动derive/verify。

R4 工具提交 `1a31a229`。首次worker预检在 `pnpm spine:check --help` 报tsx不在PATH，永久derive标记尚不存在、没有测量执行；只修显式PATH后重做加载预检，不计作额外推导。

R4 唯一采样来源 `8a5dfb21`：13点×D1/EHP×3种子及59个地城压力样本完成，无采样失败。计划曾预应用于工作区，验证前审查发现数值阶段的输入读取错误：实现用了怪物等级与legacy效率0.75，既有主干应使用stage.N.push.levels与既定η中位数0.7335055971815823。已校验文件等于该计划afterHash后撤回自己的未发布数值，原始计划/采样及错误应用留档保留。将只复用同一批13点/59条压力数据确定性修复输入来源，不重测、不按验证结果调参；唯一验证尚未开始。

2026-10-24 编译与配置：全仓 `tsc --noEmit` 通过；源 Excel 仅清空 `巅峰段完成度!A11:J11`（9个非空格）及8个profile JSON键，11页签10,656格的其他值/公式/格式不变；`pnpm config:export` 只导出节奏目标，`pnpm config:check` 10本一致。

本批针对性单测18文件178项通过；主干范围/节奏工具等19文件64项通过。新的 `roguelike-removal.database.test.ts` 在 `node tools/vitest-tempdb.mjs` 自有临时库中5项通过：旧指令无写入、首段真实清场到第二段、冻结构筑恢复、旧实例/回执只读隔离、先备份维护后只释放自有占位。

扩大回归44文件：621项通过、34项失败。用撤销前 `cadfaabe` 的隔离源码副本运行对应4文件，仍为同样34项失败，名称与错误文本逐项完全一致：R1旧构筑hash4、R2旧帧轨迹14、RS旧毒技能轨迹12、4个本地未提供的静态图标。保留这些历史断言与素材原状，不更新golden、不删断言、不补图；原始对比仅 `.qa/roguelike-removal/`。这部分不是本批新增回归。

扩大PG覆盖中，新巢穴清场走通道进第二段已通过。另在修正测试的既有操作流程：当前换海入口为hub/sea-tier；新增先行测试后不得假设全表条目数为0，应断言拒绝前后数量不变；宝箱怪单tick瞬态需在既有开箱窗口切手动观察，再自动真实击杀，保留全部奖励/位置断言和数值。

扩大PG的3项问题已解决并定向通过：换海使用现行hub接口、入场拒绝前后计数相等；宝箱怪诊断确认寻宝导航反复打断开箱，修服务端寻宝自动导航仅在存活敌人处理后执行，原数值不变。FP5最终16.79秒通过。加上之前通过的15项，四个相关PG文件18项均已验证；新撤销专用PG5项亦通过。全部在自有临时库，未操作常驻/云角色。

## 空缺与硬阻塞

R4 最终验证：53个原始定义/59个普通与困难场景、60个派生HUB切片，共119检查项；原始地城44/59清场，数值阶段26/27清场，HUB49/60清场（含2个无敌人片段未测）。数值阶段已清场首领中位46.75秒（目标70）、手动不施法承压中位2.83秒（目标30）；全域没有重新验收，不宣称平衡达标。没有追加采样或参数修正，详见新summary.md。

发布隔离：并行提交0332065a为界面重做，不纳入本批；发布检出位于 `G:/webgame/abyss-walker-migration/roguelike-release`，只有本批提交。稀疏检出共享资源连接曾误移除主工作区659个原本未修改的跟踪文件，已按Git原内容恢复并移除共享连接；资源内容差异已清零（原先inscription-rubbings差量保留），本地像素试验仍在，恢复文件不进入提交。后续仅独立检出所需JSON。

R5 发布检出最终 tsc 通过，34文件354项相关单测（含TAC-B1）全过，config:check 10本一致；额外无潮印UI断言通过。最终六组临时PG25项全部通过（含巢穴真实跨段、宝箱怪、重连、HEX/钥匙/回执保护、旧实例隔离与备份维护），尚未云发布。

空缺：世界阶层dungeonAugmentExtra奖励删除，不补其他奖励。
空缺补充：船台2阶额外潮印重抽随能力撤销，不挪成其他奖励；结算少本场构筑行、HUD少潮印按钮、展示页少示例标题，仅记录机械删除后的潜在空洞交给Claude。
当前无硬阻塞。数值目标未全部达到，按既定只验证一次要求保留残差，不继续调参。

## 最终交付

**潮印已撤销（ow-97 起），R0–R6完成并发布。** 删除生成、刷新、选择、自动选、存档/投影字段、推进门禁、90条内容目录、面板/倒计时/结算记录及纯潮印测试；混合测试保留共享机制与奖励防重覆盖。世界阶层额外轮次、船台2阶额外重抽取消，没有补成其他奖励或局内强化。兼容识别器只用于拒绝旧实例，历史报告和美术来源登记保留，不是功能开关。

发布源码 **98e2fe206d71899c22c96c8bd2dce6267a031a48**；版本 **client 0.11.57 / protocol 57 / rules ow-97 / assets world-art-20261007-v24-world-runtime / db19**。health/content/build-info均200且五项一致，build-info.source匹配。首页与14个引用JS核对通过：无选择潮印、本场/本局潮印、旧choose/reroll指令或倒计时入口。没有打开浏览器。

云端冒烟在一个新建自有QA角色上完成：正常开场回港→wind-story-1正常胜利→装备已激活技能→创建wind-nest-1→真实清完stage0→观测通道开启→进入stage1后退出。**35个HTTP请求均200**；HTTP均为curl，原生WS只做已有hello/心跳/合法auto/go输入，没有清场注入、传送、数据库改构筑。所有帧/响应未出现已撤销字段。数据库容器仍为86cadc993bb4，启动时间仍为2026-10-18T13:05:22.22657588Z，healthy；没有清库或维护真实角色/装备/奖励回执。旧实例维护工具只在临时PG验证，没有在云端批量清理旧账号。

R4关键数字：唯一采样含13个标准人点×2轴×3种子及59条真实终局压力；校正输入来源只复用原样本。有效计划改30个定义，风栖1倍率HP/攻击6.15/8.35→4.90/7.55，风栖2为8.90/9.40→7.15/8.50。唯一验证119检查项：原始地城44/59清场、数值阶段26/27清场、HUB49/60清场（含2个没有敌人的片段未测）；数值阶段首领中位46.75秒、手动不施法死亡中位2.83秒，相对70/30目标为-23.25/-27.17秒。全部残差、删失、多人/剧情切片限制及legacy大幅变化均列在 `../../reviews/roguelike-removal-20261024/summary.md`，不宣称数值平衡通过，不追加第三轮。

空缺清单：①世界阶层额外一轮奖励空缺；②船台2阶重抽收益空缺（原有通用奖励不改）；③HUD、结算栏、展示页机械删除后可能留白，交Claude；④主干EHP与不主动施法承压口径差异、未清场切片及两处无敌人剧情片段待后续设计验证；⑤34项旧金样/缺图断言在撤销前也失败，保持原样，未用改断言制造通过。并行方向A视觉提交未纳入本次发布。原始测量/计划/HTTP/构建留档均未提交，位于G:/webgame/aw-deploy/roguelike-removal-20261024及该次release目录。

给Grok的复测说明：打开 https://43-165-179-11.sslip.io/ ，先核对版本0.11.57/protocol57/ow-97，再用新建自有QA角色从拾星港星门进入巢穴，分别以手动和自动完成各段；清场后直接走通道/出口，确认没有选卡等待、三选一、刷新或倒计时，结算不列本局潮印。检查断线恢复、宝箱怪、奖励防重、装备HEX仍正常；记录节点、角色等级/构筑、卡住位置和复现步骤，界面空洞交Claude。不要用TAC-B1沙盒代替正式副本验收，不改数值、不清库；截图/视频仅留本地，未实际测试的内容明确标未测。
