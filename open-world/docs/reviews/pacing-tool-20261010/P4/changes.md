# 单次节奏推导

已显式 --apply。规则 ow-65 → ow-66。

| 文件 | 字段 | 改前 | 改后 | 原因 |
|---|---|---|---|---|
| packages/content/aspects.json | 24.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-st-ember-burn","name":"余烬之心","description": | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-st-ember-burn","name":"余烬之心","description": | 燃烧引爆：当前版本留存样本的单次机制校准 |
| packages/content/aspects.json | 26.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-st-permafrost-focus-boss","name":"集中 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-st-permafrost-focus-boss","name":"集中 | 冻结碎冰：当前版本留存样本的单次机制校准 |
| packages/content/aspects.json | 54.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-mv-tailwind-focus-elite","name":"集中火 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-mv-tailwind-focus-elite","name":"集中火 | 疾行游击：当前版本留存样本的单次机制校准；通用属性回退已标红 |
| packages/content/aspects.json | 0.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-tf-whirl-expose-boss","name":"命中强敌时揭 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-tf-whirl-expose-boss","name":"命中强敌时揭 | 震地旋风：当前版本留存样本的单次机制校准 |
| packages/content/aspects.json | 16.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-tf-knife-focus-elite","name":"集中火力压制 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-tf-knife-focus-elite","name":"集中火力压制 | 分裂箭雨：当前版本留存样本的单次机制校准 |
| packages/content/aspects.json | 47.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-df-burst:37","name":"爆盾","description":"护盾破 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-df-burst:37","name":"爆盾","description":"护盾破 | 坚壁反伤：当前版本留存样本的单次机制校准 |
| packages/content/aspects.json | 37.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-tr-headhunter:26","name":"猎首","description" | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-tr-headhunter:26","name":"猎首","description" | 先手刺杀：当前版本留存样本的单次机制校准 |

## 保持与局限

- 燃烧的剩余超界来自同次范围命中多次引爆；给自身引爆加1秒间隔，保留单体持续伤害，不再盲降全技能伤害。
- 通用属性回退：当前51%闪避来自合法装备，位移冷却修正未改变受击数；仅在该核心回收闪避比例，避免改全局词缀或其他BD。
- 先手首领按两轮留存响应使用平方根增幅校正：直接命中与衍生引用都消费压制效果，不假设一次线性缩放。
- 仅一次解析推导，不执行候选对局；实测达成仍由下一次独立validate判断。
- 消融不去掉剩余基础技能、固有连招或合法装备属性；原始残差与失败保留，不能宣称整体平衡通过。
