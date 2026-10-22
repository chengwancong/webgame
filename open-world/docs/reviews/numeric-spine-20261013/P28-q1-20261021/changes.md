# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/progression-challenges.json | seasons | null | [{"id":"abyss-2027-q1","name":"深渊回响","start":"2027-01-01T00:00:00+08:00","end":"2027-04-01T00:00:00+08:00","killXp":2,"bossXp":40,"challengeXp":100,"rewards":[{"id":"supply-2027-q1","name":"行者补给","xp":100,"gold":300,"material":20},{"id":"journey-2027-q1","name":"远征储备","xp":500,"gold":1500,"material":100},{"id":"mastery-2027-q1","name":"深渊珍藏","xp":2000,"gold":6000,"material":400},{"id":"veteran-2027-q1","name":"老练行者","xp":4000,"gold":12000,"material":800},{"id":"bounty-2027-q1","name":"悬赏常客","xp":7000,"gold":20000,"material":1400},{"id":"legend-2027-q1","name":"深渊传说","xp":12000,"gold":36000,"material":2400}]}] | Claude P28 next-season default: select by now, 2027Q1 with same names/values and season-suffixed reward IDs; preserve original single-season object and all claim history. |
