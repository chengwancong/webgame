# 战斗手感整改执行文档：护盾动效 · 打击感 · 飘字

> 日期：2026-10-05　范围：`open-world`　状态：已完成（实施与浏览器验收完成；自动化保留2项既有失败）
> 按阶段顺序执行，每阶段通过验收后再进入下一阶段。帧数均按模拟 30 tick/秒 计算（1 tick ≈ 33ms）。

## 0. 必守约束

- **服务端权威**：暴击、吸收、击杀等事实只能来自 `packages/simulation` 发出的 `CombatEvent`。客户端不掷骰、不推算伤害，也不改动 `world` 的任何状态。
- **表现层不影响逻辑**：顿帧、击退、缩放、震屏都只作用于渲染（sprite 动画、渲染偏移、相机）。不暂停、不减速模拟 tick，也不改实体 `position`。
- **颜色与字号只走 token**：新增值写进 `packages/ui-tokens/tokens.json` 的 `Color.Combat.*` 和 `Font.Size.Combat*`，然后运行 `node tools/build-ui-tokens.mjs` 生成。代码通过 `resolvedToken()` / `uiColor()` 读取，不写裸色值。元素特效色继续用 `vfxPalettes`。
- **美术方向**：沿用游戏内现有特效和「奶白浅金」基调，柔和、半透明、有层次。**禁止“高亮锐利”风格**，即纯白满屏闪光、高饱和霓虹、细硬描边一类。不新增位图素材，粒子、碎片、火花都用 Graphics 代码绘制。
- **减少动态效果**：`bridge.motionReduced===true` 时关闭顿帧、击退、缩放弹跳、震屏、飘字位移，只保留颜色闪烁和淡入淡出。
- **新事件字段一律可选**：字段缺失时退回当前表现，老回放和测试照常运行。
- **机器负载**：tsc、vitest、浏览器验收串行执行，不并行。浏览器验收放在全部阶段完成之后，一次做完。

## 1. 现状与根因

| 编号 | 问题 | 位置 | 根因 |
|---|---|---|---|
| F-01 | 受击闪白几乎看不见 | `scene.ts` 约 261、269 行 | `setTintMode(MULTIPLY)` 乘一个浅色，结果接近原色，而且只持续 2 tick（66ms） |
| F-02 | 没有顿帧、没有受击位移 | `scene.ts` actor 渲染 | 只有 `action='hurt'` 4 tick 的动作切换，没有渲染层的冲击反馈 |
| F-03 | 震屏只有大招才有 | `combat-vfx.ts` 52 行 | 只有 `power===3` 才触发，6 tick 线性衰减；暴击、击杀、主角重伤都不震 |
| F-04 | 普通命中没有声音 | `main.ts` `sound()`，`scene.ts` 273 行 | 只有 cast / kill / danger 三种声音，全是 0.1 秒正弦“嘀”声；命中、暴击、受伤、护盾都没有声音 |
| F-05 | 血条没有掉血残影 | `scene.ts` 约 262 行 | 血条直接按当前值填充，掉血的瞬间没有可感知的过程 |
| N-01 | 飘字小、主次颠倒 | `scene.ts` 271 行 | 打怪数字用 H3 16px，主角受伤用 H2 20px，玩家自己的输出反而更小 |
| N-02 | 飘字没有冲击感 | `scene.ts` 289 行 | 寿命 18 tick（0.6 秒），匀速上升，从第 0 帧开始线性变淡，没有弹出和缩放 |
| N-03 | 飘字没有区分度 | `scene.ts` 271 行 | 暴击、普通、持续伤害、击杀同一个样式；`CombatEvent` 没有暴击标记，暴击只在 `packages/simulation/index.ts` 422 行的局部变量里算出来 |
| N-04 | 主角回血显示成红色 | `scene.ts` 271 行 | 颜色只按 `e.id==='hero'` 选，`healed` 也用了 `DamageTaken` |
| N-05 | 多段伤害叠在一起 | `scene.ts` 271 行 | 所有数字都从同一点 `p.y-16` 生成，没有错位和堆叠 |
| N-06 | 描边太细 | `scene.ts` 271 行 | `strokeThickness:2`、没有阴影，亮场景下读不清 |
| N-07 | 闪避、未命中没有提示 | `scene.ts` | `missed` 事件和 `status_changed{skill:'dodge'}` 事件都没有表现 |
| S-01 | 护盾生成没有动画 | `combat-vfx.ts` `drawShield` 229–233 行 | `shield>0` 时直接以 alpha .62 出现 |
| S-02 | 护盾常驻呆板 | 同上 | 2px 静态圆环加 sigil；不随剩余量变化，也没有呼吸 |
| S-03 | 受击高光方向错误 | 同上 231 行 | 高光弧固定在 `-1.3..1.3` 弧度（右侧），和攻击者方向无关，只亮 5 tick |
| S-04 | 全额吸收时没有反馈 | `scene.ts` | 伤害全部被盾吸收时 `hit_resolved.amount=0`，不出飘字也不闪；`shielded` 事件没有任何表现 |
| S-05 | 盾破没有碎裂 | 同上 229–230 行 | 10 tick 线性淡出，和自然到期完全一样 |
| S-06 | 护盾值不可见 | 主角血条 | 不知道盾还剩多少 |
| S-07 | 盾没有体积 | 同上 231 行 | 整圈画在 `foot.y+4` 深度，前后都压在角色身上，看着像贴片 |
| S-08 | 两套护盾绘制并存 | `combat-vfx.ts` `drawShield`、`skill-effects.ts` 118 行 | 由 `makeEffects()` 二选一。只改当前生效的 `SkillEffects`（combat-vfx），旧的 `skill-effects.ts` 不再追加功能 |

