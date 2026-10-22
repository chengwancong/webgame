# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| apps/api/src/hex-loot.json | policy | null | {"version":1,"island":"ss-map-mist","unlockTask":"HEX-Q01","levelAhead":2,"magicLevel":13,"catalogue":["hex-void-rift","hex-aftershock","hex-detonation-sigil","hex-mark-relay","hex-footfall-heal","hex-control-to-shield","hex-cast-hit-relay","hex-bee-volley"],"sources":{"elite":0.025,"event":0.06,"firstEventMultiplier":2,"dungeonChest":0.1,"dungeonBoss":1,"dungeonMagic":0.25,"rare":1,"rareMagic":0.4},"biasWeight":3,"biases":{"field-mist-1":["贴身绞杀"],"field-mist-2":["先铺后炸"],"field-mist-3":["穿行续战","节奏接力"],"ow-mist-rare1":["先铺后炸"],"ow-mist-rare2":["穿行续战"]},"dungeons":["field-mist-1","field-mist-2","field-mist-3"],"rares":["ow-mist-rare1","ow-mist-rare2"]} | Claude D11-1 §4.1 initial source probabilities / ×3 bias; D10 §7 level+2 and prerequisites; D12 HEX-Q01 accepted gate. Exact authored values, no tuning or target changes. |
