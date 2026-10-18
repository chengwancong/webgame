# 硬阻塞：被动移速转伤害缺少表现事件

对应交接§7.1：需要修改战斗模拟才能准确接入该音效。本期禁止改动模拟、服务端、伤害与判定。

证据：

- `packages/simulation/index.ts` 的 `dynamicConversions` 分支（约516行）在直接/持续伤害过程中计算动态移速增伤，然后直接改 `amount`，没有携带转换来源或是否实际贡献伤害的独立事件。
- 同文件的 `effectTriggered`（约566行）只为 `ExecutableRule` 发出 `effect_triggered`。被动转换路径不经过它。
- `packages/rules/build-parts.ts`（约50行）把转换登记为 `stats.dynamicConversions`，该数据表示拥有转换，不证明某次伤害实际触发了它。
- `CombatEvent` 的普通 `hit_resolved` 只提供本次总结果；音频层若重新计算临时速度、永久增幅、技能增伤分母并猜测贡献，会复制数值规则，违反AGENTS的计算唯一所有者约束。

已做：`mechanism/speed` 音效已合成并进入试听合集。已撤销把 `dash/moving/speed` 名称匹配当成被动换算的猜测触发，清单为 `wired=false`。普通位移技能和脚步仍按真实事件播放。

恢复步骤：

1. 由被授权修改模拟的工作提供不改变判定结果的只读事件，包含实际生效的转换来源、目标、tick和必要去重标识；永久换算与临时换算须有明确语义。
2. 音频适配层只消费此事件，绑定 `mechanism/speed`，加入实际发生/未发生转换的音频事件测试。
3. `python -X utf8 tools/audio/build.py` 重新生成wired元数据，运行音频覆盖/路由测试与全量验证。

本期不修改这些所有者文件，也不以“只要带有此构筑就播放”伪造机制正在生效。其余配方三版后的客观残差另见report.md，不与这个硬阻塞混为一谈。
