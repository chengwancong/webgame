# 流派丰富度 R0 批次记录

日期：2026-10-06。验收针对当前工作区；工程中其他任务的未提交内容保留，提交只暂存本批相关修改。

## 修改文件与行为

| 文件 | 修改 |
|---|---|
| `packages/rules/item-power.ts` | 显式声明仅 attack / armor / hp 随阶段放大；speed / mana / regen 与比例属性保持原档数值。缩放函数返回新词缀对象，仅在新生成时调用，不用于读档或构筑解析。R1 将此名单迁入 stageScaled 登记表。 |
| `packages/rules/affix-generator.ts` | 新掉落、锻造、洗练共用 generateGearAffixes；按品质、物品等级和阶段生成。沿用 10 级开放二档、23 级开放三档门槛，并保留掉落来源的最高档限制。无 ilvl 的旧装备洗练保持旧生成口径。 |
| `apps/api/src/app.ts` | 掉落先确定物品等级，再调用共享词缀生成函数；洗练走同一函数，保留既有 revision、事务和 command_id 幂等链路。 |
| `packages/rules/deep-progression.ts` | 收藏装备锻造先确定物品等级，再调用共享词缀生成函数，避免重复乘阶段倍率。 |
| `packages/contracts/index.ts` | 当前工作区 client 0.11.0 → 0.11.1，rules ow-41 → ow-42；protocol、assets、db 不变。 |
| `tests/item-affix-power.test.ts` | 阶段缩放、等级/品质门槛、旧实例只读解析回归。 |
| `tests/item-affix-power.database.test.ts` | 真实 PostgreSQL 读取、启动迁移、T1/T8 洗练、重复命令、过期 revision、流水与恢复。 |
| `tools/verify-build-variety-r0.mjs` | 编译版 Chrome、真实 HTTP、隔离数据库与常驻服务登录/营地恢复验收。隔离部分的证据独立保存，允许仅重跑常驻登录。 |

## 实际玩家路径与证据

- 隔离数据库的受控角色：账号登录 → 读取/预览旧装备 → T1/T8 洗练 → 同命令重复提交 → 刷新恢复。每次洗练扣 100 金、10 材料，仅一条流水；词缀处于品质/等级/阶段允许的范围。已掉落的移速 72 旧实例以及非目标装备逐字段保留。
- 编译版 Chrome，1280×720：同一真实会话提交 T1/T8 洗练，重复提交返回相同回执，重新加载后装备一致。洗练目前使用真实 HTTP 命令验收，本批没有新增洗练界面。
- 常驻网页：只输入账号登录，回到拾星港并重新加载恢复。营地位置采用真实 location 命令保存；未修改主线成长或其他玩家装备。
- 常驻数据库：开工时保存账号、角色、回执、流水基线；已有行与装备/仓库字段逐一核对。期间正常角色变化依据新增回执和流水审计，不把全表摘要变化判作数据丢失。
- 生产构建按停止常驻服务 → 构建 → 恢复常驻服务执行；实际 health/content 与当前客户端的版本相符。浏览器最终结论见 [browser.json](browser.json)，编译版洗练证据见 [isolated-browser.json](isolated-browser.json)，数据库测试运行记录见 [tests.json](tests.json)。

![编译版洗练与刷新后的行囊](compiled-reroll-restored-bag.png)

![常驻服务营地](live-camp.png)

## 测试与检查

重任务串行执行，未并行运行 vitest、数据库测试或浏览器探针。

| 检查 | 结果 |
|---|---|
| `tests/item-affix-power.test.ts` | 通过：3 项 |
| `tests/item-affix-power.database.test.ts` | 通过：1 项，真实隔离 PostgreSQL |
| `tests/drop-progression.test.ts` | 通过：4 项 |
| `tests/equipment-runtime.test.ts` | 通过：8 项 |
| `tests/deep-progression-rules.test.ts` | 通过：22 项 |
| `tests/balance-integrity.test.ts` | 通过：9 项 |
| `tsc --noEmit` | 通过 |
| `tools/validate-content.ts` | 通过，当前仍为 63 个技能 |
| `pnpm build` | 通过；保留既有大分包提示 |
| 真实浏览器与常驻存档审计 | 通过；browser.json 最终 ok=true、errors=[]，旧装备和仓库装备逐字段不变 |

验收脚本修正过百分比范围断言、模板附带字段比较、启动/刷新命令尚未结束时的提交竞态。编译版洗练通过后，常驻部分曾遇到服务停用，已恢复。行囊回港导航中出现面板关闭，原因未定位；本批未修改该界面，最终营地恢复通过真实位置命令和浏览器刷新核对，不将导航操作标为已通过。

## 版本

| client | protocol | rules | db | assets |
|---|---|---|---|---|
| 0.11.1 | 25 | ow-42 | 15 | world-art-20261005-v21-collision |

## 遗留与下一批

- R1 将显式阶段名单迁入属性登记表；本批没有迁移、重洗或削减既有装备数值。
- RS 夜幕的伤害参照已由用户确认改为同武器、同形态的死莲；致盲仅作状态参照，按每秒伤害差 ≤10% 核定首版数值。
- RS 在中毒预算处按交接任务单 §5 暂停：现有解析器强制中毒总量为技能伤害一半，且命中执行器从直接伤害中扣除该毒伤；无法直接执行新表的直接伤害加指定毒伤。待用户确认是否新增状态预算标记，以保留旧毒箭/淬毒针行为并实现新技能。
- 潮印和伤害构成面板的方案选择继续在 R7/R8 进行，其他已定决策保持。
