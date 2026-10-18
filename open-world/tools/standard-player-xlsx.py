"""星潮海标准人属性规划表（仿 QT05.属性规划 / 角色和怪物属性表）。

数据来源：npx tsx tools/standard-player-model.ts → .design/standard-player-20261005/model.json
生成：python tools/standard-player-xlsx.py [输出路径]
表内占比、怪物、副本推算全部是 Excel 公式，改黄色参数格即可重算。
"""
import json, math, os, shutil, sys
from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.formatting.rule import ColorScaleRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as col

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, '.design', 'standard-player-20261005', 'model.json')
OUT = sys.argv[1] if len(sys.argv) > 1 else r'G:\webgame\数值设计S2\QT05_星潮海标准人属性规划.xlsx'
m = json.load(open(SRC, encoding='utf-8'))
rows, meta, dungeons = m['rows'], m['meta'], m['dungeons']
systems = meta['systems']
AK = col(len(systems) + 3)  # 达标率表的整体达标率列
LV = [r['level'] for r in rows]
STAGE_LV = [8, 15, 21, 27, 32, 37, 45, 50, 55, 60]
FIT = {'level', 'gearBase', 'island', 'hardmode', 'cores'}  # 怪物曲线拟合时基准人已含（或主线自动获得）的部分

HEAD = PatternFill('solid', fgColor='1F4E78'); HEADF = Font(color='FFFFFF', bold=True)
INPUT = PatternFill('solid', fgColor='FFF2CC'); NOTE = Font(color='7F7F7F', italic=True)
FITF = PatternFill('solid', fgColor='DDEBF7'); THIN = Side(style='thin', color='BFBFBF')
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def header(ws, r, labels, c0=1):
    for i, t in enumerate(labels):
        x = ws.cell(r, c0 + i, t); x.fill = HEAD; x.font = HEADF; x.border = BOX
        x.alignment = Alignment(horizontal='center', vertical='center', wrap_text=True)


def widths(ws, w):
    for i, v in enumerate(w, 1): ws.column_dimensions[col(i)].width = v


def fmt(ws, rng, number_format):
    for row in ws[rng]:
        for c in row: c.number_format = number_format


wb = Workbook()

# ---------------- 说明 ----------------
ws = wb.active; ws.title = '说明'
lines = [
    ('星潮海标准人属性规划', True),
    (f"生成时间 {meta['generated']}　规则版本 rules={meta['versions'].get('rules')} content={meta['versions'].get('content')}", False),
    ('', False),
    ('一、目的', True),
    ('仿 QT05《属性规划》：先定“标准人”每级的养成进度，再用真实结算代码算出每级属性、DPS，以及每个养成的收益占比；最后用收益预期反推怪物与副本强度。', False),
    ('', False),
    ('二、口径', True),
    ('· 基准人：怪物曲线 starsea 拟合时用的角色（等级 + 白装 + 主线技能 + 主线自动获得的岛屿之力/裂星潮/星核），其 DPS 为 30Hz 实测。', False),
    ('· 标准人：在基准人上按《养成进度》表的进度把 22 个属性来源全部打开，属性由 resolveBuild / resolveStats 真实计算（非手抄公式）。', False),
    ('· 标准人 DPS = 基准实测 DPS × 技能循环伤害比（同循环次数 × 冷却缩放 × 期望单次，含暴击）。L21/37/50 已用真实 World 战斗验证，误差 < 5%。', False),
    ('· 词缀按真实 generateAffixes 抽 2000 次取期望（QT05 的“允许池”思路），不是挑最优词缀。', False),
    ('· 养成倍数：留一法，m_i = 标准人 ÷ 关掉第 i 个养成后的标准人。游戏是乘区叠加，所以占比 = ln(m_i) / Σ ln(m_j)（QT05 线性占比的对数版）。', False),
    ('· 标准人 = 每级目标（100% 达标）。实际玩家按游戏时长达标：1 级标准人就是新建角色（初始武器、衣服、首饰），之后各养成按滞后时长落后于标准人。', False),
    ('· 倍数 < 1 的按 1 处理（个别养成单独关掉时因封顶/互斥反而略升）。', False),
    ('· 蓝底列 = 怪物曲线拟合时已计入的部分（等级、基础装备、岛屿之力、裂星潮、星核）；其余是深度养成，目前没有进怪物拟合。', False),
    ('', False),
    ('三、表说明', True),
    ('养成清单：22 个属性来源与说明。', False),
    ('养成进度：标准人每级的养成进度假设（改进度需改 tools/standard-player-model.ts 的 SCHEDULE 后重新生成）。', False),
    ('标准人属性：每级基准人 vs 标准人的攻击/生命/护甲/暴击/乘区/DPS/EHP 与倍数。', False),
    ('养成倍数_输出 / 养成倍数_生存：每级每个养成的留一倍数（输出=技能循环伤害，生存=对星潮海普通怪的有效生命）。', False),
    ('养成占比_输出 / 养成占比_生存：公式计算的每级占比；末行为最终占比。', False),
    ('阶段占比：各章节末与满级的占比汇总 + 堆叠图。', False),
    ('等级时长：每级用时（默认 30 小时设计），决定玩家在每一级的游戏时长。', False),
    ('达标参数：每个养成的“滞后时长”（玩家比标准人慢多少小时拿到该养成的进度），以及取值时点（刚到该级 / 即将离开）。', False),
    ('达标率_输出 / 达标率_生存（辅助：达标率_生命 / 达标率_护甲）：每级每个养成的达标率与整体达标率，全部公式，改参数即重算。', False),
    ('实战效率：体感 TTK ÷ 站桩理论 TTK，按章节实地自动刷怪/打首领实测（tools/field-efficiency-probe.ts），黄色列可改。', False),
    ('怪物推算：所有 TTK 为体感秒。参考玩家 = 标准人 × 达标率；建议怪物生命 = 理论DPS × 实战效率 × 体感TTK。', False),
    ('副本推算：真实 dungeonSpawns（星潮海世界线）算出的副本首领数值，对比标准人击杀时间，并按目标 TTK 给出建议 enemyScale。', False),
    ('', False),
    ('四、重新生成', True),
    ('npx tsx tools/standard-player-model.ts', False),
    ('python tools/standard-player-xlsx.py', False),
]
for i, (t, b) in enumerate(lines, 1):
    c = ws.cell(i, 1, t); c.font = Font(bold=b, size=14 if i == 1 else 11)
