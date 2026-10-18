# 四岛敌人技能设计

按现有机制原子组合，新的ID与岛主题、技能组合和状态共同定义；倍率由E2真实HP/护甲/致死时间反推，不手填。

## 风栖

主题：海风、船坞、钩索、鸟群。普通40秒、精英20秒、稀有30秒、首领70秒为受控推导目标。

| id | 中文名 | 定位/形态 | 元素 | 预警tick | 冷却tick | 倍率来源 | 特效主题 | 音效基调 |
|---|---|---|---|---|---|---|---|---|
| island_wind_skitter | 疾风扑击 | melee / dash | physical | 24 | 360 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | streak | steel |
| island_wind_hook | 缆钩缠足 | projectile / root | physical | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | spear | steel |
| island_wind_gust | 甲板风压 | zone / slow | physical | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | sweep | steel |
| island_wind_gale | 桅杆裂风 | projectile / slow | physical | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | forks | steel |
| island_wind_talon | 群鸟俯掠 | zone / blind | physical | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | landing | steel |
| island_wind_anchor | 落锚锁链 | zone / root | physical | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | rune | steel |
| island_wind_boss_squall | 船坞飑线 | projectile / slow | physical | 45 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | forked-arrow | steel |
| island_wind_boss_anchor | 重锚落点 | trap / root | physical | 60 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | crater | steel |
| island_wind_boss_flock | 群鸟盘旋 | zone / blind | physical | 45 | 270 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | wings | steel |
| island_wind_boss_deck | 甲板裂压 | zone / slow | physical | 60 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | staff-fissure | steel |
| island_wind_boss_gale | 桅顶狂风 | projectile / slow | physical | 45 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | spear | steel |

模板分配：

- ow-mon-wind-1：island_wind_skitter。
- ow-elite-wind：island_wind_gust、island_wind_gale。
- ow-mon-wind-2：island_wind_hook。
- ow-rare-wind-1：island_wind_talon、island_wind_hook。
- ow-rare-wind-2：island_wind_anchor、island_wind_gust。
- ow-boss-wind-1：island_wind_boss_squall、island_wind_boss_anchor、island_wind_boss_deck；招牌 island_wind_boss_squall；两阶段100%/55%。
- ow-boss-wind-2：island_wind_boss_anchor、island_wind_boss_flock、island_wind_boss_gale；招牌 island_wind_boss_anchor；两阶段100%/55%。
- ow-boss-wind-3：island_wind_boss_flock、island_wind_boss_deck、island_wind_boss_squall；招牌 island_wind_boss_flock；两阶段100%/55%。
- 岛主保留旧机制，添加 island_wind_boss_squall。

## 雾隐

主题：迷雾、苔藓、藤蔓、花粉、军需盾阵。普通40秒、精英20秒、稀有30秒、首领70秒为受控推导目标。

| id | 中文名 | 定位/形态 | 元素 | 预警tick | 冷却tick | 倍率来源 | 特效主题 | 音效基调 |
|---|---|---|---|---|---|---|---|---|
| island_mist_pollen | 轻扬花粉 | melee / slow | poison | 24 | 360 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | buds | nature |
| island_mist_vine | 藤索缠足 | projectile / root | poison | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | vines | nature |
| island_mist_fog | 迷雾障眼 | zone / blind | poison | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | miasma-cloud | nature |
| island_mist_guard | 苔盾护阵 | buff / buff | poison | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | buckler | nature |
| island_mist_snare | 军需藤网 | zone / root | poison | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | lattice | nature |
| island_mist_bloom | 孢花炸散 | zone / slow | poison | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | toxic-cloud | nature |
| island_mist_boss_fog | 迷途雾幕 | zone / blind | poison | 45 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | miasma-cloud | nature |
| island_mist_boss_vine | 藤墙束缚 | trap / root | poison | 60 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | vines | nature |
| island_mist_boss_pollen | 花粉流雨 | projectile / slow | poison | 45 | 270 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | needle-triple | nature |
| island_mist_boss_moss | 苔巢扩散 | zone / slow | poison | 60 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | buds | nature |
| island_mist_boss_mark | 孢印落点 | trap / root | poison | 45 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | rune | nature |

模板分配：

- ow-mon-mist-1：island_mist_pollen。
- ow-elite-mist：island_mist_fog、island_mist_guard。
- ow-mon-mist-2：island_mist_vine。
- ow-rare-mist-1：island_mist_snare、island_mist_vine。
- ow-rare-mist-2：island_mist_bloom、island_mist_fog。
- ow-boss-mist-1：island_mist_boss_fog、island_mist_boss_vine、island_mist_boss_moss；招牌 island_mist_boss_fog；两阶段100%/55%。
- ow-boss-mist-2：island_mist_boss_vine、island_mist_boss_pollen、island_mist_boss_mark；招牌 island_mist_boss_vine；两阶段100%/55%。
- ow-boss-mist-3：island_mist_boss_pollen、island_mist_boss_moss、island_mist_boss_fog；招牌 island_mist_boss_pollen；两阶段100%/55%。
- 岛主保留旧机制，添加 island_mist_boss_fog。

## 锻炉

主题：熔炉、熔渣、矿车、采能机、过热爆炸。普通40秒、精英20秒、稀有30秒、首领70秒为受控推导目标。

