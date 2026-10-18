# 单次节奏推导

已显式 --apply。规则 ow-64 → ow-65。

| 文件 | 字段 | 改前 | 改后 | 原因 |
|---|---|---|---|---|
| packages/content/aspects.json | 24.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-st-ember-burn","name":"余烬之心","description": | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-st-ember-burn","name":"余烬之心","description": | 燃烧清图超过1.5：仅自身核心技能缩放，单体/精英压制补偿保持；不改其他BD或掉落 |
| packages/content/aspects.json | 26.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-st-permafrost-focus-boss","name":"集中 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-st-permafrost-focus-boss","name":"集中 | 冻结预算不足：补自身冰甲规避；不恢复永久控制，不降低其他BD |
| packages/content/aspects.json | 54.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-mv-tailwind-focus-elite","name":"集中火 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"pacing-aspect-mv-tailwind-focus-elite","name":"集中火 | 疾行清图仍低于0.6：按已触发范围脉冲实测伤害补齐；自身机动过强则校对位移周期，并补回单体输出 |
| packages/content/aspects.json | 41.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-tr-tempo:30","name":"节拍","description":"每 6 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-tr-tempo:30","name":"节拍","description":"每 6 | 回响预算偏高：按自身输出场景加权贡献回收核心伤害，不改变基础武器/掉落 |
| packages/content/aspects.json | 47.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-df-burst:37","name":"爆盾","description":"护盾破 | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-df-burst:37","name":"爆盾","description":"护盾破 | 坚壁规避超过1.5：回收自身规避；伤害补丁不应缩小护身印护盾，修正类型边界 |
| packages/content/aspects.json | 37.parts | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-tr-headhunter:26","name":"猎首","description" | {"stats":[],"zones":[],"atoms":[],"rules":[{"id":"aspect-tr-headhunter:26","name":"猎首","description" | 先手仍过强：用实际执行冷却/核心冷却推导潮印缩放，按两击目标修正；保留群怪刃阵补机制 |

## 保持与局限

- 本轮只使用P2已完成的80场样本，未运行候选试探；升级曲线已经达标，保持不动。
- 消融原始臂保持定义：关闭核心/4件/潮印，未扩大消融去除基础技能或固有连招；残余差距单列归因待办。
- 同种子伤害/控制/资源变化会改变随机抽取顺序，解析修正仍需本批唯一一次真实验证。
