# 外观系统 V2 开发文档（装备换装 + 形象 + 幻化）

> 交付对象：负责实现的开发者/代码助手。本文自包含，按顺序实施即可。
> 工程根目录：`G:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world`（下文路径均相对此目录）。
> 2026-10-05 用户修订：外观只保留武器、衣服、鞋子三槽，取消头盔外观、美术计划及显示开关。装备系统的头盔属性与存档保留。
> 写于 2026-10-05，基线版本：client 0.10.9 / protocol 18 / rules ow-31 / assets world-art-20261004-v20-bow / db 12。

---

## 0. 必须遵守的工程约束（来自上层 AGENTS.md，摘要）

1. 持久状态（外观选择、收集）只由服务端修改；客户端只发起预览/保存请求，消费服务端返回的已解析结果。
2. 版本号分开维护：`packages/contracts/index.ts` 第 28 行 `versions={client,protocol,rules,assets,db}`。改契约升 protocol，改规则升 rules，改资源升 assets，改存档结构升 db 并写迁移。
3. 迁移只能增量保留：账号、角色、装备、钱包、回执、流水全部保留；不得删库、清档、关版本校验。
4. 数据库测试用真实数据库，不用 mock。
5. UI 颜色/字号/间距只用 `packages/ui-tokens/tokens.json` 生成的 Token；控件复用 `apps/web/src/ui-components.ts` 和 `apps/web/src/ui/`。切换条目时布局必须稳定（不跳动、不改变滚动/焦点）。
6. 大的 UI 布局变更：先给用户看示意/实机截图确认。
7. 不描述未实现的效果；没有对应美术的部位不能拿别的资源冒充（例如斧/锤不能显示成双手剑）。
8. 开发登录只输入账号名，无密码。
9. 改动 API / contracts / content / rules 后，等待托管服务自动重载（约 20 秒），用 `curl http://127.0.0.1:8612/api/health` 核对版本，再用真实浏览器登录进入营地验收，才算可玩。
10. 用户电脑性能有限：探针、vitest、数据库任务一次只跑一个重任务。
11. 不要修改 `tools/build-skill-fx.mjs`、`apps/web/src/combat-vfx.ts`、`apps/web/src/vfx-profiles.ts`。
12. 原始资源只读：`assets/mini-hero/navy/runtime/` 四个文件（Character.json/.atlas/.png/_2.png）字节不得改动，`node tools/build-mini-hero.mjs --check` 必须继续通过。新增美术走扩展图集（见 §6.3）。

---

## 1. 背景：现在的问题和根因

玩家反馈：“穿装备会把我的模型替换掉”“外观功能和常规游戏完全不同”。

根因有三条：

1. **两套角色渲染器混用。** 主角默认是 MiniFantasy 藏蓝 Spine 4.2 角色（`apps/web/src/mini-native-renderer.ts`）。但 `miniSupportsAppearance()` 只在“身体六部位都是 100011/100041 且武器是这三把之一”时才用它；穿上任何别的衣服、拿弓/斧/锤，整个角色就切换成另一套旧的分件角色（`apps/web/src/wardrobe-renderer.ts`，来自另一个素材包、另一种画风）。这就是“模型被替换”。
2. **旧分件素材是“整套角色”，不是“衣服”。** 旧素材 16 套（总库 226 套）每套是一个不同的角色（双马尾女孩、蓝发法师……）。装备映射到某套，就把那个角色的身体套到玩家身上。
3. **外观页按身体切块，而不是按装备槽。** 现在可选“头部/衣甲/手部/裤装/靴子/背饰/武器”七格，和装备栏（武器/衣服/头盔/鞋子）对不上；脸发和衣服混在一起收集；头盔没有任何显示也没有说明；“此部位自动/全部自动/自动匹配”三层规则让玩家无法预期。

## 2. 目标与非目标

**目标**

- 主角永远只用 MiniFantasy 一个模型；换任何装备只改变对应部位，脸、发型、体型永远不变。
- 外观槽对应可显示的装备：武器、衣服、鞋子，共三个槽。
- 默认“跟随装备”；可选“幻化”为已收集外观（换装备后保持）。
- 新增“形象”页：脸型/肤色、发型/发色，全部免费可选。
- 324 件装备（54 套）中的武器、衣服、鞋子及对应旧装备有外观；头盔、项链、戒指、核心不参与外观。

