# 裂星远航 · 场景与环境资源

设计版本 `starsea-20261003-d1`，生产版本 `starsea-20261003-scenes-v1`，制作所有者 `scene_art`，制作日期 2026-10-04。局部生产者状态与主代理独立验收分开记录。

## 完整交付

41个需求ID：13张可消费资源地图＋28组环境资源。包含8组地表/道路、13组透明摆件/建筑、1张独立远景和6种环境循环。12张新原图包括飞艇、栈桥、岛缘、邮站、工坊、观测站、前哨、誓约庭、龙骨支架、星潮海远景、赤炉地表及冻舰残骸变体；其余优先复用已验证 `environment-handdrawn-20261003-v2`，共用地表通过运行材质区分，不重复计算原图数。

源 PNG 与内置 imagegen 提示词在 `sources/` 与 `generation.json`。导入仅做透明边界裁切、等比缩放、留边与现有图集区域提取；既有原始 PNG 保留。模型、摆放数量和内容ID各自统计。没有把岛屿整幅图当成导航地图。

运行文件集中在 `apps/web/public/art/starsea/scenes/`，主/运行目录各有一份 `manifest.json`。公共目录索引和全局生产构建由 `props_integration` 唯一接入；本组生成器只写本组目录。

## 构建与自检

从 `open-world` 根目录运行：

```powershell
node assets/starsea/scenes/export.mjs
node assets/starsea/scenes/verify.mjs
node assets/starsea/scenes/capture.mjs
node assets/starsea/scenes/serve.mjs 8636
```

预览入口 `/art/starsea/scenes/preview/index.html`。可切13地图、全图/原比例局部、导航叠层、暂停、拖动与滚轮缩放。演员为真实怪物移动图集，用于足点与遮挡检查；NPC与原生首领统一接入由公共预览所有者验证。既有旧地图、主线、状态、数值、版本和存档未由本组修改。

## 接入契约

- 地表/摆件/远景 `runtime.kind=prop`：`file / anchor / displayWidth / displayHeight / states / variants`。变体可独立文件、镜像或缩放。停泊飞艇与冻舰残骸是两张实际不同原图。
- 地表 `sampling=mirrored-repeat`，`tileSize` 为屏幕世界纹理周期，导航单位仍32px；相邻镜像采样共享边缘，避免源边缘差。主题材质 `tint`、港口奶白洗色 `wash` 明确登记，源PNG不改写。原图大小不当作地图格子大小。
- 地图 `runtime.kind=map`，`file` 指向JSON。提供冻结的 `id / width / height / cellPixels / projection / theme / groundResource / safe / roads / obstacles / landmarks / spawns`，额外 `decorations / ambient / boundary / backdropResource` 可直接消费。障碍矩形与地标锚点完全沿用d1；3格道路按一格扩张碰撞求路。安全港和准备区禁止自动追击敌人。
- `spawns` 保留 `artId / ruleReference / level / rank / position / aggroPolicy`，引用现有模板和指定等级。它们是资源预览摆放，新ss地图尚未加入旧地区列表；外观不更换战斗规则。
- 环境 `runtime.kind=effect`，JSON声明 `clips / fragments / mode / timeline / mount / geometry / count / duration / velocity / alpha / tint`。星潮与落雪是原素材静态部件＋程序粒子；薄雾/蒸汽/界隙/节点使用经验证的原生层时间线适配，加明确环境循环。它们不能称整套原作Spine还原，也不决定碰撞或战斗范围。
- 模块 `/art/starsea/scenes/preview/renderer.js` 导出 `SceneRenderer(canvas, manifest)`，`await loadMap(map)`、`render(seconds)`、`fit()`、`focus(x,y,zoom)` 可直接用于统一预览；地表、道路、装饰、演员、环境独立，深度由足点决定。

## 来源与验收证据

所有资源 `source.sha256 / files[].sha256` 均可查。环境原件来自用户授权的300套Spine库（033烟团、209云层、220法阵），原始包复制进本组 `sources/ambient/`；另有已登记 `telegraph-reuse/tip-glow` 和 `effects/skill-source` 冰晶区域。各环境配置记录采用层、原版本、导出帧和循环方式。

`evidence/navigation.json` 记录13地图可达与碰撞对照；`evidence/verification.json` 记录41项源/运行文件校验、13图导航与安全区、8组连接像素、6循环五时刻真实栅格变化、真实Chrome零错误。全图、原比例局部、地表重复和环境截图分别保存；`evidence/dynamic/` 保存实际连续浏览器播放视频与记录。

生产者复验通过仅说明资源可加载与组内导航/动态行为正确。公共构建、真实账号恢复、原存档保留及新主线战斗/交互执行能力由集成代理和主代理独立验收；不得据此宣称主线已经可通关。
