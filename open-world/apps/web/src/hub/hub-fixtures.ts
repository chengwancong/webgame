/**
 * 预览 / 测试用样例数据 —— 仅由 hub-review.ts 与 tests/hub-panels.test.ts 引用，不进入游戏 bundle。
 * 结构按 backend-B0-B4.md §3.1 的节点模板（5 列 × 3 行，风栖 / 雾铃各 10 个节点），
 * 并在测试里用 packages/contracts/hub.ts 的 zod 模式校验，防止字段漂移。
 */
import type {ChartView, ChartRegionView, ChartNodeView, NodeKind, TodayView, HubCommissionsView as CommissionsView, HubPortView as PortView, HubSettlement as HubResultBlock, ChartRegionId} from '../../../../packages/contracts/hub.ts';

type Slot = {slot: string; kind: NodeKind; col: number; row: number; links: string[]; name: string; line: string; drop: string; level: number; minutes: [number, number]; shards: number; challenges: ChartNodeView['challenges']; reward: string[]};

const TEMPLATE: Omit<Slot, 'name' | 'line' | 'drop' | 'level' | 'minutes' | 'shards' | 'challenges' | 'reward'>[] = [
  {slot: 'story-1', kind: 'story', col: 0, row: 1, links: ['story-2', 'story-3', 'nest-1']},
  {slot: 'story-2', kind: 'story', col: 1, row: 1, links: ['story-1', 'nest-2']},
  {slot: 'story-3', kind: 'story', col: 1, row: 2, links: ['story-1', 'nest-3']},
  {slot: 'nest-1', kind: 'nest', col: 1, row: 0, links: ['story-1', 'nest-2', 'hunt']},
  {slot: 'nest-2', kind: 'nest', col: 2, row: 1, links: ['story-2', 'nest-1', 'nest-3', 'tide']},
  {slot: 'nest-3', kind: 'nest', col: 2, row: 2, links: ['story-3', 'nest-2', 'treasure']},
  {slot: 'hunt', kind: 'hunt', col: 3, row: 0, links: ['nest-1', 'gate']},
  {slot: 'tide', kind: 'tide', col: 3, row: 1, links: ['nest-2', 'gate']},
  {slot: 'treasure', kind: 'treasure', col: 3, row: 2, links: ['nest-3', 'gate']},
  {slot: 'gate', kind: 'gate', col: 4, row: 1, links: ['hunt', 'tide', 'treasure']},
];

const SPEC: Record<'wind' | 'mist', Record<string, [string, string, string, number, [number, number], number, ChartNodeView['challenges'], string[]]>> = {
  wind: {
    'story-1': ['落点求生', '醒来时身边只剩一截断桅。', '基础材料', 1, [6, 9], 1, [], ['剑 / 暗器招牌技找回 1']],
    'story-2': ['抢救船台', '船台还在冒烟，得赶在潮水前动手。', '基础材料', 3, [8, 12], 1, [], ['船台声望 +10']],
    'story-3': ['两条进港路', '一条走码头，一条穿货栈。', '基础材料', 4, [8, 12], 2, [], ['法杖招牌技找回 1']],
    'nest-1': ['风车地窖', '磨坊下面的老地窖，传出脚步声。', '地窖材料', 5, [10, 14], 2, ['high'], ['风车地窖奖励']],
    'nest-2': ['沉船货舱', '货舱半浸在水里，箱子还没散。', '货舱材料', 6, [10, 14], 2, ['high'], ['沉船货舱奖励']],
    'nest-3': ['船坞遗址', '倒塌的船坞里有东西在动。', '船坞材料', 7, [12, 16], 3, ['high', 'nightmare'], ['船坞遗址奖励']],
    hunt: ['风车旧井', '井底盘着一只稀有的精英。', '稀有材料', 8, [10, 15], 3, ['high'], ['生命星晶 ×1', '风栖配方 ×1']],
    tide: ['风车地宫', '四波敌人，守住信标。', '怪潮材料', 8, [12, 16], 3, ['high'], ['风栖配方 ×1']],
    treasure: ['风车迷宫', '五个宝箱，限时三分钟。', '金币与饰品', 8, [8, 12], 2, [], ['生命星晶 ×1']],
    gate: ['击退登港先锋', '先锋堵在港口外，不打退就出不了海。', '高级材料', 10, [14, 20], 3, ['high', 'nightmare'], ['三系招牌技找回 2', '开启雾铃']],
  },
  mist: {
    'story-1': ['封印货箱', '灯塔下压着一排封了蜡的货箱。', '基础材料', 12, [10, 14], 2, [], ['雾铃地图残片']],
    'story-2': ['找回信使', '信使在雾里走丢了。', '基础材料', 13, [10, 14], 2, [], ['剑招牌技找回 3']],
    'story-3': ['追踪军需队', '军需队留下的车辙通向两个方向。', '基础材料', 14, [12, 16], 2, [], ['法杖 / 暗器招牌技找回 3']],
    'nest-1': ['雾铃树穴', '树洞里有光。', '树穴材料', 14, [12, 16], 2, ['high'], ['雾铃树穴奖励']],
    'nest-2': ['废弃邮站', '邮站的信箱全被撬开了。', '邮站材料', 15, [12, 16], 3, ['high'], ['废弃邮站奖励']],
    'nest-3': ['军需暗库', '暗库的门锁是新的。', '暗库材料', 16, [14, 18], 3, ['high', 'nightmare'], ['军需暗库奖励']],
    hunt: ['树穴深处', '稀有精英守着树穴最深处。', '稀有材料', 17, [12, 16], 3, ['high'], ['生命星晶 ×1', '雾铃配方 ×1']],
    tide: ['邮站前庭', '四波敌人，守住信标。', '怪潮材料', 17, [12, 16], 3, ['high'], ['雾铃配方 ×1']],
    treasure: ['暗库货架', '五个宝箱，限时三分钟。', '金币与饰品', 17, [8, 12], 2, [], ['生命星晶 ×1']],
    gate: ['截击军需官', '军需官带着最后一车货。', '高级材料', 19, [16, 22], 3, ['high', 'nightmare'], ['三系招牌技找回 4', '开启赤炉']],
  },
};

