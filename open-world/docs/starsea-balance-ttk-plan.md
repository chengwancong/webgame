# 星潮海数值重做：按击杀时间反推怪物 + 野怪复活 + 技能距离（交给实现者）

日期：2026-10-05。工程：`G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world`，本机服务 `http://127.0.0.1:8612`。

实施状态：已完成。数值、真实数据库、生产构建和浏览器证据见 [实施结果](../.design/starsea-balance-20261005/result.md) 与 [逐级模型](../.design/starsea-balance-20261005/model.md)。胜率采用指定剑系期望构筑、每档五个种子；自然流程与受控首领补测分开记录。

**玩家反馈：**
1. 第一个首领（暮界先锋·卡珀，`ss-map-boss-1`）打不过。
2. 野怪不复活，打不过就没处练级。
3. 技能要求的距离太大，近战总提示"超出施放距离"，没有刷怪的爽快感。

**本文目的：**用正式算法重做星潮海怪物数值、等级摆放和经验节奏，补上练级途径，并修正技能距离手感。

---

## 0. 必须遵守（违反即返工）

**规则与权限**
- 先读仓库根目录的 `AGENTS.md` 和 `项目.md`。
- 持久状态只由服务端修改，客户端只显示服务端结果。

**数值与测量**
- 怪物 = 模板 + 等级 + 普通/精英/首领修正，来源只有 `packages/content/monsters.json`。
- 不在代码里写死某只怪的血量或攻击。
- 所有数值测量都要记录版本、策略、种子、样本数和上限，写进工具输出和结果文档。

**版本号**
- 分开升，位置在 `packages/contracts/index.ts` 的 `versions`。
- 本方案改规则和内容，升 `rules`。
- 如果契约结构变了（例如授权里加了复活字段），升 `protocol`。
- 客户端有改动，升 `client`。
- 不得关闭版本校验。

**反作弊**
- 阈值来自真实构筑，宁可漏判，不可误判。
- 新增的复活刷怪不能触发现有的 `RATE` 校验（`apps/api/src/app.ts` 第 176–182 行附近）。

**测试与环境**
- 测试用真实 PostgreSQL，不 mock。开发登录只输账号名。
- 本机性能差：模拟、vitest、数据库、浏览器任务**一次只跑一个**。

**不要动的东西**
- 不改、不删：`tools/build-skill-fx.mjs`、`apps/web/src/combat-vfx.ts`、`vfx-profiles.ts`、`wardrobe-v2-review.html`。
- 不提交 git。

---

## 1. 现状测量（改前基线，复现脚本见 §8）

**条件：**
- 规则 ow-36。
- 剑系 斩击 / 旋风斩 / 护身印，各 1 级。
- 初始装备（`tools/starsea-fight-model.ts` 的 `freshCharacter`）。
- 自动战斗，半径 40。
- 种子 11 / 23 / 47 / 71 / 101，每场上限 180 秒。

**首领卡珀 9 级：**生命 8895，攻击 40，护甲 6。

| 玩家等级 | 胜率 | 结果 |
|---|---|---|
| 4 | 0/5 | 70 秒阵亡，首领剩 3050 血（34%） |
| 5 | 0/5 | 73 秒阵亡，首领剩 2106 血（24%） |
| 7 | 5/5 | 77 秒胜，玩家剩 24% 血 |
| 9 | 5/5 | 65 秒胜，玩家剩 35% 血 |

**经验节奏：**每章做完前 4 个任务，再把岛清一遍（`starseaKillReward` 加 `taskXp`）后的等级：

| 章 | 岛等级段 | 野怪数 | 到首领时玩家等级 | 首领等级 | 差距 |
|---|---|---|---|---|---|
| 1 | 1–9 | 29 | 5 | 9 | −4 |
| 2 | 10–16 | 24 | 9 | 16 | −7 |
| 3 | 17–22 | 27 | 14 | 22 | −8 |
| 4 | 23–27 | 26 | 18 | 27 | −9 |
| 5 | 28–32 | 9 | 22 | 32 | −10 |
| 6 | 33–37 | 16 | 27 | 37 | −10 |

