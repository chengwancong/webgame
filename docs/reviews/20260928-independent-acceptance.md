# M0 独立复验：基础链路通过，暂不最终签收

日期：2026-09-28。被验收提交：`2ac8546`。工程：`/Users/chengmocong/Documents/ChatGPT/abyss-walker-rewrite`。

依据：本工程 AGENTS、PRODUCT、README、20260927 检查报告、20260928 修复报告，以及上一轮 M0 修复范围。此次没有修改业务源码、测试源码、内容源或依赖；对 84 个受 Git 跟踪文件做了前后哈希核对。官方检查入口更新了其机器报告，另外新增本报告及必要证据。

## 结论

**M0 基础链路已有可运行证据，但暂不最终签收。** 当前不需要再次推倒重写；应先关闭下面三个可定位问题，再进入 M1。

独立执行 `make check` 成功：21 项测试通过，0 失败、0 跳过，整个命令约 22.5 秒。编译、真实 PostgreSQL、迁移、鉴权、角色归属、事务、Web 导出及默认样例对照均有实际结果。额外完成了真实并发阻塞观测、API 进程重启，以及通过正常键盘操作进入 Web 战斗。

但默认样例未覆盖技能完成最后一击时的错误；手动体验命令遗漏跨域配置；异常清理仍有遗漏。因此修复报告中的“M0 通过”“7 个优先问题全部关闭”需要收窄，不能仅用现有全绿管线签收。

这仍是 M0 联机技术样例：玩家登录后观看文本状态战斗，没有构筑选择、奖励决策、装备替换或失败后改善路径。奖励、成长、挑战结算和重连属于 M1；本报告没有把这些尚未承诺完成的功能列为本轮缺陷，也没有据此宣称游戏体验成立。

## 需要修复的问题

### 1. [P1] 技能击杀最后一个敌人时，战斗报错并丢失终局事件

位置：`client/combat/battle_core.gd:88–98`。

`_nearest_enemy()` 在没有敌人时返回空 Dictionary，调用者却用 `target == null` 判断，随后读取 `target["x"]`。技能结算在普通攻击循环之前；技能杀死最后一个敌人后就会进入这条错误路径。

复现只改本轮临时 BattleSpec：沿用现有技能、种子和策略，将 `raider_2.max_hp` 从 40 改为 1，其他参数不变。生命值 1 属于现有 schema 允许范围，未修改生产配置。第 26 tick 报：

```text
SCRIPT ERROR: Invalid access to property or key 'x' on a base object of type 'Dictionary'.
at: step (res://combat/battle_core.gd:91)
```

结果快照仍显示 `cleared`、敌人 hp=0，但事件列表停在第 25 tick，缺少第 26 tick 的伤害和死亡事件。Godot 最终仍返回 0；外部检查器正确根据错误输出判失败。可见/headless 使用相同核心并不能排除两边出现同一错误。

**修复要求：**使用与返回值一致的空目标判断；明确最后一击后的处理顺序，确保当 tick 的伤害、死亡事件在终止前进入 trace。补技能击杀最后敌人、普通攻击击杀最后敌人、范围技能同时清场和我方全灭样例；同时检查无错误输出、终局状态和事件完整性。

证据：`20260928-independent-evidence/core-terminal-repro.json`、`core-terminal-repro.log`、`core-probes.json`。

可从工程根复现，日志请写在自行创建的临时目录：

```sh
/Applications/Godot-4.7.app/Contents/MacOS/Godot --headless --path client --log-file /tmp/awr-terminal-repro.log --script res://tests/battle_core_headless.gd -- --spec /Users/chengmocong/Documents/ChatGPT/abyss-walker-rewrite/docs/reviews/20260928-independent-evidence/core-terminal-repro.json
```

实际验收应通过项目的外部超时/输出限制工具包装该命令，并在结束后删除上述临时日志。不要仅凭退出码判断结果。

### 2. [P2] README 的手动 Web 体验流程不能直接登录

位置：`README.md:47–50`、`server/api/http.py:56–62`、`tools/web_serve.py`。

README 要求分别运行 `make api` 和 `make web-serve`，两个服务使用不同端口。API 只有设置 `ABYSS_CORS_ORIGINS` 才安装跨域中间件，而手动流程没有提供该配置；静态服务默认还随机选端口。

复验使用同一真实一次性 PostgreSQL，分别启动默认 API 和配置了确切静态页面 origin 的 API：

| 路径 | 实际结果 |
|---|---|
| 默认 API 的 `/sessions` 跨域预检 | HTTP 405，无 Access-Control-Allow-Origin |
| 浏览器输入测试账号密码后激活登录 | 显示“登录失败：LOGIN_FAILED”；控制台 Failed to fetch |
| 同一页面改连显式配置 origin 的 API | 正常键盘登录、自动建角、手动启动开场遭遇、39 tick 胜利 |

这里使用真实输入操作，没有 `aw_auto`、URL 密码或脚本直接调用游戏业务方法。浏览器中的成功状态和 trace 来自实际导出包。测试入口能够通过，是因为 `tools/check.py` / 浏览器测试专门将静态 origin 传给 API；手动体验入口缺少同样的连接步骤。

