# 流派丰富度实施进度

执行依据：`../AGENTS.md`、`../项目.md`、`docs/build-variety-handoff-20261006.md` §0。2026-10-06 从 RS 续做，R0 提交 `e946e31` 已完成。设计优先级：需求 > 内容清单 > 主文。批次连续执行；重测试串行；用户追加：禁止无头浏览器测试，所有后续浏览器验收必须可见；只有 §5 硬阻塞能暂停单项。

## §7 完成定义

- [x] 技能 77 个；元素覆盖符合清单 §7.4；11 技能奥术、5 技能状态补全；全部正式图标和特效档案。数量/状态/标签见 directed.log、图标 icons/result.json、七武器真实命中 player-path/result.json（ok=true）。RS已提交19112f9。
- [x] 原子 50 个；25 条连携迁为规则，行为保持（R2/R3帧轨迹与逐项测试）。
- [x] 新副属性 24 种，部位限制和上限；部位主属性按清单 §2。
- [x] 套装 18 身份（2+4），旧 6 套保持；守护者减伤数据化。
- [x] 威能 60 个；6 新机制字段和 charges 有执行器和测试；铭纹、强化开词条、锁定洗练可用。
- [x] 潮印 90 个；三选一、换一组、重连；开关次数在 dungeons.json。
- [x] 冻结、易伤、叠层、持续伤害暴击、自身增益、计数器执行器和测试（R3/R6/R7定向与完整回归）。
- [x] 防作弊上界覆盖触发动作，未覆盖抽查跳过，有测试（R2/R3）。
- [x] effect_triggered 事件与规则触发统计（R2/R3）。
- [x] 17 流派模拟在 0.8–1.25 带或按 §5.1 调整登记。
- [x] R0–R8（含 RS）每批提交及证据目录（R8提交6e31100）。
- [x] 完整回归1368通过/2既有跳过、tsc、内容校验与pnpm build全部通过。
- [x] 真实浏览器全路径：登录→营地→新装备→新技能野外战斗→副本潮印→断线重连→通关。
- [x] 旧正式存档验收按用户指定口径结案：开发期用户授权清档，备份完整可追溯（267/148/1910/1910，哈希与R4审计一致）。当前正式库保持清档后状态；之后存档一致性只针对新库（见[存档结案](build-variety-save-acceptance-20261007.md)）。
- [x] 流派handoff §7按用户确认的开发期清档验收口径全部完成，无硬阻塞。

## 批次与证据

| 批次 | 状态 | 提交 | 证据 |
|---|---|---|---|
| R0 | 已完成，复用既有证据 | e946e31 | [R0](build-variety-r0-20261006/) |
| RS | 已完成 | 19112f9 | [RS](build-variety-rs-20261006/) |
| R1 | 已完成并通过可见验收 | fd395a3 | [R1](build-variety-r1-20261006/) |
| R2 | 已完成，可见七武器/正式登录通过 | c6580b9 | [R2](build-variety-r2-20261006/) |
| R3 | 已完成 | a67f95d | [R3](build-variety-r3-20261006/) |
| R4 | 已完成，可见新掉落/Tip/刷新通过 | aae4d75 | [R4](build-variety-r4-20261006/) |
| R5 | 已完成；开发期授权清档验收通过 | 3325c02 | [R5](build-variety-r5-20261006/) |
| R6 | 已完成；开发期授权清档验收通过 | 31607fc | [R6](build-variety-r6-20261006/) |
| R7 | 功能、完整副本、发布自验收完成；最终全绿回归在R8再跑 | 4a3da76 | [R7](build-variety-r7-20261006/) |
| R8 | 已完成；开发期授权清档验收通过 | 6e31100 | [R8](build-variety-r8-20261006/) |

## 决策日志

- 2026-10-06：保留工作区全部既有变更；开工差异保存在 `.runtime/build-variety-work/preexisting.patch`。RS 已有部分实现按任务单逐项复验，禁止把旧测试记录当成本轮完成。只提交任务相关差异，不纳入其他 UI、地图、剧情改动。回退只撤销本任务提交，不能清空工作区。
- 中毒采用用户裁决：hit 总量拆半，zone 配置总量额外缩放。腐蚀劈 36=18+18。弓火毒差异在 R8 实测处理。

- 2026-10-07 用户确认：2026-10-06 22:24整库清档由用户授权、Claude执行，先备份；开发期无真实玩家，旧星潮海章节链与新任务系统冲突，选择清档不写迁移。当前正式库不恢复、不覆盖。开发期用户授权清档不违反保留要求；以后先问能否清档，不先写迁移。旧正式存档不再阻塞，验收清档后新建角色完整路径和已有角色服务重启/构建一致性。历史隔离恢复副本已清理，原备份SHA核对一致并保留。

## 硬阻塞

无。2026-10-07用户直接确认2026-10-06 22:24整库清档由其授权、Claude执行，先整库备份；开发期没有真实玩家，旧星潮海章节进度与新任务系统冲突，选择清档而不迁移。当前正式库保持清档后状态，不恢复/覆盖。旧正式存档项改记“开发期已按用户授权清档，备份可追溯”，替代的新建角色全路径和当前角色重启/构建一致性已有通过证据。历史隔离恢复副本已清理，原dump保留。详见[新口径验收](build-variety-save-acceptance-20261007.md)。

## 精确下一步

1. 流派R0/RS/R1–R8与handoff §7按当前授权口径全部完成，无硬阻塞，可由用户统一试玩。R7=4a3da76，R8=6e31100；当前0.11.11/protocol28/ow-52/v23/db15。新建角色全路径及清档后已有角色服务重启/构建前后一致性已验，历史清档改记“开发期已按用户授权清档，备份可追溯”。保持当前正式库，不恢复旧数据；备份原件保留，历史隔离恢复副本已清理。以后碰到旧存档兼容，先问用户能否清档，不先写迁移。暗影之握与界面版式备选仍交用户决定；开放世界数值文档§9/§10的未校准分布限制保持原记录，不能冒称整体数值验收已完成。完整报告见build-variety-final-report-20261007.md，新验收口径见build-variety-save-acceptance-20261007.md。

### 历史接续记录（RS期间状态，不是当前待办）

以下2–7项保留原始过程记录；当前执行状态以本页开头的完成定义、批次表和“精确下一步”第1项为准。

2. 后续绝不使用无头浏览器。`accept-handdrawn-skill-icons.mjs`、`accept-skill-fx.mjs`、`verify-build-variety-rs-browser.mjs` 已改 `headless:false`。动态脚本全部77技能、5模型、暂停/移动/死亡曾通过，整项记录曾因旧营地入口/准入失败（fx/result.json仍须ok=true）；已改当前小地图远行入口、模式下拉及受控Lv50/legacyAccess，旧聊天也正在复验，避免同时重跑重任务。
3. 本聊天的可见实机：CUA Chrome扩展连接失败，改用可见内置浏览器，绑定 `gameTab`、`gameBrowser`（browser id2），viewport1280×720。当前URL `http://localhost:4039/`，账号 `bv_visible_rs_20261006`，角色「流派实机验收」，Lv50/高生命灵力为明确受控授予；已真实穿戴青锋长剑、激活霜刃、卸下其余技能，唯一霜刃进入苍风原野，观察命中与减速。当前用Space暂停，截图 `visible/sword-slow.png`；早先龙骨荒漠霜刃击杀3个敌人截图 `visible/sword-field.png`。读取DOM/AX交互，不能通过CUA evaluate读取awInspect（隔离读作用域中为null）。`gameTab.pressKey(null,'e')` 可用；locator('body').press('e')曾失败，已重新观察后改用合法键盘API。
4. 可见隔离服务由 `tools/serve-build-variety-visible.mjs` 托管，exec session **5099**（tty=true，保持存活）；其API `tools/build-variety-visible-api.mjs` 在同一临时DB，只把meadow一个普通目标设为HP200000、attack0、合法距离1.8，以便观察状态。stdin可发送 `reload\r` 重建并重启API保留DB，`stop\r` 清理自身临时DB。旧session96676 stdin关闭且监督器退出后被QA清理，旧4039以外环境不再使用；新监督器已有keepalive和API ownership，不能再把API子进程移出监督器。正式8612服务与原玩家存档未由该fixture改写。
5. RS复验/提交后直接执行R1。准备脚本 `.runtime/build-variety-work/r1-edit.py`（尚未集成）：生成登记表、迁移六处属性名单、DamageZone显式type/mult、条件schema空通道，旧构筑/300帧样例 `.runtime/build-variety-work/legacy-builds.json`。已生成但未使用的 `packages/content/stats.json` 为34登记（25原词缀+9内部修正），**不得计为R1完成**。执行前用 `.runtime/build-variety-work/stage-batch.py snapshot r1 <所有待改文件>` 保存实际基线；集成后定向回归，再完整回归、版本/可见登录、仅暂存本批差异并提交。
6. R2/R3准备文件（仅草稿，不得计完成）：`.runtime/build-variety-work/conditions-contract.ts`、`conditions-runtime.ts`、`effects-contract.ts`、`r3-atoms.py` 与生成的 `effect-atoms.json`（50个）。效果schema需把状态override的z.record改partialRecord；比例/档位scale路径需要按实际字段校验；全部执行器/World埋点仍待实现。R2要迁25旧连携数据并保持旧随机/逐帧行为、上界chance/crit必定、effect_triggered统计；R3落实16触发/10动作/状态叠层及buff计数器，50原子逐项测试。禁止把准备JSON当完成。
7. 后续R4–R8依任务单继续，未实施，不得提前勾选。跨聊天协调授权问题已向用户提出，但用户仅追加“别无头测试”，并未授权向旧聊天发消息；不得擅自send_message_to_thread。可以读取紧凑wait_threads状态与共享证据。

### RS 校准与验收决策

- 参照零伤害旧「致盲」无法计算DPS比，夜幕改与同武器范围技能死莲配对，伤害41；其他新技能校准已记录内容清单修改记录。瘴气/毒雾弹的额外毒预算保持6/8；腐蚀劈技能总预算36不变。回退限新技能参数。
- 正式 renderer 已为 combat-vfx v3，旧动态脚本只识别 skill-source-fx 单一图集及旧role字段。验收改为检查实际注册图集+程序几何、真实分配节点、复制的beam端点和8个地面火焰点；所有旧验收意图保留。新增诊断只读，不修改动效。

- 可见浏览器：Chrome扩展连接暂不可用，已在本聊天侧栏打开可见内置浏览器 `http://127.0.0.1:8612/`。动态脚本77技能/5模型/暂停/移动/死亡已通过的观察保留，但整项仍未通过（野外入口因当前准入条件禁用）。后续验收必须可见，不将无头运行视为交付证据。

### 本轮接续约束

- 以用户确认的 RS 提交 19112f9 为基线；上述旧会话端口、session 和 RS 待验收记录仅作历史，不作为当前状态。
- Claude 的 M1 改动全部保留且不纳入批次提交；同文件用本轮快照与工作区差异三方合并到 Git 索引。每次版本从 0.11.3 / protocol26 / ow-44 / db15 或更高现值递增。
- 数据库测试统一 --no-file-parallelism；重任务逐个运行；浏览器必须 headless:false。

## 2026-10-06 R1 续做更新

