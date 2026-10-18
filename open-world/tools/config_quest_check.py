"""Semantic checks shared by export/check; rejects task-only progression and deadlocks."""
def validate_quest_config(files):
  tasks=files.get('tasks.json',{}); cs=tasks.get('conditions',[])
  if not cs: return # Old workbooks remain readable during the explicit upgrade.
  rows={t['id']:t for t in tasks['tasks']}; world=files['world.json']; chapters=files['chapters.json']; npcs=files['npcs.json']['npcs']
  params={p['id']:p['value'] for p in tasks.get('parameters',[])}; legacy=set(params.get('legacy_tasks',[])); legacy_layout=set(params.get('legacy_layout',[]))
  zones={z['id'] for z in world['zones']}; islands={c['map'] for c in chapters['chapters'] if c['campaign']=='starsea'}; bosses={c.get('boss_map') for c in chapters['chapters'] if c['campaign']=='starsea'}; npc_ids={n['id'] for n in npcs}; features={f['id'] for f in chapters['features']}|{'sprint','waypoint','outpost','events','bounty','field-dungeon'}; gates={g['id'] for g in world.get('gates',[])}; wp={w['id'] for w in world['waypoints']}
  grouped={}; graph={}; fail=lambda msg: (_ for _ in ()).throw(ValueError('任务配置：'+msg))
  for c in cs:
    target=c['target']; grouped.setdefault(target,{}).setdefault(c['group'],[]).append(c)
    kind,value=c['kind'],c['value']; reference={'task':rows,'task_active':rows,'task_ready':rows,'feature':features,'island':islands,'boss':bosses,'zone':zones,'gate':gates,'waypoint':wp,'npc_met':npc_ids}.get(kind)
    if reference is not None and value not in reference and not (kind=='boss' and value=='all-6') and not(kind=='waypoint' and value in ['any','any-outpost']): fail('引用不存在 '+kind+':'+value)
    if kind=='level' and (not value.isdigit() or int(value)<1): fail('无效等级 '+value)
    dep=value if kind in ['task','task_active','task_ready'] else 'feature:'+value if kind=='feature' else 'island:'+value if kind=='island' else 'hardmode' if kind=='hardmode' else None
    if dep: graph.setdefault(target,set()).add(dep)
    if target in rows and kind in ['task','task_active','task_ready'] and rows[target].get('chapter')!=rows[value].get('chapter'): fail('跨岛任务前置 '+target+' -> '+value)
  mandatory={'feature:'+f for f in features}|{'island:'+i for i in islands}|{'npc:'+c['unlock_npc'] for c in chapters['chapters'] if c.get('unlock_npc') and c['campaign']=='starsea'}|{'hardmode'}
  # NPC unlocks have already moved out of chapter rows; registered targets are still mandatory.
  mandatory|={t for t in grouped if t.startswith('npc:')}
  for target in mandatory:
    groups=grouped.get(target,{})
    if not any(all(c['kind'] not in ['task','task_active','task_ready','threads'] for c in group) for group in groups.values()): fail('缺少非任务兜底 '+target)
  active=set(); complete=set()
  def visit(n):
    if n in active: fail('条件图有环 '+n)
    if n in complete: return
    active.add(n)
    for d in graph.get(n,[]): visit(d)
    active.remove(n);complete.add(n)
  for n in graph: visit(n)
  # World phases refer to the same condition target owner as quests and dialogue.
  for table in ['camps','outposts','waypoints','objects','landmarks','gates','merchants','events','chests','rares','patrols','dungeonEntrances']:
    for row in world.get(table,[]):
      for key in ['when','until','openWhen','unlockWhen']:
        if row.get(key) and row[key] not in grouped: fail('世界相位条件不存在 '+table+':'+row['id']+':'+row[key])
      if table=='outposts' and row.get('waypoint') and row['waypoint'] not in wp: fail('前哨航标不存在 '+row['id'])
      if table=='merchants' and row['npc'] not in npc_ids: fail('商人人物不存在 '+row['id'])
  positions=files['npcs.json'].get('positions',[])
  for row in [*npcs,*positions]:
    for key in ['when','until']:
      if row.get(key) and row[key] not in grouped: fail('人物相位条件不存在 '+row['id']+':'+row[key])
    if row.get('join_guide_condition') and row['join_guide_condition'] not in grouped: fail('人物引导条件不存在 '+row['id'])
    if row.get('dialog_join_fallback') and not any(l['group']==row['dialog_join_fallback'] for l in files['dialogue.json']['lines']): fail('人物入驻对白不存在 '+row['id'])
  for row in positions:
    if row['npc'] not in npc_ids: fail('站位人物不存在 '+row['id'])
    if row['map'] not in islands|bosses|{n['home_map'] for n in npcs}|{i['region'] for i in world.get('islands',[])}: fail('站位地图不存在 '+row['id'])
    if row.get('landmark') and not any(l.get('key',l['id'])==row['landmark'] and l['region']==row['map'] for l in world.get('landmarks',[])): fail('站位地标不存在 '+row['id'])
  # Expand OR-of-AND targets into symbolic clauses. Level intervals and positive/
  # negative world facts prove that authored positions are mutually exclusive.
  # Reachability is deliberately conservative: future progress can combine facts.
  def clauses(target, negate=False):
    if not target: return [] if negate else [(1,float('inf'),frozenset(),frozenset())]
    groups=grouped[target]
    positive=[]
    for group in groups.values():
      lo=max([int(c['value']) for c in group if c['kind']=='level'] or [1])
      atoms=frozenset((c['kind'],c['value']) for c in group if c['kind']!='level')
      exclusions=frozenset((other,c['value']) for c in group if c['kind'] in ['task','task_active','task_ready'] for other in ['task','task_active','task_ready'] if other!=c['kind'])
      positive.append((lo,float('inf'),atoms,exclusions))
    if not negate: return positive
    result=[(1,float('inf'),frozenset(),frozenset())]
    for lo,hi,yes,no in positive:
      # `no` contains inferred mutual exclusions, not authored negative
      # predicates. Active/ready atoms already imply those exclusions; their
      # negation is sufficient and avoids redundant exponential alternatives.
      inverse=([(1,lo-1,frozenset(),frozenset())] if lo>1 else [])+[(1,float('inf'),frozenset(),frozenset([atom])) for atom in yes]
      result=combine(result,inverse)
    return result
  def combine(left,right):
    out=[]
    for a in left:
      for b in right:
        lo,hi=max(a[0],b[0]),min(a[1],b[1]);yes,no=a[2]|b[2],a[3]|b[3]
        if lo<=hi and not yes&no: out.append((lo,hi,yes,no))
    return out
  def position_clauses(row):
    visible=clauses(row.get('when'))
    return combine(visible,clauses(row['until'],True)) if row.get('until') else visible
  for i,row in enumerate(positions):
    for other in positions[i+1:]:
      if row['npc']==other['npc'] and combine(position_clauses(row),position_clauses(other)): fail('人物站位同时可见 '+row['id']+' / '+other['id'])
  pools={}
  for t in rows.values():
    if t.get('campaign')!='starsea': continue
    if t['type'] not in ['guide','side','bounty']: fail('新任务不得为main '+t['id'])
    if t['type']=='guide' and not t.get('series'): fail('引导缺少series '+t['id'])
    if t.get('accept_mode') in ['discover','arrive'] and not t.get('discover_landmark'): fail('缺少发现地标 '+t['id'])
    if t.get('pre'):
      p=rows[t['pre']]
      if t.get('series')!=p.get('series') or t.get('thread')!=p.get('thread') or p.get('thread')=='arrive': fail('线索之间存在pre '+t['id'])
    bounty=t['type']=='bounty'
    if bounty and (not t.get('pool') or not t.get('repeat_cooldown_seconds')): fail('悬赏缺池/冷却 '+t['id'])
    if not bounty and (t.get('pool') or t.get('repeat_cooldown_seconds')): fail('非悬赏有池/冷却 '+t['id'])
    if bounty:
      # 内容方案 §6.3：只计本分区服务端确认的击杀；经验由击杀经验 ×0.5 推导，不在表里配；不给装备。
      if not t.get('zone') or t.get('cond_kind')!='kills' or not t.get('cond_count'): fail('悬赏须有分区与击杀目标 '+t['id'])
      if t.get('reward_xp') is not None or t.get('chapter'): fail('悬赏经验由击杀推导且不属于章节 '+t['id'])
      if pools.setdefault(t['pool'],t['zone'])!=t['zone']: fail('悬赏池跨分区 '+t['pool'])
  for series in {t.get('series') for t in rows.values() if str(t.get('series','')).startswith('isle-')}:
    mine=[t for t in rows.values() if t.get('series')==series]; threads={t.get('thread') for t in mine}&{'A','B','C'}
    if series in legacy_layout:
      if any(t['id'] not in legacy for t in mine): fail('兼容布局不能用于新任务 '+series)
      continue # Existing 36-task layout; completed 51-task island content belongs to steps 4–5.
    if len(threads) not in [2,3]: fail('岛屿线索数不为2–3 '+series)
    keys={t['thread'] for t in mine if t.get('key_thread')}; converge=sorted([t for t in mine if t.get('thread')=='converge'],key=lambda t:t['order'])
    if len(keys)>1 or not converge: fail('关键线索或汇合非法 '+series)
    for group in grouped.get(converge[0]['id'],{}).values():
      deps={rows[c['value']].get('thread') for c in group if c['kind']=='task'}
      if not keys<=deps: fail('汇合缺关键线索 '+series)
      if threads<=deps and series!='isle-1': fail('汇合要求全部线索 '+series)
  for line in files.get('dialogue.json',{}).get('lines',[]):
    if line.get('when') and line['when'] not in ['a','b','route','route:a','route:b'] and line['when'] not in grouped: fail('对白条件不存在 '+line['when'])
  for task in tasks.get('tasks',[]):
    if task.get('zone') and task['zone'] not in zones: fail('任务分区不存在 '+task['id']+':'+task['zone'])
  for step in tasks.get('steps',[]):
    for field, refs in [('zone',zones),('gate',gates),('camp',{c['id'] for c in world.get('camps',[])})]:
      if step.get(field) and step[field] not in refs: fail('步骤引用不存在 '+field+':'+step[field])
  for rumor in tasks.get('rumors',[]):
    if rumor['island'] not in islands or rumor['zone'] not in zones: fail('传闻地点不存在 '+rumor['id'])
    if rumor['source']=='task' and rumor['source_id'] not in rows: fail('传闻来源不存在 '+rumor['id'])
    if rumor['source']=='npc' and rumor['source_id'] not in npc_ids: fail('传闻人物不存在 '+rumor['id'])
  for chapter in chapters['chapters']:
    if chapter['campaign']=='starsea' and (chapter.get('unlock_features') or chapter.get('unlock_npc')): fail('章节开放项尚未迁移 '+chapter['id'])
  for c in cs:
    if c['kind']!='npc_met' or c['target'] not in rows: continue
    level=[int(x['value']) for x in cs if x['target']=='npc:'+c['value'] and x['kind']=='level' and x['path']=='fallback']
    n=int(rows[c['target']]['chapter'][-2:]); opening=[1,6,13,19,25,30][n-1]
    if not level or min(level)>opening: fail('人物认识条件没有及时等级兜底 '+c['value'])
