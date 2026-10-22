# HUB-B0～B4 后端进度

依据：backend-B0-B4.md，2026-10-21。顺序 B0 → B1 → B2 → B3 → S → B4；未完成项不标待验收。

## 开工与在途交接

- [x] 完整阅读交接文档；任务队列已通过官方局部工具领取。
- [x] HEX/COPY/P42/P55 在途实现保留并在协作中心明确移交原任务维护。本聊天此前仅修改 UX 测试结论，没有自有 HEX 实现。HUB 不把现有 dirty 当作自己的提交；本地工作区、索引补丁与状态在 `.runtime/hub-b0-b4-20261021/`。
- [x] 依赖复核发现HUB直接依赖原HEX未跟踪代码，因此将可精确重建的开工前后端基线单独提交为 `f44c178c`（92路径，HEX/P27/P28/COPY/P42/P55原有混合在途状态）；候选树逐blob核对，两个XLSX用原Git binary patch恢复。没有HUB/前端/设计/UX/原始证据差量，工作区文件未覆盖。该提交仅保留原工作，不宣布原任务验收完成。
- [ ] HUB 差量按批独立提交；每次提交核对不含 apps/web、已有其他任务差量和原始证据。

## B0 冻结与基线

- [x] 三个新增开关及服务端拒绝/公开状态，默认 false；snapshot/content 均下发九开关，公共地区和权威活动关闭自动疾跑。
- [x] 九开关旧入口覆盖与新角色阻断清单：旧 permit 新开局、location/safe 非港口、quest arrive/start/gate/waypoint、plane/interact、野外 gather、旧 camp/patrol/bounty/event，以及非节点 field/plane/story/normal 副本新建；旧回执重放和旧实例结算保留。新号原先会在开场后旧岛屿 permit 被挡；B1/B2 已改新流程结束开场返港、星门 node_id 出发，不借 skipped-by-freeze 通过。
- [x] spine:check 基线命令退出1：0.11.47 / protocol49 / ow-90 / db18，预算546项、outside156（numeric150、unknown6），稳定性失败10，源漂移52，已接受历史基线新增regressions为空；原始 `.runtime/hub-b0-b4-20261021/spine-baseline/check-summary.json`，不把原文档的151当成实时值。
- [x] 整库备份 dry-run、完整pg_restore对账、并发连接拒绝清档、保留账号清角色与db19标记，均在自有临时库跑通。测试备份 `hub-2026-10-21T06-39-49.687Z-f479b3de-afdf-4cf4-876f-566f487b0a2c.dump`，SHA256 `d24ccddab5422368054335e1824c1c5ec4293323ff8bb04aa658616f75bfdddb`；这不是常驻库S备份。
- [ ] 类型/内容/config/定向测试、健康与真实登录验证。

## B1 星门航图

- [x] 航图工作簿、20节点及五个锁定航区骨架；9本工作簿export/check通过，原628条对白逐字段不变。
- [x] hub.ts 固定字段契约与 chart/sea-tier/return-ack，通用validateResponse已接所有HUB真实响应。
- [x] 节点解锁、首通/每日计数、出发验证与冻结、奖励及回港队列；真实PG并发/每日/锁/残页/20节点事实顺序通过（教学条件为fixture，不冒充自然通关）；数值为D4零值待B4。
- [x] 港口星门(14,18)、回港(14,20)连通；全部67个解析副本返回拾星港。任务工作簿改挂及60条委托目标文案已导出/校验；原对白保持不变。
- [ ] 批次验证与提交。

## B2 副本模板

- [x] 六剧情、怪潮、狩猎、寻宝、巢穴/关口统一外壳与目标已实现；功能单测及真实PG通过，完整自然路线仍在验收。
- [x] 分段事实与分支、三选一自动选择、全自动出口已实现；8秒选卡与寻宝超时成功通过真实PG。
- [x] 实例采集、三种残页、掉落映射、hub结算及重试已实现；系统中断退款防重、普通失败不退款、Q03成功出口边界和重连保留通过。
- [ ] 批次验证与提交。

