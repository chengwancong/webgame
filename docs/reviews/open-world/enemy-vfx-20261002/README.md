# 怪物弹道与预警整改验收

2026-10-02，正式客户端0.7.9，protocol8，rules ow-11，assets world-art-20261002-v11-enemy-vfx，db10。

正式游戏已使用整改后的CombatVfx。普通箭弹、寒冰箭/冰枪、骨矛、虚空弹具有独立主体与运动尾迹；危险圆区、前摇与落地延迟、光束方向、临近触发提示统一由战斗时钟驱动。固定危险边界与真实判定投影一致，暂停与减少动态继续保留范围和剩余时间信息。

## 视觉证据

- [整改前正常速度](before-normal.webm)，22.25秒。
- [整改后正常速度](after-normal.webm)，22.25秒。
- [整改后0.25倍慢放](after-slow.webm)，88.31秒。
- [圆形预警整改后](warning-after.png)、[整改前](warning-before.png)。
- [雪地](warning-snow.png)、[暗色地面](warning-dark.png)、[光束预警](beam-after.png)。
- [箭弹](arrow-after.png)、[冰箭](ice-after.png)、[骨矛](bone-after.png)、[虚空弹](void-after.png)。

录像由正式WorldScene和真实战斗核心生成，未用生成图、模拟剪辑或人工命中替代。三份录像均在浏览器真实解码：1280×720、readyState4、无媒体错误，详情见[video-validation.json](video-validation.json)。对照页 `/monster-vfx-qa.html` 提供重播、前后对照、逐帧、慢放与三种背景。

## 行为与性能

48项检查通过，覆盖真实发射/命中关联、怪物前摇与落地延迟交接、暂停与真实触发时间、同一首领不同技能的实例编号隔离、紧急脉冲透明度边界、毁灭吐息正确来源，以及既有55技能/怪物/首领战斗轨迹、第一章战斗与UI Tokens。TypeScript与生产构建通过。

本机RTX4070SUPER，ANGLE Direct3D11，1280×720。每个压力场景运行600战斗tick，记录最后600渲染帧：

| 场景 | 帧耗时P95 | 场景绘制P95 | 对象池峰值活动数 | 单帧装饰舍弃峰值 |
| --- | --- | --- | --- | --- |
| 20敌人/30弹体 | 16.69ms | 以JSON原始记录为准 | 120 | 0 |
| 60敌人/100弹体 | 16.69ms | 以JSON原始记录为准 | 246 | 70 |

详见[20/30](performance-20-30.json)、[60/100](performance-60-100.json)。高负载优先舍弃尾迹和附加装饰，攻击主体与危险边界保持受保护。压力页补入的零伤害弹体只用于负载，不用于证明技能伤害。结果对应本机GPU与该场景，不外推到其他设备。

## 发布与存档

[versions.json](versions.json)核对实际health、content与客户端版本一致。主游戏已有会话恢复、进入归途营地，无加载/版本拦截或控制台错误；[营地截图](release-camp.png)。

独立临时PostgreSQL与独立localhost会话完成账号登录、进入营地、苍风原野实际战斗、拾取装备、回城及刷新：[战斗截图](release-live-battle.png)、[刷新后的营地](release-live-restored.png)、[界面记录](release-live-restored.txt)。测试角色从Lv1成长到Lv2，60金币与进度刷新后保留；未修改真实玩家道具或掉落概率。

[persistence-before.json](persistence-before.json)与[persistence-after.json](persistence-after.json)核对主数据库既有68账号、68角色、508回执和508流水均保留。验收期间正常操作新增7条回执/流水，总量515，涉及1个角色的修订变化已按新增回执核对。原始行快照只保存在忽略的.runtime目录。正式服务由现有Limited Windows系统任务继续托管，启用自启。

本轮为游戏现有演出的适配整改。APK原始战斗粒子仍按原可用性清单登记，未将这些新轮廓或预警控制标记为APK完整还原。当前场景和怪物美术仍属其他整改范围。
