# CONTENT-G01 宠物 R1 后端与前端接线交接

2026-10-23。对照 `content-design-r1.md`，本批生产源码已接入风绒、风芽鹿、岚羽三个主动 profile，并提供结构化 `PetView.activeEffect`。当前源码版本为 client `0.11.54` / protocol `55` / rules `ow-95` / db `19`，尚未部署。主代理已串行完成新增 5 项及既有杖剑 9 项真实 PG/API 测试，共 14 项通过；这不代表联合验收完成或数值平衡达标。设计文档中的全套 18 家族规划也不等于全套上线。

## 本批实际行为

|家族 ID|主动|边界|
|---|---|---|
|`wind-free` 风绒|每 2 秒攻击一个目标；单次为原 4 秒系数的一半|不覆盖周围敌人|
|`wind-light` 风芽鹿|每 4 秒给主人护盾，持续 3 秒；1 级目标量为最大生命 4%，随现有等级系数成长|主动没有伤害，不参与元素弱点判断；护盾沿现有执行器取较大值，不叠加两份|
|`wind-heavy` 岚羽|每 4 秒首击 + 最多两次连锁，三个不同目标，按 1 / 0.7 / 0.49 分配同次伤害预算|现有 `arc` 不含首击，生产规则因此使用首击 `nova` 后接两次 `arc`；单首领只吃首击，不回弹|

规则只由上阵宠物提供；助阵仅提供现有被动的 50%，即使卡片包含 `activeEffect` 也不代表助阵会施放。允许 `active:null`、仅保留助阵。无目标/超出既有触发距离时按执行器条件判断，不能在界面自行按墙钟每 2/4 秒播放成功反馈。

本批没有调整被动：1 级常见仍为攻击 3% + 最大生命 4%；稀有仍为攻击 4%；传说仍为攻击 4% + 暴击率 3%。等级与助阵折算沿现有规则。设计要求风芽鹿改生命被动等项仍待数值预算定档，不能写成已完成。其余 15 家族仍沿当前主动规则，苔芽毒伤、铃沼解控等新机制暂未实装。

九流派仍映射现有元素。`ricochet` 目前映射物理，`frostneedle` 目前映射冰霜；分击与集中变体尚未实装，不得使用“已额外分击/集中增伤”等玩家说明。流派不会自动附送灼烧、冻结、连锁等异常或动作。辅助技能允许选流派，但流派不把护盾变成攻击。

## 接口与结构化视图

契约：`packages/contracts/zhangjian.ts`。唯一数值来源：`packages/content/pets.json` → `packages/content/zhangjian.ts` → `packages/rules/zhangjian-build.ts`。`petActiveEffect` 从实际执行规则生成数值视图，前端不重算等级、分摊、护盾或被动公式。

`GET /api/pets` 返回 `{owned,lineup,catalog}`；`owned` 每项保留旧字段 `family/name/level/flow/element/runtime/activeLine/passiveLine`，新增可选 `activeEffect`，并带 `skillName/combatRole/suitableFor/tradeoff/flowDescription` 等文案字段。旧响应缺少 `activeEffect` 时可回退 `activeLine`，不能猜出未收到的新技能参数。

以下是 1 级、`blade` 流派时对应 `owned` 条目的字段节选。`damageRatios` 是攻击力倍数；`shieldPercent` 是百分数，4 表示 4%；时间单位为秒。

```json
{
  "family": "wind-free",
  "flow": "blade",
  "element": "physical",
  "activeEffect": {
    "kind": "single",
    "intervalSeconds": 2,
    "dealsDamage": true,
    "damageElement": "physical",
    "damageRatios": [1.078],
    "targetLimit": 1
  }
}
```

```json
{
  "family": "wind-light",
  "flow": "blade",
  "element": "physical",
  "flowDescription": "本技能不造成元素伤害；流派不改变护盾效果。",
  "activeEffect": {
    "kind": "shield",
    "intervalSeconds": 4,
    "dealsDamage": false,
    "damageElement": null,
    "damageRatios": [],
    "targetLimit": 1,
    "shieldPercent": 4,
    "durationSeconds": 3
  }
}
```

```json
{
  "family": "wind-heavy",
  "activeEffect": {
    "kind": "chain",
    "intervalSeconds": 4,
    "dealsDamage": true,
    "damageElement": "physical",
    "damageRatios": [2.1333333333333333, 1.4933333333333332, 1.0453333333333332],
    "targetLimit": 3
  }
}
```

浮点序列展示应使用统一格式化规则，不能把节选中的小数硬编码成前端公式。其他仍为范围攻击的家族返回 `kind:"area"`，范围无显式人数上限时 `targetLimit:null`。

护盾宠物仍保留 `element` 表示所选流派皮肤/元素映射，例如选 `storm` 后 `element:"lightning"`；实际伤害必须读 `activeEffect.dealsDamage` 与 `damageElement`。护盾仍返回 `damageElement:null`、空伤害倍率列表。不能仅凭 `PetView.element` 把风芽鹿画成雷电输出来源。

## 阵容、流派与方案保存

写接口使用登录 cookie 与已有控制权，先按现有流程获取 `/api/control`。M17 请求本身只传 `command_id`，现有服务端 `zWrite` 补齐租约和当前 revision，经统一事务写入与回执幂等路径执行。

```json
{"op":"lineup","active":"wind-light","support":["wind-free","wind-heavy"],"command_id":"<新 UUID>"}
```

```json
{"op":"flow","family":"wind-light","flow":"storm","command_id":"<新 UUID>"}
```

以上均为 `POST /api/pets`，返回 `{revision,pets:{owned,lineup,catalog}}`。同一请求重试复用同一个 `command_id`；同编号换内容返回 `409 COMMAND_CONFLICT`，不重复修改角色、不新增流水。重复宠物占位、未拥有宠物仍由已有服务端规则拒绝。

