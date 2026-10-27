# 环境细腻像素与语义纠正交接（2026-10-28）

本子任务只写新源处理工具、候选像素和离线检查报告。未改 live manifest、公共渲染器、游戏数值、碰撞、世界 mask 或正式玩家数据；没有浏览器自动化、提交或部署。主代理负责最终合并、TSC、相关单测、显式路径提交与云测试服发布。技术校验不等于用户已经认可美术。

## 产物及范围

最终本组为 **546 个候选入口**，全部 scale=1；生产实际读取 95 个源族（包括复用已批准的港口源），选定新源表 94 项。整组项目像素校验、物理契约校验均为零问题；26 个 cliff 的 alpha 逐像素不变。最终候选位置：

- `.runtime/pixel-coherence/environment-v2/candidates.json`、`keys.json`、`mapping.json`
- `.runtime/pixel-coherence/environment-v2/final-adjudications.json`：逐项裁决主代理最后的 88 条差集，不以脚本选中范围的 `retained=0` 冒充全盘完成。
- `.runtime/pixel-redraw/candidates/art-pixel/environment-fine-v2/`：本批候选 PNG；不提交 PNG、contact、原始生成稿、raw JSON 明细或 ZIP。

最后 88 项差集裁决结果：32 项由本组替换、29 项由独立 world-states 组处理、27 项明确保留已核素材；未决 0，组间 key 重叠 0。`retained.json=[]` 只表示本脚本选中范围没有缺源，不能替代这份全盘裁决。

共 94 个选定新源。自然物初稿的树冠被裁、叶片写实碎密，已拒绝并按已批准的 meadow-v2 风格重新编辑；新的叶团、岩面是大面积连通明暗簇，并非仅删除单点。建筑、残拱、低祭坛、栅栏、帐篷以及追加设施均按完整轮廓检查后处理。4 张地下/天空背景与 4 张岩面材质为有意的全幅不透明源，其余源不允许主体触到裁切边界。

本轮覆盖树石花草、真实建筑/设施、原分类漏掉的 12 件建设装饰和工坊三档、主题门、剧情器物、矿点/机关/门/宝箱状态、地图 glyph 和星图、地下背景/星海天空、26 件悬崖装饰，以及 `world-props` 总 atlas 的全部九个 tile。旧的每物件别名与总 atlas 都处理，不能只修一端。

## 正确语义与外观

旧脚本曾把 house/column/altar 分类内的不同设施分别填成房子、石柱和传送门。本轮按原图和资源名核对：起重机、水车、熔炉、冷却槽、管阀、钻机、维修台、升降台、灯塔、风车、钟塔、观星台、碑刻和炮塔等分别使用相符的新源。`ss-prop-postal` 为告示牌，contract 为合同卷轴，node 为翼晶台，core 为核心球，log 为冰封日志，testimony 为证词夹板，ice-anchor 为冰锚。

`ss-prop-refugee` 虽然资源名是“平民站位标识”，实际原图是带提灯的旅行布包；本轮按原图的道具身份重新绘制，不再错误换成站立 NPC。`ss-prop-cargo` 使用平盖封印木箱的闭合/打开两种新源，和弧顶的普通宝箱分开。

地城/首领门分为航海绳索、龙骨、炉铁齿轮、冰石、根与蘑菇、断裂暗石六套主题；不能全部套蓝色魔法漩涡。入口变体保留各自资源键并加同区域器物作视觉区分；共享传送门和主星门才沿用原已认可的魔法门源。小地图 chest 单独绘成原生小 glyph，不拿大型地面宝箱撑成 UI 标记。

建设装饰逐项对应：工具挂架、矿石箱、配方摊、铜铃齿轮招牌；码头灯、二队小艇、星图测绘台、旗帆艇；圆邮筒、委托板、双旗、鸽笼邮车。工坊使用完整红顶炉屋；第 2 档加贴地工具架，第 3 档加有落地基座的动力设施，不再把完整小楼悬在烟囱上。宠物小院原平涂棚栏也替换为新围栏与蓝色遮蔽棚组合，保留原 144×128 和锚点。

## 物理与状态契约

以开始生产时当前 live manifest 的 `frame × scale`、`anchor × scale` 作为物理目标，已是 scale=1 的条目绝不再乘 2；原有 scale=2 小源转换一次为等效物理尺寸的 scale=1 新画格。全部原 `original` 路径、batch、kind、baseOrigin、defaultFrame、帧名/帧位置、效果时钟保留，原图不改不删，关闭开关由原公共接缝恢复原画。

门的 locked/opening-N/open 和静态 opening.png 别名分别处理；静态 opening 别名为半开，不误作锁门。宝箱 hidden 是半埋状态，glint 有原序列亮点，opened 使用专门重画的空箱；手工黑矩形遮金币的尝试已弃用。beacon 的 damaged/critical 递减玻璃亮度并保留破损纹，broken 留支座；pylon broken 留断座；binding 的闭合和 released 有可见开合差异；管道 broken 有真正断口。星图保留六节点及其相对位置，fragmented 使用断续线，aligned 使用连续线。

