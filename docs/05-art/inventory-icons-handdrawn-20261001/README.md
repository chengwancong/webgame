# 普通道具与材料正式图标

背包落地使用14张256×256透明底正式基础图：攻击/生命合剂、11种真实材料、技能书底图。每本技能书叠加其关联技能的正式图标徽记，区分燎原、雷链等关联技能。

其中8张沿用用户已看过的背包设计稿图标，6张材料图补充独立生成；均使用内置ImageGen，保持已认可的手绘符记风格。新增素材提示词见 `prompts.json`、原始输出见 `generated.json`；沿用图标的提示词与来源见 `.design/inventory-categories/demo-prompts.json`、`demo-resource-prompts.json`及相邻records文件。

正式源图及索引位于 `open-world/assets/ui-source/v2/inventory-handdrawn/`，高分辨率原图保存在其 `originals/`。导入统一透明画布及208px安全区，检查真实alpha、无主体触边与像素唯一性。使用 `tools/import-inventory-icons.mjs` 登记，再由现有UI构建发布。

稳定ID：`item-tonic-attack`、`item-tonic-hp`、`item-skill-book`；材料为 `item-material-` 加真实材料ID，例如 `item-material-omega_fragment`。

内容校验逐一确认全部11种材料与合剂/书底图有正式资源、256px画布及正确哈希。预览见 [14张总览](../../reviews/open-world/inventory-icons-handdrawn-20261001/all-items.png)。
