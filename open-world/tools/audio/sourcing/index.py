"""录音素材索引：把 .qa/audio-sourcing 下的原始素材切成单发片段，统一 48k 单声道，写入本地素材包。

用法（工作目录 open-world）：python -X utf8 tools/audio/sourcing/index.py
输出：.qa/audio-sourcing/pack/*.wav 与 .qa/audio-sourcing/pack/index.json（只留本地，不提交）。
来源与授权见 tools/audio/sourcing/sources.md；原始素材获取见同目录 fetch.py。
"""
from __future__ import annotations
import hashlib, json, math, re, sys
from pathlib import Path
import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / '.qa/audio-sourcing'
PACK = SRC / 'pack'
SR = 48000
LONG = 12.0  # 超过即另存一份环境/长素材（前 60 秒）


def resample(x: np.ndarray, sr: int) -> np.ndarray:
    if sr == SR:
        return x
    n = int(round(len(x) * SR / sr))
    spec = np.fft.rfft(x)
    keep = min(len(spec), n // 2 + 1)
    out = np.zeros(n // 2 + 1, dtype=complex)
    out[:keep] = spec[:keep]
    return np.fft.irfft(out, n) * (n / len(x))


def licence_of(path: Path) -> tuple[str, str]:
    s = path.as_posix()
    if '/raw-cc0/' in s:
        pack = path.relative_to(SRC / 'raw-cc0/x').parts[0]
        who = 'Kenney (kenney.nl)' if pack.startswith('kenney') else 'rubberduck (opengameart.org)'
        return f'{who} · {pack}', 'CC0 1.0'
    lib = path.relative_to(SRC / 'raw-sonniss').parts[1]
    return f'Sonniss GDC Game Audio Bundle · {lib}', 'Sonniss GDC Bundle 免版税授权（可商用、无需署名、禁止 AI 训练）'


def tags_of(path: Path) -> list[str]:
    s = path.relative_to(SRC).as_posix().lower()
    s = re.sub(r'\.(wav|ogg|flac|aiff?)$', '', s)
    return sorted({t for t in re.split(r'[^a-z0-9]+', s) if len(t) > 1 and not t.isdigit()})


def segments(x: np.ndarray) -> list[tuple[int, int]]:
    """按静音切分：50ms RMS 包络低于峰值 -42dB 持续 120ms 视为间隔。"""
    hop = int(.01 * SR)
    n = len(x) // hop
    if n < 3:
        return [(0, len(x))]
    env = np.sqrt(np.mean(x[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-20)
    env = np.convolve(env, np.ones(5) / 5, 'same')
    thr = env.max() * 10 ** (-42 / 20)
    on = env > thr
    out, i = [], 0
    while i < n:
        if not on[i]:
            i += 1
            continue
        j = i
        quiet = 0
        while j < n and quiet < 12:
            quiet = quiet + 1 if not on[j] else 0
            j += 1
        a, b = max(0, i - 2) * hop, min(len(x), (j - quiet + 4) * hop)
        out.append((a, b))
        i = j
    return out


def features(seg: np.ndarray) -> dict:
    peak = float(np.max(np.abs(seg))) + 1e-12
    m = 1 << 15
    spec = np.abs(np.fft.rfft(seg[:m], m)) ** 2
    f = np.fft.rfftfreq(m, 1 / SR)
    tot = spec.sum() + 1e-20
    hop = int(.005 * SR)
    n = max(1, len(seg) // hop)
    env = np.sqrt(np.mean(seg[:n * hop].reshape(n, hop) ** 2, axis=1) + 1e-20) if len(seg) >= hop else np.array([peak])
    k = int(np.argmax(env))
    after = env[k:]
    t20 = int(np.argmax(after < env[k] * .1)) if np.any(after < env[k] * .1) else len(after)
    return dict(dur=round(len(seg) / SR, 3), peak=round(20 * math.log10(peak), 1),
                centroid=int((spec * f).sum() / tot), low200=round(float(spec[f < 200].sum() / tot), 3),
                attack=round(k * hop / SR, 3), decay=round(t20 * hop / SR, 3))


def main():
    PACK.mkdir(parents=True, exist_ok=True)
    files = [p for p in sorted((SRC / 'raw-cc0/x').rglob('*')) + sorted((SRC / 'raw-sonniss').rglob('*'))
             if p.suffix.lower() in ('.wav', '.ogg', '.flac', '.aif', '.aiff') and 'preview' not in p.name.lower()
             and ('--cc0' not in sys.argv or '/raw-cc0/' in p.as_posix())]
    index = []
    for p in files:
        try:
            x, sr = sf.read(str(p), always_2d=True, dtype='float32')
        except Exception as e:  # 个别文件格式异常时跳过并记录
            print('skip', p, e, file=sys.stderr)
            continue
        x = x[:int(120 * sr)]
        mono = x.mean(axis=1).astype(np.float64)
        mono = resample(mono, sr)
        source, licence = licence_of(p)
        rel = p.relative_to(SRC).as_posix()
        sid = hashlib.sha1(rel.encode()).hexdigest()[:10]
        spans = [(a, b) for a, b in segments(mono) if b - a >= .03 * SR]
        # 长文件：整段当环境素材（前 60 秒）；同时把其中的单发片段（多条录制、长尾冲击）切出来，超过 8 秒的截成 3 秒
        items = []
        if len(mono) / SR > LONG:
            items.append(('long', 0, mono[:int(60 * SR)]))
        if len(mono) / SR <= LONG or len(spans) >= 2 or (spans and spans[0][1] - spans[0][0] > 8 * SR):
            for a, b in spans[:40]:
                seg = mono[a:b]
                if len(seg) > 8 * SR:
                    n = int(3 * SR)
                    seg = seg[:n] * np.concatenate([np.ones(n - n // 4), np.linspace(1, 0, n // 4) ** 2])
                items.append(('shot', len(items), seg))
        for kind, n, seg in items:
            if np.max(np.abs(seg)) < 10 ** (-50 / 20):
                continue
            out = PACK / f'{sid}_{n:02d}.wav'
            sf.write(str(out), (seg / max(1e-9, np.max(np.abs(seg))) * .9).astype(np.float32), SR, subtype='PCM_16')
            index.append(dict(id=f'{sid}_{n:02d}', file=out.name, origin=rel, segment=n, segments=len(items), kind=kind,
                              tags=tags_of(p), source=source, licence=licence, **features(seg)))
        print(f'{len(index):5d} {rel}', flush=True)
    (PACK / 'index.json').write_text(json.dumps(index, ensure_ascii=False, indent=0), encoding='utf-8')
    print('片段', len(index), '来源文件', len(files))


if __name__ == '__main__':
    main()
