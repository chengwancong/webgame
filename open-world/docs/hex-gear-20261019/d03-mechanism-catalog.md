# HEX-D02b 机制总表（36 + 6 扩展）

> 版本：D02b-1（2026-10-20，Claude 总策划，用户指令「机制太少」的落地稿；无需用户确认，Claude 默认裁决）
> 覆盖：design.md 第三节「首批 12 种」与 U-02。U-01、U-03～U-07 不变（2 槽/不升品/掉落/可分解/不强化/六角图标）。
> 样板 HEX-01 连锁闪电不变，继续走 B02/F01/V01，不阻塞本表。

## 0. 规则

1. 总量：6 类 × 6 = **36 种基础机制**（每种 4 品质 = 144 条规则），另有 6 种「扩展机制」（X01–X06）依赖新增能力，能力落地后追加，合计 42。
2. 每种机制有**独立的触发器或独立的行为**；同一触发器下行为必须不同类（例如 hit 触发的 6 种分别是弹射/标记/引爆/反伤/…，不是同一动作换数值）。
3. 品质规则：common/magic 只是**同一行为的强度梯度**；rare 起加一个**附加行为**（第二条 EffectRule 或 when/状态扩展）；legendary 再加一个**质变**（改触发源、范围或联动）。下表「品质」列写四档的关键参数与附加。避免出现“4 档只改数字”。
4. 等级门槛沿用 10/15/20/25（common/magic/rare/legendary）。
5. 类别枚举扩为 `attack | defense | control | mobility | resource | synergy`（现为 attack/defense/mobility/resource，见 N0）。
6. 互斥：同 `exclusiveGroup`（= 机制 slug）不可双装（沿用）。另设**软互斥提示**：同类别可双装，不禁止；联动类建议与指定类别搭配（见「搭配」列）。
7. 数值只是初值，上线前由 TTK 推导一次定档（沿用 U-06 决定）：单件 HEX 的稳态贡献目标 = 角色同等级总输出/生存的 6–10%（legendary 可到 12%），双槽叠加不超过 20%。
8. 状态可行性：下表「能力」列 ✅ = 当前 EffectRule（22 触发器 / 17 动作 / condition 全集）已可表达，仅需 GPT 先做 **N0 可行性核验**；🔧 = 需新增能力（见第 8 节）。

## 1. 攻击（attack）——改变「怎么打出伤害」

| # | slug | 名称 | 触发 | 行为 | 品质梯度与附加 | 搭配 | 能力 |
|---|---|---|---|---|---|---|---|
| A1 | chain-lightning | 连锁闪电 | hit 30–45%，ICD 60 | arc 雷电，弹射 3–6，0.5–0.65 | 沿用样板 d02-sample-spec | 联动·引爆印记 | ✅ 已落地 |
| A2 | aftershock | 余震裂地 | nth 每 5 次命中（5/5/4/4） | nova 物理，半径 2.5，ratio 0.6/0.7/0.8/0.9 | rare：爆点留 2s 减速区（field slow）；legendary：每第 4 次且爆点范围 +30%，并对 boss 额外 +20% | 控制·冻结脉冲 | ✅ |
| A3 | star-shards | 碎星弹幕 | crit，概率 40%，ICD 90 | shards 4/5/6/8 枚，射程 8，每枚 0.25/0.28/0.32/0.35 | rare：碎片附 vulnerable 2s；legendary：暴击敌人死亡再散出 4 枚（kill 触发的第二条规则，killDepth≤2 内） | 联动·弱点贯穿 | ✅ |
| A4 | cast-echo | 回响施法 | cast，12/15/18/22%，ICD 240 | echo ratio 0.5/0.6/0.7/0.8，delay 30 | rare：echo 可 retarget 到最近敌人；legendary：echo 对 longest 技能（冷却最长者）触发率翻倍 | 资源·免费咏唱 | ✅ |
| A5 | storm-reaper | 暴风收割 | kill 100% | buff damageMult +3/4/5/6%/层，10s，最高 5/6/7/8 层 | rare：满层时 speedPercent +10%；legendary：满层再击杀刷新全部层时长并回 3% 灵力 | 位移·动能蓄积 | ✅ |
| A6 | void-rift | 虚空裂隙 | interval 每 300t（10s） | field 自身，半径 3，持续 90t，每 30t 一跳，0.25/0.30/0.35/0.40 attack 暗影 | rare：范围内敌人受 slow 20%；legendary：每次裂隙结束（zone_end）在最近敌人处再开小型裂隙 | 控制·引力井 | ✅ |

