"""背景音乐：把 .qa/audio-sourcing/raw-cc0/music 下的 CC0 原曲加工成运行时循环（.ogg 主用、.mp3 兜底），登记 music-manifest.json。
原曲不进 Git；加工产物在 apps/web/public/audio/music（不进 Git）。用法：python -X utf8 tools/audio/music.py"""
import json
from pathlib import Path
import numpy as np, soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / '.qa/audio-sourcing/raw-cc0/music'
OUT = ROOT / 'apps/web/public/audio/music'
MANIFEST = ROOT / 'apps/web/src/audio/music-manifest.json'
SR = 44100
XFADE = 2.0  # 非无缝原曲：尾部 2 秒等功率交叉淡入到开头，做成循环
# key: (原曲目录, 是否原本就无缝循环, 目标 RMS dBFS)。探索类压在环境声（约 -29）之上、命中声（约 -21）之下。
TRACKS = {
    'wind': ('feel-good-island-loop', True, -24),
    'port': ('town-theme-rpg', False, -24),
    'mist': ('mysterious-winds', False, -24),
    'forge': ('treasure-hunter', False, -24),
    'frost': ('snowfall', True, -24),
    'rift': ('crystal-cave-song18', False, -24),
    'dragon': ('chest-of-adventure', False, -24),
    'dungeon': ('cave-theme', False, -24),
    'combat': ('battle-theme-a', False, -22),
    'boss': ('boss-battle-music', True, -22),
    'title': ('to-the-wind', False, -24),
}


def load(path: Path):
    d, sr = sf.read(str(path), dtype='float32', always_2d=True)
    if d.shape[1] == 1: d = np.repeat(d, 2, 1)
    d = d[:, :2]
    if sr != SR:
        x = np.linspace(0, len(d) - 1, int(len(d) * SR / sr))
        d = np.stack([np.interp(x, np.arange(len(d)), d[:, c]) for c in range(2)], 1).astype('float32')
    return d


def trim(d):
    a = np.abs(d).max(1); idx = np.where(a > a.max() * 10 ** (-50 / 20))[0]
    return d[idx[0]:idx[-1] + 1] if len(idx) else d


def loop(d):
    n = int(SR * XFADE); t = np.linspace(0, np.pi / 2, n, dtype='float32')[:, None]
    head = d[:n] * np.sin(t) + d[-n:] * np.cos(t)
    return np.concatenate([head, d[n:-n]])


def level(d, target):
    a = np.abs(d).mean(1); gated = d[a > a.max() * 10 ** (-40 / 20)]  # 只算有声段，免得安静段拉低
    rms = 20 * np.log10(np.sqrt((gated ** 2).mean()) + 1e-9)
    d = d * 10 ** ((target - rms) / 20); pk = np.abs(d).max(); lim = 10 ** (-1 / 20)
    return (d * (lim / pk) if pk > lim else d), rms


def write(path: Path, d, **kw):
    tmp = path.with_name(path.name + '.tmp')
    with sf.SoundFile(str(tmp), 'w', SR, 2, **kw) as f:
        for i in range(0, len(d), 4096): f.write(d[i:i + 4096])  # libsndfile 整段写 Vorbis 会崩
    tmp.replace(path)


def main():
    OUT.mkdir(parents=True, exist_ok=True); manifest = {}
    for key, (slug, seamless, target) in TRACKS.items():
        folder = RAW / slug
        src = next(p for p in folder.iterdir() if p.suffix.lower() in ('.ogg', '.mp3', '.wav', '.flac'))
        info = dict(line.split(': ', 1) for line in (folder / 'SOURCE.txt').read_text(encoding='utf-8').splitlines()[2:] if ': ' in line)
        d = load(src)
        if not seamless: d = loop(trim(d))
        d, before = level(d, target)
        ogg, mp3 = OUT / f'{key}.ogg', OUT / f'{key}.mp3'
        write(ogg, d, format='OGG', subtype='VORBIS', compression_level=0.5)
        write(mp3, d, format='MP3', subtype='MPEG_LAYER_III', compression_level=0.5)
        manifest[f'music/{key}'] = dict(files=['/audio/music/' + ogg.name, '/audio/music/' + mp3.name], seconds=round(len(d) / SR, 1), seamless=seamless,
                                         source=f'https://opengameart.org/content/{slug}', author=info.get('Author', ''), license=info.get('License', 'CC0'))
        print(f'{key:8s} {slug:24s} {len(d) / SR:6.1f}s  原RMS {before:6.1f} → {target}  ogg {ogg.stat().st_size // 1024}KB mp3 {mp3.stat().st_size // 1024}KB')
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')


if __name__ == '__main__':
    main()
