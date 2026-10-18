# 物理技能特效铺开交接（2026-10-13）

用户反馈旧版物理技能特效「真的很挫」。Claude 做了 4 个样板，用户已确认方向，原话是「不用加转身，我认为这个方向可以」。4 个样板是：

- 斩击 `cut`
- 裂地 `cleave`
- 重击 `ground_slam`
- 穿云箭 `bolt`

本文交给实现方（GPT），任务是把样板的做法和参数推到**剩下 39 个物理技能**。

执行要求：

- **按批次连续做完全部批次**，中途不停下来问。
- 遇到问题按第 8 节「默认裁决」处理。只有第 10 节「窄阻塞清单」里的情况才允许停。
- 进度写在 [physical-vfx-rollout-progress.md](physical-vfx-rollout-progress.md)（R0 时新建）。每批开始和结束都要更新。

样板的唯一参考实现是 `apps/web/src/vfx-showcase.ts`，共 165 行，**先通读一遍再动手**。本文的参数都从这个文件抄来；两边有出入时，以代码为准。

## 0. 硬边界（违反即返工）

- **只改前端表现。** 以下一律不动：
  - 伤害、前摇、判定、冷却、命中目标、位移结果；
  - 服务端；
  - `packages/simulation`、`packages/content` 的数值。

  `tests/vfx-v2.test.ts` 里 69 组确定性轨迹必须逐字不变。这个测试现在有 1 项 boss/abyss_lord 位置不一致的失败，是其他会话改模拟造成的既有失败，记录即可，不要去修。
- **服务与数据**
  - 不碰 8612 正式服务及其数据库，不通过 8790 登录或写接口。
  - 画廊 `combat-art-qa.html` 不调接口，可以随便用。截图保存用 `tools/serve-physical-vfx-qa.mjs`，独立端口 8768。
- **浏览器**
  - **禁止 headless 浏览器。** 所有浏览器检查都在可见的应用内浏览器面板里做。
  - 用完把视口恢复成 desktop。
- **资源占用**
  - 一次只跑一个重任务：vitest 全量、构建、浏览器截图不并行。
  - 完整回归只在 R6 跑一次。
- **他人改动**
  - 不回退其他会话未提交的改动，共享文件只做最小插入。
  - 禁止 `git add -A`，只提交本批文件。
- **素材**
  - 只用已导出的特效库片段（`packages/asset-manifest/combat-physical-fx.json`、`combat-hit-fx.json`）和 `vfx-showcase.ts` 里的 4 张程序贴图（glow / ring / trail / spark）。
  - 不重绘，不 AI 生成。
  - 新增颜色只能来自 `vfxPalettes`（`apps/web/src/vfx-profiles.ts`）或 ui-tokens。
- **动作映射**
  - 保持 `apps/web/src/physical-actions.ts` 的现有映射：
    - 武器打击类一律用 `attack`（原版挥砍）；
    - 只有 `berserker`、`war_cry`、`blood_rage`、`shadow_step` 用 `skill`（举武器姿势）。
  - **旋转类技能不加转身、不翻朝向**（用户明确要求）。
- **克制**
  - 每次施放只有**一个主层**最显眼。
  - 白闪 ≤ 2 帧，震屏 ≤ 6px，不做全屏闪。
  - 减少动态模式下关闭以下内容：
    - 震屏、身体位移、残影；
    - 火花 `sparks()` 和碎石。

## 1. 样板总结出的硬规则（每个技能都要遵守）

这些都是样板调试时踩过的坑，违反任何一条，画面都会退回旧版的样子。

1. **Graphics + ADD 混合在这个 Phaser 版本里不渲染。**
   - 发光一律用 Image + ADD：程序贴图 glow / ring / trail / spark，或库片段。
   - Graphics 只用 NORMAL 混合（刀弧三角带、箭身）。
   - `VfxPool.graphics()` 已经强制重置为 NORMAL，不要在外面改回 ADD。
2. **库片段完整播放，按帧号推进。**
   - 用 `clipImage(key, id, index, …)`，index 跟随 age 走。
   - 不要用旧 `layer()` 那种「峰值前后两帧」的播法。
   - 寿命由技能自己的 `lifetimes` 表决定，不跟 profile 的 flash 寿命走。
3. **跳过这些帧段**（会读成白烟团或巨大星形）：
   - `blade-crescent-heavy`：
     - 0–19 是蓄力火花，只在前摇里用；
     - 21–24 的大星形跳过；
     - 释放从 25 开始。
   - `blade-streak`：0–3 的爆团跳过，从 4 开始。
   - `impact-heavy`：从 6 开始，速度 ×0.6。
