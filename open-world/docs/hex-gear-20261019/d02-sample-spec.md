# HEX-D02 可实施样板规格

> 设计版本：D02-v1（2026-10-19）
> 负责人：Claude
> 状态：U-01～U-07 已于 2026-10-19 由用户决定（见 design.md 7.1），可交 Codex 实现样板
> 依赖：HEX-D01（初稿完成）、HEX-B01（后端盘点完成）

## 一、样板选定

**样板**：HEX-01「连锁闪电」（Chain Lightning）

选择理由：
1. `arc` action 已有真实执行——`augments.json` 中的「万物传导」（aug-p-arc）使用完全相同的 `hit → arc` 模式
2. `hit` 触发是最稳定的效果入口，ICD 与概率控制成熟
3. 视觉反馈明显，可直接复用雷电弹射特效
4. 数值维度清晰（弹射次数、衰减、伤害比），便于 TTK 推导校验

## 二、数据定义（精确字段）

### 2.1 HEX 数据源建议

新增 `packages/content/hex-runes.json`，结构参考 `aspects.json` 的 `parts.rules` 字段。

样板条目（HEX-01 连锁闪电，普通品质）：

```json
{
  "id": "hex-chain-lightning",
  "name": "连锁闪电",
  "description": "命中时30%概率释放连锁闪电，弹射到附近3个敌人，每次弹射衰减30%。",
  "category": "attack",
  "icon": "hex-chain-lightning",
  "exclusiveGroup": "chain-lightning",
  "tiers": {
    "common": {
      "requiredLevel": 10,
      "rules": [
        {
          "id": "hex-chain-lightning-c",
          "name": "连锁闪电",
          "description": "命中时30%概率释放连锁闪电，弹射3次，各50%伤害。",
          "source": "hex-chain-lightning",
          "tier": 1,
          "trigger": "hit",
          "chance": 0.3,
          "icd": 60,
          "filter": {},
          "when": [],
          "action": {
            "type": "arc",
            "ratio": 0.5,
            "count": 3,
            "range": 4,
            "damageType": "lightning",
            "decay": 0.7
          },
          "scale": [],
          "vfxKey": "hex/chain-lightning"
        }
      ]
    },
    "magic": {
      "requiredLevel": 15,
      "rules": [
        {
          "id": "hex-chain-lightning-m",
          "name": "连锁闪电",
          "description": "命中时35%概率释放连锁闪电，弹射4次，各55%伤害。",
          "source": "hex-chain-lightning",
          "tier": 2,
          "trigger": "hit",
          "chance": 0.35,
          "icd": 60,
          "filter": {},
          "when": [],
          "action": {
            "type": "arc",
            "ratio": 0.55,
            "count": 4,
            "range": 4,
            "damageType": "lightning",
            "decay": 0.7
          },
          "scale": [],
          "vfxKey": "hex/chain-lightning"
        }
      ]
    },
    "rare": {
      "requiredLevel": 20,
      "rules": [
        {
          "id": "hex-chain-lightning-r",
          "name": "连锁闪电",
          "description": "命中时40%概率释放连锁闪电，弹射5次，各60%伤害，减速命中目标。",
          "source": "hex-chain-lightning",
          "tier": 3,
          "trigger": "hit",
          "chance": 0.4,
          "icd": 60,
          "filter": {},
          "when": [],
          "action": {
            "type": "arc",
            "ratio": 0.6,
            "count": 5,
            "range": 5,
            "damageType": "lightning",
            "decay": 0.7
          },
          "scale": [],
          "vfxKey": "hex/chain-lightning"
        },
        {
          "id": "hex-chain-lightning-e-slow",
          "name": "连锁闪电 · 感电",
          "description": "连锁闪电命中时施加减速。",
          "source": "hex-chain-lightning",
          "tier": 3,
          "trigger": "hit",
          "chance": 1,
          "icd": 60,
          "filter": { "fromEffect": "hex-chain-lightning-r" },
          "when": [],
          "action": {
            "type": "status",
            "ref": "hit",
            "status": "chill",
            "duration": 60,
            "strength": 0.2,
            "ratio": 0
          },
          "scale": [],
          "vfxKey": "hex/chain-lightning-slow"
        }
      ]
    },
    "legendary": {
      "requiredLevel": 25,
      "rules": [
        {
          "id": "hex-chain-lightning-l",
          "name": "连锁闪电",
          "description": "命中时45%概率释放连锁闪电，弹射6次，各65%伤害，减速且有概率感电。",
          "source": "hex-chain-lightning",
          "tier": 4,
          "trigger": "hit",
          "chance": 0.45,
          "icd": 60,
          "filter": {},
          "when": [],
          "action": {
            "type": "arc",
            "ratio": 0.65,
            "count": 6,
            "range": 5,
            "damageType": "lightning",
            "decay": 0.7
          },
          "scale": [],
          "vfxKey": "hex/chain-lightning"
        },
        {
          "id": "hex-chain-lightning-l-shock",
          "name": "连锁闪电 · 雷击",
          "description": "连锁闪电命中时施加感电减速。",
          "source": "hex-chain-lightning",
          "tier": 4,
          "trigger": "hit",
          "chance": 1,
          "icd": 60,
          "filter": { "fromEffect": "hex-chain-lightning-l" },
          "when": [],
          "action": {
            "type": "status",
            "ref": "hit",
            "status": "shock",
            "duration": 90,
            "strength": 0.25,
            "ratio": 0
          },
          "scale": [],
          "vfxKey": "hex/chain-lightning-shock"
        }
      ]
    }
  }
}
```

