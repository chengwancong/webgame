# C6 测试失败分类与处理

- 首轮全量：240文件，1731通过、4失败、2项仓库原有skip；独立任务日程1通过。
- 四项失败均为真缺陷（验收环境）：WindowsApps的python3执行别名在Node spawnSync/execFileSync中返回EOF或非零状态。涉及world-island-quest-config、world-phase-config（两项）及world-production.database。
- 修复：在本期自有.qa/pacing-identity-bin放置真实Python解释器的python3.exe副本，只为本期shell及其子进程设置PATH/PYTHONHOME。未改测试、未改任务/相位/生产内容、未改全局环境。
- 先用原三文件在独立临时库复验，再完整重跑；第一次日志和清理证据保留。
- C2过期测试：锚点模型替代实时中位数模型，显式实测夹具替代估计边际；8%floor与5%网格冲突时断言首个可行网格10%。描述测试改查非默认参数，不再要求默认100%/0秒或数字规则名。独立参数遍历和实际伤害断言仍保留。