方案命令为 `POST /api/loadout`，示例：

```json
{"op":"save","index":1,"name":"稳过","command_id":"<新 UUID>"}
```

```json
{"op":"apply","index":1,"command_id":"<新 UUID>"}
```

保存会记录上阵家族、助阵家族及这些家族的流派；恢复会装回仍拥有的宠物与其流派。返回 `{revision,loadout,result?}`，`result` 包含 `{applied,skipped}`。`GET /api/loadout` 直接返回视图，`current.elements` 和每个 `slots[].elements` 都由服务端根据真实伤害来源算好。仅物理技能 + 雷鸣风芽鹿、无伤害助阵的例子，两处都应只有 `["physical"]`。已保存的护盾方案也不能被当前换上的攻击宠物所污染。

副本锁使用现有 `zhangjianSwitchBlock`：角色副本指针、进行中的副本成员关系、世界活动，以及仍有未清敌人的有效野外许可。界面读 `loadout.canSwitch/switchBlock`，不能只看是否打开副本窗口。锁中新的宠物阵容/流派命令返回 `409 PET`，新的应用方案命令返回 `409 LOADOUT_LOCKED`，失败不写角色或回执。已成功命令重放返回历史回执，不产生新的切换。

## 事件与前端表现接线

真实事件来源为 `packages/simulation/index.ts` 的 `effectTriggered/comboAct/effectShield`：

- 规则触发：`effect_triggered`，`ruleId:"pet-wind-light"`、`source:"pet:wind-light"`、`action:"shield"`、`amount:0`。它表示发生动作，可驱动宠物施放动画，不是伤害值或真实新增护盾量。
- 真实护盾：`shielded`，`shieldPhase:"applied"`，附带 `ruleId/sourceId`、`shieldRemaining`。本批已补充 `shieldGained` 作为实际新增量；`amount` 保持旧语义，可能是目标盾量。用宠物 `ruleId`、主人 `sourceId` 精确归因，且只有 `shieldGained > 0` 才播护盾增长成功反馈。不能依赖“同帧或前后两帧 + amount>0”猜来源；已有更大护盾时动作仍可发生，但新增量为 0。
- 真实伤害：`hit_resolved`，消费其 `ruleId/sourceId/targetId/amount/category/damageType`；伤害飘字和命中反馈按事件发生，不用主动面板倍率伪造数字。宠物衍生伤害不能当主人直接普攻或直接施法触发无限接力。

岚羽 `effect_triggered.action` 是首击 `nova`，后续 `after.arc` 不会逐跳再发一条 `effect_triggered`。本批新增可选 `followupActions`，直接由本场执行的冻结 `rule.after` 提取动作类型；岚羽返回 `["arc"]`，原范围攻击没有该字段。前端用宠物 `ruleId`、`action === "nova"` 且 `followupActions?.includes("arc")` 精确识别本次连锁，并跟随真实命中目标事件。不要只判断 `action === "arc"`，也不要以局外 `owned.activeEffect.kind` 替代旧实例的实际形态。旧实例继续按开战时冻结规则产生事件，不会因当前宠物详情已经更新而变成新连锁。

以下为本场岚羽触发事件的字段节选；连锁命中数仍由后续真实命中事件决定：

```json
{
  "type": "effect_triggered",
  "ruleId": "pet-wind-heavy",
  "source": "pet:wind-heavy",
  "action": "nova",
  "followupActions": ["arc"],
  "amount": 0
}
```

当前前端待接点：`apps/web/src/hub/pet-panel.ts` 按结构化字段区分单体/护盾/连锁，详情展示“做什么/适合哪里/损失什么”；`apps/web/src/hub/pet-event-feedback.ts` 改为精确来源 + 实际增量，并根据事件 `action:"nova"` 与 `followupActions:["arc"]` 识别岚羽；既有 `pet-follower.ts`/`scene.ts` 的宠物动作继续由真实规则触发驱动。上述是交接清单，本批后端任务未修改前端，也未验收其完成状态。

## 新增验证与执行边界

新增 `tests/content-pet-r1.database.test.ts`，使用 `createApp({testLogin:true,dungeons:false})` 注入真实 API，登录新账号、建立控制权，仅在自有临时库准备角色 fixture。无密码输入，无常驻登录写接口调用。测试先要求 `AW_DATABASE_URL`，并在迁移前检查 PostgreSQL `data_directory` 必须是 `.qa/run-*/data`，拒绝持久库路径。

覆盖五项：三种主动视图及既有被动；阵容/流派幂等和命令冲突；助阵/仅助阵无主动规则；护盾方案的流派保存恢复、无伪元素攻击、角色恢复与重放；副本锁拒绝新切换且不写回执/流水。

主代理已完成串行运行：新增 `content-pet-r1.database.test.ts` 5 项通过，既有 `zhangjian.database.test.ts` 9 项通过，合计 14 项真实 PG/API 测试通过。复验入口：

```powershell
node tools/vitest-tempdb.mjs tests/content-pet-r1.database.test.ts tests/zhangjian.database.test.ts --maxWorkers=1 --no-file-parallelism
```

本子任务按分工仅编写测试和交接，未自行运行 PG、测试、tsc、构建或浏览器；以上运行结果由主代理提供。三种主动的命中行为由本批独立规则/模拟测试负责，PG/API 测试不替代体感、TTK或云测试服 Grok 联合验收。当前仍未部署，也不据此证明剩余 15 家族、新被动、流派变体和自动“技攻交替”已经完成；风芽鹿仍保留旧攻击被动，未完成设计中的生命被动替换。
