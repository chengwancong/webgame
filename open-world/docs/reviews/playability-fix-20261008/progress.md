# 玩家体验修复进度（2026-10-08）

执行顺序：F1 → F6 连续执行；D1–D4 已确认；不修改数值；重任务串行；GUI 1280×720；只写隔离 PG。

## §7 完成定义

- [x] F1–F6 每条根因、修改、定向测试、真实路径截图与 AX 证据齐全。
- [x] P-01 至 P-10、结算单位、对白复读、清场文案、世界层级理由、天赋重复点击均已处理。
- [x] D1–D4 已实现，quest-system 文档同步。
- [x] 完整回归、pnpm build、health/content 与客户端版本核对、生产包GUI 登录与会话恢复进入营地通过。
- [x] §4 存档复验与 recheck.md 十维度评分完成；层4真实39分38秒，已自然达到层5并通关stage19。
- [x] 正式库无玩家状态写入；正式8612仅只读health/content，全部游玩在独立127.0.0.2隔离PG。
- [x] 数值观察已记入 recheck.md 数值批次待办，未改怪物、掉率、经验、费用或公式。

## 批次

- [x] F1：P-01 卡忙、P-02 统一交互候选。
- [x] F2：P-09 取消追踪、P-05 相位进度、D1 阶段引导与文档。
- [x] F3：P-03 航标溢出、P-04 战斗信息布局。
- [x] F4：P-06/D2 首领主动接敌、清场说明、层级风险回报。
- [x] F5：P-07 失败回顾、P-08/D3 钥匙适配与预览、Tooltip 单位。
- [x] F6：对白、天赋批量、D4 沉星房型与野外短目标。
- [x] 最终隔离存档复验、构建、正式服务同步及生产包GUI补验。

## 决策日志

见下方逐项决策日志；按 §5 记录依据、影响与回退方式。

## 阻塞点

尚未发现硬阻塞。

## 数值批次待办

本轮不调整数值；已记录的同强化取舍、不同奖励来源、失败输出占比和高层续玩观察见后续逐批记录及 recheck.md 的数值批次待办。

## 提交与证据

F1：5c0b72d；F2：7c4d14f；F3：22694e1；F4：c0fba54；F5：28824f9；F6：fc7e22a。最终收口代码、回归、构建与生产GUI均已完成，本进度文件随最终收口提交保存，具体hash见Git最新提交及最终§8汇报。其他会话未提交改动保留，仅提交本轮明确拥有的增量。

## 最终状态与续接说明

全部§7完成，无§6硬阻塞。F1–F6连续完成并提交，§4三条自然路径及十维度评分见recheck.md；最终回归212文件/1596通过/2原有skip，标准pnpm build通过，正式Limited常驻服务恢复，health/content与生产客户端五版本一致，生产包GUI登录/刷新恢复/两航标/取消追踪/同强化预览均已验收。当前无需继续批次或重复测试。

按用户最新指令，构建占用只停止本次隔离Vite后重试，未改构建脚本；不再新增或运行指纹、前后像、审计脚本。31个本轮临时脚本已删除。QA内保留自然成长数据库、五分支只读备份及当前生产预览配置，正式服务和隔离生产包维持可访问。以下是执行历史，其“下一步/待完成”均是当时记录，不能覆盖本节的最终状态。

最终自有增量提交采用既有baseline index与final-manifest，不整体暂存共享文件。发布代码已测试并构建，此后只更新本目录报告/截图和清理自有.qa临时文件；不修改产品代码或其他会话改动。

## F1 实施记录（进行中）

- P-01 根因：main.ts heartbeat/applyReceipt 在 processing=true 时重绘已打开面板，正常续租 finally 仅 syncPause，没有重绘；形成已完成请求留下的禁用 DOM，后续点击不会发请求。write finally 同样缺恢复重绘。修改为 finally 恢复状态并保留焦点重绘；续租从 flush 前持锁，避免异步间隙命令竞态。Outbox 写事务与打开操作增加 10 秒超时，事务超时 abort，保留既有请求 10 秒保护与待确认/恢复链路。
- P-02 根因：main.ts interact 先航标/悬赏板，starsea.prompt 另按最近任务对象/门户选择。增加 interaction-candidate.ts，提示与 E 共用 ID、距离与优先级选择；当前任务 NPC > 门户 > 航标 > 悬赏板 > 其他对象；不删除任何服务。
- 定向测试：f1-directed.log，2 文件 9 测试通过；f1-types.log，tsc --noEmit 通过。
- 完整回归：f1-regression.log，正在串行执行（含隔离真实 PG）。
- GUI：可见 IAB 1280×720 已显示独立 127.0.0.2 登录页；操作工具多次超时，登录/新手路径尚未证实，禁止记通过。后续继续恢复控制取证。
- 隔离：isolated-session.json，独立 PG 10838，API 10839，网页 10840；已恢复 final-new/final-late/final-endfresh/checkpoint-30 四份报告存档并创建空库。正式 8612 未打开、正式库无写入。
- 工作区基线：workspace-baseline.patch/txt；.qa/playability-fix-baseline.index 保存开工工作状态，提交时只取相对基线的本轮 delta，避免收进其他会话改动。

### 决策 001

依据 §5 与 P-01 的无请求证据，先修已确认的忙 DOM 残留与命令竞态，同时给本机前置持久化加超时，不把无请求归咎为服务端传送失败。影响：正常续租/写操作完成后控件恢复；失败仍保留待确认与恢复入口。回退：撤销本轮 main.ts/network.ts 变更，不碰原有成长/回执。

### 决策 002

GUI 工具超时只影响取证，不提前宣布 §6 隔离硬阻塞。独立 PG 已搭建，继续所有可独立完成的产品修复与测试，GUI 证据未完成项保留并在工具恢复后补齐。

### 决策 003（测试执行时限）

F1 完整回归中的 world-natural-calendar.database.test.ts 在 600000ms 既有时限超时：no-quests 已自然到 50 级且 failures=[]，attempt-all-tasks 已到 37 级，尚无业务断言失败。保留首次失败日志。为同机串行完整执行增加 AW_LONG_TEST_TIMEOUT_MS 环境覆盖，默认时限仍 600000ms；本轮重跑使用更长墙钟时限，不改变游戏数值、不删断言、不限制策略、不跳过防重/真实 PG。待当前回归退出后串行重跑该测试，再继续完整回归。回退仅移除测试环境时限覆盖。

## 当前精确续接点（2026-10-08 20:27）

1. 当前独占重任务：exec session 89259，node heavy-job-lock PID 70684 → vitest PID 23572；f1-regression.log。首个自然日程测试因 600000ms 超时失败，后续 worker PID 42168 于 20:20:51 启动，仍在跑完整其余回归；不要同时开另一 vitest/构建/PG 测量/GUI 驾驶。首次失败必须保留。
2. tests/world-natural-calendar.database.test.ts 已将显式时限改为 Number(process.env.AW_LONG_TEST_TIMEOUT_MS??600000)，默认不变。下一次运行设 AW_LONG_TEST_TIMEOUT_MS=1800000，完整两策略都跑，不设 AW_CALENDAR_STRATEGY、不删断言。
3. F1 产品修改：apps/web/src/main.ts（心跳/写请求 finally 重绘恢复；统一 interactionCandidate/executeInteraction）、network.ts（Outbox init/tx 10秒超时）、新 interaction-candidate.ts；测试 playability-interaction/outbox。9定向通过，tsc通过。未完成 GUI 证据。
4. real index 已仅暂存本轮 main.ts/network.ts 差异，git apply --cached --3way 成功，32+2行插入/3+2行删除。不得 git add main.ts 全文件，它有其他会话未提交修改。新文件和测试/本轮 progress/evidence 可单独暂存。基线 index=.qa/playability-fix-baseline.index；生成 delta 必须 git diff --binary --output=...，禁止 PowerShell 管道转写 patch（会改变换行导致 apply 失败）。提交后应将本轮 delta apply --cached 到该基线 index 并暂存本轮新文件到基线，下一批继续相对它提取 own delta。
5. 隔离 host exec session 50742，ownerPid46880。独立PG10838，API10839，Vite127.0.0.2:10840；配置 isolated-session.json，host-control.json 可写 {phase:fresh/new/late/endfresh/middle,reload:N} 让 host 重启API，阶段各自独立数据库。来源 final-new/late/endfresh/checkpoint-30均恢复。仅自建新目录 .qa/playability-fix-1791461103490，不调用 runtime.reapStale，不动其他QA或正式8612。早两次自建启动尝试已停PG，目录留存。
6. GUI：IAB browser2/tab1，可见1280×720。about:blank后已到隔离URL，截图登录页正常；多调用合在60秒内仍超时，kernel已重置。恢复时从同 browser2 获取handle，用 browser.tabs.get('1') 绕过 getTab 自动抓取超时；单次只做一个 fill/click/snapshot（单截图约25秒，元信息约12秒）。上一组 fill账号fix_20261008_fresh/click进入游戏的结果未知，必须先重新观察，不能盲重试。禁止调用普通Playwright/其它API控制浏览器、禁止headless/SwiftShader。测试重任务结束再GUI操作。
7. F2 预备脚本=.qa/implement-f2.py，尚未执行。包含 contracts trackedManually/tideProgress/hardmodeBossCleared、服务端阶段推荐/普通与裂星潮分离、航图与世界层级4剩余进度、取消追踪不报完成、quest-system §5.4 文档。还需补首领结算 phase_progress 字段/服务端冻结相位解析/显示，以及F2定向测试；执行前检查脚本全部锚点。
8. F2 Excel 预备=.qa/playability-config/edit-tasks.mjs，尚未执行；Artifact Tool加入4条说明页参数 recommend_stage_boss/recommend_stage_tide/recommend_stage_complete/boss_approach，输出 .qa临时任务.f2.xlsx 后校验未改原单元格再落回正式内容源并 pnpm config:export/check。已完成Artifact import与说明页原图查看 .qa/playability-config/tasks-before.png。需先成功运行技能 container_tools/mark_artifact_operation_started.mjs（operation edit，expected-output-count按实际变更工作簿数）一次，再首次author。依赖junction已建到 bundled node_modules；用loader Node执行该builder。导出路径目前用URL.pathname需改 fileURLToPath，避免中文百分号编码路径。
9. 后续技能：frontend-ui-engineering/computer-use已读且告知；Spreadsheets已告知，用Artifact Tool改既有配置；已读quick start/style/edit workflow，SKILL全文分段读取，可能还需核对110–194段未截断部分。配置不能另起旁路硬编码任务/NPC/对白。
10. F3锚点 ui/minimap.css .region-map-actions flex不换行；ui/hud-layout.css:19 把dungeon-hud居中top16，与ui/hud.css:22 bossbar居中top12冲突。F4 simulation/index.ts:autoMove约376只选anchor/radius内敌人，region.boss单目标应全auto/semi主动接近且保持野外radius；starsea guide/HUD按场景目标优先。F5 stage-key-rewards.ts已经主手适配，不改数值，补同强化服务端只读预览；dungeon-diagnostics.ts当前无boss直接return不记录ticks/承伤，须覆盖前段与岛首领。F6天赋max复用逐点服务端规则/费用/事务，dialogue seen accept:id已存在，加入进行中对白配置，沉星变体不得更改怪物/奖励参数。

## F1 GUI 已取证（21:20 更新）

- 新建独立账号 fix_20261008_fresh，真实首战自然到 Lv2，沿正式箭头走到船台湾途中 Lv3；无授予。
- 航标激活后同站位，画面提示 E 和领航员米洛对话，按 E 实际打开米洛交谈，不再误开悬赏板。证据 f1-milo-prompt.png、f1-milo-e-correct.png/txt、f1-waypoint-activated.txt。
- 野外正式技能页 → 法术 → 寒霜阵，UI 显示 3/3 达成、激活消耗无，点击激活成功变 1/5，显示升级/装配，关闭按钮可用并实际成功关闭。证据 f1-frost-before.txt、f1-frost-activated.png/txt、f1-skill-close.txt；api-fresh.log 中 POST /api/skills/activate 已发出。
- GUI 发现恢复处理不能无条件每次心跳重绘，否则正在读/点的对白 DOM 被替换。已增加 panelBusy 只在面板确实绘制过忙态时恢复；真实写请求开始绘制忙态，完成恢复；正常后台续租不重建对白。
- 定向最终 11 项通过：f1-directed-final.log。完整回归 197文件/1507项通过，1项自然日程时限失败需较长时限重跑；2项既有跳过位于 campaign-balance.test.ts 的 melee/ranged 历史场景，未新增跳过，未改任何防刷/防重断言。
- IAB 设置 visibility=true 后 Playwright DOM 通道恢复；每个浏览器 API 仍约21秒开销。单次一动作+domSnapshot约42秒，控制超时上限60秒，别打包3个API导致kernel reset。截图用 tab.screenshot 比原生 getScreenshot 少一次包装，待核对；所有浏览器仍由 cua_repl 控制。
- 正常退出新手账号后，切换 host-control.json 到 endfresh/reload1；下一步等待API_READY endfresh，浏览器reload，然后登录已恢复账号 calendar_9637b11f7557437b。通过航图到龙眠岛（存档最后在boss6场），打开区域地图点击誓约庭传送，记录请求/AX/截图；之后用 late 库检查界桥前庭。

## F1 完成与验收

