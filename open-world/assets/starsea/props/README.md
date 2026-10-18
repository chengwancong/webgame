# 星潮海任务物件与公共集成

设计版本 `starsea-20261003-d1`。本组24ID、50状态、22张保存于工程的手绘原始PNG（含开箱、解扣、破损管、破损阀、破损引擎5个物理变体），8份代码原生SVG。PNG透明trim、比例缩放与8px边距为技术导入；未用程序重画位图。知识确认状态明确采用同一实物图＋剧情UI记录。能源运行采用显式程序灯层，低能/离线有材质差异；界桥独立程序星潮层仅作装饰，没有伤害边界。

`source-inventory.json`记录先查正式环境/物品注册及NPC附件的9项来源、哈希和未冒充任务物件的理由。每张新图的完整提示词及原生成路径在`source/*.json`；运行不依赖Codex生成缓存。`manifest.json`登记每状态的URL、大小、足点、图差异、程序层、使用任务与来源。

## 复建与查看

在open-world根运行：

```powershell
node assets/starsea/props/build.mjs
node tools/build-starsea-assets.mjs
node tools/verify-starsea-art.mjs --isolated
node assets/starsea/props/seal-review.mjs
```

正式入口 `/starsea-art-qa.html` 直接使用六组骨架/图集、13份地图JSON及真实技能播放器。演员尺寸保持100/80/90/110/150px基线，不按透明画布误缩；角色工具在原生附件中，不另贴overlay。首领死亡高于阶段，B3排气读实际`ss_exhaust`骨。世界航图为静态六节点选择，不写章节解锁或模拟自由驾驶。

公共包在`packages/asset-manifest/starsea.v1.json`与`/art/starsea/manifest.json`。`starsea:assets`与正常生产build包含本包及Vite入口；`starsea:validate`检查ID闭包、文件SHA、尺寸、URL与必需状态/动作；`starsea:verify`保存1280×720实际操作证据。源角色、特效、场景问题交回其所有者，不在集成层篡改素材。

## 状态与证据

`evidence/states-contact.png`是50状态的源图对照，能量程序层及撤离隐藏以实际页为准。`evidence/producer-review.json`只封存本组实际浏览器和文件自检；任何源图或运行文件变化会使复建自动退回producer-review-pending。主代理独立验收另记，聚合包始终区分资源存在、制作自检与剧情接入；新故事未替换当前正式主线。

生产发布遵守停止托管服务→构建→恢复，随后检查health/content与客户端兼容、真实账号登录/已有会话恢复以及旧角色、回执、流水保留。证据在`assets/starsea/integration/evidence/`，不以HTTP 200代替实际登录。