4. **以下素材不用：**
   - `ground-dust`：橄榄色半透明，在草地上看不见。尘土一律用程序奶油色团：`DUST=0xeadcb8`，NORMAL 混合，每团叠两层 glow，alpha .9，不标 decor。
   - `blade-crescent`（轻）：白云波，不像刀。
   - `arrow-flight` / `arrow-launch`：发橄榄色，太弱。
5. **地面环**一律是两层：底层 `DUST` 色 NORMAL，上层元素色 ADD。只有 ADD 的话，在草地上会变绿。
6. **深度规则**

   | 层 | 深度 |
   |---|---|
   | 地面层（环、裂纹、坑） | `GROUND_DEPTH=-7500` 及其 ±2 |
   | 角色身上的光 | `feet.y+5 ~ +10` |
   | 刀弧 | `max(feet.y,target.y)+40`（要压在目标身上） |
   | 环身类的后半圈 | `feet.y-2` |
   | 环身类的前半圈 | `feet.y+40` |

7. **位置在第一次绘制时冻结**（`capture()`）。释放层和受击层留在打中的地方，角色走开不跟着走。前摇层每帧跟随武器挂点。
8. **受击层每次施放每 tick 最多 3 个完整**（`FULL_IMPACTS=3`）。超出的只画一个 40px 的 glow（lite）。
9. **库片段本体不着色**，保持白芯。元素色只上在 glow、ring 外边、火花、星芯外光、裂纹辉光副本上。土系和钢系的样板用 ember（`vfxPalettes.fire`）做暖色强调，这是用户认可的观感，钢系武器保持这个配色。
10. **碎石、火花算入共享预算。** `draw()` 返回用掉的数量，交给 `drawGround` 扣减；碎石标 decor。

## 2. 样板参数（模板 A–D，原样复用）

| 模板 | 来源 | 寿命 释放/受击 | 前摇 | 释放 | 受击 |
|---|---|---|---|---|---|
| **A 刀弧** | cut | 16 / 12 | 武器挂点 glint：glow 16→30 + 星 8→16，钢色 | NORMAL 三角带弧，见下 | `blade-streak` 4+age，124px，ADD，垂直于来向 +.56；glow 40；星 28；火花 6 根，射程 40 |
| **B 重月牙** | cleave | 34 / 14 | ① `blade-crescent-heavy` 0→19.99 帧铺满前摇，130px，ADD；② ember glow 24→74；③ 收缩范围环 | 月牙 25+age，宽 area.width×.82，朝向 θ；背月牙 25+age-2，×.62，θ+π，alpha .7；起手闪 glow 54 持续 2 tick；`groundBlast(裂纹4, 长度.62, 碎石6)` | 重：`impact-heavy` 6+age×.6，96px，ADD，ember.light；glow 48；星 34；火花 8 根，射程 52 |
| **C 落地冲击** | ground_slam | 42 / 14 | glow 18→44；t>.45 起顶点星；收缩范围环；起跳 `jump:18` | 白热核 glow .55 area，3 tick；光柱 34×120，5 tick；`groundBlast(6, .78, 碎石10, 带坑)`；二道环 3–14 tick | 同 B |
| **D 弹道** | bolt | 9 / 12 | 枪口 glow 14→32 + 3 根汇聚火花 | 枪口闪 glow 44，4 tick；星 22，3 tick；火花 4 根，锥角 .9 | ring 爆环 20→64，6 tick；glow 40；星 28；火花 6 根 |

模板细节：

- **刀弧（A 释放）**
  - 半径 r=64，绕胸口。
  - 起始角 θ-1.3·side，扫角 2.4·side。
  - 头部 `easeOut(age/2)`，age 3 起淡出 5 tick。
  - 三层 `[[1.35,main,.85],[1,light,1],[.45,白,1]]`，宽度 `1+11·sin(π(.12+.8k))`，等距 y 压扁 .6。
- **groundBlast**
  - 环在 8 tick 内扩到真实半径（DUST 底 + ADD 边）。
  - 裂纹用 `ground-crack` 原生冷却序列，帧号 = age×.75，高 30。另有一份 ADD 辉光副本，高 36，持续 16 tick。
  - 8 个尘团在环前沿依次冒出。
  - 碎石用 `ground-rock`，填充色 0x9e8566，≤ 18 tick。