**非目标**

- 不改装备属性、掉落、费用、套装效果、战斗判定。外观纯展示。
- 剧情 NPC 继续使用旧分件渲染器（`story-appearance.ts` 的 `rig:'modular-hero'`），本次不动。
- 不做染色系统、不做外观交易/付费。

## 3. 玩家视角的规则（验收以此为准）

| 编号 | 规则 |
| --- | --- |
| R1 | 角色只有一个模型。任何时候换装备，头、脸、发型、体型不变。 |
| R2 | 穿衣服 → 上身、双臂、披风/衬里/领子换成该衣服外观。 |
| R3 | 穿鞋子 → 双腿（裤腿+鞋）换成该鞋子外观。没穿鞋子时，双腿跟随当前衣服外观（保持整套完整）。 |
| R4 | 拿武器 → 手上显示该武器；攻击动作按武器类型（单手/双手/双持/法杖/权杖/弓）。不拿武器 → 空手，单手动作。 |
| R5 | 发型始终显示；装备不会替换或遮住发型。 |
| R6 | 每个外观槽两种状态：“跟随装备”（默认）或“幻化：某外观”。幻化后换装备仍保持幻化，直到玩家改回“跟随装备”。 |
| R7 | 外观收集：第一次获得某件装备即永久解锁它的外观（之后分解/卖掉仍保留）。地区/首领也可奖励外观。 |
| R8 | 武器幻化只能选同一动作类型的武器外观（单手剑只能换单手剑外观）。主手换成别的类型时，已保存的不兼容武器幻化自动失效（不删除记录，换回同类型时恢复）。 |
| R9 | 形象（脸型、肤色、发型、发色）全部免费，随时可改，不受装备影响。 |
| R10 | 外观不影响任何数值；保存外观只改外观状态和角色 revision。 |
| R11 | 获得新外观时提示一行“解锁外观：XXX”，不自动穿上。 |

## 4. 资源盘点与美术需求

### 4.1 已有、直接复用（无需新画）

来源：`assets/mini-hero/navy/runtime/Character.json`（Spine 4.2.43，404 个 skin，图集 662 个区域全部存在，已校验）。总览图：

- 身体：`../.design/wardrobe-20261005/minifantasy-bodies.png`
- 发型：`../.design/wardrobe-20261005/minifantasy-hair.png`
- 武器：`../.design/wardrobe-20261005/minifantasy-weapons.png`
- 旧分件 226 套（不再用于主角，仅供对照）：`../.design/wardrobe-20261005/all-226-sets.png`

| 类别 | Skin 前缀 | 数量 | 占用插槽 | 用途 |
| --- | --- | --- | --- | --- |
| 身体 | `BODY/{class}_{rarity}{1|2}` + `BODY/base` | 61 | top, arm_L, arm_R, leg_L, leg_R；部分有 cloak(10)/lining(18)/neck(6) | 衣服（上身部分）与鞋子（腿部分） |
| class | knight / warrior / archer / rogue / wizard / cleric | 6 | | |
| rarity | common / uncommon / rare / epic / legendary，各 1、2 两款 | 10/职业 | | |
| 头 | `HEAD/headA`、`headA1..6`、`headB`、`headB1..6` | 14 | head | 形象：脸型(A/B) × 肤色(7) |
| 头发 | `HAIR/hair{A|B}_{a|b|c}{''|1..12}` | 78 | hair，部分有 hair_B（后发） | 形象：发型(6) × 发色(13) |
| 主手 | `RIGHTHAND/{Bow,Dagger,Scepter,Spear_OneHand,Spear_TwoHand,Staff,Sword_OneHand,Sword_TwoHand}_{Rarity}{1..4}` | 159 | RIGHTHAND | 武器 |
| 副手 | `LEFTHAND/{Dagger,Shield_Large,Shield_Small,Spear_OneHand,Sword_OneHand}_*` | 90 | LEFTHAND，盾牌含 shield_L | 双持暗器的左手匕首 |
| 动作 | Wait1-4, Run1-4, Walk1-4, Attack_OneHand1/2, Attack_TwoHand1/2, Attack_DualHand1/2, Cast1/2, Spell1/2, Shoot1, Guard1/2, Damage1/2, Die, Life_* | 32 | | |

