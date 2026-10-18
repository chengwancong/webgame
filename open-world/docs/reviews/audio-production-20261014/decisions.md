# 音频裁决

| 时间 | 问题 | 裁决 | 影响 |
|---|---|---|---|
| 2026-10-14 | 工作目录比请求路径深一层 | 所有相对路径以 open-world 为根 | 本期文档 |
| 2026-10-14 | 需求与交接规格冲突 | 执行交接：WAV16bit、环境24秒、清单由build生成、不建Excel、压低6dB/0.6秒 | 管线及运行时 |
| 2026-10-14 | 其他会话正在全量vitest | 等待结束，先做轻量静态盘点；不终止他人进程 | A0渲染调度 |

| 2026-10-14 | 当前怪物103而需求75；招牌明确标星25项 | 按当前103模板覆盖，明确标星25项；不凭约数杜撰技能 | census.md、catalog.json |

| 2026-10-14 | 兜底与采样冲击差 | 8组离线近似测量，中位采样高12.8dB，synthGain一次从0.4调到1.736；不重复调 | mixer.ts、measure_fallback.py |
| 2026-10-14 | 全库首版172MB超过80MB | 新环境24kHz，非高频2变体，高频至少3；原标杆变体不动，仍超则报告等待转码 | recipes注册 |

| 2026-10-14 | 第二版严格验收917项残差 | 第三版修正变体共鸣偏移、预警双音结构；修复DSP循环拼接2ms差分，标杆配方与TIERS不改。第三版后保留最接近版本并逐项记录残差，不改阈值 | recipes、dsp.py |

| 2026-10-15 | 疾行被动移速转伤害没有实际触发事件 | 硬阻塞§7.1：simulation/index.ts约516行直接计算bonus并改amount；约566行effectTriggered仅覆盖ExecutableRule。禁止在表现层重算公式，也不能用dash/moving规则事件冒充。保留mechanism/speed素材但wired=false；需要模拟所有者提供只读生效事件后恢复 | production.ts、recipes注册、blocked.md |

| 2026-10-15 | 宝箱/剧情/声望没有统一音频回调 | 比较服务端已确认快照中的done/gates/rumors/waypoints/quest.step与DungeonView.claimed；声望只读ProgressionView.rank，不新增轮询或复制公式；初次恢复不补播 | state-signals.ts、audio-state-signals.test.ts |