## 2. 阶段一：模拟层事件补字段（可选字段）

文件：`packages/simulation/index.ts`（`CombatEvent` 类型在第 20 行）。

1. `CombatEvent` 增加三个可选字段：
   ```ts
   crit?:true;
   shieldPhase?:'applied'|'absorbed';
   shieldRemaining?:number;
   ```
2. `damage()` 第 422 行：把暴击判定结果存进局部变量 `crit`，在第 448 行 `hit_resolved` 上带 `...(crit?{crit:true}:{})`。随机数调用次数和顺序**不得改变**，避免影响确定性回放。
3. 第 371 行施放护盾的 `shielded`：带 `shieldPhase:'applied'`、`shieldRemaining:this.hero.shield`。
4. 第 464 行吸收伤害的 `shielded`：带 `shieldPhase:'absorbed'`、`shieldRemaining:this.hero.shield`（这里的值已经扣过）。已有的 `...this.vfxContext` 带着攻击者的 `sourceId`，供方向计算使用。
5. 不新增事件类型。击杀用“同一 tick、同一 id 的 `entity_died`”和 `hit_resolved` 配对判断。闪避沿用现有的 `status_changed{skill:'dodge'}`。
6. 单测：暴击时带 `crit`；护盾施放、部分吸收、完全吸收后 `shieldRemaining` 正确；固定种子下，加字段前后的伤害序列完全一致。
7. 查一下 authoritative world 的序列化和校验（`authoritativeWorld` 路径）：如果事件有 schema 白名单，就把新字段加成可选。反作弊阈值不动。

**验收**：`npx tsc --noEmit -p .` 通过；simulation 相关 vitest 全部通过；固定种子回放结果和改动前一致。

## 3. 阶段二：Token

在 `tokens.json` 新增以下 token，然后运行 `node tools/build-ui-tokens.mjs` 和 `--check`：