ws.column_dimensions['A'].width = 150

# ---------------- 养成清单 ----------------
ws = wb.create_sheet('养成清单')
header(ws, 1, ['序号', 'ID', '养成', '说明', '已计入怪物拟合'])
for i, s in enumerate(systems, 1):
    ws.append([i, s['id'], s['name'], s['desc'], '是' if s['id'] in FIT else '否'])
    if s['id'] in FIT:
        for c in ws[i + 1]: c.fill = FITF
widths(ws, [6, 14, 14, 90, 14])

# ---------------- 养成进度 ----------------
ws = wb.create_sheet('养成进度')
sched_keys = list(rows[0]['schedule'].keys())
SCH_CN = {'legendary': '传奇件数', 'rare': '稀有+件数', 'enhance': '强化等级', 'setPieces': '套装件数', 'codexRank': '图鉴阶',
          'skillRank': '技能等级', 'skillAwaken': '技能觉醒', 'talentPoints': '天赋点', 'reputationClaims': '声望领取',
          'weaponLevel': '主武器等级', 'weaponUncap': '武器突破', 'gridWeapons': '方阵武器数', 'omega': '方阵Ω', 'primal': '方阵原初',
          'summonLevel': '召唤石等级', 'summonUncap': '召唤石突破', 'summons': '召唤石数', 'awakening': '角色觉醒', 'characterUncap': '角色突破',
          'paragonNodes': '巅峰节点', 'glyphLevel': '雕文等级', 'collection': '收藏', 'islands': '已通岛屿', 'hardmode': '裂星潮',
          'lifeCrystals': '生命水晶', 'starCores': '星核'}
header(ws, 1, ['等级', '装等', '装备阶'] + [SCH_CN.get(k, k) for k in sched_keys])
for r in rows:
    ws.append([r['level'], r['ilvl'], 'T%d' % r['stage']] + [('是' if v else '') if isinstance(v, bool) else v for v in r['schedule'].values()])
widths(ws, [6, 6, 7] + [9] * len(sched_keys)); ws.freeze_panes = 'B2'

# ---------------- 标准人属性 ----------------
ws = wb.create_sheet('标准人属性')
H = ['等级', '装等', '基准攻击', '标准攻击', '基准生命', '标准生命', '基准护甲', '标准护甲', '标准暴击', '标准暴伤', '标准加算', '标准乘区',
     '基准DPS单体', '标准DPS单体', '基准DPS群体', '标准DPS群体', '基准EHP', '标准EHP', '输出倍数', '生存倍数', '攻击倍数', '生命倍数', '输出达标率', '生存达标率', '实际玩家DPS', '实际玩家EHP']
header(ws, 1, H)
for i, r in enumerate(rows, 2):
    b, f = r['baseline'], r['full']
    ws.append([r['level'], r['ilvl'], b['attack'], f['attack'], b['hp'], f['hp'], b['armor'], f['armor'], f['critChance'], f['critMultiplier'],
               f['damageAdd'], f['damageMult'], b['dps1'], f['dps1'], b['dpsN'], f['dpsN'], b['ehp'], f['ehp'],
               f'=N{i}/M{i}', f'=R{i}/Q{i}', f'=D{i}/C{i}', f'=F{i}/E{i}', f'=达标率_输出!{AK}{i}', f'=达标率_生存!{AK}{i}', f'=N{i}*W{i}', f'=S{i}*X{i}'])
