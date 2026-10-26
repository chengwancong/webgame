> **已作废（2026-10-25）**：用户撤销回合制战棋，改为实时战斗、以自动战斗为主体，见 `planning-bd-v1/27-auto-combat-direction.md`。本文不再执行，GPT 停止相关工作；战棋代码冻结不删（D-A4）。

# ART-HH 战棋棋盘与 HUD 美术统一（2026-10-25）

用户反馈战棋页"不像游戏"：角色是 Q 版手绘，地表是单张草地 + 网格线，HUD 是系统控件，三者互相打架。前端已由 Claude 先用 CSS 做了金边牌匾、E7 金框技能槽、选中脚下光环、敌人红描边；本批只补素材，不改画风：不转 3D、不整体转像素，仍是奶白浅金 + 手绘符记 + Q 版柔和深描边。

| 编号 | 内容 | 规格 | 交付路径 |
|---|---|---|---|
| H1（A39） | 每航区棋盘地表：草/土/石板各 3 变体 + 两两过渡边；棋盘四周收边（崖壁、灌木、水岸各一套）；格线改成地表上的浅刻纹（单独一层，可调透明度） | 128×128 无缝贴片图集，2× 出图；收边九宫格 | `public/art/tactical/ground/<region>/` + 登记 json |
| H2（A40） | 每航区 8–12 件构图摆件：残墙、木箱、篝火、旗帜、碎石堆、断桩等；标注占格 / 不占格 | 透明 PNG，显示宽 0.6–1.6 格，锚点底部中心 | `public/art/tactical/props/<region>/` |
| H3（A41） | HUD 牌匾件：金边牌匾九宫格（回合牌、行动序条、生命牌）；技能槽底座 可用 / 选中 / 锁定 三态；圆形图标钮底 | 九宫格 PNG；槽底 128×128；钮底 96×96 | `public/art/tactical/hud/` |

参照：`public/art/hub-ui/ui-ornaments.png`（E7 金框）、现有棋盘树木与岩石摆件、`docs/scene-dressing.md`。素材只用自绘或 CC0/CC-BY，新下载须用户逐次同意。接线由 Claude 做，GPT 只交素材和登记 json，不改 `tactical/*.ts`、`tactical.css`。

## 一键复制提示词

```
你在《深渊行者》仓库 abyss-walker-rewrite/open-world 工作。任务：出战棋棋盘与 HUD 的统一美术素材（ART-HH），只交素材和登记 json，不改 apps/web/src/tactical 下的代码和样式。

先读 docs/hub-portal-rework-20261021/handoff/art-hh-tactical-board.md，按 H1、H2、H3 连续做完，中途不停下来问。

画风：奶白浅金现代明亮卡通 + 手绘符记，Q 版角色的柔和深色描边；不转 3D、不整体转像素；HUD 件禁皮革、铜钉、金属浮雕，可用金边、内高光、4px 底边厚度。参照 public/art/hub-ui/ui-ornaments.png 和现有棋盘树木/岩石摆件。

约束：素材只用自绘或 CC0/CC-BY；不提交截图和预览拼图；只按路径提交自己的文件。每批写进度到 docs/hub-portal-rework-20261021/handoff/art-hh-progress.md。做完用中文回报每批文件清单、规格核对和未完成项。
```
