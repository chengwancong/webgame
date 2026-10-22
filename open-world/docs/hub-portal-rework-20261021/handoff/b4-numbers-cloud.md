# 交接：B4 数值推导（改在云测试服跑）

> 2026-10-22 Claude（总策划）写给 Codex/GPT。本文接替 `backend-B0-B4.md` §4「B4 数值」一节的**执行方式**；推导口径不变，仍以 `modules/M14-economy-numbers.md` §3.3–§3.7 为准。**设计已定，照做**；写了默认裁决的地方直接按默认做，并记进决策日志，不回来问。
> 为什么改到云上：本机常驻 MU（有反外挂），不能跑自动驾驶和重任务；测试服是独立机器，切换点 S 已完成（db 19，9 个冻结开关已开）。

## 0. 执行方式（强制）

1. **一次连续做完 C0 → C1 → C2 → C3 → C4 → C5**，批次之间不停、不等确认、不回来问。允许的结束状态只有两种：
   - **全部完成**：§7 完成定义全部勾上；
   - **硬阻塞**：已经做完所有不受阻塞影响的部分，只剩 §6 列出的硬阻塞项。
2. 进度文件：同目录 `b4-progress.md`（你创建并持续更新）。每完成一项勾一项，写提交号或证据路径和一句验证结论。中断后从第一个未勾项接着做，不重做已勾项。
3. 决策日志：沿用同目录 `backend-decisions.md`，每条一行：问题｜处理｜依据条目。
4. 协作中心：`游戏协作.md` 当前 45,867 字符，**先按「精简与归档规则」归档到 40,000 字符以下**，再把任务队列 HUB-B4 一行改成「云上执行中」，每批完成更新一次，只用 `更新游戏协作.ps1`。
5. **本机只做轻活**：tsc、内容校验、`config:export/check`、定向单测、临时库测试，一次只跑一个。本机**不跑**自动驾驶、战斗测量、浏览器自动化、无头浏览器。重的都在云上跑。
6. 原始数据不入库：测量明细、自动驾驶日志、截图、备份只留云上 `~/abyss-b4/` 和本机 `.runtime/b4/`。提交前看 `git diff --cached --shortstat`，单文件 > 200KB 或总量 > 2000 行就停下来查。

**禁止**：手填或估填任何奖励数字；扫参、多候选并行比较、「诊断的诊断」；改 TTK / TTD 档位目标或经验曲线；改 2026-10-22 定下的开放规则（见 §1）；碰常驻库容器 `abyss-staging-db-1` 和线上 API 容器；在 `~/abyss/open-world`（线上发布目录）里跑任何东西；在客户端（`apps/web`）改代码；用控制台或接口改测试服上的角色、钱包、等级、任务、奖励；清测试服数据库；把测试服口令写进任何文件、日志、提交或报告。

## 1. 现状（以此为准）

- 线上：client 0.11.50 / protocol 53 / rules ow-91 / db 19，提交 `9d300ca6`。Grok 正在测试服上跑 30 小时测试（`docs/hub-portal-rework-20261021/grok-30小时全内容测试.md`），奖励数字在 Grok 那边记作占位值。
- 工具已备好，但都还没跑过：`tools/hub-reward-derive.mjs`（统一入口，分 `--measure-combat` / `--derive` / `--verify` / `--apply` / `--correction` / `--requirements`）、`tools/hub-autopilot.ts`（真实 API + WS 验收，每条路线用一次性 schema）、`tools/hub-reward-apply.mjs`（只写工作簿）、`tools/spine/hub-*.ts`、服务端加载器 `apps/api/src/hub-numbers.ts`。产物 `packages/content/hub-outside-numbers.json` 还不存在，所以 `tests/hub-port-economy.database.test.ts` 目前 3 项都是 skip。
- **2026-10-22 新定的开放规则（任务引导降级，用户决定，不得改回）**：
  - 关口 = 本航区再通关 3 个非关口节点（`HUB_GATE_CLEARS=3`）；**不再有关口任务**，`gateQuest` 不再下发。
  - 剧情节点没有「找 NPC 按 E」的步骤，开场直接打。
  - 工坊在第一次打完节点回港时开放，码头在风栖关口首通后开放。
  - 规则见 `packages/rules/hub-chart.ts`、`hub-port.ts`，变更记录见 `README.md` 最后一行。

## 2. 云上环境（C0 搭建，只用隔离容器）