n = len(rows) + 1
fmt(ws, f'I2:I{n}', '0.0%'); fmt(ws, f'J2:L{n}', '0.00'); fmt(ws, f'M2:R{n}', '#,##0'); fmt(ws, f'S2:V{n}', '0.00'); fmt(ws, f'W2:X{n}', '0%'); fmt(ws, f'Y2:Z{n}', '#,##0')
widths(ws, [6, 6] + [10] * 10 + [13] * 6 + [9] * 6 + [13] * 2); ws.freeze_panes = 'C2'
ch = LineChart(); ch.title = '输出倍数（标准人 ÷ 基准人）'; ch.y_axis.scaling.logBase = 10; ch.height = 9; ch.width = 22
ch.add_data(Reference(ws, min_col=19, min_row=1, max_row=n), titles_from_data=True); ch.set_categories(Reference(ws, min_col=1, min_row=2, max_row=n))
ws.add_chart(ch, 'AB2')


# ---------------- 倍数 / 占比 ----------------
def mult_sheet(name, key):
    ws = wb.create_sheet(name)
    header(ws, 1, ['等级'] + [s['name'] for s in systems] + ['合计 Σln', '已拟合部分', '深度养成'])
    for i, r in enumerate(rows, 2):
        vals = [max(1.0, r['ablation'][s['id']][key]) for s in systems]
        ws.append([r['level']] + vals)
        last = col(len(systems) + 1)
        ws.cell(i, len(systems) + 2, f'=SUMPRODUCT(LN(B{i}:{last}{i}))')
        fit = '*'.join(f'{col(j + 2)}{i}' for j, s in enumerate(systems) if s['id'] in FIT)
        deep = '*'.join(f'{col(j + 2)}{i}' for j, s in enumerate(systems) if s['id'] not in FIT)
        ws.cell(i, len(systems) + 3, '=' + fit); ws.cell(i, len(systems) + 4, '=' + deep)
    for j, s in enumerate(systems):
        if s['id'] in FIT: ws.cell(1, j + 2).fill = PatternFill('solid', fgColor='2E75B6')
    fmt(ws, f'B2:{col(len(systems) + 4)}{len(rows) + 1}', '0.000')
    widths(ws, [6] + [8] * len(systems) + [9, 10, 10]); ws.freeze_panes = 'B2'
    ws.cell(len(rows) + 3, 1, '留一法：关掉该养成后，标准人数值下降为原来的 1/倍数。已拟合部分 / 深度养成 = 各自倍数连乘（未计交互，仅供量级参考）。').font = NOTE
    return ws


def share_sheet(name, src):
    ws = wb.create_sheet(name)
    header(ws, 1, ['等级'] + [s['name'] for s in systems] + ['已拟合合计', '深度养成合计'])
    k = len(systems)
    for i, r in enumerate(rows, 2):
        ws.cell(i, 1, r['level'])
        for j in range(k):
            c = col(j + 2)
            ws.cell(i, j + 2, f"=IF('{src}'!{col(k + 2)}{i}=0,0,LN('{src}'!{c}{i})/'{src}'!{col(k + 2)}{i})")
        fit = ','.join(f'{col(j + 2)}{i}' for j, s in enumerate(systems) if s['id'] in FIT)
        ws.cell(i, k + 2, f'=SUM({fit})'); ws.cell(i, k + 3, f'=1-{col(k + 2)}{i}')
    fin = len(rows) + 2
    ws.cell(fin, 1, '最终'); ws.cell(fin, 1).font = Font(bold=True)
    for j in range(k + 2):
        ws.cell(fin, j + 2, f'={col(j + 2)}{fin - 1}').font = Font(bold=True)
    fmt(ws, f'B2:{col(k + 3)}{fin}', '0.0%')
    ws.conditional_formatting.add(f'B2:{col(k + 1)}{fin}', ColorScaleRule(start_type='num', start_value=0, start_color='FFFFFF', end_type='max', end_color='F8696B'))
    for j, s in enumerate(systems):
        if s['id'] in FIT: ws.cell(1, j + 2).fill = PatternFill('solid', fgColor='2E75B6')
    widths(ws, [6] + [8] * k + [10, 11]); ws.freeze_panes = 'B2'
    return ws


mult_sheet('养成倍数_输出', 'rot'); mult_sheet('养成倍数_生存', 'ehp')
share_sheet('养成占比_输出', '养成倍数_输出'); share_sheet('养成占比_生存', '养成倍数_生存')

