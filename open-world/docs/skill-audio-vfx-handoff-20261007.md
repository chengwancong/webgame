# 新岛敌人技能 + 技能音效与特效补全 · 交接（2026-10-07）

> 交给 GPT／Codex 一次性落地。读完本文件直接开工，不需要再问。

## 0. 现状盘点（Claude 2026-10-07 实测，作为起点数据）

**音效：基本空白**
- 仓库里没有任何音频文件（`.ogg/.mp3/.wav` 共 0 个）。
- 全部声音来自 `apps/web/src/combat-audio.ts` 的 WebAudio 合成，只有 11 种提示音：hit、crit、hurt、kill、miss、shield-up、shield-hit、shield-break、danger、cast、loot。
- 所有技能释放共用同一声 `cast`（220Hz 正弦短音）。技能、元素、连携、状态、怪物、首领都没有各自的声音。
- 触发点：`scene.ts:303-306`（hit_resolved／shielded／missed／danger_started／cast_started／entity_died）、`main.ts:246`（loot）、`combat-vfx.ts:49`（shield-break）。
- 每次播放都新建一块噪声缓冲，没有缓存，也没有总线和压限。

**特效：档案齐全，但近一半只是标签**
- `apps/web/src/vfx-profiles.ts` 收录玩家技能 83 个（近战 33、远程 17、法术 23、辅助 10）、怪物 17 个、首领 19 个、连携 23 个、系统 2 个。玩家技能没有缺档案。
- 但每个技能的 `motif`（视觉主题）只有 27 个在绘制代码里真正用到。下面 42 个主题没有专门画法，这些技能只按「家族×元素」的默认样子绘制：
  crescent、sweep、streak、cleaver、landing、heavy-cross、flames、forks、spear、fletching、needle、arrowhead、barb、double-tail、comet、crystal、zigzag、orb、raven、ice-ring、hammer、rune、lattice、frost-edge、zigzag-streak、magma-crater、corroded-cross、frozen-fissure、ember-arrow、forked-arrow、three-ravens、toxic-cloud、double-shadow、night-shroud、static-lattice、claw、miasma-cloud、staff-tap、staff-sweep、vault-landing、staff-cross、staff-fissure
- 按（家族、元素、素材片段）算，83 个技能只有 55 种视觉签名，其中 18 组画面相同。最大的一组：bolt、multi_shot、pierce_arrow、volley、throwing_knife、fan_of_knives 六个完全一样。完整分组请用 A0 的盘点脚本重新输出。
- 怪物、首领、连携、状态技能的特效覆盖还没有在新岛和地城的真实事件上核对过。这一项由 A0 完成。

**新地图敌人：有贴图，没有设计过技能**

数据来源：`packages/content/monsters.json`、`open-world/production.json`。正式岛有风栖、雾隐、锻炉、霜岛 4 座，每岛 3 座地城。
- 贴图：岛怪都是旧怪素材换色（`registered-actor-material-and-scale-adaptation`），有图可用。
- 技能：全部照搬旧章节怪，没有按岛设计。

| 岛 | 普通怪1（成群） | 普通怪2 | 精英 | 稀有1／2 | 3 座地城首领 |
|---|---|---|---|---|---|
| 风栖 | 无技能 | 无技能 | 无技能 | 无／无 | 全部套用 meadow-boss 机制 |
| 雾隐 | shield_bash | 无技能 | shield_bash | shield_bash／shield_bash | 全部套用 forest-boss |
| 锻炉 | flame_breath | frost_stomp（熔炉岛上踩冰，主题不符） | flame_breath | flame_breath／flame_breath | 全部套用 rift-boss |
| 霜岛 | frost_bite | ice_arrow | frost_stomp | frost_stomp／frost_bite | 全部套用 frost_queen |

