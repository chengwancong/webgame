/**
 * Z3 宠物战斗事件分类（纯函数，方便单测）。
 * 根据 CombatEvent 与持久状态，判断该事件与宠物的关系类型。
 * 不依赖 Phaser/DOM，可在 vitest 环境直接测试。
 */

/** 宠物 EffectAction 中造成实际伤害的类型（来自 packages/contracts/effects.ts effectActionSchema）。 */
const PET_DAMAGE_ACTIONS = new Set([
  'homing',    // 自制追踪弹
  'nova',      // 范围爆发
  'shards',    // 碎片
  'arc',       // 连锁闪电（同时也标记 chain）
  'field',     // 场地区域
  'detonate',  // 引爆
  'echo',      // 回响（重复某技能造成伤害）
]);

export type PetEventKind = 'attack' | 'chain' | 'shield-cast' | 'shield-applied';

/**
 * classifyPetEvent 所需的可变状态（调用方维护，单局游戏内持久化）。
 * lastPetShieldTick：最近一次宠物 shield-cast 触发时的 tick，-999 表示从未触发。
 */
export interface PetEventState {
  lastPetShieldTick: number;
}

/** 创建初始 PetEventState。 */
export function makePetEventState(): PetEventState {
  return {lastPetShieldTick: -999};
}

/**
 * 分类单个战斗事件与宠物的关系。
 *
 * 返回值：
 * - 'attack'：伤害类宠物动作（homing/nova/shards/field/detonate/echo 等）→ 播放攻击动画
 * - 'chain'：连锁动作（arc）→ 播放攻击动画 + 连锁轻量反馈
 * - 'shield-cast'：宠物施放了护盾动作 → 播放施法动画，并记录 tick 用于后续关联
 * - 'shield-applied'：护盾实际生效（与最近宠物 shield-cast 同 tick 或 ≤2 tick 内）
 * - null：与宠物无关、或无需特殊处理的事件
 *
 * 注意：effect_triggered 的 amount 始终为 0；真实伤害数字来自后续 hit_resolved。
 * 不要依赖 effect_triggered 的 amount 来决定是否显示伤害飘字。
 */
export function classifyPetEvent(
  event: {
    type: string;
    ruleId?: string;
    action?: string;
    /** GPT 实现的连锁宠物：主 action 为 nova，后跟 arc；通过此字段传递后续动作列表。 */
    followupActions?: string[];
    shieldPhase?: string;
    amount?: number;
    tick: number;
  },
  state: PetEventState,
): PetEventKind | null {
  // 宠物规则触发事件
  if (event.type === 'effect_triggered' && event.ruleId?.startsWith('pet-')) {
    const action = event.action ?? '';
    const followups = event.followupActions ?? [];

    // arc 连锁：直接 arc 动作，或 followupActions 包含 arc（如 nova+arc 组合）
    if (action === 'arc' || followups.includes('arc')) {
      return 'chain';
    }
    if (action === 'shield') {
      // 记录触发时 tick，用于后续关联 shielded 事件
      state.lastPetShieldTick = event.tick;
      return 'shield-cast';
    }
    // 其他伤害类动作（以及未识别动作，保守地触发攻击动画，与原有行为一致）
    return 'attack';
  }

  // 护盾生效事件：判断是否关联到宠物
  if (
    event.type === 'shielded' &&
    event.shieldPhase === 'applied' &&
    (event.amount ?? 0) > 0
  ) {
    // 同 tick 或 ≤2 tick 内视为宠物护盾触发的生效
    if (Math.abs(event.tick - state.lastPetShieldTick) <= 2) {
      return 'shield-applied';
    }
  }

  return null;
}
