/**
 * CONTENT-G01 前端接线单元测试。
 * 覆盖：
 * - 宠物卡缺字段时不出现"适合/代价"行，有字段时出现
 * - activeEffect 徽章逻辑（dealsDamage 决定攻击型/辅助型）
 * - classifyPetEvent 各分支（含 followupActions）
 * - doorRowHtml 含来源文字（龙眠两门）
 * 无 DOM、无 Phaser、无服务端调用。
 */
import {describe, it, expect} from 'vitest';
import type {PetView} from '../packages/contracts/zhangjian.ts';
import type {ChartNodeView} from '../packages/contracts/hub.ts';
import {petPanelHtml} from '../apps/web/src/hub/pet-panel.ts';
import {classifyPetEvent, makePetEventState} from '../apps/web/src/hub/pet-event-feedback.ts';
import {doorRowHtml} from '../apps/web/src/hub/chart-panel.ts';

// ---------- 辅助构造 ----------

/** 构造最小合法 PetView（所有必填字段）。 */
function makePet(overrides: Partial<PetView> & Record<string, unknown> = {}): PetView & Record<string, unknown> {
  return {
    family: 'wind-free',
    name: '疾风犬',
    island: 'wind',
    tier: 'free',
    level: 1,
    xp: 0,
    xpNext: 100,
    form: 'young',
    flow: 'blade',
    element: 'physical',
    runtime: 'wind-free-young',
    activeLine: '每 5 秒 · 物理伤害 80%',
    passiveLine: '攻击 +5%',
    ...overrides,
  } as PetView & Record<string, unknown>;
}

/** 构造包含一只宠物的 PetsView 并生成 HTML。 */
function petHtmlWith(petFields: Partial<PetView> & Record<string, unknown>): string {
  const pet = makePet(petFields);
  return petPanelHtml({
    owned: [pet],
    lineup: {active: 'wind-free', support: []},
    catalog: [],
  }, false);
}

/** 构造带 door 字段的最小 ChartNodeView。 */
function makeNodeWithDoor(key: 'mist' | 'rift', keyName: string, keyOwned: boolean, opened: boolean): ChartNodeView {
  return {
    id: 'dragon-gate',
    region: 'dragon',
    kind: 'gate',
    name: '龙眠关口',
    line: '测试节点',
    dungeonId: 'dragon-gate-run',
    status: 'open',
    recommendedLevel: 35,
    estimatedMinutes: [3, 5],
    firstClearReward: [],
    firstClearDone: false,
    firstClearBonusAvailable: false,
    shardSlots: 0,
    challenges: [],
    publicDropNote: '材料',
    recommended: false,
    links: [],
    pos: {col: 4, row: 1},
    door: {id: `dragon-door-1`, key, keyName, keyOwned, opened},
  } as ChartNodeView;
}

// ============================================================
// 1. 宠物卡字段测试
// ============================================================

describe('宠物卡：缺字段不显示适合/代价行', () => {
  it('没有 suitableFor 时 HTML 不包含"适合"标签', () => {
    const html = petHtmlWith({});
    expect(html).not.toContain('pet-card__best');
    // 不应出现"适合"标签（除非来自其他地方）
    expect(html).not.toMatch(/class="pet-card__best"/);
  });

  it('没有 tradeoff 时 HTML 不包含"代价"行', () => {
    const html = petHtmlWith({});
    expect(html).not.toContain('pet-card__cost');
  });

  it('有 suitableFor 时显示适合行', () => {
    const html = petHtmlWith({suitableFor: '野外遭遇战'} as Record<string, unknown>);
    expect(html).toContain('pet-card__best');
    expect(html).toContain('适合');
    expect(html).toContain('野外遭遇战');
  });

  it('有 tradeoff 时显示代价行', () => {
    const html = petHtmlWith({tradeoff: '减少 10% 暴击率'} as Record<string, unknown>);
    expect(html).toContain('pet-card__cost');
    expect(html).toContain('代价');
    expect(html).toContain('减少 10% 暴击率');
  });

  it('activeLine 直接显示在卡片中', () => {
    const html = petHtmlWith({activeLine: '每 5 秒 · 物理伤害 80%'});
    expect(html).toContain('每 5 秒 · 物理伤害 80%');
  });

  it('passiveLine 显示在"被动"行', () => {
    const html = petHtmlWith({passiveLine: '攻击 +5%'});
    expect(html).toContain('被动');
    expect(html).toContain('攻击 +5%');
  });

  it('skillName 有值时作为加粗前缀出现在 activeLine 之前', () => {
    const html = petHtmlWith({skillName: '闪击', activeLine: '每 5 秒造成伤害'});
    expect(html).toContain('<b>闪击</b>');
    expect(html).toContain('每 5 秒造成伤害');
  });
});

