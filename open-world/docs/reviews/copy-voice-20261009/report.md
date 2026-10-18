# 游戏文案与界面直观性改造验收

验收日期：2026-10-10（Asia/Shanghai）。B1–B5 已完成。界面、文案、生产登录与长流程回归均已核验。

## 改动与画面对照

| 界面 | 改前 | 改后 | 改前画面 | 改后画面 |
|---|---|---|---|---|
| 岛首领失败 | 列举受击与测量数据，建议只是一段文字 | 只讲最后一击；最多三个建议按钮；具体碎片和掉落地点 | [改前](evidence/before-failure-island.png) | [改后](evidence/after-failure-island.png) |
| 地城前段失败 | 输出秒数、事件记录、占比、DPS 等诊断文字 | 敌人、招式、伤害、状态标签和行为提示；真实页面建议 | [改前](evidence/before-failure-dungeon.png) | [改后](evidence/after-failure-dungeon.png) |
| 成功结算 | 成功收获与返回操作 | 保留收获、具体钥匙进度；再来一次 / 回港整备 | [改前](evidence/before-success.png) | [改后](evidence/after-success.png) |
| 海域难度 | 旧提交未挂载世界层级控件，区域地图仍是原入口位置 | 独立面板，危险/奖励星级、真实解锁条件、罗马数字档名 | [旧区域地图](evidence/before-sea-difficulty.png) | [海域难度](evidence/after-sea-difficulty.png) · [锁定档](evidence/after-sea-difficulty-locked.png) · [详情展开](evidence/after-sea-difficulty-expanded.png) |
| 装备对比 | 属性行模板未正确插值，缺少明确总评 | 实际差值用绿 ▲ / 红 ▼，零变化用 —；服务端总评 | [改前](evidence/before-equipment-compare.png) | [改后](evidence/after-equipment-compare.png) |
| 装备 Tips | 阶段钥匙产物、普通随机传说等术语 | 钥匙制作 / 掉落传说；属性箭头与总评共用 | [改前](evidence/before-equipment-tip.png) | [改后](evidence/after-equipment-tip.png) |
| 钥匙配方 | 阶段用途、机制方向、同强化对比等长段说明 | 一句话用途；具体碎片名和 x/y；各部位同等级比较、制作后的真实等级可展开 | [改前](evidence/before-key-recipe.png) · [预览](evidence/before-key-preview.png) | [改后](evidence/after-key-recipe.png) · [预览](evidence/after-key-preview.png) |
| 地城目录 | 实时作战、1至1人、阶段等系统文字 | 单人不列人数；组队保留实际人数与职责 | [改前](evidence/before-dungeons.png) | [改后](evidence/after-dungeons.png) |
| 航图 | 阶段目标与内部难度说法 | 当前目标、海域难度入口 | [改前](evidence/before-chart.png) | [改后](evidence/after-chart.png) |
| HUD 引导 | 长任务目标直接占据 HUD | 短行动提示；完整原目标保留在 Tooltip 和任务页 | [改前](evidence/before-hud.png) | [改后](evidence/after-hud.png) |
| Toast | 既有副本运行提示；忙态有泛化文字 | 忙态按动作表达；保留副本不会暂停的事实提示 | [改前](evidence/before-toast.png) | [改后](evidence/after-toast.png) · [换海提示](evidence/after-sea-toast.png) |
| 任务页 | 处理中、领取待确认、查看刚入档任务 | 领取中、待确认、看新任务；任务和对白仍来自 Excel 导出 | [改前](evidence/before-tasks.png) | [改后](evidence/after-tasks.png) |
| 满包 | 真实数量可能超过容量 | 保留真实数量，明确提示回港整理 | [改前 HUD](evidence/before-hud-full.png) · [行囊](evidence/before-bag-full.png) | [改后 HUD](evidence/after-hud-full.png) · [行囊](evidence/after-bag-full.png) |
| 设置 | 既有公共设置界面 | 沿用公共控件与样式，系统提示按动作表达 | [改前](evidence/before-settings.png) | [改后](evidence/after-settings.png) |

## 验证范围和边界

- 可见 Chrome，`headless:false`，固定 1280×720；独立临时 PostgreSQL，改前、改后和回归分库。正式 8612 没有用于验收登录或读写存档。
- 界面样本通过隔离角色设置等级、装备、已有解锁和初始背包数量。胜负、奖励和再次入场仍由真实 API / WebSocket / 战斗执行器完成。这些样本用于界面验收，不代表自然养成速度。
- 副本已确认奖励按现有规则直接入包，因此可超过普通拾取容量；界面显示真实数量，不截成 60/60。野外满包停止全自动和主动整理的原规则保留。
- 改前以 `7956a4f` 的界面、诊断和相应契约为基础，使用当前必要运行资源；任务列表保留现有接口兼容并反转本批系统文案。它不是整个项目的完整历史运行快照。
- 旧提交虽有 `world-tier-view.ts`，`presentation.ts` 没有调用它。报告使用真实旧区域地图作入口对照；没有伪造旧难度面板的锁定/展开截图。旧倍率长句由旧 API 字段 `worldTierChoices.hint` 核对。
- `对话.xlsx` 只读核对确认仅“对话!E8、E64”两个单元格文本变化，其余单元格值和公式、页签顺序、合并区域一致；已有保存过程改变了样式 XML 的部分应用标志，不能据此声称文件字节和样式序列化完全相同。配置导出一致性另行检查。

