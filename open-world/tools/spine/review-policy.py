"""留档暂存门禁：原始数据不入库，结论文件限200KB/2000行，总新增限30000行。"""
from pathlib import Path
import subprocess, sys, json
repo=Path(__file__).resolve().parents[3]
prefix='open-world/docs/reviews/numeric-spine-20261013/'
def git(*args):return subprocess.check_output(['git',*args],cwd=repo)
def raw(name):
    p=Path(name)
    summaries={'prerequisites.json','resume-check.json','workspace-baseline.json','numeric-sources.json','spine-targets-draft.json','cleanup.json','environment.json','test-result.json','build-cleanup.json','build-location.json','build.json','python-cleanup.json','python-environment.json','commit.json','staged-files.json'}
    opaque_json=p.suffix=='.json' and p.name not in summaries and not p.name.endswith(('-summary.json','-preservation.json'))
    return opaque_json or any(x in p.parts for x in ['arms','source-before','resume-own-base','own-preview','golden-raw','model-raw','natural','screenshots','dist','world-reviews']) or p.name.startswith(('bd-measurements','natural-calendar')) or p.suffix.lower() in ['.png','.webm','.zip','.gz','.dump']
def check():
    files=git('diff','--cached','--name-only','--diff-filter=ACMR','-z').decode().rstrip('\0').split('\0')
    added=0; checked=[]
    for name in files:
        if not name.startswith(prefix):continue
        assert not raw(name),'原始数据不得暂存：'+name
        assert Path(name).suffix in ['.md','.json','.log'],'只允许结论文档/汇总JSON/小日志：'+name
        data=git('show',':'+name); lines=len(data.splitlines())
        assert len(data)<=200*1024 and lines<=2000,('超限留档',name,len(data),lines)
        checked.append({'file':name,'bytes':len(data),'lines':lines})
    for row in git('diff','--cached','--numstat').decode().splitlines():
        a,d,name=row.split('\t',2)
        if name.startswith(prefix) and a!='-':added+=int(a)
    assert added<=30000,('本期留档新增行数超限',added)
    return {'passed':True,'reviewAddedLines':added,'files':checked}
if __name__=='__main__':print(json.dumps(check(),ensure_ascii=False,indent=2))
