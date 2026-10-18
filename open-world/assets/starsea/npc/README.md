# 裂星远航 · NPC原生资源交付

设计版本 `starsea-20261003-d1`，资源版本 `starsea-20261003-npc-v1`。生产所有者 `npc_art`，公共集成所有者 `props_integration`，主代理负责独立验收。本包只覆盖七名友方NPC，维洛由首领组制作。

## 覆盖与来源

| ID | 姓名 | 原生衣装／发型 | 职业附件 | 显示高度 |
| --- | --- | --- | --- | --- |
| ss-npc-cheng | 港务长·澄 | cleric_common2／hairB_c9，深蓝头发使用原生slot乘色 | 航务帽、青蓝领巾、腰哨、日志册 | 100px |
| ss-npc-milo | 领航员·米洛 | archer_uncommon1／hairA_b2 | 护目镜、海蓝披肩、折叠星盘、折叠航图 | 100px |
| ss-npc-tongling | 机巧师·铜铃 | cleric_common2／hairB_c6 | 护目镜、赭色围裙、小锤、扳手 | 96px |
| ss-npc-qingmang | 邮差·青芒 | cleric_common1／hairB_b2 | 绿褐披肩、橙邮袋、叶扣、信件 | 100px |
| ss-npc-xuemi | 记录官·雪弥 | cleric_uncommon1／hairB_b8 | 靛蓝白边外衣、记录器、记录册、笔筒 | 100px |
| ss-npc-mijia | 暮界译者·弥迦 | cleric_common1／hairA_a8，原生headA及slot灰紫乘色 | 灰紫围巾、翻译石片、文件册、腰扣 | 100px |
| ss-npc-jinyu | 龙裔见证者·烬羽 | cleric_epic1／hairA_b3 | 独立角部件、鳞形肩领、铜金短杖、旧约印 | 104px |

完整主体沿用 `assets/mini-hero/navy/runtime` 的原生Spine **4.2.43**，浏览器使用现有 **spine-webgl 4.2.120**。原生四件文件的绝对路径、SHA-256、字节数列在manifest的 `nativeSourceFiles`。原始上游目录和release记录列在 `delivery`。每名角色只组合原生服装、脸与发型；原始bones、所有32段animations、IK、transform和physics保持不变。

七套职业附件使用内置 `image_gen.imagegen` 制作；每套保存原始透明PNG和完整提示词JSON，共28个独立部件。导入只做象限裁切、alpha边界留边、等比缩放及PMA图集打包。没有程序重画主体。姿态几何仍由原始加权mesh与约束系统执行。

不同身体衣装仍保留原生轮廓，新增围裙、披肩、外衣、角和工具形成职业差异；不宣称已重建新的身体骨架或面部表情系统。

## 运行接口

局部资源登记为 `manifest.json`。每个条目的 `runtime` 提供 `profile`、`displayHeight`、`renderAppearance`、`bodySetId`、`family`、`storyAdapter`、`accessorySockets` 和透明 `portrait`。

公共集成可以直接调用现有 `MiniNativePreview`：

```ts
const item = manifest.assets.find(a => a.id === npcId)!;
const painter = new MiniNativePreview(canvas, {
  profileUrl: item.runtime.profile,
  height: item.runtime.displayHeight,
  footX: 0.5,
  footY: 0.8,
});
await painter.setAppearance(item.runtime.renderAppearance);
painter.render({
  action: item.runtime.storyAdapter[storyAction],
  clock: storyClock,
  facing: -1,
});
```

`400105` 是本NPC profile的现有appearance兼容路由ID。全部六个body slots及weapon均使用已明确接受的同一ID，衣装实际来自profile列出的原生skin；没有修改玩家服装选择或战斗家族规则。

**职业附件已在每名Character.json内作为原生RegionAttachment和skin注册，读取profile就会显示，集成不需要叠加额外Canvas工具。** 图集共用两张原生纹理页和一张512×896职业附件页。新增附件的PMA与原生页一致。保留(−0.25,0)原始脚底，左右朝向围绕同一脚底镜像。肩部跟随spine2，帽与角跟随head，腰部跟随pelvis，工具跟随RIGHTHAND／LEFTHAND。

