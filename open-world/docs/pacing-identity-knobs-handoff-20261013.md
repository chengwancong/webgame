# 节奏工具三期：身份旋钮进表、机制回到可感数值、边际实测（交接给 GPT）

日期：2026-10-13　仓库：`G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world`（git 根是上一级 `abyss-walker-rewrite`）
前置文档：`docs/pacing-tool-handoff-20261010.md`（一期）、`docs/pacing-mechanics-handoff-20261012.md`（二期）
二期产物：`docs/reviews/pacing-mechanics-20261012/`（report.md、numeric-todo.md、decisions.md、B5/validation/validation.json），二期提交 `2c0e209`、`e900215`
本期进度文件：`docs/reviews/pacing-identity-20261013/progress.md`（C0 创建）
全部回复、文档、提交说明用中文。

> 二期 progress.md 写着"本期额度已用完，不要再次运行 derive/validate"——那是**二期**的额度。本期是用户批准的新一期，额度按本文第 5 节重新计算。

---

## 0. 执行方式（强制）

1. **一次跑完 C0→C7 全部批次。** 每批做完立即进入下一批，不要停下来汇报、不要问"是否继续"。
2. 只允许两种结束状态：
   - **完成**：第 9 节完成定义全部打勾（数值是否全部达标不是完成条件，见第 9 节）；
   - **硬阻塞**：遇到第 7 节列出的硬阻塞，且**其余所有能做的批次都已做完**，才可以停下，并在进度文件写清阻塞点、已做内容、恢复步骤。
3. 第 6 节默认裁决表覆盖的歧义，直接按裁决执行，记入 `docs/reviews/pacing-identity-20261013/decisions.md`（一行：时间、问题、裁决、影响文件）。表外但非硬阻塞的歧义，按"符合构筑身份、玩家能感到、描述可读、改动最小"四条原则自行决定，同样记录。
4. 每批结束更新进度文件：打勾、产物路径、实测数字、下一步的**精确**命令。中断后从进度文件恢复，不重做已完成批次。
5. **同一时间只跑一个重任务**（用户电脑会卡）：vitest 全量、validate、marginals、数据库测试、构建，不得并行；跑之前确认没有自己遗留的 node/postgres 子进程。如果物理特效铺开（`docs/physical-vfx-rollout-handoff-20261013.md`）也在进行，两边的重任务同样不得并行。
6. **不跑无头浏览器。** 本期不需要浏览器验收。
7. **严禁连接或修改 8612 正式库，不调用 8790 登录/写接口。** 数据库测试和 validate 只用临时库，沿用二期 B5 做法，跑完清理并留 `cleanup.json`。

---

## 1. 背景：二期做对了什么、卡在哪里

### 1.1 二期已完成且保留（不要回退）

- 39 条 `pacing-aspect-*` 通用规则全部删除，通用兜底 0 条；"先砍再补"补丁删除。
- `packages/content/aspect-description.ts` 数字描述 + `tests/aspect-description-consistency.test.ts`。
- 机制旋钮表 `config/json/pacing-mechanism-knobs.json`（24 条，Excel 源在 `config/excel/节奏目标.xlsx` 机制旋钮页）。
- `pnpm pacing:derive --out/--from/--apply --plan/--adjust --recenter`、`pnpm pacing:validate` 三种子 41/42/43、逐规则触发统计、动态计数、`cooldownRecovery` buff 属性。
- 规则版本已在二期升到 `ow-69`。

### 1.2 二期结果（B5 三种子中位数，括号内为目标）

| 构筑 | 预算（1.0±5%） | 最差场景 |
|---|---|---|
| 燃烧引爆 burn | 0.982 ✓ | 单体 0.662（0.9）、精英 0.505（0.95） |
| 冻结碎冰 freeze | **3.091** | 清怪 2.853（0.762）、安全 6.923（1.25） |
| 疾行游击 mobile | **2.686** | 单体 3.713（0.8）、精英 7.829（1.0）、清怪 0.521（1.048） |
| 震地旋风 quake | **0.737** | 单体 0.420（1.1）、精英 0.248（1.05） |
| 分裂箭雨 arrows | **1.432** | 单体 3.062（0.7） |
| 回响法师 echo | **1.269** | 精英 2.237（1.3）、安全 1.678（0.9） |
| 坚壁反伤 bulwark | **1.339** | 清怪 2.694（0.714）、单体 0.450（0.8） |
| 先手刺杀 opening | **2.516** | 精英 10.439（1.4）、清怪 0.305（0.714） |

