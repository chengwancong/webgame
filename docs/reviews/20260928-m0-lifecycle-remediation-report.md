# M0 生命周期修复与复验报告

日期：2026-09-28。修复依据：`docs/reviews/20260928-second-independent-acceptance.md`。
被验收提交：`5c054e4`（含 `8a7cca6`）。证据：`docs/reviews/evidence/lifecycle-evidence.json`
与 `docs/reviews/evidence/manual-web-flow-*.png|json`。

## 一、结论

第二次独立复验把 M0 挡在签收之外的四项，本轮已全部修复，并在**真实入口**上复验：

| 编号 | 问题 | 状态 | 关键证据 |
|---|---|---|---|
| P1 | `check` 启动回收先删父目录，删掉仍在运行的数据库文件 | 已修复 | 真实 CLI 入口用例：库先停（端口关闭）、后删目录；`reaped_stale_runs` 记录 `stopped/verified/removed` |
| P2 | 中断时 `run_guarded` 只删日志目录，留下子进程 | 已修复 | 真实 SIGTERM 回归：子进程确认退出 + 无残留临时目录；本轮另有一个真实孤儿被项目回收器停掉 |
| P2 | `make dev` 没删数据库目录却报 “bytes removed” | 已修复 | 正常退出 / SIGTERM / 启动失败三条路径都断言“报告的目录真的不存在、剩余字节为 0” |
| P2 | `make db` 在无 `PYTHONPATH` 的终端启动失败 | 已修复 | `env -u PYTHONPATH make db → migrate → api → 中断` 全链路用例通过 |

另外处理了复验报告里“保持报告准确”一节指出的问题：原 `test_low_hp_last_enemy_repro_*`
其实是一个变体，不是被保留的原始规格。现在原始规格已作为固定夹具纳入回归，变体用例也改了名字。

**本轮不自称最终签收。** M0 是否通过由下一轮独立复验判定；本报告只给出可复现的修复与证据。

## 二、逐项修复

### 1. [P1] 回收顺序：先停内部资源，再删父目录

**位置**：`tools/check.py`（`reap_stale_runs` / `stop_run_dir_resources` / `release_run_dir` / `finish`）、
`tools/runowner.py`（`reap_stale` 的 stopper 语义）。

**原因**：启动时 `runowner.reap_stale('awr-check-*', OWNER_TOOL)` 不带 stopper，直接 `rmtree`
整个父检查目录。若上一轮检查的父进程已死、而它启动的 PostgreSQL 仍在跑，数据文件先被删，
后面的 `pgproc.reap_stale()` 已找不到数据目录，无法再按原方式停库 —— 删了目录但没收尾资源。

**修复**：

- 新增 `stop_run_dir_resources(work)`：删除前遍历目录内所有 `awr-pg-*`，逐个 `pgproc.stop_cluster_dir`
  停库并核验；任何一个未停成功就返回 `stopped: false` 并带上失败原因。
- `reap_stale_runs()` 把它作为 stopper 传给 `runowner.reap_stale`，因此父目录只有在内部资源全部
  停止并核验后才会被删除；停止失败时目录与 `owner.json` 都保留，记录里 `removed: false`。
- 删除失败/停止失败不再静默：这类遗留会写进清理错误，进而让 `report.ok = false`、退出码非零。
- 运行中的这一轮同样按依赖顺序收尾：把清理逻辑抽成 `release_run_dir(run_dir, api_process, cluster)`，
  顺序为 **API → 数据库（停止并核验）→ 目录**；数据库停止未核验时**保留目录**并记录错误。
- `check.finish()` 现在会在 cleanup 里有任何错误时把 `ok` 置 false、退出码置非零；`cleanup` 里新增
  `retained` 字段，报告先清理后落盘（报告始终带清理记录）。

**复验**（都不是只测局部函数）：

- `tests/tools/test_lifecycle_entrypoints.py::test_check_entrypoint_stops_a_leftover_database_before_deleting_its_run_dir`
  —— 由一个真实子进程登记父检查目录所有者、在内部启动真实 PostgreSQL 后退出，然后运行**真实
  `tools/check.py` 入口**：断言库里先被停止（原监听端口关闭）、`reaped_stale_runs` 里
  `stopped/verified/removed` 全为真、`bytes_removed > 0`、父目录消失、临时根目录没有残留。