- 用户验收 RS 提交19112f9通过。R1锁定该提交的77技能数据与RS验收源码指纹；工作区已有R1草稿及 `.runtime/build-variety-work/r1/files.json` 实施前备份，先审计，不重新生成覆盖既有改动。
- R8待办：暗影之握伤害11、恐惧30帧的参照/定位重新评估（石化90帧），提供延长恐惧/提高伤害等测量结果，报用户决定。火焰箭/旧毒箭差距维持R8安排。本批不改两项。
- R1新增验收：stageScaled迁入stats.json后重新验证T1/T8移速同值与旧装备逐字段不变；逐帧基线覆盖全部77技能，同构筑、同种子。
- 当前精确动作：审计contracts/stats.ts与stats.json；补齐set-calculator套装/养成属性的共用分派；DamageZone显式type/mult、新条件空通道；建立RS独立基线77技能记录，再定向/完整串行回归、内容、生产构建与可见登录。

- R1 裁决（§5.1 / L1）：旧套装生命值小于1按比例这一语义保留，其余静态属性复用登记表分派。条件池本批只验证通道，R2启用执行。版本从当前0.11.3/26/ow-44递增为0.11.4/26/ow-45，协议保持M1的26。回退仅R1提交中的解析及版本增量。

- R1 已通过：定向39、串行全量836+2跳过、类型/内容、生产构建、可见Chrome登录和行囊刷新；证据 reviews/build-variety-r1-20261006/README.md。旧26协议保持，版本0.11.4/ow-45。

### R1 补充验收：用户要求的 RS 基线与77技能（2026-10-06）

- 77技能 × 2构筑 × 种子41/73 × 每组600帧，共308组，精确数值、事件、逐帧状态全部一致。请求与实际执行技能逐组核对，净化给予双方同一减益，所有技能有真实施放。证据：`build-variety-r1-20261006/frames-77/result.json`、`traces.json.gz`、README。相关源码前后指纹相同。
- 基线锁定19112f9的RS技能与已提交RS验收源码指纹。164依赖文件与指纹一致，4个后续兼容依赖及影响边界明确列入来源清单；全部基线字节归档`reference-source.json.gz`，可在后续批次后复现，未回滚工作区。
- 定向复验`build-variety-r1.test.ts`31项、`item-affix-power.test.ts`3项全部通过，包含T1/T8固定移速同值及旧装备阶段移速72读档解析后逐字段不变；新增工具后的`tsc --noEmit`通过。
- 可见浏览器登录→港口→行囊稳定→刷新恢复通过；`build-variety-r1-extended-20261006/live/result.json`为ok=true，真实数据库装备及仓库逐字段不变，账号/角色/回执/流水保留。实测服务0.11.4/26/ow-45/db15，health/content与客户端兼容。
- R1实施和暂存仍有另一聊天同时操作；跨聊天协调授权已向用户提出。本补充验收没有改写共享实施文件或提交他人的暂存区；整批提交、生产构建及后续批次尚不能据此勾选完成。

- R2 裁决（§5.1/L4）：保留旧 Stats.combos 快照读取，转换成同一通用执行规则；新来源使用 Stats.rules。25条原连携的触发顺序、随机调用与伤害不变，新增遥测字段在逐帧比对时单独检查。条件单位为秒，战斗内部帧按30Hz换算。回退只R2提交，旧快照不写回迁移。

### R2 在制接续记录

- 当前代码已接入条件真值表、25条数据规则的旧快照适配、Stats.rules、命中条件池、上界概率/暴击、effect_triggered与触发/伤害统计。25×300帧逐帧回归和14条旧连携测试通过；100种子上界触发通过。
- 版本当前0.11.5/protocol26/ow-46/db15。正在执行串行全量 `node tools/verify-build-variety-regression.mjs r2`（exec session 90623）；结束后检查types/content，修复后做生产构建和可见浏览器验收，再提交R2。R1提交fd395a3。
- R2修改前基线 `.runtime/build-variety-work/r2/files.json`；R1索引人工脚本 `stage-r1-owned.py` 展示如何只从HEAD构造本批差异，不能直接git add共享文件。R2测试新文件、rules/effects/conditions新文件可独立暂存。M1文件仍不得纳入。
- R2新增测试 `tests/build-variety-r2.test.ts`；参考录制 `tests/fixtures/build-variety-r2/legacy-traces.json.gz`；规则唯一源 `packages/content/weapon-combo-rules.json`。当前 effect动作仅7种，R3扩展后才可装载50原子草稿，禁止提前计完成。

- R2 全量已通过：117文件，884测试通过、2原有跳过；types/content通过；生产构建版本0.11.5/26/ow-46/db15并恢复服务。可见七武器命中/状态/表现录像脚本运行中（session1542），输出 reviews/build-variety-r2-20261006/player-path/；结束后运行 `node --import tsx tools/verify-build-variety-live.mjs r2`，写README并提交暂存R2。
- R2索引由 `.runtime/build-variety-work/stage-r2-owned.py` 仅合入规则/遥测相关部分；M1的Entity字段、游荡/精英/sprint/combatAt等未合入，工作区仍保留完整实现。不要直接git add packages/simulation/index.ts或packages/contracts/index.ts。
- R3开始前需snapshot新基线；用 `.runtime/build-variety-work/effects-contract.ts`/r3-atoms.py作参考，不能直接视为完成。需先扩展状态schema freeze/vulnerable/maxStacks/stackMode/onStacks，通用selfBuffs/计数器/16触发/10动作；复用R2原7动作保持7500帧旧样例；50原子每条实测、动作预算压力测试。回旋原子依赖L7 returns，可按§5.1把该单一字段执行器提前R3，R6补齐其余机制，避免占位。

- R2可见七武器全部通过，正式登录/行囊/刷新与旧装备仓库核对通过。前后行为基于7500帧冻结录制，可见操作视频另存player-path/video（视频哈希见video-manifest.json），不把人工录像像素当伤害计量。

- R3裁决（§5.1/L7依赖）：回旋原子要求返回投射物，returns字段和执行/碰撞/表现测试前置到R3，R6不重复实现；其余L7字段仍按R6完成。功能语义与内容数量不变，可单独回退该字段实现。

### 独立实施与核对记录（本聊天追加）

- R1基线兼容核对：`build-variety-r1-20261006/regression.json` 曾明确通过116文件/836测试（2项为原有跳过）、tsc、内容校验；本聊天未删除失败测试，修复武器剧情数量断言63→77。后来共享目录继续增加R1套装分派及77技能验收，最终R1提交fd395a3已确认；R2提交c6580b9已确认。所有这些完成以对应最终提交/证据为准，旧执行过程仅保留来源。
- R3已实际修复：冰缓阈值转冻结、冰甲初始/周期光环、guardian/immunity增益和field状态构造缺少必需cleanse字段。阈值/首领迟缓/非冰伤解冻及冰甲护盾和光环实测通过；证据`build-variety-r3-20261006/threshold-review.json`、`ice-armor-review.json`。新增`tests/build-variety-r3-review.test.ts`保留回归。
- R3已实际修复：持续毒伤刷新后emitted超过第一个预算周期，引爆原来错误返回0。新增`remainingStatusDamage`按真实next/ends和预算余数计算未来伤害；tick100/next120/ends160/emitted3的剩余毒伤实测60。定向回归在`review-directed.log`，不得删除该失败重现或放宽标准。
- 后续数据/逻辑准备（均不能作为运行时完成）：`.runtime/build-variety-work/r4-stats.json`24副属性+完整主属性权重；`set-effects.json`18身份；`aspects.json`60威能；`augments.json`90（40/35/15）；`inscriptions.json`分部位铭纹/强化节点/洗练配置；`balance-builds.json`17构筑已检查全部武器/技能/套装/威能/潮印引用。
- 独立通用逻辑：`skill-patches-rules.ts`白名单克隆/过滤/元素标签重推导/半径实际绑定等已用`verify-patch-core.ts`核对（未安装的新机制会报错，不能静默剥离）；`self-buffs.ts`叠层、消耗、过期、实际移动与3秒击杀窗口已核对；`run-augments.ts`100种子三选一/同阶换组/幂等载荷/不公开privateSeed已核对。全部仍需真实World/服务端/副本/存档和可见浏览器接入验收。
- UI示意已完成可见1280×720渲染，项目Token+公共组件：`.design/build-variety-augments-20261006/`三张a-cards/b-focus/c-list；`.design/build-variety-damage-panel-20261006/`三张a-zones-rules/b-columns/c-skills-detail。均带“示例数字、非实机验收”标识；页面高度720无外部裁切。版式待用户选；R7/R8功能必须先公共组件接真实数据，不能因选版式而停工。
- 设计冲突的实现候选（落实时按§5.1登记）：毒爆偏好“原子毒云”不在90潮印中，改选久蚀并由项链铭纹提供毒云；震地旋风用剑主手穿震岳4+旋锋2以合法使用旋风变形（套装不限主手）；分裂箭雨核心保留旧标签威能aspect-build-split，毒流/回响等全部数据项仍保留。上述仅构筑测量候选，必须实测后再计平衡完成。


- R3实测修正：荆棘草稿为脚下1格范围，会漏掉远程攻击者，改为以实际攻击者为中心的单目标反弹（护甲×1不变）；回退仅atom-thorns的目标/半径配置。多人DOT新暴击权限按status.sourceId的角色状态求值，保持存储的毒/燃烧预算。

- R3共享工作区出现外部复核修改：tests/build-variety-r3-review.test.ts，以及skill-runtime.ts的remainingStatusDamage与World调用。已保留；原实现未计刷新后跨预算周期的剩余DOT，复核helper按未来结算次数修复。此部分标记为外部修改，暂存时单独核对，不混入M1或冒充本轮独立改动。applyStatus本轮改为接收schema输入类型并在函数内解析默认字段，以通过复核样例的类型检查。

### R3 在制接续（最新）

- 已运行50原子逐项与16埋点/状态/consume/returns/extend/reduce/arc等74定向测试；10分钟18000tick全原子压力通过，seed41，maxActions≤24。R2的7500旧帧仍保持。版本已升0.11.6/26/ow-47/db15。
- 当前串行全量runner session8486，输出r3目录；结束后检查types/content。共享外部review测试与remainingStatusDamage已保留，不能整体覆盖skill-runtime或review测试。
- 自审待补一处：applyStatus在onStacks转换成功后应立即return true，避免递归freeze后外层又把已消费slow的旧ends写回target.slow；补上冻结过期后无残留迟缓的测试，再定向复验。旧无onStacks状态不受影响。
- R3可见验收还未执行。待用verify-build-variety-skills-visible的受控副本夹具，增加3种原子组合（霜刃+寒蚀、火箭+回旋、静电场+叠感电），检查实际冻结/回程/叠层和状态标签，全部必须headless:false。然后构建/正式可见登录/仅本批暂存并提交，接R4→R8。
- 本轮R3新增脚本仅是已应用的补丁记录，不可重复执行：.runtime/build-variety-work/r3-integrate.py、r3-status.py、r3-hurt-cast.py、r3-finish-basics.py。当前源码为准。50原子源已在packages/content/effect-atoms.json，生成草稿仅供参考。

- R3全量首次961通过、1失败、2跳过。唯一失败是既有保留期测试在cleanup事务执行中途回拨ended时间，Read Committed不同语句看到不同夹具时间，导致battle先清而ticks暂留。只调整测试夹具：停止应用后回拨、重启后验收；原零tick/奖励/回执断言全部保留，不改数据库清理或删除策略。
- 冻结/易伤已补可见状态表现：复用ice-vfx冰晶与既有血色标记绘制，读取当前状态和演员挂点；冻结转换后立即返回，避免已消费slow写回。

