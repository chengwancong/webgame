# 拾星港工坊：强化与重铸只在工坊（2026-10-11）

用户反馈「在背包里可以直接重铸属性，这很奇怪」。2026-10-11 用户选定：

- 重铸「只在港口工坊」；
- 「强化也搬去工坊」。

背包和人物页只能看、穿、锁定、分解。

## 玩家看到的

- **背包 / 人物页**：
  - 装备详情只列副属性，并加一行「强化与重铸：前往拾星港工坊」。
  - 没有强化按钮，也没有重铸区。
- **拾星港工坊**：
  - 打开入口：
    - 港口锻造台（19,20）旁的「打开工坊」交互；
    - 机巧师·铜铃的「打开工坊」服务；
    - 旧营地锻造台。
  - 左边先列身上的装备，再列背包。
  - 右边是详情：主属性 → 强化消耗 → 副属性 → 重铸（选一条 → 看消耗 → 重铸该条）。主按钮是「强化」。
- **离开工坊**：剧情服务按钮、战斗复盘的「强化武器 / 护甲」建议都只提示「强化和重铸请到拾星港工坊（港口锻造台旁）」，不再打开人物页。

## 服务端（`apps/api/src/app.ts` `/api/gear/upgrade|reroll`）

请求体带 `region` 和 `position`（主角当前位置），检查方式同悬赏板。不满足任一条件就拒绝，且不扣任何资源：

| 条件 | 错误码 |
|---|---|
| 不在副本中（`dungeon.instance` / `pendingResult`） | `FORGE_PLACE` |
| 所在区域有 `kind=forge` 地标，且主角离它不超过 5 格 | `FORGE_PLACE` |
| 锻造功能已开放 | `STORY_LOCKED` |
| 仅重铸：角色等级 ≥ `inscriptions.json` `reroll.level`（23，见 `build-depth-design.md`） | `REFORGE_LEVEL` |

装备提示 `tip.reforge` 增加 `level`，并给出原因（未开放 / 等级不足）；工坊页把原因显示在重铸消耗上方。

## 配置

- `config/excel/NPC.xlsx`：铜铃的 `service_panel` 从 `character` 改为 `forge`，批注已同步。
- `packages/content/inscriptions.json`：`reroll.level = 23`。

## 验收

- `tests/inventory-ui-system.test.ts`：
  - 背包和人物页不出现强化按钮和重铸区，并有工坊提示；
  - 工坊页有强化按钮，没有分解；
  - 工坊列表先列身上的装备。
- `tests/build-variety-r4.database.test.ts`：以下三种情况被拒，且角色存档逐字不变：
  - 不带位置；
  - 离锻造台远；
  - 等级 < 23。
- 其余调用强化或重铸的数据库测试都改为带锻造台位置：`database`、`equipment-runtime`、`item-affix-power`、`build-variety-r6`、`world-natural-calendar`。
- 旧的 headless 验收脚本（`tools/accept-*.mjs`、`verify-enhancement-stones.mjs`）仍点背包里的强化，已经过时，不再作为验收依据。