- **飞行（D）**
  - ADD 拖尾长 `min(130, 24+age·55)`，高 14。
  - 头部 glow 40。
  - Graphics 箭：深色描边杆、白头、钢色尾羽，NORMAL 混合。

## 3. 现状盘点（39 个待改技能）

数据来自 `physicalSpecs` + `skillCatalog` + `vfxProfiles`，2026-10-13 导出。现在这 39 个技能都还走旧路径：

- `vfx-physical.ts` 的 `flash()`；
- `vfx-physical-skills.ts`（75 行）；
- `vfx-ground.ts`；
- `vfx-weapon-smear.ts`。

旧画面的问题：

- 两帧峰值播法；
- 白云环（如 whirl）；
- 橄榄色箭；
- 着色填充把库片段染成纯色块。

表中缩写：「半径」指 radius；「前摇」「持续」单位为 tick；「次」为段数 / 投射物数。

| 技能 | 名 | 武器 | 类型 | 半径 / 射程 | 前摇 | 持续 | 元素 | 强度 | 旧形态 | 次 | 机制 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| whirl | 旋风斩 | 剑 | area | 4.5 | 7 | – | steel | 2 | spin | 3 | |
| blade_fury | 刀刃风暴 | 剑 | area | 4 | 5 | 90 | steel | 2 | spin | 3 | schedule |
| vortex_blade | 漩涡之刃 | 剑 | area | 4.5 | 9 | – | arcane | 2 | spin | 3 | |
| dual_strike | 双重打击 | 剑 | single | r3 | 4 | – | steel | 2 | cross | 2 | schedule |
| execute | 斩杀 | 剑 | single | r3 | 8 | – | blood | 3 | slash | | execute |
| counter_strike | 反击 | 剑 | shield | 3 | 1 | 60 | steel | 2 | slash | | onHit |
| frost_blade | 霜刃 | 剑 | single | r3 | 5 | – | ice | 2 | slash | | |
| rush | 破阵 | 剑 | dash | r6 / 2 | 3 | – | steel | 2 | dash | | |
| leap_strike | 跳斩 | 剑 | dash | r8 / 2.5 | 4 | – | earth | 3 | slam | | |
| thunder_dash | 雷闪 | 剑 | dash | r7 / 2 | 3 | – | storm | 2 | dash | | lightning |
| stun_strike | 震慑 | 斧 | single | r3 | 5 | 30 | earth | 2 | slam | | |
| rampage | 狂暴 | 斧 | area | 4 | 5 | – | blood | 2 | cross | | onHit |
| berserker | 狂战士 | 斧 | single | r3.2 | 10 | 60 | blood | 3 | cross | 2 | 动作=skill |
| war_cry | 战吼 | 斧 | area | 6 | 3 | 120 | holy | 2 | cry | 3 | 动作=skill |
| blood_rage | 血怒 | 斧 | shield | – | 2 | 180 | blood | 2 | aura | | 动作=skill |
| magma_slam | 熔岩重击 | 斧 | area | 4 | 12 | – | fire | 3 | slam | | |
| venom_cleave | 腐蚀劈 | 斧 | area | 3.5 | 6 | – | poison | 2 | slash | | |
| frost_quake | 冰裂 | 斧 | area | 4.5 | 16 | – | ice | 3 | slam | | |
| staff_strike | 杖击 | 杖 | single | r3.5 | 4 | – | steel | 1 | thrust | | onHit |
| staff_flurry | 连环杖 | 杖 | single | r3.5 | 3 | – | steel | 2 | thrust | | schedule |
| staff_sweep | 横扫 | 杖 | area | 4 | 8 | – | earth | 2 | slash | | |
| pole_vault | 撑杆跃击 | 杖 | dash | r6.5 / 2.2 | 4 | – | earth | 2 | slam | | |
| seismic_staff | 震地杖 | 杖 | area | 4.5 | 16 | – | earth | 3 | slam | | |
| staff_cyclone | 回旋杖 | 杖 | area | 4 | 6 | – | steel | 2 | spin | 3 | schedule |
| throwing_knife | 飞刀 | 暗器 | projectile | r9 | 3 | – | steel | 1 | flight | | |
| fan_of_knives | 扇刃 | 暗器 | projectile | r8 | 5 | – | steel | 2 | flight | 多发 | |
| venom_needle | 淬毒针 | 暗器 | projectile | r11 | 4 | 90 | poison | 2 | flight | 多发 | |
| explosive_kunai | 爆裂苦无 | 暗器 | projectile | r10 / 1.8 | 8 | – | fire | 2 | flight | | surface 爆炸 |
| shadow_step | 影袭 | 暗器 | dash | r6 / 1.8 | 2 | – | shadow | 2 | dash | | 动作=skill |
| blade_flurry | 乱刃 | 暗器 | single | r3 | 3 | – | steel | 2 | cross | | schedule、onHit |
| assassinate | 暗杀 | 暗器 | single | r3 | 10 | – | blood | 3 | slash | | execute |
| death_lotus | 死莲 | 暗器 | area | 4.5 | 6 | – | blood | 3 | spin | 8 | schedule |
| shadow_blade | 影刃 | 暗器 | single | r3 | 4 | – | shadow | 2 | cross | 2 | schedule、penetration |
| multi_shot | 多重箭 | 弓 | projectile | r11 | 5 | – | steel | 1 | flight | 多发 | |
| volley | 齐射 | 弓 | projectile | r10 | 8 | – | steel | 2 | flight | 多波 | schedule |
| pierce_arrow | 穿透箭 | 弓 | projectile | r14 | 7 | – | steel | 2 | flight | | 穿透 |
| snipe | 狙击 | 弓 | single | r18 | 20 | – | steel | 3 | snipe | | |
| rain_of_arrows | 箭雨 | 弓 | zone | r10 / 4 | 15 | 90 | steel | 2 | rain | | surface、zone |
| explosive_shot | 爆破箭 | 弓 | projectile | r12 / 2 | 10 | – | fire | 2 | flight | | surface 爆炸 |

