# 装备道具表

2026-10-04 更新：54 套、324 件已全部实装，`obtainable=true`、`runtimeBase=id`。真实掉落、定向锻造、六部位穿戴、2／4／6 件加成、强化与存档说明见[装备实装](equipment-runtime.md)。以下保留首次登记的字段说明和历史验收。

同日命名更新：`name` 使用正式单件名，套装名由 `equipment-set-names.json` 独立维护，分类字段不拼接入名称。完整 54 套、324 件名称见 [装备名称表](equipment-names.md)。已持有与待领取装备按基础编号显示当前名称；原属性、实例编号与历史回执保留。

2026-10-01，按用户要求将 54 套、324 件装备登记到游戏内容数据。

正式表为 [`packages/content/equipment-catalog.json`](../packages/content/equipment-catalog.json)，由 `equipment-catalog.ts` 校验并导出 `equipmentItems` 和 `getEquipmentItem(id)`。该表是可以独立编辑的内容源，运行时不读取文档或美术生产清单。

| 字段 | 含义 |
| --- | --- |
| `id` | 稳定道具 ID，例如 `primal-axe-t3-weapon` |
| `kind` / `name` | 道具类别 `equipment` 与名称 |
| `part` | 武器、衣服、头盔、鞋子、项链、戒指六部位 |
| `family` | 剑、锤、斧、法杖、暗器、魔杖六谱系 |
| `series` | 常规、方阵、原初 |
| `tier` | T1/T2/T3，美术阶段；不代表词缀品阶或战斗属性 |
| `setId` | 同系列、谱系、阶段的六件装备组；不自动产生套装加成 |
| `iconId` | 正式资源 ID，例如 `gear-primal-axe-t3-weapon` |
| `status` | `registered`，已登记 |
| `obtainable` | 当前为 `true`，已接入实际获取 |
| `runtimeBase` | 当前与 `id` 相同，对应独立运行模板 |

只读接口：

- `GET /api/content` 的 `equipmentItems` 字段返回全部 324 条。
- `GET /api/items` 返回有版本和阶段语义的完整道具目录。
- `GET /api/items/:id` 返回一条定义，未知 ID 返回 404。

现有九个战斗装备模板、四槽存档、六种野外掉落和初始装备保持原逻辑。新增目录没有追加到随机掉落用的 `gearBases` 数组，也没有把项链、戒指硬映射为旧饰品或核心。六部位穿戴、战斗数值、职业、掉落、商店和配方由后续功能配置接入。

内容检查验证 6 谱系 × 3 系列 × 3 阶段 × 6 部位的完整矩阵、ID 唯一性、分组与图标对应关系。开放获取的条目必须绑定运行模板；绑定模板的部位必须一致。

验收入口：`pnpm content`、`pnpm exec tsc --noEmit`、既有装备/掉落/养成规则测试，以及 `node --import tsx tools/equipment-art/accept-published.mjs --catalog`。后者访问真实本机服务，验证表与内容接口一致、六部位查询、未知项 404、图标解码、旧掉落池、账号登录和角色装备恢复。

本次上述检查已通过：27 项既有测试通过，实际服务返回 324 条定义，六部位单项查询与未知项 404 正常，全部图标成功解码；刷新后角色及装备保持一致。实际版本为 client `0.6.1`、protocol `7`、rules `ow-7`、assets `world-art-20261001-v5`、db `9`。完整记录见 [接口与浏览器验收](../../docs/reviews/open-world/equipment-item-catalog-20261001/result.json)。
