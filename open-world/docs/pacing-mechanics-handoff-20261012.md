# 节奏工具二期：把通用倍率换成构筑机制（交接给 GPT）

日期：2026-10-12　仓库：`G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world`
前置文档：`docs/pacing-tool-handoff-20261010.md`（一期 P0–P5），一期进度 `docs/reviews/pacing-tool-20261010/progress.md`
本期进度文件：`docs/reviews/pacing-mechanics-20261012/progress.md`（B0 创建）
全部回复、文档、提交说明用中文。

---

## 0. 执行方式（强制）

1. **一次跑完 B0→B6 全部批次。** 每批做完立即进入下一批，不要停下来汇报、不要问"是否继续"。
2. 只允许两种结束状态：
   - **完成**：第 9 节完成定义全部打勾；
   - **硬阻塞**：遇到第 7 节列出的硬阻塞，且**其余所有能做的批次都已做完**，才可以停下，并在进度文件写清阻塞点、已做内容、恢复步骤。
3. 遇到第 6 节默认裁决表里覆盖的歧义，直接按裁决执行，并把这条裁决记进 `docs/reviews/pacing-mechanics-20261012/decisions.md`（一行：时间、问题、采用的裁决、影响文件）。不在表里但不属于硬阻塞的歧义，自行按"符合构筑身份、描述可读、改动最小"三条原则决定，同样记入 decisions.md。
4. 每批结束更新进度文件：打勾、产物路径、实测数字、下一步的**精确**命令。中断后从进度文件恢复，不重做已完成批次。
5. **同一时间只跑一个重任务**（用户电脑会卡）：vitest 全量、validate、数据库测试、构建，不得并行；跑之前确认没有自己遗留的 node/postgres 子进程。
6. **不跑无头浏览器**（headless/swiftshader 会把 CPU 打满）。本期不需要浏览器验收。
7. **严禁连接或修改 8612 正式库。** 数据库测试和 validate 只用临时库，沿用一期 P5 的临时库做法（见一期 progress.md 与 `docs/reviews/pacing-tool-20261010/P5-regression/`），跑完清理并留 `cleanup.json`。

---

## 1. 背景：一期留下了什么问题

一期工具把升级时间线调到了 236.9 虚拟分钟（目标 240，通过），但构筑平衡是靠**往构筑词条上缝通用倍率**凑出来的，违反了一期文档"优先用构筑机制、通用属性标红"的要求。用户已裁决：**换成有条件的构筑机制**（方案 A）。

### 1.1 盘点：8 个构筑词条上被注入的东西（当前 `packages/content/aspects.json`）

| 构筑 | 词条 | 原始机制（改动前描述） | 被注入的通用规则 | 被注入的"先砍再补"补丁 |
|---|---|---|---|---|
| 燃烧引爆 burn（法杖） | aspect-st-ember 余烬之心 | 燃烧可以暴击（暴击率减半）；燃烧伤害 ×1.2；攻击×0.65 | 对首领/精英易伤25%；对首领 +107.5%、精英 +158.7%、**普通 +16.4%** 增伤；**无条件闪避 +33.9%** | 火球/陨石/余烬伤害 ×0.583；火球冷却 ×0.686 |
| 冻结碎冰 freeze（法杖） | aspect-st-permafrost 永冻 | 冻结时间 +1 秒；碎冰范围 ×2；攻击×0.7 | 首领 +33.4%、精英 +61.9% 增伤；**无条件减伤 37.7%**；**无条件闪避 +32.5%**；冻结/减速时长倍率 0.28/0.53 | 冰霜/新星/冰箭伤害 ×0.768 |
| 疾行游击 mobile（暗器） | aspect-mv-tailwind 追风之力 | 移速加成的 50% 转为类型池伤害加成；攻击×3 | 精英 +68.3%、首领 +17.2%；普通怪≥4只时留刃阵 | **影步/影刃/刃舞伤害 ×0.427**；影步冷却 ×1.686（描述未写） |
| 震地旋风 quake（斧） | aspect-tf-whirl 风暴回旋 | 旋风改 4 段跟随、移动不打断；锤/斧可用；攻击×0.9 | 首领/精英易伤；首领 +120.8%、**精英 +251%**；**无条件减伤 35.7%**；**无条件闪避 +34.4%** | 旋风/地裂/劈砍 ×0.936 |
| 分裂箭雨 arrows（暗器） | aspect-tf-knife 环刃 | 飞刀环绕 3 秒，接触半径1格，每 0.5 秒一次，单次接触 9.5% 预算 | 精英 +243.6%、**普通 +411.7%**、首领 +3%；**无条件减伤 31.7%**；**无条件闪避 +46.2%** | 飞刀/扇刃/刃舞伤害 **×0.240** |
| 回响法师 echo（法杖/魔杖） | aspect-tr-tempo 节拍 | 每 6 秒，下一个技能 ×1.5 且必定暴击；攻击×3.3 | 首领 +138%、普通 +22.8%；**无条件减伤 23.7%** | 奥术飞弹/重力井/静电场 ×0.563 再 ×0.913 |
| 坚壁反伤 bulwark（锤） | aspect-df-burst 爆盾 | 护盾破裂时爆炸，伤害 = 护盾值 150%（半径 3） | 首领/精英易伤；首领 +71.8%、精英 +78.1%；**无条件减伤 32.1%**；**无条件闪避 +48.4%**（描述写"转移时避开追击"，实际无条件）；持盾 +18.9% 增伤 | 地裂/暴走 ×0.825 |
| 先手刺杀 opening（剑） | aspect-tr-headhunter 猎首 | 击杀精英或首领时，所有技能冷却重置；攻击×0.4 | 首领 +52.2%；普通怪≥4只时留刃阵（与"先手刺杀"身份无关）；减伤 4.8%；**无条件闪避 +29.7%** | 处决冷却设为 120、伤害 ×0.586 |

