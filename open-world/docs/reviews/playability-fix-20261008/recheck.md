# 玩家体验修复复验（2026-10-08 任务）

状态：F1–F6、§4自然存档复验、最终完整回归、生产构建及生产包GUI登录/会话恢复与关键交互验收全部完成。建议重新提交玩家体验验收；数值观察保留给数值批次，不据本轮自动战斗结果宣称整体平衡通过。

## 方法与隔离

沿用[原报告](../playability-20261008/report.md)的十维度、每项1–5分。评分属于本次可见交互判断，不能当作数值分布或全机器通过率。浏览器只用可见 GUI、1280×720；重任务串行。隔离入口为127.0.0.2，与正式8612的主机名和会话存储分开；所有正常游玩收益、花费、回执保留，没有授予等级、首领或层级。

四份报告存档分别恢复为独立PG分支。实际读取：final-new为Lv5，final-late为Lv30，final-endfresh为Lv50，checkpoint-30为Lv30；早期推断的8/45已撤回。分支之间不覆盖自然成长。原始dump保留；middle30在最终初败前保持未重配。

## 逐项复现对照

每项图像和文本均链接到实际保存文件；修复前沿用原报告的旧版本证据，修复后为当前隔离GUI。不把布局样本、单元测试或受控PG夹具冒充自然游玩。

