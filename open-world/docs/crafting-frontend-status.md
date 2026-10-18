# 制作系统前端进度（Claude）

对应设计：`docs/crafting-system-design.md`；后端交接：`docs/crafting-backend-handoff-20261014.md`。前端只做展示和发命令，数量、价格、概率、结果都以服务端为准。

## 已完成（2026-10-15）

| 步骤 | 内容 | 主要文件 |
|---|---|---|
| F1 | 显示用数据模型：材料分组/图标兜底、配方筛选、选项归一、消耗行、错误码提示 | `apps/web/src/crafting-model.ts` |
| F2 | 工坊页签：强化·重铸 / 制作 / 图样 / 提纯 / 精工 / 钥匙 / 设施；预览走 `crafting/preview`，提交走 `crafting/action` | `crafting-controller.ts`、`components/CraftingPanel.ts`、`crafting-panel.css` |
| F3 | 背包材料按产地分组（产地下拉筛选）、岛屿材料详情 + “前往工坊”；旧 ore/herb/leather 仅持有时显示 | `bag-model.ts`、`components/BagPanel.ts` |
| F4 | 野外采集点：按 E 采集（`field/gather` manual）、全自动只采路线 2 格内的点（route，不绕路、每点每次进图只试一次）；采过的点隐藏 | `gather-nodes.ts`、`main.ts`、`scene.ts`、`starsea-controller.ts` |
| F5 | 消耗品改为读制作表：合剂 / 抗性药剂 / 食物，显示数值与持续击杀数，提示“同类同时只能生效一种” | `bag-model.ts`、`components/BagPanel.ts` |

测试：`tests/crafting-ui.test.ts`（新增）、`tests/bag-ui.test.ts`（按材料迁移 ore→wind_ore 更新断言）。

## 依赖后端 / 待确认

- K5：`consumable.use` 支持 resist_* / food_*，同类互斥；前端已按此展示，后端未完成前使用会被拒。
- 采集点 `world.json` 的 `resource` 是 UI 图标 id（`item-material-ore/plant`），不是场景资源；前端已改用岛屿岩石/灌木道具图兜底，场景预加载也跳过这个字段。
- 图样配方岛屿分布偏斜：雾铃 / 霜镜 / 龙眠各只有 5–6 个配方。

## 美术缺口

- 岛屿材料图标 24 个（6 岛 × 矿/草/部件/首领），现用同类图标 + 色相区分。
- 抗性药剂、食物图标；野外采集点专用道具；工坊 3 档外观。

## 未做

- GUI 冒烟（等后端 K 批次结束、常驻库空闲后在内置浏览器里跑）。
- 小地图剩余采集点数（`GatherNodes.count()` 已备好，未接入小地图）。