注意：当前图集里 `BODY/knight_rare1` 已是藏蓝重绘版（现在的主角外观），保留它作为初始衣服。

### 4.2 必须补齐的扩展佩戴资源（P0，发布前必须到位）

MiniFantasy 没有**斧**和**锤**。按 §0-7 不能用双手剑或权杖冒充。2026-10-05 已从工程现有正式装备美术中复用18张真实斧/锤源图，登记于 `assets/mini-hero/extensions/extensions.json`；源图与本轮图标已齐，原生附件的旋转、尺寸、握点与特效端点尚待校准，不代表角色已能正确佩戴。

| 资源 | 数量 | 说明 |
| --- | --- | --- |
| 双手斧 | 9 | 常规/方阵/原初 × T1/T2/T3 |
| 双手锤 | 9 | 同上 |

现有18张源图优先复用。佩戴校准后若仍有不符合以下规范的部件，再微调对应源图；不得把图标完成记为佩戴验收完成。

**佩戴适配规格（斧/锤，图标展示方向与角色附件方向分别处理）**

- 风格：与 MiniFantasy 武器一致。深棕色粗描边（约 2–3px）、2–3 阶平涂明暗、少量高光，无渐变发光。对照 `minifantasy-weapons.png` 第 7–8 行的剑。
- 方向：竖直，柄在下、刃/锤头在上，刃朝向图片左侧（原角色朝左）。
- 尺寸：参照 `RIGHTHAND/Sword_TwoHand_Rare1`，即附件 width 56、height 234（图集像素 1:1）。斧/锤宽度可到 70–90，高度 200–234。
- 握把点：与双手剑一致，位于图片垂直中心下方 75px（附件 `x≈0.4, y≈75`，即握点在图片中心沿骨骼方向 -75）。交付时在说明里标注握点像素坐标和锤头/刃最外端（作为特效挂点）像素坐标。
- 交付格式：PNG，straight alpha（不要预乘），透明底，四周留 2px 透明边。文件名 `axe_{series}_t{tier}.png`、`hammer_{series}_t{tier}.png`，series ∈ standard/omega/primal。
- 阶段区分：T1 朴素铁木 → T2 加金属包边/纹饰 → T3 加宝石/符文、轮廓更大。方阵系偏蓝灰规整，原初系偏暗红/金、带纹路，与现有装备图标色调一致（参照 `apps/web/public/art/equipment/` 对应图标）。

### 4.3 取消的范围

用户已取消头盔外观。V2 不设头盔槽、幻化、显示开关或扩展头盔美术；保持形象页选择的发型。

### 4.4 装备图标统一（用户已要求）

2026-10-05 用户已明确要求补齐正式装备图标，并同步外观页缩略图。范围为武器、衣服、鞋子，共54×3=162张；头盔、项链、戒指、核心保留原图。图标与V2佩戴形象必须采用同一份来源映射。144张已有原生对应资源，以Wait1第0帧按角色分件直接生成；18张斧/锤使用已验证的真实斧/锤源图，登记为扩展佩戴资源来源，挂载/握点校准完成后随V2一起发布。不得让新图标继续对应旧的另一套角色。

### 4.5 缩略图（程序生成，非手绘）

外观页需要每个外观的小图。用工具离线渲染 Spine（`Wait1` 第 0 帧）导出：

- 衣服：只渲染上身部件，叠在默认头/腿上。
- 鞋子：只渲染腿部。
- 武器：渲染该武器单图。
- 发型：头和发型组合。

输出到 `apps/web/public/art/mini-hero/thumbs/{kind}/{id}.png`，并登记哈希到 manifest。新工具：`tools/build-wardrobe-thumbs.mjs`。浏览器离线渲染属于重任务，单独运行。现有导出页`wardrobe-icon-bake.html`按原生分件在目标256px分辨率直接渲染；清单、哈希与透明边缘由构建工具校验并发布供独立预览读取。

## 5. 内容数据（唯一内容源）

