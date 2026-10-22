# abyss-walker-rewrite

## 许可证

本仓库自行开发的源代码采用 **GNU General Public License v3.0 或更新版本（GPL-3.0-or-later）**。你可以依据 GNU GPL 第 3 版，或自行选择其任何后续版本，使用、修改和再分发这些代码。软件不提供任何担保，完整条款见 [LICENSE](LICENSE)。

第三方代码、依赖、字体、美术、音频及其他素材保留其原有许可，不因本声明改用 GPL。授权范围与第三方说明见 [NOTICE.md](NOTICE.md)。

当前前端统一遵循 [项目 UI 标准](项目.md)：字体、字号、色板、控件及用户确认的竖版装备 Tips 布局。UI 实施前先读此标准。

## 当前大世界入口（2026-09-28）

新版 TypeScript / Phaser / Fastify / PostgreSQL 位于 [`open-world/`](open-world/README.md)。双击 `open-world/启动深渊行者.command`，或在该目录运行 `pnpm dev` 后打开 `http://127.0.0.1:8612/`。它使用独立数据存储，不接入下面的 Godot/Python 原型。

开发依据见 [大世界设计文档](docs/00-project/open-world-development-outline.md)，实际完成与限制见 [实施状态](docs/04-open-world/implementation-status.md)。

## 新世界观与资源制作（2026-10-03）

「星潮海／裂星远航」的世界观、六章36任务、13地图白盒、美术需求、六代理任务书及验收台账见 [星海制作文档](open-world/docs/starsea/README.md)。主代理负责文档与独立验收，六个子agent负责制作和返修。新设定与资源包先独立准备，当前正式主线与玩家存档继续保留；文档与资源完成不代表新剧情已经接入。

---

下面保留此前 Godot/Python 原型的记录与命令；其验收不代表大世界版本的验收。

新版《深渊行者》独立仓库。当前阶段 M0：边界与验证基础。

**M0 尚未最终签收。** 第三次独立复验（`docs/reviews/20260928-third-independent-acceptance.md`）确认此前修复已通过，但完整检查在真实 API 测试期间被 SIGTERM 中断仍可能遗留 API 进程。本轮补上可见游戏路径，标准 `make check` 的 44 项检查通过；这不代表中断缺陷已修复。界面与试玩记录见 `docs/reviews/20260928-game-interface.md`。

## 锁定版本

| 项 | 版本 |
|---|---|
| Godot | 4.7.stable.official（`/Applications/Godot-4.7.app/Contents/MacOS/Godot`，可用 `ABYSS_GODOT` 覆盖） |
| Python | 3.12.x（`tools/setup` 会拒绝其他版本；仓库内 `.venv`） |
| FastAPI / Pydantic / psycopg / psycopg-pool | 见 `server/requirements.lock.txt` |
| PostgreSQL | 18.6（`~/.local/share/abyss-walker-server/pgsql/18.6/bin`，可用 `ABYSS_PG_BIN` 覆盖） |
| 协议 / 规则 / 结构版本 | 见 `contracts/version.json`（四类版本分开推进） |

## 常用命令（干净终端按顺序可用）

```bash
make setup    # 建 .venv 并安装锁文件依赖（需要 Python 3.12，可用 ABYSS_PYTHON 指定）
make content  # 校验内容源并生成 public/、private/ 与客户端离线夹具
```

### 开发用数据库与 API

```bash
make db       # 启动一次性 PostgreSQL（随机端口，仅 127.0.0.1；Ctrl-C 即停止并删除集群）
# 复制它打印的 ABYSS_DSN=...，然后：
export ABYSS_DSN='dbname=postgres user=aw_dev host=127.0.0.1 port=64596'   # 换成你的端口
make migrate  # 应用 server/migrations
make api      # 启动 API，默认 http://127.0.0.1:8601
```

`make db` 以模块方式运行（`python -m tools.pgproc`），因此在**没有任何 PYTHONPATH 的干净终端**里也能启动。
它的集群是一次性的：正常退出、Ctrl-C、SIGTERM 都会先停止 PostgreSQL、再删除集群目录，并重新测量确认删除；
如果停止无法确认，目录会保留、打印失败原因并以非零退出码结束，不会把残留报成已释放。

进程被硬杀也不会永久泄漏：下一次 `make db` / `make check` 会按所有权记录（`owner.json`：工具名 +
属主进程已退出 + 非符号链接）回收遗留集群，**先停库、核验后再删目录**。

### 验收与测试

```bash
make core-test   # headless 战斗核心契约（确定性、终局、有界退出）
make server-test # 服务端测试（需要 ABYSS_DSN；未设置会明确失败或跳过）
make check       # 完整 M0 管线（约 50 秒，见下）
make ci          # 同 check
```

