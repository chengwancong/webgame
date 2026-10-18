# 本期裁决

| 时间 | 问题 | 裁决 | 影响文件 |
|---|---|---|---|
| 2026-10-13 | 二期额度说明 | 本期按三期第5节重新计算；不重跑已完成的三期重任务 | progress.md |

| 2026-10-13 | 节拍恢复同窗就绪 | 恢复规则也是节拍身份的一部分，startReady同时打开；其他interval默认false | identity-content.ts |
| 2026-10-13 | 护盾8%下限与5%网格冲突 | floor保留0.08；可行网格从0.10起，不生成0.08的越网格值 | derive-model.ts |
| 2026-10-13 | 爆盾已有来源但破裂稀少 | 保留原来源；增加格挡护盾绑定身份，区分低压过期与生存破裂 | identity-content.ts |
| 2026-10-13 | 既有余烬与猎杀重置没有旋钮 | 余烬持续增伤登记机制旋钮；猎杀重置登记icd代价旋钮，让每条规则目标场景来自旋钮表 | 机制旋钮表 |
| 2026-10-13 | 原Excel目标/样式/批注不可变 | 使用ZIP成员保留方式更新机制页XML；目标、样式、批注差异0，不重导整个工作簿 | sync-knobs.py |
| 2026-10-13 | 二期测试要求所有描述含默认100%/0秒、数字规则名 | 按M8改为非默认参数和命名断言，保留参数独立遍历及真实伤害断言 | 描述及机制测试 |

| 2026-10-13 | 旧会话临时库标记阻断全局reapStale | 为通用runtime增加可选reap（默认true），本期驱动关闭全局回收，仅创建并清理自身临时库；不接管旧会话目录 | runtime.mjs、run-calendar.mjs、run-tests.mjs |

| 2026-10-13 | C2旧测试夹具仍依赖二期实时比值及8%非网格下限 | 迁移为固定锚点+显式实测测试夹具；下限断言取首个可行网格，保留不改通过构筑断言 | pacing-calibrate/refine/derive测试 |
| 2026-10-13 | C0过期诊断前瞻一帧导致重复 | 修正计数并用原始参数快照生成真实链路计数，初始原始记录保留 | C0/diagnosis*.json |

| 2026-10-13 | 测量前共享文件哈希变化 G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world\docs\reviews\pacing-identity-20261013\C3\baseline | 本期改动/其他会话混杂保留，不追加重跑；详见 shared-hashes.json | open-world/packages/simulation/index.ts |

| 2026-10-13 | 测量前共享文件哈希变化 G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world\docs\reviews\pacing-identity-20261013\C3\marginals | 本期改动/其他会话混杂保留，不追加重跑；详见 shared-hashes.json | open-world/packages/simulation/index.ts |

| 2026-10-13 | C3 burn aspect-st-ember-state目标场景未覆盖 | [{"scene":"clear","seconds":1.2,"reason":"条件空窗/失效"}]；结构已冻结，记录残差，不改结构、不重跑 | C3/baseline/validation.json |

| 2026-10-13 | 测量前共享文件哈希变化 G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world\docs\reviews\pacing-identity-20261013\C5\validation | 本期改动/其他会话混杂保留，不追加重跑；详见 shared-hashes.json | open-world/packages/simulation/index.ts |

| 2026-10-13 | C3编译器合成flags状态规则未登记，错误回退到五场景 | 通用地继承相同flagFilter的已登记本体规则目标场景；不改内容结构、不改弹性、不追加测量，C3/C5原始报告保留 | mechanisms.ts、report.md |

| 2026-10-13 | 测量前共享文件哈希变化 G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world\docs\reviews\pacing-identity-20261013\C6\validation | 本期改动/其他会话混杂保留，不追加重跑；详见 shared-hashes.json | open-world/packages/simulation/index.ts |

| 2026-10-13 | 全量4项python3启动失败 | 分类为验收环境真缺陷，仅当前进程PATH/PYTHONHOME使用真实解释器；原断言不改，完整复跑 | C6/test-classification.md、C6/python-repair/ |

| 2026-10-13 | 终检发现机制页数据节点重建未保留单元格style引用和行高 | 从C0不可变源恢复原324格样式及原行高；新增格继承原表样式。仅元数据修复，无旋钮数值/结构变化；config:check仍一致 | sync-knobs.py、C1/workbook-original-format.json、C7/workbook-preservation.json |

| 2026-10-13 | C7最后文案检查：余烬持续增伤回退名称为节拍强化 | 仅更正生成器机制名为燃烧强化，重新生成描述；不改旋钮数值、规则结构和测量结果 | aspect-description.ts、aspects.json |
| 2026-10-13 | C6升级中位数238.737已在240±5% | 不消耗重定中心额度，不改经验需求、不追加timeline-only；种子离散单列 | report.md、progress.md |
