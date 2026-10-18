# 测试服部署方案（阶段 1）

## 组成

| 部分 | 去向 | 说明 |
|---|---|---|
| 代码 + 配置（文本） | 云端私有 GitHub 仓库 | `node tools/cloud-mirror.mjs` 推快照，自动排除图片/音视频/Spine 二进制/压缩包/转储（约 206MB，排除约 1.96GB） |
| API | Docker 镜像（`deploy/Dockerfile`） | Node 24 + tsx 直接跑 `apps/api/src/main.ts`，启动时自动迁移数据库 |
| 数据库 | `postgres:18` 容器 | 数据卷 `pgdata` |
| Web 客户端构建产物 | 本机构建后上传到服务器 `deploy/web-dist/` | 含美术，**不进 Git、不进镜像**；挂载为只读 |
| HTTPS + 访问口令 | `caddy:2` 容器 | 自动签证书；除 `/api/health` 外整站 basic auth |

## 服务器

- 规格：2 vCPU / 4GB 内存 / 40GB 硬盘起步（单测试服 + PG）。
- 地域：先用**香港 / 东京 / 新加坡**。大陆机房的域名走 80/443 需要 ICP 备案，测试期不划算。
- 系统：Debian 12 / Ubuntu 24.04，装 Docker Engine + compose 插件。
- 域名：一个子域名（例 `staging.你的域名`）A 记录指向服务器。

## 首次部署

```bash
# 服务器上
git clone git@github.com:<你>/<私有仓库>.git abyss && cd abyss/open-world/deploy
cp env.example .env   # 填 AW_DOMAIN / PG_PASSWORD / AW_GATE_HASH
```

```powershell
# 本机：构建并上传 Web 产物（需要本地素材）
pnpm build
tar -czf web-dist.tgz -C apps/web/dist .
scp web-dist.tgz <服务器>:abyss/open-world/deploy/
```

```bash
# 服务器上
mkdir -p web-dist && tar -xzf web-dist.tgz -C web-dist
docker compose up -d --build
curl https://staging.你的域名/api/health
```

## 日常更新

当前测试服从本机通过 SSH 发版，不在服务器 git pull：

1. 将本批代码按限定路径提交，然后在 open-world 执行 `node tools/deploy-staging.mjs --dry-run`。
2. 执行 `node tools/deploy-staging.mjs`：HEAD 归档、重建 API、隔离 Vite 构建、按素材哈希上传、校验 health、推文本镜像。
3. 仅 API 更新可用 `--skip-web`；完整参数和备份说明见下方「当前测试服」。

## 两种模式

- **staging（默认）**：`NODE_ENV=development`、`AW_TEST_LOGIN=1`，开测试号登录、QA 区域和开发检查点，方便跑测机器人；只靠 Caddy 口令挡外人。
- **prod**：`.env` 里设 `AW_MODE_NODE_ENV=production`、`AW_TEST_LOGIN=0`，密码账号、cookie 仅 HTTPS；`main.ts` 会拒绝在 production 下开 QA 开关。

## 云端跑测（阶段 2 预留）

镜像仓库不含素材，所以云端适合跑**不依赖图片**的检查：类型检查、内容校验（`pnpm content`）、数值推导/校验（`pacing:*`、`spine:check`）、
带 PG 的服务端与模拟测试、`probe-quest.mjs` 这类对着 API 的自动驾驶。下面这些测试读取 PNG，云端要跳过或等素材进对象存储后再跑：
`mini-native-renderer`、`native-kit`、`native-skin-composition`、`story-npc-art`、`telegraph-polish`、`wardrobe-icon-content`。

## 当前测试服（2026-10-18 首次上线）

- 腾讯云轻量 · 东京，Ubuntu 24.04，2核/3.6GB；本机 SSH 别名 `abyss-staging`（用户 `ubuntu`，密钥 `~/.ssh/id_ed25519_abyss`）。
- 地址 `https://43-165-179-11.sslip.io/`（sslip.io 免费域名，Let's Encrypt 证书）；访问口令只存本机仓库外 `G:\webgame\aw-deploy\staging-credentials.txt`。
- 实际流程（不经 GitHub，免部署密钥；不跑素材生成步骤，避免改动工作区）：
  1. `git archive HEAD` 打包 package 清单、`apps/api`、`packages`、`config`、`deploy` → scp 到 `~/abyss` 解包；
  2. `node node_modules/vite/bin/vite.js build --config apps/web/vite.config.ts --outDir G:/webgame/aw-deploy/web-dist --emptyOutDir`；
  3. `tar -cf - -C G:/webgame/aw-deploy/web-dist . | ssh abyss-staging 'tar -xf - -C ~/abyss/open-world/deploy/web-dist.new'`，换名后 `docker compose up -d --force-recreate api`（目录换了 inode，必须重建 api 容器才能看到新文件）。
