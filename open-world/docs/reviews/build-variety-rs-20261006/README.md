# 流派丰富度 RS 批次记录

日期：2026-10-06。RS 验收完成。验收针对当前工作区；其他任务的改动保留，涉及共享应用/规则/状态的文件只暂存本批修改。

## 已实施

- 11 个技能改为奥术；标签继续由 skill-tags 自动推导。火球术、陨石术追加燃烧，雷链、闪电箭追加感电，暗影箭追加致盲。
- 14 个新技能与武器绑定已接入。数值校准逐项记入内容清单 §7.3 修改记录；伤害类型、状态、射程、半径、施法阶段使用既有机制。
- 命中中毒保留计入技能总量、减半拆分；地面中毒按配置额外缩放，按每段命中刷新。未新增中毒字段。
- 腐蚀劈伤害保持 36（18＋18），冷却校准为 64 帧。毒雾弹中毒总量 8、瘴气中毒总量 6 保持。
- 新图标逐个使用内置 ImageGen 生成，原图、完整提示词、哈希与生成路径保留在 assets/ui-source/v2/skill-handdrawn/。通过原有导入/发布管线，只处理新增 ID。原 63 个图标登记与既有来源记录逐字段不变。
- 特效按档案取数；原 63 个选材及原有档案值逐项不变。新特效复用已登记素材，调整冰霜/暗影挥砍、雷闪到达、毒素区域的颜色。
- 浏览器再现了 R0 的面板关闭：登录恢复先开放操作，晚到的地图进入再清空面板。增加恢复期间的忙碌生命周期，拦截菜单和键盘输入，服务端副本继续推进。

## 数值核对

见 [measurements-summary.json](measurements-summary.json)。L50、技能等级1、同攻击预算、无甲耐久靶，种子41，预热900 tick、稳定测量9000 tick（300秒）。其余新技能全部在参照的 ±10% 内。腐蚀劈约 −9.6%；夜幕使用有伤害的死莲作参照，约 −8.5%。火焰箭与旧毒箭按已定决策留到 R8。

TTK 使用当前 raider 模板与对应怪物等级，角色等级10/20/50，种子41/73/107，共252组，未过滤失败样本，当前无清场失败。此为受控授予、明确技能等级、同预算的单技能测试；高生命/灵力与禁用怪物攻击用于隔离输出，不能当作自然养成或完整BD平衡结论。

## 必须保留的回归证据

- tests/fixtures/build-variety-rs/poison-before.json：修改前采集的毒箭/淬毒针基线，等级1/20/50、技能等级1/5、种子41。改后解析参数与逐帧伤害一致。
- tests/fixtures/build-variety-rs/visuals-before.json：原63技能的选材与原有特效档案值，改后逐项一致。
- 地面中毒离开区域后，单次完整周期预算按配置8/6缩放；在区域内，每段命中刷新持续时间，不叠加同源实例。

## 玩家路径与状态

真实隔离 PostgreSQL、编译版 Chrome、真实装备/激活/技能栏命令及服务端战斗。结果见 [player-path/summary.json](player-path/summary.json)，ok=true，剑/锤/斧/弓/法杖/暗器/魔杖均完成实际激活、装配、释放、命中、状态与可见特效。真实恢复请求挂起期间，菜单禁用、键盘被阻止；恢复后面板稳定。原装备逐字段不变。所有受控授予仅发生在临时数据库，常驻玩家成长不改写。

图标验收见 [icons/result.json](icons/result.json)。特效验收见 [fx/summary.json](fx/summary.json)，包含实际释放、挂点、移动、暂停与死亡清理；终局记录须为 ok=true。

## 遗留

- 火焰箭与旧毒箭的差距留到 R8，此批不修改这两项既定伤害。
- 所有批次完成后由用户统一试玩；中途不要求用户走查。

## 文件落点

- 内容与版本：packages/content/skills-expanded.ts、skill-weapons.ts、packages/contracts/index.ts；内容清单同步首版数值及修改记录。
- 中毒：packages/rules/index.ts、packages/simulation/index.ts；scope 决定预算归属。
- 表现：apps/web/src/vfx-profiles.ts、skill-fx-layout.ts、projectile-emitter.ts、combat-vfx.ts；正式图标、原图与来源记录；UI源清单与UI资源登记。
- 恢复状态：apps/web/src/main.ts；恢复完成前的输入与界面忙碌状态。
- 验收：tests/build-variety-rs.test.ts 和修改前基线；skill-mechanisms、weapon-combos、projectile-emitter的受影响断言；图标导入/验收、特效验收、测量、玩家路径、常驻服务脚本。
- 工程校验：tools/source-version.mjs 排除生成的 .qa/.runtime 输出，可附逐文件指纹；保留真实源码一致性检查。

## 最终测试

| 检查 | 结果 |
|---|---|
| build-variety-rs.test.ts | 通过，30项 |
| skill-mechanisms.test.ts | 通过，114项 |
| skill-effects.test.ts | 通过，8项 |
| weapon-combos.test.ts | 通过，14项 |
| projectile-emitter.test.ts | 通过，5项 |
| vfx-presence.test.ts | 通过，3项 |
| vfx-v2.test.ts | 通过，5项 |
| tsc --noEmit、validate-content.ts | 通过 |
| pnpm build | 通过；停止服务、构建、恢复服务依序执行 |
| import-handdrawn-skill-icons.mjs --only 新增ID | 通过，独立图形与透明底；原63登记和来源记录不变 |
| accept-handdrawn-skill-icons.mjs | 通过，77技能的列表/详情/快捷栏及32/48像素图册 |
| accept-skill-fx.mjs | 通过，77技能播放、5角色模型、移动挂点、暂停、死亡清理、营地/野外；前后源码指纹一致 |
| verify-build-variety-rs-browser.mjs | 通过，7武器真实装备/激活/施放；恢复忙碌与面板稳定回归 |
| verify-build-variety-rs-live.mjs | 通过，真实登录、拾星港恢复、行囊稳定；账号/角色/回执/流水、旧装备与仓库字段保留 |

## 发布版本

client 0.11.2；protocol 25；rules ow-43；db 15；assets world-art-20261006-v22-skill-variety。实际 health/content 相符，常驻服务保持可访问。玩家路径的首次受控记录为更新版本标签前的同一实现（0.11.1/ow-42），最终发布版本另外执行了常驻登录/行囊回归与稳定源码的特效复验。

R0 面板关闭问题已定位并完成修复，RS中明确测试了恢复结束前后输入。初始资源加载时探针曾出现10秒取消，验收先等待资源就绪再操作；本批未关闭版本校验、伪造健康状态或清空成长。

完整逐帧日志以同目录的 `.json.gz` 无损保存，摘要记录原始日志 SHA-256 与大小；原始 JSON 仍保留在本工作区。压缩后解压字节逐一相等已核对。
