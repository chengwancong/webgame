"""渲染音效 → apps/web/public/audio/，写清单 apps/web/src/audio/sample-manifest.json，并做客观验收。

用法（工作目录 open-world）：
  python -X utf8 tools/audio/build.py            渲染 + 验收 + 写清单 + 试听合集
  python -X utf8 tools/audio/build.py --check    只验收已渲染文件（不写）
  python -X utf8 tools/audio/build.py --only cue/hit,player/cut
验收不通过时退出码 1。
"""
from __future__ import annotations
import hashlib, json, math, sys, wave
from pathlib import Path
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from dsp import SR, db, fft_filter, hp_resp, write_wav, normalize_peak, mix, silence  # noqa: E402
from benchmarks import TIERS
from recipes import SOUNDS
from validation import production_checks  # noqa: E402
from compress import attach as attach_ogg  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
PUBLIC = ROOT / 'apps/web/public/audio'
MANIFEST = ROOT / 'apps/web/src/audio/sample-manifest.json'
QA = ROOT / '.qa/audio-benchmarks'

# 高频重复、必须在小喇叭上可辨的核心反馈
CORE = {'cue/hit', 'cue/crit', 'cue/kill', 'cue/danger', 'cue/loot', 'cue/shield-break'}
FREQUENT = {'cue/hit', 'cue/kill', 'cue/loot', 'foley/step-stone', 'foley/step-wood', 'ui/click'}

def seed_of(key: str, stage: str, v: int) -> int:
    return int(hashlib.sha1(f'{key}:{stage}'.encode()).hexdigest()[:8], 16) % 100000 * 10 + v

def k_weight(f):  # 近似 ITU-R BS.1770 K 计权：38Hz 高通 + 1.7kHz 以上 +4dB
    shelf = 1 + (db(4) - 1) / (1 + (1700 / np.maximum(f, 1)) ** 2)
    return hp_resp(38, 2)(f) * shelf

def loudness(x, sr):
    y = fft_filter(x, k_weight, sr); ms = np.mean(y ** 2, axis=-1)
    total = float(np.sum(ms)) if y.ndim == 2 else float(ms)
    return -0.691 + 10 * math.log10(total + 1e-20)

def metrics(x, sr):
    mono = x.mean(axis=0) if x.ndim == 2 else x
    peak = float(np.max(np.abs(x))) + 1e-12
    m = 1 << 16; spec = np.abs(np.fft.rfft(mono[:m] if len(mono) > m else mono, m)) ** 2
    f = np.fft.rfftfreq(m, 1 / sr); tot = spec.sum() + 1e-20
    act = np.abs(mono) > peak * .05
    full = math.sqrt(np.mean(mono[act] ** 2)) + 1e-12
    small = fft_filter(mono, hp_resp(200, 2), sr)
    small_r = math.sqrt(np.mean(small[act] ** 2)) + 1e-12
    kw = fft_filter(mono, k_weight, sr); w = max(1, int(.05 * sr))
    win = np.sqrt(np.convolve(kw ** 2, np.ones(w) / w, 'valid')) if len(kw) > w else np.array([math.sqrt(np.mean(kw ** 2))])
    punch = 20 * math.log10(float(win.max()) + 1e-12)
    return dict(peak=round(20 * math.log10(peak), 1), lufs=round(loudness(x, sr), 1), punch=round(punch, 1),
                low200=round(float(spec[f < 200].sum() / tot), 2),
                harsh=round(float(spec[(f > 2000) & (f < 5000)].sum() / tot), 2),
                small_loss=round(20 * math.log10(full / small_r), 1),
                centroid=int((spec * f).sum() / tot), dur=round(mono.shape[-1] / sr, 3))