- 首次上线占用：api ~500MB、caddy ~56MB、PG ~40MB；镜像 823MB（含 devDependencies）。

### 一键发版

在 open-world 下运行 `node tools/deploy-staging.mjs`。脚本固定 HEAD 服务端和前端源码，前端在仓库外隔离构建；本地 public 素材随构建部署。工作区脏时只警告，不打包未提交源码。Windows 使用 Git 自带 SSH/SCP，别名 abyss-staging。

- `--dry-run`：只显示步骤，不构建、不上传、不推送。
- `--skip-web` / `--skip-api`：跳过对应部分；仍严格检查实际 client 版本。
- `--full-web`：强制整包，否则比较仓库外 web-dist-manifest.json 的非 JS/CSS/HTML 文件 SHA256 清单；首次整包。
- `--no-mirror`：不推代码镜像。

产物在 `G:/webgame/aw-deploy/`，不进 Git。整包换目录后强制重建 API。health 轮询超时或版本不符退出非零并显示预期/实际值；部署期间 HEAD 变化时拒绝推镜像。并发保护使用同目录 deploy-staging.lock；异常终止后先确认没有部署进程，再清理遗留锁。

当前机器使用 SSH 归档部署，不采用上文通用的 git pull 流程。不要在本机运行 pnpm build 的素材生成链。

### 数据库备份

部署 backup.sh 后，在服务器执行一次 `bash ~/abyss/open-world/deploy/install-backup-cron.sh`，重复安装不会新增重复条目。Ubuntu cron 使用服务器本地时区；安装器用每小时 UTC 时刻守卫确保每日 **04:00 UTC（北京时间 12:00）** 备份，不依赖不被 Ubuntu cron 支持的 CRON_TZ。

手动运行 `bash ~/abyss/open-world/deploy/backup.sh`。脚本使用 flock、pipefail、临时文件和 gzip 校验，成功后原子改名，保留最近 7 天；文件权限由 umask 077 保护。原文件不因失败被替换。

本机拉取最新备份：`node tools/deploy-staging.mjs --skip-api --skip-web --no-mirror --pull-backup`，存到 `G:/webgame/aw-deploy/backups/`，不进 Git。

### 云端 CI（S5）

仓库根 `.github/workflows/ci.yml` 随文本镜像推送，在 main push 或手动触发时运行。Node 24、锁定 pnpm、PostgreSQL 18 service；不需要测试服口令或数据库 secret。数据库只属于该 Actions 作业。

检查顺序：`pnpm install --frozen-lockfile` → `pnpm exec tsc --noEmit` → `pnpm exec tsx tools/validate-content.ts --metadata-only` → `node tools/ci-tests.mjs`。工作簿测试另装 openpyxl 3.1.5。metadata-only 保留素材登记、哈希一致性与引用校验，默认不带参数的本机校验仍读取并验证真实素材字节。

唯一排除名单是 `tools/ci-test-excludes.json`：原六项，加 lightning-arrow-vfx、vfx-art、vfx-hit-style、vfx-presence（PNG / 图集）和 audio-coverage（WAV）。不排除数据库、规则或长流程回归。测试串行，长日程允许 30 分钟；日志会显示仓库外证据目录。

本机也运行同一 `ci-tests.mjs`，须由 `tools/runtime.mjs` 的 `startDatabase({temporary:true})` 提供 AW_DATABASE_URL 并在 finally 调用 stop；建议在仓库外 HEAD 文本快照验收，避免旧测试留档影响共享工作区。Windows 工作簿测试使用 AW_PYTHON（runner 默认解析 python.exe），不依赖 WindowsApps 的 python3 商店别名。

### 当前运行层

API 多阶段镜像只保留生产依赖和独立的 tsx 4.21.0；不包含 TypeScript、Vitest、Playwright 或 Electron。实测 docker images 磁盘占用 567MB（原 824MB），压缩内容约 113MB；Node 直接加载 tsx loader 运行源码。
