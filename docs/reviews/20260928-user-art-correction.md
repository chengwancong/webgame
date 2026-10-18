# 用户资源接入纠正（2026-09-28）

上一轮错误地选回 `bright_anime_v2` 生成角色、敌人和战斗背景，仅城镇使用了用户提供的资源。旧工程的 `docs/01-architecture/pockie-appearance-reference.md` 已在 2026-09-13 明确记录用户原始资源和转换成果；重写客户端本应接入这些素材。

## 本次改正

从旧工程已转换的 PNG 中选择原始资源接入独立新版，不迁入旧运行代码：

| 当前用途 | 来源 |
|---|---|
| 玩家身体七类动作 | `pockie_native/pockie_1` |
| 同步前后武器层 | `pockie_1/weapon_1`、`weapon_back` |
| 袭击者七类动作 | `pockie_native/pockie_10001` |
| 城镇 | `pockie_media/scenes/camp.png` |
| 战斗背景 | `pockie_library` 的 `background_2101.s114` |
| 直刺、横扫图标 | `pockie_media/skills/power_strike.png`、`whirlwind.png` |
| 命中特效 | `native_fighteffect_1802_s113` 的 14 个转换帧 |

选择的 281 个文件共 7,501,526 字节，逐项 SHA-256 已核验。实际来源及原工程路径见 `../../client/assets/art/source-records.json`；动作、图层、朝向、脚点与转换原始来源见 `../../client/assets/art/actors.json`。已删除上一轮在新版中复制的旧生成资源，未删除用户原始文件。

身体和武器共享帧时序与脚点；玩家转向敌人，敌人转向玩家；命中特效由真实伤害事件触发。技能图标只表达已有直刺和横扫，不改变技能数值。当前只接入一名玩家形象和一种敌人形象，没有把旧资源库的 94 人物与 169 怪物当作新版已实现内容。

## 实际运行

![准备界面](20260928-user-art-correction/camp.jpg)
![战斗界面](20260928-user-art-correction/battle.jpg)
![真实胜利结果](20260928-user-art-correction/result.jpg)

标准 `make check`：44 passed、0 failed、0 skipped，`ok=true`；含重新导出 Web、真实数据库/API、浏览器和可见/headless 一致性检查。通过旧 UI 控制回归证明暂停、手动技能、冷却和结算仍消费实际核心。

实际键盘注册、出发、暂停、继续、手动横扫与胜利结算已验证。横扫在第 33 tick 开始、第 35 tick 造成 7 点实际伤害；最终第 42 tick 胜利，造成伤害 90、承受伤害 16，与界面一致。浏览器错误记录为空。证据保存在同名目录。

此前生成素材截图仅作为修改前对照。当前仍是单场战斗原型，持续奖励、装备、成长与关卡循环未完成；本轮未修复此前独立验收指出的完整检查 SIGTERM 中断 API 遗留缺陷，未宣称原生交付包验收通过。

试玩：新版目录运行 `make dev`，打开 `http://127.0.0.1:8602/`。当前 Web 构建已更新。

清理实测见同名目录的 `cleanup-summary.json`。只处理本轮 QA 文件与一次性数据库，保留当前构建和共享导入缓存；旧工程、存档和 `cloudrealm/` 未改动。