升级时间线：B0 241.2 → B4（机制写入后）281.9 → B4 调整（49 项经验需求 ×240/281.9，**同时**改了旋钮）→ B5 中位数 216.85（min 197.6 / max 222.8），偏离 240 −9.6%，未达中心 ±5%。

### 1.3 根因（本期要解决的就是这 6 条）

**(a) 最大的身份杠杆不在旋钮表里。** 8 个词条的 `parts.statMultipliers.attack` 等身份参数来自构筑多样性时期（早于节奏工具），二期旋钮表没收录，推导只能动新加的小机制：

| 构筑 | 词条 | 身份参数（当前值，均在 `packages/content/aspects.json`） |
|---|---|---|
| burn | aspect-st-ember | `statMultipliers.attack` **0.65**；`overrides[atom-detonate].set.icd` 30；`flags.dotCrit`（燃烧暴击率减半） |
| freeze | aspect-st-permafrost | `statMultipliers.attack` **0.7**；`overrides[atom-chill].set["action.onStacks.duration"]` 75（2.5 秒）；`overrides[atom-shatter].mul["action.radius"]` **2** |
| mobile | aspect-mv-tailwind | `statMultipliers.attack` **3.0**；`conversions[0].ratio` 0.5 |
| quake | aspect-tf-whirl | `statMultipliers.attack` 0.9；`patches[0].ops[damage].value` **1.6** |
| arrows | aspect-tf-knife | 无攻击倍率（=1.0）；`patches[0].ops[damage].value` 0.1（单次接触预算，已在表） |
| echo | aspect-tr-tempo | `statMultipliers.attack` **3.3**；规则 `aspect-tr-tempo:30` 的 `mods.damageMult` 0.3、`every` 180 |
| bulwark | aspect-df-burst | 无攻击倍率（=1.0）；`aspect-df-burst:37` nova 1.4（已在表） |
| opening | aspect-tr-headhunter | `statMultipliers.attack` **0.4**；`healthy-hit` 阈值 0.9、增伤 0.9（增伤已在表） |

疾行 ×3.0、回响 ×3.3 直接造成单体/精英数倍超标；先手 ×0.4 配合"满血 +90%"变成一击秒精英（精英 10.4）。

**(b) 新机制被推到下限，变成摆设。** B3 把大多数新机制推到 0%，B4 再兜到下限 5%："伤害增加 5%""闪避增加 5%""冷却恢复 5%""格挡反击 5%"。玩家感觉不到，等于机制白加。

**(c) 边际是估的，不是测的。** 旋钮表 `marginal` 字段全是"局部近似：条件覆盖率×伤害/防护贡献；未追加候选战斗试跑"。B4 用估计边际一次调整，严重过冲/欠冲。

**(d) 比值是相对 8 套中位数的，构筑互相耦合。** `tools/pacing/measure.ts` 的 `summarizePacingRows`：每种子、每场景用 8 套 full 分数的中位数归一。一个构筑大改会挪动中位数，其他构筑的比值跟着变；而推导按各构筑独立计算，所以必然不收敛。好消息：各构筑**原始分数**只取决于自己的参数，且 8 套目标在每个场景的中位数恰好都是 1.0（例如清怪目标排序后中间两项 0.952、1.048），因此可以**冻结一个锚点中位数**把 8 个构筑解耦（见 M3）。

**(e) 升级重定中心和旋钮调整同时做。** B4 的经验需求缩放用的是"旋钮调整前"的 281.9 分钟，随后同批旋钮变化又让升级变快，结果落到 216.85。经验需求不影响五个战斗场景，所以升级重定中心必须**在战斗旋钮定稿之后单独做**，并且只需要测升级时间线。

