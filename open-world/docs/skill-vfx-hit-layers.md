# 技能受击层与打击感（2026-10-11）

用户反馈技能动效“太简陋、打击感弱、太乱太闪”。2026-10-11 先做斩击、裂地、火球、冰霜新星四个样板（对比图 `docs/reviews/skill-vfx-20261011/sample-before-after.png`），用户确认方向后铺开到全部技能。只改前端表现，不改伤害、前摇、判定或冷却。

## 受击层

- 素材全部来自 `Q版日式手游SPINE特效300套` 的 001–105 号手绘受击特效，由 `tools/spine-hit-export/`（只在可见浏览器运行，禁止 headless）按原始 Spine 动画逐帧导出为 256px 帧表，源文件在 `assets/skill-fx/hit-library-source/hit-*/`，`node tools/build-combat-hit-fx.mjs` 复制到 `apps/web/public/art/effects/combat-hits/` 并生成 `packages/asset-manifest/combat-hit-fx.json`（记录库目录、动画名、起始时间、原文件与帧表哈希）。
- 元素对应（`apps/web/src/vfx-hit-style.ts` 是唯一映射）：

| 元素 | 受击层 | 库编号 |
|---|---|---|
| 钢（近战 / 远程） | hit-slash / hit-blast | 083 / 026 |
| 火（普通 / 强力） | hit-fire / hit-fire-big | 078（从 0.28 秒起）/ 104 |
| 冰（单体 / 范围或强力） | hit-ice-shard / hit-ice | 009 / 001 |
| 土（玩家物理） | hit-slash + 小团 ground-dust；范围由 GroundImpact 组合 | 083 / 084 / 054 |
| 土（怪物） | hit-earth | 027 |
| 雷 | hit-storm | 087 |
| 奥术 | hit-arcane | 071 |
| 暗影 | hit-shadow | 068 |
| 自然 | hit-nature | 095 |
| 毒 | hit-poison | 096 |
| 圣 | hit-holy | 079 |
| 血 | hit-blood | 057 |
| 暴击叠加 | hit-crit | 006 |

- 怪物命中尺寸 ×0.8，主角自己的命中始终更醒目。范围释放（裂地、新星、爆炸、毒刃劈等）在落点播放对应元素层，尺寸按真实判定半径换算。
- 冰冻状态显示 hit-ice 定格帧；减速等冰系状态只在脚下加一小片碎冰，不再给每个目标画一片冰晶林。
- 已删除：各技能的线条示意图（`vfx-motifs.ts` 的 drawMotif 不再绘制，签名仍保留给结构测试）、前摇圆环与汇聚线、释放圆环/符印/裂纹、命中暗色圆盘与白色椭圆、飞行物上的线条图形、地面区域的线条图案与冰晶几何。保留：斩击/旋风刀光、突进拖尾、闪电弧线、首领预警（扩张填充 v2）与区域边界圈。

## 打击感与降噪

- 停顿：近战轻击 1 帧、技能 2 帧、暴击 3 帧、强力技能 4 帧、击杀 5 帧；远程轻击不停顿；6 帧内不重复停顿。
- 接触闪光：命中点两帧四角星光 + 白芯；火花沿攻击方向 100° 锥形飞出。
- 同一次施放最多 3 个目标播放完整受击层，其余目标只保留受击变色与火花；每次最多 6 组火花。

## 物理技能整改（2026-10-11，2026-10-12 接续验收）

43 项登记在 `apps/web/src/physical-vfx-spec.ts`；动作在 `physical-actions.ts`。剑用刀条/月牙，锤斧用重月牙与地面反馈，杖击用小冲击环，暗器与弓沿真实弹体播放。杖的 magic 外观施放物理技能时仅切换动作：旧换装用 spear，MiniFantasy 同一骨骼用已有 Attack_TwoHand1/2，武器和外观部件保持。

新片段来自现成库：207 月牙、206 刀条（排除文字槽）、204 重月牙、239 爪痕、157 飞刀、158/159 出手与箭矢、132 重爆点、054 陨坑/冲击环、084 尘/地裂/碎石。转换、源路径与哈希见 `combat-physical-fx.json` 和 `library-contact-sheet.png`；没有新画素材。

- 震屏 1.5 / 3 / 5px，首领死亡 6px，向量总长上限 6px；地面重击竖直主导。
- 敌人视觉位移 6 / 10 / 16px，精英 ×0.6，首领 0；强地面重击额外浮空 6px、8 tick 回位。
- 主角前冲 8 / 12px、6 tick 回位；跃击/撑杆跳 18px，裂地等 10px，落地对齐真实释放。dash 不另加前冲。
- 减少动态关闭震屏、视觉位移、前冲、起跳、残影与碎石；停顿分档保持原值。白闪最多 1 tick，陨坑最多 6 个，碎石计入 384 全局粒子预算。
- 真实 Projectile 决定飞刀/箭的数量与路径；effect_activated 决定延迟爆点，hit_resolved 决定命中层。连击遵守 part 的真实时间。已存在的箭雨区域可播放下落箭；死莲三次近战脉冲只有环绕刀影，没有外射弹体。其他 D6 缺口见进度文件。

证据在 `docs/reviews/physical-vfx-20261011/after/`（43 × 3），对比图 `before-after.png`，完整状态和例外见 `docs/physical-skill-vfx-progress.md`。

## 验收

- `tests/vfx-hit-style.test.ts`：每个技能都映射到已登记、有帧表且来自库编号的受击层；元素之间不混用；怪物尺寸小于主角。
- `tests/hit-feedback.test.ts`：停顿分档。
- 可见浏览器画廊截图：`docs/reviews/skill-vfx-20261011/`。

## 2026-10-16 构建与自身增益修正

- `tools/build-combat-hit-fx.mjs` 在每个单元格外圈 20px 做 Alpha 羽化，被导出裁切（alpha>40）截平的柔光不再显成方块；hit-nature 和 hit-shadow 的首帧最明显。颜色与内部像素不变，`adaptation` 字段已写明。
- 自身增益（护盾、加速等）的胸前闪光由 `buffLayer`（`vfx-hit-style.ts`）选择该元素的受击层；钢、土、血三系用 hit-holy 加乘法染色。`hit-earth` 仍只给怪物用。
