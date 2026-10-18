# 物理系技能表现整改交接（2026-10-11）

用户反馈：「使用技能的特效，感觉还是不是很像游戏，尤其是物理系的」。本文是给实现方（GPT）的完整交接，**必须按批次连续做完全部批次**，中途不停下来问；遇到问题按「默认裁决」处理，只有「窄阻塞清单」里的情况才允许停。进度写在 [physical-skill-vfx-progress.md](physical-skill-vfx-progress.md)，每批开始和结束都要更新。

## 0. 硬边界（违反即返工）

- **只改前端表现**：伤害、前摇、判定、冷却、命中目标、位移结果、服务端、`packages/simulation` 一律不动。`tests/vfx-v2.test.ts` 的 69 组确定性轨迹必须逐字不变。
- 不碰 8612 正式服务及其数据库；不通过 8790 登录或写接口。画廊 `combat-art-qa.html` 不调接口，可以随便用。
- **禁止 headless 浏览器**。所有浏览器检查在可见的应用内浏览器面板里做，做完把视口恢复 desktop。
- 一次只跑一个重任务（vitest 全量 / 构建 / 浏览器导出不并行）。完整回归只在 P6 跑一次。
- 不回退其他会话未提交的改动；共享文件只做最小插入。
- 素材**先用特效库** `G:/webgame/abyss-walker-migration/Q版日式手游SPINE特效300套`，不重绘、不 AI 生成；只做运行时缩放、旋转、着色、裁剪。
- 克制：用户之前嫌「太乱太闪」。每次施放只有**一个主层**最显眼；白闪 ≤ 2 帧；不做全屏闪；减少动态模式下关闭震屏、击退、主角前冲和碎屑。

## 1. 现状诊断（为什么“不像游戏”）

在画廊里把释放瞬间定格看到（P0 要补成截图存档）：

| 技能 | 现在看到的 | 问题 |
|---|---|---|
| 斩击 cut | 一条细黄刀光 + 一条细蓝弧线 + 小星形受击 | 线条感，没有体积，像示意图 |
| 旋风斩 whirl | 一根竖直黄光条 + 一圈细蓝椭圆线 + 星形 | 看不出“转一圈”，蓝线与钢系无关 |
| 冲锋 rush | 释放后第 2 帧几乎只剩一个受击星 | 没有残影、速度线、起止尘土，冲刺感为零 |
| 裂地 ground_slam | 盖住所有单位的一大片红橙色平面团 | 看起来像火，不是土；没有坑、裂纹、碎石、尘环、冲击波 |

根因：

1. **动作不分武器**：主角施法只播 `attack` / `skill` 两个通用动作；锤、斧、剑、杖、暗器挥起来一样。外观上法杖映射到 `magic` 动作族，所以**杖术物理技能是用施法姿势放的**。主角释放时也没有前冲或起跳。
2. **刀光是程序画的细线**：斩击、旋风、突进主要靠 `combat-vfx.ts` 的 `arcPoints` 丝带加 1–2 个通用 slash 贴图，所有物理技能共用，没有月牙刀光的体积和拖影。
3. **土系受击层选错**：`vfx-hit-style.ts` 中土的 `areaLayer` / `hitLayer` 是 `hit-earth`（库 027）。实际画面偏红橙，读成火；而且只是一张平贴的图，不贴地。
4. **打击反馈偏弱**：震屏上限 3px（`vfxBudgets.cameraShakePixels`），最强一档只有 3.5px；敌人受击视觉位移只有 6 / 11px；没有浮空，没有方向性地面反馈。停顿分档已经有，保留。
5. **素材只用了库里一小部分**：只导出了 001–105 号里的 15 套受击层。106–300 号里有成套的斩击月牙、刀光条、三连爪、飞刀、箭矢、重击爆点；054/084 号（3.7 版）有陨坑、冲击环、尘云、裂纹、碎石，都没用上。

## 2. 目标效果（一句话标准）

**每个物理技能定格在释放后第 3 帧，不看技能名也能说出“这是剑 / 锤 / 杖 / 暗器 / 弓的哪种招”。** 具体要做到：

