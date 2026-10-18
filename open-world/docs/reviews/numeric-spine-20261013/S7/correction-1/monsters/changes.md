# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/monsters.json | ranks.normal.attack | 1 | 0.25 | V1真实TTD反推攻击：旧×实测TTD/目标TTD，0.05档；增加TTD须降低攻击，不把交接倒置比值用于相反方向 |
| packages/content/monsters.json | ranks.elite.attack | 2 | 0.35 | V1真实TTD反推攻击：旧×实测TTD/目标TTD，0.05档；增加TTD须降低攻击，不把交接倒置比值用于相反方向 |
| packages/content/monsters.json | ranks.elite.hp | 0.4 | 1.5 | V1生命×目标TTK/实测TTK，0.05档 |
| packages/content/monsters.json | ranks.boss.attack | 2 | 0.35 | V1真实TTD反推攻击：旧×实测TTD/目标TTD，0.05档；增加TTD须降低攻击，不把交接倒置比值用于相反方向 |
| packages/content/monsters.json | templates.49.base.hp | 125 | 121 | V1地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.50.base.hp | 416 | 357 | V1地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.51.base.hp | 349 | 413 | V1地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.52.base.hp | 135 | 133 | V1地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.53.base.hp | 375 | 410 | V1地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
| packages/content/monsters.json | templates.54.base.hp | 419 | 316 | V1地图首领五种子中位击杀秒数：生命×锁定目标/实测 |
