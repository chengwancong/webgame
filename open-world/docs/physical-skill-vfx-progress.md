# 物理系技能表现整改进度

交接文档：[physical-skill-vfx-handoff-20261011.md](physical-skill-vfx-handoff-20261011.md)

- 当前批次：P6（执行完成；完整回归未全绿）
- 下一步：用户统一试玩；完整回归保留失败另行处理
- 批次顺序：P0 → P1 → P2 → P3 → P4 → P5 → P6

## 批次记录

| 批次 | 状态 | 提交 | 改动文件 | 备注 |
|---|---|---|---|---|
| P0 | 完成 | 11d0aa3a083cb28c1b576d9831ec66afbfc67fc5 | physical-vfx-qa.ts、serve-physical-vfx-qa.mjs、physical-vfx-workflow.py、combat-art-qa.ts、reviews/physical-vfx-20261011/before/、metrics/before-*、本文件 | 43×3=129 张，独立 8768 可见画廊，无 API 代理 |
| P1 | 完成 | 93167a495533b4888a1ab08a2502b3243c4f9afe | tools/spine-hit-export/{serve.mjs,physical-export.*,spine21-convert.*,inspect.html}、build-combat-physical-fx.mjs、tests/spine21-conversion.test.ts、13个片段、combat-physical-fx.json、public/art/effects/combat-physical/、library-contact-sheet.png、本文件 | 8 个 2.1 套件转换成功；5 个 3.7 片段；2 项转换测试通过；重复构建哈希稳定 |
| P2 | 完成 | 5d7d535c706fc4bed873ee84d3827e2e96dbab3b | vfx-physical.ts、vfx-weapon-smear.ts、vfx-ground.ts、physical-vfx-spec.ts、combat-vfx.ts、vfx-hit-style.ts、tests/{vfx-physical,vfx-hit-style}.test.ts、after-samples/、metrics/after-samples-captures.json、本文件 | 四项定向测试通过；类型检查通过；四样板12张截图 |
| P3 | 完成 | 94e41f64253b087c34123d0a99fb59077a1beee4 | physical-motion.ts、hit-feedback.ts、vfx-profiles.ts、scene.ts、combat-vfx.ts、vfx-pool.ts、vfx-physical.ts、physical-vfx-spec.ts、tests/hit-feedback.test.ts、metrics/p3-*、本文件 | 15 项通过/1 项既有战斗轨迹失败，类型检查通过；禁止改动路径与轨迹 SHA 全部未变 |
| P4 | 完成 | 5735cbfcf8cd916202ebd97427cbd8317db9a160 | physical-actions.ts、scene.ts、wardrobe-renderer.ts、mini-native-renderer.ts、tests/physical-actions.test.ts、本文件、metrics/p4-tests.json、after-samples/ | 3 项测试通过；类型检查通过；可见画廊 9 项动作 27 张截图，无资源错误；保护路径哈希未变 |
| P5 | 完成 | b395d081c8c297eee2bd2c5e22ced334a0dcb73e | physical-vfx-spec.ts、vfx-physical.ts、vfx-physical-skills.ts、vfx-ground.ts、combat-vfx.ts、scene.ts、effect-attachments.ts、physical-vfx-qa.ts、tests/vfx-physical.test.ts、metrics/p5-tests.json、本文件 | 43 项规格登记、真实弹体/区域/命中事件接入；19 项定向测试通过；129 张初次截图无资源错误 |
| P6 | 执行完成，未全绿 | a61d12c3691ec354ee83d33a05cb26ab6292757e | vfx-physical-skills.ts、vfx-physical.ts、combat-vfx.ts、tests/{vfx-physical,projectile-emitter}.test.ts、tools/{physical-vfx-workflow.py,run-physical-vfx-regression.mjs,build-physical-vfx-evidence.mjs}、skill-vfx-hit-layers.md、../AGENTS.md、after/、metrics/p6-*、before-after.png、本文件 | 最终 33 项定向测试、类型检查与隔离 QA 构建通过；129 张截图，偏移全部对齐，0资源错误；56.57 FPS（基线94.58%）；完整回归失败保留 |