**根因：**
- `apps/api/src/economy.ts` 的 `starseaKillReward` 注释写着"每章清岛 3–4 轮"，但野怪不会单独复活。
- 刷新条件在 `apps/api/src/app.ts` `/api/permit`：全岛清光、满 `refreshSeconds`，并且带新的 `attempt_id` 重新进图。实际上不可能反复刷。
- 风栖岛 29 只野怪里 6 级 12 只、8 级 7 只，1 级新角色一上岛就碰到高 5 级的怪。原因是 `placementLevel` 按"离登陆点的距离"线性取值，而大部分怪的位置都比较远。
- 卡珀的数值来自 `tools/starsea-boss-tune.ts`。它按"玩家等级 = 首领等级"来调，但玩家实际到达时低 4 级以上。

---

## 2. 正式算法（必须按此实现）

新建工具 `tools/starsea-balance-model.ts`，作为数值的**唯一生成源**：

```
npx tsx tools/starsea-balance-model.ts            # 只输出报告
npx tsx tools/starsea-balance-model.ts --write    # 改写 monsters.json 的 starsea 曲线与 ss-* 模板基准、starsea 等级与经验配置
```

现有的 `tools/starsea-boss-tune.ts` 和 `starsea-power-model.ts` 中的 `--write` 改为调用新工具或删除写入功能，避免两个来源互相覆盖。`build-starsea-monsters.mjs` 中写曲线的那行同理。

### 2.1 第一步：玩家输出曲线（逐级 1–60）

**预期角色**
- 复用 `tools/starsea-power-model.ts` 的 `character(L,'normal',max(1,L-2))`：装备落后 2 级，不凑套装。
- 技能用该等级能拿到的剑系常用组合：
  - 1–4 级：`cut / whirl / ward`；
  - 之后每章首领给的技能书解锁后加入。
- 技能等级沿用 `min(5,1+floor(L/6))`。

**测量方法**
- 在 `ss-map-wind` 的开阔地（远离安全区），用真实 `World` 测：
  1. **单体秒伤 DPS₁(L)**：玩家打 1 个同级"木桩"（普通怪模板，生命设为 1e9）30 秒。
  2. **群体秒伤 DPSₙ(L)**：同时打 4 个同级木桩 30 秒，记录总伤害。
  3. **生命 HP(L)、护甲 Armor(L)**：取 `resolveBuild` 的结果。
- 自动战斗，种子 5 个，取平均值并输出标准差。

### 2.2 第二步：三类怪物的预设时间（写成常量放在工具顶部，可调）

| 类型 | 击杀时间 TTK（玩家打死它） | 致死时间 TTD（它单独打死同级玩家） | 说明 |
|---|---|---|---|
| 普通 | 2.5 秒 | 40 秒 | 一群 4 只约 10 秒清完，掉 30–40% 血，靠岛上的脱战回复（`calmRegen` 3%/秒）连续刷 |
| 精英 | 10 秒 | 20 秒 | 必须开护盾或拉开距离 |
| 首领 | 60 秒（第 1 章）/ 75 秒（第 2–6 章） | 30 秒 | 站桩会输，躲开预警圈和用护盾能赢 |

### 2.3 第三步：反推怪物数值

**生命**
```
生命(L, 类型) = DPS₁(L) × TTK(类型)
```
- 普通怪用 DPS₁，不用 DPSₙ，保证单只也是 2.5 秒；群刷更快是 AOE 技能的奖励。
- 结果写进 `curves.starsea[L].hp`（普通怪基准）。

**精英和首领的倍率**
- `ranks` 是全局表，旧曲线也在用，**不要改**。
- 把差异放进 ss-* 模板的 `base`：
```
base.hp = curve(referenceLevel).hp × 目标倍率 / ranks[类型].hp
```
- 目标倍率：精英 = TTK精英 / TTK普通，首领 = TTK首领 / TTK普通。
- 模板之间原有的风格系数（`build-starsea-monsters.mjs` 中的 `factor`，例如守卫血量 ×1.3）保留，作为对基准的微调。

**攻击与技能倍率**
- 目标：怪物秒伤 `目标秒伤 = HP(L) / TTD(类型)`。
- 用迭代测量，不能只算一次，因为护甲减伤 `armorMitigation`（hit-ratio 模型）是非线性的，怪的技能也有各自的倍率。
- 迭代步骤：
  1. 用当前攻击 A₀ 生成怪物，让玩家（生命设为 1e9、不出手，或只开普通攻击）挨打 60 秒，测得实际秒伤 T(A₀)。
  2. 令 `A₁ = A₀ × 目标秒伤 / T(A₀)`，重测；最多 6 轮，直到误差 ≤5%。
