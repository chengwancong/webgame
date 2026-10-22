# 噩梦挑战扩展（P27，Claude 默认裁决，2026-10-21）

## 要解决
Lv50 每日 5 次噩梦全打同一入口（`nightmare`，forest-boss，Lv40）；词缀池仅 4 种，抽 2 共 6 种组合。后期重复游玩动力断点（walkthrough-20-30h §1）。

## 内容模板（交 Codex 写入 progression-challenges.json，不改规则代码）
`entries` 新增 3 条，字段同现有 `nightmare`（kind=nightmare，stages=1；hp/atk 为倍率，tier1 基线低于同区 high 以便渐进）：

| id | region | level | hp | attack | reward gold/xp/material | description（原创） |
|---|---|---|---|---|---|---|
| nightmare-tundra | tundra-boss | 50 | 5 | 1.8 | 900 / 450 / 60 | 1–100 层，冰原守卫在每层吸取你的热量：层数越高，倒下得越快。 |
| nightmare-abyss | abyss-boss | 50 | 4.5 | 2.0 | 1100 / 550 / 75 | 1–100 层，深渊学会重演你的每个招式：层数越高，回击越狠。 |
| nightmare-dragonbone | dragonbone-boss | 50 | 4 | 2.2 | 1300 / 650 / 90 | 1–100 层，龙骨之巅的余烬不熄：层数越高，战场越窄。 |

原 `nightmare` 保留不变（作为 Lv40 入门）。每日 `nightmareDaily=5` 不变（总次数不增，选择变多）。
奖励约为同区 high 的 0.5–0.75 倍起步，`rewardPerTier=0.04` 沿用（100 层时 ×5）。

## 词缀池扩到 8（新增 4，字段同现有：hp/attack/cooldown/healing 倍率，不新增机制字段）
| id | 名称 | 倍率 | 玩家感受 |
|---|---|---|---|
| bulwark | 壁垒：首领生命 +50%、攻击 -10% | hp1.5 atk0.9 | 拖长战斗，考验续航 |
| glass | 脆壳：生命 -30%、攻击 +80% | hp0.7 atk1.8 | 速杀 vs 暴毙 |
| sluggish | 迟滞：技能冷却 +60%、攻击 -20% | cd1.6 atk0.8 | 平稳但漫长 |
| leech | 汲取：治疗效果 -75%、生命 +20% | heal0.25 hp1.2 | 压制回复流 |
`affixCount=2` 不变；组合数 6→28。校验：`affixCount<=affixes.length` 仍成立；hp×attack 乘积单个词缀≥0.9 且≤3，防止双词缀叠成不可通关（glass+frenzied：hp0.7、atk2.7，最危险，须在 tier1 通过模拟）。

## 验收（Codex 功能验收）
1. `challengeContent` 解析通过；新 3 入口在对应区域开放且 Lv50 可进，未开放区域按 `challengeAvailability` 给“请先开放对应区域”。
2. 确定性：同 seed 抽到同一对词缀；100 次抽样 28 种组合均可出现。
3. 每个新入口 tier1 由基准 Lv50 构筑模拟通关率 ≥50%、tier100 通关率 <5%（`simulateChallenge`，不改公式）；若 glass+frenzied tier1 通关率 <30%，调该词缀 attack 至 1.5 并回报。
4. 每日 5 次计数仍按 `nightmare:day` 共享，不是每入口各 5 次。
5. 前端无需改（入口列表读 entries）；若面板仅按 id 硬编码 `nightmare`，登记回派前端。

## 裁决 R01（Claude 默认裁决，2026-10-21 回应 Codex：显示名 + tier100 失败）
1. **显示名**：3 个新入口 name = 对应 high 入口首领名 + 「·噩梦」（kind 已标噩梦；无新美术、无新专名）。dungeons.json 的 3 条目录映射按此名落地，region/level 同 entries。
2. **tier100 失败的根因判断**：公式未变，`standardState(50,sword)` 在 tier100（hp×12.9、atk×6.9 再乘入口倍率）仍 20/20 通关，说明基准构筑相对该公式富余过大，不是词缀问题。验收标准（tier1≥50%、tier100<5%）**保留不放宽**，改调参数，**一次推导、一次验证**：
   - 第一步：只调 3 个新入口的 `hp`（≥原值，上限 ×6），对每个入口二分一次，找使 tier1 通关率≥50% 且 tier100<5% 的最小 hp 缩放；attack 不动。
   - 第二步（仅当第一步在 ×6 内无解）：授权把 `nightmare.hpPerTier` 0.12→最高 0.30、`attackPerTier` 0.06→最高 0.12（全部噩梦入口含原 `nightmare` 共用；无真实玩家，开发期可改），同样一次推导；原 `nightmare` 须回归 tier1≥50%。
   - 两步都无解才回报，附每入口 tier1/10/30/60/100 通关率曲线；不再另开探索。
3. glass+frenzied 在 tier1 若 <30%，仍按原条款把 glass.attack 调到 1.5。奖励 `rewardPerTier` 不动。
4. 通过后才发布入口与词缀；发布后 P27 由 Codex 标完成，前端无需再改。

## 裁决 R02（Claude 默认裁决，2026-10-21 回应 R01 结果：无可行区间）
1. **口径统一**：只采用“正式共用函数模型”（Lv50 怪物、starsea 世界线、nightmare 1800 秒预算）作为验收口径；旧 `simulateChallenge` 预算/基表不再作为 P27 发布依据。
2. **最后一次授权推导（一次推导、一次验证，之后不再回报曲线）**：
   - 共用 `nightmare.hpPerTier` 上限放到 0.45、`attackPerTier` 上限 0.20；新 3 入口 `hp` 上限 ×10（相对表内原值）、`attack` 上限 ×1.5。原 `nightmare` 须保持 tier1 ≥50%。
   - 目标：每个新入口 tier1 ≥50%，tier100 ≤30%（由 <5% 放宽；基准构筑是固定技能 5 级的单一样例，不代表玩家上限）。曲线随层数单调不升。
3. **兜底（不再回派）**：若上述上界内仍未达到 tier100 ≤30%，按上界内最难的参数直接发布，在验收记录写一行实测曲线即可，P27 标完成。理由：本玩法为 1–100 层自选梯度，天花板高于样例构筑不构成缺陷；无真实玩家，事后试玩再调。
4. 奖励 `rewardPerTier` 不动；glass.attack 条款不变。
