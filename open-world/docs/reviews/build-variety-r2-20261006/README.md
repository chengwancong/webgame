# R2 条件与效果规则引擎

版本：client 0.11.5 / protocol26 / rules ow-46 / db15。

25条连携迁移至 weapon-combo-rules.json；旧快照 Stats.combos 转入统一执行规则，新来源可传 Stats.rules。条件纯函数、条件伤害池、规则过滤、上界概率/暴击、effect_triggered（ruleId/source/action/amount）和按规则触发/实际伤害统计接入。旧快照保持可读，遥测状态支持战斗检查点恢复。未覆盖触发/动作跳过本次抽查，不改变判罚。

## 玩家路径与前后行为

- 原25连携在修改前冻结 seed41、各300帧、共7500帧记录，逐帧比较全部原事件和敌人HP，全部一致。仅新增遥测字段独立核对，不参与旧画面事件比较。测试夹具 tests/fixtures/build-variety-r2/legacy-traces.json.gz。
- 可见 Chrome、编译客户端、隔离真实PostgreSQL：七种武器经实际装备/技能激活与技能栏命令，逐个进入服务端副本实战施放，释放/命中/状态/可见效果全部通过。player-path/result.json保存每条输入、执行构筑、事件和帧；player-path/video/保存可见操作录像。角色等级与目标位置为明确受控夹具，非自然养成样本。
- 前后比较的真值是冻结帧录制；可见录像是迁移后的真实表现证据，不宣称两段人工操作视频像素完全相同。
- 正式服务可见登录/行囊/刷新恢复见 live/result.json，旧装备和仓库逐字段不变。

## 检查

- build-variety-r2.test.ts 48项：条件真值表、25轨迹、条件池、100种子上界、检查点遥测。
- weapon-combos.test.ts 原14项全保留通过；build-variety-r1.test.ts 31项通过。
- 串行完整回归117文件884通过、2原有跳过；逐项见 regression.log。tsc、content通过，见 regression.json。
- 生产/QA构建通过，服务恢复；267账号/148角色/1469回执与流水构建前后逐行不变，见 build/build.json。
- 所有重任务串行，浏览器 headless:false。未改认证、版本校验和防作弊判罚；仅增加上界与安全跳过路径。

新16触发、10动作、叠层/冻结等和50原子由R3紧接实施；本批未把其草稿计作运行时内容。