- 结果：风栖岛整岛只有普攻。同一座岛的 3 个地城首领打法完全相同。各岛岛主（boss-entry → ss-map-boss-N）也沿用旧章节首领。
- 怪物技能是数据驱动的（`monsterSkills`、`chapterBossSkills`，见 `packages/simulation/index.ts` 第 24、701、1096 行附近），可以在现有机制原子上组合出新技能。

## 1. 目标

0. 4 座正式岛的敌人都有按岛主题设计的技能。同一座岛的 3 个地城首领打法互不相同。新技能同时配齐特效和音效。
1. 每个玩家技能都有自己的音效：至少「释放」和「命中」两段，按家族、元素、强度区分，同组技能之间也能听出差别。
2. 连携、状态（灼烧、感电、中毒、冰冻、流血等，以 A0 盘点为准）、怪物攻击、首领技能都有对应音效。首领的危险预警声优先级最高。
3. 42 个只有标签的主题全部落地专门画法。18 组同签名技能拆开后，组内每个技能至少有一个肉眼可辨的差别：形状、数量、轨迹、附加层或落点效果。
4. 新三岛和地城里，真实战斗事件产生的每个 vfxKey 都有特效档案和音效档案，不出现静默回退。
5. 混音可控：不爆音、不刷屏、不拖帧。

## 2. 执行方式（强制）

- 按批次顺序 A0 → E1 → E2 → A1 → A2 → A3 → V1 → V2 → Z 一次做完。每完成一批，更新进度文件后直接进入下一批，**不停下来问**。
- 只允许两种结束状态：
  1. 全部完成，完成定义（§9）全部勾选；
  2. 其余全部做完后，仍剩下 §5 硬阻塞清单里的项目，并把阻塞写清楚。
- 遇到模糊之处按 §4 默认裁决处理，每条裁决写进进度文件的「裁决日志」。
- 进度文件：`docs/skill-audio-vfx-progress.md`。每批开始和结束都更新，写明下一步从哪里续。中断后读它续做。
- 工作区里有其他会话未提交的改动（画面比例锁定：stage.ts、stage.css、main.ts、scene.ts、22 个 CSS 文件等；装备面板；地图）。**不得回退、覆盖或格式化这些改动**。提交时只 `git add` 本任务的文件；对共用文件（scene.ts、main.ts）只做最小插入。
- 每批完成后单独提交一次，提交信息格式 `feat(audio-vfx): <批次> ...`。

## 3. 批次

### A0 盘点脚本（先做，作为后续批次的输入）
- 新建 `tools/audit-skill-fx.mts`（用 `node_modules/.bin/tsx` 运行），输出 `docs/skill-audio-vfx-inventory.json`，内容包括：
  - 玩家、连携、怪物、首领、系统各类档案的数量；
  - 主题（motif）是否有专门画法；
  - 视觉签名分组；
  - 音效档案覆盖率（A1 之后才有数据）；
  - **真实事件中出现的 vfxKey／skill**：用 simulation 在每个已注册区域（含风栖、雾隐、锻炉三岛和各地城）以固定种子各跑一小段自动战斗，收集 cast_started、hit_resolved、zone、projectile、status 等事件里的 vfxKey，与档案求差集。
  - 状态种类清单：灼烧、感电、中毒、冰冻、流血等以代码为准。
- 差集里缺的档案，在 V2 批次补齐。
- 另外输出「岛→怪物模板→技能」表，供 E1 使用。

### E1 新岛敌人技能设计（先出设计表，直接按表实现）
- 产出 `docs/island-enemy-skills.md`：每岛一节，列出主题、每个怪物模板的技能、每个首领的技能组和阶段。
- 岛屿主题以现有地名、怪名、地图资源为准。默认读法：
  - 风栖：海风、船坞、钩索、鸟群——突进、钩拉、风压击退、高空俯冲；
  - 雾隐：迷雾、苔藓、花粉、军需营——致盲雾、藤蔓定身、花粉减速、护盾；
  - 锻炉：熔炉、矿车、采能机——喷火、熔渣地面、矿车冲撞、过热爆炸；
  - 霜岛：已有冰系技能，保留并补首领差异。
