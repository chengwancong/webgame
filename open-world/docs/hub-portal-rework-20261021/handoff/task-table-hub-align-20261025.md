# 任务表对齐 HUB（Claude → GPT，2026-10-25）

## 背景

用户反馈：主线一堆原地对白，像在对骂。查下来的原因是：HUB 改版把大世界换成"单岛主城 + 星门节点"，但任务表只冻结了一部分旧任务，再给剩下的挂上 `hub_node`，任务的写法本身没有跟着改。10-22 定的口径是"任务引导全面降级"：不强制和 NPC 对话，每步最多一句台词，回港对白自动确认。现在的任务表不符合这条。

客户端兜底由 Claude 在本会话另做：HUB 模式下，对白弹窗统一降级为一行提示。**这份交接只管内容表**：任务.xlsx、对话.xlsx 和导出的 `config/json/tasks.json`、`dialogue.json`。

## 现状（截至 2026-10-25）

范围：`campaign=starsea`、`frozen` 不为 true、`type` 不是 bounty 的任务，约 90 条。

1. **挂节点的任务**（有 `hub_node`，约 80 条）：完成判定已经由规则层改为"通关该节点"（`packages/rules/starsea.ts` 第 69 行和第 125 行），旧步骤的地图和类型不再生效。但以下内容还是旧大世界的：
   - `goal` 写着"启动船台的临时引擎，守住它并击退 3 名侵军"这类旧流程。
   - 接取对白多为 5 句，完成对白 1–5 句；里面有 narrator 的"航图上的问号标在……"这类旧大世界指路，也有玩家质问、NPC 解释的来回。
   - 同一个节点挂了多条任务：比如 `mist-story-1` 挂了 t01 和 t02，各巢穴节点同时挂着 `ow-*-side-*` 和 `ow-*-dungeon-guide*`。通关一次会连着完成好几条，每条都有自己的完成对白。
2. **港口强制对话任务**：`ss-c01-t02` 港口登记、`ss-c01-t06` 到 `ss-c06-t06`（每章尾声，`accept_mode=talk`，步骤为 `talk`）、`hub-first-return`（两步 talk）、`HEX-Q01`、`HEX-Q02`（最后一步 talk）。玩家必须走到 NPC 那里点一串对白才算完成。
3. `ow-*-dungeon-guide*` 共 18 条：原本是大世界里"找到入口再进副本"的引导。HUB 下副本直接从航图进入，这类引导没有意义了。

## 要做的事

### T1 挂节点任务的文案降级

- `goal` 改成节点说法，≤20 字，例如"通关「抢救船台」"。
- `dialog_accept` 组压到 **1 句**：保留最能交代"为什么去"的那句。删掉 narrator 指路和玩家质问。这一句会在剧情副本第一步的顶栏显示。
- `dialog_complete` 组压到 **1 句**，这一句会在回港时作为一行提示显示。
- `dialog_progress`、触发表（`dialogue.json` 的 triggers）里属于这些任务的组，也按每组 1 句处理；`mode=popup` 一律改成 `notice`。
- 语气：交代事实、给下一步，不写人物互相指责。原来有意义的剧情信息，挑一句最关键的留下，不要硬塞进一句长句里（每句 ≤40 字）。

### T2 一个节点只留一条带对白的任务

- 每个 `hub_node` 最多保留 **1 条**有接取或完成对白的任务。默认保留 `order` 最小的剧情任务（`ss-c0x-t0x`），其余同节点任务清空对白组引用，任务和奖励保留。
- `ow-*-dungeon-guide*` 共 18 条：默认 `frozen=true`。它们的奖励如果不是 0，就把奖励并到同节点保留的那条任务上，不要让玩家少拿东西。

### T3 港口强制对话改成自动完成

- `ss-c01-t06` 到 `ss-c06-t06`：`accept_mode` 改为 `none`，`talk` 步骤改成 `hub_fact`，key 用 `hub-node:<该航区>-gate`，也就是关口首领首通即完成。完成对白 1 句，由回港队列以一行提示给出。
- `ss-c01-t02` 港口登记：改成 `hub_fact`，key 用 `hub-guide:near`（走到星门旁即完成）；没有独立意义的话直接 `frozen=true`。
- `hub-first-return`：工坊和码头已经改成"通关节点自动解锁"，这条默认 `frozen=true`。
- `HEX-Q01`、`HEX-Q02`：删掉最后的 `talk` 步骤，靠前面的事实步骤完成。
- **奖励和解锁不能丢**：凡是 talk 步骤完成时会发奖励、开功能、加船员或宠物的，改成 hub_fact 后要在 PG 测试里证明仍然发放。

### T4 等级和奖励核对（只报告，不调数）

- 列出每条保留任务的 `reward_xp`、`reward_xp_hardmode`、`reward_gold`、`reward_material`，与所挂节点的推荐等级（`hub-chart.json`）对照。
- 写进进度文件：哪些还按旧大世界等级算、差多少。**不改数值**，数值改动按 TTK 推导另立批次，由 Claude 裁决。

### T5 防回归检查

新增 `tests/hub-task-alignment.test.ts`（不要改 `tools/validate-content.ts`，其他会话正在改它），覆盖范围内的任务：
- 没有 `op=talk` 的步骤，`accept_mode` 不是 talk。
- 所用的接取、完成、进度对白组每组 ≤1 句；触发表里没有 popup。
- 每个 `hub_node` 最多 1 条任务带对白。
- `goal` ≤20 字，每句对白 ≤40 字。

## 默认裁决（直接采用，不回来问）

- 改源表 `config/excel/任务.xlsx`、`对话.xlsx`，按现有流程导出 json；不要只改 json。
- 规则层（`packages/rules/starsea.ts`）、后端和前端代码都不改。确实需要新的事实 key 或规则支持的，记进进度文件「待 Claude」，该条先 `frozen=true` 兜住，继续往下做。
- 删对白时要选句子保留，不能整组删空导致剧情信息全没：每个剧情任务至少保留 1 句接取对白或 1 句完成对白。
- 规则没覆盖的边角：选对玩家更直观、更少打断的处理，记进进度文件（问题｜处理｜依据）。

## 验证

- 每步跑：内容导出校验、全仓 tsc、`tests/hub-task-alignment.test.ts`、`tests/starsea-dialogue.test.ts`、`tests/playability-dialogue.test.ts`、HUB 相关的 PG 测试（`--maxWorkers=1 --no-file-parallelism`）。重任务一次一个。
- 旧测试因为对白句数变化而失败的，改成新口径的断言，不要恢复旧对白。
- 禁无头浏览器、Playwright 探针和自动化脚本；可以用你自带的浏览器（非无头 GUI）对本地服务做短时自查：新角色打一个剧情节点再回港，确认只出一行提示、不弹对白窗口。完整真机验收发云测试服交 Grok。

## 约束

- 只按明确路径提交本任务文件，不碰工作区里其他会话的改动（目前 `apps/api/src/app.ts`、`dungeon-controller.ts`、`main.ts`、`contracts/index.ts`、`salvage-batch.ts`、`validate-content.ts` 都有别人的未提交改动）。
- 不提交原始明细、截图、构建产物。
- 云测试服口令只在 `G:\webgame\aw-deploy\staging-credentials.txt`，不得写进报告、日志、提交或链接；开发期可以清档，但先备份。