| 问题 | 修复前 | 修复后 | 判断范围 |
|---|---|---|---|
| P-01 操作卡忙 | [技能卡忙](../playability-20261008/evidence/s1-19-activation-stuck.txt)、[龙眠卡忙](../playability-20261008/evidence/s3-04-teleport-stuck.txt)、[前像](../playability-20261008/evidence/s1-19-activation-stuck.jpg)、[前像](../playability-20261008/evidence/s3-04-teleport-stuck.jpg) | [技能激活](evidence/f1-frost-activated.png)、[AX](evidence/f1-frost-activated.txt)、[关闭成功](evidence/f1-skill-close.txt)、[誓约庭](evidence/f1-dragon-waypoint-success.png)、[AX](evidence/f1-dragon-waypoint-success.txt)、[界桥前庭](evidence/f1-rift-waypoint-success.png)、[AX](evidence/f1-rift-waypoint-success.txt)、[请求时序](evidence/f1-network-summary.json) | 激活与两处航标真实请求及关闭状态；成功之外的拒绝/超时由定向验证补充 |
| P-02 E对象错位 | [错误执行对象](../playability-20261008/evidence/s1-10-e-wrong-target.txt)、[回港范围](../playability-20261008/evidence/s1-51-port-e-mismatch.txt)、[前像](../playability-20261008/evidence/s1-10-e-wrong-target.jpg)、[前像](../playability-20261008/evidence/s1-51-port-e-mismatch.jpg) | [同站位提示](evidence/f1-milo-prompt.png)、[E实际执行](evidence/f1-milo-e-correct.png)、[AX](evidence/f1-milo-e-correct.txt)；[新角色回港E](evidence/f6-fresh-port-opening.png)、[AX](evidence/f6-fresh-port-opening.txt)、[米洛原地E](evidence/f6-fresh-milo-progress.txt) | 任务NPC与板重叠、门户相同候选 |
| P-03 航标入口溢出 | [8航标旧图](../playability-20261008/evidence/s3-02-dragon-map.jpg)、[旧AX](../playability-20261008/evidence/s3-03-map-overflow.txt)、[AX](../playability-20261008/evidence/s3-02-dragon-map.txt)、[前像](../playability-20261008/evidence/s3-03-map-overflow.jpg) | [实际8航标](evidence/f3-dragon-8-after.png)、[AX](evidence/f3-dragon-8-after.txt)、[末项传送](evidence/f3-dragon-last-travel.png) | 0/1/2/8/9布局样本全部入口保留；实际角色有8个龙眠航标，9样本未授予航标 |
| P-04 战斗信息遮挡 | [风车旧图](../playability-20261008/evidence/s1-37-boss-observe.jpg)、[沉星旧图](../playability-20261008/evidence/s2-25-boss-telegraph.jpg)、[AX](../playability-20261008/evidence/s1-37-boss-observe.txt)、[AX](../playability-20261008/evidence/s2-25-boss-telegraph.txt) | [沉星同帧施法](evidence/f3-rift-boss-fight.png)、[AX](evidence/f3-rift-boss-fight.txt)、[边界](evidence/f3-rift-boss-bounds.json) | 风车/沉星实际三段与独立岛首领；血条、施法、完整任务和目标卡共存 |
| P-05 相位进度不实 | [旧航图](../playability-20261008/evidence/s4-02-endgame-chart.jpg)、[层4锁定](../playability-20261008/evidence/s4-07-world-tier-options.jpg)、[AX](../playability-20261008/evidence/s4-02-endgame-chart.txt)、[AX](../playability-20261008/evidence/s4-07-world-tier-options.txt) | [相位航图](evidence/f2-chart-phases.png)、[AX](evidence/f2-chart-phases.txt)、[本场结算](evidence/f2-boss-phase-result.png)、[最终6/6与层5](evidence/final-production-tier5-restored.png)、[AX](evidence/final-production-tier5-restored.txt) | 普通与裂星潮分开；实际5/6后自然龙眠胜，最终6/6、当前5、下一层6正常开放 |
| P-06 首领不接敌 | [旧龙眠](../playability-20261008/evidence/s4-28-dragon-outcome.jpg)、[AX](../playability-20261008/evidence/s4-28-dragon-outcome.txt) | [半自动](evidence/f4-dragon-semi-contact.png)、[全自动](evidence/f4-dragon-auto-contact.png)、[AX](evidence/f4-dragon-auto-contact.txt)、[最终自然龙眠胜](evidence/final-dragon-natural-state.png)、[AX](evidence/final-dragon-natural-state.txt) | 受控接敌与最终默认半自动无手动移动自然胜分开记录；两前岛默认半自动正常胜利 |
| P-07 失败页无行动解释 | [前段初败](../playability-20261008/evidence/s2-07-wall-failure.jpg)、[岛首领失败AX](../playability-20261008/evidence/s3-25-island-failure-correction.txt)、[AX](../playability-20261008/evidence/s2-07-wall-failure.txt)、[前像](../playability-20261008/evidence/s3-25-island-failure-correction.jpg) | [前段失败](evidence/f5-front-failure-visible.png)、[AX](evidence/f5-front-failure-visible.txt)、[岛首领失败](evidence/f5-island-failure.png)、[AX](evidence/f5-island-failure.txt) | 实际事件来源、输出秒占比及材料/可刷来源；未记录历史明确说明 |
| P-08 钥匙/奖励难辨识 | [旧配方](../playability-20261008/evidence/s2-04-key-readability.jpg)、[旧换装](../playability-20261008/evidence/s2-30-item-tradeoff.jpg)、[AX](../playability-20261008/evidence/s2-04-key-readability.txt)、[AX](../playability-20261008/evidence/s2-30-item-tradeoff.txt) | [同强化护甲预览](evidence/f5-armor-preview-fixed.png)、[AX](evidence/f5-armor-preview-fixed.txt)、[召唤成长](evidence/f5-summon-preview.png)、[AX](evidence/f5-summon-preview.txt)、[只读审计](evidence/f5-gui-preview-after.json) | 服务端只读同强化预览与主手适配；不保证净提升 |
| P-09 取消追踪假完成提示 | [旧AX](../playability-20261008/evidence/s2-23-untrack-toast.txt)、[前像](../playability-20261008/evidence/s2-23-untrack-toast.jpg) | [修复图](evidence/f2-untracked.png)、[AX](evidence/f2-untracked.txt) | 正常取消，任务保留；同次wallet/done/completion审计无变 |
| P-10 复刷同构 | [旧复刷AX](../playability-20261008/evidence/s3-10-repeat-chest.txt)、[前像](../playability-20261008/evidence/s3-10-repeat-chest.jpg) | [精英后阵](evidence/f6-rift-first-entry.png)、[AX](evidence/f6-rift-first-entry.txt)、[精英前阵](evidence/f6-rift-second-entry.png)、[AX](evidence/f6-rift-second-entry.txt)、[冻结对照](evidence/f6-pilot-comparison.json)、[野外1](evidence/f6-field-first-done.png)、[AX](evidence/f6-field-first-done.txt)、[野外2](evidence/f6-field-second-done.png)、[AX](evidence/f6-field-second-done.txt) | 沉星密仓两种冻结阵型与沉星野外可选短目标试点；没有推广其它岛 |
| 结算Tooltip单位 | [本轮F5前像](evidence/f5-tooltip-before.png)、[AX](evidence/f5-tooltip-before.txt) | [正式结算Tip](evidence/f5-result-tooltip.png)、[AX](evidence/f5-result-tooltip.txt)、[魔杖百分比](evidence/f5-result-wand-tooltip-fixed.png)、[AX](evidence/f5-result-wand-tooltip-fixed.txt)、[普通随机传说](evidence/f5-random-legend-origin.png)、[AX](evidence/f5-random-legend-origin.txt) | 同一正式装备详情解析器，百分比一致；不补造旧装备来源 |
| 对白复读 | [旧1/3](../playability-20261008/evidence/s1-53-repeated-dialogue.txt)、[前像](../playability-20261008/evidence/s1-53-repeated-dialogue.jpg) | [首次开场1/3](evidence/f6-fresh-port-opening.png)、[AX](evidence/f6-fresh-port-opening.txt)、[读完后澄进行中](evidence/f6-fresh-cheng-progress.png)、[AX](evidence/f6-fresh-cheng-progress.txt)、[米洛进行中](evidence/f6-fresh-milo-progress.png)、[AX](evidence/f6-fresh-milo-progress.txt) | 已播放开场后去NPC读进行中对白，正常完成按钮保留 |
| 清场文案 | [旧说明](../playability-20261008/evidence/s4-11-field-stop-interpretation.txt)、[前像](../playability-20261008/evidence/s4-11-field-stop-interpretation.jpg) | [清场停机](evidence/f4-field-cleared.png)、[AX](evidence/f4-field-cleared.txt) | 正常雾铃清空后停到半自动，保留刷新/已击杀/满包规则 |
| 层级风险理由 | [旧层3](../playability-20261008/evidence/s4-08-tier3-select.jpg)、[AX](../playability-20261008/evidence/s4-08-tier3-select.txt) | [各层说明](evidence/f4-world-tier-risk.png)、[层4说明](evidence/f4-world-tier-4-risk.txt) | 全部服务端倍率，普通随机传说权重与精英/稀有保底不混同 |
| 天赋逐点点击 | [旧29次](../playability-20261008/evidence/s2-12-respec-complete.txt)、[前像](../playability-20261008/evidence/s2-12-respec-complete.jpg) | [整行报价](evidence/f6-batch-quote-readable.png)、[AX](evidence/f6-batch-quote-readable.txt)、[点数限制](evidence/f6-batch-point-limited.png)、[AX](evidence/f6-batch-point-limited.txt)、[分配完成](evidence/f6-talents-allocated.png)、[AX](evidence/f6-talents-allocated.txt)、[8次提交审计](evidence/f6-talents-all-after.json) | 批量可负担前缀、精确费用、同一事务；原规则与重置确认保留 |