- 配置数量下限：
  - 成群普通怪：1 个轻技能（低频、低威胁、有预警）；
  - 普通怪2：1 个；
  - 精英：2 个；
  - 稀有怪：各 2 个，其中 1 个是该怪的招牌技能；
  - 地城首领：每座地城一个招牌技能，再从本岛首领技能池（4–5 个）里取 2–3 个组合，同岛 3 个首领的组合不能相同，并至少分 2 个阶段；
  - 岛主（ss-map-boss-N）：保留旧机制，另加 1 个本岛主题的技能。
- 去掉主题冲突的借用，例如锻炉岛的 frost_stomp，换成本岛主题的同定位技能。
- 新技能只用现有机制原子组合（突进、投射物、地面区域、爆发、召唤、标记、护盾、状态），用新的 id。不新增战斗规则类型。
- 每个技能写明：id、中文名、定位、形态（家族）、元素、预警时长、冷却、伤害倍率来源（见 E2）、对应的特效家族和主题、音效基调。

### E2 新岛敌人技能实现与平衡
- 把 E1 的技能写入 `monsterSkills`／`chapterBossSkills` 和怪物模板。
- 同时给每个新技能补上特效档案（`monster/<id>`、`boss/<id>`）和主题画法（并入 V1 的画法清单），音效在 A3 一并做。
- 数值按既定的 TTK 推导规则：技能倍率由玩家生命、护甲和目标致死时间反推，不手调。只做**一次推导 + 一次验收**：每岛固定种子小样本跑一次，通过就提交；不通过按规则调一次再测，不做扫参。
- 首领新增技能必须有预警（沿用现有 telegraph 和 danger 体系），不能出现无预警秒杀。
- 普通怪新技能不能让 TTK 验收翻车：如果成群怪加技能后致死时间低于目标，就降技能频率，**不删技能**。

### A1 音效框架
- 新建 `apps/web/src/audio/`，`combat-audio.ts` 改为在框架上实现，保留现有 11 种提示音的听感和调用接口。
  - `sound-recipes.ts`：合成配方。由层组成：振荡器（类型、起止频率、时长、权重）、噪声（滤波类型、频率、时长、权重）、可选 LFO、可选的延迟回声。
  - `sound-profiles.ts`：与 `vfx-profiles.ts` 平行，键名也一致（`player/<id>`、`combo/<id>`、`monster/<id>`、`boss/<id>`、`status/<id>`）。每个档案包含 `cast`、`release`、`impact`，以及可选的 `loop`（区域持续）和 `tick`（状态跳伤）。
    - 默认从「家族×元素×强度」推导，单个技能可以覆盖其中的参数。
  - `mixer.ts`：
    - 主音量、战斗总线、界面总线；
    - 末端 DynamicsCompressor 防爆音；
    - 噪声缓冲按（时长、种子）缓存复用；
    - 同时发声上限 12，按优先级抢占：首领预警 > 首领技能 > 玩家技能 > 怪物 > 命中 > 其他；
    - 同一配方的冷却；每帧总发声上限；
    - 按舞台 x 坐标声像定位（StereoPanner，−0.6 到 0.6）；视野外的怪物音效不播放。
  - 留好采样位：配方可以写 `sample:'路径'`，有文件时优先播放文件，没有就用合成。本任务**不引入任何音频文件**。
- **元素音色基调**（作为默认推导的依据，可以微调）：
  - 钢：带通金属噪声加三角波刃鸣
  - 火：低通噪声爆燃加低频呼
  - 冰：高频正弦玻璃音加碎晶噪声
  - 雷：方波电击加高通噼啪
  - 自然：柔和正弦和声
  - 奥术：正弦上滑加 FM 颤音
  - 暗影：低频失谐锯齿波加低通
  - 大地：低频重击加尘土噪声
  - 神圣：明亮三和弦钟鸣
  - 血：湿润低通噪声加心跳低频
  - 毒：LFO 调制的冒泡噪声
