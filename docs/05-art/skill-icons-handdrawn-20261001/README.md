# 全技能手绘图标

2026-10-01 用户确认采用「手绘符记」，补齐全部技能图标。当前 55 个技能全部使用独立图片：近战 15、远程 18、控制 12、辅助 10；旧的同机制复用回退已移除。

每个技能由 built-in imagegen 单独绘制，统一使用用户选定的 `../skill-icon-directions-20261001/02-hand-drawn-signs.png` 作风格参考。大轮廓、暖米白与分类色、柔和深蓝描边、少量手绘色面，图内没有标题或界面边框。`prompts.json` 保存逐项提示词，`generated-files.json` 保存原始生成文件对应关系。

## 资源与导入

以下资源路径均相对项目根目录。

- 原图：`open-world/assets/ui-source/v2/skill-handdrawn/originals/`。
- 正式源图：`open-world/assets/ui-source/v2/skill-handdrawn/skill-<id>.png`，透明底、统一 256×256 画布。
- 发布目录：`open-world/apps/web/public/art/ui-v2/skill-handdrawn/`。
- 原图尺寸、原始与正式图片 SHA256：`open-world/assets/ui-source/v2/skill-handdrawn/provenance.json`。

`node --import tsx tools/import-handdrawn-skill-icons.mjs` 保留原图，按比例规范透明边距和画布，登记正式源资源；`python tools/build_ui_v2.py` 使用既有事务构建发布图片与 `ui.v2.json`。技能目录、详情、快捷栏共用资源登记。

新增技能必须补充独立正式图标。内容校验会检查每个技能的资源、文件及唯一哈希，缺失或复用图片会失败，不再默默显示其他技能的图片。

## 验收

`node --import tsx tools/accept-handdrawn-skill-icons.mjs` 使用临时 PostgreSQL 与真实玩家入口，逐个选择 55 个技能，核对列表／详情路径、图片加载与比例，再核对快捷栏和 32px／48px 总览。内容校验、TypeScript、构建及本机账号登录进入营地均通过。

- 总览：`../../reviews/open-world/skill-icons-handdrawn-20261001/all-skills.png`。
- 自动验收：`../../reviews/open-world/skill-icons-handdrawn-20261001/result.json`。
- 实际本机预览：`../../reviews/open-world/skill-icons-handdrawn-20261001/live-preview.json`、`live-login-skills.png`。
- 发布前后原有存档核对：`local-release.json`。

未激活技能仍按现有状态规则变灰；总览显示正式资源的原始颜色。图标更新不改变技能激活、升级、战斗或奖励规则。
