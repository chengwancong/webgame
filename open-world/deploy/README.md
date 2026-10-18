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

1. 本机提交后 `node tools/cloud-mirror.mjs`（只推代码快照）。
2. 服务器 `git pull && docker compose up -d --build api`。
3. 只有客户端/美术变了才重新 `pnpm build` 并上传 `web-dist`。

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