## B3 局外

- [x] 建筑声望/领取、派遣/快速收益、委托/累计次数、今日视图代码与第一轮真实PG通过；新捐献/配方售价及全来源数值仍待B4。
- [x] 角色模式记忆、旧悬赏冻结隔离代码和单测通过；节点实际模式链路纳入B2验收。
- [ ] 批次验证与提交。

## S 切换（B3验收之后）

- [ ] 核对其他会话及常驻库运行实例。
- [ ] 整库备份，记录文件名、SHA256及恢复验证。
- [ ] 打开九开关 → 清角色保留账号 → db19。
- [ ] 重启、版本对齐、真实登录进港并出发剧情1。
- [ ] 协作中心发布 HUB-S 已切换消息。

## B4 数值

- [ ] 主干推导工具与工作簿/JSON奖励产出。
- [ ] N1/2/3/4/5/6/7/8/10一次推导及验证，最多一次裁决调整。
- [ ] 收益/日常/7日残页/找回漂移断言及真实残差报告。
- [ ] 全流程验收、批次提交、协作中心待Claude验收。

## 集成验证与当前恢复点

- 用户追加授权模块化子代理：hub_b1负责B1/工作簿/B4工具准备，hub_b2负责B2/runtime/autopilot，hub_b3负责B3；root负责共享入口、B0、安全切换和整体验收。所有重任务仍按root发放时段串行。
- 首轮集成tsc通过；`node tools/hub-backend-test.mjs ...` 的9文件52项通过，含真实PG、真实WebSocket、8秒自动选卡、寻宝计时结算、retry扣残页和外观。之后新增坏账回滚、会话回港去重、Q03成功边界、材料包及预算缩放等差量，必须再跑，不能沿用52项宣称新差量已验。
- 三武器服务端autopilot preflight已通过：新账号真实HTTP登录→原开场命令→港口→风栖剧情1 create/ready/start→leave，零首通/每日计数且无skipped；尚非20节点自然通关。
- 常驻后台已自动同步到client0.11.47 / protocol50 / rules ow-91 / assets v24 / db18，health/content一致，九开关仍全false。
- 已确认MU进程未运行后，用真实Chrome完成退出/登录测试号→返回拾星港→航图七航区/风栖十节点→今日10/10与05:00→三建筑/收藏的真实接口GUI。最后重载后控制台新增error=[]；已退出账号、关闭本聊天创建的测试标签页。截图在 `.runtime/hub-b0-b4-20261021/gui/`，不提交。
- GUI发现并已修：共享starsea材料包引入服务端node:crypto造成白屏；HUB路径漏注册validateResponse导致“数据不兼容”。均修后真实GUI验证，非通过关闭校验绕过。
- 当前合并回归10文件70项通过：真实PG首通/每日/ACK归档、系统退款、Q03出口边界、重连不补血不重刷、局外与模型；该次命令误带了不存在的appearance.test.ts（未计入70项），外观已有独立appearance-rules.test.ts九项通过，最终差量需用正确路径复核。原始integrated-current.log仅留本地。
- 自然三路线已排除两种工具策略缺陷（守护中反复点信标、战斗中直奔箱子），中断样本保留不计数值失败。修后剑/杖首巢穴反复失败并真实成长至L8，暗器通过巢穴1/2至L9；等级7/14是B4目标而非功能测试停止条件，后续完整路线只保留时间与尝试次数上限，超标如实记录，未改游戏数值。
- S默认只读预检通过：常驻库db18，九开关false，活动控制/副本/野外均0，4条idle连接逐条映射到托管API进程；S工具未apply。临时库最新安全验证还包含数据库归属与同份备份完整恢复核对，b0-safety-final.log留本地；不把临时库备份当常驻库备份。
- **S 已执行（2026-10-22，Claude 按用户指示代为执行）**：本机常驻库由 `tools/hub-switch.mjs --apply` 完成（备份 `.runtime/backups/hub-2026-10-22T03-08-23.032Z-*.dump`，已做完整还原验证；24 个账号保留、角色清零、db19、九个冻结全开；回执见工具输出）。源码提交 `f45b3498`。测试服：部署 f45b3498 后停 API → backup.sh 备份并还原到临时库逐表核对 → 清空账号外全部表、schema 19 → API healthy；15 个账号保留；S 前备份另存 `~/abyss/backups/hub-s-before-20261022T031220Z.sql.gz`（sha256 727fff0f…，不在 7 天轮换内）。真机流程（登录→开场→港口→星门→风栖剧情1）交 Grok G1–G3。**B4 现在可以开始**。
- 原后端基线已独立提交 `f44c178c`，HUB提交仍待本轮验收。父提交为Claude的 `951531df`，未回退其前端更新；本聊天始终未修改apps/web。
- 最新跨模块审查修复（尚未运行回归）：节点/回港实际完成的side任务增加邮局声望；HUB及S后的旧团本、赛季、保留野外结算均停止增长旧六阵营声望；createApp统一注入hubNumbers到公共钩子、捐献、航图、局外和副本结算，B4前仍pending；main及autopilot现已静态接入统一真实配置加载器，实际产物应用后仍须运行验收。
- 自动驾驶v2d在疑似MU出现时中止并清理自有临时库：剑35个已结束实例4成功31失败；巢穴1累计643.833游戏秒后L13通关，巢穴2两次失败；杖/暗器该轮未开始。未完场不算完成，原始本地interrupted记录保留。按实际可用等级/费用准备的v3策略已写但未运行。
- 运行约束已确认：用户明确答复“MU正在运行，先做不受影响的工作”。按§0.6暂缓游戏自动驾驶、GUI和新增重探针；继续静态审查、只读配置一致性核对与测试准备。常驻库未清档，S/B4未执行，任务不标待Claude验收。

