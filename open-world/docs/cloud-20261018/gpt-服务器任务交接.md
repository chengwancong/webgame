# GPT 任务交接：测试服运维批次 S1–S6（2026-10-18）

先读 `docs/cloud-20261018/服务器交接.md`（现状、发版命令、约束），再读 `deploy/README.md`。本文只写要做的事和规则。
工作目录 `G:\webgame\abyss-walker-migration\abyss-walker-rewrite`（下文路径相对 `open-world/`，除非写明仓库根）。

## 执行方式（强制）

1. **一次性做完 S1–S6**。做完一批立刻进下一批，不要停下来汇报，也不要问“是否继续”。
2. 只允许两种结束状态：
   - **全部完成**：完成定义里的每一项都勾上；
   - **硬阻塞**：其余能做的都做完了，只剩下面“硬阻塞清单”里的事。
3. 遇到模糊点按“默认裁决”表处理，把裁决写进进度文件的决策日志，然后继续。
4. 每完成一批就更新进度文件 `docs/cloud-20261018/进度-服务器运维.md`：批次状态、提交号、验证结果、决策日志。中断后从这里接着做。
5. 每批单独提交：`git commit --only -- <本批路径>`，提交信息用英文。

## 硬阻塞清单（只有这些可以停下来问用户）

- 要花钱（买域名、升配、付费服务）或要登录云控制台（改防火墙、安全组、快照）。
- 要输入或生成用户的口令、私钥、token（Caddy 口令只在本机 `G:\webgame\aw-deploy\staging-credentials.txt`，**只能读，不能改，不能打印到输出或提交**）。
- 会丢测试服数据库数据，而且没法先备份。
- GitHub Actions 需要用户在网页上授权或填 secret。

## 默认裁决

| 模糊点 | 裁决 |
|---|---|
| 脚本用什么语言 | Node ESM（`.mjs`），和 `tools/cloud-mirror.mjs` 风格一致，零新依赖 |
| 美术是否变化的判断 | 对 `web-dist` 里**非** `.js/.css/.html` 文件生成「路径→大小+mtime 之外的内容哈希」清单，存本机 `G:\webgame\aw-deploy\web-dist-manifest.json`；与上次不同才整包传 |
| 发版时工作区有未提交改动 | 照样只打包 HEAD；脚本打印一行警告，不中止 |
| health 版本和预期不一致 | 脚本失败退出，非 0，打印两边版本 |
| 备份放哪、留几份 | 服务器 `~/abyss/backups/`，`pg_dump | gzip`，保留 7 天；cron 每天 04:00 UTC |
| trustProxy 信任范围 | 只信任 compose 内网（`172.16.0.0/12` 和回环），不要 `true` |
| 有没有用到 IP 的反作弊/限流 | 先 grep `req.ip`/`remoteAddress`。改 IP 来源后若会影响判定，**宁可漏判不误判**：阈值不变，有疑问就跳过该判定 |
| Dockerfile 瘦身时 tsx 怎么办 | 运行时保留 tsx（直接跑源码），只去掉其余 devDependencies；做不到就保留现状并记录原因 |
| CI 里读 PNG 的测试 | 用 `deploy/README.md` 列出的 6 个文件做排除名单；另有因缺素材失败的，加进名单并在决策日志写明 |
| CI 放哪 | 仓库根 `.github/workflows/ci.yml`（镜像快照包含仓库根）；PG 用 `postgres:18` service |
| gh CLI 没登录 | 推镜像后用不了 `gh run` 就跳过远端确认，把“去 Actions 页看结果”记进硬阻塞，其余照做 |

## 禁止

- 素材（图片/音视频/Spine 二进制/压缩包）进 Git；`.env`、口令、私钥进 Git 或输出。
- 碰别的会话没提交的改动；`git add -A`；`git push` 到除 `tools/cloud-mirror.mjs` 以外的地方。
- `docker compose down -v`、删 `pgdata`/`caddy_data` 卷、在服务器上 `rm -rf ~/abyss`。
- 本机并行跑重任务（构建、vitest、带 PG 的测试一次只跑一个）；跑 headless 浏览器探针。
- 只写文档不落代码；用占位脚本或 `TODO` 充数；跳过验证。