## 最终自然路径

| 路径 | 真实起止时间 | 操作与结果 | 限制 |
|---|---|---|---|
| F6之后的新角色前10分钟 | 10月9日11:25:36开场—11:32:23首地城入场，实际6分47秒 | 新隔离账号fix_20261009_final／正式复验旅人；首战→航标E→原地米洛E→野外寒霜阵激活装配/正常关闭→落风坡明确E提示正常回港→澄3段读完后单段进行中→4级风车地窖入场；[开场](evidence/final-new-start.png)、[AX](evidence/final-new-start.txt)、[航标提示](evidence/final-new-waypoint-prompt.png)、[AX](evidence/final-new-waypoint-prompt.txt)、[原地E](evidence/final-new-milo.png)、[AX](evidence/final-new-milo.txt)、[激活](evidence/final-new-skill-activated.png)、[AX](evidence/final-new-skill-activated.txt)、[回港提示](evidence/final-new-return-prompt.png)、[AX](evidence/final-new-return-prompt.txt)、[实际回港](evidence/final-new-port-opening.png)、[AX](evidence/final-new-port-opening.txt)、[澄进展](evidence/final-new-cheng-progress.png)、[AX](evidence/final-new-cheng-progress.txt)、[首本入场](evidence/final-new-dungeon-entry.png)、[AX](evidence/final-new-dungeon-entry.txt)、[真实时间日志](evidence/final-gui-journal.jsonl) | 真实可见GUI墙钟，包含工具等待；没有授予。早先F6另一新角色自动路径27分6秒含约21秒/步工具延迟，保留其原证据，但不将其冒称10分钟内完成。正式路径另建新UUID，不覆盖旧收益 |
| checkpoint-30 初败→重配→通关→两次复刷 | 10月9日11:49:43弱态入场—12:47:43第二复刷成功—12:52:29回港 | 原26伤害/3防御、3技能，后阵第一前段自然倒下：[失败图](evidence/final-middle-weak-front.png)、[AX](evidence/final-middle-weak-front.txt)。正常120重洗+290配点，防御15/伤害14，再免费激活并装配寒霜阵；[重配](evidence/final-middle-talents-allocated.png)、[AX](evidence/final-middle-talents-allocated.txt)、[费用回执](evidence/final-middle-respec-ledger.json)。前阵首通1124金/2728XP/120石/10装，[结果](evidence/final-middle-pass-result.png)、[AX](evidence/final-middle-pass-result.txt)；后阵复刷1412金/3688XP/168石/10装，[结果](evidence/final-middle-repeat-one-result.png)、[AX](evidence/final-middle-repeat-one-result.txt)；前阵再刷1124金/2728XP/120石/8装，[结果](evidence/final-middle-repeat-two-result-before.png)、[AX](evidence/final-middle-repeat-two-result-before.txt)。[三次冻结](evidence/final-middle-three-run-comparison.json)构筑完全相同：30级/943HP/174攻击/82护甲、同四技能，实际visit3/4/5前→后→前。全部收益和新苍风守灵50保留、未上阵；最终[营地](evidence/final-middle-camp.png)、[AX](evidence/final-middle-camp.txt)：4322金/1271石/50装。 | 原弱态908HP以实机为准。失败25/100输出秒含未接敌与工具等待，不当纯DPS；不是同种子单变量配对；前阵允许原达标条件推进、实际击杀量影响收益。正常410费用共9付费回执，另外2条零收支且build不变记录分开核对，未重复扣费 |
| final-endfresh 龙眠→层4 20–40分钟→可达层5 | 10月9日13:03:07首领入口—13:04:08龙眠胜；层4实际入场13:22:08.819—14:01:47.166选择5，共39分38.347秒；14:24:19层5通关 | 原50级/4039HP/48009金/50装，默认半自动无手动移动自然维洛胜：[入口](evidence/final-dragon-entry.png)、[AX](evidence/final-dragon-entry.txt)、[6/6结算](evidence/final-dragon-natural-state.png)、[AX](evidence/final-dragon-natural-state.txt)、[52级冻结许可](evidence/final-dragon-entry-permit.json)、[真实六标记](evidence/final-dragon-victory-permit.json)。[层4解锁](evidence/final-tier4-unlocked.png)、[AX](evidence/final-tier4-unlocked.txt)。层4阶段19/怪物40自然成功；阶段23/怪物48初败与正常寒霜阵控场重试均失败；阶段24/怪物50前段观察后正常退出、60金/240XP保留；[窗口原始时间](evidence/final-tier4-play-window.json)、[逐事件日志](evidence/final-gui-journal.jsonl)。层5阶段19/怪物40真实完整三段成功：[层5选择](evidence/final-tier5-selected.png)、[AX](evidence/final-tier5-selected.txt)、[真实冻结](evidence/final-tier5-wind19-entry-frozen-run.json)、[结算](evidence/final-tier5-wind19-result.png)、[AX](evidence/final-tier5-wind19-result.txt)。最终自然营地[图](evidence/final-endfresh-camp-prebuild.png)/[AX](evidence/final-endfresh-camp-prebuild.txt)：50级/4039HP/58531金/1521石/73装/2待领，世界层级5、下一层已正常开放。 | 39分38秒含正常菜单、技能准备与工具输入间隔，未计此前代码/工作簿/测试时间，不是战斗纯时长或真人速度。高阶以层4为额外倍率基准：4的1/1与5的1.1/1.09均为现行真实冻结。只用真实三路线19–24，未把普通风车1当高层。原收益/材料分层作用域均保留、没有授予或回档 |