- **家族包络**：
  - 斩击：80–150ms 挥风
  - 旋风：较长挥风加声像扫动
  - 冲刺：挥风加音高下滑
  - 投射物：发射声与命中声分开
  - 连锁：每次弹跳一声短电击，同一施放内限 4 声
  - 区域：布设一声，持续时用低音量 loop 或定时 tick
  - 爆发：大冲击
  - 护盾、治疗：上行钟鸣
  - 标记、召唤：低频预示
- 音量设置沿用现有的 `volume`。如果设置面板里没有「音效」滑条，用通用组件补一个。

### A2 玩家技能音效（83 个）
- 每个玩家技能都有档案，并接上真实事件：
  - cast_started → cast；
  - 投射物生成 → release；
  - 带该 vfxKey 的 hit_resolved → impact；
  - 区域激活 → loop 或 tick。
- 如果事件里拿不到技能身份，就在 contracts 的事件类型上加纯表现字段（例如透传 vfxKey）。**不改任何战斗规则和数值**。
- 区分度要求：
  - 83 个技能的（cast + impact）配方签名两两不同；
  - 同家族同元素的技能，至少在音高、层数、时长、附加层中的两项上有差异。
- 群体命中：同一施放在同一 tick 命中多个目标时，只播一次 impact，另按命中数加一层厚度（最多 +2 层），不要按目标数逐个播放。

### A3 连携、状态、怪物、首领音效
- 连携 23 个：先播所借用技能的音效，再叠加一层统一的「触发」高音点缀，让玩家听出这是连携。
- 状态：施加时一声。跳伤 tick 只给玩家自身身上的状态出声，并做节流（同一状态 1 秒最多一声）。
- 怪物：按家族×元素推导，整体比玩家低 6dB。普通近战、远程、范围三种基础攻击各一套。
- 首领：每个首领技能单独配方。预警（danger_started）按首领区分音色，并保留最高优先级。

### V1 主题特效落地（42 个主题）
- 在 `combat-vfx.ts`、`vfx-drawing.ts`、`ground-zone-vfx.ts` 里给每个主题写专门画法。只用现有的基础图元（ribbon、ring、arcPoints、lightning、sprite 素材库、groundZoneStyle）和元素配色，**不新增图片素材**。
- 同一个主题被同一签名组里的两个技能共用时（如 cleaver：execute／assassinate；fletching：multi_shot／fan_of_knives；needle：pierce_arrow／throwing_knife；arrowhead：explosive_shot／explosive_kunai；barb：poison_arrow／venom_needle），先拆成两个主题，再分别画。
- 画法读法表（默认按此执行，可以在不违背原意的前提下细化；改动写进裁决日志）：

