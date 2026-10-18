# 素材与制作系统：后端实现（交接给 GPT）

日期：2026-10-14　仓库：`G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world`（git 根是上一级 `abyss-walker-rewrite`）
设计稿：`docs/crafting-system-design.md`（下称"设计"，引用写作 设计§N；§11 是用户已拍板的决定）
本期目录：`docs/reviews/crafting-20261014/`；进度文件 `progress.md`，裁决记录 `decisions.md`（K0 创建）
全部回复、文档、提交说明用中文。

**分工**：GPT 只做**后端**（内容配置、共享契约、规则、服务端接口、数据库测试、数值模拟）。**前端由 Claude 做**，它只依赖本文第 3 节的契约。契约是双方唯一的接口：要改契约，必须先在 `decisions.md` 记录原因，并同步修改本文第 3 节和 `packages/contracts/crafting.ts`，不能只改其中一处。

---

## 0. 执行方式（强制）

1. **一次跑完 K0→K8 全部批次。** 每批做完立即进入下一批，不要停下来汇报，也不要问"是否继续"。
2. 只允许两种结束状态：
   - **完成**：第 9 节完成定义全部打勾；
   - **硬阻塞**：遇到第 7 节列出的硬阻塞，且**其余所有能做的批次都已做完**，才可以停下，并在进度文件写清阻塞点、已做内容、恢复步骤。
3. 第 6 节默认裁决覆盖的歧义直接执行，记入 `decisions.md`（时间、问题、裁决、影响文件）。表外但非硬阻塞的歧义，按"服务端为准且幂等 > 不破坏阶段钥匙节奏 > 与现有模式一致 > 改动最小"自行决定，同样记录。
4. 每批结束更新进度文件：打勾、改动文件、测试结果（通过数/失败数）、下一步的**精确**命令。中断后从进度文件恢复，不重做已完成批次。
5. **同一时间只跑一个重任务**（用户电脑会卡）：vitest 全量、数据库测试、tsc、vite 构建、`numeric-flow-sim.py` 都算。跑之前确认没有自己遗留的 node/python 子进程。
6. **不跑无头浏览器。** 界面由 Claude 做并验收；本期后端靠单测和真实 PostgreSQL 测试。
7. **严禁连接或修改 8612 正式库，不调用 8790 登录/写接口。** 数据库测试用现有隔离临时库的方式。开发期允许清档，但本期不需要清档：旧存档必须能通过迁移读出（见 K1）。
8. 遵守 `AGENTS.md`：持久状态只由服务端修改；预览不写入；命令走 `write()`（命令 ID 幂等 + 回执）；新效果 ID 必须有执行语义和共享样例；配置表驱动，不在代码里硬编码材料名、配方、文案。
9. 原始测试明细、截图、构建产物只留本地，提交时只提交结论（见 `docs/reviews` 的现有做法）。

---

## 1. 现状（先读懂再动手）