export type NodeOverride = Partial<Pick<ChartNodeView, 'status' | 'lockReason' | 'firstClearDone' | 'firstClearBonusAvailable' | 'best' | 'recommended' | 'collectible'>>;

export function buildRegion(region: 'wind' | 'mist', status: ChartRegionView['status'], overrides: Record<string, NodeOverride>, extra: Partial<ChartRegionView> = {}): ChartRegionView {
  const names = {wind: '风栖', mist: '雾铃'} as const;
  const nodes = TEMPLATE.map<ChartNodeView>(t => {
    const [name, line, drop, level, minutes, shards, challenges, reward] = SPEC[region][t.slot];
    return {
      id: `${region}-${t.slot}`, region, kind: t.kind, name, line, dungeonId: `${region}-${t.slot}-run`,
      status: 'locked', lockReason: '先通关相邻的节点',
      recommendedLevel: level, estimatedMinutes: minutes,
      firstClearReward: reward, firstClearDone: false, firstClearBonusAvailable: false,
      shardSlots: shards, challenges, publicDropNote: drop, recommended: false,
      links: t.links.map(l => `${region}-${l}`), pos: {col: t.col, row: t.row},
      ...overrides[t.slot],
    };
  });
  return {id: region, name: names[region], levelRange: region === 'wind' ? [1, 10] : [12, 19], status, nodes, ...extra};
}

const SEA_CHOICES: ChartView['seaTier']['choices'] = [
  {tier: 1, name: 'calm', unlocked: true, danger: 1, rewardStars: 1, summary: '平静海域，适合熟悉路线。', level: 1, unlockText: '', monster: {hp: 1, attack: 1}, reward: {xp: 1, gold: 1, material: 1, gear: 1}},
  {tier: 2, name: 'swell', unlocked: true, danger: 2, rewardStars: 2, summary: '浪涌海域，敌人更硬，收获更多。', level: 10, unlockText: '', monster: {hp: 1.3, attack: 1.2}, reward: {xp: 1.3, gold: 1.3, material: 1.2, gear: 1.2}},
  {tier: 3, name: 'storm', unlocked: false, danger: 3, rewardStars: 3, summary: '风暴海域。', level: 20, unlockText: '通关浪涌海域后开放', monster: {hp: 1.7, attack: 1.5}, reward: {xp: 1.7, gold: 1.7, material: 1.5, gear: 1.5}},
];

export function fixtureChart(patch: Partial<ChartView> = {}): ChartView {
  return {
    regions: [
      buildRegion('wind', 'open', {
        'story-1': {status: 'cleared', firstClearDone: true, best: {seconds: 312}},
        'story-2': {status: 'cleared', firstClearDone: true, best: {seconds: 358}},
        'story-3': {status: 'open', lockReason: undefined, recommended: true, firstClearBonusAvailable: true},
        'nest-1': {status: 'cleared', firstClearDone: true, best: {seconds: 480}, collectible: {kind: 'lifeCrystal', owned: true}},
        'nest-2': {status: 'open', lockReason: undefined},
        'nest-3': {status: 'locked', lockReason: '先通关沉船货舱或两条进港路'},
        hunt: {status: 'hidden', lockReason: undefined, collectible: {kind: 'lifeCrystal', owned: false}},
        tide: {status: 'hidden', lockReason: undefined},
        treasure: {status: 'hidden', lockReason: undefined, collectible: {kind: 'lifeCrystal', owned: false}},
        gate: {status: 'locked', lockReason: '完成 3 个剧情节点与关口任务后开放'},
      }, {gateQuest: [{text: '修好船台', done: true}, {text: '清点港口物资', done: false}]}),
      buildRegion('mist', 'locked', {}, {lockReason: '击退登港先锋后开放'}),
    ],
    lastRegion: 'wind',
    seaTier: {current: 1, choices: SEA_CHOICES},
    shards: {slotsUnlocked: 2, owned: [{id: 'shard-swift', name: '疾风残页', effect: '移动速度 +8%', count: 2}, {id: 'shard-iron', name: '铁壁残页', effect: '受到伤害 -6%', count: 1}]},
    bagFull: false,
    ...patch,
  };
}