# ---------------- 等级时长 / 达标参数 / 达标率 ----------------
ws = wb.create_sheet('等级时长')
header(ws, 1, ['等级', '本级用时(分)', '到达时累计(时)', '离开时累计(时)', '说明'])
for i, L in enumerate(LV, 2):
    ws.cell(i, 1, L)
    c = ws.cell(i, 2, round(2.886 * L ** 0.8, 1)); c.fill = INPUT
    ws.cell(i, 3, 0 if i == 2 else f'=C{i - 1}+B{i - 1}/60'); ws.cell(i, 4, f'=C{i}+B{i}/60')
    if L == 1: ws.cell(i, 5, '默认取 docs/balance-30h-design.md：每级 2.886×等级^0.8 分钟（1→50 级约 30 小时）')
    if L == 50: ws.cell(i, 5, '50 级以后按同公式外推，未经实测，可改')
fmt(ws, f'C2:D{len(LV) + 1}', '0.00'); widths(ws, [6, 12, 14, 14, 70]); ws.freeze_panes = 'B2'

LAG = {'level': (0, '等级本身，到了就有'), 'gearBase': (1.0, '换装跟不上装等：约落后 1 小时的掉落'), 'enhance': (2.0, '强化要金币/材料，落后约 2 小时'),
       'affix': (2.0, '好词缀靠刷，落后约 2 小时'), 'set': (3.0, '凑套装最慢'), 'aspect': (2.0, '威能要先有传奇再提取'),
       'skillRank': (0.5, '技能升级花费低'), 'skillAwaken': (1.0, ''), 'talent': (0.5, '天赋点随升级自动给，加点有延迟'),
       'reputation': (1.0, '声望奖励要跑任务'), 'weaponGrowth': (1.5, '武器经验与突破材料'), 'grid': (2.0, '方阵武器靠高难刷取'),
       'summon': (2.0, '召唤石靠高难刷取'), 'awakening': (1.5, ''), 'uncap': (3.0, '突破材料稀缺'), 'paragon': (1.0, ''),
       'glyph': (1.0, ''), 'collection': (2.0, '收集类慢'), 'island': (0, '主线首领必得'), 'hardmode': (0, '主线自动开启'),
       'cores': (0.5, ''), 'life': (0.5, '')}
ws = wb.create_sheet('达标参数')
ws.cell(1, 1, '达标参数（黄色可改）').font = Font(bold=True, size=12)
ws.cell(2, 1, '滞后时长：玩家在该养成上比标准人慢多少小时。实际玩家在 t 时刻的该养成 = 标准人在 (t − 滞后) 时刻的该养成；不足滞后时按开局（1 级标准人＝新建角色）计。默认值是估计，需用试玩/统计校准。').font = NOTE
header(ws, 3, ['序号', '养成', '滞后时长(时)', '说明'])
for j, sdef in enumerate(systems):
    lag, why = LAG.get(sdef['id'], (1.0, ''))
    ws.cell(4 + j, 1, j + 1); ws.cell(4 + j, 2, sdef['name']); c = ws.cell(4 + j, 3, lag); c.fill = INPUT; c.border = BOX; ws.cell(4 + j, 4, why)
ws.cell(4, 6, '取值时点（0=刚升到该级，1=即将离开该级）'); c = ws.cell(4, 7, 0); c.fill = INPUT; c.border = BOX
ws.cell(5, 6, '默认 0：怪物按“刚到这一级、还没刷”的玩家设计，之后刷怪/养成只会更轻松。').font = NOTE
widths(ws, [6, 14, 12, 40, 4, 40, 8])
NL = len(LV)


def attain_sheet(name, src):
    ws = wb.create_sheet(name)
    k = len(systems)
    header(ws, 1, ['等级', '取值时刻(时)'] + [s['name'] for s in systems] + ['整体达标率'])
    for i, L in enumerate(LV, 2):
        ws.cell(i, 1, L); ws.cell(i, 2, f'=等级时长!C{i}+达标参数!$G$4*等级时长!B{i}/60')
        for j in range(k):
            m = col(j + 2); lag = f'达标参数!$C${4 + j}'
            t = f'MAX(0,$B{i}-{lag})'
            kk = f'MATCH({t},等级时长!$C$2:$C${NL + 1},1)'
            c0 = f"LN(INDEX('{src}'!{m}$2:{m}${NL + 1},{kk}))"
            c1 = f"LN(INDEX('{src}'!{m}$2:{m}${NL + 1},MIN({NL},{kk}+1)))"
            fr = f'MIN(1,({t}-INDEX(等级时长!$C$2:$C${NL + 1},{kk}))/(INDEX(等级时长!$B$2:$B${NL + 1},{kk})/60))'
            cl = f"LN('{src}'!{m}{i})"
            ws.cell(i, j + 3, f'=IF({cl}<=0,1,MAX(0,MIN(1,({c0}+{fr}*({c1}-{c0}))/{cl})))')
        ws.cell(i, k + 3, f"=EXP(SUMPRODUCT((C{i}:{col(k + 2)}{i}-1)*LN('{src}'!B{i}:{col(k + 1)}{i})))")
    fmt(ws, f'B2:B{NL + 1}', '0.00'); fmt(ws, f'C2:{col(k + 3)}{NL + 1}', '0%')
    ws.conditional_formatting.add(f'C2:{col(k + 3)}{NL + 1}', ColorScaleRule(start_type='num', start_value=0, start_color='F8696B', mid_type='num', mid_value=0.6, mid_color='FFEB84', end_type='num', end_value=1, end_color='FFFFFF'))
    widths(ws, [6, 10] + [8] * k + [11]); ws.freeze_panes = 'C2'
    ws.cell(NL + 3, 1, '单项达标率 = 实际玩家该养成的对数贡献 ÷ 标准人该养成的对数贡献；整体达标率 = 实际玩家 ÷ 标准人 = EXP(Σ(达标率−1)×ln(倍数))。').font = NOTE
    ch = LineChart(); ch.title = name.replace('达标率_', '') + '整体达标率'; ch.height = 8; ch.width = 18
    ch.add_data(Reference(ws, min_col=k + 3, min_row=1, max_row=NL + 1), titles_from_data=True); ch.set_categories(Reference(ws, min_col=1, min_row=2, max_row=NL + 1))
    ch.y_axis.scaling.min = 0; ch.y_axis.scaling.max = 1; ws.add_chart(ch, f'{col(k + 5)}2')