共 39 条 `pacing-aspect-*` 规则，数值全是六位小数拟合值。规则名/描述只有"集中火力压制强敌""转移时避开追击"这类空话，不显示数字；P5 还把上表"原始机制"一列中写清数字的描述改成了模糊文案（如「爆盾」→"破盾反击，持盾增伤，避开追击。"）。

### 1.2 盘点：工具代码里的拟合痕迹

- `tools/pacing/derive-model.ts:65-67`：直接生成 `guard`（无条件减伤）和 `evasion`（无条件闪避）规则。
- `tools/pacing/calibrate-model.ts`：按上一次实测反推 evasion/shield 数值；第 49 行有 `t.id==='quake'` 的单构筑分支。
- `tools/pacing/refine-model.ts:31`：`modify('bulwark',…)` 单构筑分支。
- `tools/pacing/derive.ts`：路径写死 `docs/reviews/pacing-tool-20261010/...`（第 31、37、40 行），校验写死 `newAspectSchema.array().length(60)`、`stageKeyPoolSchema.array().length(24)`。
- 每个场景只用 seed 41 跑一次，0.6–1.5 倍率与 ±5% 预算判定建立在单样本上。
- P1–P4 每批只跑了工具自己的 2–5 个测试，从未全量回归。

### 1.3 盘点：规则引擎现成可用的条件与触发（不需要写新代码就能用）

- **条件 `when`**（`packages/contracts/conditions.ts`）：`skill`（tags/skills/weapons/damageTypes）、`target_status`（statuses、minStacks）、`target_rank`、`target_hp` / `self_hp` / `distance` / `crowd` / `combat_time` / `cast_hits`（lt/lte/gt/gte + value + radius）、`self_state`（shield/moving/still/mana/buff/kills/manaSpent）、`all` / `any` / `not`。
- **触发 `trigger`**（`packages/contracts/effects.ts:7`）：hit、crit、kill、cast、nth、passive、kill_elite、dash、status_apply、hurt、dodge、block、shield_break、shield_gain、low_hp、lethal、interval、combat_start、moved、mana_empty、mana_spent、zone_end。
- **动作 `action.type`**：amplify、arc、buff、cooldown、detonate、echo、extend、field、heal、mana、nova、reduce、refund、shards、shield、spread、status。
- **状态**：burn、poison、slow、stun、silence、petrify、fear、root、blind、time_stop、attack_up、speed_up、armor_down、counter、immunity、guardian、regen、bleed、shock、freeze、vulnerable。

B0 必须核实这些在模拟里**真的生效**（不是只有 schema）：对每种你打算用的条件/触发/动作，找到 `packages/simulation` 中的执行代码或已有测试。不生效的列入 inventory.md 的"缺口"，按第 3 节模块 M3 补实现，不得改用别的通用倍率绕过。

### 1.4 当前测试状态（2026-10-12 Claude 已处理一部分）

