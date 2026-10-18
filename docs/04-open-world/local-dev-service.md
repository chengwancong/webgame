# 本机常驻预览服务

## Windows 本机服务（2026-09-30）

当前 Windows 工程位于 `G:\webgame\abyss-walker-migration\abyss-walker-rewrite\open-world`。访问 <http://127.0.0.1:8612/>；API 为 <http://127.0.0.1:8611/api/health>，页面也代理 `/api`。服务只监听本机，电脑需要开机且当前用户已登录；关机、注销或休眠期间无法访问。

首次运行 `pnpm setup:windows`。脚本要求已有 Node 24 和 pnpm，安装锁定依赖，并在没有配置 `AW_PG_BIN`／`AW_DATABASE_URL` 时下载 EDB PostgreSQL 18.6 的 Windows 二进制至 `.runtime/dependencies/pgsql`。来源为 [PostgreSQL 官方 Windows 下载入口](https://www.postgresql.org/download/windows/)所指向的 [EDB 二进制发布页](https://www.enterprisedb.com/download-postgresql-binaries)，下载地址和压缩包 SHA-256 保存为 `.runtime/dependencies/postgresql-source.json`。不注册系统数据库服务，数据仅保存在本工程 `.runtime/dev/data`。从源码重新准备资源时还需要 Python/Pillow 和 Chrome；`pnpm assets` 可重建当前角色图集，`pnpm build` 生成正常 Web 构建。网页服务安装跳过 Electron 可执行文件下载，桌面使用前另行 `pnpm rebuild electron`。

日常命令在 `open-world` 内执行：

```powershell
pnpm service:install    # 安装／更新托管配置并立即启动
pnpm service:status     # 查看托管进程及实际 HTTP 健康状态
pnpm service:stop       # 正常停止整组服务，关闭登录自启
pnpm service:start      # 恢复运行并开启登录自启
pnpm service:restart    # 正常停止后重新启动
pnpm service:uninstall  # 移除托管配置及自启，保留数据库和日志
```

也可双击 `启动服务.cmd`、`停止服务.cmd`、`重启服务.cmd` 或 `查看服务状态.cmd`。管理脚本使用绝对工作路径，关闭管理窗口不停止后台服务。移动工程或替换 Node 后需重新安装配置。

2026-10-02 起，Windows 任务计划 `AbyssWalker-218ca1919d2a`（名字按工程路径生成）负责启动当前用户的隐藏 WScript 守护进程，权限为 Limited；进程由系统任务服务启动，不依附 Codex／终端的进程生命周期。Startup 中同名 VBS 仅请求启动该任务，重复启动由任务计划 IgnoreNew 限制。守护进程协调 PostgreSQL、API、Vite；组件故障停止剩余组件再重启。启用标记仍在时，托管进程无论正常退出码 0 或异常退出都等待一秒后重试；`service:stop` 先关闭标记、自启与任务，再正常关闭数据库，避免反复拉起。任务设置保留异常重试、无执行时间限制和电池运行；自启登记已核对，未实际注销／重新登录。此实现使用当前用户权限，不是管理员级 Windows Service。

资源库存在时，同一守护进程还托管素材目录 8624 与完整动作预览 8625；这些地址与游戏 8612 区分。可通过安装配置中的 `AW_APK_PREVIEW=0` 关闭可选预览。可选端口被其他程序占用时不结束其他程序，也不阻止游戏启动。

数据库使用 `pg_ctl -m fast -w stop` 正常停机；API 使用进程间消息完成关闭和连接池释放。异常退出恢复只处理本工程所有权记录与进程身份一致的组件，再对本工程数据库执行正常停止／WAL 恢复；无法证明所有权则拒绝接管。端口被其他程序占用时不会结束其他程序。

配置保存在 `.runtime/service/config.json`，仅继承安装时显式指定的 `AW_PG_BIN`、`AW_DATABASE_URL`、`AW_TEST_LOGIN`。默认沿用内网账号模式（`AW_TEST_LOGIN=1`）；在本机输入账号即可创建／继续进度。后台日志在 `.runtime/service/stdout.log`、`stderr.log`；每个日志超过 8 MiB 时最多保留当前和上一份。状态／控制端口动态分配，只绑定本机，并使用随机控制令牌。

日志轮转使用独立的读写句柄截断文件，保留父进程与子进程的追加写句柄；Windows 追加句柄直接 `ftruncate` 会触发 EPERM，该错误已修复并通过继承写句柄的实测用例。

本次恢复证据见 [常驻恢复验收](../reviews/open-world/service-survival-20261002/result.json)：正常退出后约 6 秒恢复、强制终止后约 8 秒恢复，数据库集群及已有账号／角色／回执／流水保留；后台源码变更重载也通过。核对使用真实开发数据库；并发正常操作通过新增回执与流水验证，不能用全表哈希相等代替存档保留判断。

2026-10-05 数据库连接中断排查：17:37–17:45 的 API 级别 50 错误（取连接超时）、续租 3–8 秒和 409 CONTROL，与同时运行的 Playwright 浏览器验收、临时 PostgreSQL 数据库测试和首领数值网格在时间上吻合。Windows 下 PostgreSQL 每个新连接都要创建一个 `postgres.exe` 进程（空闲时 20–136 ms）；机器繁忙时创建进程超过 10 秒，并出现过一次 `CreateProcess() ... error code 5`（autovacuum 进程启动失败，数据库自行重试）。G: 为 NVMe，检查点 `sync` 仅为毫秒级；日志中 `write=` 数秒是检查点按计划限速写入，不是磁盘慢。同期 Defender 无拦截记录，系统／应用日志无错误。缓解：常驻 API 使用 `poolFor(dsn,{warm:true})`，常热 4 条连接，超出部分空闲 5 分钟才回收，并在空闲时补回断开的连接（`keepWarm`）；测试与工具仍使用原连接池参数。实测 4 分钟自动游玩共 127 个请求，全程复用启动时的 4 个后端，未新建进程。浏览器验收、临时数据库测试与数值网格仍应逐个运行，避免与真实游玩同时进行。

Windows 下 Vite 的文件监视器可能锁住资源目录。修改源文件可以直接热更新；重新发布 UI 资源或执行 `pnpm build` 时按 `service:stop` → 构建 → `service:start` 操作。手动 `pnpm dev` 前同样先停止服务，避免两个进程争用同一数据库和端口。

2026-10-01 起，Windows 托管服务同时监测 API 及共享 contracts、content、rules、simulation 的 TypeScript／JSON 源文件。连续两次观察到稳定的新内容后，整组服务正常停机并重启，防止 Vite 已加载新版本而 API 仍运行旧协议。单独生成图片、修改前端和工具不会触发此重启。更新完成前已打开的旧页面仍需刷新；版本拦截继续保留，不绕过协议检查。源码检测不修改账号、角色或成长数据。

本轮实际验证见 [Windows 服务验收记录](../reviews/open-world/windows-service-20260930/result.json)：Chrome 登录页正常渲染、50 个图集／UI／字体资源可访问；API 崩溃、托管进程崩溃均自动恢复；显式停止、启动和重启通过；正常发布构建通过。所有恢复前后数据库系统 ID 及账号／角色／回执／流水数据摘要一致。本机新库当时没有玩家账号，因此该摘要检查不代替有成长存档的长时间回归；17 项数据库用例在另一个真实临时 PostgreSQL 中通过并清理，21 项战斗核心用例通过。原工程和旧数据库未修改。

---

以下保留 macOS 的运行说明。

## 原因与运行方式

此前 `pnpm dev` 是前台开发进程：它可以保留数据库，但没有操作系统负责重启。终端或运行会话结束、API/Vite 异常退出后，8612 会失去服务。

现在使用当前用户的 macOS LaunchAgent `com.abysswalker.openworld.dev` 托管 `tools/dev.mjs`。它协调 PostgreSQL、API（8611）和 Vite（8612）；任一组件退出后先停止其余组件，再由 launchd 重启整组。配置包含 `RunAtLoad`、`KeepAlive`、十秒启动节流与进程组清理。登录自动加载与退出重启的系统机制见 [Apple launchd 文档](https://developer.apple.com/library/archive/documentation/MacOSX/Conceptual/BPSystemStartup/Chapters/CreatingLaunchdJobs.html)。十秒是启动节流参数，不是恢复时间保证。

这是当前 Mac 的开发预览服务。Mac 必须开机、保持唤醒并登录当前用户；休眠、关机或注销期间不能提供访问。只监听本机地址，其他电脑上的 127.0.0.1 不指向这台 Mac。持续对外访问需要独立部署。

## 管理命令

```sh
cd /Users/chengmocong/Documents/ChatGPT/abyss-walker-rewrite/open-world
pnpm service:install    # 安装或更新配置，并立即启动
pnpm service:status     # 查看任务状态，以及页面和代理 API 的 HTTP 状态
pnpm service:stop       # 停止，并关闭登录自启，直到再次 start
pnpm service:start      # 启动并重新开启登录自启
pnpm service:uninstall  # 卸载任务；保留数据库与日志
```

也可以直接执行 `node tools/local-service.mjs status` 等命令，不要求 pnpm 在系统后台 PATH 中。

访问地址：<http://127.0.0.1:8612/>。

项目位于“文稿”目录。macOS 可能弹出 `node` 访问文稿文件夹的授权提示，需要用户允许，否则后台进程可能阻塞在读取项目阶段。不要因此把数据库当作损坏数据清空，也不要以“launchctl 显示 running”代替 HTTP 可访问验证。

手动调试前先 `pnpm service:stop`，再运行 `pnpm dev`。不能同时启动两个所有者争用端口与同一个数据库。调试结束后停止前台进程，再 `pnpm service:start`。

## 数据与故障恢复

- 正式开发数据仍在 `open-world/.runtime/dev/data`，服务停止、重启和卸载均保留。
- 已成功入库的账号、角色、装备和进度保留。尚未确认的战斗结果仍受原有恢复边界限制，常驻服务不提供零丢失保证。
- 非正常退出遗留的 `postmaster.pid` 只在路径、运行所有者标记和死亡进程检查全部通过时移除。已有活跃数据库或无法核对归属时拒绝接管，不清空数据库。
- QA 仍使用独立临时数据库，与开发数据不混用。
- 若配置缺失依赖、端口冲突或权限被拒绝，服务会重试，但需要修复根因；持续重启不等于健康运行。

## 配置与日志

- 配置：`~/Library/LaunchAgents/com.abysswalker.openworld.dev.plist`。
- 标准输出：`open-world/.runtime/service/stdout.log`。
- 标准错误：`open-world/.runtime/service/stderr.log`。
- Node 固定使用安装时的绝对路径，工作目录固定为本工程。移动工程或替换 Node 后需要重新安装配置。
- 当前脚本使用默认 PostgreSQL 路径，不自动复制终端环境中的数据库凭证到 plist；外部数据库或非默认二进制需要单独配置。
- 日志追加保存，当前没有自动轮转；长期运行需查看磁盘占用，轮转前停止服务，保留必要故障记录。

本配置不涉及生产发布、不修改旧工程数据库，也不处理 `cloudrealm/`。
