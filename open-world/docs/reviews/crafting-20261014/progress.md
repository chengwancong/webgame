# 素材与制作后端进度

开始日期：2026-10-14。交接文档为唯一验收依据；只修改后端，重任务串行。

最终状态：**完成（按2026-10-15新裁决）**。K0–K7保留，K8恢复完成；交接第9节和新裁决完成项全部勾选，结论见 `result.md`。以下保留首轮与恢复历史，不把旧阻塞作为当前状态。

- [x] K0 契约与配置结构
- [x] K1 材料与迁移
- [x] K2 掉落与只读视图
- [x] K3 世界采集
- [x] K4 制作规则与命令
- [x] K5 消耗品
- [x] K6 图样、图鉴、设施
- [x] K7 精工与终局来源
- [x] K8 数值、回归与版本核验

## 当前执行点

K0–K8按新裁决全部完成，无待续批次。下一步的精确只读复核命令（open-world）：`Get-Content docs/reviews/crafting-20261014/result.md -Raw`。不重新运行已完成的derive/apply-gold/verify。

## K0 完成（保留历史）

K0契约与工作簿结构已完成；契约3通过/0失败，类型检查通过。入口`packages/contracts/crafting.ts`与交接第3节一致。

## K1 完成

改动文件：`config/excel/制作.xlsx`、`config/json/crafting*.json`、`tools/config-export.py`、`tools/config_crafting_check.py`、`packages/content/crafting.ts`、`packages/content/deep-progression.{ts,json}`、`packages/contracts/{crafting-state,deep-progression,index}.ts`、`packages/rules/{crafting-migration,deep-progression}.ts`、`apps/api/src/{app,database}.ts`、`tests/{crafting-migration,deep-progression-rules,equipment-runtime}.test.ts`、旧装备数据库测试及 `tools/pacing/completion.ts`。

结果：迁移单测5通过/0失败；契约、制作基础及养成装备回归合计45通过/0失败；配置一致性检查通过。旧专业动作与采集充能已删除；旧字段在迁移入口读取并保留训练历史，材料定义进入 `/api/content.crafting.materials`。

过程中出现过3项旧断言失败（旧界面模块数、旧材料键），完成接口迁移与断言更新后复验全部通过。原始日志只留本地。

当前进入K2。已编写只读视图与基础命令，先前隔离PostgreSQL基础验证8通过/0失败；掉落接线与迁移后复验尚未完成。
下一条精确命令（open-world）：`node tools/pacing/run-tests.mjs .qa/crafting-20261014/K2 tests/crafting.database.test.ts`。

## K2 完成

改动文件：`apps/api/src/{crafting-loot,crafting-service,field-loot,field-activities,app}.ts`、`packages/contracts/{crafting,index}.ts`、制作表及公开/私有导出、`tests/{crafting,field-activities}.database.test.ts`。
真实PostgreSQL测试17通过/0失败：制作基础10项（含旧存档迁移与真实击杀部件回执）和活动链路7项（含开箱材料、首次稀有配方、冻结规则和重复命令）。临时库已清理。`GET /api/crafting` 与 `/api/content.crafting.materials` 已接入，公开包没有掉率。
下一步K3，精确命令：`node tools/pacing/run-tests.mjs .qa/crafting-20261014/K3 tests/crafting-gather.database.test.ts`。

## K3 完成

改动文件：`config/excel/世界.xlsx`、`config/json/world.json`、`packages/contracts/{crafting-state,open-world,index}.ts`、`packages/content/world-tables.ts`、`packages/rules/crafting-gather.ts`、`apps/api/src/{crafting-service,app}.ts`、`tests/crafting-gather.database.test.ts`。
真实PostgreSQL测试6通过/0失败：150点与导航覆盖、成功与回执幂等、远距离拒绝、同轮重复与重新进入、续期/构筑/恢复保留、副本/未开放区域拒绝。首次用初始岛做锁岛断言，被正常初始化规则重新开放；改用未解锁雾铃岛后复验通过。没有放宽区域判定。
下一步K4，精确命令：`node tools/pacing/run-tests.mjs .qa/crafting-20261014/K4 tests/crafting.database.test.ts tests/equipment-runtime.database.test.ts`。

## K4 完成