- 普通怪用代表模板 `ss-mon-dusk-blade` 求曲线的 `attack`。其余模板沿用风格系数。
- 远程和法系模板（ranged / shaman / artillery）要单独测一次，确认它们的 TTD 在目标的 ±20% 以内，超出就调整它们的风格系数。
- **每个首领单独求**它的模板 `base.attack`，因为 6 个首领的 AI 和技能都不同。
- 首领技能倍率在 `packages/content/chapter-combat.ts` 和 `encounter-balance.json` 的 `meadowBoss` 等处。如果单个技能一击超过玩家 40% 生命，就降低该技能倍率，再整体提高普攻来补回秒伤。目标是"没有一下秒杀，但持续挨打会输"。

**护甲**
- 曲线中的 `armor` 保持现有的增长方式。
- 测 DPS₁ 时木桩要用对应等级的护甲，保证生命反推里已经算进护甲。

### 2.4 第四步：等级摆放（按体验预设）

**体验目标：**
- 岛上的普通怪与玩家**当前预期等级持平**，精英高 1 级。
- 首领 = **按主线到达时的预期等级 + 2**。
- 走主线到首领时打得过但吃力（胜率约 60–80%）；多刷 10 分钟左右、升到首领同级后很稳（100%）。

**做法：**
1. 先按 §2.5 的经验节奏算出每章的「起始等级 S_c」和「到达首领等级 E_c」（做完任务 0–3、清岛一遍之后）。
2. `islandBands[c] = [S_c, E_c]`；`bossLevels[c] = E_c + 2`。
3. 困难模式（`hardmodeBands` / `hardmodeBossLevels`）这次不动。
4. `placementLevel` 改为**按路线进度分段**，不再只按到登陆点的直线距离：
   - 野怪组按 `progress` 排序后，均匀映射到 `[S_c, E_c]`，保证每个等级都有怪。
   - 第 1 章登陆点附近必须有 1–2 级的怪。
5. 第 1 章的预期结果：岛上约 1→6 级，首领约 8–9 级。最终以工具算出的数为准。

**连锁检查：**`islandBands` 和 `bossLevels` 还被以下地方使用，改完要全部回归：
- 物品等级、掉落阶段：`stageForItemLevel`、`starseaLootFocus`；
- `starsea-power-model.ts`；
- 首领推荐等级的 HUD（`bossLevel-2`）；
- 航图上显示的等级段；
- `tests/campaign-balance.test.ts`、`starsea-build-depth.test.ts`。

### 2.5 第五步：经验节奏

**目标：**每章「做完任务 0–3 + 清岛 1 遍」恰好到「首领等级 − 2」；击败首领并交完任务 4、5 后，正好进入下一章的起始等级。

**做法：**
- 在 `starseaKillReward` 里按章节（或按怪物等级的平滑函数）乘以经验系数，由工具二分求出。
- 改前测得需要的倍数：第 1 章约 ×3.5，第 2–4 章约 ×9–12。
- 第 5、6 章即使 ×20 也不够，因为第 5 岛只有 9 只野怪、第 6 岛只有 16 只。这两座岛要先在 `islandPlacements` 里把密度提高到 ≥24 只，再求系数。
- 任务经验 `taskXp`（`packages/rules/starsea.ts` 第 27 行）可以一起调，但要保持"任务约占 40%，野外约占 60%"。

**防止刷爆：**
- 现有的等级差惩罚（高 5 级经验减半、高 10 级只剩 1/10）保留。
- 再加一条：**高于首领等级后，本章野怪经验减半**，避免一张图一直刷到满级。

---

## 3. 任务 A：野怪复活（练级途径）【优先级最高】

**现状：**授权里的 `spawns` 是一次性的。刷新必须全清、满 `refreshSeconds`(25)，还要用新的 `attempt_id` 重进图。

**方案（服务端为准，客户端照着加怪）：**

1. **复活时间**：星潮海**岛屿图**（`kind==='island'`）的野怪，单只死亡 `respawnSeconds` 后在原位置复活。
   - 这个值放在 `packages/content/encounter-balance.json` 新增的 `starseaRespawn`：
     ```json
     {"seconds": 75, "maxPerRenew": 6, "minPlayerDistance": 10}
     ```
   - 首领图、拾星港、任务波次、星潮夜的怪都**不复活**。
