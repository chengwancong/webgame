# M0 修复验收报告

日期：2026-09-28。工程：`/Users/chengmocong/Documents/ChatGPT/abyss-walker-rewrite`。
依据：`docs/reviews/20260927-m0-review.md`、本工程 PRODUCT/AGENTS、`game/docs/00-project/full-rewrite-plan-20260927.md`。

## 结论

**M0 通过。** 全部检查由 `make check`（`tools/check.py`）在一条可重复管线内完成，最近一次运行 22.3 秒：内容构建、客户端编译、Web 导出、一次性 PostgreSQL、迁移、21 项测试（0 跳过 0 失败）、真实浏览器联网流程，随后自动停库、删集群、删临时目录。报告见 `docs/reviews/m0-check-report.json`。

上一轮检查的 7 个优先问题全部关闭；未把 M1 功能（奖励、装备、成长、重连）计作完成。

## 逐项修复与验证

### 一、编译、测试退出与开发环境

1. **rounded() 编译错误** — 已修。快照精度明确为 `SNAPSHOT_PRECISION = 0.000001`（`battle_core.gd`，仅序列化时使用，不掩盖状态差异）；显示层另行用 3 位小数（`DISPLAY_DECIMALS`）。验证：编译检查通过；可见与 headless 的 trace（事件序列+终局快照）完全一致。
2. **初始化失败不终止** — 已修。`BattleCore.build()` / `BattleRunner.start()` 显式返回成败；headless 循环改为按迭代计数（`MAX_STEPS=1200`，不依赖 tick），另有 60 秒看门狗。验证：`test_a_broken_core_fails_fast_and_stays_inside_output_bounds` 故意重新引入 `rounded()` 缺陷，结果在时限内以错误输出失败，输出小于上限。
3. **检查工具边界** — 新增 `tools/processguard.py`：外部超时、输出/日志体积上限、进程组终止、错误模式检测（Godot 打印解析错误时退出码为 0，因此必须同时匹配成功标记）、日志写入本轮临时目录（`--log-file`）。验证：`make check` 每步都有界；缺陷复现测试确认快速失败。
4. **日志与用户数据隔离** — 工程名改为 `AbyssWalkerRewrite`，用户数据目录与旧版 `Abyss Walker` 分离（实测仅 20KB）；所有检查日志写入本轮临时目录并随清理删除。
5. **依赖** — `psycopg-pool==3.3.3`、`websockets==17.1` 已进入 `requirements.in` 与锁文件；`tools/bootstrap.py` 强制 Python 3.12.x，`make setup`（`tools/setup`）选择解释器并从空目录重建 `.venv` 验证通过（随后再跑 `make check` 全绿）。
6. **make db / migrate / api** — 已接通：`make db` 启动一次性集群（127.0.0.1 随机端口）并打印 `ABYSS_DSN`，退出/Ctrl-C/SIGTERM 都会停止并删除；被硬杀留下的集群由下次启动自动回收（`reap_stale`，实测回收 7 个）。干净终端验证：`make db` → `make migrate`（应用 0001+0002）→ `make api` → `/health`、`/version`、注册、登录全部正常。
7. **Git 仓库** — 已初始化并提交基线，`.gitignore` 覆盖 venv、缓存、凭据类文件、临时目录与构建产物；旧 `game` 工程与本轮无关文件未动。

### 二、身份与持久写入边界

- 密码 PBKDF2（200k 次迭代）+ 常数时间比较；`POST /sessions` 登录、`DELETE /sessions/current` 可撤销会话（哈希存储、过期、吊销）。
- 角色创建/读取/开场数据均从会话推导账号；请求模型 `extra='forbid'`，根本没有可填 account_id 的字段。未登录 401、错误密码 401、吊销/伪造 token 401、跨账号读取与取开场数据 404（刻意不泄露存在性）。
- 同名注册返回 409 `LOGIN_TAKEN`，响应中不含任何凭据；同名角色 409 `CHARACTER_NAME_TAKEN`。
- 并发幂等：`commands.replay_or_run` 在事务内先 `SELECT … FOR UPDATE` 锁定账号行，再查回执、执行业务、写回执并提交；唯一约束冲突时整事务回滚并重读已提交回执（`ReceiptRace`），不会变成 500。
- 相同 command_id+相同参数返回原结果；相同 ID 不同参数 409 `COMMAND_CONFLICT`。
- 回执与角色写入同一事务；业务写入后抛错整体回滚由真实数据库测试证明（`test_failed_business_write_rolls_back_everything`：插入后抛错，角色与回执计数均为 0）。