## 2. 生存（defense）——改变「怎么活下来」

| # | slug | 名称 | 触发 | 行为 | 品质梯度与附加 | 搭配 | 能力 |
|---|---|---|---|---|---|---|---|
| D1 | thorned-heart | 荆棘之心 | hit，ICD 30，when self_state shield | nova（ref shield）0.20/0.30/0.40/0.55 shield 值 | rare：护盾期间受击也触发（also: hurt）；legendary：护盾破碎时返还已造成反伤的 30% 为新护盾 | 联动·护盾共鸣 | ✅ |
| D2 | overflow-spring | 生命涌泉 | hurt，when self_hp<50%，ICD 300 | heal 5/6/8/10% maxHp + overflowShield 1.0 | rare：ICD 缩至 240；legendary：同时给 3s damageReduction +15% | 位移·幻影换位 | ✅ |
| D3 | last-stand | 不屈 | lethal，ICD 1800（60s） | buff flags surviveAtOne，2s；common 仅保命；magic +heal 10% | rare：保命期间 damageReduction +30%；legendary：触发后冷却 −50% 条件为 3s 内击杀 ≥3 个 | — | ✅（核验 flags 在 lethal 可用） |
| D4 | riposte | 格挡反击 | block，ICD 30 | nova at self 半径 2，0.8/1.0/1.2/1.5 attack | rare：反击附 stun 0.5s；legendary：格挡率 +10% 并反击免费触发 nextCast 强化 | 位移·瞬步突袭 | ✅ |
| D5 | shadow-veil | 影遁护盾 | dodge，ICD 120 | shield maxHp 6/8/10/12%，3s | rare：护盾期间 speedPercent +15%；legendary：闪避同时取消自身一个控制状态（需 N3）或改为额外 +10% dodge 3s | 位移·幻影步 | ✅（取消控制为 🔧 N3，缺省用 dodge buff） |
| D6 | cornered-will | 绝境意志 | low_hp（<30%），ICD 600 | buff damageReduction 20/25/30/35% + regen，6s | rare：+ lifesteal 8%；legendary：持续期间击杀延长 1s（extend） | 资源·嗜血 | ✅ |

## 3. 控制（control）——改变「敌人怎么动」

| # | slug | 名称 | 触发 | 行为 | 品质梯度与附加 | 搭配 | 能力 |
|---|---|---|---|---|---|---|---|
| C1 | frost-armor | 寒霜护甲 | hurt 40%，ICD 90 | status slow 30–45%，2–3s（对攻击者） | rare：slow 叠到 freeze（status_apply 链）；legendary：近战攻击者直接 freeze 1s | 联动·冰裂碎击 | ✅ |
| C2 | freeze-pulse | 冻结脉冲 | cast 25%，ICD 360 | nova at self 半径 3.5，0.3 attack 冷伤 + status freeze 1/1.2/1.5/1.8s | rare：boss 免疫改为 slow；legendary：脉冲后 3s 内冻结目标受 vulnerable +20% | 联动·冰裂碎击 | ✅ |
| C3 | gravity-well | 引力井 | interval 每 360t | field at target，半径 4，pull 0.6，持续 90t，伤害 0.15 | rare：中心 root 0.5s；legendary：zone_end 引爆，0.8 attack AoE | 攻击·虚空裂隙 | ✅ |
| C4 | silence-touch | 沉默之触 | crit 100%，ICD 180 | status silence 1/1.2/1.5/2s | rare：对 elite 同时 armor_down；legendary：silence 期间目标受 vulnerable | 攻击·碎星弹幕 | ✅ |
| C5 | petrify-gaze | 石化凝视 | nth 每 10 次命中，when target_rank≠boss | status petrify 1/1.2/1.5/2s | rare：petrify 结束时 nova 小爆；legendary：boss 改为 stun 1s | 攻击·余震裂地 | ✅ |
| C6 | terror-wave | 恐惧波 | kill_elite（也 kill 5%） | spread fear，radius 6，count 3/4/5/6 | rare：fear 敌人受 amplify +10%；legendary：恐惧结束时目标 slow 40% 2s | 联动·瘟疫传播 | ✅ |

## 4. 位移（mobility）——改变「怎么移动与站位」