- 刀光是**有宽度的月牙或刀条贴图**（白芯 + 元素色边），朝向目标，水平挥砍按等距压扁；不再出现宽度小于 6px 的线条刀光。
- 重武器落地一定有**地面反馈**：坑 / 裂纹 / 尘环 / 碎石 / 冲击环，并且贴地（等距压扁、画在单位下方）。
- 主角在释放帧有**身体动作**：斩击前冲，重击起跳下砸，暗器抬手，弓拉满。
- 命中有**分档的重量**：轻击脆、重击沉、击杀顿。
- 五类武器的配色和节奏不同：剑快而亮，锤斧慢而沉、带土，杖钝而圆，暗器小而多，弓直而长。

## 3. 素材清单（P1 导出）

| 新片段 id | 库目录 | Spine 版本 | 用途 | 注意 |
|---|---|---|---|---|
| `blade-crescent` | `207-eff65hensao` | 2.1.27 | 白色月牙刀光（多角度）+ 尘冠 | 灰白素材，运行时按元素着色；旋风拼环、横扫、重劈 |
| `blade-streak` | `206-eff64zhan-sc` | 2.1.27 | 金色直刀条 + 火花 | **剔除写有「斩」字的槽位**（文字贴图不要） |
| `blade-crescent-heavy` | `204-eff64zhan-fd-down` | 2.1.27 | 橙红粗月牙 + 十字爆点 | 处决、狂战、重劈；血系着暗红 |
| `claw-triple` | `239-eff81zhuaji-fd-down` | 2.1.27 | 三连爪痕 + 火花 | 双刃斩、刀刃乱舞、暴走 |
| `knife-flight` | `157-eff37feidaofx` | 2.1.27 | 飞刀本体 + 拖尾 | 拖尾原色紫，钢系着白，暗影保留紫 |
| `arrow-flight` / `arrow-launch` | `159-eff37shejianfx` / `158-eff37shejianfd` | 2.1.27 | 箭矢 + 拖尾 / 出手 | 金色，钢系可降饱和 |
| `impact-heavy` | `132-eff28daduanfd` | 2.1.27 | 白刺爆点、光柱 | 狙击、处决的命中主帧 |
| `ground-crater` | `054-1320122` | 3.7.93 | 暗色陨坑、冲击环、尘团、裂纹 | 绿色叶环槽位不要 |
| `ground-dust` | `084-1509122` | 3.7.93 | 侧向尘云、地裂线 `dilie1/2`、碎石 `suishi_s` | 尘云左右镜像可用作冲刺起止尘 |

导出方式沿用 `tools/spine-hit-export/`（`node tools/spine-hit-export/serve.mjs`，在**可见面板**打开 export.html），产物放 `assets/skill-fx/combat-library-source/<id>/`，扩展 `tools/build-combat-hit-fx.mjs`（或同目录新建 `build-combat-physical-fx.mjs`）生成帧表与 manifest，记录库目录、动画名、原文件和帧表哈希，格式与 `combat-hit-fx.json` 一致。

**2.1 版本问题**：export.html 用的是 `spine36.js`，读不了 2.1.27 的 JSON。默认做法：在 export.html 里加一个 2.1→3.x 的 JSON 转换（`skinnedmesh` 转带权重的 `mesh`、`ffd` 转 `deform`、补齐 3.x 必需字段），转换后在面板里与原图集逐帧目视比对。转换失败的套件改用「图集区域序列」模式：按 2.1 JSON 中槽位 attachment 时间轴依次取图集区域，以 30 FPS 拼帧。两种都不行才换素材（见默认裁决 D2）。

做完要出一张接触表 `docs/reviews/physical-vfx-20261011/library-contact-sheet.png`。

## 4. 通用模块（P2、P3）

### 4.1 刀光层 WeaponSmear（替换钢系细丝带）

- 位置：`combat-vfx.ts` 的 slash / spin / dash 分支。物理技能不再画 `arcPoints` 丝带；元素系的冰、雷、毒保留少量丝带作为点缀，但宽度 ≥ 6px。
- 贴图：按技能取第 3 节的 `blade-*` / `claw-triple` 片段，锚在武器挂点（`wardrobe-renderer` 的 weapon socket）与目标方向之间。
- 方向：朝向真实目标，没有目标就朝向朝向方向；水平挥砍 `scaleY ×0.55` 压成等距。
- 时长：3–5 帧主帧加 4 帧淡出；尺寸按 `vfxProfile.size` 和真实判定半径换算，不靠肉眼放大。
- 颜色：钢系白芯 + 浅金边；元素系白芯 + `vfxPalettes[element].main` 边。

### 4.2 地面层 GroundImpact（新模块 `vfx-ground.ts`）