2. **服务端生成复活怪**：在 `/api/permit` 续期分支和战斗上报处理中，找出本授权内满足以下条件的原始野怪：
   - 已击杀（`ow_kills`）；
   - 击杀时间早于 `now - seconds`；
   - 还没生成过复活实例。

   为它生成新实例，id 为 `${原id}~r${n}`，同模板、同等级、同位置；用 `resolveMonsterSpawn` 重新解析，追加到 `row.data.spawns`。
   - 每次最多追加 `maxPerRenew` 只。
   - 离玩家最近上报位置不足 `minPlayerDistance` 的先跳过，避免脸上刷怪。
   - 可以参考现有追加波次怪的写法：`app.ts` 第 305–306 行。
3. **返回给客户端**：上报的回执和续期返回新增的怪，客户端用已有的 `World.addSpawns` 加进当前战斗。参考 `starsea-controller.ts` 第 82 行的写法，**不要重建 World**。
   - 契约里给回执加 `spawns?: Spawn[]` 字段，升 `protocol`。
4. **奖励与反作弊**：
   - 复活怪的击杀按普通野怪发奖励，进入 `ow_kills` 时 id 唯一。
   - `count-(priorKills)+kills ≤ elapsed×15+2` 的速率上限不变。
   - 在 `tests/` 里用真实刷怪节奏（自动战斗 10 分钟）确认不会误判 `RATE`。
5. **星潮夜**：`tideNightKills=40` 是按累计击杀计的，复活后更容易触发。保持现状，作为刷怪奖励。

**测试**（新增 `tests/starsea-respawn.database.test.ts`，真实 DB）：
- 击杀 1 只野怪，75 秒内续期没有新怪；拨快时钟后续期出现 `~r1` 实例。
- 再击杀复活怪，经验和金币正常到账。
- 首领图和任务波次的怪不复活。
- 连续 10 分钟模拟刷怪不触发 `RATE`。

---

## 4. 任务 B：首领与怪物数值落地

1. 实现 `tools/starsea-balance-model.ts`（§2），跑 `--write`。
2. 生成结果写到 `.design/starsea-balance-20261005/model.md`，内容包括：
   - 逐级 DPS₁、DPSₙ、HP、Armor；
   - 每级普通、精英、首领的生命和攻击；
   - 实测 TTK / TTD 和目标值的误差；
   - 版本、种子、样本数和上限。
3. `starseaBossEnrage`（180 秒后攻击 ×2）保留：首领目标 TTK 是 60–75 秒，狂暴只惩罚拖太久的打法。
4. 升 `rules`。

---

## 5. 任务 C：技能距离与刷怪手感

**现状：**
- 剑系 斩击 `range` 2.2；旋风斩是 `area`、`targeting:'enemy'`，要求目标在 `radius` 3.5 以内才能放。
- 目标稍远时，`World.castDeclared` 直接返回 `range` 失败，客户端提示"所选位置或目标超出施放距离"，必须手动走过去。

**方案：**

1. **自动接近再出手**（`packages/simulation/index.ts`，注意另一个代理也在改这个文件，先拉最新再改）：
   - 敌方目标类技能（single / chain / area / projectile）在手动或半自动下，目标在 `range`（area 用 `radius`）之外、但在 `range + 8` 格以内时，不报失败。
   - 改为记录施法意图 `castIntent={skill,targetId,until:tick+90}`，角色沿 `findPath` 走向目标，进入范围后自动释放。
   - 以下情况取消意图：
     - 玩家有移动输入、点地面移动或放别的技能；
     - 目标死亡；
     - 超过 3 秒。
   - `castIntent` 要加进 `heroFields`（多人逐玩家切换），检查点 `restore` 的字段校验要接受它。
   - `cast()` 在记录意图时返回 true，客户端就不会弹失败提示。
2. **加大近战的距离和范围**（`packages/content/skills-extended.json` 等技能源；改完跑 `tools/validate-content.ts`）：

   | 技能 | 改前 | 改后 |
   |---|---|---|
   | 斩击 `cut` | range 2.2 | range 3.0 |
   | 双重打击 `dual_strike` | range 2.5 | range 3.0 |
   | 斩杀 `execute` | range 2.5 | range 3.0 |
   | 震慑 `stun_strike` | range 2.5 | range 3.0 |
   | 乱刃 `blade_flurry` | range 2.4 | range 3.0 |
   | 暗杀 `assassinate` | range 2.6 | range 3.0 |
   | 狂战士 `berserker` | range 2.8 | range 3.2 |
   | 旋风斩 `whirl` | radius 3.5 | radius 4.5 |
   | 重击 `ground_slam` | radius 3 | radius 4 |
   | 狂暴 `rampage` | radius 3 | radius 4 |
   | 死莲 `death_lotus` | radius 3.5 | radius 4.5 |

   - 敌方目标类的 `area` 技能，判定改为"范围 + 1.5 格内有敌人即可放"，伤害仍只算 `radius` 内的敌人。
