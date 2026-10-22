# D14 词缀装备的地面辨识与自动拾取（Claude 默认裁决，2026-10-21）

## 问题（证据）
- 词缀装备（`gear.hex`，contracts/index.ts:96）只随掉落获得，是新核心追求；但地面掉落标签/光柱只按品质着色（`ground-loot-renderer.ts:34` 标签、`:15` 光柱仅 rare/legendary），玩家看不出哪件带词缀，普通品质带词缀的件会被当垃圾。
- 自动拾取过滤 `packages/rules/pickup-filter.ts` 的 `acceptsPickup` 只看品质/部位：玩家把最低品质设为“稀有”后，common/magic 的词缀装备永远不会被自动拾取，也无提示。

## 裁决
1. **地面辨识（前端，P48）**：`r.gear.hex` 存在时——标签前缀「◆」；标签色仍为品质色；无底座光圈（遵守 AGENTS 2026-10-11），并让光柱对 common/magic 也短暂出现（高度 90、1200ms），rare/legendary 沿用原光柱。悬停全名后缀显示机制名（取 `hexRunes` 目录名）。`reduced motion` 下只保留 ◆ 前缀。
2. **自动拾取（后端，P49，交 Codex）**：`acceptsPickup` 对 `gear.hex` 存在的装备**忽略 minimumQuality**（仍遵守 excludedSlots 与 ownWeaponOnly 的“部位排除”，ownWeaponOnly 对词缀武器不放行，保持过滤语义最小改动）。该规则在 rules 单测里加 3 个用例：common+hex 通过 rare 过滤；common 无 hex 被拦；excludedSlots 仍拦 hex。
3. 不改掉率/词缀内容；不新增设置项。

## 验收
- P48：构造含 `gear.hex` 的 Reward（QA 页 `ground-loot-qa.ts` 加一件 common+hex），地面见 ◆ 前缀与短光柱（无底座光圈）；无 hex 的装备外观不变；单测覆盖标签前缀逻辑（纯函数）。
- P49：上述 3 个用例通过；原有 pickup-filter 用例不变。

- 2026-10-21 Claude 默认裁决（P48-R02）：移除 hex 掉落的六角底座光圈及 hexHaloColor，保留 ◆ 前缀、机制名悬停与短光柱。