| 主题 | 技能 | 画法要点 |
|---|---|---|
| crescent | cut | 单道细长新月弧，尾迹渐隐 |
| sweep | whirl | 整圈扫掠环加地面尘弧 |
| streak | rush、shadow_step | 直线残影三段；暗影版起止点各一团烟 |
| cleaver → cleaver／backstab | execute／assassinate | 竖劈重刀加地面裂口／目标背后短十字瞬切加暴击闪光 |
| landing | leap_strike | 起跳弧线加落地冲击环和碎石 |
| heavy-cross | berserker | 粗十字加血雾外扩 |
| flames | ember | 地面火苗簇，随机高低跳动 |
| forks | chain | 每跳一次分两叉，主干加粗 |
| spear | lance | 长矛形光束加贯穿尾迹 |
| fletching → fan3／ring | multi_shot／fan_of_knives | 三支扇形箭羽尾迹／一圈环形飞刀 |
| needle → pierce／spin-knife | pierce_arrow／throwing_knife | 贯穿细线加多目标穿孔点／旋转小刀 |
| arrowhead → blast-arrow／delay-kunai | explosive_shot／explosive_kunai | 箭头加落点爆炸／苦无插地闪烁后延迟爆炸 |
| barb → barb-arrow／needle-triple | poison_arrow／venom_needle | 倒钩箭加毒雾点／三连细针 |
| double-tail | volley | 每支箭带双尾迹 |
| comet | arcane_missile | 彗星头加弯曲追踪尾 |
| crystal | frost_bolt | 冰晶飞弹，落点碎片四溅 |
| zigzag | lightning_bolt | 锯齿闪电直线 |
| orb | fireball | 火球自旋加落点爆燃圈 |
| raven | dark_arrow | 鸦形暗箭加羽毛飘落 |
| ice-ring | nova | 多层冰环向外扩散 |
| hammer | stun_strike | 锤形冲击加眩晕星绕头 |
| rune | petrify | 地面符文圈加石化灰点 |
| lattice | slow_field | 地面冰格网 |
| frost-edge | frost_blade | 刀弧带冰霜锯齿边 |
| zigzag-streak | thunder_dash | 折线冲刺残影加电弧 |
| magma-crater | magma_slam | 熔岩坑加岩浆飞溅 |
| corroded-cross | venom_cleave | 绿色腐蚀十字加滴落 |
| frozen-fissure | frost_quake | 冰裂缝放射加冰刺 |
| ember-arrow | fire_arrow | 箭身火焰尾迹 |
| forked-arrow | thunder_arrow | 落点分叉电弧 |
| three-ravens | night_volley | 三只鸦形弹分散后汇聚 |
| toxic-cloud | toxic_bomb | 抛物线投掷，落地成毒云团 |
| double-shadow | shadow_blade | 主刀弧后跟一道错位影刃 |
| night-shroud | night_veil | 暗幕从外向内收拢 |
| static-lattice | static_field | 地面电网节点闪烁 |
| claw | dark_grasp | 地面伸出暗爪抓合 |
| miasma-cloud | miasma | 低矮弥漫雾带，缓慢漂移 |
| staff-tap | staff_strike | 长杖点击加小冲击圈 |
| staff-sweep | staff_sweep | 低平长弧扫地加尘 |
| vault-landing | pole_vault | 撑杖弧线加落地双冲击 |
| staff-cross | staff_flurry | 连续交叉杖影 |
| staff-fissure | seismic_staff | 杖插地，放射三道裂缝 |

- 预算沿用 `vfxBudgets`（装饰图 96、粒子 384、镜头震动 3px）。超预算时减数量，**不删主题**。
- 开启「减少动态效果」时每个主题保留静态关键帧，不能变成空白。

### V2 敌方与回退核对
- 补齐 A0 差集里缺的 monster／boss／combo／status 特效档案。只有基础攻击（basic-melee、basic-ranged、basic-area）允许走通用档案。
- 在 `vfxProfile()` 和 `soundProfile()` 的缺档案分支里，开发模式下打一次 `console.warn`（每个键只打一次），不再静默。

### Z 收尾
- 扩展现有特效预览页（`starsea-vfx-preview.ts` 或 `combat-art-qa.ts` 二选一，选已有入口的那个），做成「技能画廊」：按类别列出全部技能，点一下播放该技能的特效和音效，并标出所属签名组，方便用户最后试玩时逐个看。
- 完整回归只跑一次，见 §6。

## 4. 默认裁决

| 情况 | 裁决 |
|---|---|
| 用合成还是找音频素材 | 合成。下载外部素材需要用户逐个批准，并涉及版权，本任务不做；采样位留给以后替换 |
| 事件里拿不到技能身份 | 在事件上加纯表现字段，不改规则、数值、tick |
| 某个主题怎么读有歧义 | 取字面上最简单的形状读法，写进裁决日志 |
| 画面或声音超预算 | 降数量、降层数，不删主题、不静音 |
| 两个技能实在难以区分 | 加附加层（落点效果、尾迹、二段声）区分，不能合并 |
| 怪物和玩家技能同名 | 各自独立档案，怪物版降 6dB、尺寸按现有规则 |
| 首领有专属施法图（frost-queen-cast 等） | 沿用，只补音效 |
| 设置里没有音效滑条 | 用通用组件补一个，默认 70% |
| 新岛敌人技能主题有歧义 | 以地名、怪名、地图资源字面为准，选最直白的读法，记入裁决日志；设计表留给用户最后试玩时一起看 |
| 新敌人技能需要新的战斗规则类型 | 改用现有机制原子组合，不新增规则类型 |
| 新技能导致 TTK 验收不通过 | 按推导规则调一次倍率或频率，不删技能 |
| 需要改 scene.ts／main.ts | 最小插入，不重排、不格式化，不碰画面比例相关代码 |