Claude 已修好与节奏工具无关的过期测试，并修了一个真缺陷，**不要回退**：
- `tests/fixtures/build-variety-r1/legacy-builds.json`：标签"武器亲和"→"主手加成"（数值、战斗帧不变）。
- `tests/build-variety-set-stage-ui.test.ts`、`tests/story.database.test.ts`：跟随界面文案更新断言。
- `tests/deep-progression-rules.test.ts`：巅峰经验按配置推算，不再写死 600/250000。
- `apps/web/src/battle-result-panel.ts`：恢复了被 polish 误删的结算页"本场进度 · 裂星潮 x/6"一行。

仍失败、**必须由本期机制改造自然修好**的 3 个：
- `tests/build-variety-r6-review.test.ts` 余烬之心燃烧暴击（期望 240，实际 279，来源是 `focus-normal` +16.4% 作用到燃烧）；
- `tests/build-variety-r6.test.ts` burn-only critical flag（同上）；
- `tests/build-variety-r6.test.ts` tailwind 移速转换（顺风补丁引用暗器技能，剑装配下技能列表为空，`w.skills[0]` 是 undefined）。

这 3 个测试**不得为了通过而改断言**。只有当新机制合理地改变了期望值时才可以改，并在 decisions.md 写明原因。

### 1.5 工作区注意

工作区里有其他会话未提交的改动（Godot `client/`、`apps/web/public/world/maps/*`、`apps/web/src/scene.ts`、`combat-vfx.ts`、`shield-feedback.ts`、`presentation.ts`、`hud.css`、`ui-tokens` 等）。**不要动这些文件，也不要提交它们。** 提交时只 `git add` 本期改动的具体路径，禁止 `git add -A` / `git add .`。一期 P5 未提交的内容（aspects.json、progression-curve.json、版本号等）由本期接手，B6 一并提交。

---

## 2. 已确定的决策（不可推翻）

1. **方案 A**：8 个构筑词条上的通用倍率全部换成**有条件的、贴合构筑身份的机制**。
2. 用户指定的五场景权重（清怪 0.30 / 安全 0.25 / 单体 0.20 / 精英 0.15 / 生存 0.10）、各构筑目标倍率、预算 1.0±5%、升级 240 虚拟分钟（目标带 210–270，硬上限 300）**不得修改**（`config/excel/节奏目标.xlsx` / `config/json/pacing-targets.json` 的 weights 与 builds 只读）。
3. 平衡方法 = 推导：**一次推导 + 一次验证**；不过只允许按第 5 节规则调整一次再验证一次。禁止探索性扫参、并行候选方案、"诊断的诊断"。
4. 描述必须写出**所有数字**，并且与实现完全一致；玩家能从描述准确算出效果。
5. 覆盖不足就补机制，不靠删技能、删构筑、隐藏数值来掩盖。
6. 开发期没有真实玩家；规则版本只在 B6 统一升一次。

---

## 3. 通用模块（先建模块，内容是数据）

### M1 构筑机制规则（数据）
每个构筑词条最终由三部分组成：
- **原始身份机制**（1.1 表"原始机制"一列，保留；数值可作为调参旋钮）；
- **输出机制** 1–2 条：必须带构筑身份条件，可选来源 = 本构筑核心状态（`target_status`）、核心技能（`skill` 过滤）、核心自身状态（`self_state`）、核心触发（dash/shield_break/block/kill_elite/status_apply…）、`crowd`/`distance`/`target_hp`/`combat_time`/`cast_hits`；
- **生存机制** 0–1 条：同样必须有构筑身份条件（例："移动中闪避"、"持盾时减伤"、"受击时冻结周围"），**禁止无条件的 dodge/reduce**。

硬性约束：
- `target_rank` **不得作为唯一条件**，除非该构筑身份本身就是"打强敌"（只有 opening 先手刺杀可以单独用精英/首领条件）。
- 每个词条新增规则 ≤3 条；每条规则 id 用 `aspect-<key>-<机制名>`，**不再用 `pacing-` 前缀**（工具也不再生成 `pacing-*`）。
- 删除"先砍再补"补丁（1.1 表最后一列）。如果某个技能伤害确实需要削弱作为代价，保留为**一条**补丁，并在描述里写明（如"代价：影步伤害 −30%"）。
- 数值取设计步长：百分比 5% 一档，时长 0.5 秒一档，次数/层数取整，半径 0.5 格一档。**禁止六位小数。**