## 基线

- 负载场景（60 敌人 / 100 弹体）帧率：整改前 **59.813 FPS**（600 个可见渲染帧，mean 16.719ms，render p95 5.2ms）；最终 **56.569 FPS**，基线 **94.58%**，达到 90% 门槛（同为600帧）。详情 `metrics/{before,after}-load.json`。
- 基线截图：`docs/reviews/physical-vfx-20261011/before/`，+0/+3/+8 均取真实 `cast_released` tick；诊断：`metrics/before-captures.json`、`metrics/before-load.json`。

## 裁决日志

- D7/P0：开始前保存共享文件和 Git 状态；各批使用独立 Git index 与最小差异提交，保留其他会话改动和已暂存内容。禁止修改路径与 69 组轨迹另存 SHA-256 基线。
- D5/P0：画廊暂停状态会拒绝 cast；采集器仅在同步调用已有 cast 时临时解除暂停，再通过现有单帧按钮路径推进，截图仍以真实 release tick 对齐，不注入战斗事件或更改前摇。
- D1/P1：054 的 hitguangquan_a1 实际是绿色叶形环，接触表发现后剔除；ground-ring 仅导出 yinboquan_a1。206 的 zi1/zi2/zi3 文字槽剔除。084 的裂纹、尘云、单石分别导出，避免整套重叠播放。
- D2/P1：已实现并单测 attachment 时间轴区域序列回退；本次 8 个 2.1 套件均由转换后 Spine runtime 成功导出，未使用回退或替代素材。可见 inspector 提供逐帧导出图/原图集对照；接触表逐项复核并纠正叶环。
- D1/P2：月牙逐片旋转会把水平旋风画成竖直风车，改为仅用注册片段原像素在运行时拼合、旋转后整体等距压扁；主帧在原片段峰值附近压缩播放，3–5 帧主层＋4帧淡出。刀光深度跟随真实目标前后关系，地面层仍在单位下方。
- D7/P2：既有 vfx-hit-style.ts / 对应测试尚未入 Git，作为本批明确涉及的受击映射文件纳入；保留其原有元素断言，仅把土系钢重击的合法复用纳入校验。共享 combat-vfx.ts 只提交本批差异。
- D8/P3：定向运行原封不动的 tests/vfx-v2.test.ts，`retains current ruleset traces of the 19 skill promises and existing enemy presentations` 失败，首个差异为 `boss/abyss_lord` 召唤怪位置/动作及后续 HP、zone 结果。前置普通怪碰撞/AI 改动在本任务开始前已经存在；本批没有改模拟或轨迹文件。保留完整失败于 metrics/p3-tests.json，不更新快照、不删比较、不改成通过；P6 原样复验。
- D4/P4：旧换装资源具备 spear 动作，施法时只换 motion，保留全部部件与武器图。当前 MiniFantasy 原生骨骼没有 spear 动作且不能套用另一骨骼的矩阵，使用同一原生骨骼中已存在的 Attack_TwoHand1/2（读取既有双手动作元数据），保留 Staff_Rare1 及其挂点，不再播 Spell1；缺失时保留原动作并用 P3 身体偏移补偿。
- D5/P4：施放动作使用实际 now-started 计算，命中停顿不再推迟下一个动作的释放姿态；原资源 impactTime 映射真实 release tick，前摇、模拟与位移结果不变。
- D7/P4：共享基线的 releaseFrame 尚未进入 HEAD，本批仅连同动作族切换所需的方法纳入；其他未提交内容保留。提交工具增加该方法的邻接锚点处理，修复脚本留在工作区单独审查。
- D5/P5：双刃等已由模拟按 part 发出分段 release；每次只画对应斩痕，间隔服从真实释放，不按交接表再叠造一组。采集器固定首次 release 为 +0/+3/+8 的基准，避免后续连击改写截图偏移。
- D6/P5：以当前 content/真实事件为准；交接表中的箭雨零持续描述已过时，当前为 90 tick 区域、3 次命中，只消费现有 zone/activation。
- D1/P6：可见截图发现残影重叠于终点，改为角色真实画面快照沿实际 origin→position 路径分布，最多 3 个；减少动态不分配快照纹理。流血等附加状态原先还会播放通用金色刀光，物理技能已有主层和受击层，去掉重复瞬时刀光，保留状态标签/持续标记。
- D8/P6：完整回归只运行一次，使用新建临时 PostgreSQL，不访问正式服务。完整回归开始后继续的最终表现微调以定向测试补验，不重复全量；原始全量结果不覆盖。涉及战斗轨迹、任务、副本或套装文字的失败完整保留，不修改受保护逻辑/旧快照消除失败。
- D7/P6：全量结果含临时数据库文件并行造成的独占所有者冲突/死锁；复现脚本改为文件串行，并隔离日历报告输出。首次运行写入旧日历报告的产物移到本批 metrics，按运行前备份恢复旧报告。没有重跑完整回归覆盖初始失败。
- P6 挂点复验：全量发现 3 项投射物测试失败，修复物理释放点/狙击真实命中端点的一次采样，保留 beamSegments 与发射后独立运动断言；假图像补齐 setTintMode 等真实 Phaser API。无护盾/无护盾动画时不再每帧查角色挂点。7 文件 33 项定向测试最终全部通过（p6-directed.json）。