## 批次

### S1 一键发版脚本 `tools/deploy-staging.mjs`
把 `服务器交接.md` 第 2 节①–⑤串起来：打包 HEAD → scp → 解包 + 写 `SOURCE_COMMIT` → `docker compose up -d --build api` → vite 构建到 `G:/webgame/aw-deploy/web-dist` → 只传代码或整包（按清单判断，整包后 `--force-recreate api`）→ 轮询 health 直到 `versions.client` 等于本地 `apps/web/package.json`（或现有版本常量）→ 推镜像。
参数：`--skip-web`、`--skip-api`、`--full-web`、`--no-mirror`、`--dry-run`（只打印步骤）。
验证：先 `--dry-run`，再真跑一次，health 正常；把用法补进 `deploy/README.md`「当前测试服」。

### S2 数据库定时备份
`deploy/backup.sh`（在服务器上跑：容器内 `pg_dump`，gzip，删 7 天前的）+ 安装 cron 的说明或幂等安装命令；S1 脚本加 `--pull-backup` 把最新一份拉到 `G:\webgame\aw-deploy\backups\`。
验证：手动跑一次 `backup.sh`，文件存在且 `gunzip -t` 通过；`crontab -l` 有条目；拉回本机成功。

### S3 真实客户端 IP
`apps/api/src/app.ts` 的 `Fastify({...})` 加 `trustProxy`（按裁决表）；确认日志里 `remoteAddress` 或新增字段是真实 IP。检查所有用到 IP 的逻辑（反作弊、限流、登录记录），按裁决表处理。
验证：tsc；`tests/database.test.ts` 通过（用 `tools/runtime.mjs` 的 `startDatabase({temporary:true})` 提供 `AW_DATABASE_URL`）；部署后从本机请求一次，服务器日志显示的不是 172.18.x.x。

### S4 镜像瘦身
`deploy/Dockerfile` 改多阶段，运行层只含生产依赖 + tsx。
验证：服务器上 `docker images` 体积比 823MB 小；api 健康；能登录建角色（用 curl 走 API：带 basic auth 读本机凭据文件，不打印）。

### S5 云端 CI
仓库根 `.github/workflows/ci.yml`：pnpm 安装、`tsc --noEmit`、`tsx tools/validate-content.ts`、带 PG service 的 `vitest run`（排除名单）。push 到镜像后确认运行结果。
验证：本机先按同样的排除名单跑一遍确认能过；镜像推送成功；`gh run list` 绿色（或按裁决记为硬阻塞）。

### S6 Grok 跑测指南
`docs/cloud-20261018/grok-跑测指南.md`：给 Grok 的一段可直接粘贴的提示词 + 规则：一直用同一个浏览器会话（保住 cookie）、用自己的用户名（`qa_grok1` 起）、先完成开场武器三选一建角色、只开一个标签页、标签页挂后台超过 2 分钟后回来如果弹“恢复连接”就点恢复、发现问题按「步骤/期望/实际/截图时间/角色名」格式记录。口令写“向用户索取”，不写真值。
可选：如果 `tools/probe-quest.mjs` 能对着远端地址跑（加 basic auth），补一个 `--base` 参数和说明；改不动就记录原因。

## 完成定义

- [ ] S1 `tools/deploy-staging.mjs` 真跑通过一次，README 已更新
- [ ] S2 服务器有备份文件和 cron 条目，本机拉回成功
- [ ] S3 trustProxy 已上线，日志显示真实 IP，DB 测试通过
- [ ] S4 新镜像更小且测试服健康，API 能建角色
- [ ] S5 CI 文件已提交并推镜像，运行结果已确认（或记为硬阻塞）
- [ ] S6 Grok 跑测指南已提交
- [ ] `服务器交接.md` 的「待办」和「已知问题」已按实际结果更新
- [ ] 进度文件写全：每批提交号、验证输出摘要、决策日志
- [ ] 最后一次 `node tools/cloud-mirror.mjs` 已推送，测试服 `SOURCE_COMMIT` 等于最终 HEAD 或包含全部服务端改动
