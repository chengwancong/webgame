"""开荒 / 爽刷数值心流推导与蒙特卡洛（docs/open-world-numeric-flow.md）。
输入：.design/standard-player-20261005/model.json（标准人逐级 dps1 / dpsN / ehp）。
输出：.design/numeric-flow-20261006/flow.json，并打印阶段表。
运行：PYTHONUTF8=1 python tools/numeric-flow-sim.py
"""
import json, math, os, random, hashlib, io, contextlib, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# 数值来源已迁到 tools/spine；旧命令只校验主干来源，不再运行独立扫参或写旧模型。
if __name__ == '__main__':
    import subprocess, sys
    if '--crafting' in sys.argv:
        raise SystemExit(subprocess.call(['node','--import','tsx','tools/spine/cli.ts','crafting-flow',*[arg for arg in sys.argv[1:] if arg != '--crafting']],cwd=ROOT))
    raise SystemExit(subprocess.call(['node','--import','tsx','tools/spine/check-legacy.ts','numeric-flow-sim'],cwd=ROOT))
MODEL = json.load(open(os.path.join(ROOT, '.design/standard-player-20261005/model.json'), encoding='utf-8'))
ROWS = {r['level']: r for r in MODEL['rows']}

# ---- 标准人时间轴（与 standard-player-model 相同：每级 2.886·L^0.8 分钟） ----
H = {1: 0.0}
for L in range(1, 61): H[L + 1] = H[L] + 2.886 * L ** 0.8
def level_at(t):
    for L in range(1, 61):
        if H[L + 1] > t: return L + (t - H[L]) / (H[L + 1] - H[L])
    return 60.0
def lerp_full(t, key):
    L = level_at(t); a = int(L); f = L - a
    v = lambda l: ROWS[min(l, 60)]['full'][key]
    return math.exp(math.log(v(a)) * (1 - f) + math.log(v(min(a + 1, 60))) * f)
def wall_power(t): return math.log(lerp_full(t, 'dps1') * lerp_full(t, 'ehp'))
# 标准人逐级曲线有大量台阶（强化档、传奇、觉醒），这些台阶正是本方案要重新分配给各阶段的“钥匙”。
# 墙的位置取平滑曲线：岛与裂星潮节点之间按时间线性插值 ln 力量；L37→L40（觉醒 + 原初）是裂星潮入场的确定性跳升。
ANCHORS = [1, 8, 15, 21, 27, 32, 37, 40, 44, 50, 55, 60]
def smooth_log(t, key):
    # Both axes already include actual source-owned growth from resolveBuild.
    pts = [(H[L], math.log(ROWS[L]['full'][key])) for L in ANCHORS]
    for (ta, pa), (tb, pb) in zip(pts, pts[1:]):
        if t <= tb: return pa + (pb - pa) * (t - ta) / (tb - ta)
    return pts[-1][1]
def smooth_power(t): return smooth_log(t, 'dps1') + smooth_log(t, 'ehp')
def current_monster(L, key):
    a = int(L); f = L - a; v = lambda l: ROWS[min(max(l, 1), 60)]['monster']['current'][key]
    return v(a) * (1 - f) + v(min(a + 1, 60)) * f

# ---- 设计参数（文档 §2 / §4 / §5） ----
ISLANDS = [  # (名称, 起止等级, 探索/剧情占比)
    ('第1岛 风原', 1, 8, .17), ('第2岛 雾铃', 8, 15, .20), ('第3岛 熔炉', 15, 21, .22),
    ('第4岛 霜港', 21, 27, .24), ('第5岛 裂隙', 27, 32, .24), ('第6岛 龙眠', 32, 38, .25),
]
HARDMODE = ('裂星潮', 38, 50, .12)          # 六岛裂星潮各一阶段；50 级后进入世界层级（§6）
STAGE_WEIGHTS = [.30, .33, .37]             # 岛内三阶段时长占比
PUSH_SHARE = (.20, .34)                     # 循环内开荒占比：第 1 阶段 → 最后阶段（线性）
ETA = .6                                    # 开荒期成长效率（相对平均成长速度）
GRIND_BOUND = 4.0                           # 不靠钥匙、纯刷级也能过墙的时间上限（× 开荒目标）
CRAFT_AT = 1.4                              # 制作钥匙（保底）所需材料 = 开荒目标 × 1.4 的产出
P_EARLY = 0.0                               # 2026-10-06 用户裁定：取消跨阶段提前掉落；钥匙仅在当前阶段地城获得
P_BONUS, BONUS = .25, .18                   # 额外 BD 件：出现概率、力量（ln，+20%）
KEY_SHARE_MAX = .6                          # 钥匙最多占两堵墙之间成长的 60%
SKILL_SD = .07                              # 操作水平：过墙所需力量比的对数标准差
AUGMENT_DPS, AUGMENT_EHP = 1.25, 1.10  # 流派主文§7.5：模块L9，不是等级9；地城墙使用
BOSS_TTK, BOSS_EFF, NORMAL_EFF = 70, .75, .75
N = 20000