### 5.1 新文件 `packages/content/wardrobe.json`

```jsonc
{
  "version": 1,
  "identity": {
    "faces":   [{"id":"headA2","skin":"HEAD/headA2","label":"脸型一·肤色三"}, ...14 项],
    "hairs":   [{"id":"hairA_a2","skin":"HAIR/hairA_a2","style":"hairA_a","color":2}, ...78 项],
    "hairStyles": [{"id":"hairA_a","label":"短碎发"}, ...6 项],
    "hairColors": [{"index":0,"label":"白"}, ...13 项],
    "default": {"face":"headA2","hair":"hairA_a2"}
  },
  "outfits": [
    {"id":"knight_rare1","skin":"BODY/knight_rare1","name":"藏蓝旅装","class":"knight","rarity":"rare","variant":1},
    ... 60 项（base 不进玩家列表）
  ],
  "weapons": [
    {"id":"Sword_OneHand_Rare1","right":"RIGHTHAND/Sword_OneHand_Rare1","actionSet":"one-hand","name":"..."},
    {"id":"Dagger_Rare1","right":"RIGHTHAND/Dagger_Rare1","left":"LEFTHAND/Dagger_Rare1","actionSet":"dual"},
    {"id":"axe_standard_t1","right":"EXT/axe_standard_t1","actionSet":"two-hand","template":"RIGHTHAND/Sword_TwoHand_Rare1"},
    ...
  ],
  "starter": {"outfit":"knight_rare1","weapon":"Sword_OneHand_Rare1"},
  "unarmed": {"actionSet":"one-hand"},
  "rewards": [                   // 地区/首领奖励外观，替代旧 bundle 的 region/boss 解锁
    {"kind":"armor","id":"archer_common2","unlock":{"type":"region","region":"forest"}},
    ...
  ]
}
```

`packages/content/wardrobe.ts` 用 zod 校验，必须检查：

- 每个 skin 名都存在于 `Character.json`（构建时读取 skin 列表比对；扩展资源检查扩展图集）。
- `actionSet` ∈ {one-hand, two-hand, dual, staff, scepter, bow}。
- 所有 id 唯一；`starter`/`default` 引用存在。

### 5.2 装备 → 外观映射（写入 `packages/content/equipment-runtime.json` 的 families，替换现有 `appearances` 字段）

每个谱系新增：

```jsonc
"sword": {
  ...,
  "wardrobe": {
    "outfitClass": "knight",
    "weaponKind": {"standard":"Sword_OneHand","omega":"Sword_TwoHand","primal":"Sword_OneHand"},
    "tiers": {
      "standard": ["common1","uncommon1","rare1"],
      "omega":    ["uncommon2","rare2","epic1"],
      "primal":   ["epic2","legendary1","legendary2"]
    }
  }
}
```

**派生规则**（在 `packages/content/equipment-runtime.ts` 里替换 `collectionAppearanceMappings`）：

- `rarityVariant = tiers[series][tier-1]`，例如 `rare1`。
- 衣服、鞋子 → outfit id `${outfitClass}_${rarityVariant}`（例如 `knight_rare1`）。
- 武器 → weapon id `${weaponKind}_${Rarity}${variant}`，例如 `Sword_OneHand_Rare1`。rarity 首字母大写，variant 取 1/2（rarityVariant 的数字），保证在 1–4 内。
- 斧/锤 → `axe_{series}_t{tier}` / `hammer_{series}_t{tier}`（扩展资源）。
- 头盔、项链、戒指、核心 → 无外观。

**谱系 → 职业外观（默认方案，实施前请用户看 `minifantasy-bodies.png` 确认）**

| 谱系 | outfitClass | 武器 | actionSet | 理由 |
| --- | --- | --- | --- | --- |
| 剑 sword | knight 骑士甲 | Sword_OneHand（方阵：Sword_TwoHand） | one-hand / two-hand | 套装名“破晓骑士” |
| 锤 hammer | warrior 战士甲 | 现有真实锤源图，待挂载校准 | two-hand | “铁砧守卫/雷鸣勇士” |
| 斧 axe | archer 皮革猎装 | 现有真实斧源图，待挂载校准 | two-hand | “开山先锋”，皮革粗犷 |
| 法杖 staff | wizard 法袍 | Staff | staff | |
| 暗器 hidden | rogue 盗贼装 | Dagger 双持 | dual | |
| 魔杖 wand | cleric 祭司袍 | Scepter | scepter | |