3. **自动战斗站位**：`autoMove` 中近战的停步距离 1.7 改为 `min(主力近战技能 range − 0.4, 2.6)`，避免贴脸卡位。
4. 技能面板显示的"距离 N 格"会跟着数据变化，不需要另改文字。
5. 改完重新跑 §2.1 的 DPS₁ 和 DPSₙ，再跑一遍 §2 的 `--write`。距离变了，输出也会变，**C 要在 B 的最终生成之前完成**。

**测试：**
- `tests/` 新增：目标在 5 格外按斩击，角色走近并命中；途中按方向键会取消。
- 旋风斩在 4 只敌人围成 4 格半径时全部命中。

---

## 6. 实施顺序

1. **C 技能距离**：改完数据和接近逻辑，测试通过。
2. **A 野怪复活**：服务端、契约、客户端，加数据库测试。
3. **§2.4–2.5 等级与经验**：工具求出 `islandBands`、`bossLevels`、经验系数，补高第 5、6 岛的密度。
4. **B 怪物数值**：工具 `--write` 生成曲线和模板，跑回归。
5. **版本与整体验证**：升版本，跑 §7 全部验收。

每一步都单独跑相关测试，一次只跑一个重任务。

## 7. 验收标准

**数值（工具报告里列出，全部满足）：**
1. 每章，玩家处于「到达首领等级 E_c」时打首领：自动战斗 5 个种子的胜率在 60–80% 之间，用时 50–90 秒。
2. 玩家在「首领等级」时，5 个种子全胜，剩余生命 ≥30%。
3. 玩家等于同级时：
   - 单只普通怪 TTK 在 2–3.5 秒；
   - 4 只一群 ≤12 秒，打完剩余生命 ≥50%；
   - 连续打 3 群（中间不停）不死。
4. 精英 TTK 8–14 秒；站桩被打死的时间在 15–25 秒。
5. 经验节奏：每章做完任务 0–3、清岛 1 遍后等级 = 首领等级 − 2（±0）；交完本章任务后 = 下一章起始等级（±1）。
6. 第 1 章：1 级角色登陆后 30 格内的怪都 ≤2 级。

**实机（真实浏览器，新账号只输账号名登录）：**
1. 风栖岛开局打 1–2 级的怪，单只约 2–3 秒。
2. 打死一只怪站远等 75 秒，它在原位复活；击杀后经验正常到账，没有任何报错提示。
3. 敌人在 5 格外按斩击，角色自动冲上去出手，不再出现"超出施放距离"。
4. 按主线走到卡珀，用工具报告里的 E₁ 级打首领，能赢但吃力；输了以后回岛上刷到首领同级，再打稳赢。
5. `/api/health` 的版本与客户端一致；控制台没有 pageerror。

**回归：**
- `npx tsc --noEmit -p .`
- `npx tsx tools/validate-content.ts`
- vitest：`campaign-balance`、`starsea-boss-enrage`、`starsea-build-depth`、`starsea-collision`、`combat-permit`、`skill-*`、`balance-integrity`，以及新增的测试。

**交付：**
- 结果写在 `.design/starsea-balance-20261005/result.md`，包括：
  - 改前和改后的对照表；
  - 每项测量的版本、种子、样本数和上限；
  - 实机截图。
- 不提交 git。

---

## 8. 附：基线复现脚本

改前基线由下面两个临时脚本测得，可直接参考或并入新工具：
- `.runtime/_base2.ts`：首领与一群怪的胜负测量。
- `.runtime/_flow.ts`：逐章经验节奏和所需经验倍数。

注意：`tools/starsea-fight-model.ts` 的 `fight()` 把怪摆在安全区旁边，怪不会进攻（测出来受伤为 0），**不能用来测量**。新工具要把玩家和怪摆在安全区外，或者直接用首领图的首领出生点。