### R3最终验收在制（覆盖上方旧session记录）

- 最终串行全量119文件964通过、2原有跳过；tsc/content通过，r3/regression.json为ok=true；首轮失败保留regression-first.*。cleanup-recheck已通过原全部断言。
- 生产与QA构建完成，版本0.11.6/26/ow-47/db15，源前后稳定；267账号148角色1473回执/流水逐行一致。
- 可见原子脚本 `tools/verify-build-variety-atoms-visible.mjs r3` 正运行session14410；霜刃freeze/vulnerable双标记与火箭return已通过，等wand三层shock。
- 截图发现world-numbers把所有consumed显示为守护已用，待限定仅guardian（旧缺status事件保留兼容）；其他叠层consumed不生飘字。先snapshot该文件及tests/world-numbers.test.ts以保护既有UI改动。修后定向测试、刷新编译客户端复核sword截图。
- R3暂存隔离脚本stage-r3-owned.py已建立，仅合入本批改变，simulation/contracts的M1字段和分支未入索引。独立流派会话的review修复已确认属R3范围，保留来源说明；Claude M1仍不暂存。可见验收最终通过后正式可见登录，README/证据/版本记录并提交R3，立即R4。
- R4–R8数据准备来自另一个同目标会话（未运行接入，不计完成）：.runtime/build-variety-work/r4-stats.json、set-effects.json、aspects.json、augments.json、inscriptions.json、balance-builds.json；skill-patches-rules.ts/run-augments.ts/self-buffs.ts等需逐项审查后接入，不重新生成已定条目。R7/R8示意图也已在.design对应目录（仅示意，功能仍须接真实数据）。

- R3采纳的独立复核已确认为同一流派范围，不是Claude M1；提交保留其来源说明与review测试。M1的app/field-service、精英词缀、悬赏、世界表、任务表、tier/传送等继续留工作区不暂存。

- R3最终：3类可见原子均通过；修复后的霜刃截图无错误守护飘字；不衰覆盖旧chain开关，新增定向3项通过；发布release/build.json为passed，源稳定。旧账号/角色/回执/流水保留，期间正常变更有新增回执证明。

### 独立模块接续（19:54，共享工作区）

- R4复核修正：stats.json 的荆棘使用 display=multiplier，登记schema原来只容许 percent/number/seconds 导致全部runtime导入失败。已扩展schema，并让affixDisplayValue按×倍率显示荆棘。改动仅contracts/stats.ts与affix-units.ts两行，R4主实施暂存时纳入；其他R4文件未覆盖。
- L8独立执行模块已建立：packages/rules/atom-parts.ts，resolveAtomParts最高档去重/scale字段只乘一次，overrideEffectRules支持来源/显式group/原子ID改写；schema严格拒绝未知字段/原型路径，chance加倍明确封顶1。tests/build-variety-atom-parts.test.ts 6项通过；尚未接collectBuildParts，不能计R5完成。
- R6独立补丁模块：packages/contracts/skill-patches.ts、packages/rules/skill-patches.ts；白名单、clone、append、过滤、元素重新推导、爆炸半径与新radius同步、cooldown resolution同步。tests/build-variety-skill-patches.test.ts 14项通过。尚未接resolveProgressionSkill，6新字段和charges尚未全部执行；不能计R6完成。
- R7独立选择模块：packages/contracts/run-augments.ts、packages/rules/run-augments.ts；严格policy/private状态schema，100种子三选一/同档换组/UUID命令防重/重连恢复/隐藏seed与命令日志；支持小数权重。tests/build-variety-augment-offers.test.ts 6项通过。尚未接正式DungeonService事务、frozen base build、UI与实际90项，不能计R7完成。
- R8用户追加测量已完成首版：tools/measure-build-variety-r8-skill-options.ts → r8/skill-options.json（ow-47，Lv50/rank1，seeds41/73/107，90秒输出，normal/elite/boss，显式高生命灵力隔离）。暗影11/恐惧30 DPS44.97、控制21.8%，石化15/90 DPS42.03、控制43.5%；暗影11/90 DPS42.60、控制60.1%，因真实恐惧位移损失部分输出；暗影18/60 DPS73.68、控制43.7%。boss免疫fear如实保留。火箭349.33 vs旧毒箭205.18（+70.3%）。候选只改测量副本，不改正式技能；用户要求交其决定暗影选项，R8最终附方案比较。17完整BD仍须接实际内容后模拟。
- 以上独立文件暂不单独提交，供对应R4/R5/R6/R7/R8批次正式接入、验收、一起提交。重任务保持串行，浏览器必须可见。

- 独立复核接续20:07：R4 review 6项与R1旧帧/登记55项通过，证据r4/independent-review.log、legacy-registration-review.log。R1单位显示断言扩展了seconds/multiplier分支（24新属性自然增加样例）；原旧帧断言未动。仅该测试行的原基线保存.runtime/build-variety-work/r4-review。R4正式提交需包含review测试与这一单位断言修正。
- 独立模块整体26项通过，tsc --noEmit通过（r6/independent-modules.log、independent-types.log；发生在20:00前，后续源码仍变更，不能替代批次最终完整回归）。
- R8功能组件已建立apps/web/src/damage-breakdown-model.ts、components/DamageBreakdown.ts。5项测试含真实World落雷埋点匹配、池/标签分开、无记录vs零触发、HTML转义。tools/render-build-variety-damage-preview.ts调用实际resolveBuild并运行seed41/300帧；落雷4次/2392伤害。使用公共statRow/sectionTitle/stateBlock，不新增正式布局。可见IAB1280x720核对上/下滚动截图functional-top.png、functional-bottom.png，document1280x720无外溢；functional-layout.json记录奶白背景与字号。修正默认暴击倍率从错误×1改读登记表×1.5。此页明确标受控组件，尚未接CharacterPanel入口及实时World/副本checkpoint计数，不计R8实机完整路径完成。示意图仍在.design/build-variety-damage-panel-20261006，版式待选不阻塞功能接入。
- R8火箭候选冷却90输出252.33（对毒箭+23%），100输出227.1（+10.68%，稍超RS10%）；建议继续测105并在R8按§5.1裁决，保持30+燃烧9与旧毒箭逐帧。暗影选项依用户追加仅测量，最终交其决定。

- 独立接续20:21：packages/simulation/replace-build.ts + tests/build-variety-replace-build.test.ts 5项通过（r7/replace-build.log）。R7选择同步应调用replaceCombatBuild，不能调用World.applyBuild（旧方法会清pending并按比例回血）。新helper验证后一次性替换，保留飞行物/阶段/冷却/状态/计数器/随机状态；HP和灵力仅在新上限更低时截顶，增加上限不回血，多人只改指定角色。未接DungeonService事务，仍不计R7完成。
- charges独立模块packages/simulation/skill-charges.ts + tests/build-variety-skill-charges.test.ts 6项通过（r6/charges-module.log）。裁决：每次充能使用实际战斗tick和最终冷却，按顺序逐枚恢复；冷却减少只前移当前充能并保留后续间隔，重置恢复全部。保存max/spentUntil，可恢复且暂停不增加tick。未接skillSchema、World.cast/readiness、heroFields/checkpoint及UI，因此不计charges机制完成；R6接入后补真实释放/表现验收。
- R4 gearContribution补显式数值字典返回类型，允许主属性critChance等出现在base/enhancement/effective且保留attack/armor必填，解决R4测试类型错误。panel-types.log旧失败是源码同时变更期间记录，保留，后续稳定类型检查需重跑。
- R8技能测量扩为raider无甲与guard有甲、3档位、3种子，共198样本。暗影11/30对普通guard DPS35.47，石化32.79（+8.2%），控制仍21.8% vs43.5%；单延长恐惧90对guard DPS33.60、控制61.3%。火箭CD105无甲218.04 vs毒205.18（+6.27%），有甲168.16 vs毒135.58（+24.0%），说明只校无甲不够；脚本已追加CD120候选并扩展13个关键依赖指纹，下次稳定/串行再跑（当前skill-options.json仍198样本、尚无120）。旧毒不改。后续R8最终用正式内容版本复跑，不能把此报告当17BD完成。

### R4裁决与在制

- 版本0.11.7/26/ow-48/db15；49副属性登记（旧25+新24），主属性权重保留7元素各5。秒数/倍率独立显示，比例精度读pool.precision，荆棘单条允许最大2，不按百分比≤1误拒。
- 新随机主属性只在实际掉落/制作生成入口调用assignMainStat；初始赠送与中性模板保持校准配置；读档/洗练不重掷主属性。新数值强化用同一8%参数保留小数，不用最低+1把暴击率错误加成100%。
- 旧计算顺序保留：旧affix/set/progression后应用新main，主属性同类百分比合并一次；castSpeed按速度倍率缩短windup/(1+value)，普通弹体碰撞不随areaSize放大，实际范围/爆炸半径同步。
- realPG定向：确认掉落→领取/装备→Tips→洗练→重放/刷新，15项通过；同构筑4组旧300帧仍通过。当前已补新属性详情、比较、待领预览及随机主属性掉落预览。随后全量/可见新掉落/发布/提交R4，立即R5。

- 独立接续20:35：R8最新skill-options.json为216样本（12方案×2模板×3档位×3种子），13关键依赖稳定。火箭CD120候选无甲186.34（相对毒箭−9.18%）、有甲143.06（+5.52%），两种均≤10%；仅测量副本，正式CD60未改。具体定位/限制/数据见r8/skill-options.md，R8最终再用正式版本及长窗口复验。该文档版本ow-47为初步测量版本，不能冒充ow-48生产结论。
- 新潮印公共组件apps/web/src/augments-panel.ts，使用既有confirm overlay/header/state/button/badge，未增加平行皮肤或正式布局。pending提交禁用全部选择与换组，次数0禁用换组；无/不完整/重复/混档选项不给可选按钮，已选恢复、错误文字转义。tests/build-variety-augment-panel.test.ts 5项与damage-breakdown 6项共11项通过（r7/public-panels.log）。UI尚未接dungeon-controller/network/DungeonService；不要计R7完成。
- DamageBreakdown接受第4参数sourceNames映射，未知set/aspect/aug/atom目录ID显示“构筑效果”，避免把技术ID作为玩家文案；self_state的mana/移动/静止显示百分比/秒。panel-types-final.log在此前源码稳定点tsc通过，后续新AugmentPanel仍须批次最终检查。
- 本聊天没有暂存或提交，避免把未接入R6/R7/R8模块混入R4。下一步：主流程R4可见掉落/Tips/洗练→完整回归/发布/提交；R5统一套装时接atom-parts；R6接skill-patches/skill-charges并完成World真实6字段；R7接run-augments/replace-build/AugmentPanel真实事务与网络；R8接DamageBreakdown到CharacterPanel并传实际World/多人checkpoint effectStats，再17BD模拟/全路径可见验证。

- R4复核20:38：ref='dealt'目前只由status动作执行器使用。已把contracts/effects.ts中status.ref限制为hit/dealt，其余引用继续hit/shield/armor/maxHp/attack/maxMana/cost；避免让nova/shield等接受执行器实际忽略的dealt，或status接受忽略的maxHp。新增schema负例与旧正例，R4 review7+atom-parts6通过（r4/independent-review-final.log）。正式R4暂存包含此细化，旧原子默认hit不变。
- R6/R7接入时要核对准备数据的真实语义：aspect-df-scythe的conditional lifestealMultiplier当前World仅读buffValue，需真实条件倍率执行；aspect-df-hold的perStillSecond/max需要schema与每秒叠加；speedBonus转换须明确额外速度的比例口径，不得numericStat未知key默认为0。aug-g-volley的unsharedProjectiles要同时保留命中毒总量分配口径；aug-p-coin锁0暴击与非暴击乘区要明确保证暴击的优先级并记录。上述当前未接内容，不是§5阻塞，不得把JSON预备数据作为运行时完成。

