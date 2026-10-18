# 技能修复交接任务单

核对时间：2026-10-03T18:21:11.660215+08:00。当前源码：client 0.8.10 / protocol 12 / rules ow-17 / db 11。

给修复 agent 的任务：**修复下列36个技能的真实能力，连同4项共享执行问题和6项直接关联的技能交互，按同一组规则、契约、解析结果与战斗事件贯通。机制成立后再完成2项数值复测。每批交付可实际操作的玩家路径和证据。**

工作目录：`G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world`。先读取 [AGENTS.md](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/AGENTS.md) 与 [项目.md](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/项目.md)；核对工作区已有改动，保留其他任务的修改。

## 版本与范围

当前导入55个技能，真实唯一入口是 `packages/content/index.ts → skills-expanded.ts`。不要只改未被导入的 `skills-engineered.ts`、`skills-complete.ts` 或技能数据库草稿。本单核心问题经当前源码静态复核；原受控执行证据版本是0.8.7，不冒充0.8.10的新执行结果。

**测试入口注意：修复实际open-world，snapshot只作为只读旧证据。原audit-math.ts与mechanism-probes.ts默认导入snapshot，原封不动运行不会验证新实现。修复后建立现行源测试，记录版本与执行前后指纹。**

本次现有六个核心源（技能表、content/index、simulation/index、rules/index、deep-progression规则、chapter-combat）与原审查快照的哈希比较见JSON。修复前仍应确认代码未继续变化。

默认保持现有技能ID、已训练等级、等级/技能书激活方式、1–5级上限、费用与已获得资源。缺失机制新增的强度、解除和叠加参数写入正式内容源，记录采用值；原报告中的百分比只是试验建议。单段改多段、多投射物改扇形时先守住单次总伤预算，不能无意倍增。

UI继续用户确认的C“分组技能册”，使用当前4“奶白浅金”标准与公共Token/组件；技能页不加角色立绘。此轮的搜索、费用、顺序、状态与草稿修复在现有结构内完成。旧报告铜色方案图仅看机制信息流，不作为当前皮肤依据；大改布局按项目约束先提供多个方案。

## 先建立共享能力

逐技能条目不是36个互不相干的系统。至少需要以下可组合能力：

- 伤害类别、来源和触发许可：直接命中、持续伤害、衍生伤害；暴击、吸血、传导、护盾、斩杀、打断各自有声明规则。
- 状态生命周期：来源、目标、强度、开始/结束tick、下一次结算、层数、刷新/覆盖/叠加、免疫/抵抗、净化、死亡与阶段处理。
- 多段与通道排程；单次区域爆发与持续区域；多投射物、贯穿、追踪、接触点爆炸。
- 自身/敌人/队友/地面或方向目标；独立治疗与回能；格挡/反击、伤害类型免疫、一次致死拦截。

弹体碰撞半径与范围爆炸半径分别定义：当前爆破箭/火球的radius同时传给弹体，不能靠放大弹体碰撞来冒充范围爆炸或造成刚发射就提前命中。类型免疫需要配置声明的伤害类型，不依据特效颜色猜测，也不顺带新增完整元素防御体系。

冻结的是长期构筑基准，临时攻击/速度/护甲增益必须改变真实伤害、位移和防御结果。当前resolvedSkills.damage是预先解析值，单改本场stats.attack可能不会改变技能输出。服务端提供用于临时修饰的已解析基准/系数，战斗核心只处理临时效果，不能重新实现等级、装备或技能成长公式；测试同时检查有效属性与实际结果。

新能力有共享schema与内容校验，未知效果/冲突组合报错。持续伤害要保留真正施加者，不能消费当前聚焦玩家的属性。状态临时修改不能写入角色持久属性或直接永久累乘怪物攻击。

## 4项共享执行问题

### C01 · 燃烧自续、伤害触发边界与来源归属 · P1

当前问题：DOT调用damage默认secondary=false，重新刷新燃烧并进入命中触发；吸血在!secondary之外，单改布尔值仍不足。burn仅保存结束tick，没有独立施加者/强度记录。

修复：明确直接命中、持续伤害、衍生伤害类别；燃烧跳伤不能续自己，按相对战斗时钟排程，记录来源/强度/结束与下次结算。暴击、吸血、传导、护盾、打断分别用规则控制。

入口：`packages/simulation/index.ts:99`、`packages/simulation/index.ts:214`、`packages/content/index.ts:32`

验收：

- 一次直接命中后30秒内只产生声明的跳数；按3秒/每秒一次的方案应为3次。
- 重复直接命中刷新时间不无限加层，不重置跳伤到永远不结算；不同玩家的归属可核对。
- 断线、保存恢复、阶段切换后时间与次数一致。

### C02 · 龙之祝福永久累乘 · P1

当前问题：buff_nearby直接修改ally.attack*=1.2，没有回收；原300秒受控样本25→662。

修复：基础攻击与临时modifier分开，声明持续时间、来源、刷新/叠加上限和清除规则。

入口：`packages/simulation/index.ts:631`、`packages/content/chapter-combat.ts`

验收：

- 持续300秒不超过声明上限，到期回基础值。
- 施加者死亡、驱散、重连不重复乘算。

### C03 · 敌方减速与眩晕声明未执行 · P1

当前问题：frost_bite.slow、shield_bash.effect=stun未在近战命中执行；敌方zone.slow也没有更新玩家减速。

修复：玩家与怪物共用状态执行能力，明确比例/时长、免疫/抵抗、解除和行动限制。

入口：`packages/simulation/index.ts:574`、`packages/simulation/index.ts:115`、`packages/content/chapter-combat.ts`

验收：

- 冰冻撕咬、盾击、冰霜区域分别测移动和可施法窗口。
- 状态到期、净化、救援与恢复结果一致，未命中不施加。

### C04 · 最终冷却、上限与UI口径 · P2

当前问题：技能冷却修正与stats.cdr分别最多降低75%，合成后可能超过75%；面板总贡献不等于实际生效。

修复：服务端输出最终解析冷却、贡献与有效上限；前摇/施法占用另显示，防止冷却已好但仍不可施法的静默点击。

入口：`packages/rules/deep-progression.ts:130`、`packages/simulation/index.ts:82`、`apps/web/src/ui/skill-effects.ts`

验收：

- UI最终冷却与实际cooldown tick一致。
- 双池、封顶、取整、施法占用和资源不足均有对应状态。

## 36个逐技能问题总表

原基础值不是角色生效伤害；`duration`、`windup`、`cooldown`使用30Hz tick，秒数= tick/30。完整实现建议与验收在后文。

### 近战 · 8项

