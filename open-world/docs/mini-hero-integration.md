# MiniFantasy 藏蓝角色正式接入

首次接入于客户端0.7.6，资源 `world-art-20261002-v10-mini-navy`。当前发布客户端0.7.7、协议8、规则ow-11、数据库10，实际版本以本次运行验收记录为准。初始苍风旅装/守望旅装接入已验收的藏蓝MiniFantasy角色，正式营地、战斗、HUD头像、人物页和外观预览使用同一外观解析结果；本次换皮自身不修改玩法规则或数据库结构。

## 范围与资源

身体六部位明确接受原有100011/100041，两套初始外观均更新为本次同一藏蓝皮肤。主手100011使用原单手剑，300601使用原双手剑，400105使用原法杖。每项由服务端返回的 `ResolvedAppearance` 选择；没有新增装备ID、解锁条件、伤害、费用或奖励。

2026-10-16（客户端0.11.27、协议37）起，服务端外观附带 `kit`，所有角色按装备主手与护甲走原生骨骼：七种武器各有九档衣装与武器，斧/锤用登记的扩展手绘图挂在手骨上，不替换成双手剑；技能施放播放手工编排的技能动作。对照表与挂点见[资源映射「装备套装」](mini-hero-mapping.md#装备套装客户端01127协议37)。没有 `kit` 的旧快照仍按下述三项映射，其他继续使用原分件角色。原七部位选择、收集权限、自动装备外观及存档均保留。完整对应、原图坐标、动作校准与SHA256见[资源映射](mini-hero-mapping.md)。

正式源保存在 `assets/mini-hero/navy/runtime/`，独立发布到 `apps/web/public/art/mini-hero/navy/`；原始资源和已验收皮肤包保留。构建只读取工程内正式源，无需D盘资源、Spine编辑器或实验预览服务。

## 渲染与时序

`mini-native-renderer.ts` 使用固定版本 `@esotericsoftware/spine-webgl@4.2.120` 读取真实4.2.43导出。原骨骼、网格、权重、UV、附件变换、插槽顺序、19个物理约束和32动画未修改。图集已经预乘Alpha，上传不再预乘，绘制使用PMA混合。

一套共享WebGL上下文/图集服务游戏角色、头像和预览，各实例独立骨架和物理状态。源动画按1/60步进解算，正常单调播放增量更新，动作切换、回绕或回放后退重新求姿态。相同战斗时钟不更新物理或GPU；历史帧挂点独立求解，不改变当前角色。人物高度96px，地面原点、镜像、脚下阴影和按Y排序延续原场景布局。

外观预览与人物页的整身图启用独立UI镜头约束。三武器17个去重动作按原生60Hz求取并集，四边保留8px，镜像采用对称宽度余量；所有动作/武器使用同一缩放，不随挥击放大缩小，也不裁掉举过头的剑或杖头。头像依旧只按头与头发的真实范围适配。这项画布适配不改变正式场景96px，也不改附件几何或动画。

手、胸、头挂点来自原骨骼；刀尖与法杖宝珠从完整PNG坐标经过原附件、骨骼与显示变换得到。效果与角色采用同一个映射，释放后的飞行或地面效果继续由现有战斗事件管理。原动作没有释放事件，配置的impactTime是视觉校准，映射到玩法既定前摇边界，不能改变命中判定。

`hero-appearance.ts` 在原生与旧分件路径间原子切换。完整资源解码后先验证实际首帧、非空Alpha及渲染错误，再提交；失败同步恢复画布、保留原角色，迟到请求不能覆盖新请求。头像由原骨骼的头部和头发一起渲染。

外观页切动作从源首帧播放，按真实动作时长循环。正式战斗动作按已有玩法阶段播放。战斗结束后的死亡收尾使用 `HeroDeathPlayback`，只播放原Die至1.5秒，不推进世界tick或结算；失败结果页允许播放收尾，显式暂停、隐藏和连接阻塞仍冻结，单步推进1/30秒，复活或换世界清零。

## 可复现检查

```powershell
node tools/build-mini-hero.mjs --check
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run tests/native-kit.test.ts tests/mini-native-renderer.test.ts tests/hero-appearance.test.ts tests/hero-death-playback.test.ts tests/wardrobe-renderer.test.ts tests/effect-attachments.test.ts tests/skill-effects.test.ts tests/appearance-rules.test.ts
pnpm mini:verify
node tools/accept-mini-native-combat.mjs
```

`pnpm build` 已包含原字节资源发布与校验。发布按停止托管服务、构建、恢复Windows Limited任务服务执行；交付前再次检查实际health/content版本、真实账号登录和会话恢复。

发布与数据保留记录见 `docs/reviews/open-world/mini-hero-integration-20261002/release-service.json`；三武器释放帧、物理暂停、单步、死亡/复活与真实录像见该目录 `controlled/result.json`、`controlled/controlled-operations.webm`。受控测试只在独立战斗页消费真正World/Phaser事件，不修改真实玩家数据库。

实机证据：[正式营地](../../docs/reviews/open-world/mini-hero-integration-20261002/camp-1280x720.png)、[人物页](../../docs/reviews/open-world/mini-hero-integration-20261002/character-figure-1280x720.png)、[野外战斗](../../docs/reviews/open-world/mini-hero-integration-20261002/real-meadow-combat-1280x720.png)、[真实玩家路径结果](../../docs/reviews/open-world/mini-hero-integration-20261002/result.json)。检查覆盖登录、营地、头像/预览一致、暂停/镜像、实际弓与剑装备切换、移动、真实伤害、回城、会话恢复及既有数据库记录保留。截图均来自真正骨骼或游戏运行。

这轮没有扩展全部装备套装，也没有新增受击/死亡表情。软件GPU浏览器用于正确性验证，不能替代原生显卡性能验收。