**(f) 统计与描述问题。**
- 被动 buff 按"生效的每一帧"计数：`aspect-tr-headhunter-opening-critical` 在四个场景都是 91（≈3 秒×30 帧+1），`aspect-mv-tailwind-moving-evasion` 安全场景 304。应当统计"激活次数（上升沿）+ 覆盖率 + 实际使用次数"。
- 疑似失效触发：`aspect-df-burst:37`（护盾破裂爆炸）五场景合计只触发 1 次；`aspect-tr-tempo:30` 只在单体触发（每 6 秒第一次才就绪，清怪约 1.2 秒、精英约 6 秒就结束了）；`aspect-st-ember-burn` 清怪 0 次（燃烧还没跳伤怪就死了，这是目标场景标错，不是 bug）。
- 规则目标场景写死在 `tools/pacing/mechanisms.ts` 的映射表里，且有标错的。
- 描述啰嗦/错误："连续移动超过0秒时"、每条都带"（触发率100%，触发间隔0秒）"、"附加伤害0%""强度0%"；规则 `name` 是"风暴回旋 · 5%"这种数值名。

### 1.4 场景定义（只读，供理解）

`tools/pacing/measure.ts` 的 `pacingEncounters`：单体 = 1 首领（长战斗，约 50 秒）；清怪 = 12 普通怪（约 1–2 秒）；精英 = 1 精英（约 6 秒）；生存 = 3 不死精英 + 每 30 帧翻倍压力（得分=存活秒数，上限 60 秒）；安全 = 4 精英绕路线（得分 = 1/(受击次数+1)）。**本期不修改场景定义**（改场景等于换基线，属于用户决策，写进 report 的建议即可）。

### 1.5 工作区注意

工作区有 900+ 个其他会话未提交改动，其中**与本期共享的文件**已有他人改动：`packages/simulation/index.ts`、`packages/rules/index.ts`、`packages/rules/skill-patches.ts`、`packages/rules/frozen-augment-build.ts`、`packages/contracts/index.ts`（版本号所在）、`packages/content/deep-progression.ts`、`packages/content/index.ts`、`AGENTS.md`。另外 `apps/web/src/scene.ts`、`apps/web/src/qa/combat-feel.ts`、`combat-vfx.ts`、`shield-feedback.ts`、物理特效相关文件都是其他工作，**不要动**。
- 共享文件只暂存本期差量（沿用二期 B6 做法：导出本期 hunk 的 patch，`git apply --cached`），在 `C7/staged-files.json` 记录。
- 禁止 `git add -A` / `git add .`；禁止提交、回退其他会话的改动。
- C0 记录上述共享文件的哈希；每次 validate/marginals 前复核，如被他人改动，记入 decisions.md 和 report 的"混杂因素"，**不因此重跑**。

---

## 2. 已确定的决策（不可推翻）

1. 用户指定的五场景权重（清怪 0.30 / 安全 0.25 / 单体 0.20 / 精英 0.15 / 生存 0.10）、各构筑目标倍率、预算 1.0±5%、升级 240 虚拟分钟（目标带 210–270，硬上限 300，中心 ±5%）**只读**（`config/json/pacing-targets.json` 及 Excel 目标页）。
2. 二期方案 A 不变：只用有构筑身份条件的机制；**禁止无条件的 dodge/reduce/amplify**；`target_rank` 不得作为唯一条件（opening 除外）。
3. **身份参数也是旋钮，而且是主旋钮**：预算缺口主要由身份参数（攻击倍率、核心技能倍率、核心状态时长/范围）承担；新机制是"手感"，数值必须让玩家感觉得到，有设计下限（M2）。
4. 平衡方法 = 推导，但边际必须**实测**：每个旋钮一次配对扰动（M4），之后一次推导、一次验证、一次调整、一次复验；升级重定中心单独一次。禁止探索性扫参、并行候选、多轮拟合。
5. 描述写出所有**有意义**的数字，与实现一致；默认值（触发率 100%、间隔 0）不写。
6. 数值取设计步长：百分比 5% 一档，时长 0.5 秒（15 帧）一档，半径 0.5 格一档，倍率 0.05 一档，次数取整。禁止六位小数；禁止 `if(id===…)` 单构筑特例。
7. 规则版本只在 C7 统一升一次（ow-69 → ow-70）。

---

## 3. 通用模块

### M1 旋钮表扩展（数据 + 导出）

`config/json/pacing-mechanism-knobs.json` 与 Excel 机制旋钮页同步新增列（原有目标页、样式、批注差异必须为 0；`pnpm config:export` / `pnpm config:check` 通过）：

