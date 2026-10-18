# M0 遗留修复复验报告

日期：2026-09-28。基线：`2ac8546`；本修复提交：`8a7cca6`。
依据：`docs/reviews/20260928-independent-acceptance.md`（独立验收）所列三项问题与两项验证要求。

## 结论

独立验收提出的三项问题全部修复并复验通过；并发证据按第四条要求加强。最终 `make check` 全绿：**33 通过 / 0 失败 / 0 跳过（30.7s）**，清理记录完整落盘。M0 按独立验收的四项重新签收条件判定为**通过**。

## 逐项修复与复验

### 1. [P1] 技能击杀最后一个敌人报错并丢失终局事件 → 已修复

- `client/combat/battle_core.gd`：自动攻击循环改用与 `_nearest_enemy()` 返回值一致的 `target.is_empty()` 判断（原 `== null` 永不匹配，导致读 `target["x"]` 崩溃、该 tick 的伤害/死亡事件因未归档而丢失）。
- `step()` 内部顺序显式化并加终局守卫：命令 → 未决施法 → 普攻 → 事件归档；`outcome()` 非空后直接返回空数组，不产生重复结算或重复死亡。
- `client/tests/battle_core_headless.gd`：终局后再推进一次的冻结探测（trace 不变才通过）。
- 新增 `tests/core/test_terminal_blow.py` 六项：默认样例、报告原始复现（raider_2 max_hp=1）、单体技能清场（末击 cause=strike）、普攻清场（cause=auto）、范围技能同 tick 双杀、我方全灭。每项校验：无脚本错误（processguard 错误模式）、终局正确、每个死亡角色恰好一条死亡事件且与同 tick 伤害事件配对、trace 终止 tick == 最后一击 tick。
- 用独立验收的原始复现规格 `core-terminal-repro.json` 直接复跑：退出码 0、零 SCRIPT ERROR、终局 cleared、死亡事件在档。

### 2. [P2] 手动 Web 体验入口跨域 405 → 已修复

- 新增 `tools/dev.py` + `make dev`：固定页面地址（默认 `http://127.0.0.1:8602`，`ABYSS_WEB_PORT` 可覆盖），API 以 `ABYSS_CORS_ORIGINS=<该 origin>` 启动（保持受限 allow-list，只是自动接线），一次性 PostgreSQL 就地启动并迁移，DSN 直接打印；Ctrl-C/SIGTERM 走同一 finally：停 API、停库（核验 postmaster.pid 消失）、删集群。
- `client/net/api_client.gd`：区分三层失败并给出人话提示——连接层失败（`outcome[0] != OK`）、空响应且非 204（原先被当成正常空 JSON）、`request()` 发送失败；均回填 `body.detail`，主菜单直接显示原因（如"网络错误…请确认 make dev 已启动"），不再出现空白失败。
- README「手动体验 Web 构建」改为 `make web` + `make dev` 两步，地址、origin、数据库配置全部写明。
- 复验：干净环境 `make dev` 启动后，`OPTIONS /sessions` 预检返回 204 且带 `Access-Control-Allow-Origin`（修复前 405）；静态页 200；预检无代理干扰（`--noproxy`）。

### 3. [P2] 异常清理与清理报告 → 已修复

- 新增 `tools/runowner.py`：临时目录所有权登记（`owner.json`：pid + 工具名 + 时间）；回收须同时满足"真实目录、非符号链接、工具匹配、属主进程已死"；停止失败不删除、不计释放；全程不跟随符号链接。
- `tools/pgproc.py`：`reap_stale()` 经 runowner 递归搜索（覆盖 `awr-check-*/awr-pg-*` 嵌套），先 `pg_ctl` 停止并核验 `postmaster.pid` 消失再删；`stop_and_measure()` 供 check 先计量后删除。
- `tools/processguard.py`：整个执行段包进外层 try/finally，执行文件缺失、超时、输出超限等所有退出路径都清理 `awr-run-*` 草稿目录。
- `tools/check.py`：cleanup 先于报告；先计量（本轮 93,747,271 字节）→ 停 API → 停库并核验 → 删目录 → 复核余量（0）→ **最后**写含 `cleanup` 字段的报告；SIGTERM 转 KeyboardInterrupt 保证中断路径同样收尾；`ABYSS_CHECK_FAIL_AFTER=<step>` 注入式失败用于真实验证失败路径。
- 新增 `tests/tools/test_cleanup_paths.py` 五项：执行文件缺失、超时、输出超限、孤儿嵌套集群回收（真实子进程建库后退出 → 回收器停止并核验）、注入失败路径的完整清理与报告字段断言。

### 4. 并发回归证据加强

- `test_concurrent_duplicate_commands_produce_one_change`：改为有截止时间（20s）轮询 `pg_stat_activity`，**观测到两笔请求同时处于 `wait_event_type='Lock'`** 才释放外部行锁；随后断言两次 201 且响应体相同、角色与回执各 1。
- 新增 `test_api_restart_preserves_characters_and_receipts`：真实启动第二个 API 进程（同 DSN），重启后角色 200、同 command_id 重发 201 且响应与原回执一致。
- 全链路真实进程：真实 TCP、真实 PostgreSQL、真实事务，无 mock。

## 最终检查

`make check`：7 步全 ok，**33 通过 / 0 失败 / 0 跳过**（REQUIRED_TESTS 从 20 扩到 27，新增项全部在册），30.7s。清理：before=93,747,271B → after=0B，errors=0，PostgreSQL 停止已核验（40,513,163B）。报告：`docs/reviews/m0-check-report.json`。

## 剩余限制（不变，非缺陷）

战斗为文本面板；奖励/装备/成长/重连属 M1；一次性集群仅 loopback trust；Windows 导出与备份演练属 M2/M4。