### MU运行期间已完成的静态工作

- 只读`python -X utf8 tools/config-export.py --check`通过，9本工作簿与JSON/运行时镜像一致；未重新导出或写表。
- 收口后对71个变更TS/MJS文件做纯语法解析通过，git diff --check通过（无模块导入/执行、无类型检查）。这不能替代tsc或功能测试。
- 关口检查现在消费服务端已完成动作事实，避免卸下◆装备/退还天赋后误锁关口；新增针对历史事实的单测待运行。
- 新增server-only `hub-numbers.ts`，main及autopilot使用同一实际工作簿收益加载器。仅全节点pending且无正式文件时允许pending；部分应用拒绝启动，避免正式预算混用零占位。已准备接线，实际B4文件尚未产出。
- S工具重启后重新核对resident归属、原数据库identity及SQL schema版本；同份备份的恢复proof在破坏性事务之前持久化，以覆盖COMMIT成功但响应丢失的分支。新增安全验证断言待临时库运行。
- 自动驾驶达到时限后不再无限等已关闭WS的旧帧；退出响应与最终查询有界。测试补了原始WS/HTTP私有字段检查及开启冻结后旧回执保留；仅静态审查。
- B4工具已完成静态修复：实际数值指纹与应用计划身份校验、限定HEX概率写入范围、本地原始证据路径、首通文案与工作簿精确一致，以及按计划hash分别保留三工作簿指纹/备份/预览（初始与correction不覆盖）。尚未运行apply或对应回归。
- N3须分离普通掉落和保底统计，混合统计不能冒充普通HEX小时率；当前缺改版前同口径自然小时基线，保持未测。N10明确为两航区/一槽已解锁后的七日稳态经济情景，起始残页库存0；不冒充N4新号流程，不使用未开放节点/深潮补给保证通过。
- 本轮最后只读health/content版本完全一致：client0.11.47、protocol50、rules ow-91、assets v24、db18，九开关false。没有执行GUI/自动驾驶、PG回归、S或B4数值推导；HUB差量尚未提交。