| 问题 | 根因与修改 | 证据 |
|---|---|---|
| P-01 野外卡忙 | GameApp.heartbeat/write：忙态绘制后无恢复重绘；增加 panelBusy 精确恢复，写命令前后显示真实状态，区分前置未发出与已提交待确认。Outbox 全部打开/读/写事务有10秒保护、abort/error处理、恢复提示和原始cause。 | f1-directed-final.log（14项）、f1-types-final.log；evidence/f1-frost-activated.png/txt、f1-skill-close.txt、f1-dragon-waypoint-success.png/txt、f1-rift-waypoint-success.png/txt、f1-network-summary.json |
| P-02 E 对象一致 | interaction-candidate.ts + GameApp.interactionCandidate/executeInteraction；提示、E和提示点击共用候选ID、距离与优先级。当前任务NPC > 门户 > 航标 > 悬赏板 > 其他对象。保留所有对象功能。 | 6组两两重叠与距离边界测试通过；evidence/f1-milo-prompt.png、f1-milo-e-correct.png/txt；普通后期港口箭头→E实际打开正式航图。野外回港精确边界将在§4统一逐路径复验再覆盖。 |

- 完整回归首次：198文件，197通过；1507项通过、1项自然日程600秒超时、2项既有历史跳过。原失败保留 f1-regression.log。
- 唯一失败重跑：f1-natural-retry.log，两策略完整自然到50级，failures=[]，974.558秒，通过；AW_LONG_TEST_TIMEOUT_MS=1800000，默认时限与全部业务断言未改。
- 最新定向：2文件14项通过；最新 tsc --noEmit 通过。
- 正式请求：技能激活200/49.84ms、誓约庭200/205.49ms、界桥前庭200/115.77ms；对应GUI均完成并复位，数值未改，正式入口未打开。
- GUI现在为同一可见IAB tab1的about:blank，角色进度已由正常请求保存；PG host保持late分支，下一批开始前按需要重载API。
- 下一步：提交F1后，执行 .qa/playability-config/edit-tasks.mjs 的受控Excel修改与导出校验；执行预备F2脚本、结算脚本及6项定向测试，修正实际错误后进行F2完整回归与终局相位GUI验收。
F1 提交：5c0b72d；F2 已开始。

## F2 实施与决策（进行中）

- P-09：starsea-controller.step 不再把 tracked/task 变空当作故事完成；真实完成演出仍只消费服务端 completion.id。取消追踪不发奖、不改变 done。
- P-05：contracts/starsea.ts 新增 hardmodeBossCleared/tideProgress，服务端读取 world.hardmodeBosses；航图区分普通已平定和裂星潮待挑战/已完成，显示剩余岛；world-tier.ts 按层4真实条件列 x/6、剩余。首领结算通过追加只读 /combat/results/:id/progress 读取本场冻结怪物等级识别相位，保留原 /combat/results/:id 返回结构。
- D1：starseaTracked 统一HUD/任务页有效追踪；超过首岛等级带或开放后续岛时，旧自动新手目标降级，任务保留且可手动追踪。阶段推荐为下一未平定首领或裂星潮x/6下一岛，文案来自任务.xlsx新增4行参数。quest-system §5.4同步。
- Excel验证：8页、29244原单元格、2303原数值、106原表头批注保持一致；config:export/check通过（6本一致）。证据 f2-workbook-preservation.json。没有改奖励、经验、费用或怪物数值。
- 定向最终：5文件24项通过，包括真实PG下手动标记持久但不暴露给旧严格快照、相位读取零角色/回执写入、跨角色404。f2-directed.log；tsc通过，f2-types.log。

### 决策 004（兼容与真实性）

依据既有 battleResultSchema.strict 与 StarseaV2State.strict，新增相位元信息走追加的服务端只读接口，手动追踪意图仅服务端保存并在公开角色快照剔除；不关闭或放宽任何现行校验。历史授权缺冻结怪物记录时显示未记录，不从当前世界相位补造历史。本场结果用“本场进度”标相位，避免重复挑战被误读为新增完成。影响：旧客户端旧接口保持可读，新客户端获得真实分相位数据；回退仅移除本轮追加视图接口/字段，不动奖励与流水。

## 当前下一步

API host 正在重载 endfresh/reload3；确认 API_READY 后在可见IAB恢复隔离入口，验证HUD裂星潮5/6下一岛龙眠、航图普通/裂星潮分开、层4剩余龙眠、手动追踪/取消不报完成；选择已完成的前五岛首领重战，核对结算相位。GUI后退到about:blank，再串行F2完整回归（AW_LONG_TEST_TIMEOUT_MS=1800000，两自然策略都保留）。

## F2 GUI 与只读审计

- endfresh 自然50登录后 HUD 正确为“阶段 · 裂星潮5/6，下一岛：龙眠岛”；旧自动新手目标未显示。f2-endgame-heading.png/txt。
- 同图提示“E 回拾星港”时直接E已真实回港，补充F1门户执行证据 f2-portal-return.txt。
- 任务页搜索落点求生，仍进行中且可追踪；手动追踪后恢复旧目标，取消后恢复阶段5/6，无“岛屿故事已完成”。f2-onboarding-retained.txt、f2-onboarding-manual-track.txt、f2-untracked.png/txt。只读审计 f2-track-before/after.json：wallet/done/completion均未变，2条新账本delta均0。
- 港口世界层级4保持锁定且显示5/6剩余龙眠，当前层3未改。f2-world-tier-progress.png/txt。
- 航图龙眠：普通已平定、裂星潮待挑战；五岛裂星潮已完成，页脚明确剩余龙眠。f2-chart-phases.png/txt。
- 正常重战已完成的风栖卡珀，进入后的第一次GUI读取仍半自动、首领11124662/29836963，后续实际成功。结算标“本场进度·裂星潮5/6”，收益4108金币/15633经验/8强化石/1装备，正常返回拾星港保留38098金币、46/60装备；未新增裂星潮完成岛。f2-boss-phase-result.png/txt、f2-result-return.txt。这是自然重战收益，不是授予或受控发行。
- GUI已暂停到about:blank，启动F2完整回归前保持一个重任务；最后类型检查与24项定向通过，配置6本一致。完整回归使用扩展墙钟时限、保留两条自然策略和全部现行断言。

### 决策 005（留给F3的实际布局问题）

F2实机截图发现：较长的阶段目标使原有世界浮动方向标签在右边缘越界（f2-endgame-heading.png）；港口层级5按钮也出现原有窄列竖排（f2-world-tier-progress.png）。按§5与F3布局范围，后续按现有字体测量/钳制浮动标签、通用地图操作区换行并保留完整名称，不删提示、不缩小字体、不改头像/系统菜单。该布局待验项不计入F2进度真实性已通过的结论。

## 中断恢复（23:56）

F2完整回归exec19004仍在运行，重任务锁owner17660、vitest40592；不并开测试或GUI驾驶。自然成长两策略、earned-all-quests、岛屿流程、story、地城服务已通过；后半段database.test.ts的3项迁移失败，并有若干文件beforeAll失败，用例未执行。必须等待完整诊断，保留本轮日志并修复原因、串行复跑，不将初始化失败当作跳过通过。产品代码当前冻结等待该轮退出，real index为空。F3/F4仍仅.qa草稿，未落入产品；F3脚本已缓存标签word-wrap宽度避免每帧重排，地图样本草稿使用正式按钮/CSS与已登记龙眠航标，明确布局样本不写存档。F4草稿改为仅solo独立首领主动接近，半自动仅追近不额外自动躲预警，世界层风险复用既有hint保持旧严格契约。

### 决策 006（完整回归的真实PG文件隔离，10月9日00:02）

首轮F2完整回归200文件188通过/12失败，3条迁移断言失败、31条初始化未执行，加2条原有skip；f2-regression.log完整保留。只读核实postgres测试库5个camp_*角色state={}来自world-camps.test.ts最小持久化夹具，缺build/revision；复用上一轮库触发migration4时NaN。空库定向12文件发现文件排序仍能让world-camps早于migration10，产生tasks undefined，失败现场f2-migration-clean-retry.log。临时将该文件最小夹具隔离，12文件70项全部通过f2-migration-isolated-retry.log，证明原因。

由于world-camps.test.ts是其他会话未提交的新文件，已精确撤销本轮临时隔离改动（相对基线diff为空），未提交其内容。新增本轮独立tools/playability-vitest.config.ts、playability-pg-scope.ts：不更改现行测试，setup在每文件import前用真实PG创建独立schema并传AW_DATABASE_URL，afterAll关闭后删除本文件schema。所有200文件原样运行，默认时限/所有断言/防重规则未改。4文件52项验证（含迁移、最小夹具与嵌套隔离相位测试）通过f2-scope-directed.log。回退：移除本轮两个回归入口工具即可，不影响产品/存档。

完整隔离复跑已启动exec82433，job F2-full-regression-isolated；f2-regression-isolated.log。AW_DATABASE_URL指本轮专用fix_f2_regression_clean，AW_LONG_TEST_TIMEOUT_MS=1800000；每文件独立schema、maxWorkers1。不得同时运行GUI/构建/其它测试；产品源码等待退出冻结。旧postgres测试现场、fresh/new/late/endfresh/middle自然存档均保留未清档。完成后先提交F2，再正式应用F3脚本与布局样本。

## 等待完整隔离回归期间的草稿（10月9日00:49，尚未实施/验收）

- F2完整隔离复跑exec82433，重任务owner78884，f2-regression-isolated.log；两自然策略到50且failures=[]、全任务175完成、岛屿流程/剧情/地城服务均通过，正在末批短测试；产品仍F2未变，real index仍空。
- F3 `.qa/implement-f3.py`：地图入口换行+按44px触达Token限定3行滚动；首领阶段目标卡left20/top212；方向标签按真实尺寸和文字内边距限制位置，缓存wrap宽度。会同时复制 `.qa/drafts/playability-map-layout-qa.html/ts` 到apps/web/QA页与src；使用正式modal、CSS、按钮，明确“布局样本，不写存档”。龙眠配置实际只有8航标，9样本使用8个龙眠+1个已登记沉星航标，不授予角色。实际8地图仍须GUI。guide-label-layout.test12例已草拟。
- F4 `.qa/implement-f4.py` 已重写为仅players.size=0独立首领，semi只接近不额外躲预警，野外radius/avoidElite保持；HUD boss > dungeon scene > active wave > tracked > stage，导航经Main.go到权威执行器，检查点箭头打开副本面板；世界层风险/回报复用hint，明确强化石/传说权重不混为总掉率。`.qa/drafts/playability-boss-approach.test.ts`为6岛两模式+手动/野外半径控制样本，未执行。
- F5 `.qa/implement-f5.py` + `.qa/implement-f5-review.py`：API只读同强化预览、已选公开配方固定候选流/ID与主手法杖倾向，随机掉落原随机流不改；实际制作仍0强化，旧高强化对齐到双方合法上限并显示说明。共享stat-comparison替换原gear-tip同一比较实现；普通随机来源仅在确知掉落的API/地城/宝箱发行处标记，不把所有制造装备冒充随机掉落；钥匙实例独立origin标记，历史无标记不补造。模板数值/概率/费用不变；序数配方名改描述名、所有配方说明由authoring-only tools/stage-key-copy.ts生成，脚本后须tsx执行 `.qa/drafts/f5-author-copy.mjs`（只改说明并比较非文案投影）。combat-review.ts副侧记录消费真实World事件；地城measurement保留并冻结于SavedRun，不新增World checkpoint字段，避免旧严格解码器拒绝；岛首领仅记当前载入后执行器事件并随结果本机展示上下文保存，不参与奖励。结算装备走正式equipmentTip+当前revision。F5测试草稿：playability-reward-preview.test.ts、playability-failure-review.test.ts、playability-preview.database.test.ts，均未执行。
- F6 `.qa/implement-f6-talents.py`、`implement-f6-dialogue.py`、`implement-f6-pilot.py`；先Artifact Tool修改/导出任务.xlsx、对白.xlsx，再引入pilot模块（必需参数replay_optional_routes，草稿JSON `.qa/drafts/replay-optional-routes.json`）。D4正确对象是 `field-rift-1` 沉星密仓/numericStage13；field-rift-3实际是界桥地窖，已纠正草稿。2阵型只置换既有合法点，按冻结body半径验证；stage顺序、actor IDs/属性/奖励源不变，选择冻结在SavedRun，按真实创建记录轮换，重试先返回旧命令结果。野外2可选走访路线来自任务.xlsx说明参数+世界.xlsx航标坐标，当前permit私有状态保存；显式entry换目标，续期/规则续接保留，现有trusted observer确认到达，只写走访bool无奖励。目标在区域地图显示，不加HUD第二行。天赋复用逐点规则/费用，服务端报价最大可负担前缀、总费用，原子写入，旧单点契约保留。F6测试草稿 playability-polish.test.ts/database.test.ts 均未执行。
- `.qa/validate-playability-drafts.py`在内存副本顺序试应用上述全部脚本，所有锚点匹配；`.qa/draft-validation`里的未来TS语法解析无错误。此检查不是定向测试或GUI验收，不计入完成项。
- 下一具体动作：完整回归退出且全绿后，最新tsc/config:check；从baseline index提取F2 14个共享文件的own binary patch，仅stage本轮patch/新模块/2测试入口工具/证据与日志，提交F2并推进baseline。然后立即F3：捕获minimap.css/hud-layout.css/quest-guide.ts当前前像到baseline，应用F3脚本、12例+类型检查；取得GUI重任务锁后可见1280×720样本0/1/2/8/9、实际龙眠8、三段风车/沉星及独立首领布局，保存AX/截图，about:blank后释放GUI锁再跑F3完整回归。

