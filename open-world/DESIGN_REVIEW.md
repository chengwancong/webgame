# 装备 TIPS 历史审查

> 本文记录 2026-09-30 的当时问题。当前装备对比与 Tips 已读取服务端解析的强化和角色变化，不能把 P1 的旧本地减法代码当作当前实现；2026-10-03 的数值与实机复核见 [数值审计](docs/balance-audit.md)。

日期：2026-09-30。范围：装备提示与相关装备对比，先查找和总结，不修改实现。

审查依据：现有蓝金卡通奇幻方向、`docs/05-art/ui-v2-implementation/README.md`、当前装备规则与服务端预览。主要场景是桌面游戏，1280×720 与 1024×576；平板／手机截图仅用于检查提示的边界能力，不视为整套游戏移动端验收。

实际启动当前源码、真实 PostgreSQL 与浏览器验证。强化 +3、锁定装备与一件待领取奖励由独立测试库初始化，专门复现显示状态；常驻玩家库未使用。原始数据、源码哈希和清理结果在 [audit.json](screenshots/equipment-tips-20260930/audit.json)。本轮实现文件审查前后哈希一致，无页面错误，临时数据库已停止并清理。

## 总结

问题集中在数值口径、内容一致性和提示生命周期。最严重的是强化装备的本地对比与服务端结果方向相反；其次是掉落图标内部移动会隐藏提示，以及键盘选择后焦点丢失。现有 TIPS 是通用文字框，尚未形成统一的装备信息卡。

## 必须优先修复

### 1. P1：强化数值与装备对比口径不一致

测试角色原本装备基础苍风之刃，浏览未装备的穿云弓 +3。TIPS 标题正确含有 `+3`，但属性仅显示基础攻击 7、护甲 0，没有区分基础值与强化贡献。

| 展示位置 | 实际显示／服务端结果 |
| --- | --- |
| 穿云弓 +3 TIPS | 攻击 7、护甲 0 |
| 右侧本地对比 | 攻击 9 → 7（-2），护甲 0 → 0（0） |
| 服务端换装预览 | 角色攻击 21 → 25（+4），护甲 4 → 7（+3） |

本地对比没有计入强化贡献，会把实际提升显示为下降。服务端正确结果虽然也被写入右侧更下方的预览区，但 720p 下可能需要滚动才能看到，首屏醒目的红色减益更容易误导判断。

位置：`apps/web/src/presentation.ts:279`、`:281`、`:318`；正式规则在 `packages/rules/index.ts` 的 `resolveBuild`。证据：[upgraded-bow-comparison.png](screenshots/equipment-tips-20260930/upgraded-bow-comparison.png)。

处理方向：基础属性、强化贡献与生效属性明确区分；对比采用同一份服务端解析结果，不能在客户端另写一份强化规则。

### 2. P1：掉落图标内部移动会导致 TIPS 消失

悬停掉落装备图片后，鼠标移到同一个按钮的边框区域，按钮仍满足 `:hover`，但提示变成隐藏。因为 body 捕获子元素 `mouseleave`，只要子元素的 `closest('[data-tip]')` 找到按钮，就直接执行 `hideTip()`，没有检查鼠标是否真正离开提示宿主。

位置：`apps/web/src/presentation.ts:56`。证据：[drop-preview-tip.png](screenshots/equipment-tips-20260930/drop-preview-tip.png)、[drop-tip-padding-movement.png](screenshots/equipment-tips-20260930/drop-tip-padding-movement.png)，原始检查 `drop-image-to-padding` 为 `parentStillHovered=true / visible=false`。

注意：背包图片有 `pointer-events:none`，同样的“图片到边框”操作在背包格子里本轮没有复现。不要把所有装备入口都笼统归为同一现象。

处理方向：提示归属按钮本身，判断 relatedTarget 是否仍在宿主内部，再决定隐藏。

### 3. P2：键盘选择装备后焦点丢失