attain_sheet('达标率_输出', '养成倍数_输出'); attain_sheet('达标率_生存', '养成倍数_生存')
mult_sheet('养成倍数_生命', 'hp'); mult_sheet('养成倍数_护甲', 'armor')
attain_sheet('达标率_生命', '养成倍数_生命'); attain_sheet('达标率_护甲', '养成倍数_护甲')

# ---------------- 阶段占比 ----------------
ws = wb.create_sheet('阶段占比')
k = len(systems)
for block, (title, src) in enumerate([('输出占比', '养成占比_输出'), ('生存占比', '养成占比_生存')]):
    top = 1 + block * (len(STAGE_LV) + 4)
    ws.cell(top, 1, title).font = Font(bold=True, size=12)
    header(ws, top + 1, ['等级', '输出倍数' if block == 0 else '生存倍数'] + [s['name'] for s in systems] + ['已拟合', '深度养成'])
    for i, L in enumerate(STAGE_LV):
        r = top + 2 + i
        ws.cell(r, 1, L)
        ws.cell(r, 2, f"=INDEX(标准人属性!{'S' if block == 0 else 'T'}:{'S' if block == 0 else 'T'},MATCH(A{r},标准人属性!A:A,0))").number_format = '0.00'
        for j in range(k + 2):
            ws.cell(r, j + 3, f"=INDEX('{src}'!{col(j + 2)}:{col(j + 2)},MATCH($A{r},'{src}'!$A:$A,0))").number_format = '0.0%'
    chart = BarChart(); chart.type = 'col'; chart.grouping = 'percentStacked'; chart.overlap = 100
    chart.title = title + '（章节末/满级）'; chart.height = 11; chart.width = 30
    chart.add_data(Reference(ws, min_col=3, max_col=k + 2, min_row=top + 1, max_row=top + 1 + len(STAGE_LV)), titles_from_data=True)
    chart.set_categories(Reference(ws, min_col=1, min_row=top + 2, max_row=top + 1 + len(STAGE_LV)))
    ws.add_chart(chart, f'{col(k + 6)}{top}')
widths(ws, [6, 9] + [8] * k + [8, 9])

# ---------------- 实战效率 ----------------
EFF = json.load(open(os.path.join(os.path.dirname(SRC), 'efficiency.json'), encoding='utf-8'))
ws = wb.create_sheet('实战效率')
header(ws, 1, ['等级', '普通/精英效率', '首领效率', '来源'])
er = EFF['rows']; bl = meta['bossLevels']
avg_n = sum(r['field']['killEfficiency'] for r in er) / len(er); avg_b = sum(r['boss']['efficiency'] for r in er) / len(er)
for i, L in enumerate(LV, 2):
    ch = next((k for k, b in enumerate(bl) if L <= b), None)
    en, eb, src = (er[ch]['field']['killEfficiency'], er[ch]['boss']['efficiency'], f"第{ch + 1}章实测（{er[ch]['island']} / 首领L{er[ch]['bossLevel']}）") if ch is not None else (avg_n, avg_b, '主线后：六章平均（未单独实测）')
    ws.cell(i, 1, L); a = ws.cell(i, 2, round(en, 3)); b = ws.cell(i, 3, round(eb, 3)); a.fill = INPUT; b.fill = INPUT; ws.cell(i, 4, src)