## F2 完成（10月9日00:52）

| 问题 | 根因 | 修改 | 定向与真实路径证据 |
|---|---|---|---|
| P-09 | 追踪目标变空被当作完成 | 完成演出只绑定completion.id，取消追踪只更新追踪 | 24项定向；f2-onboarding-retained/manual-track.txt、f2-untracked.png/txt，前后审计wallet/done/completion不变，两条delta0 |
| P-05 | 航图只读普通bosses，结算与层4没有裂星潮上下文 | 服务端解析hardmodeBosses，航图普通/裂星潮分列、层4x/6剩余；冻结许可相位走追加只读接口，旧结果结构保留 | f2-chart-phases.png/txt、f2-world-tier-progress.png/txt、f2-boss-phase-result.png/txt，普通风栖重战后仍5/6且收益真实保留；真实PG零写入与跨角色404 |
| D1 | 自动旧新手目标持续占据HUD | 按首岛等级/后岛开放降级旧自动目标，保留任务并支持明确手动追踪；阶段推荐下一首领/裂星潮剩余；任务工作簿模板与quest-system §5.4同步 | f2-endgame-heading.png/txt、f2-untracked.png/txt、f2-workbook-preservation.json |

最终完整回归：f2-regression-isolated.log，200文件全部通过，1525项通过、2项原有campaign-balance历史跳过，2976.20秒；两自然策略完整到50且failures=[]。最初失败与两次诊断保留，按决策006修复测试命名空间串扰，未改断言或业务规则。最新tsc通过f2-types-final.log，config:check 6本一致f2-config-check-final.log。版本声明保持当前兼容版，隔离API真实GUI登录/结果返回已通过health-f2.json及上述证据；正式入口未打开。所有怪物属性、经验、掉率、费用未改。

下一步：提交本批自有差异后立即应用F3，先定向12例和类型检查，再在可见1280×720 GUI验布局样本与自然存档真实流程；不询问是否继续。

提交隔离说明：battle-result-controller.ts 的其他会话未提交文案与F2新增读取相邻，3-way仅index冲突；已用HEAD原内容加本轮3行解析构造index blob，工作区文件未覆盖，其他文案仍未提交。任务.xlsx基线blob与HEAD一致，二进制补丁只含本轮4参数行。全部暂存路径已核对为本轮自有源改动/证据/日志。

F2提交：7c4d14f。已推进baseline index，仅将本轮track delta应用到基线并保留其他前像；F3前像minimap.css/hud-layout.css/quest-guide.ts已捕获。F3现在开始：应用脚本，跑guide-label-layout 12例和tsc，再取得可见GUI独占锁。

决策007（F3 GUI实测）：2航标原本仍单列。DOM实测面板384/内区342/内padding8，完整按钮166.328+160+gap8比可用334多0.328px。沿Token把地图宽度加Space.8至416，并允许按钮等宽两列、长名正常换行；14px字号/44px触达保留，所有入口保留。仅本区域地图作用域；回退移除本轮宽度与flex两条即可。重新验0/1/2/8/9及实际地图。

## F3 GUI 中途记录（继续进行，非结束）

- 当前GUI独占锁exec58021（TTY holder `.qa/hold-gui-lock.mjs`，newline释放），隔离host50742仍活跃。
- browser2/tab1，可见1280×720。采集动作后截图+DOM可用Promise.all两项只读观察，同一波约21秒；单动作21秒+并行只读21秒≈42秒。禁止3个顺序浏览器API（≥63秒会kernel reset）。上次reset已恢复同browser2。可见窗口 `tab.pressKey(null,'e')` 正常；locator('body').press('e')曾deadline失败，无动作，已读状态后换原生键通道成功。
- 0/1/2/8/9样本均观察；最终宽416，两列、长名正常换行、列表max156。9项末项真实点击通过，f3-layout-9-last.png/txt；measure-final.json：viewport1280×720，buttons171.5px宽、44/53px高，font14px；list clientWidth=scrollWidth359无横溢，scrollHeight269可滚到113。0-final/2-after/8/9图片保存。样本按钮反馈改aria-label避免把隐藏busy文字拼入说明（QA页独有修正）。
- endfresh 50正常恢复，38098金币/46装备/2待领保留；龙眠地图8航标真实显示并点击最后中央2成功，状态中枢入口、health4039/4039未变；f3-dragon-8-after.png/txt、f3-dragon-last-travel.png/txt；长标签right<=1264完整在屏内 f3-dragon-label-after.png。随后正常退出。
- host切new/reload4；playability_20261008_new真实Lv5/626金/22装备/1待领。首次本源载入显示港口登记与抢救船台开场，各正常跳过；未改任务进度。正常地图→副本目录→风车地窖（Lv4准入，钥匙4/10）创建。
- 风车3段真实流程：半自动阶段1击杀3普通后全自动清前段；阶段1生命232/270、材料5/10；阶段2生命201/270、材料8/10；在第二检查点通过正式模式输入手动+准备后进入boss，生命201保持，无复活/暂停执行器。f3-wind-stage1/2.png/txt、f3-wind-boss.png/txt/bounds.json：boss(450,12,380,51)，目标卡(20,212,280,122.5)，任务条(20,132,280,44)，互不重叠。恢复全自动，首领6413→2750真实攻击；后实际通关：368金/496XP/42石/7装备，f3-wind-outcome.png/txt。正常返回拾星港994金/29装备/1待领，f3-wind-return.png/txt，收益全保留。
- 新发现留F4：新角色副本返回港口设置页“活动半径”显示48（副本stageWorld设置max地图宽高），进入本次副本前原野外值12；Main.travel复制world偏好可能把权威副本半径串到野外。D2要求野外半径保持，应在F4隔离玩家字段偏好与权威副本临时参数，并补UI返回/切号回归；只修参数所有者，不改12默认/3–20范围/战斗数值。勿在F3混改。
- 当前屏幕：new角色在拾星港设置页（返回已完成实例），退出账号按钮可用，尚未退出。下一步正常退出→host-control切late/reload5并等API_READY→reload页面后登录calendar_9637b11f7557437b→沉星密仓3段真实流程（用late45已成长存档，勿用middle30提前重配）；其次独立岛首领布局/施法提示。GUI完成about:blank，write_stdin58021 newline释放锁，再F3完整回归。F3定向12与tsc已通过，尚未完整回归/提交。

决策008（F3普通阶段一行引导）：late实际为30级/943HP/4219金币/48装备，先前45级假设撤回，采用实际读到状态。沉星第一段截图中完整“前往龙眠岛，挑战暮界提督·维洛”在280宽任务条换两行；按D1和§5，单独将starsea-hud扩为Token416，不删名称或缩字号，right436仍在首领条left450之外，目标卡仍left20/top212/width280。GUI将重验该条与首领卡边界，回退仅移除新增宽度条款。当前沉星stage1半自动，普通目标1/1、精英0/1、HP943、材料17/64，未改构筑。

## F3 GUI 齐全，等待完整回归（02:26）

- late实测30级（已纠正45推断），沉星密仓正常三段：HP943/943保留；stage1材料19/64/装备53，stage2材料21/64/装备58；检查点正式手动+准备进入boss，炮台裂晶卫504569HP，未复活/暂停服务端。截图与AX f3-rift-stage1-after、stage2、boss及bounds。boss条450/12/380/51，目标卡20/212/280/122.5，完整一行任务条20/132/416/44(right436)。
- 恢复全自动后同帧捕获真实“敌方施法 ·1 /注意脚下范围”，boss280923/504569、角色943/943；f3-rift-boss-fight.png/txt清楚证明血条/施法提示/目标卡/任务条互不遮挡。
- 沉星实际通关1412金/3688XP/168石/12装备，正常回港5631金/60装备，满包提示真实可见。f3-rift-outcome/return。自然新掉落月铃法袍的旧结算Tooltip法术伤害0.09已另存f5-tooltip-before.png/txt（F5前像，未提前实施F5）。该装备留存，不补造来源。
- 独立沉星普通首领正常航图重战裂隙督军·乌洛，保持半自动/自动技能，未开启满包全自动；入口真实boss364983/439149、HP943；f3-island-boss.png/txt。后实际胜利1735金/83751XP/8石/1装备，普通进度仍5/6，角色自然30→31/HP963；f3-island-outcome。正常回港7366金、61/60装备、0待领，f3-island-return；超容量为既有首领/副本直送保护，满包全自动规则仍保留，没有自动分解或回城。
- GUI已about:blank，锁exec58021已newline正常释放（GUI_LOCK_RELEASED）。host50742保持late/reload5，所有本轮合法收益保留，middle30未操作。F3 12项定向、最新tsc通过；health-f3.json证明API/content版本一致0.11.21/protocol32/rulesow-62/db16/assetsv24，并有三分支真实登录/恢复/回港证据。
- f3-source-before.json已记录1162源码文件及12配置文件指纹；完整回归使用真实PG每文件schema隔离、两自然策略、1800000ms时限，maxWorkers1；期间仅准备.qa草稿，正式产品代码冻结。回归后运行 `.qa/playability-source.mjs f3 after` 确认源码/内容未漂移，才提交本轮自有delta并立即F4。
- F4新增必要工作：修复副本权威radius48串入玩家野外偏好（原值12，GUI已复现），不能把默认/允许范围改掉。先查Main.loadSettings/saveSettings、worldChanged、travel偏好复制所有者，保存玩家野外设置并在退出权威场景恢复；补正常副本前后设置GUI与定向测试，再合并F4既有soloBossTarget/场景引导/清场/层级说明草稿。

## F3 完成（03:05）

| 问题 | 根因 | 修改 | 定向与真实证据 |
|---|---|---|---|
| P-03 航标溢出 | 地图入口flex不换行，无可滚动高度；完整文字的分数宽度也令两项单列 | Token416宽地图、等宽两列、最小160/触达44、完整名称自然换行、156高可滚动；全部入口保留 | 0/1/2/8/9样本与末项点击；f3-layout-9-last.png/txt、measure-final.json；实际龙眠8：f3-dragon-8-after.png/txt、最后中央2真实传送成功 f3-dragon-last-travel.png/txt；前像f3-dragon-8-before.png |
| P-04 战斗信息相盖 | 目标卡与首领条均占顶部中央 | 首领段目标卡移左侧top212，血条top12中央，施法提示中央下方；任务条按Token416保留完整一行；不改头像/A1/字体 | 风车与沉星真实3段通关、独立沉星真实重战成功；f3-wind-boss.png/bounds.json、f3-rift-boss-fight.png/txt（同帧敌方施法）、f3-rift-boss-bounds.json；风车368金/496XP/42石/7装，沉星1412金/3688XP/168石/12装，均正常回港保留 |
| D1布局补齐 | 普通阶段长首领名使一行条换两行，世界方向标签越右界 | 单独扩starsea-hud至416，浮动文字按真实宽高/内边距钳制，缓存wrap宽度 | guide-label-layout12例通过；f3-rift-stage1-after.png、f3-dragon-label-after.png（完整文字与原字号） |

完整回归f3-regression.log：201文件全部通过，1537项通过、2原有历史跳过，2138.51秒；两策略到50均failures=[]，全任务、剧情、多人/保留/奖励防重等均未跳过。最新tsc通过f3-types-final.log。f3-source-before/after.json：1162源码与12配置指纹完全一致，确认本轮测试期间源码/内容无漂移。health-f3.json API/content版本一致且真实登录恢复/返回已验证。F3没有数值源修改。

下一步：提交F3并推进baseline，立即应用F4 `.qa/implement-f4.py`+`implement-f4-preferences.py`；promote三个定向测试草稿（boss-approach、automation-preferences、zone-context）后串行定向与类型；API显式重载，GUI真实登录/半径副本往返/龙眠和至少两前岛接敌/清场说明/层级风险。仅§6硬阻塞可停。

### 决策009（F4单人范围与偏好所有者，尚未实施）

D2单目标场景应覆盖独立岛首领与权威单人副本，因此soloBossTarget采用players.size<=1；多人角色职责/治疗控制保持原策略。手动、明确移动/施法目标优先于默认接近。野外设置由FieldAutomationPreferences四字段单独保存，显示/回城/设备持久化均读该对象，不借副本radius48；默认12、输入3–20、所有数值规则保留。草稿15接近/输入案例+3偏好案例待执行。回退移除本轮helper接线/保存点，数据结构与游戏配置无迁移。

### 决策010（F4真实清场与相位等级，尚未实施）

既有后端营地90秒+距离条件须保留，不能承诺回港重进马上刷新；说明改“本分区已清空，前往其他分区，或回港选择新的远行／副本”。自动导航不按本地TTL重选已清营地，服务端返回活营地才取消清场标记，不强制攻击玩家避开的精英。F3龙眠裂星潮曾显示普通36–37，源码证实FieldController.announce绕过已解析worldView.zones；F4只改为读服务端实际相位等级带，并清理换角色/World时旧镜像，怪物等级公式不改。回退仅显示/导航缓存接线，不触动刷新/奖励数据。

### F5/F6草稿补充（尚未实施）

F5新增stage-key-growth.ts，在同强化试戴前记录真实技能等级、原装备强化/突破、法典/召唤/雕文/星核/巅峰成长，避免非装备配方在基础属性不变时误显为无收益；新预览contract含growth，按钮“对比预览”，装备/成长标题分别显示，制作不自动装备且随机掉落以实际详情为准。新增三项成长预览测试草稿。F6批量按钮文案改为服务端本次实际点数“批量投入N点”，避免资金/点数不足时宣称节点已满；费用/规则不变。F6 pilot world-change锚点已适配F4相位镜像重置，须再次内存试应用。

