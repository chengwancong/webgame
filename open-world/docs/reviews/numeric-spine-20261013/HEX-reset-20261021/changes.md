# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/hex-policy.json | policy | {"version":2,"resonanceMin":2,"resonanceMultiplier":1.1,"damageMultiplierCap":0.6,"damageReductionCap":0.35,"cooldownReductionCap":0.4,"recoveryPerSecondCap":0.08,"manaRefundCap":0.6,"invulnerabilitySharedTicks":600,"invulnerabilityMaxTicks":240,"lethalSaveMinimumTicks":3600} | {"version":2,"resonanceMin":2,"resonanceMultiplier":1.1,"damageMultiplierCap":0.6,"damageReductionCap":0.35,"cooldownReductionCap":0.4,"recoveryPerSecondCap":0.08,"manaRefundCap":0.6,"invulnerabilitySharedTicks":600,"invulnerabilityMaxTicks":240,"lethalSaveMinimumTicks":3600,"resetSecondaryScale":0.5} | Claude D10 §5.1 and D13 §9 clarified 2026-10-21: subsequent different cooldown-reset item in the same tick grants half, floored; keep all other targets. |
