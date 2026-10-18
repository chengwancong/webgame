"""显式自有文件与HEAD差量预览暂存；不将共享工作树整文件加入索引。"""
from pathlib import Path
import subprocess,json,runpy,hashlib,sys
world=Path(__file__).resolve().parents[2];repo=world.parent;review=world/'docs/reviews/numeric-spine-20261013'
verified=Path(next((a[9:] for a in sys.argv if a.startswith('--source=')),str(world))).resolve()
def git(*args,input=None):return subprocess.check_output(['git',*args],cwd=repo,input=input)
cached=git('diff','--cached','--name-only','-z').decode().rstrip('\0').split('\0')
cached=[p for p in cached if p]
if cached:
 assert '--refresh' in sys.argv,'已有暂存内容，保留并停止'
 old=json.loads(git('show',':open-world/docs/reviews/numeric-spine-20261013/S9/staged-files.json'))
 expected={r['file']:r['sha256'] for r in old['files']}
 own_manifest='open-world/docs/reviews/numeric-spine-20261013/S9/staged-files.json'
 assert set(cached)<=set(expected)|{own_manifest},'索引含其他会话文件，停止'
 batch=git('cat-file','--batch',input=(''.join(':'+p+'\n' for p in cached)).encode())
 offset=0
 for p in cached:
  end=batch.index(b'\n',offset);size=int(batch[offset:end].split()[2]);body=batch[end+1:end+1+size];offset=end+size+2
  if p!=own_manifest:assert hashlib.sha256(body).hexdigest()==expected[p],('索引并发变化',p)
initial_tree=git('write-tree').decode().strip()
start_head=git('rev-parse','HEAD').decode().strip()
policy=runpy.run_path(str(world/'tools/spine/review-policy.py'));entries={}
def own(path):
 assert path.is_file() and not path.is_symlink(),path
 actual=path
 if path.is_relative_to(world) and not path.is_relative_to(review):
  candidate=verified/path.relative_to(world)
  if candidate.is_file():actual=candidate
 entries[path.relative_to(repo).as_posix()]={'bytes':actual.read_bytes(),'scope':'本期自有文件；使用已验证副本'}
for p in (world/'tools/spine').iterdir():
 if p.name=='crafting-flow.ts':continue # 并发制作会话拥有；命名空间不代表所有权。
 if p.suffix in ['.ts','.py','.mjs','.json','.md','.ps1'] and p.is_file():
  if not (verified/p.relative_to(world)).is_file():continue
  own(p)
for name in ['spine-anchor','spine-player','spine-flow','stat-weights','build-knobs','spine-source-lock','spine-measurement-stability','spine-world-source','spine-final-validation']:
 rel='tools/spine/data/'+name+'.json';p=verified/rel
 if p.exists():entries['open-world/'+rel]={'bytes':p.read_bytes(),'scope':'本期已验证模型结论；原始构筑不入库'}
for p in (world/'tests').glob('numeric-spine-*.test.ts'):own(p)
for p in (world/'tests/fixtures/numeric-spine').glob('*.json'):own(p)
for f in ['packages/content/skill-coefficients.json','packages/content/progression-node-values.json','packages/content/spine-controls.ts','packages/content/spine-rate-limits.json','config/json/spine-targets.json','config/excel/节奏目标.xlsx']:own(world/f)
for filename in ['own-preview-summary.json','json-own-preview-summary.json']:
 manifest=json.loads((review/'S9'/filename).read_text(encoding='utf-8'))
 assert not manifest.get('conflicts'),filename
 for row in manifest['files']:
  assert not row['conflicts'],row
  p=Path(row['preview']);b=p.read_bytes();assert b'<<<<<<<' not in b,row
  entries[row['file']]={'bytes':b,'scope':'HEAD上重放本期差量，工作树外部改动保留'}
# package和AGENTS只添加本期入口，不带入现有其他修改。
h=json.loads(git('show','HEAD:open-world/package.json'));c=json.loads((verified/'package.json').read_text(encoding='utf-8'))
for k,v in c['scripts'].items():
 if k in ['spine:targets','spine:bench','spine:audit','spine:normalize','spine:solve-builds','spine:monsters','spine:progression','spine:validate','spine:check']:h['scripts'][k]=v
entries['open-world/package.json']={'bytes':(json.dumps(h,ensure_ascii=False,indent=2)+'\n').encode(),'scope':'仅spine命令'}
line='- 数值改动必须经主干工具，入口 `pnpm spine:check`；目标、测量、推导和统一 apply 的证据见 `open-world/tools/spine/`。'
h=git('show','HEAD:AGENTS.md').decode('utf-8').rstrip()
entries['AGENTS.md']={'bytes':(h+'\n\n'+line+'\n').encode(),'scope':'仅主干规范行'}
for p in review.rglob('*'):
 if p.is_file() and p.suffix in ['.md','.json','.log'] and p.name!='staged-files.json' and not policy['raw'](p.relative_to(repo).as_posix()):
  b=p.read_bytes()
  if len(b)<=200*1024 and len(b.splitlines())<=2000:own(p)
for required in ['report.md','numeric-todo.md','numeric-todo-summary.json','commit.json','cleanup.json']:
 assert (review/'S9'/required).relative_to(repo).as_posix() in entries,('必要交付物缺失或超过留档限制',required)
for name,row in entries.items():
 if Path(name).suffix in ['.ts','.py','.mjs','.json','.md','.log','.ps1']:row['bytes']=row['bytes'].replace(b'\r\n',b'\n')
manifest={'scope':'本期专属文件与共享文件差量；正式测试针对S0已有工作树加本期修改的隔离副本，提交只重放本期差量。','parent':start_head,'verificationSource':str(verified),'textEncoding':'暂存文本规范为LF；共享工作树保持原样','files':[{'file':f,'sha256':hashlib.sha256(v['bytes']).hexdigest(),'scope':v['scope']} for f,v in sorted(entries.items())]}
p=review/'S9/staged-files.json';p.write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8',newline='\n');own(p)
if '--apply' in sys.argv:
 assert git('rev-parse','HEAD').decode().strip()==start_head,'HEAD并发变化，重新生成预览'
 assert git('write-tree').decode().strip()==initial_tree,'索引并发变化，停止'
 for name,row in sorted(entries.items()):
  oid=git('hash-object','-w','--stdin',input=row['bytes']).decode().strip();mode='100644'
  prior=git('ls-files','-s','--',name).decode()
  if prior:mode=prior.split()[0]
  git('update-index','--add','--cacheinfo',mode+','+oid+','+name)
 assert git('rev-parse','HEAD').decode().strip()==start_head,'暂存时HEAD并发变化，停止并核验索引'
 changed=git('diff','--cached','--name-only','-z').decode().rstrip('\0').split('\0')
 assert set(changed)<=set(entries),'索引出现其他会话文件，禁止提交'
 for name in changed:assert git('show',':'+name)==entries[name]['bytes'],('索引内容并发变化',name)
 print(json.dumps(policy['check'](),ensure_ascii=False))
else:print(json.dumps({'previewFiles':len(entries),'manifest':str(p)},ensure_ascii=False))