- 组成：陨坑贴花、地裂线、尘环、碎石、冲击环，按技能组合，见第 6 节。
- 贴地：全部按等距投影压扁，深度画在单位下方、地表上方。
- 陨坑贴花：停留 0.9 秒后线性淡出；同屏最多 6 个，超出时淘汰最旧的。
- 冲击环：从 0 扩张到真实判定半径（读 cast / zone 事件里的半径），用时 0.25 秒。
- 地裂线：沿施法方向延伸到真实判定长度。
- 碎石：每次 6–10 块，走抛物线，0.5 秒落地消失，计入 384 粒子预算。
- 资源管理：复用 `VfxPool`，屏外裁剪。

### 4.3 打击反馈（`hit-feedback.ts`）

| 项 | 现在 | 改为 |
|---|---|---|
| 震屏预算 `cameraShakePixels` | 3 | 6 |
| 震屏档位幅度 | 1.2 / 2.4 / 3.5 | 1.5 / 3 / 5（击杀首领 6） |
| 重击震动方向 | 随机 | 地面重击以竖直为主（`direction.y` 主导） |
| 敌人受击位移（纯视觉） | 6 / 11px | 轻 6、力度 2 为 10、力度 3 为 16；精英 ×0.6；首领 0 |
| 地面重击浮空 | 无 | 范围内目标额外上抛 6px 弧线，8 tick 内回原位 |
| 主角前冲（纯视觉偏移） | 无 | slash 族朝目标 8px、力度 3 为 12px，6 tick 内回位；dash 族由模拟位移负责，不另加 |
| 主角起跳 | 无 | 跃击 leap_strike、撑杆跳 pole_vault：沿释放前摇画 18px 上抛弧，落地帧对齐释放 |
| 起手闪光 | 无 | 力度 ≥ 2 的近战在武器挂点闪 1 次小火花（206 的小火花帧），力度 3 脚下加聚尘 |

停顿分档保持现有 1/2/3/4/5 帧不变。所有视觉位移都只作用于渲染坐标，不写回 World。

### 4.4 施法动作（P4）

- 现状：`scene.ts` heroCast 只用 `attack` / `skill` 两个动作，动作族取外观武器（`equipment-runtime.json` 的 animationFamily：剑→sword、锤/斧→axe、杖→magic、暗器→fist）。
- 改为按技能形状选动作：
  - 单体斩击 / 戳：`attack`；
  - 旋转、重击、跃击：`skill`；
  - 投掷、射箭：`projectile`（原长 1.13 秒，按现有 `wardrobeFrameIndex` 的方式时间扭曲，让 impactTime 对齐真实释放）。
- 杖术物理技能在外观族为 `magic` 时，施法期间临时改用 `spear` 动作族（只换动作文件，部件和武器贴图不变）。默认裁决见 D4。

## 5. 元素修正

- 土系 `areaLayer` 不再用 `hit-earth`，改为第 4.2 节的 GroundImpact 组合。
- 土系单体 `hitLayer` 改为钢系重击（`blade-streak` 火花帧或 `hit-slash`）加一小团 `ground-dust` 尘。
- `hit-earth` 只保留给怪物的土系技能。
- 改完后 `tests/vfx-hit-style.test.ts` 里「元素之间不混用」的断言同步更新，不得删除。

## 6. 逐技能规格（43 个，P5 逐条落地）

列说明：**动作**＝施法动作；**主层**＝最显眼的一层；**地面**＝4.2 组合；**受击 / 镜头**＝命中层与震屏档位（0 不震）。所有层只在真实事件上播放：`cast_started` 起手、`cast_released` 主层、`hit_resolved` 受击。

### 剑（sword 动作族）