26 件 cliff 只用原画的 alpha/大明暗面区作几何约束，重新填入专门新绘的砂岩、花岗岩、冰壁、玄武岩连通像素岩面，并作选择性 1px 轮廓。校验逐像素比较 alpha；不改岸线、洞口、碰撞或 world mask，也不再保留旧的整块平涂条纹。

## 来源与生产

使用内置 image_gen，未下载字体。工业大设施没有找到语义和原生尺寸都合适的 CC0 来源，故用新稿；新生成稿不标为开源或 CC0。原画只作为轮廓与功能参照，没有将原厚涂插画量化后冒充重画成品。

风格参考为 `.runtime/pixel-coherence/misc/v2/travel-meadow-native.png` 和用户蓝橙港口参考图。提示集的共同要求：真透明背景、独立完整轮廓、充分留白、左上光、3–5 个大明暗面、连通像素簇、无写实颗粒/渐变/柔光/文字。分组题材为自然9、建筑4、设施4、地牢9、工业9、遗物9、航海地标6、碑刻9、剧情道具9、背景4、岩面4、建设装饰9、空箱精修、主题门/货箱/旅行包9。被拒的自然/工业写实稿和裁切稿没有接入。

选定源文件、精确裁切坐标、网格恢复参数和完整轮廓结果写在 `tools/pixel/fine-environment-source.py` 与运行时 `sources.json`；生成稿复制在工作区 `.runtime/pixel-coherence/environment-v2/`，不只保留在 Codex 生成目录。新稿先用本机 proper-pixel-art 恢复网格，再经公共 64 色量化、二值 alpha 和像素轮廓清理。程序 glyph/地图/光斑直接按原生像素绘制，不属于把原插画压方块。

## 复现与验证

在项目根目录按顺序运行，重任务只跑一个：

```powershell
& G:/webgame/aw-third-party/pixel-tools/.venv/Scripts/python.exe tools/pixel/fine-environment-source.py
node tools/pixel/fine-environment-build.mjs
node tools/pixel/fine-environment-check.mjs
node tools/pixel/fine-environment-inspect.mjs
node tools/pixel/fine-environment-adjudicate.mjs
```

`check` 运行项目 `check-pixel-art.mjs` 的整组像素校验，并逐项核对物理 frame、anchor、imageSize、全部帧名/坐标、原路径、baseOrigin、defaultFrame 和效果元数据；另逐像素核对 26 cliff 的 alpha。TSC 和全套/相关单测由主代理串行处理，不在子任务重复并发。

离线检查图：`states-contact.png`、`construction-contact.png`、`legacy-atlas-contact.png`、`cliff-before-after.png`、`backdrops-contact.png`、`gate-themes-contact.png`、`last-audit-props-contact.png`、`families-*.png`。小物件 contact 的最近邻检查放大只发生在预览，不改变游戏候选和 manifest。

## 保留与分工

world-states 的桥梁、封印、残骸、补给车、驻所、界桥装置/供能器、飞艇与覆雪失事船壳由 fine_monsters 独立 29-key 组负责，本组明确排除，最终检查交集为零。它们不能因旧 recipe 不在 supported 中而静默留旧图。

已逐项确认可保留的例外为：港口原生小地图标记；正确用途的两处 pier；三个 NPC 摊位；衣橱；主星门/共用传送门；六处营火；六处营地货堆；六处前哨补给箱。这些沿用已经离线批准的高密度源，不将“同源可用”扩大为“所有曾用它的错误映射也可用”。完整逐键裁决在 `final-adjudications.json`，不能只看 selected 范围的 `retained.json`。

## 给 Grok 的真机检查

1. 港口及各岛核对树石、房屋、设施和全部 12 建设装饰的实际功能；工坊 1/2/3 档应有落地结构和清楚差异，宠物小院不能回到无细节木棚。
2. 六主题地城/首领门与入口变体：骨、炉、冰、根、裂隙和航海各可辨，不能都变蓝色漩涡；主星门/共用传送门的正确魔法表现保留。
3. 门 locked→opening→open、cache hidden/glint/opened、cargo 开闭、beacon 三段受损/broken、pylon broken、binding released、断管：应按真实状态变化，不显示相同静态图，不改原动作/状态时钟。
4. 六节点星图断续/连续线与地图 glyph：文字仍由原 UI 清晰显示，小标记不撑大控件，关闭像素模式恢复原图。
5. 悬崖与岸线、洞口、桥接区域：画面岩面更细，但可见轮廓和碰撞保持；检查近岸视角和各岛主题，不产生新几何缺口或遮挡角色脚底。
6. 普通世界、地下三主题与星海天空切换时，检查世界 atlas 九个 tile、锚点、alpha、材质密度与最近邻清晰度；反复开关画风后必须完整恢复原样，最终视觉不达标对象另记，不能用技术通过替代验收。
