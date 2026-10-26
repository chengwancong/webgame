> **已作废（2026-10-25）**：用户撤销回合制战棋，改为实时战斗、以自动战斗为主体，见 `planning-bd-v1/27-auto-combat-direction.md`。本文不再执行，GPT 停止相关工作；战棋代码冻结不删（D-A4）。

# 战棋紧凑 HUD 首版落地（2026-10-25）

**后续实机结论：用户否定本版与确认稿的视觉一致性。** 本文保留接线与发布历史，不能视为视觉验收通过；纠偏记录见 [战棋实机视觉纠偏](ui-tactical-visual-correction-20261025.md)。

用户确认布局后要求复用本项目公共组件，并把人物大卡、移动/主行动卡与宠物卡改为状态图标。本轮实现的是独立战棋页的 HUD 试用版，不改伤害、养成、服务端调度或正式角色存档。

## 交付

- 源码提交：`4b920e6ba780e4ce7cc90e6cce7f59edfd41b29a`。
- 横向战场信息与已公开行动顺序，当前行动者来自投影；执行者未公开时只显示阶段，不猜测敌人。
- 技能栏上方一条状态带：生命、实际存在的蓝量、移动额度、主行动额度与实际存在的宠物。
- 图标支持悬停、键盘焦点、点击固定详情和 Escape/关闭；查看详情不会提交战斗命令。详情刷新保留焦点，避免原生 title 与自定义说明重复。
- 移动/主行动已用时显示斜线，未轮到我方/托管/同步时显示等待标记；不只靠颜色区分。
- 普攻与最多四个技能按 category 分开，缺少的技能是未装配空槽，不补造能力。B 是普攻，1–4 对应技能，M 保留移动入口。
- 未选择技能时，点击服务端已公布的可达空格进入移动预览；仍需原来的确认或再次点击目标，不跳过校验和费用结算。
- 默认只有“结束行动”是主按钮；选中有效目标后换成“确认行动”。详情图标不是额外行动按钮。
- 去掉独立夸张金框、技能发光与位移效果；复用公共按钮、itemSlot、meterHtml、componentArtHtml、petPortraitHtml。
- 新尺寸先登记 tokens.json，再生成 tokens.css。9×9、10×10 棋盘遵守舞台剩余高度，不再被旧 40px 最小格长撑出底栏。

## 入口与真实数据边界

- 可操作入口：`/tactical-board.html?source=sandbox`，由既有服务端沙盒提供数据，不发正式奖励。
- 隔离交互演示：`/tactical-board.html?source=fixture`，仅本地样例状态。
- 静态验收：`/u4-u6-qa.html`，最前六项为 `tactical-compact-ready / move-spent / main-spent / low / long / missing`。均挂载真实控制器；冻结样例不请求 API、不推进战斗，写操作拒绝。
- 当前沙盒投影的 resource 与 pet 仍为 null，真实页因此不画蓝条/宠物。QA 中补入的蓝量与宠物用于验证显示，明确标为样例，不冒充后端已接通。
- 当前源没有攻速行动条百分比，界面保留已公开行动顺序/战场单位，不制作假进度。这次没有把战棋页替换进正式 World 探索路径。
- 地表、摆件、单位仍使用现有资源；聊天中的生成图片只作布局参考，没有作为正式场景素材导入。

## 验证与发布

- `node tools/build-ui-tokens.mjs --check`：516 个 Token 一致。
- `npx tsc --noEmit -p .`：通过。
- Vitest 12 文件、110 项通过，统一 `--maxWorkers=1 --no-file-parallelism`。
- 本地生产构建包含战棋入口，12 个 HTML 产物通过 CSS 层序检查；`publicDir:false`、`write:false`，不导出构建物，不复制图片。
- 发布命令：`node tools/deploy-staging.mjs --remote-web --skip-api --no-mirror`；只部署提交快照，沿用现有云端 API 与静态资源。
- 发布完成：2026-10-25 19:03（北京时间），云端隔离构建 63 个客户端文件；既有 API 镜像恢复健康后完成切换。
- 只读复核：health / content / build-info 的 client `0.11.57`、protocol `57`、rules `ow-97`、assets `world-art-20261007-v24-world-runtime`、db `19` 一致，build-info.source 等于上述源码提交。
- `/api/tactical/sandbox/catalog` 返回 5 个棋盘、2 个英雄；没有创建战斗或写角色数据。
- 战棋页 13 项 JS/CSS、静态页 23 项 JS/CSS 可读取；均含层序前导和紧凑 HUD 样式，静态页包包含六种新样例。
- [战棋沙盒试用](https://43-165-179-11.sslip.io/tactical-board.html?source=sandbox)；[只读状态样例](https://43-165-179-11.sslip.io/u4-u6-qa.html)。
- 没有运行浏览器自动化，也未把静态检查称为真机视觉验收。

相关测试：`tactical-compact-status`、`tactical-hud`、`tactical-hud-layout`、`tactical-ui`、`tactical-control`、`tactical-skills`、`tactical-sandbox`、`tactical-contracts`、`tactical-deploy-remote-web`、`ui-cascade`、`ui-direction-a-u6`、`ui-tokens`。

## 待 Claude / 数据接入

- 待后端发布真实攻速条、蓝量与宠物投影后接入相应数据；本次不修改规则和属性换算。
- H1/H2 的地表与摆件素材仍按原登记推进；H3 的组件外观以用户本次确认的现有公共组件为准。
- 新增占位使用：宠物头像未加载时用公共 star，技能无 iconSrc 时用公共 swords，空槽用 lock；不下载或新画正式素材。登记在 art-backlog.md。

## 给 Grok 的真机检查

1. 在 1280×720 下分别进入普通、9×9 精英和 10×10 首领棋盘；检查顶部信息、单位标签、底栏和详情均不越界或相压。
2. 用鼠标悬停、Tab、点击和 Escape 检查四种状态详情；倒计时/投影刷新时焦点不丢，查看详情不花额度也不刷新等待时限。
3. 点击可达空格预览移动、取消、再次确认；再用 B / 1–4 / M，确认普攻与技能共用主行动、第四技能不被切掉，空槽不可执行。
4. 检查移动已用、主行动已用、敌方阶段、托管和断线状态；只显示真实剩余额度，预览确认与结束按钮不同时成为主按钮。
5. 真实沙盒缺蓝量/宠物时不补值；静态页切换六种样例，核对长名称、条件、数值、状态的换行与内部滚动。
6. 查看宠物真实条件与角色当前护盾，避免把“能力就绪”当成“已获得护盾”；完成沙盒战斗并返回，保留明确的不发奖说明。
