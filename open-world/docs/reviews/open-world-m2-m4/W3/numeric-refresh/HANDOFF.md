# W3 数值交付清单（最终）

裁决：一刀优先：各阶段群怪生命取本阶段及之后各阶段一刀线的后缀最小值，使用一条单调不降曲线。

正式配置写入、一次验收、一次失败调参/复测及提交均由主集成负责。数值会话交付后结束。

| 项目 | 候选文件 | 生成命令 | 文件 SHA256 |
|---|---|---|---|
| 怪物曲线 | docs/reviews/open-world-m2-m4/W3/monsters-proposed.json | `node --import tsx tools/apply-monster-curve.ts` | `793628f45d36a098b10b7759098ed84117d6eaf777365ad1257ec885c6186bb1` |
| 群怪模板 | docs/reviews/open-world-m2-m4/W3/monsters-proposed.json | `node --import tsx tools/apply-monster-curve.ts` | `793628f45d36a098b10b7759098ed84117d6eaf777365ad1257ec885c6186bb1` |
| 营地生命预算 | docs/reviews/open-world-m2-m4/W3/numeric-refresh/camp-health-targets.json | `node --import tsx tools/camp-health-budget-proposal.ts` | `57fe2bb3f68ae8905fc284a60c4e61bd2eaa7bfeccd6581cfcf1696ed2e4ee4b` |
| 24个钥匙池 | docs/reviews/open-world-m2-m4/W3/numeric-refresh/stage-key-pools-proposed.json | `node --import tsx tools/build-w3-numeric-handoff.ts` | `da4059e04b181018fa45e8a8fd735ac982df78dc474f975f411de4dbe66eeea1` |
| 世界层级基准 | docs/reviews/open-world-m2-m4/W3/numeric-refresh/world-tiers-proposed.json | `node --import tsx tools/build-w3-numeric-handoff.ts` | `445a12d2a1a01cb03bff1c6986d1cefacbb9c158eefdcc7f5ea6d2b6abaacfef` |

## 来源哈希

- model：.design/standard-player-20261005/model.json — `25ab67c0428780f3d3eb73860ee23cbc66afe1ece2578af62bd3995da1d0bdf8`
- flow：.design/numeric-flow-20261006/flow.json — `dd6d0d1a15eeaf7a062680ee1d3364b7bc2c0b5b9a9a4c0b48d03a185c671341`
- phaseHits：docs/reviews/open-world-m2-m4/W3/stage-aoe-hits.json — `a3379a9cbc34fffe74b97001fb7527d5eadcfee4f98c1398177c147bd957891e`
- sourceBasis：docs/reviews/open-world-m2-m4/W3/key-source-basis.json — `dd937d0359bdae978076d21e15589925a8c2bba25b1fda866289b3a117412a5e`
- timing：assets/numerics/world-stage-timing.json — `ed1501a81decd0f9d79bbffd571ed91b88b22e71fb81b640ffc90778cab70ee2`
- formalMonsters：packages/content/monsters.json — `a51155084c8c1799917257ea28ec95a58d63ea0ae0ccce6ac94eb5896ba88c22`
- proposedMonsters：docs/reviews/open-world-m2-m4/W3/monsters-proposed.json — `793628f45d36a098b10b7759098ed84117d6eaf777365ad1257ec885c6186bb1`
- formalTiers：packages/content/world-tiers.json — `cfbfd0974fd3075fd32847305233ac1bbb4ecbcb8702c37c5b16b3b0fa16e727`
- formalPools：apps/api/src/stage-key-pools.json — `0cd601f02ec61b160df0b76ff6fdd53bafa24ea3021a3b8cbca82cac9637e6e9`
- tierReference：docs/reviews/open-world-m2-m4/W3/numeric-refresh/proposal.json — `e1b39256cb66b2bfba2633bdbd4a41b39203c5be96a494f66648d722afd8f5ce`

## 采纳与验收

- 两项怪物条目共用同一monsters-proposed，采纳一次；六个真实swarm模板已包含。
- 营地预算以实际campMembers人数/角色/档位计算，不减少模板或人口；targets文件给出24阶段角色HP。
- 私有池保留现有选项、输出与权重，仅刷新推导参数。
- 四层候选HP×8.450924992448973、攻击×4.225076994768009；真实已注册ow-boss-dragon-3，规划怪物等级53。参考的攻击/AI/技能未变，仅把boss HP换成最终候选曲线的解析值；主集成在正式定义确认该元组并一次验收。
- 使用共享heavy-job.lock排队。固定12/20目标、1.5门槛；墙四档按现有小样本工具执行。通过提交W3；失败按文档调一次再测。
- 既有小样本和已在裁决前完成的结果留作历史证据，不新增容量扫描/双阈值/逐层诊断。
