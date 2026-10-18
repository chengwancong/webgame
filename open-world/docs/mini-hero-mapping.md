# MiniFantasy 藏蓝角色正式资源映射

正式源：`assets/mini-hero/navy/runtime`，四文件按已验收独立皮肤包原字节复制，原始资源和实验包保留。`tools/build-mini-hero.mjs` 只读正式源与本项目内容；不依赖 D 盘、Spine 编辑器、实验工具或独立预览服务。资源发布至 `/art/mini-hero/navy/`。

```powershell
node tools/build-mini-hero.mjs
node tools/build-mini-hero.mjs --check
```

`--check` 验证正式源与已发布资源逐字节相同，不改文件。`pnpm build` 已包含此发布步骤。接入不修改玩法内容或存档结构。

## 明确替代范围

身体六部位每个允许使用既有 `100011` 或 `100041`；这是初始苍风旅装/守望旅装明确替代为同一藏蓝人物，不是默默忽略任意装备外观。其余身体外观使用原 renderer。

默认人物皮肤：`BODY/knight_rare1`、`HEAD/headA2`、`HAIR/hairA_a2`。原生朝左，ground `[-0.25,0]`，referenceHeight `204.69363486766815`，FPS60，PMA=true。原骨骼版本4.2.43，32动画，19个JSON physics约束；JSON和atlas完全未修改。

| 现有外观 ID | 现有内容语义 | 真实 MiniFantasy 武器 | 动作 |
| --- | --- | --- | --- |
| 100011 | sword，初始 blade | RIGHTHAND/Sword_OneHand_Rare1 | Attack_OneHand1；技能 Attack_OneHand2 |
| 300601 | sword，omega-blade，方阵苍风剑 | RIGHTHAND/Sword_TwoHand_Rare1 | Attack_TwoHand1；技能 Attack_TwoHand2 |
| 400105 | magic，已有默认魔法武器外观 | RIGHTHAND/Staff_Rare1 | Spell1，用于有限施法与投射释放 |

没有创建第三个武器/装备 ID。双手剑保持业务 family=sword，不将斧或锤假装双手剑。下表三项是没有 `kit` 的旧外观快照（如已存储的副本快照）的兼容路径；当前角色由下节「装备套装」决定。

## 装备套装（客户端0.11.27、协议37）

2026-10-16 用户选定「全部接入原生骨骼」。服务端 `resolveAppearance` 额外返回 `kit`：主手的玩法武器类型与系列/阶段、护甲的谱系/系列/阶段（`packages/rules/appearance.ts` `appearanceKit`；旧底材按名称前缀 primal-/omega- 视为 T1）。`kit` 可选，旧快照不受影响；它只决定外观，不改属性、伤害或存档。客户端 `apps/web/src/native-kit.ts` 查表：

- 衣装职业：剑→骑士，斧/锤→战士，暗器→盗贼，弓→弓手，法杖/魔杖→法师；无护甲用武器职业的 common1，赤手空拳用 `knight_common1`。头、发沿用藏蓝角色。
- 品阶（衣装与武器共用，九档互不相同、随阶段上升）：

| 系列 | T1 | T2 | T3 |
| --- | --- | --- | --- |
| standard 常规 | Common1 | Rare1 | Epic2 |
| primal 原初 | Uncommon1 | Rare2 | Legendary1 |
| omega 方阵 | Uncommon2 | Epic1 | Legendary2 |

- 武器：剑 `Sword_OneHand_*`，法杖 `Staff_*`，魔杖 `Scepter_*`，弓 `Bow_*`，暗器双手 `Dagger_*`。原骨骼没有斧和锤，使用 `assets/mini-hero/extensions` 登记的手绘斧锤（18件，按 series×tier 命名），在 RIGHTHAND 骨上按记录的柄尾/锤头像素放置；`build-mini-hero.mjs` 逐字节发布并校验。
- 普攻动作：剑 Attack_OneHand1/2，斧锤 Attack_TwoHand1/2，暗器 Attack_DualHand1/2（21/60、22/60），弓 Shoot1（23/60），法杖/魔杖 Spell1。
- 挂点：剑取刀尖，法杖/魔杖取杖头宝珠（图高 14.9%），弓取弓把中心，斧锤取登记的头部像素；投射释放点剑为刀尖、杖为宝珠，其余为手。

技能动作：83 个技能有手工编排的姿态（`apps/web/src/skill-motions.ts`、`skill-motion-map.ts`），加载时烘焙为骨骼动画，并把动作的命中帧对齐到玩法前摇，其余映射到 8 tick 收招。每个动作另有 `@still` 原地版，减少动态时骨盆与脚 IK 位移为零。只改表现，不改前摇、释放 tick、伤害或判定。