| id | 中文名 | 定位/形态 | 元素 | 预警tick | 冷却tick | 倍率来源 | 特效主题 | 音效基调 |
|---|---|---|---|---|---|---|---|---|
| island_forge_spark | 炉火飞星 | projectile / burn | fire | 36 | 360 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | ember-arrow | fire |
| island_forge_slag | 熔渣倾泻 | zone / slow | fire | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | magma-crater | fire |
| island_forge_breath | 炉口喷焰 | zone / burn | fire | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | flames | fire |
| island_forge_cart | 矿工冲撞 | melee / dash | fire | 24 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | streak | fire |
| island_forge_overheat | 过热裂爆 | zone / burn | fire | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | orb | fire |
| island_forge_melt | 采能熔蚀 | projectile / armor_down | fire | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | corroded-cross | fire |
| island_forge_boss_vent | 炉膛喷射 | zone / burn | fire | 45 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | flames | fire |
| island_forge_boss_cart | 失控矿车 | projectile / stun | fire | 60 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | heavy-cross | fire |
| island_forge_boss_slag | 熔渣坑阵 | trap / slow | fire | 45 | 270 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | magma-crater | fire |
| island_forge_boss_overheat | 过热核心 | trap / burn | fire | 60 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | orb | fire |
| island_forge_boss_extract | 采能脉冲 | zone / armor_down | fire | 45 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | static-lattice | fire |

模板分配：

- ow-mon-forge-1：island_forge_spark。
- ow-elite-forge：island_forge_breath、island_forge_cart。
- ow-mon-forge-2：island_forge_slag。
- ow-rare-forge-1：island_forge_overheat、island_forge_slag。
- ow-rare-forge-2：island_forge_melt、island_forge_breath。
- ow-boss-forge-1：island_forge_boss_vent、island_forge_boss_cart、island_forge_boss_overheat；招牌 island_forge_boss_vent；两阶段100%/55%。
- ow-boss-forge-2：island_forge_boss_cart、island_forge_boss_slag、island_forge_boss_extract；招牌 island_forge_boss_cart；两阶段100%/55%。
- ow-boss-forge-3：island_forge_boss_slag、island_forge_boss_overheat、island_forge_boss_vent；招牌 island_forge_boss_slag；两阶段100%/55%。
- 岛主保留旧机制，添加 island_forge_boss_vent。

## 霜岛

主题：冰棱、冻潮、霜镜、封舱。普通40秒、精英20秒、稀有30秒、首领70秒为受控推导目标。

| id | 中文名 | 定位/形态 | 元素 | 预警tick | 冷却tick | 倍率来源 | 特效主题 | 音效基调 |
|---|---|---|---|---|---|---|---|---|
| island_frost_bite | 霜牙轻咬 | melee / slow | cold | 24 | 360 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | fangs | ice |
| island_frost_arrow | 碎镜冰箭 | projectile / slow | cold | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | crystal | ice |
| island_frost_stomp | 寒潮踏地 | zone / slow | cold | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | frozen-fissure | ice |
| island_frost_spike | 冰棱锁足 | zone / root | cold | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | spikes | ice |
| island_frost_veil | 冻雾漫舱 | zone / blind | cold | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | miasma-cloud | ice |
| island_frost_shard | 霜镜穿射 | projectile / slow | cold | 36 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | spear | ice |
| island_frost_boss_mirror | 霜镜贯刺 | projectile / slow | cold | 45 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | crystal | ice |
| island_frost_boss_tide | 冻潮旋环 | zone / slow | cold | 60 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | ice-ring | ice |
| island_frost_boss_prison | 封舱冰阵 | trap / root | cold | 45 | 270 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | lattice | ice |
| island_frost_boss_fissure | 冰壳碎裂 | trap / slow | cold | 60 | 210 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | frozen-fissure | ice |
| island_frost_boss_veil | 白霜帷幕 | zone / blind | cold | 45 | 240 | 玩家HP÷目标TTD×周期×威胁份额，经原hurt执行器反求 | miasma-cloud | ice |

模板分配：

- ow-mon-frost-1：island_frost_bite。
- ow-elite-frost：island_frost_stomp、island_frost_spike。
- ow-mon-frost-2：island_frost_arrow。
- ow-rare-frost-1：island_frost_veil、island_frost_arrow。
- ow-rare-frost-2：island_frost_shard、island_frost_stomp。
- ow-boss-frost-1：island_frost_boss_mirror、island_frost_boss_tide、island_frost_boss_fissure；招牌 island_frost_boss_mirror；两阶段100%/55%。
- ow-boss-frost-2：island_frost_boss_tide、island_frost_boss_prison、island_frost_boss_veil；招牌 island_frost_boss_tide；两阶段100%/55%。
- ow-boss-frost-3：island_frost_boss_prison、island_frost_boss_fissure、island_frost_boss_mirror；招牌 island_frost_boss_prison；两阶段100%/55%。
- 岛主保留旧机制，添加 island_frost_boss_mirror。

## 默认裁决

- 钩索采用既有投射物+定身的“缠足”读法；风压采用既有区域+减速，不新增强制拉拽规则。
- 群鸟是有预警区域袭击；矿车是实体投射物，使用现有投射物碰撞，不伪造未知召唤效果。
- 锻炉不再借用冰技能；霜岛旧冰技能的定位保留，技能组按新组合补齐。
- 首领只组合projectile/zone/trap现有原子；两阶段及三组招牌不同。

## Z来源复核

上表的首领70秒是本任务误用的设计目标，不是既定TTD。既定starsea-balance-ttk-plan §2.2及open-world-numeric-flow §5规定首领TTD30秒。推导及一次调参验收已执行，不能将本轮数值宣称完成；详见skill-audio-vfx-progress.md。未擅自追加推导、测量或修改玩家规则。