**修复要求：**提供可复制的配套启动命令或统一开发启动器，确定 Web 地址并明确传入允许的 origin；保留受限跨域配置。用无预设 CORS 环境的干净终端照 README 启动，再以正常输入完成流程。建议将此入口加入回归，避免仅测专用自动入口。

证据：`cors-probe.json`、`manual-login-failed.png`、`manual-online-victory.png`、`manual-online-trace.txt`。

### 3. [P2] 异常回收覆盖不足，机器报告没有记录实际清理量

位置：`tools/pgproc.py:124–151`、`tools/check.py:87–102`、`tools/processguard.py:146–157`。

- `make check` 的数据库放在 `awr-check-*/awr-pg-*/data`；`reap_stale()` 只搜索临时目录第一层的 `awr-pg-*`。补充验证按相同嵌套形状启动一次性数据库，让所属辅助进程退出且不执行 stop，再调用原回收器：回收数为 0，数据库目录仍存在，`pg_isready` 仍成功。该测试库已由本轮显式停止和删除。不能据此继续声称下一次检查能回收所有异常遗留集群。
- `processguard.run_guarded()` 在执行文件不存在时提前 return，跳过末尾的 `rmtree`。本轮可复现留下 `awr-run-*` 目录；该目录已清理。
- `check.finish()` 先写 JSON 报告，后增加 `report['cleanup']`，没有再次保存；本轮实际生成的报告没有 cleanup 字段。数据库还在计量之前被删除，无法从该报告得到完整的清理前后字节数。

**修复要求：**将正常、失败和中断路径统一到 finally/context manager；用明确的本轮目录登记和所有者校验回收嵌套资源，避免扫描或删除无关目录；计量所有自有临时资源的删除前后逻辑字节，最后写报告。补执行文件缺失、建库后父进程退出、管线失败后的清理验证。

证据：`supplemental-probes.json`、`nested-cleanup-probe.json`、官方 `m0-check-report.json`。

## 已确认通过的部分

| 项目 | 本轮独立结果 | 范围 |
|---|---|---|
| 战斗编译 | 通过 | 已消除原 rounded() 编译错误 |
| 原初始化故障的有界退出 | 现有故障注入测试通过 | 不代表所有异常清理路径完成 |
| 依赖与运行 | API 能启动，pip check 无缺损，21 项真实执行 | 本轮使用现有 venv，没有重建一个干净 venv |
| 登录、撤销、角色归属 | 正确密码、错误密码、伪造/撤销凭据、越权访问等测试通过 | 隔离账号和本地 API |
| 并发重复命令 | 两请求确实同时阻塞后，均 201、结果相同，角色/回执各 1 条 | 两个真实登录会话，真实 TCP、PostgreSQL |
| 重启后读取和重发 | 重启 API 进程后角色 200，重复命令 201，原回执保持 | 同一一次性数据库；非灾难恢复验收 |
| 必需数据库未配置 | exit 1，明确报 ABYSS_DSN required | 必跑模式不会全跳过冒充成功 |
| 公开/私有目录和层次 | 延续分离结构，服务端不依赖 Godot 场景 | 未宣称完成 M1 持久结算 |
| Web 平台链路 | 自动检查通过；配置正确后正常输入也走通 | 当前固定种子、单一小样例、脚本战斗策略 |

补充测试还发现一个验证质量问题：现有 `test_concurrent_duplicate_commands_produce_one_change` 第 105–108 行只检查线程 alive 就释放外部锁，没有观测两笔 SQL 是否已到达，因此其注释中的“guaranteed”不成立。本轮额外观测 `pg_stat_activity` 确认两个请求都处于 Lock 等待后才释放，结果通过；建议将这项证据提升为常规回归。这里没有发现服务端重复写入缺陷。

## 修复顺序与重新签收条件

1. 先修最后一击的空目标访问与事件丢失，默认样例和终局边界样例均无脚本错误。
2. 接通文档中的手动 Web 启动入口，真实键盘登录、建角、开战可直接完成。
3. 修复异常清理与报告落盘，用失败路径证明进程、数据库和临时目录均已收尾。
4. 重跑全量检查和上述定点回归，再将 M0 标为通过；随后进入 M1 的第一条玩家循环。

不能以增加更多接口、文档或测试数量替代这些具体结果。

## 修改范围与清理

业务源码、内容源、锁文件和既有测试文件哈希未改变。Git 中原有文件的变化仅为官方检查命令重写 `docs/reviews/m0-check-report.json`；新增独立报告与必要小型证据。详见 `source-before.json`、`source-verification.json`。

已关闭本轮浏览器页、API 辅助进程、所有本轮补充数据库；没有修改旧 game、旧部署或 cloudrealm。原最终 Web 构建和项目现有缓存保留。

**有删除前后计量证据的临时文件合计：17,826,987 逻辑字节 → 0。** 其中 17,816,973 字节为检查期间已计量删除的故障复现工程副本，10,014 字节为最后删除的本轮脚本、日志和临时规格文件。其他被被测入口提前自动删除的数据库、浏览器目录和检查目录没有留下完整的删除前字节记录，因此不纳入此数字，不将其估算为已释放空间。剩余本轮自有临时根目录不存在；详细记录在 `cleanup-summary.json`。

本轮未进行 Windows/macOS 发布包验收、人工长时间试玩、数值平衡或生产部署；这些不能从 M0 的固定样例推导。
