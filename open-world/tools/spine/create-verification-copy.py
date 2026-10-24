"""冻结S0既有工作区＋本期数值改动；保留共享目录里并发制作迁移，不在原处回退。"""
from pathlib import Path
import os,shutil,tempfile,subprocess,json,re,hashlib,sys
world=Path(__file__).resolve().parents[2];repo=world.parent;review=world/'docs/reviews/numeric-spine-20261013';recovery=world/'.qa/spine-recovery'
resume=next((a[9:] for a in sys.argv if a.startswith('--resume=')),None)
work=Path(resume).resolve() if resume else Path(tempfile.mkdtemp(prefix='numeric-spine-verify-',dir=world/'.qa')).resolve();source=work/'source';source.mkdir(exist_ok=True)
assert work.is_relative_to((world/'.qa').resolve()) and work.name.startswith('numeric-spine-verify-')
(work/'owner.json').write_text(json.dumps({'owner':'numeric-spine-20261013','source':str(source),'root':str(world)}),encoding='utf-8')
baseline=json.loads((review/'S0/workspace-baseline.json').read_text(encoding='utf-8'));lock=json.loads((world/'tools/spine/data/spine-source-lock.json').read_text(encoding='utf-8'))
known={r['file'] for r in baseline['files']}|set(lock['hashes'])
original_log=(review/'S8/final-tests/tests.log').read_text(encoding='utf-8');tests=set(re.findall(r'^[ ✓❯]+(tests/[^\r\n]+?\.test\.ts) \(',original_log,re.M));assert len(tests)==245,len(tests)
tests|={p.relative_to(world).as_posix() for p in (world/'tests').glob('numeric-spine-*.test.ts')}
skip_dirs={'node_modules','.git','.qa','dist','.vite','.vite-copy','__pycache__'};raw_dirs={'arms','source-before','resume-own-base','own-preview','golden-raw','natural','world-reviews','screenshots'}
copied=0
for folder in ([] if resume else ['apps','packages','assets','config','tools','tests','docs']):
 for root,dirs,files in os.walk(world/folder):
  rel=Path(root).relative_to(world);dirs[:]=[d for d in dirs if d not in skip_dirs and not(folder=='docs' and d in raw_dirs)]
  for name in files:
   p=Path(root)/name;r=p.relative_to(world).as_posix()
   if folder=='packages' and r.split('/')[1] in ['content','rules','contracts','simulation'] and r not in known and p.suffix in ['.ts','.json']:continue
   if folder=='config' and r not in known:continue
   if r.startswith('apps/api/src/crafting'):continue
   if folder=='tests' and name.startswith('crafting') and r not in tests:continue
   if folder=='tests' and name.endswith(('.test.ts','.spec.ts')) and r not in tests:continue
   if folder=='docs':
    if p.suffix not in ['.md','.json','.log']:continue
    if name.startswith(('bd-measurements','natural-calendar')) and r not in ['docs/reviews/open-world-m2-m4/W10/natural-calendar-attempt-all-tasks.json','docs/reviews/pacing-tool-20261010/P0/bd-measurements.json']:continue
    if name=='marginals.json':continue
   dest=source/r;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);copied+=1
for name in ['package.json','pnpm-lock.yaml','tsconfig.json']:
 shutil.copy2(world/name,source/name)
overrides=[]
def put(r,body,basis):
 p=source/r;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(body);overrides.append({'file':r,'basis':basis,'sha256':hashlib.sha256(body).hexdigest()})
def read(p):return p.read_text(encoding='utf-8-sig').replace('\r\n','\n')
def git_file(r):return subprocess.check_output(['git','show','HEAD:open-world/'+r],cwd=repo)
owned={'packages/content/aspects.json','packages/content/set-effects.json','packages/content/gear-affixes.json','packages/content/monsters.json','packages/content/dungeons.json','packages/content/world-tiers.json','packages/content/progression-curve.json','packages/content/aspect-description.ts','packages/content/deep-progression.ts','packages/content/set-effects.ts','packages/content/inscriptions.ts','packages/rules/index.ts','packages/rules/affix-generator.ts','packages/rules/aspect-sources.ts','packages/contracts/index.ts'}
for entry in baseline['files']:
 r=entry['file']
 if r.startswith('packages/') and r not in owned and 'appearance' not in Path(r).name:put(r,(review/'S0/source-before'/r).read_bytes(),'S0稳定源码；本期没有修改此文件')
