"""按对象身份重放本期JSON差量到HEAD；绝不夹带基线已有字段。"""
from pathlib import Path
import subprocess,json,copy,sys
world=Path(__file__).resolve().parents[2];repo=world.parent;review=world/'docs/reviews/numeric-spine-20261013';out=review/'S9/own-preview'
verified=Path(next((a[9:] for a in sys.argv if a.startswith('--source=')),str(world))).resolve()
files=['packages/content/aspects.json','packages/content/set-effects.json','packages/content/gear-affixes.json','packages/content/monsters.json','packages/content/dungeons.json','packages/content/world-tiers.json','packages/content/progression-curve.json','apps/api/src/stage-key-pools.json','config/json/pacing-mechanism-knobs.json']
missing=object();conflicts=[];edits=[]
def identity(v):
 if not isinstance(v,dict):return None
 if 'id' in v:return ('id',v['id'])
 if 'stat' in v:return ('stat',v.get('slot'),v['stat'],v.get('tier'))
 if 'level' in v:return ('level',v['level'])
 return None
def replay(head,base,current,path):
 if base==current:return head
 if base is missing:
  if head is not missing and head!=current:conflicts.append({'path':path,'reason':'new key collision'});return head
  edits.append(path);return copy.deepcopy(current)
 if head is missing:conflicts.append({'path':path,'reason':'external baseline entry absent from HEAD'});return head
 if isinstance(base,dict) and isinstance(current,dict) and isinstance(head,dict):
  result=copy.deepcopy(head)
  for k in set(base)|set(current):
   if k not in current:
    if k in head and head[k]==base[k]:del result[k];edits.append(path+[k])
    elif k in head:conflicts.append({'path':path+[k],'reason':'delete conflict'})
   else:
    value=replay(head.get(k,missing),base.get(k,missing),current[k],path+[k])
    if value is not missing:result[k]=value
  return result
 if isinstance(base,list) and isinstance(current,list) and isinstance(head,list):
  keys=[identity(v) for v in base];newkeys=[identity(v) for v in current];hkeys=[identity(v) for v in head]
  if keys and all(k is not None for k in keys+newkeys+hkeys) and len(set(keys))==len(keys) and len(set(newkeys))==len(newkeys) and len(set(hkeys))==len(hkeys):
   result=copy.deepcopy(head)
   for key in keys:
    if key not in newkeys:
     if key in hkeys:result=[v for v in result if identity(v)!=key];edits.append(path+[str(key)])
     continue
    if key not in hkeys:
     if base[keys.index(key)]!=current[newkeys.index(key)]:conflicts.append({'path':path+[str(key)],'reason':'external row absent from HEAD'})
     continue
    i=next(i for i,v in enumerate(result) if identity(v)==key);result[i]=replay(head[hkeys.index(key)],base[keys.index(key)],current[newkeys.index(key)],path+[str(key)])
   for key in newkeys:
    if key not in keys:
     assert key not in hkeys,(path,key)
     result.append(copy.deepcopy(current[newkeys.index(key)]));edits.append(path+[str(key)])
   return result
  if len(base)==len(current)==len(head):return [replay(h,b,c,path+[i]) for i,(h,b,c) in enumerate(zip(head,base,current))]
 if head!=base and head!=current:conflicts.append({'path':path,'reason':'overlapping existing external value','head':head,'baseline':base,'current':current});return head
 edits.append(path);return copy.deepcopy(current)
rows=[]
for f in files:
 base=review/'S0/source-before'/f
 assert base.exists(),f
 proc=subprocess.run(['git','show','HEAD:open-world/'+f],cwd=repo,capture_output=True);assert proc.returncode==0,f
 h=json.loads(proc.stdout);b=json.loads(base.read_text(encoding='utf-8-sig'));c=json.loads((verified/f).read_text(encoding='utf-8-sig'))
 n=len(conflicts);e=len(edits);result=replay(h,b,c,[f]);dest=out/f;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 rows.append({'file':'open-world/'+f,'conflicts':len(conflicts)-n,'ownPaths':len(edits)-e,'preview':str(dest)})
summary={'files':rows,'conflicts':conflicts,'edits':edits}
(review/'S9/json-own-preview-summary.json').write_text(json.dumps(summary,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print(json.dumps({'files':rows,'conflicts':conflicts},ensure_ascii=False))