F3提交隔离：minimap.css末尾与其他会话已改的悬赏样式相邻，3-way仅index冲突；用HEAD加本轮9行布局追加构建stage0，工作区及其他样式保持原样，未把其未提交内容带入。

F3提交22694e1；baseline已推进F3自有delta，F4九个共享源前像已捕获。F4脚本与偏好所有者现已正式应用，新3个定向测试已promote；先串行类型与相关单元/真实PG回归，再API reload与可见GUI验收，最后F4完整回归。当前无重任务在运行，browser2/tab1 about:blank，host50742 late/reload5。

F4首轮定向9文件63项：8文件/57项通过，6项新接近测试失败；全部现行PG副本20/营地10/相位等通过。失败根因是本轮测试误用2.1格阈值，而原meleeStopRange保留min(skill.range-.4,2.6)，半自动在合法2.38–2.58范围停步。没有改生产停步/射程/数值，改测试为全6岛两模式实际造成正伤害、初始超射程时角色真实移动、默认/明确目标与野外radius保持；原失败f4-directed.log保留。

## F4 GUI 齐全，等待完整回归（10月9日）

- 首轮新接近测试阈值纠正后，f4-boss-retry.log 16项全部通过：6岛两模式实际正伤害、初始超射程真实移动、手动/明确输入与野外半径保持；3偏好+1相位单元和既有PG副本/营地/相位测试首轮均通过。f4-types-final.log通过。
- 正常登录/恢复 late31（7366金/61装备）再正常退出；endfresh50正常恢复。当前五岛裂星潮完成、龙眠未完成，所有自然收益保留，middle30仍未操作。
- 玩家活动半径12：副本前f4-preferences-before；Wind1实例运行时f4-preferences-in-dungeon仍12，实际副本执行器临时范围不变；正常退出实例回港后f4-preferences-after仍12/范围3–20。实例已击杀所得18金正常保留，未重置角色。
- 层级风险全部公开，f4-world-tier-risk与f4-world-tier-4-risk.png/txt；服务端现有倍率直接解析，普通随机传说权重与精英/稀有保底区分。字体/滚动可读，层4仍5/6锁定。
- 龙眠裂星潮：默认半自动不额外移动即接近并造成伤害，boss49943384/70367833，f4-dragon-semi-contact；正常本地暂停用于同帧观察后选择全自动、继续约21秒再正常暂停，boss39757447/70367833、角色4018/4039，f4-dragon-auto-contact。只使用独立首领现有暂停，不暂停权威地城；这些受控接敌片段不作为自然TTK。正常行囊回城整理退出，进度仍5/6，f4-dragon-retreat；最终复测再自然打完龙眠。
- 前岛回归：风栖默认半自动正常接敌胜利4108金/15633XP/8石/1装，f4-wind-contact/result；雾铃同路径默认半自动胜利4881金/31375XP/8石/1装，f4-mist-contact/progress。两岛GUI为半自动，不冒充全自动实测；全自动六岛见真实World定向测试。
- 雾铃野外正常全自动清空，自动停到半自动，提示“本分区已清空，前往其他分区，或回港选择新的远行／副本。” f4-field-cleared.png/txt。正常获得904金/2443XP、装备保留，48009金/50装备/2待领；没有改90秒/36格刷新条件或满包规则。
- 正常航标传送三邮站谷后显示“Lv.40–41”（裂星潮服务端相位），f4-phase-zone.png/txt；普通基础分区等级不再覆盖相位。GUI about:blank，exec23749正常释放 GUI_LOCK_RELEASED，host50742 endfresh/reload7继续。
- 下一步：f4源码/12配置before指纹；maxWorkers1真实PG每文件schema完整回归；退出后after指纹与最新类型，确认无漂移，再仅提交F4自有delta。立即实施F5，再F6，不询问继续。

### 后续草稿决策（F4回归期间，产品源码未变）

F6许可新版本创建时保留上一行的replayPilot，再由明确attempt_id决定是否轮换；不把正常续租当新轮。真实PG草稿检查相同attempt/无attempt续租不变、明确新attempt visit+1且目标不同。可选短目标改用已登记且始终存在的难民营地/炮台通道航标（ow-rift-wp2/wp3），不选出生的沉星滩头，避免进场即完成而没有短路线行动。内容仍只来自任务.xlsx参数，坐标从世界.xlsx导出表解析，无额外奖励/激活/任务完成。依据D4+§5；回退删除本轮参数/展示与permit私有展示记录，不影响奖励或营地轮次。

F6实际内容源文件名为config/excel/对话.xlsx（非此前草稿说明写的“对白.xlsx”）。已准备Artifact Tool builder edit-polish.mjs与只读preservation脚本，但尚未运行导出或改产品；仅两处任务dialog_progress单元格、一个新参数、两条新进行中对白，全部旧数值/表头批注/冻结窗格需验证保留。F4完整回归exec56443，两自然策略到50且failures=[]；其余测试继续，不能并跑重任务。

### 决策011（F4完整回归暴露的策略范围，05:34）

首轮完整回归 f4-regression.log 保留：204文件201通过/3失败，1554项通过/3失败/2原有历史skip，2148.06秒。源码与12配置 before/after指纹完全一致，证明期间未漂移。失败：阶段钥匙材料期望7实际5；旧六区starter seed11在tundra未通；另一个实际终局测试在ready/next链得到CONTROL409（此项需重跑确认，不能先归为数值/优先策略）。

源码与真实测试确认，把D2扩到所有region.boss/players<=1超出报告的独立岛首领路径：权威副本近处精英被绕过，旧六区原策略也被改变。依据§5“保留既有规则”，撤回决策009中扩到权威副本的部分；default接近限定现有starseaBossMaps登记的六个独立岛首领且players.size===0。权威副本继续已有场景范围/阵型/目标策略；旧主线也保留原策略。手动/明确目标/野外半径保持。GUI六独立岛输入条件一直players=0，已保存接敌截图与前岛胜利仍是相同路径行为，未冒充权威副本新策略。

本轮自有测试原“权威单人也应强制首领”假设改为保护权威近处精英与范围，并新增旧区近处敌人案例；现行失败测试/断言均不改、不跳过。串行重跑：六岛接敌17例、campaign-balance、stage-keys真实PG、authored-dungeon-entry真实PG、dungeon-instance真实PG。全部通过后GUI恢复/营地核对，再f4-fixed指纹+完整回归，不以定向通过替代完整回归。F5仍仅.qa草稿，real index空。

决策012（F4旧区剩余失败，05:39）：定向重跑 stage-keys/authored-dungeon-entry/dungeon-instance/17接近案例均通过，CONTROL409未重复；campaign starter仍失败。继续逐行核对确认 tools/campaign-model.ts 把内部autoState“等待敌群刷新”当作重新定位信号，而F4曾顺手改成通用行动文案，使旧区gate路径不再移动。整个apps/web没有消费该内部autoState；真正玩家清场提示来自stopReason，已按F4改为行动说明。恢复内部稳定信号原字串，保留玩家实际可见的新清场文案；不改工具/现行测试断言，不改任何数值。该失败与默认首领范围是两处独立原因，均保留失败记录。

## F4 修正后验证与精确续接（05:41）

f4-policy-retry.log：5文件4通过/旧区1失败；阶段钥匙5项、实际生产地城2项、权威副本20项、接近17项均通过，材料7/精英收益保护恢复，CONTROL409未重复。随后恢复内部等待信号，f4-legacy-retry.log旧区starter全5种子+六岛两模式/保护共23项通过、2原有历史skip。f4-types-narrowed.log最新tsc通过。现行失败测试一字未改。

host50742已endfresh/reload8 API_READY，GUI独占exec38291最新真实恢复到拾星港，4039/4039HP、48009金、50装备/2待领、5/6剩龙眠均保留；设置仍radius12，f4-narrowed-session.png/txt。没有调音量/偏好。GUI已about:blank，锁正常释放。

现在执行 `.qa/playability-source.mjs f4-fixed before` 后完整复跑 f4-regression-fixed.log（maxWorkers1、真实PG独立schema、两自然策略，源码冻结）；第一次完整失败f4-regression.log及两个定向失败/恢复日志全保留。退出后f4-fixed after指纹、仅F4自有差异提交，再立即F5。

续接工具（均.qa草稿，不是产品完成项）：
- `.qa/stage-f4.py`默认只生成own patch/清单；完整回归通过后`python .qa/stage-f4.py --apply`才对real index应用自有3way并add四个自有新文件、f4证据/日志/进度。若冲突仅解决index，不覆盖工作区。提交后将f4-own.patch apply到baseline index并add本轮新文件/记录，保留其他会话改动。
- `.qa/f5-manifest.json`记录17个F5共享文件精确前像与8个不存在的新文件；`.qa/apply-f5-guarded.py`会先校验前像/新目的地/real index空，再捕获baseline、执行F5两脚本、promote三测试并运行author-copy（仅文案，非文案投影相同）。F4当前后续修正只动simulation和本轮新测试，不改变这17前像。
- F5草稿已补Gear手写type.origin声明；随机取得阶段钥匙也用默认stageKeyRandomIds保留当前法杖武技/法术倾向，制作使用固定公开已选配方流保证预览一致。普通随机装备与原词缀/概率/费用流不变。新增16件随机钥匙覆盖两倾向的定向样本（受控发行，不是自然GUI）。F5需要真实GUI只读预览、失败页和正式百分比，然后完整回归。
- F6工作簿builder `.qa/playability-config/edit-polish.mjs`（实际对话.xlsx）与只读verify-polish.py已准备未运行。marker在F2已成功运行一次，不重跑。另已准备playability-dialogue.test.ts（真实规则推进到登记，检查已播开场后仍有正常完成动作），与polish两测试一起promote。可选目标参数现为wp2难民营地/wp3炮台通道，不用出生点wp1。
- `.qa/recheck-draft.md`仅证据索引/空评分草稿，不能把待填当完成。最终至少20–40分钟真实层4，正确高层为各岛第三条地城numericStage19–24；Wind1仍普通stage1。层5由真实层4worldTierScaling地城首领胜利解锁，不能靠低阶段本/授予。

## F4 完成（06:19）

| 问题 | 根因 | 修改 | 定向与真实路径证据 |
|---|---|---|---|
| P-06 / D2 | 独立龙眠首领距出生点超出原活动半径，默认目标/接近仍按周边敌人；不是地图不可达 | 登记六岛独立首领为默认目标，全自动/半自动主动接近；明确目标/输入优先；权威副本与旧区保持既有策略 | 六岛两模式实际正伤害、17接近/保护案例；f4-dragon-semi-contact/auto-contact.png/txt，前五岛中风栖/雾铃默认半自动真实胜利；受控本地暂停片段不冒充自然TTK |
| 清场说明 | 文案暗示等待；本地TTL会重选已清营地 | 玩家显示已清/换区/回港新远行或副本；服务端给活营地才取消本地清空标记 | 雾铃自然清空停到半自动，f4-field-cleared.png/txt；后端90秒/距离条件、清场不原地复刷、满包保护不变 |
| 层级理由 | 选项只显示锁定条件 | 服务端解析所有层的生命/攻击/经验/金币/石与普通随机传说权重简述，保留各来源保底含义 | f4-world-tier-risk、world-tier-4-risk.png/txt；5/6剩龙眠时层4仍锁定，倍率值未改 |
| 偏好与场景目标 | 设置/返回借用权威副本radius48；旧任务抢占当前战斗，分区等级绕过相位解析 | 独立四字段偏好所有者，UI/保存/回城读该对象；当前首领/地城/波次优先，一行箭头经正式导航；分区等级读服务端相位 | f4-preferences-before/in-dungeon/after.png/txt，12前后保持；f4-phase-zone.png/txt（三邮站谷40–41）；f4-narrowed-session.png/txt 最新GUI恢复拾星港、48009金/50装/2待领/5/6完整保留 |

完整回归修正轮 f4-regression-fixed.log：204文件全部通过、1558项通过/2原有历史skip，2169.18秒；两自然策略到50且failures=[]，所有现行任务/副本/收益/防重断言原样运行。首轮3失败与两次定向诊断均保留，见决策011/012；最终实际地城CONTROL409未重复，未削弱控制规则。最新类型检查f4-types-narrowed.log通过。f4-fixed-source-before/after.json：1166源码与12配置指纹完全相同，测试期间无漂移；数值内容源未改。

提交隔离：预演发现main.ts/presentation.ts/settings-panel.ts与其他会话未提交内容相邻，3-way仅index冲突。已验证以HEAD加F4精确替换构造3个index blob；工作区不覆盖，不带入其他会话的技能标签/页面字段/拾取过滤等未提交差异。其余6个共享文件补丁干净应用。提交后推进baseline再立即F5。


F4提交c0fba54；baseline已仅推进F4自有delta，其他会话前像保留，real index空。立即F5：guarded脚本校验17共享前像/8新目的地，promote四个定向文件（奖励预览、失败回顾、真实PG、结算Tooltip），只改配方名称/说明并验证其它字段完全不变；随后串行类型与定向测试。当前无重任务，browser2/tab1 about:blank，host50742 endfresh/reload8。

## F5 实施中（06:23）