def band_vec(x, sr):
    mono = x.mean(axis=0) if x.ndim == 2 else x
    s = np.abs(np.fft.rfft(mono, 1 << 15)); f = np.fft.rfftfreq(1 << 15, 1 / sr)
    edges = np.geomspace(60, 16000, 33)
    v = np.log(np.array([s[(f >= a) & (f < b)].sum() for a, b in zip(edges[:-1], edges[1:])]) + 1e-9)
    return (v - v.mean()) / (v.std() + 1e-9)

def check(sound, m):
    t = TIERS[sound.tier]; errs = []
    if 'lufs' in t:
        if abs(m['lufs'] - t['lufs']) > t['tol']: errs.append(f"响度 {m['lufs']} 偏离 {t['lufs']}±{t['tol']}")
        if m['peak'] > t['peak_max']: errs.append(f"峰值 {m['peak']} 超过 {t['peak_max']}")
    elif abs(m['peak'] - t['peak']) > t['tol']:
        errs.append(f"峰值 {m['peak']} 偏离 {t['peak']}±{t['tol']}")
    if sound.key in CORE:
        if m['small_loss'] > 3: errs.append(f"小喇叭损失 {m['small_loss']}dB > 3")
        if m['low200'] > .5: errs.append(f"200Hz 以下占比 {m['low200']} > 0.5")
    if sound.tier in ('impact-heavy', 'impact-light', 'cast', 'warning', 'stinger') and m['small_loss'] > 4:
        errs.append(f"小喇叭损失 {m['small_loss']}dB > 4（低频过多，笔记本/手机听不到）")
    if sound.tier == 'ambience' and m['small_loss'] > 6: errs.append(f"小喇叭损失 {m['small_loss']}dB > 6")
    if (sound.key in FREQUENT or sound.key.startswith(('foley/step-','cue/pickup-')) or sound.stage=='hurt') and m['harsh'] > .45: errs.append(f"2–5kHz 占比 {m['harsh']} > 0.45（易疲劳）")
    if sound.stage != 'loop' and m['dur'] > 3: errs.append(f"时长 {m['dur']}s > 3")
    if sound.tier!='ambience' and not sound.key.startswith('boss/') and sound.tier!='stinger' and m['low200']>.3:
        errs.append(f"低频预算 {m['low200']} > 0.3")
    if sound.key.startswith('ui/') and m['dur']>(1 if any(k in sound.key for k in ['popup','notification','reward','rating','badge','salvage']) else .35):
        errs.append(f"界面时长 {m['dur']} 超出规格")
    return errs

def rel(p: Path) -> str:
    return '/' + p.relative_to(ROOT / 'apps/web/public').as_posix()

def file_of(sound, v):
    return PUBLIC / f'{sound.key}__{sound.stage}__v{v + 1:02d}.wav'

def read_wav(p: Path):
    with wave.open(str(p)) as w:
        sr, ch = w.getframerate(), w.getnchannels(); a = np.frombuffer(w.readframes(w.getnframes()), '<i2') / 32767
    return (a.reshape(-1, 2).T if ch == 2 else a), sr

