"""Task-local baselines and minimal batch commits; preserves the caller's index."""
from pathlib import Path
import sys, subprocess, json, hashlib, shutil, difflib, os
ROOT=Path(__file__).resolve().parents[1]; REPO=ROOT.parent
STATE=ROOT/'.runtime/physical-vfx-workflow'; STATE.mkdir(parents=True,exist_ok=True)
def git(*args,env=None,check=True):
 return subprocess.run(['git',*args],cwd=REPO,env=env,check=check,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def minimal_rebase(before,after,head):
 """Replay task edits onto HEAD without importing the baseline's unrelated edits."""
 b=before.splitlines(True);a=after.splitlines(True);h=head.splitlines(True)
 for op,i,j,x,y in reversed(list(difflib.SequenceMatcher(None,b,a,autojunk=False).get_opcodes())):
  if op=='equal':continue
  old=''.join(b[i:j]);new=''.join(a[x:y]);whole=''.join(h)
  if old and whole.count(old)==1:h=whole.replace(old,new,1).splitlines(True);continue
  # The shared baseline may contain an uncommitted helper that this batch now
  # requires. Include only that method, anchored to its committed neighbour.
  if j-i==1 and y-x==1 and old.lstrip().startswith('releaseFrame(') and not any(line.lstrip().startswith('releaseFrame(') for line in h):
   anchors=[n for n,line in enumerate(h) if line.lstrip().startswith('actionDuration(')]
   if len(anchors)==1:h[anchors[0]+1:anchors[0]+1]=a[x:y];continue
  if i==j:
   anchor=None
   for k in range(i-1,max(-1,i-40),-1):
    if b[k].strip() and h.count(b[k])==1:anchor=h.index(b[k])+1;break
   if anchor is None:raise RuntimeError('No unique insertion anchor')
   h[anchor:anchor]=a[x:y];continue
  if j-i>1 and j-i==y-x:
   for oldline,newline in zip(b[i:j],a[x:y]):whole=minimal_rebase(oldline,newline,whole)
   h=whole.splitlines(True);continue
  if j-i==1 and y-x==1:
   candidates=[n for n,line in enumerate(h) if line.lstrip().startswith(b[i].lstrip()[:32])]
   if len(candidates)!=1:raise RuntimeError('No unique line anchor: '+old[:70])
   n=candidates[0];line=h[n]
   if 'distance=actor?.boss?' in b[i] and 'spec=physicalSpec' in a[x]:
    h[n]=a[x];continue # D7: the task explicitly owns replacement of this distance expression.
   for cop,bi,bj,ai,aj in reversed(list(difflib.SequenceMatcher(None,b[i],a[x],autojunk=False).get_opcodes())):
    if cop=='equal':continue
    part=b[i][bi:bj];replacement=a[x][ai:aj]
    if part and line.count(part)==1:line=line.replace(part,replacement,1);continue
    left=b[i][max(0,bi-24):bi];right=b[i][bj:bj+24]
    if left and line.count(left)==1:at=line.index(left)+len(left)
    elif right and line.count(right)==1:at=line.index(right)
    else:raise RuntimeError('No unique character anchor')
    line=line[:at]+replacement+line[at+len(part):]
   h[n]=line;continue
  raise RuntimeError('Manual rebase needed for '+old[:70])
 return ''.join(h)
def guard():
 paths=[ROOT/'tests/vfx-v2.test.ts']
 for d in ['packages/simulation','packages/contracts','packages/content','packages/rules','apps/api']:
  paths.extend(p for p in (ROOT/d).rglob('*') if p.is_file())
 return {str(p.relative_to(REPO)).replace('\\','/'):sha(p) for p in paths}
mode=sys.argv[1]
if mode=='init':
 (STATE/'guard.json').write_text(json.dumps(guard(),indent=2),encoding='utf8')
 (STATE/'status-before.txt').write_bytes(git('status','--porcelain').stdout)
 print('Baseline saved; no production service access.')
elif mode=='begin':
 batch=sys.argv[2]; dest=STATE/batch;dest.mkdir(exist_ok=True)
 for name in sys.argv[3:]:
  p=ROOT/name;q=dest/name
  if p.is_file():q.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,q)
 print('Snapshot',batch)
elif mode=='commit':
 batch=sys.argv[2]; paths=sys.argv[3:]; temp=STATE/(batch+'.index');env={**os.environ,'GIT_INDEX_FILE':str(temp)}
 git('read-tree','HEAD',env=env); own=[]
 for name in paths:
  p=ROOT/name;old=STATE/batch/name;rel=str(p.resolve().relative_to(REPO)).replace('\\','/')
  tracked=git('cat-file','-e','HEAD:'+rel,check=False).returncode==0
  if not tracked and git('check-ignore','-q',rel,check=False).returncode==0:
   print('Generated/ignored output retained on disk:',rel);continue
  if name=='docs/physical-skill-vfx-progress.md' or not old.exists() or not tracked:
   git('add','--',rel,env=env);own.append(rel);continue
  before=old.read_text(encoding='utf-8-sig');after=p.read_text(encoding='utf-8-sig')
  if before==after:continue
  patch=''.join(difflib.unified_diff(before.splitlines(True),after.splitlines(True),fromfile='a/'+rel,tofile='b/'+rel,n=3))
  patchfile=STATE/(batch+'-'+p.name+'.patch');patchfile.write_text(patch,encoding='utf8',newline='\n')
  applied=git('apply','--cached','--whitespace=nowarn',str(patchfile),env=env,check=False)
  if applied.returncode:
   head=git('show',':'+rel,env=env).stdout.decode('utf8')
   merged=minimal_rebase(before,after,head)
   blob=subprocess.run(['git','hash-object','-w','--stdin'],cwd=REPO,input=merged.encode(),stdout=subprocess.PIPE,check=True).stdout.decode().strip()
   git('update-index','--cacheinfo','100644,'+blob+','+rel,env=env);print('D7 minimal rebase:',rel)
  own.append(rel)
 diff=git('diff','--cached','--binary',env=env).stdout
 if not diff:raise RuntimeError('Empty batch')
 git('commit','-m','feat(physical-vfx): '+batch,env=env)
 # Advance only the task patch in the normal index, leaving unrelated staging intact.
 patchfile=STATE/(batch+'-index.patch');patchfile.write_bytes(diff)
 normal=git('apply','--cached','--whitespace=nowarn',str(patchfile),check=False)
 if normal.returncode:print('Normal index needs review:',normal.stderr.decode(errors='replace'))
 commit=git('rev-parse','HEAD').stdout.decode().strip()
 (STATE/(batch+'-commit.json')).write_text(json.dumps({'commit':commit,'files':own},indent=2),encoding='utf8');print(commit)
elif mode=='guard':
 before=json.loads((STATE/'guard.json').read_text());after=guard();changed=[p for p in before if after.get(p)!=before[p]]
 print(json.dumps({'unchanged':not changed,'changed':changed,'trajectorySha256':after.get('open-world/tests/vfx-v2.test.ts')},indent=2))