| Token | 值 | 用途 |
|---|---|---|
| `Font.Size.CombatHit` | 22px | 玩家对敌普通伤害 |
| `Font.Size.CombatCrit` | 30px | 暴击、击杀一击 |
| `Font.Size.CombatMinor` | 15px | 持续伤害、派生伤害（`category!=='direct'`） |
| `Font.Size.CombatTaken` | 18px | 主角受伤 |
| `Font.Size.CombatLabel` | 14px | 闪避、未命中、吸收、抵抗等文字 |
| `Color.Combat.Crit` | #ffd36b | 暴击（浅金，和主题一致） |
| `Color.Combat.Heal` | #9fe39a | 治疗、回复 |
| `Color.Combat.Shield` | #bfe3ff | 护盾获得、吸收 |
| `Color.Combat.Miss` | #d8d0c0 | 闪避、未命中 |
| `Color.Combat.Element.Fire` / `Cold` / `Lightning` / `Arcane` / `Shadow` / `Poison` | 分别取 `vfxPalettes` 对应元素的 `light`/`main` 中可读性高的一档 | 非物理伤害数字着色 |
| `Color.Combat.NumberStroke` | `{Color.World.Ink}` | 飘字描边 |
| `Color.Combat.HealthTrail` | #fff4df | 血条掉血残影 |

`Color.Combat.DamageDealt` 保持 `{Color.World.Text}`（物理普通伤害为奶白色）。

## 4. 阶段三：飘字重做

新建 `apps/web/src/world-numbers.ts`，把 `scene.ts` 271 行和 289 行的创建、动画逻辑整体迁过去。`scene.ts` 只负责调用 `numbers.spawn(kind, …)` 和 `numbers.update(tick)`。

### 4.1 分类与样式

| kind | 触发 | 字号 | 颜色 | 内容 |
|---|---|---|---|---|
| `hit` | `hit_resolved`，目标非主角，direct，无 crit | CombatHit | 物理用 DamageDealt；元素伤害用 `Color.Combat.Element.*` | `formatBig(amount)` |
| `crit` | 同上，且 `crit===true` | CombatCrit | Crit | 数字本身，不加“暴击”字样；背后画一个 4 角星芒（Graphics，Crit 色，alpha .55） |
| `kill` | 同 tick 同 id 有 `entity_died` | 在原样式上放大 ×1.15 | 不变 | 冲击曲线加强（见 4.2） |
| `minor` | `category!=='direct'`（持续、连锁、派生） | CombatMinor | 按 damageType 着色 | 数字 |
| `taken` | 目标为主角，`amount>0` | CombatTaken | DamageTaken | `-` + 数字 |
| `heal` | `healed`、`revived` | CombatTaken | Heal | `+` + 数字；`revived` 为 `复起 +数字` |
| `resource` | `resource_restored` | CombatLabel | `Color.World.Info` | `能量 +数字` |
| `absorb` | `shielded` 且 `shieldPhase==='absorbed'` | CombatLabel | Shield | `吸收 数字` |
| `shieldGain` | `shielded` 且 `shieldPhase==='applied'` | CombatTaken | Shield | `护盾 +数字` |
| `miss` | `missed`，或 `status_changed` 且 `skill==='dodge'` | CombatLabel | Miss | 主角为`闪避`，否则为`未命中` |
| `status` | 现有 267 行的抵抗、免疫、净化、已结束、守护已用 | CombatLabel | `Color.World.Info` | 原文案 |

- 通用文字样式：`fontFamily` 用 token，`fontStyle:'bold'`（字重 800），`stroke` 用 NumberStroke，`strokeThickness:4`，再加 `setShadow(0,2,Ink,0,true,true)`，`resolution:worldTextResolution()`。
- **修复 N-04**：颜色按 kind 选，不再按 `e.id==='hero'` 选。

### 4.2 运动曲线（tick）

| kind | 寿命 | 缩放 | 上升 | 透明度 |
|---|---|---|---|---|
| hit | 30 | 0→2 tick 从 0.6 到 1.25（easeOutBack），2→6 tick 回到 1.0 | 0→30 tick 上升 30px，easeOutCubic | 前 65% 保持 1，之后线性降到 0 |
| crit / kill | 42 | 0→3 tick 从 0.5 到 1.6，3→8 tick 回到 1.2 | 上升 36px，easeOutCubic | 前 70% 保持 1 |
| minor | 24 | 不弹出，0.9 到 1.0 | 上升 18px | 前 50% 保持 1 |
| taken | 30 | 0→2 tick 从 1.2 到 1.0 | 向左下漂：x 为 -14px，y 先 -10 再 +6 | 前 60% 保持 1 |
| heal / shieldGain | 34 | 0.8 到 1.0 | 上升 26px，easeOutQuad | 前 65% 保持 1 |
| absorb / miss / status | 26 | 0.9 到 1.0 | 上升 16px | 前 60% 保持 1 |

