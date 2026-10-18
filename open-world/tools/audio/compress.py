"""WAV → Ogg Vorbis 运行时压缩版，并在 sample-manifest.json 的 formats.ogg 登记。

WAV 源文件保留（验收、再加工都读 WAV）；浏览器能播 Vorbis 时加载 .ogg，否则回退 WAV。
用 libsndfile（python soundfile）编码，无需 ffmpeg。Opus 需 48k/24k 采样率，而大部分源为 32k，故用 Vorbis。

用法（工作目录 open-world）：
  python -X utf8 tools/audio/compress.py           编码缺失/过期的 .ogg，登记清单，打印体积对比
  python -X utf8 tools/audio/compress.py --force   全部重编
build.py 写清单前也会调用 attach()，重渲染的 WAV 会自动重编。
"""
from __future__ import annotations
import json, sys
from pathlib import Path
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
WEB_PUBLIC = ROOT / 'apps/web/public'
MANIFEST = ROOT / 'apps/web/src/audio/sample-manifest.json'
# libsndfile 的 Vorbis：压缩级别越高越小；0.4 ≈ oggenc -q6，环境/循环/音效都听不出损失。
LEVEL = 0.4
BLOCK = 4096  # 整段一次写入会让 libsndfile 的 Vorbis 编码器栈溢出，按块写


def encode(wav: Path, force=False) -> Path:
    out = wav.with_suffix('.ogg')
    if not force and out.exists() and out.stat().st_mtime >= wav.stat().st_mtime:
        return out
    data, sr = sf.read(str(wav), dtype='float32')
    channels = 1 if data.ndim == 1 else data.shape[1]
    tmp = out.with_suffix('.ogg.tmp')
    with sf.SoundFile(str(tmp), 'w', sr, channels, format='OGG', subtype='VORBIS', compression_level=LEVEL) as f:
        for i in range(0, len(data), BLOCK):
            f.write(data[i:i + BLOCK])
    tmp.replace(out)
    return out


def attach(manifest: dict, force=False) -> dict:
    """为清单每个条目编码并登记 formats.ogg；返回体积统计。"""
    stats = dict(files=0, wav=0, ogg=0, wiredWav=0, wiredOgg=0)
    for stages in manifest.values():
        for entry in stages.values():
            wavs = [WEB_PUBLIC / f.lstrip('/') for f in entry['files'] if f.endswith('.wav')]
            if len(wavs) != len(entry['files']) or not all(p.exists() for p in wavs):
                continue
            oggs = [encode(p, force) for p in wavs]
            formats = {k: v for k, v in (entry.get('formats') or {}).items() if k != 'ogg'}
            formats['ogg'] = ['/' + p.relative_to(WEB_PUBLIC).as_posix() for p in oggs]
            entry['formats'] = formats
            w, o = sum(p.stat().st_size for p in wavs), sum(p.stat().st_size for p in oggs)
            stats['files'] += len(wavs); stats['wav'] += w; stats['ogg'] += o
            if entry.get('wired'):
                stats['wiredWav'] += w; stats['wiredOgg'] += o
    return stats


def main():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    stats = attach(manifest, '--force' in sys.argv)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    mb = lambda b: f'{b / 1048576:.1f}MB'
    print(f"{stats['files']} 个文件：WAV {mb(stats['wav'])} → OGG {mb(stats['ogg'])}；已接入 WAV {mb(stats['wiredWav'])} → OGG {mb(stats['wiredOgg'])}")


if __name__ == '__main__':
    main()
