"""本期一次性差量暂存器；只应用C0工作树→本期终态的差量，保留其他工作树改动。"""
from pathlib import Path
import subprocess,difflib,json,sys,hashlib
repo=Path(__file__).resolve().parents[5];world=repo/'open-world';review=world/'docs/reviews/pacing-identity-20261013';snap=review/'C0/source-before'
assert (repo/'.git').exists(),repo
def git(*args,input=None):return subprocess.check_output(['git',*args],cwd=repo,input=input)
assert not git('diff','--cached','--name-only').strip(),'索引已有其他会话暂存内容，须保留并隔离处理'
files=['package.json','packages/contracts/effects.ts','packages/content/aspect-description.ts','packages/content/aspects.json','packages/content/progression-curve.json','tools/runtime.mjs',
 'tools/pacing/derive-model.ts','tools/pacing/derive.ts','tools/pacing/measure.ts','tools/pacing/validate.ts','tools/pacing/mechanisms.ts','tools/pacing/calibrate-model.ts','tools/pacing/run-calendar.mjs','tools/pacing/run-tests.mjs','tools/pacing/build-isolated.mjs',
 'tests/aspect-description-consistency.test.ts','tests/pacing-mechanisms.test.ts','tests/pacing-derive.test.ts','tests/pacing-calibrate.test.ts','tests/pacing-refine.test.ts',
 'tools/pacing/anchor.ts','tools/pacing/identity-audit.ts','tools/pacing/marginals.ts','tools/pacing/sync-knobs.py','tools/pacing/identity-content.ts','tools/pacing/diagnose-identity.ts','tools/pacing/continue-identity.mjs','tools/pacing/identity-report.ts','tests/pacing-identity.test.ts','config/json/pacing-mechanism-knobs.json']
records=[];patches=[]
def normalized(path):return path.read_text(encoding='utf-8').replace('\r\n','\n')
def add_patch(path,head,desired,kind):
 if head==desired:return
 patch=''.join(difflib.unified_diff(head.splitlines(True),desired.splitlines(True),fromfile='a/'+path,tofile='b/'+path,n=3))
 if not head:patch='diff --git a/'+path+' b/'+path+'\nnew file mode 100644\n'+patch.replace('--- a/'+path,'--- /dev/null',1)
 else:patch='diff --git a/'+path+' b/'+path+'\n'+patch
 patches.append(patch);records.append({'path':path,'kind':kind,'sha256':hashlib.sha256(desired.encode()).hexdigest()})
for local in files:
 path='open-world/'+local;working=normalized(repo/path);oldfile=snap/(path+'.before')
 if not oldfile.exists():add_patch(path,'',working,'本期新文件');continue
 old=normalized(oldfile);head=git('show','HEAD:'+path).decode().replace('\r\n','\n')
 if old==head:add_patch(path,head,working,'本期整文件差量');continue
 raise AssertionError('未声明的共享文件需单独核对：'+path)
# 共享模拟文件：将C0→终态的逐段替换精确重放到HEAD，证明没有夹入C0已存在的改动。
path='open-world/packages/simulation/index.ts';old=normalized(snap/(path+'.before'));working=normalized(repo/path);head=git('show','HEAD:'+path).decode().replace('\r\n','\n');desired=head;a=old.splitlines(True);b=working.splitlines(True)
for tag,i,j,x,y in difflib.SequenceMatcher(None,a,b,autojunk=False).get_opcodes():
 if tag=='equal':continue
 prior=''.join(a[i:j]);new=''.join(b[x:y])
 if prior:assert desired.count(prior)==1,(tag,i,j);desired=desired.replace(prior,new,1)
 else:
  anchor=''.join(a[i:i+2]);assert desired.count(anchor)==1,('插入锚点',i);desired=desired.replace(anchor,new+anchor,1)
add_patch(path,head,desired,'共享文件仅本期hunk')
path='open-world/packages/contracts/index.ts';head=git('show','HEAD:'+path).decode().replace('\r\n','\n');assert head.count("rules:'ow-69'")==1;add_patch(path,head,head.replace("rules:'ow-69'","rules:'ow-70'"),'共享文件仅规则版本')
path='AGENTS.md';head=git('show','HEAD:'+path).decode().replace('\r\n','\n');line=next(s for s in normalized(repo/path).splitlines() if '节奏工具三期' in s);add_patch(path,head,head.rstrip()+'\n\n'+line+'\n','共享文件仅本期一行')
patch=''.join(patches);(review/'C7/own-source.patch').write_text(patch,encoding='utf-8',newline='')
if '--apply' not in sys.argv:print(json.dumps(records,ensure_ascii=False,indent=2));sys.exit()
git('apply','--cached','--check','--whitespace=nowarn',input=patch.encode());git('apply','--cached','--whitespace=nowarn',input=patch.encode())
# Excel基线与HEAD完全一致，ZIP只改机制页；其他目标页/样式/批注已独立验证为0差异。
binary='open-world/config/excel/节奏目标.xlsx';assert (snap/(binary+'.before')).read_bytes()==git('show','HEAD:'+binary);git('add','--',binary);records.append({'path':binary,'kind':'机制页二进制差量，原其他ZIP成员不变'})
artifacts=[p for p in review.rglob('*') if p.is_file() and 'source-before' not in p.parts and not p.name.endswith('.tmp')]
paths=[p.relative_to(repo).as_posix() for p in artifacts]
for i in range(0,len(paths),40):git('add','-f','--',*paths[i:i+40])
staged=git('diff','--cached','--name-only','-z').decode().rstrip('\0').split('\0');allowed={r['path'] for r in records}|set(paths);assert set(staged)<=allowed,set(staged)-allowed
(review/'C7/staged-files.json').write_text(json.dumps({'files':staged,'sourceScopes':records,'sharedMethod':'C0工作树差量重放到HEAD，生成patch后git apply --cached；不暂存其他会话内容'},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
git('add','-f','--','open-world/docs/reviews/pacing-identity-20261013/C7/staged-files.json')
print('只暂存本期文件：'+str(len(set(staged)|{'open-world/docs/reviews/pacing-identity-20261013/C7/staged-files.json'})))