可见审查页：`apps/web/native-kit-review.html`（总览每类常规T1/原初T2/方阵T3，`?type=axe` 等看九档），使用生产 `MiniNativePreview`，红点武器挂点、蓝点释放点、绿点左手。

三个武器映射都使用 Wait1 待机、Run1 移动、Damage1 受击、Die 死亡；只有待机/移动循环。武器皮肤是原 MiniFantasy 已实际验收的单手剑、双手剑、法杖，非本轮新增绘制。

## 原图坐标挂点

所有点在完整源 PNG 的连续像素坐标内，原点左上；不能拿旋转/裁切后的 atlas 小矩形坐标替代。Runtime 按原附件宽高/缩放/旋转/平移与骨骼矩阵转换至世界坐标。三武器都是 RegionAttachment；原 trim offset为(1,1)，原武器 PNG 坐标不减 trim。

| 武器 | 完整 RGBA 尺寸 | weapon 点 | muzzle 点 |
| --- | --- | --- | --- |
| 单手剑 | 55×184 | (27.5,2.5)，真实剑尖 | 同剑尖，明确作为剑类投射释放面 |
| 双手剑 | 56×234 | (28,2.5)，真实剑尖 | 同剑尖，明确作为剑类投射释放面 |
| 法杖 | 65×232 | (32.5,2.5)，杖头顶端 | (32.5,34.5)，杖头宝珠中心 |

全部 socket 的 slot 为 `RIGHTHAND`。两剑明确 `muzzlePolicy:weapon-tip`，这是本次集成选择；不宣称剑有原枪口。发布检查强制所有武器同时具有 weapon/muzzle，防止解码成功但首帧取挂点崩溃。

## 视觉命中时点

原骨骼没有 events 定义或发布事件，因此以下数字是**原动作秒单位的视觉校准**，不能当作原事件，也不能改变服务端前摇、伤害、判定或奖励时间。渲染器将已存在的玩法阶段对齐至这些时点。

| 动作 | impactTime | 来源 |
| --- | --- | --- |
| Attack_OneHand1 | 0.35 | 原4.2运行时60Hz采样，挥击阶段剑尖最大朝左伸出，约(-160.20,96.21) |
| Attack_OneHand2 | 0.4 | 原前伸关键姿态，剑尖约(-233.36,79.59)，后续为保持/回收；不是将微小保持摆动峰值0.4833误当命中 |
| Attack_TwoHand1 | 25/60≈0.416667 | 原60Hz运行时大剑主挥击最前伸，约(-234.66,48.24) |
| Attack_TwoHand2 | 26/60≈0.433333 | 原60Hz运行时大剑前伸峰，约(-271.63,83.81) |
| Spell1 | 20/60≈0.333333 | 原手臂/变换进入施法释放姿态的关键帧，法杖宝珠约(-75.92,261.34) |

采样使用匹配的4.2 Runtime，按1/60步进更新 AnimationState、Skeleton 时间与 Physics，不对原动画改曲线。单手剑真实运行截图在0.3043秒为举剑，0.3478秒已向前挥下，与上述窗口相符。Cast1为2秒持续施法摇动，没有有限的原 release marker，因此不将它硬设为本轮普通投射释放动作。

正式登录、营地、装备切换、时序与运行证据见[游戏接入验收](mini-hero-integration.md)。资源映射检查与真实玩家路径分别保留结果，不能用资源HTTP成功代替游戏验收。

## 资源字节与溯源

| 文件 | 字节 | SHA256 |
| --- | --- | --- |
| Character.json | 863982 | 92ef889c590476c0eacdbc0f77f1206e35a1c77329867331fbc731a17fa5205a |
| Character.atlas | 46423 | 34876e2e2d159af9859b7283023964a76ab3614fb00f53169474853c5e00de02 |
| Character.png | 4517918 | e8fbe63824cb0bf26be9b98f4054c7c6b46d58f2e7ea3d5aa6375fa4e99a9456 |
| Character_2.png | 1011347 | 40b5224b8983e8ce1f32b46df9f72547fff48357b4f32d1b9148e480670674b5 |

`assets/mini-hero/navy/release.json` 固定正式资源哈希，记录已验收来源 `../experiments/sequence-reskin/skins/navy-traveler/final/runtime`；这个路径仅用于溯源，构建不读取它。发布的 release-manifest.json 同时记录资源/配置哈希和3个真实外观 ID。原 png 已是 PMA，纹理上传不得重复预乘，播放须使用 PMA blending。
