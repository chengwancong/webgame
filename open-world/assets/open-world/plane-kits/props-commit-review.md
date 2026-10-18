# 三套装饰物提交复核（2026-10-18）

范围：14 件摆件、3 灯、2 柱。cave：s1–s3 小蓝晶簇/青绿菌/苔痕碎石，m1–m3 大蓝晶簇/翻倒矿车/层纹石笋，挂灯。crypt：s1–s2 骨灰坛/三烛石台，m1–m3 石棺/残碑/三头烛台，壁挂火盆、描金方柱。maze：s1–s2 苔石/符石界碑，m1 藤蔓断柱，菱形符石灯、长苔方柱。

同 ID 与灰盒 canvas/anchor/displayWidth；正式清单接线只替换 19 个文件，保留另外 18 件灰盒，不修改随机场地、碰撞和渲染规则。内置 image_gen 原图及发布 PNG 仍只在本机；提交提示词、哈希、变换参数、规格和构建校验脚本。

提交前校验：

- `npx vitest run tests/plane-scenes.test.ts tests/plane-layouts.test.ts tests/plane-gates.test.ts`：3 文件、16 项通过。
- `node tools/verify-plane-prop-art.mjs`：19 件完整 contract、画布、锚点、显示宽、透明留边及文件哈希通过。
- `node tools/verify-plane-kit-art.mjs --allow-pending`：契约通过、0 错误；总包原有范围外占位/接缝缺口 210 条，不宣称总包美术全部完成。
- `npx tsx tools/verify-plane-prop-runtime.ts`：19 替换、18 保留；默认 12 种子 × 6 场景的四侧墙面、cave 四侧岩台及原向/镜像检查。
- `npx tsc --noEmit --pretty false`：只有用户已知 `tests/plane-gates.database.test.ts:28` 的 TS2339 / TS7006，按授权忽略；未修改测试来绕过。

浏览器使用三个 stage-1 的 `&calm=1&seed=random`，每套刷新两次；六次页面均无 console error。可复现种子：cave 412872777 / 583612501；crypt 1617087889 / 592329932；maze 1954074252 / 2146156021。截图及原始浏览器记录仅在 `docs/reviews/plane-world-20261018/`，不提交。

方向覆盖边界：现行 `dress` 只向 +x/+y 两个面向镜头的墙面挂灯，crypt/maze 挡路件只靠 -x/-y 后墙；没有四张独立方向图，也未修改该规则。墙和 cave 岩台的四侧均覆盖。随机样本没有摆放 maze pillar，因此该件的证据为契约、透明边、运行时解析及素材图检查，不冒称随机场内目视通过。随机布局数据覆盖到其余 18 件；六张实机截图覆盖各自出生点视野，不等同于 18 件全部目视。

复建需要本地 PNG 原图：`node tools/build-plane-prop-art.mjs`。通用入口 `node tools/build-plane-kit-art.mjs --allow-pending` 已在末尾接入专用小画布导入，避免退回旧 528×528 规格。管理工具在没有本地 production-state.json 时自动初始化生产记录；生产日志不入库。