### M2 描述生成与一致性校验（代码）
- 新增 `packages/content/aspect-description.ts`（或在现有词条描述模块中扩展）：由规则参数生成中文描述片段，格式遵守 `docs/copy-voice-handoff-20261009.md` 的文案口吻。
- 新增测试 `tests/aspect-description-consistency.test.ts`：对 8 个构筑词条，每条规则的关键参数（ratio、strength、duration、chance、icd、条件阈值）都必须以玩家可读形式出现在词条描述里；描述里出现的每个数字都必须能对应到某个参数。
- 每条规则的 `name` / `description` 也要写数字，不再出现"集中火力压制强敌"这种空话。

### M3 机制缺口实现（代码，仅在 B0 发现缺口时）
如果某个必要的条件/触发/动作在模拟里不生效，在 `packages/simulation` 里补通用实现（按类型实现，不按构筑写特例），并为它单独写测试。

### M4 节奏工具改造（代码）
- `derive-model.ts`：删掉生成 guard/evasion/focus/expose 等通用规则的逻辑。derive 只调整**机制旋钮表**里声明的参数。
- 新增机制旋钮表 `config/json/pacing-mechanism-knobs.json`（如有 Excel 源，同步到 `config/excel/节奏目标.xlsx` 的新工作表，并更新导出脚本）：每个构筑列出 1–3 个可调参数（规则 id + 参数路径 + 步长 + 上下限 + 影响的场景）。推导在旋钮范围内按步长取值。
- 通用属性兜底只允许作为旋钮表里显式标注 `generic:true` 的条目：每个构筑最多 1 条，报告中标红，并且仍然必须带条件。
- 删除 `calibrate-model.ts`、`refine-model.ts` 里所有 `t.id==='quake'`、`modify('bulwark',…)` 这类单构筑分支；校准逻辑改为对所有构筑统一的旋钮调整规则（第 5 节）。
- `derive.ts`：输出目录用 `--out=` 参数，默认 `.qa/pacing/latest`；读取上次实测用 `--from=<目录>`，不再扫描写死的 P2–P5 路径；词条数/钥匙池数从内容推出，不再写死 60/24。
- `validate.ts`：多种子，默认 seeds = 41、42、43；每个构筑×场景报告**中位数**和最小/最大值；判定用中位数；报告里列出每条机制规则的触发次数（证明条件机制真的在战斗中触发）。

---

## 4. 各构筑的默认机制方案（可在约束内微调，微调记入 decisions.md）

| 构筑 | 输出机制（默认） | 生存机制（默认） | 主要旋钮 |
|---|---|---|---|
| 燃烧引爆 burn | 保留"燃烧可暴击（暴击率减半）、燃烧伤害 +20%"；新增：对燃烧中的目标，直接命中伤害 +X%（`target_status: burn`）；燃烧中的敌人死亡时，把燃烧扩散给 3 格内 N 个敌人（kill + spread） | 命中燃烧中的敌人时获得护盾 = 最大生命 Y%（icd） | X、扩散数量 N、Y |
| 冻结碎冰 freeze | 保留"冻结 +1 秒、碎冰范围 ×2"；新增：对冻结/减速目标伤害 +X%（`target_status: freeze, slow`） | 受击时冻结周围 R 格敌人 Z 秒（hurt + nova/status，icd） | X、Z、icd |
| 疾行游击 mobile | 保留移速转伤害（比例作为旋钮）；新增：位移（dash）后下一次命中 +X% 且必定暴击 | 移动中闪避 +Y%（`self_state: moving`），这才是"转移时避开追击" | 转换比例、X、Y；**删除影步/影刃/刃舞 ×0.427 补丁** |
| 震地旋风 quake | 保留旋风 4 段跟随；新增：周围敌人 ≥3 时（`crowd`）范围技能伤害 +X%；旋风命中施加破甲（armor_down） | 施放旋风期间减伤 Y%（cast + skill 过滤 whirl 的 buff） | X、Y、破甲强度 |
| 分裂箭雨 arrows | 保留飞刀环绕；**用"单次接触预算"一个旋钮替代"×0.24 再对普通怪 +412%"**；新增：对流血目标伤害 +X%（`target_status: bleed`） | 周围敌人 ≥3 时闪避 +Y%（`crowd`） | 接触预算、X、Y |
| 回响法师 echo | 保留"每 6 秒下一个技能 ×1.5 且必定暴击"（若 P5 已改成"每 3 次施法追加回响"，以 B0 核实的现状为准，二选一记入 decisions.md）；新增：回响触发后 Z 秒内冷却恢复 +X% | 法力消耗累计到阈值时获得护盾（mana_spent） | X、护盾量；**删除两层伤害折算补丁，改为调整"×1.5"本身** |
| 坚壁反伤 bulwark | 保留"护盾破裂爆炸 = 护盾值 150%"；新增：格挡时反伤 +X%（block） | 持盾时减伤 Y%（`self_state: shield`），替换无条件减伤；**删除无条件闪避 48%**（坦克不靠闪避，且它正是安全 1.543 超标的来源） | 爆炸倍率、X、Y |
| 先手刺杀 opening | 保留"击杀精英/首领重置冷却"；新增：对生命 ≥90% 的目标伤害 +X%（`target_hp`，对应关键属性 vsHealthy）；进战前 3 秒（`combat_time`）暴击伤害 +Y% | 击杀精英后获得护盾（kill_elite + shield） | X、Y；**删除"群敌留刃阵"（与身份无关）**；处决补丁改为一条写明的代价或删除 |

