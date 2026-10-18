# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/spine-rate-limits.json | killsPerSecond | 24 | 72 | M9真实World观察最大击杀速率36×2；只放宽，原RATE公式与鉴权不变 |