| 审查ID | 技能及稳定ID | 当前缺口 | 必须得到的实际能力 |
| --- | --- | --- | --- |
| SK01 | 双重打击 `dual_strike` | 当前 single 分支只产生一次命中，文案为快速连击两次。 | 一次成功完整施放有两次命中，总伤等于原定预算，不能把 28 直接变成两次 28。 |
| SK02 | 刀刃风暴 `blade_fury` | area 分支只伤害一次，duration=90 没有形成持续旋转。 | 持续期有三次可追溯命中，结束后无额外伤害；范围与旋转表现跟随同一主体。 |
| SK03 | 斩杀 `execute` | 只有基础 80 单次伤害，低生命额外伤害不由技能本体提供。 | 同一敌人 21% 与 19% 生命的配对命中产生预定差异，其他技能不获得这个本体加成。 |
| SK04 | 血怒 `blood_rage` | shield damage=0，只消耗能量，未增加攻击或持续损失生命。 | 持续期间攻击与生命按规定改变，到期恢复；角色倒地、重连和刷新不会永久叠加。 |
| SK05 | 漩涡之刃 `vortex_blade` | 只有范围伤害，没有 pull 参数，敌人不会被吸引。 | 敌人距离按预定范围缩短，但不穿墙、不重叠；首领的抵抗结果可见。 |
| SK06 | 反击 `counter_strike` | 当前只是 50 点护盾，不反弹伤害，radius 没有执行意义。 | 窗口内外同一命中产生不同反馈，反击不形成双方递归循环，防护到期正确。 |
| SK07 | 狂战士 `berserker` | 只有 65 点单次伤害，没有牺牲防御的状态。 | 施放前后同一次来袭伤害按规定改变，2 秒后恢复；代价与伤害收益都可预览。 |
| SK08 | 战吼 `war_cry` | area 只造成 20 伤害，没有降低敌人防御。 | 同敌人被影响时后续命中伤害按预定曲线提高，到期恢复，其他目标不受影响。 |

### 远程 · 11项

| 审查ID | 技能及稳定ID | 当前缺口 | 必须得到的实际能力 |
| --- | --- | --- | --- |
| SK09 | 多重箭 `multi_shot` | projectiles 未配置，默认只生成一支直线箭。 | 无遮挡释放生成三条独立弹道，墙体和目标命中逐条验证，单目标近距离总伤可解释。 |
| SK10 | 穿透箭 `pierce_arrow` | 技能本体没有穿透，只有装备 pierce 或 lance 特例会贯穿。 | 用无穿透装备、三个共线目标验证本体贯穿；换装备不应使技能突然丢掉名称承诺。 |
| SK11 | 箭雨 `rain_of_arrows` | zone duration=0，单次施放没有伤害。 | 单次施放有正伤害，首次/末次命中都在声明时段内；范围外目标不受伤。 |
| SK12 | 爆破箭 `explosive_shot` | projectile 只直接命中一名敌人，radius=2 没有触发爆炸查询。 | 贴近命中点的第二名敌人按规则受伤，范围外不受伤，直接目标不被无意双算。 |
| SK13 | 毒箭 `poison_arrow` | duration=90 未创建毒性持续状态，仅有直线伤害。 | 停止施法后中毒按时结束，来源、总量和护甲作用可核对，不能无限延长。 |
| SK14 | 齐射 `volley` | 没有连发排程，仍为一次投射物。 | 一次命令只扣一次费用，但释放三发；打断和目标消失不会产生遗漏的幽灵弹。 |
| SK15 | 奥术飞弹 `arcane_missile` | 方向在发射时固定，未追踪移动敌人。 | 移动目标下弹道明显转向，追踪和普通直线弹道有可测差别，不穿墙。 |
| SK16 | 陨石术 `meteor` | zone duration=0，单次施放没有伤害。 | 前摇后落点内目标受到一次预定伤害，移动离开能躲过，冷却与费用只扣一次。 |
| SK17 | 冰霜箭 `frost_bolt` | projectile 命中没有设置减速状态。 | 被命中目标相同时段移动距离降低预定比例，到期恢复；落空不施加减速。 |
| SK18 | 火球术 `fireball` | 仅单体命中，没有文案中的范围爆炸。 | 主目标和周边目标各被正确命中一次；墙后目标和范围外目标不受伤。 |
| SK19 | 暗影箭 `dark_arrow` | 护甲穿透只来自角色 stats，技能自身没有穿透修正。 | 相同护甲目标下本技能与无穿透技能的配对受伤符合公式，零护甲不额外增伤。 |

### 控制 · 10项

| 审查ID | 技能及稳定ID | 当前缺口 | 必须得到的实际能力 |
| --- | --- | --- | --- |
| SK20 | 震慑 `stun_strike` | single 只造成伤害，没有 30 tick 眩晕。 | 普通目标在 1 秒内不能行动/施法，到期恢复；对首领规则一致且有反馈。 |
| SK21 | 重力陷阱 `gravity_well` | zone 只有周期伤害，没有减速或拉扯。 | 区域内目标移动与位置真实改变，退出即按规则停止，墙体与首领抵抗有效。 |
| SK22 | 沉默 `silence` | 零伤 area，没有禁止敌人技能的状态。 | 沉默期普通怪不开始新技能，仍可普攻；到期、抵抗和净化有真实事件。 |
| SK23 | 石化 `petrify` | 只有一次 15 点伤害，没有 90 tick 控制。 | 被石化目标按规定不能移动/施法，受到伤害和到期各遵守解除规则。 |
| SK24 | 减速场 `slow_field` | 只有区域周期伤害，slow 仅对 id=frost 开启。 | frost 与 slow_field 都按自身参数执行；新增同机制技能只改内容即可生效。 |
| SK25 | 恐惧术 `fear` | 零伤 area 没有驱使敌人逃跑。 | 目标确实远离施法者，不能卡进墙体；结束后恢复接敌且已击杀实例不重刷。 |
| SK26 | 束缚 `root` | zone 只造成伤害，不固定敌人位置。 | 目标普通移动停止，但允许的攻击/施法仍运行，到期恢复，突进遵守声明规则。 |
| SK27 | 致盲 `blind` | 零伤 area，没有降低敌人命中或改变判定。 | 同种子配对可重放致盲命中差异，重连不会重抽，视觉与失手事件一致。 |
| SK28 | 虚空漩涡 `vortex` | 区域持续伤害存在，但没有文案中的吸引。 | 持续期有实际牵引事件与伤害事件；结束后两者都停止，碰撞状态稳定。 |
| SK29 | 时间停滞 `time_stop` | 零伤 area 没有定身或暂停敌人的能力。 | 受影响敌人在 1 秒内按规则停止，玩家与副本倒计时继续，恢复不会重新生成敌人。 |

### 辅助 · 7项

