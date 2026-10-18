# 音频制作验收报告

最终状态（2026-10-15）：硬阻塞，未满足交接完成定义。A0–A10的可执行制作与验证已运行；被动转换事件缺口、素材残差及未覆盖项保留，不能标记全项完成。

## 产物

| 类别 | key数 | key/阶段组 | 文件数 | wired组 |
|---|---:|---:|---:|---:|
| cue | 30 | 30 | 68 | 25 |
| player | 83 | 291 | 586 | 291 |
| voice | 63 | 282 | 564 | 252 |
| foley | 28 | 38 | 89 | 25 |
| ui | 43 | 43 | 83 | 20 |
| amb | 15 | 15 | 15 | 14 |
| stinger | 12 | 12 | 12 | 12 |
| combo | 23 | 79 | 158 | 79 |
| system | 2 | 7 | 14 | 7 |
| status | 21 | 117 | 234 | 117 |
| mechanism | 8 | 8 | 16 | 7 |
| accent | 6 | 6 | 12 | 6 |
| monster | 61 | 230 | 460 | 230 |
| boss | 39 | 180 | 360 | 180 |
| affix | 6 | 12 | 24 | 7 |
| world | 20 | 20 | 40 | 8 |
| ambient-detail | 42 | 42 | 84 | 42 |
| source | 12 | 12 | 12 | 12 |

实际WAV文件 2831 个，合计 142241526 字节。高于80MB；已依裁决将新环境降至24kHz、非高频变体降至2，高频保留至少3。原标杆不降低变体数。可选 `node tools/audio/transcode.mjs`，本期未运行转码。

## 客观验收

最后一次检查共有 823 项残差。分类：响度/时长/其他 45；变体差异 38；跨key频谱相关 679；首领预警 61。
三版渲染残差依次为3835、917、819；最终检查增加规范覆盖后，以这里读取的当前检查结果为准。未放宽阈值，也未把未接入项标成wired。

| 检查 | 结果 |
|---|---|
| A0原始标杆 | 23组复跑通过，日志 .qa/audio-production/baseline-build.log |
| A1验收自检 | 4项通过 |
| 音频相关单测 | 8文件20项通过（新增状态信号2项独立验收）；当前所有229个特效键阶段有采样或明确兜底 |
| TypeScript | 通过 |
| 生产Vite构建 | 通过 |
| QA Vite构建 | 通过 |
| 全量vitest | 未通过：1760通过、10失败、2个原有跳过；5个文件失败、243个文件通过。新增状态信号2项另行通过 |

最差三类单文件指标（每类前三）：

- small_loss：amb/dungeon-rift/loop v1 = 2.0；cue/crit/one v1 = 1.4；cue/crit/one v2 = 1.2
- low200：amb/dungeon-rift/loop v1 = 0.33；player/fireball/impact v1 = 0.26；voice/dusk-humanoid/death v2 = 0.26
- harsh：voice/ss-boss-fog-quartermaster/warning v1 = 1.0；voice/ss-boss-fog-quartermaster/warning v2 = 1.0；voice/ss-boss-ice-patrol/warning v1 = 1.0

残差示例（完整原始明细仅留本地）：

- 同类冲击差 cue/impact-light/one: cue/hurt 与 cue/loot 4.0dB > 3
- 同类冲击差 cue/impact-heavy/one: cue/drop-epic 与 cue/shield-break 3.2dB > 3
- 同类冲击差 cue/stinger/one: cue/loot-legendary 与 cue/drop-legendary 3.8dB > 3
- 同类冲击差 player/cast/cast: player/frost_bolt 与 player/frost_quake 7.3dB > 3
- 同类冲击差 player/impact-heavy/impact: player/guardian_angel 与 player/root 5.4dB > 3
- 同类冲击差 voice/impact-light/death: voice/ss-elite-rift-hunter 与 voice/plant 6.8dB > 3
- 同类冲击差 foley/foley/one: foley/blink 与 foley/step-stone 14.0dB > 3
- 同类冲击差 ui/ui/one: ui/badge 与 ui/click 9.1dB > 3
- 同类冲击差 stinger/stinger/one: stinger/level-up 与 stinger/death 5.2dB > 3
- 同类冲击差 player/cast/release: player/thunder_arrow 与 player/stun_strike 5.2dB > 3
- 同类冲击差 player/cast/flight: player/thunder_arrow 与 player/frost_bolt 6.2dB > 3
- 同类冲击差 combo/cast/cast: combo/aspect-combo-sunder 与 combo/shatter 4.7dB > 3
- 同类冲击差 combo/cast/release: combo/aspect-combo-sunder 与 combo/aspect-combo-warpath 4.0dB > 3
- 同类冲击差 combo/impact-light/impact: combo/sword-qi 与 combo/aspect-combo-cascade 3.3dB > 3
- 同类冲击差 status/cast/cast: status/vulnerable 与 status/armor_down 4.2dB > 3
- 同类冲击差 status/impact-heavy/impact: status/attack_up 与 status/root 3.6dB > 3
- 同类冲击差 status/cast/tick: status/attack_up 与 status/stun 3.4dB > 3
- 同类冲击差 status/cast/end: status/time_stop 与 status/fear 3.4dB > 3