## 4. 模块改造

把 `ShowcaseVfx` 从「4 个技能硬编码」改成**按表驱动**，不另起一套：

1. `vfx-showcase.ts`：
   - 文件可以改名为 `vfx-physical-recipes.ts`，类名随意；
   - 保留 `capture` / `clipImage` / `soft` / `star` / `sparks` / `groundBlast` / `flight` 这些原语；
   - 新增一张配方表 `recipes: Record<skillId, Recipe>`：
     ```ts
     type Recipe={
      pattern:'arc'|'crescent'|'slam'|'bolt'|'spin'|'dash'|'combo'|'thrust'|'execute'|'cry'|'aura'|'guard'|'knife'|'rain'|'snipe';
      element:VfxElement;            // 决定 main/light 强调色
      life:{release:number;impact:number};
      heavy?:boolean;                // 受击走 B/C 的重受击
      params?:Record<string,number>; // 第 6 节每个技能的数值
     };
     ```
   - `isShowcaseKey` 改为「配方表里有这个技能」；
   - `vfx-physical.ts` / `combat-vfx.ts` 里所有 `isShowcaseKey` 分支自动覆盖新技能。
2. 4 个样板的现有画面**像素级不变**。重构后先用画廊截图对比 4 个样板，确认没变再继续。
3. 旧路径（`vfx-physical-skills.ts`、`vfx-ground.ts`、`vfx-weapon-smear.ts`、`flash()` 里的物理分支）在 39 个技能全部接入后：
   - 删掉不再被引用的代码；
   - 敌人或其他非 `player/` 的键如果还在用，就保留。
   - 删前 grep 确认。
4. `physical-vfx-spec.ts` 里身体动作相关字段（`lunge` / `jump` / `shake` / `ghosts` / `action`）继续由 `physical-motion.ts` / `hit-feedback.ts` 使用，不要删。只有画面层字段（`main` / `ground` / `hit` / `overlay`）可以在旧路径删除后清理。
5. 元素受击片段（`hit-ice-shard`、`hit-fire-big`、`hit-poison`、`hit-storm`、`hit-shadow`、`hit-blood`、`hit-arcane`、`hit-crit`）在 `combat-hit-fx.json` 里，可以作为受击的第二层。用法：
   - 完整播放；
   - 宽 72px，alpha .8；
   - 深度在 glow 之上、星之下。
   - 先确认场景已加载对应纹理；没加载的处理见 D3。

## 5. 新模板（从样板推导，参数是起点，R 批内允许 ±25% 微调，超出要写裁决）

元素色记法：`P=vfxPalettes[element]`。钢系的强调色用 ember（与样板一致），其他元素用自己的 `P.main` / `P.light`。