### 已记录的体验边界

- 两阵型同入口963HP/176攻击/82护甲、同四技能，实际精英位置由远端(32,18)/(32,25)换到近端约(17.06,23.30)/(18.05,26.70)。两轮均成功；原过关条件允许达标即推进，第一轮清更多普通怪，收益1412金/3688XP/168石/10装，第二轮836金/1768XP/72石/7装。该差异不能证明掉率或倍率改变，防重/发奖规则另有真实PG验证。
- 野外走访visit1难民营地→visit2炮台通道；仅在明确重新出航时轮换，可信到达标done，不发额外奖。途中正常野外收益保留，最终Late31/11876金/90装/3待领/1682石。地图可选目标没有新增HUD第二行。
- 初败前段93.8%输出秒占比只覆盖最后失败阶段，岛首领93.3%只覆盖本次载入；不冒称全本战斗时间。原报告汇总341HP与原截图908HP不一致，以原s2-05图及本轮实机908HP为准，不宣称提高了生命数值。

### 结算旧失败提示收口

客户端原先在已结束挑战恢复时仍播放终局快照的cast_failed，导致成功结算旁残留“目标已失效”。只调整结果反馈优先级：战斗中的原失败文案保留；已成功/失败/退出各显示真实当下结果，重复终局不重播。3项新状态转换测试与2项既有正式Tooltip测试通过，类型通过。同一已保存成功实例[修前](evidence/final-middle-repeat-two-result-before.png)、[AX](evidence/final-middle-repeat-two-result-before.txt)→[修后](evidence/final-middle-repeat-two-result-after.png)、[AX](evidence/final-middle-repeat-two-result-after.txt)显示“挑战成功，战利品已保存”。[完整状态审计](evidence/final-feedback-persistence-after.json)Hash/521回执流水/131奖励/物品/金币全部不变，既没有重打也没有重发奖。

