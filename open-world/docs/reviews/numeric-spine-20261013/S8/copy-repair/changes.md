# 主干配置变更

申请应用，结果见apply-result.json。

| 文件 | 路径 | 前 | 后 | 依据 |
|---|---|---|---|---|
| packages/content/augments.json | 71.parts.rules.0.description | "范围技能1秒后回响50%" | "施放时：1秒后重放当前技能，造成30%伤害。" | 真实规则参数同步内层描述 |
| packages/content/augments.json | 80.parts.rules.0.description | "移速 −40%，静止0.5秒伤害 ×2" | "站定至少0.5秒时：伤害增加70%。" | 真实规则参数同步内层描述 |
| packages/content/augments.json | 80.description | "undefined变为原来的60%。站定至少0.5秒时：伤害增加70%。" | "移动速度变为原来的60%。站定至少0.5秒时：伤害增加70%。" | S3实际归一参数重新生成潮印说明；身份保留 |
| packages/content/augments.json | 87.parts.rules.0.description | "本局首次死亡恢复50%生命" | "承受致命伤害时：免于死亡，并恢复85%最大生命，本局最多触发1次。" | 真实规则参数同步内层描述 |
| packages/content/augments.json | 87.description | "承受致命伤害时：reviveRatio增加85%，持续0.0333秒，最多1层。" | "承受致命伤害时：免于死亡，并恢复85%最大生命，本局最多触发1次。" | S3实际归一参数重新生成潮印说明；身份保留 |
| packages/content/augments.json | 77.parts.rules.0.description | "每秒损失2%生命，伤害 ×1.6，击杀恢复4%" | "每1秒：回复-2%最大生命。" | 真实规则参数同步内层描述 |
| packages/content/augments.json | 77.parts.rules.1.description | "每秒损失2%生命，伤害 ×1.6，击杀恢复4%" | "击杀时：回复4%最大生命。" | 真实规则参数同步内层描述 |
| packages/content/augments.json | 81.parts.rules.0.description | "技能0.5秒后70%重演" | "施放时：0.5秒后重放当前技能，造成75%伤害。" | 真实规则参数同步内层描述 |
