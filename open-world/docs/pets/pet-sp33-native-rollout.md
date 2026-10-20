# 宠物全量改用 SP33 原生生物（PA6，2026-10-18）

负责：GPT 全部负责（选型、导出工具、导出、打包、替换、自检、验收图）。Claude 只做最后的动作映射抽查和游戏接入。

## 0. 背景与已定裁决

- 前几轮「库素材重画」都被用户否掉：平涂矢量粗糙、SVG 厚涂怪诞、A7 龙像虫子。
- 2026-10-18 用户确认：重氪龙 岚鳞 改用 SP33 魔兽风二头身库的 `julongzisi`，原生骨骼、原生画面、原生动作，**只替换美术资源**。效果通过，作为本轮样板。
- 用户裁定：
  - **零氪、轻氪、重氪全部换成 SP33 原生生物**，6 岛 × 3 氪度 = 18 个家族。
  - **9 套皮肤（职业 × 流派）同色**，只靠挂件区分；色板不再改底图颜色。
  - 由 GPT 全部负责。
- 不变的东西：
  - 162 套皮肤的 id、名称、岛屿/职业/氪度/流派。
  - `skins.json` 的挂件与特效。
  - v3 运行格式与合成器 `preview/composer.js`。
  - 强度比 60:100:130（与美术无关）。

## 1. 执行方式（强制）

1. 从第 1 批做到第 6 批，**中途不提问、不停下等确认**。每批做完就更新进度文件，然后直接进入下一批。
2. 只允许两种结束状态：
   - **全部完成**：完成定义（第 8 节）全部打勾。
   - **硬阻塞**：其余能做的都已做完，只剩阻塞项；在进度文件写清阻塞点和已尝试的办法。
3. 遇到第 6 节默认裁决表能覆盖的歧义，按表执行，并记入决策日志，不停下。
4. 进度文件：`docs/pets/pa6-progress.md`。
   - 每批开头写「开始」，结尾写「完成 + 产出路径 + 自检数字」。
   - 中断后从进度文件最后一个未完成批次继续。
   - 决策日志也写在这里。
5. 机器负载：同一时间只跑一个重任务（导出、打包、全量自检不并行）。
   - **禁止无头浏览器**（swiftshader 会占满 CPU）。
   - 导出必须用有界面的浏览器（硬件 GL），例如 Playwright `headless:false` 或手动打开页面，逐只串行。

## 2. 样板（必读，直接复用）

样板目录：`.design/pet-dragon-claude-20261018/`

| 文件 | 作用 |
|---|---|
| `export.html` | Spine 3.6 硬件渲染导出：按宠物五动作取原生动作，隐藏阴影/特效插槽，算统一缩放与锚点，逐帧 PNG + 挂点 POST 到本地服务 |
| `export-server.mjs` | 静态服务 + `POST /save` 落盘到 `export/` |
| `pack-heavy.mjs` | 帧裁边去重、装箱、原色直出材质码本（a=255 条目，超 16 位索引时逐级降精度）、写 sockets/profile、改两份 manifest、首次运行先备份 |
| `sp33.html` | 与巡猎兽、主角同排对比预览 |
| `sp33/spine-webgl.js`、`sp33/binary.js` | 3.6 运行时（来源 `tools/vendor/spine36/`，`SkeletonBinary.ts` 用 typescript 转译） |

Spine 3.6 要点（样板里已踩过的坑）：

- 没有 `Skeleton.scaleX`：缩放放在根骨骼（`scaleX/Y`、`x/y`），镜像用 `sk.flipX`。
- 动作应用：`anim.apply(sk,0,t,false,[],1,spine.MixPose.setup,spine.MixDirection.mixIn)`。
- 导出前 `gl.pixelStorei(UNPACK_PREMULTIPLY_ALPHA_WEBGL,true)` 再建 `GLTexture`，`drawSkeleton(sk,true)`。否则 alpha 写成 a²，边缘出亮边/绿边。
- `OrthoCamera.zoom` = 每像素世界单位。

## 3. 批次

### 第 1 批：通用化工具

- 把样板改成配置驱动：`tools/pets/sp33/`（或 `.design/pet-sp33-rollout/tools/`，二选一，写入决策日志）。
- 一个 `families.json` 配置描述 18 个家族，每项字段：
  - 宠物 id 前缀、生物路径、动作映射、隐藏插槽正则；
  - 挂点定义（插槽名 + 偏移）、氪度、尺寸阶梯。