def main():
    if '--register-transcodes' in sys.argv:
        manifest={}
        for sound in SOUNDS:
            wav=[file_of(sound,v) for v in range(sound.variants)]
            formats={ext:[rel(p.with_suffix('.'+suffix)) for p in wav] for ext,suffix in [('opus','opus'),('aac','m4a')] if all(p.with_suffix('.'+suffix).exists() for p in wav)}
            manifest.setdefault(sound.key,{})[sound.stage]=dict(files=[rel(p) for p in wav],formats=formats,tier=sound.tier,wired=sound.wired,source=getattr(sound,'source','synth-placeholder' if sound.key.startswith('voice/') else 'synth'),license=getattr(sound,'license','项目自制程序合成；无第三方录音'),note=sound.note)
        attach_ogg(manifest)
        MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
        return
    only = next((a.split('=', 1)[1] if '=' in a else sys.argv[sys.argv.index(a) + 1] for a in sys.argv if a.startswith('--only')), None)
    check_only = '--check' in sys.argv
    sounds = [s for s in SOUNDS if not only or s.key in only.split(',')]
    rows, failures, vecs, manifest = [], [], {}, {}
    if MANIFEST.exists() and only: manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    for s in sounds:
        files = []
        for v in range(s.variants):
            p = file_of(s, v)
            if check_only:
                x, sr = read_wav(p)
            else:
                x = s.fn(seed_of(s.key, s.stage, v), v); sr = s.sr
                t = TIERS[s.tier]
                if 'lufs' in t:
                    x = x * db(t['lufs'] - loudness(x, sr))
                else:
                    x = normalize_peak(x, t['peak'])
                write_wav(p, x, sr)
                x, sr = read_wav(p)
            m = metrics(x, sr); m['bytes'] = p.stat().st_size; errs = check(s, m)
            if s.tier=='ambience' and s.stage=='loop':
                seam=20*math.log10(float(np.max(np.abs(x[...,0]-x[...,-1])))+1e-12)
                m['seam']=round(seam,1)
                if m['dur']<24: errs.append('环境循环不足24秒')
                if seam>=-40: errs.append(f'循环接缝 {seam:.1f}dBFS >= -40')
            rows.append((s, v, m, errs)); files.append(rel(p)); vecs.setdefault((s.key, s.stage), []).append((band_vec(x, sr), x))
            failures += [f'{s.key}/{s.stage} v{v + 1}: {e}' for e in errs]
        manifest.setdefault(s.key, {})[s.stage] = {'files': files, 'tier': s.tier, 'wired': s.wired, 'source': getattr(s, 'source', 'synth-placeholder' if s.key.startswith('voice/') else 'synth'), 'license': getattr(s, 'license', '项目自制程序合成；无第三方录音'), 'note': s.note}
    failures += production_checks(rows, PUBLIC)
    # 轻重层级：冲击响度 暴击 > 命中 ≥3dB；预警最响
    pm = {}
    for s_, v, m, e in rows: pm.setdefault(s_.key + '/' + s_.stage, []).append(m['punch'])
    avg = {k: sum(v) / len(v) for k, v in pm.items()}
    for hi, lo, gap in [('cue/crit/one', 'cue/hit/one', 3), ('cue/danger/one', 'cue/crit/one', 0), ('player/cut/impact', 'cue/hit/one', 2)]:
        if hi in avg and lo in avg and avg[hi] - avg[lo] < gap:
            failures.append(f'层级：{hi} 冲击响度 {avg[hi]:.1f} 未比 {lo} {avg[lo]:.1f} 高 {gap}dB')
    # 变体：同族相似（频谱相关 ≥0.8）但波形不重复（互相关 <0.9）
    for (k, st), vs in vecs.items():
        for i in range(len(vs)):
            for j in range(i + 1, len(vs)):
                c = float(np.dot(vs[i][0], vs[j][0]) / len(vs[i][0]))
                if c < .8: failures.append(f'{k}/{st} v{i + 1}~v{j + 1}: 变体音色差太大（频谱相关 {c:.2f} < 0.8）')
                a, b = vs[i][1], vs[j][1]
                if a.ndim == 1 and b.ndim == 1:
                    n = min(len(a), len(b)); xc = float(np.max(np.abs(np.fft.irfft(np.fft.rfft(a[:n], 2 * n) * np.conj(np.fft.rfft(b[:n], 2 * n)))))) / (np.linalg.norm(a[:n]) * np.linalg.norm(b[:n]) + 1e-12)
                    if xc > .9: failures.append(f'{k}/{st} v{i + 1}~v{j + 1}: 变体几乎相同（互相关 {xc:.2f} > 0.9）')
    # 不同声音之间：同阶段不得出现孪生音（频谱相关 >0.95）
    keys = list(vecs)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            if keys[i][1] != keys[j][1] or keys[i][0].split('/')[0] != keys[j][0].split('/')[0]: continue
            c = float(np.dot(vecs[keys[i]][0][0], vecs[keys[j]][0][0]) / 32)
            if c > .95: failures.append(f'{keys[i][0]} 与 {keys[j][0]}（{keys[i][1]}）听感过近：频谱相关 {c:.2f}')
    warnings=[k for k in vecs if k[1]=='warning' and k[0].startswith('voice/')]
    for i,k in enumerate(warnings):
        for other in warnings[i+1:]:
            c=float(np.dot(vecs[k][0][0],vecs[other][0][0])/32)
            if c>.9: failures.append(f'首领预警辨识度 {k[0]}/{other[0]}: {c:.2f} > 0.9')
        from recipes.skills import CATALOG
        body=next((b for b in CATALOG['bodies'] if 'voice/'+b['id']==k[0]),None)
        if body:
            for skill in body['skills']:
                for prefix in ['boss/','monster/']:
                    target=(prefix+skill,'impact')
                    if target in vecs:
                        c=float(np.dot(vecs[k][0][0],vecs[target][0][0])/32)
                        if c>.85: failures.append(f'预警/技能命中区别 {k[0]}/{target[0]}: {c:.2f} > 0.85')
        impact=(k[0],'hurt')
        if impact in vecs:
            c=float(np.dot(vecs[k][0][0],vecs[impact][0][0])/32)
            if c>.85: failures.append(f'预警/受击区别 {k[0]}: {c:.2f} > 0.85')
    print(f"{'key':28s} {'阶段':7s} v  峰值  冲击  <200  2-5k 小喇叭 时长   结果")
    for s, v, m, errs in rows:
        print(f"{s.key:28s} {s.stage:7s} {v + 1} {m['peak']:5.1f} {m['punch']:5.1f} {m['low200']:5.2f} {m['harsh']:5.2f} {m['small_loss']:5.1f} {m['dur']:6.2f}  {'OK' if not errs else '✗'}")
    if not check_only:
        attach_ogg(manifest)  # 运行时压缩版 .ogg，WAV 源保留
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        QA.mkdir(parents=True, exist_ok=True)
        (QA / 'metrics.json').write_text(json.dumps([dict(key=s.key, stage=s.stage, v=v + 1, **m, errors=e) for s, v, m, e in rows], ensure_ascii=False, indent=1), encoding='utf-8')
        # 试听合集（全部变体，48k 单声道；环境声取前 8 秒）
        parts, labels, t = [], [], 0.0
        for s, v, m, e in rows:
            x, sr = read_wav(file_of(s, v))
            if x.ndim == 2: x = x.mean(axis=0)
            if sr != SR: x = np.interp(np.arange(int(len(x) * SR / sr)) * sr / SR, np.arange(len(x)), x)
            if s.stage == 'loop': x = x[:8 * SR]
            labels.append(f'{t:7.2f}s  {s.key} [{s.stage}] v{v + 1}  {s.note if v == 0 else ""}'); parts += [x, silence(.5)]; t += (len(x)) / SR + .5
        write_wav(QA / 'benchmarks-reel.wav', np.concatenate(parts))
        (QA / 'benchmarks-reel.txt').write_text('\n'.join(labels) + '\n', encoding='utf-8')
    QA.mkdir(parents=True, exist_ok=True)
    summary = dict(recipes=len(sounds), files=len(rows), failures=failures, totalBytes=sum(p.stat().st_size for p in PUBLIC.rglob('*.wav')), worst={k:sorted([dict(key=s.key,stage=s.stage,v=v+1,value=m[k]) for s,v,m,e in rows],key=lambda r:r['value'],reverse=True)[:3] for k in ['small_loss','low200','harsh']})
    (QA / 'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=1)+'\n',encoding='utf-8')
    print('\n' + ('验收通过' if not failures else '验收未通过：\n  ' + '\n  '.join(failures)))
    sys.exit(1 if failures else 0)

if __name__ == '__main__':
    main()
