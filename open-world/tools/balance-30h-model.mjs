// 30小时数值模型：从“目标游玩时间”反推经验、装备、怪物与经济。
// 只做设计计算，不读写游戏数据。运行：node tools/balance-30h-model.mjs [--json]
import {readFileSync} from 'node:fs';
// 等级基础属性来自正式等级属性表，与服务端一致。
const levelRows = JSON.parse(readFileSync(new URL('../packages/content/level-stats.json', import.meta.url), 'utf8')).levels;
const levelBase = L => levelRows[Math.min(levelRows.length, Math.max(1, Math.round(L))) - 1];
const P = {
  hoursToCap: 30, cap: 50,
  timeExponent: 0.8,            // 每级用时 ∝ L^0.8：前期快、后期慢但不断崖
  activeShare: 0.8,             // 实际战斗时间占比（对话、整理、跑图占20%）
  killsPerMinute: 10,           // 普通怪当量/分钟（精英=2.5，首领另计）
  questShareMain: 0.3,          // 主线期（≤36级）剧情/任务经验占比
  questShareEnd: 0.2,           // 后期挑战首通/悬赏经验占比
  xpKill: L => Math.round(10 * 1.12 ** (L - 1)),
  goldKill: L => Math.round(6 * 1.09 ** (L - 1)),
  // 装备阶段：每章一个阶段，后期两个
  tiers: [
    {tier: 1, level: 1, scale: 1}, {tier: 2, level: 10, scale: 1.7}, {tier: 3, level: 17, scale: 2.8},
    {tier: 4, level: 23, scale: 4.4}, {tier: 5, level: 28, scale: 6.8}, {tier: 6, level: 33, scale: 10.5},
    {tier: 7, level: 38, scale: 16}, {tier: 8, level: 45, scale: 24},
  ],
  quality: { // 主属性倍率、词缀数、强化上限
    common: {name: '普通(白)', primary: 1.0, affix: [0, 0], maxRank: 5},
    magic: {name: '魔法(蓝)', primary: 1.1, affix: [1, 2], maxRank: 8},
    rare: {name: '稀有(黄)', primary: 1.2, affix: [3, 4], maxRank: 10},
    legendary: {name: '传奇(橙)', primary: 1.3, affix: [4, 4], maxRank: 12, unique: 1},
    ancient: {name: '太古(红)', primary: 1.5, affix: [5, 5], maxRank: 15, unique: 1},
  },
  rankBonus: 0.08,
  attackParts: 9 + 2 + 1,       // 武器+项链+戒指主属性(攻击)，来自 equipment-runtime.json
  // 期望穿戴：[等级, 平均主属性品质倍率, 平均强化等级, 每件期望攻击词缀(以T1基础值3.5为单位), 深度养成攻击加成]
  worn: [[1,1.0,0,0,0],[5,1.05,1,.2,0],[9,1.1,2,.35,0],[16,1.15,4,.5,0],[22,1.2,6,.7,.1],[27,1.24,7,.8,.2],[32,1.27,8,.9,.35],[36,1.3,9,1,.5],[40,1.32,10,1.1,.7],[45,1.36,11,1.2,.9],[50,1.4,12,1.3,1.2]],
  ttkNormalAttacks: 4.3,        // 普通怪=4.3次“期望攻击”（现1级 90HP / 21攻 的比例）
  monsterHitShare: 0.045,       // 普通怪单击≈期望生命的4.5%（现1级 9 / 198）
  chapters: [
    {id: 'ss-c01', name: '风栖岛'}, {id: 'ss-c02', name: '雾铃岛'}, {id: 'ss-c03', name: '赤炉岛'},
    {id: 'ss-c04', name: '霜镜岛'}, {id: 'ss-c05', name: '沉星岛'}, {id: 'ss-c06', name: '龙眠岛'},
  ],
  chapterHours: [0, 1.5, 4, 7, 10.5, 14, 18],
};
const lerp = (rows, L, i) => { let a = rows[0], b = rows.at(-1); for (let k = 0; k < rows.length - 1; k++) if (L >= rows[k][0] && L <= rows[k + 1][0]) { a = rows[k]; b = rows[k + 1]; break; } const t = b[0] === a[0] ? 0 : (L - a[0]) / (b[0] - a[0]); return a[i] + (b[i] - a[i]) * t; };
const tierAt = L => [...P.tiers].reverse().find(t => L >= t.level);
// 1) 每级分钟：a·L^k，a 使 1→50 总计 30 小时
const raw = L => L ** P.timeExponent; let rawSum = 0; for (let L = 1; L < P.cap; L++) rawSum += raw(L);
const a = P.hoursToCap * 60 / rawSum;
const minutes = L => a * raw(L);
const cumulative = []; { let m = 0; for (let L = 1; L <= P.cap; L++) { cumulative[L] = m; m += minutes(L); } }
const levelAtHour = h => { for (let L = 1; L <= P.cap; L++) if (cumulative[L] / 60 > h) return L - 1 + (h * 60 - cumulative[L - 1]) / minutes(L - 1); return P.cap; };
// 2) 经验阈值 = 每级分钟 × 每分钟经验 / (1-任务占比)
const xpPerMinuteFromKills = L => P.activeShare * P.killsPerMinute * P.xpKill(L);
const questShare = L => L <= 36 ? P.questShareMain : P.questShareEnd;
const threshold = L => Math.round(minutes(L) * xpPerMinuteFromKills(L) / (1 - questShare(L)) / 10) * 10;
// 3) 期望角色
const player = L => {
  const t = tierAt(L), q = lerp(P.worn, L, 1), r = lerp(P.worn, L, 2), aff = lerp(P.worn, L, 3), deep = lerp(P.worn, L, 4);
  const gear = P.attackParts * t.scale * q * (1 + P.rankBonus * r) + 6 * aff * 3.5 * t.scale * 0.35; // 约35%的词缀是攻击类
  const base = levelBase(L);
  const attack = (base.attack + gear) * (1 + deep);
  const hp = (base.hp + 6 * aff * 17 * t.scale * 0.35) * (1 + deep * 0.6);
  return {attack, hp, tier: t.tier, quality: q, rank: r, deep};
};
const monster = L => { const p = player(L); return {hp: p.attack * P.ttkNormalAttacks, attack: p.hp * P.monsterHitShare}; };
const fmt = (x, d = 0) => Number(x.toFixed(d)).toLocaleString('en-US');
// 输出
const out = {params: {a}, levels: [], chapters: []};
for (let L = 1; L <= P.cap; L++) { const p = player(L), m = monster(L); out.levels.push({L, minutes: minutes(L), hourAt: cumulative[L] / 60, threshold: threshold(L), xpKill: P.xpKill(L), goldKill: P.goldKill(L), tier: p.tier, attack: p.attack, hp: p.hp, mHp: m.hp, mAtk: m.attack}); }
P.chapterHours.forEach((h, i) => { if (i < 6) out.chapters.push({...P.chapters[i], startHour: h, endHour: P.chapterHours[i + 1], startLevel: levelAtHour(h), endLevel: levelAtHour(P.chapterHours[i + 1])}); });
if (process.argv.includes('--json')) { console.log(JSON.stringify(out, null, 1)); process.exit(0); }
console.log('每级用时系数 a =', a.toFixed(3));
console.log('\n章节 | 时间 | 等级区间');
for (const c of out.chapters) console.log(`${c.id} ${c.name} | ${c.startHour}–${c.endHour}h | ${c.startLevel.toFixed(1)} → ${c.endLevel.toFixed(1)}`);
console.log(`后期 | 18–30h | ${levelAtHour(18).toFixed(1)} → ${levelAtHour(30).toFixed(1)}`);
console.log('\n等级 | 本级分钟 | 到达时累计小时 | 升级经验 | 普通怪经验 | 普通怪金币 | 装备阶段 | 期望攻击 | 期望生命 | 普通怪HP | 普通怪攻击');
for (const r of out.levels) if ([1,2,3,5,7,9,10,13,16,17,20,22,23,25,27,28,30,32,33,35,37,38,40,42,44,45,48,50].includes(r.L))
  console.log([r.L, fmt(r.minutes,1), fmt(r.hourAt,2), fmt(r.threshold), r.xpKill, r.goldKill, 'T'+r.tier, fmt(r.attack), fmt(r.hp), fmt(r.mHp), fmt(r.mAtk)].join(' | '));
let total = 0; for (const r of out.levels.slice(0, 49)) total += r.threshold; console.log('\n1→50 总经验', fmt(total));
