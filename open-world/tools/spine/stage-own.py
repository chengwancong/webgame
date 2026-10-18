"""只暂存本期新建工具、测试和证据；不暂存共享数值源及S0快照。"""
from pathlib import Path
import subprocess, json, sys, hashlib, runpy

world = Path(__file__).resolve().parents[2]
repo = world.parent
review = world / 'docs/reviews/numeric-spine-20261013'

def git(*args):
    return subprocess.check_output(['git', *args], cwd=repo)

assert not git('diff', '--cached', '--name-only').strip(), '索引已有其他会话暂存内容；保留索引，不自动提交'
sources = [
    'tools/spine/math.ts', 'tools/spine/targets.ts', 'tools/spine/apply.ts',
    'tools/spine/preflight.ts', 'tools/spine/diagnose.ts', 'tools/spine/resume.ts',
    'tools/spine/retry-python-tests.mjs',
    'tools/spine/with-python.mjs',
    'tools/spine/tsconfig.json', 'tools/spine/stage-own.py',
    'tests/numeric-spine-math.test.ts', 'tests/numeric-spine-apply.test.ts',
]
paths = [world / p for p in sources]
policy=runpy.run_path(str(world/'tools/spine/review-policy.py'))
paths.extend(p for p in review.rglob('*') if p.is_file()
             and not policy['raw'](p.relative_to(repo).as_posix())
             and p.suffix in ['.md','.json','.log'] and p.stat().st_size<=200*1024
             and len(p.read_bytes().splitlines())<=2000
             and p.relative_to(review).as_posix() != 'S9/staged-files.json')
paths = sorted(set(paths))
records = []
for path in paths:
    assert path.is_file() and not path.is_symlink(), path
    name = path.relative_to(repo).as_posix()
    # 仅本期专属命名空间；共享源码的hunk另行重放后必须过同一留档门禁。
    assert name.startswith(('open-world/tools/spine/','open-world/tests/numeric-spine-','open-world/docs/reviews/numeric-spine-20261013/')),name
    records.append({'file': name, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
                    'scope': '本期新文件；无共享文件差量'})
manifest = review / 'S9/staged-files.json'
manifest.parent.mkdir(parents=True, exist_ok=True)
manifest.write_text(json.dumps({'scope': '前置硬阻塞下的独立准备，非S9数值完成',
                               'files': records, 'excluded': ['S0/source-before', '所有共享数值源、Excel、AGENTS.md、其他会话文件']},
                              ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
if '--apply' not in sys.argv:
    print('已生成暂存范围清单，未写索引：', len(paths) + (manifest not in paths))
    sys.exit()
paths = sorted(set(paths + [manifest]))
for start in range(0, len(paths), 35):
    git('add', '-f', '--', *(p.relative_to(repo).as_posix() for p in paths[start:start + 35]))
staged = set(git('diff', '--cached', '--name-only', '-z').decode().rstrip('\0').split('\0'))
allowed = {p.relative_to(repo).as_posix() for p in paths}
assert staged == allowed, {'unexpected': sorted(staged - allowed), 'missing': sorted(allowed - staged)}
print('仅暂存本期新文件：', len(staged))
policy['check']()