| 东西 | 位置 | 本期处理 |
|---|---|---|
| 11 种材料、8 个配方、专业配置 | `packages/content/deep-progression.json`（`materials` `recipes` `professions` `rewards`） | 材料和配方迁到新表，旧字段删除或改为从新表读 |
| 专业规则：`profession.choose` / `profession.gather` / `recipe.learn` / `recipe.craft`、`gatherCharges` | `packages/rules/deep-progression.ts`（约 65、131–134、261–262 行） | **删除**，改由新的 `packages/rules/crafting.ts` 实现 |
| 动作枚举 | `packages/contracts/deep-progression.ts` 的 `progressionActionSchema` | 删掉上面 4 个 op；`consumable.use` 保留并支持新消耗品 |
| 材料数量 | `progression.materials`（随角色快照返回） | **保留这个位置**，背包现在就从这里读 |
| 强化石 | `material` 数值字段（`enhancement-stones.md`） | 不改，在材料表里登记为 T0 `enhance_stone`，数量仍读原字段 |
| 工坊位置校验 | `apps/api/src/app.ts` `/api/gear/upgrade|reroll`，错误码 `FORGE_PLACE` / `STORY_LOCKED`（`forge-workshop.md`） | 制作、提纯、设施、精工**复用同一校验** |
| 阶段钥匙制作保底 | `apps/api/src/stage-key-*.ts`、`packages/contracts/stage-keys.ts` | 不改规则；只在 `CraftingView` 里引用其进度（3.2） |
| 世界物件 | `config/excel/世界.xlsx` objects 页签（现有 `kind=life/core`），`packages/rules/world-phase.ts` | 新增 `kind=gather` |
| 宝箱/稀有怪结算 | `apps/api/src/field-activities.ts`、`field-loot.ts`、`field-loot.json` | 加材料和配方掉落 |
| 击杀结算 | `apps/api/src/app.ts` `/api/combat/report` → 奖励 | 加怪物部件掉落 |
| 消耗品（合剂，N 次击杀） | `progression.consumables`、`consumable.use` | 新增抗性药剂和割草食物，用同一模板 |
| 抗性 / 元素词条 | `packages/contracts/index.ts` `Stats`（`fireResist` 等 7 种伤害、7 种抗性已存在） | 直接使用，不新增词条 |
| 头盔 / 鞋 / 戒指部位 | `packages/content/equipment-runtime.json` | 饰品工艺产出戒指、项链、护符；没有的部位按第 6 节裁决 |
| 收集奖励 | `packages/content/deep-progression.ts` `collectionDefinitions`（`craft-8`） | 改成图鉴档位 |
| 配置导出 | `pnpm config:export` / `pnpm config:check`（`tools/config-export.py`） | 新表 `制作.xlsx` 接入 |

---

## 2. 范围（设计已拍板，不得改）

- 专业全部开放：锻造 `smithing`、饰品工艺 `jewelcraft`、炼金 `alchemy`（含原烹饪的割草食物）、附魔 `enchanting`，各 1–100 级；另有共享的采集熟练 `gathering` 1–100 级。
- 全自动挂机只采**路线上**距离 ≤2 格的采集点；手动/半自动可以采任意点。服务端只看 `mode` 字段决定日志，判定规则一致。
- 工坊设施 4 座 × 6 级，外观 3 档；精工上限 5 级。
- 制作品强度 ≤ 同阶段掉落；定向锻造的等级上限 = 当前已通过的阶段；钥匙材料只出在本阶段地城。

---

## 3. 前后端契约（Claude 的前端只依赖这里）

文件：`packages/contracts/crafting.ts`（zod，K0 先写，用于前端开工）。字段名下面定死，类型按 zod 写。

### 3.1 材料定义（`/api/content` 公开内容里新增 `crafting.materials`）

```ts
CraftMaterialDef = {
  id: string;              // 'wind_ore' 等，见 4.1
  name: string;
  tier: 'T0'|'T1'|'T2'|'T3';
  island: string|null;     // 'ss-map-wind' 等；T0/T3 为 null
  kind: 'common'|'ore'|'plant'|'part'|'boss'|'endgame'|'legacy';
  icon: string;            // 资源 ID；美术未到时用 'item-material-<kind>'（前端负责回退）
  sources: string[];       // 一行一个来源说明
  stack: number;           // 9999
}
```

### 3.2 `GET /api/crafting` → `CraftingView`

