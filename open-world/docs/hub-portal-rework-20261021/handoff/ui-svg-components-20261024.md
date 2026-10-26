# 公共组件 SVG 精修（2026-10-24）

用户认可当前页面，选择先精修「公共标题、资源胶囊、品质标签」。保留奶白浅金、页面布局、交互、字体与正式图标，不新增动画。

## 已实施

- `ui/component-art.ts` 集中提供圆徽、标题底牌、资源胶囊、切角标签四种 SVG 底板；全部使用现有 Token，无下载素材、滤镜、全局 SVG ID 或 defs。
- `panelHeaderHtml` 继续使用原徽记图标和真实 HTML 标题；装饰在已有框内定位，不参与尺寸计算。对白继续隐藏徽记与标题装饰。
- `resourceAmountHtml(...,{pill:true})` 接新轮廓与内沿，金币/经验/强化石沿用原图标；数字、0/未知值和末尾数值容器结构保持。
- 稀有/传说、NEW、HEX 标签保留原语义色及 HTML 文字。多个标签从图标内移到独立标记行，避免覆盖道具主体。
- CSS 仅通过统一 `ui-entry.css` 加载，沿用生产层序检查；修正委托页局部阴影可能与 SVG 底边叠加的问题。
- 验收页增加「SVG · 公共组件」「SVG · 长文与零值」两项，复用正式渲染函数与真实装备 ID。当前共有 41 个状态样例。

## 验证

- [x] `node tools/build-ui-tokens.mjs --check`，478 个 Token 一致；本轮没有新增样式数值。
- [x] `npx tsc --noEmit -p .`。
- [x] 9 文件 / 40 条相关单测通过，覆盖重复 SVG、装饰隐藏、真实 HTML 文字、0/未知资源、品质标签、长文本与层序。
- [x] 内存生产构建通过，10 个 HTML 入口的层序检查通过。
- [x] 2026-10-24 23:02（Asia/Shanghai）云测试服发布完成，线上健康/内容/构建版本与游戏/QA/组件展示/战棋入口层序核对通过。

单测：`npx vitest run tests/ui-component-art.test.ts tests/ui-components.test.ts tests/ui-direction-a-primitives.test.ts tests/ui-controls-layout.test.ts tests/ui-dialogue-layout.test.ts tests/ui-direction-a-u5.test.ts tests/ui-cascade.test.ts tests/ui-direction-a-u4.test.ts tests/ui-direction-a-u6.test.ts --maxWorkers=1 --no-file-parallelism`。

另用 SVG 代码生成部件 PNG 绘制预览，已在对话展示；这是矢量绘制稿，不是浏览器截图，预览图片未入 Git。继续遵守不运行浏览器/无头自动化的约束，不把源码和构建验证表述成真机视觉通过。

## 真机检查

1. 公共标题短文、长文及两行标题，徽记、文字、关闭按钮分别占位；对白仍无标题底牌。
2. 三种资源在普通/紧凑胶囊、大数值、0/未知值下不压字；委托/结算页没有双重底边。
3. 稀有/传说、NEW、HEX 同时出现时只占标签区，不遮道具图标；文字可读。
4. 连续切换面板、悬停/按下/禁用/忙碌状态与减少动态设置，装饰不拦点击，也没有新增动画。

代码提交与发布源码：`7e9818b7fcac919648385be5fb60bc3902b03c7f`。发布命令：`node tools/deploy-staging.mjs --remote-web --skip-api --no-mirror`。线上 CSS 已确认包含新 SVG 组件样式，四个核对入口的首建层顺序均为 `tokens → legacy → components`；`/api/health`、`/api/content`、`/build-info.json` 版本一致，build-info 指向上述源码。未提交图片或构建产物，未改其他会话的工作区改动。

验收：[SVG 公共组件与长文/零值样例](https://43-165-179-11.sslip.io/u4-u6-qa.html)。本轮默认打开「SVG · 公共组件」，工具栏可切到「SVG · 长文与零值」及原有页面。