改动文件：`packages/rules/crafting.ts`、`apps/api/src/crafting-service.ts`、`packages/content/crafting.ts`、制作表与导出、`tests/{crafting-rules,equipment-runtime}.test.ts`、`tests/{crafting,equipment-runtime}.database.test.ts`。
最终真实PostgreSQL测试17通过/0失败，其中一项逐件覆盖全部324件装备的真实制作、穿戴、报价、强化、幂等与恢复。七种失败边界均有事务不变断言。制作规则与装备单测13通过/0失败。
发现并修复：新增食物属性解析缺少settings导入造成读取失败；低级传奇图样因现有传奇词缀从二档开放而产生空词缀，现将这些图样的物品等级下限设为10，仍受已通过阶段限制。最终矩阵全部通过。

## K5 完成

改动文件：`packages/rules/{crafting-consumables,deep-progression,index}.ts`、`packages/contracts/{crafting,index}.ts`、`apps/api/src/{crafting-loot,field-loot,field-activities,app}.ts`、`tests/crafting-consumables.test.ts`。
消耗品单测4通过/0失败；关联制作与养成回归合计33通过/0失败。抗性应用现有75%上限；三类独立互斥；食物影响真实私有材料概率和服务端金币结算，拾取半径由服务端解析；真实击杀扣剩余次数。
下一步K6，精确命令：`node tools/pacing/run-tests.mjs .qa/crafting-20261014/K6 tests/crafting-patterns.database.test.ts`。

## K6 完成

改动文件：`packages/rules/{crafting,deep-progression}.ts`、`packages/contracts/crafting-state.ts`、`apps/api/src/app.ts`、制作图样/图鉴/设施配置、`tests/{crafting-db-fixture,crafting-patterns.database.test}.ts`。
真实PostgreSQL测试4通过/0失败：首次拆解与仅学一次、指定传奇效果继承、原装备保护、设施六级扣费与三档外观、失败回滚、图鉴领取幂等与永久属性生效。当时图样326种，含324套装模板与2个固定原初模板；K8补齐所有旧通用传奇模板后为334种。
下一步K7，精确命令：`node tools/pacing/run-tests.mjs .qa/crafting-20261014/K7 tests/crafting-masterwork.database.test.ts`。

## K7 完成

改动文件：`packages/rules/crafting.ts`、`packages/contracts/crafting-state.ts`、`apps/api/src/{crafting-loot,app,field-loot}.ts`、制作表「精工」「掉落」、`tests/crafting-masterwork.database.test.ts`、`tests/crafting-loot.test.ts`。
真实PostgreSQL精工测试4通过/0失败：世界层级门槛、五级上限与每级4%主属性、T3扣费与命令重试、锁定索引保持与其他词缀重铸、非法锁定拒绝。终局/材料来源单测3通过/0失败，消耗品关联复验合计7通过/0失败。首次精工测试误将无随机主属性的武器当作有mainStat的样本；改用真实有该字段的头盔后通过，执行器同时保留固定攻击/护甲的精工路径。
下一步K8，精确命令：`pnpm exec tsc --noEmit`。随后数值主干进行一次推导、一次验证，全量回归与构建串行执行。

## K8 检查过程

一次推导与一次验证已完成。24阶段×三种子×每组10000样本：钥匙保底11.6413%（精确解11.6408%），不是约23%；直接锻造配对测量的开荒加速模型中位数0%、最大阶段中位数0%；金币预算投影未达20%，六章约为−0.98%、36.23%、38.46%、49.07%、49.46%、49.91%。金币投影不能冒称自然养成实测，未据此虚报校准。

确认交接第7节第4类硬阻塞：本次不允许改阶段钥匙规则。当时继续完成其他K8检查，最终结束点见下文。
首次K8类型检查通过；配置一致性通过；内容生成与校验修正旧列表替换语法、明确采集图标回退后通过。全量测试以隔离临时库串行运行中，已通过自然养成、全部任务驾驶、五岛主线驾驶11项、真实副本生命周期和324装备矩阵。

兼容修正：正式旧附魔ID与固定传奇映射、全部334模板图样、所有套装图样沿用稀有品质、旧首领事实制作限额、当前区域采集检查。数值参数、掉率、设施成本、432种直接锻造选择与各章平均价格等价，已留本地检查，未重跑数值。
全量发现前端4处禁用词，记录在 `frontend-integration.md`，不修改前端。历史评审源副本不属于当前测试，已在Vitest排除 `docs/reviews`，不删当前用例。

当前命令：`node tools/pacing/run-tests.mjs .qa/crafting-20261014/K8-all --all`。
之后精确命令：`pnpm exec tsc --noEmit`，随后执行生产构建与托管服务重载/版本核验。

## 最终检查与结束点