### Claude 后端补齐（2026-10-21 晚，MU 运行中，仅自有临时库）

- 恢复顺序第2步已完成：主tsc、autopilot工具tsc、config:check、content校验全部通过。
- 新增：寻宝开箱读条下发。`hubDungeonPublic.opening{id,left,total}`（contracts），runtime导出`HUB_CHEST_OPEN_SECONDS=2`，`finishHubChest`与公开帧共用；前端HUD显示「开箱中」进度条。前端多余的模式偏好写接口已删除（服务端在副本内`{kind:'mode'}`输入时已持久化并在开局应用）。
- 第3步定向回归（`tools/hub-backend-test.mjs`，串行）：单元 hub-chart/hub-dungeon-hex/hub-field-freeze/hub-outside/hub-reward-model/appearance-rules/field-freeze-gate/build-variety-augment-panel 63项、hub-dungeon-runtime 8项、hub-panels 69项通过；PG hub-dungeon-instance 5、hub-outside.database 6、hub-chart-database 11、hub-b0.database 2、hub-faction-freeze 2 通过；`tools/hub-b0-verify.mjs` passed（临时库清档+同份备份完整恢复）。原始日志`.runtime/hub-b0-b4-20261021/claude-*.log`只留本地。
- 修的测试缺陷（非业务）：hub-faction-freeze 用户名含UUID连字符被登录正则拒（改去连字符并断言登录/建角200）；field-freeze 开关数断言仍写6个（改为与`parseFieldFreeze()`默认值比较，现9个）。
- hub-port-economy.database：`hub-outside-numbers.json`由B4产出，文件不存在时3项标skip（不算通过），文件一出现即强制真实运行。
- 非HUB遗留（2026-10-22已清）：field-freeze「HEX-A05」改为HEX词缀装备（与hex-affix.database同工厂的受控背包）走`gear/equip`，验证世界活动进行中换装被`FIELD_BUILD_LOCKED`拒、旧回执重放不变、领奖后可换且新武器HEX生效；hex-runes.database本就是D13退役的历史文件（整份skip），保持不动。field-freeze偶发409根因：三个app的100ms后台执行器能在两次请求之间把1血单波事件打完，冻结端随后报FIELD_FROZEN；测试事件改为两波（第2波15秒才出），连跑3次8/8，tsc通过。
- 仍阻塞（需MU关闭）：v3自然三武器autopilot、S、B4、真实GUI。HUB差量未提交。

### 恢复顺序（最新差量未验证）

1. 用户确认MU已关闭后恢复自动化；所有重任务依旧串行。本轮MU运行状态已确认，无需重复询问是否运行。
2. ~~主tsc、工具tsc、config:check与完整content校验~~（2026-10-21 Claude已过）。
3. 定向回归（2026-10-21 Claude已过，见上节；hub-port-economy待B4）包含hub-b0.database（新增赛季冻结/重放）、hub-chart-database（新增支线声望/重放）、hub-faction-freeze.database（新非HUB击杀/raid两路径、false/true/缺省）、hub-dungeon-instance（补HUB旧声望不增）、hub-outside两文件、hub-chart/runtime/hex/field-freeze、hub-reward-model（现8项）、appearance-rules。不能沿用旧70项结果覆盖新增测试。
4. 运行v3自然三武器流程（按当前等级与可负担报价准备，无资源注入），记录全部20节点、首通/每日/回港队列和失败；之后提交通过验证的HUB差量。
5. 重新核对协作与常驻库，执行S严格顺序；真实GUI完成新号开场→港口→星门→剧情1后才发HUB-S消息。
6. S后才执行B4真实测量→一次推导→写工作簿→导出/check。main/自动驾驶统一加载器已静态接好；实际应用后验证各港口消费链路、真实重载/登录、工作簿批注持久化与实际数值指纹，执行最终数值验证与spine残差报告。最多一次默认修正。