- R6独立常驻转换模块packages/rules/stat-conversions.ts已建，conversionZones按额外移速/等级基线速度得到比例，cdr仅转换超阈值部分；严格拒绝未知字段、递归toStat、重复来源。tests/build-variety-stat-conversions.test.ts 4项通过（r6/stat-conversions.log）。此模块只负责服务端常驻参数，临时速度增益是否也转换仍须在正式R6按清单语义接入与测试，当前不计对应威能完成。
- R5/R8务必核对弓的真实4+2获取路径：正式六部位含主手，弓没有新谱系时，仅其余五部位不足4+2。不能只在17BD夹具里给弓伪造新setId；需让实际新掉落的弓按内容配置借用千刃/剑势/决斗身份（保留弓武器绑定和正式旧图标、不新增谱系），或找到设计里已声明且实际可获取的第六件。旧弓实例字段保留。此项属于已定“弓借套装”的落地，不是重新讨论；R5真实路径必须覆盖。

- 浏览器模式核对20:48：本轮未运行无头浏览器。余下旧tools/verify-build-variety-rs-live.mjs、verify-build-variety-r0.mjs的headless:true已改false，防后续复制旧入口误跑无头；仅改启动可见性，无额外测试。所有流派验收脚本现在均headed（R4新gear-visible入口也false）。modules-types.log已在ow-48当前源码点tsc通过。

- R8公共测量执行器tools/build-variety-benchmark.ts及tests/build-variety-benchmark.test.ts已加入（**尚未单独运行**，当前R4全量runner67000/70416在跑，不能并行重任务）。sampleCombatBuild严格核对请求/实际技能顺序、激活等级、实际主手及正式技能绑定；消费传入的服务端构筑、敌人、地区和明确tick预算，不补血回蓝、不隐藏失败样本；记录cast/failure/direct/periodic/derived/TTK/死亡/截尾存活/规则埋点。后续17BD正式源接完后调用，不能现在宣称17BD通过。当前R4全量是否收到了这一新测试需要核对，若未收集，等其结束再跑定向。
- R7冻结边界：需保存入场原始构筑（或角色基线）及本场可用的潮印/原子数值快照，选潮印从该基线重建，不从已经叠加过的frozen结果再乘一次，也不能读当前存档装备/等级改本场。旧已开战副本不因新增默认开关补发潮印；重连还原私有seed、待选、已选、offerVersion、command ledger。运行中版本变化后继续采用本场冻结规则，不能把最新全局catalog的新数值混进旧局。以上是AGENTS固定规则要求，不是额外确认项。

- 独立接续21:03：R4全量131文件1067通过/2原跳过，types/content均通过，regression.json完成13:00UTC。未与该重任务并行跑其他测试。benchmark新增文件未被其启动时收集，已在结束后单独跑4项，全部通过（r8/benchmark-module.log）。R8实际17BD仍未跑。
- 所有本聊天新模块当前均在工作区且未暂存；R4 schema/单位/数值贡献返回类型修复应入R4，后续模块入对应批次。下一步继续主流程R4可见新装备验收与生产发布，然后R5。R8初步216样本和功能组件截图保留，正式版本改变后必须更新数据/版本。

- R6/R7还需针对性覆盖DOT暴击：当前dotAllowed只检测dotCrit（half）不检测dotCritFull；若潮印仅授予Full，会不生效。aspect-st-ember只声明“燃烧可暴击”时还须限定燃烧，不能顺带使毒/流血暴击；现buffFlag仅接skill/target，状态tick通常无skill上下文，单靠fire tags过滤可能不匹配。正式接入应传实际damageType/status上下文并做burn/poison/bleed对照；buff.filter受控规则也不能被undefined skill静默忽略。这里只记实码缺口，未把条目提前勾选。

- R5/R7投射物组合边界需真实覆盖：set-hidden-omega草稿的nextCast mods.projectiles=2目前buffMods白名单还不支持；应由有schema/执行器的临时补丁施加且只消费下一次投射物。基础三发+潮印额外2+套装下一发额外2=7，当前skillSchema.projectiles最大5会拒绝或被旧成长截掉，不能默默少给。接入时统一扩充安全计数上限并验证总预算分摊/不分摊标志、渲染与动作预算，旧无新零件仍保持原结果。此为组合实现边界，不删条目，不需用户再裁决。

- R6补丁复核21:14：applySkillPatches在damage或mechanics.statuses变更后重新将hit poison预算设为floor(skill.damage/2)，zone poison保持独立原预算；先拒绝无效既有total，不用重算掩盖负数。新增毒箭×3=84总量/42毒预算、zone不联动、负预算拒绝的测试。当前gear-visible进程69596正在可见验收，**新增第15项尚未运行**，待其结束再定向。正式R6接入还需让运行时nextCast伤害增益遵守同一半拆分，现prepareEffectSkill直接乘旧毒total在奇数预算时可能差1；应共用预算规则，不能重写旧无补丁构筑的帧。

### R4最终验收在制（最新）

- 完整串行回归131文件1067通过/2原有跳过；types/content通过；生产构建与托管恢复通过，当前0.11.7/26/ow-48/db15。
- 可见真实新掉落脚本 tools/verify-build-variety-gear-visible.mjs 正运行session17459（第一次拾取处理中点背包未接收已修等待条件）。路径：登录→实际field kill→私有受控helmet池新掉落→自动拾取→回城→人物详情/竖版Tips→装备→刷新。等结果；失败仅修其真实原因，不改游戏准入。然后正式verify-build-variety-live.mjs r4、README/证据/提交。
- R4暂存骨架stage-r4-core.py已只从HEAD合入任务变化；stage-r4-ui.py已修GearDetails旧if分支格式并成功执行。app的M1 camp/quest/tier/传送等未入索引，新增MainStat/比较是本批hunk。M1xlsx不暂存。
- R4实际改动：stats49，gear-affixes.mainStats及pool.precision，main-stats issuance函数，build-parts legacyOwner桥接，affix部位/排重，属性实际exec，各UI主属性和比较显示。源码仍不提交时不得重跑旧补丁脚本覆盖。
- R4源collector与中性模板不重掷旧数据；启动赠送按校准配置，真实掉落/制作执行main generator。新随机主属性强化用同一8%比率而非最低+1。

- 17BD的另一处真实装配约束：预备balance-builds.json的quake为Sword主手，HammerStandard4+AxePrimal2，主手不属于这两套，剩余5部位也不足4+2。不能照此夹具造任意setId。主文§9此流派常见锤/斧，而现whirl只允许剑。R6/R8可按L7自然扩展让“风暴回旋”威能对锤/斧解锁旋风斩（补丁白名单weapons、服务端兼容性解析/装备校验、真实执行和测试），保留无威能旧绑定，并把quake主手改锤、配真实4+2；或在三文档中找到等效且严格能装备的已定方案。不能换掉该核心威能后仍称已验其效果。此为实现约束，按§5.1继续裁决，不整体停工。

- L7自然扩展已落实在独立补丁schema/执行器：白名单新增既有字段weapons，可由明确威能补丁扩大特定技能武器许可，原catalog不改。新增whirl仅在补丁后允许锤/斧的schema/参数测试（现在共16项，最新两项待gear-visible结束运行）；服务端SkillAccess/装备技能校验仍需正式R6按补丁后的技能许可执行，不能仍先用旧skillWeaponAllowed过滤。quake主手改锤后，另两个技能须改为其正式可用技能（如ground_slam/cleave），保留whirl为核心，而不是把blade_fury/rush也伪造为锤可用。
- Benchmark以服务端解析后的显式Skill.weapons为准，并仍拒绝未注册技能/未激活/未解析许可；不能把威能条件解锁错误地按原始global绑定拦掉。注册表只用于验证技能存在，实际武器许可按输入冻结参数与World执行一致。新代码待可见重任务结束复测4项。

- R4可见验收修正均为脚本定位/同步：等待pickup写操作结束再开包；空头盔槽装备直接提交，无确认对话；候选列表没有Tip绑定，改在真实背包卡片点击/悬停并等待目标名称和属性而非复用旧Tip的busy=false。数值栏已用space24固定宽度和nowrap防百分号换行。脚本当前session44170，等待final result后R4发布/正式登录/提交，立即R5。

- R4脚本独立修正21:31：tooltip-controller点击会主动suppress同一target，必须真实离开后再悬停才恢复（其pointerover代码检查suppressedPointerLeft）。gear-visible在hover.click后立即hover相同像素，因此Tip可一直不显示、目标名称等待超时。已在两动作间真实hover背包“人物”按钮，再返回目标卡片；不改Tooltip生产逻辑、不降低名称/主属性/高度/存档断言。只改这一段脚本，待主验收重跑，仍headless:false。

- gear-visible的scope文字同步改为combat/pickup/equip/Tips/session restore：当前脚本没有点击强化，不能在报告标题冒称实机upgrade。强化/洗练的真实PG命令链路由r4.database定向15项证明；R6强化开词条玩家路径仍要做真实UI操作。

- 裁决已同步需求L7/清单#1及修改记录：按更高优先级需求R8的17BD装配目标，风暴回旋仅在威能存在时扩许可剑/锤/斧，4段40%数值不变；无威能旧绑定/旧帧保持。预备aspects.json该威能增加weapons补丁，另补清单24变形威能的weapons限制元数据（其余36为空=不限）；此前草稿遗漏“限武器”列，正式R6schema、掉落与生效收集器须消费，不能对所有武器乱发无效变形。仅预备源已改，正式60仍未加载，不计完成。不要重跑旧r6-aspects.py覆盖这项已裁决数据。

- R4最终：可见实战掉落→拾取→回营→详情→装备→竖版Tip→刷新ok=true，旧实例全字段保留，比例主属性数值高33px；完整131文件1072通过/2原跳过。类型错误为独立R6测试参数类型，修复后tsc/content通过，保留原失败日志。版本0.11.7/26/ow-48/db15。模板元数据保留属于L8旧存档兼容自然延伸，不参与新公式/不重掷旧字段；回退只撤本批schema hunk。

- 独立接续21:50：R4可见gear player-path最新ok=true；旧失败result/failure来自此前指针和定位排查，不可当最终结论。最新全量包含benchmark4项与skill-patches17项均通过，types在修复旧测试错误字段后通过（保留error_before_repair），未删除失败测试。新的weapons参数补丁已由World证明：无补丁锤施放whirl被weapon拦截，有明确补丁后可以实际释放并命中；服务端正式兼容性与威能加载仍待R6接入。
- R7隐私约束：初始化私有潮印随机流时，不复用会下发到World/checkpoint的公开战斗随机种子/状态。应使用本场独立保存的私有种子或私有域派生流；多人每成员独立保存，重连不重新取种子。公共视图只下发已揭示选项/已选，不能因隐藏privateSeed字段却从公开world RNG仍可反推未来候选。

### R5裁决与在制

