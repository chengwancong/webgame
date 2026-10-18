# 技能图标方向

首批 `a-action-illustration.png` 与 `b-magic-emblem.png` 已被用户明确否定：画风与当前游戏不符，不能进入正式资源。

修订方案以实机角色、装备、场景为参考，排除旧临时技能图标。使用 built-in imagegen 制作，同一组八个技能对照；提示词及参考路径保存于 `revised-prompts.json`。

| 文件 | 方向 | 状态 |
| --- | --- | --- |
| `01-cartoon-objects.png` | 圆润卡通物件，沿用装备材质与暖色体积 | 未采用 |
| `02-hand-drawn-signs.png` | 简绘技能符记，减少细节，侧重小尺寸形状 | 2026-10-01 用户确认，补齐全部技能 |

本目录为方案图，不直接切图上线。正式资源按单技能生成无文字透明图，并在 48px 快捷栏与技能卡片中检查；新增技能不得长期借用相同旧图标充当正式图。生成提示词见 `../skill-icons-handdrawn-20261001/prompts.json`。