**旧装备映射**（写在 `wardrobe.json` 的 `legacyGear`）：

| 旧 base | 衣服/鞋 | 武器 |
| --- | --- | --- |
| blade | — | Sword_OneHand_Common2 |
| omega-blade | — | Sword_TwoHand_Rare1（现有双手剑） |
| primal-blade | — | Sword_OneHand_Legendary1 |
| bow | — | Bow_Common1（actionSet bow） |
| omega-bow | — | Bow_Rare1 |
| coat | knight_common2 | — |
| charm / core / shield | 无外观（原映射是“整套角色”，新系统不再适用） | — |

### 5.3 动作映射（`assets/mini-hero/navy/profile.json` 扩展为按 actionSet 配置）

| actionSet | idle | move | attack | skill | projectile | hurt | death |
| --- | --- | --- | --- | --- | --- | --- | --- |
| one-hand | Wait1 | Run1 | Attack_OneHand1 | Attack_OneHand2 | — | Damage1 | Die |
| two-hand | Wait1 | Run1 | Attack_TwoHand1 | Attack_TwoHand2 | — | Damage1 | Die |
| dual | Wait1 | Run1 | Attack_DualHand1 | Attack_DualHand2 | — | Damage1 | Die |
| staff | Wait1 | Run1 | Spell1 | Spell2 | Spell1 | Damage1 | Die |
| scepter | Wait1 | Run1 | Cast1 | Cast2 | Cast1 | Damage1 | Die |
| bow | Wait1 | Run1 | Shoot1 | Shoot1 | Shoot1 | Damage1 | Die |

`impactTime`（表现释放帧）沿用现有 profile 的校准方式：one-hand/two-hand/staff 已有已验收值，直接沿用；dual/scepter/bow 需要按动画实际挥出帧校准，并在 profile 记录来源。impactTime 只是表现同步，不改变战斗命中（命中由 simulation 决定）。

武器挂点（特效 muzzle/weaponTip）：按 actionSet 定义 `muzzlePolicy`。剑/斧/锤/匕首用刃尖；法杖/权杖用杖头；弓用弓弦中点。挂点由附件图片坐标经附件矩阵和骨骼矩阵计算（现有 `mini-native-renderer.ts` 已有 weapon-tip 实现，扩展到每个 weapon id；同一类型可共享归一化坐标，例如“图片顶部中心向下 6%”，逐类截图核对）。

## 6. 实现

### 6.1 契约 `packages/contracts/appearance.ts`（protocol +1）

```ts
export const wardrobeSlots=['weapon','armor','boots'] as const;
export const actionSets=['one-hand','two-hand','dual','staff','scepter','bow'] as const;

// 存档
export const appearanceStateSchema=z.object({
  identity:z.object({face:id,hair:id}),
  overrides:z.object({weapon:id.optional(),armor:id.optional(),boots:id.optional()}).strict().default({}),
  collection:z.array(z.string().regex(/^(weapon|armor|boots):[A-Za-z0-9_-]{1,80}$/)).default([]),
  legacy:z.unknown().optional()   // 旧 {selection,unlocked}，迁移后原样保留，仅供审计
}).strict();

// 服务端解析结果（玩家）
export const heroAppearanceSchema=z.object({
  rig:z.literal('mini-fantasy'),
  revision:z.number().int().nonnegative(),
  family:z.enum(weaponFamilies),          // 保留给战斗/特效现有消费者
  actionSet:z.enum(actionSets),
  skins:z.object({
    face:z.string(), hair:z.string(),
    top:z.string(),                        // BODY skin，取 top/arm_L/arm_R/cloak/lining/neck
    legs:z.string(),                       // BODY skin，取 leg_L/leg_R
    right:z.string().nullable(), left:z.string().nullable()
  }).strict(),
  sources:z.object({weapon:z.enum(['equipment','override','starter','none']),armor:z.enum(['equipment','override','starter']),boots:z.enum(['equipment','override','armor'])}).strict()
}).strict();

// NPC 继续用旧结构：resolvedAppearanceSchema = z.union([heroAppearanceSchema, modularAppearanceSchema])
```