### 三、工程验证

- `make check`/`make ci` 自动管理隔离 PostgreSQL：启动（随机端口、loopback）、迁移、测试、停止、删除。缺 `ABYSS_DSN` 或必跑测试被跳过 → 检查失败（`ABYSS_REQUIRE_INTEGRATION=1` 下 fixture 直接 `pytest.fail`；解析 `-v` 输出后缺任何必需用例都判失败）。
- 真实并发验证：外部连接先持有账号行锁，使两个 HTTP 请求确定性地同时到达回执检查点；两者都返回 201 且响应体一致，数据库中角色与回执各恰好 1 条（`test_concurrent_duplicate_commands_produce_one_change`）。
- 回滚、响应丢失后重试同 ID 取回原回执，均有真实数据库测试。
- 全部身份/事务/网络链路使用真实进程：uvicorn 子进程 + httpx over TCP + 真实 PostgreSQL；浏览器链路用真实 Chrome。无 mock 替代。
- 过程中发现并修掉一个环境陷阱：本机 shell 导出 `HTTP_PROXY`，回环请求经代理后在 keep-alive 连接上改写为绝对目标、服务器对存在的路由返回 404。测试客户端固定 `trust_env=False`，Chrome 加 `--no-proxy-server`（记录在 `tests/conftest.py`）。

### 四、客户端流程与 Web

- 客户端（Godot）通过真实 HTTP 完成注册/登录、创建角色、读取角色、取得开场 BattleSpec（`/opening` 返回 ruleset、遭遇、技能参数、种子与角色镜像）；在线入口只用服务端数据开战，本地样例更名为 `client/data/fixture_combat.json` 并在界面上明确标注"离线夹具战斗（仅测试）"。
- 可见场景与 headless 使用同一 `BattleCore`/`BattleRunner`、同一 BattleSpec、种子与逐 tick 策略；比较对象是关键事件序列 + 终局快照（不是简化结果串），且双方完全一致（pytest + 浏览器两处验证）。
- 真实 Web 导出（`web-build/`，51MB，含打包的 Noto Sans SC 中文字体，OFL 许可随附）；headless Chrome 经 DevTools 驱动完成整条联网流程并截图：登录 → 建角"验收行者" → 取 BattleSpec → 打完 39 tick → "战斗结果：胜利"，浏览器 trace 与 headless 参考逐字段一致，无控制台错误。证据：`docs/reviews/evidence/web-flow.png`。
- 职责分离保持：服务端只发 JSON BattleSpec，不创建也不依赖 Godot 场景；战斗临时状态在客户端核心内，持久资产只经服务端事务。

## 交付物

- 代码与命令：见 README；`make check` 可复现上述全部结论。
- Web 构建：`web-build/`（`make web` 可重建）。
- 检查报告（机器可读）：`docs/reviews/m0-check-report.json`；浏览器证据：`docs/reviews/evidence/web-flow.png`。

## 本轮清理

- 每轮 `make check` 的临时目录（Web 导出 + PostgreSQL 集群 + 日志，约 90MB/轮）随运行结束自动删除；管线退出前停库、删集群。
- 手工清理：7 个因硬杀遗留的临时集群（约 40MB/个，量级与上轮一致）、1 个遗留检查目录 38MB、`/tmp` 下本轮中间物约 38MB、仓库内 `__pycache__`/`.pytest_cache`。上轮失控日志（2.9GB）已由检查轮删除，不在本轮数字内。
- 保留：`.venv`（68MB，运行所需）、`web-build/`（51MB，最终构建）、`docs/reviews/`（约 92KB，必要证据）。磁盘可用空间前后约 72GB 持平。

## 剩余限制（不影响 M0 退出条件）

- 战斗表现为文本状态面板；命中表现、音画反馈属 M1/M2。
- 奖励、装备、成长、挑战结算、断线重连未实现（M1 范围）。
- 会话 TTL 固定 12 小时；接管/多设备语义属 M2。
- 一次性集群主机认证为 trust，仅 loopback + 随机端口 + 用后即删，不承载任何真实数据。
- Windows 导出、备份恢复演练属 M2/M4。