### 2.2 字段说明

| 字段 | 含义 | 约束 |
|---|---|---|
| `id` | HEX 机制唯一标识 | `hex-` 前缀，全局唯一 |
| `category` | 分类：`attack`/`defense`/`mobility`/`resource` | 仅影响 UI 分类展示 |
| `exclusiveGroup` | 互斥组名 | 同组不可同时装备 |
| `tiers.{quality}.rules` | 该品质下的 EffectRule 数组 | 复用现有 `EffectRule` schema |
| `tiers.{quality}.requiredLevel` | 该品质的最低装备等级 | 服务端校验 |

### 2.3 与现有数据的关系

参照物——`augments.json` 中「万物传导」（aug-p-arc）：
```json
{
  "trigger": "hit",
  "chance": 0.3,
  "icd": 0,
  "action": { "type": "arc", "ratio": 0.5, "count": 2, "range": 5, "damageType": "lightning" }
}
```

HEX-01 样板与之差异：
- 增加 ICD 60 ticks（2秒），防止高攻速下过度触发
- 弹射次数更多（3→6 随品质），但每跳衰减 0.7
- 高品质附加减速/感电状态

## 三、后端集成规格

### 3.1 新增槽位（U-01 已定：方案 B，2 个独立槽）

已定方案 B（2 个独立槽位），后端需要：

1. **gear-slots.ts** 扩展：
   ```ts
   export const gearSlots = ['weapon','armor','helmet','boots','accessory','ring','core','hex1','hex2'] as const;
   ```

2. **CharacterState.equipment** 自动支持新槽位（`Partial<Record<Slot, string>>`）

3. **存档迁移**：旧存档无 `hex1`/`hex2` 字段，`Partial` 已覆盖缺省——无需数据迁移，只需 `protocol_version` 升级声明新槽位可选

### 3.2 构筑解析入口

`build-parts.ts` 的 `collectBuildParts` 需新增 HEX 规则收集：

```ts
// 在 collectBuildParts 中，sourceRules 计算之后：
const hexRules = collectHexRules(worn, s.equipment);
// hexRules 汇入最终 rules 数组
```

`collectHexRules` 逻辑：
1. 从 `s.equipment.hex1` / `s.equipment.hex2` 读取装备 ID
2. 在 `s.gear` 中找到对应 Gear 实例
3. 从 `hex-runes.json` 查找对应机制和品质
4. 返回该品质的 `rules` 数组，每条规则的 `source` 设为 HEX 实例 ID

### 3.3 装备命令

复用已有装备穿脱命令，新增 `hex1`/`hex2` 作为合法槽位：
- `equip { slot: 'hex1', gearId: '...' }` → 穿戴
- `unequip { slot: 'hex1' }` → 卸下
- 互斥校验：同一 `exclusiveGroup` 不可同时出现在 hex1 和 hex2

### 3.4 物品实例

