# 星潮海公共集成交付

设计版本starsea-20261003-d1；本轮实际检查日期2026-10-04（Asia/Shanghai）。公共所有者props_integration，最终接受状态只读根代理的docs/starsea/resource-ledger.json。129ID＝7 NPC＋21怪物＋6首领＋30技能＋13地图＋28环境＋24物件。当前校验701个源/包文件、274个运行URL。

入口：常驻开发页http://127.0.0.1:8612/starsea-art-qa.html；实际Vite生产包http://127.0.0.1:8611/starsea-art-qa.html。六组均由真实源骨架、完整图集、物件状态、地图JSON或独立原生特效适配播放。旧正式内容13地区/55技能/26演员保留。36任务新故事没有切换为可玩主线。

物件50状态、开盖/破损等实体变体保持统一主体宽和固定足点。引擎/损坏引擎与破损阀采用参考保持编辑，初稿留在源目录。B3预警按演员最大动作与实际几何联合边界整体平移。圆形完整可见，80格长束使用3797px级别1:1长画布并可滚动；投影32×18、实际范围、时序与角色尺寸不改变。每项技能的左右完整边界都进入生产报告。

## 证据

- evidence/production-review.json：真实8611生产页129项、60两向范围、暂停/恢复、地图与状态、0页面错误/0失败资源请求。
- evidence/publish.json、publish.log：停止托管服务→完整正式构建→恢复的结果、源码SHA、健康/content版本、四表前后审计。
- evidence/built-login.json：复用旧QA账号balance_9d24dbd76c4047df8c，无密码；真实登录→营地→刷新恢复同一角色，原四表保留。
- evidence/service-identity.json：legacy/current身份、创建时间不符、仅路径、不存在PID、限时失败、不可读API保留目录、确认旧API退出后才移除自有临时目录。
- evidence/source-reload/result.json：实际可逆API注释变更与恢复触发两次真实后台重载，并核对持久数据。
- evidence/service-survival/result.json：真实Node→wscript→svchost调度链，启用标记保持时正常退出和强制终止都恢复，原数据、回执、流水保留。

实际版本以实时contracts/health/content/生产客户端一致为准；本次现场为client0.8.12、protocol13、rulesow-18、assets world-art-20261004-v18-equipment-chibi、db11，未回退初始0.8.11/v17或修改规则/数据库协议。

## 服务恢复事实

曾观察到enabled标记不存在、supervisor未运行，日志记录正常关闭数据库且bytes_removed=0。标记移除的调用者未被捕获，不能据此归因。恢复时另观察到旧同步Get-CimInstance与ScheduledTasks查询无界等待，API已开8611但Vite8612未启动。改用有10s上限的只读原生命令行/创建时间查询与有15s上限的TaskScheduler COM接口，继续由当前用户Limited计划任务启动。

身份仍包含创建时间与完整命令行，兼容旧CIM时间精度和修复过程中的创建时间＋路径记录；从不只凭PID或路径终止进程。读取失败、身份不符或退出未确认时保留进程/运行目录。祖先查询仅用于验证真实调度来源，不用于终止授权。原生结构依据Microsoft的[NtQueryInformationProcess](https://learn.microsoft.com/en-us/windows/win32/api/winternl/nf-winternl-ntqueryinformationprocess)与[RTL_USER_PROCESS_PARAMETERS](https://learn.microsoft.com/en-us/windows/win32/api/winternl/ns-winternl-rtl_user_process_parameters)，不改主机WMI服务。

根台账全项accepted且版本一致后，聚合包才输出resource-accepted；剧情仍story-not-connected。源/自检/接入/根验收状态分别记录。
