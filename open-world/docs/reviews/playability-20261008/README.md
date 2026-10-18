# 本轮交付目录

- [主报告](report.md)：总评/十维评分、前十问题、W11例外解释、65点流水、修复排序与覆盖缺口。
- [进度与决策日志](progress.md)：保留样本纠正、中间态更正和正式库自动写入偏差。
- [独立流水表](session-timeline.md)；`evidence/play-journal.jsonl`为原始UTC逐次记录。
- `evidence/s1-*`至`s4-*`：原始1280×720 JPEG及同名AX/备注文本。截图观察点不等于精确击倒时刻。
- `runtime-baseline.json`、`source-end.json`、`network-summary.json`、`pg-audit-final.json`：版本、请求时间线、真实构筑及冻结副本结果。
- `historical-reuse.json`：已有W10/W11数据来源哈希及本轮解释，没有新扫网格。
- `formal-readonly-check.json`：披露正式页面自动恢复会话产生12条零收益回执/流水；本轮隔离约束未完全满足。没有删除或回滚。
- `final-backups.json`与以下PG归档：全部是自建隔离库，不含正式存档导出。

## 可恢复的自然样本

| 归档 | 内容 | 登录账号 |
|---|---|---|
| `evidence/checkpoint-8.dump` | 自然8级完整PG基线。 | calendar_9637b11f7557437b |
| `evidence/checkpoint-30.dump` | 自然30级未重配基线，入口撞墙可复演。 | 同上 |
| `evidence/checkpoint-50.dump` | 自然50级、六普通首领、未重打裂星潮基线。 | 同上 |
| `evidence/final-new.dump` | 新手段结束Lv5，新增冰阵/头盔/天赋，public schema。 | playability_20261008_new |
| `evidence/final-late.dump` | 自然30正常重配后，普通沉星首领完成、48装备、三次地城冻结结果。 | calendar_9637b11f7557437b |
| `evidence/final-endfresh.dump` | 自然50，前五裂星潮首领、层级3、正常旋风强攻觉醒、最后龙眠未接敌。 | 同上 |

自然驾驶器只有一次完整补跑，代码原始运行位置为本报告目录的`natural-sample.test.ts`，运行后另存`evidence/natural-sample.test.ts.txt`，不会被后续全量vitest自动发现。`driver.log`、检查点JSON、完整PG回执/流水共同提供来源证明。控制租约/已确认营地冷却使用隔离时间加速，等级、装备、技能、资金均走真实World/应用命令。

## 恢复注意事项

1. 先用项目既有工具新建**完全独立临时PG集群**；遵守重任务锁。不要连接`.runtime/dev`正式库，不要沿用本报告已停止的临时端口。
2. 在新集群里创建空数据库，使用PostgreSQL18或兼容工具`pg_restore --exit-on-error --no-owner`恢复选定归档。不要使用`--clean`清理已有数据库。
3. 自然样本schema为`qa_calendar_cf329c27c2a34ef599b2ded6fc6d6056`，`final-new.dump`为public。恢复后为新数据库设置对应search_path；具体归档哈希见清单。
4. 用匹配报告版本的独立运行源码/发布产物，给临时API设置独立DSN、端口与Origin，再核对health/content。当前报告是实际运行版本，存在预先未提交源码，不能仅从HEAD宣称干净复现。
5. 浏览器使用独立存储分区或验证过的独立测试主机名。**不同127.0.0.1端口不能隔离同名Cookie**；本轮因此有分支重登录，也发生了最初正式页自动恢复的执行偏差。不要打开正式游戏入口来验证测试登录。
6. 开发登录仅账号；恢复的控制租约可在界面正常接管，此操作只应针对新建隔离库。

本目录的`*-host.mjs`、`prepare-driver.mjs`等为当时一次性取证脚本，输出路径固定；审计用途保留，**不要直接在原证据目录重跑覆盖文件**。需要复演时复制到新验收目录，调整输出位置，并使用新的隔离集群。恢复自然归档是存档恢复，不是授予角色成长；不得改成把其中字段UPDATE进正式角色。

`cleanup.json`证明自有临时PG工作目录停止并清理至0；完整归档和证据仍保留。正式服务未停止/重启；正式12条自动零收益记录保持原样，待用户裁决。

`manifest.json`保存原始字节SHA256；文字文件另给LF规范化SHA256，以便跨平台Git行尾转换后核对。JPEG与PG归档始终按原始二进制哈希核对。`verification.json`的通过仅代表证据结构校核，不代表玩家体验、正式隔离约束或高层玩法全部通过。
