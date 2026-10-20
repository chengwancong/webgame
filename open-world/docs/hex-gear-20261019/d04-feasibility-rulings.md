# HEX-D04 可行性核验裁决（对 Codex 11:22 N0 首轮结果的答复）

> 2026-10-20 Claude 总策划默认裁决。以下为设计层定论；GPT 不再反问，按此实现。数值仍为初值，上线前 TTK 推导一次。

## 0. 发布门槛依据（回应“与用户确认门槛冲突”）
- 用户 2026-10-20 原话指令：HEX 机制太少，扩到不少于 36 种，“本项不需要用户确认，直接裁决执行”，并要求全流程无人工确认卡点（样板过功能验收后直接铺量，用户事后统一试玩复核）。该指令晚于并覆盖 U-02 与“样板确认优先”。
- 因此：N0 通过 + A2/S1 样板过功能验收后，B03-1～B03-3 可直接铺量，不等用户试玩。保留 HEX-01 原样板。新类别下发前必须完成前端兼容（已做：hex-rune-tip.ts 六类中文映射已补，背包 HEX 详情含锁定/分解，批量分解入口守卫已与 inTown 一致）。

## 1. 缺失参数（直接采用）
| 项 | 裁决 |
|---|---|
| D1 nova 半径 | 3.0 |
| D6 regen | 取消 regen。改为触发瞬间 heal 4/5/6/8% maxHp + damageReduction（原数值），持续 6s |
| C3 field | 伤害类型 shadow，每 30t 一跳；半径 4 |
| M2 field | 每 30t 一跳；common/magic 持续 120t，rare/legendary 180t |
| M3 moved | 每累计移动 2 格 +1 层（moved 事件的距离阈值 `every:2`） |
| M4 附加 slow | 30%，1s |
| M6 blink | 需 N1：方向=远离半径 8 内敌人质心；碰障碍停在障碍前（走 moveBody） |
| R5 nextCast buff | 持续 8s，未用完过期 |

## 2. “schema 可过但语义不符”的裁决
- **D3 不屈**：真实保命必须成立 → 新增 **N7a（P0）**：lethal 触发且带 surviveAtOne 时，致死伤害把 HP 置为 1（不是仅 immortal 分支）。验收：致死一击后 HP=1，2s 内免死，ICD 60s 内第二次致死则死亡。
- **S6 冰裂碎击**：不再用 detonate。等价行为=hit 且目标冻结时：以目标为中心 nova（ref attack，半径 3，ratio 1.0/1.3/1.6/2.0 冷伤）并移除目标冻结状态。若无“移除状态”动作则新增 **N7b `status_remove`（P0）**。
- **C6 恐惧波**：kill_elite（kill 5%）时对半径 6 内最多 N 个敌人**直接施加** fear（不依赖死者已带 fear）。实现=spread 增 `seed:true`（先给死亡目标挂状态再扩散）或等价 status_apply 范围版，GPT 择一，语义以此为准。**N7c（P1）**。
- **S1 引爆印记**：每个被引爆目标用**自己的**剩余 DOT 预算×ratio，只处理自己带 DOT 的目标（无异常邻居不受伤）。rare 去掉“返还 50%”：改为 remove=true 且 ratio×1.5（提前引爆更大）。legendary：半径 3 内带异常的敌人各自引爆（需 detonate 支持 radius+每目标预算+过滤，**N7d P0**）。
- **A2 余震裂地**：ref=hit。rare 爆点 field：slow 30%、2s、每 30t 一跳。legendary：半径 3.25、ratio 1.05；删除“对 boss +20%”这一条（schema 不支持，不为此加能力）。
- **A3 碎星弹幕**：rare 的 vulnerable 改为额外一条 crit 触发规则对目标施加 vulnerable 2s（不是每枚碎片）。legendary 的 kill 再散射保持。
- **A4**：common/magic 显式 `retarget:false`；rare 起 true。
- **A6 虚空裂隙**：rare 的 slow 取 field 现有固定 0.3（不再要求 0.2）。
- **S3 弱点贯穿**：被动修正，验收用伤害对比（对 vulnerable 目标伤害 ×(1+bonus)），不要求 effect_triggered 事件。
- **S5 延绵毒焰**：需事件上下文携带 `statusKind`（新施加的状态种类）——**N7e（P0）**；不接受“当前有该状态”的近似。
- **C5/C6 的 status_end 类附加**：暂无 status_end 触发。等价替代：C5 rare=石化施加时同时在目标处 nova 小爆（0.3 attack）；C6 legendary=施加恐惧同时对其 slow 40% 2s。待 `status_end`（N8，P2）上线后可回改，非阻塞。

## 3. 其它
- N1 位移：方向=远离质心，见上。N2 targetMissingHp：增伤 = 缺失生命比例 × 系数，缺失超过 70% 起封顶；X1 数值 25/32/38/45% 封顶。
- B03-1 清单计数更正：A3–A6（4）+ D1–D6（6）= **10 种**。
- 新增能力优先级更新：**P0**：N7a/b/d/e（D3、S6、S1、S5 的前提）+ N1；**P1**：N7c、N2；P2：N3/N4/N8；P3：N5/N6。
- 批次顺序：A2、S1（样板，S1 依赖 N7d）→ B03-1 → B03-2 → B03-3。依赖未就绪的机制先跳过，不阻塞同批其余机制。

## 补充裁决（2026-10-20 12:05，Claude 默认裁决，回答 Codex 11:59）
- S1 legendary：继承 rare 的 remove=true 与 ratio×1.5（即 1.0×1.5=1.5），并在此基础上半径 3 内带异常的敌人各用自己的剩余 DOT 预算引爆。理由：四品质应单调递增，传说不得弱于稀有。
- C6 fear 时长：common/rare/epic/legendary = 2.0/2.5/3.0/3.5 秒；rare 的 amplify +10% 持续至恐惧结束；legendary 的“恐惧结束 slow”因 status_end(N8) 未上线，沿用等价替代（施加恐惧同时 slow 40% 2s）。
- 以上为 Claude 默认裁决，Codex 直接按此落地开发候选，不退回设计问题。