- `::test_check_entrypoint_keeps_a_run_dir_whose_database_will_not_stop` —— 构造一个 `pg_ctl`
  无法停止的目录，断言：目录被保留、`owner.json` 保留、错误写明原因、清理错误进入报告且 `ok=false`、
  退出码非零。
- `::test_a_run_dir_is_kept_when_its_own_database_will_not_stop` —— 当前这一轮（`release_run_dir`）
  同样“停不了就不删”。
- `::test_a_symlinked_or_foreign_run_directory_is_never_reaped` —— 符号链接目标不被跟随/删除，
  归属为其他工具的目录不被回收。

### 2. [P2] 中断时的进程收尾

**位置**：`tools/processguard.py`（`run_guarded` 外层 finally + 新增 `_reap_process` / `_wait_gone`）。

**原因**：最外层 `finally` 只做 `rmtree(out_dir)`；正常超时会 `terminate`，但父进程收到 SIGTERM
（`check.py` 把它变成 `KeyboardInterrupt`）时不走该分支。子进程用 `start_new_session=True` 启动，
不会跟随父进程退出，于是“日志目录删了、子进程还在”。

**修复**：外层 finally 现在无条件收尾 —— 对仍在运行的自有进程组先 SIGTERM、限时等待，再 SIGKILL、
再限时等待，**确认退出后**才删除临时目录；若 SIGKILL 后仍存活，记录 `process_leaked` 并保留临时目录
路径以便追溯（不伪报为已清理）。超时分支里原先的“kill 后不等待”也一并收敛到这个统一路径。
`RunResult` 增加 `forced_cleanup` / `process_leaked` / `scratch_dir_retained` 三个可观测字段。

**复验**：

- `::test_run_guarded_reaps_its_child_when_the_parent_is_interrupted` —— 包装进程使用与 `check.py`
  相同的中断语义（SIGTERM → 在该帧抛 `KeyboardInterrupt`），管理一个真实长睡子进程。断言：
  中断前子进程存活 → SIGTERM 后包装进程正常退出 → 子进程在限时内消失 → 临时目录无残留。
- 本轮实测中还真的出现了一个孤儿：某次工具调用结束时 shell 被回收，`dev.py` 在清理途中被杀，
  留下真实 postmaster（pid 81601，仍在 58007 监听）。项目自己的回收器把它停掉并删除了目录
  （40,407,226 字节），记录见 `lifecycle-evidence.json`。

### 3. [P2] `make dev` 的实际删除与如实报告

**位置**：`tools/dev.py`（finally 收尾、错误聚合、退出码）、`tools/pgproc.py`（新增 `stop_and_delete`）。

**原因**：`stop_and_measure()` 只负责停止与计量，不删除目录；`check.py` 之后会删父目录，但 `dev.py`
没有对应步骤，于是把“测到的数据库大小”当成“已删除字节”打印出来，目录却还在（复验报告实测剩余
40,558,935 字节）。

**修复**：

- 新增 `pgproc.stop_and_delete(cluster)`：停止 → 核验 → 只删除本项目自有（非符号链接、`owner.json`
  属主匹配）的工作目录 → **重新测量**剩余字节 → 返回 `bytes_before / bytes_after / bytes_removed / removed`；
  任一环节失败都返回 `removed: false` + `retained` 路径 + `error`。
- `dev.py` 改用它，并在输出里打印**被删目录的路径**与真实删除量；只要停止、删除或复测任何一项没成功，
  就打印 `ERRORS:` 并以非零退出码结束。
- 正常退出 / SIGTERM / 启动失败（API 端口被占用导致健康检查超时）三条路径都走同一个 finally。
- `make db`（`pgproc.serve`）同样改用 `stop_and_delete`，失败时以非零退出码 + 明确原因结束。
- `pgproc.start()` 在 initdb / pg_ctl 失败时不再留下半成品目录：先停并删除，再抛出带输出的错误。
- 顺带修正启动横幅里的按钮名（原来写“开始联网战斗”，实际按钮是“进入开场遭遇（服务端数据）”）。

