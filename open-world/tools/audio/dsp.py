"""音效合成基础件（离线，numpy）。所有标杆和后续批量音效只用这里的积木，保证同一套质感。

约定：
- 采样率 SR=48000，float64 [-1,1]，单声道为一维数组，立体声为 (2,n)。
- 随机性一律走 rng(seed)，同一 seed 输出逐字节一致，变体用不同 seed。
- 时间单位秒，频率 Hz，增益 dB 用 db() 转换。
"""
from __future__ import annotations
import math, wave
from pathlib import Path
import numpy as np

SR = 48000

def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)

def db(v: float) -> float:
    return 10 ** (v / 20)

def t_axis(dur: float, sr: int = SR) -> np.ndarray:
    return np.arange(int(round(dur * sr))) / sr

def silence(dur: float, sr: int = SR) -> np.ndarray:
    return np.zeros(int(round(dur * sr)))

# ---------- 包络 ----------

def env_ad(dur: float, attack: float, decay_curve: float = 6.0, sr: int = SR) -> np.ndarray:
    """起音线性上升 attack 秒，之后指数衰减到 −60dB（decay_curve 越大衰减越快）。"""
    t = t_axis(dur, sr); a = max(attack, 1 / sr)
    rise = np.clip(t / a, 0, 1)
    fall = np.exp(-decay_curve * np.clip(t - a, 0, None) / max(dur - a, 1 / sr))
    return rise * fall

def env_exp(dur: float, t60: float, sr: int = SR) -> np.ndarray:
    """从 1 开始按 t60（衰减 60dB 所需秒数）指数衰减。"""
    t = t_axis(dur, sr)
    return np.exp(-6.9078 * t / max(t60, 1e-4))

def fade(x: np.ndarray, fin: float = .002, fout: float = .01, sr: int = SR) -> np.ndarray:
    y = x.copy(); n = y.shape[-1]
    a, b = min(n, int(fin * sr)), min(n, int(fout * sr))
    if a: y[..., :a] *= np.linspace(0, 1, a)
    if b: y[..., n - b:] *= np.linspace(1, 0, b) ** 2
    return y

# ---------- 振荡器 ----------

def sweep(f0: float, f1: float, dur: float, curve: str = 'exp', sr: int = SR) -> np.ndarray:
    t = t_axis(dur, sr); u = t / max(dur, 1e-9)
    return f0 * (f1 / f0) ** u if curve == 'exp' else f0 + (f1 - f0) * u

def osc(freq, dur: float, kind: str = 'sine', phase: float = 0.0, sr: int = SR) -> np.ndarray:
    n = int(round(dur * sr)); f = np.broadcast_to(np.asarray(freq, dtype=float), (n,))
    ph = phase + np.cumsum(f) / sr; p = ph % 1.0
    if kind == 'sine': return np.sin(2 * math.pi * ph)
    if kind == 'tri': return 1 - 4 * np.abs(p - .5)
    if kind == 'saw':  # 3 阶加法近似，避免裸锯齿的刺耳混叠
        return sum(np.sin(2 * math.pi * k * ph) / k for k in range(1, 9)) * (2 / math.pi)
    raise ValueError(kind)

def fm(carrier: float, ratio: float, index_env: np.ndarray, dur: float, sr: int = SR) -> np.ndarray:
    """两算子 FM：钟、铃、晶体的基础。index_env 为调制指数随时间变化。"""
    t = t_axis(dur, sr); mod = np.sin(2 * math.pi * carrier * ratio * t) * index_env[:len(t)]
    return np.sin(2 * math.pi * carrier * t + mod)

def modal(partials: list[tuple[float, float, float]], dur: float, seed: int = 0, detune: float = 0.0, sr: int = SR) -> np.ndarray:
    """模态合成：[(频率, 相对幅度, t60)]。金属、玻璃、木头、石头的共振体。"""
    r = rng(seed); t = t_axis(dur, sr); y = np.zeros_like(t)
    for f, a, t60 in partials:
        ff = f * (1 + detune * r.uniform(-1, 1))
        y += a * np.sin(2 * math.pi * ff * t + r.uniform(0, 2 * math.pi)) * np.exp(-6.9078 * t / t60)
    return y

