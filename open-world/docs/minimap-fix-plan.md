# 小地图修正方案（交给执行方）

工作目录：`abyss-walker-rewrite/open-world`。只改小地图/区域全图相关代码，不动战斗、存档、任务、其他 HUD 样式。

## 一、问题根因（已核对源码）

1. **投影不一致（主因）**
   - 场景是等距（斜 45°）投影：`apps/web/src/scene.ts:36` `project = p => ({x:(p.x-p.y)*32, y:(p.x+p.y)*18})`，`starsea-world-renderer.ts:5` 同一公式。
   - 小地图 `apps/web/src/ui/minimap.ts` 是俯视正交：`x = px + p.x*scale, y = py + p.y*scale`。
   - 结果：屏幕上往"上"走（世界 -x,-y），小地图上角色是往"左上斜"走；地图在场景里是菱形，小地图里是正方形；入口/敌人在屏幕右边，小地图上却在右下或上方。整体方向错了 45° 且纵向没压扁。

2. **星海地图（`presentationKey` 以 `ss-map-` 开头）数据源不一致**
   - 场景用 `StarseaWorldRenderer` 读取封存地图 JSON（`StarseaMap.roads / decorations / landmarks`）来画路和装饰。
   - 小地图仍画 `region.obstacles` + `mapRoads(region)`（寻路生成的"道路"）+ `region.landmarks`。所以星海地图上小地图的路、建筑、地标和画面看到的完全对不上。

3. **假地形**：`minimap.ts` 里 12 个按公式生成的椭圆"色块"、以及把地面贴图直接拉伸铺满矩形，都与真实地面无关，会误导。

4. **角色箭头永远朝上**，而 `hero.facing` 只有 ±1（左右），并不是真实朝向。

5. **全图比例**：`minimap.css` 中 `#region-map-canvas{aspect-ratio:1}` 且画布是正方形；改成等距后地图外接框是 `(W+H)*32 × (W+H)*18`，不是正方形。

（`hud-clean-preview.ts` / `hud-controls-review.ts` 的"复制雷达画布当全图"属于预览页，不是正式入口，可不处理。）

## 二、修正方案

### 1. 统一投影：小地图直接复用场景投影
- 在 `minimap.ts` 引入与场景一致的投影（建议把 `project` 抽到一个无 Phaser 依赖的小模块，如 `apps/web/src/iso.ts`，`scene.ts`、`starsea-world-renderer.ts`、`starsea-vfx-layout.ts`、`minimap.ts` 共用，避免再次分叉）。
- 小地图坐标 = `project(世界点)` 乘缩放 `k` 再平移：
  - 雷达：`center = project(hero)`；`screen = size/2 + (project(p) - center) * k`。`k` 由"视野半径 R 格"决定：`k = (size/2 - padding) / (R * 32 * √2 ... )`，按实际想看到的范围定，建议让半径 12 格在横向刚好填满圆。
  - 全图：取四个角 `(0,0)(W,0)(0,H)(W,H)` 投影后的外接框，等比适配到画布，居中。
- 地形/道路/障碍物可以用 canvas 矩阵一次性完成等距变换，然后直接用世界坐标绘制：
  `ctx.setTransform(d*k*32, d*k*18, -d*k*32, d*k*18, tx, ty)`（d = 像素密度，tx/ty 为平移）。
  注意此变换下 `lineWidth` 也被缩放，道路宽度改为用世界单位，或先把点转换后再在单位矩阵下描线。
- 标记（角色、敌人、NPC、入口）在**恢复单位矩阵后**用投影后的点画，保证图标不被斜切。
- 区域边界画成菱形（四角投影后连线）并 clip，边界外显示底色。
- "N" 标记：等距下"屏幕上方"不是世界北。建议把顶部标识改成不带方位含义的样式，或直接去掉；文档 `docs/minimap.md` 同步更新"固定北向"的说法。

### 2. 星海地图使用同一份地图数据
- 当 `region.presentationKey?.startsWith('ss-map-')` 时，小地图通过 `loadStarseaMap(id)`（`starsea-world-renderer.ts` 已导出）异步加载并按 id 缓存；加载完成前只画底色+角色+敌人，不要画旧的 `mapRoads`。
- 道路：遍历 `map.roads[].points`，按 `widthCells` 画成格子带（与 `StarseaWorldRenderer.chunk` 中按格子展开道路的逻辑一致），颜色用 `Color.Minimap.Road`。
- 地标：用 `map.landmarks`（id → 位置），结合 `starseaPortObjects` 已有的 NPC 映射；入口/首领仍用 `region.portal / bossPortal`。
- 装饰：只画 `occlusion==='foreground'` 或体积大的建筑类装饰为小色块，`depthMode==='ground'` 的地面贴花不画。
- 先确认 `map.width/height` 与 `region.width/height` 一致；若不一致，以 `region` 为准换算并在控制台报错。

### 3. 去掉假地形
- 删除 12 个椭圆色块循环。
- 地面：只填 `Color.Minimap.Terrain` 纯色菱形；如果要保留贴图，必须在等距矩阵下绘制（与场景一致），不要再拉伸成矩形。

### 4. 角色标记
- 改成"圆点+外圈"，不再画固定朝上的箭头。
- 如需方向：用连续两帧 `hero.position` 的位移经 `project` 后求角度，静止时保留上次角度；不要用 `facing`。

### 5. 全图面板
- `#region-map-canvas` 去掉 `aspect-ratio:1`，按外接框比例设置画布宽高（例如宽 320，高 = 320 × 外接框高/宽，再乘密度）。
- 图例保持现有项。

### 6. 像素密度
- `density` 从固定 2 改为 `Math.min(3, Math.ceil(devicePixelRatio || 1))`，画布 CSS 尺寸不变。

## 三、验收

单元测试（更新 `tests/hud-art-layout.test.ts`，原有正交投影断言需改写）：
1. 雷达：角色始终在圆心。
2. 世界移动 `(-1,-1)`（屏幕正上方）→ 其他标记在小地图上**只做纵向移动，x 不变**；世界移动 `(+1,-1)`（屏幕正右）→ 标记只做横向移动。
3. 任意点 P：小地图上 P 相对角色的方向向量，与场景 `project(P)-project(hero)` 方向一致（夹角 < 1°），长度比恒定为 `k`。
4. 全图：四个角投影后都落在画布内边距以内；长方形地图（64×24、24×80）也满足。
5. 星海地图：给定一份 `StarseaMap` 测试数据，小地图道路格与地图 `roads` 格子一致，且不调用 `mapRoads`。

实机（按"一次只跑一个重任务"执行，不要并行跑浏览器探针和 vitest）：
- 营地：让角色站在入口正左侧，小地图入口应在角色正右侧；按住向上移动，小地图地形只上下滚动不斜移。
- 切到一个 `ss-map-*` 星海地图：小地图道路形状与画面地面道路吻合，港口三位 NPC 点位与画面一致。
- 展开全图：菱形完整、不溢出，320 宽度窄屏不横向溢出，雷达与任务条不重叠。
- 截图存 `.design/minimap-fix-<日期>/`。
