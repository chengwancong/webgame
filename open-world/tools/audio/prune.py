"""只清理本次注册配方降变体留下的WAV；不遍历删除未知文件。"""
from pathlib import Path
from recipes import SOUNDS
from benchmarks import SOUNDS as BENCHMARKS
root=Path(__file__).resolve().parents[2]/'apps/web/public/audio'
protected={(s.key,s.stage) for s in BENCHMARKS}
removed=[]
for sound in SOUNDS:
    if (sound.key,sound.stage) in protected:continue
    for v in range(sound.variants+1,6):
        target=(root/f'{sound.key}__{sound.stage}__v{v:02d}.wav').resolve()
        if not target.is_relative_to(root.resolve()) or target.suffix!='.wav':raise RuntimeError('拒绝越界清理')
        if target.exists():target.unlink();removed.append(str(target.relative_to(root)))
print(f'清理已降级变体 {len(removed)} 个；保留所有标杆与未知文件。')