- 最终内容：34材料、376配方、334图样、150采集点。旧装备配方展示适配改为读取新制作表，旧硬编码配方生成器及动作门槛已移除；物理岛使用全抗5%护身剂，契约同步。
- 后端稳定复验19文件126通过/0失败；后续相关6文件52通过/0失败；最终消耗品/规则/成长38通过/0失败。最新制作命令数据库15通过/0失败，采集数据库7通过/0失败。db17只迁移制作域，其他成长历史保留有真实PG测试。
- 最终类型检查、完整生产构建及最终Vite打包通过；配置8本一致、内容校验通过。前端源码252文件指纹变化0。
- 隔离API真实重载通过：同一会话、钱包、装备、旧材料、回执和流水保留；health/content/源码版本一致，client0.11.26、protocol36、rules ow-72、db17、assets world-art-20261007-v24-world-runtime。最终API10580/数据库10578，测试结束已关闭并清理，不碰正式库。
- 首轮全量1822通过/12失败/2既有跳过，第二自然策略1通过；失败后端项已完成稳定定向复验，未冒称全量重新运行通过。前端文案独立检查仍1项失败（4处词），不越分工修改。
- 主干检查未通过，未擅自冻结新来源或覆盖原预算/测量报告。数值只做一轮推导、一轮验证；保底11.64%与约23%冲突、金币投影未达标，保持真实残差。

结论与遗留已写入 `result.md`，裁决与影响文件见 `decisions.md`。原始日志、数值明细、数据库临时文件和构建产物仅本地留存，没有提交。

恢复前置：先由用户/数值负责人解决冻结钥匙基线与目标的冲突；不重做K0–K7。之后下一条精确命令（open-world）：

```powershell
& C:/Users/ccc/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe -X utf8 tools/numeric-flow-sim.py --crafting --derive --out=.qa/crafting-20261014/K8-resume
```

## K8 恢复（2026-10-15）

设计裁决已替换旧完成定义，K0–K7保持。改动：制作工作簿与导出、`tools/spine/crafting-{flow,pricing,gold}`、设施共用金币解析、来源冻结入口及设施定向数据库测试。新轮已经单次推导、单次应用金币；钥匙规则8文件、24阶段来源及池哈希通过不回退核对；验证运行中。本段尚无新增测试计数，0通过/0失败（未运行），不覆盖既有批次结论。

当前精确命令：`python -X utf8 tools/numeric-flow-sim.py --crafting --verify --out=.qa/crafting-20261014/K8-resume`，已启动，不可重复推导/应用/验证。完成后下一步：`node node_modules/typescript/bin/tsc --noEmit`。

K8恢复数值完成：一次derive、一次apply-gold、一次verify均通过，六章结余约20%，钥匙不回退通过，开荒中位和最大阶段中位均0%。未重做K0–K7。下一步精确命令：`node node_modules/typescript/bin/tsc --noEmit`。

恢复工程检查：tsc通过；8本配置一致；内容校验通过。首轮相关定向12文件67通过/4失败，已定位两项受控资金不足、一项新测试星海fixture缺字段、一项宝箱与精英异步奖励总钱包竞态；修正资金/状态准备和宝箱精确回执断言，业务钥匙规则未改。下一条精确命令：`node node_modules/typescript/bin/tsc --noEmit`，然后只复验这3个失败文件。

## K8 恢复完成

修改文件：制作.xlsx与公开/总导出、content/crafting.ts、rules/crafting.ts、配置校验、spine制作数值三文件及check/cli/来源锁、设施/装备/钥匙三个数据库测试、交接和结论文档。K0–K7不重做。

恢复测试历史：首轮67通过/4失败；失败文件二轮17通过/1失败；末轮设施5通过/0失败。最终有效覆盖12文件71通过/0遗留失败（不是单轮全量）；324装备矩阵通过。最终tsc、配置8本一致、内容校验通过。一次derive、一次apply-gold、一次verify完成；钥匙不回退通过；六章结余20.016037%、20.002386%、20.001737%、19.999803%、19.999955%、20.000005%；开荒中位和最大阶段中位均0%。

制作域24来源重新冻结，漂移0；spine全局因既有预算/测量残差仍失败，旧139与当前S8指针151、测量10如实列入result.md。没有修复或改目标。隔离API10954/PG10951重载通过，health/content/源码版本一致，同会话、钱包、装备、旧材料、回执与流水保留，临时库已停止并清理。前端4处copy-voice修复按设计方已通过结论关闭，本轮未动前端。

完成后下一条精确命令：`Get-Content docs/reviews/crafting-20261014/result.md -Raw`。无待续实现，无需重做批次。原始明细和产物仅本地。
