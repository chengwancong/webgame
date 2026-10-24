# CONTENT-G01 设计R1：前端进度（Claude）

依据：`content-design-r1.md/json`（81c1c522）。只改前端、交互和表现接线，不改后端、内容表、大纲、M14 或 TTK 目标。

## 提交

- d408a8bc：宠物详情三行、攻击/辅助徽章、宠物事件反馈、龙眠锁门钥匙来源；新增 `tests/content-g01-frontend.test.ts`（31 项）。

## 逐项状态

| 项 | 状态 | 说明 |
|---|---|---|
| 1 宠物详情「做什么/适合哪里/代价」 | 已接，等后端字段上线 | `hub/pet-panel.ts`：「做什么」用技能名加服务端 `activeLine`，下面一行显示被动 `passiveLine`；`combatRole`/`flavor` 小字。适合哪里读 `suitableFor`，代价读 `tradeoff`；没下发时整行隐藏，不放占位文案。前端不算任何数值 |
| 2 风绒单体/风芽鹿护盾/岚羽连锁表现 | 已接，等后端规则上线 | `hub/pet-event-feedback.ts` 的 `classifyPetEvent`：只认 `ruleId` 以 `pet-` 开头的 `effect_triggered`，播放 SP33 攻击动作；`action==='arc'` 或 `followupActions` 含 arc 时加连锁色调。护盾反馈只在随后 ≤2 tick 内收到 `shielded applied amount>0` 时播放；伤害数字沿用通用 `hit_resolved` 飘字，辅助宠物不冒数字 |
| 3 攻击型/辅助型区分，不凭流派说「可打出弱点」 | 已接（宠物页），弱点提示靠后端 | 徽章由 `activeEffect.dealsDamage` 决定，`kind` 显示为单体/范围/连锁/护盾。节点弱点提示读服务端 `loadoutView.slots[].elements`；GPT 工作区的 `activePetFlow` 已让不造成伤害的宠物不再贡献元素，前端不另做判断。出战方案页签暂不显示宠物类型，因为 slot 只有 `pet` id |
| 4 四套打法搭配与获取去处 | 阻塞：缺生产数据源 | 没有带「已实装」标记和获取顺序的生产内容表或接口。`content-design-r1.json` 是设计稿，不接进正式入口 |
| 5 龙眠两门钥匙来源与开启状态 | 已接 | `doorRowHtml` 增加「来源：<节点名>首通」（hub-explore `keys[].from` → 航图节点名）；已开启/已获得/未获得三态和图标不变。铃钥=截击军需官，星钥=击败前线督军 |

## 依赖的后端字段（GPT 工作区未提交，前端用本地可选类型读取，HEAD 可独立编译）

- `PetView.suitableFor`、`PetView.tradeoff`、`PetView.activeEffect{kind,dealsDamage,…}`
- `effect_triggered.followupActions`
- `loadoutView` 里不造成伤害的宠物不再贡献元素

## 本机自检

- `npx tsc --noEmit -p .` 通过。
- vitest：content-g01-frontend 31、hub-panels 69、zhangjian-frontend 14、hub-art-wiring 51、hub-chart 14 全部通过。存量失败 fe-report-fixes FE-01 与本轮无关。
- vite build 通过。

## 待联验（部署云测试服后交 Grok）

1. 宠物页：风绒、风芽鹿、岚羽三张卡分别显示攻击型·单体、辅助型·护盾、攻击型·连锁；适合/代价两行有文字且不撑破 1280×720 卡片。
2. 副本内：风绒每 2 秒攻击时 SP33 播放攻击动作；风芽鹿施盾时播放动作，主人护盾值实际增加时才出现浅蓝反馈；风芽鹿不冒伤害数字。岚羽首击之后连锁跳跃，出现金色调。
3. 出战风芽鹿时，航图节点不因宠物流派元素提示「能打出 X 弱点」。
4. 龙眠巢穴2/巢穴3的锁门行：未获得、已获得、已开启三态，以及来源节点名。
5. 第 4 项：后端/内容数据源到位后再接，再验证未实装能力不显示为已生效、早期获取顺序不倒置。