`AppearanceView`：

```ts
{
  revision, state: AppearanceState, resolved: HeroAppearance,
  slots: [{slot, equippedItem:{id,name}|null, source, displayId, displayName, overrideValid:boolean}],
  catalog: {
    weapon:[{id,name,actionSet,owned,unlockHint,thumb}], armor:[...], boots:[...],
    faces:[...], hairStyles:[...], hairColors:[...]
  }
}
```

### 6.2 规则 `packages/rules/appearance.ts`（rules +1，整体重写）

- `ensureWardrobe(s)`：补齐默认 identity；把“当前或曾经拥有的装备”对应外观加入 collection（同现有 `ensureAppearance` 语义：只增不减）；处理地区/首领奖励。
- `resolveHeroAppearance(s, draft?)`，按 §3 的规则：
  - face/hair 取 identity。
  - armor：先看 `overrides.armor`（必须在 collection），否则装备中衣服的 outfit，否则 `starter.outfit`。
  - legs：先看 `overrides.boots`，否则装备中鞋子的 outfit，否则跟随 armor 的结果。
  - weapon：取主手对应的 weapon（含旧装备映射）。override 只有在 collection 内且 actionSet 与主手一致时生效（R8）。无主手时 right/left 为 null，actionSet 为 one-hand。
  - 副武器盘不影响手持模型（保持现有规则）。
- `validateWardrobeInput`：
  - id 必须存在于内容；
  - override 必须已收集；
  - 武器 override 必须与当前主手 actionSet 一致，否则返回 `APPEARANCE_WEAPON`；
  - face/hair 只校验存在（免费）。
- `previewWardrobe` 不写档；`applyWardrobe` 写 identity/overrides；`resetWardrobe` 清空 overrides（identity 不变）。
- 解锁提示：`ensureWardrobe` 返回本次新增的 collection 项，交给获得装备的服务端流程，附在回执/事件里（R11）。

### 6.3 渲染 `apps/web/src/mini-native-renderer.ts` / `hero-appearance.ts`（assets +1）

1. **主角只走 MiniFantasy。** 删除 `miniSupportsAppearance` 分支；`HeroPreview` 对 `rig==='mini-fantasy'` 一律用 `MiniNativePreview`，`modular-hero` 只留给 NPC。营地、战斗、HUD 头像、人物页、外观预览、剧情中的主角都走同一路径。
2. **组合皮肤**：按角色从多个 skin 取指定插槽，拼成一个运行时 `Skin`。
   ```ts
   const roles = {
     top:   ['top','arm_L','arm_R','cloak','lining','neck'],
     legs:  ['leg_L','leg_R'],
     face:  ['head'],
     hair:  ['hair','hair_B'],
     right: ['RIGHTHAND'],
     left:  ['LEFTHAND','shield_L'],
   };
   // 对每个 role：src = skeletonData.findSkin(name)；遍历 src.getAttachments()，
   // 只拷贝 slotIndex 属于该 role 的条目：composite.setAttachment(slotIndex, entry.name, entry.attachment)。
   // role 的 skin 没有某插槽（例如没有 cloak）→ 该插槽为空，不能残留上一套的附件。
   ```
   切换皮肤后调用 `skeleton.setSkin(composite); skeleton.setSlotsToSetupPose();`。物理约束要 reset，避免披风/头发甩动。组合皮肤按 key 缓存。
3. **扩展图集（斧/锤）**：`assets/mini-hero/extensions/` 存交付的 PNG 和 `extensions.json`（id、文件、sha256、握点、挂点、template）。新工具 `tools/build-mini-hero-ext.mjs` 把 PNG 预乘 alpha 后打包成 `Character_ext.atlas` + `Character_ext.png`，发布到 `apps/web/public/art/mini-hero/navy/`。运行时加载第二个 TextureAtlas，按 `template` 克隆 RegionAttachment（复制 x/y/rotation/scale，宽高按新图），换成扩展区域，以 `EXT/{id}` 注册进组合皮肤。原四个文件不改。
4. 原子切换、首帧校验、失败回滚、迟到请求不覆盖：保留 `hero-appearance.ts` 的现有机制。
5. 头像：继续只取头和头发范围。