| 项 | 做法 |
|---|---|
| 机器 | SSH 别名 `abyss-staging`（2 核 / 3.7GB / 剩余约 38GB 磁盘）。宿主机没有 node，一律用容器 |
| 代码 | 本机 `git archive <提交> open-world` 打包后经 ssh 解到 `~/abyss-b4/<短提交号>/`。只带文本，不带素材（素材本来就不在 Git 里）。不要在服务器上配 GitHub 凭据 |
| 数据库 | 单独起 `docker run -d --name b4-pg --network b4net --cpus=0.5 --memory=512m -e POSTGRES_PASSWORD=<随机> postgres:18`，只给 B4 用；跑完 `docker rm -f b4-pg`。**绝不连 `abyss-staging-db-1`** |
| 运行 | `docker run --rm --network b4net --cpus=1 --memory=1500m -v ~/abyss-b4/<sha>:/w -w /w/open-world node:22 …`；容器里 `corepack enable && pnpm install --frozen-lockfile`，然后 `AW_DATABASE_URL=postgres://…@b4-pg/postgres` 跑工具 |
| 资源护栏 | 同时只跑一个 B4 容器，限 1 核。每个长任务开始前和每 30 分钟用 `curl -s -o /dev/null -w '%{time_total}' https://43-165-179-11.sslip.io/api/health` 查一次线上；超过 2 秒，或 `docker compose ps` 里 api 不是 healthy，就立即停掉 B4 容器，等 10 分钟恢复后再继续（记一行决策日志） |
| 证据 | 云上 `~/abyss-b4/<sha>/open-world/.runtime/`，用 `scp` 拉回本机 `.runtime/b4/<sha>/`。证据里要有提交号、命令、种子 |

## 3. 批次清单

### C0 环境与工具对齐
- [ ] 归档协作文档并改 HUB-B4 状态（§0.4）。
- [ ] **修过期守卫**：`tools/spine/hub-rewards.ts` 的 `switchGuard()` 写死了 `protocol 50`，现在是 53，会直接拒跑。改成只校验「S 已完成」的事实：`db===19`，九个冻结开关全为 true，rules 前缀为 `ow-`。不要再写死 protocol 或 client。`tools/hub-switch.mjs` 只管 S，不用改。
- [ ] 让工具认得新开放规则：自动驾驶和推导里凡是假设「关口任务 / gateQuest / 关口任务材料包」的地方，改成「本航区 3 个节点」。关口任务材料包**不再推导**，原预算按 §5 D-B1 处理。
- [ ] 本机 tsc、工具 tsc、`pnpm config:check`、`node tools/vitest-tempdb.mjs tests/hub-*.database.test.ts`（逐个跑）通过后提交，记提交号。
- [ ] 按 §2 搭好云上环境，容器里 `npx tsc --noEmit -p .` 通过，证明环境和本机一致。

### C1 实测（云上）
- [ ] `--measure-combat`：风栖、雾铃 6 类副本带增益的实际 TTK / TTD（M14 N1），固定种子、小样本，一次。
- [ ] `hub-autopilot.ts all`：剑 / 法杖 / 暗器三条路线，新角色从开场打到雾铃关口首通。记录 20 节点每个的实际用时、等级、首通、每日首通计数、回港队列。断言 `skipped-by-freeze`=0、首通各发一次、回港队列每次 ≤1 条 unlock。
- [ ] 自动驾驶失败：先判断是工具问题还是游戏 BUG。工具问题修工具重跑**该路线**；游戏 BUG 记进 `b4-progress.md`「发现的问题」（写复现命令和种子），用 D-B4 绕过后继续，不停。

### C2 一次推导（本机，轻）
- [ ] 把 C1 证据拉回本机，`--derive` 一次：20 节点的金币 / 经验 / 材料 / 残页 / 声望、派遣速率表、委托数值，以及 M14 N2、N3、N5、N6、N7、N8、N10。
- [ ] 卡片「预计时长」按 C1 三路线实测用时的中位数写回（取整到分钟，下限 = 中位数 × 0.8，上限 = 中位数 × 1.25），同一份计划里一起写。
- [ ] `--apply` 写工作簿 → `pnpm config:export` → `pnpm config:check`，串行跑。生成 `hub-outside-numbers.json`。

### C3 一次验证（云上）
- [ ] 用应用后的提交重打包，`--verify` + 三路线自动驾驶各再跑一次。
- [ ] 断言写进测试（M14 §3.5）：每类副本「节点奖励 ÷ 预计分钟」≤ 同航区基准；日常额外 ≤ 40%；7 日模拟残页盈余 5–15%；N4 找回时点漂移 ≤ 10%；带增益 TTK / TTD 在档位目标 ±20% 内。
- [ ] 不过：按 M14 §3.5 的默认裁决 `--correction` 调**一次**，再测**一次**，然后如实报告残差。不再迭代。