---

## 5. 批次

**B0 盘点与核实**（不改内容）
- 创建进度文件、decisions.md。
- 写 `docs/reviews/pacing-mechanics-20261012/inventory.md`：确认 1.1/1.2/1.4 的现状（逐条核对，有出入以实际为准并记录）；逐项核实第 4 节要用到的条件/触发/动作在模拟里真实生效（列出代码位置或测试名），不生效的列为缺口。
- 记录当前基线：跑一次 `pnpm pacing:validate`（单种子即可，作为对比基线，产物放 `B0/baseline`）。

**B1 通用模块代码**
- M2 描述生成 + 一致性测试；M3 补缺口（如有）；M4 工具改造（去单构筑分支、旋钮表、`--out`/`--from`、去写死计数、多种子 validate、机制触发次数统计）。
- 为工具改造写/更新 `tests/pacing-*.test.ts`；跑相关测试 + `npx tsc --noEmit -p tsconfig.json`。

**B2 内容替换**
- 按第 3、4 节改写 8 个构筑词条：删 39 条 `pacing-aspect-*` 和"先砍再补"补丁，写入新机制规则（先用第 4 节初值：输出机制 X 取 +20%，生存机制 Y 取 15%，其余取合理设计值并记入 decisions.md）。
- 用 M2 生成描述，恢复并补全数字；一致性测试通过。
- 1.4 的 3 个失败测试必须自然通过。

**B3 一次推导**
- `pnpm pacing:derive --out=docs/reviews/pacing-mechanics-20261012/B3`：只调旋钮表参数，按步长取整，写 `changes.md`（每个改动：文件、路径、前→后、依据）。
- 核对升级时间线不被破坏（progression-curve / monsters / deep-progression 只在必要时改，改了要在 changes.md 说明）。
- `--apply` 写入。

**B4 一次验证**
- `pnpm pacing:validate`（3 种子），产物 `B4/validation`。
- 判定：升级时间在 210–270 内且中位数离 240 不超过 5%；8 个构筑按中位数，加权预算 1.0±5%、各场景倍率在 tolerance 内；每条机制规则在其目标场景中触发次数 >0。
- **只允许调整一次**：对不达标的构筑，只动它旋钮表里的参数，按"偏差比例 ÷ 该旋钮对该场景的边际影响（B3 推导时记录）"算一次新值、取整，写 `B4/adjust.md`。然后进入 B5。

**B5 复验与全量回归**
- 调整后再跑一次 validate（产物 `B5/validation`）。仍不达标的构筑**不再调整**，写入 `numeric-todo.md`：实测中位数、目标、偏差、建议机制方向。
- 全量回归：`npx vitest run`（含数据库测试，用临时库，见 0.7），日志 `B5/tests.log`；要求 0 失败。失败按"测试过期 / 内容改坏 / 真缺陷"分类处理：测试过期就更新测试并写原因；内容改坏或真缺陷就修代码/内容，不得删测试。
- `npx tsc --noEmit -p tsconfig.json` 通过；正式构建通过，且正式包里没有节奏实验入口（沿用一期 P5 的检查方式）。

