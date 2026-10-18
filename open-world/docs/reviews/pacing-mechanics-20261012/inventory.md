# B0 盘点与执行核实

## 真实内容与交接差异

八词条原始完整数据保存于 `B0/aspects-before.json`，新增规则共39条，全部以 `pacing-aspect-` 开头。燃烧6、永冻5、追风3、旋风6、环刃5、节拍3、爆盾7、猎首4。最后两个数量不含原始身份规则。

交接1.1的伤害、控制、补丁数值与实际相同；追风还残留 `statMultipliers.dodge=0.778511` 的无条件闪避折算，必须一起删除。环刃真实轨道半径1.4格、碰撞半径1格、速度0.14弧度/帧，原始伤害预算9.5%；按设计步长将轨道半径取1.5格、接触预算取10%，速度保留引擎运动参数（不是平衡旋钮）。节拍实际为interval180帧，下一次施法增伤50%且必暴，词条总描述“每3次施法”错误。版本实际为ow-68，已超出一期报告ow-67；不回退，B6只在现行版本上统一升一次。

工具 `derive-model.ts` 确有无条件guard/evasion和按rank增伤生成；`calibrate-model.ts`、`refine-model.ts` 确有单构筑分支；`derive.ts` 扫描固定一期目录、硬编码60/24，apply自行升规则版本。measure仅seed41，validate仅判0.6–1.5与预算，没有与用户各场景目标逐项比较，规则计数虽有World.effectStats但未汇入验收。以上全部在B1改造。

交接1.4的Claude修复已在工作区，保留：legacy-builds主手加成、界面与数据库文案断言、巅峰配置推算、battle-result-panel裂星潮进度。余烬测试被普通怪通用增伤污染、追风剑装配被暗器补丁引入空技能的原因与源码一致；B2删除注入后用原断言验证。

## 模拟执行证据

| 条件/触发/动作 | 实际执行位置 | 核实 |
|---|---|---|
| target_status、target_hp、combat_time、crowd、self_state（moving/shield/buff）、skill | `packages/simulation/conditions.ts:8-13`；`index.ts conditionContext/comboMatches` 读取真实状态、血量、战斗时钟、近邻和技能标签 | 生效；多个状态为任一满足 |
| direct类别过滤、burn持续伤害过滤 | `index.ts comboMatches` 的categories/statusKinds与伤害上下文 | 生效，燃烧增幅不污染毒/流血 |
| passive amplify/reduce/buff | `index.ts damage`、`hurt`、`effectBuffs` | 生效；passive buff效果可随条件变化，原计数只在无目标上下文中登记，目标相关被动buff需补计数 |
| hit、kill与spread | `index.ts comboHit/comboKill/comboSpread` | 生效；击杀传入清除前carried状态，扩散必须源自玩家；条件可识别死亡前燃烧 |
| dash + buff consume nextHit | `index.ts executeDeclared:453`、`effectBuff`、`damage:517-555` | 生效；仅直接命中消费，强制暴击可用 |
| hurt + nova/status | `index.ts hurt`、`comboNova` | 生效；范围状态在命中成功且目标存活时施加，ratio=0仍有最低1点伤害，描述必须诚实记载 |
| hit + armor_down | `index.ts comboStatus/applyStatus`、`effectiveStats` | 生效 |
| cast + skill过滤 + buff | `index.ts comboCast/effectBuff`、`hurt conditionalValue` | 生效；按旋风4段0.5秒间隔，护持取2秒 |
| shield_break + nova(ref shield) | `index.ts hurt:719`、`effectRef/comboNova` | 生效；取破裂前该护盾峰值，不是破裂后的0 |
| block + nova(ref hit) | `index.ts hurt:714`、`fireEffects` | 生效；reference为格挡所抵消的护甲减免前伤害，描述必须写明 |
| kill_elite + cooldown/shield | `index.ts damage:554`、`effectCooldown/effectShield` | 生效，包括精英及首领 |
| interval、mana_spent + shield | `index.ts stepEffects:688-689`、`effectShield` | 生效；mana_spent按累计阈值跨越计数，无额外赠送法力 |
| 冷却恢复速度buff | effects.ts buffMods没有该字段，模拟只支持固定cooldown动作 | **缺口**：M3新增通用cooldownRecovery属性，逐帧加速剩余冷却并覆盖充能/多人/检查点 |
| 规则触发统计 | `index.ts effectTriggered`，benchmark返回rules | 已有真实计数；M3补目标相关被动buff首次生效统计，M4汇总每个种子与场景 |

## 基线

命令：`pnpm pacing:validate --out=docs/reviews/pacing-mechanics-20261012/B0/baseline`。

自然World/临时PostgreSQL日程241.249222虚拟分钟，主节奏通过；80场seed41完整/消融，8套中仅环刃预算通过，整体未通过，exit1为数值失败而非执行失败，errors=[]。原始场景与预算见baseline/validation.json。临时库已停止并清理，`baseline/natural/calendar-cleanup.json` 记录bytes_after=0。当前工作区战斗行为已变化，不能把一期236.870560当成本期基线。

## 工作区保护

Godot、地图、scene、combat-vfx、shield-feedback、presentation、HUD、ui-tokens及其他会话改动不动不提交。共享simulation/index、contracts/index和AGENTS先保存会话起点，B6只暂存本期差量。目标weights/builds只读；不操作正式8612，不执行任何浏览器工具。