| 列 | 含义 |
|---|---|
| `role` | `identity`（身份参数）/ `mechanism`（新机制）/ `cost`（写明的代价） |
| `design` | 设计值（C2 写入的初值） |
| `floor` / `ceiling` | 推导可取的下限/上限；`mechanism` 的 floor 见 M2，推导**不得**低于 floor |
| `scenes` | 该规则的目标场景（从 `mechanisms.ts` 写死映射迁移过来并修正，供触发验收用） |
| `marginal` | C3 实测弹性（替换现在的估计值），`basis` 写 `measured:C3 seeds=41,42,43 Δ=…` |
| `scale` | `log`（乘性参数，如攻击倍率、技能倍率、半径倍率）/ `linear`（加性参数，如增伤 ratio、闪避） |

新增 `identity` 旋钮（每构筑至少 1 条攻击倍率；没有攻击倍率的 arrows、bulwark 新建 `statMultipliers.attack`=1.0）：

| 构筑 | 新增身份旋钮（路径以 aspects.json 实际结构为准） | 当前 | 步长 | 范围 |
|---|---|---|---|---|
| 全部 8 套 | `parts.statMultipliers.attack` | 见 1.3 表 | 0.05 | 0.5–1.5 |
| burn | `overrides[atom-detonate].set.icd` | 30 | 15 | 30–90 |
| freeze | `overrides[atom-chill].set["action.onStacks.duration"]` | 75 | 15 | 30–90 |
| freeze | `overrides[atom-shatter].mul["action.radius"]` | 2 | 0.25 | 1–2 |
| quake | 旋风 `patches[0]` damage mul | 1.6 | 0.1 | 1.0–2.0 |
| echo | `aspect-tr-tempo:30` `mods.damageMult` | 0.3 | 0.1 | 0.3–1.5 |
| opening | `healthy-hit` 增伤 ratio（已在表，改 role=identity） | 0.9 | 0.05 | 0.2–1.0 |

攻击倍率范围 0.5–1.5 是硬边界：疾行 3.0、回响 3.3 必须降入范围，差额由机制承担（这正是"身份做主、机制有感"）。

### M2 机制设计值与下限（数据）

新机制在 C2 统一回到设计值，旋钮 floor 如下（取设计步长）：

| 机制类型 | 设计值 | floor | ceiling |
|---|---|---|---|
| 条件增伤 amplify / buff damageMult | 20% | 15% | 60% |
| 条件闪避 dodge | 15% | 10% | 30% |
| 条件减伤 damageReduction / reduce | 20% | 10% | 45% |
| 护盾 shield（最大生命比例） | 10% | 8% | 25% |
| 冷却恢复 cooldownRecovery | 30% | 15% | 60% |
| 暴击伤害 critMultiplier | 30% | 20% | 80% |
| 反击/新星 nova（相对攻击或抵消伤害） | 50% | 30% | 150% |
| 状态时长 | 1.5 秒 | 1 秒 | 3 秒 |

推导解出的值低于 floor 时，**夹在 floor**，剩余偏差交给同构筑的 `identity` 旋钮；仍不够就记残差，禁止把机制推回 5% 或删除。

### M3 锚点解耦（代码，`tools/pacing/derive-model.ts` + `validate.ts`）

- C3 基线验证后，把"每种子、每场景的 8 套 full 原始分数中位数"冻结为 `C3/anchor.json`。
- 推导时，构筑 i 场景 s 的预测比值 = 预测原始分数 / 锚点；目标原始分数 = 目标比值 × 锚点。由于目标在每场景的中位数为 1.0，所有构筑同时达标时实时中位数 ≈ 锚点，因此可以对 8 个构筑**分别独立求解**。
- validate 报告两组比值：官方的"实时中位数比值"（验收用）和"锚点比值"（诊断用，看构筑本身离目标多远，不受他人移动影响）。

### M4 边际实测（代码，新命令 `pnpm pacing:marginals`）