- 54造型套装的实例setId/setName不改写；当前ow-49按谱系×系列计18效果身份、最低造型阶段，旧6套与旧54规则适配器分别保留。旧已冻结战斗仍用冻结Stats，不重解析旧局。新版新掉落弓借千刃/剑势/决斗之一，不增谱系或模型；无独立造型阶段的旧弓按T1缩放，旧弓实例不追补身份。
- L4自然延伸currentCast：只给千刃每第3次施放的临时增弹作用当次，普通nextCast仍作用下一次；白名单projectiles扩至15，测试7弹叠加与预算，避免把三发+2+2截成5。统一套装百分比与新主属性同组相加一次；老套数值顺序不改。

- R5交叉状态实战发现：霜刃原生迟缓与寒蚀叠层曾共用同一player+kind组，导致提前冻结/消费别的规则状态。L5按player+kind+skill/rule来源隔离可叠层与转化组；旧单层/普通技能状态行为不变。补两次无冻结、第三次冻结的实际命中测试，回退只撤对应group筛选hunk。无新零件的规则列表继续使用原combos适配，R1旧Stats与帧不因重复rules字段改变。

- R5预备表两条4件×区误写成条件加算池：决斗对首领×1.15、雷鸣对感电×1.2，正式源改为有when的passive amplify规则独立相乘，并按声明scale随最低造型阶段放大；2件的对精英/受控仍在条件加算池。定向核对实际伤害，未沿用草稿错误口径。旧测试324发放/强化/刷新仍保留，当前ruleset的套装断言改为18身份2/4及余烬实际DOT参数，历史54适配测试仍逐条保留2/4/6。

- R5独立运行复核22:16：tests/build-variety-r5-review.test.ts三项通过（r5/lifesteal-review.log），实际命中生命回复证明狂骨4低HP倍率已由conditionalValue执行：T1低于30%为×2、超过阈值×1、T3低HP×2.5；并按命中实际伤害核对，非仅检查配置存在。World本批已修复原buffValue遗漏条件倍率，R6死神镰刀也可复用这一执行通道。
- 独立skill-patches的非法弹数负例从6改100：新版明确允许7弹叠加、上限15，6不应再被视为非法。仍检查超过安全上限报错，不是删测试或把7截成5。
- R5真实UI数据还有一处需收口：SetBonusTooltip当前只用统一表的T1 bonus.description，虽显示最低T3，数值仍如T1“翻倍/8%”；getEquippedSets只返回artStage无当前已解析加成。须从唯一服务端套装解析器返回可展示的当前倍率/数值（或明确基础数值及受scale的字段），不让UI复制成长公式。gearSetChanges目前在count/activeBonuses相同就return，忽略更换最低造型阶段T1→T3的加成改变；应纳入artStage差异并用服务端预览值显示。旧实例setId/name不用改写。

- 独立R5 UI修正22:29：gearSetChanges已把artStage计入相同判断；同样4件/同样激活2+4时换最低T1→T3或T3→T1显示正/负变化，不虚报新激活/失去。tests/build-variety-set-stage-ui.test.ts两项通过（r5/stage-preview-review.log）。阶段描述数值的bonusDescriptions已由主流程接到服务端/DTO/SetBonusTooltip，后续校验gearSetChanges激活/失去也应优先用对应before/after.bonusDescriptions（现静态fallback仍在），并在阶段单独变化时展示预览后的数值。
- 当前可见sets脚本正在验证，不并行重测试；该次最新全量133文件1102通过/2原跳过，types/content通过，运行版本0.11.8/26/ow-49/db15。UI后续变更须定向复验与最终构建保持源码稳定；已保存旧失败，不降低断言。

- R5独立UI收口22:37：gearSetChanges的激活使用after.bonusDescriptions，失去使用before.bonusDescriptions；阶段变化且档位仍激活时直接显示服务器预览描述，缺失则“当前数值尚未记录”，不拿T1值冒充、不复制缩放公式。tests/build-variety-set-stage-ui.test.ts现3项全部通过。该小改在sets-visible完成后进行，生产发布构建应包含当前版本；对应可见预览在后续统一全路径补验。

- R6独立铭纹模块22:46：contracts/inscriptions.ts、content/inscriptions.json/.ts、rules/inscriptions.ts已建，内容按清单6部位41条池，schema校验已知50原子/.5档、唯一池项；rollInscription新发放概率30%/100%，extractInscriptionRubbing20%保留原子+部位，imprintInscription仅同部位覆盖，collectInscriptionAtoms走统一去重。7项定向通过（r6/inscriptions-module.log）。未接GearSchema持久字段/真实drop factory/分解事务/拓片库存/拓印命令与UI，**不计R6完成**。inscriptionRubbings提供41个有限ID供库存内容登记，不能存未知字符串当完成；拓片不是任意部位通用碎片。
- 重铸语义按主文§3.4“每件只能锁定一条副属性反复重铸”：首次选择的重铸槽永久成为该件唯一可重铸槽，其余副属性保留；不是锁住一条后重掷全部其余词缀。新命令带目标槽及版本、防重；已锁定的目标不能换另一条。旧字段读取不补选、不重掷，旧已强化等级不补发节点。R6正式实现需覆盖此语义。

- R5发布存档基线异常：R4发布前267账号/148角色/1906回执与流水，而R5发布前当前库仅1/1/4/4。发现.runtime/backups/wipe-before-r5-20261006-222451.dump，尚无本聊天人类授权证据；已用异步问题核对是否用户授权清档。不恢复或删除正式库，隔离库恢复备份核验；代码R6–R8继续，旧存档验收暂不据新库少量行数勾选。R5功能/全量/可见4+2均通过，独立UI复核新增最低造型阶段及服务端描述预览需纳入同批并定向复验/最终构建。

- R6养成可达性还需收口：现gearMaxRank带ilvl传奇封顶12、普通5，+15节点配置本身不可达；正式R6须按新版规则让适用品质可达到15（不补发已越过节点，也不重写旧实例）。common品质词缀池count0/tiers[]，强化开条不能直接调用common整件掉落生成器得到空数组；节点须有单条池/容量配置。已满时只选可提升条，T3为清单最高档时须明示到顶或按§5.1记录升数值上限的替代规则，不能升出无schema的T4或记“开条完成”却没改任何值。

- R6单槽重铸独立模块23:01：packages/rules/single-affix-reroll.ts / tests/build-variety-single-reroll.test.ts 4项通过（r6/single-reroll-module.log）。rerollSingleAffix克隆输入，首次写rerollSlot索引，随后拒绝换槽；共享generateGearAffixes生成1条，排除其它槽/主属性，保留原槽ID、其它旧值、主属性、强化、铭纹。T1/T8同档成长属性按24倍率、固定旧速度3.7不重写。common已开条后单槽重铸使用一档池，common原整件发放仍无词缀。成本/版本/幂等/持久提交/UI未接，尚不计R6完成。
- 存档数量异常仍只暂停该验收项；本聊天未清档、未恢复或改写正式库，等待直接人类授权证据的核对，R6–R8其它条目持续。

- R5最终全量133文件1102通过/2原跳过，tsc/content退出0；独立收口后定向33项通过。真实弓4千刃+2决斗三次施放、3枚投射物/触发实机通过；正式0.11.8/26/ow-49/db15可见登录/营地/背包/刷新ok=true，正常新角色引导按UI跳过，未绕准入。archive隔离恢复四表与R4最后审计全部哈希一致，历史dump备份20MB留.runtime/backups，不纳入Git。新当前库基线保留auditpassed；清档人类授权问题仍未收到直接答复，不用沉默推定同意。

### R6裁决与在制

- L7自然延伸mechanics.targeting白名单：环刃参数允许无目标的self施放，仍由普通projectile通道执行。SkillMechanics正式声明6字段和charges；释放参数只由服务端解析。
- 预备“余烬之心”错误把所有dot纳入×区；正式改为filter.statusKinds=['burn']的独立passive amplify及DOT暴击flag，要求只烧伤而不使毒/流血/地面火区暴击，新增DamageContext.statusKind及EffectRule.filter.statusKinds带执行器。旧无新规则参数不变。
- 枭鳞/坍缩的crit/status/perCrowd/radiusRef、影杀echoOnConsume、血怒延长上限模式、远狙fraction、lastPart过滤、不屈surviveAtOne等属于L4/L6自然延伸，先schema再唯一动作执行器/测试，不删数据条目。当前不可提前勾选R6。
- 新追加状态budget原值由服务端按已计算的技能增长比例转换，不让客户端重算等级/装备成长；命中中毒半拆分仍保持，下一施放增益/回响的奇数预算还须统一精确处理。

### 独立R6接续（2026-10-07 00:46）

- 环刃真实闪现复核tests/build-variety-r6-review.test.ts：开启activationRadius=40的空间索引，实际throwing_knife环绕后blink从(10,10)到(18,10)，沿途(13,12.45)敌人原查询漏判（旧无索引地图全扫描会掩盖）。advanceOrbit候选范围已改为整段中点/半长+碰撞半径。
- 墙体先后顺序另外发现两个漏判：原代码遇墙直接return使墙前敌人也没中；又以新施法者位置lineOfSight筛掉原投射物先经过的目标。现在先把轨迹截到首个墙接触，再只判截断段接触，沿用terrainContact/segmentContact，不用施法者的新视线替代投射物路径。墙前目标命中、墙后目标不命中，环刃撞墙结束，正常返回/普通弹道未改。
- 4项真实释放/命中/空间索引/墙序对照全部通过，r6/orbit-sweep-review.log；三份原失败日志orbit-sweep-first.log、orbit-wall-first.log、orbit-wall-los-first.log保留。World仅改advanceOrbit这一函数，不覆盖共享的其它R6执行器。R6正式提交需含本复核测试与hunk；仍须可见表现、全量与旧档核对。
- R7预备augments.json当前已有正确赌徒alternate/setMods、轮转variants、星环field.orbit/projectiles参数，不能用旧草稿退化成静态crit0/同元素常驻来冒充。R7需先schema+执行器再加载90；不重复执行旧生成覆盖已修内容。原子来源描述若包含某套装2件加成（如狂骨描述攻击+10%），单授原子潮印不能照抄并谎称同时给该属性，需按实际原子语义显示。

- R6截至2026-10-07：74主用例+55旧构筑回归通过；真实PG掉落→铭纹→单槽重铸/换槽拒绝→15次强化→拓印费用和拓片消费→分解→命令重放12项通过。节点容量沿用现有上限common1/magic2/rare4/legendary6，不降低原2–4/4–6掉落数量；传奇rankCaps15、稀有12仅扩展后续成长，不改既有rank/roll，不补发越过节点。已满T3明示到顶，不捏造T4。
- 非伤害位移只在mechanismTags中补dash用于机制筛选；skillTags和既有伤害标签不改，R1四组完整参数和帧仍保持。焰心只对burn状态，毒/流血与无statusKind的火区不授暴击/×区。74实际用例覆盖充能/推进/跟随/环绕/返回/路径/不屈/影杀/血怒/静止减伤/动态移速。
- item-issuance新发放规则冻结在野外permit.private_data.itemRules与副本privateRules.itemRules，主属性/词缀/铭纹概率/威能候选用冻结参数；旧无此快照的局不补发铭纹，威能用旧154目录。制作按当下规则，拓片库存41公开有限ID，不把私有概率放入公开材料字典。R6仍须可见玩家路径、全量、构建、提交；R7/R8不停。