fmt(ws, f'B2:C{len(LV) + 1}', '0.00')
ws.cell(1, 6, '实测明细（体感 = 单只从首次命中到死亡；效率 = 站桩理论用时 ÷ 体感用时）').font = Font(bold=True)
header(ws, 2, ['章', '岛屿', '等级', '站桩DPS', '击杀数', '单只体感(秒)', '单只理论(秒)', '普通效率', '清图效率(含跑图)', '交战时间占比', '首领等级', '首领效率'], c0=6)
for j, r in enumerate(er, 3):
    f = r['field']
    for c, v in enumerate([r['chapter'], r['island'], r['level'], round(r['stationaryDps']), f['kills'], round(f['meanKillSeconds'], 2), round(f['theoryKillSeconds'], 2), round(f['killEfficiency'], 3), round(f['clearEfficiency'], 3), round(f['engagedShare'], 3), r['bossLevel'], round(r['boss']['efficiency'], 3)], 6):
        ws.cell(j, c, v)
ws.cell(10, 6, f"探针 tools/field-efficiency-probe.ts；构筑 = {EFF['build']}；种子 {EFF['seeds']}；野外 {EFF['fieldSeconds']} 秒/种子，首领 {EFF['bossSeconds']} 秒/种子（首领生命放大不死，只覆盖第一阶段）；自动模式，不含手动操作损失。").font = NOTE
ws.cell(11, 6, '黄色列可改：建议用试玩录像/日志校准后覆盖。手动操作通常比自动再低 10–25%。').font = NOTE
widths(ws, [6, 13, 10, 40, 4, 5, 14, 6, 10, 7, 12, 12, 9, 15, 12, 9, 9])

# ---------------- 怪物推算 ----------------
ws = wb.create_sheet('怪物推算')
T, R = meta['targets'], meta['ranks']
params = [('普通怪 TTK(秒)', T['normal']['ttk']), ('普通怪 TTD(秒)', T['normal']['ttd']), ('精英 TTK(秒)', T['elite']['ttk']), ('精英 TTD(秒)', T['elite']['ttd']),
          ('首领 TTK(秒)', 75), ('首领 TTD(秒)', T['boss']['ttd']), ('普通怪攻击间隔(秒)', 3), ('首领攻击间隔(秒)', 2.5), ('技能修正(怪物技能/普攻)', 1),
          ('精英生命倍率(现)', R['elite']['hp']), ('精英攻击倍率(现)', R['elite']['attack']),
          ('首领生命倍率(现)', R['boss']['hp']), ('首领攻击倍率(现)', R['boss']['attack'])]
ws.cell(1, 1, '参数（黄色可改）').font = Font(bold=True, size=12)
P = {}
for i, (t, v) in enumerate(params, 2):
    ws.cell(i, 1, t); c = ws.cell(i, 2, v); c.fill = INPUT; c.border = BOX; P[t] = f'$B${i}'
ws.cell(2, 4, '所有 TTK 均为体感秒。参考玩家 = 标准人 × 达标率（见 达标参数 / 达标率_*）。DPS_用(理论) = 标准DPS × 输出达标率；建议生命 = DPS_用 × 实战效率 × 体感TTK（效率见《实战效率》，普通/精英与首领分开）。生命_用 = 标准生命 × 生命达标率；护甲_用 = 标准护甲 × 护甲达标率。').font = NOTE
ws.cell(3, 4, '怪物攻击反推（护甲命中比模型）：伤害 d = 攻击²/(2×护甲+攻击)，减伤上限 90% → 攻击 = MIN((d+√(d²+8·护甲·d))/2, 10d)，d = 玩家生命 × 攻击间隔 / TTD / 技能修正。').font = NOTE
ws.cell(4, 4, '首领 TTK 用单体 DPS；普通/精英也用单体 DPS（与原拟合一致：普通怪生命 = 2.5 × 基准单体 DPS）。').font = NOTE
h0 = len(params) + 3
header(ws, h0, ['等级', '基准DPS', '标准DPS', 'DPS_用(理论)', '生命_用', '护甲_用',
                '建议普通生命', '建议普通攻击', '建议精英生命', '建议精英攻击', '建议首领生命', '建议首领攻击',
                '现普通生命', '现普通攻击', '现首领生命', '现首领攻击',
                '生命系数(建议/现)', '攻击系数(建议/现)', '现普通体感TTK·标准人', '现首领体感TTK·标准人', '现普通体感TTK·基准人', '现首领体感TTK·基准人'])


def atk(d, a):
    return f'MIN(({d}+SQRT({d}^2+8*{a}*{d}))/2,10*{d})'


