# 三种子节奏与机制验证

种子41、42、43。自然日程中位数281.869分钟，范围224.545–303.322。节奏未通过，构筑未通过。

| 构筑 | 单体 | 清怪 | 生存 | 精英 | 安全 | 预算 | 机制 |
|---|---|---|---|---|---|---|---|
|燃烧引爆|0.571 [0.548, 0.571]|1.388 [1.388, 1.388]|1.388 [1.000, 1.390]|0.575 [0.572, 0.601]|0.950 [0.942, 0.958]|0.993|有未触发规则|
|冻结碎冰|1.186 [1.186, 1.203]|2.940 [2.940, 2.940]|1.457 [1.046, 1.463]|0.953 [0.953, 0.958]|7.123 [7.062, 7.187]|3.189|通过|
|疾行游击|1.915 [1.876, 2.081]|0.537 [0.379, 0.537]|1.000 [1.000, 1.000]|1.891 [1.891, 1.900]|2.110 [1.983, 2.260]|1.455|通过|
|震地旋风|0.435 [0.421, 0.438]|0.980 [0.980, 0.980]|0.610 [0.443, 0.612]|0.309 [0.309, 0.311]|0.950 [0.942, 0.958]|0.726|通过|
|分裂箭雨|1.641 [1.613, 1.641]|0.806 [0.781, 0.806]|0.619 [0.615, 0.862]|1.047 [1.042, 1.047]|0.991 [0.991, 1.018]|1.037|通过|
|回响法师|0.814 [0.797, 0.814]|1.020 [1.020, 1.020]|0.610 [0.443, 0.612]|2.791 [2.791, 2.804]|1.727 [1.662, 1.917]|1.380|通过|
|坚壁反伤|0.461 [0.452, 0.474]|2.777 [2.777, 2.777]|1.388 [1.000, 1.390]|0.592 [0.454, 0.595]|0.950 [0.942, 0.958]|1.390|通过|
|先手刺杀|1.514 [1.267, 1.545]|0.314 [0.314, 0.314]|1.000 [1.000, 1.000]|13.027 [13.027, 13.088]|1.009 [0.982, 1.009]|2.703|通过|

## 机制触发

- 燃烧引爆 aspect-st-ember-burn：single、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-burning-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-spread：single、clear；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-ember-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-state：所有场景0次；未覆盖
- 冻结碎冰 aspect-st-permafrost-cold-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 冻结碎冰 aspect-st-permafrost-frost-guard：single、survival、safety；至少一个场景三种子均触发
- 疾行游击 aspect-mv-tailwind-dash-strike：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 疾行游击 aspect-mv-tailwind-moving-evasion：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 震地旋风 aspect-tf-whirl-crowd-area：clear、survival、safety；至少一个场景三种子均触发
- 震地旋风 aspect-tf-whirl-whirl-armor：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 震地旋风 aspect-tf-whirl-whirl-guard：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 分裂箭雨 aspect-tf-knife-bleeding-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 分裂箭雨 aspect-tf-knife-crowd-evasion：clear、survival、safety；至少一个场景三种子均触发
- 回响法师 aspect-tr-tempo:30：single、safety；至少一个场景三种子均触发
- 回响法师 aspect-tr-tempo-tempo-recovery：single、safety；至少一个场景三种子均触发
- 回响法师 aspect-tr-tempo-mana-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst:37：survival；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst-block-counter：single、survival、elite、safety；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst-shield-guard：single、survival、elite、safety；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter:26：single、elite；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-healthy-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-opening-critical：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-elite-shield：single、elite；至少一个场景三种子均触发
