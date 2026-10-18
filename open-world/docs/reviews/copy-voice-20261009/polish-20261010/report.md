# 界面收尾验收 · 2026-10-10

本轮覆盖用户提出的七项界面收尾。只修改文案、布局、图标及只读显示投影；不修改伤害、成长、掉落、任务条件、剧情对白和任务文本。改前使用本轮开始时的当前工作区副本，包含当时已有的未提交界面；不是上轮 7956a4f 历史画面。

[打开完整前后对照](comparison.html)。所有游戏截图均由可见 Chrome（headless:false）实际操作取得，游戏视口为 **1280×720**，没有用合成图替代 GUI。

## 七项结果

| 界面 | 本轮处理 | 改前 | 改后 |
|---|---|---|---|
| 岛首领失败 | 零收益改成一句话，移除空左栏；最后一击及三条建议加现有手绘图标；删除小标题、首领编号及返回地点；无相关钥匙就隐藏 | [截图](evidence/before-failure-island.png) | [截图](evidence/after-failure-island.png) |
| 副本失败 | 紧凑零收益；最后一击和建议图标；只显示本场副本的钥匙碎片 | [截图](evidence/before-failure-dungeon.png) | [截图](evidence/after-failure-dungeon.png) |
| 成功结算 | 右栏收窄；真实首通标记显示“首次通关奖励已领取”；本场钥匙进度保留 | [截图](evidence/before-success.png) | [截图](evidence/after-success.png) |
| 副本目录 | 条目显示“推荐 Lv xx · 碎片 x/y”；删除详情中的重复关卡类别；钥匙预览说明改为“属性会随你的进度变强” | [目录](evidence/before-dungeons.png) · [预览](evidence/before-key-preview.png) | [目录](evidence/after-dungeons.png) · [预览](evidence/after-key-preview.png) |
| 装备 Tips / 对比 | 删除内部造型档位及词缀末尾 T1；武器特性用“擅长武技”等玩家语言；套装件数解释换上后增加/失去几件 | [Tips](evidence/before-equipment-tip.png) · [套装变化](evidence/before-equipment-compare-set.png) | [Tips](evidence/after-equipment-tip.png) · [套装变化](evidence/after-equipment-compare-set.png) |
| 航图 | 星晶旁增加悬停说明，解释每颗提升及集齐含义；底部简化为“裂星潮 0/6 · 怪物更强，掉落更好” | [截图](evidence/before-chart.png) | [截图](evidence/after-chart.png) · [星晶说明](evidence/after-chart-crystal-help.png) |
| 技能 | 流派标签旁增加公共帮助入口，悬停展示现有流派和连招说明；提示框向面板内弹出 | [截图](evidence/before-skills.png) | [说明截图](evidence/after-skill-school-help.png) |
| 任务 | 目标只显示一次；说明区只保留不同的原有背景；地点卡使用实际地图名，无地点则隐藏；无前后任务不显示关系块；删除当前任务的接取提示；页签改名“领奖核对”并说明用途 | [当前任务](evidence/before-tasks.png) · [待确认](evidence/before-task-pending.png) | [当前任务](evidence/after-tasks.png) · [领奖核对](evidence/after-task-pending.png) |
| 海域难度 | 当前档标签使用公共成功色绿底、白字；验证实际计算颜色 | [截图](evidence/before-sea-difficulty.png) | [截图](evidence/after-sea-difficulty.png) |

图标均来自现有手绘资源：最后一击按招式伤害类型选择招式图，控场建议使用眩晕招式图，生存建议使用护身印图，强化建议使用锤子图。没有新增美术，也没有改变建议选择或跳转规则。

目录碎片计数复用现有 stageKeyProgress，只新增可选的 materials/required 只读投影。数据库用例验证它与原配方接口相同、读取不改 revision 或金币、没有泄露私有掉落参数。相关钥匙由结算的副本阶段限定；岛首领不会查询并展示当前养成阶段的无关碎片。

## 验证

- [定向测试](tests-final.log)：7 文件、53 用例通过，其中本轮新增 9 条，覆盖零收益、钥匙归属、首通领取说明、现有图标与跳转、词缀数值不变、套装损失说明、任务去重/真实地点/隐藏关系、流派帮助、新禁用词及旧冻结元数据的显示名称。
- [类型检查](types-final.log)：通过。曾发现新增测试夹具少了 scope，已补齐并重跑通过，未改业务 schema。
- [配置检查](config-final.log)：6 本 Excel 与 JSON 一致，本轮未改工作簿或任务/对白数据。
- [内容校验](content-final.log)：通过，敌人招式 hint 118/118；[UI Token](tokens-final.log)：320 项通过。
- [文案盘点](inventory.md)：7301 条，禁用词 0、超长 0；新增“造型”“亲和”“T1/T2/T3”检查，白名单未增加。
- [完整生产构建](build-final.log)：通过，保留既有大 chunk 提示；构建在隔离源码/素材/文档副本执行，不绕过资源校验。
- [生产 GUI](after-production-browser.json)：3 项通过，验证登录、会话恢复、原角色和背包数量、客户端与 API 的版本一致。client 0.11.24 / protocol 34，rules ow-63、assets world-art-20261007-v24-world-runtime、DB 16 保持。
- 可见 GUI：[改前全流程](before-browser.json)、[改前界面补拍](before-ui-browser.json)、[改后界面](after-ui-browser.json)、[真实战斗](after-battles-browser.json)、[帮助框可见性](after-help-browser.json)、[最新岛首领图标](after-island-browser.json)、[最新副本失败图标](after-dungeon-failure-browser.json)、[改前套装变化](before-gear-browser.json)、[改后套装变化](after-gear-browser.json)。最终 [检查汇总](verification-summary.json) 记录 10 个通过的 GUI 验证档、57 张不同截图的实际尺寸。帮助框同时检查实际命中元素与面板内位置，不能仅以 DOM 可见替代画面复核。

战斗胜负、收益、钥匙碎片、再次入场均由真实 API/WS/执行器产生。高低装备、满包、当前难度及任务样本只在本轮临时验收库准备；这些画面证明界面行为，不作为自然养成或数值平衡结论。没有读写正式 8612 角色存档。

## 提交边界

工作区原有技能分系、天赋四树、战斗亲和机制、装备布局及其他美术修改未整体纳入本次提交。对混有旧工作的文件只选择本轮 UI 改动。任务页的相关公共标题/图标表现以及旧技能页的流派帮助作为独立 UI 变更纳入，不加入技能分系规则。

两处文案依赖尚未提交的新功能：GearDetails 的武器特性显示与 damage-zones 的新主手加成行。它们已在当前工作区改好，另保留 [精确文案补丁](dependent-labels.patch)，不为提交两句文字而把整套原有战斗规则纳入。本次提交的伤害说明渲染器也会把旧冻结的内部名称规范为“主手加成”，数值及作用标签不变。

当前完整工作区的检查、构建和 GUI 通过。另尝试脱离既有未提交依赖单独检查 HEAD + 本次暂存源码，发现既有主手导出、技能分系导出及未纳入副本的生成素材依赖，见 [独立快照类型诊断](selected-types.log)、[独立快照测试诊断](selected-tests.log)；不把这次尝试标为通过，也不为消除它而提交用户的规则改动。

## 环境收尾

本轮宿主及其 API、Vite、PostgreSQL 已关闭，宿主自己创建的 .qa 临时目录已移除，[清理记录](cleanup.json) 显示 bytes_after 为 0；原验收端口均无监听。正式预览只做 [只读连通性检查](formal-preview-readonly.json)，health/content 版本一致，现有图标资源返回 200。
