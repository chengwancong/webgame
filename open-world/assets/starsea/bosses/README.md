# 裂星远航 · 六章首领资源包

制作所有者：boss_art；需求版本 starsea-20261003-d1；输出版本 starsea-20261003-bosses-v1。根代理独立验收记录另存主台账。本包不更换正式主线、不改变首领数值、不修改服务或玩家存档。

## 六项交付

| ID | 主体与原生衣装 | 三技能原生动作 |
| --- | --- | --- |
| ss-boss-port-vanguard | 开脸暮界重盔，knight_epic1，缩短双手巨刃 | Attack_TwoHand2 / Guard2 / Run2 |
| ss-boss-fog-quartermaster | 老军需官，高领紫袍，背部独立引潮箱 | Spell1 / Spell2 / Cast1 |
| ss-boss-core-extractor | 密闭机械面罩，warrior_epic2，独立炉心、重锤、排气阀 | Cast1 / Spell1 / Attack_TwoHand2 |
| ss-boss-ice-patrol | 密闭蓝银面罩，knight_rare1短甲，枪杖、裂冰护片 | Spell1 / Cast1 / Guard2 |
| ss-boss-rift-marshal | 灰紫成熟军官，knight_epic1，双叉裂潮杖、背部装置 | Spell1 / Spell2 / Cast2 |
| ss-boss-vilo | 银发成熟提督，knight_epic2，航冠、长刃；剧情和战斗同一主体 | Attack_TwoHand2 / Cast1 / Cast2 |

基础身体和动作来自已发布的 `assets/mini-hero/navy/runtime`：Spine 4.2.43，原始JSON SHA-256 `92ef889c590476c0eacdbc0f77f1206e35a1c77329867331fbc731a17fa5205a`。原生身体、加权网格、约束与完整动作时间线保留。新头部及装置由 built-in image_gen 生成；原始透明PNG、实际提示词见 `source/`。26个独立导入部件由6张原始分件图裁出，不是26个新角色。

B3、B4明确登记为拟人机械适配，未使用女王/龙王静态预览。原生动作共用是表现限制，不假装每个技能都有新动画。

## 公共集成契约

- 读取 `manifest.json`；每项 `runtime.profile`、`runtime.renderAppearance`、`bodySetId`、`family`均可传给现有 MiniNativePreview。`renderAppearance`的全部部位是同一首领ID，weapon family匹配本地profile。
- 150px来自有效身体高度，不按透明原图画布缩放。固定原点 `[-0.25,0]`；同一首领所有状态使用同一测得高度和最大动作包围盒。显示左右镜像围绕相同足点。
- B3的 `weaponCategory=hammer`；现有renderer兼容家族为 `axe`。此字段只用于原生显示，不改变玩家职业、武器类型、任何战斗规则或服务端内容。
- 基础profile提供idle/move/attack/hurt/death和默认skill/projectile。三个技能都有独立 `profile-skillN.json`，按 `actions.skills[skillId].profile`选择；运行阶段对应 `profiles['phase-active']`，保留每项原生sourceAnimation、释放注解和实际前摇tick引用。
- `states['phase-enter'/'phase-active'/'phase-end'].profile`提供独立阶段预览。底层动作 `SS_phaseEnter`、`SS_phaseEnd`保持身体原生待机，单独编制阶段骨骼/核心颜色。进入和结束转换窗口0.6s，身体动画持续完整原始周期。
- **选择优先级固定为死亡→存活阶段转换→所选存活动作。** `runtime.actionSelection`与所有profile同步登记：death始终使用`SS_death`/原生Die，取消phase-enter/phase-end片段选择，phase-active也不替代死亡。阶段profile的death映射均为同一SS_death；0.65s后武器和阶段部件透明，所有外部循环同时清理。第6代理聚合页/实际演员必须先检查death，再处理阶段。
- 手部是原生 RIGHTHAND 骨；weapon/muzzle从实际附件PNG像素经附件与骨变换求得，不使用统一屏幕偏移。B5发射点取实际红晶核；原刀叉顶部透明孔隙不作挂点。
- 阶段核心和左右护片绑定 `ss_module`、`ss_panel_left`、`ss_panel_right`；具体源骨与前后层在 `phaseComponents`。B3实际排气阀挂点为 `ss_exhaust`，阶段蒸汽循环交VFX组作为既定 `ss-fx-b03-flame` 的 `phase_exhaust` 活动子片段提供；phase-end/death时销毁循环，保持既定需求ID闭包。当前本组不提供蒸汽粒子或18技能特效。
- 死亡使用完整原生Die；0.65s后武器及阶段件透明。该清理窗口不替代服务端击杀或奖励事件。
- 每项Character.atlas通过相对路径引用正式mini-hero共用PMA页，专用parts.png也按PMA编码。正式构建须先保证既有mini-hero资源发布；依赖路径与哈希均在manifest。

## 构建与验收

`node assets/starsea/bosses/tools/build.mjs` 从本组已保存PNG和现有已发布原生源重建全部六项，只写本组源/导出目录与本组局部manifest。公共构建可直接调用此命令，然后由集成所有者聚合登记。构建不依赖生成缓存仍存在。

`node assets/starsea/bosses/tools/preview-server.mjs 8634` 启动只读静态验收服务器，入口 `/art/starsea/bosses/preview.html`。已发布公共静态服务也可直接打开同一路径。页面不是客户端战斗绑定，也不写账号或任务状态。

`node assets/starsea/bosses/tools/review.mjs` 用1280×720真实WebGL播放，逐项核验八个动作、四阶段、非空武器像素、真实挂点镜像、固定足点、工具/阶段死亡清理；保存完整连续WebM、截图和review.json。`--no-video`可只跑动态采样，但最终交付必须有完整录像。

`runtime/<id>/diagnostics.json`保留每个完整动作的60fps逐帧骨骼变化数、动作边界及原点零位移检查。`evidence/`的截图是检查依据，连续动作及阶段切换以对应WebM和实时页核验。头部/装备源图不冒充动作输出。

`node assets/starsea/bosses/tools/verify-production-native.mjs` 使用现有生产 `MiniNativePreview`，覆盖六项×十套profile、头像、左右镜像和真实cast时钟在前摇边界映射原生释放注解。隔离Vite仅用于加载实际生产模块，不重启正式服务。通过后运行 `node assets/starsea/bosses/tools/seal-review.mjs` 核对全部文件哈希并固化本组producer-reviewed状态，根验收仍独立。

自检使用Headless Edge/SwiftShader，不认证实际GPU混战性能。真实游戏登录、版本兼容与原存档保留由公共集成流程完成。六章剧情、真实技能判定和18技能特效另外验收。
