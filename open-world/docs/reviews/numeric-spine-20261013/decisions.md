# 数值主干裁决

| 时间（北京时间） | 问题 | 裁决 | 影响文件 |
|---|---|---|---|
| 2026-10-13 | 用户给出相对路径在外层目录不存在 | 工程位于 abyss-walker-rewrite/open-world，以交接正文的绝对路径为准 | 全部本期文件 |
| 2026-10-13 | 所有分支无 pacing-identity: 提交，三期C7未完成 | 符合第7节硬阻塞6。不得代提交三期或把工作树ow-70当作提交完成。先做只读盘点、诊断、独立计算代码和基线回归；正式Excel改写、冻结锚点及内容推导待前置完成 | S0/prerequisites.json、progress.md |
| 2026-10-13 | Excel当前有其他会话未提交的三期旋钮变更 | 保留原文件，先生成本期目标草稿；不把二进制整文件暂存，避免夹入三期内容 | config/excel/节奏目标.xlsx、S0/spine-targets-draft.json |
| 2026-10-13 | 缺野外/危险度目标，旧模型版本过期 | 按第6节默认裁决等待S2当前标准人实测，不从旧模型复制，不虚构缺失值 | targets-conflicts.md |
| 2026-10-13 | 技能角色判定及宿主缺失 | 冷却帧除30，按≤1/≤6/≤20/>20秒分组，无伤害功能；宿主优先共享技能/武器族，其次技能标签，无匹配用该武器标准人 | census.md、S0/hosts.md |
| 2026-10-13 | 全量状态输出超过Node默认缓冲区 | 缩小git状态范围到数值源和配置，显式使用UTF-8路径与16MiB缓冲；不扫描素材和其他评审附件 | tools/spine/preflight.ts |
| 2026-10-13 | 前置未提交时执行全量测试 | 仅作当前工作树基线，存入S8/precondition-baseline；不冒充S8最终回归，不消耗V1–V3数值验证额度 | progress.md、S8/precondition-baseline |
| 2026-10-14 00:07 | 阶段目标字段名没有分钟/目标后缀 | 核对flow.json首行及原§3后，按push=开荒目标、farm=爽刷目标精确取24阶段48行；旧模型派生战斗量不导入目标 | S0/spine-targets-draft.json、tools/spine/preflight.ts |
| 2026-10-14 00:07 | 防止恢复时重跑preflight覆盖初始数值快照 | 发现workspace-baseline.json即拒绝重建；目标草稿可单独用--targets-draft更新，不动初始快照 | tools/spine/preflight.ts |
| 2026-10-14 00:07 | 硬阻塞下可以安全前置的实现 | 纯公式/冲突检测/apply防护层不依赖数值锚点，继续实现并定向验收；不添加空实现CLI、不用数学预测冒充World实测 | tools/spine/math.ts、targets.ts、apply.ts |
| 2026-10-14 | 宿主查找不能只看技能patch，避免带过滤条件的内容误落到不触发的标准人 | 同时读取已声明规则和原子引用的filter.skills/filter.tags，再按共享技能/武器族匹配；仍无匹配才用标准人 | tools/spine/preflight.ts、S0/hosts.md |
| 2026-10-14 | 诊断中的基础属性消融没有移除强制暴击或条件增伤规则 | 将“去暴击/去满血增伤”精确标为“基础暴击率置0/基础满血增伤置0”，保留实测数值，不能按全部来源消融解释 | tools/spine/diagnose.ts、S0/diagnosis.json |
| 2026-10-14 00:36 | 全量基线4项失败均为python3启动错误 | 根因为WindowsApps商店别名。保持3个原测试字节一致，在自有临时目录提供真实python3解释器副本并用真实临时PG复跑，4项全部通过；不改变测试或断言，不覆盖旧评审输出 | S8/python-retry、tools/spine/retry-python-tests.mjs |
| 2026-10-14 00:36 | 主工程tsc返回后台会话后，未先确认退出就启动工具tsc | 这是串行调度错误，不能声称全程严格无重叠。随后已等待主检查退出0，工具修正后单独退出0；后续重任务必须看到退出结果才能启动下一项。数据库/战斗/构建任务没有并行 | S8/types.log、S8/spine-types.log |
| 2026-10-14 | vsHealthy在构筑解析时已编译为conditional，改解析后的属性不能完成消融 | 保留原诊断到diagnosis-before-source-fix.json并标为无效的该行；改为在受控装备词缀/主属性来源置0后重新resolveBuild，重跑同一14组单种子诊断。其他条件增伤规则保留，名称改为“装备满血词缀置0” | tools/spine/diagnose.ts、S0/diagnosis.json |
| 2026-10-14 | 正式构建中的python3同样命中商店别名 | 只对子进程提供自有临时解释器路径，不改系统设置；构建仍由原build-isolated.mjs执行，并清理解释器副本 | tools/spine/with-python.mjs、S8/precondition-build |
| 2026-10-14 | 三期提交从952a151更新为c210635，随后e63b574移出旧原始数据 | 按当前祖先提交c210635核验，硬阻塞6解除。数值内容哈希无外部漂移；保留原S0快照，不重做旧基线全量回归 | S0/resume-check.json、progress.md |
| 2026-10-14 | 新增原始数据不入库规则 | 原测量仅本地保留；移出跟踪本期剩余超限及明细文件。提交仅结论、汇总、限额内日志，并在提交前强制校验200KB/2000行和留档新增30000行上限；报告记录本地路径、sha256、提交、命令和种子 | tools/spine/review-policy.py、stage-own.py、S0/local-raw-summary.json |
| 2026-10-14 | 原Excel页样式/批注要求零差异 | 沿用三期OOXML增量方式，仅新增主干目标页和三个目录元数据成员，原页/样式/批注成员字节完全保留。已导出132条目标并通过7本配置一致性检查 | tools/spine/workbook.py、S0/workbook-preservation.json |
| 2026-10-14 | S1按原1e9木桩实测L50标准人D1窗口耗尽，D1被截断为33333333.33 | 按第0节3条“符合用户目标”优先：只扩大测量台木桩至1e15，正式怪物不变，不重置目标，不补资源。完整30秒D1实测42576883.3。此为对M2字面生命值的明确修订，不冒充原口径无耗尽 | tools/spine/bench.ts、S1/pilot.json（本地） |
| 2026-10-14 | S1标准人固定rL、120秒后生命无净损失，原EHP式为无穷，无法作为有限弹性输入 | 按非锁定测量口径自行裁决：EHP统一取“累计实际原始输入＋末态剩余生命×原始输入/仅护甲处理的输入”，表示120秒有限窗口防护容量；死亡时仍等于死亡前原始输入。逐行保留原式literalEHP和删失标志，不用1点损失兜底。此为M2口径修订，后续所有测量/映射/校验统一使用，用户目标/权重不变 | tools/spine/bench.ts、后续来源权重及报告 |
| 2026-10-14 | AV未规定参考攻击者输出，直接复用EHP压力会在60秒前杀死先手，无法完整观察路线 | AV固定输入秒伤=同级标准人生命/240，完整60秒最多输入标准人25%生命；所有同级构筑一致，潜在伤害不随控制减少，实际伤害仍执行真实投射物/预警/护盾/格挡 | tools/spine/bench.ts |
| 2026-10-14 | “一次施法或一帧变化”未明确扰动方式 | 定时量化检查采用单次施法延后1帧和对应时间偏移；完整删除一次技能另属消融，不作为时钟精度测试。每次施法和每帧占总伤害比例也保留，先手B3单次78.02%的爆发集中度不隐去 | tools/spine/bench.ts、S1连续性检查 |
| 2026-10-14 | 标准人溢价异常 D1 | S2当前规则实测σ=0.00101813。理想构筑只含受控装备，标准人另含武器盘、召唤、岛屿成长等；通过来源留一量化，不把σ强制拉回区间 | S2/core-summary.json、sources.json |
| 2026-10-14 | 标准人溢价异常 DN | S2当前规则实测σ=0.000880125。理想构筑只含受控装备，标准人另含武器盘、召唤、岛屿成长等；通过来源留一量化，不把σ强制拉回区间 | S2/core-summary.json、sources.json |
| 2026-10-14 | 标准人溢价异常 B3 | S2当前规则实测σ=0.000911446。理想构筑只含受控装备，标准人另含武器盘、召唤、岛屿成长等；通过来源留一量化，不把σ强制拉回区间 | S2/core-summary.json、sources.json |
| 2026-10-14 | 标准人溢价异常 EHP | S2当前规则实测σ=0.136096。理想构筑只含受控装备，标准人另含武器盘、召唤、岛屿成长等；通过来源留一量化，不把σ强制拉回区间 | S2/core-summary.json、sources.json |
| 2026-10-14 | 标准人溢价异常 AV | S2当前规则实测σ=0.973650。理想构筑只含受控装备，标准人另含武器盘、召唤、岛屿成长等；通过来源留一量化，不把σ强制拉回区间 | S2/core-summary.json、sources.json |
| 2026-10-14 | 消融旋风词条会丢失武器使用许可 | 对必须依靠词条换武器的宿主使用正式withoutAspects投影，保留weapons补丁并移除数值效果；其余保持原删除来源口径，旧有效配对不重跑 | tools/spine/audit.ts、player.ts |
| 2026-10-14 | 原核心测量和本次权重基线输入相同但输出小幅不同 | 当前simulation含其他会话27增20删的未提交改动；保留混杂证据及原冻结锚点，不覆盖旧测量。S5按最终代码统一重测标准人，V逐格实测报告残差 | S2/core-summary.json、stat-weights.json |
| 2026-10-14 | 天赋与巅峰为TS生成数据，缺少安全的逐项JSON写入路径 | 新增主干技能系数/节点数值控制表，初值逐项等于原有定义，运行效果零变化；后续只通过统一apply按路径改写，保留内容身份和机制 | packages/content/spine-controls.ts、skill-coefficients.json、progression-node-values.json |
| 2026-10-14 | 预算小组成员不足3：技能/武技/功能/功能 | 并入同类别最近字典序可用组 技能/法术/功能/功能 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：技能/武技/核心/持续 | 并入同类别最近字典序可用组 技能/法术/功能/功能 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：技能/法术/冷却/单体 | 并入同类别最近字典序可用组 技能/法术/功能/功能 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/silver/fire | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/silver/cold | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/silver/lightning | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/silver/area | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/silver/single/area | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/fire | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/割裂 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/剑势 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/决斗 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/震岳 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/坚壁 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/镇压 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/狂骨 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/饮血 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/旋锋 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/炽炉 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/霜镜 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/余烬 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/淬影 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/千刃 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/疾影 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/雷鸣 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/潮汐 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/时砂 | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/projectile | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/area | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/dash | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/arcane | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/gold/dot | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/prismatic/arcane | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/prismatic/fire/cold/lightning | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/prismatic/chain/lightning | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/prismatic/area/arcane | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：潮印/prismatic/defense | 并入同类别最近字典序可用组 潮印/gold/通用 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/damage/1 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/damage/2 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/damage/3 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/damage/4 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/defense/1 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/defense/2 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/defense/3 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/defense/4 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/support/1 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/support/2 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/support/3 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/support/4 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/special/1 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/special/2 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/special/3 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/special/4 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/special/5 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 预算小组成员不足3：天赋/support/5 | 并入同类别最近字典序可用组 天赋/damage/5 | S2/audit.md |
| 2026-10-14 | 非参考词条描述生成器覆盖不足 | 统一说明生成器需要扩展；本计划先保留残差并拒绝未同步描述的词条应用：Error: 尚无补丁中文描述：projectiles | tools/spine/normalize.ts |
| 2026-10-14 | 技能系数直接乘进目录使原始Skill的damage出现小数，破坏World恢复契约 | 系数只在正式resolveSkill所有者内折算并取整，原始技能目录保留整数；不放宽契约。两项旧平衡数值断言按S3推导更新：斧标准两件10%→5%、单技能潮印3→2.95，仍验证独立伤害与持续预算各缩放一次 | packages/rules/index.ts、相关2测试 |
| 2026-10-14 | 八构筑多个轴没有2倍专用弹性，安全AV饱和 | S4开始后保持规则结构冻结，保留零弹性、触及边界及残差，不估计J、不追加候选扫参；按允许的3步/2次修正上限验证 | S4/elasticities-summary.json、后续numeric-todo.md |
| 2026-10-14 | artifact-tool对前次生成的带前缀ContentTypes元数据导入失败 | 在一次只读副本中验证默认命名空间后成功；后续增量导出统一三个允许修改的目录元数据命名空间，原工作表/样式/批注字节差仍为0。已完成前后渲染 | tools/spine/workbook.py、S2/workbook*.log |
| 2026-10-14 | RATE击杀阈值放宽 docs/reviews/numeric-spine-20261013/S6/rate | 观察最大速率12，原阈值15→24；仅配置阈值，判定逻辑不变 | packages/content/spine-rate-limits.json、apps/api/src/app.ts |
| 2026-10-14 | S6临时库自然日程在生成flat速度词缀时返回500 | 根因S3将flat下界归一为0.65，正式crypto.randomInt只接收整数。统一flat按1取整并经apply修复；原自然日程断言保持，失败证据和临时库清理保留。加强配置schema提前拦截非法flat范围 | S3/flat-repair-plan.json、packages/rules/affix-generator.ts |
| 2026-10-14 | RATE击杀阈值放宽 docs/reviews/numeric-spine-20261013/S7/correction-1/rate | 观察最大速率36，原阈值24→72；仅配置阈值，判定逻辑不变 | packages/content/spine-rate-limits.json、apps/api/src/app.ts |
| 2026-10-14 | S7攻击修正公式的方向 | 交接文字targetTTD/actualTTD会在死亡过快时进一步提高攻击，违背锁定危险度目标。按符合用户目标优先使用攻击×actualTTD/targetTTD；生命仍×targetTTK/actualTTK，删失不修正 | tools/spine/correct.ts |
| 2026-10-14 | 预算审计的净收益符号、标准宿主与功能技能基线错误 | 保留原始记录和原推导，禁止把负P绝对值当正预算；标准人前缀现在实际装配标准人；功能技能保留宿主输出并真实移除/加入，盾疗damage字段不当作伤害。V3以修复口径验收，旧S2/V1/V2不能与V3预算直接同比；不重置已用测量/迭代额度 | tools/spine/audit.ts、content.ts、preflight.ts、numeric-todo.md |
| 2026-10-14 | V2一刀线探针中的无限HP放大敌方防御AI且存在未出手机会 | 一刀线改为每目标附近合法可见站位、保留真实普通怪群布局/护甲与地形的固定木桩，关闭敌方AI并精确去暴击；首次直接命中与原HP比较，未命中仍计分母。TTK/TTD仍使用实际营地与完整AI，旧无效夹具记录不覆盖 | tools/spine/authored-field.ts、S7/V2/authored-field-summary.json |
| 2026-10-14 | 武器平价配置只改模板名而保留了剑系白值、威能和觉醒 | 按真实同档模板重新生成主手及预期套装部位，匹配武器与技能的传奇/天赋/觉醒，养成进度和词缀期望保留；重新测D1，不把S5旧配置当最终平价验收 | tools/spine/player.ts、parity.ts |
| 2026-10-14 | S7修正2完成数据收尾 | 构筑2步、怪物/地城/层级按公式应用，里程碑独立缩放；V3保留全部失败样本，之后不再改数 | S7/correction-2/correction-summary.json |
| 2026-10-14 | 高阶法典将伤害扣减倍率继续放大为负数 | S7修正2期间修复倍率数值域：damage乘区小于1的代价保持声明值，正收益仍按每级10%成长；新增三个域测试。修复先于最终标准人及V3测量，不作V3后调参。 | packages/rules/aspect-sources.ts、tests/numeric-spine-codex-domain.test.ts |
| 2026-10-14 | S8精确数值与全帧golden因已应用计划变化 | 按第6节更新精确期望；新增numeric-spine版本golden并保留旧文件，参数/全帧/RNG断言保持。没有为修复断言再调内容数值。 | S8/golden-refresh-summary.json、tests/fixtures/numeric-spine |
| 2026-10-14 | S8长期战斗的测试驱动未续45秒控制租约 | 驾驶器按真实control API续租；保留全部任务排列、奖励/幂等断言。龙眠岛原4分钟时限不足，延长至15分钟，不缩样。 | tests/island-story-player-flows.database.test.ts |
| 2026-10-14 | S8副本已结束而客户端仍用上一帧checkpoint请求next | 只在DUNGEON_CLOSED后读取持久结果并断言确为终态；其余错误仍失败。修复后两座裂隙仍真实死亡，作为未通过项保留。 | tests/earned-all-quests.database.test.ts、S8/repaired |
| 2026-10-14 | S8最小生命和固定清场下限使比例夹具退化 | 只在比例/速度单测中使用脱离整数最小值与计算上限的受控夹具；正式反作弊公式、角色与怪物未改，API实际下限精确断言同步为320ms。 | tests/world-pack-growth.test.ts、world-field-foundations.test.ts、weapon-story-flow.test.ts |
| 2026-10-14 | S8文案含倍率禁词、undefined和内部复生字段 | 修复中文生成器并通过apply仅同步description；复生85%、每局1次和火焰类型均来自实际规则。 | S8/copy-repair-plan.json、S8/aspect-copy-plan.json |
| 2026-10-14 | 本地测试快照副本被Vitest误发现 | 仅将S0/S9备份副本改为.snapshot后缀；真实tests下文件和断言不删不跳过。 | S8/exact-values-recheck.log、tools/spine/prepare-own.py |
| 2026-10-14 | V3后发现连续性与首章行为、裂隙通关仍失败 | 保留失败；不改2%断言，不删除首章预警/阶段检查，不将死亡改判通关。已向用户请求V3冻结与继续修复的裁决，其余收尾继续。 | S8/initial-final-regression-summary.json、S8/repaired |
| 2026-10-14 | S9规则升号与测量版本不同 | 声明仅ow-70→ow-71一次；models保留measuredVersions=ow-70与版本桥，不补造V4，数值点不变。S8失败不因此转为通过。 | S9/version-summary.json |
| 2026-10-14 | 用户授权修复测量并重新验证 | 原V3留档；允许修复测量定义及重跑受影响结果，不擅自追加牛顿/自由调参。先定位一帧变化根因。 | S8/measurement-repair/authorization-summary.json |
| 2026-10-15 | 精英危险度的120秒删失不能归为功能型 | 七个原始样本全部存活到120秒，六项降低比例改为未知，不再把下界之比当0；实测越界与不可判定分列，不重跑World、不改游戏数值。 | S8/elite-audit-correction/reuse-summary.json |

