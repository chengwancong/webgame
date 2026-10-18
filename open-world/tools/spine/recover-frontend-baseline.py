"""只解析并发前端编辑日志里的字面量替换，逆放到自有验证副本；不执行日志代码。"""
from pathlib import Path
import ast,json,re,datetime,subprocess,shutil,sys
world=Path(__file__).resolve().parents[2];review=world/'docs/reviews/numeric-spine-20261013'
manifest=json.loads((review/'S8/verification-source-summary.json').read_text(encoding='utf-8'));source=Path(manifest['source']).resolve();assert source.is_relative_to((world/'.qa').resolve())
if len(sys.argv)!=2:raise SystemExit('用法：recover-frontend-baseline.py 本地编辑记录.jsonl；只在本轮恢复副本时使用')
log=Path(sys.argv[1])
ops=[];newFiles=set();unknown=[];SOURCE=object()
def rel(p):
 p=p.replace('\\','/');prefix='apps/web/src/'
 return prefix+p.split(prefix,1)[1] if prefix in p else prefix+p.removeprefix('./')
def parse_script(code,time):
 env={};active=None
 def add(path,old,new,count=1):
  if isinstance(path,str) and isinstance(old,str) and isinstance(new,str):ops.append({'file':rel(path),'old':old,'new':new,'count':count,'time':time})
  else:unknown.append({'time':time,'reason':'非字面量替换'})
 def value(n):
  nonlocal active
  if isinstance(n,ast.Constant):return n.value
  if isinstance(n,ast.Name):return env.get(n.id)
  if isinstance(n,ast.BinOp) and isinstance(n.op,ast.Add):
   a,b=value(n.left),value(n.right)
   if isinstance(a,str) and isinstance(b,str):return a+b
   return SOURCE if a is SOURCE or b is SOURCE else None
  if isinstance(n,ast.Subscript) and value(n.value) is SOURCE:return SOURCE
  if isinstance(n,ast.Call):
   if isinstance(n.func,ast.Attribute) and n.func.attr=='read' and isinstance(n.func.value,ast.Call):
    call=n.func.value
    if isinstance(call.func,ast.Name) and call.func.id=='open':active=value(call.args[0]);return SOURCE
   if isinstance(n.func,ast.Attribute) and n.func.attr=='replace':
    base=value(n.func.value);args=[value(a) for a in n.args]
    if base is SOURCE:
     add(active,args[0],args[1],args[2] if len(args)>2 else -1);return SOURCE
    if isinstance(base,str) and all(isinstance(a,(str,int)) for a in args):return base.replace(*args)
  return None
 def leaves(n):return leaves(n.left)+leaves(n.right) if isinstance(n,ast.BinOp) and isinstance(n.op,ast.Add) else [n]
 for n in ast.parse(code).body:
  if isinstance(n,ast.Assign):
   if any(isinstance(t,ast.Name) and t.id=='s' for t in n.targets) and isinstance(n.value,ast.BinOp):
    literals=[value(a) for a in leaves(n.value) if not(isinstance(a,ast.Name) and a.id=='s') and not isinstance(a,ast.Subscript)]
    insert=''.join(a for a in literals if isinstance(a,str))
    if insert:add(active,'',insert)
   v=value(n.value)
   for t in n.targets:
    if isinstance(t,ast.Name):env[t.id]=v
  elif isinstance(n,ast.Expr) and isinstance(n.value,ast.Call) and isinstance(n.value.func,ast.Name):
   call=n.value;args=[value(a) for a in call.args]
   if call.func.id=='rep':add(active,*args[:2])
   elif call.func.id=='edit':add(*args[:3],args[3] if len(args)>3 else 1)
for line in log.open(encoding='utf-8'):
 x=json.loads(line);content=x.get('message',{}).get('content',[])
 if not isinstance(content,list):continue
 for item in content:
  if not isinstance(item,dict) or item.get('type')!='tool_use':continue
  v=item.get('input',{});time=x.get('timestamp','')
  if item.get('name')=='Write' and 'apps\\web\\src' in v.get('file_path',''):
   name=rel(v['file_path']);tracked=subprocess.run(['git','cat-file','-e','HEAD:open-world/'+name],cwd=world.parent,capture_output=True).returncode==0
   if tracked:raise RuntimeError('现有文件被整体重写，需要修改前快照：'+name)
   newFiles.add(name)
  if item.get('name')!='Bash':continue
  command=v.get('command','')
  for block in re.findall(r"python - <<'EOF'\n(.*?)\nEOF",command,re.S):
   try:parse_script(block,time)
   except (SyntaxError,IndexError,TypeError) as e:unknown.append({'time':time,'reason':str(e)})
  for line in command.splitlines():
   m=re.search(r'sed -i "\d+a (.*?)" ([\w./-]+)',line)
   if m:ops.append({'file':rel(m[2]),'old':'','new':m[1]+'\n','count':1,'time':time})