- 输入：`--from=<基线验证目录>`（读 anchor 与基线原始分数）、`--out=<目录>`。
- 对旋钮表每个旋钮 k：在当前值上扰动一次 Δ = 2 个步长（`log` 型取 ×1.2 与 2 步长中较大者；已在上限则向下扰动），**只重跑该构筑**的 5 场景 × 3 种子，其余参数不变。
- 弹性：`log` 型 `e = Δln(score) / Δln(value)`；`linear` 型 `e = Δln(score) / Δvalue`。任一臂分数为 null（清场失败）时该场景弹性记 `unknown`，推导不用它控制该场景。
- 同时记录扰动臂的升级无关指标（场景时长、触发次数），用于判断非线性（例如清怪 1.2 秒内的过量伤害饱和）。
- 产物 `marginals.json`（逐旋钮×场景×种子原始分数、弹性、中位弹性），并回写旋钮表 `marginal`/`basis`。
- 每个旋钮只扰动**一次**，不做多点扫描。

### M5 推导求解器（代码，替换 `derive-model.ts` 的估计边际解）

- 对每个构筑：在旋钮步长网格上，最小化 `Σ_s w_s · (ln 预测锚点比值_s − ln 目标_s)²`，`w_s` 为用户权重；约束 floor/ceiling；预测用 C3 实测弹性的一阶模型。
- 求解用确定性离散坐标下降（固定旋钮顺序、无随机），单步最多移动该旋钮范围的 50%（防止一阶模型外推过远）。
- **可控性检查**：若某场景偏差 > tolerance，但该构筑所有旋钮在该场景的弹性与其他场景同号同量级（无法单独移动该场景），在 `derive.json` 标 `uncontrollable` 并写入 numeric-todo 的原因，不得为此临时新增机制（新增机制只能在 C2，否则 C3 弹性作废）。
- 升级时间线不在 C4 动；`--recenter` 只允许在 C6 用（见第 5 节）。

### M6 触发统计修正（代码，`measure.ts` / 模拟计数）

- 被动 buff：记录 `activations`（未生效→生效的上升沿次数）、`uptime`（生效帧/战斗帧）、`uses`（consume 型被实际消耗的次数）；被动增伤仍按实际被加成的命中计数。
- 每条规则目标场景改从旋钮表 `scenes` 读取，`mechanisms.ts` 写死映射删除。
- 每场景报告战斗时长中位数；当规则的周期/窗口（`every`、`combat_time` 阈值、icd）大于该场景时长时，报告标注"场景时长不足"，与"条件空窗/失效"区分。
- 护盾链路增加计数：`shield_gain`、`shield_break`、`shield_expire` 分别计数（用于诊断爆盾）。

### M7 触发器通用补全（代码，仅 C0 确认需要时）

- `interval` 触发新增可选字段（如 `startReady: true`）：进入战斗时第一次立即就绪，之后按 `every` 计时。按类型实现，单独写测试；默认 false，不改变现有其他规则行为。
- 其他 C0 诊断出的引擎缺口同样按"通用实现 + 单测"补，不写构筑特例。

### M8 描述清理（代码，`packages/content/aspect-description.ts` + 一致性测试）

- `chance === 1` 不写触发率；`icd === 0` 不写触发间隔；附加伤害/强度为 0 的分句不写。
- `self_state moving` 阈值为 0 时写"移动时"，不写"连续移动超过0秒时"。
- 规则 `name` 改为"词条名 · 机制名"（如"风暴回旋 · 群敌增伤""追风之力 · 移动闪避"），不再用数值做名字。
- 一致性测试相应更新：仍要求所有非默认参数以玩家单位出现在描述里、描述中每个数字都能对应参数；新增断言"描述中不出现 `触发率100%`、`触发间隔0秒`、`超过0秒`、`0%`"。

---

## 4. 各构筑默认方向（C2 内容；可在约束内微调，微调记 decisions.md）

原则：攻击倍率先降/升到 0.5–1.5 内的合理起点（下表"C2 初值"），机制回到 M2 设计值；每个构筑必须有至少一个旋钮能**单独**移动其偏差最大的场景，没有就在 C2 补一条带身份条件的机制（每词条规则总数 ≤ 原有数 + 1）。