**B6 收尾与提交**
- 规则版本升一次。
- 写 `docs/reviews/pacing-mechanics-20261012/report.md`：8 个构筑新机制一览（描述原文 + 规则 id）、验证结果表（中位数/min/max）、机制触发次数、标红的通用兜底（应为 0 或极少）、残差、工具用法（命令、参数、输出位置）。
- 更新 `AGENTS.md` 一行记录本期决策与入口。
- 只 `git add` 本期文件（含接手的一期 P5 未提交内容、Claude 已修的测试与 `battle-result-panel.ts`），提交说明以 `pacing-mech:` 开头，可以每批一个提交。

---

## 6. 默认裁决表

| 歧义 | 裁决 |
|---|---|
| 第 4 节某个机制所需的条件/动作在模拟里不生效 | 按 M3 补通用实现；实现量过大（>1 天）时换用第 4 节同构筑的另一种身份条件，记录 |
| 新机制让某个现有测试的精确数值变了 | 新机制合理就更新期望值，写明原因；如果是因为通用倍率仍残留在作用，就是内容错误，修内容 |
| 一个构筑只靠条件机制无法达到目标（旋钮已到上限） | 允许 1 条 `generic:true` 兜底，必须带条件，报告标红 |
| 原始身份机制本身数值与目标冲突 | 调原始机制的数值（它也是旋钮），不加新的通用倍率 |
| 回响词条现状与原始描述不一致 | 以 B0 核实的现状为准，选更贴近"回响"身份、描述更清楚的一种，记录 |
| 升级时间线因内容变化偏离 240 | 只用一期已有的升级曲线推导规则修正一次，不重新设计曲线 |
| 文案措辞拿不准 | 遵守 `docs/copy-voice-handoff-20261009.md`；数字用玩家单位（%、秒、格） |
| 测试需要数据库而临时库起不来 | 先排查一期 P5 临时库脚本；仍不行算硬阻塞，但先做完其他所有批次 |
| validate 单次耗时过长 | 照跑，不缩样本、不减种子；期间不启动其他重任务 |

---

## 7. 硬阻塞（只有这些可以停）

1. 需要修改用户指定的权重、构筑目标倍率、升级目标（第 2 节第 2 条）。
2. 需要删除或合并某个构筑，或推翻方案 A。
3. 可能造成数据丢失：需要动 8612 正式库，或需要清空非临时数据。
4. 需要改鉴权、版本协议、反作弊判定（会误伤玩家）。
5. 需要新美术资源且没有任何现有管线能生成。

---

## 8. 禁止事项

- 禁止保留或新增无条件的 dodge / reduce / amplify 通用规则（`generic:true` 兜底除外，且仍须有条件）。
- 禁止六位小数拟合值；禁止针对单个构筑写 `if(id===…)` 特例。
- 禁止用模糊描述掩盖数值；禁止描述与实现不一致。
- 禁止为了过测试改断言、删测试、跳过测试（`.skip`/`.only`）。
- 禁止只写文档不改代码/内容；禁止占位实现；禁止缩减构筑数、技能数、种子数。
- 禁止探索性扫参、并行候选方案、多轮迭代拟合（只允许第 5 节规定的一次调整）。
- 禁止并行跑重任务；禁止无头浏览器；禁止连接 8612。
- 禁止 `git add -A` / `git add .`；禁止提交其他会话的改动；禁止回退 1.4 中 Claude 已做的修复。

---

## 9. 完成定义

- [ ] B0：inventory.md 完成，所有要用的条件/触发/动作已核实或列为缺口；基线验证留档
- [ ] B1：描述生成 + 一致性测试；缺口实现（如有）附测试；工具去单构筑分支、旋钮表、`--out`/`--from`、不写死计数、多种子、机制触发统计
- [ ] B2：39 条 `pacing-aspect-*` 全部删除；"先砍再补"补丁全部删除或改为一条写明的代价；8 个词条新机制写入且描述带全部数字
- [ ] B2：余烬 ×2、顺风 ×1 这 3 个测试自然通过
- [ ] B3：一次推导完成，changes.md 记录每处改动与依据，数值全部取设计步长
- [ ] B4：3 种子验证完成；不达标的构筑只调整一次，adjust.md 留档
- [ ] B5：复验完成；残差写入 numeric-todo.md；全量 vitest 0 失败（含数据库测试，临时库已清理）；tsc 通过；正式构建通过、无实验入口
- [ ] B6：规则版本升一次；report.md、AGENTS.md 更新；只提交本期相关文件
- [ ] 全程：decisions.md 记录所有裁决；progress.md 可直接恢复
