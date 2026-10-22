# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/hex-policy.json | policy | {"version":1,"resonanceMin":2,"resonanceMultiplier":1.1,"damageMultiplierCap":0.6,"damageReductionCap":0.35,"cooldownReductionCap":0.4,"recoveryPerSecondCap":0.08,"manaRefundCap":0.6,"invulnerabilitySharedTicks":600,"invulnerabilityMaxTicks":240} | {"version":2,"resonanceMin":2,"resonanceMultiplier":1.1,"damageMultiplierCap":0.6,"damageReductionCap":0.35,"cooldownReductionCap":0.4,"recoveryPerSecondCap":0.08,"manaRefundCap":0.6,"invulnerabilitySharedTicks":600,"invulnerabilityMaxTicks":240,"lethalSaveMinimumTicks":3600} | Claude D10 §5.1: lethal-save minimum120s; preserve all existing budgets, invuln600/240 ticks, D13 scale and frozen targets. |