HEX 散件作为 `Gear` 实例存储在 `CharacterState.gear` 中，与普通装备共享工厂。区分方式：
- `Gear.base` 指向 `hex-runes.json` 中的 ID
- **品质直接复用已有 `Gear.quality: GearQuality`（common/magic/rare/legendary，显示 普通/魔法/稀有/传说）**，不新增 `hexTier` 字段、不新增 epic 枚举（2026-10-19 修订：避免平行品质体系，颜色/标签/分解保护规则直接沿用）
- 不用旧 `Gear.effect` 枚举表达 HEX 机制（B01 建议）；`effect` 填现有中性值，机制只来自 hex-runes.json 规则

### 3.5 掉落与获取

HEX 散件的掉落走已有加权掉落系统，配置在唯一源中：
- 掉落权重、品质概率、等级门槛由内容源声明
- 客户端不知道掉落候选，服务端决定后推送结果
- U-04 已定：掉落为主（野外精英、首领、副本，品质随来源难度提高；不加商店/任务/制作）；U-05 可分解不可交易；U-03 不升品；U-06 不可强化。具体权重样板后定

## 四、客户端数据与事件消费

### 4.1 内容包

`GET /api/content` 返回 HEX 公开目录：
```json
{
  "hexRunes": [
    {
      "id": "hex-chain-lightning",
      "name": "连锁闪电",
      "description": "...",
      "category": "attack",
      "icon": "hex-chain-lightning",
      "exclusiveGroup": "chain-lightning",
      "tiers": {
        "common": { "requiredLevel": 10, "description": "命中时30%概率释放连锁闪电..." },
        "magic": { "requiredLevel": 15, "description": "..." },
        "rare": { "requiredLevel": 20, "description": "..." },
        "legendary": { "requiredLevel": 25, "description": "..." }
      }
    }
  ]
}
```

注意：客户端包只含展示信息（名称、描述、图标、等级需求），不含具体规则参数。

### 4.2 角色快照

`GET /api/character` snapshot 中：
```json
{
  "equipment": {
    "weapon": "gear-123",
    "hex1": "gear-456",
    "hex2": null
  },
  "stats": {
    "rules": [
      { "id": "hex-chain-lightning-c", "trigger": "hit", "..." : "..." }
    ]
  }
}
```

HEX 规则已通过 `resolveBuild` 汇入 `Stats.rules`，客户端无需单独解析。

### 4.3 战斗事件

HEX 效果触发时，服务端推送已有 `CombatEvent`：
```json
{
  "type": "effect_triggered",
  "source": "hex-chain-lightning-c",
  "trigger": "hit",
  "action": "arc",
  "targets": ["enemy-1", "enemy-2", "enemy-3"]
}
```

客户端根据 `source` 前缀 `hex-` 识别为 HEX 效果，播放对应特效。弹射目标从 `targets` 读取，依次播放闪电特效。

### 4.4 穿脱交互

1. 打开 HEX 装备界面 → 读取背包中 `base` 以 `hex-` 开头的物品
2. 拖拽/点击装备到 hex1/hex2 槽 → 发送 `equip` 命令
3. 服务端校验（等级、互斥、槽位有效性）→ 返回新 snapshot
4. 客户端刷新 HEX 槽位显示与构筑预览

## 五、验收案例

### 5.1 数据校验

| # | 操作 | 预期结果 |
|---|---|---|
| T01 | `pnpm content` 包含 hex-runes.json | 无校验错误，HEX 条目被正确解析 |
| T02 | HEX-01 普通品质的 rules 通过 `effectRuleSchema` | schema 校验通过 |
| T03 | 4 个品质的 `arc.count` 分别为 3/4/5/6 | 品质梯度正确 |

### 5.2 构筑集成

| # | 操作 | 预期结果 |
|---|---|---|
| T04 | 角色装备 HEX-01(common) 到 hex1 | `Stats.rules` 含 `hex-chain-lightning-c` |
| T05 | 同时装备 HEX-01 到 hex1 和 hex2 | 被拒绝（同 exclusiveGroup 互斥） |
| T06 | 装备 HEX-01(hex1) + HEX-04(hex2) | 两条规则均出现在 `Stats.rules` |
| T07 | 卸下 hex1 | 该规则从 `Stats.rules` 移除 |
| T08 | 等级不足时装备高品质 HEX | 被拒绝，返回合适错误码 |

### 5.3 战斗触发

