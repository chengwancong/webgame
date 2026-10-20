# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| apps/api/src/stage-key-pools.json | pools.0.choices.0.outputs.0 | {"kind":"gear","slot":"weapon","quality":"magic","count":1,"series":"standard"} | {"kind":"gear","slot":"weapon","quality":"rare","count":1,"series":"standard","itemLevel":1,"guaranteedOutput":"repair-tendency","starterAttack":true} | Claude GROW-02 fixed starter attack ruling; declared score 40/40 improvement and <=115% repaired for sword/staff/hidden; one candidate verification, no sweep. |
| apps/api/src/stage-key-pools.json | pools.0.choices.0.name | "蓝色主手" | "风车地窖·精工主手" | Claude GROW-02 fixed starter attack ruling; declared score 40/40 improvement and <=115% repaired for sword/staff/hidden; one candidate verification, no sweep. |
| apps/api/src/stage-key-pools.json | pools.0.choices.0.description | "做出一把魔法武器，替换当前主手。" | "钥匙兑换的精工主手，偏重输出" | Claude GROW-02 fixed starter attack ruling; declared score 40/40 improvement and <=115% repaired for sword/staff/hidden; one candidate verification, no sweep. |