```ts
CraftingView = {
  revision: number; ruleset_version: string;
  atForge: boolean;                    // 请求带 ?region=&x=&y=，服务端用工坊位置校验算出；false 时只读
  forgeReason: string;                 // atForge=false 的原因文案
  materials: { id: string; quantity: number; uses: { recipe: string; name: string }[] }[];
  professions: { id: 'smithing'|'jewelcraft'|'alchemy'|'enchanting'|'gathering'; name: string; level: number; xp: number; xpNext: number; fineChance: number }[];
  recipes: {
    id: string; name: string;
    profession: 'smithing'|'jewelcraft'|'alchemy'|'enchanting';
    category: 'gear'|'accessory'|'tonic'|'resist'|'food'|'essence'|'pattern'|'refine';
    island: string|null;
    known: boolean; unlockHint: string;          // 未学会时显示"在哪里获得"
    levelRequired: number; facilityRequired: { id: string; level: number }|null;
    options: { slots?: string[]; tendencies?: string[]; elements?: string[] };   // 定向锻造的可选项
    baseCost: { gold: number; materials: Record<string, number> };
  }[];
  patterns: { id: string; name: string; slot: string; quality: 'legendary'|'set'; island: string|null; learned: boolean; sourceHint: string }[];
  codex: { id: string; name: string; required: number; current: number; bonus: string; claimed: boolean }[];
  facilities: { id: 'forge'|'jewel'|'alchemy'|'enchant'; name: string; level: number; maxLevel: 6; appearanceTier: 1|2|3;
                effects: string[]; next: { level: number; cost: { gold: number; materials: Record<string, number> }; effects: string[] }|null }[];
  refine: { from: string; to: string; inputCount: number; outputCount: number }[];   // 只列当前可用的规则
  masterwork: { unlocked: boolean; reason: string; maxLevel: 5 };
  stageKey: StageKeyProgress|null;     // 复用 stage-keys.ts 的类型，没有当前阶段时为 null
}
```

### 3.3 `POST /api/crafting/preview`（不写入）

请求：`{ revision: number; action: CraftAction; region: string; position: {x,y} }`
返回：

```ts
CraftPreview = {
  revision: number; action: CraftAction;
  enabled: boolean; reason: string;                  // 不可做时的原因（材料不足/等级/设施/不在工坊/背包满）
  cost: { gold: number; materials: Record<string, number> };
  output: {
    kind: 'gear'|'consumable'|'material'|'pattern'|'facility'|'masterwork';
    name: string; icon: string; count: number;
    quality?: string;                                // 装备品质
    level?: number;                                  // 装备等级
    guaranteedAffix?: string;                        // 定向锻造必出的词缀描述
    affixPool?: { label: string; weight: number }[]; // 只给池子和权重，不给具体结果
    fineChance?: number;                             // 精良概率 0–0.3
    statChanges?: { label: string; before: string; after: string }[];  // 精工、设施升级
  };
  bagFull: boolean;
}
```

### 3.4 `POST /api/crafting/action`（命令）

请求：`command`（现有的 `command_id` + `revision`）+ `{ action: CraftAction; region: string; position: {x,y} }`
返回：现有回执格式，`delta` 里增加：

```ts
{ materials: Record<string, number>;   // 变化量，正负都有
  gold: number;
  gear?: Gear[];                        // 新装备实例
  consumables?: Record<string, number>;
  patterns?: string[]; recipes?: string[]; // 本次新发现的配方（宝箱/稀有怪结算）
  professions?: Record<string, { level: number; xp: number }>;
  facility?: { id: string; level: number };
  fine?: boolean }                      // 本次是否精良
```

```ts
CraftAction =
  | { op: 'craft'; recipe: string; count?: number /* 消耗品 1–20，装备固定 1 */; slot?: string; tendency?: string; element?: string }
  | { op: 'refine'; from: string; times: number /* 1–100 */ }
  | { op: 'exchange'; to: string; times: number /* 1–100，与提纯一致 */ } // 星尘兑换 T1
  | { op: 'facility.upgrade'; facility: string }
  | { op: 'masterwork.apply'; gear: string }
  | { op: 'masterwork.reroll'; gear: string; lockAffix: number }   // 精工 3、5 级解锁
  | { op: 'codex.claim'; target: string }
```

错误码：`FORGE_PLACE`、`STORY_LOCKED`、`CRAFT_UNKNOWN`、`CRAFT_LOCKED`（未学会/等级/设施）、`CRAFT_MATERIAL`、`CRAFT_GOLD`、`BAG_FULL`、`CRAFT_STAGE`（超过已通过阶段）、`REVISION`。

### 3.5 采集：`POST /api/field/gather`（命令）

请求：`command` + `{ region: string; node: string; position: {x,y}; mode: 'manual'|'route' }`
返回回执：`delta.materials` + `delta.node: { id: string; gathered: true }` + `delta.professions.gathering`。
错误码：`GATHER_FAR`（距离 > 2 格）、`GATHER_DONE`（本轮已采）、`GATHER_PLACE`（在副本中/区域未开放）。