- P-07根因：dungeon-diagnostics.ts在前段没有boss时提前return，承伤/治疗/时间均未记录；独立岛首领失败结果没有本次事件回顾。新增共享simulation/combat-review.ts侧记录，消费执行器实际hit_resolved、最近5承伤来源/技能、每秒真实伤害命中占比；不加World checkpoint字段，权威SavedRun measurement持久化，重复tick去重。旧实例/本次载入前无事件不补造；首领DPS单独bossTicks，避免前段时间改变原分母。
- D3：原stage-key-rewards.ts已按主手谱系选模板，复用原规则并补法杖武技/法术倾向保证（制作/随机阶段钥匙），普通随机掉落不改。新的服务端revision守卫只读预览在克隆状态上执行同一发行、同强化试戴和共享比较；非装备成长照实列技能/强化/突破/法典/召唤/雕文/星核/巅峰；已达目标时明确无新增成长且仍耗材料。制作不自动装备，未加净提升保证。
- 来源与单位：Gear.origin手写type/Zod可选类型，确知阶段钥匙/普通随机发行才标记，历史未知不补造。地城/岛首领已入包结算装备改用正式equipmentTip+revision/API/renderer；未领取野外结果的fallback也复用affixDisplayValue。GearTip原统计比较抽为同一个server共享实现，UI不复制公式。
- 配方内容：6个序数名改部位/机制描述，51条说明统一写部位/机制方向/阶段用途；tools生成器也覆盖普通与终局说明。evidence/f5-content-preservation.json：24阶段51配方，其它全部字段（包括全部数值/权重/材料/等级/输出）不变。未运行数值推导生成器，只运行author-copy。
- 首轮types仅本轮Tooltip夹具漏了GearTip comparison.attack必需字段；补完整合法夹具，生产逻辑无修改。f5-types.log保留，f5-types-retry.log通过。四个新定向文件已promote，连同现行stage-keys、权威副本、结果/装备测试串行跑真实PG，日志f5-directed.log；exec83934。GUI仍about:blank，未并开其它重任务。
- 后续F6草稿：野外可选目标私有seenEntries记录可防延迟旧nonce把新目标再次轮换；对外仅返回goal，不泄露入口历史、无额外奖励。pure/realPG均新增延迟重试案例。设置底部“后台全暂停”与实际副本/事件规则不符，F6只改说明不改运行规则。工作簿尚未编辑；marker不重跑。
- 最终生产包GUI辅助已准备 `.qa/production-preview.config.ts` 与 `.qa/stop-owned-vite-for-preview.ps1`：仅验证并停止host46880的独立127.0.0.2 Vite子进程，最终构建后同隔离10840源启动Vite preview（AW_API_PORT10839）。正式Limited服务仍用仓库service stop→build→start，绝不打开正式8612的游戏会话去写玩家状态。该辅助尚未执行。

F5定向 f5-directed.log：8文件53项全通过，含真实PG只读预览无状态/回执/流水变化、实际制作重试一份产物、原阶段钥匙与权威副本收益保护。额外源码审查发现Main持有上一World回顾，普通野外后续失败可能误借；已用currentCombatReview按World身份归属返回当前记录，否则undefined，补真实World跨执行器案例。f5-types-owner.log通过；f5-owner-directed.log 2文件5项全通过。独立岛失败的材料标题改“已记录的地城阶段”，避免把上次所选来源冒充本次岛首领冻结阶段。所有原定向/类型日志保留。

接下来GUI：late分支正常登录→港口沉星密仓stage13两配方只读预览（前后审计零变）→实际地城结算正式Tooltip；然后middle分支先手动前段失败/返回、再独立沉星首领手动导航接敌失败，取真实承伤/输出回顾与材料信息，不为测试授予/改成长。Middle构筑保持弱态，为F6后初败→正常120+290重配→寒霜阵→通关→两次复刷保留路径；若手动失败有正常收益须如实保留，不能恢复覆盖。

### F5 GUI 接线修正（06:41）

第一次真实护甲预览被客户端PROTOCOL校验拒绝，f5-armor-preview.png/txt保留为失败证据，不记通过。根因不是服务器数据错误：contracts.validateResponse先匹配通用path.includes('/preview')，抢在stage-keys/preview专用schema之前。已将专用分支移前，保留全部严格校验和版本保护；真实PG测试改为对实际响应再调用validateResponse，七谱系单元也覆盖同一解码器，f5-dispatch-directed.log 2文件14项通过，types-dispatch通过。失败请求前后PG状态Hash/金币/材料/装备/回执/流水完全一致，f5-preview-protocol-before/after.json，unchanged=true。

同时实际截图/源码证实目录重绘只保留左列表滚动，右详情会回顶部，让预览/错误在折叠区下方不可见。补同选择详情scroll保留、新preview生成一次滚到结果并聚焦可读region、错误滚到status；不每次刷新强制滚动，不删内容/不缩字。新tabindex仅用于结果焦点，沿公共控件。正在类型检查后重新GUI；原失败记录全部保留。GUI已about:blank，exec9664正常释放，尚未F5完整回归/提交。

## F5 GUI 预览与单位已验证（继续，未完成F5）

- latest host late/reload10、可见1280×720；正常会话恢复31级/7366金/61装备，f5-late-login。阶段13沉星密仓21/64材料，两配方名称/部位/机制/用途完整，f5-rift-recipes。
- 固定后护甲预览正常定位/聚焦region，f5-armor-preview-fixed.png/txt：双方强化2，制作产物0，晨光胸甲冰甲机制；攻击176→123、护甲82→101、HP963→812，冷却/抗性等百分比真实。没有宣称净提升，未制作/穿戴。
- 苍风召唤石成长预览 f5-summon-preview：当前基础攻击/护甲/HP不变，直接成长苍风守灵0→50。GUI两次预览前后PG完整stateHash一致、7366金/1253石/61装、652回执/652流水/142奖励行完全不变，f5-gui-preview-before/after.json unchanged=true。
- 同角色正常沉星三段：HP963全程保留，默认半自动先击杀3普通，再正常全自动清场；第一段材料23/64，第二段实际随机取得苍风召唤石，界面已取得。f5-rift-entry/front/second/result（result文件为尚在首领战143743/504569的帧，不能冒充终局）；真正终局 f5-rift-outcome：1412金/3688XP/168石/12装备，正常回港 f5-rift-return：8778金/73装/0待领。所有收益/召唤成长保留，未整理/删除装备。
- 结算装备实际data-equipment-tip和revision686已读DOM确认，正式晨光胸甲Tooltip抗性+6%、近战+10%、投射物+29%、暴击比较5→13%，f5-result-tooltip.png/txt；魔杖第一次点击被正在阅读的竖版Tip覆盖，旧 f5-result-wand-tooltip 是未换物帧；正常Esc收起再点击后 f5-result-wand-tooltip-fixed 正确显示棱光魔杖、冷却11%、暴伤21%、奥术11%、远程17%。不是修改装备。
- 当前这12掉落全部稀有/魔法/普通，没有新随机传说，不将其当“随机传说徽记”GUI证据；该徽记/钥匙来源逻辑已有共享renderer单元/真实PG发行验证，最终自然高层/试点若掉传说再补实机。保留的历史月铃法袍无来源不补造，f5-preserved-robe-detail显示暴击7%、火抗20%、法术20%；这是行囊正式详情，不冒充本次结算月铃。
- Late已正常logout到登录页。接下来host-control middle/reload11→reload→calendar账号，真实弱构筑先前段失败回顾、正常返回，再独立沉星首领手动导航接敌失败回顾。构筑不重配、不授予、不恢复覆盖；F6后再做正式弱态撞墙→正常重配→通关→2复刷。GUI锁exec78615仍持有；不并开测试。

## F5 真实失败路径齐全（07:46，等待完整回归）

- 重要纠正：checkpoint-30实际初始GUI为Lv30、HP908/908、136金、16装备、715石，位置沉星岛；不是此前推测的341HP/480金。原值见f5-middle-login.png/txt。正常回城不改构筑，阶段13材料0/64。
- 原3技能/原天赋下默认半自动先3普通，再正常全自动：第一前段自然清空，HP191/908，568金，材料2/64，f5-middle-front-state。带原残血正常ready/next进入第二前段，实际倒下，f5-front-failure：648金/2064XP/100石/5装备保留，钱包136→784、装备16→21。未在F5重配、未改装备/激活寒霜阵；没有用死亡清收益。
- 冻结审计 f5-front-failure-frozen-run.json：field-rift-1普通numericStage13、worldTier1、怪物29、实际执行者入口HP908/攻击174/护甲72、skills cut/ward/whirl；第二前段stage1终局failed。definition.policy.entryLevel默认1与catalogue.definition.level29是不同字段，用户准入以实际目录29为准，后续审计须同时记定义level，不能混当怪物等级。
- 前段回顾：最近裂缝幼影近身47、裂界督猎者近身101/背刺128，控场/生存/分批/避危险区建议，材料2/64还差62。输出15/16秒93.8%、事件记录15.4秒是**最后失败阶段**采样，不是整个副本总耗时或全本输出占比。原note在ℹ说明里；已把服务端已解析首句直接放结果初始可见区（字符串呈现，不复制数值公式），保留完整说明和其它内容、正常滚动。f5-front-failure-visible.png/txt。新增18th共享文件dungeon-diagnostic-view.ts的前像已捕获到baseline/manifest，未覆盖他人改动。
- 前段自然掉落流星之戒为新普通随机传说，实际结算正式Tip显示明确徽记、冷却8.57%/其它比例，f5-random-legend-origin.png/txt；补齐此前Late那轮没有传说的来源实机证据。历史装备仍不补造来源。
- 失败正常返回camp后784金/21装保留，f5-middle-return。接着普通独立沉星首领默认半自动、无额外移动/施法/暂停/手动设置，真正自然倒下：boss226920/439149，角色0/908；f5-island-entry/state/failure。结果明确普通4/6未推进、0收益，输出28/30秒93.3%/本次载入记录29.1秒，乌洛虚空领域/近身来源，已记录的地城阶段13材料2/64和可刷建议，f5-island-failure.png/txt。
- 最后正常返回拾星港，Lv30、HP908、784金、21装、普通仍4/6，f5-final-camp。中期构筑继续弱态，所有F5自然收益保留，不能恢复覆盖。F6批量天赋GUI应使用Late（31级/8778金/73装/新苍风守灵50），不要提前重配Middle；F6正式提交后才用Middle做§4新一轮初败→正常重配/寒霜阵→通关→2复刷。
- GUI about:blank，exec78615已正常GUI_LOCK_RELEASED；host50742 middle/reload11。最新类型/相关diagnostic/tooltip测试后完整回归；本轮尚未提交F5。F6和最终复测仍未完成，无§6硬阻塞。

数值观察追加（不调）：同强化2的护甲预览实际攻击176→123、生命963→812、护甲82→101，并显示冰甲攻击×0.7等原机制，属于可解释取舍，不证明TTK升降。阶段13召唤配方0→50但当前基础三属性不变已明示；未来数值批次核对当前等级/装配条件下的即时用途。两次失败有效输出秒占比高仍倒下，说明不能只按DPS差距引导；不据这两次发布普遍墙或4×保证结论。

### 原报告中期生命值核对与等待记录（08:15）

已直接查看原报告evidence/s2-05-clear-front.jpg：HUD是Lv30、908/908，金币208（136+首3普通72），与本轮f5-middle-entry完全一致。原报告汇总表341/341不作为执行构筑依据，不能据该表宣称本轮生命变了或墙降低；不改原报告。旧AX s2-07-wall-failure记录月铃法袍暴击0.07/火抗0.2/法术0.2，本轮保留的同类旧法袍正式详情7%/20%/20%，当前结算新装备也走同一正式解析器，分别说明证据范围。

F5完整回归exec10417，f5-regression.log；两自然策略50级failures=[]、全任务链已通过。最新类型f5-types-final通过、3文件7项可见摘要/正式Tooltip/旧diagnostic检查通过。源码before32f0e8e...，1178文件/12配置，继续冻结。F5提交预演已完成：18共享文件补丁139+/106-，仅battle-result-controller与equipment-tip两处3-way index冲突。`.qa/resolve-f5-index.py --preview`已验证HEAD+本轮精确替换，保留HEAD原错误文案/原flags控件，不把其他会话改动带入，工作区未覆盖；`.qa/stage-f5.py --apply`会在正式暂存时自动调用该已验证索引整理。

F6辅助准备但未执行：`.qa/capture-f6-manifest.py`先F6内存试应用/捕获源前像、加两工作簿+两JSON并记录其余配置指纹；`.qa/apply-f6-guarded.py`要求真实preservation证明源/目标SHA，捕获baseline后复制两Artifact Tool导出的工作簿，pnpm config:export/check，确认其余配置未改，再应用4个F6脚本和promote3测试。任务/对话xlsx当前blob与HEAD完全一致（fe62c307/fbfd24f5），无其他工作簿未提交差异可被带入。Artifact builder edit-polish.mjs尚未运行，marker在F2已执行一次不要重跑。

F6新增只读报价草稿覆盖缺失optional progression/weaponLoadouts的合法旧角色，用克隆basis算before，避免预览对传入对象补默认字段；纯测试新增该字节不变案例。真实PG批量/field-replay案例现在也对真实响应调用validateResponse，覆盖实际客户端解码路径。四F6脚本（含quest-system文档）在内存试应用全部锚点匹配、语法26文件无错误；这不是类型/PG/GUI通过。source product仍F5，F6/最终复验均未完成，无硬阻塞。