| 审查ID | 技能及稳定ID | 当前缺口 | 必须得到的实际能力 |
| --- | --- | --- | --- |
| SK30 | 加速 `haste` | shield damage=0，不改变移动速度。 | 4 秒内位移增加预定比例，到期恢复；不因掉线、重复按键或区域切换永久叠加。 |
| SK31 | 再生 `regen` | heal damage=0，只会执行零点即时回复。 | 受伤目标按声明节奏恢复，到期结束，治疗总量与报价一致；满血不会冒充有效治疗。 |
| SK32 | 闪现 `blink` | dash 依赖敌人目标，没有目标时 cast=false，无法自由选择逃离位置。 | 无敌人时仍可按选定合法方向位移，非法终点不会扣费后卡墙，范围与提示一致。 |
| SK33 | 净化 `cleanse` | heal damage=0，不清除状态；生命大于80%还会被治疗条件阻止。 | 满血但中减益时可用，减益确实移除；无可清除状态按策略提示而非空扣费。 |
| SK34 | 相位转换 `phase_shift` | shield damage=0，不提供物理伤害免疫。 | 物理与其他类型配对命中结果符合声明，到期恢复，未分类伤害明确拒绝或迁移。 |
| SK35 | 回气 `second_wind` | 只回复 50 生命，没有恢复法力。 | 满血低能量时可按规则使用，两资源实际改变且不溢出各自上限。 |
| SK36 | 守护天使 `guardian_angel` | shield damage=0，核心没有此技能的死亡拦截或复活记录。 | 连续两次致死只拦截第一次，同场重连不会重置次数；复起位置和生命可核对。 |

## 逐技能实施与验收细节

### SK01 · 双重打击 `dual_strike`

