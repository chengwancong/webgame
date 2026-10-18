"""按WebAudio包络/滤波的离线近似复核，不含浏览器压缩器和带限振荡差异。"""
import json,math
from pathlib import Path
import numpy as np
from build import metrics,read_wav
SR=48000
MASTER=1
def biquad(x, kind, f0, q=1.0):
    w0 = 2 * math.pi * min(f0, SR / 2 * .99) / SR
    c, s = math.cos(w0), math.sin(w0)
    if kind in ('lowpass', 'highpass'):
        alpha = s / (2 * 10 ** (q / 20))  # WebAudio: LP/HP 的 Q 以 dB 计
    else:
        alpha = s / (2 * q)
    if kind == 'lowpass':
        b = [(1 - c) / 2, 1 - c, (1 - c) / 2]
    elif kind == 'highpass':
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
    else:  # bandpass (constant 0 dB peak)
        b = [alpha, 0, -alpha]
    a = [1 + alpha, -2 * c, 1 - alpha]
    b = [v / a[0] for v in b]; a1, a2 = a[1] / a[0], a[2] / a[0]
    y = np.zeros_like(x); x1 = x2 = y1 = y2 = 0.0
    for n in range(len(x)):
        xn = x[n]; yn = b[0] * xn + b[1] * x1 + b[2] * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xn, y1, yn; y[n] = yn
    return y

def lcg_noise(n, seed):
    out = np.empty(n); s = seed or 1
    for i in range(n):
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        out[i] = s / 2147483648 - 1  # mixer.ts: (imul(s,1664525)+1013904223)>>>0，再 /2^31−1
    return out

def osc(kind, phase):
    p = phase % 1.0
    if kind == 'sine': return np.sin(2 * math.pi * p)
    if kind == 'square': return np.where(p < .5, 1.0, -1.0)
    if kind == 'sawtooth': return 2 * p - 1
    return 1 - 4 * np.abs(p - .5)

def render(r):
    layers = r['layers']; echo = r.get('echo')
    dur = max(l['duration'] + l.get('delay', 0) for l in layers) + (echo['delay'] if echo else 0) + .02
    out = np.zeros(int(dur * SR) + 1)
    for l in layers:
        at = l.get('delay', 0); n = max(1, int(l['duration'] * SR)); t = np.arange(n) / SR
        env = l['weight'] * (1e-5 / l['weight']) ** (t / l['duration']) if l['weight'] > 1e-5 else np.zeros(n)
        if l['kind'] == 'tone':
            f0, f1 = l['from'], max(1, l.get('to', l['from']))
            f = f0 * (f1 / f0) ** (t / l['duration'])
            if 'lfo' in l: f = f + l['lfo']['depth'] * np.sin(2 * math.pi * l['lfo']['hz'] * t)
            sig = osc(l.get('type', 'sine'), np.cumsum(f) / SR)
        else:
            sig = biquad(lcg_noise(n, round(l['from'])), l.get('filter', 'lowpass'), l['from'])
            if 'lfo' in l: env = env + l['weight'] * l['lfo']['depth'] * np.sin(2 * math.pi * l['lfo']['hz'] * t)
        y = sig * env; i0 = int(at * SR); out[i0:i0 + n] += y[:len(out) - i0]
        if echo:
            j0 = i0 + int(echo['delay'] * SR); out[j0:j0 + n] += (y * echo['weight'])[:max(0, len(out) - j0)]
    return out * MASTER

if __name__=='__main__':
    root=Path(__file__).resolve().parents[2]
    data=json.loads((root/'.qa/audio-production/fallback-recipes.json').read_text(encoding='utf-8'))
    manifest=json.loads((root/'apps/web/src/audio/sample-manifest.json').read_text(encoding='utf-8'))
    rows=[]
    for row in data['rows']:
        recipe=row['recipe']
        for layer in recipe['layers']:layer['weight']*=data['synthGain']
        synthesized=render(recipe); fallback=metrics(synthesized,SR)['punch']
        samples=[metrics(*read_wav(root/'apps/web/public'/url.lstrip('/')))['punch'] for url in manifest[row['key']][row['stage']]['files']]
        delta=round(float(np.median(samples))-fallback,1)
        rows.append(dict(key=row['key'],stage=row['stage'],fallback=fallback,sample=round(float(np.median(samples)),1),difference=delta))
    delta=float(np.median([r['difference'] for r in rows]))
    report=dict(method='离线近似，统一主音量/总线归一，不含限幅器',synthGain=data['synthGain'],medianDifference=round(delta,1),recommended=round(data['synthGain']*10**(delta/20),3) if abs(delta)>6 else data['synthGain'],rows=rows)
    (root/'.qa/audio-production/fallback-review.json').write_text(json.dumps(report,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False))
