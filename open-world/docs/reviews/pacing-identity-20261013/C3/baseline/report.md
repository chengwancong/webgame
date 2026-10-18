# 三种子节奏与机制验证

种子41、42、43。自然日程中位数212.208分钟，范围209.206–223.367。节奏未通过，构筑未通过。

| 构筑 | 单体 | 清怪 | 生存 | 精英 | 安全 | 预算 | 机制 |
|---|---|---|---|---|---|---|---|
|燃烧引爆|0.943 [0.943, 0.958]|1.089 [1.089, 1.089]|1.388 [1.005, 1.390]|0.816 [0.745, 0.841]|0.923 [0.899, 0.933]|1.007|有未触发规则|
|冻结碎冰|1.652 [1.606, 1.675]|2.305 [2.305, 2.305]|1.379 [0.995, 1.385]|1.255 [1.159, 1.509]|3.956 [3.852, 3.999]|2.337|通过|
|疾行游击|1.057 [1.042, 1.057]|0.214 [0.214, 0.214]|1.000 [1.000, 1.005]|1.221 [1.184, 1.322]|2.153 [2.130, 2.247]|1.097|通过|
|震地旋风|0.638 [0.636, 0.641]|1.089 [1.089, 1.089]|1.000 [0.445, 1.000]|0.403 [0.391, 0.436]|0.923 [0.899, 0.933]|0.845|通过|
|分裂箭雨|3.374 [3.338, 3.384]|0.911 [0.911, 0.911]|0.725 [0.615, 0.862]|1.475 [1.394, 1.557]|1.037 [1.018, 1.045]|1.501|通过|
|回响法师|0.288 [0.284, 0.288]|0.051 [0.051, 0.051]|0.610 [0.445, 0.612]|0.611 [0.592, 0.661]|1.978 [1.926, 1.999]|0.720|通过|
|坚壁反伤|0.413 [0.405, 0.420]|2.177 [2.177, 2.177]|1.390 [1.005, 1.776]|0.401 [0.389, 0.435]|0.923 [0.899, 0.933]|1.166|通过|
|先手刺杀|7.363 [7.264, 7.363]|0.329 [0.329, 0.329]|1.000 [1.000, 1.005]|12.618 [12.237, 13.663]|0.963 [0.955, 0.982]|3.805|通过|

## 机制触发

- 燃烧引爆 aspect-st-ember-burn：single、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-burning-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-spread：single、clear、elite；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-ember-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-state：single、survival、elite、safety；未覆盖
- 冻结碎冰 aspect-st-permafrost-cold-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 冻结碎冰 aspect-st-permafrost-frost-guard：single、survival、safety；至少一个场景三种子均触发
- 疾行游击 aspect-mv-tailwind-dash-strike：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 疾行游击 aspect-mv-tailwind-moving-evasion：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 疾行游击 aspect-mv-tailwind-dash-nova：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 震地旋风 aspect-tf-whirl-crowd-area：clear、survival、safety；至少一个场景三种子均触发
- 震地旋风 aspect-tf-whirl-whirl-armor：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 震地旋风 aspect-tf-whirl-whirl-guard：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 分裂箭雨 aspect-tf-knife-bleeding-hit：clear、survival、safety；至少一个场景三种子均触发
- 分裂箭雨 aspect-tf-knife-crowd-evasion：clear、survival、safety；至少一个场景三种子均触发
- 回响法师 aspect-tr-tempo:30：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 回响法师 aspect-tr-tempo-tempo-recovery：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 回响法师 aspect-tr-tempo-mana-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst:37：survival；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst-block-counter：single、survival、elite、safety；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst-shield-guard：single、survival、elite、safety；至少一个场景三种子均触发
- 坚壁反伤 aspect-df-burst-block-shield：single、survival、elite、safety；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter:26：single、elite；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-healthy-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-opening-critical：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-elite-shield：single、elite；至少一个场景三种子均触发
- 先手刺杀 aspect-tr-headhunter-kill-refund：single、clear、elite；至少一个场景三种子均触发