| 技能 | 动作 | 主层 | 地面 | 受击 / 镜头 |
|---|---|---|---|---|
| cut 斩击 | attack + 前冲 8 | 1 道 `blade-streak` 斜斩，朝目标 | — | hit-slash / 0 |
| dual_strike 双刃斩 | attack + 前冲 8 | `claw-triple` 取两道，X 形，两道相隔 3 帧 | — | hit-slash ×2 / 0 |
| blade_fury 刀刃风暴 | skill | 身周 3 道 `blade-crescent`，每 4 帧旋转 120° | 尘环小 | hit-slash / 1 |
| whirl 旋风斩 | skill | `blade-crescent` 拼成整圈水平环，压扁 0.55，转 1 圈 | 尘环（半径＝判定） | hit-slash / 1 |
| rush 冲锋 | skill | 身后 3 个主角残影（alpha .35→0）+ `blade-streak` 速度线 | 起点、终点 `ground-dust` 侧尘 | hit-slash / 1 |
| execute 处决 | attack + 前冲 12 | `blade-crescent-heavy` 竖劈，着暗红 | — | `impact-heavy` + hit-blood / 2 |
| leap_strike 跃击 | skill + 起跳 18 | 落地 `blade-crescent-heavy` 下劈 | 陨坑 + 冲击环 + 碎石 8 | hit-slash / 2（竖） |
| vortex_blade 涡刃 | skill | `blade-crescent` 着奥术紫，3 圈螺旋收缩 | — | hit-arcane / 1 |
| counter_strike 反击 | attack | 格挡帧 206 火花 → 1 道 `blade-streak` | — | hit-slash / 1 |
| frost_blade 霜刃 | attack + 前冲 8 | `blade-streak` 着冰蓝 + 冰屑 | — | hit-ice-shard / 0 |
| thunder_dash 雷闪 | skill | rush 的残影改成电光色，路径上保留现有 lightning | 起止侧尘 | hit-storm / 1 |

### 锤 / 斧（axe 动作族，节奏慢、带土）

| 技能 | 动作 | 主层 | 地面 | 受击 / 镜头 |
|---|---|---|---|---|
| cleave 劈裂 | skill + 前冲 12 | `blade-crescent-heavy` 前方扇形 | **地裂线**沿施法方向到判定长度 + 碎石 6 + 尘 | 钢重击 + 尘 / 2 |
| ground_slam 裂地 | skill + 起跳 10 | 无刀光；落地瞬间白闪 1 帧 | **陨坑 + 冲击环（扩到判定半径）+ 尘环 + 碎石 10** | 钢重击 + 尘 + 浮空 / 2（竖） |
| stun_strike 震晕击 | skill | 竖砸短 `blade-crescent-heavy` | 小陨坑 + 小冲击环 | 钢重击 / 1 |
| rampage 暴走 | attack ×节奏 | `claw-triple` 着血色，3 连 | — | hit-blood / 1 |
| berserker 狂战 | skill + 前冲 12 | 两道交叉 `blade-crescent-heavy`，着血色 | 尘环小 | hit-blood + `impact-heavy` / 2 |
| war_cry 战吼 | skill | 3 道冲击环（054）着金色，依次扩张 | 尘环 | — / 1 |
| blood_rage 血怒 | skill | 自身血色气焰（保留 shield 族），不加刀光 | — | — / 0 |
| magma_slam 熔岩砸 | skill + 起跳 10 | 同裂地 | 陨坑 + 地裂线着橙 + 保留 hit-fire-big 作主层 | hit-fire / 2 |
| venom_cleave 毒刃劈 | skill | `blade-crescent-heavy` 着毒绿 | 地裂线着绿 + 现有毒雾 | hit-poison / 1 |
| frost_quake 霜震 | skill + 起跳 10 | 同裂地 | 陨坑 + 地裂线着冰蓝 + hit-ice 落点 | hit-ice / 2 |

### 杖（施法期间用 spear 动作族；钝、圆、不出刀光）

| 技能 | 动作 | 主层 | 地面 | 受击 / 镜头 |
|---|---|---|---|---|
| staff_strike 杖击 | attack + 前冲 8 | 无刀光；命中点一圈小冲击环（054 环，钢白） | — | hit-blast / 0 |
| staff_flurry 杖舞连打 | attack | 3–4 个快速小冲击环，沿目标排开 | — | hit-blast / 0 |
| staff_sweep 横扫 | skill | `blade-crescent` 低平宽弧，着土黄 | 弧形尘 | 钢重击 + 尘 / 1 |
| pole_vault 撑杆跳 | skill + 起跳 18 | — | 落地尘环 + 小冲击环 | 钢重击 / 1 |
| seismic_staff 震地杖 | skill | 杖尖落地白闪 | 5 条**地裂线**放射 + 陨坑 + 碎石 8 | 钢重击 + 浮空 / 2（竖） |
| staff_cyclone 杖轮 | skill | `blade-crescent` 环着土黄，加旋转杖影（主角武器剪影 ×3） | 尘环 | hit-blast / 1 |