- 独立R6复核01:00：6项通过（r6/thorns-attribute-review.log）。余烬之心100次燃烧结算验证半暴击率及×1.2，200次毒/流血结算全部不暴/不附加倍率；无statusKind的地面火区也不暴。
- 荆甲原只改atom-thorns，未改稍后生成的stat-thorns：实际敌人发射并击中后，装备thorns副属性反弹不暴也不破甲。applyBuildParts现对新生成属性规则单独应用parts.overrides，组映射atom-thorns→stat-thorns；已改过的parts.rules不重复改写，保留属性反弹原值和原规则ID。实际远程攻击对照现在反弹armor×2（critChance=1/倍率2），并施加破甲，日志thorns-attribute-first.log保留原失败。R6正式暂存此build-parts hunk与review测试。
- 原子只授效果，勿把套装2件属性混进潮印文案；当前atom-bone/whirl-edge.description带攻击/移速套装文字，但实际atom.action没有这些常驻属性。R7单原子卡应按其实际原子触发/系数描述；R6接口/词条仍按实际parts，不能改执行器给多余属性掩盖文案错误。

- R6继承旧帧复验01:03：combat-collision13/vfx-v2旧19机制档案5/独立review6，共24项通过（r6/legacy-dash-review.log）；首轮全量中的rush落点与旧录像失败现已由当前landing中心实现恢复，不改/更新旧基线掩盖差异。首轮thorns失败是已修alias之前被worker缓存的源码，定向6全部通过；后续全量继续保留原失败。
- R6新发放过滤还需核对：freezeItemRules当前aspects仅存id/slots/requiredLevel，丢失newAspects.weapons；assignGearAspect也仅按slot/level选，因而限定暗器的环刃可能掉到弓/剑武器，且activeNewAspects又拒绝生效。新快照必须带weapons并在武器发放时按真实gearWeaponType过滤；旧缺该字段的冻结候选保持原行为，非武器部位允许后续切主手/刻印但生效时限制仍要核对。不是降低元素掉率的替代。
- R8准备quake已改为真实锤主手，技能whirl/ground_slam/cleave，核心风暴回旋条件解锁已实码支持；不再用Sword主手伪造Hammer4+Axe2。arrows核心aspect-build-split是旧accessory威能，R6目前全部legacy.dropEnabled=false，新角色无法再取得；须按§5.1给这一已定分裂箭流派保留可获取的旧版分裂箭候选/明确解锁入口（名称仍旧版、不增加60新威能数）或实现等效既定核心，并验证实际获取，不能仅手工把失效旧威能塞到17BD夹具。没有TFmulti条目可用来随便替换，不能假称同一核心效果。

- R6七项可见机制均ok=true（return/orbit/follow/path/advance/chain/charges），1280×720、realPG、目录装备及威能夹具、实际装备/激活/施放命令；不注入rules。下一份gear-path只约束私有传说/阶段样例，真实出货/拾取/重铸/15级强化全走命令。
- 2026-10-07 UI补齐：威能法典分组纳入inscriptions区块，重铸使用公共select/按钮/费用组件、首次明确选一条后永久只重铸此槽，价由GearTip.reforge供给。铭纹描述按服务端半档缩放输出，不在客户端计算成长。拓片公开字典独立于私有概率配置，避免从公开材料入口引入node:crypto或权重。

- 独立R6新发放修正01:14：freezeItemRules.aspects现在保存weapons；AspectIssueDefinition为可选限制以兼容旧快照；assignGearAspect仅对weapon槽按gearWeaponType过滤，非武器槽不按美术谱系硬限。4定向通过（r6/issuance-weapon-review.log）：冻结字段保留、7武器族各29次实际issueCombatGear全部合法、新传奇仍有铭纹、已有aspect不重掷、旧缺限制快照维持旧行为。只改deep-progression的候选过滤与item-issuance冻结字段。

- 独立R6获取复核01:19：5项全部通过（r6/issuance-weapon-review.log）。除新60威能外，仅为主文17BD既定分裂箭流派保留旧版aspect-build-split的传奇accessory获取候选，名称仍标旧版、原20%投射物类型加成不改，不把它计为第61个新威能。freezeItemRules保存60新+该旧候选；新旧混合池均匀选取，避免旧build威能2/3优先分支使唯一分裂箭占满新项链池，纯旧冻结候选仍保留原优先规则。测试以实际issueCombatGear获取、真实resolveBuild投射物加成证明可达，不手填失效威能。依据交接§2弓借套装、R8主文17流派及§5.1自然延伸；回退只撤旧split的dropEnabled及新旧混池优先判断，旧装备/旧冻结局不改。正式R6提交须包含content/deep-progression.ts、rules/item-issuance.ts、rules/deep-progression.ts和issuance-review测试。

- 独立R8装配器tools/build-variety-builds.ts/.json已建立17正式配置，全部通过轻量实际issuance→resolveBuild装配核对：六个真实目录底材/弓真实借套、4+2身份、核心实际发放、3关键属性、显式rank5、请求与解析技能相等。使用同L50/ilvl50/造型T1、5稀有3条+1传奇5条、T3词缀合法区间中值的受控授予，非自然掉率报告；不改公开配置/权重/旧数据。武器/衣服固定底材主属性保留，四随机主属性部位从正式主池选值。R6刚将许可拆到skill-weapon-access.ts，装配器已消费该真实适配器，锤旋风无核心仍禁止。tests/build-variety-builds.test.ts19项已写，当前r6-release重回归在跑，尚未定向运行；待结束后测试真实施放/命中、无核许可拒绝与非法主手拒绝。当前不含潮印、不计17BD平衡完成；R7接入后通过同冻结构筑规则加偏好潮印，再调用benchmark。

- 独立R8装配19项于01:37全部通过（r8/assembly-review.log）：17正式4+2实际施放/命中、非法主手拒绝和无核心锤旋风拒绝。仍未宣称17BD平衡通过。
- 独立R6资源修复：r6-release全量141文件1206通过/2原跳过、tsc通过，但content因41铭纹拓片未注册正式图标失败。tools/build-inscription-rubbings.mjs现从有限公开inscription-rubbings.json生成41独立矢量符记拓纸物品（256透明PNG、各原子独立大轮廓+部位印记），沿用既有ui-source→build_ui_v2管线，正式源和runtime manifest均已登记。未用一张材料底图代替全部拓片，也未跳过content校验。独立content现在退出0（r6/inscription-art/content.log），41哈希全唯一，透明边距/尺寸检查通过；contact-sheet已人工查看。正式R6须纳入tools/build-inscription-rubbings.mjs、assets/ui-source/v2/inscription-rubbings/全部源与PNG、ui-source.json本批41条hunk、packages/asset-manifest/ui.v2.json相应41条hunk、apps/web/public/art/ui-v2/inscription-rubbings/和r6/inscription-art证据。生产build_ui_v2会重新生成同样runtime目录，不改既有物品资源。

- 独立R7候选复核01:42：reroll原先在新池数量≥3、但唯一匹配/通用选项刚好位于旧组时抛No option can match this build。按L9至少一张适用选项要求，优先全换新；若所有新选项都不适用，只保留已揭示的那张适用卡，另两张仍从新池抽，不暗造新候选/不改档位/不额外耗次数。offer-applicability-first.log保留失败，augment-offers现7项全部通过（r7/offer-applicability-review.log）。这是同L9自然延伸，不需推翻已定决策；回退仅offerAugments的preferred选择分支。正式R7必须接入DungeonService私有冻结状态与真实命令后再计可用。

- 独立R8轻量预检153样本已完成（tools/measure-build-variety-preflight.ts；r8/preflight/result.json/summary.md；preflight.log）。17真实装配×清怪/单体/生存×种子41/73/107，请求/实际技能完整一致，无零施放/零伤害/未清场失败；没有补血回蓝、重置目标、复活或剔除失败。使用声明的L50怪物模板＋独立档位＋难度倍率，在相同三个受控场景下比较；非现行副本通关报告，尚无潮印，balanceAcceptance明确false。需正式R7后再测，而不是依据这份预检改R6数值。明显检查点：流血/轮转单体约4倍中位，回响/游击约0.36/0.40，环刃清场约0.25，燃烧/碎冰/引力清场约2倍；两个生存流派在60秒截尾，不能把下限60秒当真实死亡时间。最终平衡需要更长或更高压力的公共生存场景获得可解释的非截尾数据，以及合法已选潮印的冻结构筑。全部24关键源前后指纹一致，无盲删异常样本。

- 独立R6铭纹文案复核01:53：原50原子中8条description误带整套2件属性或另一个4件原子的效果（bone/bleed/time-sand/bulwark/drinking/evasion/whirl-edge/suppress），独立铭纹/银金原子会虚报攻击、吸血、移速或震慑。现只修正式effect-atoms.json这8条文案，不改触发/动作/系数/旧战斗行为；套装2件及附属条件仍由自己的真实parts描述。scaledDescription同时修护盾armor×2的半档显示×1（不是×2），按完整原数字token一次替换，避免10%→20%再被另一路缩成40%或4%误改24%。tests/build-variety-effect-descriptions.test.ts5+R5真实吸血3共8通过（r6/inscription-description-review.log），半档骨/割裂/镇压/荆壁/饮血/旋锋/专注及套装2/4分项均覆盖。正式R6还须暂存packages/content/effect-atoms.json这8文案hunk、rules/set-bonus-descriptions.ts token函数和新测试。R7预备augments.json对应无额外set的单原子卡已更新基准文案，但档位数字仍须正式R7由唯一服务端scaledDescription输出实际值，不能卡上同时写1.6档却仍显示基础4%。

- 独立R7草稿schema审计01:58：90条原稿先只有85条可解析。statOverrides/statMultipliers错误使用Zod枚举record，要求65全部字段而非稀疏指定；已改partialRecord，零暴击override保留、只减半HP不要求别的64属性，未知ID/负倍率/NaN仍拒绝，2测试通过（r7/sparse-stats-review.log）。这一通道需要正式R7唯一服务端执行器，不能仅schema通过算完成。不朽草稿flags.reviveRatio无执行器，现改用已存在的immortal guardian通道+mods.reviveRatio=.5/maxTriggers1，未新增未知flag。草稿审计现在87/90通过，剩3条恰为赌徒alternate/setMods、元素轮转variants、星环field.orbit/projectiles，必须新schema/唯一执行器/实际测试后才能加载90，不能降格代替。当前draft-schema-audit.json明确formalRuntime=false。

- R6最终：141文件1206通过/2原跳过、tsc0、内容补41图后通过、七机制+gear-path+imprint-path可见全部ok，正式0.11.9/27/ow-50/v23/db15登录与存档审计ok。预存未跟踪weapon-skills/skill-tags不纳入本批，以新的skill-weapon-access/skill-mechanism-tags适配器接本批能力，基础文件保持原内容。暂存仅本批新模块/素材和共享文件own hunk；Claude M1世界/任务xlsx、精英/营地/悬赏/层级/传送等仍工作区未混入。

- 独立R8结果审计tools/build-variety-results.ts与5项测试通过（r8/result-audit-review.log）：必须17流派×3声明场景×全部种子，缺少/重复/未声明/无施放或伤害/失败样本不静默略过；焦点指标落带并且非截尾才可接受；并列第三全部计入前三，不能靠数组顺序掩盖三个指标均领先的流派。preflight工具已改为调用此唯一统计审计器，修改后的工具尚未重跑，既有153数据仍是此前稳定源点，不冒称当前正式平衡。R8最终接正式潮印后需要消费此审计或等价全部约束。

