# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/monsters.json | ranks.normal.hp | 1 | 0.05 | V2一刀线优先：普通生命×min(目标TTK/实测TTK, 非暴击命中/原HP的10%分位)，向下投影0.05档，至少覆盖90%已观测目标；未命中仍在验收分母 |
| packages/content/monsters.json | ranks.elite.hp | 1.5 | 1 | V2生命×目标TTK/实测TTK，0.05档 |
| packages/content/monsters.json | templates.49.base.hp | 121 | 122 | V2地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.50.base.hp | 357 | 354 | V2地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.51.base.hp | 413 | 414 | V2地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.52.base.hp | 133 | 166 | V2地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.53.base.hp | 410 | 482 | V2地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.54.base.hp | 316 | 406 | V2地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
