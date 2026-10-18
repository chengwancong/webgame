# 已批准预警接入 · 2026-10-03

用户认可 `.design/telegraph-polish/concepts/01-circle-comparison.png` 右侧方案并要求先接入预警。本次修改正式 `SkillEffects` 渲染入口，覆盖普通怪与 BOSS 的圆形危险范围、延迟区域与光束预警。移除粗黑边、固定三角和中心符号，采用细珊瑚边界、柔和地表材质、单条暖金倒计时弧与柔光亮点；屏幕层继续仅显示倒计时／施法条。范围来自真实世界判定，时间来自战斗时钟。伤害、费用、冷却与技能机制未在本次特效修改中调整。

## 已有资源复用

优先资源库：`G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套`。已发现 300 atlas、300 GIF、286 JSON、15 skel、300 spine、9,637 PNG；这些是文件盘点，不等于 300 套均已通过动态验收。抽查首套 JSON 为 Spine 3.7.93。

这次实际复用 `001-10000222/0/TX/gaoguang.png`，原始 18×18 RGBA 字节不变，SHA256 为 `cec9374d7529ace1fb848f41510fc6f8f5338fe4ed1269accb1bb8afab35344e`。仅在运行时调整尺寸、颜色与透明度，运动跟随真实倒计时弧。登记见 `open-world/packages/asset-manifest/telegraph-reuse.json`；构建工具验证原件哈希后复制到 public。

此项是静态部件复用，**未导入整套 Spine 原始动画**。检查过的其他光圈有重复轮廓或不规则外缘，不适合作为精确判定边界；危险边界由程序绘制。地表距离渐变为缓存的程序材质。后续“先直接复用，再微调复用，缺少合适资源才新制”的要求已写入根目录 `AGENTS.md` 和 `项目.md`。

## 实机证据

- `before-grass.png`、`after-grass.png`：同镜头、同技能的真实运行截图。
- `after-snow.png`、`after-dark.png`、`after-beam.png`：雪地、暗地与光束检查。
- `before-normal.webm`、`after-normal.webm`、`after-slow.webm`：正常速度前后对比与 0.25x 慢放，录制结束后场景继续播放。
- `video-proof.json`：浏览器读取录像尺寸均为 1280×720，无媒体错误；正常速度新版完成解码，其余两项已读取有效媒体头。
- 正式预览：<http://127.0.0.1:8612/monster-vfx-qa.html>，保留 1x 连续标杆播放。

## 检查与性能

21 项检查通过：`telegraph-polish` 4、`enemy-vfx` 7、`blizzard-vfx` 2、`vfx-v2` 5、`ui-tokens` 3。覆盖真实椭圆投影、范围不随进度变动、曲线采样上限、减少动态的确定性、原始 PNG 哈希与现有战斗事件追踪。生产 Vite 构建成功。

本机 RTX 4070 SUPER，原生 D3D11 ANGLE，1280×720：

| 负载 | 600 帧 P95 | 逻辑 P95 | 场景 P95 |
| --- | --- | --- | --- |
| 20 怪／30 补充弹体，首次 | 20.03ms | 1.30ms | 4.80ms |
| 20 怪／30 补充弹体，复测 | 16.69ms | 0.70ms | 3.10ms |
| 60 怪／100 补充弹体 | 18.34ms | 1.40ms | 5.40ms |

敌人中包含巫师、炮兵与远程怪，预警来自真实战斗核心；为维持目标负载而补充的零伤害弹体不用于证明技能伤害机制。高负载装饰峰值丢弃 156 项，危险范围使用关键预算保留。首次目标负载略超 20ms，因此不能宣称每次采样均通过；复测与高负载数据完整保留。复测报告旧版 `warningPeak` 可能继承上一场首帧，已修正验收采样只接受当前战斗 tick，旧峰值字段不作为本次范围数量结论。

整个工作区的 `tsc --noEmit` 未通过，最后检查报在并行开发的 `apps/api/src/dungeon-service.ts`（catalogue 返回结构缺少 transport 声明）；之前亦出现副本测试与远行目的地的空值错误。本次预警文件无类型错误。未覆盖或撤回其他任务修改，不将全工程类型检查标记为通过。

## 发布与存档

按停止常驻服务 → Vite 构建 → 恢复常驻服务发布。实际 health/content 均为 client 0.7.12、protocol 8、rules ow-11、assets world-art-20261003-v14-telegraph-polish、db 10，见 `versions.json`。

主账号正在其他设备游玩，未接管。用独立临时 PostgreSQL 与同一份正式 dist 在 localhost:8616 验证真实账号登录、角色创建、进入营地、刷新恢复、进入苍风原野战斗、回城与再次刷新恢复；见 `release-camp.png`、`release-battle.png`、`release-restored-camp.png`。该构建的浏览器警告／错误记录为空。隔离测试库不写主存档。

主数据库发布前后 68 账号、68 角色、520 回执、520 流水均保留，已有行逐项校验通过，见 `persistence-before.json` 与 `persistence-after.json`。

临时验收进程已退出。目录 `.qa/run-b0yYjX` 的递归删除被自动审批以 `blocked by policy` 阻止，未给出进一步原因。目录及残留 PID 文件完整保留，并通过可恢复的移动转存到 `.runtime/retained-telegraph-qa-20261003`，防止自动临时目录回收检查影响常驻服务；未删除测试数据。路径与进程／端口核对见 `temporary-cleanup.json`。