export const FIXTURE_CHART: ChartView = fixtureChart();

export function fixtureToday(patch: Partial<TodayView> = {}): TodayView {
  return {
    resetAt: '2026-10-22T04:00:00.000Z',
    firstClear: {used: 1, limit: 8},
    commissions: {open: true, active: 2, slots: 3, doneToday: 1, banked: 2},
    dock: {
      open: true,
      fleets: [{fleet: 1, region: 'wind', accruedHours: 4.5, cap: 12}, {fleet: 2, region: null, accruedHours: 0, cap: 12}],
      maxFleets: 2, quickAvailable: true, pendingCollect: true,
    },
    high: {left: 2, limit: 3},
    returnQueue: [],
    ...patch,
  };
}
export const FIXTURE_TODAY: TodayView = fixtureToday();

export function fixtureCommissions(patch: Partial<CommissionsView> = {}): CommissionsView {
  return {
    doneToday: 1, limitToday: 8, banked: 2,
    slots: [
      {id: 'c1', title: '清剿风车地窖', region: 'wind', target: {text: '击败地窖里的敌人', progress: 18, goal: 30}, reward: {xp: 300, gold: 150, rep: 10}, status: 'active'},
      {id: 'c2', title: '打捞货舱箱子', region: 'wind', target: {text: '在沉船货舱开箱', progress: 5, goal: 5}, reward: {xp: 200, gold: 100, rep: 8}, status: 'ready'},
      {id: 'c3', title: '侦察船坞遗址', region: 'wind', target: {text: '抵达船坞遗址深处', progress: 0, goal: 1}, reward: {xp: 500, gold: 250, rep: 20}, status: 'active'},
    ],
    ...patch,
  };
}
export const FIXTURE_COMMISSIONS: CommissionsView = fixtureCommissions();

export function fixturePort(patch: Partial<PortView> = {}): PortView {
  return {
    buildings: [
      {id: 'forge', name: '工坊', npc: '铁拳老格', rep: 120, tiers: [
        {tier: 1, threshold: 100, rewards: ['精炼上限 +1'], claimed: true, claimable: false},
        {tier: 2, threshold: 200, rewards: ['精炼上限 +1', '重铸折扣'], claimed: false, claimable: false},
        {tier: 3, threshold: 400, rewards: ['精炼上限 +1'], claimed: false, claimable: false},
      ]},
      {id: 'shipyard', name: '船台', npc: '造船师娜薇', rep: 260, tiers: [
        {tier: 1, threshold: 100, rewards: ['码头船队 +1'], claimed: true, claimable: false},
        {tier: 2, threshold: 250, rewards: ['船队累积上限提高'], claimed: false, claimable: true},
        {tier: 3, threshold: 500, rewards: ['码头船队 +1'], claimed: false, claimable: false},
      ]},
      {id: 'post', name: '邮局', npc: '信使小跑', rep: 45, tiers: [
        {tier: 1, threshold: 50, rewards: ['委托栏位 +1'], claimed: false, claimable: false},
        {tier: 2, threshold: 150, rewards: ['委托栏位 +1'], claimed: false, claimable: false},
      ]},
    ],
    collectibles: {lifeCrystal: {owned: 3, total: 12}, starCore: {owned: 1, total: 6}},
    systems: [
      {id: 'dock', name: '码头派遣', open: true},
      {id: 'commission', name: '委托板', open: true},
      {id: 'hunt', name: '狩猎', open: false, lockReason: '通关任一巢穴后开放'},
    ],
    ...patch,
  };
}
export const FIXTURE_PORT: PortView = fixturePort();

export const FIXTURE_RESULT: HubResultBlock = {
  nodeId: 'wind-nest-2',
  firstClear: true,
  firstClearRewards: ['沉船货舱奖励', '船台声望 +10'],
  dailyBonus: {applied: true, used: 2, limit: 8},
  collectibles: [{kind: 'lifeCrystal', owned: 4, total: 12}],
  rep: [{building: 'shipyard', delta: 12}, {building: 'forge', delta: 4}],
  unlock: {id: 'wind-nest-3', title: '船坞遗址', text: '新的节点已经在航图上亮起。'},
  retry: {allowed: true},
  next: {nodeId: 'wind-nest-3', name: '船坞遗址'},
};

export const REGION_IDS: ChartRegionId[] = ['wind', 'mist'];
