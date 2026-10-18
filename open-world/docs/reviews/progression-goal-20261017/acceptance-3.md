# G1–G11 第三轮验收

执行日期：2026-10-17至2026-10-18（北京时间）。依据 acceptance-3-handoff.md 与 acceptance-3-plan.md。对象：当前未提交工作区，client 0.11.29 / protocol 38 / rules ow-74 / db 17。

## 自动化总表

所有命令均在 open-world 下串行执行，均首次通过，无失败重跑。数据库测试均使用临时库，并预设 AW_REVIEW_ROOT=.runtime/acceptance-g3/world-reviews。原始输出、截图与逐步进度仅在 .runtime/acceptance-g3/。

| 项 | 命令 | 结论 | 关键数字 |
| --- | --- | --- | --- |
| A1 | `curl.exe -s http://127.0.0.1:8612/api/health` | 通过 | client 0.11.29、protocol 38、rules ow-74、db 17 |
| A2 | `node node_modules/typescript/bin/tsc --noEmit -p .` | 通过 | exit 0，0 TS错误 |
| A3 | `python -X utf8 tools/config-export.py --check` | 通过 | 配置表一致：8本工作簿 |
| A4 | `node --import tsx tools/prologue-build.ts --check` | 通过 | prologue.json ok |
| A8 | `node node_modules/vitest/vitest.mjs run tests/energy-wording.test.ts` | 通过 | 1/1；灵力、法力命中0处 |
| B1 | `node node_modules/vitest/vitest.mjs run tests/skill-recovery.test.ts tests/craft-goal.test.ts tests/prologue.test.ts tests/combat-collision.test.ts tests/aspect-description-consistency.test.ts` | 通过 | 5文件、46/46 |
| D1 | `node node_modules/vitest/vitest.mjs run tests/opening-boss-timing.test.ts` | 通过 | 2/2；eager三把武器均20–25秒，见下表 |
| D8 | `node node_modules/vitest/vitest.mjs run tests/auto-dash-boundary.test.ts` | 通过 | 1/1；全部冲刺开始距离≤4格 |
| B3/D4 | `node .runtime/db-tests.mjs tests/weapon-story.database.test.ts` | 通过 | 3/3；按交接方案采用同一回执授予/激活护身印及成长卡片测试结论 |
| B3 | `node .runtime/db-tests.mjs tests/prologue.database.test.ts` | 通过 | 6/6 |
| 检查点 | `node .runtime/db-tests.mjs tests/dev-checkpoint.database.test.ts` | 通过 | 3/3 |
| A5–A7 | 本轮不跑 | 沿用 | normal掉率0.25；四系数0.66/3.2/2.74/6.07；自动冲刺上限4格。A5其余掉率历史未变的证据限制仍保留 |
| C1 | 本轮不跑 | 沿用 | 第一轮ALL PASS、12项dense达标 |
| B2 | 本轮不跑 | 原有失败，不计本批 | 未将旧失败冒充本轮实测 |

A8覆盖packages、apps/web/src、apps/api/src、config/json与apps/web/*.html中的指定源文件；旧报告、生成物、测试不在守卫范围内。

| 武器 | eager巨兽秒数（验收口径） | hold巨兽秒数（只记录） | eager全开场秒数 |
| --- | --- | --- | --- |
| 剑 | 22.7 | 15.7 | 42.4 |
| 法杖 | 22.7 | 18.5 | 44.3 |
| 暗器 | 23.1 | 23.3 | 41.9 |

D1全部finished=true、stalledIn=null。hold中剑和法杖不足20秒，按交接口径只记录，不裁为失败。

| 武器/冲刺技 | 3.8格目标实际起冲距离 | 4.3格目标实际起冲距离 | 20秒混战次数/最大距离 |
| --- | --- | --- | --- |
| 剑/破阵 | 3.8 | 1.3（先走近） | 1 / 3.98 |
| 法杖/撑杆跃击 | 3.8 | 1.3（先走近） | 1 / 3.97 |
| 暗器/影袭 | 3.8 | 1.3（先走近） | 1 / 2.66 |

## 可视验收

浏览器仅访问http://127.0.0.1:8612。检查点分别一次成功：`node tools/qa-checkpoint.mjs qa_g3d5_01 port-road sword`、`node tools/qa-checkpoint.mjs qa_g3d6_01 salvage hidden`；账号均10位、qa_开头。登录和关闭到达对白在段外完成。未补段。

时间为2026-10-18北京时间，精确到秒：

| 段 | 首张截图 | 最后实际可视操作 | 实际操作跨度 | 4分30秒截止 |
| --- | --- | --- | --- | --- |
| D5 | 00:14:15 | 00:15:49 | 1分34秒（93.942秒） | 00:18:45；提前结束 |
| D6 | 00:21:11 | 00:22:53 | 1分42秒（102.115秒） | 00:25:41；后续调用被守卫拒绝 |

D6计时透明说明：最后实际可视操作之后没有截图或页面输入；00:26左右下一次调用的首条计时守卫抛错，未执行其中的详细属性点击、截图或移动。00:26:24仅写本地计时记录。不能把这段空档视作已经持续观察缺能量，也不将延后落盘时间伪装为可视操作时间。

| 项 | 结论 | 依据与限制 |
| --- | --- | --- |
| D5 金币/强化石弹出与飞行 | 未覆盖 | 已在普通怪群连续击杀，金币150→192；当前截图319×612、游戏画面缩小，未可靠辨认两个图标的完整弹出/飞行轨迹，不以金币增长代替演出证据 |
| D5 部件图标/名称/遮挡 | 未覆盖 | 未取得足够清晰的部件图标、名称与角色/血条相互遮挡证据；不判产品失败 |
| D6 缺能量染色及悬停文案 | 未覆盖 | 暗器飞刀/扇刃已自动战斗；首次进入敌群至最后观察约60秒，包含升级对白与菜单中断，不能算连续60秒战斗；记录到92、85能量，最后人物页为100；未捕捉缺能量染色，也未完成悬停说明核对 |
| D6 回气说明 | 通过 | 技能→辅助→回气显示“大量恢复生命和能量”，已截图D6-huiqi.png |
| D6 人物资源名称 | 通过（人物主面板）；详细属性展开未覆盖 | 人物主面板显示最大能量100、能量恢复10/秒；展开详细属性的调用被计时守卫阻止 |
| D6 全局旧称 | 通过（A8自动化） | 按方案由A8覆盖，灵力/法力0处，不要求本段遍历全部界面 |

## 新发现问题

未确认新的产品缺陷。第二轮“回气仍写法力”在本轮已不复现。D5图像细节不足、D6缺能量未触发均按默认裁决列为未覆盖，不推断不存在或已经通过。

## 整体结论

本轮可作为已覆盖自动化项及D6已观察小项的验收依据，**不能作为G1–G11全部验收通过的依据**。缺口为D5完整掉落演出与遮挡，以及D6缺能量染色/悬停说明、详细属性展开。未修源码、配置或数值，未运行整套vitest、无头浏览器、verify探针或wind-island-driver测试；未访问8790，未执行任何Git状态变更命令。