- 2026-10-15 S8隔离恢复：7项失败属于制作迁移前基线恢复遗漏，已根据HEAD及修改前证据恢复断言/原测试数据；6文件57项复核通过。共享制作代码保持原样。第二次全量仍运行完整248文件和两种自然策略。证据：S8/final-baseline-recovery-summary.json。
| 2026-10-15 | S9当前σ与标准人投入口径 | D1=0.0021，DN=0.0014，B3=0.0012，EHP=0.5546，AV=1.0000；参考构筑受控配置与SCHEDULE全养成标准人投入不同，不能当成同投入溢价。不暗加成长补齐，不强制σ=1。 | S9/report-inputs-summary.json、tools/spine/player.ts |

- 2026-10-15 最终S8：248文件/1766项通过、0失败、2原有skip；独立任务策略1项通过，tsc×2、7本config、ow-71正式构建43文件/0实验入口通过。首轮任务日程401.08分钟、末轮236.81分钟均保留；私有掉落未固定。重跑覆盖了首轮同名raw，摘要保存覆盖前数字和原SHA并明确该限制。类型修复只补budget.ts数组标注，无运行行为变更。源门禁漂移0，151预算未通过/10敏感性正确退出1。

- 2026-10-15 S9完成：实现提交a9338d36f5b50d58a5b16d9c14bb5c78ad2302ee，共517个本期文件差量；留档新增16740行，源码空白检查通过，原始明细/截图/并发制作文件未暂存。共享工作树保留ow-72及其他会话改动。数值状态为完成但数值有残差，75个锁定目标未改，追加牛顿0步。
