# SVG 第二批：按钮、页签、提示与状态（2026-10-24）

用户在第一批公共标题/资源/品质标签完成后要求继续。此批沿用相同奶白浅金语言，复用 `component-art.ts/.css`，不改变页面布局与交互流程。

## 改动

- 公共文字按钮：新增 SVG 内沿、短高光与角线；背景、尺寸、按压位移/底边和焦点继续由原 controls 控制。图标按钮不加底板，禁用时隐藏装饰，忙态文字占位不变。
- 页签：仅选中且未禁用时显示轻内轮廓。保留键盘顺序、选中语义、计数和标记；人物出战方案手写页签也接同一 SVG。
- 提示条：切角奶油底牌替换旧底图，继续使用原位置、队列上限、到期时间、sticky 与透明度进出。图标和文案仍在独立内容层。
- 空/加载/错误/成功：分别绘打开空箱、罗盘沙漏、提示纸页、勾章。使用原 48px 槽位；加载保持原文案和 `aria-busy`，新插图静止，不让整张罗盘旋转。
- 所有 SVG 无全局 ID、defs、滤镜、图片、SVG 文字及新动画；装饰不接收点击。CSS 仍只由统一入口加载，使用既有 Token。
- QA 新增 6 项：按钮/可点击页签、提示条、四种状态；当前共 47 个状态样例。预览图为 SVG 直接绘制的部件展示，非浏览器截图，图片不入库。

## 验证

- [x] Token check（478 个 Token）与 tsc 通过。
- [x] 相关 UI 回归 13 文件 / 70 条通过；补充人物布局 2 条通过，共 72 条不同测试。人物方案接线后的 3 文件 / 13 条复验通过。
- [x] 生产内存构建通过，10 个 HTML 入口层序检查通过。
- [x] 2026-10-24 23:32（Asia/Shanghai）云测试服发布完成，健康/内容/构建版本与游戏/QA/组件展示/战棋入口层序核对通过。

UI 回归：`npx vitest run tests/ui-svg-feedback.test.ts tests/ui-component-art.test.ts tests/ui-components.test.ts tests/ui-controls-layout.test.ts tests/ui-direction-a-primitives.test.ts tests/ui-dialogue-layout.test.ts tests/ui-direction-a-u4.test.ts tests/ui-direction-a-u5.test.ts tests/ui-direction-a-u6.test.ts tests/ui-cascade.test.ts tests/hud-arbitration.test.ts tests/hud-avoidance.test.ts tests/progression-ui-system.test.ts --maxWorkers=1 --no-file-parallelism`。

人物接线复验：`npx vitest run tests/ui-character-layout.test.ts tests/ui-direction-a-u5.test.ts tests/ui-svg-feedback.test.ts --maxWorkers=1 --no-file-parallelism`。

## 真机检查

1. 主/次/危险/禁用/忙碌按钮，长文不溢出，按压与焦点占位稳定，装饰不拦截点击。
2. 横向/纵向/出战方案页签连续切换，选中装饰正确，文字、数字和红点不重叠。
3. 提示条最多三条、原右中避让区不变，普通提示到期消失，sticky 连接提示保留。
4. 四种状态的插图、原文案与操作一致；加载图静止，减少动态有效；正式技能与装备图未替换。

继续遵守不运行浏览器或无头自动化，不将静态/构建检查表述成真机视觉通过。

代码提交及发布源码：`ea8ab4250b1eb9fe74ff3f06cc049219f588da74`。命令：`node tools/deploy-staging.mjs --remote-web --skip-api --no-mirror`。云端隔离生产构建通过，线上确认 control/toast/state SVG 样式存在，四个核对入口首建层顺序全部为 `tokens → legacy → components`；健康、内容与 build-info 版本一致，源码指向上述提交。没有提交图片/构建产物，其他会话改动保留。

验收：[第二批组件样例](https://43-165-179-11.sslip.io/u4-u6-qa.html)，默认打开「SVG 2 · 按钮与页签」，可切换提示条和四种状态。
