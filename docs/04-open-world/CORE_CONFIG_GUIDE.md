# 大世界唯一配置源

本指南只适用于 open-world，旧版核心配置指南保持原状。

|领域|唯一源|消费方|
|---|---|---|
|区域、碰撞、出生点、入口、据点|packages/content/maps/*.json（Tiled）|导航、世界、服务端授权、渲染|
|技能机制、参数、自动范围、刷新与上报|packages/content/index.ts|核心、界面、服务端授权|
|装备行为效果|同文件 effects / effectText|核心执行、说明生成|
|等级属性、经验公式、装备底材、成长消耗|packages/rules/index.ts|仅服务端正式推导；模拟工具可调用|
|奖励金额、随机几率|apps/api/src/economy.ts|仅服务端，授权时保存私有快照|
|协议运行校验、分离版本|packages/contracts/index.ts|两端与工具|
|动画、帧、锚点、来源|tools/build_assets.py 生成 packages/asset-manifest/catalog.json|Phaser表现|

距离：导航格；地图编辑对象像素/32转换。冷却、前摇、持续：整数逻辑步（30Hz）。货币、经验、材料：非负整数。装备 rank 0–5、技能等级1–5。默认技能等级1；缺失或未知机制直接报错。

修改配置后 `pnpm content`、`pnpm test:core`；行为或端服变更运行 `pnpm check`。平衡使用同种子 `pnpm balance`；`--hp=...` 只克隆模拟输入，不改源配置。不要用 UI 文案代替规则更新。

服务端返回正式属性、成长预览；UI 消费预览中的成本和变化。奖励表不进入浏览器包。授权保存怪物与私有奖励参数；重新请求未完成轮次不重置可奖励来源。
