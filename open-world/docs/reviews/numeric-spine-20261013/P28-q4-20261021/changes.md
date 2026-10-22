# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/progression-challenges.json | season | {"id":"abyss-2026-q4","name":"深渊回响","start":"2026-10-01T00:00:00+08:00","end":"2027-01-01T00:00:00+08:00","killXp":1,"bossXp":25,"challengeXp":100,"rewards":[{"id":"supply","name":"行者补给","xp":100,"gold":300,"material":20},{"id":"journey","name":"远征储备","xp":500,"gold":1500,"material":100},{"id":"mastery","name":"深渊珍藏","xp":2000,"gold":6000,"material":400}]} | {"id":"abyss-2026-q4","name":"深渊回响","start":"2026-10-01T00:00:00+08:00","end":"2027-01-01T00:00:00+08:00","killXp":2,"bossXp":40,"challengeXp":100,"rewards":[{"id":"supply","name":"行者补给","xp":100,"gold":300,"material":20},{"id":"journey","name":"远征储备","xp":500,"gold":1500,"material":100},{"id":"mastery","name":"深渊珍藏","xp":2000,"gold":6000,"material":400},{"id":"veteran","name":"老练行者","xp":4000,"gold":12000,"material":800},{"id":"bounty","name":"悬赏常客","xp":7000,"gold":20000,"material":1400},{"id":"legend","name":"深渊传说","xp":12000,"gold":36000,"material":2400}]} | Claude season-expansion-20261021 P28: six thresholds, kill2/boss40/challenge100; approved gold/material fallback; retain Q4 ID/dates and historical claims. |