聚焦装备格并按 Enter，选中状态更新成功，但整块面板被重新创建，`document.activeElement` 变成 BODY，TIPS 同时隐藏。下一次 Tab 会重新从面板起点开始，连续比较装备的键盘路径被打断。

位置：`apps/web/src/main.ts:179` 与 `renderPanel()`。证据：`audit.json` 的 `keyboard-selection-after-render`，记录 `selected=true / activeTag=BODY / visible=false`。

处理方向：根据装备实例 ID 恢复焦点，并在重新渲染后恢复当前有效提示；避免把提示状态完全交给 DOM 节点生命周期。

## 应修复的问题

### 4. P2：鼠标与键盘没有统一的提示归属

键盘焦点保持在装备 A，鼠标查看装备 B 后移开，所有提示被隐藏，A 的焦点提示没有恢复。当前 focus 和 hover 都调用同一个 show/hide，没有各自的激活状态。

证据：[keyboard-focus-tip-missing.png](screenshots/equipment-tips-20260930/keyboard-focus-tip-missing.png)，`bladeStillFocused=true / visible=false`。

处理方向：维护当前 hover 宿主、focus 宿主和显示宿主，定义优先顺序，鼠标离开时恢复仍有效的焦点提示。

### 5. P2：缩放后位置不跟随，长文案缺少边界兜底

1280×800 下提示的坐标是约 x=354、y=91。窗口缩为 1024×576 后，装备格移到约 x=244，但提示仍在原位置，出现与目标脱离的现象。继续缩为 375 宽后，提示右边达到约 418，超过视口。该桌面缩窗问题已实际复现，手机截图用于展示边界结果。

定位函数仅在触发 show 时计算一次，没有 resize／滚动更新；只有水平方向夹取和“上方放不下就放下方”，没有最终纵向夹取和最大高度控制。独立长文案压力样本的提示高度约 1546，底边超出 720 高度。该长文案不是当前正式装备文本，不作为普通装备的既有溢出故障。

位置：`apps/web/src/presentation.ts:39`、`apps/web/src/style.css:161`。证据：[bag-tip-1024x576.png](screenshots/equipment-tips-20260930/bag-tip-1024x576.png)、[bag-tip-375x812.png](screenshots/equipment-tips-20260930/bag-tip-375x812.png)、[long-tip-position-stress.png](screenshots/equipment-tips-20260930/long-tip-position-stress.png)。

处理方向：跟随宿主重新测量，增加上下左右避让、最终边界限制和长内容的可读策略。

### 6. P2：同一装备在不同入口的信息结构不统一

- 背包格子：名称／强化后缀、部位与特性混合在同一行、基础攻击／护甲。
- 已装备栏：例如只显示“武器”“苍风之刃”，缺少攻击、护甲和特性。
- 掉落预览：有独立部位、攻击／护甲、特性、可能掉落说明；属于模板预览，不能套用已拥有实例的锁定／装备状态。
- 已拥有装备的锁定、已装备、强化上限等状态没有形成完整的 TIPS 信息区；一部分只在格子小标记或右侧面板出现。

位置：`apps/web/src/presentation.ts:279`、`:294`，`apps/web/src/travel-browser.ts` 的 `renderTravelDrops`。证据：[upgraded-bow-tip.png](screenshots/equipment-tips-20260930/upgraded-bow-tip.png)、[equipped-slot-tip.png](screenshots/equipment-tips-20260930/equipped-slot-tip.png)、[drop-preview-tip.png](screenshots/equipment-tips-20260930/drop-preview-tip.png)。

处理方向：统一装备提示模型，区分“已拥有实例”和“可能掉落模板”，各入口复用同一组件，按上下文展示有效字段。

### 7. P2：待领取装备缺少属性 TIPS

待领取列表只有装备名称、地区和特性；唯一的 `data-tip` 挂在领取按钮上，内容是“领取到行囊”。领取前不能查看该装备的攻击、护甲或完整说明。