## 待用户选样

无。没有新增美术需求或需要改变游戏数值才能解决的界面问题。

## 检查与提交

| 检查 | 结果 | 证据 |
|---|---|---|
| 文案盘点 | 7,309 条，禁用词 0；按钮/HUD/Toast/配方用途超长 0；普通文案白名单为空 | [盘点](inventory.md) · [检查](copy-final.log) |
| 改前 GUI | 13 项界面检查 + 8 项战斗检查 + 3 项钥匙区域补拍 | [界面](before-ui-browser.json) · [战斗](before-battles-browser.json) · [钥匙](before-keys-browser.json) |
| 改后 GUI | 20 项界面检查 + 12 项战斗检查 + 5 项钥匙/Toast 补拍，禁用词及操作按钮超长均为 0 | [界面](after-ui-browser.json) · [战斗](after-battles-browser.json) · [补拍](after-keys-browser.json) |
| 生产 GUI | 3 项检查通过；原角色 ID 和 67 件装备保留，刷新恢复会话 | [记录](after-production-browser.json) · [画面](evidence/after-production-session-restored.png) |
| 类型检查 | 通过 | [日志](typecheck-final.log) |
| Excel 导出 / 一致性 | 6 本工作簿一致 | [导出](config-export-final.log) · [校验](config-check-final.log) |
| 内容 | 通过；敌人招式 hint 118/118，缺 0 | [日志](content-final.log) |
| 公共 Token | 320 项检查通过 | [日志](tokens-final.log) |
| 完整回归 | 共覆盖 217 个测试文件（分批执行）；第一轮 215 文件中的 22 条旧文案/新增字段失败项修复后，29 文件 260 条定向复验全部通过 | [完整记录](regression-short.log) · [最终复验](regression-repaired-final.log) |
| HUD 同步补修 | 4 文件 24 条通过；其他操作同步时不伪报整理忙态 | [日志](hud-final.log) |
| 自然日程：不接任务 | 从 1 到 50 级、六岛首领、467 个真实事件，失败 0；原时限内通过 | [日志](calendar-no-quests-final.log) · [结果](calendar-no-quests-result.json) |
| 自然日程：尝试任务 | 从 1 到 50 级、六岛首领、470 个真实事件；完成 3 个任务，并非全任务通关 | [日志](calendar-tasks-final.log) · [结果](calendar-tasks-result.json) |
| 全任务长流程 | 175/175 完成；自然角色完成 174 项，剩余 1 项单独用合法既成装备验证可达性 | [最终日志](earned-quests-final.log) · [结果](earned-quests-result.json) |
| 临时环境清理 | 临时 PostgreSQL、API、Vite 和 helper 均已停止；临时目录移除，正式预览及原资源可访问 | [清理](cleanup.json) |
| pnpm build | 独立源码/素材副本完整构建通过，保留既有大 chunk 提示 | [日志](build-isolated-final.log) |
| 版本一致性 | client 0.11.23 / protocol 33 / rules ow-63 / assets world-art-20261007-v24-world-runtime / db 16 | [生产记录](after-production-browser.json) · [正式预览只读检查](local-version-read.json) |

完整回归中两条既有跳过是旧六区 melee/ranged 日程，原因已写在 campaign-balance.test.ts 中；本批没有新增跳过或放宽战斗/测试时限。两个自然日程策略均从 1 级到 50 级。全任务长流程的自然结果与合法既成装备可达性分别保留；没有把界面受控装备当作自然成长。

第一次在原目录构建时，Windows 预览占用了资源目录，发布器保留原资源并失败退出。随后复制源码、素材、配置及文档，在没有预览锁的隔离目录完整重跑同一条 pnpm build。没有跳过资源发布检查，也没有关闭正式预览。

提交：7956a4f（B1）、ec146cd（B2）、78355f7（B3）、19aa796（B4）、c981e1b（B4 的 HUD 同步补修）；B5 为本报告、验收工具与证据所在提交。

原有技能分系/天赋四树/美术等未提交工作保留。新技能册的主手加成说明依附原有未提交布局，已在工作区改成短主句和折叠数值；没有代为提交整套布局。续做位置见 [progress.md](progress.md)。


全任务驱动首轮曾将终局之后才到达的自动模式输入误判为服务故障。测试现在仅在读取持久结局并确认地城已经结束后接受 DUNGEON_CLOSED，其他拒绝仍失败；实际失败地城仍记作失败，没有改变服务端规则、结局或奖励。完整重跑通过，首轮记录保留在 [earned-quests-first.log](earned-quests-first.log)。

白名单：terms = []，lengthExceptions = []。短招式提示同时由契约、内容检查与定向测试约束（≤20 字）；状态小标签按既有状态名展示。配方说明补扫包括三份终局配方，均不超过 30 字。