- 水平散布：每个数字 x 偏移 ±10px，用 `hash(event.tick, event.id, 序号)` 确定，不用 `Math.random`，保证同一帧重绘结果稳定。
- **堆叠**：同一目标 8 tick 内的第 n 个数字，起点 y 额外上移 `14*n` px，n 最多到 3，之后循环。
- **持续伤害合并**：同一目标、同一 damageType 的 `minor` 在 10 tick 内合并为一个数字。数值累加，每次累加重新做一次 1.0→1.15→1.0 的 4 tick 缩放，寿命刷新。
- **数量上限**：同时存活最多 28 个；超出时先销毁最老的 `minor` / `status`，再销毁最老的 `hit`。
- 深度保持 10000。主角相关数字（taken/heal/absorb）层级低于玩家输出数字（hit/crit），不遮挡输出。
- **减少动态效果**：缩放固定为 1，位移为 0，只保留透明度淡出；堆叠位移保留（它属于布局，不算动画）。
- 保留 `damageNumbersCreated` 计数和 `'damage-number'` data 标记，现有测试和诊断依赖它们。

## 5. 阶段四：打击感

新建 `apps/web/src/hit-feedback.ts`，由 `scene.ts` 的 `consume()` 送入事件，actor 渲染时读取每个 actor 的反馈状态（tint、缩放、偏移、动画暂停）。

### 5.1 受击闪光（修 F-01）
- 第 0–1 tick：`setTint(Color.World.Text 对应的数值).setTintMode(Phaser.TintModes.FILL)`，sprite alpha 不变。
- 第 2–3 tick：`setTint(vfxPalettes[element].light).setTintMode(Phaser.TintModes.FILL)`，同时通过一个叠加的同形 sprite 或 `setAlpha` 混合，把强度降到 0.45。如果引擎不支持 FILL 混合强度，就改为 MULTIPLY 用 `palette.main`。
- 第 4 tick 起：`clearTint()`。
- 主角受击：FILL 改用 `Color.Combat.DamageTaken`，2 tick。
- 闪光不受“减少动态效果”影响（它不是位移）。

### 5.2 挤压与击退（修 F-02）
- 挤压：普通命中 `scaleX*1.08, scaleY*0.92` 保持 2 tick，再用 4 tick easeOutQuad 恢复。暴击和击杀改为 1.12 / 0.88。Boss 改为 1.03 / 0.97。
- 击退：渲染偏移 = 从 `sourceId` 指向目标的单位向量 × 距离。距离：普通 4px，暴击 7px，精英 ×0.6，Boss 为 0。1 tick 推出，6 tick easeOutCubic 回位。**只改渲染坐标**，不改 `world` 中的位置。
- 没有 `sourceId` 时用主角指向目标的方向。

### 5.3 顿帧（Hit Stop）
- 触发条件：主角的 direct 命中，且满足任一项：技能 `power>=2`、`crit`、`kill`。
- 表现：被击目标和主角的 sprite 动画暂停（`anims.pause()` 或跳过本帧动画推进）。时长：`power2` 为 2 tick，`crit` 为 3 tick，`kill` 和 `power3` 为 4 tick。暂停期间受击闪光照常播放。
- 冷却：两次顿帧至少间隔 6 tick，避免普攻连打显得卡顿。
- **不暂停模拟、不暂停特效时钟、不影响输入**。
- 减少动态效果时关闭。

### 5.4 震屏分级（修 F-03）
修改 `combat-vfx.ts` 52 行和 235 行，改为按档位取值：

