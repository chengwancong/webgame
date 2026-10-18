# R1 属性登记表与分池验收

版本：client 0.11.4 / protocol 26 / rules ow-45 / db15。

六处属性名单统一读取 stats.json；属性按池分派，旧套装生命百分比计算顺序保留；DamageZone 校验 type/mult 与旧 kind 一致；条件池提供带 schema 的空通道。

- 玩家路径：可见 Chrome 登录 qa_build_variety_r0 → 拾星港 → 行囊属性 → 关闭/刷新 → 原角色与装备恢复；health/content/client 版本一致，无页面错误。见 live/result.json 与 live/camp.png、bag-stable.png。
- 定向：build-variety-r1.test.ts 31、equipment-runtime.test.ts 8 全过；seed41，每种旧构筑300帧事件与解析结果逐字段相同。样本数见 verification.json。
- 完整回归：116 文件，836通过、2原有跳过，全部测试逐项结果在 regression.log。数据库 --no-file-parallelism，临时真实PostgreSQL，结束后清理。
- 完整回归后的类型检查曾报告套装数值类型未收窄，已修正并重新通过 tsc、定向39测试、内容校验；原失败记录保留于 regression.json/types.log，后续通过记录见 verification.json。
- 生产/QA 构建通过并恢复托管服务；267账号、148角色、1461回执/流水在构建前后逐行一致，见 build/build.json。可见浏览器检查再次核对旧装备和仓库逐字段未改。
- 提交边界：只暂存R1登记/解析/契约及其验证。Claude M1运行时、任务/世界Excel和营地/悬赏/精英/传送改动仍留工作区；共享contracts按R1字段构造索引，保留协议26兼容标记。工作区不回退。

本批是同构筑兼容验证；新24副属性、50原子、18套装、60威能和90潮印按R2–R8继续执行，不据登记条数宣称后续内容完成。