### 6.4 API `apps/api/src/app.ts`

沿用现有四个端点与事务/租约/revision/幂等回执/流水，只换请求体：

- `GET /api/appearance` → `AppearanceView`
- `POST /api/appearance/preview` `{revision, identity?, overrides?}` → `{revision, resolved}`
- `POST /api/appearance/apply` 同上，加 command 字段 → receipt
- `POST /api/appearance/reset` → 清空 overrides
- 删除 `appearance/default`（如仍被客户端调用则保留为 reset 的别名一个版本）。
- `packages/contracts/index.ts` 第 117–119 行同步更新解析。

所有把装备写进角色的流程（掉落领取、锻造、任务奖励、商店）在同一事务里调用 `ensureWardrobe`，把新解锁项放进回执，供客户端提示。

### 6.5 存档迁移 `apps/api/src/database.ts`（db 12 → 13）

新增 `version=13` 块，`SELECT ... FOR UPDATE` 逐角色处理：

1. `legacy = {selection, unlocked}` 原样存入 `appearance.legacy`。
2. `identity = wardrobe.identity.default`（headA2 + hairA_a2，即现在主角的藏蓝脸发，玩家看到的样子不变）。
3. `overrides = {}`。旧七部位选择无法对应新资源，不迁移；首次打开外观页显示一次提示“外观系统已升级，原搭配已重置为跟随装备”。
4. `collection`：
   - 遍历角色当前和历史拥有的装备 base（gear 列表 + 已有回执中的装备授予），按 §5.2 生成；
   - 旧 `unlocked` 中的地区/首领类 bundle，按 `wardrobe.json.rewards` 对应表转换。
5. 发型按 identity 始终显示，不增加装备遮挡开关。
6. 不改钱包、装备、成长、回执。迁移前后核对角色数、装备数、钱包合计一致（写进迁移测试）。

### 6.6 界面 `apps/web/src/appearance-panel.ts` / `appearance-controller.ts` / `appearance-panel.css`

整体布局（实施前先出实机截图给用户确认）：

```
┌──────────────┬──────────────────────────────────────────┐
│ 角色预览画布  │ [装备外观] [形象]                          │
│ (待机/攻击/  │ ┌部位──穿着的装备──────显示为────────────┐ │
│  施法/转向)  │ │武器  霜纹长剑        跟随装备           │ │
│              │ │衣服  守望皮甲        幻化·龙裔战装 🔒   │ │
│              │ │鞋子  旅人短靴        跟随装备           │ │
│              │ └────────────────────────────────────────┘ │
│              │ 武器·单手剑  已收集 3/20                     │
│              │ [跟随装备][外观][外观][外观][未收集]…       │
├──────────────┴──────────────────────────────────────────┤
│ 状态提示                              [撤销] [保存外观]   │
└─────────────────────────────────────────────────────────┘
```

- 装备外观页：
  - 点哪一行就在下方列出该槽的外观；第一格固定为“跟随装备”。
  - 已收集外观可点；未收集的置灰，显示获取途径（unlockHint）。
  - 武器只列与当前主手同 actionSet 的外观。
- 形象页：
  - 两组：脸型（A/B）+ 肤色（7 个色块），发型（6 个缩略图）+ 发色（13 个色块）。
  - 全部可点，不显示“未收集”。
- 预览：点选即请求服务端 preview，画布实时更新。保存前所有改动只是草稿。
- 按钮：只保留“撤销调整”（secondary）和“保存外观”（primary），尺寸一致。删除“此部位自动”“全部自动”“刷新信息”（刷新改为出错时的恢复按钮）。
- 必须复用 `tabsHtml`、`itemSlot`、`buttonHtml`、`statusBadgeHtml`、`stateBlockHtml`；颜色/尺寸用 Token。
- 布局稳定：切换槽位、选中外观、切换页签时，预览、列表区、按钮位置都不移动；列表区固定高度，内部滚动，切换槽位时滚动归零。

