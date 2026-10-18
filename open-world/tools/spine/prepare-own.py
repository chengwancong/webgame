"""只把本期基线→当前的增量合并到HEAD副本；先生成预览，不改工作树/索引。"""
from pathlib import Path
import subprocess,json,difflib,sys
world=Path(__file__).resolve().parents[2];repo=world.parent
verified=Path(next((a[9:] for a in sys.argv if a.startswith('--source=')),str(world))).resolve()
review=world/'docs/reviews/numeric-spine-20261013';out=review/'S9/own-preview';out.mkdir(parents=True,exist_ok=True)
def git(*args):return subprocess.run(['git',*args],cwd=repo,capture_output=True)
def text(b):return b.decode('utf-8-sig').replace('\r\n','\n')
files=['packages/content/aspect-description.ts','packages/rules/index.ts','packages/content/deep-progression.ts','packages/rules/affix-generator.ts','packages/content/inscriptions.ts','packages/content/set-effects.ts','apps/api/src/app.ts','packages/rules/aspect-sources.ts','tools/config-export.py','tools/numeric-source-audit.ts','tools/apply-monster-curve.ts','tools/apply-world-tier-curve.ts','tools/calibrate-hardmode-dungeons.ts','tools/recalibrate-legacy-dungeons.ts','tools/propose-world-numeric-refresh.ts','packages/contracts/index.ts']
markers=review/'S9/legacy-markers-summary.json'
if markers.exists():files.extend(r['file'] for r in json.loads(markers.read_text(encoding='utf-8'))['files'] if r['tracked'])
files.extend('tests/'+p.name.removesuffix('.snapshot') for p in (review/'S0/resume-own-base/tests').glob('*.test.ts.snapshot') if p.name.removesuffix('.snapshot') not in ['build-variety-effect-descriptions.test.ts','build-variety-frozen-attributes.test.ts','monster-model.test.ts','elite-affixes.test.ts'])
rows=[];excluded=[]
for f in files:
 base=review/'S0/resume-own-base'/f
 if not base.exists() and (Path(str(base)+'.snapshot')).exists():base=Path(str(base)+'.snapshot')
 if not base.exists():base=review/'S0/source-before'/f
 assert base.exists(),f
 head=git('show','HEAD:open-world/'+f)
 if head.returncode:
  excluded.append({'file':f,'reason':'原文件为其他会话未跟踪文件，本期局部修复留工作树，不代提交整文件'});continue
 before=text(base.read_bytes());after=text((verified/f).read_bytes());h=text(head.stdout)
 if before==after:continue
 dest=out/(f+'.snapshot' if f.endswith('.test.ts') else f);dest.parent.mkdir(parents=True,exist_ok=True)
 temp=out/'merge-temp';temp.mkdir(exist_ok=True)
 for name,body in [('head',h),('base',before),('own',after)]: (temp/name).write_text(body,encoding='utf-8')
 merged=subprocess.run(['git','merge-file','-p',str(temp/'head'),str(temp/'base'),str(temp/'own')],capture_output=True)
 result=text(merged.stdout);conflicts=merged.returncode
 if conflicts and f=='packages/contracts/index.ts':
  # 本期仅提升rules；起点已有客户端升版由原会话保留。
  assert "rules:'ow-70'" in h and "rules:'ow-71'" in after
  result=h.replace("rules:'ow-70'","rules:'ow-71'");conflicts=0
 elif conflicts and f=='packages/content/deep-progression.ts':
  # 本期仅新增覆盖器；外部字形改名不进入索引。
  new=[l for l in after.splitlines() if l.startswith('import {progressionNodeValues}') or l.startswith('for(const node of [...talentDefinitions')]
  assert len(new)==2
  result=new[0]+'\n'+h.replace('export const glyphDefinitions=',new[1]+'\nexport const glyphDefinitions=');conflicts=0
 elif conflicts and f=='tests/equipment-runtime.database.test.ts':
  assert 'z.value===1.3' in h
  result='// numeric-spine：同步已应用计划的精确值，保留原机制断言。\n'+h.replace('z.value===1.3','z.value===1.375');conflicts=0
 elif conflicts and f in ['packages/content/inscriptions.ts','packages/rules/affix-generator.ts']:
  name,raw=('inscriptionConfig','raw') if 'inscriptions.ts' in f else ('gearAffixConfig','source')
  schema='inscriptionContentSchema' if name=='inscriptionConfig' else 'gearAffixConfigSchema'
  result=h.replace('export const '+name+'=z.object','export const '+schema+'=z.object').replace('.strict().parse('+raw+');','.strict();\nexport const '+name+'='+schema+'.parse('+raw+');')
  if name=='gearAffixConfig':
   old=next(l for l in before.splitlines() if l.startswith('const tier='));new=next(l for l in after.splitlines() if l.startswith('const tier='));assert old in result;result=result.replace(old,new)
  conflicts=0
 dest.write_text(result,encoding='utf-8')
 rows.append({'file':'open-world/'+f,'base':str(base),'conflicts':conflicts,'preview':str(dest),'ownAdded':sum(1 for l in difflib.ndiff(before.splitlines(),after.splitlines()) if l.startswith('+ '))})
# 没有S0副本的窄改动经逐行审阅，只重放已确认本期片段。
for f in ['apps/api/src/stage-key-pools.ts','apps/api/src/field-loot.ts','tools/numeric-flow-sim.py','tools/standard-player-model.ts','tests/build-variety-effect-descriptions.test.ts','tests/build-variety-frozen-attributes.test.ts','tests/monster-model.test.ts','tests/elite-affixes.test.ts']:
 h=text(git('show','HEAD:open-world/'+f).stdout);current=text((verified/f).read_bytes());result=current
 if f=='tools/standard-player-model.ts':
  # 四树装配及导出函数是其他会话已有修改，不纳入本次提交。
  first=h.index(" if(on('talent')){");last=h.index('\n }',first)+3
  start=result.index(" if(on('talent')){");end=result.index('\n }',start)+3
  result=result[:start]+h[first:last]+result[end:]
  result=result.replace('export function metrics(','function metrics(').replace('export function rotation(','function rotation(')
 if f=='tests/build-variety-frozen-attributes.test.ts':result=result.replace("try{definition.category='spell'","try{definition.category='control'")
 dest=out/(f+'.snapshot' if f.endswith('.test.ts') else f);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(result,encoding='utf-8');rows.append({'file':'open-world/'+f,'base':'HEAD + 手工核验本期片段','conflicts':0,'preview':str(dest),'ownAdded':sum(1 for l in difflib.ndiff(h.splitlines(),result.splitlines()) if l.startswith('+ '))})
summary={'scope':'HEAD + 本期基线到当前差量；冲突不得暂存','files':rows,'excluded':excluded}
(review/'S9/own-preview-summary.json').write_text(json.dumps(summary,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps([{'file':r['file'],'conflicts':r['conflicts'],'ownAdded':r['ownAdded']} for r in rows],ensure_ascii=False))
