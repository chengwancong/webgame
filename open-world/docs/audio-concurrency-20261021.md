# 音频并发与分类音量核对（P39/P40，2026-10-21）

结论（代码核对 apps/web/src/audio/mixer.ts、settings.ts、production.ts）：

1. 分类音量已存在：settings 含 master / music / ambience / effects / ui 五路 + 后台静音（settings.ts:3、production.ts:20），战斗音走 effects、界面音走 ui，无需再补滑条。P39 关闭。
2. 总并发有上限：`mixerLimits={voices:12, perFrame:12}`（mixer.ts:5）；超限时按 priority 淘汰低优先级音（VoiceGate.admit），同 id 有 cooldown，UI 音按 `cooldown/30` 秒去抖（mixer.ts:41）。无需新增总限。
3. 风险点（W04/W05 接线时须遵守）：新增 foley/affix 音效必须传入 priority（不得全用最高档），脚步/命中类必须带 cooldown ≥3 tick，否则会在大怪群中挤掉 warning/首领语音。
4. 后续只在接入新音效后做一次“怪群 + 首领狂暴”人工听感复核（用户试玩期间）。P40 关闭为“上限已在，约束已记”。

## P43 复核（W05 触发点，2026-10-21）

- world/beacon-activate、world/teleport、return-town、key-use：均由玩家一次性操作触发（main.ts 397/403 等），无循环触发路径，受 mixerLimits（voices12/perFrame12）总限保护。
- world/npc-bubble：边沿触发（bubbleId 变化才响）+ `sounds.allow(...,1500)` 冷却，已具备 cooldown。
- world/clue、affix 冲击音：走 `gate.allow(key,tick)` 同 tick 去抖路径（foley-events.ts），战斗密集时由 perFrame 上限兜底。
- 结论：无缺 cooldown 的循环触发点，无需追加改动；若实机出现爆音再对 affix 冲击音单独加 priority。
