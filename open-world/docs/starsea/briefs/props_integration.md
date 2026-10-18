# 制作任务书 6 · 物件/界面/集成

代理：props_integration。组：props。主代理：文档与独立验收。日期2026-10-03。

## 输入与数量

- world.md、campaign.md、chapters/全部正文、maps.md、art/props.md、requirements.json。
- 本组ID前缀：ss-prop-。
- 24组物件与状态；世界航图、标识、公共登记与生产预览。
- 需求项从requirements读取；props=24；以及公共集成职责。

## 文件权限

- 允许：assets/starsea/props/及apps/web/public/art/starsea/props/。
- 局部manifest：assets/starsea/props/manifest.json。
- 组内生成脚本/预览/证据在组内子目录；不得写docs/starsea设计正文或主代理台账。
- 唯一允许：公共构建/登记/Vite QA入口/运行资源加载/资源版本及服务发布；新增独立starsea资产包，保留旧正式剧情。必须先读取所有其他组manifest，缺项逐ID追踪。

## 专项验收

24物件每状态可消费；航图和标识小尺寸可辨；读取五组manifest构建starsea-art-qa.html生产入口，真实动态、13地图/技能预览可切换；类型/内容校验、构建与健康版本/真实登录/存档保留证据。

## 所有组共同执行要求

1. 先读上级AGENTS.md、项目.md、本目录world.md/campaign.md/art/README.md与requirements.json，源与规格均已冻结为d1。先核对现有素材，禁止把未验证预览直接称正式动作。
2. 仅写本组源/导出/局部manifest/预览/证据；禁止清理其他组或旧素材，禁止改持久数据库、重启正式服务或改全局版本（集成代理在发布收尾时另有授权）。
3. 本任务范围内不再spawn其他子代理。图像生成/编辑需要时使用已提供imagegen技能/工具，优先完整原生动画复用；不是所有资源都需要新画。
4. 首章与代表样板先完成，然后完成requirements中的本组全量。提交总表含全部ID，不随意减项。找不到或能力不支持，给出具体源与缺口，不用伪动作顶替。
5. manifest严格按共同契约，files存在并记录sha256；native/atlas/effect/map/prop runtime可消费。native可引用现有已发布mini-hero原生rig，必须登记依赖；非原生导出明确帧率、原点、完整动作帧。
6. 预览动作真实连续，保存本组dynamic evidence/diagnostics；演员特效用独立挂点。机制引用不能冒充新敌人的战斗绑定已接入。
7. 向主代理提交完成/待验证ID、文件路径、运行方法、预览证据、自检结果和限制；资源修复归你，主代理只验收。

