# 本机现成特效小样审查

只审查素材；原件、业务代码与服务均未修改。

| 样例 | PNG数量 | 画布 | 原slot混合 | 原件目录 |
| --- | ---: | --- | --- | --- |
| slash | 18 | 160x74 (18) | additive | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/guang/manwang_1/hero_1/tx/daoguang |
| impact | 17 | 207x101 (17) | normal | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/guang/pandawoman/attacked/Effect/hit |
| arrow | 2 | 475x25 (1), 155x24 (1) | normal | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/feng/banrenmalueduozhe/missile |
| flaming-arrow | 1 | 140x53 (1) | normal | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/feng/banrenmalueduozhe/missile_skill |
| arcane-projectile | 12 | 623x147 (12) | normal | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/huo/tongkuzhiyuan/missile/tx/qiu |
| ice-crystal | 10 | 140x105 (10) | additive | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/effect/bingdong/bing1 |
| lightning | 6 | 48x48 (2), 47x53 (1), 48x44 (1), 46x52 (1), 46x44 (1) | normal | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/shui/leishen/missile |
| nature-aura-05 | 25 | 95x173 (25) | normal | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/feng/deluyizhanglao/effect/tx/05 |
| shield | 20 | 212x319 (20) | additive | G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/effect/gedang_help_1/01 |

所有代表PNG均为带alpha的透明图。visibleBlack统计不等于整张黑底：原件有局部暗色/半透明像素，必须尊重原slot的normal/ADD。

原始 .skel 通过本工程Spine3.6解析器在离线VM中读取，实测版本3.6.32。inventory.json保存原attachment中心偏移、旋转、scale、尺寸、slot顺序、骨骼父级与换帧时间线；切勿把PNG左上角或任意中心直接当作世界锚点。

箭的jian.png与jian2.png是两个独立件，不是2帧动画；原图箭头朝右。火焰huojian0001.png是单件且朝右。fx_00..11.png是紫色魔法弹，不能称作橙色火球。绿色叶片为自然/治疗候选，原始治疗语义未证实。

Wushi atk2/hou共15帧150x87，原slot在角色后面且normal；atk2/qian共15帧150x177，在角色前面且ADD。它们出现在Attack2/Skill时间线，Attack1相关附件为空。现工程effect-attachments/attack_*_{front,back}.png 54张实测alpha全部为空。该导出是旧角色相机512x512画布，原fxAnchor=[0.45139259372568824,0.6168144967962559]，不能直接当作新模块角色的武器局部件。

D盘部分3.8.75 JSON仅root骨骼空壳，没有slots/动画，不能据此推断原点与动作。优先使用工程source-assets保存的原skel/atlas/独立PNG。