| 模板 | 推导自 | 前摇 | 释放 | 受击 |
|---|---|---|---|---|
| **E 环斩 spin** | A 刀弧 | A 的 glint | ① 刀弧改成绕**脚下**一圈：椭圆半径 = area.width×.5×.85，y 压扁 .56。② 头部一圈 6 tick，宽度 `1+14·sin`。③ 画两份：背半圈（角度 sin<0）深度 feet.y-2，前半圈深度 feet.y+40，形成刀光环身的效果。④ 地面一道 DUST+强调色环，6 tick 扩到真实半径；无裂纹、无碎石 | A |
| **F 冲锋 dash** | A + D 拖尾 | A 的 glint | ① 起点（`e.origin`，没有就用前摇时冻结的 feet）冒 3 个尘团。② trail 贴图从起点拉到终点，高 26，ADD，P.light，8 tick 淡出。③ 终点打一记 A 刀弧，扫角 2.0 | A |
| **G 连击 combo** | A | A 的 glint | 每个命中 tick 一记 A 刀弧，side 交替（左右互斩），r=56，扫角 2.0 | A；每次命中都算新一组 FULL_IMPACTS |
| **H 刺击 thrust** | D 枪口 + A 受击 | 武器 glint | trail 从武器挂点朝目标，长 80，高 18，ADD，3 tick 伸出、4 tick 淡出。末端星 22 | D 的爆环 + A 的星和火花（不放 blade-streak） |
| **I 处决 execute** | B | B 的蓄力片段（130px）+ glow，用 P 强调 | 目标胸口单体月牙：25+age，宽 160，θ 朝向。背月牙 ×.6。不做 groundBlast，只放一道小 DUST 环（2 格半径） | 重受击 + 元素受击片段（hit-blood） |
| **J 战吼 cry** | C 的环 | 胸口 glow 18→40，P.light | ① 两道扩散环，DUST 底 + P.main ADD，间隔 4 tick，各 10 tick 扩到真实半径。② 胸口 glow 54 闪 2 tick。③ 6 根火花**向上**飘（direction=-π/2，锥角 1.2） | 无（多数无伤害；有伤害时用 lite） |
| **K 光环 aura** | J | 同 J | 释放：一次 J 的环（1 道）+ 胸口闪。之后整个 `e.duration`（没有就用技能 duration）内：脚下 ring，P.main ADD，alpha 在 .25–.45 之间呼吸，周期 30 tick，宽 = groundSize(1.2) | 无 |
| **L 格挡 guard** | K + A | glint | 持续 `duration`：胸口 ring 60×40，钢色 ADD，alpha .4 呼吸。反击触发时（该技能的 `hit_resolved`）打一记 A 刀弧，扫角在 1 tick 内完成 | A |
| **M 飞刀 knife** | D | D 枪口（14→24） | D 枪口闪 ×.7 | D 爆环 ×.8 |
| **N 箭雨 rain** | D 箭 + C 环 | 目标区：DUST+强调色收缩环（同 B 前摇的环） | zone 生效期间每 3 tick 在区内随机点（seededNoise，用 zone.id+tick 做种子）落一支箭：Graphics 箭头朝下，ADD 竖拖尾长 60，6 tick 从高 90px 落到地面；落点冒 1 个尘团 + 小爆环 | D 的 lite |
| **O 狙击 snipe** | D | 保留现有瞄准线（Graphics NORMAL）。枪口 glow 在 20 tick 内 14→48，最后 4 tick 加星 | ① trail 从枪口拉到目标，高 18，4 tick 淡出。② 枪口闪 glow 60。③ 震屏走现有 spec | 重受击 + `hit-crit` |

飞行物（M、N 以外的弓箭）一律用 D 的 `flight()`。knife 版本的飞行物：

- 拖尾最长 90，高 10；
- 头部 glow 28；
- 刀身先试 `knife-flight` 片段（R0 看帧），不合适就用 Graphics 画短刀（见 D1）。

## 6. 逐技能配方（39 个）

「区别点」一栏说明同模板技能之间怎么拉开差距，必须做到。

### 剑（10）

