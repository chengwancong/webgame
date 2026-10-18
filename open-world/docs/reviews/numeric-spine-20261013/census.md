# 当前工作树内容盘点

- skills：83
- aspects：60
- nonReferenceAspects：52
- sets：18
- augments：90
- affixRows：121
- mainStats：28
- talents：41
- paragon：48
- inscriptionAtoms：41
- inscriptionSlotEntries：41
- monsterTemplates：103
- dungeons：47

技能冷却按30帧/秒推断；无伤害归功能。技能形态为初始分组，召唤语义与小组并组待S2审计确认，不把无实测条目标为预算达标。

| 技能 | 名称 | 系别 | 角色 | 形态 | 冷却秒 | 宿主 |
|---|---|---|---|---|---:|---|
| cut | 斩击 | 武技 | 填充 | 单体 | 0.80 | bleed |
| whirl | 旋风斩 | 武技 | 核心 | 范围 | 2.50 | quake |
| rush | 破阵 | 武技 | 核心 | 范围 | 3.67 | bleed |
| cleave | 裂地 | 武技 | 核心 | 范围 | 6.00 | quake |
| dual_strike | 双重打击 | 武技 | 核心 | 单体 | 1.17 | bleed |
| ground_slam | 重击 | 武技 | 核心 | 范围 | 3.00 | quake |
| blade_fury | 刀刃风暴 | 武技 | 核心 | 范围 | 4.00 | bleed |
| execute | 斩杀 | 武技 | 核心 | 单体 | 5.00 | bleed |
| leap_strike | 跳斩 | 武技 | 核心 | 范围 | 3.17 | opening |
| blood_rage | 血怒 | 武技 | 功能 | 功能 | 8.00 | bone |
| vortex_blade | 漩涡之刃 | 武技 | 核心 | 范围 | 2.83 | bleed |
| counter_strike | 反击 | 武技 | 功能 | 功能 | 6.00 | bleed |
| rampage | 狂暴 | 武技 | 核心 | 范围 | 2.00 | bulwark |
| berserker | 狂战士 | 武技 | 核心 | 单体 | 4.00 | quake |
| war_cry | 战吼 | 武技 | 核心 | 范围 | 5.00 | quake |
| bolt | 穿云箭 | 武技 | 填充 | 单体 | 0.83 | arrows |
| ember | 燎原 | 法术 | 核心 | 持续 | 4.33 | burn |
| chain | 雷链 | 法术 | 核心 | 范围 | 3.17 | 标准人:sword |
| lance | 星矛 | 法术 | 核心 | 单体 | 3.00 | 标准人:sword |
| multi_shot | 多重箭 | 武技 | 核心 | 单体 | 1.33 | arrows |
| pierce_arrow | 穿透箭 | 武技 | 核心 | 单体 | 1.83 | arrows |
| rain_of_arrows | 箭雨 | 武技 | 核心 | 持续 | 3.67 | arrows |
| explosive_shot | 爆破箭 | 武技 | 核心 | 范围 | 2.67 | arrows |
| snipe | 狙击 | 武技 | 核心 | 单体 | 4.00 | arrows |
| poison_arrow | 毒箭 | 武技 | 核心 | 单体 | 2.33 | arrows |
| volley | 齐射 | 武技 | 核心 | 单体 | 1.50 | arrows |
| arcane_missile | 奥术飞弹 | 法术 | 核心 | 单体 | 2.00 | shock |
| meteor | 陨石术 | 法术 | 核心 | 范围 | 6.00 | burn |
| barrage | 弹幕 | 法术 | 核心 | 持续 | 3.00 | 标准人:sword |
| frost_bolt | 冰霜箭 | 法术 | 核心 | 单体 | 1.67 | freeze |
| lightning_bolt | 闪电箭 | 法术 | 核心 | 单体 | 2.50 | 标准人:sword |
| fireball | 火球术 | 法术 | 核心 | 范围 | 2.83 | burn |
| dark_arrow | 暗影箭 | 武技 | 核心 | 单体 | 2.17 | arrows |
| frost | 寒霜阵 | 法术 | 核心 | 持续 | 5.00 | freeze |
| nova | 冰环 | 法术 | 核心 | 范围 | 5.00 | freeze |
| stun_strike | 震慑 | 武技 | 核心 | 单体 | 2.67 | quake |
| gravity_well | 重力陷阱 | 法术 | 核心 | 持续 | 4.67 | shock |
| silence | 沉默 | 法术 | 功能 | 功能 | 6.00 | 标准人:sword |
| petrify | 石化 | 法术 | 冷却 | 单体 | 6.67 | gravity |
| slow_field | 减速场 | 法术 | 核心 | 持续 | 4.00 | 标准人:sword |
| fear | 恐惧术 | 法术 | 功能 | 功能 | 5.33 | 标准人:sword |
| root | 束缚 | 法术 | 核心 | 持续 | 3.33 | 标准人:sword |
| blind | 致盲 | 法术 | 功能 | 功能 | 4.67 | 标准人:sword |
| vortex | 虚空漩涡 | 法术 | 核心 | 持续 | 5.67 | gravity |
| time_stop | 时间停滞 | 法术 | 功能 | 功能 | 10.00 | 标准人:sword |
| ward | 护身印 | 法术 | 功能 | 功能 | 8.00 | bulwark |
| mend | 回春 | 法术 | 功能 | 功能 | 9.00 | 标准人:sword |
| haste | 加速 | 法术 | 功能 | 功能 | 6.00 | 标准人:sword |
| regen | 再生 | 法术 | 功能 | 功能 | 6.67 | 标准人:sword |
| blink | 闪现 | 法术 | 功能 | 功能 | 4.00 | echo |
| barrier | 屏障 | 法术 | 功能 | 功能 | 7.33 | 标准人:sword |
| cleanse | 净化 | 法术 | 功能 | 功能 | 5.00 | 标准人:sword |
| phase_shift | 相位转换 | 法术 | 功能 | 功能 | 6.00 | 标准人:sword |
| second_wind | 回气 | 法术 | 功能 | 功能 | 10.00 | 标准人:sword |
| guardian_angel | 守护天使 | 法术 | 功能 | 功能 | 20.00 | 标准人:sword |
| throwing_knife | 飞刀 | 武技 | 填充 | 单体 | 0.60 | poison |
| fan_of_knives | 扇刃 | 武技 | 核心 | 单体 | 1.50 | blades |
| venom_needle | 淬毒针 | 武技 | 核心 | 单体 | 1.67 | poison |
| shadow_step | 影袭 | 武技 | 核心 | 范围 | 3.00 | mobile |
| blade_flurry | 乱刃 | 武技 | 核心 | 单体 | 2.00 | blades |
| explosive_kunai | 爆裂苦无 | 武技 | 核心 | 范围 | 2.83 | poison |
| assassinate | 暗杀 | 武技 | 核心 | 单体 | 4.67 | poison |
| death_lotus | 死莲 | 武技 | 核心 | 范围 | 5.33 | poison |
| frost_blade | 霜刃 | 武技 | 核心 | 单体 | 1.50 | bleed |
| thunder_dash | 雷闪 | 武技 | 核心 | 范围 | 3.67 | bleed |
| magma_slam | 熔岩重击 | 武技 | 核心 | 范围 | 3.67 | quake |
| venom_cleave | 腐蚀劈 | 武技 | 核心 | 范围 | 2.13 | quake |
| frost_quake | 冰裂 | 武技 | 核心 | 范围 | 5.67 | quake |
| fire_arrow | 火焰箭 | 武技 | 核心 | 单体 | 4.00 | arrows |
| thunder_arrow | 雷鸣箭 | 武技 | 核心 | 范围 | 3.17 | arrows |
| night_volley | 夜袭齐射 | 武技 | 核心 | 单体 | 1.73 | arrows |
| toxic_bomb | 毒雾弹 | 武技 | 核心 | 持续 | 4.00 | poison |
| shadow_blade | 影刃 | 武技 | 核心 | 单体 | 1.83 | mobile |
| night_veil | 夜幕 | 武技 | 核心 | 范围 | 4.00 | shadow |
| static_field | 静电场 | 法术 | 核心 | 持续 | 4.33 | shock |
| dark_grasp | 暗影之握 | 法术 | 核心 | 单体 | 4.67 | 标准人:sword |
| miasma | 瘴气 | 法术 | 核心 | 持续 | 4.67 | 标准人:sword |
| staff_strike | 杖击 | 武技 | 填充 | 单体 | 0.90 | burn |
| staff_sweep | 横扫 | 武技 | 核心 | 范围 | 3.00 | burn |
| pole_vault | 撑杆跃击 | 武技 | 核心 | 范围 | 3.83 | burn |
| staff_flurry | 连环杖 | 武技 | 核心 | 单体 | 2.07 | burn |
| seismic_staff | 震地杖 | 武技 | 核心 | 范围 | 5.83 | burn |
| staff_cyclone | 回旋杖 | 武技 | 核心 | 范围 | 5.00 | burn |
