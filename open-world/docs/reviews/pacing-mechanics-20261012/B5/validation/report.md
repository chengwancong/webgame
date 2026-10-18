# 三种子节奏与机制验证

种子41、42、43。自然日程中位数216.853分钟，范围197.573–222.801。节奏未通过，构筑未通过。

| 构筑 | 单体 | 清怪 | 生存 | 精英 | 安全 | 预算 | 机制 |
|---|---|---|---|---|---|---|---|
|燃烧引爆|0.662 [0.635, 0.676]|1.347 [1.318, 1.347]|1.388 [1.000, 1.390]|0.505 [0.505, 0.509]|0.923 [0.899, 0.933]|0.982|有未触发规则|
|冻结碎冰|1.220 [1.206, 1.234]|2.853 [2.791, 2.853]|1.457 [1.046, 1.463]|0.764 [0.764, 0.770]|6.923 [6.741, 6.998]|3.091|通过|
|疾行游击|3.713 [3.644, 3.780]|0.521 [0.510, 0.606]|1.000 [1.000, 1.000]|7.829 [7.829, 7.893]|2.051 [1.930, 2.157]|2.686|通过|
|震地旋风|0.420 [0.405, 0.425]|0.951 [0.930, 0.951]|1.000 [0.443, 1.000]|0.248 [0.248, 0.250]|0.923 [0.899, 0.933]|0.737|通过|
|分裂箭雨|3.062 [3.014, 3.108]|1.010 [1.010, 1.032]|0.721 [0.615, 0.862]|1.236 [1.230, 1.236]|1.037 [1.018, 1.045]|1.432|通过|
|回响法师|0.780 [0.766, 0.794]|0.990 [0.968, 0.990]|0.610 [0.443, 0.612]|2.237 [2.237, 2.255]|1.678 [1.586, 1.866]|1.269|通过|
|坚壁反伤|0.450 [0.434, 0.454]|2.694 [2.636, 2.694]|1.388 [1.000, 1.390]|0.474 [0.364, 0.478]|0.923 [0.899, 0.933]|1.339|通过|
|先手刺杀|2.591 [1.898, 2.687]|0.305 [0.298, 0.305]|1.000 [1.000, 1.000]|10.439 [10.439, 10.523]|0.963 [0.955, 0.982]|2.516|通过|

## 机制触发

- 燃烧引爆 aspect-st-ember-burn：single、survival、elite、safety；未覆盖
- 燃烧引爆 aspect-st-ember-burning-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-spread：single、clear、elite；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-ember-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-state：single、survival、elite、safety；未覆盖
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