### 高层实际结果与信息接线

| 层级/路线 | 实测结果 | 证据与边界 |
|---|---|---|
| 4 / 船坞遗址 stage19 / 怪物40 | 自然完整成功，368金/496XP/42石/9装备，首领59777100HP | [入场](evidence/final-tier4-wind19-entry.png)、[AX](evidence/final-tier4-wind19-entry.txt)、[冻结](evidence/final-tier4-wind19-entry-frozen-run.json)、[结算](evidence/final-tier4-wind19-result.png)、[AX](evidence/final-tier4-wind19-result.txt)；worldTierScaling=true，额外难度按层4基准为1/1，准入38与怪物40分开 |
| 4 / 界桥地窖 stage23 / 怪物48 | 原三技能4.5秒倒下、零收益；正常免费激活并装配寒霜阵后1.8秒仍倒下、零收益 | [初败](evidence/final-tier4-rift23-entry.png)、[AX](evidence/final-tier4-rift23-entry.txt)、[原冻结](evidence/final-tier4-rift23-failure-frozen-run.json)、[免费激活](evidence/final-endfresh-frost-activated.png)、[AX](evidence/final-endfresh-frost-activated.txt)、[重试](evidence/final-tier4-rift23-retry.png)、[AX](evidence/final-tier4-rift23-retry.txt)、[四技能冻结](evidence/final-tier4-rift23-retry-final-frozen-run.json)；角色4039HP/3059攻击/2229护甲，原三技能参数相同；普通裂缝幼影9036875HP/4950攻击，最近近身2376/背刺4039。不同实例随机过程，不作同种子单变量因果比较 |
| 4 / 航网机库 stage24 / 怪物50 | 前段普通击杀达标、精英未完成，3190/4039HP时正常退出；60金/240XP保留，未通关 | [入场](evidence/final-tier4-dragon24-entry.png)、[AX](evidence/final-tier4-dragon24-entry.txt)、[50级冻结](evidence/final-tier4-dragon24-entry-frozen-run.json)、[收益保留确认](evidence/final-tier4-dragon24-exit-quote.png)、[AX](evidence/final-tier4-dragon24-exit-quote.txt)、[abandoned终态](evidence/final-tier4-dragon24-final-frozen-run.json)；普通骨庭幼卫28496150HP/265攻击，不能按怪物等级单一推断场景难度 |
| 5 / 船坞遗址 stage19 / 怪物40 | 真正完整成功，368金/496XP/42石/13装备，首领65754810HP | [首领](evidence/final-tier5-wind19-boss.png)、[AX](evidence/final-tier5-wind19-boss.txt)、[成功](evidence/final-tier5-wind19-result.png)、[AX](evidence/final-tier5-wind19-result.txt)、[success冻结](evidence/final-tier5-wind19-final-frozen-run.json)；额外倍率1.1/1.09，四技能包含正常激活寒霜阵，不作为与三技能层4的配对TTK |