- 独立R8面板复核02:08：damage-breakdown-model.ts现在只把pool=cond的伤害放进条件增伤，低HP生命偷取×2和静止防御不再误显示成伤害×2。独立乘区包含已解析passive amplify规则（如半档嗜血×1.125），不仅Stats.zones；狂骨按实际每层系数+2%和失血层数限制展示，不假算成多次×1.02。余烬之心明确“作用于燃烧伤害”，不宣称全部技能；元素/伤害类别/指定技能约束保留，暴击/倍率最多四位小数避免1.125变1.13。9项通过（r8/pool-display-review.log），仍是只读公共组件，未接CharacterPanel/正式World统计的玩家路径，不计R8面板验收完成。

- 独立R8技能显示继续收口：DamageBreakdown不再把zone.per_tick的4显示为瘴气整次预算，明确每段/共5段与额外zone毒6；hit毒标明已含在总量，火箭30另显示附加燃烧9，不在UI重复成长或粗算刷新DOT总和。当前新第10项待正式R7源码稳定后运行，已有9项通过仍保留。
- R8定位工具measure-build-variety-r8-skill-options.ts已改为真实同族主手（暗影之握/石化=wand，火/毒箭=bow），显式rank1后核对唯一请求/解析/执行技能，不再靠无主手的历史兼容通道测量；维持同武器组内相同真实攻击/控制生命灵力预算，不改正式技能。0施放/0命中/0输出直接拒绝发表，来源指纹纳入测量工具本身与武器许可。尚未重跑216正式版本样本，旧skill-options.json/.md仍是ow-47历史点，R8最终必须在稳定新版本重跑后更新报告，不用旧绝对DPS当当前结论。

- 独立R7执行复核02:18：tests/build-variety-r7-review.test.ts4+R8面板10共14通过（r7/field-semantics-review.log，原3失败field-semantics-first.log保留）。星环使用既有环绕投射物执行器，但原生成的rule-id Skill被hitSkill误当direct，critChance1/lifesteal1时80预算会暴击并吸血。hitSkill现仅对“s.id=当前ruleId且非正式技能”标derived，原注册飞刀/返回箭等仍direct；真实星环三颗每触点80、无direct暴击/吸血，角度/接触间隔完整checkpoint恢复20帧一致。只改hitSkill这一识别hunk，不覆盖主流程新增3字段执行器。
- 对应共享schema补拒绝会被执行器忽略的组合：普通field不能写projectiles；orbit必须self且不能混pull/zone statuses；buff不能同时alternate和variants；setMods绝对属性必须在每一阶段显式有值，0值合法。正式90数据仍完整加载，未删除/降低数量。R7须暂存contracts/effects.ts这段superRefine、simulation/index.ts generatedEffect分类hunk、tests/build-variety-r7-review.test.ts，及其定向证据。R8每段/火毒预算新第10项现在通过。

- 独立R7冻结属性复核02:31：侵蚀砧原先只增加Stats中5个chance，旧入场rules不重建，因而“面板+20%”却实际不施状态。已将原applyBuildParts的9类属性触发与条件池生成移至唯一packages/rules/attribute-effects.ts，装备/养成及局内重建共用。其冻结配置保存属性定义/默认/上限/条件、9规则模板与数值到字段单位（如秒×30），而非再写第二套状态公式。frozen-augment-build保存该配置与setStages，重建以新Stats重新生成状态/击杀资源/荆棘规则，保留原威能overrides含atom-thorns→stat-thorns，不重复原子规则；stat条件同步更新。
- applyStatBonuses增加可选冻结登记表参数，默认原表不变；Frozen重建的上限/默认/部位造型阶段均读私有入场快照，不再查当前全局表。4定向实际状态/去重/源码变更冻结/击杀单位测试+R1旧参数55/R4真实属性7/R6环刃与荆棘6，共72通过（r7/frozen-attributes-review.log）。直接World命中验证了新授burn/slow/shock/poison/bleed，非只看数值存在。正式R7须含attribute-effects.ts、build-parts.ts的抽取hunk、simulation/set-calculator.ts可选登记表hunk、frozen-augment-build.ts新增快照/规则重建及frozen-attributes测试。
- 冻结复核剩余具体点：applySkillPatches仍从全局skillCatalog取category，R7冻结basis.categories已有旧值，需让同一补丁器接受冻结分类供参数标签推导，避免旧局选潮印时读新分类。单技能豪赌的slot0 damage×3目前只改Skill.damage，原额外燃烧预算未跟着变，需明确整技能输出预算语义并在同一补丁器支持/测试，不能UI称所有伤害×3却只放大直伤；旧hit毒仍必须按floor总量/2保持已定口径。副本真实事务/90逐条作用/全场重连、17BD正式带潮印模拟仍由主流程继续，不因这些准备与定向提前勾选R7/R8。

- 独立R7技能冻结/完整预算收口02:39：applySkillPatches可接冻结category，frozen-augment-build使用basis.categories；World通过同一skill-mechanism-tags模块的resolvedSkillTags/resolvedMechanismTags消费已解析tags，只有旧未带tags快照走原推导，普通伤害标签及非伤害dash扩展保留。实际把当前cut分类改为control，旧冻结构筑仍一致且真实melee筛选命中回复5灵力。
- L7自然延伸scalePeriodicBudget显式布尔选项：仅整技能伤害补丁选择启用，原R6 damage字段补丁默认行为不改；在唯一补丁器按该补丁的damage比率放大burn/bleed/zone毒预算，hit毒仍最终floor总量/2。单技能豪赌slot0声明该选项，火球直伤与附加燃烧均×3；火箭90+燃烧27、毒箭84含毒42、瘴气每段12+额外毒18验证，拒绝无damage操作的无效flag。6冻结属性/技能+18补丁+R1旧55+R7真实星环4共83通过（r7/frozen-skills-review.log）。R7提交须含contracts/skill-patches.ts、rules/skill-patches.ts、contracts/build-sources.ts slotPatches字段、content/augments.json单技能flag、content/skill-mechanism-tags.ts新只读标签入口、simulation/index.ts标签消费及对应测试；不扩R6既有补丁默认数值。

- 独立R7候选/卡片冻结收口02:49：frozenAugmentContext使用已解析技能标签及入场主属性/类型池标签；原DungeonService直接mechanismTags(skill)在缺category的已解析cut上误推spell。ensureAugmentOffers及reroll现在共用冻结上下文，已选全套共鸣只将18新身份的已激活2件视4，一件不提升，旧6身份不伪造。basis本身不写改。
- augmentDescription只对普通纯原子卡按入场冻结原子+最高档解析描述，金狂骨实际+6.4%、金旋锋实际+24%，特殊套装共鸣/覆盖卡保留清单自己的说明，不把maxStacks8等覆盖错误描述为基础5。DungeonService.publicMember消费此唯一只读描述，不将私有基线或原子目录下发。8冻结复核+正式R7的90条参数编译/5实际轮转与替换共103通过（r7/frozen-context-review.log）。真实PG事务与浏览器完整副本尚未验，不能凭95参数测试勾选R7。R7须纳入新增rules/augment-descriptions.ts、frozen-augment-build.ts末尾context helper、DungeonService这三处调用及新增两个测试。

- 独立R7当前全树tsc --noEmit于02:50通过（r7/independent-types.log空日志、退出0）。首次是新测试误用不在category枚举的magic，已改为合法control保持“当前分类变成非近战”的同一验证意图，原错误日志independent-types-before-repair.log保留，未删除该用例。Frozen相关6→8的定向最新103通过，R7正式最终回归/真实DB/发布仍待主流程，不能将这次tsc替代完整回归。

- 独立R7阶段边界在制03:xx：DungeonService.nextStage只复制hero/cooldowns/slow，导致effectStats/触发次数、comboCounts、selfBuffs、skillCharges被新World重置，不朽maxTriggers1变成每段一次。已增World.carryPlayerRunState，使用既有heroFields作为唯一状态字段源保留局内计数/规则冷却/自身增益/充能/战斗时钟与模式；地图导航、旧场景pending/echo/旧目标留在旧checkpoint，新位置/anchor不串图，不补血回蓝/复活。API.nextStage调用，序号通过carryStageIdentifiers保留以防跨段castId撞旧动画。
- tests/build-variety-stage-continuity.test.ts两项已写（真实充能与模式/自身状态checkpoint、已消费不朽换段后第二次致命必死）；当前可见R7重试进程9372仍在跑，尚未运行该新测试，禁止并行重任务。待它结束先运行该两项+R7review4/R1旧55，再全树tsc；若失败修真实原因保留日志。还需realPG跨阶段例验证next命令确实消费此入口，不能只用World单元代替API。
- R7另外明确未完的配置点：content/dungeons.ts目前在return按d.story硬关潮印，顶层augments统一3轮，schema不接受profile/definition.policy.augments覆盖；API.create冻结的是全局dungeonAugmentPolicy，尚未按每副本次数解析。设计要求默认→模板→逐副本覆盖、世界IV以上额外首领HP50%一次；当前ensureAugmentOffers把round>=2都当boss前，第四次会提前，尚无IV配置。需声明配置及唯一机会判定/冻结私有policy/实际PG与可见验证，不能称完成。权重未来种子仍私有；不得借此改变旧已开战无潮印的副本。

- 独立R7换段定向03:17已通过：stage-continuity2/R7review4/R1旧55共61（r7/stage-continuity-review.log）。实际已消费的不朽经过新stage Actor创建后再受致命伤，生命归0且不二次revive；真实blink充能deadline/自身buff/规则计数/手动设置的模式保留，新地图位置/anchor与导航正确，checkpoint序列化恢复一致。仍需API真实next命令与最终回归，不把单元当PG。新方法carryPlayerRunState/carryStageIdentifiers已由nextStage调用。

- 独立R7配置修复03:23：dungeons.json defaults明确enabled/choices/rerolls/roundCount，命名augments-disabled profile挂到当前剧情定义；dungeons.ts公共默认→profile→definition.policy深合并支持每副本次数/换组覆盖，去掉d.story硬关，声明支持的story覆盖可显式重新开启。顶层主开关关闭仍禁选，非法轮数明确拒绝。新增augmentExtra声明世界IV起、bossHpRatio=.5、金70/棱彩30；resolveRunAugmentPolicy生成并冻结本副本实际轮数/换组与额外轮私有权重。API.create按activeWorldTier（现有权威解锁函数）解析，instance公开roundCount反映实际3/4；未把权重/私有seed下发。
- ensureAugmentOffers第四轮仅限冻结extra存在、最后阶段且存活boss≤50%HP，不再round>=2都在boss前。旧已开战无augmentPolicy不追补。4新配置/世界IV单元+旧dungeon-content3共7通过（r7/dungeon-policy-review.log）；尚须realPG世界IV阈值/逐副本1或2轮写链路及完整最终回归。新增Root基线.r7-policy-extra包含dungeons.ts/json/contracts/dungeon-service本次之前的字节以便只暂存这批差异，不覆盖主R7字段。

- 独立R7实际PG复验03:30全部3通过（r7/policy-pg-review/tests.log/result.json）：原私有候选/重放/真实重启恢复、逐副本1轮/2次换组覆盖实际create/start/choose/持久私有policy、主流程追加的真实next命令跨段已选构筑与累计规则计数保持。944源前后SHA一致，临时PG清理完成；未mock DB/未改正式库。该PG源点包含World.carryPlayerRunState/Identifier与解析配置。还须世界IV阈值PG与完整最终回归；R7可见player-path最新ok=true，完整3轮/重连/结算已通过，是否包含后续配置需最终发布复核。