### 3.6 采集点在世界数据里

- 公开世界表 `objects` 增加 `kind:'gather'` 行，字段：`id region zone x y name material resource`（`resource` 是图标/外观 ID）。
- 角色快照新增 `field.gathered: string[]`：**当前区域本轮**已采的节点 ID。重新进入区域（新一轮）时清空，规则和清场一致；断线恢复、授权续期、构筑同步都不能清空。

### 3.7 消耗品

`progression.consumables` 新增 ID：`resist_fire resist_cold resist_lightning resist_arcane resist_shadow resist_poison`（各 +X% 对应抗性），`food_pickup food_gold food_material`（拾取范围 / 金币 / 材料掉率）。生效状态沿用合剂的 `remainingKills`；**同类同时只能生效一个**（抗性一类、食物一类、合剂一类各自独立）。使用仍走 `consumable.use`。

物理主岛按第6节默认裁决额外使用 `resist_all`（全抗小值5%、30次击杀），归抗性类；不新增抗性词条，不改变六种元素药剂ID的原语义。

食物的已解析效果在快照 `Stats` 中提供 `pickupRadius`（实际拾取格数）、`goldBonus`、`materialDropBonus`（后两者为小数比例）。数量和剩余击杀数仍读 `progression.consumables/buffs`；结算结果以回执为准。

---

## 4. 内容

### 4.1 材料 ID（名称见设计§2.2，写进 `制作.xlsx`「材料」页签）

| 岛 | 采集① | 采集② | 部件 | 领主 |
|---|---|---|---|---|
| 风栖 `ss-map-wind` | `wind_ore` | `wind_herb` | `wind_part` | `wind_boss` |
| 雾铃 `ss-map-mist` | `mist_ore` | `mist_herb` | `mist_part` | `mist_boss` |
| 赤炉 `ss-map-forge` | `forge_ore` | `forge_herb` | `forge_part` | `forge_boss` |
| 霜镜 `ss-map-frost` | `frost_ore` | `frost_herb` | `frost_part` | `frost_boss` |
| 沉星 `ss-map-rift` | `rift_ore` | `rift_herb` | `rift_part` | `rift_boss` |
| 龙眠 `ss-map-dragon` | `dragon_ore` | `dragon_herb` | `dragon_part` | `dragon_boss` |

T0：`enhance_stone`（映射到原 `material` 字段）、`stardust`。T3：沿用 `omega_fragment legendary_essence gold_moon glyph_dust`，来源改为裂星潮/世界层级/团本。
旧 `ore herb leather` → 迁移规则：按 1:1 转为 `wind_ore wind_herb wind_part`。`character_shard summon_shard awakening_crystal boss_essence` 保留原用途，`kind='legacy'`，只改来源说明。

### 4.2 新配置表 `config/excel/制作.xlsx`

页签：说明、材料、配方、采集点产出、设施、精工、图样、图鉴、掉落。每个字段写批注（`AGENTS.md` 要求）。导出到 `config/json/crafting.json`，`pnpm config:check` 校验，内容构建把公开部分（材料、配方定义、设施、图样名称）放进公开包，**掉率放进私有包**。

### 4.3 配方数量下限（不得少做）

| 类 | 每岛 | 合计 |
|---|---|---|
| 定向锻造（武器 1、护甲 1） | 2 | 12 |
| 饰品（戒指/项链或护符，按现有部位） | 1 | 6 |
| 抗性药剂（每岛主元素） | 1 | 6（物理岛用 `allResist` 小值） |
| 割草食物 | — | 3（风栖、赤炉、沉星各解锁一种） |
| 合剂（攻击/生命，保留） | — | 2 |
| 附魔：词缀精华 / 觉醒结晶 | 1 | 6 |
| 图样锻造（每件已有传奇/套装件一条） | — | = 现有传奇+套装件数 |

### 4.4 初始数值（K8 再推导校准；先用这些值，不能留空）

