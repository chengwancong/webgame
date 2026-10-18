# 裂星远航 · 30项怪物/首领技能资源

制作代理 `monster_vfx`，冻结需求 `starsea-20261003-d1`，资源版本 `starsea-20261003-vfx-v1`。本组交付源、运行资源、表现配置与自检，正式验收由主代理记录。资源不能代替新怪物规则绑定或六章主线完成。

## 资源与来源

- 30个需求ID完全保留，未新增第31个技能。`manifest.json` 可直接消费；逐ID配置输出到 `/art/starsea/vfx/effects/<id>.json`。
- 优先核验用户指定的300套库，保留30个候选的原始JSON、Atlas、PNG和哈希。27个独立原生层导出保留Bezier/stepped曲线、逐帧附件与透明度，用30 FPS共同画布导出。原生版本2.1.27/3.7.93、采用slot、过滤文字/夸张速度线、原始帧数和调整见 `source/inventory.json`、`source/clips.json` 与 `evidence/*-native.json`。
- 此包的序列是**原生层适配**。过滤部分slot、层合成、效果截段与运行时调色均有记录；不宣称整套原作Spine、外围场景或原游戏像素还原。未经完整依赖验证的APK粒子未引入。
- 实体箭刃复用300库157的 `j40004` 原始部件，透明裁边后由执行器位置独立运动；它是明确的静态实体部件，不冒充Spine完整动画。实体层 `source-over`，蓝白调色仅在运行时；装饰尾迹独立播放。
- 铜夹晶核复用首领组已生成的可拆卸部件，使用 imagegen 仅将中央青蓝能源适配为紫晶并保留铜、灰紫主体；2份原图保存在 `source/projectile-parts/`。提示词、原始输入、哈希及技术裁边/缩放写入组件来源。不会改写首领主体。
- B3蒸汽采用300库033的 `Smoke` 实际附件/alpha轨迹：28帧、30 FPS、0.9秒。两个半周期错开的实例用于连续排气；只是一条 `ss-fx-b03-flame.secondaryClips.phase_exhaust`，挂**实际 `ss_exhaust` 骨**，停止事件立即销毁。

## 可复建文件与命令

`source/player/` 是播放器/预览源；`runtime/clips/` 保留已导出的完整PNG图集与描述。正常构建消费这些工程内文件和保留的紫晶图，运行时与复建不依赖Codex默认生成目录。原始库路径只用于溯源和显式重新导出；先完成NPC/怪物/首领组依赖。

在 `open-world` 根目录运行：

```powershell
node assets/starsea/vfx/tools/build.mjs
node assets/starsea/vfx/tools/verify.mjs
node assets/starsea/vfx/tools/verify-light.mjs
node assets/starsea/vfx/tools/serve.mjs 8637
```

预览路径 `/art/starsea/vfx/preview.html`。8637仅为本组临时验收进程；正式常驻托管、公共索引、版本与登录验收由第6代理处理。预览有30项、六章筛选、草地/雪地/奶白港石、镜像、移动挂点、暂停/逐帧、时间轴和B3阶段/死亡检查。

需从已授权原库重新提取时：`source-audit.mjs` → `export-native.mjs` → `build.mjs`。提取命令不安装新运行时，不生成程序绘画来替代真实素材。

## 公共集成接口

导入 `/art/starsea/vfx/renderer.mjs`：`StarSeaVfxRenderer`、`isoPoint`、`warningPolygon`、`projectedGeometry`、`contains`、`loadStarSeaVfx`。调用方提供实际冻结实例与战斗时钟；`timeline.reference` 只是有源哈希的参考，禁止用它覆盖实际参数。

```javascript
const fx = new StarSeaVfxRenderer(manifest, {
  project: navigationPoint => projectToCurrentWorldCanvas(navigationPoint)
}); // 默认危险色来自已解析的 manifest.shared.warningTokens
await fx.load([effectId]);
fx.emit({effectId, castId, sourceId, tick, type: 'cast_started',
  resolved: {windupTicks, delayTicks}, geometry, position: groundPoint});
fx.advance(realCombatTick, {paused: visualClockPaused});
fx.draw(ctx, {sockets: realActorSocket, facing: actualFacing, layer: 'ground'});
drawActors();
fx.draw(ctx, {sockets: realActorSocket, facing: actualFacing, layer: 'front'});
```