describe('宠物卡：activeEffect 徽章', () => {
  it('没有 activeEffect 时不显示徽章', () => {
    const html = petHtmlWith({});
    expect(html).not.toContain('pet-role-badge');
    expect(html).not.toContain('攻击型');
    expect(html).not.toContain('辅助型');
  });

  it('activeEffect.dealsDamage=true 显示"攻击型"徽章', () => {
    const html = petHtmlWith({
      activeEffect: {kind: 'nova', intervalSeconds: 5, dealsDamage: true, damageElement: 'physical', damageRatios: [0.8], targetLimit: null},
    } as Record<string, unknown>);
    expect(html).toContain('pet-role-badge');
    expect(html).toContain('攻击型');
  });

  it('activeEffect.dealsDamage=false 显示"辅助型"徽章', () => {
    const html = petHtmlWith({
      activeEffect: {kind: 'shield', intervalSeconds: 8, dealsDamage: false, damageElement: null, damageRatios: [], targetLimit: null, shieldPercent: 0.15, durationSeconds: 6},
    } as Record<string, unknown>);
    expect(html).toContain('pet-role-badge');
    expect(html).toContain('辅助型');
  });

  it('activeEffect.kind 种类小字出现在徽章中（范围→"范围"）', () => {
    const html = petHtmlWith({
      activeEffect: {kind: 'area', intervalSeconds: 5, dealsDamage: true, damageElement: 'fire', damageRatios: [0.6], targetLimit: 3},
    } as Record<string, unknown>);
    expect(html).toContain('范围');
  });

  it('chain 种类小字"连锁"出现在徽章中', () => {
    const html = petHtmlWith({
      activeEffect: {kind: 'chain', intervalSeconds: 4, dealsDamage: true, damageElement: 'lightning', damageRatios: [0.5, 0.35], targetLimit: 3},
    } as Record<string, unknown>);
    expect(html).toContain('连锁');
  });

  it('已拥有列表项中也带 activeEffect 徽章', () => {
    const html = petHtmlWith({
      activeEffect: {kind: 'shield', intervalSeconds: 8, dealsDamage: false, damageElement: null, damageRatios: [], targetLimit: null, shieldPercent: 0.15, durationSeconds: 6},
    } as Record<string, unknown>);
    // 面板 HTML 里应包含辅助型（来自已拥有列表或卡片）
    expect(html).toContain('辅助型');
  });
});

// ============================================================
// 2. classifyPetEvent 测试
// ============================================================

