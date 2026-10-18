# 端服与协议实施记录

## 依赖与职责

应用入口 `apps/web/src/main.ts` 协调会话、正式镜像、World、Outbox与面板。`presentation.ts`只读视图并发出操作，`scene.ts`绘制世界和消费事件。`network.ts`管理超时、运行时响应校验及持久待提交命令。World拥有临时生命、坐标、实体、技能与自动状态，不写入正式资产。

API模块化单体采用路由应用层、事务仓储、纯规则和私有经济表。现在尚未拆成独立业务服务文件，不能据此声称完成生产模块化组织；业务职责已经有明确所有者，下一轮按现有命令边界拆分而不复制公式。

模块联动：输入/自动→导航/战斗→事件/画面→报告Outbox→API授权校验→数据库事务→回执→正式镜像→奖励地面展示。装备操作通过同一命令屏障结算尾批，再更新核心参数。

## 数据与版本

`packages/contracts/index.ts`记录client/protocol/rules/assets/db五种版本，源码哈希另用于本次验收定位，不能替代版本协议。

`ow_accounts/sessions`认证，`ow_characters`正式角色JSONB；`ow_controls`单角色控制；`ow_permits`遭遇轮次与私有奖励快照；`ow_kills`来源去重；`ow_rewards`待领取；`ow_receipts`命令指纹与原回执；`ow_ledger`资产变化。首次创建自动执行幂等DDL。目前适合独立开发环境，上线前须替换为明确迁移序列、部署锁与恢复验证。

账号密码为随机盐scrypt哈希，Cookie HttpOnly/SameSite Strict，生产Secure。状态归属只从会话获取。来源检查、严格请求对象与体积限制拒绝异站写入。

## 请求样例与边界

```json
{
  "command_id": "23ee61bd-6e3c-4f20-a9f7-c5a49b1f428c",
  "revision": 4,
  "lease_id": "be9d37b0-6f96-4317-86a6-029775d93c73",
  "permit_id": "c6b51f60-3533-4a69-9f7c-a62e78034d3f",
  "build": 2,
  "sequence": 3,
  "from_tick": 120,
  "to_tick": 180,
  "kills": [{"source_id": "meadow:1:meadow-01", "tick": 150}]
}
```

示例不是可重放的测试资产。有效UUID、来源、版本和步范围必须来自本人实际授权。API不接收客户端余额、装备属性或等级覆盖。

控制会话在当前登录身份下验证；重新授权可能续用未结束遭遇，已击杀来源随轮次保留。卸载渲染地块不生成新奖励身份。重复报告整批拒绝，不部分入账。收益随机在服务端，装备落点当前使用授权出生位置；不是经过验证的死亡位置。

重试同一命令前优先读 `/api/receipt/:id`。失效租约的原待确认操作可带 `X-AW-Resume-Lease` 指向同角色当前控制者，正文保持不变。已确认命令读取不检查旧租约是否活跃；新命令仍受角色版本、控制权和授权检查。

所有成长写入串行，预览可并发。批次2秒或20杀；最多两批未确认。关闭网页的异步尾批并不保证完成，强制关闭/清空IndexedDB的末段收益可能丢失。

## 错误处理

|错误码|客户端行动|
|---|---|
|AUTH / LOGIN|重新登录或检查凭据|
|BUSY / CONTROL|停止成长，显式接管或重新取得控制权|
|REVISION / BUILD|暂停，确认在途命令后拉快照和授权|
|PERMIT / EXPIRED / SEQUENCE|查询原回执，再恢复授权；不要换ID重发|
|COMMAND_CONFLICT / DUPLICATE / SOURCE / RATE|拒绝报告，保留正式状态，记录关联标识|
|CAPACITY|整理背包；奖励继续保存|
|PROTECTED / COST / MAX_RANK|保持原装备/余额，提示条件|
|LOCKED / TASK / CLAIMED|保持世界进度，展示前置或已完成状态|
|VERSION / PROTOCOL|刷新客户端，不以本地数据覆盖正式状态|
|NETWORK / SERVER|暂停，恢复原命令和正式镜像|

## 配置与内容更新

地图修改以Tiled对象层为源。规则与装备底材由server resolveBuild消费，奖励表只在API。前端采用已解析技能伤害，不另推导成长公式。文案引用effects唯一参数；奖励/分解按钮没有复制私有金额，实际数值来自回执或服务端预览。

授权固定怪物/奖励快照；规则热更新与旧客户端兼容窗口尚未做发布演练。生产首次发布应停新授权、处理在途命令、备份并协调更新客户端/API；不能只回退程序而忽略数据与内容版本。
