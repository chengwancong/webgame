# 音频运行时与复验

音频唯一清单由 `tools/audio/build.py` 生成。离线配方在 `tools/audio/recipes`，标杆函数保留在 `benchmarks.py`。Python只使用按key/阶段/变体派生的种子。

- 主输出经过限幅器。combat/ui/music/ambience/foley五总线；foley使用音效滑块。
- 首领预警、提示音乐触发0.6秒的6dB压低；自身绕过被压低的总线，但仍受对应音量控制。
- 怪物通用衰减6dB；敌方技能另衰减3dB。已有屏幕可见性参数继续生效；躯体声音使用18格近域限制。
- cue/foley/ui及当前装配技能预载，其余首次合成兜底、异步加载采样。环境不解码进AudioBuffer，使用HTMLAudioElement。
- 场景掉落从GroundLootRenderer落地/拾取事件发声。初次入区已有掉落不重播落地音。
- UI只在公共组件挂载；成功音消费成功回执。游戏暂停时UI限频使用音频时间，声部预算每音频帧重置。
- 设置保存在aw-settings.audio，保留旧volume兼容。音乐URL为空，素材外采前不发出伪音乐。

复验命令（open-world目录；每次先确认无其他重任务）：

```powershell
python -X utf8 tools/audio/build.py
python -X utf8 tools/audio/test_validation.py
node node_modules/vitest/vitest.mjs run tests/audio-coverage.test.ts tests/audio-production.test.ts tests/audio-routing.test.ts tests/skill-sound-mixer.test.ts tests/combat-audio.test.ts tests/skill-audio-events.test.ts tests/skill-audio-vfx-structure.test.ts --maxWorkers=1 --no-file-parallelism
node node_modules/typescript/bin/tsc --noEmit
node tools/audio/run-tests.mjs
```

全量单测启动独立临时PostgreSQL；拒绝8612/8790端口，不连接正式库、不调用8790登录/写接口。全量日志仅存`.qa/audio-production/full-tests`。不运行无头浏览器。

QA入口`audio-qa.html`仅在Vite的qa模式构建。试听合集`.qa/audio-benchmarks/benchmarks-reel.wav`，标签同目录`benchmarks-reel.txt`。音频是否好听由用户试听判定，自动验收只报告客观指标。