describe('classifyPetEvent', () => {
  it('非 pet- ruleId 的 effect_triggered 返回 null', () => {
    const state = makePetEventState();
    const result = classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'skill-fire-nova', action: 'nova', tick: 10},
      state,
    );
    expect(result).toBeNull();
  });

  it('pet- ruleId + nova action 返回 attack', () => {
    const state = makePetEventState();
    const result = classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-wind-free-01', action: 'nova', tick: 10},
      state,
    );
    expect(result).toBe('attack');
  });

  it('pet- ruleId + arc action 返回 chain', () => {
    const state = makePetEventState();
    const result = classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-dragon-heavy-01', action: 'arc', tick: 20},
      state,
    );
    expect(result).toBe('chain');
  });

  it('pet- ruleId + followupActions 含 arc → 返回 chain', () => {
    const state = makePetEventState();
    // GPT 连锁宠物实现：主 action 为 nova，后跟 arc
    const result = classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-rift-heavy-01', action: 'nova', followupActions: ['arc'], tick: 25},
      state,
    );
    expect(result).toBe('chain');
  });

  it('pet- ruleId + followupActions 不含 arc，action 也不是 arc → 返回 attack', () => {
    const state = makePetEventState();
    const result = classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-forge-light-01', action: 'nova', followupActions: ['buff'], tick: 30},
      state,
    );
    expect(result).toBe('attack');
  });

  it('pet- ruleId + shield action 返回 shield-cast 并记录 tick', () => {
    const state = makePetEventState();
    const result = classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-mist-light-01', action: 'shield', tick: 30},
      state,
    );
    expect(result).toBe('shield-cast');
    expect(state.lastPetShieldTick).toBe(30);
  });

  it('shielded applied + amount>0 且 tick 在 ≤2 内返回 shield-applied', () => {
    const state = makePetEventState();
    // 先触发 shield-cast
    classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-mist-light-01', action: 'shield', tick: 30},
      state,
    );
    // 同 tick 的 shielded applied
    const result = classifyPetEvent(
      {type: 'shielded', shieldPhase: 'applied', amount: 500, tick: 30},
      state,
    );
    expect(result).toBe('shield-applied');
  });

  it('shielded applied + tick 差 2 也返回 shield-applied', () => {
    const state = makePetEventState();
    classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-mist-light-01', action: 'shield', tick: 30},
      state,
    );
    const result = classifyPetEvent(
      {type: 'shielded', shieldPhase: 'applied', amount: 200, tick: 32},
      state,
    );
    expect(result).toBe('shield-applied');
  });

  it('shielded applied + tick 差 3 返回 null（超出关联窗口）', () => {
    const state = makePetEventState();
    classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-mist-light-01', action: 'shield', tick: 30},
      state,
    );
    const result = classifyPetEvent(
      {type: 'shielded', shieldPhase: 'applied', amount: 200, tick: 33},
      state,
    );
    expect(result).toBeNull();
  });

  it('shielded applied + amount=0 返回 null（金额为 0 不触发反馈）', () => {
    const state = makePetEventState();
    classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-mist-light-01', action: 'shield', tick: 30},
      state,
    );
    const result = classifyPetEvent(
      {type: 'shielded', shieldPhase: 'applied', amount: 0, tick: 30},
      state,
    );
    expect(result).toBeNull();
  });

  it('shielded absorbed 不返回 shield-applied', () => {
    const state = makePetEventState();
    classifyPetEvent(
      {type: 'effect_triggered', ruleId: 'pet-mist-light-01', action: 'shield', tick: 30},
      state,
    );
    const result = classifyPetEvent(
      {type: 'shielded', shieldPhase: 'absorbed', amount: 100, tick: 30},
      state,
    );
    expect(result).toBeNull();
  });

  it('未触发过 shield-cast 时 shielded applied 返回 null', () => {
    const state = makePetEventState();
    const result = classifyPetEvent(
      {type: 'shielded', shieldPhase: 'applied', amount: 500, tick: 10},
      state,
    );
    expect(result).toBeNull();
  });
});

// ============================================================
// 3. doorRowHtml：来源文字（龙眠两门）
// ============================================================

describe('doorRowHtml：钥匙来源', () => {
  it('mist 钥匙（铃钥）显示"截击军需官首通"', () => {
    const node = makeNodeWithDoor('mist', '铃钥', false, false);
    const html = doorRowHtml(node);
    expect(html).toContain('来源：');
    // mist-gate 节点名为"截击军需官"
    expect(html).toContain('首通');
    expect(html).toContain('截击军需官');
  });

  it('rift 钥匙（星钥）显示"击败前线督军首通"', () => {
    const node = makeNodeWithDoor('rift', '星钥', false, false);
    const html = doorRowHtml(node);
    expect(html).toContain('来源：');
    expect(html).toContain('首通');
    expect(html).toContain('击败前线督军');
  });

  it('未获得时显示"需要 铃钥（未获得）"', () => {
    const node = makeNodeWithDoor('mist', '铃钥', false, false);
    const html = doorRowHtml(node);
    expect(html).toContain('需要 铃钥（未获得）');
  });

  it('已获得时显示"已获得 铃钥"', () => {
    const node = makeNodeWithDoor('mist', '铃钥', true, false);
    const html = doorRowHtml(node);
    expect(html).toContain('已获得 铃钥');
  });

  it('已开启时显示"已开启"', () => {
    const node = makeNodeWithDoor('mist', '铃钥', true, true);
    const html = doorRowHtml(node);
    expect(html).toContain('已开启');
  });

  it('没有 door 字段时返回空字符串', () => {
    const node = makeNodeWithDoor('mist', '铃钥', false, false);
    const nodeNoDoor = {...node, door: undefined};
    const html = doorRowHtml(nodeNoDoor as ChartNodeView);
    expect(html).toBe('');
  });
});