- `export.html` 读 `?family=` 参数导出单只；打包脚本按 family 打包。
- 用新工具重跑 岚鳞，产物与现有 `ss-pet-dragon-heavy-*` 对比：帧数一致、挂点误差 ≤ 0.5px、全量自检通过。

### 第 2 批：选型（18 个家族）

- 来源：`G:/webgame/abyss-walker-migration/source-assets/SP33 魔兽风二头身SPINE/spine/`
  - 八个子目录：an/di/feng/god/guang/huo/shui/effect；`effect` 不选。
  - `_1` 结尾的是同生物的另一版本，可作同家族候选。
- **排除**（已被游戏占用）：
  - `assets/actors/` 下的所有生物（chailangren、chilongwang、deluyizhanglao、dijinglieshou、dijingyaoshi、duyanjuren、huoqiang、kuloufashi、kulouweishi、samannvwu、wushi、xiaolang）；
  - 龙眠重氪已用的 `julongzisi`。
- 只选**生物**（兽、龙、鸟、元素精灵、小怪物），不选人形战士或法师。
- 18 个家族互不重复。
- 必须有这五个原生动作或近似动作：Idle、Movement/Run/Walk、Attack1、BeAttacked；Celebrate 可缺（见默认裁决）。
- 岛屿主题：
  - 风栖：风、草原、羽；
  - 雾铃：沼、苔、雾；
  - 赤炉：火、矿、金属；
  - 霜镜：冰、雪、水晶；
  - 龙眠：龙；
  - 沉星：星、夜、光。
- 氪度阶梯：

| | 零氪 | 轻氪 | 重氪 |
|---|---|---|---|
| 体型印象 | 小、圆、可爱，无威胁感 | 中等，有一两个亮点结构（角、尾、鳍） | 大、帅：翼、角、华丽结构，读起来像「坐骑级」 |
| 显示高度（幼/成/觉醒） | 44 / 56 / 68 | 48 / 62 / 74 | 54 / 70 / 84 |

- 同岛三档放在一起时，一眼能分出档次。
- 产出：
  - 每岛一张候选总览图（每档 2–3 个候选，与巡猎兽、主角同排，1× 和 2×）；
  - 选定表（家族 → 生物 → 理由），写进进度文件。
- 选型由 GPT 按本节规则直接定，不等用户。用户在最终验收时可以点名换某个生物，工具配置化后重跑成本低。

### 第 3 批：动作映射与特效隐藏

- 映射规则：
  - idle → Idle（循环）
  - idle2 → Celebrate
  - move → Movement（循环）
  - attack → Attack1
  - knock → BeAttacked
- 隐藏规则：
  - 隐藏原生地面阴影，以及动作里嵌入的特效插槽（雾气、电光、蓄力、大招、口水、闪光等）。
  - 本体发光部位（眼睛、角光、体纹）保留。
- 每只出一张逐帧抽查图：五动作各取 6 帧，带挂点圆点。
- 逐只记录隐藏正则和保留的发光插槽。

### 第 4 批：导出与打包（17 个家族，岚鳞在第 1 批已重跑）

- 导出流程与 岚鳞 一致：
  - 24fps，原生时长，循环动作 `round(d·24)` 帧，非循环 `floor(d·24)+1` 帧；
  - 全动作统一缩放，Idle 第 0 帧包围盒高度 = displayHeight 基准；
  - 根骨 = 地面，飞行生物保留原生离地高度。
- 打包按样板格式写入 `apps/web/public/art/starsea/pets/v3/<id>/`：
  - 文件：actor.webp、actor.json、regions.webp、materials.bin、sockets.json、profile.json；
  - 更新两份 manifest：`assets/starsea/pets/v3/manifest.json` 和 `apps/web/public/art/starsea/pets/v3/manifest.json`。
- **体积**：同一家族三形态共用一套帧。
  - 资源只放一份（例如 `v3/<family-id>/`），三个形态的 runtime 里 image/atlas/sockets/materials 指向同一份，只有 displayHeight、scale、displayBounds 不同。
  - 岚鳞 现在是三份拷贝，一并改成共用。
  - 目标：整个 `pets/v3` ≤ 50MB；超出时按默认裁决表处理。
