# 分件角色资源管线

原素材来自用户本机 `D:/2D/assets/man/主角/spineaaa`。只读取原始导出与图片，不修改来源，不读取 Spine 激活信息。第一批实际发布 16 套分件；全目录 226 套、每套 14 件的尺寸、SHA-256 和完整性登记在 `packages/asset-manifest/wardrobe-catalog.json`。未发布目录不能进入玩家选择列表。

## 开发导入与构建

- `node tools/wardrobe-import.mjs`：读取原素材目录，可用 `WARDROBE_SOURCE` 指定替代目录；按 `selection.json` 选品并更新 provenance/catalog/manifest。
- `node tools/wardrobe-preview.mjs`：浏览器 Canvas 使用真实骨骼矩阵拼装原素材，生成目录审查、七武器动作联系图与透明缩略图；需要原素材目录。缩略图原件存入本目录 `previews/` 后参与构建。
- `node tools/wardrobe-build.mjs`：仅使用本工程的 `source/`、`sets/`、`previews/` 与登记文件，校验哈希并输出网页资源。部署机器不需要本机 D 盘、Spine 安装、激活信息或骨骼运行时。
- `node tools/wardrobe-verify.mjs`：原件哈希、发布选择、家族匹配、采样帧、镜像坐标约定、固定地面点以及独立骨骼数学比较。

## 动作与渲染协议

7 个武器家族各保留原始独立骨骼动作：剑、斧、弓、枪、拳、矛、魔法。每家族导出 idle/move/walk/attack/hurt/death/skill/projectile/impact/win 共 10 个可播放动作，30 fps，合计 1396 帧。第 11 个 `unit_no_shadow` 是阴影工具动画，不作为玩家动作。

矩阵 `[a,b,c,d,tx,ty]` 将 PNG **中心为原点、局部 Y 向下**的像素坐标映射到 **Spine Y 向上**的世界坐标。局部 PNG 翻转已包含在矩阵；Canvas 只在世界层进行一次 Y 翻转，再按矩阵绘制 `drawImage(image,-width/2,-height/2,width,height)`。朝向镜像围绕同一个地面原点翻转所有世界 X，包括挂点。原角色攻击朝向左侧。不得按每帧包围盒居中，否则跑动和攻击时脚底会滑动。

drawOrder 消费源槽位顺序，源文件未包含动态图层序列。每帧另外提供 feet/chest/hand/muzzle/weapon/weaponTip 的原骨骼挂点。渲染器再消费 `weapon-sockets.json` 登记的 16 套武器实际刀刃、枪口、弓释放面和法杖头部像素点：原 PNG 左上坐标 → 图片中心局部坐标 → 当帧真实附件矩阵 → 地面、缩放与镜像。原 hand/chest/feet 坐标保留。拳的 weapon PNG 故意为空，改用当前 hands 套装的 front_hand/back_hand 非空拳面；`handPolicy=leading-hand` 在原向左坐标中选择当前最前面的拳，再整体镜像。96 个标定点在导入与部署构建时检查图片尺寸、边界、实际 alpha 非空和配置哈希，不使用通用 `+40` 骨骼偏移。

源使用普通骨骼、RegionAttachment、rotate/translate/scale、slot color、linear/stepped，不含 IK、mesh、shear。导入器遇到未支持类型直接失败。独立验证使用工程现有官方 Spine 3.6 数学作为正常骨骼 oracle；仅为比较把 3.8 skin 容器转换为旧结构，并显式补 3.8 省略值（time/angle 默认 0、scale 默认 1）。1396 帧 78176 个顶点最大差异约 0.000145 Spine 单位。游戏不依赖旧 runtime，也不把此转换当成通用版本迁移。

动作 impactTime 是表现同步注解。弓/魔法/矛的原 effect 事件未写 time，原值为 0；在联系图检查举起动作后，用 `selection.json.motionTiming` 配置 .3333s 表现释放帧，并保留 sourceEffectTime=0。战斗命中与技能前摇仍由服务端解析参数决定，不由资源注解发奖或计算伤害。

## 美术与可选覆盖

`sets/` 保存第一批原始分件，不能用改色或图片编辑覆盖它们。ImageGen 的微调成品以相同 PNG 画布和锚点保存到 `stylized/`；原生成图也保留供审查。

可选 `style-overrides.json` 格式：`{"v2-soft":{"100011":{"face":"/art/wardrobe/stylized/100011-face.png"}}}`。导入器检查发布套装、分件名、URL 白名单、画布尺寸与哈希。manifest.styleOverrides 供运行时逐部件解析，未覆盖的部件使用原件；缓存键必须包含最终 URL。

原素材 face 合并头发/脸，hands 分组含上臂和手，back 只有一个背饰附件；当前自由组合的是这些真实素材分件，不能宣称支持脸、发型、肤色、头盔完全独立编辑。目录本身跨日式 Q 版、轻装奇幻和重甲，需要逐批审美检查，不能全量自动上线。

`referenceHeight=106.43` 来自基础套装 idle PNG 有效 alpha 范围，保持统一骨架缩放；原 setup 包围盒 145.45 含大量透明画布，另存为 sourceSetupBoundsHeight，不能用作实机人物身高。