for i, r in enumerate(rows):
    x = h0 + 1 + i
    L = r['level']; cur = r['monster']['current']
    look = lambda c: f'INDEX(标准人属性!{c}:{c},MATCH($A{x},标准人属性!$A:$A,0))'
    ws.cell(x, 1, L)
    ws.cell(x, 2, f'={look("M")}'); ws.cell(x, 3, f'={look("N")}')
    effN = f'INDEX(实战效率!$B:$B,MATCH($A{x},实战效率!$A:$A,0))'; effB = f'INDEX(实战效率!$C:$C,MATCH($A{x},实战效率!$A:$A,0))'
    ws.cell(x, 4, f'=C{x}*{look("W")}')
    ws.cell(x, 5, f'={look("F")}*INDEX(达标率_生命!{AK}:{AK},MATCH($A{x},达标率_生命!$A:$A,0))')
    ws.cell(x, 6, f'={look("H")}*INDEX(达标率_护甲!{AK}:{AK},MATCH($A{x},达标率_护甲!$A:$A,0))')
    ws.cell(x, 7, f'=D{x}*{effN}*{P["普通怪 TTK(秒)"]}')
    dn = f'(E{x}*{P["普通怪攻击间隔(秒)"]}/{P["普通怪 TTD(秒)"]}/{P["技能修正(怪物技能/普攻)"]})'
    ws.cell(x, 8, '=' + atk(dn, f'F{x}'))
    ws.cell(x, 9, f'=D{x}*{effN}*{P["精英 TTK(秒)"]}')
    de = f'(E{x}*{P["普通怪攻击间隔(秒)"]}/{P["精英 TTD(秒)"]}/{P["技能修正(怪物技能/普攻)"]})'
    ws.cell(x, 10, '=' + atk(de, f'F{x}'))
    ws.cell(x, 11, f'=D{x}*{effB}*{P["首领 TTK(秒)"]}')
    db = f'(E{x}*{P["首领攻击间隔(秒)"]}/{P["首领 TTD(秒)"]}/{P["技能修正(怪物技能/普攻)"]})'
    ws.cell(x, 12, '=' + atk(db, f'F{x}'))
    ws.cell(x, 13, cur['hp']); ws.cell(x, 14, cur['attack'])
    ws.cell(x, 15, f'=M{x}*{P["首领生命倍率(现)"]}'); ws.cell(x, 16, f'=N{x}*{P["首领攻击倍率(现)"]}')
    ws.cell(x, 17, f'=G{x}/M{x}'); ws.cell(x, 18, f'=H{x}/N{x}')
    ws.cell(x, 19, f'=M{x}/(C{x}*{effN})'); ws.cell(x, 20, f'=O{x}/(C{x}*{effB})'); ws.cell(x, 21, f'=M{x}/(B{x}*{effN})'); ws.cell(x, 22, f'=O{x}/(B{x}*{effB})')
last = h0 + len(rows)
fmt(ws, f'B{h0 + 1}:P{last}', '#,##0'); fmt(ws, f'Q{h0 + 1}:V{last}', '0.00')
widths(ws, [24, 12, 12, 12, 10, 9] + [15] * 10 + [11] * 6); ws.freeze_panes = ws.cell(h0 + 1, 2)
ch = LineChart(); ch.title = '怪物生命系数（建议/现曲线）'; ch.height = 9; ch.width = 22; ch.y_axis.scaling.logBase = 10
ch.add_data(Reference(ws, min_col=17, max_col=18, min_row=h0, max_row=last), titles_from_data=True)
ch.set_categories(Reference(ws, min_col=1, min_row=h0 + 1, max_row=last)); ws.add_chart(ch, 'X2')

# ---------------- 副本推算 ----------------
ws = wb.create_sheet('副本推算')
ws.cell(1, 1, '参数（黄色可改）').font = Font(bold=True, size=12)
dp = [('团队副本有效人数（14输出+6辅助×0.3）', 15.8), ('目标TTK·试炼(秒)', 60), ('目标TTK·高难(秒)', 90), ('目标TTK·噩梦1层(秒)', 60),
      ('目标TTK·团队首领(秒)', 180), ('目标首领单次伤害占玩家生命', 0.08), ('噩梦每层预期养成增量', 0.06)]
D = {}
for i, (t, v) in enumerate(dp, 2):
    ws.cell(i, 1, t); c = ws.cell(i, 2, v); c.fill = INPUT; c.border = BOX; D[t] = f'$B${i}'
ws.cell(2, 4, "DPS_用 / 生命_用 引用《怪物推算》（标准人 × 达标率）。推荐等级 = max(副本等级, 星潮海首领映射等级)。首领数值为真实 dungeonSpawns（星潮海世界线，最低档位/各噩梦层，不含随机词缀；噩梦另有 2 个随机词缀，生命期望×1.5、攻击期望×1.25）。").font = NOTE
ws.cell(3, 4, '建议 enemyScale = 现 enemyScale × 生命系数（目标TTK ÷ 现TTK）。噩梦按 1 层目标定 enemyScale，层数成长 hpPerTier 不变。').font = NOTE
h0 = len(dp) + 3
header(ws, h0, ['副本ID', '名称', '类型', '档位/层', '阶段数', '推荐等级', '人数', '现 enemyScale.hp', '现 enemyScale.atk', '首领生命', '首领攻击', '首领护甲',
                '杂兵总生命(末阶段)', '标准DPS', '基准DPS', 'DPS_用', '玩家生命_用', '现体感TTK·标准人', '现体感TTK·基准人', '现体感TTK·DPS_用', '目标体感TTK',
                '生命系数', '建议 enemyScale.hp', '现单次伤害/生命_用', '攻击系数', '建议 enemyScale.atk'])
