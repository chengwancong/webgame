import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

wb = openpyxl.Workbook()
wb.remove(wb.active)

HDR_FILL = PatternFill('solid', start_color='4472C4')
HDR_FONT = Font(bold=True, color='FFFFFF', size=11)
TITLE_FONT = Font(bold=True, size=14)
THIN = Side(style='thin', color='BFBFBF')
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)


def style_header(ws, row, ncols):
    for c in range(1, ncols + 1):
        cell = ws.cell(row, c)
        cell.fill = HDR_FILL
        cell.font = HDR_FONT
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = BORDER


def set_widths(ws, widths):
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


def write_rows(ws, start_row, data):
    for i, row in enumerate(data):
        for j, val in enumerate(row):
            cell = ws.cell(start_row + i, j + 1, val)
            cell.border = BORDER
    return start_row + len(data)


# ===== Sheet 1: 武器盘乘区表 =====
ws = wb.create_sheet('武器盘-乘区')
ws['A1'] = '武器盘系统 — 乘区与武器技能数值'
ws['A1'].font = TITLE_FONT
ws.merge_cells('A1:G1')

hdr = ['技能类型', '效果', '乘区', '基础值', '满级值', '获取难度', '定位']
for c, h in enumerate(hdr, 1):
    ws.cell(2, c, h)
style_header(ws, 2, len(hdr))

grid = [
    ['攻刃(ATK)', '攻击力+X%', '普通(加算)', '15%', '30%', '易', '输出基础'],
    ['必杀刃(Skill)', '技能伤害+X%', '普通(加算)', '20%', '50%', '中', '技能流核心'],
    ['守护(HP)', '生命值+X%', '普通(加算)', '15%', '35%', '易', '生存'],
    ['铁壁(DEF)', '防御力+X%', '普通(加算)', '12%', '25%', '易', '坦克'],
    ['技巧(Crit)', '暴击率+X%', '普通(加算)', '8%', '18%', '中', '暴击流'],
    ['方阵攻刃(Omega)', '攻击力xN倍', '方阵(乘算)', '1.5x', '2.5x', '极难', '核心爆发'],
    ['方阵必杀(Omega)', '技能伤害xN倍', '方阵(乘算)', '1.8x', '3.0x', '极难', '技能流核心'],
]
r = write_rows(ws, 3, grid)

ws.cell(r + 1, 1, '乘区规则').font = Font(bold=True)
ws.cell(r + 2, 1, '普通攻刃=加算；方阵倍率=乘算；方阵x普通=爆炸伤害')
ws.cell(r + 3, 1, '公式: 攻击=基础x(1+攻刃总和)x方阵攻击倍率')
ws.cell(r + 4, 1, '公式: 技能伤害=基础技能x(1+必杀刃总和)x方阵必杀倍率')
set_widths(ws, [18, 18, 14, 10, 10, 12, 16])

# ===== Sheet 2: 武器突破表 =====
ws2 = wb.create_sheet('武器盘-突破')
ws2['A1'] = '武器上限突破 (Uncap) 数值'
ws2['A1'].font = TITLE_FONT
ws2.merge_cells('A1:F1')

hdr2 = ['突破星级', '等级上限', '技能效果', '同种武器', '方阵碎片', '特殊材料']
for c, h in enumerate(hdr2, 1):
    ws2.cell(2, c, h)
style_header(ws2, 2, len(hdr2))

uncap = [
    ['★0', 'Lv50', '100%', '-', '-', '-'],
    ['★1', 'Lv75', '130%', 'x1', '-', '-'],
    ['★2', 'Lv100', '160%', 'x2', 'x20', '-'],
    ['★3', 'Lv125', '200%', 'x3', 'x50', '-'],
    ['★4', 'Lv150', '250%', 'x5', 'x100', 'BOSS素材'],
    ['★5', 'Lv150', '300%', 'x10', 'x200', '金月x10+传说素材'],
]
write_rows(ws2, 3, uncap)
set_widths(ws2, [12, 14, 14, 14, 14, 22])