## 事件缺口

- death_lotus：当前是 3 次近战范围脉冲，没有八把外射弹体；真实 release 显示八片环绕刀影，不新增飞行轨迹、命中或外射伤害。
- rampage：当前只有一次范围攻击；实际命中显示血色爪痕，不伪造三连命中。
- explosive_kunai：当前是碰撞即爆、没有插地延迟；飞行和爆炸分别跟随真实 Projectile / effect_activated；若未来出现真实延迟 Zone，已支持等待时闪烁。
- staff_cyclone：当前原生武器和人物由一个骨骼画布合成，没有独立武器剪影快照；保留土黄水平环和实际杖动作，不用整个人物残影冒充三根杖影。
- counter_strike：当前先施加反击状态，反伤发生时才有命中；刀光移到真实命中阶段，不能在无攻击者的状态施加帧伪造反击。

## 逐技能自检（P5）

- 剑：
  - [x] cut
  - [x] dual_strike
  - [x] blade_fury
  - [x] whirl
  - [x] rush
  - [x] execute
  - [x] leap_strike
  - [x] vortex_blade
  - [x] counter_strike
  - [x] frost_blade
  - [x] thunder_dash
- 锤 / 斧：
  - [x] cleave
  - [x] ground_slam
  - [x] stun_strike
  - [x] rampage
  - [x] berserker
  - [x] war_cry
  - [x] blood_rage
  - [x] magma_slam
  - [x] venom_cleave
  - [x] frost_quake
- 杖：
  - [x] staff_strike
  - [x] staff_flurry
  - [x] staff_sweep
  - [x] pole_vault
  - [x] seismic_staff
  - [x] staff_cyclone
- 暗器：
  - [x] throwing_knife
  - [x] fan_of_knives
  - [x] venom_needle
  - [x] shadow_step
  - [x] blade_flurry
  - [x] explosive_kunai
  - [x] assassinate
  - [x] death_lotus
  - [x] shadow_blade
- 弓：
  - [x] bolt
  - [x] multi_shot
  - [x] volley
  - [x] pierce_arrow
  - [x] snipe
  - [x] rain_of_arrows
  - [x] explosive_shot

## 阻塞

没有执行阻塞；整体验收未全绿，原始完整回归失败须保留。

## 完整回归记录