`accessorySockets` 明确各slot的真实bone、source region、局部矩阵、手持物imageSize与握持像素；握点已验证落在实际alpha内。挂点消费者继续使用原生 `painter.socket()` / `painter.bonePose()`；禁止固定屏幕偏移替代。

| 叙事状态 | 原生clip | 时长 | 现有renderer动作 |
| --- | --- | --- | --- |
| idle | Wait1 | 2.000s | idle |
| move | Walk1 | 0.800s | move |
| talk | Cast2 | 2.000s | attack |
| read | Life_Crafting | 0.667s | skill |
| repair | Life_Crafting | 0.667s | skill |
| point | Spell1 | 1.000s | projectile |
| hurt | Damage1 | 见manifest的原生duration | hurt |
| death | Die | 见manifest的原生duration | death |

talk使用完整原生肢体交谈手势，不是口型动画；read使用制作姿势承载检查记录的表现，不声称提供翻页动画。point使用无特效的原生手部手势，不新增战斗技能。hurt/death仅提供renderer兼容表现，不声明友方战斗AI。各profile的storyActions记录精确时长、60fps采样和loop；read/repair共用clip，不能按两套新动画计数。

头像由完整原生rig渲染后摄像机裁切，保留帽、角和职业领饰。**不要调用原有drawPortrait替代本包头像**，该函数会过滤掉STARSEA自定义skin。头像源与导出都保存256×256透明PNG，导出参数与native诊断在 `evidence/portrait-export.json`。

## 构建与预览

在open-world根目录运行：

```powershell
node assets/starsea/npc/scripts/build-npcs.mjs
node assets/starsea/npc/scripts/build-preview.mjs
node assets/starsea/npc/scripts/verify-npcs.mjs
```

需要刷新原生头像时，在本组预览可访问后执行 `export-portraits.mjs`，随后再运行build-npcs与verify-npcs。构建仅使用本工程已保存的源文件，不依赖Codex生成图片缓存。所有输出仅写本组源/发布目录，不写公共登记、主入口、package.json、版本或数据库。

预览：`http://127.0.0.1:8612/art/starsea/npc/preview/index.html`。独立ES module及Token样式已打包，发布目录中的index.html可以由正式静态服务托管。1280×720预览canvas buffer与CSS均220×220，角色按100／96／104px显示，4＋3排同时展示。按钮支持八状态、镜像、暂停与继续；footer使用真实播放状态。暂停文字和行为须一并沿用到公共验收页。

`window.starseaNpc.inspect()` 返回实际native clip、sourceTime、source帧、skins、原生脚底与骨骼挂点、错误和就绪状态。`setAction`、`setFacing`、`setPaused`、`seek`可复现指定动作与时间；`capturePortrait`用于完整rig头像导出。

## 自检与验收证据

- `evidence/self-review.json`：7个需求ID、全部源/运行哈希、原生几何与动画完全一致、握点alpha、1:1显示、八动作各16时间点、边界无裁切、全部挂点镜像、真实时钟与暂停检查。
- `evidence/npc-native-dynamic-1280x720.webm`：实际浏览器连续播放，含原生动作、双朝向及工具随手。
- `evidence/npc-<state>-1to1-1280x720.png` 与对应 `mirrored` PNG：八状态、双朝向实际截图。
- `source/selection.json`、`source/accessories.json`、`source/accessory-regions.json`：skin、调色、附件层序与矩阵、技术裁切与打包来源。

制作自检通过后manifest状态为 `producer-reviewed`。主代理独立验收仍由其台账记录，本组不会自行标记root accepted。

资源已就绪；新主线任务执行、NPC跟随/战斗AI、真实登录、版本兼容与存档检查由公共集成及主代理在后续验收完成。SwiftShader检查证明资源加载与原生动态可播放，硬件GPU性能不在本组报告内。