- 2026-10-07 主流程R7可见完整地城通过；初次恢复期间准备点击被输入门槛拦截、检查点遗漏ready两次脚本失败均修真实玩家流程，未改按钮准入规则或注入击杀/时间/奖励。Escape潮印显式延后当前offer，下一帧不再强制弹回，可通过HUD重新打开。

- 世界IV实际内容边界：当前world-tiers.json正式只I–III，文档numeric-flow§8将IV列为L50+六岛裂星潮首领后的M4终局起点，并非当前可选层级。额外第四轮已是可执行规则，不能假称当前账号能选IV。准备.r7-iv-test.draft：只在真实PG隔离测试进程声明IV目录夹具，实际activeWorldTier→create私有4轮→正常选择前三→真实auto伤害到boss50%才出现第四，同档/非死亡阈值验证；不改正式世界倍率或解锁，不把受控IV当自然解锁验收。当前r7全量仍跑，待结束添加此草稿与QA单boss声明，再串行PG。若最终范围要求IV本身上线，必须依据M4终局怪物/解锁表独立落地与测量，不能凭本单元传4勾选。
- R8带潮印校准驱动已准备.runtime/build-variety-work/measure-r8-augmented.ts.draft：真实assembleBuildVariety→freezeAugmentBasis→rebuildFrozenAugmentBuild；一个明确受控偏好潮印，requires4校验，Solo只能1技能时按已声明loadoutLimit核对执行，不默默过滤。不是三轮自然抽样；正式17带潮印平衡仍未执行，不计完成。

- IV PG夹具前两次失败保留：首次单boss没有中段敌人，无法自然取得前两轮，已改真实meadow→boss两段；第二次WS初始loading帧暂无augments读空已加待同步保护；第三次next响应在新World首tick前没有第三轮，已等待真实stage1/offered3再选，不改服务器机会判定/按钮准入。尚未通过阈值验证，待串行复测。

- IV真实PG阶段同步再收口：iv-pg-stage-ready 4用例全部实际通过，但sourceStable=false（期间添加诊断等待），不能当最后稳定证据。随后pg-choice-synchronized有一次第三选择后仍3张，源因为HTTP选择回复与WS旧offer帧不同步，未逐个确认选择status/已选数量。当前IV测试已对三次HTTP各确认200、等待WS已选1/2/3，切manual后等待World实际mode确认，next后等待stage1真正第三轮且已选2，不改游戏状态或削弱50%断言。等待当前build-open-world进程31784结束，重跑该文件4个真实PG用例保存新目录稳定源证据；若随机候选造成瞬时boss终结，调整声明QA敌人倍率而不夹造半血。
- 当前精确下一步补充：R7首次全量1359/1旧手动剧情失败已通过显式手动施放修复；r7-final 1360/1新IV WS空帧/不同步失败均保留。稳定IV4通过后主流程发布+可见登录/own提交，R8连续。Root尚未运行带偏好潮印17校准草稿，也未运行更新后的216真实主手定位。R8组件/assembler/audit皆在工作区，不提前计平衡或正式人物面板完成。

- 2026-10-07：核对主文§7.5后纠正了模型参数误读，模块L9不是等级9；地城墙用DPS×1.25/EHP×1.10，标准人原始实测不预加潮印系数。未改变已确认平均收益或跨阶段钥匙裁决。

- 独立R7稳定IV最终03:55：iv-pg-synchronized-final的4真实PG全通过，946文件前后SHA a3a5ece9一致，cleanup完成。三个正常路径与IV实际auto伤害跨50%/同档第四轮均通过；此前初始/换段/选择WS同步失败完整保留，未更改服务器逻辑放宽。R7已4a3da76，正式0.11.10/28/ow-51/v23/db15可见登录/营地ok；该最终稳定PG证据在提交后产生，可纳入R8/最终证据提交。

- 独立R8首个带偏好潮印校准153已完成（tools/measure-build-variety.ts；augmented-calibration/result.json/summary.md，源码29项前后一致）。多数不在全17中位的0.8–1.25带，两个生存仍截尾，balanceAcceptance明确false；不是自然三轮候选模拟。Solo已声明loadoutLimit1后逐个请求/执行匹配，并保留entryRequested3，没偷偷过滤。回响/游击低、流血/开场过高，旋风/毒/感电/箭雨清怪等部分在带，尚不计完成。
- 独立R8环刃自动接近修复04:01：autoMotion原把所有projectile停在7格，环刃真实半径更小，自动会放出来却不接近。新增World.autoAttackStopRange只对主伤害技能的orbit取实际radius-.4，普通弹道/旧近战维持原分支；退避评分与追击同入口。450帧真实全自动向静止远靶接近并环刃命中，7相关测试通过（r8/orbit-auto-review.log）；初4失败orbit-auto-first保留。主流程同期把环刃唯一半径调2.5→3.5，原R6扫掠夹具Y坐标写死2.45导致提前接触/墙不交；现在按实际radius-.05放靶、墙按同差值移动，原“闪现前不命中/墙前命中/墙后阻挡”全部断言保留，并非更新HP基线掩盖碰撞。新AI测试读取实际范围，不把平衡后的3.5误当旧2.5。R8须含World本入口/两调用、R6review几何参数化、新orbit-auto测试；.runtime/r8-orbit-ai保存此次前World基线。

- 独立R8属性倍率冻结04:15：新共用applySourceStatMultipliers原使用当前numericStat默认值，会让旧局缺critMultiplier字段时跟着新版默认变。此唯一倍率函数新增可选definitions（常驻默认仍当前登记表）；FrozenBuilder传basis.attributeEffects.stats，未知ID仍拒绝、正HP/mana/speed要求保持。9冻结用例通过（r8/frozen-source-default-review.log），实际把当前critMultiplier默认1.5改4，旧冻结倍率仍得到3，而非8。R8纳入source-stat-multipliers.ts该参数与frozen-augment-build调用、新第9测试，不新建第二套倍率算术。

- 独立R8测量诊断04:19：sampleCombatBuild新增damageBySkill，逐真实hit_resolved按skill及direct/periodic/derived记录伤害与命中数；保持旧分类总量，不改变World/奖励/AI/样本筛选。4 benchmark测试通过（r8/skill-damage-accounting.log），各技能分项合计严格等于总伤害；后续调独有零件可以核对是谁实际造成输出，避免只看总体DPS误调。parent新增的统一pressure/initialTargets/HP比例字段完整保留，未覆盖其计量逻辑。

- 独立R8定位当前234样本完成（13方案×2模板×3档位×3种子；skill-options-current.log及skill-options.json/.md）。真实wand/bow主手、rank1、16依赖含工具前后一致；保存old ow47 json/md。当前火箭CD120/直30+额外燃9对毒箭28含毒/CD70无甲−9.2%、有甲+4.3%，所有18配对模板档位差均在10%内；额外加入历史CD60反事实，显示+70%/+103%。暗影11/30仍正式值，提供11/90或18/60等真实控制/伤害测量最终交用户决定，未替其改变定位；更多方案保留完整数据。此报告不冒充17BD平衡，若后续技能/许可执行器再变应重测。

- R8多窗口诊断计量同步：parent现将单体分90/50/20%初始HP三独立窗口，已汇总总伤害/施法；新增damageBySkill与rule counters也要三窗口合计，不能从trials[0]继承后配总量。measure-build-variety.ts已同样汇总新分项和规则count/damage，保留每个trials完整原始记录；不改DPS/焦点带/压力/参数。最终pnpm balance --strict须在当前源复跑，旧final-balance仅为之前源点。

- 2026-10-07 R8完整回归r8-release已绿：153文件1368通过/2既有跳过，types/content退出0。7个旧参数断言的初次失败保留，R1只改未装配新火箭预览CD，四旧角色/装备/解析stats/实际装备技能与300帧trace的SHA前后完全一致；R5按登记千刃参数改为1,1,2与六箭，预算守恒断言保留；R6根据实际声明半径验圆轨道，不改命中/间隔/跟随断言。参数回归4文件162项通过且源稳定。最终发布和可见R8伤害面板/全副本正在串行，禁止并行重任务。

- 2026-10-07 R8整合可见路径最终ok=true；单次同角色覆盖新技能野外实际击杀/受控私有发放池下真实新装备领取穿戴/三轮潮印/同档换组/人物冻结构筑与真实非零统计/刷新重连/跨段/首领结算返城。脚本先前错把人物入口找成系统栏、在营地点隐藏模式、200ms等待重复点击、换段已经自动模式且胜利后重复点模式，全部通过真实UI状态等待修复，失败记录保留；没有改服务器输入门槛或伪造击杀/奖励/统计。

- 独立R8当前严格平衡复跑通过（r8/final-balance-verified/result.json、balance-verified.log）：255真实独立战斗、153场景/种子组合，accepted=true，outsideBand/dominatesAllThree/failures均空；38依赖含工具/补丁/分类/属性倍率源前后相同。新增三窗口damageBySkill各项严格和totalDamage相等（所有153记录 accounting=true），规则count/damage亦汇总；无修改评分或略过样本。当前所有焦点指标落0.8–1.25且生存无截尾，统一压力条件明确不是正式地城TTD/自然随机抽样。最新R8整合可见玩家路径ok=true；完整153文件1368通过/2既有跳过、tsc/content绿见r8-release。最终health/content与当前client0.11.11/protocol28/ow52/assetsv23/db15及own提交仍由主流程完成，旧正式存档保留验收仍只该§5项。

- R8提交6e31100后最终证据同步：最终报告填入实际SHA与234技能定位样本，链接当前strict final-balance-verified；health/content于本聊天再次实读一致0.11.11/28/ow52/v23/db15，正式live.result ok=true。所有独立完成项通过；旧存档授权§5单项维持未勾选，未覆盖当前正式库。

- 2026-10-07 最终文档校正：页首R8提交统一6e31100，当前技能定位样本234；旧存档四表采用隔离恢复结果267/148/1910/1910。RS期间旧接续步骤明确标为历史，不作为当前待办。最终回归附录逐文件标明通过，保留2项既有跳过。当前唯一剩余项仍为旧正式存档§5授权与处置，不重复实现或测试。

- 2026-10-07 本会话直接人类授权结案核对：原dump 20,291,485字节，SHA-256 b7883ad748596ea93e8000fe4e101a6cd67d6f7ad3e5ed710dd99fa1241fda6e，与archive/result.json一致。该工具finally已停止并删除历史隔离恢复副本，cleanup.bytes_after=0；本次未重建副本、未写入正式库，当前其它活动QA库保留。§7旧正式存档项按用户指定267/148/1910/1910及四表哈希一致口径勾选，全部完成。

### 最新状态：用户授权清档确认后的结案（2026-10-07）

本条覆盖此前过程记录中的“授权待核/旧存档硬阻塞”状态：用户已直接确认授权，当前正式库保持清档后状态，流派handoff §7按替代验收全项完成，无硬阻塞。新角色完整路径和已有角色服务重启/构建一致性已有通过证据；今日正式库两次只读快照4账号/4角色/228回执/228流水数量/SHA一致，未写库。历史隔离恢复副本已清理，20,291,485字节原dump与原SHA一致并保留。其它活动M1 QA实例不属于恢复副本，保留。见build-variety-save-acceptance-20261007.md/json。