| 技能 | 模板 | 区别点 / 参数 |
|---|---|---|
| whirl | E | 1.5 圈（9 tick），钢色 + ember 强调。旧的白云环删掉 |
| blade_fury | E | 持续 90 tick：每次该施放的 `hit_resolved` 新 tick 起一圈。若 12 tick 内无命中，按每 10 tick 补一圈，直到 `duration` 结束。宽度 ×.85。地面环只在第一圈出 |
| vortex_blade | E | arcane。3 道刀弧环，半径从 1.0 收缩到 .35（向内吸），各差 2 tick。中心一个 arcane glow 40 持续 9 tick |
| dual_strike | G | 两刀交叉成 X：第二刀 side 反向，起始角偏 +.5。若只有一个命中 tick，两刀间隔 3 tick |
| execute | I | blood。前摇 8 tick 用蓄力片段。月牙宽 170。受击加 hit-blood |
| counter_strike | L | 反击刀弧扫角 2.6，r=70 |
| frost_blade | A | ice 强调（刀弧三层改 ice.main / ice.light / 白）。受击第二层 `hit-ice-shard` |
| rush | F | 钢色。trail 高 26 |
| leap_strike | C | 落点 = 释放事件位置。groundBlast(5, .7, 碎石8, 带坑)。落地前 2 tick 在落点出收缩环 |
| thunder_dash | F | storm。trail 改两条，沿路径法向错开 ±6px，交替闪烁（偶数 tick 显示一条）做出电弧感。终点 glow 用 storm.light |

### 斧（8）

| 技能 | 模板 | 区别点 / 参数 |
|---|---|---|
| stun_strike | C 缩小 | 打在目标位置。groundBlast(4, .5, 碎石4, 无坑)，半径用 1.5 格。眩晕 30 tick 内目标头顶 3 颗小星（star 8）绕圈 |
| rampage | B 变体 | blood。主层用 `claw-triple`（R0 定帧段），宽 area.width×.7，朝向 θ。groundBlast(3, .5, 碎石0) |
| berserker | I + K | 动作=skill。释放先放一次 K 的光环爆发（blood），再放 I 的单体月牙 ×2，间隔 4 tick，side 反向 |
| war_cry | J | holy。环半径 6 格 |
| blood_rage | K | blood，持续 180 tick |
| magma_slam | C | fire。裂纹辉光副本 tint fire.main，环边 fire.main。中心加 `hit-fire-big` 一层，宽 area.width×.5。尘团保留 DUST（不换色） |
| venom_cleave | B | poison。环边、裂纹辉光改 poison.main。另加 5 团毒雾：soft glow，poison.dark，NORMAL，alpha .45，在范围内停 30 tick 渐散 |
| frost_quake | C | ice。裂纹辉光 ice.light，环边 ice.main。8 根裂纹，长度 .9。受击第二层 `hit-ice-shard`。碎石 tint 改 ice.dark |

### 杖（6）

| 技能 | 模板 | 区别点 / 参数 |
|---|---|---|
| staff_strike | H | 钢色，长 80 |
| staff_flurry | H × 每命中 | 每个命中 tick 一记刺击，角度轮流偏 ±.15 |
| staff_sweep | B 变体 | earth。月牙高度压到宽度的 .5（扁平横扫），宽 area.width×.9。groundBlast(0, 0, 碎石0)，只留环和尘团 |
| pole_vault | C 缩小 | groundBlast(4, .5, 碎石4, 无坑) |
| seismic_staff | C | 8 根裂纹，长度 .9，带坑，碎石 10 |
| staff_cyclone | E | 刀弧宽度 ×1.3（杖比刀粗），半径 ×.9。sand 强调色沿用 spec 的 d4bc83（已有登记色） |

### 暗器（9）

| 技能 | 模板 | 区别点 / 参数 |
|---|---|---|
| throwing_knife | M | 单发 |
| fan_of_knives | M | 每支投射物各自飞行。枪口闪只放一次 |
| venom_needle | M | poison。拖尾高 6，头 glow 20，受击第二层 `hit-poison` |
| explosive_kunai | M + C 缩小 | fire。surface 爆炸：环（fire）+ `hit-fire-big` 宽 area.width×.6 + groundBlast(4, .5, 碎石0, 无坑) |
| shadow_step | F 变体 | 动作=skill。不用发光 trail。起点和终点各冒 5 团 shadow.dark NORMAL 团（alpha .6，8 tick 散开），做出消失 / 出现。终点打一记 A 刀弧，用 shadow 强调 |
| blade_flurry | G | r=48，扫角 1.6，更快（头部 1.5 tick） |
| assassinate | I | blood。前摇 10 tick。月牙在目标**背后**一侧（θ+π 偏移 20px）出。受击加 hit-blood |
| death_lotus | E 变体 | blood。主层不是刀弧，而是 8 把刀（`knife-flight` 或 Graphics 短刀）绕脚下椭圆公转并外扩，半径从 .3 到 1.0，持续到 schedule 结束；每把带 ADD 短拖尾 |
| shadow_blade | G | shadow。两刀。另加一条穿透 trail，从施法者穿过目标后继续延伸 60px（表现 penetration） |

