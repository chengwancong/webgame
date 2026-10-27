# 像素画风 · 原生像素重绘（2026-10-27 PX0–PX9）

设置里的“像素画风”开关保留。开启后使用 `art-pixel/manifest.json` 中的重绘资源；关闭后恢复原图片、图集帧、比例、原点、透明度和原有角色渲染器。

用户对实际画面的视觉验收未通过；此前 PX0–PX9 的 100% 覆盖不代表美术完成。港口 71 个条目的纠偏、免费游戏素材与 CC0 的授权区别、尚未改好的对象见 [港口纠偏记录](hub-portal-rework-20261021/handoff/pixel-harbor-art-correction-20261027.md)。

第 1、2 轮把厚涂原图缩格、学习颜色、再放大，用户判定不算像素画。这两轮的运行时自动像素化与相机采样滤镜已退役；`pixel-art.ts` 已删除，`pixel-texture.ts` 只保留开关状态广播。旧版实机记录不作为本轮验收证据。

## 硬规格与资源

- 舞台 1280×720；世界画到 640×360 RenderTexture，以最近邻 ×2 显示。文字保留独立相机。
- 主色板为 `packages/asset-manifest/pixel-palette.json` 的 60 色，公开副本在 `art-pixel/palette.json`。全透明/不透明；脚下阴影唯一使用指定色和 128 alpha。
- 人形原生 48px，64×64 画格；精英从整数坐标配方重新光栅化，不放大成品。首领使用独立大画格。地表统一 16×16、N1/E2/S4/W8 Wang 图块；图标独立绘制 32/16 两档。
- 只画右朝向，左朝向镜像。动作使用原 motion/profile 的总时长、命中时刻和阶段窗口；挂点保留 feet/chest/hand/weapon/muzzle。
- 原画素材未改、未删。对话头像保留原风格。中文像素字体未下载；候选与协议列在进度文件。

## 接入

| 入口 | 责任 |
|---|---|
| `pixel-assets.ts` | 读取 manifest；按资源键、原路径、图集帧查找；图片异步解码与共享缓存 |
| `pixel-actor.ts` / `pixel-actor-view.ts` | 整帧绘制、分层换色、动作时钟、命中帧、镜像挂点 |
| `hero-appearance.ts` / `wardrobe-renderer.ts` | 世界与换装预览的像素角色分支；关闭后恢复原生/部件渲染 |
| `starsea-runtime-assets.ts` / `pixel-world-assets.ts` | 原生角色、旧图集、物件和特效的像素替换及精确还原 |
| `pixel-terrain.ts` / `pixel-ground.ts` | 原图仅供地形分类；沿用原道路/岸线/墙体几何掩膜，输出色彩全部来自重画图块。手工裁决在 `pixel-terrain.json` |
| `pixel-world-target.ts` / `pixel-mode.ts` | 固定原生世界画布、文字相机、关闭清理；旧 size 值兼容读取，实际倍率固定 ×2 |
| `pixel-images.ts` | 现有 DOM 图片、HUD/HEX/工具图标和 UI 图集的开关替换；保存并恢复原 src、尺寸、样式 |
| `hub/pet-follower.ts` / `hub/pet-portrait.ts` | 54 个 SP33 形态与面板图像；跟随者沿用原动画播放窗口 |

## 生产与校验

可用生成图做草稿，必须先经过本机 `proper-pixel-art` 对齐网格并量化主色板；草稿不进入 manifest。最终素材由原生整数像素配方绘制，辨识度不足的图标和石质地表改用 CC0 像素素材加工。7Soul1 的 496 图标包裁掉原生 32px 外的透明边框，统一主色板并清理 16px 细节；Kenney Tiny Dungeon 的原生 16px 石砖/土地图块重建 Wang 边缘。原游戏厚涂图不作为压块成品。来源、包哈希和逐键绑定在 `packages/asset-manifest/pixel-open-art.json`，公开署名在 `art-pixel/open-art-credits.json`。

候选先写入 `.runtime/pixel-redraw/candidates/`，通过校验、检查联络图后，使用 `approve-candidates.mjs` 的明确键名单批准。批准脚本先验证合并清单，再复制 PNG 并原子更新 manifest，失败图不会入清单。PNG 不进 Git；提交配方、JSON、测试和小报告。

```powershell
node tools/pixel/check-pixel-art.mjs
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run tests/pixel-coverage.test.ts tests/pixel-authored.test.ts tests/pixel-mode.test.ts tests/pixel-art.test.ts tests/wardrobe-renderer.test.ts tests/hero-appearance.test.ts --maxWorkers=1 --no-file-parallelism
node --import tsx tools/pixel/write-progress.ts
```

`check-pixel-art.mjs` 检查色板、透明度、整画格、孤点、锚点，并验证哈希、角色逐帧挂点、帧边界、命中帧及换装色阶。`finalize.ts` 对当前盘点做严格覆盖检查，全部覆盖后才写 `complete:true` 和盘点哈希。

完整资源盘点、各批提交和 Grok 真机清单见 [重绘进度](hub-portal-rework-20261021/handoff/pixel-art-redraw-20261027-progress.md)。本轮没有运行浏览器或无头浏览器；单测和离线图片检查不冒充真机通过。

辅助特效几何也有像素分支：`pixel-vfx-graphics.ts` 用整数格填充线段、多边形与椭圆；预警、旋刃和示例技能软光不在像素模式下使用原渐变纹理，事件与范围不变。

## 云测试服

```powershell
node tools/deploy-staging.mjs --remote-web --dry-run
node tools/deploy-staging.mjs --remote-web
```

`--remote-web` 在云端从已提交源码隔离构建；原静态资源保留，另按 manifest 的明确白名单上传 `art-pixel` 图片、色板和地形映射，校验文件哈希后覆盖到候选发布目录。未提交或未达到 100% 的像素清单不能发布。口令只留部署凭据文件，不进入文档、日志或链接。
