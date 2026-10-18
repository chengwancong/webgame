# 前端集成检查

2026-10-15，后端全量回归观察到前端同批工作已经接入。以下是首轮历史检查结果，不修改 `apps/web/src`。

首轮`tests/copy-voice.test.ts`曾发现4处；2026-10-15设计裁决确认Claude已修复且测试通过。本轮不修改或复验前端，以下保留历史位置：

| 文件与行 | 当前文案 | 可用表述 |
|---|---|---|
| `apps/web/src/crafting-model.ts:96` | 请先通过对应阶段。 | 请先通过对应地城。 |
| `apps/web/src/components/CraftingPanel.ts:55` | 制作结果由服务端确定，预览不消耗材料。 | 预览不消耗材料，完成制作后才扣除费用。 |
| `apps/web/src/components/CraftingPanel.ts:81` | 消耗与结果以服务端为准，被锁定的词缀保持不变。 | 锁定的词缀保持不变，其余词缀重新随机。 |
| `apps/web/src/components/CraftingPanel.ts:87` | 进入新阶段地城后，这里会显示钥匙材料进度。钥匙材料只在本阶段地城获得。 | 进入新的地城后，这里会显示钥匙材料进度。请在当前地城收集材料。 |

复验命令：`pnpm exec vitest run tests/copy-voice.test.ts --maxWorkers=1 --no-file-parallelism`。

后端交付入口仍为交接第3节和 `packages/contracts/crafting.ts`。实际材料34种、配方376条、图样334种、采集点150个。K8已按2026-10-15新裁决完成，详情见进度及结果报告。
