# 音频盘点

数据源：vfx-profiles、skills-expanded（30Hz冷却）、monsters.json。可用 tools/audio/census.ts 重新导出。

| 前缀 | 数量 |
|---|---|
| player | 83 |
| monster | 61 |
| boss | 39 |
| combo | 23 |
| status | 21 |
| system | 2 |

## 技能/状态/连携/敌方技能

| key | 元素 | 形态 | 冷却秒 | 档 | 招牌 |
|---|---|---|---|---|---|
| player/cut | steel | slash | 0.80 | filler |  |
| player/whirl | steel | spin | 2.50 | core | ★ |
| player/rush | steel | dash | 3.67 | core |  |
| player/cleave | earth | burst | 6.00 | core |  |
| player/dual_strike | steel | slash | 1.17 | core |  |
| player/ground_slam | earth | burst | 3.00 | core | ★ |
| player/blade_fury | steel | spin | 4.00 | core | ★ |
| player/execute | blood | slash | 5.00 | core | ★ |
| player/leap_strike | earth | dash | 3.17 | core |  |
| player/blood_rage | blood | shield | 8.00 | cooldown |  |
| player/vortex_blade | arcane | spin | 2.83 | core | ★ |
| player/counter_strike | steel | shield | 6.00 | core |  |
| player/rampage | blood | burst | 2.00 | core |  |
| player/berserker | blood | slash | 4.00 | core | ★ |
| player/war_cry | holy | burst | 5.00 | core | ★ |
| player/bolt | steel | projectile | 0.83 | filler |  |
| player/ember | fire | zone | 4.33 | core |  |
| player/chain | storm | chain | 3.17 | core | ★ |
| player/lance | arcane | projectile | 3.00 | core |  |
| player/multi_shot | steel | projectile | 1.33 | core |  |
| player/pierce_arrow | steel | projectile | 1.83 | core |  |
| player/rain_of_arrows | steel | zone | 3.67 | core | ★ |
| player/explosive_shot | fire | projectile | 2.67 | core | ★ |
| player/snipe | steel | chain | 4.00 | core | ★ |
| player/poison_arrow | poison | projectile | 2.33 | core |  |
| player/volley | steel | projectile | 1.50 | core |  |
| player/arcane_missile | arcane | projectile | 2.00 | core |  |
| player/meteor | fire | zone | 6.00 | core | ★ |
| player/barrage | arcane | zone | 3.00 | core |  |
| player/frost_bolt | ice | projectile | 1.67 | core |  |
| player/lightning_bolt | storm | projectile | 2.50 | core |  |
| player/fireball | fire | projectile | 2.83 | core | ★ |
| player/dark_arrow | shadow | projectile | 2.17 | core |  |
| player/frost | ice | zone | 5.00 | core | ★ |
| player/nova | ice | burst | 5.00 | core |  |
| player/stun_strike | earth | slash | 2.67 | core |  |
| player/gravity_well | arcane | zone | 4.67 | core | ★ |
| player/silence | shadow | burst | 6.00 | core |  |
| player/petrify | earth | chain | 6.67 | cooldown |  |
| player/slow_field | ice | zone | 4.00 | core |  |
| player/fear | shadow | burst | 5.33 | core |  |
| player/root | nature | zone | 3.33 | core |  |
| player/blind | holy | burst | 4.67 | core |  |
| player/vortex | shadow | zone | 5.67 | core | ★ |
| player/time_stop | arcane | burst | 10.00 | cooldown | ★ |
| player/ward | holy | shield | 8.00 | cooldown |  |
| player/mend | nature | heal | 9.00 | cooldown |  |
| player/haste | nature | shield | 6.00 | core |  |
| player/regen | nature | heal | 6.67 | cooldown |  |
| player/blink | arcane | dash | 4.00 | core |  |
| player/barrier | ice | shield | 7.33 | cooldown |  |
| player/cleanse | holy | heal | 5.00 | core |  |
| player/phase_shift | shadow | shield | 6.00 | core |  |
| player/second_wind | nature | heal | 10.00 | cooldown |  |
| player/guardian_angel | holy | shield | 20.00 | cooldown | ★ |
| player/throwing_knife | steel | projectile | 0.60 | filler |  |
| player/fan_of_knives | steel | projectile | 1.50 | core |  |
| player/venom_needle | poison | projectile | 1.67 | core |  |
| player/shadow_step | shadow | dash | 3.00 | core |  |
| player/blade_flurry | steel | slash | 2.00 | core |  |
| player/explosive_kunai | fire | projectile | 2.83 | core |  |
| player/assassinate | blood | slash | 4.67 | core | ★ |
| player/death_lotus | blood | spin | 5.33 | core | ★ |
| player/frost_blade | ice | slash | 1.50 | core |  |
| player/thunder_dash | storm | dash | 3.67 | core | ★ |
| player/magma_slam | fire | burst | 3.67 | core | ★ |
| player/venom_cleave | poison | burst | 2.13 | core |  |
| player/frost_quake | ice | burst | 5.67 | core |  |
| player/fire_arrow | fire | projectile | 4.00 | core |  |
| player/thunder_arrow | storm | chain | 3.17 | core |  |
| player/night_volley | shadow | projectile | 1.73 | core | ★ |
| player/toxic_bomb | poison | zone | 4.00 | core |  |
| player/shadow_blade | shadow | slash | 1.83 | core |  |
| player/night_veil | shadow | burst | 4.00 | core | ★ |
| player/static_field | storm | zone | 4.33 | core |  |
| player/dark_grasp | shadow | chain | 4.67 | core |  |
| player/miasma | poison | zone | 4.67 | core |  |
| player/staff_strike | steel | slash | 0.90 | filler |  |
| player/staff_sweep | earth | spin | 3.00 | core |  |
| player/pole_vault | earth | dash | 3.83 | core |  |
| player/staff_flurry | steel | slash | 2.07 | core |  |
| player/seismic_staff | earth | burst | 5.83 | core | ★ |
| player/staff_cyclone | steel | spin | 5.00 | core |  |
| monster/frost_bite | ice | slash | 0.00 | filler |  |
| monster/ice_arrow | ice | projectile | 0.00 | filler |  |
| monster/ice_spike | ice | zone | 0.00 | core |  |
| monster/frost_stomp | ice | burst | 0.00 | core |  |
| monster/backstab | shadow | dash | 0.00 | core |  |
| monster/bone_spear | earth | projectile | 0.00 | filler |  |
| monster/death_explosion | poison | burst | 0.00 | core |  |
| monster/summon_undead | shadow | summon | 0.00 | cooldown |  |
| monster/flame_breath | fire | zone | 0.00 | core |  |
| monster/shield_bash | steel | slash | 0.00 | filler |  |
| monster/dragon_blessing | holy | heal | 0.00 | core |  |
| monster/basic-melee | steel | slash | 0.00 | filler |  |
| monster/basic-ranged | steel | projectile | 0.00 | filler |  |
| monster/basic-area | earth | zone | 0.00 | core |  |
| monster/frost_nova | ice | burst | 0.00 | core |  |
| monster/elite_fire_trail | fire | zone | 0.00 | core |  |
| monster/elite_teleport | arcane | dash | 0.00 | core |  |
| boss/ice_lance | ice | projectile | 0.00 | filler |  |
| boss/blizzard | ice | zone | 0.00 | core |  |
| boss/ice_prison | ice | zone | 0.00 | core |  |
| boss/ice_burst | ice | burst | 0.00 | core |  |
| boss/void_bolt | shadow | projectile | 0.00 | filler |  |
| boss/ritual | shadow | summon | 0.00 | cooldown |  |
| boss/void_zone | shadow | zone | 0.00 | core |  |
| boss/death_mark | shadow | mark | 0.00 | core |  |
| boss/claw_swipe | fire | slash | 0.00 | filler |  |
| boss/flame_breath | fire | zone | 0.00 | core |  |
| boss/tail_slam | earth | burst | 0.00 | core |  |
| boss/dive_bomb | fire | burst | 0.00 | core |  |
| boss/fire_rain | fire | zone | 0.00 | core |  |
| boss/summon_whelps | fire | summon | 0.00 | cooldown |  |
| boss/dragon_roar | holy | burst | 0.00 | core |  |
| boss/ultimate | fire | beam | 0.00 | core |  |
| combo/sword-qi | steel | slash | 0.00 | filler |  |
| combo/quake | earth | burst | 0.00 | core |  |
| combo/split-arrow | steel | projectile | 0.00 | filler |  |
| combo/shatter | ice | burst | 0.00 | core |  |
| combo/storm | storm | burst | 0.00 | core |  |
| combo/overload | arcane | burst | 0.00 | core |  |
| combo/return-blade | steel | projectile | 0.00 | filler |  |
| system/damage | steel | slash | 0.00 | filler |  |
| system/burn | fire | zone | 0.00 | core |  |
| combo/innate-staff-ignite | fire | zone | 0.00 | core |  |
| combo/innate-wand-shock | storm | chain | 0.00 | filler |  |
| combo/aspect-combo-bloodblade | blood | slash | 0.00 | filler |  |
| combo/aspect-combo-sunder | holy | burst | 0.00 | core |  |
| combo/aspect-combo-venomedge | poison | projectile | 0.00 | filler |  |
| boss/basic-melee | steel | slash | 0.00 | filler |  |
| boss/basic-ranged | steel | projectile | 0.00 | filler |  |
| boss/basic-area | earth | zone | 0.00 | core |  |
| monster/island_wind_skitter | steel | dash | 0.00 | core |  |
| monster/island_wind_hook | steel | projectile | 0.00 | filler |  |
| monster/island_wind_gust | steel | zone | 0.00 | core |  |
| monster/island_wind_gale | steel | projectile | 0.00 | filler |  |
| monster/island_wind_talon | steel | zone | 0.00 | core |  |
| monster/island_wind_anchor | steel | zone | 0.00 | core |  |
| boss/island_wind_boss_squall | steel | projectile | 0.00 | filler |  |
| monster/island_wind_boss_squall | steel | projectile | 0.00 | filler |  |
| boss/island_wind_boss_anchor | steel | mark | 0.00 | core |  |
| monster/island_wind_boss_anchor | steel | zone | 0.00 | core |  |
| boss/island_wind_boss_flock | steel | zone | 0.00 | core |  |
| monster/island_wind_boss_flock | steel | zone | 0.00 | core |  |
| boss/island_wind_boss_deck | steel | zone | 0.00 | core |  |
| monster/island_wind_boss_deck | steel | zone | 0.00 | core |  |
| boss/island_wind_boss_gale | steel | projectile | 0.00 | filler |  |
| monster/island_wind_boss_gale | steel | projectile | 0.00 | filler |  |
| monster/island_mist_pollen | nature | slash | 0.00 | filler |  |
| monster/island_mist_vine | nature | projectile | 0.00 | filler |  |
| monster/island_mist_fog | nature | zone | 0.00 | core |  |
| monster/island_mist_guard | nature | shield | 0.00 | cooldown |  |
| monster/island_mist_snare | nature | zone | 0.00 | core |  |
| monster/island_mist_bloom | nature | zone | 0.00 | core |  |
| boss/island_mist_boss_fog | nature | zone | 0.00 | core |  |
| monster/island_mist_boss_fog | nature | zone | 0.00 | core |  |
| boss/island_mist_boss_vine | nature | mark | 0.00 | core |  |
| monster/island_mist_boss_vine | nature | zone | 0.00 | core |  |
| boss/island_mist_boss_pollen | nature | projectile | 0.00 | filler |  |
| monster/island_mist_boss_pollen | nature | projectile | 0.00 | filler |  |
| boss/island_mist_boss_moss | nature | zone | 0.00 | core |  |
| monster/island_mist_boss_moss | nature | zone | 0.00 | core |  |
| boss/island_mist_boss_mark | nature | mark | 0.00 | core |  |
| monster/island_mist_boss_mark | nature | zone | 0.00 | core |  |
| monster/island_forge_spark | fire | projectile | 0.00 | filler |  |
| monster/island_forge_slag | fire | zone | 0.00 | core |  |
| monster/island_forge_breath | fire | zone | 0.00 | core |  |
| monster/island_forge_cart | fire | dash | 0.00 | core |  |
| monster/island_forge_overheat | fire | zone | 0.00 | core |  |
| monster/island_forge_melt | fire | projectile | 0.00 | filler |  |
| boss/island_forge_boss_vent | fire | zone | 0.00 | core |  |
| monster/island_forge_boss_vent | fire | zone | 0.00 | core |  |
| boss/island_forge_boss_cart | fire | projectile | 0.00 | filler |  |
| monster/island_forge_boss_cart | fire | projectile | 0.00 | filler |  |
| boss/island_forge_boss_slag | fire | mark | 0.00 | core |  |
| monster/island_forge_boss_slag | fire | zone | 0.00 | core |  |
| boss/island_forge_boss_overheat | fire | mark | 0.00 | core |  |
| monster/island_forge_boss_overheat | fire | zone | 0.00 | core |  |
| boss/island_forge_boss_extract | fire | zone | 0.00 | core |  |
| monster/island_forge_boss_extract | fire | zone | 0.00 | core |  |
| monster/island_frost_bite | ice | slash | 0.00 | filler |  |
| monster/island_frost_arrow | ice | projectile | 0.00 | filler |  |
| monster/island_frost_stomp | ice | zone | 0.00 | core |  |
| monster/island_frost_spike | ice | zone | 0.00 | core |  |
| monster/island_frost_veil | ice | zone | 0.00 | core |  |
| monster/island_frost_shard | ice | projectile | 0.00 | filler |  |
| boss/island_frost_boss_mirror | ice | projectile | 0.00 | filler |  |
| monster/island_frost_boss_mirror | ice | projectile | 0.00 | filler |  |
| boss/island_frost_boss_tide | ice | zone | 0.00 | core |  |
| monster/island_frost_boss_tide | ice | zone | 0.00 | core |  |
| boss/island_frost_boss_prison | ice | mark | 0.00 | core |  |
| monster/island_frost_boss_prison | ice | zone | 0.00 | core |  |
| boss/island_frost_boss_fissure | ice | mark | 0.00 | core |  |
| monster/island_frost_boss_fissure | ice | zone | 0.00 | core |  |
| boss/island_frost_boss_veil | ice | zone | 0.00 | core |  |
| monster/island_frost_boss_veil | ice | zone | 0.00 | core |  |
| status/burn | fire | zone | 0.00 | core |  |
| status/poison | poison | zone | 0.00 | core |  |
| status/slow | ice | zone | 0.00 | core |  |
| status/stun | earth | slash | 0.00 | filler |  |
| status/silence | shadow | burst | 0.00 | core |  |
| status/petrify | earth | chain | 0.00 | filler |  |
| status/fear | shadow | burst | 0.00 | core |  |
| status/root | nature | zone | 0.00 | core |  |
| status/blind | holy | burst | 0.00 | core |  |
| status/time_stop | arcane | burst | 0.00 | core | ★ |
| status/attack_up | blood | shield | 0.00 | cooldown |  |
| status/speed_up | nature | shield | 0.00 | cooldown |  |
| status/armor_down | poison | burst | 0.00 | core |  |
| status/counter | steel | shield | 0.00 | cooldown |  |
| status/immunity | shadow | shield | 0.00 | cooldown |  |
| status/guardian | holy | shield | 0.00 | cooldown |  |
| status/regen | nature | heal | 0.00 | core |  |
| status/bleed | blood | slash | 0.00 | filler |  |
| status/shock | storm | chain | 0.00 | filler |  |
| status/freeze | ice | zone | 0.00 | core |  |
| status/vulnerable | blood | slash | 0.00 | filler |  |
| combo/aspect-combo-afterimage | steel | slash | 0.00 | filler |  |
| combo/aspect-combo-hemophage | steel | slash | 0.00 | filler |  |
| combo/aspect-combo-warpath | steel | slash | 0.00 | filler |  |
| combo/aspect-combo-bonebreaker | steel | slash | 0.00 | filler |  |
| combo/aspect-combo-weakspot | steel | slash | 0.00 | filler |  |
| combo/aspect-combo-cascade | steel | slash | 0.00 | filler |  |
| combo/aspect-combo-wildfire | fire | zone | 0.00 | core |  |
| combo/aspect-combo-thermal | fire | zone | 0.00 | core |  |
| combo/aspect-combo-dominate | arcane | projectile | 0.00 | filler |  |
| combo/aspect-combo-timeloop | arcane | projectile | 0.00 | filler |  |
| combo/aspect-combo-toxicology | steel | projectile | 0.00 | filler |  |