| 档位 | 触发 | 幅度 | 时长 |
|---|---|---|---|
| 0 | 普通 power1 命中 | 无 | — |
| 1 | power2 命中、暴击 | 1.2px | 4 tick |
| 2 | power3 命中、精英被击杀、主角单次受伤 ≥ 最大生命 12% | 2.4px | 6 tick |
| 3 | Boss 技能命中、Boss 被击杀、护盾破碎时主角同时受伤 | 3.5px | 8 tick |

- 衰减：`(1-t)^2`，不用线性。
- 高档位可以打断低档位；同档位 8 tick 内不重复触发。
- 主角受伤的震屏方向偏向攻击来向（x 分量 ×1.5）。
- 减少动态效果时关闭（保持现状）。

### 5.5 命中火花
- 每次敌人 `hit_resolved`，在 chest 点用 Graphics 画短火花：普通 4 条、暴击 8 条。线长 6–12px，沿击退方向 ±50° 扇形散开，6 tick 内飞出并淡出。颜色：内层用 `palette.light`，外层用 `palette.main`，线宽 2，alpha 不超过 .85。
- 复用 `VfxPool`，不要每帧 new Graphics。
- 先核对现有 impact 阶段的 flash（`combat-vfx.ts` 中 `stage==='impact'`）是否每次命中都播放；火花是对它的补充，不是替代。

### 5.6 血条残影（修 F-05）
- 每个 actor 记录 `trailHp`。掉血时，当前血量之后、`trailHp` 之前的一段用 `Color.Combat.HealthTrail`（alpha .85）绘制。保持 10 tick 后，用 12 tick 线性收缩到当前血量。回血时 `trailHp` 直接等于当前值。
- 主角血条同样处理。

### 5.7 主角重伤反馈
- 主角单次受伤 ≥ 最大生命 12% 时，屏幕四周画一圈 `DamageTaken` 色的暗角（alpha 从 .35 到 0，14 tick）。用一张全屏 Graphics 径向渐变，或四条边的渐变矩形实现。
- 这个效果不算位移，减少动态效果时保留，但 alpha 减半。

### 5.8 音效（修 F-04）
扩展 `main.ts` 的 `sound(kind)`，仍然只用 WebAudio 合成，不下载音频文件：

| kind | 合成方式 | 触发 | 限频 |
|---|---|---|---|
| `hit` | 白噪声 40ms，过 lowpass 1.8kHz，叠加 90Hz 正弦 60ms 衰减 | 主角命中敌人 | 3 tick 内最多 1 次 |
| `crit` | `hit` 加一个 1.2kHz 三角波 80ms 上滑 | 暴击 | 4 tick |
| `hurt` | 低通噪声 70ms，加 70Hz 方波 | 主角受伤 | 4 tick |
| `kill` | 保留原有，并叠加一个 `hit` | 击杀 | 保持现状 |
| `shield-up` | 520→780Hz 正弦滑音 160ms | 护盾生成 | — |
| `shield-hit` | 1.6kHz 三角波 50ms，带轻微随机音高 | 吸收 | 4 tick |
| `shield-break` | 高通噪声 180ms，叠加 3 个递降的三角波 | 破碎 | — |
| `miss` | 高通噪声 30ms，很轻 | 闪避、未命中 | 6 tick |

- 每次播放音高随机 ±5%（用确定性 hash 即可）。
- 沿用现有 8 voice 上限；`danger` 优先级最高，其次 `shield-break` / `kill`。
- 音量基线保持 `volume*.05` 量级，不能比现有提示音更刺耳。

## 6. 阶段五：护盾动效重做

只改 `combat-vfx.ts` 的 `drawShield`（S-08）。护盾状态机由客户端根据 `world.hero.shield` 和 `shielded` 事件推导，只用于表现：

```
none →(shield>0 或 shieldPhase:'applied')→ appear(8 tick) → idle
idle →(shieldPhase:'absorbed')→ hit(8 tick) → idle
idle →(shield 从 >0 变成 0，且当 tick 有 absorbed 事件)→ break(16 tick) → none
idle →(shield 从 >0 变成 0，且当 tick 没有 absorbed 事件)→ expire(12 tick) → none
```

