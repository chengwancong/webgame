# 全界面挤压与文字重叠修复（2026-10-24）

用户反馈：对白截图中标题压到头像，且要求检查所有界面，防重叠应作为统一要求。

## 已定位原因

1. **全局生产 CSS 层序倒置**：`growth-feedback.ts` 直接导入 CSS，Vite 将其抽为最先加载的 `CraftingPanel-*.css`。这份样式先创建 `components`，随后 `ui-entry` 中的声明无法重排已经存在的层，实际顺序变成 `components → tokens → legacy`。线上 HTML/CSS 只读解析已确认该顺序，旧面板宽度、内边距和标题字号因而盖过新布局。此前检查了源码和单测，遗漏了生产分片加载顺序，这是上一轮验收缺口。
2. 人物页方案栏直接进入旧两行网格，推动纸娃娃、属性区和页脚错位。
3. 公共文本按钮、页签及缎带标题固定高度，长文换行后可能越出容器。
4. 港口详情与航图固定高度卡片没有完整内部滚动链；航图锁门来源声明网格跨列，但父级实际是 flex，文字与条件挤在一行。
5. 对白头像和姓名牌依赖绝对偏移；旧样式一旦压过空间预留，内容会重叠。旧验收样例手写简化头部，没有复现真实公共标题结构。

## 修复

- 样式回归 `ui-entry.css` 统一导入；Vite 给所有 HTML 入口在样式前插入统一层序，并在生产产物阶段按实际标签顺序解析 CSS 检查。错误层序直接阻止构建。
- 对白改为显式头像/内容双列，姓名牌进入文档流；无头像旁白使用单列，标题/正文/操作可换行且内部可滚动。对白内容和翻页流程不变。
- 人物方案栏单独占首行，装备/属性/换装保留主内容行，页脚独立。
- 文本按钮/页签/长标题使用既有最小高度与字号，图标/关闭按钮保持固定槽位。
- 港口详情、航图节点主体内部滚动，锁门来源单独跨一行，保留固定卡片布局和全部信息。
- QA 使用真实人物整屏和真实对白增强器，补换装、长标题长对白、无头像状态；示例切换时卸载对白观察器和键盘监听。
- 全界面要求已写入根 `项目.md` 和 `AGENTS.md`。

## 审查范围与边界

已按源码和生产产物审查：公共标题/按钮/页签/表单、登录建角、设置、HUD、对白、背包、人物、技能、养成、工坊、任务、远行、主城、航图、战棋侧栏与结算。未更改棋盘、技能栏动效、玩法、数据结构或存档。

继续遵守本任务“不运行浏览器或无头自动化”的要求。本次依据用户截图、真实生产 HTML/CSS、整屏样例及静态回归；不宣称全部页面已完成真机视觉检查。

## 验证与发布

- [x] Token check / tsc 通过。
- [x] 12 个相关 UI 测试文件、111 条测试通过，包括生产层序反例、长文本尺寸、人物网格、对白布局、港口/航图长内容。
- [x] 内存生产构建通过，10 个 HTML 入口全部执行层序检查；`publicDir:false` 不打包/修改既有图片与字体。
- [x] 云测试服于 2026-10-24 22:39（Asia/Shanghai）发布完成，健康/内容/构建版本及线上 11 个入口层序均核对通过。

代码提交与发布源码：`7f77b17c133b06ef8283438389d28fbf0bc40966`。命令：`node tools/deploy-staging.mjs --remote-web --skip-api --no-mirror`。云端隔离构建包含战棋预览，产物阶段检查通过；线上 `index.html`、`ui-system.html`、`ui-direction-a-qa.html`、`u4-u6-qa.html`、`ui-v2-showcase.html`、`open-world-five-art-qa.html`、`open-world-art-qa.html`、`world-art-qa.html`、`story-npc-qa.html`、`starsea-art-qa.html`、`tactical-board.html` 均通过按实际 HTML/CSS 标签顺序的只读解析，首建层顺序全部为 `tokens → legacy → components`。

`/api/health`、`/api/content`、`/build-info.json` 一致返回 client `0.11.57` / protocol `57` / rules `ow-97` / assets `world-art-20261007-v24-world-runtime` / db `19`，build-info 源码与本轮发布提交一致。未读取输出口令，未清库或修改正式角色数据，未提交图片/构建产物，其他会话改动保留。

额外执行 `tests/starsea-dialogue.test.ts`，2 条中 1 通过、1 失败，失败位置为第 15 行对 `newStarseaState().quests['ss-c01-t01']` 的初始化断言。已用执行前 `a26cb1c7` 的独立 `git archive` 源码快照复现同一失败，不涉及本轮 UI 文件；未删除断言、未修改剧情规则。整体此次命令结果为 112 通过 / 1 既有失败，不能写成全部测试通过。

UI 测试命令：`npx vitest run tests/ui-cascade.test.ts tests/ui-controls-layout.test.ts tests/ui-character-layout.test.ts tests/ui-dialogue-layout.test.ts tests/ui-components.test.ts tests/ui-direction-a-primitives.test.ts tests/ui-direction-a-u4.test.ts tests/ui-direction-a-u5.test.ts tests/ui-direction-a-u6.test.ts tests/hub-panels.test.ts tests/title-mute.test.ts tests/hud-avoidance.test.ts --maxWorkers=1 --no-file-parallelism`。生产构建通过 Vite API 使用 `build({configFile:'apps/web/vite.config.ts',publicDir:false,build:{write:false}})`，不启动浏览器、不改本机服务。

## 真机统一检查

1. 同一界面分别显示短文和长文，标题/头像/姓名/正文/按钮不互相遮挡，正文不缩小。
2. 连续悬停、选中、禁用、忙碌和错误状态，按钮图标不跳位；操作文字只显示一个状态。
3. 1280×720 下内容增长只在所属区内滚动，末行信息和主操作可到达，关闭按钮不被挤走。
4. 人物有/无方案栏以及换装态切换，方案、主区、页脚分行；对白短文、长文、回看、无头像分区稳定。
5. 港口四阶详情、航图完整节点及锁门来源，长条目不裁切、不压缩字号。
6. 除本次确定问题外，所有其他生产页按上述统一标准连续切换检查，发现新的实机问题按具体面板补回归。
