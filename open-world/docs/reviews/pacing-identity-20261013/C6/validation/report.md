# 三种子节奏与机制验证

种子41、42、43。自然日程中位数238.737分钟，范围227.036–249.576。节奏通过，构筑未通过。

| 构筑 | 单体 | 清怪 | 生存 | 精英 | 安全 | 预算 | 机制 |
|---|---|---|---|---|---|---|---|
|燃烧引爆|0.972 [0.917, 0.983]|1.217 [1.217, 1.258]|1.388 [1.000, 1.390]|0.950 [0.950, 0.988]|0.885 [0.881, 0.924]|1.062|通过|
|冻结碎冰|1.175 [1.135, 1.235]|2.578 [2.578, 2.663]|1.095 [0.786, 1.100]|1.043 [1.012, 1.043]|2.125 [2.113, 2.218]|1.806|通过|
|疾行游击|1.027 [1.017, 1.027]|0.239 [0.239, 0.247]|1.000 [1.000, 1.000]|1.379 [1.339, 1.379]|2.133 [2.043, 2.201]|1.117|通过|
|震地旋风|0.973 [0.973, 0.976]|2.087 [2.087, 2.156]|1.000 [0.443, 1.000]|0.673 [0.641, 0.693]|0.885 [0.881, 0.924]|1.243|通过|
|分裂箭雨|1.377 [1.364, 1.377]|0.783 [0.742, 0.783]|0.866 [0.862, 1.000]|0.957 [0.922, 0.957]|1.057 [1.027, 1.084]|1.005|通过|
|回响法师|0.584 [0.578, 0.584]|0.057 [0.057, 0.059]|0.610 [0.443, 0.612]|2.672 [2.593, 2.672]|2.043 [1.761, 2.133]|1.107|通过|
|坚壁反伤|0.772 [0.765, 0.772]|3.371 [3.371, 3.483]|1.390 [1.000, 1.776]|0.929 [0.645, 0.929]|0.885 [0.881, 0.924]|1.665|通过|
|先手刺杀|2.963 [2.455, 3.682]|0.555 [0.555, 0.573]|1.000 [1.000, 1.000]|14.252 [13.831, 14.252]|0.943 [0.916, 0.973]|3.233|通过|

## 机制触发

- 燃烧引爆 aspect-st-ember-burn：single、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-burning-hit：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-spread：single、clear、elite；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-ember-shield：single、clear、survival、elite、safety；至少一个场景三种子均触发
- 燃烧引爆 aspect-st-ember-state：single、survival、elite、safety；至少一个场景三种子均触发
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