位置：`apps/web/src/presentation.ts:304`。证据：[pending-reward-no-equipment-tip.png](screenshots/equipment-tips-20260930/pending-reward-no-equipment-tip.png)。

处理方向：待领取装备名称／图标也接入统一的实例 TIPS，领取按钮保留操作解释。

### 8. P2：缺少可访问性关联

提示容器有 `role=tooltip`，但装备按钮没有 `aria-describedby` 关联。穿云弓 +3 的按钮 `aria-label` 仍只是“穿云弓”，没有强化、锁定和属性信息。视觉上可聚焦出提示，不代表提示内容已与控件建立朗读关联。

位置：`apps/web/src/ui-components.ts:17`、`apps/web/src/presentation.ts:39`。证据：`upgraded-locked-tip` 记录 `ariaDescribedBy=null`。

处理方向：为当前宿主关联提示 ID，完善实例名称与状态标签，并定义 Escape 关闭提示与关闭面板的层级。当前 Escape 直接关闭背包；这部分属于交互策略待统一，不单独算程序错误。

## 视觉与维护方面可以改善

### 9. P3：通用小文字框未形成装备信息卡，展示页与实机实现分离

当前样式基本是 13px 文本、加粗名称和普通两列。名称、部位、基础属性、强化收益、特性与状态缺少清晰分区；没有悬停即可读的装备比较。基础背包第一行把“武器”放左边、“无特殊效果”放右边，语义不清楚。提示比游戏的蓝金装备面板更像通用帮助框。

组件展示页 `apps/web/src/showcase.ts:66` 另写了一套纯文本提示，不复用实机 JSON 结构和 showTip。它通过不代表装备 TIPS 的内容／交互通过。

处理方向：先统一数据与交互，再建立装备小卡的标题、状态、属性、强化、特性和对比层次；展示页使用同一组件与真实样例。

## 已有效的部分

名称和说明有 HTML 转义。当前基础提示能由悬停和键盘焦点触发。掉落模板已经来自只读服务端预览。服务端换装计算是正确的，并已有异步回包守卫。后续应保留这些基础，优先消除客户端展示口径与提示生命周期问题。

## 建议处理顺序

1. 统一服务端数值口径，修复强化与换装对比的误导。
2. 统一实例／模板装备提示模型，补齐已装备与待领取入口。
3. 修复宿主内部移动、hover／focus 归属、重绘后焦点恢复和定位。
4. 再统一视觉信息卡、快捷比较、可访问性与组件展示页。

本轮不新增品质、词缀或装备等级机制；建议均围绕目前已经存在的装备数据和行为。

## Screenshots Captured

均保存于 `screenshots/equipment-tips-20260930/`，逐张完成视觉检查。

| 文件 | 场景 |
| --- | --- |
| bag-tip-desktop-1280x720.png | 基础装备提示，主要桌面场景 |
| bag-tip-padding-movement.png | 背包格子内部移动，本轮提示仍可见 |
| upgraded-bow-tip.png | 强化／锁定实例的提示字段 |
| upgraded-bow-comparison.png | 本地减益与服务端提升的口径矛盾 |
| equipped-slot-tip.png | 已装备槽位信息缺项 |
| keyboard-focus-tip-missing.png | 焦点仍在但提示隐藏 |
| bag-tip-1280x800.png | 常规桌面提示位置 |
| bag-tip-1024x576.png | 缩窗后提示与宿主脱离 |
| bag-tip-768x1024.png | 平板边界诊断 |
| bag-tip-375x812.png | 手机边界诊断，提示越出视口 |
| pending-reward-no-equipment-tip.png | 待领取装备没有属性提示 |
| drop-preview-tip.png | 掉落模板提示的现有结构 |
| drop-tip-padding-movement.png | 掉落按钮内部移动后提示隐藏 |
| long-tip-position-stress.png | 合成的长文案边界压力样本 |
