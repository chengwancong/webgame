"""将最终授权复核证据发布到四张只读输出页；不触发测量或游戏数值写回。"""
from pathlib import Path
import json, sys
import workbook
from workbook import publish, ROOT

def read(path):return json.loads((ROOT/path).read_text(encoding='utf-8'))
def columns(items):return [(key,label,kind,width) for key,label,kind,width in items]
review=Path(next((a[9:] for a in sys.argv if a.startswith('--review=')),str(ROOT/'docs/reviews/numeric-spine-20261013')))
workbook.REVIEW=review
workbook.FILE=Path(next((a[11:] for a in sys.argv if a.startswith('--workbook=')),str(workbook.FILE)))
player=read('tools/spine/data/spine-player.json')
publish({'columns':columns([('level','等级','number',12),('D1','单体DPS','number',20),('DN','多目标DPS','number',20),('B3','B3末端平滑DPS','number',24),('EHP','有限窗口有效生命','number',24),('AV','60秒窗口安全度','number',22)]),'rows':player['points']},'标准人曲线')
weights=read('tools/spine/data/stat-weights.json')['rows']
publish({'columns':columns([('level','等级','number',12),('stat','属性','string',28),('delta','测量扰动','number',18),('powerWeight','每单位对数力量','number',24),('deltaSource','扰动来源','string',36)]),'rows':weights},'属性权重')
budget=read(review/'S8/final-validation/budget/audit-summary.json')['rows']
for row in budget:
 row['status']='不可判定' if row['observed'] is None else '带内' if row['inBand'] else '实测越界'
publish({'columns':columns([('category','类别','string',18),('id','内容ID','string',42),('observed','有符号实测值','number',22),('center','组中位数','number',22),('error','相对偏差','number',22),('functional','功能型','bool',12),('inBand','带内','bool',12),('status','验收状态','string',18),('host','宿主','string',35)]),'rows':budget},'预算审计')
before=read(review/'S5/monster-summary.json')['lines']
current=read('packages/content/monsters.json')['curves']
rows=[]
for family,curve in current.items():
 for row in curve:
  old=next((p for p in before if p['family']==family and p['level']==row['level']),{})
  rows.append({'family':family,**row,'beforeHp':old.get('beforeHp'),'beforeAttack':old.get('beforeAttack')})
publish({'columns':columns([('family','曲线族','string',22),('level','等级','number',12),('beforeHp','原生命','number',18),('hp','最终生命','number',18),('beforeAttack','原攻击','number',18),('attack','最终攻击','number',18),('armor','护甲','number',18)]),'rows':rows},'怪物曲线')