| 构筑 | 问题 | C2 初值与默认改法 |
|---|---|---|
| burn | 单体/精英偏低，清怪偏高 | 攻击 0.65→0.8；`burning-hit` 保留 0.5（直接命中燃烧目标，偏单体/精英）；`ember-shield` 5%→10%；`spread` 3 保留（只影响清怪，是清怪的独立旋钮）；`ember-burn` 目标场景改为单体/精英 |
| freeze | 清怪、安全严重超标 | 攻击 0.7 保留；碎冰半径倍率 2→1.5；寒蚀冰冻 75→60 帧；`cold-hit` 5%→20%（偏单体）；`frost-guard` 冰冻 1.5 秒保留、伤害 5%→30%、icd 6 秒保留 |
| mobile | 单体/精英数倍超标，清怪不足 | 攻击 3.0→1.0；`dash-strike` 5%→30%；`moving-evasion` 5%→15%，描述"移动时"；**新增清怪机制**：位移后对落点周围 2 格敌人造成攻击 X% 的物理伤害（dash + nova，X 设计 50%，作为清怪独立旋钮） |
| quake | 单体/精英严重不足 | 攻击 0.9→1.2；旋风倍率 1.6 保留为旋钮；`crowd-area` 5%→20%（清怪独立旋钮）；`whirl-armor` 破甲强度保留、去掉"附加伤害0%"分句；`whirl-guard` 45% 保留（ceiling 45%） |
| arrows | 单体严重超标，清怪不足 | 新建攻击倍率 1.0；接触预算保留为旋钮；`bleeding-hit` 改为"目标处于流血**且你周围 4 格敌人 ≥3**：伤害 +20%"（清怪独立旋钮，单体不吃）；`crowd-evasion` 15% 保留 |
| echo | 精英/安全超标，单体/生存不足 | 攻击 3.3→1.2；节拍 `aspect-tr-tempo:30` 加 `startReady`（M7），增伤 0.3→0.6，必定暴击保留；`tempo-recovery` 5%→30%；`mana-shield` 5%→10% |
| bulwark | 清怪超标，单体/精英/安全不足；爆盾几乎不触发 | 新建攻击倍率 0.8；**补护盾来源**：格挡时获得最大生命 X% 护盾（block + shield，设计 10%，icd 3 秒），让"护盾破裂爆炸"真正发生（若 C0 诊断出别的原因，以诊断为准修复）；`block-counter` 改为只打攻击者（单体向，区别于清怪），5%→50%；`shield-guard` 20% 保留 |
| opening | 精英 10 倍超标，清怪严重不足 | 攻击 0.4→0.8；`healthy-hit` 90%→40%（role=identity，范围 0.2–1.0）；`opening-critical` 5%→30%；**新增清怪机制**：击杀时返还当前冷却最长技能 X% 冷却（kill + refund，设计 30%，作为清怪独立旋钮，符合"连环刺杀"身份） |

---

## 5. 批次

**C0 盘点与诊断**（不改内容，不跑 validate）
- 创建 progress.md、decisions.md；记录共享文件哈希（1.5）。
- `inventory.md`：逐条核对 1.3 表的身份参数实际路径与值；列出当前 8 词条全部规则（id、触发、动作、当前值、描述原文）。
- 诊断（读代码 + 写小型定向测试，不跑全量）：
  1. 爆盾：bulwark 构筑在各场景的护盾来源、获得/破裂/过期次数；破裂为何几乎为 0。
  2. 节拍：`interval` 计时起点；为何生存/精英 0 次。
  3. 被动 buff 计数口径（1.3(f)）。
  4. 先手 `healthy-hit` 在精英场景是否一击决定胜负（记录精英场景前 3 次命中伤害）。
- 对每个构筑写"偏差最大场景 → 能单独移动它的旋钮"对照；缺的列为 C2 必补机制。

**C1 工具代码**
- M1（旋钮表列 + Excel 同步 + 导出）、M3（锚点）、M4（`pnpm pacing:marginals`）、M5（求解器 + 可控性检查）、M6（计数修正、目标场景迁移、场景时长、护盾链路计数）、M7（如 C0 需要）、M8（描述清理）。
- `pnpm pacing:validate` 新增 `--timeline-only`：只跑三种子升级时间线，不跑战斗矩阵（C6 用）。
- 为上述写/更新 `tests/pacing-*.test.ts`、描述一致性测试、M7 单测；跑相关测试 + `npx tsc --noEmit -p tsconfig.json`。

**C2 内容**
- 按第 4 节写入 8 个词条：身份参数初值、机制设计值、必补机制、目标场景；用 M8 重新生成描述；一致性测试通过。
- 跑定向测试（构筑多样性 r6 系列、词条描述一致性、节奏工具测试）；精确数值因内容改变而变化的，按"新机制合理就更新期望并写原因"处理。
- **C2 之后到 C6 之前，不得再改任何规则结构或新增机制**（否则 C3 弹性作废）；只允许推导/调整写旋钮值。

