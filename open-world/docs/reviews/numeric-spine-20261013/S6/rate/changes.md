# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/spine-rate-limits.json | killsPerSecond | 15 | 24 | M9真实World观察最大击杀速率12×2；只放宽，原RATE公式与鉴权不变 |
