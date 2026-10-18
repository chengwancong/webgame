# 装备图标全量重制

2026-10-04 后续更新：用户已要求全部实装，54套324件现已接入实际获取、六部位、套装、强化和存档，查看[装备实装及当前验收](../../../open-world/docs/equipment-runtime.md)。本页保留图标重制的制作与资源记录。

2026-10-04 完成 54 套、324 张独立装备图标的全量重制，已替换现有装备图标库。当前方向是与实机 Q 版角色一致的圆润手绘：柔和深色描边、大色块、克制高光，适配奶白浅金 UI。

范围为六武器谱系 × 三系列 × T1/T2/T3，每套包含武器、衣服、头盔、鞋子、项链、戒指。每张独立调用内置 ImageGen，保留原图、实际提示词、参考图和哈希；正式 PNG 为透明 256×256，主体等比缩放到中央 208px 安全区。

| 武器方向 | 主要轮廓 |
| --- | --- |
| 剑 | 对称直刃、V 形与菱形结构 |
| 锤 | 宽矮块面、圆形连接件、厚实衣甲 |
| 斧 | 月牙刃、偏置肩部、弧形与分叉下摆 |
| 法杖 | 长柄、竖向菱形、长袍和巫师头饰 |
| 暗器 | 三刃、偏置环、斜向绑带与低兜帽 |
| 魔杖 | 短柄圆芽、卷曲花瓣、短披肩和圆兜帽 |

常规系列采用钢、皮革、布料与木；方阵系列以符文石板、块状接缝和开放框架构成；原初系列使用骨片、根木、绑带与琥珀核心。阶段通过杖头／护手、衣甲长短、头饰、鞋帮和首饰支架的主要结构区分。全库缩略图复查后，另外修正了 12 个材质仍偏普通布料的法杖／魔杖部件。

## 查看和取用

- [54 套总览](../../reviews/open-world/equipment-icons-chibi-20261004/final/overview.png)：全部以 48px 展示。
- [完整筛选图册](../../reviews/open-world/equipment-icons-chibi-20261004/final/all-equipment.html)：按方向、系列、阶段筛选，显示 80px／32px／48px，并可切换灰度。
- [灰度总览](../../reviews/open-world/equipment-icons-chibi-20261004/final/overview-grayscale.png)：核对轮廓和构造。
- [324 张 PNG 压缩包](equipment-chibi-324.zip)：包含图标、目录与来源记录。
- [当前正式目录](catalog.json)和[逐张生产记录](production-provenance.json)。

正式资源位于 `open-world/assets/ui-source/v2/equipment-handdrawn/`，沿用既有 324 个稳定 ID；运行图片位于 `/art/ui-v2/equipment-handdrawn/`。旧版图标及发布前清单保存在 `open-world/assets/equipment-remake-20261003/previous-live-20261004/`，本次原图与修改版本保存在同一生产目录的 `originals/`、`revisions/`，最终导入包为 `package-final/`。

## 接入和验收

本次替换全部 324 个图标；其余 85 个 UI 资源登记保持原值。UI 清单为 `2.6`，当前客户端为 `0.8.12`，资源版本为 `world-art-20261004-v18-equipment-chibi`，protocol `13`、rules `ow-18`、db `11`。

装备内容表的发布前后哈希一致；这批重制提供已登记装备的美术资产，当前可获得装备继续按现有内容配置解析。

- [最终资产检查](../../reviews/open-world/equipment-icons-chibi-20261004/final/result.json)：54 套、324 个独立像素，透明度和安全区通过，裁切警告为零。
- [目视复查](../../reviews/open-world/equipment-icons-chibi-20261004/final/visual-review.json)：绑定最终包 SHA-256，由 Codex 检查全部方向／系列图页及彩色、灰度总览。
- [生产服务验收](../../reviews/open-world/equipment-icons-chibi-20261004/published/result.json)：8611 生产入口的 health/content 与客户端一致；324 张实际返回图片哈希匹配、全部解码；无密码账号登录、进入营地、同角色会话恢复及装备保留通过。
- [行囊和图册交互](../../reviews/open-world/equipment-icons-chibi-20261004/published/ui-result.json)：1280×720 行囊显示和图片解码通过；筛选结果为 9 套 → 3 套 → 1 套／6 部件，灰度切换正常。

执行了 UI 资源构建、`pnpm exec tsc --noEmit`、`pnpm content`、`pnpm ui:tokens:check` 及 Vite 生产构建，均通过。发布按停止服务、构建、恢复服务执行，现有 Limited 任务计划服务保持运行。