# ===== Sheet 3: 武器品质表 =====
ws3 = wb.create_sheet('武器盘-品质')
ws3['A1'] = '武器品质与获取'
ws3['A1'].font = TITLE_FONT
ws3.merge_cells('A1:E1')

hdr3 = ['品质', '技能数', '技能等级', '获取方式', '定位']
for c, h in enumerate(hdr3, 1):
    ws3.cell(2, c, h)
style_header(ws3, 2, len(hdr3))

qual = [
    ['普通(R)', '1个', '低级', '普通怪掉落', '过渡'],
    ['精良(SR)', '1个', '中级', '精英/副本', '中期'],
    ['稀有(SSR)', '2个', '高级', 'BOSS/高难', '核心'],
    ['方阵(Omega)', '1个方阵', '方阵级', '高难副本farming', '终局核心'],
    ['神话(Primal)', '2个方阵', '方阵级', '隐藏BOSS', '天花板'],
]
write_rows(ws3, 3, qual)
set_widths(ws3, [16, 12, 12, 22, 14])

# ===== Sheet 4: 威能数值表 =====
ws4 = wb.create_sheet('威能系统')
ws4['A1'] = '传奇威能 (Aspects) 数值'
ws4['A1'].font = TITLE_FONT
ws4.merge_cells('A1:F1')

hdr4 = ['威能类型', '槽位', '效果示例', '数值', '数量', '定位']
for c, h in enumerate(hdr4, 1):
    ws4.cell(2, c, h)
style_header(ws4, 2, len(hdr4))

aspects = [
    ['攻击威能', '武器/手套', '技能伤害+X%', '40%', '30个', '高价值'],
    ['防御威能', '胸甲/护腿', '受伤获得护盾', '护盾值=15%HP', '20个', '生存'],
    ['资源威能', '头盔/戒指', '击杀回能+X%', '30%', '15个', '续航'],
    ['机动威能', '鞋子', '位移CD-X%', '50%', '10个', '手感'],
    ['效用威能', '护身符', '掉落率+X%', '25%', '15个', 'Farming'],
    ['专属威能', '特定槽', '改变技能机制', '机制级', '30个', 'Build核心'],
]
r4 = write_rows(ws4, 3, aspects)

ws4.cell(r4 + 1, 1, '威能法典收集奖励').font = Font(bold=True)
coll = [
    ['收集30个', '全威能效果+5%'],
    ['收集60个', '全威能效果+10%'],
    ['收集90个', '全威能效果+15%'],
    ['收集120个', '全威能效果+20%+称号'],
]
write_rows(ws4, r4 + 2, coll)
set_widths(ws4, [14, 14, 20, 14, 10, 14])

# ===== Sheet 5: 天赋树数值 =====
ws5 = wb.create_sheet('天赋树')
ws5['A1'] = '三系专精与天赋节点数值'
ws5['A1'].font = TITLE_FONT
ws5.merge_cells('A1:E1')

hdr5 = ['专精', '定位', '关键天赋(Capstone)', '每点属性', '节点数']
for c, h in enumerate(hdr5, 1):
    ws5.cell(2, c, h)
style_header(ws5, 2, len(hdr5))

talents = [
    ['战士系', '近战/生存', '斩杀(对低血+100%伤害)', '+2%小节点/+8%大节点', '30节点'],
    ['法师系', '技能/爆发', '奥术强化(技能伤害+50%)', '+2%小节点/+8%大节点', '30节点'],
    ['游侠系', '暴击/机动', '致命(暴击伤害+80%)', '+2%小节点/+8%大节点', '30节点'],
]
r5 = write_rows(ws5, 3, talents)

ws5.cell(r5 + 1, 1, '巅峰盘(Paragon) 50级后').font = Font(bold=True)
para = [
    ['普通节点', '+1%属性'],
    ['魔法节点', '+5%属性'],
    ['稀有节点', '+15%属性或特殊'],
    ['雕文插槽', '范围内节点+X%'],
    ['雕文满级', 'Lv21'],
]
write_rows(ws5, r5 + 2, para)
set_widths(ws5, [12, 14, 30, 26, 12])