### 弓（6）

| 技能 | 模板 | 区别点 / 参数 |
|---|---|---|
| multi_shot | D | 每支箭各自飞行，枪口闪一次 |
| volley | D | 每一波释放都闪一次枪口。箭身尾羽改 holy.light，与 multi_shot 区分 |
| pierce_arrow | D | 拖尾最长 180。穿过每个目标都放受击（A 星 + 爆环），箭不消失 |
| snipe | O | 前摇 20 tick |
| rain_of_arrows | N | 持续 90 tick，区域半径 4 |
| explosive_shot | D + C 缩小 | fire。surface 爆炸同 explosive_kunai，规模 ×1.15 |

## 7. 批次（连续做完，不停下来等确认）

| 批 | 内容 | 产物 |
|---|---|---|
| **R0 盘点** | ① 新建进度文件，记录 git 状态、保护路径 SHA、69 组轨迹 SHA。② 用画廊逐帧看并记下可用帧段（拼成接触表存档）：`claw-triple`、`knife-flight`、`ground-ring`、`ground-crater`；`combat-hit-fx` 里本文用到的 8 个元素受击片段。③ 录 39 个技能的「改前」接触表 | `docs/reviews/physical-vfx-rollout-20261013/before/`、`frames.md`（帧段表） |
| **R1 表驱动重构** | 第 4 节 1–2 条。4 样板截图与重构前逐张对比，不允许有可见差异 | 4 样板对比图、单测 |
| **R2 剑 10** | 第 6 节剑 | 接触表 |
| **R3 斧 8 + 杖 6** | | 接触表 |
| **R4 暗器 9 + 弓 6** | | 接触表 |
| **R5 清理与预算** | 删除旧路径中不再引用的代码；负载场景（60 敌人 / 100 弹体）测帧率；同屏 20 个 E/C 技能时预算不溢出 | 负载 metrics |
| **R6 收尾** | 完整回归一次、文档、前后对比总图 | 第 9 节全部勾完 |

每批结束：

- 跑本批相关的定向测试和 `npx tsc --noEmit -p tsconfig.json`；
- 更新进度文件；
- 只提交本批文件；
- 提交信息写明批次。

## 8. 默认裁决（遇到就照做，写进进度文件的裁决日志）

- **D1 素材不合用**（如 `knife-flight` 或 `claw-triple` 帧段读不出形状）：
  - knife 改用 Graphics NORMAL 画短刀：刀身 18×4，P.light，深色描边；
  - claw 改用 3 记平行的 A 刀弧（r=50，间距 10px）。
- **D2 事件不足以支撑设计**（例如没有逐次命中、没有 `origin`）：
  - 按现有事件能表达的最大程度做；
  - 不新增、不伪造模拟事件；
  - 记入「事件缺口」。
  - 允许用纯表现计时器，例如 blade_fury 的补圈。
- **D3 元素受击片段没加载**：先查 `combat-vfx.ts` 预加载列表，补上加载，只在前端预加载里加。加不了就用 P.light 的 glow + 星代替，并记录。
- **D4 预算超了**：按以下顺序降级：
  1. 碎石；
  2. 尘团数（8→4）；
  3. 裂纹辉光副本；
  4. 背月牙、二道环。

  主层、受击主帧、首领预警不降。
- **D5 模板参数在实际画面里不好看**：允许 ±25% 调整，记下原值和新值。超出 ±25% 或要换模板时，选最接近的样板做法，记录理由，继续。
- **D6 与他人未提交改动冲突**：只做最小插入，三方比对后只提交本批文件。
- **D7 旧测试因表现键或路径变化失败**：保留战斗结果相关断言，把表现断言迁到新测试。不删断言凑通过。
- **D8 画廊没有对应武器外观按钮**（例如没有斧）：用最接近的模型，画面以特效为准。动作正确性看 `tests/physical-actions.test.ts`。

## 9. 验收与完成定义

### 动作对比验收（核心）

用户看的是**动起来的样子**，所以验收用接触表，不用单帧截图：

- **画廊扩展**
  - 在 `physical-vfx-qa.ts` 加一个 phase `rollout`，并把现有「4样板循环播放」扩成「按武器族循环播放」：剑 / 斧 / 杖 / 暗器 / 弓 / 全部。
  - `serve-physical-vfx-qa.mjs` 的保存路径正则加上 `rollout/`。