| # | slug | 名称 | 触发 | 行为 | 品质梯度与附加 | 搭配 | 能力 |
|---|---|---|---|---|---|---|---|
| M1 | phantom-step | 幻影步 | cast，ICD 120 | buff speedPercent +20/25/30/35%，2s | rare：持续 3s；legendary：期间闪避 +10% | 生存·影遁护盾 | ✅ |
| M2 | dash-embers | 冲刺余烬 | dash | field at path，半径 1.5，持续 120t，fire，0.2/0.25/0.3/0.4，附 burn | rare：路径残留 3s；legendary：冲刺终点爆发 nova 0.6 | 联动·延绵毒焰 | ✅ |
| M3 | kinetic-charge | 动能蓄积 | moved，ICD 30 | buff damageAdd +2/3/4/5% 每层，最高 5 层，停下 2s 衰减 | rare：满层移速 +10%；legendary：满层时下一击 consume nextHit 额外 0.8 attack | 攻击·暴风收割 | ✅ |
| M4 | landing-quake | 落地冲击 | dash | nova at self 半径 3，0.5/0.6/0.8/1.0 attack + slow 1s | rare：冲刺前路径 pathHit；legendary：冲击击杀刷新冲刺冷却（cooldown reset） | 控制·冻结脉冲 | ✅ |
| M5 | blink-strike | 瞬步突袭 | dash，ICD 300 | buff flags forceCrit，consume nextHit，4s | rare：暴击伤害 +30%；legendary：该击对 boss/elite 额外 amplify +25% | 防御·格挡反击 | ✅ |
| M6 | phase-swap | 幻影换位 | hurt，when self_hp<35%，ICD 1200 | 🔧 blink 向远离敌人方向位移 6/7/8/9 | rare：落点留幻影诱饵（嘲讽 3s，N5）；legendary：位移后 2s 无敌 | 生存·生命涌泉 | 🔧 N1 |

## 5. 资源（resource）——改变「灵力/冷却/续航」

| # | slug | 名称 | 触发 | 行为 | 品质梯度与附加 | 搭配 | 能力 |
|---|---|---|---|---|---|---|---|
| R1 | mana-siphon | 灵力虹吸 | kill | mana 6/8/10/12% maxMana | rare：精英击杀回 2 倍；legendary：灵力满时溢出转 shield | 位移·幻影步 | ✅ |
| R2 | resonance-echo | 冷却共鸣 | crit，ICD 150 | cooldown random −30t/40/50/60 | rare：暴击 boss 时 −2 个技能；legendary：被减技能下次施法 +15% 伤害 | 攻击·碎星弹幕 | ✅ |
| R3 | mana-surge | 灵力回路 | mana_empty，ICD 1200 | mana 30/35/40/45% maxMana | rare：附 3s freeCost；legendary：灵力耗尽时同时清除全部冷却 25%（cooldown fraction） | 资源·免费咏唱 | ✅ |
| R4 | blood-contract | 嗜血 | kill | heal 3/4/5/6% maxHp | rare：精英击杀 +overflowShield；legendary：3 连杀内再击杀回复翻倍（self_state kills） | 防御·绝境意志 | ✅ |
| R5 | free-incantation | 免费咏唱 | nth 每 6 次施法（count: cast） | buff flags freeCost，consume nextCast | rare：每 5 次；legendary：免费施法同时 echo 0.4 | 攻击·回响施法 | ✅ |
| R6 | finisher-refund | 终结返还 | kill_elite | refund mode longest fraction 0.30/0.40/0.50/0.60 | rare：boss 击杀改为 all cooldown −30%；legendary：返还同时给 5s damageMult +8% | 攻击·暴风收割 | ✅ |

## 6. 联动（synergy）——让两件 HEX 或 HEX+元素/状态互相放大

| # | slug | 名称 | 触发 | 行为 | 品质梯度与附加 | 搭配 | 能力 |
|---|---|---|---|---|---|---|---|
| S1 | detonation-sigil | 引爆印记 | hit ICD 180，when target_status any(burn,poison,bleed) | detonate 全异常 0.5/0.6/0.8/1.0，remove false | rare：remove true 但返还 50% 伤害；legendary：引爆对半径 3 内同样有异常的敌人也生效 | 攻击·连锁闪电 | ✅ |
| S2 | hunter-mark | 猎手印记 | hit 20%，ICD 150 | status vulnerable 3s，strength 12/15/18/22% | rare：对 elite/boss ICD −50%；legendary：标记目标被击杀时标记转移至最近敌人 | 联动·弱点贯穿 | ✅ |
| S3 | weak-point | 弱点贯穿 | passive | amplify against vulnerable/armor_down/shock，+10/14/18/24% | rare：penetration 15%；legendary：对 boss +10% | 联动·猎手印记 | ✅ |
| S4 | plague-spread | 瘟疫传播 | kill，when 目标死亡时带 burn/poison/bleed | spread 该状态，radius 5，count 2/3/4/5 | rare：传播时延长 2s；legendary：传播到的敌人额外 nova 0.3 | 联动·延绵毒焰 | ✅（核验 kill 时可读目标状态） |
| S5 | lingering-flame | 延绵毒焰 | status_apply（burn/poison） | extend 同状态 +1/1.5/2/2.5s，最长 +4s | rare：dotCrit 允许持续伤害暴击（buff flags dotCrit）；legendary：持续伤害 tick 回复 1% 灵力 | 联动·引爆印记 | ✅ |
| S6 | shatter-ice | 冰裂碎击 | hit，when target_status freeze | detonate freeze，remove true，ratio 1.0/1.3/1.6/2.0，radius 3 | rare：碎冰对周围 slow；legendary：碎冰击杀回 4% 灵力 | 控制·冻结脉冲 | ✅ |