# ===== Sheet 6: 召唤石 =====
ws6 = wb.create_sheet('召唤石')
ws6['A1'] = '召唤石加护与突破'
ws6['A1'].font = TITLE_FONT
ws6.merge_cells('A1:E1')

hdr6 = ['加护类型', '主召唤效果', '友召效果', '满级', '获取']
for c, h in enumerate(hdr6, 1):
    ws6.cell(2, c, h)
style_header(ws6, 2, len(hdr6))

summons = [
    ['攻击加护', '全队攻击+80%', '全队攻击+40%', 'Lv200 ★5', '高难/金月'],
    ['属性加护', '特定属性伤害+60%', '特定属性+30%', 'Lv200 ★5', '高难'],
    ['生存加护', '生命/防御+50%', '生命/防御+25%', 'Lv200 ★5', '副本'],
    ['技能加护', '技能伤害+40%', '技能伤害+20%', 'Lv200 ★5', '高难'],
]
write_rows(ws6, 3, summons)
set_widths(ws6, [14, 20, 20, 16, 14])

# ===== Sheet 7: 声望数值 =====
ws7 = wb.create_sheet('声望系统')
ws7['A1'] = '势力声望等级与奖励'
ws7['A1'].font = TITLE_FONT
ws7.merge_cells('A1:D1')

hdr7 = ['声望等级', '进度', '奖励', '解锁内容']
for c, h in enumerate(hdr7, 1):
    ws7.cell(2, c, h)
style_header(ws7, 2, len(hdr7))

rep = [
    ['中立', '0-3000', '-', '起始'],
    ['友善', '3000-6000', '区域商店开放', '买图纸/材料'],
    ['尊敬', '6000-9000', '声望装备(紫色)', '紫装'],
    ['崇敬', '9000-12000', '专业配方+坐骑', '配方'],
    ['崇拜', '12000', '传说图纸+特殊称号', '传说'],
]
write_rows(ws7, 3, rep)
set_widths(ws7, [14, 16, 24, 18])

# ===== Sheet 8: 突破觉醒 =====
ws8 = wb.create_sheet('角色突破觉醒')
ws8['A1'] = '角色上限突破(Uncap)与觉醒'
ws8['A1'].font = TITLE_FONT
ws8.merge_cells('A1:E1')

hdr8 = ['突破星级', '等级上限', '属性提升', '碎片消耗', '特殊材料']
for c, h in enumerate(hdr8, 1):
    ws8.cell(2, c, h)
style_header(ws8, 2, len(hdr8))

awaken = [
    ['★1', '+10', '+15%', '碎片x20', '-'],
    ['★2', '+10', '+15%', '碎片x50', '区域素材'],
    ['★3', '+10', '+15%', '碎片x100', 'BOSS素材'],
    ['★4', '+10', '+15%', '碎片x200', '高难素材'],
    ['★5', '+10', '+15%', '金月x20', '传说素材'],
]
r8 = write_rows(ws8, 3, awaken)

ws8.cell(r8 + 1, 1, '觉醒等级 Lv1-10').font = Font(bold=True)
ws8.cell(r8 + 2, 1, '每级: 全属性+3%，解锁觉醒技能(每层3选1)')
set_widths(ws8, [14, 14, 14, 16, 18])

# ===== Sheet 9: 高难副本掉落 =====
ws9 = wb.create_sheet('高难副本掉落')
ws9['A1'] = '高难副本掉落表 (武器盘核心来源)'
ws9['A1'].font = TITLE_FONT
ws9.merge_cells('A1:E1')

hdr9 = ['副本BOSS', '等级', '掉落武器', '武器技能', '每日次数']
for c, h in enumerate(hdr9, 1):
    ws9.cell(2, c, h)
style_header(ws9, 2, len(hdr9))