源：[skills-expanded.ts:13](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`single`，基础damage=28，range=2.5，radius=0，duration=0 tick，windup=4 tick，cooldown=35 tick，cost=8。

原描述：快速连击两次。

当前缺口：当前 single 分支只产生一次命中，文案为快速连击两次。

实现建议（新增数值为试验起点）：

1. 将已解析的单次总伤害拆成两段，间隔建议 0.12–0.18 秒；整数余数放到第二段，先保持总预算。
2. 第一段与第二段分别发命中事件，第二段目标死亡或离开范围时允许落空；是否追踪新目标必须明确。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 一次成功完整施放有两次命中，总伤等于原定预算，不能把 28 直接变成两次 28。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK01.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK02 · 刀刃风暴 `blade_fury`

源：[skills-expanded.ts:15](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=15，range=0，radius=4，duration=90 tick，windup=5 tick，cooldown=120 tick，cost=22。

原描述：持续旋转攻击周围。

当前缺口：area 分支只伤害一次，duration=90 没有形成持续旋转。

实现建议（新增数值为试验起点）：

1. 建立跟随施法者的 3 秒通道，建议每秒一次伤害；先将现有总伤预算分到三次。
2. 移动、控制、死亡和再次施放分别定义中断规则；这是跟随人物的旋转能力，不能把静态落地区域当作同一机制。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 持续期有三次可追溯命中，结束后无额外伤害；范围与旋转表现跟随同一主体。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK02.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK03 · 斩杀 `execute`

源：[skills-expanded.ts:16](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`single`，基础damage=80，range=2.5，radius=0，duration=0 tick，windup=8 tick，cooldown=150 tick，cost=20。

原描述：对低血量敌人造成额外伤害。

当前缺口：只有基础 80 单次伤害，低生命额外伤害不由技能本体提供。

实现建议（新增数值为试验起点）：

1. 增加明确低生命阈值和伤害倍率字段，初始试验可为 20% 阈值、50% 增伤，重新核对基础爆发预算。
2. 在命中时而非按键时读取目标生命比；与通用斩杀天赋的叠加单独规定，避免重复乘算。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 同一敌人 21% 与 19% 生命的配对命中产生预定差异，其他技能不获得这个本体加成。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：恐怖黎明（Grim Dawn）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK03.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/grim-combat.jpg) · [原图出处](https://store.steampowered.com/app/219990/Grim_Dawn/)。借鉴机制/信息组织，具体参数由本作验证。

### SK04 · 血怒 `blood_rage`

源：[skills-expanded.ts:18](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`shield`，基础damage=0，range=0，radius=0，duration=180 tick，windup=2 tick，cooldown=240 tick，cost=30。

原描述：提升攻击力但持续消耗生命。

当前缺口：shield damage=0，只消耗能量，未增加攻击或持续损失生命。

实现建议（新增数值为试验起点）：

1. 改为有来源的攻击增益与生命消耗状态，建议先试 6 秒、攻击 +20%、每秒损失最大生命 2%。
2. 自耗是否能致死、是否触发护盾/吸血、净化是否可解除均明确；不把零盾当作攻击增益。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 持续期间攻击与生命按规定改变，到期恢复；角色倒地、重连和刷新不会永久叠加。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK04.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK05 · 漩涡之刃 `vortex_blade`

源：[skills-expanded.ts:19](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=38，range=0，radius=4.5，duration=0 tick，windup=9 tick，cooldown=85 tick，cost=24。

原描述：制造吸引敌人的漩涡。

当前缺口：只有范围伤害，没有 pull 参数，敌人不会被吸引。

实现建议（新增数值为试验起点）：

1. 配置适度牵引距离，先试 1–1.5 格；命中后调用已有身体移动与碰撞能力。
2. 墙体、存活单位和首领抵抗统一处理；不能直接把敌人位置设为角色坐标。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 敌人距离按预定范围缩短，但不穿墙、不重叠；首领的抵抗结果可见。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK05.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK06 · 反击 `counter_strike`

源：[skills-expanded.ts:20](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`shield`，基础damage=50，range=0，radius=3，duration=60 tick，windup=1 tick，cooldown=180 tick，cost=15。

原描述：格挡并反弹伤害。

当前缺口：当前只是 50 点护盾，不反弹伤害，radius 没有执行意义。

实现建议（新增数值为试验起点）：

1. 保留防护预算，加入短格挡窗口与真实被挡伤害记录；反击基于实际挡下的伤害而非攻击者无限面板值。
2. 反击标为衍生伤害，不再触发反击、燃烧续期等循环；规定远程、DOT、重击是否可反弹。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 窗口内外同一命中产生不同反馈，反击不形成双方递归循环，防护到期正确。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK06.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK07 · 狂战士 `berserker`

源：[skills-expanded.ts:22](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`single`，基础damage=65，range=2.8，radius=0，duration=0 tick，windup=10 tick，cooldown=120 tick，cost=25。

原描述：牺牲防御换取巨额伤害。

当前缺口：只有 65 点单次伤害，没有牺牲防御的状态。

实现建议（新增数值为试验起点）：

1. 为爆发加一个短暂防御代价，先试释放后 2 秒护甲降低 20%，并重新校准额外伤害收益。
2. 防御代价用基础属性外的临时 modifier 表达，不直接修改持久护甲；禁止因重连丢掉代价。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 施放前后同一次来袭伤害按规定改变，2 秒后恢复；代价与伤害收益都可预览。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK07.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK08 · 战吼 `war_cry`

源：[skills-expanded.ts:23](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=20，range=0，radius=6，duration=120 tick，windup=3 tick，cooldown=150 tick，cost=18。

原描述：降低周围敌人防御。

当前缺口：area 只造成 20 伤害，没有降低敌人防御。

实现建议（新增数值为试验起点）：

1. 增加范围护甲削弱，先试 4 秒、20%；写明同类只刷新或取最高，不无界叠加。
2. 目标防御从冻结基础值与状态推导；多玩家重复战吼、首领抵抗和驱散都使用同一效果 ID。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 同敌人被影响时后续命中伤害按预定曲线提高，到期恢复，其他目标不受影响。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：恐怖黎明（Grim Dawn）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK08.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/grim-combat.jpg) · [原图出处](https://store.steampowered.com/app/219990/Grim_Dawn/)。借鉴机制/信息组织，具体参数由本作验证。

### SK09 · 多重箭 `multi_shot`

源：[skills-expanded.ts:32](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=16，range=11，radius=0.3，duration=0 tick，windup=5 tick，cooldown=40 tick，cost=10。

原描述：同时发射三支箭。

当前缺口：projectiles 未配置，默认只生成一支直线箭。

实现建议（新增数值为试验起点）：

1. 声明基础投射物数 3 和扇形角度；区分技能本体数量与天赋/威能加成，统一到现有最多 5 支能力。
2. 先保持合理单次总伤预算，再测三目标收益；不能直接把单箭 16 无条件乘三。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 无遮挡释放生成三条独立弹道，墙体和目标命中逐条验证，单目标近距离总伤可解释。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK09.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK10 · 穿透箭 `pierce_arrow`

源：[skills-expanded.ts:33](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=32，range=14，radius=0.4，duration=0 tick，windup=7 tick，cooldown=55 tick，cost=12。

原描述：穿透多个敌人。

当前缺口：技能本体没有穿透，只有装备 pierce 或 lance 特例会贯穿。

实现建议（新增数值为试验起点）：

1. 把穿透次数/贯穿标志写入技能解析参数，先试贯穿 2 个后续目标。
2. 每个目标只命中一次，整段路径检查墙体；装备穿透与本体规则合并，不能重复生成同一次命中。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 用无穿透装备、三个共线目标验证本体贯穿；换装备不应使技能突然丢掉名称承诺。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK10.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK11 · 箭雨 `rain_of_arrows`

源：[skills-expanded.ts:34](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`zone`，基础damage=18，range=10，radius=4，duration=0 tick，windup=15 tick，cooldown=110 tick，cost=22。

原描述：在区域内降下箭雨。

当前缺口：zone duration=0，单次施放没有伤害。

实现建议（新增数值为试验起点）：

1. 明确是一次落地爆发还是持续箭雨；建议先试 3 秒、三次伤害，range=10/radius=4 沿用现有范围。
2. 伤害总量、首次命中时刻和对移动目标的作用由执行器定义，动效只能消费真实落地事件。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 单次施放有正伤害，首次/末次命中都在声明时段内；范围外目标不受伤。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK11.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK12 · 爆破箭 `explosive_shot`

源：[skills-expanded.ts:35](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=40，range=12，radius=2，duration=0 tick，windup=10 tick，cooldown=80 tick，cost=20。

原描述：命中后爆炸。

当前缺口：projectile 只直接命中一名敌人，radius=2 没有触发爆炸查询。

实现建议（新增数值为试验起点）：

1. 直接命中后在接触点产生一次范围爆炸，区分直接与范围预算。
2. 直接目标是否同时承受爆炸需明示；爆炸检查视线、身体与边界，不因弹道大半径冒充爆炸。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 贴近命中点的第二名敌人按规则受伤，范围外不受伤，直接目标不被无意双算。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK12.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK13 · 毒箭 `poison_arrow`

源：[skills-expanded.ts:37](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=28，range=11，radius=0.35，duration=90 tick，windup=6 tick，cooldown=70 tick，cost=14。

原描述：造成持续毒性伤害。

当前缺口：duration=90 未创建毒性持续状态，仅有直线伤害。

实现建议（新增数值为试验起点）：

1. 给命中目标创建独立中毒状态，建议 3 秒、三次跳伤，直接伤害与 DOT 预算分别标注。
2. 区分毒与装备燃烧的来源、叠加和到期；持续伤害不再刷新自身或触发所有直接命中收益。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 停止施法后中毒按时结束，来源、总量和护甲作用可核对，不能无限延长。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：恐怖黎明（Grim Dawn）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK13.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/grim-combat.jpg) · [原图出处](https://store.steampowered.com/app/219990/Grim_Dawn/)。借鉴机制/信息组织，具体参数由本作验证。

### SK14 · 齐射 `volley`

源：[skills-expanded.ts:38](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=20，range=10，radius=0.3，duration=0 tick，windup=8 tick，cooldown=45 tick，cost=18。

原描述：快速连续射击。

当前缺口：没有连发排程，仍为一次投射物。

实现建议（新增数值为试验起点）：

1. 建立短连射序列，建议三发间隔 0.1 秒；先把既有单次预算分到三发。
2. 明确连射期间能否移动、能否打断、目标死亡后后续是否继续；不重复扣整份能量或重启冷却。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 一次命令只扣一次费用，但释放三发；打断和目标消失不会产生遗漏的幽灵弹。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK14.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK15 · 奥术飞弹 `arcane_missile`

源：[skills-expanded.ts:39](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=35，range=13，radius=0.4，duration=0 tick，windup=5 tick，cooldown=60 tick，cost=16。

原描述：追踪敌人的魔法飞弹。

当前缺口：方向在发射时固定，未追踪移动敌人。

实现建议（新增数值为试验起点）：

1. 给投射物保存目标 ID 并设置有限转向速度，而非瞬间吸附；保留可躲避空间。
2. 目标死亡/不可见后采用最后方向或结束，行为需定义；追踪不能绕过完整路径碰撞。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 移动目标下弹道明显转向，追踪和普通直线弹道有可测差别，不穿墙。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK15.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK16 · 陨石术 `meteor`

源：[skills-expanded.ts:40](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`zone`，基础damage=60，range=12，radius=3.5，duration=0 tick，windup=25 tick，cooldown=180 tick，cost=35。

原描述：召唤陨石砸击地面。

当前缺口：zone duration=0，单次施放没有伤害。

实现建议（新增数值为试验起点）：

1. 将陨石定义为前摇后的单次范围命中，保留 25 tick 前摇并明确实际落地延迟。
2. 使用一次爆发事件，不靠 duration=1 的周期取模偶然产生伤害；落点在释放后保持固定。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 前摇后落点内目标受到一次预定伤害，移动离开能躲过，冷却与费用只扣一次。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK16.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK17 · 冰霜箭 `frost_bolt`

源：[skills-expanded.ts:42](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=30，range=12，radius=0.4，duration=0 tick，windup=6 tick，cooldown=50 tick，cost=12。

原描述：减速敌人的冰箭。

当前缺口：projectile 命中没有设置减速状态。

实现建议（新增数值为试验起点）：

1. 命中施加短减速，建议初始 30%/2 秒；将比例与时长写进实际参数。
2. 同源刷新、不同来源取最大或按规则合成；DOT、护盾和减速不得混用 damage 字段。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 被命中目标相同时段移动距离降低预定比例，到期恢复；落空不施加减速。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK17.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK18 · 火球术 `fireball`

源：[skills-expanded.ts:44](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=50，range=11，radius=1.5，duration=0 tick，windup=10 tick，cooldown=85 tick，cost=20。

原描述：造成范围爆炸的火球。

当前缺口：仅单体命中，没有文案中的范围爆炸。

实现建议（新增数值为试验起点）：

1. 接触点触发一次半径 1.5 的范围查询，明确主目标与周边伤害分配。
2. 复用爆破箭的执行能力，以不同参数和表现区分；先测总伤与费用效率再定爆炸倍率。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 主目标和周边目标各被正确命中一次；墙后目标和范围外目标不受伤。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK18.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK19 · 暗影箭 `dark_arrow`

源：[skills-expanded.ts:45](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`projectile`，基础damage=38，range=15，radius=0.35，duration=0 tick，windup=7 tick，cooldown=65 tick，cost=15。

原描述：穿透护甲的暗影攻击。

当前缺口：护甲穿透只来自角色 stats，技能自身没有穿透修正。

实现建议（新增数值为试验起点）：

1. 加入本技能的穿透参数，先试忽略 30% 护甲，并与角色穿透明确合成方式和上限。
2. 仅本次命中消费该参数；不要把能力写成全角色永久穿透或直接跳过全部防御。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 相同护甲目标下本技能与无穿透技能的配对受伤符合公式，零护甲不额外增伤。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：恐怖黎明（Grim Dawn）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK19.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/grim-combat.jpg) · [原图出处](https://store.steampowered.com/app/219990/Grim_Dawn/)。借鉴机制/信息组织，具体参数由本作验证。

### SK20 · 震慑 `stun_strike`

源：[skills-expanded.ts:52](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`single`，基础damage=25，range=2.5，radius=0，duration=30 tick，windup=5 tick，cooldown=80 tick，cost=12。

原描述：眩晕单个敌人。

当前缺口：single 只造成伤害，没有 30 tick 眩晕。

实现建议（新增数值为试验起点）：

1. 创建 1 秒眩晕状态，行动与施法能力由状态执行器控制。
2. 首领控制抵抗和不可打断动作需声明；表现只反映成功、抵抗或免疫的真实结果。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 普通目标在 1 秒内不能行动/施法，到期恢复；对首领规则一致且有反馈。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK20.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK21 · 重力陷阱 `gravity_well`

源：[skills-expanded.ts:53](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`zone`，基础damage=10，range=8，radius=3，duration=90 tick，windup=12 tick，cooldown=140 tick，cost=24。

原描述：减速并拉扯敌人。

当前缺口：zone 只有周期伤害，没有减速或拉扯。

实现建议（新增数值为试验起点）：

1. 区域持续 3 秒，按固定频率施加减速和有限牵引；伤害频率与位移频率分开。
2. 牵引沿身体碰撞移动，记录来源和最大位移；范围中心固定，不能把特效跟着目标漂移。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 区域内目标移动与位置真实改变，退出即按规则停止，墙体与首领抵抗有效。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK21.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK22 · 沉默 `silence`

源：[skills-expanded.ts:54](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=0，range=0，radius=5，duration=60 tick，windup=5 tick，cooldown=180 tick，cost=20。

原描述：禁止敌人使用技能。

当前缺口：零伤 area，没有禁止敌人技能的状态。

实现建议（新增数值为试验起点）：

1. 范围命中施加 2 秒沉默，限制主动技能但保留普攻；不能把“沉默”等同暂停整个敌人。
2. 正在前摇的技能是中断还是只禁止新技能需定义；首领免疫或韧性写入内容。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 沉默期普通怪不开始新技能，仍可普攻；到期、抵抗和净化有真实事件。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK22.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK23 · 石化 `petrify`

源：[skills-expanded.ts:55](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`single`，基础damage=15，range=10，radius=0，duration=90 tick，windup=15 tick，cooldown=200 tick，cost=28。

原描述：石化单个敌人。

当前缺口：只有一次 15 点伤害，没有 90 tick 控制。

实现建议（新增数值为试验起点）：

1. 配置 3 秒石化，决定受到伤害是否解除，以及是否伴随防御变化。
2. 石化与眩晕共用控制基础能力，但分别定义解除条件；不要凭颜色或冻结动画判定完成。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 被石化目标按规定不能移动/施法，受到伤害和到期各遵守解除规则。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK23.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK24 · 减速场 `slow_field`

源：[skills-expanded.ts:56](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`zone`，基础damage=5，range=9，radius=4，duration=150 tick，windup=8 tick，cooldown=120 tick，cost=18。

原描述：大范围减速区域。

当前缺口：只有区域周期伤害，slow 仅对 id=frost 开启。

实现建议（新增数值为试验起点）：

1. 把减速能力变为显式参数，建议 5 秒区域、30% 减速，不依赖固定技能 ID。
2. 进入、退出和多个区域重叠使用同一状态来源模型，地表边界读取真实 radius=4。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- frost 与 slow_field 都按自身参数执行；新增同机制技能只改内容即可生效。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK24.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK25 · 恐惧术 `fear`

源：[skills-expanded.ts:57](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=0，range=0，radius=4，duration=45 tick，windup=10 tick，cooldown=160 tick，cost=22。

原描述：使敌人逃跑。

当前缺口：零伤 area 没有驱使敌人逃跑。

实现建议（新增数值为试验起点）：

1. 配置 1.5 秒恐惧，暂时切换敌人的目标选择与逃离方向。
2. 可通行路径、地图边缘和首领抵抗必须执行；结束后恢复原 AI，不能删除敌人或强制穿墙。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 目标确实远离施法者，不能卡进墙体；结束后恢复接敌且已击杀实例不重刷。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK25.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK26 · 束缚 `root`

源：[skills-expanded.ts:58](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`zone`，基础damage=8，range=10，radius=2.5，duration=60 tick，windup=7 tick，cooldown=100 tick，cost=16。

原描述：固定敌人位置。

当前缺口：zone 只造成伤害，不固定敌人位置。

实现建议（新增数值为试验起点）：

1. 区域命中施加短定身，建议 2 秒，禁止普通移动但保留可施法。
2. 突进是否受限制、控制免疫和新状态刷新需要明确；不能把减速 100% 作为全部定身语义。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 目标普通移动停止，但允许的攻击/施法仍运行，到期恢复，突进遵守声明规则。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK26.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK27 · 致盲 `blind`

源：[skills-expanded.ts:59](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=0，range=0，radius=5，duration=75 tick，windup=5 tick，cooldown=140 tick，cost=18。

原描述：降低敌人命中率。

当前缺口：零伤 area，没有降低敌人命中或改变判定。

实现建议（新增数值为试验起点）：

1. 先建立实际命中/失手机制，再配置 2.5 秒致盲；建议初期 25% 失手概率作为测试值。
2. 使用已冻结的随机状态，失手产生独立事件；不同伤害路径是否受影响必须清楚。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 同种子配对可重放致盲命中差异，重连不会重抽，视觉与失手事件一致。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：恐怖黎明（Grim Dawn）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK27.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/grim-combat.jpg) · [原图出处](https://store.steampowered.com/app/219990/Grim_Dawn/)。借鉴机制/信息组织，具体参数由本作验证。

### SK28 · 虚空漩涡 `vortex`

源：[skills-expanded.ts:60](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`zone`，基础damage=20，range=8，radius=3.5，duration=90 tick，windup=18 tick，cooldown=170 tick，cost=30。

原描述：持续吸引并伤害。

当前缺口：区域持续伤害存在，但没有文案中的吸引。

实现建议（新增数值为试验起点）：

1. 沿重力陷阱的有限牵引能力，使用 radius=3.5/duration=3 秒的参数。
2. 区分持续牵引与漩涡之刃一次牵引，控制最大频率和首领抵抗，不能无限压入同点。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 持续期有实际牵引事件与伤害事件；结束后两者都停止，碰撞状态稳定。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK28.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK29 · 时间停滞 `time_stop`

源：[skills-expanded.ts:61](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`area`，基础damage=0，range=0，radius=6，duration=30 tick，windup=20 tick，cooldown=300 tick，cost=40。

原描述：短暂定身所有敌人。

当前缺口：零伤 area 没有定身或暂停敌人的能力。

实现建议（新增数值为试验起点）：

1. 将 1 秒时间停滞定义为指定目标的控制状态，暂停它们声明的行动，不暂停实例时钟。
2. 投射物、地面区域、首领韧性和冷却是否继续分别定义；切后台仍不延长副本时限。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 受影响敌人在 1 秒内按规则停止，玩家与副本倒计时继续，恢复不会重新生成敌人。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK29.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK30 · 加速 `haste`

源：[skills-expanded.ts:68](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`shield`，基础damage=0，range=0，radius=0，duration=120 tick，windup=2 tick，cooldown=180 tick，cost=20。

原描述：提升移动速度。

当前缺口：shield damage=0，不改变移动速度。

实现建议（新增数值为试验起点）：

1. 改为 4 秒速度 modifier，建议先试 +25% 移速，数值在服务端解析并进入临时状态。
2. 效果取最高/刷新策略明确；碰撞、寻路和网络输入归一化仍按实际速度工作。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 4 秒内位移增加预定比例，到期恢复；不因掉线、重复按键或区域切换永久叠加。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK30.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK31 · 再生 `regen`

源：[skills-expanded.ts:69](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`heal`，基础damage=0，range=0，radius=0，duration=180 tick，windup=5 tick，cooldown=200 tick，cost=18。

原描述：持续恢复生命。

当前缺口：heal damage=0，只会执行零点即时回复。

实现建议（新增数值为试验起点）：

1. 建立 6 秒持续治疗，建议总量先接近回春的单次预算，按每秒分配。
2. 释放条件基于受伤或预设策略；治疗事件可追踪，重复释放采用刷新或取最高，不无限叠层。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 受伤目标按声明节奏恢复，到期结束，治疗总量与报价一致；满血不会冒充有效治疗。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK31.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK32 · 闪现 `blink`

源：[skills-expanded.ts:70](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`dash`，基础damage=0，range=10，radius=0，duration=0 tick，windup=1 tick，cooldown=120 tick，cost=15。

原描述：瞬间移动。

当前缺口：dash 依赖敌人目标，没有目标时 cast=false，无法自由选择逃离位置。

实现建议（新增数值为试验起点）：

1. 提供显式地面目标/方向输入，使用10格最大距离与终点规则；自动模式单独定义避险目的地。
2. 闪现与普通突进是否检查整段身体路径要按现有接触约束明确，不借瞬移绕开墙体验收。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 无敌人时仍可按选定合法方向位移，非法终点不会扣费后卡墙，范围与提示一致。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK32.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK33 · 净化 `cleanse`

源：[skills-expanded.ts:72](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`heal`，基础damage=0，range=0，radius=0，duration=0 tick，windup=2 tick，cooldown=150 tick，cost=16。

原描述：移除减益效果。

当前缺口：heal damage=0，不清除状态；生命大于80%还会被治疗条件阻止。

实现建议（新增数值为试验起点）：

1. 改成清除允许列表的减益，施放条件根据可清除状态而非生命比例。
2. 只解除已定义可净化控制和持续伤害；来源、剩余时长和副本特殊标记不能随意全部删除。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 满血但中减益时可用，减益确实移除；无可清除状态按策略提示而非空扣费。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK33.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK34 · 相位转换 `phase_shift`

源：[skills-expanded.ts:73](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`shield`，基础damage=0，range=0，radius=0，duration=90 tick，windup=1 tick，cooldown=180 tick，cost=20。

原描述：免疫物理伤害。

当前缺口：shield damage=0，不提供物理伤害免疫。

实现建议（新增数值为试验起点）：

1. 在伤害类型尚未正式区分前，先收敛为已可执行的明确防护说明；若保留物理免疫，需要加入伤害类型合同。
2. 免疫建议3秒，伤害分类由所有命中路径声明；护盾、免疫与闪避的优先级固定，不能全部来袭伤害默认为物理。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 物理与其他类型配对命中结果符合声明，到期恢复，未分类伤害明确拒绝或迁移。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK34.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

### SK35 · 回气 `second_wind`

源：[skills-expanded.ts:74](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`heal`，基础damage=50，range=0，radius=0，duration=0 tick，windup=10 tick，cooldown=300 tick，cost=30。

原描述：大量恢复生命和法力。

当前缺口：只回复 50 生命，没有恢复法力。

实现建议（新增数值为试验起点）：

1. 增加独立能量回复字段，建议先试恢复25能量，声明治疗量与回能量的各自成长。
2. 施放条件考虑生命或能量至少一项不足，不沿用单纯80%生命门槛；费用与回能发生时点需明确。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 满血低能量时可按规则使用，两资源实际改变且不溢出各自上限。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：Hades（哈迪斯）；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK35.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/hades-boon.png) · [原图出处](https://gigazine.net/gsc_news/en/20210501-game-hades/)。借鉴机制/信息组织，具体参数由本作验证。

### SK36 · 守护天使 `guardian_angel`

源：[skills-expanded.ts:75](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)。当前kind=`shield`，基础damage=0，range=0，radius=0，duration=300 tick，windup=1 tick，cooldown=600 tick，cost=0。

原描述：死亡时复活一次。

当前缺口：shield damage=0，核心没有此技能的死亡拦截或复活记录。

实现建议（新增数值为试验起点）：

1. 实现一次致死拦截状态，建议有效10秒、一次消耗，复起生命比例单独设定。
2. 副本倒地/救援与该效果的顺序要固定，效果已消费状态进入检查点；避免退出、重连重复获得复活。
3. 通过共享能力/合同解析，再同步技能详情、报价与动效；保留已训练等级和原回执。新增图像优先复用用户指定的现成特效库，不能用动效代替机制。

验收：

- 连续两次致死只拦截第一次，同场重连不会重置次数；复起位置和生命可核对。
- 覆盖单人、多人目标、墙体、状态到期与检查点恢复；记录施法、命中、费用和失败样本。

参考：激战2；[机制方案图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/diagrams/SK36.png) · [真实参考图](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/references/gw2-combat.jpg) · [原图出处](https://hardstuck.gg/gw2/guides/general/game-basics-first-steps-in-tyria/)。借鉴机制/信息组织，具体参数由本作验证。

## 6项技能界面与装配交互

### I01 · 未保存装配关闭后丢失 · P1

对应原审查：EX08。入口：`apps/web/src/main.ts:125`、`apps/web/src/skills-panel.ts`

修复：关闭、Esc、切系统页统一处理未保存差异：保存并退出/放弃/继续编辑；保留角色归属、滚动与焦点。响应未知沿用原Outbox编号核回执。

验收：

- 移除技能后关闭不再无提示复原；取消退出保留草稿。
- 重复请求只保存一次，升级与保存意图不混用。

### I02 · 自动施法顺序缺可见调整入口 · P2

对应原审查：EX11。入口：`apps/web/src/main.ts:296`、`apps/web/src/skills-panel.ts:45`

修复：接出已有上移/下移动作，支持键盘；可再加拖动。只调整草稿，保存后才成为正式装配；说明按满足条件的装配顺序检查。

验收：

- 不移除技能即可调整顺序，焦点与图标尺寸不跳。
- 同构筑同种子验证实际施法顺序及治疗/防护触发。

### I03 · 费用未显示持有与缺口 · P2

对应原审查：UI05。入口：`apps/web/src/skills-panel.ts:22`、`apps/web/src/ui/primitives.ts`

修复：使用公共费用组件展示需要/持有/不足，未知值保持待核对；免费激活与满级分别明确呈现。

验收：

- 0、刚好足够、不足、满级和待确认各状态清楚。
- 消费服务端报价，UI不复制费用公式。

### I04 · 本场冻结构筑与升级后生效时机不清楚 · P1

对应原审查：EX07。入口：`apps/web/src/dungeon-controller.ts:18`、`apps/web/src/main.ts:165`、`apps/web/src/skills-panel.ts`

修复：区分持久等级/技能与入场冻结构筑；已锁定实例的培养/保存入口表现为不可执行并说明生效边界，保留只读查看。

验收：

- 升级提示与本场真实参数不冲突。
- 打开面板、后台和断线不暂停副本，不重置生命/冷却。

### I05 · 效果参数与升级差异不易比较 · P2

对应原审查：UI06。入口：`apps/web/src/ui/skill-effects.ts`、`apps/web/src/skills-panel.ts`

修复：伤害/治疗/护盾、冷却、能量固定对齐；控制时长、强度、跳数、层数、解除条件等新增真实字段进入详情与预览，只强调实际变化。

验收：

- 所有新能力均显示真实当前值与下一级效果。
- 长短描述、等级切换保持布局、列表滚动和焦点稳定。

### I06 · 缺跨分类检索与可用筛选 · P2

对应原审查：UI07。入口：`apps/web/src/skills-panel.ts:27`

修复：沿现有分组技能册补搜索及已激活/可激活/全部，保留分类、选中项与草稿；机制标签须对应已实现能力。

验收：

- 55个登记技能可按名称找到。
- 切换和清空筛选不改变草稿与当前权限。

## 机制完成后的2项数值复测

### T01 · 零伤害能力升级没有实际收益

当前：现行基础成长只乘damage，blood_rage/haste/regen/cleanse/phase_shift/guardian_angel等damage=0时升级仍可能不改变能力。

工作：机制完成后在唯一内容/规则源定义该能力真实成长字段，使skillAccess.current/next与实战一致；保留已训练等级、费用和激活门槛。

验收：

- 每个可升级技能至少有实际有效变化，满级不再报价。
- 新成长参数明确记录，控制/位移不无界放大。

### T02 · 装配的资源与输出/防护效率复测

当前：初始回能10/秒，穿云箭约耗4.8/秒、护身印约1.875/秒；伤害类倍率还作用于治疗/护盾解析。能力补齐后旧输出、控制、防护和回能结果将改变。

工作：同敌人/构筑/种子测每个技能施法、命中、输出、DOT、防护、治疗、能量与失败；自然获取和受控授予分别标注。先提出预算结果，不借此批量重做方阵、经济和怪物曲线。

验收：

- 请求与实际执行技能一致，空或无输出构筑不得静默过滤。
- 真实副本时限、冻结构筑、目标、独立玩家与跨阶段资源被消费。

## 兼容性与实施边界

1. 持久钱包、技能等级、技能书、装备、任务与奖励只由服务端应用服务修改；培养与预览共用同一规则。UI、特效和动画不能决定命中、消耗或发奖。
2. 所有新能力字段通过公共契约到达客户端和服务端战斗核心；避免Zod把未登记字段裁掉、服务器解析而客户端未消费、客户端写第二套成长公式。
3. 现有激活状态保留：达到条件不等于已激活；书技能只按本技能配置检查书，不追加等级门槛；未激活仅激活、已激活仅升级、满级禁用升级。
4. 新版开战冻结规则与完整构筑；旧实例按冻结版本恢复。新增状态、投射物、多段进度、来源、致死拦截是否已用等全部进入检查点。不能通过重建怪物、补满生命或重置冷却实现恢复。
5. 实时副本打开界面、后台和掉线仍继续，时间停滞只是对指定目标的控制，不暂停实例或副本倒计时。二十人仍是独立角色；治疗/护盾/控制/伤害归属不能聚合或串人。
6. 所有移动、突进、拉扯、恐惧路径及投射物覆盖墙体、存活角色/怪物、重叠出生与整段路径；闪现的路径/终点接触规则明确，不能只凭动画宣称穿越合格。
7. 新机制必须真实执行后再接动画：前摇、释放、接触、受击、持续、到期共用战斗时钟与事件。武器/手部/受击点/地面挂点分别处理，地面落点固定、飞行物离开发射点独立运动。
8. 特效先检索用户指定的 `G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套` 与已登记库；原始部件、微调和完整Spine播放分别登记来源、哈希、版本、挂点、混合和时序。不用换特效或改文案代替能力。
9. 此单不顺带重做职业、武器盘倍率、经济、怪物等级曲线或整套UI。发现依赖风险写出具体影响与提案；不能删除技能、清空已付费成长或把未实现机制悄悄改成普通伤害后标完成。

## 建议批次顺序

| 批次 | 内容 | 必须展示的玩家路径 |
| --- | --- | --- |
| 1 | 伤害类别/来源、状态生命周期；C01–C03；最小控制与持续效果 | 一次燃烧按时结束、怪物减速真实生效、保存恢复一致 |
| 2 | 多段/通道、投射物、接触点爆炸、一次区域爆发 | 多重箭/穿透箭/爆破箭/火球/箭雨/陨石实际释放和命中 |
| 3 | 控制与位移（含地面目标）、增益/代价 | 激活→装配→战斗中眩晕/沉默/拉扯/闪现→到期 |
| 4 | 治疗/回能/净化、反击/免疫、致死拦截 | 满血低能量回气、满血带减益净化、一次免死且不重复 |
| 5 | I01–I06、C04、T01–T02与全部回归 | 训练/报价→调整顺序→保存→冻结入场→真实效果与升级预览 |

每批在同一机制族内做完整闭环，避免一次新增所有枚举而无实际能力。实现者可调整批次，但所有ID都有最终状态与证据，不能以新增文件数或测试数代替玩家路径完成。

## 完成定义与测试清单

- 对全部55个正式技能建立能力/承诺矩阵：至少36个缺口逐项关闭，原19个未列专属缺口的技能同样回归。
- 每个技能覆盖成功、距离/资源/目标不足、忙碌/冷却、死亡目标、被打断/免疫、状态到期与重复施放；多段扣费和冷却只发生声明的一次。
- 控制/持续/治疗/增益不能仅靠 `damage>0` 判定完成。测试移动距离、行动窗口、目标状态、资源变化、防护/治疗量和致死拦截消费记录。
- 同种子双人/多人验证来源、队友目标、同源/异源叠加，包含施加者掉线或离开、本场重新聚焦、保存恢复和跨阶段。DOT不能错误使用另一个当前聚焦玩家的属性。
- 真实数据库验证激活/升级/保存、防重、响应丢失、回执恢复、原已训练等级和钱包保留；测试只用独立临时数据库。数据库套件共享运行锁/迁移状态时串行执行，避免把编排干扰当玩家问题。
- 数值运行显式设技能激活/等级，校验请求构筑与 `resolveBuild` 返回一致，记录每技能施法、命中、总量、来源份额、资源和失败。自然取得与受控授予区分；实际副本规则与时限来自入场定义。
- 实机至少1280×720与1024×576，连续切条目/页签/等级，核对图标尺寸、布局、焦点、滚动、报价、主操作与技能槽序号；新状态的出现/刷新/解除/到期有正确反馈。
- 改API/contracts/content/rules/simulation后按AGENTS同步后台；核对实际 `/api/health` 与 `/api/content` 的protocol/rules/assets兼容，再做真实账号登录、会话恢复、进入营地和技能使用。构建按停止服务→构建→恢复执行，保留版本校验与原存档。

参考基础检查为TypeScript无输出检查、内容校验、相关Vitest及完整回归；涉及数据库用临时库。不要用mock证明真实持久命令或联网恢复。报告包含执行前/后指纹、规则版本、种子、构筑、模式、样本与限制。

## 源文件导航与证据

- 定义/规则：[skills-expanded.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/skills-expanded.ts)、[content/index.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/content/index.ts)、[rules/index.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/rules/index.ts)、[deep-progression.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/rules/deep-progression.ts)、[contracts/index.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/contracts/index.ts)。
- 执行/恢复：[simulation/index.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/simulation/index.ts)、[dungeon-service.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/apps/api/src/dungeon-service.ts)、[party-rescue.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/packages/simulation/party-rescue.ts)。
- UI/表现：[main.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/apps/web/src/main.ts)、[skills-panel.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/apps/web/src/skills-panel.ts)、[ui/skill-effects.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/apps/web/src/ui/skill-effects.ts)、[combat-vfx.ts](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/apps/web/src/combat-vfx.ts)、`vfx-profiles.ts`、`effect-attachments.ts`。
- 当前实现边界：[combat-contact-and-effects.md](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/docs/combat-contact-and-effects.md)；技能生命周期文档部分版本/美术说明为历史，实际以当前源码和项目标准为准。
- 基线受控数据：[55技能施放](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/evidence/math-audit.json)、[燃烧/祝福/无目标施放](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/.design/project-audit-20261003/evidence/mechanism-probes.json)。
- 原 `.design/project-audit-20261003/audit-math.ts` 与 `mechanism-probes.ts` **默认导入snapshot**；原封不动运行它们只会测旧实现。新增验收必须导入实际 `G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world`、输出当前版本与指纹；不要修改snapshot或用旧报告证明新版本已修复。
- [本任务机器清单与当前源码指纹](G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/docs/skill-repair-handoff-20261003.json)；每项参考图、原游戏与验收均已保留。

## 修复Agent交付格式

提交逐项状态：`待处理 / 已修复并实机验证 / 已修复待验证 / 阻碍及原因`，每项写实际规则、源文件、关键证据与剩余影响。提供至少一个可复现的成功与边界路径、原存档/回执核对以及服务版本健康结果。零伤害功能、只改表现、只通过纯核心测试均不能代替完整能力和联网恢复验收。
