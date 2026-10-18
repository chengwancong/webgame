# 战斗手感整改验收 · 2026-10-05

实施及功能浏览器验收完成；自动化保留两项改动前存在的失败。未修改历史伤害快照或已有玩家成长、存档与奖励数据。

## 自动化结果

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit -p .` | 通过 |
| `node tools/build-ui-tokens.mjs --check` | 通过，320 个当前工作区 Token |
| 新增事件/飘字/打击/盾/音效测试 | 22 项通过 |
| 相关 simulation/VFX/UI Token 测试（单 worker） | 190 项，188 通过、2 项既有失败 |
| `npx tsx tools/validate-content.ts` | 通过：26 地区、55 技能、60 角色 |
| `npx vite build --config apps/web/vite.config.ts` | 通过；停止服务 → 构建 → 恢复服务，保留数据 |
| 种子 41、600 tick 的改动前对照 | 伤害序列、主角、击杀及 RNG 状态一致 |

既有失败均用本次改动前的模拟代码复现，记录在 `baseline-tests.log`：

1. `skill-mechanisms.test.ts` 的战吼/普攻预期：预期 14，实际 25。
2. `vfx-v2.test.ts` 的历史 `player/cut` 快照：预期 HP 9982，当前工作区实际 9971。

机器可读摘要见 [automation-results.json](automation-results.json)；完整输出见本机保留的 `final-tests.log`（原始日志由 Git 忽略）。没有把旧金标改成当前结果；本次新增的种子对照单独保存为 `tests/fixtures/combat-feedback-before.json`，并验证最终 `randomState`。

## 浏览器与视觉

`node tools/verify-combat-feel.mjs` 使用独立 QA 入口和实际模拟器事件，共 15 组检查：hit、crit、kill、minor、hurt、heal、shield、break、expire、miss、boss、ice、snapshot、reduced、stress。

- 暴击为浅金大字，普通数字与次要数字区分；DOT 同目标/元素合并。治疗绿色，伤害为负号红字。
- 护盾获得与吸收提示保持可见行距；全额吸收有文字、高光及涟漪，主角没有红闪。盾破 14 片碎片；到期没有碎片、震动或破盾声。
- 圣盾奶白浅金，冰盾保留冰晶与冰色；后半盾深度低于角色，前半盾高于角色。
- 快照替换不中断飘字与盾面涟漪；减少动态效果时动画冻结、缩放和位移关闭。
- 数字上限 28，粒子不超过 384，Graphics 池分配达到稳定值。
- 音效触发、合成、声部上限、限频、优先级由浏览器与单测验证；自动化未评判主观听感。
- 实际账号登录、营地画面、刷新恢复会话成功；health/content 版本一致，运行时错误为零，viewport 恢复 desktop。

协议与服务版本：client 0.10.14 / protocol 19 / rules ow-34 / assets world-art-20261005-v21-collision / db 12。常驻任务恢复，账号与原有存档保留。

详细状态见 [runtime.json](runtime.json)。关键截图：[暴击](crit.png)、[治疗](heal.png)、[圣盾吸收](shield.png)、[冰盾](ice.png)、[破碎](break.png)、[到期](expire.png)、[减少动态](reduced.png)、[营地](camp.png)。

## 实时性能

`node tools/verify-combat-feel.mjs --hardware-performance`，Chrome / ANGLE / RTX 4070 SUPER / D3D11，1280×720。混战为 12 个目标，每 3 tick 同时命中一轮（约 120 次命中/秒），不包含持久奖励链路。

| 场景 | 平均 FPS | 帧耗时 p95 | 逻辑 p95 | 场景渲染 p95 |
| --- | ---: | ---: | ---: | ---: |
| 基准 | 60.0 | 16.69ms | 0.50ms | 1.30ms |
| 混战 | 58.5 | 21.68ms | 4.40ms | 2.10ms |

平均帧率保留 97.5%，数字 28 个，硬件运行池峰值 active 144、allocated 156。另一轮 SwiftShader 软件渲染中，池 allocated 180 在延长运行后仍为 180，证明复用达到平台期。软件渲染整帧 p95 50ms 不作为硬件结论；上述性能只适用于本机与这个压力场景。

硬件证据见 [hardware-performance.json](hardware-performance.json)。生产构建保留既有大 chunk 提示，没有更改打包架构。