def pluck(freq: float, dur: float, seed: int, bright: float = .5, sr: int = SR) -> np.ndarray:
    """Karplus-Strong 拨弦（竖琴、吉他、拨片乐器）。bright 0..1 控制亮度与延音。"""
    n = int(dur * sr); period = max(2, int(round(sr / freq)))
    buf = rng(seed).uniform(-1, 1, period).tolist(); out = np.empty(n)
    damp = .5 + .5 * (1 - bright) * .02; keep = .996 + bright * .0035
    i = 0
    for k in range(n):
        j = k % period; nxt = buf[(j + 1) % period]
        v = buf[j]; out[k] = v
        buf[j] = keep * (damp * v + (1 - damp) * nxt)
    return out * env_ad(dur, .002, 3.0, sr)

# ---------- 噪声与滤波 ----------

def noise(dur: float, seed: int, color: str = 'white', sr: int = SR) -> np.ndarray:
    n = int(round(dur * sr)); w = rng(seed).standard_normal(n)
    if color == 'white': return w / 3
    spec = np.fft.rfft(w); f = np.fft.rfftfreq(n, 1 / sr); f[0] = f[1] if n > 1 else 1
    spec *= (1 / np.sqrt(f)) if color == 'pink' else (1 / f)  # brown
    y = np.fft.irfft(spec, n); return y / (np.max(np.abs(y)) + 1e-12) * .5

def fft_filter(x: np.ndarray, response, sr: int = SR) -> np.ndarray:
    """静态滤波（零相位，任意幅度响应函数 response(freq)->gain）。长素材用它，速度快。"""
    n = x.shape[-1]; m = 1 << (n - 1).bit_length()
    spec = np.fft.rfft(x, m); f = np.fft.rfftfreq(m, 1 / sr)
    return np.fft.irfft(spec * response(f), m)[..., :n]

def lp_resp(fc: float, order: int = 2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))

def hp_resp(fc: float, order: int = 2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))

def bp_resp(fc: float, q: float):
    return lambda f: 1 / np.sqrt(1 + q * q * (np.maximum(f, 1e-3) / fc - fc / np.maximum(f, 1e-3)) ** 2)

def lowpass(x, fc, order=2, sr=SR): return fft_filter(x, lp_resp(fc, order), sr)
def highpass(x, fc, order=2, sr=SR): return fft_filter(x, hp_resp(fc, order), sr)
def bandpass(x, fc, q=2.0, sr=SR): return fft_filter(x, bp_resp(fc, q), sr)

def svf(x: np.ndarray, cutoff, q: float = .7, mode: str = 'lp', sr: int = SR) -> np.ndarray:
    """时变状态变量滤波器（cutoff 可为逐样本数组）。用于扫频的风声、挥舞声。短素材用。"""
    n = len(x); fc = np.broadcast_to(np.asarray(cutoff, dtype=float), (n,))
    g = np.tan(np.pi * np.clip(fc, 10, sr * .45) / sr); k = 1 / q
    a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2
    ic1 = ic2 = 0.0; out = np.empty(n); xs = x.tolist()
    sel = {'lp': 2, 'bp': 1, 'hp': 0}[mode]
    for i in range(n):
        v3 = xs[i] - ic2; v1 = a1[i] * ic1 + a2[i] * v3; v2 = ic2 + a2[i] * ic1 + a3[i] * v3
        ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2
        out[i] = v2 if sel == 2 else v1 if sel == 1 else xs[i] - k * v1 - v2
    return out

def crackle(dur: float, density: float, seed: int, fc: float = 3000, sr: int = SR) -> np.ndarray:
    """稀疏随机脉冲（火焰噼啪、碎屑、沙石）。density=每秒颗粒数。"""
    r = rng(seed); n = int(round(dur * sr)); y = np.zeros(n)
    count = r.poisson(density * dur)
    for p in r.integers(0, max(1, n - 400), count):
        L = int(r.uniform(.0008, .004) * sr); g = r.uniform(.2, 1) * np.exp(-np.arange(L) / (L / 4))
        y[p:p + L] += r.standard_normal(L) * g
    return bandpass(y, fc, 1.2, sr)