选中4后曾仍提示返回港选择层级：[修前](evidence/final-tier4-selected.png)、[AX](evidence/final-tier4-selected.txt)。最终按现行规则与工作簿短模板解析当前地城或已开放下一层，[修后](evidence/final-tier4-guide-fixed.png)、[AX](evidence/final-tier4-guide-fixed.txt)；箭头真实[打开目录](evidence/final-tier4-arrow-catalogue.png)/[AX](evidence/final-tier4-arrow-catalogue.txt)，首通后[打开地图](evidence/final-tier5-unlocked-while4.png)/[AX](evidence/final-tier5-unlocked-while4.txt)，5选中后显示当前5目标。当前场景与手动追踪优先，13项相关测试（含真实PG）通过。只加可选公开action，不改层级解锁条件、倍率或奖励。

[两条工作簿模板](evidence/final-stage-workbook-fixed.png)及[旧值保全](evidence/final-stage-workbook-preservation-fixed.json)：29254旧单元格/2303旧数值/111旧批注、页签与冻结全部保留。首次新值未JSON编码被原导出器拒绝，失败日志保留；只修新单元格，6本config:check通过。[逐字段导出审计](evidence/final-stage-content-preservation.json)证明309旧任务与所有旧字段/数字不变，另10配置字节相同。

全部五隔离分支的最终备份见[备份清单](evidence/final-isolated-backups.json)，原报告dump未覆盖，私有数据库dump仅在忽略的QA目录中保存。生产构建前自然终态见[状态基线](evidence/final-build-state-before.json)。下节另列生产GUI正常新增收益；未再新增或运行指纹、前后像或审计脚本。

## 最终发布与生产包GUI验收

