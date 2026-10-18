# P0 节奏与 BD 盘点

## 范围与口径

当前源 {"client":"0.11.24","protocol":34,"rules":"ow-63","assets":"world-art-20261007-v24-world-runtime","db":16}。历史30小时文档是旧设计，不能当作现状；任务单344.6分钟为历史参照。已保存的较新两路线为328.763/337.276虚拟分钟。
本次基线来源：docs/reviews/pacing-tool-20261010/P0/natural-calendar-no-quests.json；no-quests，种子41，真实World/PG，虚拟324.923分钟，实际运行397.58秒。自然角色未授予等级/装备/技能/金币；BD另用合法受控授予，明确分开。

## 节奏旋钮

| 类别 | 唯一来源/字段 | 影响与边界 |
|---|---|---|
| 升级经验 | packages/content/progression-curve.json / thresholds; packages/rules/index.ts / xpThreshold | 每级所需经验，影响升级/功能准入/可刷路线；旧存档等级不回写 |
| 击杀经验/经济 | packages/content/starsea/balance.json / killXpMultipliers,bossXpMultipliers; apps/api/src/economy.ts / monsterReward; apps/api/src/regional-rewards.json | 经验与金币/强化石收入；保持随机结构、防刷和每次包量 |
| 怪物模板/曲线 | packages/content/monsters.json / curves, ranks, roles, templates; packages/rules/monster-stats.ts | 模板×指定等级×档位×难度；生命决定TTK，攻击决定承伤，护甲影响强度形状 |
| 阶段/副本 | packages/content/dungeons.json; packages/content/starsea/index.ts; packages/content/open-world/production.json | 入场等级、怪物等级、难度、目标、时限及冻结规则；不能统一按玩家等级缩放 |
| 海域难度 | packages/content/world-tiers.json / tiers,growth | 怪物生命/攻击与奖励倍率；100档增长；本轮不改解锁、防刷和次数结构 |
| 钥匙 | apps/api/src/stage-key-pools.json / pools[].required,materialsPerSource,dropProbability,basis | 24阶段碎片兜底、直接钥匙概率与预期等待；碎片数量/消耗可推导，随机生成结构不改 |
| 精英/稀有/营地 | config/excel/世界.xlsx → config/json/world.json / camps,rares,patrols | 刷新间隔、怪群和路线；清场不原地复刷规则保留，不能用提高刷新绕过规则 |
| 掉落/品质 | apps/api/src/field-loot.json; packages/content/gear-affixes.json; packages/content/equipment-runtime.json | 包量、品质、部位、词缀与制作保证；不降掉率/少掉来掩盖弱BD |
| 巅峰/养成消耗 | packages/content/deep-progression.json / paragonXp,costs,recipes,reputationThresholds | 巅峰经验、金币与材料支出；节点数量/玩法结构不增减 |
| 技能/天赋/威能/套装 | packages/content/skills-expanded.ts, talent-trees.ts, effect-atoms.json, aspects.json, set-effects.json, augments.json | BD机制与强弱形状；优先修改自身核心机制，所有请求必须与实际执行匹配 |
| 强化/防御 | packages/content/combat-numerics.json, level-stats.json | 角色基础成长、强化效率、防御曲线；通用调整须单列原因，不能以通用值掩盖BD问题 |

## 当前升级与首领时间线（虚拟日程）

| 里程碑 | 虚拟分钟 | 单场击杀秒 |
|---|---:|---:|
| Lv5 | 8.350 | — |
| Lv10 | 26.067 | — |
| Lv20 | 58.579 | — |
| Lv30 | 88.508 | — |
| Lv40 | 142.191 | — |
| Lv50 | 324.923 | — |
| ss-map-boss-1（L7） | 21.265 | 24.133 |
| ss-map-boss-2（L14） | 38.200 | 32.200 |
| ss-map-boss-3（L21） | 62.698 | 43.800 |
| ss-map-boss-4（L26） | 76.981 | 29.167 |
| ss-map-boss-5（L31） | 93.038 | 25.867 |
| ss-map-boss-6（L36） | 113.025 | 30.267 |