def ttk_normal(L): return 2.5 * (.28 + .72 * math.exp(-(L - 1) / 16))

def build_stages():
    stages = []
    plan = [(i, *x) for i, x in enumerate(ISLANDS)] + [(6, *HARDMODE)]
    total = 18 + 6
    for gi, (name, a, b, explore) in [(p[0], p[1:]) for p in plan]:
        t0, t1 = H[a], H[b]; T = t1 - t0
        weights = STAGE_WEIGHTS if gi < 6 else [1 / 6] * 6
        t = t0
        for j, w in enumerate(weights):
            k = len(stages); D = T * w
            share = PUSH_SHARE[0] + (PUSH_SHARE[1] - PUSH_SHARE[0]) * k / (total - 1)
            cycle = D * (1 - explore); push = cycle * share; farm = cycle - push
            stages.append({'index': k + 1, 'group': name, 'slot': j + 1, 'start': t, 'explore': D * explore,
                           'push': push, 'farm': farm, 'clear': t + D * explore + push, 'end': t + D})
            t += D
    groups = {g: (H[a], H[b]) for g, a, b, _ in ISLANDS}; groups[HARDMODE[0]] = (H[40], H[50])  # 裂星潮成长率不含入场跳升
    for s in stages:
        s['R'] = smooth_power(s['clear']); s['level'] = level_at(s['clear'])
        ta, tb = groups[s['group']]; s['g'] = (smooth_power(tb) - smooth_power(ta)) / (tb - ta)  # 每分钟 ln 力量增长（本岛平均）
    for i, s in enumerate(stages):
        nxt = stages[i + 1] if i + 1 < len(stages) else None
        prev_rise = s['R'] - (stages[i - 1]['R'] if i else wall_power(0))
        s['J'] = min(s['g'] * ETA * GRIND_BOUND * s['push'], KEY_SHARE_MAX * prev_rise)  # 钥匙大小；至少留 40% 成长给爽刷期
        s['S'] = (nxt['R'] - s['R']) if nxt else None         # 到下一堵墙的总成长
    for i, s in enumerate(stages):
        nxt = stages[i + 1] if i + 1 < len(stages) else None
        s['F'] = (s['S'] - nxt['J']) if nxt else None         # 爽刷期（含下一段探索）可得的非钥匙成长
    return stages

def push_time(s, lam, rng):
    m, J, g = s['push'], s['J'], s['g'] * ETA
    attempt = max(.6, .1 * m)                               # 一次尝试：早期首领战 ≈ 40 秒，后期整趟地城 ≈ 4 分钟
    need = rng.gauss(0, SKILL_SD)                             # ln 过墙门槛（标准 = 0）
    bonus = BONUS if rng.random() < P_BONUS else 0.0
    t_key = 0.0 if rng.random() < P_EARLY else min(rng.expovariate(lam), CRAFT_AT * m)
    crafted = t_key == CRAFT_AT * m
    with_key = max(t_key, (need - bonus) / g, 0.0)
    no_key = max((need - bonus + J) / g, 0.0)
    ready = min(with_key, no_key)
    path = 'grind' if no_key < with_key else ('craft' if crafted else ('early' if t_key == 0 else 'drop'))
    if ready <= 0: return attempt, 'skip'                     # 运气/操作直接一次过
    return ready + 2 * attempt, path                          # 首次试探失败 + 成功一次

def simulate(s, lam, seed=7, n=N):
    rng = random.Random(seed + s['index']); out = sorted(push_time(s, lam, rng) for _ in range(n))
    times = [x[0] for x in out]; paths = {}
    for _, p in out: paths[p] = paths.get(p, 0) + 1
    q = lambda p: times[int(p * (n - 1))]
    return {'p10': q(.1), 'median': q(.5), 'p90': q(.9), 'max': times[-1], 'paths': {k: v / n for k, v in paths.items()}}

def solve_lambda(s):
    lo, hi = 1e-4, 50.0
    for _ in range(30):
        mid = math.sqrt(lo * hi)
        if simulate(s, mid, n=4000)['median'] > s['push']: lo = mid
        else: hi = mid
    return hi