### 暗器（fist 动作族；小、快、多）

| 技能 | 动作 | 主层 | 地面 | 受击 / 镜头 |
|---|---|---|---|---|
| throwing_knife 飞刀 | projectile | `knife-flight` 着钢白，飞行中自旋 | — | hit-blast 小 / 0 |
| fan_of_knives 刀扇 | projectile | `knife-flight` × 实际弹体数，扇形 | — | hit-blast 小 / 0 |
| venom_needle 毒针 | projectile | `knife-flight` 缩小 0.6 着毒绿，三连 | — | hit-poison / 0 |
| shadow_step 影步 | skill | 起点暗色 `ground-dust` 烟团 → 落点烟团 + 2 个残影 | — | hit-shadow / 0 |
| blade_flurry 刀刃乱舞 | attack | `claw-triple` 短斩，按实际命中次数逐次 | — | hit-slash / 0 |
| explosive_kunai 爆裂苦无 | projectile | `knife-flight` 插地后闪烁（按真实延迟）→ hit-fire-big | 爆点尘环 | hit-fire / 1 |
| assassinate 刺杀 | attack + 前冲 12 | 影步烟团 → `blade-crescent-heavy` 背刺竖劈，着暗红 | — | `impact-heavy` + hit-blood / 2 |
| death_lotus 死亡莲华 | skill | 8 把 `knife-flight` 绕身成环旋转后外射 | — | hit-blood / 1 |
| shadow_blade 影刃 | attack | 两道 `blade-streak` 着暗紫，前后相隔 2 帧 | — | hit-shadow / 0 |

### 弓（bow 动作族；直、长）

| 技能 | 动作 | 主层 | 地面 | 受击 / 镜头 |
|---|---|---|---|---|
| bolt 射击 | projectile | `arrow-launch` 出手闪 + `arrow-flight` | — | hit-blast / 0 |
| multi_shot 多重射击 | projectile | `arrow-flight` × 实际弹体数 | — | hit-blast / 0 |
| volley 齐射 | projectile | `arrow-flight` 两列 | — | hit-blast / 0 |
| pierce_arrow 穿透箭 | projectile | `arrow-flight` 加长拖尾 ×1.6，在每个实际命中点留一个火花 | — | hit-blast / 1 |
| snipe 狙击 | projectile | 前摇期间一条细瞄准线（唯一允许的细线，2px，跟随目标）→ 释放后 `impact-heavy` 光柱弹道 | — | `impact-heavy` + hit-crit / 2 |
| rain_of_arrows 箭雨 | projectile | 竖直 `arrow-flight` 从上方落下，插地后停留 0.4 秒 | 每支箭落点小尘 | hit-blast / 0 |
| explosive_shot 爆裂箭 | projectile | `arrow-flight` 着火色 → hit-fire-big | 尘环 | hit-fire / 1 |

箭雨目前零持续、没有伤害（见 [skill-vfx-v2.md](skill-vfx-v2.md) 机制边界），**只在真实 zone / 投射物事件上播放，不伪造命中**。

## 7. 批次（必须连续做完）

| 批次 | 内容 | 完成标准 |
|---|---|---|
| P0 | 建进度文件；画廊里 43 个技能各在释放 +0 / +3 / +8 帧定格截图作为「整改前」；记录 60 敌人 / 100 弹体负载场景的帧率 | 截图在 `docs/reviews/physical-vfx-20261011/before/`；帧率写进进度文件 |
| P1 | 第 3 节素材导出、2.1 转换、构建脚本、manifest、接触表 | 构建脚本可重复运行且哈希稳定；接触表存档 |
| P2 | 4.1 刀光层 + 4.2 地面层 + 第 5 节元素修正 | cut / whirl / ground_slam / cleave 四个样板按第 6 节呈现 |
| P3 | 4.3 打击反馈 | 减少动态模式下无震屏、无位移；69 组轨迹不变 |
| P4 | 4.4 施法动作 | 杖术施法时不再是法术姿势；投掷 / 射箭用 projectile 动作且释放帧对齐 |
| P5 | 第 6 节剩余 39 个技能逐条落地 | 每个技能对照表格自检，进度文件逐条打勾 |
| P6 | 测试、整改后截图、负载帧率复测、文档、一次完整回归 | 见第 9 节 |

**P2 做完四个样板后不需要停下来等确认**：截图放 `after-samples/`，继续做。用户最后统一试玩。