raids = [
    ['原野之主', 'Lv20+', '方阵攻刃武器', '攻刃x1.5-2.5', '3次'],
    ['林地守卫', 'Lv30+', '方阵必杀武器', '必杀x1.8-3.0', '3次'],
    ['裂谷暴君', 'Lv40+', '方阵攻刃武器', '攻刃x2.0-2.5', '3次'],
    ['冰霜女王', 'Lv50', '方阵必杀武器(核心)', '必杀x3.0', '3次'],
    ['深渊之主', 'Lv50', '神话武器素材', '素材', '2次'],
    ['远古龙王', 'Lv50', '神话武器(天花板)', '方阵x2', '1次'],
]
write_rows(ws9, 3, raids)
set_widths(ws9, [16, 12, 22, 18, 12])

# ===== Sheet 10: 终局乘区总表（公式计算）=====
ws10 = wb.create_sheet('终局乘区总表')
ws10['A1'] = '终局满配乘区叠加计算 (自动公式)'
ws10['A1'].font = TITLE_FONT
ws10.merge_cells('A1:D1')

ws10['A3'] = '乘区项'
ws10['B3'] = '数值'
ws10['C3'] = '说明'
style_header(ws10, 3, 3)

# 输入值（蓝色=可调整输入）
inputs = [
    ['普通攻刃加算总和', 3.0, '8把x25% = 300%'],
    ['方阵攻击倍率', 32.0, '5把方阵x2.0 (示例)'],
    ['召唤石攻击光环', 0.8, '★5路西法 +80%'],
    ['天赋攻击加成', 0.6, '满天赋 +60%'],
    ['觉醒加成', 0.3, '觉醒Lv10 +30%'],
    ['必杀刃加算总和', 2.0, '4把x50% = 200%'],
    ['方阵技能倍率', 27.0, '3把方阵x3.0'],
    ['威能技能伤害', 0.4, '攻击威能+40%'],
]
r10 = 4
for name, val, note in inputs:
    ws10.cell(r10, 1, name)
    c = ws10.cell(r10, 2, val)
    c.font = Font(color='0000FF')  # 蓝色=输入
    ws10.cell(r10, 3, note)
    ws10.cell(r10, 1).border = BORDER
    c.border = BORDER
    ws10.cell(r10, 3).border = BORDER
    r10 += 1

# 公式计算
ws10.cell(r10 + 1, 1, '攻击面总倍率').font = Font(bold=True)
ws10.cell(r10 + 1, 2, f'=(1+B4)*B5*(1+B6)*(1+B7)*(1+B8)')
ws10.cell(r10 + 1, 3, '=(1+攻刃)x方阵x(1+召唤)x(1+天赋)x(1+觉醒)')

ws10.cell(r10 + 2, 1, '技能面总倍率').font = Font(bold=True)
ws10.cell(r10 + 2, 2, f'=(1+B9)*B10*(1+B11)')
ws10.cell(r10 + 2, 3, '=(1+必杀刃)x方阵技能x(1+威能)')

ws10.cell(r10 + 3, 1, '理论总伤害倍率').font = Font(bold=True, color='008000')
ws10.cell(r10 + 3, 2, f'=B{r10+1}*B{r10+2}')
ws10.cell(r10 + 3, 2).font = Font(bold=True, color='008000')
ws10.cell(r10 + 3, 3, '攻击面 x 技能面')

ws10.cell(r10 + 5, 1, '对比: 裸装倍率').font = Font(bold=True)
ws10.cell(r10 + 5, 2, 1)
ws10.cell(r10 + 6, 1, '对比: 普通满配(无方阵)').font = Font(bold=True)
ws10.cell(r10 + 6, 2, f'=(1+B4)*(1+B9)')
ws10.cell(r10 + 6, 3, '仅加算，无方阵乘算')

set_widths(ws10, [22, 16, 34])

wb.save('game-deep-progression-tables.xlsx')
print('OK: game-deep-progression-tables.xlsx')