def main():
    stages = build_stages()
    for s in stages:
        lam = solve_lambda(s); mc = simulate(s, lam)
        L = s['level']; d1 = math.exp(smooth_log(s['clear'], 'dps1')); ehp = math.exp(smooth_log(s['clear'], 'ehp'))
        boss_hp = d1 * AUGMENT_DPS * BOSS_EFF * BOSS_TTK; boss_dps = ehp * AUGMENT_EHP / 30; normal_hp = d1 * NORMAL_EFF * ttk_normal(L)
        s.update(lam=lam, mc=mc, dps1=d1 * AUGMENT_DPS, ehp=ehp * AUGMENT_EHP, bossHp=boss_hp, bossDps=boss_dps, bossHpFactor=boss_hp / (current_monster(L, 'hp') * 10),
                 normalHp=normal_hp, normalHpFactor=normal_hp / current_monster(L, 'hp'),
                 farmDpsGain=math.exp(s['F'] / 2) if s['F'] is not None else None,
                 shareMedian=s['farm'] / (s['farm'] + mc['median']), shareLucky=s['farm'] / (s['farm'] + mc['p10']), shareUnlucky=s['farm'] / (s['farm'] + mc['p90']),
                 keyDropMedian=math.log(2) / lam, dropChanceByCraft=1 - math.exp(-lam * CRAFT_AT * s['push']))
    print('阶段 归属 等级 探索 开荒 爽刷 | 钥匙J 到达比 S F | 掉钥匙中位 制作保底 | MC P10 中位 P90 | 路径')
    for s in stages:
        mc = s['mc']; F = s['F']; S = s['S']
        print(f"{s['index']:>2} {s['group']}#{s['slot']} L{s['level']:.1f} {s['explore']:.0f} {s['push']:.1f} {s['farm']:.1f} | "
              f"{s['J']:.2f} {math.exp(-s['J']):.2f} {S if S is None else round(S,2)} {F if F is None else round(F,2)} | "
              f"{s['keyDropMedian']:.1f} {CRAFT_AT*s['push']:.1f} | {mc['p10']:.1f} {mc['median']:.1f} {mc['p90']:.1f} ({mc['p90']/s['push']:.2f}x) | "
              + ' '.join(f"{k}{v*100:.0f}%" for k, v in sorted(mc['paths'].items())) +
              f" | 首领HP×{s['bossHpFactor']:.1f} 普通HP×{s['normalHpFactor']:.2f} | 爽刷单体增幅 {s['farmDpsGain'] or 0:.2f} 爽占比 {s['shareUnlucky']:.2f}/{s['shareMedian']:.2f}/{s['shareLucky']:.2f}")
    g60 = (smooth_power(H[60]) - smooth_power(H[50])) / (H[60] - H[50])
    for push, farm in [(30, 60), (35, 70), (40, 80)]:
        step = g60 * (push + farm); print(f'终局世界层级：开荒 {push} + 爽刷 {farm} 分钟 → 每层威胁 ×{math.exp(step):.3f}（ln {step:.3f}）')
    # 整段旅程：同一玩家逐阶段独立运气，看总开荒时长的分布（单阶段 P90 相加会夸大）
    rng = random.Random(99); journeys = {'主线 1–18': stages[:18], '裂星潮 19–24': stages[18:]}; journey_results = []
    for name, part in journeys.items():
        totals = sorted(sum(push_time(s, s['lam'], rng)[0] for s in part) for _ in range(5000))
        target = sum(s['push'] for s in part)
        print(f'{name} 总开荒：目标 {target:.0f} 分钟 | 玩家 P10 {totals[500]:.0f} 中位 {totals[2500]:.0f} P90 {totals[4500]:.0f} 最差 {totals[-1]:.0f}')
        journey_results.append({'name': name, 'seed': 99, 'samples': 5000, 'target': target,
                                'p10': totals[500], 'median': totals[2500], 'p90': totals[4500], 'max': totals[-1]})
    for name, part in [('主线 1–18', stages[:18]), ('裂星潮 19–24', stages[18:])]:
        print(name, '探索 %.0f 开荒 %.0f 爽刷 %.0f 分钟' % tuple(sum(s[k] for s in part) for k in ('explore', 'push', 'farm')),
              '| 开荒合计 运气好P10 %.0f 中位 %.0f 运气差P90 %.0f' % tuple(sum(s['mc'][k] for s in part) for k in ('p10', 'median', 'p90')))
    out = os.path.join(ROOT, '.design/numeric-flow-20261006'); os.makedirs(out, exist_ok=True)
    json.dump({'generated': '2026-10-06', 'toolVersion': 3, 'calibration': 'current-executor-dps-measured-distributions-unmeasured',
               'measurement': MODEL['meta'].get('measurement'),
               'policy': {'keySource': 'current-stage-dungeon-only', 'crossStageKeys': False, 'earlyKeyTarget': None},
               'limitations': ['操作水平与额外BD仍为假设分布', '掉率仍由目标中位时长反解', '材料保底按期望产出，尚无真实产出测量', '首领效率仍为固定系数，尚未接入首领探针'],
               'source': '.design/standard-player-20261005/model.json',
               'modelSha256': hashlib.sha256(open(os.path.join(ROOT, '.design/standard-player-20261005/model.json'), 'rb').read()).hexdigest(),
               'versions': MODEL['meta']['versions'],
               'params': {k: v for k, v in globals().items() if k.isupper() and k not in ('ROOT', 'MODEL', 'ROWS', 'H')},
               'seed': 7, 'samples': N, 'journeys': journey_results, 'stages': stages}, open(os.path.join(out, 'flow.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

CONTENT = {1: '地城一（前段分区）', 2: '地城二（中段分区）', 3: '章节首领 + 地城三（后段分区）'}
def markdown():
    d = json.load(open(os.path.join(ROOT, '.design/numeric-flow-20261006/flow.json'), encoding='utf-8'))['stages']
    big = lambda v: f'{v/1e9:.2f}B' if v >= 1e9 else f'{v/1e6:.1f}M' if v >= 1e6 else f'{v/1e3:.1f}K' if v >= 1e3 else f'{v:.0f}'
    print('| # | 岛/阶段 | 墙 | 通关等级 | 探索 | 开荒 | 爽刷 | 钥匙 | 到达比 | 爽刷期单体增幅 | 开荒 P10 / 中位 / P90 | 一次过 | 爽占比 差/中/好 |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for s in d:
        wall = CONTENT[s['slot']] if s['index'] <= 18 else f"第 {s['slot']} 岛裂星潮首领"
        gain = f"×{s['farmDpsGain']:.2f}" if s['farmDpsGain'] else '—（转终局）'
        print(f"| {s['index']} | {s['group']} · {s['slot']} | {wall} | {s['level']:.1f} | {s['explore']:.0f} | {s['push']:.0f} | {s['farm']:.0f} | +{(math.exp(s['J'])-1)*100:.0f}% | {math.exp(-s['J']):.2f} | {gain} | "
              f"{s['mc']['p10']:.1f} / {s['mc']['median']:.1f} / {s['mc']['p90']:.1f} | {s['mc']['paths'].get('skip',0)*100:.0f}% | {s['shareUnlucky']:.2f} / {s['shareMedian']:.2f} / {s['shareLucky']:.2f} |")
    print()
    print('| # | 通关等级 | 标准人单体秒伤 | 标准人等效生命 | 墙·首领生命 | 墙·首领秒伤 | 首领生命 ÷ 现行曲线 | 爽刷·普通怪生命 | 普通怪 ÷ 现行曲线 | 钥匙掉率/分钟 | 中位掉落 | 制作保底 | 靠掉落拿到 |')
    print('|---|---|---|---|---|---|---|---|---|---|---|---|---|')
    for s in d:
        print(f"| {s['index']} | {s['level']:.1f} | {big(s['dps1'])} | {big(s['ehp'])} | {big(s['bossHp'])} | {big(s['bossDps'])} | ×{s['bossHpFactor']:.1f} | {big(s['normalHp'])} | ×{s['normalHpFactor']:.2f} | "
              f"{s['lam']:.3f} | {s['keyDropMedian']:.0f} 分 | {CRAFT_AT*s['push']:.0f} 分 | {s['dropChanceByCraft']*100:.0f}% |")

if __name__ == '__main__':
    import sys
    main()
    if '--markdown' in sys.argv:
        capture = io.StringIO()
        with contextlib.redirect_stdout(capture): markdown()
        tables = capture.getvalue().strip().split('\n\n')
        document = os.path.join(ROOT, 'docs/open-world-numeric-flow.md')
        text = open(document, encoding='utf-8').read()
        for table in tables:
            header = re.escape(table.splitlines()[0])
            text, count = re.subn(header + r'\n(?:\|[^\n]*\n?)+', lambda _: table + '\n', text, count=1)
            if count != 1: raise ValueError('找不到阶段表表头，未写入文档')
        with open(document, 'w', encoding='utf-8', newline='\n') as out: out.write(text)
        print(capture.getvalue())