### C4 本机回归与提交
- [ ] tsc、内容校验、`config:check`、hub 单测、`tests/hub-port-economy.database.test.ts`（现在必须真跑，不能 skip）、其余 hub 临时库测试，串行。
- [ ] 版本：rules → `ow-92`，client → `0.11.51`；protocol 只有改了契约字段才升（预计不改，仍 53）。同步更新 `grok-30小时全内容测试.md` 的版本行，并把其中「奖励数字仍是占位值」那句改成「奖励数值为 B4 推导 v1」。
- [ ] 报告 `docs/reviews/hub-b4-numbers-20261022/结果.md`：只放结论表（20 节点数值、N1–N10 每项「目标｜实测｜残差｜过 / 不过」）、复现用的提交号 + 命令 + 种子、发现的问题。原始明细不提交。
- [ ] 提交（结尾加你们的署名行），提交前跑 `--shortstat` 检查。

### C5 部署与收尾
- [ ] 本机 Git Bash：`export PATH="/c/Windows/System32:$PATH"; node tools/deploy-staging.mjs`（只打包已提交的 HEAD，会顺带推镜像）。部署完 `curl https://43-165-179-11.sslip.io/api/health` 核对 0.11.51 / ow-92。
- [ ] 云上清理：`docker rm -f b4-pg`、删掉 B4 网络和镜像缓存之外的临时目录，只保留 `~/abyss-b4/<最终sha>/open-world/.runtime/`。
- [ ] 协作中心：HUB-B4 改「待验收」，「双方留言」写一行：`HUB-B4 数值已上线 0.11.51/ow-92，报告 docs/reviews/hub-b4-numbers-20261022/结果.md`。
- [ ] `b4-progress.md` 末尾写给 Grok 的一段复测说明：版本号、奖励已不是占位、要重点体感的 3 个节点。

## 4. 推导边界（不得越过）

- 只调 M14 允许的旋钮：各来源占比、f / g 系数、内部 `combatScale / dropCountScale / shardChance / commissionGoldScale / commissionXpShare`。不改 TTK 档位目标、经验曲线、怪物曲线、装备翻倍规则、首通 ×2 规则。
- 发奖链路（首通一次、每日首通只在成功时消耗、整场预算冻结、回港结算）只读，不改。
- N3（海克斯每小时次数）没有同口径基线就按已有裁决「不改概率、标未测」，不用混合统计冒充。

## 5. 默认裁决

| # | 问题 | 默认 |
|---|---|---|
| D-B1 | 关口任务材料包取消后，这份预算怎么办 | 并进该航区关口首领的首通奖励（同材料、同总量），不另设来源 |
| D-B2 | 新规则下关口提前（如风栖 Lv5 就够 3 个节点）导致 N4 关口到达等级低于 7 / 14 | 不改开放规则，也不加等级门槛；关口首领仍按 7 / 14 级推导，N4 里如实写「最早可挑战等级」和「自动驾驶实际挑战等级」两列 |
| D-B3 | 三路线实测差异大，用哪条推导 | 用三路线中位数；单条偏离中位数 > 30% 写进报告「武器差异」，不为它单独调数 |
| D-B4 | 自动驾驶被某个游戏 BUG 卡住 | 记下 BUG，该节点重试一次，仍不过就让自动驾驶跳到下一个可开放节点（工具里没有这个逻辑就加上），不伪造通关；被跳过的节点在验证表里标「未测」 |
| D-B5 | 云上资源不够（OOM、跑得太慢） | 把样本降到工具允许的最小固定种子数，不降到 0；仍不够就把一条路线拆成单节点分段跑 |
| D-B6 | 工作簿写入和现有表格式冲突 | 以 `hub-reward-schema.ts` 为准改写入器，不手改 xlsx |
| D-B7 | 部署时 Grok 正在测试 | 照常部署（部署会刷新旧页面）；在给 Grok 的复测说明里写清部署时刻 |
| D-B8 | 遇到本文没写到的小歧义 | 按「最接近 M14 精神」处理，记决策日志，不停 |

## 6. 硬阻塞（只有这些可以停下来）

- 会让线上测试服掉线、丢数据或破坏备份的操作；
- 需要推翻 M14 或 2026-10-22 开放规则才能继续；
- 认证、版本校验、反作弊判罚相关的改动；
- SSH 连不上测试服超过 1 小时（先把本机能做的 C0 本地部分、C2 写入器准备都做完）。

遇到硬阻塞：先把其他不受影响的项全部做完，再在 `b4-progress.md` 和协作中心写清阻塞项、已试过什么、需要谁做什么。

## 7. 完成定义

- [ ] C0–C5 全部勾完。
- [ ] `hub-outside-numbers.json` 由脚本生成并提交；`hub-port-economy.database.test.ts` 真跑通过，没有 skip。
- [ ] 三路线自动驾驶在验证轮从开场打到雾铃关口首通，`skipped-by-freeze`=0。
- [ ] 报告已提交，N1–N10 残差如实写明，未测项标「未测」。
- [ ] 测试服 health 为 0.11.51 / ow-92；云上 `b4-pg` 已删；线上常驻库没被碰过。
- [ ] 进度文件、决策日志、协作中心状态一致；所有提交不含素材和原始数据。