装备提示联动（`apps/web/src/` 装备 Tips 渲染处）：衣服/鞋子/武器的 Tips 增加一行“外观：XXX”。若该槽被幻化覆盖，显示“外观：XXX（当前显示幻化：YYY）”。数据来自服务端 view，不在客户端推算映射。

获得提示：领取装备的回执里有新解锁外观时，HUD 弹一行“解锁外观：XXX”，复用现有提示组件。

## 7. 测试

单元/集成（vitest，一次只跑一个）：

- `tests/wardrobe-content.test.ts`：
  - wardrobe.json 里所有 skin 都存在于 Character.json；
  - 324 件装备 + 旧装备都能派生出合法外观 id（头盔/项链/戒指/核心除外）；
  - 扩展资源 id 都在扩展清单里。
- `tests/appearance-rules.test.ts`（重写）：
  - R1：换衣服前后，face/hair 不变；
  - R2/R3：衣服只改 top；穿鞋只改 legs；脱鞋 legs 跟随衣服；
  - R4：剑/斧/锤/弓/暗器/法杖/魔杖/空手对应的 actionSet 与 right/left；
  - R6：幻化后换衣服仍显示幻化；改回跟随恢复；
  - R7：分解装备后 collection 保留；
  - R8：不兼容武器幻化被拒；主手换类型后失效，换回恢复；
  - R9：任意 face/hair 可保存，未知 id 被拒。
- `tests/appearance-api.test.ts`（真实数据库）：
  - preview 不写档；
  - apply 幂等（同 command 重放返回同一回执）；
  - revision 冲突被拒；
  - reset 只清 overrides。
- `tests/appearance-migration.test.ts`（真实数据库）：
  - 造一个 db12 角色（有旧 selection/unlocked 和多件装备）；
  - 迁移后 legacy 原样保留、collection 正确，钱包/装备/回执数量不变。
- `tests/mini-native-renderer.test.ts`（扩展）：
  - 组合皮肤只含指定插槽；
  - 前一套的 cloak 不残留；
  - 扩展附件能挂上；
  - 首帧非空。
- `tests/hero-appearance.test.ts`：主角永远不实例化 WardrobePreview。

浏览器验收（一次一个，结束删掉临时文件）：

1. 账号名登录 → 进入营地，`/api/health` 版本正确，无版本拦截。
2. 打开外观页截图（装备外观页、形象页各一张）。
3. 依次装备剑/锤/斧/法杖/暗器/魔杖/弓 + 不同阶段衣服与鞋子，每次截图营地角色：脸发一致，只有对应部位变化，攻击动作类型正确。
4. 进入野外打一场，确认战斗中外观与营地一致，特效从武器尖端发出。
5. 幻化衣服 → 换另一件衣服 → 仍显示幻化；改回跟随 → 显示新衣服。
6. 刷新页面、重新登录，外观保持。
7. 记录所有截图路径交给用户试玩。

## 8. 分阶段计划

| 阶段 | 内容 | 依赖美术 |
| --- | --- | --- |
| P0 | §5 内容、§6.1–6.5 契约/规则/渲染/API/迁移；剑、法杖、暗器、魔杖、弓、旧装备全部可用 | 斧、锤 18 张（或最低 6 张原画 + 改色）。**美术未到位前不发布**，因为斧/锤不能冒充 |
| P1 | §6.6 新外观页 + 装备 Tips 外观行 + 解锁提示 + §4.5 缩略图 | 无 |
| P2 | 图标与外观统一（已由用户要求，随V2发布） | 图标162张，同源缩略图 |

每阶段按 §0-9 验收后再进入下一阶段；版本号每次按影响面分别提升。

## 9. 待用户确认（实施前问一次，未答复按默认）

| 问题 | 默认 |
| --- | --- |
| 谱系 → 职业外观对应（§5.2 表） | 按表 |
| 剑的方阵系用双手剑（动作变成双手），常规/原初用单手剑 | 是 |
| 形象全部免费 | 是 |
| 幻化换装备后保持 | 是 |
| 外观只保留武器/衣服/鞋子，不设头盔外观 | 是（已由用户确认） |
| 新外观页布局（§6.6） | 先出实机截图确认 |