海域档：当前1，已解锁1；未实际到达的高档无虚拟时间，不以解锁条件冒充到达实测。
内容时间参考：战斗23.27分，其中岛首领4.38分，其他战斗18.89分；恢复估计274.17分。安全/生存与清图交叠，旧日志无法拆成互斥五场景占比；不把未记录项写成0，不据此改用户权重。

## 巅峰与完成度

| 养成线 | 可达总量/口径 | 当前预计与待调项 |
|---|---|---|
| 巅峰 | 无限等级；4盘×12=48节点，47级可全部点亮 | 经验600+100/级；本路线平均37764经验/虚拟分钟下，第0级0.016分，第47级0.140分；47级总经验136300，约3.61分，明显过短，待按完成度调经验曲线。此为现有收入外推，不是巅峰实测。 |
| 天赋 | 41节点/121理论等级，实际预算最多60点，有互斥层 | 完成度=已分配可用点/可用点；不能把所有树同时全点满设为目标。升级及声望决定点，金币不是唯一门槛；全补满时间尚无自然样本。 |
| 技能 | 83技能，满级5；觉醒3分支每技能选1 | 完成度=满级技能数/已解锁技能数；书本获取和材料仍需自然样本，不能按受控授予时间推断。 |
| 装备/套装 | 18套身份，六部位、4+2/2+2+2；324收藏模板 | 品质覆盖=已装备达标部位/6；套装收集按18身份，携带搭配按当前六件。W11 85件/180.28分只是单路线掉落观测，不能推得每套补齐概率。 |
| 威能/潮印 | 61可掉落威能，每法典最高5；90潮印 | 法典按可获取身份/等级覆盖；潮印局内选择，不把90项写成永久拥有数。未获得部分无法给出补满时间。 |
| 觉醒/制造/声望 | 角色觉醒10层；336配方；6势力×4阶段；专业上限300 | 消耗与产出见deep-progression；完整自然补满样本缺失，目标表明确设计速率，推导器不冒充观测。 |

## 八 BD 基线（场景内相对八套中位数）

权重：清图0.30、机动安全0.25、首领0.20、精英0.15、生存0.10。每场景一次seed41，共40场；详细施法、伤害、失败与请求/实际构筑见P0/bd-measurements.json。

| BD | 首领 | 清图 | 生存 | 精英 | 机动安全 | 加权预算 |
|---|---:|---:|---:|---:|---:|---:|
| 燃烧引爆 | 0.559 | 1.023 | 1.390 | 0.473 | 0.983 | 0.874 |
| 冻结碎冰 | 1.142 | 0.993 | 1.463 | 0.788 | 7.373 | 2.634 |
| 疾行游击 | 1.874 | 0.392 | 1.000 | 1.564 | 2.809 | 1.529 |
| 震地旋风 | 0.426 | 1.323 | 0.610 | 0.256 | 0.983 | 0.827 |
| 分裂箭雨 | 2.915 | 1.007 | 0.615 | 1.212 | 0.983 | 1.374 |
| 回响法师 | 0.858 | 1.377 | 0.610 | 2.308 | 1.787 | 1.439 |
| 坚壁反伤 | 0.451 | 0.865 | 1.390 | 0.490 | 0.983 | 0.808 |
| 先手刺杀 | 1.513 | 0.218 | 1.000 | 10.772 | 1.017 | 2.338 |

低于0.6的弱项将补自身机制/技能；超过1.5的强项单独校对自身参数。禁止降掉率、少掉或把其他BD降下来掩盖弱项。分裂箭雨采用暗器千刃投射物替代弓构筑，原因与请求技能完整记录。

## 未覆盖

走位、躲避、手感、真人读字/整理/反应、种子分布、长期自然BD收集概率均需用户试玩或后续采样。本轮不以理论预测冒充实测，不宣称整体平衡通过。
