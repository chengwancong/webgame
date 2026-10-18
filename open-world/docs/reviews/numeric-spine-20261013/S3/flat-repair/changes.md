# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/gear-affixes.json | pool.8.minValue | 0.65 | 1 | 修复S3闭式结果的整数域投影：flat正式发放使用crypto.randomInt，必须整数上下界；不改变随机算法和正式奖励逻辑 |