## 5. 硬阻塞（只有这些可以停下）

- 必须下载或引入外部音频、图片素材才能完成。
- 玩家技能的音效、特效部分，必须改战斗规则、数值、tick 时序才能完成。E2 的敌人新技能数值不在此列，按推导规则做。
- 会造成数据丢失，或要回退其他会话的未提交改动。

## 6. 验证口径（只做这些，不扩展）

- **结构测试**各一个：
  - 每个玩家、连携技能键都有声音档案和特效画法；
  - A0 差集为空；
  - 83 个技能的音效签名、视觉签名两两不同。
- **真实事件测试**一个：simulation 依次施放每个玩家技能各一次，断言事件触发了对应的声音键和特效键。只断言键名映射，**不断言具体频率、时长、粒子数**。
- **新岛敌人测试**：
  - 结构测试一个：每个正式岛怪物模板满足 E1 的技能数量下限；同岛 3 个地城首领的技能组合两两不同；没有跨主题借用。
  - 平衡验收：每岛一次固定种子小样本，复用现有分区和地城探针。
- **混音测试**一个：同一 tick 触发 50 次命中，实际发声数不超过上限，首领预警能抢占。
- 旧测试如果断言的是被替换的旧行为（例如 cast 是 220Hz），直接改成断言新行为，不逐条移植，不归档旧源码和日志。
- vitest 一次只跑一个文件。完整回归在 Z 批次跑一次；失败按上面的口径修。
- **不跑无头浏览器**。画面只通过技能画廊留给用户最后试玩查看。
- 不做探索性扫参、不出多候选报告、不做「诊断的诊断」。

## 7. 禁止事项

- 用静音、空画法或复制别的技能配方充当完成。
- 删除或合并技能、主题、档案来减少工作量。
- 引入音频或图片文件。
- 为玩家技能的音效、特效改战斗数值、规则、tick。
- 新岛敌人技能手调数值、跳过预警，或者照搬旧章节技能换个名字充数。
- 只写文档不写代码。
- 跳过 §6 中的测试。
- 回退、覆盖或格式化他人的未提交改动。

## 8. 进度文件格式（`docs/skill-audio-vfx-progress.md`）

```
当前批次：A2（进行中）
下一步：从 player/xxx 开始接 impact
已完成：A0 ✔ A1 ✔
裁决日志：
- [A1] 设置面板无音效滑条 → 补滑条，默认 70%
阻塞：无
```

## 9. 完成定义

- [ ] A0 盘点脚本和 inventory.json 已产出，差集已列出
- [ ] E1 `docs/island-enemy-skills.md` 设计表完成，满足数量下限，没有主题冲突
- [ ] E2 新敌人技能已实现、平衡验收通过，同岛地城首领打法互不相同
- [ ] A1 音频框架：配方、档案、混音、缓存、声像、采样位
- [ ] A2 83 个玩家技能音效接上真实事件，签名两两不同
- [ ] A3 连携、状态、怪物、首领音效齐全，首领预警优先级最高
- [ ] V1 42 个主题都有专门画法，同签名组全部拆开，视觉签名两两不同
- [ ] V2 差集为空，缺档案会告警
- [ ] Z 技能画廊可逐个播放特效和音效
- [ ] §6 的测试全部通过，完整回归通过
- [ ] 每批已单独提交，没有包含他人的未提交文件