- `skins.json`：
  - 每套皮肤的 `family` 字段改成新生物名；
  - `palette` 保留，但不再参与底图改色；
  - 挂件 offset 按新挂点重新核对，不得遮脸。

### 第 5 批：挂件与特效核对

- 162 套皮肤 × 3 形态，逐岛出对比图，检查挂件位置：
  - 围巾在颈/胸，徽记在身体侧面，浮空晶石在头顶上方，尾饰在尾根；
  - 镜像后对称。
- 挂件面积 ≤ 本体 15%。
- 重氪常驻特效跟随挂点。

### 第 6 批：自检与验收图

- 预览页 `/art/starsea/pets/v3/preview/index.html`：
  - 静态服务根目录 `apps/web/public`，launch 配置 `web-public-static`，端口 8626；
  - 运行 `pa4.validate()`，要求 2430/2430 通过、镜像误差 0、无空帧；
  - 控制台无报错。
- 验收图（原始图只留本地 `.design/pet-sp33-rollout/`，不进 git）：
  1. 每岛一张：三档 × 三形态，与巡猎兽、主角同排，1× 和 2×；
  2. 全 162 套总览（幼年 1×）；
  3. 每只五动作逐帧抽查图。
- 预览页 UI 文案：形态下拉框里的「44/56/68」改成按氪度显示真实高度，或去掉数字。

## 4. 硬阻塞（只有这些可以停）

1. 某岛按第 2 批规则找不到 3 个不重复、动作齐全的生物（先放宽主题，仍不够才算）。
2. 导出必须用无头浏览器才能跑通（有界面浏览器整体不可用）。
3. 需要改动 v3 运行格式或 `composer.js` 的结构（只加字段不算）。
4. 需要删除或改名皮肤 id。

## 5. 禁止

- 只写文档、不出资源；少做家族或少做形态；用占位图。
- 重画、乘色调色、改骨骼几何或动作时间轴（只允许隐藏插槽）。
- 用已被游戏占用的生物；用人形生物。
- 跳过自检；把原始截图、导出帧或构建产物提交进 git。
- 并行跑多个导出或自检；用无头浏览器。
- 改动 8612/8790 正式写接口；改玩法、强度、价格配置。

## 6. 默认裁决

| 情况 | 裁决 |
|---|---|
| 生物没有 Celebrate | idle2 依次取 CastingIdle → Skill（隐藏特效后不突兀才用）→ Idle 后半段 |
| 没有 Movement | 取 Run → Walk；都没有则排除该生物 |
| 原生朝左 | nativeFacing = -1，导出不翻转 |
| `_1` 版本与原版都合适 | 选色相更贴岛屿主题的那版 |
| 颜色超过 65535 种 | 按样板逐级降精度（shift），记录 shift 值 |
| 体积超 50MB | 依次：① 三形态共用一份；② 帧格降到 192（保证 referencePixelHeight ≥ 1.3 × 最大 displayHeight）；③ 仍超则记录实际体积，不算阻塞 |
| 飞行生物离地太高，脚下空 | 保留原生离地高度，不压低 |
| 同岛三档体型差不明显 | 换生物，不靠缩放硬拉 |
| 挂件挡脸 | 移挂点偏移，不缩小本体 |
| 工具放置目录 | 默认 `tools/pets/sp33/` |

## 7. 产出清单

- 工具：配置化导出页、导出服务、打包脚本，以及 `families.json`。
- 资源：18 家族 × 3 形态 = 54 个 v3 runtime（每家族共用一份帧），两份 manifest，`skins.json`。
- 文档：进度文件（选定表、逐只隐藏正则、决策日志、自检数字、体积统计）。
- 本地验收图：放在 `.design/pet-sp33-rollout/`。

## 8. 完成定义

- [ ] 工具配置化，岚鳞 重跑与现有一致
- [ ] 18 个家族选定，互不重复，避开占用生物，表格写入进度文件
- [ ] 54 个形态（18 家族 × 3）全部是 SP33 原生帧，三档尺寸按阶梯
- [ ] 三形态共用一份资源，`pets/v3` 体积达标或已记录
- [ ] `skins.json` 的 family 字段更新，挂件核对通过
- [ ] `pa4.validate()` 2430/2430，镜像误差 0，控制台无报错
- [ ] 每岛同排对比图、162 总览、逐只五动作抽查图齐全
- [ ] 进度文件写明所有决策与最终数字