| 项 | 初值 |
|---|---|
| 怪物部件掉率 | 普通 6%、精英 40%（1–2 个）、首领 3–5 个；只掉击杀所在岛的部件 |
| 采集点 | 每区域 4–8 个，每次 2–4 个，采集熟练每 20 级 +1；精良不适用 |
| 宝箱 | 加 2–6 个本岛 T1；配方掉率 15%（只掉本岛未学会的配方） |
| 稀有怪 | 首杀必掉 1 张本岛未学会配方；之后 10% |
| 提纯 / 兑换 | T1 10→1 星尘；T2 1→5 星尘；星尘 1→3 已解锁岛 T1 |
| 定向锻造成本 | 本岛采集①×20 + 采集②×10 + 部件×8 + 金币（本章强化 +5 一次的价格）；元素倾向另加领主 ×1 |
| 精良 | 5% + 熟练度 × 0.2%，加设施加成，上限 30%；精良主属性 +8% |
| 熟练度 | 每次制作 40 经验，`xpNext = 60 + 12 × level`；采集每次 15 经验 |
| 设施升级 | 第 n 级需要第 n 岛的领主 ×(3n) + 金币；第 6 级需要 T3；每级精良 +2%、提纯损耗 −2%（只作用在兑换） |
| 精工 | 每级主属性 +4%，消耗 T3；3、5 级解锁锁定 1 条词缀后重铸其余 |
| 抗性药剂 | +15% 对应抗性（受现有抗性上限约束），30 次击杀 |
| 割草食物 | 拾取范围 +30% / 金币 +15% / 材料掉率 +20%，40 次击杀 |
| 图鉴 | 每岛"图样 + 配方全部学会"一档，奖励小额全属性 +0.5%；替换旧 `craft-8` |

---

## 5. 批次

| 批 | 内容 | 验收 |
|---|---|---|
| **K0** | 建本期目录、进度、裁决文件；写 `packages/contracts/crafting.ts`（第 3 节全部类型和 `CraftAction`），从 `contracts/index.ts` 导出；建 `制作.xlsx` 的结构和「说明」页 | `tsc` 通过；契约文件路径写入进度文件（**Claude 前端从这里开工**） |
| **K1** | 材料表、`config:export/check`、公开内容输出 `crafting.materials`；旧 `ore/herb/leather` 存档迁移；删除 `profession.*`、`recipe.*` op 与 `gatherCharges`、旧 `materials/recipes/professions` 配置 | 内容校验；迁移单测（旧存档能读出，数量正确）；`/api/content` 带材料定义 |
| **K2** | 怪物部件掉落、宝箱/稀有怪材料和配方掉落、私有掉率；`GET /api/crafting`（不含制作） | 数据库测试：击杀/开箱进回执，重复上报不重复发放 |
| **K3** | 采集点：`世界.xlsx` 六岛共约 150 个 `kind=gather` 点；`field.gathered`；`POST /api/field/gather`（距离、本轮、副本、区域校验） | 数据库测试：采集成功、远距离拒绝且存档不变、本轮重复拒绝、重新进入后可再采、续期不清空 |
| **K4** | `packages/rules/crafting.ts`：配方解析、预览、制作（消耗品、合剂、抗性药剂、食物、附魔、定向锻造）、提纯/兑换、熟练度、精良；`/api/crafting/preview` 和 `/action`；工坊位置校验；背包满拒绝装备产出 | 数据库测试：扣料、材料不足回滚、金币不足回滚、重复命令幂等、不在工坊拒绝、背包满拒绝、超阶段 `CRAFT_STAGE` |
| **K5** | 消耗品生效：抗性和食物进入 `Stats`/掉落结算；同类互斥；`consumable.use` 支持新 ID | 单测：抗性受上限约束；食物影响材料掉率；同类不能叠加 |
| **K6** | 图样：首次分解传奇/套装件学会图样；图样锻造；图鉴和领取；设施升级与 `appearanceTier` | 数据库测试：分解学会且只学一次；图样锻造出指定传奇效果；设施扣费与等级 |
| **K7** | 精工（世界层级解锁）：应用、锁词缀重铸；T3 来源接入裂星潮/世界层级 | 数据库测试：上限 5 级、锁定的词缀不变、未解锁拒绝 |
| **K8** | 按 `crafting-k8-decision-20261015.md` 新裁决：一次推导、一次金币应用、一次验证；钥匙规则/来源/池不回退且制作不产出钥匙材料；六章结余15%–25%；开荒中位降幅≤5%；制作域来源冻结，既有spine残差列为遗留；tsc、配置一致性、内容校验、相关定向测试通过 | 结论写入 `docs/reviews/crafting-20261014/result.md` |

