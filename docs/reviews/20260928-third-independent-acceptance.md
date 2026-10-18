# 第三轮独立验收：M0 生命周期修复

- 日期：2026-09-28
- 验收版本：`343bb3fa5be56ddf379a398a4c92bc2b898667db`
- 范围：上轮四项修复、完整检查真实入口、默认 Web 手动路径及本轮资源回收。
- 结论：上轮四项中三项已关闭；实际完整检查中断时仍遗漏测试启动的 API，M0 暂不最终签收。

## 已通过的部分

| 项目 | 独立验收结果 |
| --- | --- |
| 完整 `make check` | 43 passed、0 failed、0 skipped；42 项必需检查均出现，命令返回 0 |
| 遗留检查目录回收 | 真实入口先停止嵌套 PostgreSQL，再删除父目录；停止失败时保留目录并报告失败；符号链接及非本轮所有目录受到保护 |
| `make dev` 生命周期 | 正常退出、SIGTERM、启动失败的回归通过；额外运行实际 Web 构建后中断，数据库、API、Web 服务均停止，工作目录删除 |
| 干净终端启动链路 | 无 `PYTHONPATH` 时，`make db → migrate → make api → interrupt` 的真实入口回归通过 |
| 战斗结束逻辑 | 原始低血量复现样例及终结攻击、全灭等回归通过；可见客户端与无界面核心对照通过 |
| 默认手动 Web 路径 | 打开 `http://127.0.0.1:8602/`，实际输入临时账号并操作登录、开战，取得胜利；tick 39、20 条事件，无浏览器错误 |

手动 Web 路径未使用自动流程 URL 参数、URL 密码或业务 JavaScript 触发。使用独立临时数据库和测试账号。复用了现有 Web 构建：本次修复没有改变运行时客户端源码；完整检查另有临时真实导出及浏览器流程验证。

完整检查正常结束时，工作目录实际从 93,757,383 字节降至 0，清理报告无错误。额外手动运行 `make dev` 后，数据库工作目录从 40,513,725 字节降至 0，8601、8602 端口关闭。

## 仍需修复：P2，完整检查中断后遗漏 API 进程

这是上轮中断回收问题的剩余部分。直接子进程已能回收，但真实集成测试另起会话启动的 API 不在该进程组内。

相关位置：

- `tests/conftest.py:118`：API 通过 `start_new_session=True` 启动。
- `tests/conftest.py:139–151`：API 的正常退出依赖 pytest fixture 的 `finally`。
- `tools/processguard.py:194–208`：回收被跟踪进程后删除临时目录。
- `tools/processguard.py:227–245`：等待直接子进程退出，无法证明另起会话的后代进程已经停止。

### 本轮实际复现

1. 在独立临时根目录中启动真实 `.venv/bin/python tools/check.py`。
2. 等待 pytest 启动真实 Uvicorn API，并确认其端口正在监听。
3. 只向检查进程发送 SIGTERM，触发检查入口自己的中断处理。
4. 等待检查退出，检查原 API 的存活与监听状态，对照清理报告。

实际进程关系为 `check → pytest → uvicorn`；Uvicorn 有独立进程组。中断回收 pytest 不会自动回收这个 API，也无法保证运行 fixture 的清理代码。

本次观测：

- 检查返回码为 **130**，正确表示被中断。
- API PID 为 **96070**、进程组为 **96070**、端口为 **49584**。
- 检查结束后，API 仍然存活，49584 仍在监听。
- 清理报告同时记录 `removed=true`、`after_bytes=0`、`errors=[]`，检查临时目录已经删除。
- PostgreSQL 已经停止，故残留 API 还失去了其原本连接的数据库。

这里的问题是资源清理不完整、清理报告遗漏错误；不是检查错误返回了成功码。本轮验收随后单独停止了自己创建的残留 API，并确认端口关闭，没有留下该进程。

### 修复建议与通过条件

让一次检查显式拥有其启动的全部后台资源，包括测试 fixture 创建的独立会话 API；可以登记资源并由入口统一回收，也可以调整进程会话归属，确保中断覆盖这些进程。不能只以 pytest 已退出作为回收完成的证据。

取消检查时，先停止并确认本轮 API 等后台进程退出，再停止数据库、删除目录。按本轮资源身份回收，不使用无差别 `pkill uvicorn`。停止失败时保留定位信息，并把实际残留写入 `cleanup.errors`。

新增回归必须中断**完整检查入口**：在真实集成测试 API 已启动且正在监听时发送 SIGTERM，断言 API 与数据库均停止、端口释放、无本轮残留进程；成功回收后才允许报告目录清理完成。现有“包装器启动一个休眠子进程”的测试不能覆盖另起会话的 API。

修复后复跑上述中断用例及完整检查；不需要重做本轮已确认的业务设计。

## 验收边界与清理

本轮未修改业务源码。对 129 个已跟踪文件核对哈希，变化仅为完整检查生成的 `docs/reviews/m0-check-report.json`；另新增本报告与必要证据。旧工程、旧存档及 `cloudrealm/` 未作修改或清理。

本轮已计量清理 **521,609,693 字节 → 0**：包括临时根目录中 52 次有前后记录的删除，以及最终剩余 5,164 字节。该数字只统计实际观测到的本轮删除，不包含开始前已经消失的内容。部分干净环境子测试移除了计量环境变量，其自行删除的数据未另作估算并计入总数。

最终临时根目录已不存在，本轮核验的 8601、8602、49584 端口均关闭；浏览器验收页已关闭。保留当前 Web 构建、导入缓存、虚拟环境与必要证据。

这是 M0 技术链路验收。奖励结算、装备成长、完整关卡和重连等后续游戏闭环不属于本轮已完成范围，不能据此认定完整游戏已经重建完成。

## 证据

- [完整检查结果](20260928-third-independent-evidence/full-check-report.json)
- [完整检查日志](20260928-third-independent-evidence/make-check.log)
- [中断入口复现结果](20260928-third-independent-evidence/interrupted-entrypoint-result.json)
- [中断时检查报告](20260928-third-independent-evidence/interrupted-check-report.json)
- [手动 Web 胜利截图](20260928-third-independent-evidence/default-dev-victory.png)
- [手动 Web 战斗记录](20260928-third-independent-evidence/default-dev-trace.txt)
- [开发环境退出核验](20260928-third-independent-evidence/dev-shutdown-result.json)
- [源码变化核验](20260928-third-independent-evidence/source-verification.json)
- [实际清理统计](20260928-third-independent-evidence/cleanup-summary.json)
