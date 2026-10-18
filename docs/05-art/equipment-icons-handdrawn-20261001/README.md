# 六部位手绘装备图标

2026-10-04 更新：当前正式图标库已完成全量重制，查看[新版 54 套／324 张图标与验收](../equipment-icons-chibi-20261004/README.md)。本目录保留 2026-10-01 的历史交付。

已完成 **54 套、324 张独立透明 PNG**，由四名 Agent 并行生成和检查。采用用户确认的「手绘符记」画风：柔和深色描边、清晰轮廓、少量手绘色面和暖色高光。

| 维度 | 内容 |
| --- | --- |
| 武器谱系 | 剑、锤、斧、法杖、暗器、魔杖 |
| 系列 | 常规、方阵、原初 |
| 阶级 | 每个系列均含 T1、T2、T3 |
| 每套部位 | 武器、衣服、头盔、鞋子、项链、戒指 |
| 数量 | 6 × 3 × 3 = 54 套；54 × 6 = 324 张 |

## 查看与取用

- [整库总览](../../reviews/open-world/equipment-icons-handdrawn-20261001/final/overview.png)：按武器谱系、阶级、系列排列，全部以 48px 展示。
- [完整分类图册](../../reviews/open-world/equipment-icons-handdrawn-20261001/final/all-equipment.html)：按方向和系列查看，每件同时显示 80px、32px、48px。
- [324 张正式图标压缩包](equipment-handdrawn-324.zip)：包含正式 PNG 及资源索引。
- [正式资源索引](../../../open-world/assets/ui-source/v2/equipment-handdrawn/catalog.json)：固定 ID、六维分类、路径、尺寸及 SHA-256。
- [全部最终提示词与来源](production-provenance.json)：324 张逐件记录实际提示词、参考图、生成来源及最终原图哈希。

正式图位于 `open-world/assets/ui-source/v2/equipment-handdrawn/`；每张采用 256×256 透明画布，主体等比缩放到中央 208px 安全区域。高分辨率原图保留在相邻的 `equipment-handdrawn-originals/`；用于定向修订的部分旧版另存于 `revisions/`。

## 项目登记

324 个 ID 已加入 `ui-source.json`，通过 UI 构建发布到 `/art/ui-v2/equipment-handdrawn/`。消费示例：`art('gear-primal-axe-t3-weapon')`。UI 清单版本为 `2.4`，资源版本为 `world-art-20261001-v4`。

这批交付是装备美术资源库；职业、数值装备、掉落表及现有存档槽位保持原有定义。后续配置装备时，按对应谱系、系列、阶级和部位选择稳定 ID。

用户随后要求加入游戏道具表，324 条定义现已登记到 [正式装备道具表](../../../open-world/packages/content/equipment-catalog.json)，并通过游戏内容和单项查询接口提供。当前为已登记、未开放获取，具体字段及运行装备边界见 [接入说明](../../../open-world/docs/equipment-item-catalog.md)。

## 验收

四名 Agent 的最终数量为 78、84、78、84 张。检查包括完整六部位、跨批次像素唯一、真实透明度、主体边界、套装颜色与材质、阶级结构及小尺寸辨识。修正了剑 T2 鞋朝向、斧系鞋嵌石颜色、原初 T3 头盔结构和原初魔杖 T2 装饰层级。

- [技术检查](../../reviews/open-world/equipment-icons-handdrawn-20261001/final/result.json)：324 张、54 套、324 个独立像素哈希，裁切警告为零。
- [目视检查记录](../../reviews/open-world/equipment-icons-handdrawn-20261001/final/visual-review.json)：绑定最终导入包 SHA-256。
- [实际服务验收](../../reviews/open-world/equipment-icons-handdrawn-20261001/published/result.json)：health/content 版本一致，账号无密码登录、进入营地、同角色会话恢复，全部 324 张公开资源成功解码。

`pnpm exec tsc --noEmit`、`pnpm content` 和 `pnpm build` 均通过。发布按停止服务、构建、恢复服务执行，本机预览保持可访问。

生成采用内置 ImageGen，每张独立调用；具体导入、检查、登记命令见 [工具说明](../../../open-world/tools/equipment-art/IMPORT.md)。