- **接触表格式**
  - 每个技能一张，从真实 `cast_started` 起，取这些帧：前摇中点、release +0 / +2 / +4 / +6 / +9 / +14 / +20 / +30，以及第一次命中 +0 / +3 / +6。
  - 横排，按角色居中裁切。
  - 存到 `docs/reviews/physical-vfx-rollout-20261013/after/<skill>.png`。
- **对照**
  - 同一张接触表的末尾拼一行同模板样板（cut / cleave / ground_slam / bolt）对应帧，作为对照。
  - 新模板 E–O 对照最近的样板。
- **逐技能自检**，写进进度文件的 39 行表，每一项必须答「是」：
  1. 定格在 release +3，不看技能名，能说出武器和招式类型；
  2. 主层是完整序列在动，不是一张图淡出；
  3. 没有白烟团、没有绿色地面环、没有橄榄色箭；
  4. 同模板的技能能区分（第 6 节「区别点」可见）；
  5. 地面层贴地，在单位下方；刀弧压在目标身上；
  6. 减少动态模式下无震屏、无位移、无火花、无碎石。

### 自动测试（新建或扩展 `tests/vfx-physical.test.ts`）

- 43 个技能都有配方；`pattern` 合法；`life` 有值。
- 所有用到的库片段 id 都在 manifest 里，且帧号在范围内（`blade-crescent-heavy` 释放 ≥ 25，`blade-streak` ≥ 4）。
- 没有任何 Graphics 被设为 ADD：在 pool 层断言 graphics 的 blendMode 恒为 NORMAL。
- 同一施放同一 tick 有 10 个命中时，完整受击 = 3，其余为 lite。
- 减少动态模式下，火花数和碎石数都是 0。
- `tests/hit-feedback.test.ts`、`tests/physical-actions.test.ts` 通过，动作映射不变。
- `tests/vfx-v2.test.ts` 的 69 组轨迹 SHA 不变（abyss_lord 既有失败照旧记录）。

### 负载

60 敌人 / 100 弹体场景的帧率不低于上一轮基线 56.57 FPS 的 95%。

### 文档

- 更新 [skill-vfx-hit-layers.md](skill-vfx-hit-layers.md)：配方表、模板、帧段表。
- 在 `../AGENTS.md` 加一条 2026-10-13 的物理特效铺开说明，写明第 1 节的硬规则，特别是「Graphics+ADD 不渲染」。

### 完成定义（全部打勾才算完）

- [ ] R0–R6 每批完成，进度文件有裁决日志和改动文件清单
- [ ] 39 个技能接触表 + 自检表全部为「是」
- [ ] 4 样板重构前后无可见差异
- [ ] 上述测试通过，完整回归跑一次并记录结果
- [ ] 负载帧率达标
- [ ] 没有改动模拟、服务端、数值、时序和动作映射

## 10. 窄阻塞清单（只有这些情况可以停下来问用户）

1. 画廊页面无法启动或无法渲染，且原因不在本任务改动范围内，最小修复也做不到。
2. 4 样板重构后出现可见差异，且 2 次尝试内无法恢复。

其他情况一律按第 8 节处理并继续。用户最后统一试玩。

## 关键文件

- 样板 / 配方：`apps/web/src/vfx-showcase.ts`（参考实现）
- 接入：
  - `apps/web/src/vfx-physical.ts`（consume / flash / flight / drawGround）
  - `apps/web/src/combat-vfx.ts`（命中火花跳过、diagnostics）
- 旧路径（R5 清理）：
  - `apps/web/src/vfx-physical-skills.ts`
  - `apps/web/src/vfx-ground.ts`
  - `apps/web/src/vfx-weapon-smear.ts`
- 规格与动作：
  - `apps/web/src/physical-vfx-spec.ts`
  - `apps/web/src/physical-actions.ts`
  - `apps/web/src/physical-motion.ts`
  - `apps/web/src/hit-feedback.ts`
- 对象池：`apps/web/src/vfx-pool.ts`
- 素材：
  - `packages/asset-manifest/combat-physical-fx.json`
  - `packages/asset-manifest/combat-hit-fx.json`
  - `apps/web/public/art/effects/`
- 画廊：
  - `apps/web/combat-art-qa.html`
  - `apps/web/src/physical-vfx-qa.ts`
  - `tools/serve-physical-vfx-qa.mjs`（8768，可保存截图）
- 上一轮交接与进度：
  - [physical-skill-vfx-handoff-20261011.md](physical-skill-vfx-handoff-20261011.md)
  - [physical-skill-vfx-progress.md](physical-skill-vfx-progress.md)
