# 音频制作进度

任务日期2026-10-14；收尾日期2026-10-15；工作目录 `open-world`。**最终状态：硬阻塞，未满足全部完成定义。**遵守三版后记录残差，不放宽验收；不把生成文件冒充真实触发。

| 批次 | 状态 | 产物与验证 |
|---|---|---|
| A0 | [x] 完成 | census.md；23组标杆复跑通过；83玩家/61怪物/39首领/23连携/21状态；103怪物模板映射 |
| A1 | [x] 完成 | recipes拆分、清单来源/授权/说明、3项新增验收；4项自检通过 |
| A2 | [ ] 有残差 | 反馈、真实落地/拾取、防疲劳和满包钩子已接入；第五品质仅预留、部分经济声音待挂载；素材质量未全过 |
| A3 | [ ] 有残差 | 83技能全部采样映射；11元素/12形态/25明确标星；孪生与层级未全过 |
| A4 | [ ] 硬阻塞 | 状态结束/跳伤、连携六点缀及7类可观察机制已接入；移速转伤害缺少模拟生效事件，见blocked.md；素材质量未全过 |
| A5 | [ ] 有残差 | 9躯体、103模板映射、100敌方技能、30首领预警（含6旧首领）及精英/稀有；预警辨识度未全过，enrage等未接入项保留wired=false |
| A6 | [ ] 部分完成 | 脚步、公共按钮/面板、成功回执、武器基础层和预载策略已接入；其他界面/动作见uncovered.md |
| A7 | [x] 实现及接缝完成 | 15底噪、每区6种非生物点缀、12定点；流式/2秒切换/距离衰减；24秒循环接缝通过，跨key质量残差仍保留 |
| A8 | [x] 实现完成（素材残差保留） | 12提示音乐已生成并挂到确认状态/事件；五滑块/后台静音/静音音乐状态机/压低/外采清单完成；声望仅在读取服务端已解析rank变化时播放 |
| A9 | [x] 实现与单测完成 | audio-qa仅QA构建；229特效键阶段覆盖0缺失（含明确兜底）；8组兜底测量，synthGain一次0.4→1.736 |
| A10 | [ ] 验证结束，未过门槛 | 音频20项通过；最新tsc通过；生产/QA构建通过；全量1760通过/10失败/2原有跳过；报告与标注已写，未提交 |

## 实测记录

- 第一版：1376组/3715文件/3835项残差。
- 第二版：1424组/2831文件/917项残差。
- 第三版：1424组/2831文件/819项残差；最终补全规格检查后为 **823** 项。采用第三版，不再第四轮调配方。
- 删除本期降变体留下的980个旧WAV，未删标杆或未知文件；当前总量142241526字节，仍高于80MB，按裁决等待可选转码。
- 音频相关8文件20项通过（状态信号新增2项独立通过）；新增限频与可见性复验通过；类型检查通过。
- 当前每类数量、残差示例、素材来源、试听路径见report.md。完整日志只在`.qa/audio-production`、`.qa/audio-benchmarks`。

## 最终验证与恢复

- 自有临时库端口9784，已停止并删除，剩余0字节；所有本期重任务已退出。
- 音频8文件20项通过；新增状态信号2项在全量启动后创建并独立验证，不混入全量当次1772项总数。
- 全量当次：243文件通过、5文件失败；1760项通过、10项失败、2项原有跳过。耗时2715.73秒。
- 全量失败：任务全流程1、数值测量台1、第一章战斗预警计数6、自然进度600秒超时1、crafting文案1。没有改断言、跳过或删测试。
- 最终tsc初次发现其他会话的crafting.ts类型错误；检测到该文件随后更新，再复验为0错。文案单测复查仍失败（crafting.ts三处禁词）。
- 生产/QA构建均通过，输出在`.qa/audio-production/dist-production`与`dist-qa`；未覆盖正式服务构建目录。
- 已确认硬阻塞§7.1：被动移速转伤害没有实际生效事件。已保留素材并设wired=false，不以其他事件冒充，详情见blocked.md。
- **未提交**：全项完成门槛尚未通过；工作树及`.qa/audio-production/own-delta.patch`保留，未暂存或提交他人改动。

恢复前提：由被授权的模拟所有者提供实际转换的只读事件；恢复事件消费后，生成清单并依次复验。全量中的非音频失败由对应规则/任务所有者处理，不在音频层绕过。

精确复验命令（先确认无其他重任务）：

```powershell
python -X utf8 tools/audio/build.py
node node_modules/vitest/vitest.mjs run tests/audio-state-signals.test.ts tests/audio-coverage.test.ts tests/audio-production.test.ts tests/audio-routing.test.ts tests/skill-sound-mixer.test.ts tests/combat-audio.test.ts tests/skill-audio-events.test.ts tests/skill-audio-vfx-structure.test.ts --maxWorkers=1 --no-file-parallelism
node node_modules/typescript/bin/tsc --noEmit
node tools/audio/run-tests.mjs
python -X utf8 tools/audio/report.py
```

最差三类指标：

- small_loss：amb/dungeon-rift/loop v1=2.0；cue/crit/one v1=1.4；cue/crit/one v2=1.2
- low200：amb/dungeon-rift/loop v1=0.33；player/fireball/impact v1=0.26；voice/dusk-humanoid/death v2=0.26
- harsh：voice/ss-boss-fog-quartermaster/warning v1=1.0；voice/ss-boss-fog-quartermaster/warning v2=1.0；voice/ss-boss-ice-patrol/warning v1=1.0

全量测试结束后已对最终状态信号接线重新运行tsc与生产/QA构建。快速试听`.qa/audio-production/quick-reel.wav`（47段、76.8秒）；完整合集与时间标签见report.md。

## 录音版（2026-10-17）

用户裁决：合成音效「完全不行」，全部音效改用免费可商用录音（CC0 + Sonniss GDC，授权与来源见 `tools/audio/sourcing/sources.md`）。

- 管线不变：`tools/audio/recipes/recorded.py` 在注册末尾替换各配方 fn，响度档/变体数/wired 不变；素材包缺失时自动退回合成。
- 素材：CC0 10 包 + Sonniss 395 文件，切成 1596 个片段（`.qa/audio-sourcing/pack`，只留本地）。
- 短音效 32kHz 单声道，环境 24kHz 立体声 24 秒；合成版备份在 `.qa/audio-synth-backup`。
- 第三轮全量：2831 文件，161MB（合成版 142MB），残差 **315** 项（合成版 823），阈值未改。
- 主要残差：环境循环互判孪生（24kHz 文件在检查最高频带 13.9–16kHz 无内容，z 分数被该带主导，属测量偏差）；同阶段技能孪生、同类冲击差（极短点击类无法靠限幅抬冲击感）、个别变体频谱相关 <0.8。
- 待用户试听：`.qa/audio-recorded/audition.html`（launch 配置 audio-audition，端口 8623），按反馈再调。