- 一次完整运行：2026-10-12 01:32–01:44（北京时间），236 文件：217 通过 / 19 失败；1711 项：1645 通过 / 35 失败 / 31 跳过。临时 PostgreSQL 已停止并清理，见 `metrics/p6-regression-run.json`。
- 完整原始报告 `metrics/p6-regression.json` 与 `.log` 不覆盖；其中 3 项 projectile-emitter 失败已在最终定向运行修复通过，其余失败不宣称为已修复或一概既有。
- 保留的失败包含受保护 `vfx-v2` 的 boss/abyss_lord 轨迹、combat-event-feedback 轨迹、build-variety/deep-progression 断言、套装阶段文字、任务/掉落/剧情断言、main.ts 的既有超长工坊提示；数据库 beforeAll 的并发所有权冲突/死锁另行记录。均未修改这些断言、源数据或受保护服务端以凑绿。
- 全量运行先于 P6 最终残影/降噪/挂点微调；最终微调由 33 项定向测试、类型检查和最终可见截图覆盖。

## 完成定义核对

- [x] P0–P5 实现和逐技能自检，D6 缺口明确登记
- [x] 43 个技能截图 +0/+3/+8，固定首次 release 的帧对齐
- [x] 一次完整回归及原始失败记录，最终定向复验通过
- [ ] 原始完整回归全部通过（本次未达到）
- [x] 最终隔离 QA 构建、帧率与边界复验；受保护源路径和69组轨迹 SHA 未变

## 原生骨骼动作联合复核（2026-10-16）

技能动作改为手工编排的原生骨骼动作后，按武器分组（剑、锤、斧、杖、暗器、弓、法术、控制、辅助）在独立可见画廊逐帧复核动作与特效，工具为 `combat-art-qa.html` 的 `awMotionReview`（`apps/web/src/vfx-motion-review.ts`）。审查图只留本地 `.qa/review-sheets/`，不入库。只改表现，不改前摇、释放 tick、伤害、判定或服务端规则。

- 时序：HeavySpin、LotusSpin 和 StaffSpin 的接触点前移到转半圈处，与真实释放 tick 对齐。
- 转身：旋转类动作不再用 |cos| 把身体压到 32% 宽（像纸片人），改为身体保持至少 85% 宽，侧对镜头时用阶梯关键帧一步镜像（`turnScale`）。6 个旋转技能已复核。
- 挂点：法术弹体改从法器宝珠（muzzle）出手，暗器新增 `thrown` 发射器（从手出手）；箭离弦层沿射击方向旋转；dark_arrow 改用 `arrow` 飞行层。
- 战吼与血怒：火焰与圣光受击层，加上冲击环第 21–24 帧；血怒的火焰画在身体后面。war_cry 染色 0xf2c75a，blood_rage 主层 hit-fire-big。pole_vault 与 leap_strike 各 3 个残影。陨坑上限 230px。
- 库片段构建修正（`tools/build-combat-layer-fx.mjs`）：14 个 library-* 片段原先把每帧的裁剪框拉伸铺满单元格，导致变形、贴边。现在按 `spriteSourceSize` 放回 512 源画布，再统一缩到 256。void-flight 和 blade-flight 两个飞行片段逐帧把箭尖对齐锚点，消除沿路径循环的抖动。
- 受击层构建（`tools/build-combat-hit-fx.mjs`）：每个单元格外圈 20px 做 Alpha 羽化，被导出裁切截平的柔光不再显成方块；颜色与内部像素不变。
- 自身增益：去掉软光晕上的整片染色（会呈方块）。护盾闪光改用 `buffLayer`（元素自身的鲜明受击层；钢、土、血三系用圣光层加乘法染色），召唤光环与护盾泡改为叠加发光。闪现/冲刺拖影改为细条。
- 地面法术：陨星落体改用奥术球（library-void-flight），雷暴区域在真实半径内按种子位置闪烁雷击受击层（减少动态时只保留 1 处）。
- 减少动态抽查锤组：无陨坑、碎石、震屏和残影，受击与状态照常显示；原生动作的 `@still` 版本把骨盆和双脚归零。
- 定向测试 25 个文件全部通过，类型检查通过；`build-mini-hero --check` 通过（4 个运行时源文件未改动）。`projectile-emitter.test.ts` 改为断言法术从宝珠出手，并新增暗器从手出手的断言。