`shieldMax` 取最近一次 `applied` 事件的 `shieldRemaining`。缺失时取进入 idle 时的 `hero.shield`。它只用于计算显示比例。

### 6.1 生成 appear（S-01）
- 圆环缩放：0→5 tick 从 0.6 到 1.08（easeOutBack），5→8 tick 回到 1.0。alpha 从 0 到 .62。
- 一道扩散光环：半径从 42/58 扩到 70/88，alpha 从 .45 到 0，线宽从 4 到 1，持续 10 tick。
- 现有 sprite（`shield-source`）同步淡入。
- 播放 `shield-up` 音效，飘字 `护盾 +数值`。

### 6.2 常驻 idle（S-02、S-07）
- 呼吸：alpha 在 .48 到 .62 之间按 60 tick 正弦变化；sigil 保持慢速旋转。
- **前后分层**：圆环拆成后半圈（弧度 π..2π，深度 `foot.y-1`，alpha ×0.6）和前半圈（0..π，深度 `foot.y+4`），让角色“站在盾里”。
- 剩余比例 `r=shield/shieldMax`：线宽 `1.5+1.5*r`，alpha 乘以 `0.6+0.4*r`。`r<0.3` 时，在前半圈画 3 道代码裂纹（折线，用 `palette.light`，alpha .7）。
- 冰盾已有的六边形和冰晶保留，同样分前后层。

### 6.3 吸收 hit（S-03、S-04）
- 方向：用主角指向 `sourceId` 的角度 θ。在 `θ±0.7` 弧度画高光弧：线宽 5，用 `palette.light`，alpha 从 .9 到 0，8 tick。替换原来固定在右侧的弧。
- 圆环冲击：缩放 1.0→1.06→1.0，共 4 tick。
- 涟漪：从 θ 方向的盾面点向外扩散一个小圆（r 从 4 到 22），6 tick。
- 主角不闪红；飘字 `吸收 数值`；音效 `shield-hit`。
- **全额吸收**（`hit_resolved.amount===0` 且同 tick 有 absorbed）时，同样完整播放以上表现。这是 S-04 的核心修复。

### 6.4 破碎 break（S-05）
- 第 0–1 tick：圆环用 `palette.light` 画满一次（线宽 6，alpha .9）。
- 碎片：14 片三角形（每片边长 6–12px，填充 `palette.main`，描边 `palette.light`），从圆环上均匀分布的点沿径向飞出。初速 2.5–4px/tick，重力 0.25px/tick²，带自转，16 tick 内淡出。用确定性 hash 生成参数，复用 `VfxPool`。
- 震屏按档位 2；如果当 tick 主角同时受伤，按档位 3。
- 音效 `shield-break`。

### 6.5 到期 expire
- 12 tick 内 alpha 从当前值降到 0，圆环半径缩小 6%，并从圆环向上飘 6 个光点（`palette.light`，r=2，上升 18px）。没有碎片，不震屏，没有音效。

### 6.6 护盾值显示（S-06）
- 主角头顶血条（`scene.ts` 约 262 行）：在血量填充之后叠加一段护盾条，宽度为 `(width-2)*min(shield, maxHp)/maxHp`，从当前血量末端开始；超出血条的部分从左侧覆盖。颜色 `Color.Combat.Shield`，alpha .9，上沿画 1px 的 `Color.World.Text` 高光。
- HUD 主角生命条如有同样结构，用同一规则；如果没有，不新增。

### 6.7 风格自检
- 不出现纯白满屏闪光，不出现大于 6px 的硬白描边，不出现高饱和霓虹色。
- 圣盾（holy）整体应该是奶白偏金的柔光，和其他元素盾色调要有明显区分。

## 7. 阶段六：测试与验收

