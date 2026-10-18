# 三种子节奏与机制验证

种子41、42、43。自然日程中位数222.125分钟，范围209.888–225.873。节奏未通过，构筑未通过。

| 构筑 | 单体 | 清怪 | 生存 | 精英 | 安全 | 预算 | 机制 |
|---|---|---|---|---|---|---|---|
|燃烧引爆|0.983 [0.972, 0.986]|1.250 [1.226, 1.258]|1.388 [1.000, 1.390]|0.988 [0.988, 1.079]|0.885 [0.881, 0.924]|1.080|有未触发规则|
|冻结碎冰|1.164 [1.161, 1.181]|2.647 [2.596, 2.663]|1.108 [0.796, 1.113]|1.012 [0.921, 1.012]|2.125 [2.113, 2.218]|1.821|通过|
|疾行游击|1.017 [1.014, 1.027]|0.246 [0.241, 0.247]|1.000 [1.000, 1.000]|1.339 [1.218, 1.339]|2.133 [2.043, 2.201]|1.111|通过|
|震地旋风|0.973 [0.964, 0.974]|2.143 [2.101, 2.156]|1.000 [0.443, 1.000]|0.673 [0.566, 0.673]|0.885 [0.881, 0.924]|1.260|通过|
|分裂箭雨|1.456 [1.450, 1.470]|0.750 [0.742, 0.774]|0.866 [0.862, 1.000]|0.950 [0.865, 0.950]|1.057 [1.027, 1.084]|1.009|通过|
|回响法师|0.485 [0.484, 0.490]|0.059 [0.058, 0.059]|0.610 [0.443, 0.612]|1.729 [1.573, 1.729]|2.043 [1.761, 2.133]|0.946|通过|
|坚壁反伤|0.632 [0.626, 0.643]|2.500 [2.452, 2.515]|1.390 [1.000, 1.776]|0.645 [0.587, 0.645]|0.885 [0.881, 0.924]|1.333|通过|
|先手刺杀|3.646 [3.637, 4.862]|0.495 [0.485, 0.498]|1.000 [1.000, 1.000]|13.831 [12.588, 13.831]|0.943 [0.916, 0.973]|3.288|通过|

## 机制触发

- 燃烧引爆 aspect-st-ember-burn：single、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-burning-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-spread：single、clear、elite；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-ember-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-state：single、survival、elite、safety；未覆盖
- 冻结碎冰 aspect-st-permafrost-cold-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 冻结碎冰 aspect-st-permafrost-frost-guard：single、survival、elite、safety；至少一个场景三种子均触发
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