## F5 完成（08:25）

| 问题 | 根因 | 修改 | 真实路径/定向证据 |
|---|---|---|---|
| P-07 前段与岛首领失败 | 没有boss就提前停止诊断采样；独立岛失败没有本次事件上下文 | 真实执行器侧记录最近承伤/技能与输出秒窗口，权威末阶段持久化、独立岛仅本次载入，重复tick去重且不同World不串用；行动建议+可刷来源+真实材料；关键摘要直接可见 | f5-front-failure-visible（末失败前段15/16秒93.8%、背刺等、2/64/差62）；f5-island-failure（本次载入28/30秒93.3%、虚空领域等、普通仍4/6/0收益）；冻结阶段13/怪物29审计；真实World/PG及旧diagnostic检查 |
| P-08 / D3 | 原谱系选择没有清楚展示，法杖倾向可随UUID改变；序数名误导；无同强化/直接成长预览 | 复用服务端主手谱系选择，补两种法杖倾向保证；克隆同一发行逻辑、同强化试戴与共享属性比较，非装备列真实成长，已达目标明确无新成长仍耗材；6名/51说明文案修正，其它字段不变 | f5-armor-preview-fixed双方+2与正负取舍、产物+0；f5-summon-preview 0→50但当前三属性不变；前后完整PG hash/回执/流水不变；实际自然随机取得苍风召唤石；13预览案例+实际PG制作幂等/只读/解码 |
| 来源区分/结算单位 | 结算使用通用raw affix.value；不同出处缺明确标识 | 已入包结算统一正式equipmentTip/API/renderer/当前revision，未领取fallback共用单位格式；确知阶段钥匙/普通随机来源才标记，历史未知不补造 | f5-result-tooltip抗性6%/伤害10%/29%、wand-tooltip-fixed暴伤21%/冷却11%等；f5-random-legend-origin自然流星之戒“普通随机传说”；旧法袍7%/20%/20%详情与原0.07/0.2/0.2 AX对照；2单位/来源案例 |
| 预览接线与可读性 | 新专用预览被旧通用/preview解码分支抢先；详情刷新回顶部 | 专用严格schema移到通用前，实际PG响应走validateResponse；同选择保留详情滚动，新结果一次定位/聚焦，错误也可见 | 原失败截图/零写入审计保留；f5-dispatch-directed14通过；两次修正后GUI结果直接可读，无绕过校验/版本保护 |

完整回归f5-regression.log：208文件全通过、1577项通过/2原有历史skip，2144.28秒；两自然策略50级failures=[]，全部现行流程/防刷/防重断言保留。最新types-final通过，7项可见摘要/旧诊断/Tooltip短检查通过。f5-source-before/after：1178源码与12配置完全一致，测试期间无漂移。配方24阶段51选择内容审计再次证明除名称/说明外全字段不变，没有数值重算。

提交仅18共享文件的自有patch、8新模块/4新测试和本轮证据/日志；battle-result-controller与equipment-tip的索引冲突已预演为HEAD加F5精确差异，保留其他会话未提交错误文案/图标flags改动，工作区不覆盖。提交后推进baseline，立刻F6工作簿受控编辑、四脚本落地、定向、GUI与完整回归；不询问继续。


F5提交28824f9；baseline已仅推进F5自有delta，real index空，其他会话工作区保留。F6立即开始：捕获源/WB/JSON前像，Artifact Tool导出两工作簿并验证所有旧数值/批注/冻结窗格，再复制源与config:export/check，落四脚本/三测试。无重任务在运行，browser2/tab1 about:blank；host50742 middle/reload11，Middle30/908HP/784金/21装弱态保留，Late31/8778金/73装/苍风守灵50自然所得保留，Endfresh50/48009金/50装/2待领/裂星潮5/6保留。F6批量与阵型GUI优先用Late，正式§4弱态重配只在F6完整提交之后做。

## F6 工作簿验证（08:31）

Artifact Tool两本导出已完成（未重跑marker）；第一次渲染证实原模板值列/对白ID文本列太窄，新内容不可读，未直接落源。仅加宽说明B值列、对白A/C/E列，新行顶对齐和合适行高，原A说明列/其它sheet不缩窄；不改任何单元格数值。第二次渲染完整可读 f6-workbook-routes/dialogue.png。preservation：任务29252旧单元格/2303旧数值/110原批注，只有Q5/Q66从空引用进行中对白；对话4239旧单元格/694旧数值/14原批注不变，新增2行seq1；页签顺序/冻结窗格保留。source/targetSHA与manifest绑定，另准备导出JSON逐字段白名单验证，防公式缓存/类型变化误改旧数值。即将guarded复制工作簿、config export/check、确认其它配置字节不变，再落四脚本/三测试。

## F6 定向通过，开始GUI（08:50）

工作簿/JSON已guarded落源，config:export只写任务/对话JSON，config:check 6本一致，逐字段审计证明309旧任务、689旧对白、6旧触发及所有旧数值/其它字段不变，只有两进行中引用+两新对白+一个可选路线参数；其它配置字节不变。四脚本/三测试已正式应用。

首轮types只有新地图错误提示escapeHtml未定义，改用现有公共esc；types-retry通过。定向10文件：9通过，1个自有receipt解码断言过严（解析器按既有契约丢未声明展示字段，不是接口或扣费失败）。只改本轮错误的raw全对象等式，改严格验证公开回执ID/一次revision/一次build/精确扣费/天赋数，原防重/事务回滚/费用断言不变。f6-directed.log保留80项通过/1失败；f6-types-decoder通过、f6-pg-retry.log 5项全部通过（真实PG批量/回滚/阵型冻结/field续租新入场/延迟旧nonce私有历史）。类型与所有相关业务验证现已通过，尚未完整回归。

GUI下一步：host middle/reload12，恢复原会话到camp确认30级/908HP/784金/21装弱构筑不变，正常logout；再late/reload13登录31级/8778金/73装，正常120金币重洗，批量分配30个可用点（按真实报价/费用，不授予），保持控场/生存选择。Late跑两次沉星密仓，记录前阵/后阵实际名称/位置/结果与冻结元数据；沉星野外显式入场两次可选走访轮换、续租保持/到达状态，不把正常杀怪收益当走访奖励。Fresh另建新账号/角色，验证开场→NPC进展不复读、E/技能/首本路径；Middle始终不在F6提前重配，正式§4弱态重试仅在F6完整提交之后。

### F6 GUI批量报价布局修正（09:16，继续进行）

最新Middle会话30/908/784金/21装恢复正常后已正常logout；API late/reload13正常登录31/963/8778金/73装。天赋总30/可用1，原使用29。正常重洗报价120，确认后8658金、HP875、30点可用；等级/装备/召唤成长保留，f6-talent-reset-quote/done。

实机发现新批量报价放在半宽按钮列中，使“金币”竖排；单点+3与批量5点的范围也不够清楚。已只调整progression-panel：整行显示服务端批量成本/after，单点与批量标题区分，沿现有公共成本/比较/间距控件，无新皮肤/CSS数值，不删旧按钮/信息、不缩字、不改费用。`.qa/implement-f6-batch-layout.py`已加入未来脚本序列，实际只执行此追加一次。f6-types-layout通过；f6-layout-directed 2文件21项通过（原UI14+批量pure7）。GUI已about:blank并释放exec37026，当前无重任务。

精确下一步：重新取得GUI锁，原Late会话恢复8658金/30点→养成天赋，截图确认批量5点/50金币/实际批量属性预览整行可读，再正常分配。后期可用30点默认选防御16/伤害14（原29点的15/14多1点加减伤），七次批量5/5/3/3/5/5/3与最后单点暴伤1共30点，真实分配费用300，重洗120，总420；实际以GUI报价为准。两次沉星阵型复刷保持这一同构筑/寒霜阵/未上阵守灵状态，记录冻结stats/variant。Middle保留弱态，后续正式复验用29点原15/14正常410费用（若等级变则按真实点数），绝不恢复覆盖F5自然收益。

## F6 批量天赋实机完成（09:38）

修正后报价整行可读，f6-batch-quote-readable：单点攻击160→163，批量5点160→176、50金，不再竖排金币。首批锋锐0→5，可用30→25、8658→8608；PG f6-batch-sharp-before/after：gold-50，revision/build/receipt/ledger各+1，rewards+0，证明不是客户端循环5次。

后期当前31级自然可用30点：锋锐5、致命5、武技3；体魄5、铁甲5、生命偷取3、减伤3；最后暴伤1。节点3上限按30金保存，最后节点未满但只剩1点时显示批量1点/10金、停止条件天赋点不足，f6-batch-point-limited。最后用原单点提交，保留单点路径；f6-talents-allocated可用0/30，HP963，8358金。

f6-talents-all-before/after：总分配费用300，7批量+1单点=8写提交，revision/build/receipt/ledger各+8，rewards0；素材1421/装备73/等级31与已得守灵不动。加原120重洗，总420，费用规则未改。防御16/伤害14是原29点15/14加自然多1点减伤，之后两次沉星试点保持此构筑/原四技能，不上阵守灵、不换新装备；输入与实际冻结stats由审计记录。Middle仍30/908/784金/21装原弱构筑，未提前重配。

当前GUI持锁exec43747，host50742 late/reload13，browser2/tab1养成天赋页。下一步关闭→区域地图→副本目录→沉星密仓，记录真实实例名/首段位置/完整结果，连续两次看前阵/后阵（顺序由所有历史实例数量决定，不能假设从0开始），audit-frozen-run.mjs late f6-rift-first/second记录真实pilot、13/怪物29/tier1/frozen角色stats与两前段合法位置；收益保留。然后沉星野外可选走访两次入场轮换，Fresh新角色对白验收。F6尚未完整回归/提交，仍连续执行。

## F6 沉星试点GUI完成（10:18，连续执行）

- Late同构筑两次自然通关，f6-rift-first-entry/second/boss/result、f6-rift-second-entry/front/result。第一实例b7e496f2...为visit6精英后阵，第二f3cb202e...为visit7精英前阵；第一半自动先普通3再全自动清前段，第二半自动入口即击败前置精英、按原达标条件推进。两次分别1412金/3688XP/168石/10装备与836金/1768XP/72石/7装备；差异包含实际击杀数量与随机掉落，不能当倍率变化或固定收益对比。全部保留，回港10606金/90装/0待领。
- 四份f6-rift-first/second[-final]-frozen-run.json证明两个实例正常running→success，阶段13/怪物29/tier1、入口963HP/176攻击/82护甲，同cut/ward/whirl/frost；pilot及两前段合法位置完整记录。前阵/后阵不是只换名称，精英原合法点互换；没有改怪数/属性/奖励。首领阶段半自动未接敌属原多阶段副本范围，正常切全自动通关；F4限定独立岛首领，不扩大到副本以免改变现行自然流程。
- 野外第一次正常航图出航：visit1难民营地wp2，f6-field-first-goal/done与arrival-audit；正常导航后done=true、完成按钮禁用，续租/同入场保持visit1。途中原野外战斗收益保留，10606→11552、90装/3待领/1677石。
- 正常回港→航图再出航：实际visit2炮台通道wp3，f6-field-second-goal/entry-audit，入口仍11552金，目标轮换不发奖。正常导航后done=true，f6-field-second-arrival/done/arrival-audit；当前11876金/90装/3待领/1682石/Lv31/HP963。途中普通怪/精英收益正常保留，走访本身不发奖。所有画面可见1280×720。没有整理/分解/覆盖收益。
- 最后设置→退出账号，原Late正常退出到登录页。GUI锁43747仍在，host50742 late/reload13。下一步切fresh/reload14，新账号fix_20261009_recheck、新UUID确保不复用克隆分支相同角色的已读状态，正常首战→米洛→首次激活→港口→程记进展对白→首本；保留真实操作耗时，工具单步约21秒不冒称熟练玩家10分钟。然后blank释放GUI，F6完整回归、提交及§4正式Middle/Endfresh持续执行。无硬阻塞。

## F6 实机条目齐全，完整回归中（10:49起）

| 问题 | 根因 | 修改 | 定向与真实路径证据 |
|---|---|---|---|
| 对白复读 | 到港开场已读状态未被NPC主任务交谈消费，始终拼accept/player | 主任务NPC若已播放开场且有配置dialog_progress则优先进行中，保留正常完成按钮；任务/对话工作簿两组配置 | f6-fresh-port-opening首次1/3，实际逐段读完；f6-fresh-cheng-progress单段登记台、完成按钮；f6-fresh-milo-progress原地E单段前哨，未误触板；真实规则对白单元与配置旧字段审计 |
| 天赋重复点击 | 仅提供单点operation | 服务端逐点原规则克隆报价，批量可负担前缀、expected_count、一次原事务/回执/build；整行批量报价与单点标题区分 | f6-batch-quote-readable、point-limited、talents-allocated；真实PG5案例与pure7；首批5点50金一次receipt/ledger/revision/build、7批量+1旧单点总300金；重洗120不变 |
| D4副本同构 | 原每次固定配置位置 | 配置2阵型，复用所有原合法位置，仅交换原演员位置，创建按完整历史轮换并冻结，重复命令/续接不重抽 | f6-rift-first/second-entry与各result，visit6后阵→visit7前阵，两次自然成功；f6-pilot-comparison冻结构筑/合法点集合相同，精英位置不同；真实PG命令防重/恢复冻结 |
| D4野外同构 | 明确入场无短走访变化 | 任务.xlsx说明参数驱动2原航标，已有世界坐标，独立只读contract，可信到达记done，地图导航、不发奖/不写任务、不加HUD行 | f6-field-first/second-goal/done及审计，visit1难民营地→visit2炮台通道，正常再出航才轮换，入口wallet不变；原怪收益保留；真实PG续租/旧nonce/新entry与奖励保护 |
| 设置后台说明 | 通用“后台暂停”误盖服务器副本持续运行规则 | 只修文案按实际场景区分，未改运行/暂停规则 | F6设置实机读到完整正确说明，旧副本生命周期定向20与相关全套回归保留 |