## 7. 扩展机制（需新增能力，能力落地后追加；N 见第 8 节）

| # | slug | 名称 | 触发/行为 | 能力 |
|---|---|---|---|---|
| X1 | executioner | 处决 | passive：目标 HP 越低增伤，<30% 时最高 +25–45% | N2 amplify.targetMissingHp |
| X2 | pair-resonance | 对子共鸣 | 另一槽 HEX 为同类别时本件强度 +15–30% | N3 condition equipped_hex |
| X3 | knockback-wave | 震退 | block 后击退近战敌人 3 格（boss 抵抗）| N4 knockback 动作 |
| X4 | void-servant | 虚空侍从 | combat_start 召唤随从 20s，随你攻击 | N5 summon 动作 |
| X5 | stack-burst | 满层爆发 | 任意 HEX buff 满层触发一次 AoE | N6 trigger stacks_full |
| X6 | decoy | 幻影诱饵 | M6 的诱饵（嘲讽）| N5 taunt（与 summon 同批）|

## 8. 能力清单与优先级（交 GPT）

| 编号 | 优先级 | 能力 | 说明 | 解锁 |
|---|---|---|---|---|
| N0 | **P0** | 36 机制可行性核验 + 类别枚举扩展 | 逐条把表中 ✅ 条目写成 EffectRule 草稿过 `effectRuleSchema`，对每条写 1 条确定性模拟断言（构造事件→断言 effect_triggered）；类别 `publicHexRuneSchema.category` 扩为六类；`requiredLevel` 沿用；发现无法表达的条目写入阻塞清单并给出等价替代 | 全部 ✅ 条目 |
| N1 | P1 | `blink` 动作（自身位移，距离/方向 away_from_enemies，碰撞走 moveBody） | M6 | M6 |
| N2 | P1 | `amplify` 增加 `targetMissingHp`（缺失生命越多越高，上限） | X1 | X1 |
| N3 | P2 | condition `equipped_hex`（category/id 的另一槽判断）与 `cleanse` 动作（清自身一个控制） | X2、D5 传说质变 | X2 |
| N4 | P2 | `knockback` 动作（nova/field 附加 push，boss 抵抗系数） | X3 | X3 |
| N5 | P3 | `summon` + `taunt` | X4、X6、M6 rare | X4/X6 |
| N6 | P3 | trigger `stacks_full`（buff 达最大层数） | X5、A5 传说简化 | X5 |

## 9. 批次与验收

- **B03-0（P0）**：GPT 完成 N0，并按模板落地 **A2、S1** 两种为第二批样板（一个攻击型，一个联动型）。验收：对每种机制 4 品质各一条 `effect_triggered` 确定性断言；rare/legendary 的附加行为各有独立断言。
- **B03-1**：攻击 A3–A6、防御 D1–D6（11 种）。
- **B03-2**：控制 C1–C6、资源 R1–R6（12 种）。
- **B03-3**：位移 M1–M5、联动 S2–S6（10 种）。
- **B03-4**：N1–N6 按优先级陆续交付后追加 M6、X1–X6。
- 每批通过功能验收即进入下一批，不等用户试玩。F02（前端资源接入）随批次做：每种机制 1 张六角符记图标（4 品质换描边色），见 HEX 图标规范（透明底，大轮廓）。图标生产沿用美术管线，缺图用类别占位图标，标注“临时”。
- 掉落分布（Claude 默认裁决）：野外精英 common/magic；首领 magic/rare；副本宝箱 rare；高难副本/挑战 legendary；各类别等权，同一次掉落避免与已持有机制重复一次（软去重，不强制）。