KIND = {'trial': '试炼', 'high': '高难', 'nightmare': '噩梦', 'raid': '团队'}
mp = "'怪物推算'"
mrow0 = len(params) + 4
x = h0
for d in dungeons:
    for t in d['tiers']:
        x += 1
        last_stage = t['stages'][-1]; L = min(60, max(d['entryLevel'], last_stage['level'] or 1))
        target = {'trial': D['目标TTK·试炼(秒)'], 'high': D['目标TTK·高难(秒)'], 'nightmare': D['目标TTK·噩梦1层(秒)'], 'raid': D['目标TTK·团队首领(秒)']}[d['kind']]
        party = D['团队副本有效人数（14输出+6辅助×0.3）'] if d['kind'] == 'raid' else 1
        vals = [d['id'], d['name'], KIND[d['kind']], t['tier'], len(t['stages']), L, d['party'], d['enemyScale']['hp'], d['enemyScale']['attack'],
                last_stage['bossHp'], last_stage['bossAttack'], last_stage['bossArmor'], last_stage['addsHp']]
        for j, v in enumerate(vals, 1): ws.cell(x, j, v)
        look = lambda c, sheet='标准人属性': f'INDEX({sheet}!{c}:{c},MATCH($F{x},{sheet}!$A:$A,0))'
        ws.cell(x, 14, f'={look("N")}'); ws.cell(x, 15, f'={look("M")}')
        ws.cell(x, 16, f"=INDEX({mp}!D:D,MATCH($F{x},{mp}!$A${mrow0}:$A$999,0)+{mrow0 - 1})")
        ws.cell(x, 17, f"=INDEX({mp}!E:E,MATCH($F{x},{mp}!$A${mrow0}:$A$999,0)+{mrow0 - 1})")
        eb = f'INDEX(实战效率!$C:$C,MATCH($F{x},实战效率!$A:$A,0))'
        ws.cell(x, 18, f'=J{x}/(N{x}*{party}*{eb})'); ws.cell(x, 19, f'=J{x}/(O{x}*{party}*{eb})'); ws.cell(x, 20, f'=J{x}/(P{x}*{party}*{eb})')
        ws.cell(x, 21, f'={target}' if d['kind'] != 'nightmare' else f'={target}*(1+{t["tier"] - 1}*{d["tierRules"]["hpPerTier"]})/(1+{t["tier"] - 1}*{D["噩梦每层预期养成增量"]})')
        ws.cell(x, 22, f'=U{x}/T{x}'); ws.cell(x, 23, f'=H{x}*V{x}')
        ws.cell(x, 24, f'=K{x}/Q{x}'); ws.cell(x, 25, f"={D['目标首领单次伤害占玩家生命']}/X{x}"); ws.cell(x, 26, f'=I{x}*Y{x}')
        if d['kind'] == 'nightmare' and t['tier'] > 1:
            ws.cell(x, 23, '（同1层）'); ws.cell(x, 26, '（同1层）')
fmt(ws, f'H{h0 + 1}:I{x}', '0.000'); fmt(ws, f'J{h0 + 1}:Q{x}', '#,##0'); fmt(ws, f'R{h0 + 1}:V{x}', '0.0')
fmt(ws, f'W{h0 + 1}:W{x}', '0.000'); fmt(ws, f'X{h0 + 1}:X{x}', '0.0%'); fmt(ws, f'Y{h0 + 1}:Y{x}', '0.00'); fmt(ws, f'Z{h0 + 1}:Z{x}', '0.000')
ws.cell(x + 2, 1, '噩梦目标TTK = 1层目标 × (1+层×hpPerTier)/(1+层×每层预期养成增量)：层数生命成长快于玩家养成时，深层自然变难。').font = NOTE
widths(ws, [18, 12, 6, 7, 6, 8, 5, 10, 10, 13, 9, 8, 14, 12, 12, 12, 10, 11, 11, 11, 8, 9, 12, 12, 9, 12]); ws.freeze_panes = ws.cell(h0 + 1, 3)

os.makedirs(os.path.dirname(OUT), exist_ok=True)
wb.save(OUT)
copy = os.path.join(ROOT, '.design', 'standard-player-20261005', os.path.basename(OUT))
if os.path.abspath(copy) != os.path.abspath(OUT): shutil.copyfile(OUT, copy)
print('saved', OUT, 'and', copy)