| # | 操作 | 预期结果 |
|---|---|---|
| T09 | 装备 HEX-01(common)，命中敌人 | 约 30% 概率触发 `effect_triggered` 事件 |
| T10 | 连续快速命中（<2秒间隔） | ICD 60 ticks 内第二次不触发 |
| T11 | 弹射目标周围有 3 个敌人 | 依次弹射 3 个目标，伤害逐跳衰减 |
| T12 | 弹射范围（4格）内无其他敌人 | 仅命中原始目标，不弹射 |
| T13 | 换装卸下 HEX-01（战斗中） | 已触发的弹射完成，后续不再触发 |

### 5.4 存档兼容

| # | 操作 | 预期结果 |
|---|---|---|
| T14 | 旧存档（无 hex1/hex2）加载 | 正常加载，HEX 槽位为空 |
| T15 | 新存档保存后降级协议版本 | hex 字段被忽略，不影响旧客户端 |

### 5.5 客户端表现（F01 前置准备）

| # | 操作 | 预期结果 |
|---|---|---|
| T16 | 收到 `effect_triggered` arc 事件 | 播放闪电弹射特效（目标间依次连线） |
| T17 | HEX 装备界面显示 | 六角形图标、名称、品质色、机制描述 |
| T18 | 构筑预览显示 HEX 效果 | 效果描述出现在构筑面板 |

## 六、数值参数来源

所有数值为初始提案，最终确定需要：
1. **TTK 推导**：按 `balance = TTK derivation` 原则，从目标击杀时间 × 玩家等级输出反推 HEX 效果的伤害贡献比重
2. **战斗模拟验证**：使用 `pnpm test:core` 中的战斗模拟，验证 HEX 效果在不同构筑下的实际 DPS 贡献
3. **用户试玩确认**：数值调整后保留试玩环节

当前参数梯度设计思路：
- 普通 → 传说：概率 +5% 每级，弹射 +1 每级，伤害比 +5% 每级
- ICD 固定 60 ticks 不随品质变化（防止高品质过度触发）
- 衰减固定 0.7（控制远端弹射的总伤害贡献）

## 七、已确定 / 建议 / 待用户确认

### 已确定

- 样板选 HEX-01 连锁闪电（`hit → arc`）
- 完全复用现有 `EffectRule` schema，无需新增触发或动作
- 数据源为新增 `hex-runes.json`，不侵入现有 aspects/augments
- 客户端消费 `Stats.rules` 和 `CombatEvent`，不复制执行逻辑
- 互斥按 `exclusiveGroup` 同组禁止，跨组允许

### 建议（D01 已提出，需用户确认后成为确定）

- 2 个独立 HEX 槽位（hex1/hex2）
- 4 品质梯度，复用 GearQuality：common/magic/rare/legendary（普通/魔法/稀有/传说）
- 六角形底+机制符号图标风格

### 待用户确认

- U-01～U-07 已决定（见 design.md 7.1）；仍待定：槽位解锁等级、互斥关系、品质数值（TTK 推导）、掉落权重
- 稀有/传说品质的附加效果（减速/感电）是否合适
- 具体数值需 TTK 推导后用户确认

## 八、给 Codex 的后端任务（HEX-B02 交接）

### 目标

实现 HEX-01 连锁闪电样板的后端机制，使其可在真实战斗中触发并产生预期效果。

### 需要后端做的事

1. **新增 `hex-runes.json`** 内容源（按上述格式），初始只含 HEX-01 四个品质
2. **扩展 `gear-slots.ts`**：新增 `hex1`/`hex2` 槽位（若用户确认方案 B）
3. **扩展 `build-parts.ts`**：新增 `collectHexRules` 函数，从 HEX 槽位读取规则汇入构筑
4. **装备命令**：hex1/hex2 的 equip/unequip 走已有路径，新增互斥校验
5. **Gear 实例**：HEX 散件实例的创建/存储/加载
6. **内容接口**：`GET /api/content` 包含 HEX 公开目录
7. **测试**：
   - `hex-runes.json` schema 校验
   - `collectHexRules` 单元测试
   - 互斥校验
   - 战斗触发（`hit → arc`，概率、ICD、弹射）
   - 换装/卸下/死亡/checkpoint 恢复
   - 旧存档兼容
8. **protocol_version** 升级声明

### 不需要后端做的事

- 不改已有 EffectRule 执行器（arc 已支持）
- 不改已有战斗模拟管线
- 不改已有存档迁移
- 不新增效果类型

### 验收

- B02 完成后，Claude 进入 F01（前端展示与交互），随后 V01（端到端验收）
- B02 交付时须附：protocol_version、真实请求/响应样例、错误码、兼容策略
