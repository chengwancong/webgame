// 伤害乘区与 Build 深度模型：按等级算“成型 / 普通 / 白板”三种搭配打出的伤害数字。
// 只做设计计算，不读写游戏数据。运行：node tools/damage-depth-model.mjs [--json]
// 配套文档：docs/build-depth-design.md
const lerp = (rows, L) => { if (L <= rows[0][0]) return rows[0][1]; for (let k = 0; k < rows.length - 1; k++) { const [a, va] = rows[k], [b, vb] = rows[k + 1]; if (L <= b) return va + (vb - va) * (L - a) / (b - a); } return rows.at(-1)[1]; };
const P = {
  // 攻击力：等级 + 装备主属性（沿用 balance-30h-model 的阶段倍率），不再含任何百分比养成
  tiers: [[1, 1], [10, 1.7], [17, 2.8], [23, 4.4], [28, 6.8], [33, 10.5], [38, 16], [45, 24]],
  wornQuality: [[1, 1], [9, 1.1], [16, 1.15], [22, 1.2], [32, 1.27], [40, 1.32], [50, 1.4]],
  wornRank: [[1, 0], [9, 2], [16, 4], [22, 6], [27, 7], [32, 8], [36, 9], [40, 10], [45, 11], [50, 12]],
  // 技能系数（主力技能当前等级下的伤害%）：基础→核心(5)→精通(17)→终极(28)，加装备“+技能等级”
  skillCoef: [[1, 1.2], [5, 2.0], [10, 2.4], [17, 2.9], [23, 3.4], [28, 4.6], [33, 5.2], [38, 6.0], [45, 6.8], [50, 7.5]],
  // 加算增伤 [+]：词缀、天赋小点、套装2件、巅峰普通点，全部相加
  additive: [[1, 0], [5, 0.1], [10, 0.4], [17, 0.9], [23, 1.6], [28, 2.4], [33, 3.2], [38, 4.0], [45, 5.0], [50, 6.0]],
  // 独立乘区 [×]：[名称, 开放等级, 开放时数值, 50级数值, 是否通用]。通用乘区与标签无关，任何搭配都吃满；其余要求标签/机制对上
  zones: [
    ['传奇威能①', 17, 1.2, 1.5, false], ['套装4件', 23, 1.3, 1.45, false], ['武器盘方阵', 23, 1.1, 1.4, true],
    ['天赋关键点', 28, 1.25, 1.35, false], ['召唤石光环', 28, 1.1, 1.25, true], ['传奇威能②(法典)', 33, 1.25, 1.5, false],
    ['传奇威能③(法典)', 38, 1.2, 1.4, false], ['技能觉醒', 38, 1.3, 1.5, false], ['套装6件', 38, 1.3, 1.5, false], ['太古词缀', 40, 1.1, 1.3, false],
  ],
  critChance: [[1, 0.05], [10, 0.1], [23, 0.25], [33, 0.4], [50, 0.5]],
  critMult: [[1, 1.5], [23, 2.0], [38, 2.8], [50, 3.5]],
  vulnerable: [[1, 1], [22, 1], [23, 1.2], [38, 1.35], [50, 1.5]],
  builds: { // 成型=标签全对；普通=一半对；白板=随便穿
    成型: {add: 1, zone: 1, crit: 1, critMult: 1, vuln: 1},
    普通: {add: 0.6, zone: 0.6, crit: 0.7, critMult: 0.5, vuln: 0.5},
    白板: {add: 0.3, zone: 0, crit: 0.3, critMult: 0.2, vuln: 0},
  },
  hitsNormal: 3, hitsElite: 25, hitsBoss: 300, // 以“普通”搭配为基准的击杀所需平均命中
  paragon: {perFifty: 1.5}, nightmare: {hpPerLayer: 1.15, damagePerLayer: 1.06},
};
const tierScale = L => [...P.tiers].reverse().find(t => L >= t[0])[1];
const attack = L => Math.round(10 + 2 * L + 12 * tierScale(L) * lerp(P.wornQuality, L) * (1 + 0.08 * lerp(P.wornRank, L)) + 6 * 0.35 * 3.5 * tierScale(L) * Math.min(1, L / 20));
const zoneValue = ([, at, v0, v50], L) => L < at ? 1 : v0 + (v50 - v0) * (L - at) / Math.max(1, 50 - at);
const hit = (L, b, extraZone = 1) => {
  const w = P.builds[b], atk = attack(L), coef = lerp(P.skillCoef, L), add = 1 + lerp(P.additive, L) * w.add;
  const zones = P.zones.reduce((n, z) => n * (1 + (zoneValue(z, L) - 1) * (z[4] ? 1 : w.zone)), 1) * extraZone;
  const cc = Math.min(0.5, lerp(P.critChance, L) * w.crit), cm = 1.5 + (lerp(P.critMult, L) - 1.5) * w.critMult, vuln = 1 + (lerp(P.vulnerable, L) - 1) * w.vuln;
  const base = atk * coef * add * zones * vuln;
  return {atk, coef, add, zones, cc, cm, vuln, hit: base, crit: base * cm, avg: base * (1 + cc * (cm - 1))};
};
const cn = x => x >= 1e8 ? (x / 1e8).toFixed(2) + '亿' : x >= 1e4 ? (x / 1e4).toFixed(1) + '万' : String(Math.round(x));
const out = [];
for (const L of [1, 5, 10, 17, 23, 28, 33, 38, 40, 45, 50]) {
  const s = hit(L, '成型'), n = hit(L, '普通'), w = hit(L, '白板'), mob = n.avg * P.hitsNormal;
  out.push({L, atk: s.atk, coef: s.coef, add: s.add, zones: s.zones, critChance: s.cc, critMult: s.cm, vuln: s.vuln, built: s.hit, builtCrit: s.crit, builtAvg: s.avg, normalAvg: n.avg, blankAvg: w.avg, mobHp: mob, eliteHp: n.avg * P.hitsElite, bossHp: n.avg * P.hitsBoss, hitsBuilt: mob / s.avg, hitsNormal: P.hitsNormal, hitsBlank: mob / w.avg});
}
const endgame = [];
for (const [para, layer] of [[0, 0], [50, 5], [100, 10], [150, 20], [200, 30]]) {
  const extra = P.paragon.perFifty ** (para / 50), s = hit(50, '成型', extra);
  endgame.push({paragon: para, nightmare: layer, builtCrit: s.crit, builtAvg: s.avg, mobHp: hit(50, '普通').avg * P.hitsNormal * P.nightmare.hpPerLayer ** layer});
}
if (process.argv.includes('--json')) { console.log(JSON.stringify({levels: out, endgame}, null, 1)); process.exit(0); }
console.log('等级 | 攻击 | 技能系数 | 加算[+] | 乘区[×]积 | 暴击率/暴伤 | 易伤 | 成型·非暴 | 成型·暴击 | 普通·平均 | 白板·平均 | 普通怪HP | 击杀命中 成型/普通/白板');
for (const r of out) console.log([r.L, r.atk, r.coef.toFixed(1), '×' + r.add.toFixed(2), '×' + r.zones.toFixed(2), `${Math.round(r.critChance * 100)}%/×${r.critMult.toFixed(1)}`, '×' + r.vuln.toFixed(2), cn(r.built), cn(r.builtCrit), cn(r.normalAvg), cn(r.blankAvg), cn(r.mobHp), `${r.hitsBuilt.toFixed(1)}/${r.hitsNormal}/${r.hitsBlank.toFixed(1)}`].join(' | '));
console.log('\n乘区开放后数值：'); for (const z of P.zones) console.log(`${z[0]} Lv${z[1]} ×${z[2]} → ×${z[3]}`);
console.log('\n巅峰/梦魇 | 成型暴击 | 成型平均 | 普通怪HP'); for (const e of endgame) console.log(`P${e.paragon} 梦魇${e.nightmare} | ${cn(e.builtCrit)} | ${cn(e.builtAvg)} | ${cn(e.mobHp)}`);
