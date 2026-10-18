# 装备后端实现入口

旧任务草案已归档到 [历史版本](history/backend-task-gear-system-v1.md)，其中的整数百分比生成器没有上线，不能继续接入。

当前唯一词缀定义为 packages/content/gear-affixes.json，唯一生成器为 packages/rules/affix-generator.ts。比例字段使用小数：0.1 表示 10%；护甲、攻击、生命和移动速度采用各自的点数单位。接口拒绝把 10 当作暴击率 10%。

数值、强化与完整口径见 [当前装备词缀说明](gear-affixes.md) 和 [数值审计](balance-audit.md)。