## 怪物躯体映射

按名称和已有美术标识推断，暮界人形为默认；并非人类视觉复核。

| 模板 | 名称 | 美术 | 组 | 首领 |
|---|---|---|---|---|
| raider | 豺狼人劫掠者 | raider | beast |  |
| archer | 火枪斥候 | archer | dusk-humanoid |  |
| beast | 铁鬃战狼 | beast | beast |  |
| caster | 骸骨咒术师 | caster | dusk-humanoid |  |
| meadow-boss | 荒原守门人 | meadow-boss | dusk-humanoid | meadow-boss |
| guard | 骸骨盾卫 | guard | dusk-humanoid |  |
| assassin | 地精伏击者 | assassin | dusk-humanoid |  |
| summoner | 枯枝唤灵者 | summoner | dusk-humanoid |  |
| artillery | 炼金投弹手 | artillery | dusk-humanoid |  |
| forest-boss | 雾林祭司 | forest-boss | dusk-humanoid | forest-boss |
| rift-boss | 裂谷炎主 | rift-boss | dusk-humanoid | rift-boss |
| frost_wolf | 冰霜狼 | frost_wolf | beast |  |
| snow_ranger | 雪地游侠 | snow_ranger | dusk-humanoid |  |
| ice_elemental | 冰元素 | ice_elemental | dusk-humanoid |  |
| frost_giant | 霜巨人 | frost_giant | dusk-humanoid |  |
| frost_queen | 冰霜女王·艾莎 | frost_queen | dusk-humanoid | frost_queen |
| shadow_stalker | 暗影潜行者 | shadow_stalker | dusk-humanoid |  |
| bone_mage | 骸骨法师 | bone_mage | dusk-humanoid |  |
| abomination | 憎恶缝合怪 | abomination | dusk-humanoid |  |
| shadow_lord | 暗影领主 | shadow_lord | dusk-humanoid |  |
| abyss_lord | 深渊之主·莫格斯 | abyss_lord | dusk-humanoid | abyss_lord |
| dragon_whelp | 幼龙 | dragon_whelp | dusk-humanoid |  |
| dragon_guard | 龙人守卫 | dragon_guard | dusk-humanoid |  |
| dragon_priest | 龙祭司 | dragon_priest | dusk-humanoid |  |
| dragon_king | 远古龙王·巴哈姆特 | dragon_king | dusk-humanoid | dragon_king |
| shadow-minion | 亡灵仆从 | shadow_stalker | dusk-humanoid |  |
| ritual-minion | 亡灵仆从 | shadow_stalker | dusk-humanoid |  |
| summoned-whelp | 幼龙 | dragon_whelp | dusk-humanoid |  |
| ss-mon-dusk-blade | 暮界刀兵 | ss-mon-dusk-blade | dusk-humanoid |  |
| ss-mon-dusk-gunner | 暮界铳手 | ss-mon-dusk-gunner | dusk-humanoid |  |
| ss-mon-dusk-weaver | 暮界织隙者 | ss-mon-dusk-weaver | dusk-humanoid |  |
| ss-mon-wind-hound | 风原巡猎兽 | ss-mon-wind-hound | beast |  |
| ss-mon-dock-scavenger | 港湾拾荒者 | ss-mon-dock-scavenger | pirate |  |
| ss-mon-moss-warden | 苔壳巡守 | ss-mon-moss-warden | plant |  |
| ss-mon-pollen-caller | 花尘唤灵者 | ss-mon-pollen-caller | plant |  |
| ss-mon-ember-worker | 炉渣小灵 | ss-mon-ember-worker | fire-spirit |  |
| ss-mon-ore-loader | 矿道搬运机 | ss-mon-ore-loader | machine |  |
| ss-mon-frost-hound | 霜脊巡猎兽 | ss-mon-frost-hound | beast |  |
| ss-mon-frozen-watch | 冻舰守卫 | ss-mon-frozen-watch | frost-guard |  |
| ss-mon-rift-lurker | 裂隙潜猎者 | ss-mon-rift-lurker | rift |  |
| ss-mon-rift-caller | 裂隙唤潮者 | ss-mon-rift-caller | rift |  |
| ss-mon-bone-sentinel | 龙骨巡卫 | ss-mon-bone-sentinel | dragon-oath |  |
| ss-mon-oath-acolyte | 旧约侍仪 | ss-mon-oath-acolyte | dragon-oath |  |
| ss-elite-hook-leader | 星钩头目 | ss-elite-hook-leader | pirate |  |
| ss-elite-vine-keeper | 藤甲扼路者 | ss-elite-vine-keeper | plant |  |
| ss-elite-forge-overseer | 炉甲压阵机 | ss-elite-forge-overseer | machine |  |
| ss-elite-frost-lock | 霜锁卫士 | ss-elite-frost-lock | frost-guard |  |
| ss-elite-rift-hunter | 裂界猎兵 | ss-elite-rift-hunter | rift |  |
| ss-elite-oath-keeper | 龙骨执令者 | ss-elite-oath-keeper | dragon-oath |  |
| ss-boss-port-vanguard | 暮界先锋·卡珀 | ss-boss-port-vanguard | dusk-humanoid | meadow-boss |
| ss-boss-fog-quartermaster | 军需官·格铎 | ss-boss-fog-quartermaster | dusk-humanoid | forest-boss |
| ss-boss-core-extractor | 岛心采能机·掘星者 | ss-boss-core-extractor | machine | rift-boss |
| ss-boss-ice-patrol | 冻舰巡守·霜镜卫 | ss-boss-ice-patrol | frost-guard | frost_queen |
| ss-boss-rift-marshal | 裂隙督军·乌洛 | ss-boss-rift-marshal | rift | abyss_lord |
| ss-boss-vilo | 暮界提督·维洛 | ss-boss-vilo | dusk-humanoid | dragon_king |
| ow-mon-wind-1 | 逐风幼牙 | ow-mon-wind-1 | beast |  |
| ow-mon-wind-2 | 锈钩船匪 | ow-mon-wind-2 | pirate |  |
| ow-elite-wind | 船台督哨 | ow-elite-wind | dusk-humanoid |  |
| ow-rare-wind-1 | 逐风巨钩 | ow-rare-wind-1 | pirate |  |
| ow-rare-wind-2 | 失铃长牙 | ow-rare-wind-2 | beast |  |
| ow-boss-wind-1 | 岩岸船钩守卫 | ow-boss-wind-1 | pirate | ow-boss-wind-1 |
| ow-boss-wind-2 | 残骸吊索守卫 | ow-boss-wind-2 | dusk-humanoid | ow-boss-wind-2 |
| ow-boss-wind-3 | 要塞航契守卫 | ow-boss-wind-3 | dusk-humanoid | ow-boss-wind-3 |
| ow-mon-mist-1 | 苔铃幼兽 | ow-mon-mist-1 | beast |  |
| ow-mon-mist-2 | 雾邮唤粉者 | ow-mon-mist-2 | plant |  |
| ow-elite-mist | 藤谷督卫 | ow-elite-mist | plant |  |
| ow-rare-mist-1 | 独铃织网者 | ow-rare-mist-1 | dusk-humanoid |  |
| ow-rare-mist-2 | 失邮苔壳 | ow-rare-mist-2 | plant |  |
| ow-boss-mist-1 | 渡口雾钟守卫 | ow-boss-mist-1 | dusk-humanoid | ow-boss-mist-1 |
| ow-boss-mist-2 | 树冠结网者 | ow-boss-mist-2 | dusk-humanoid | ow-boss-mist-2 |
| ow-boss-mist-3 | 军需暗铃统领 | ow-boss-mist-3 | dusk-humanoid | ow-boss-mist-3 |
| ow-mon-forge-1 | 灰烬搬运灵 | ow-mon-forge-1 | fire-spirit |  |
| ow-mon-forge-2 | 红炉装载兵 | ow-mon-forge-2 | machine |  |
| ow-elite-forge | 熔线监工 | ow-elite-forge | dusk-humanoid |  |
| ow-rare-forge-1 | 炽尾炉灵 | ow-rare-forge-1 | fire-spirit |  |
| ow-rare-forge-2 | 锈阀巨锤 | ow-rare-forge-2 | dusk-humanoid |  |
| ow-boss-forge-1 | 矿道裂岩卫 | ow-boss-forge-1 | dusk-humanoid | ow-boss-forge-1 |
| ow-boss-forge-2 | 冷阀铸甲者 | ow-boss-forge-2 | dusk-humanoid | ow-boss-forge-2 |
| ow-boss-forge-3 | 炉心熔焰统领 | ow-boss-forge-3 | dusk-humanoid | ow-boss-forge-3 |
| ow-mon-frost-1 | 雪巷幼牙 | ow-mon-frost-1 | beast |  |
| ow-mon-frost-2 | 冰港哨兵 | ow-mon-frost-2 | frost-guard |  |
| ow-elite-frost | 冻锁督卫 | ow-elite-frost | dusk-humanoid |  |
| ow-rare-frost-1 | 长夜锁链者 | ow-rare-frost-1 | dusk-humanoid |  |
| ow-rare-frost-2 | 暮雪牙王 | ow-rare-frost-2 | beast |  |
| ow-boss-frost-1 | 冻舱守钥者 | ow-boss-frost-1 | dusk-humanoid | ow-boss-frost-1 |
| ow-boss-frost-2 | 冰桥重甲卫 | ow-boss-frost-2 | dusk-humanoid | ow-boss-frost-2 |
| ow-boss-frost-3 | 白潮冻锁统领 | ow-boss-frost-3 | dusk-humanoid | ow-boss-frost-3 |
| ow-mon-rift-1 | 裂缝幼影 | ow-mon-rift-1 | dusk-humanoid |  |
| ow-mon-rift-2 | 碎桥步兵 | ow-mon-rift-2 | dusk-humanoid |  |
| ow-elite-rift | 裂界督猎者 | ow-elite-rift | rift |  |
| ow-rare-rift-1 | 暮炮追命者 | ow-rare-rift-1 | dusk-humanoid |  |
| ow-rare-rift-2 | 断桥潜影 | ow-rare-rift-2 | dusk-humanoid |  |
| ow-boss-rift-1 | 炮台裂晶卫 | ow-boss-rift-1 | dusk-humanoid | abyss_lord |
| ow-boss-rift-2 | 界桥追猎者 | ow-boss-rift-2 | dusk-humanoid | abyss_lord |
| ow-boss-rift-3 | 要塞界镜统领 | ow-boss-rift-3 | dusk-humanoid | abyss_lord |
| ow-mon-dragon-1 | 骨庭幼卫 | ow-mon-dragon-1 | dusk-humanoid |  |
| ow-mon-dragon-2 | 旧约侍仪兵 | ow-mon-dragon-2 | dragon-oath |  |
| ow-elite-dragon | 龙骨执令卫 | ow-elite-dragon | dragon-oath |  |
| ow-rare-dragon-1 | 断誓追忆者 | ow-rare-dragon-1 | dragon-oath |  |
| ow-rare-dragon-2 | 白骨长爪 | ow-rare-dragon-2 | dusk-humanoid |  |
| ow-boss-dragon-1 | 骨庭契约卫 | ow-boss-dragon-1 | dusk-humanoid | dragon_king |
| ow-boss-dragon-2 | 祭坛龙鳞卫 | ow-boss-dragon-2 | dusk-humanoid | dragon_king |
| ow-boss-dragon-3 | 航网旧约统领 | ow-boss-dragon-3 | dragon-oath | dragon_king |