- [最终完整回归](final-regression.log)：212文件通过，1596项通过、2项原有历史skip，1901.77秒。定向、类型与六本配置一致性均通过；重任务全程串行。
- [生产构建](final-build.log)：标准`pnpm build`成功。首次ui-v2目录重命名被Windows占用阻止；只停止已核实属于本次隔离host的Vite后重试成功，未改构建脚本。原失败日志保留。现有大chunk警告保留，未提高阈值掩盖警告。
- [正式服务](final-service-status.log)：当前用户Limited任务计划Running、自启开启、lastError为空。正式8612与隔离生产10840的`/api/health`及`/api/content`实际版本均为client **0.11.22** / protocol **32** / rules **ow-63** / assets **world-art-20261007-v24-world-runtime** / db **16**。GUI实际加载`./assets/game-BDibmQLL.js`，无`/@vite/client`，DOM视口1280×720，控制台无error。

| 生产包实际路径 | 结果 | 证据 |
|---|---|---|
| 同源账号重新登录→营地→刷新恢复 | 登录与刷新都正常进入拾星港；50级/4039HP/58531金/73装备/2待领与构建前自然终态一致 | [登录图](evidence/final-production-login.png)、[AX](evidence/final-production-login.txt)、[恢复图](evidence/final-production-session-restored.png)、[AX](evidence/final-production-session-restored.txt) |
| 正常选层1→龙眠野外→誓约庭航标→关闭/回城 | 真实到达誓约庭，地图自动关闭；重新打开地图八个完整航标、传送按钮与关闭键均可用，关闭后回城成功。两帧主界面曾显示“处理中”，保留原证据；不据这两帧声称完成耗时或所有HUD刷新均无延迟 | [到达帧](evidence/final-production-dragon-waypoint.png)、[AX](evidence/final-production-dragon-waypoint.txt)、[地图恢复可用](evidence/final-production-dragon-map.png)、[AX](evidence/final-production-dragon-map.txt) |
| 沉星正常出航→界桥前庭传送→回城 | 真正到达界桥前庭、地图自动关闭，系统与回城入口可用，正常回港；地图保留八航标和可选无额外奖励走访 | [传送图](evidence/final-production-rift-waypoint.png)、[AX](evidence/final-production-rift-waypoint.txt) |
| 正常恢复层5→任务页取消追踪 | 层5当前、6已开放。建立滩头前哨保持进行中1/2，按钮变回追踪；HUD恢复阶段目标，无假完成提示，金币与装备数未变 | [层级图](evidence/final-production-tier5-restored.png)、[AX](evidence/final-production-tier5-restored.txt)、[取消图](evidence/final-production-untracked.png)、[AX](evidence/final-production-untracked.txt) |
| 船坞遗址stage19原初主手对比→正常关闭 | 服务端同强化+7，适配当前剑谱系，显示实际机制、阶段用途与百分比；攻击3059→2813、护甲2229→1831，回复10→15等取舍公开。材料4/111、制作仍禁用；只预览，未制作/换装 | [预览图](evidence/final-production-key-preview.png)、[AX](evidence/final-production-key-preview.txt)、[最终营地图](evidence/final-production-camp.png)、[AX](evidence/final-production-camp.txt) |