# 后来的制作字段只在验证副本中回到S0；数值JSON、技能系数及本期规则修复保留。
for r in ['packages/contracts/deep-progression.ts','packages/contracts/open-world.ts','packages/rules/deep-progression.ts','packages/content/deep-progression.json','config/json/world.json','config/excel/世界.xlsx']:
 put(r,(review/'S0/source-before'/r).read_bytes(),'S0既有基线；排除并发制作迁移')
r='packages/content/deep-progression.ts';s=read(review/'S0/source-before'/r);current=read(world/r)
addition=[l for l in current.splitlines() if l.startswith('import {progressionNodeValues}') or l.startswith('for(const node of [...talentDefinitions')];assert len(addition)==2
s=addition[0]+'\n'+s.replace('export const glyphDefinitions=',addition[1]+'\nexport const glyphDefinitions=');put(r,s.encode(),'S0四树与命名基线＋本期节点覆盖器')
r='packages/contracts/index.ts';s=read(review/'S0/source-before'/r);assert "rules:'ow-70'" in s;s=s.replace("rules:'ow-70'","rules:'ow-71'");put(r,s.encode(),'本期ow-71/protocol35/db16；并发ow-72不回退共享文件')
# 以改动前预览里的纯本期差量，三方合并回S0的已有未提交基线。
for r in ['apps/api/src/app.ts','tools/config-export.py']:
 b=review/'S0/resume-own-base'/r
 if not b.exists():b=review/'S0/source-before'/r
 temp=work/'merge';temp.mkdir(exist_ok=True)
 (temp/'baseline').write_text(read(b),encoding='utf-8',newline='\n');(temp/'head').write_text(git_file(r).decode('utf-8-sig').replace('\r\n','\n'),encoding='utf-8',newline='\n');(temp/'own').write_text(read(recovery/'own-pre-crafting'/r),encoding='utf-8',newline='\n')
 merged=subprocess.run(['git','merge-file','-p',str(temp/'baseline'),str(temp/'head'),str(temp/'own')],capture_output=True)
 assert merged.returncode==0,(r,merged.stdout.decode('utf-8',errors='replace')[:400]);put(r,merged.stdout,'S0已有变更＋本期独占hunk')
for r in ['apps/api/src/database.ts','tools/pacing/completion.ts']:
 put(r,git_file(r),'本期开始时未修改的HEAD版本；排除并发制作db17/完成度字段')
for r in ['tests/equipment-runtime.test.ts','tests/deep-progression-rules.test.ts']:
 put(r,(recovery/'baseline'/(r+'.snapshot')).read_bytes(),'修改前只读证据恢复；原8/24项测试完整保留')
r='tests/equipment-runtime.database.test.ts';s=read(review/'S0/resume-own-base'/(r+'.snapshot')).replace('z.value===1.3','z.value===1.375');put(r,s.encode(),'制作迁移前7项测试＋本期S3套装精确数值期望')
# 本机依赖只作读取；业务包使用相对导入，不穿过此链接读取共享业务源码。
if not (source/'node_modules').exists():subprocess.check_call(['cmd','/c','mklink','/J',str(source/'node_modules'),str(world/'node_modules')],stdout=subprocess.DEVNULL)
if (world/'.design').exists() and not (source/'.design').exists():subprocess.check_call(['cmd','/c','mklink','/J',str(source/'.design'),str(world/'.design')],stdout=subprocess.DEVNULL)
for name in ['AGENTS.md','README.md','项目.md']:
 if (repo/name).exists():shutil.copy2(repo/name,work/name)
result={'owner':'numeric-spine-20261013','work':str(work),'source':str(source),'copiedFiles':copied,'baselineTestFiles':245,'testFiles':len(tests),'tests':sorted(tests),'overrides':overrides,'sharedWorkspaceReverted':False,'rules':'ow-71','protocol':35,'db':16,'scope':'S0已存在的未提交基线＋本期数值hunk；并发制作迁移单独保留在共享工作树。'}
(review/'S8/verification-source-summary.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8');print(json.dumps({'source':str(source),'files':copied,'tests':len(tests),'overrides':len(overrides)},ensure_ascii=False))