**C3 基线 + 边际实测**（两个重任务，串行）
- `pnpm pacing:validate --out=docs/reviews/pacing-identity-20261013/C3/baseline`（三种子、240 场完整/消融 + 升级时间线），生成 `anchor.json`。
- `pnpm pacing:marginals --from=docs/reviews/pacing-identity-20261013/C3/baseline --out=docs/reviews/pacing-identity-20261013/C3/marginals`。
- 检查：每条规则在目标场景触发 > 0（被动 buff 看 activations/uptime）；为 0 的写入 decisions.md 并说明是"场景时长不足"还是"失效"。失效的不在本期再改结构，进 numeric-todo。

**C4 一次推导**
- `pnpm pacing:derive --from=docs/reviews/pacing-identity-20261013/C3/baseline --out=docs/reviews/pacing-identity-20261013/C4`：只写旋钮值，按 M5 求解，写 `changes.md`（文件、路径、前→后、依据=实测弹性与目标偏差）、`derive.json`（含 uncontrollable 列表）。
- 不改升级曲线。确认后 `--apply --plan`。

**C5 一次验证 + 一次调整**
- `pnpm pacing:validate --out=docs/reviews/pacing-identity-20261013/C5/validation`。
- 判定：8 构筑按实时中位数，预算 1.0±5%、各场景在 tolerance 内；每条规则目标场景触发 > 0。
- **只允许调整一次**：`pnpm pacing:derive --adjust --from=…/C5/validation --out=…/C5/adjust`，只动不达标构筑的旋钮值，弹性仍用 C3 实测值（可用 C3→C5 的实际位移校正一次弹性，校正公式写进 adjust.md），**不得同时改升级曲线**。`--apply --plan`。

**C6 复验 + 升级重定中心 + 全量回归**
- `pnpm pacing:validate --out=…/C6/validation`。仍不达标的构筑不再调整，写入 `numeric-todo.md`（实测中位数/min/max、锚点比值、目标、偏差、是否触及 floor/ceiling/uncontrollable、建议方向）。
- 升级：若 C6 中位数不在 240±5%，执行**唯一一次** `pnpm pacing:derive --adjust --recenter --from=…/C6/validation --out=…/C6/recenter`（只改经验需求，整数），然后 `pnpm pacing:validate --timeline-only --out=…/C6/timeline` 复测。仍不达标写 numeric-todo，不再改。报告三种子中位数和 min/max，并单列种子间离散度。
- 全量回归：`npx vitest run`（含数据库测试，临时库，留 `cleanup.json`），日志 `C6/tests.log`，要求 0 失败（失败按"测试过期 / 内容改坏 / 真缺陷"分类处理，不得删测试或 skip）。
- `npx tsc --noEmit -p tsconfig.json` 通过；正式构建通过，正式包无节奏实验入口（沿用二期 B5 检查）。

**C7 收尾与提交**
- 规则版本 ow-69 → ow-70（一次）。
- `report.md`：8 构筑最终描述原文 + 规则 id；身份参数与机制值前后对照表；C3/C5/C6 结果表（实时中位数比值、锚点比值、min/max）；实测弹性表；触发表（activations/uptime/uses、场景时长）；升级时间线；残差；场景定义的改进建议（只建议，不改）；工具用法。
- `AGENTS.md` 加一行本期决策与入口（共享文件，只暂存本期 hunk）。
- 只提交本期文件，提交说明以 `pacing-identity:` 开头，可每批一个提交；`C7/staged-files.json`、`C7/commit.json`、`C7/cleanup.json` 留档。

---

## 6. 默认裁决表