## 8. 默认裁决（遇到就照做，写进进度文件的裁决日志）

- **D1 素材不贴合**：原素材方向、颜色不对，就用运行时旋转、镜像、着色、裁剪解决；不重绘。
- **D2 2.1 套件转换失败**：先转「图集区域序列」模式。仍失败时用替代：
  - 月牙换 `combat-library-source/slash`；
  - 刀条换 `hit-slash`（083）的刀光帧；
  - 飞刀、箭换现有 `arrow` 图集。

  在进度文件里注明，继续往下做。
- **D3 预算超了**：先降碎石数量，再缩短贴花停留时间；主层、受击主帧和首领预警不降。
- **D4 换 spear 动作族后部件错位**（武器贴图偏离手、穿模）：退回外观自带的动作族，改用 4.3 的前冲 / 起跳偏移补身体感，并在进度文件里记录。
- **D5 动作时间扭曲后释放帧对不上**：以模拟的 release tick 为准，压缩动作，不改前摇。
- **D6 某技能事件不足以支撑表里的设计**（例如没有命中次数）：按现有事件能表达的最大程度做，不新增或伪造事件，并在进度文件「事件缺口」里登记。
- **D7 和他人未提交改动冲突**：只做最小插入；三方比对后只提交本批文件。
- **D8 测试旧快照因表现键变化失败**：保留战斗结果比较，只把表现断言迁到新测试；不删断言凑通过。

## 9. 验收与完成定义

自动测试（新建或扩展）：

- `tests/vfx-physical.test.ts`：
  - 43 个技能各自登记了第 6 节的主层 / 地面 / 受击组合；
  - 主层片段都在 manifest 里，且来自库编号；
  - 钢系物理技能没有宽度小于 6px 的丝带（snipe 瞄准线除外）；
  - 土系不再映射 `hit-earth`；
  - 减少动态模式下震屏、视觉位移、前冲、碎石都为 0；
  - 同时触发 60 个裂地时，贴花 ≤ 6、碎石计入预算。
- `tests/vfx-hit-style.test.ts`、`tests/hit-feedback.test.ts` 按新档位更新。
- `tests/vfx-v2.test.ts` 69 组轨迹逐字不变。

可见浏览器：

- 43 个技能整改后在 +0 / +3 / +8 帧的截图，放 `after/`；
- 一张前后对比拼图 `before-after.png`；
- 负载场景帧率不低于整改前的 90%。

文档：

- 更新 [skill-vfx-hit-layers.md](skill-vfx-hit-layers.md)（土系映射、新片段、打击反馈档位）；
- 在 `../AGENTS.md` 加一条 2026-10-11 的物理技能表现说明。

完成定义（全部打勾才算完）：

- [ ] P0–P6 每批完成，进度文件有裁决日志和改动文件清单
- [ ] 43 个技能逐条自检通过
- [ ] 上述测试通过，完整回归跑一次并记录结果
- [ ] 前后截图与负载帧率存档
- [ ] 没有改动模拟、服务端、数值和时序

## 10. 窄阻塞清单（只有这些情况可以停下来问用户）

1. 画廊页面无法启动或无法渲染，且原因不在本任务改动范围内（例如其他会话把共享构建弄坏，最小修复也做不到）。
2. 特效库目录不可读。

其他情况一律按第 8 节处理并继续。

## 关键文件

- 表现：
  - `apps/web/src/combat-vfx.ts`（drawFlash 各族分支）
  - `apps/web/src/skill-effects.ts`
  - `apps/web/src/vfx-profiles.ts`（技能行与预算）
  - `apps/web/src/vfx-hit-style.ts`（受击映射，唯一来源）
  - `apps/web/src/hit-feedback.ts`（停顿、位移、震屏）
- 动作：
  - `apps/web/src/scene.ts`（heroCast、`wardrobeFrameIndex`）
  - `apps/web/src/wardrobe-renderer.ts`（武器挂点）
  - `apps/web/public/art/wardrobe/manifest.json`（动作族）
- 素材管线：
  - `tools/spine-hit-export/`
  - `tools/build-combat-hit-fx.mjs`
  - `packages/asset-manifest/combat-hit-fx.json`
  - `assets/skill-fx/combat-library-source/`
- 画廊：`apps/web/combat-art-qa.html`（只进 QA 构建）
- 武器与技能对应：`packages/content/skill-weapons.ts`