## 接入与未完成范围

已实现五总线/五滑块/后台静音、当前技能预载、按需采样、保留合成兜底、真实掉落动画声音、公共按钮/面板、真实位移脚步、状态结束与跳伤、连携点缀、机制事件、怪物躯体/首领预警、环境流式与定点衰减。具体实现与复验命令见 runtime.md。
硬阻塞§7.1：被动移速转伤害没有实际生效事件；mechanism/speed保留素材但wired=false，见blocked.md。尚未完成：全库孪生音归零、所有层级/同组差通过、全部首领预警辨识度通过；部分界面/动作/状态专属触发尚无已确认公共入口，见 uncovered.md 和清单wired=false项。音乐与真实生物声为外采。
标杆来自既有交接；本次不宣称重新创作标杆。DSP修复采样取整不一致和循环端点2ms衔接，benchmarks.py配方与TIERS不变。

## 兜底电平

8组离线近似测量：采样冲击响度比旧兜底中位高12.8dB；按交接一次调整synthGain 0.4→1.736。测量不含浏览器带限振荡和最终限幅器差异。工具 measure_fallback.py / export-fallback.ts，原始数字 .qa/audio-production/fallback-review.json。

## 试听与安全边界

- 快速试听：`.qa/audio-production/quick-reel.wav`（47段/76.8秒），标签`quick-reel.txt`。
- 试听合集：`.qa/audio-benchmarks/benchmarks-reel.wav`。
- 时间标签：`.qa/audio-benchmarks/benchmarks-reel.txt`。
- QA入口：`audio-qa.html`，仅qa模式构建；每条显示采样/合成兜底/缺失、tier、source与接入状态。
- 全量测试使用自有临时数据库；无8612正式库访问、无8790登录/写调用、无无头浏览器。
- 未修改战斗模拟、服务端、伤害判定、scene.ts、combat-vfx.ts、shield-feedback.ts或物理技能特效文件。
- 不对听感作结论；由用户试听裁决。

## 恢复

全部本期验证进程已退出，自有临时数据库已清理（剩余0字节）。先按blocked.md由模拟所有者提供实际转换事件，再恢复接入与验收。未提交：完成门槛未通过，且共享文件须仅暂存本期差量；没有提交或回退其他会话改动。


## 全量失败的小汇总

| 文件 | 失败数 | 证据 |
|---|---:|---|
| earned-all-quests.database.test.ts | 1 | 两条裂隙地城引导任务未完成；实际流程记录角色倒下/任务不可接取 |
| numeric-spine-bench.test.ts | 1 | 标准人50/B3单帧扰动误差约7.41%，门槛2% |
| first-chapter-combat.test.ts | 6 | 1/2级三类构筑的首领预警计数为0，要求大于0 |
| world-natural-calendar.database.test.ts | 1 | 原600秒超时，未提高时限 |
| copy-voice.test.ts | 1 | crafting.ts三处文案禁词；后续单独复查仍失败 |

最终类型检查第一次发现外部crafting.ts的TS2352；检测到该文件被其他会话更新后，已重新运行tsc，最新结果0错。本期未修改crafting.ts或以上测试。全量当次结果保留，不用单项复查覆盖它。

结构化小汇总见validation-summary.json；原始日志仅在`.qa/audio-production/full-tests`。未提交任何`.qa`留档。