| 歧义 | 裁决 |
|---|---|
| 推导要求机制低于 floor | 夹在 floor，剩余交给同构筑 identity 旋钮，记录 |
| 推导要求攻击倍率超出 0.5–1.5 | 夹在边界，剩余由机制旋钮承担；仍不够记残差，不扩范围 |
| C0 发现某个身份参数路径与 1.3 表不同 | 以实际为准，写 inventory 与 decisions |
| 爆盾诊断结果不是"缺护盾来源" | 按诊断修复（通用实现 + 测试），第 4 节"格挡获得护盾"可不做 |
| `startReady` 改动影响其他使用 interval 的规则 | 默认 false，只在节拍规则上打开；其他规则行为必须不变（加回归测试） |
| 某场景弹性为 unknown（失败样本） | 该旋钮不用于控制该场景；在 derive.json 记录 |
| 扰动后分数无变化（弹性 ≈ 0） | 记录为"无效旋钮"，推导不移动它；报告列出 |
| 一阶预测与 C5 实测偏差大 | 只在 C5 adjust 时按实际位移校正一次弹性，写公式；不再追加测量 |
| 新机制让现有测试精确数值变化 | 合理就更新期望并写原因；若是残留通用倍率导致，修内容 |
| 共享文件被他人在本期中途改动 | 记录为混杂因素，不重跑，不回退他人改动 |
| validate / marginals 耗时长 | 照跑，不缩样、不减种子；期间不启动其他重任务 |
| 文案拿不准 | 遵守 `docs/copy-voice-handoff-20261009.md`；数字用 %、秒、格 |
| 测试需要数据库而临时库起不来 | 先按二期 B5 临时库脚本排查；仍不行算硬阻塞，但先做完其他批次 |

---

## 7. 硬阻塞（只有这些可以停）

1. 需要修改用户指定的权重、构筑目标倍率、升级目标，或修改五个场景定义。
2. 需要删除或合并某个构筑，或推翻方案 A。
3. 可能造成数据丢失：需要动 8612 正式库，或需要清空非临时数据。
4. 需要改鉴权、版本协议、反作弊判定（会误伤玩家）。
5. 需要新美术资源且没有任何现有管线能生成。

---

## 8. 禁止事项

- 禁止无条件的 dodge / reduce / amplify；禁止把机制推回 5% 摆设值或删掉机制来凑数。
- 禁止六位小数；禁止 `if(id===…)` 单构筑特例；禁止旋钮表以外的手工调数。
- 禁止估计边际（旋钮表 `basis` 不得再出现"局部近似"）；禁止多点扫描、并行候选、多轮拟合；每旋钮只扰动一次。
- 禁止在同一次调整里同时改战斗旋钮和升级曲线。
- 禁止 C2 之后修改规则结构/新增机制（C6 之前）。
- 禁止为过测试改断言、删测试、`.skip`/`.only`；禁止占位实现；禁止缩减构筑数、技能数、种子数、样本数。
- 禁止模糊描述、描述与实现不一致。
- 禁止并行重任务；禁止无头浏览器；禁止连接 8612 或调用 8790 写接口。
- 禁止 `git add -A` / `git add .`；禁止提交或回退其他会话的改动。

---

## 9. 完成定义

数值全部达标**不是**完成条件；完成条件是流程与软件全部到位、数值结果如实报告。本期期望（用于自查，不达成要在 report 中逐条解释原因）：≥6/8 构筑预算在 1.0±5%，升级中位数在 240±5%，所有机制目标场景触发 > 0。

- [ ] C0：inventory.md（身份参数实际路径/值、全部规则清单）；爆盾/节拍/计数/先手四项诊断有结论；"偏差场景→独立旋钮"对照表
- [ ] C1：旋钮表新列 + Excel 同步；锚点；`pacing:marginals`；求解器 + 可控性检查；计数修正（activations/uptime/uses、护盾链路、场景时长）；目标场景迁移出 mechanisms.ts；`--timeline-only`；描述清理；相关测试与 tsc 通过
- [ ] C2：8 词条身份参数初值、机制设计值、必补机制写入；描述无"触发率100%/触发间隔0秒/超过0秒/0%"；一致性测试通过
- [ ] C3：三种子基线 + anchor.json；每旋钮一次扰动的实测弹性写回旋钮表
- [ ] C4：一次推导，changes.md 每处改动有实测依据；uncontrollable 已列出
- [ ] C5：一次验证；只调整一次（不含升级曲线），adjust.md 留档
- [ ] C6：复验；升级重定中心至多一次 + timeline-only 复测；残差写 numeric-todo.md；全量 vitest 0 失败（临时库已清理）；tsc 通过；正式构建通过、无实验入口
- [ ] C7：规则版本升一次；report.md、AGENTS.md 更新；只提交本期相关文件
- [ ] 全程：decisions.md 记录所有裁决；progress.md 可直接恢复
