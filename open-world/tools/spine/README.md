# 数值主干

目标来自 `config/excel/节奏目标.xlsx` 的主干目标页；导出到 `config/json/spine-targets.json`。运行内容只通过 `apply.ts` 的文件白名单、前值检查和真实 schema 写入。标准人、构筑和宿主的战斗计算使用正式 World。

## 当前验收状态

本周期已使用V1、V2、V3和两次修正，禁止直接再次执行本周期修正命令。用户随后授权修复测量并复核：B3末端平滑保留原始三秒DPS，冻结输入重放后更新权重及弹性，额外牛顿0步。旧区首领预算及完整房间压力遗漏已修复。最终证据指向 `data/spine-final-validation.json`；145项预算实测越界、6项危险度不可判定以及10格真实时序敏感性仍保留。完整状态以 `docs/reviews/numeric-spine-20261013/progress.md` 为准，不能把 `spine:check` 当成全量回归，也不能将数值残差报告为全部达标。

## 命令

所有命令在 `open-world` 执行。重任务必须串行，完成并退出后才启动下一项。新周期使用新的 `--out=目录`，相同路径中不同输入的arms不得覆盖。

| 命令 | 输出/作用 |
|---|---|
| `pnpm spine:check` | 对比已冻结源哈希并报告现有预算残差；存在任一问题时退出1 |
| `pnpm spine:bench --player --out=目录` | 13个标准人真实点及10个同档武器族配置；全部点完成才更新canonical模型 |
| `pnpm spine:bench --levels=10,20 --out=目录` | 指定等级诊断，不覆盖完整标准人模型 |
| `pnpm spine:bench --builds --out=目录` | 8个参考构筑的有限窗口测量 |
| `pnpm spine:bench --stats --out=目录` | L20/35/50属性配对扰动与权重 |
| `pnpm spine:bench --sources --out=目录` | 来源留一 |
| `pnpm spine:bench --content --out=目录` | 全量内容宿主测量 |
| `pnpm spine:bench --scenes --out=目录` | M3五场景真实测量 |
| `pnpm spine:audit --from=内容测量.json --out=目录` | 同组预算审计 |
| `pnpm spine:normalize --from=审计-summary.json --out=目录` | 预览一次闭式归一，不能重复用旧审计调参 |
| `pnpm spine:normalize --apply --plan=计划.json --out=目录` | 应用已审阅的前值→后值计划 |
| `pnpm spine:monsters --player / --efficiencies / --world` | 分别重测标准人、测效率、推导世界计划；写入须显式`--apply` |
| `pnpm spine:progression --timeline-only --out=目录` | 三个种子的临时库自然日程；失败样本不删除 |
| `pnpm spine:validate --suite=all --out=目录` | builds/calendar/walls/field/budget/guard六套件；未通过退出1 |

`--structure`、`--measure-elasticities` 和求解步数仅在用户授权的新周期内使用。结构测量开始后冻结，不因专用轴不足追加规则。`data/spine-anchor.json` 是冻结的8构筑L50锚点，不能通过重新生成锚点掩盖偏差。版本声明改变与真实重测分开记录。

## 证据和回归

原始arms、完整validation、自然日程和截图留在本机；结论摘要登记路径和SHA256。`review-policy.py` 拒绝原始文件、超过200KiB/2000行的留档，以及超过30000行的留档新增。

回归统一使用 `tools/pacing/run-tests.mjs 输出目录 --all`，临时PostgreSQL单worker运行并清理。Windows的Python别名不可用时，用 `with-python.mjs` 指定已验证解释器。正式构建使用 `tools/pacing/build-isolated.mjs`；不调用8612正式库或8790写接口。

只读Excel输出页由 `publish-results.py` 从已完成测量生成，工作表保护防止误改；目标页、原样式和批注保持。`prepare-own.py` / `prepare-json-own.py` 先把本期差量重放到HEAD副本，`stage-final.py`只暂存自有文件及这些差量。测试基线副本必须用`.snapshot`后缀，防止Vitest误发现。