生产补验中沉星正常野外半自动战斗新增1770金、23108XP、3强化石；进入该岛还按既有规则自动接取建立滩头前哨，最终仅取消追踪而未放弃或完成。未删除这次收益或接取记录。最后正常营地为50级/4039HP/**60301金、1524强化石、73装备、2待领**，当前层5、层6已开放；没有合成、分解、换装或额外领取。

§7各项均完成，无§6硬阻塞；正式库只读health/content，未进入正式游戏会话或向正式玩家状态写入。当前正式服务及隔离生产预览保持可访问。31个本轮临时审计/指纹/构建包装脚本已清理；保留隔离PG数据、五分支备份及`production-preview.config.ts`，分别用于保留自然成长、恢复存档和维持当前生产预览。结果日志、截图与AX保留在本目录。

## 十维度重新评分

| 维度 | 原评分 | 新评分 | 直接证据与置信度 |
|---|---:|---:|---|
| 前30分钟 | 3/5 | 4/5 | 正式F6后新角色6分47秒走到首个地城，E/技能激活关闭/开场与进展对白均有截图。中置信度：覆盖初始内容路径，不能当真人完整30分钟体验。 |
| 方向感 | 2/5 | 4/5 | 普通/裂星潮/当前场景与手动追踪层次清楚；真实6/6后4/5目标及两种箭头入口都已验证。中高置信度。 |
| 战斗手感 | 3/5 | 3/5 | 血条/施法信息与独立首领接敌改善有直接证据；主体自动模式，工具间隔不足以评估人工移动/闪避收益。高阶瞬死风险仍在本次自然构筑下出现。中置信度。 |
| 循环体感 | 3/5 | 3/5 | 中期初败→正常410金币重配/控场→三次成功形成可行动循环；高层23两次短失败、24仅前段退出，整体强度与经济节奏本轮保留。中置信度。 |
| 奖励感 | 3/5 | 4/5 | 同强化只读预览、机制/用途/来源徽记与百分比单位实际可读；新角色自然苍风之刃与普通随机传说均有实机。改善的是可辨识/可比较，不保证净提升。中高置信度。 |
| 构筑 | 4/5 | 4/5 | 原深度保留；批量精确费用/单点路径与中期重配后实际执行构筑明确，三成功冻结一致。未新增构筑深度，不据按钮减少给更高分。中高置信度。 |
| 探索 | 3/5 | 3/5 | 全航标保留与真实传送、一岛两条可选走访有证据；没有全六岛内容深度或自愿绕路的人类样本。中置信度。 |
| 界面摩擦 | 2/5 | 4/5 | 卡忙、E错位、航标溢出、首领遮挡、对白复读、天赋多点与终局旧提示均有真实路径及类型/PG补充；1280×720单机边界。高置信度。 |
| 重复与疲劳 | 2/5 | 3/5 | 沉星前/后阵与野外两目标短期变化已实测；仅一岛试点，骨架循环与数小时真人疲劳未验证。中低置信度。 |
| 数值实测例外的体验影响 | 3/5（低至中置信度） | 3/5 | 不改数值、不撤原W11例外；新高层19成功、23两失败、24正常退出、5的19成功均按实际冻结区分，未做同种子人工避让/强化配对。低至中置信度。 |

## 数值批次待办（本轮不调）

- D3适配与同强化可解释不等于净提升保证；4×TTK保证仍须未来按同构筑/敌人/种子配对推导。正式新角色自然阶段1钥匙苍风之刃与原青锋长剑同为+0时，角色攻击41→37，增加点燃3%/冰缓4%；[真实正式Tip](evidence/final-new-key-tooltip.png)、[AX](evidence/final-new-key-tooltip.txt)、[自然发行来源](evidence/final-new-key-origin.json)。未来核对早期关键奖励的即时用途与预算，不据此调整当前数值。
- 原W11 17区爽刷例外仍保留，区分走路、停机、已清空和真正流式加载问题，不能用总营地数抵销。
- F3普通沉星岛首领的83751XP与同名地城3688XP来自不同来源和冻结怪物；先核对完整来源/等级后再判奖励节奏，不能直接按岛名并列。
- 本次自然构筑在stage23前段出现4.5/1.8秒致死背刺；未来按同冻结构筑/种子区分正常准备、控场、人工避让与属性需求，检验反应窗口，不能仅凭自动失败断言全部玩家无法通过。
- stage24普通怪更高生命、较低攻击而未完成全本，与stage23模板/技能/入场比例不同；未来按角色目标和实际来源做TTK/承伤配对，不能按等级或岛名混算。
- stage19层4/5完整奖励本次均368金/496XP/42石，装备9/13件含随机波动；营地世界倍率、高阶段地城以4为基准的倍率、各固定奖励表与钥匙预算需分开核对，不由两次掉落推断概率变化。[旧层材料保留](evidence/final-tier-key-scopes.json)表明4层4份仍在原作用域，5层是独立进度。
- 虚拟日程、可见GUI窗口与事件记录的战斗秒数分开；39分38秒含菜单/准备与工具输入间隔，不当纯战斗或真人反应时长。

完整实现、决策、所有失败诊断及每批回归记录见[progress.md](progress.md)。