- `position` 是导航坐标；`geometry` 的圆半径/束流半宽/长度也是导航单位，投影固定 `(32,18)`。圆先在导航空间采样再投影，束流长度使用实例实际 `reach`，不是鼠标距离。缺失几何报诊断，不用贴图边缘或默认半径制造判定。
- `sockets(actorId,name)` 返回**当前世界画布像素点**。MiniNativePreview的 `socket` / `boneSocket` 已变换scale/ground/mirror，直接使用，禁止二次缩放或固定抬高。Atlas按其逐帧socket、共同anchor、scale与朝向变换。
- `projectile_spawned / projectile_snapshot / projectile_ended` 提供独立 `projectileId、position、direction`；允许 `screenPosition` 直接消费已计算的真实视觉位置。离开发射点后不再追随手/武器。`hit_resolved` 提供真实接触点，可提供其 `screenPosition`；状态挂目标真实chest。
- `effect_activated` 需要真实 `durationTicks` 与固定落点；`effect_ended` 清理持续段。`effect_armed` 表示陷阱已放置但仍在等待，不产生命中；`summon_appeared` 是实际实体显现反馈，不是伤害。
- `cast_failed / interrupted` 停预摇与主体，独立播放中断片段。`death` 立即停附着效果与B3蒸汽；已经释放的弹体/地面区域继续消费执行器真实生命周期，防止隐藏仍然有效的伤害。世界结束用 `clear()` 全部清理。
- `phase-active / phase-end / death` 对蒸汽无需castId；`sourceId` 是实际实体实例ID，`phase-active.actorTemplateId` 为 `ss-boss-core-extractor`。参考页直接用模板ID作为sourceId，真实多实例独立登记与清理。两个排气片段共用该实例的实际骨点并同时停止；进入B3活动阶段时应针对flame资源发事件，不依赖当前播放的技能。暂停使用同一战斗时钟，重播clear重置暂停状态。
- 颜色使用已解析的Warning Tokens；原始Token中的 `{Color.World.Ink}` 等别名需先解析。所有UI尺寸、字、控件取项目Tokens，浅底仍保留实体普通透明层。

## 参考演示与机制边界

共享 `/art/starsea/vfx/reference-fixtures.mjs` 导出 `buildReferenceFixture` 和 `referenceEventsAt`，公共验收页直接复用，不另复制数值/几何。传入已采样的 `launchScreen / contactScreen`，返回排序后的演出事件。

参考前摇、延迟、范围、束流宽度/80格长度来自现行 `chapter-combat.ts`；弹速 `.5`、寿命40、碰撞半径`.55`读取 `content/index.ts.aiRules`。这些只验证资源播放，预览联系点是有明确标识的样本输入，没有调用新怪物战斗执行器。普通怪图集未暴露原生释放标注时，保留原生时钟并明确记录该限制；正式接入还要验证动作释放、真实碰撞和目标完成。

- 普通近战、铳击、召援没有虚构前摇；默认冲锋是实际位移快照与延迟危险区，素材不制造另一段位移。
- B3泄焰明确引用怪物版25/15/60 tick，不擅自借用龙王75 tick定义。
- 1 tick爆发区域、beam单次触发保留机制待验证状态；纯视觉余韵不会补造持续伤害。
- 航钥锁定是60 tick前摇、放置后等待150 tick、再1 tick实际区域爆发；不会把等待期误做第二段150 tick伤害。召唤/护持不伪造 `hit_resolved` 或受击动作。
- 未修改内容源、规则、公开协议、API、服务、全局版本、公共注册或账号存档；本组没有声称新剧情可玩。

## 自检与验收证据

`evidence/verification.json`：30 ID闭包、文件SHA256、圆/束流几何、暂停/重播、死亡后独立实体保留、固定落点、B3停止及多实例隔离；30×6时刻实际浏览器播放、镜像与中断。`light-backgrounds.json`：7种实体弹在雪地/奶白港石的14例真实1280×720截图，并独立渲染实体层测对比，排除演员、预警与加法装饰影响；每例至少60个像素的亮度对比达到3:1，最小实体可见像素数107。实体普通透明层和外轮廓保持可见。

`dynamic-captures.json` 与32份WebM：30个完整1×参考周期及B3死亡/阶段结束。首次录制检查打印错误地用12 tick作为停止门槛，而实际参考取消是15 tick；逐帧数据在15 tick后蒸汽全部为0，浏览器状态检查通过，记录已按真实取消点修正。此修正是检查阈值修正，未伪造视频帧或改动生命周期。

主代理仍需独立验收；`producer-reviewed` 不是最终批准。真实新敌人绑定、主线目标、正式版本/登录与存档保留由后续集成验收完成。
