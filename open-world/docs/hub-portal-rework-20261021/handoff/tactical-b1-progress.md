# TAC-B1 战棋战斗核心：进度

交接：`tactical-b1-combat-core.md`；决策日志：`tactical-b1-decisions.md`（执行者创建）。
按 T0 → T9 连续执行；每项勾选时写提交号和一句验证结论。中断后从第一个未勾项继续。

- [x] T0 准备：完整读取交接/16 号及 08 §6–7、09 §2–5、13 候选表；基线 tsc 通过，3 文件 48 项 tactical 测试通过；决策日志和协作任务行已建（提交见下）。
- [x] T1 契约 `packages/contracts/tactical.ts`：单位、七类意图、动作、事件、投影与托管编排已定义；9 项契约单测通过（提交见下）。
- [x] T2 回合机 `encounter.ts`：意图制、种子重现、先手、Bresenham、不可变输入与公开预览；10 项回合机测试通过。
- [x] T3 技能 `skills.ts`：剑 4＋暗器 4、CD/盾/DOT/区域、拉拽与同主行动预算；7 项技能测试通过。
- [x] T4 敌人 AI：8 原型＋swarm、6 词缀、普通防必死、首领阶段/蓄力/力竭；26 项 AI＋4 项边角测试通过。
- [x] T5 托管 `autopilot.ts`：公开组合枚举、确定评分、编排三开关、同 act 执行与实际暴击后剩余动作恢复；6 项托管测试通过。
- [x] T6 内容：archetypes / graybox / 风栖 5 棋盘；已接现有内容校验入口，10 项内容测试通过（预算、出生连通性、真实群伤覆盖）。
- [x] T7 沙盒：环境开关、固定 1 小时寿命、CAS/防重、只读预览、60 秒托管/接管；21 项真实 HTTP 测试通过，五棋盘手动和后台托管均至终局。
- [x] T8 托管基线：fdd45073 首轮100场 → f88ae442唯一调整 → 验证100场；总胜率90%→100%，所有数值/残差见summary.md，停止调数。
- [ ] T9 收尾：全量相关测试、版本、云部署、Grok 说明、协作中心更新

## 验证记录

2026-10-24 T0：`node node_modules/typescript/bin/tsc --noEmit` 退出 0；`node node_modules/vitest/vitest.mjs run tests/tactical-*.test.ts --maxWorkers=1`（PowerShell 展开文件列表）3 文件、48 项通过。协作中心 21,826 字符，小于 40,000；通过规定脚本登记 TAC-B1。工作区已有前端变更及图片删除，留在原处，不纳入本批。

T0 提交：`0a90709c`。T1 验证：`node node_modules/vitest/vitest.mjs run tests/tactical-contracts.test.ts --maxWorkers=1`，9 项通过；严格动作 schema 拒绝未知字段、无效格坐标，投影 schema 不包含 RNG 游标。

T1 提交：`ca8c2a3a`。T2–T4 的规则模块相互依赖，以同一个原子提交交付，包含执行必需的灰盒内容源；T6 仍单独验收内容校验接线。T2/3/4 分别 10/7/30 项针对性测试通过。炮手初次失败是用例把友军放在实际标记范围外，已改为合法已标格并保留受伤断言；未改伤害规则迎合测试。补充事件 ownerTurnId、rootActionId、真实已走路径与同时归零玩家胜裁决。

14:33 全部 `tactical-*.test.ts` 13 文件 180 项通过（包含 Claude 同步前端测试）；14:36 追加边角与云编排器等 44 项通过。全仓 `tsc --noEmit` 已重新通过，先前并行前端错误已自行修复，不构成阻塞。测试串行，无浏览器、无数据库访问。

T2、T3、T4 提交均为 `45d2b3ce`。T5 的 6 项测试在全量 180 项中通过，覆盖确定性、不读种子未来结果、手动同轨迹、优先祭司、无技能用普攻/结束、非暴击后不重播动作。

T5 提交 `0fb95fb0`。T6 内容源随 `45d2b3ce` 原子提交，校验接线及 10 项测试独立提交；现有 `validate-content.ts` 只添加 tactical loader，不纳入先前 build-guides 未提交工作。

T6 提交 `121e9e9e`。T7：`tests/tactical-sandbox-api.test.ts` 21 项通过（全量战棋回归的一部分）；完整遭遇测试允许 30 秒运行时间，终局断言保持不变。接口模块没有数据库/角色依赖，生产模式不注册，开发/测试也必须 `TACTICAL_SANDBOX=1`；PG 未改动，因此本项使用无数据库 Fastify inject 验证，不接正式角色。

T7 提交 `4a3bc1cd`。T8 测量前冻结：全仓 tsc 通过，5 项 CLI/云编排边界测试通过；通过云端无网络 1 核/1GB 容器执行 100 场/轮，本机只归档和接收汇总，原始结果不提交。

T8 首轮来源 `fdd45073`，100 场完成，总胜率 90%；普通 100%、精英 50%、首领 100%。一次推导已在 `docs/reviews/tactical-b1-20261024/summary.md` 冻结：中档 HP20→12、刀兵伤害8→5、首领 HP130→110。规则/站位/技能/托管权重不变。26 项 AI 单测先在旧值下验证配置驱动夹具，继续保留“总伤害=HP 必须降级”的严格临界断言；配置更新不靠弱化规则断言过关。接着仅跑一轮 100 场验证。

## 硬阻塞

T8 报告提交 `12361bb6`，验证来源 `f88ae442`；验证 100/100 获胜，普通 ER3.45/HL4.42%、精英6.9/34%、首领10.45/0%；残差已冻结，不再修改数值。

T9 准备：升版 client0.11.55 / protocol56 / rulesow-96，db19与assets不变；全仓 tsc 通过，本机 health/content 已同步。云数据库容器仍为 `86cadc993bb4`、启动于 2026-10-18，部署只切 API/客户端。火焰测试前置刀兵旧金额已分离，追加“火焰仅一次”严格事件断言，未改战斗代码或数值。

无。

## Grok 测试说明

完整可复制说明：`tactical-b1-grok-prompt.txt`。先核对真实 sandbox 请求与三端版本，再逐个测试五棋盘×双英雄的手动/托管、两个合理选择、意图可读性、预览/防重/超时接管。Claude 的前端线格式仍需按共享契约核对，独立提示词为 `tactical-b1-claude-contract-sync.txt`；不把 fixture 验收当沙盒已接。

发布前最后回归：`node node_modules/typescript/bin/tsc --noEmit` 通过；`vitest run tests/tactical-*.test.ts --maxWorkers=1` 15 文件、188 项全过。T9 云部署和 health/content/build-info 核对正在执行，成功后再勾选。

T9 第一次部署（来源 `4bc6ee82`）：云构建成功（40 文件），激活前归档解压出现 `tar: ./assets: Cannot unlink: Directory not empty`；尚未停止旧 API，线上来源仍为 `f70e565c`，数据库容器/启动时间不变。修复为归档普通文件列表，保持 unlink-first 解除暂存硬链接的安全机制；部署工具 5 项单测通过。接下来只重试一次，若再失败按交接 §5 标硬阻塞。
