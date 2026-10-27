# 世界状态与语义地标像素重绘 · 2026-10-28

本组是最终差集的独立补充，不修改环境 agent 脚本、正式 manifest、玩法状态或原素材。范围先写入 `.runtime/pixel-coherence/world-states/owned-keys.json` 并与环境 agent 排除，最终 29/29 入口、17 张去重 PNG，全部离线复核并设 reviewed:true。

## 原图与语义裁决

- `ss-scene-bridge` 与五岛 landmark-bridge 原图是平铺斜木板通路，无码头桩；古骨栈桥另有象牙护栏、石脚与木甲板。它们分别使用独立新源。
- world-bridge-broken/fixed 是同一绳索桥的断裂／修复状态。断裂源保留两个主要桥头和中间透明缺口；修复源为连续桥面。
- world-seal-closed/open 是同一双塔封印门。闭态门板合拢、锁芯完整；开态两扇门向内开启，入口清楚可辨，不用单纯换色表示开门。
- `ss-prop-bridge` 原图 `/art/starsea/props/ss-prop-bridge.png` 是黄铜拱门装置，**不是木桥或码头**；`ss-prop-supply` 是带双曲管的青晶供能器。rift-bridge-anchor 则是双支座与中央罗盘的锚台机械，三者不互相替代。
- `ss-scene-airship` 与五岛飞艇原图都有大气囊、悬挂吊舱、绳索和尾部螺旋桨。已纠正旧普通帆船替代。frozen-hull 原图是覆雪失事飞艇艇壳，保留长艇身、开放残舱、冰柱和着陆脚；普通搁浅帆船残骸只用于 `ow-art-wreck`。
- 四岛 landmark-depot 的正式来源是 outpost，保留炮塔、驻所、沙袋和紫旗。沉星岛 landmark-depot 的正式来源表明确 reusedAssetId=ss-scene-workshop、zone=供能厅，因此保留圆铜顶供能厅，不按名称强行换成帐篷。独立 rift-supply-depot 才是紫白军需帐篷。补给车保留车轮、篷布、货物与牵引杆。

## 生产与契约

内置 image_gen 以原图参考 atlas 和已认可的 meadow／monster V2 簇状尺度重绘 4 张草稿，拆成 16 种语义源；不是将旧小像素图放大。提示词与返回路径留在本机 `generation-record.json`，原图对照为 `reference-{bridges,seals,supplies,ships}.png`。

`fine-world-states-source.py` 先按全图连通区域归属找完整对象，再使用本机 proper-pixel-art 恢复网格，保留断桥的两个大桥头。不能直接按四格裁切：骨桥石脚会越格，简单裁切会截脚并把碎片混到断桥。随后使用公共 64 色板、二值透明和最近邻逐像素投影，在既定画布上重新生成。

所有目标按当前 live.frame×scale 转为 scale:1 **一次**；本组输入已全部为 scale:1，故 frame、anchor、imageSize 原值保持。original、baseOrigin、frames／atlasFrames、state／states／stateGroup 等字段逐项比较，不更换状态键或物理位置，不改导航碰撞。

候选在 `.runtime/pixel-coherence/world-states/candidates.json`，PNG 在公共 candidateRoot 的 `/art-pixel/world-states-v2/`。17 张最终原生尺寸总览为 `contact-native.png`；本组没有提交 PNG、参考图或原始明细。

## 最终检查

`node --import tsx tools/pixel/fine-world-states-verify.mjs --reviewed-contact` 对全部 owned29 同时核对元数据、最新 source hash、实际文件 SHA 和完整像素合同，结果 **29 项、17 图、0 issues**；真实报告为 `.runtime/pixel-coherence/world-states/final-validation.json`。

状态不是仅文件名不同：断／修桥像素差异 39.94%，固定桥一个主要连通域 15929px，断桥两个主要连通域 7718／7144px；封印闭／开像素差异 44.56%。断桥有真实缺口，修复后连续；拱门装置中心保持透空。最终图已经离线看过，仍不冒充真机验收。

复现顺序：`fine-world-states-audit.mjs` → `fine-world-states-source.py` → `fine-world-states-build.mjs` → `fine-world-states-review.mjs` → `fine-world-states-verify.mjs --reviewed-contact`。草稿已复制到本机 `world-states/drafts/`，不依赖临时目录作为正式资源位置。

## 真机检查

1. 在状态切换前后检查断桥的两座桥头、绳索断点与恢复后的完整桥面，人物导航位置不能跳动。
2. 封印开门后能看见打开的门和通道；关门时锁芯、合拢门板清楚，双塔底座保持原位置。
3. 港口飞艇必须有大气囊与吊舱；冰壳变体是失事艇壳；旧码头残骸必须保持破船身份，不能混用。
4. 界桥装置应为透空金属拱门，供能器为青晶机械，锚台为双支座罗盘；不得再出现同一木码头替代。
5. 驻所、供能厅、军需帐篷和带车轮的补给车同屏辨认，比例保持既定物理画布；关闭像素模式完整恢复原图。