# ---------- 空间 ----------

def reverb_ir(t60: float, seed: int, predelay: float = .008, bright: float = 6000, sr: int = SR, stereo: bool = False) -> np.ndarray:
    n = int((t60 + predelay) * sr); r = rng(seed)
    def one(s):
        rr = rng(s); ir = rr.standard_normal(n) * np.exp(-6.9078 * np.arange(n) / sr / t60)
        ir[:int(predelay * sr)] = 0; return lowpass(ir, bright, 1, sr) / math.sqrt(n)
    return np.stack([one(seed), one(seed + 1)]) if stereo else one(seed)

def convolve(x: np.ndarray, ir: np.ndarray) -> np.ndarray:
    n = x.shape[-1] + ir.shape[-1] - 1; m = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[..., :n]

def room(x: np.ndarray, t60: float, wet: float, seed: int = 7, bright: float = 6000, sr: int = SR) -> np.ndarray:
    """短混响：干声 + 湿声，输出长度 = 原长 + 尾巴。"""
    ir = reverb_ir(t60, seed, bright=bright, sr=sr); w = convolve(x, ir)
    d = np.zeros_like(w); d[:len(x)] = x
    return d + wet * w / (np.max(np.abs(w)) + 1e-12) * (np.max(np.abs(x)) + 1e-12)

def pan_stereo(x: np.ndarray, pan: float) -> np.ndarray:
    a = (pan + 1) * math.pi / 4
    return np.stack([x * math.cos(a), x * math.sin(a)])

# ---------- 拼装与母带 ----------

def mix(*layers: tuple[np.ndarray, float, float]) -> np.ndarray:
    """mix((信号, 起始秒, 增益dB), ...) → 按起点叠加。"""
    end = max(int(round(at * SR)) + s.shape[-1] for s, at, _ in layers)
    stereo = any(s.ndim == 2 for s, _, _ in layers)
    out = np.zeros((2, end) if stereo else end)
    for s, at, g in layers:
        i = int(round(at * SR)); s2 = np.stack([s, s]) if stereo and s.ndim == 1 else s
        out[..., i:i + s2.shape[-1]] += s2 * db(g)
    return out

def soft_clip(x: np.ndarray, drive: float = 1.0) -> np.ndarray:
    return np.tanh(x * drive) / math.tanh(drive)

def normalize_peak(x: np.ndarray, peak_db: float) -> np.ndarray:
    return x / (np.max(np.abs(x)) + 1e-12) * db(peak_db)

def trim(x: np.ndarray, floor_db: float = -70, sr: int = SR) -> np.ndarray:
    """去掉尾部低于 floor 的静音（保留 10ms）。"""
    a = np.max(np.abs(x), axis=0) if x.ndim == 2 else np.abs(x)
    idx = np.nonzero(a > db(floor_db) * (a.max() + 1e-12))[0]
    end = min(a.shape[-1], (idx[-1] if len(idx) else 0) + int(.01 * sr))
    return fade(x[..., :end], 0, .006)

def loop_crossfade(x: np.ndarray, xfade: float, sr: int = SR) -> np.ndarray:
    """把尾部 xfade 秒与开头等功率交叉，得到首尾无缝的循环（长度减少 xfade）。"""
    n = int(xfade * sr); u = np.linspace(0, math.pi / 2, n)
    head, tail = x[..., :n], x[..., -n:]
    body = x[..., n:-n] if x.shape[-1] > 2 * n else x[..., n:]
    joined = tail * np.cos(u) + head * np.sin(u)
    result = np.concatenate([body, joined], axis=-1)
    seam = min(int(.002 * sr), result.shape[-1])
    correction = result[..., 0] - result[..., -1]
    result[..., -seam:] += np.expand_dims(correction, -1) * np.linspace(0, 1, seam)
    return result

def write_wav(path: Path, x: np.ndarray, sr: int = SR) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    y = np.clip(x, -1, 1); ch = 2 if y.ndim == 2 else 1
    pcm = (y.T if ch == 2 else y) * 32767
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(ch); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(np.round(pcm).astype('<i2').tobytes())