**复验**（`tests/tools/test_lifecycle_entrypoints.py`）：

- `::test_make_dev_normal_exit_deletes_the_database_and_reports_real_bytes` —— 真实 `dev.py`，
  正常退出：报告的目录路径必须真的不存在、字节数 > 0、临时根无残留、两个端口都释放。
- `::test_make_dev_sigterm_deletes_the_database_and_reports_real_bytes` —— 真实 SIGTERM：同上，
  并先确认服务已就绪、集群目录确实存在。
- `::test_make_dev_startup_failure_stops_everything_it_started` —— 故意占用 API 端口制造启动失败：
  退出码 1、打印 `ERRORS:`、数据库目录被删、静态服务端口释放。
- 真实终端证据（干净环境、默认端口 8602/8601）：中断后 stdout 为
  `stopped: api (pid 84166); static server :8602; postgres (stopped, deleted /tmp/awr-mkdev-check/awr-pg-52tiot40, 40407185 bytes)`，
  之后 `leftover=0`、`ports=0`、scratch 剩余 0 字节。

### 4. [P2] `make db` 的干净终端入口

**位置**：`tools/pgproc.py`（脚本自带仓库根导入路径）、`Makefile`（`db` 改为 `python -m tools.pgproc`）。

**原因**：新增的 `from tools import runowner` 需要仓库根在 `sys.path`，而 Makefile 用
`.venv/bin/python tools/pgproc.py` 运行（`sys.path[0]` 是 `tools/`），在无 `PYTHONPATH` 的终端里
直接 `ModuleNotFoundError: No module named 'tools'`。

**修复**：`pgproc.py` 像 `migrate.py` / `dev.py` 一样在文件顶部把仓库根插入 `sys.path`，
Makefile 的 `db` 目标同时改为模块方式运行 —— 两条路径都能工作。

**复验**：`::test_clean_terminal_runs_make_db_migrate_and_api_without_pythonpath` —— 在剥掉
`PYTHONPATH` 与全部 `ABYSS_*` 变量的环境里跑**文档命令** `make db` →（读日志里的 DSN）→
`make migrate` → `make api` → 中断数据库：断言无 `ModuleNotFoundError`、迁移成功、`/health` 正常、
停止后端口关闭、集群目录被删、`make db` 退出码为 0。

### 5. 附带修正：验证工具的读取循环

`tools/web_check.py` 的 CDP 读取循环在页面空闲 1 秒后会因超时异常直接 `return`，此后所有命令都无响应、
连接最终因 keepalive 超时断开。管线里的自动浏览器流程因为页面持续输出而“碰巧”没暴露它，但交互式
驱动（本轮真实输入验证）必挂。已修正为：空闲继续等待，只在连接真正关闭时结束。

### 6. 保持报告准确：原始规格纳入固定回归

`tests/core/test_terminal_blow.py`：

- 新增 `test_the_original_acceptance_repro_spec_ends_with_a_complete_killing_tick`：逐字节读取
  `tests/core/fixtures/core-terminal-repro.json`（与第一轮验收保留的规格 `bytes_equal=True`，
  sha256 `f45a55af479aff13…`），断言 tick 26 的击杀伤害与死亡事件都在档、终局 `cleared`、
  事件不重复、不得越过终局推进。
- 原用例更名为 `test_a_low_hp_last_enemy_variant_keeps_the_killing_tick`，docstring 明说它是变体、
  不是被保留的规格。

## 三、全量检查结果

```
make check   exit 0     47.7s
passed 43   failed 0   skipped 0     必跑用例 42 / 42（missing_required = []）
cleanup: before=93,757,607 bytes  after=0  removed=True  errors=0
```

步骤全部 ok：content / compile-client / export-web / postgres / migrate / pytest(36.8s) / browser-flow(7.9s)。
报告：`docs/reviews/m0-check-report.json`（含 `cleanup` 与各步骤明细）。

必跑清单本轮从 27 项扩到 42 项，新增的 15 项全部落在“真实入口 + 资源生命周期”上
（`tests/tools/`，其中 9 项是新的入口级生命周期用例），未扩到 M1。