新角色实际10:21:25开场，10:43:06风车入场，10:48:31回港；新账号fix_20261009_recheck/复验新旅人，新UUID不继承旧seen。首战自然2级→航标正常E→原地米洛E→完成任务→野外寒霜阵首次激活成功且关闭可用→装配→箭头到落风坡后E正常回港→澄3段开场完整读完→导航E单段进行中→正常完成→4级风车三段自然成功。最终252HP/552金/17装/1待领。f6-fresh-* screenshot/AX全保存。工具每步约21秒，整路径墙钟27分6秒，明确不是10分钟内通关/真人速度，按原前10分钟内容路径验收；不伪报时间。

F6回归exec68503，f6-regression.log；GUI about:blank，43747已释放，无其它重任务。config-final 6本一致；source-before12e0ab...，1186源码/12配置冻结。实机无代码追加，types-layout已通过。等全套通过后source-after验证、F6提交，立即§4 Middle保留弱态初败→重配→通关→两次复刷，再Endfresh龙眠→层4真实20–40分钟→可达5，最终版本/全套/stop-build-start/GUI恢复。不得因等测试或上下文结束停工。

F6提交预演仅17共享delta、5新模块、3新测试。presentation/progression-panel/settings-panel三处索引冲突，resolve-f6-index.py --preview已验证HEAD加本轮精确差异，不改工作区，不携其他会话waypoint地图/新版天赋皮肤/拾取过滤未提交代码。recheck.md已建立现有证据链接，旧/新截图+AX成对齐全，评分/最终两路径仍明确未完成，后续更新不重新运行覆盖此草稿。


## F6 完成（11:21）

f6-regression.log完整通过：211文件、1590项通过/2原有历史skip，1938.69秒；无任务/全部任务两策略自然50级failures=[]，完整任务链、六岛剧情分支、副本生命周期、原防刷防重断言全部保留并通过。f6-source-before/after显式核对1186源码、12配置逐字节一致，sha12e0ab428f60137896866bd04cbb4a2c38316cbde9d54f5455c8b996b70d4920。33张GUI原始图像解码均1280×720，浏览器返回JPEG字节但既有证据扩展名为.png，保留原始字节并在viewport-audit注明；不是PNG头推断。配置6本一致，原数值/已完成收益保护不变。

当前GUI about:blank、无锁；full exec68503已exit0。host50742 fresh/reload14；新角色复验新旅人4级/252HP/552金/17装/1待领，登录cookie保留。F6提交后推进baseline，马上新GUI锁→恢复Fresh营地并正常设置logout→host middle/reload15→登录calendar_9637b11f7557437b。Middle只读final-middle-original-before.json：30级/784金/815石/21装/rev409/build121，原天赋伤害26/防御3，原3技能无寒霜阵；正式初败前没有重配/换装/覆盖。先自然沉星初败与新失败页截图，再正常120重洗+29点290（按真实GUI报价），防御15/伤害14（体魄5、铁甲5、生命偷取3、减伤2；锋锐5、致命5、武技3、暴伤1），正常激活/装配寒霜阵，通关+两复刷，记录真实冻结与每次结果/成长。

随后Endfresh原50级/48009金/1419石/50装/2待领，final-endfresh-original-before.json保留，原全部天赋52点含已赚声望点，绝不按假设49点重写。正常龙眠潮首领自然胜→6/6解锁4→第三地城路线19–24的真正tier4冻结实例，实玩20–40分钟再可达5。角色数值以实际GUI/frozen audit为准，不沿用原报告341HP错误表或猜测层级。

最终剩余：recheck.md十维度评分与两条正式路径；client0.11.22/rulesow-63（protocol32兼容、db16/assets不变）版本同步；最后一轮完整回归/types；正式服务stop→锁内pnpm build→start；同隔离源改生产preview并正常GUI登录/恢复营地；最终§7全部勾选/最终提交/§8一次汇报。F6已实现不等于这些条目完成。无§6硬阻塞，持续执行。

F6提交fc7e22a；baseline已仅推进F6自有delta，real index空。立即§4，fresh14恢复营地正常退出后切middle15。

§4正式开始：F6 fc7e22a之后，GUI锁43974（final-saved-game-GUI），fresh14恢复旧新角色营地成功并正常logout。浏览器响应从每API约21秒恢复为约2秒，因此另建独立新账号fix_20261009_final/正式复验旅人，在11:25:36首帧从1级开始，final-new-start.png/txt及final-gui-journal记录真实时间，重新执行严格F6后的前10分钟路径。先前角色4级/552金/17装/1待领保留。新路径结束正常logout再切middle15；不得在当前尚登录fresh时直接切分支。

### §4 正式新角色路径完成

F6提交后新账号fix_20261009_final，正式复验旅人UUID6bb25afc-c6c2-4b0f-8de7-074176315769；11:25:36.201开场→11:32:23.405进入4级风车地窖，真实6分47.204秒，在前10分钟内完成首战/航标E/米洛原地E/野外寒霜激活装配正常关闭/回港E/澄开场读完后的单段进行中。final-new-*截图+AX、final-gui-journal原始时间。没有把F6早先工具慢27分路径改写成快路径；两新UUID与旧收益均保留。

自然风车完整三段成功：入场4级、阶段1/怪物4/tier1，final-new-entry/final-frozen-run审计，结果368金/496XP/42石/8装，剩125/252HP。正式结果自然掉苍风之刃（base blade、origin stage-key/stage:1/stage-1-a），同原主手青锋长剑的剑谱系，正式Tooltip“阶段钥匙产物”；两者+0时角色攻击41→37，点燃0→3%、冰缓0→4%。来源、百分比和机制取舍可读，不宣称净提升或调数值；追加数值待办审核早期关键奖励即时用途/TTK。未装备新剑。

正常回港final-new-camp：Lv4/252HP/559金/17装/2待领，四技能保留。下一步设置logout→host middle/reload15→登录calendar_9637b11f7557437b，原26伤害/3防御、3技能弱态先自然初败。GUI锁43974仍持有，不运行测试/build。Endfresh仍5/6未完成，最终版本/full/build/recheck评分未完成，无硬阻塞。

### §4 Middle正式初败与天赋重配完成（12:10，技能/通关待做）

middle15正常登录实机30级/908HP/784金/21装，原26伤害3防御/3技能，final-middle-login。正常沉星密仓新实例e7f2bed6...，visit2精英后阵，半自动3普通后正常全自动，第一前段自然失败，不是假退或改弱。final-middle-weak-entry/front截图AX；冻结阶段13/怪物29/tier1/原构筑、statusfailed。失败保留288金/960XP/48石/1装→1072金/863石/22装；钥匙2/64仍差62。失败页直接最近近身116/101、背刺220/11与控场/生存/分批/躲区/前段精英宝箱建议。有输出25/100秒（25%）、记录99.6秒含开场半自动与工具菜单等待，不能比较成纯战斗DPS或全本输出占比。

正常回港后120重洗，1072→952金，29可用/857HP；依次锋锐5、致命5、武技3、暴伤1旧单点，体魄5、铁甲5、生命偷取3、伤害减免2（实际节点名伤害减免，简称减伤的误选超时已查实，不是产品卡忙；未重复提交）。final-middle-reset-quote/done、last-two-quote、talents-allocated。当前943HP、30级、662金/863石/22装、0/29点、防御15/伤害14，未换装/激活技能。分配290+重洗120=410，原费用不变。

final-middle-respec-before/after总窗口从失败页到正常回港/配点：revision/receipt/ledger+11，build+9、reward0。已逐条核对final-middle-respec-ledger：427/428两条零金币/XP/材料且build121；429重洗-120/build122，430–437八条配点(-50/-50/-30/-10/-50/-50/-30/-20)至build130。明确9付费回执总-410，不把两个非配点零收支回执说成重复扣费，也不从无operation字段推断其操作名。

当前GUI锁43974，host50742 middle15，browser2/tab1天赋防御页已分配完。下一步关闭→技能→跨分类搜索寒霜阵，正常激活0→1并装配第四位（无GM），截图/冻结记录实际属性；然后沉星密仓正常通关+两次复刷，全部自然收益保留，真实阵型依历史计数应前/后/前但以实例审计为准。原装备/天赋保持，等级可自然长不清。F6六批已提交fc7e22a，最终Endfresh龙眠/层4 20–40分钟/可达5、版本/types/full/build/GUI恢复/十评分/最终报告仍未完成，无硬阻塞，继续。

### §4 Middle重配后首领进行中（12:25）

正常寒霜阵激活0→1（等级30/3、消耗无），正常装配第四位；662金/30级/943HP/22装/863石，final-middle-frost-activated/build-ready。新正常沉星实例b4e5a27a-9887-42cc-bdec-b9e8673dedb7，visit3精英前阵，阶段13/怪物29/tier1，frozen四技能cut/ward/whirl/frost已实证，实际角色943HP/174攻击/82护甲（完整以entry-frozen为准），原装备/15防御14伤害，未上阵新守灵。

第一前段默认半自动自然达标943HP后推进；第二同半自动达标943HP，随机取得苍风召唤石（阶段13成长正常保留、未上阵）。随后正常全自动清第二前段余敌，再ready/next首领。final-middle-pass-entry/second/boss截图AX；最新boss270605/504569，角色943/943。阶段切换一次“目标已失效”toast保留，但不阻止首领持续受伤，不冒称无错误文本。当前还不是终局，下一步观察自然result截图，audit-frozen-run.mjs middle final-middle-pass-final、正常回港，再连续两次复刷（后阵/前阵以真实pilot为准），全部收益保留。

GUI仍锁43974，host50742 middle15，browser2/tab1真实首领战全自动。CUA重绑过一次，现变量playBrowser/playTab/evidenceFs；不同时跑测试或build。F6完整回归/commitfc7e22a已完成，产品源码未再编辑。后续Endfresh龙眠潮自然胜→4层20–40分钟→可达5、最终版本/types/full/build/GUI恢复/评分与最终报告仍需完成。无硬阻塞，不停。

最终收口附加修复已落地（尚未最终提交）：DungeonController.accept原先无状态判断地播放终局快照cast_failed，导致三次成功结算仍显示旧目标失效。按§5当前场景/真实结果优先，由dungeon-feedback.ts一次报告真实success/failed/abandoned结果，running时原全部失败文案完整保留，closed/preparing/loading不重放历史施法；不删事件/不改战斗/不改奖励。回退仅撤本轮controller调用与新helper，前像.qa/final-before保留；两共享文件controller/contracts已捕获final-manifest及baseline，contracts版本此时仍未改，以便同一终局GUI对照。final-types-feedback exit0；final-feedback-directed 2文件5项通过。GUI about:blank，旧锁43974释放，Middle第二复刷成功尚未返回camp，before-persistence hash50762d.../30级/4322金/1271石/50装/build133/rev521，521回执/流水、131奖励、f94c1eb3...success。下一步新GUI锁→恢复相同Middle终局→截图新成功反馈→after审计hash/回执/奖励不变→正常回港/退出→版本0.11.22/ow63、Endfresh16继续。

## §4 Middle全部完成与最终结束反馈收口（12:55）

正式初败→正常410金币重配+免费激活/装配寒霜阵→前阵首通→后阵复刷→前阵复刷全部自然完成。三次success分别b4e5a27a.../4d801327.../f94c1eb3...，收益1124/2728XP/120石/10装、1412/3688XP/168石/10装、1124/2728XP/120石/8装。final-middle-three-run-comparison.json：三次frozen玩家完全相同30级/943HP/174攻击/82护甲、同四技能、visit3/4/5前后前；原装备/天赋未变，新苍风守灵50未上阵。最终正常camp30级/943HP/4322金/1271石/50装/0待领，final-middle-camp与日志；已经正常设置logout，登录页确认后blank，锁85041释放。

附加收口已实测：相同f94c1eb3...success终局，旧目标失效before→新“挑战成功，战利品已保存”after；完整stateHash50762d9c...、521回执/流水、131奖励、gold4322/gear50/build133/rev521全部不变，audit unchanged=true。没有重打/重发/删失败事件；原running失败提示保留。final-feedback-directed 2文件5项通过，final-types-feedback通过。此修复与版本仅在最后自有delta提交，F1–F6六提交保留。

现在client0.11.22/rulesow-63已同步源声明，protocol32/db16/assetsworld-art-20261007-v24-world-runtime不变；扩展字段/独立新接口向后兼容，未变World检查点协议，未绕过版本校验。final-types-release通过。host50742 endfresh/reload16已API_READY，health实际五版本一致。GUI此刻about:blank、无重任务；下一步新GUI锁→goto127.0.0.2:10840→登录calendar_9637b11f7557437b Endfresh50/4039HP/48009金/1419石/50装/2待领/tide5of6→正常龙眠潮自然胜→解锁4→真实第三路线19–24/tier4续玩20–40分钟→可达5。禁止用普通风车stage1作高层证据。