---

## 6. 默认裁决

| 歧义 | 裁决 |
|---|---|
| 没有项链/护符部位 | 饰品工艺只出现有的部位（戒指等），配方数不减：每岛 1 个饰品配方仍要做，部位不够就做同部位不同倾向 |
| 设计稿里的名称和现有内容 ID 冲突 | 保留现有 ID，名称用设计稿 |
| 某岛主元素是物理 | 抗性药剂用 `armorPercent` 小值或 `allResist` 小值，记录 |
| 定向锻造的武器倾向选项 | 读现有 `weapon-skills.ts` 的倾向枚举，不新增 |
| 定向锻造必出词缀找不到对应元素词条 | 用该元素的伤害词条（如 `fireDamage`），没有再用抗性词条 |
| 现有传奇/套装件没有"可分解"标记 | 所有传奇和套装件分解都算学会，锁定/已装备的仍受原保护规则 |
| 采集点坐标 | 从现有区域的可行走点里挑，避开营地、道路中线和宝箱 3 格内；每区域 4–8 个 |
| 全自动挂机的"路线"判定 | 服务端不判断路线，只判断距离和本轮状态；`mode` 只用于日志 |
| 掉率是否进客户端 | 一律不进，只给"来源说明"文字 |
| 数据库版本 | 有存档结构变化就递增 `db_schema_version`，写迁移；`protocol_version` 有新增接口就递增 |
| 测试依赖的旧 `profession.*` 用例 | 删除旧用例，以新用例覆盖同一能力 |

---

## 7. 硬阻塞（只有这些可以停）

1. 需要删除或无法迁移玩家存档、奖励回执、流水。
2. 需要推翻设计§11 已拍板的决定。
3. 需要放宽登录、版本校验或反作弊判定（反作弊只能抽样、宁可漏判）。
4. 阶段钥匙规则（numeric-flow §4.2）和本设计确实无法同时满足。

其余情况一律按第 6 节或第 0 节第 3 条自行裁决并记录。**美术缺图不是阻塞**：图标用 `item-material-<kind>` 回退，由前端处理。

---

## 8. 禁止

- 只写文档不写代码；用"后续再做"代替实现。
- 减少 4.3 的配方数量或采集点数量。
- 留空值、`TODO`、未知效果字符串冒充已实现。
- 跳过数据库测试，或用 mock 代替真实 PostgreSQL 验证扣费与幂等。
- 修改前端 `apps/web/src`（除了让构建通过所必需的类型导入修复，修了要记录）。
- 在代码里写材料名、配方、文案。
- 并行跑重任务；跑无头浏览器；碰 8612 / 8790。

---

## 9. 完成定义

- [x] K0：`packages/contracts/crafting.ts` 与第 3 节一致并导出
- [x] K1：材料表接入配置导出与校验；旧存档迁移有单测；旧专业逻辑已删除
- [x] K2：部件、宝箱、稀有怪掉落进回执，幂等；`GET /api/crafting` 可用
- [x] K3：约 150 个采集点；采集命令五种情况有数据库测试
- [x] K4：预览与制作；七种失败情况有数据库测试；配方数量达到 4.3
- [x] K5：抗性药剂、食物生效且同类互斥
- [x] K6：图样学习、图样锻造、图鉴、设施升级
- [x] K7：精工与 T3 来源
- [x] K8：按2026-10-15新裁决，钥匙不回退、六章结余15%–25%、开荒中位降幅≤5%、制作域来源冻结且旧残差列为遗留、tsc/配置一致性/内容校验/相关定向测试通过
- [x] 进度文件与 `decisions.md` 完整，`result.md` 写明测试数量、失败数、遗留项