`make check` 自动完成：回收上轮遗留的运行目录（先停内部数据库、核验后再删）→ 内容构建 → 客户端全量编译检查
（不信任退出码，必须出现成功标记）→ 真实 Web 导出 → 启动一次性 PostgreSQL → 迁移 → 全部测试
（当前共 44 项用例，数据库用例必须真实运行，跳过即失败，含真实浏览器流程与资源生命周期用例）→
真实浏览器（Chrome）完成登录/建角/取 BattleSpec/打完整场战斗 → 停 API → 停库并核验 → 删除本轮临时目录 →
重新测量剩余量 → **最后**写入报告。报告在 `docs/reviews/m0-check-report.json`（含 `cleanup` 字段）。

清理语义：任何清理错误（API 未停、数据库停止未核验、目录没删干净、遗留目录没回收完）都会把
`report.ok` 置为 false 并让退出码非零；资源未确认停止时该目录会被保留并附所有权记录，绝不计入已释放空间。

### 手动体验 Web 构建

```bash
make web    # 导出到 web-build/（gitignored；已存在可跳过）
make dev    # 一条命令完成手动体验的全部依赖（Ctrl-C 一次性停止并删除）
```

`make dev` 会打印全部地址，无需在终端之间复制任何东西：

- 游戏页面：`http://127.0.0.1:8602/`（固定端口，`ABYSS_WEB_PORT` 可覆盖）
- API：`http://127.0.0.1:8601`（`ABYSS_API_PORT` 可覆盖；CORS 只允许上面的游戏页面 origin）
- 一次性 PostgreSQL 的 DSN 与数据目录

浏览器打开游戏页面，输入账号（≥3 位字母数字）与密码（≥12 位），点「登录」或「注册并登录」，
进入角色准备界面后，点「出发战斗」进入开场遭遇。网络失败时界面会显示可读原因（例如
"无法连接服务器，请检查网络后重试。"），而不是空白失败。

Ctrl-C 之后它会打印实际删除的数据库目录与字节数，并重新测量确认目录已消失；只要清理没有完全成功，
退出码就是非零。这条真实输入路径（键盘输入账号密码 + 鼠标点击按钮，不使用 `aw_auto`、不在 URL 里带凭据）
的证据：`docs/reviews/evidence/manual-web-flow-typed.png`、`manual-web-flow-login.png`、
`manual-web-flow-victory.png`、`manual-web-flow.json`。

## 目录

```text
client/    app（流程）· combat（纯数据核心）· presentation（表现）· net（HTTP 客户端）
server/    api（HTTP+会话鉴权）· application（用例与事务）· domain · infrastructure · migrations
content/   唯一手工内容源与 schema；build/ 生成物（gitignored）
contracts/ 协议与版本
tools/     内容构建、一次性数据库、检查管线、浏览器验收
tests/     server（身份/幂等/事务）· core（编译/失败模式/终局/可见-headless 一致）· tools（清理与真实入口生命周期）· web（真实浏览器）
web-build/ Web 导出产物（gitignored，可用 make web 重新生成）
deploy/    环境定义与发布（M2 填充）
docs/      reviews/（检查与验收记录）
```

## 当前边界（M0）

- 客户端战斗使用服务端返回的 BattleSpec（ruleset、遭遇、技能参数、种子）；`client/data/fixture_combat.json` 仅是 headless/离线测试夹具，不出现在玩家入口。
- 账号身份来自密码登录与可撤销会话（Bearer token）；角色创建、读取、开场数据全部校验归属，不接受请求体里的 account_id。
- 命令幂等：同一 command_id 重发返回原回执，不同参数返回 409；回执与业务写入同一事务，事务内锁定账号保证并发安全（并发回归会等两笔请求都出现在 `pg_stat_activity` 的锁等待里再放行）。
- 资源生命周期：本轮创建的目录都带 `owner.json`；回收只处理"确属该工具 + 属主进程已退出 + 不是符号链接"的目录，删除前先停止并核验内部数据库，停止失败则保留目录并让检查失败。
- 可见游戏入口：城镇登录 → 角色与遭遇准备 → 场景战斗 → 胜负结果 → 返回或重新挑战。
  角色与敌人动作、生命、技能冷却和伤害反馈消费真实核心状态；默认自动策略与 headless 对照保持一致。
  空格暂停，1 / 2 手动释放技能，可切换自动技能及演出速度。Web 中文字体随包提供（Noto Sans SC，OFL）。
- 当前只开放一场开场遭遇，奖励/装备/成长仍属于 M1。界面记录见 `docs/03-presentation/playable-interface.md`。
- 当前表现使用用户提供的小小忍者资源，已替换误选的旧生成角色与敌人。最新实机证据见 `docs/reviews/20260928-user-art-correction.md`。