之后最终全套回归（当前212文件1593项预计，必须读真实结果）、source/config before-after、正式service stop→锁内node .qa/run-release-build.mjs（底层同pnpm build、源码/已有未提交资源前像保留并核对）→service start、隔离同源生产preview与真实GUI登录恢复camp、recheck十评分/§7全勾选/最后自有提交/§8一次汇报。No硬阻塞、不得停。新的final-manifest已捕获controller/contracts前像及2新文件；.qa/implement-final-feedback.py已运行不要重跑；.qa/prepare-f6-recheck.py会覆盖新报告禁止重跑。

### §4 龙眠自然胜、层4解锁与6/6后的引导补齐（13:17）

Endfresh16已正常新版本登录50级/4039HP/48009金/50装/2待领/tide5of6。航图正确五岛裂星潮完成、龙眠普通已平定/潮待挑战。正常挑战维洛，无手动移动/暂停，默认半自动主动接近；final-dragon-entry实机boss43812547/70367833、角色3841/4039+盾，许可冻结ss-map-boss-6周期6/rulesow63/怪物52级/原始difficulty1（不能拿选中tier3标记冒称boss按营地tier3乘数）。自然胜final-dragon-natural-state：9726金/194209XP/8石/1装，裂星潮6/6；server hardmodeBosses六个，57735金/1427石/51装/2待领，所有自然成长保留，build440→458随已得XP成长，不按旧构筑做配对强度宣称。正常回港4已可选，final-tier4-unlocked；正常选4，final-tier4-selected。

实机发现选4后仍旧6/6返回港选择层级，已按§5当前阶段目标裁决补齐：任务.xlsx说明新增recommend_stage_dungeon/next_tier两短模板；服务端starseaStageGoal复用activeWorldTier/worldTierChoices/worldTiers现有解锁所有者，当前深渊指向地城、有更高已开层指向地图，不复制倍率/解锁公式；contract recommend.action可选dungeons/world-tier，港口箭头打开注册正式目录/地图，sceneAction与显式追踪优先，不改任务/奖励/层级状态。quest-system §5.4同步。回退仅本轮stage-goal/codec/箭头以及2新参数；前像final-before/manifest保留，不恢复覆盖其他工作。

工作簿Artifact Tool操作，未重跑marker。初稿2值缺JSON字符串引号被原config:export正确拒绝，failed.log与原Artifact文件保留；仅修新2格JSON编码，原校验器保持。fixed-preservation：29254旧单元格、2303旧数值、111旧批注、页签/冻结全部保留；逐字段JSON审计309旧任务全字段/数值不变，仅2参数，另外10配置字节不变。final-stage-export-fixed/config-check通过6本一致。自有审计Win路径分隔符识别已规范化，未放宽其他配置Hash断言。

final-types-stage exit0，final-stage-directed两文件通过（真实计数见日志）保留全部旧断言。三个新用例覆盖当前4地城action/严格codec保留、真正现行clear规则后5地图action、旧任务手动追踪仍优先。产品现仍client0.11.22/protocol32/rulesow63/db16/assetsv24。host-control endfresh/reload17已写，等待API_READY；GUI about:blank，旧锁65457已释放，当前无重任务。

层4正式续玩尚未开始：从下一次真实层4地城入场时间计20–40分钟，不把上述工作簿/代码/测试时间计入。下一步新GUI锁→同源恢复Endfresh营地（无需跨库登录）→截图正确“世界层级4：挑战地城首领”→箭头打开副本目录实测→选船坞遗址（field-wind-3，stage19/monster40/worldTierScaling）真实tier4入场记录journal+frozen。继续界桥地窖23/48、航网机库24/50等不同高层真实成功/失败/重试，首通即使解锁5也先保持4≥20且≤40min，再选择5至少实际一轮。只有三路线19–24作高层证明，不能普通风车1。最终full212文件预计1596项（读实际）、source/config冻结、stop-build-start/保护工作区生成器前后像、隔离生产bundle GUI登录恢复camp、recheck十评分/全§7/自有最后提交/§8一次汇报全部仍待完成。无硬阻塞，连续做。

## §4 层4真实续玩已开始（13:22:08起）

final-tier4-guide-fixed实机“世界层级4：挑战地城首领”，箭头实际打开副本目录final-tier4-arrow-catalogue，修复后不再回港重复选择。首个真正tier4入场13:22:08.819（journal tier4-play-start）：field-wind-3船坞遗址，numericStage19、准入38/怪物40、worldTier4/worldTierScalingtrue，rulesow63/client0.11.22；高阶段以4为额外倍率基准，所以worldDifficulty.hp/attack=1是既有规则（DungeonService.create分母worldTier4），不是忽略层级，5按相对4倍率再冻结，绝不重复乘地图上相对航行的8.45。

船坞三段自然全自动成功：final-tier4-wind19-entry/front/second/boss/result，首领maxHP59777100；中途3876/4039，正常治疗到满，13:29:24成功，368金/496XP/42石/9装，57735→58103金、51→60装，2待领保留。首次真实tier4首领clear正常解锁5，HUD实际“已开放世界层级5，打开地图选择”；正常回港箭头打开地图，final-tier5-unlocked-while4证明确实5可选而4仍当前，没有提前切5。

当前第二个tier4真实实例7b9b17c4...field-rift-3界桥地窖，13:35:01截图时已自然first-front失败：阶段23/准入38/怪物48、worldTier4/scalingtrue，原三技能/50级/4039HP/攻击3059/护甲2229；普通裂缝幼影maxHP9036875/攻击4950（冻结difficulty攻击4.63348，policy攻击44.84542×前段0.103321；只记录不重算数值）。实际4.5秒失败、输出4/5秒80%、近身2376与背刺4039，0金/XP/石/装备，钥匙0/117差117；失效提示收口正确中性终局，失败来源/建议直接可见。frozen+GUI journal均保存，不把失败写成通过/不按同岛名字混阶段13。原收益58103金/1469石/60装/2待领完整保留。

下一步按失败建议正常激活免费寒霜阵0→1并装配第四位（原三技能顺序/原装备/原天赋保持），再试一次相同23；若仍失败如实记录，不改难度/怪物/费用来补过关。随后试真实航网机库stage24/怪物50等，层4窗口从13:22实际入场计，达到20–40分钟后正常切5至少一实际层5轮次（可用较低阶段19）。高层失败/重试是本次要求记录，不是§6硬阻塞；继续完成finalfull/build/GUI恢复等所有条目。

当前GUI锁21250，host50742 endfresh17，browser2/tab1界桥地窖失败结算；待正常返回camp→技能。源在最后阶段引导之后未再编辑，最终9共享+2新文件manifest已捕获；workbooks旧数据/另外10配置均已验证，source产品0.11.22/32/ow63/16/v24。最终完整回归、构建（含生成器前后像保护）、正式服务/隔离生产bundle GUI恢复、recheck十评分/最终自有提交/§8仍未完成，持续执行。


## 自然路径全部完成，最后回归中（14:40:20起）

层4从13:22:08.819实际stage19入场，到14:01:47.166层5当前截图，共2378.347秒=39分38.347秒，final-tier4-play-window within20to40=true，含正常菜单/技能准备/工具间隔，不是纯战斗或人类反应。期间stage19/40级成功；stage23/48级初败4.5秒与免费寒霜四技能重试1.8秒均真实失败；stage24/50级前段打倒普通未过精英，正常确认退出、60金/240XP保留、statusabandoned不冒称通过。全部血量/攻击/入场倍率frozen真实记录，未改任何数值补过关。

层5实际新实例b9d2e32a...worldTier5/worldTierScalingtrue、stage19/怪物40、相对4额外1.1/1.09，四技能冻结；真实完整成功14:24:19：368金/496XP/42石/13装，后续层6自然开放但不额外试玩。之前4材料scope stage:19:tier:4仍4份，切5为独立新scope不是清档，final-tier-key-scopes证实。正常回港final-endfresh-camp-prebuild，再设置logout到登录页、about:blank、锁21250正常释放。

最终构建前角色审计：Lv50/4039HP（GUI）/XP658185/58531金/1521石/73装/2待领/build461/rev2167/worldTier5/unlocked6，2167回执与流水、459奖励，stateHash2427ab7c556a3a10b3d41f7d26846c02a996b103263ae9ca0061783dc549147e。before完整state留.qa，evidence/final-build-state-before.json公开metadata；生产登录恢复后先after核对，再做其他正常UI补验，区分合法新增收益。

五隔离分支只读备份job72836全部exit0（13/9/38/21/75MB，见final-backups.log与final-isolated-backups.json），原始报告dump未覆盖，raw私有dump放ignored .qa/playability-final-backups-1791527442640-a17d9357，不进客户端/不stage。Fresh有3 own角色，其他分支各1，Late/New/Middle已得收益都保存。当前host50742 endfresh17、API10839/PG10838/旧Vite10840仍在，browser2/tab1about:blank且已logout；无GUI锁，唯一重任务final-full-regression exec81242。

最终config:check六本通过，final-source-before fc937dfa...1188源码/12配置已冻结。stage-final.py预演9共享+2新无冲突，final-preview.index新增2源/code check通过、real index为空。recheck.md自然路径/十评分已补全，所有证据链接存在；评分保守为4/4/3/3/4/4/3/4/3/3，不据自动和工具间隔伪称手动手感改善/数值通过，最终构建和生产GUI结果未完成，不提前总评。接下来按顶部精确下一步做完，不暂停询问。无§6硬阻塞。

## 最终发布验收完成（2026-10-09）

最终完整回归exit0：212文件、1596通过、2原有历史skip，1901.77秒；完整自然日程、任务链、副本生命周期与防重规则断言全部保留。类型/相关定向/六本config:check均通过。最终源与既有数值保全结果已在前述日志保存；用户要求简化后没有再增加或运行审计。

标准pnpm build首次因Windows占用ui-v2导致rename失败，失败日志保留。核实停止本次隔离host46880的Vite52860，重试标准构建成功，未改产品构建脚本。正式服务已恢复：当前用户Limited任务计划Running、自启开启、lastError空；正式8612与隔离10840的health/content均实读client0.11.22/protocol32/rulesow-63/assetsworld-art-20261007-v24-world-runtime/db16。仅只读正式版本接口，未登录正式源或向正式玩家数据写入。

生产preview运行于原隔离127.0.0.2:10840，API10839/PG10838，host仍endfresh17；旧dev Vite已停。GUI锁26936仅覆盖本次生产GUI，已正常释放，没有并行vitest/构建/PG测试。可见浏览器2/tab1、DOM1280×720，加载./assets/game-BDibmQLL.js而非dev客户端，console errors=[]。最终营地浏览器已标记保留。

真实生产包账号登录与刷新恢复营地：50级/4039HP/58531金/73装/2待领；final-production-login/session-restored图片AX。正常暂选1后龙眠出航→誓约庭真实传送、地图自动关闭，再开地图8完整航标/按钮/关闭均可用，关闭后正常回港。两帧主界面曾显示处理中，原图AX保留，不据这两帧声称完成耗时或所有HUD均无刷新延迟；实际地图与回港操作成功。沉星正常出航→界桥前庭真实传送→系统/回城入口可用→正常回港，final-production-rift-waypoint。全部不需要刷新页面、丢存档或绕过版本。

沉星正常半自动野外新增1770金/23108XP/3强化石，登陆按既有arrive规则接取建立滩头前哨并出现开场/进行中对白，关闭后地图可用；没有把正常收益当作构建损坏，也没有回档清除接取记录。正常恢复当前5（6已开放），任务页取消追踪后仍进行中1/2、按钮回到追踪，HUD恢复阶段目标，无假完成；final-production-tier5-restored/untracked。阶段19原初主手服务端同强化+7预览公开机制/用途/百分比，3059→2813攻击/2229→1831护甲/回复10→15等取舍，材料4/111制作禁用，未制作或换装；final-production-key-preview。预览正常关闭，最终final-production-camp：50级/4039HP/60301金/1524石/73装/2待领/当前5、下一6。金币与装备数在取消和预览过程中不变。

§4三正式自然路径全部完成：新角色6分47.204秒首本入场；原checkpoint30初败→正常410金币重配/免费控场→成功+两复刷，三次冻结构筑一致；Endfresh自然龙眠6/6→层4实际39分38.347秒（包含菜单和工具等待）→层5阶段19完整成功。高层23两失败、24仅前段正常退出照实保留，不冒称全路线通关。十维度重新评分4/4/3/3/4/4/3/4/3/3、每项证据与置信度、数值批次待办见recheck.md。

用户简化指令落实：31个本轮临时审计/指纹/前后像/构建包装/校验辅助脚本已删除，包括audit-*、production-*-audit、playability-source、check-release-versions（未运行即删除）、build-preimages等；不新增替代脚本。保留.qa/playability-fix-1791461103490自然成长数据库、.qa/playability-final-backups-1791527442640-a17d9357五分支备份、.qa/production-preview.config.ts，分别用于存档保留、可恢复备份和维持可访问的生产预览。临时Git baseline/manifest用于本轮增量提交与回退查证，不属于运行中的审计；结果日志/截图/AX留在docs。正式库、其它会话未提交代码与旧QA脚本不清理。

无§6硬阻塞，§7全部达成；最终收口只包含终局真实反馈、6/6后阶段目标接线、版本声明和本次复验报告证据。按§8一次总评/六批表/十评分/边界与数值待办/提交列表汇报，不再停问是否继续。