### 7.1 自动化（串行执行）
```bash
npx tsc --noEmit -p .
node tools/build-ui-tokens.mjs --check
npx vitest run tests/<simulation 相关>.test.ts
npx vitest run tests/<scene/vfx 相关>.test.ts
```
新增或补充的单测：
- `world-numbers`：kind 分类（含 hero heal 为绿色、全额吸收产生 absorb）、堆叠偏移、持续伤害合并、数量上限、减少动态效果下没有位移和缩放。
- 护盾状态机：appear、hit、break、expire 四种转移（break 和 expire 按“当 tick 是否有 absorbed 事件”区分）。
- `hit-feedback`：顿帧冷却、震屏档位优先级、Boss 不击退。

### 7.2 浏览器验收（全部阶段完成后一次进行，`http://127.0.0.1:8612/`）
- [ ] 普攻小怪：能明显看到受击变白，再过渡到元素色，有挤压和小幅后退，听到命中声，数字弹出后上飘，最后才淡出。
- [ ] 暴击：数字为浅金大字并带星芒，有顿帧和 1 档震屏。
- [ ] 击杀：最后一击数字加强，精英击杀时震屏。
- [ ] 持续伤害：数字小、按元素着色，并合并成跳动累加的一个数。
- [ ] 主角受伤：红字向左下漂；重伤时出现四周暗角，回血为绿色。
- [ ] 护盾：施放时有弹出和扩散光环，并显示 `护盾 +N`；受击高光出现在攻击来向；全额吸收时有 `吸收 N` 和涟漪；盾被打破时碎片四散并有声音；自然到期只是安静淡出；血条上能看到护盾段。
- [ ] 角色站在盾“里面”（后半圈在角色身后）。
- [ ] 多怪混战：同时出现的数字不糊成一团，帧率没有明显下降（同屏数字 ≤28）。
- [ ] 开启“减少动态效果”：没有顿帧、震屏、弹跳、位移，只有颜色和淡出。
- [ ] 验收结束后把视口恢复为 desktop。

## 8. 执行顺序与提交

1. 阶段一（模拟字段 + 单测），单独提交。
2. 阶段二（token），单独提交。
3. 阶段三（飘字），单独提交。
4. 阶段四（打击感），按 5.1–5.4、5.5–5.8 分两次提交。
5. 阶段五（护盾），单独提交。
6. 阶段六（全部测试 + 一次浏览器验收），完成后在本文件顶部把状态改为“已完成”，并在 `docs/hybrid-implementation.md` 记录新增事件字段、token 和模块名。


## 9. 执行结果（2026-10-05）

阶段一至五已按顺序分六次提交，阶段六收尾包含快照连续性回归、主角提示行距、圣盾纹理染色、独立验收入口与记录。实现消费权威事件；没有改动伤害公式、随机数调用顺序、模拟 tick、实体逻辑坐标或反作弊阈值。

- 类型检查、Token 生成一致性、内容校验、Vite 生产构建通过。生产构建按停止常驻服务、构建、恢复服务执行，服务及登录自启已恢复。
- 新增测试 22 项全部通过。相关完整测试 190 项中 188 项通过；两项失败已在改动前模拟代码中复现，详见验收记录，没有改写历史伤害快照掩盖差异。
- 固定种子 41、600 tick 的伤害序列、主角状态、击杀和最终随机状态与改动前一致。
- 浏览器 15 组功能检查通过，覆盖普通/暴击/击杀/持续伤害、主角受伤/治疗、圣盾/冰盾/全额吸收/破碎/到期、闪避、权威快照、减少动态效果、实时混战。截图目视检查了数字层级、提示间距、柔和配色和盾的前后层次。音效验证了触发、WebAudio 合成、音量基线、限频和优先级；主观听感不作自动化结论。
- 实际账号登录进入营地、刷新恢复会话通过；health/content 版本一致，页面运行时错误为零；浏览器视口恢复 desktop。
- RTX 4070 SUPER / D3D11 / 1280×720：基准平均 60.0 FPS；12 个目标每 3 tick 一轮命中的混战平均 58.5 FPS，帧耗时 p95 21.68ms，场景渲染 p95 2.10ms。数字最多 28；Graphics 池分配量达到稳定值。该结果限于此本机与此场景。

具体命令、原有失败、性能参数和截图见 [验收记录](reviews/combat-feel-20261005/result.md)。
