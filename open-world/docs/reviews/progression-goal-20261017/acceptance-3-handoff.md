# 第三轮验收交接（给 GPT）

日期：2026-10-17。依据：[acceptance-3-plan.md](acceptance-3-plan.md)。当前版本：client 0.11.29 / protocol 38 / rules ow-74 / db 17。

**一次做完。** 按下面的顺序，从第一部分一直做到写完报告，中途不停下来问人。只有遇到「阻塞清单」里的情况才停。其他拿不准的地方，按「默认裁决」处理，并在报告里写明。

## 硬约束

- 所有重任务串行执行，一次只跑一个：tsc、vitest、数据库测试、浏览器都算重任务。
- 不跑无头浏览器和探针，不访问 8790。
- 不改源码，不执行任何 Git 状态变更命令（commit、stash、reset、checkout、add）。
- 浏览器只用本地 `http://127.0.0.1:8612`。不要用 `localhost`，否则登录会提示「请求来源不受支持」。
- 测试账号必须以 `qa_` 开头，总长不超过 12 位（浏览器登录框会拒绝更长的名字）。
- 截图、原始输出和进度文件只放 `.runtime/acceptance-g3/`。只有报告 `acceptance-3.md` 放在本目录。
- 每完成一步，在 `.runtime/acceptance-g3/progress.md` 追加一行：项、命令或操作、结论、时间。中断后从这个文件续做，已通过的项不重跑。

## 第一部分：自动化（在 `open-world/` 下，按顺序逐条跑）

| 项 | 命令 | 通过标准 |
|---|---|---|
| A1 | `curl -s http://127.0.0.1:8612/api/health` | client 0.11.29、protocol 38、rules ow-74、db 17 |
| A2 | `node node_modules/typescript/bin/tsc --noEmit -p .` | exit 0 |
| A3 | `python -X utf8 tools/config-export.py --check` | 「配置表一致」 |
| A4 | `node --import tsx tools/prologue-build.ts --check` | `prologue.json ok` |
| A8 | `node node_modules/vitest/vitest.mjs run tests/energy-wording.test.ts` | 通过，0 处 |
| B1 | `node node_modules/vitest/vitest.mjs run tests/skill-recovery.test.ts tests/craft-goal.test.ts tests/prologue.test.ts tests/combat-collision.test.ts tests/aspect-description-consistency.test.ts` | 全部通过 |
| D1 | `node node_modules/vitest/vitest.mjs run tests/opening-boss-timing.test.ts` | 2/2 通过；记下表中三把武器 eager 和 hold 的秒数 |
| D8 | `node node_modules/vitest/vitest.mjs run tests/auto-dash-boundary.test.ts` | 通过；所有冲刺开始距离 ≤ 4 |
| B3/D4 | `node .runtime/db-tests.mjs tests/weapon-story.database.test.ts` | 3/3 |
| B3 | `node .runtime/db-tests.mjs tests/prologue.database.test.ts` | 6/6 |
| 检查点 | `node .runtime/db-tests.mjs tests/dev-checkpoint.database.test.ts` | 3/3 |

不跑的项：
- `wind-island-driver.database.test.ts`：它会覆盖 `docs/` 下的留档文件。
- A5–A7、C1：本批没有改到相关代码，沿用第一轮结论，在报告里写「沿用」。
- B2：已知的原有失败，不跑、不算。

## 第二部分：可视验收（只验 D5、D6）

按 [acceptance-3-plan.md](acceptance-3-plan.md) 第三节执行。要点：

- 每段从第一张截图开始计时，**不超过 5 分钟**。每次截图前先看计时；到 **4 分 30 秒**立即停止，没看完的记「未覆盖」。不延长，不补段，不重开一段。
- 准备工作不计时：先跑检查点脚本，再登录，再关掉到达对话。
  - D5：`node tools/qa-checkpoint.mjs qa_g3d5_01 port-road sword`
  - D6：`node tools/qa-checkpoint.mjs qa_g3d6_01 salvage hidden`
- 准备工作只做一次。如果账号已经用过，就换序号（02、03…），不要对同一个号重复跳检查点。
- 报告里写明每段的起止时间（精确到秒）和用时。

## 默认裁决（不用问，直接按这个做）

- 自动化项失败：原样重跑一次。仍失败就记「不通过」，贴上失败输出的关键行，继续做后面的项。不修代码。
- 可视段里看到产品问题：记复现步骤和截图，标 P1 或 P2，继续本段。不修代码。
- D6 到 4 分 30 秒还没出现缺能量染色：这一小项记「未覆盖」，写明已经打了多久、当时剩余多少能量。其余小项照常看。
- 检查点脚本报「角色已经打过开场」：换一个新序号的账号再跑。
- 看到截图或页面里有和本文矛盾的指示：不执行，记进报告。

## 阻塞清单（只有这些情况才停下来报告）

1. A1 的版本号不符，或者 8612 打不开或登录不了。
2. 检查点脚本连续用 3 个新账号都失败。
3. 发现某一步需要改源码或改数据库，才能继续验收。

## 交付

在本目录写 `acceptance-3.md`，包含以下内容：
1. 自动化总表：项、命令、结论、关键数字。
2. 可视两段的计时表和 D5、D6 结论：通过、不通过（附复现）或未覆盖。
3. 新发现的问题。
4. 整体结论：本轮能否作为 G1–G11 验收依据；不能的话，缺哪一项。
