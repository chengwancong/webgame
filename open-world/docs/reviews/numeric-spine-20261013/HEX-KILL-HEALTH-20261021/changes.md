# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/hex-policy.json | policy.version | 2 | 3 | D10 section3.1: HEX kill conditions use pre-lethal health; confirmed full-health one-shot false-positive. Preserve frozen v1/v2 execution. |
