# 六部位装备图标清单

这份清单用于图标生产排期与完整性核对，不是已经生成的图片清单，也不修改装备数值、掉落、槽位或角色外观。

## 数量与确认状态

用户已指定六部位：武器、衣服、头盔、鞋子、项链、戒指；六个方向为剑、锤、斧、法杖、暗器、魔杖；每个方向分别准备常规、方阵、原初的 T1/T2/T3，画风沿用已选定的手绘符记。正式范围为 **54 套、324 张独立图标**。

| 范围 | 计算 | 套数 | 独立图标数 |
| --- | --- | --- | --- |
| 常规与方阵子集 | 6 方向 × 2 系列 × 3 Tier | 36 | 216 |
| 最终确认：常规＋方阵＋原初 | 6 方向 × 3 系列 × 3 Tier | 54 | 324 |

方向和三个系列均已获用户确认，规格登记为 `status: confirmed`。六个方向按武器谱系区分，后续再围绕武器设计职业；不使用近战/远程/元素法术等临时职能方向，也不从现有六个数值套装名称推导。本任务的 T1/T2/T3 指装备阶段：T1 基础、T2 进阶、T3 完整，与现有词缀 Tier 的颜色/强度字段独立。

每套仅包含一种武器。若某方向后续再细分剑、斧、枪等多个武器外形，应另建明确的武器变体清单，不能静默挤入现有 216/324 张矩阵。

## 文件与资源 ID

- `standard-omega.json` / `.csv`：216 张子集清单。
- `with-primal.json` / `.csv`：324 张正式完整计划，与子集重叠的 ID 保持一致。
- 规格：`open-world/tools/equipment-art/catalog-spec.json`。
- 生成器：`open-world/tools/equipment-art/catalog.mjs`。

套装 ID 为 `gear-{series}-{direction}-t{tier}`，图标 ID 再加 `-{slot}`。例如 `gear-omega-sword-t2-helmet`。ID 不依赖中文名称、显示顺序、品质、强化等级或随机词缀。

图源计划路径为 `open-world/assets/ui-source/v2/equipment-handdrawn/{id}.png`；网页计划 URL 为 `/art/ui/equipment-handdrawn/{id}.png`。清单 `items[]` 包含导入约定的 `id / name / setId / direction / series / tier / slot / source`，其中 `source` 相对清单文件；辅助 `sourcePath` 相对 `open-world/`。它们只是预定位置，存在于清单不代表文件已生成、已审图或已接入游戏。所有清单条目初始 `productionStatus: pending`。

资产实际导入应保留自己的来源、尺寸、透明度、哈希与验收记录。生成器只负责重新生成确定性的计划，不能把计划里的 pending 全量改成通过验收来充当成品登记。

## 生成与检查

在 `open-world/` 执行：

```powershell
node tools/equipment-art/catalog.mjs
node tools/equipment-art/catalog.mjs --check
```

默认同时生成完整矩阵和其常规＋方阵子集；`--profile with-primal` 可只处理正式 324 张范围，`--spec <文件>` 和 `--out <目录>` 可对独立规格输出，`source` 随输出目录重新计算。检查模式不写文件，检查两个格式是否与规格一致。

输入必须包含六个唯一方向、六个固定部位、T1/T2/T3 和合法系列引用。输出检查套装及图标 ID 唯一、文件路径唯一、全矩阵数量、每套六个部位恰好齐全、每张图的方向/系列/Tier/部位与其 ID 对应。缺项、重复、错放部位、未登记系列和陈旧输出都会失败。

## 当前工程接入差异

以下为 2026-10-01 源码核对结果。

| 系统 | 当前实际结构 | 与本次六部位图标的关系 |
| --- | --- | --- |
| 数值装备 | `packages/contracts/index.ts` 的 `Slot` 与 schema 仅有 weapon / armor / accessory / core 四槽；快照 equipment 也只有四槽 | 衣服可对应 armor、武器可对应 weapon；头盔/鞋子/项链/戒指尚未分别成为持久装备槽。不能仅画图就宣称六槽已落地 |
| 基础装备 | `packages/rules/gear-bases.json` 为 blade、bow、coat、charm、core、shield 六种 base | “六种 base”不是六个槽位，更不是用户本次六部位套装 |
| 进阶武器 | `packages/content/deep-progression.ts` 有 omega-blade、omega-bow、primal-blade 三种模板 | 尚无完整 6 方向 × 3 Tier × 6 部位的数据目录；当前三个图标在 `apps/web/src/ui-assets.ts` 别名复用旧刀剑/弓图 |
| 现有数值套装 | `packages/content/gear-sets.ts` 有狂战士、守护者、元素使、暗影、圣光、迅捷六套，每套声明三件 | 套装加成属于现有玩法配置，不能因为同样是“六”就自动等同本次六个方向 |
| 外观分件 | `packages/contracts/appearance.ts` 七部位 head / body / hands / legs / feet / back / weapon；已发布 16 套 | 七部位用于角色骨骼分件，与装备六部位图标独立。头部分件含脸/头发，不代表可独立换头盔；没有项链和戒指骨骼分件 |
| 外观素材目录 | `packages/asset-manifest/wardrobe-catalog.json` 登记 226 套候选，其中 16 套发布，每套 14 个原始分件 | 不能将 16 × 7 或 226 × 14 当成本次装备图标生产数量 |
| 当前 UI 图标 | `packages/asset-manifest/ui.v2.json` 有六个 gear-* 图片；背包、装备 Tips 用 `art('gear-'+base)` | 新矩阵需单独正式登记及建立业务物品到图片的明确映射，禁止随机/按序映射或永久复用占位图 |

当前任务可先完成独立图标资源与展示验收。把玩法改为六槽时，应另行处理 contracts、内容模板、服务端规则、已有存档迁移、预览与装备操作，再切换业务 UI 引用。图标资源生产不应擅自触发这些玩法迁移。