applied=[];unresolved=[];cache={};times={}
for op in reversed(ops):
 p=(source/op['file']).resolve();assert p.is_relative_to(source)
 if not p.exists() or op['file'] in newFiles:continue
 if p not in cache:cache[p]=p.read_text(encoding='utf-8-sig');times[p]=p.stat().st_mtime
 if op['time'] and datetime.datetime.fromisoformat(op['time'].replace('Z','+00:00')).timestamp()>times[p]+2:continue
 s=cache[p];new,old=op['new'],op['old']
 if not new or new not in s:continue
 count=s.count(new)
 if op['count']==1 and count!=1:unresolved.append({'file':op['file'],'newPrefix':new[:90],'matches':count});continue
 cache[p]=s.replace(new,old,op['count']);applied.append({'file':op['file'],'newPrefix':new[:70]})
for p,s in cache.items():p.write_text(s,encoding='utf-8',newline='\n')
for r in newFiles:
 p=(source/r).resolve();assert p.is_relative_to(source)
 if p.exists():p.unlink()
# 两个原始背包模块在本期最初状态中未修改；直接采用HEAD更可靠。
for r in ['apps/web/src/bag-model.ts','apps/web/src/bag-controller.ts']:
 (source/r).write_bytes(subprocess.check_output(['git','show','HEAD:open-world/'+r],cwd=world.parent))
# 仅补齐先前拷贝筛选误漏的非数值包。
for p in (world/'packages').iterdir():
 if p.is_dir() and p.name not in ['content','rules','contracts','simulation']:
  shutil.copytree(p,source/'packages'/p.name,dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules','.git','dist'))
# API中后来增加的制作消耗品接线只在此副本撤除。
r='apps/api/src/field-loot.ts';shutil.copy2(world/'.qa/spine-recovery/own-pre-crafting'/r,source/r)
p=source/'apps/api/src/field-activities.ts';s=p.read_text(encoding='utf-8-sig');s=s.replace("import {consumeCraftKills} from '../../../packages/rules/crafting-consumables.ts';\n",'').replace("consumeCraftKills(s,(data!.battle?.data.enemies??[]).filter((enemy:any)=>enemy.reward&&!enemy.alive).length);",'').replace(",{kind:data!.kind,first:!s.starsea?.fieldFacts?.kill_rare.includes(data!.target),worldTier:data!.worldTier}",'');p.write_text(s,encoding='utf-8',newline='\n')
for r,a,b in [('apps/web/src/ui-entry.css',"@import url('./crafting-panel.css') layer(legacy);\n",''),('apps/web/src/battle-result-panel.ts','import {art,hasArt}','import {art}')]:
 p=source/r;p.write_text(p.read_text(encoding='utf-8').replace(a,b),encoding='utf-8',newline='\n')
fixture='docs/reviews/pacing-tool-20261010/P0/bd-measurements.json';(source/fixture).parent.mkdir(parents=True,exist_ok=True);shutil.copy2(world/fixture,source/fixture)
for p in (source/'apps/api/src').glob('crafting*.ts'):p.unlink()
# 解析器的本期hunk与S0原有改动合并，排除后来的食物属性接线。
r='packages/rules/index.ts';temp=source.parent/'merge';temp.mkdir(exist_ok=True)
for name,body in [('baseline',(review/'S0/source-before'/r).read_text(encoding='utf-8-sig')),('head',subprocess.check_output(['git','show','HEAD:open-world/'+r],cwd=world.parent).decode('utf-8-sig')),('own',(world/'.qa/spine-recovery/own-pre-crafting'/r).read_text(encoding='utf-8-sig'))]:(temp/name).write_text(body,encoding='utf-8',newline='\n')
merged=subprocess.run(['git','merge-file','-p',str(temp/'baseline'),str(temp/'head'),str(temp/'own')],capture_output=True);assert merged.returncode==0; (source/r).write_bytes(merged.stdout)
result={'files':[{ 'file':f,'reversedEdits':sum(r['file']==f for r in applied)} for f in sorted({r['file'] for r in applied})],'newFilesExcluded':sorted(newFiles),'unresolved':unresolved,'parseNotes':unknown,'sharedProductionFilesTouched':False,'source':str(source)}
(review/'S8/frontend-baseline-recovery-summary.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8');print(json.dumps({'applied':len(applied),'unresolved':unresolved,'parseNotes':unknown},ensure_ascii=False))