## 四、真实输入 Web 流程证据

干净终端（`PYTHONPATH` 与全部 `ABYSS_*` 变量已清除）执行 `make dev`，默认地址 8602/8601：

- CORS 预检 `OPTIONS /sessions`（Origin `http://127.0.0.1:8602`）返回 200 且带
  `access-control-allow-origin`（第一轮修复前为 405）；页面 200；`/health` 为 `ok/database ok`。
- 真实 Chrome 打开 `http://127.0.0.1:8602/index.html`，**不带任何查询参数**（无 `aw_auto`、无 URL 凭据）。
  账号先用真实 API 预建一次，随后：键盘逐字输入账号与 20 位密码 → 鼠标点击「登录」→ 界面显示
  「已登录，角色 回廊行者（Lv.1）」→ 鼠标点击「进入开场遭遇（服务端数据）」→ 完整打完一场：
  `tick 39 / outcome cleared / 20 个事件 / console_errors []`，界面显示「战斗结果：胜利」。
- 证据：`docs/reviews/evidence/manual-web-flow-typed.png`（输入后的两个输入框）、
  `manual-web-flow-login.png`（登录成功、按钮可用）、`manual-web-flow-victory.png`（终局面板）、
  `manual-web-flow.json`（坐标、口径与结果）。

## 五、清理报告

- 本轮自身的临时目录（仓库内 `.qa/`、`/tmp/awr-manual-*`、`/tmp/awr-mkdev-check`）：计量 694 字节 → 0；
  `make check` 每轮的 93,757,607 字节随报告一并删除（`after=0`）。
- **不计入本轮**的清理：上一轮遗留、已停止但未删的集群 `/tmp/awr-pg-syjaep_1`
  （`owner.json` 时间 09:20:11，40,407,209 字节）由项目回收器删除；以及本轮工具调用被 shell 回收时
  产生的真实孤儿（40,407,226 字节）。两项都单独记在 `lifecycle-evidence.json` 里，不混进本轮数字。
- 保留：`.venv`、`web-build/`（当前构建，README 默认入口依赖它）、`docs/reviews/`（报告与证据）。
  未触碰旧 `game` 工程、旧部署、旧玩家数据与 `cloudrealm/`。

## 六、修改文件

```
tools/check.py            回收顺序（stop_run_dir_resources / reap_stale_runs / release_run_dir）、
                          清理错误纳入 ok 与退出码、ABYSS_CHECK_REPORT、必跑清单 42 项
tools/runowner.py         stopper 语义与文档（停止失败不删、不计量）
tools/pgproc.py           仓库根导入路径、stop_and_delete、start 失败清理、serve 退出码、flush
tools/processguard.py     所有退出路径回收自有进程组、process_leaked 可观测
tools/dev.py              真实删除与如实报告、启动失败/中断统一收尾、参数与文案修正
tools/web_check.py        CDP 读取循环空闲不再自杀
Makefile                  db 改为 python -m tools.pgproc；dev/db 注释与实际行为一致
README.md                 M0 状态更正、真实删除语义、按钮名、42 项必跑、证据路径
tests/tools/test_lifecycle_entrypoints.py   新增 9 项入口级生命周期用例
tests/core/test_terminal_blow.py            原始规格固定回归 + 变体更名
tests/core/fixtures/core-terminal-repro.json 第一轮验收保留的原始规格（逐字节一致）
docs/reviews/evidence/*                     真实输入截图、流程 JSON、生命周期证据 JSON
```

## 七、剩余限制与未覆盖项

- M0 是否签收：**由独立复验判定**，本报告不代签。
- 游戏中战斗画面仍是文本状态面板；奖励 / 装备 / 成长 / 断线重连属 M1，本轮未做。
- 一次性集群使用 loopback + trust 认证（仅开发用途，随机端口、无真实数据、退出即删）。
- Windows 导出、备份恢复演练属 M2/M4。
- 本轮未重新用真人键盘在浏览器里从零注册新账号（用的是“预建账号 + 键盘输入已有凭据”，与复验口径一致）；
  「注册并登录」按钮走的是同一条输入与提交流程，已由 `make check` 的浏览器流程覆盖。
