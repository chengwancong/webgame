# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/skill-costs.json | throwing_knife | 3 | 1 | Claude 2026-10-20: accept knife cost 1 and kunai coefficient 1.31; recovery 3 residual accepted; level 50 ceiling takes priority; no further tuning. Evidence SHA256 54bf2c36d33394c7deeb3704ccc2bfc152314e4921315362d5a8dece332149ef |
| packages/content/skill-coefficients.json | explosive_kunai | 2.74 | 1.31 | Claude 2026-10-20: accept knife cost 1 and kunai coefficient 1.31; recovery 3 residual accepted; level 50 ceiling takes priority; no further tuning. Evidence SHA256 54bf2c36d33394c7deeb3704ccc2bfc152314e4921315362d5a8dece332149ef |
