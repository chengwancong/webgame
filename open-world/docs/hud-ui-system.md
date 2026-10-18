# HUD 统一 UI 与视口验收

2026-10-02。世界画面继续由场景渲染；本轮迁移仅处理屏幕 UI 的样式、语义色彩和布局。

## 实现范围

- 世界与 HUD 定位、plate、人物头像与血蓝条、追踪器、小地图图例、首领血条、技能快捷栏、战斗模式、六个系统入口、金币、拾取反馈、交互提示、暂停/恢复、通用 Tooltip 与 Toast 收敛到 `apps/web/src/ui/hud.css`。
- `style.css` 和 `v2-layout.css` 中对应 HUD 选择器已移除；非 HUD 部分交由主代理清理。新样式通过 `ui-entry.css` 的 components 层接入，位于共享 controls 之后。
- `hud-icons.ts` 的 SVG 颜色使用现有语义 Token。金币、生命、能量、护盾、危险、选择与普通文本保持各自语义，不新建一组旧颜色别名。
- 路线、追踪展开、模式、暂停/恢复按钮的公共 `buttonHtml` 接入由主代理完成；本轮按照真实公共按钮高度布置 HUD。
- 1280×720 保持左上人物/追踪、右上地图、下方模式/技能/系统入口。1024 下收紧系统入口占位。375 下底部分为技能、模式、系统入口三行；地图图例与金币分开，四个技能键和六个系统入口仍可访问。
- 通用 Tooltip 皮肤限定于 `#tooltip:not(.equipment-tip)`。`#tooltip` 共用仅保留定位、层级与默认显示，装备专用 Tooltip 的宽度、内边距、字体、pointer-events 与内部滚动不会被 HUD 样式覆盖。
- `warning-ui.ts` 的静态内联颜色、字体、间距与布局改为 CSS 类；真实施法筛选、倒计时、标题/说明、进度 transform 和显示时序保持。地面危险范围仍由 CombatVfx 负责。屏幕提示在暂停期间隐藏，避免覆盖恢复操作。

## 验证

- `node node_modules/typescript/bin/tsc --noEmit` 通过。
- `node tools/verify-hud-ui-system.mjs`：8 组通过。使用临时 PostgreSQL、隔离 API 与禁用监测/HMR 的独立 Vite；未启动、停止或重启 8611／8612。
- 真实账号登录进入营地，角色长名称、9位金币、四个技能键和六个系统入口，在 1280×720、1024×576、768×1024、375×812、1600×900 验证。
- 逐视口实际操作暂停、继续和追踪详情；核对交互区域均在视口内，技能/模式/系统/路线/恢复按钮之间没有交叠，悬浮不改变按钮边界。
- 真实技能激活响应丢失后进入待恢复状态，在四种视口检查 HUD 恢复按钮仍可用；实际恢复后读取到已确认技能等级，不靠 UI fixture 伪造恢复。
- 施法提示另用明确标注的**仅布局 fixture**验证四视口标题/说明/进度可读、避开人物中心及暂停弹条；它不证明首领机制、伤害、入口资格或发奖。
- 语义色彩、字号源码检查及减少动效设置通过；无浏览器脚本错误。临时数据库已停止并清理。

证据：`../.design/global-ui-system/hud-system-verification.json`；截图：`../.design/global-ui-system/screenshots/hud-system-*.png`。

## 本轮未覆盖

未进入野外验证真实倒下 → death 面板 → 返回安全点，也未验证真实首领入口未满足/可进入状态。这些不能以通知布局 fixture 代替，需要总验收单独完成。

技能页也已在基础 CSS 重建后以全新隔离 Vite 再次完成 9 组回归；见 [技能页迁移](skills-ui-system.md)。本轮不代表全部游戏 UI 已验收或发布。

## 总验收补充

主流程已另行完成真实倒下/回营地、未达标首领拒绝、达标后实际进入首领地图，见 `../.design/global-ui-system/screenshots/system-combat-result.json`。暂停时toast暂时隐藏，避免入场文字压住继续按钮；养成/外观已采用各自的分支与衣装图形。最终0.7.3构建中的触摸操作和存档核对见 `release-verification.json`。战斗伤害数字、地标名称与掉落标签也已接入UI Token，未改变判定或VFX美术规则。
