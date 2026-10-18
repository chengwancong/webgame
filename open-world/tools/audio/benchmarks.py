"""音频标杆（2026-10-14）。每个类别一个参照配方，后续批量制作照此分层与响度档执行。

每个配方：fn(seed, v) -> 单声道/立体声数组；v 为变体序号，变体只改随机种子与 ±6% 的音高/层增益，不改设计。
层次命名：瞬态（transient）/ 主体（body）/ 质感（texture）/ 尾音（tail）/ 空间（space）。
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Callable
import math
import numpy as np
from dsp import *  # noqa: F401,F403

@dataclass
class Sound:
    key: str
    stage: str        # cast/release/impact/loop/tick/end/warning/one
    tier: str         # 响度档，见 TIERS
    variants: int
    fn: Callable[[int, int], np.ndarray]
    note: str         # 设计意图（交接与描述用）
    wired: bool = True  # 是否已有游戏触发点
    sr: int = SR

# 响度档：峰值目标 dBFS（±容差）；环境声用近似 LUFS
TIERS = {
    'warning':      dict(peak=-4,  tol=1.0),
    'stinger':      dict(peak=-4,  tol=1.5),
    'impact-heavy': dict(peak=-6,  tol=1.5),
    'impact-light': dict(peak=-10, tol=1.5),
    'cast':         dict(peak=-12, tol=2.0),
    'ui':           dict(peak=-15, tol=2.0),
    'foley':        dict(peak=-18, tol=2.0),
    'ambience':     dict(lufs=-26, tol=2.0, peak_max=-10),
}

def jitter(seed: int, amount: float = .06) -> float:
    return 1 + rng(seed * 7919 + 13).uniform(-amount, amount)

def gj(seed: int, layer: int, amount: float = 1.5) -> float:
    return rng(seed * 104729 + layer).uniform(-amount, amount)

# ---------------- 战斗反馈 ----------------

def hit(seed, v):
    p = jitter(seed, .1); r = rng(seed)
    trans = bandpass(noise(.006, seed), r.uniform(2600, 3800), 1.0) * env_ad(.006, .0005, 4)
    bd, f0 = ((.07, 300), (.10, 360), (.11, 330), (.08, 390))[v % 4]  # 变体按序错开时长与起始音高，避免随机抽到相近值
    body = osc(sweep(f0 * p, r.uniform(150, 200) * p, bd), bd) * env_ad(bd, .001, r.uniform(4, 6))
    body2 = osc(sweep(660 * p, 350 * p, .06), .06) * env_ad(.06, .001, 6)
    thud = lowpass(noise(.05, seed + 1), r.uniform(1100, 1800)) * env_ad(.05, .001, 5)
    flesh = bandpass(noise(.07, seed + 2), r.uniform(700, 1050), 1.5) * env_ad(.07, .002, 5)
    x = mix((trans, r.uniform(0, .003), -6 + gj(seed, 1)), (body, r.uniform(0, .002), 0), (body2, 0, -9 + gj(seed, 4, 3)), (thud, 0, -2 + gj(seed, 2)), (flesh, r.uniform(0, .006), -4 + gj(seed, 3)))
    return trim(x)

def crit(seed, v):
    p = jitter(seed)
    base = hit(seed, v % 3 + 1)  # 取较长的三个命中骨架，暴击变体间音色保持一致
    body = osc(sweep(270 * p, 125 * p, .14), .14) * env_ad(.14, .001, 4.5)
    ring = modal([(2250 * p, 1, .22), (3480 * p, .6, .16), (5120 * p, .35, .10)], .3, seed, .01)
    slice_ = highpass(noise(.03, seed + 5), 2500) * env_ad(.03, .0005, 5)
    x = mix((base, 0, 0), (body, 0, 0), (ring, .004, -10 + gj(seed, 1)), (slice_, 0, -6))
    return trim(room(x, .35, .18, seed))

def kill(seed, v):
    p = jitter(seed, .04)
    pop = osc(sweep(440 * p, 230 * p, .07), .07) * env_ad(.07, .001, 5)
    puff = bandpass(noise(.09, seed), 1500, 1.2) * env_ad(.09, .004, 4)
    sp1 = fm(1320 * p, 2.0, np.linspace(1.2, 0, int(.26 * SR)), .26) * env_ad(.26, .003, 5)
    sp2 = fm(1760 * p, 2.0, np.linspace(1.0, 0, int(.22 * SR)), .22) * env_ad(.22, .003, 5)
    x = mix((pop, 0, 0), (puff, 0, -6 + gj(seed, 1)), (sp1, .03, -14), (sp2, .07, -16))
    return trim(x)

def danger(seed, v):
    def blip(f, d):
        tone = osc(sweep(f, f * 1.12, d), d, 'saw')
        return lowpass(tone, 2600) * env_ad(d, .004, 3.5)
    low = osc(sweep(190, 150, .16), .16) * env_ad(.16, .002, 4)
    x = mix((blip(520, .2), 0, 0), (blip(780, .22), .13, -1), (low, 0, -8))
    return trim(room(x, .3, .12, seed))

def shield_break(seed, v):
    r = rng(seed)
    parts = [(r.uniform(1500, 7200), r.uniform(.3, 1), r.uniform(.05, .22)) for _ in range(14)]
    glass = modal(parts, .35, seed)
    shards = crackle(.28, 260, seed + 1, 5200) * env_ad(.28, .002, 4)
    collapse = osc(sweep(900, 260, .3), .3, 'tri') * env_ad(.3, .002, 3.5)
    trans = highpass(noise(.01, seed + 2), 3000) * env_ad(.01, .0005, 4)
    x = mix((trans, 0, -4), (glass, 0, -3), (shards, .01, -6 + gj(seed, 1)), (collapse, 0, -9))
    return trim(room(x, .5, .2, seed))

def loot(seed, v):
    p = jitter(seed, .05)
    thunk = modal([(420 * p, 1, .05), (1130 * p, .5, .04), (2050 * p, .25, .025)], .1, seed)
    chime = fm(1046 * p, 3.0, np.linspace(.8, 0, int(.3 * SR)), .3) * env_ad(.3, .002, 5)
    x = mix((thunk, 0, 0), (chime, .035, -9 + gj(seed, 1)))
    return trim(x)

def loot_legendary(seed, v):
    notes = [784, 988, 1175, 1568, 1976]
    bells = [(fm(f, 3.5, np.linspace(1.5, .1, int(1.1 * SR)), 1.1) * env_ad(1.1, .003, 4.5), i * .07, -6 - i) for i, f in enumerate(notes)]
    swell = highpass(noise(.6, seed), 4500) * np.linspace(0, 1, int(.6 * SR)) ** 2
    low = osc(220, .8) * env_ad(.8, .01, 4)
    x = mix(*bells, (fade(swell, .01, .05), 0, -18), (low, 0, -14))
    return trim(room(x, 1.1, .3, seed))

# ---------------- 技能（钢铁 / 火 / 冰） ----------------

def sword_whoosh(seed, v):
    p = jitter(seed); d = .2
    t = t_axis(d); cut = 700 * p + 2900 * p * np.sin(np.pi * t / d) ** 1.5
    w = svf(noise(d, seed, 'pink') * 3, cut, 1.6, 'bp') * np.sin(np.pi * t / d) ** 2
    air = highpass(noise(d, seed + 1), 5000) * np.sin(np.pi * t / d) ** 4
    return trim(mix((w, 0, 0), (air, 0, -12 + gj(seed, 1))))

def sword_impact(seed, v):
    p = jitter(seed)
    trans = highpass(noise(.008, seed), 2500) * env_ad(.008, .0005, 4)
    ring = modal([(1900 * p, 1, .14), (3150 * p, .55, .1), (4620 * p, .3, .07)], .2, seed, .008)
    body = osc(sweep(300 * p, 150 * p, .1), .1) * env_ad(.1, .001, 5)
    slice_ = bandpass(noise(.04, seed + 1), 2200, 1.0) * env_ad(.04, .001, 4)
    x = mix((trans, 0, -4), (body, 0, 0), (slice_, 0, -6 + gj(seed, 1)), (ring, .003, -13 + gj(seed, 2)))
    return trim(room(x, .25, .1, seed))

def fire_cast(seed, v):
    p = jitter(seed); d = .32; t = t_axis(d)
    roar = highpass(svf(noise(d, seed, 'pink') * 3, 500 + 2600 * (t / d) ** 1.4, .9, 'lp'), 260) * env_ad(d, .12, 3)
    sizzle = crackle(d, 110, seed + 1, 3800) * np.linspace(.2, 1, len(t))
    tone = osc(sweep(300 * p, 460 * p, d), d) * env_ad(d, .1, 3)
    return trim(mix((roar, 0, 0), (sizzle, 0, -8 + gj(seed, 1)), (tone, 0, -16)))

def fire_impact(seed, v):
    p = jitter(seed); d = .55; t = t_axis(d)
    blast = highpass(svf(noise(d, seed, 'pink') * 3, 3600 * np.exp(-5 * t / d) + 700, .7, 'lp'), 240) * env_ad(d, .003, 4.5)
    mid = bandpass(noise(.25, seed + 1), 780 * p, 1.0) * env_ad(.25, .002, 4)
    crack = bandpass(noise(.02, seed + 3), 1700 * p, 1.2) * env_ad(.02, .0005, 4)
    boom = osc(sweep(170 * p, 85 * p, .25), .25) * env_ad(.25, .002, 5)
    tail = crackle(.7, 160, seed + 2, 3000) * env_ad(.7, .05, 3.5)
    x = mix((blast, 0, 0), (mid, 0, -1 + gj(seed, 1)), (crack, 0, -4), (boom, 0, -15), (tail, .05, -8 + gj(seed, 2)))
    return trim(room(x, .6, .18, seed))

def ice_cast(seed, v):
    p = jitter(seed, .04); d = .3
    shim = mix(*[(fm(f * p, 1.41, np.linspace(.2, 1.2, int(d * SR)), d) * env_ad(d, .15, 2.5), i * .03, -4 * i)
                 for i, f in enumerate([1570, 2090, 2490])])
    air = highpass(noise(d, seed), 5200) * np.linspace(0, 1, int(d * SR)) ** 2
    return trim(mix((shim, 0, 0), (fade(air, .01, .03), 0, -10 + gj(seed, 1))))

def ice_impact(seed, v):
    p = jitter(seed)
    trans = highpass(noise(.006, seed), 3500) * env_ad(.006, .0004, 4)
    glass = modal([(1320 * p, 1, .32), (2470 * p, .8, .26), (3910 * p, .55, .2), (5630 * p, .35, .12)], .4, seed, .012)
    crack = crackle(.12, 400, seed + 1, 4800) * env_ad(.12, .001, 4)
    thud = osc(sweep(320 * p, 200 * p, .07), .07) * env_ad(.07, .001, 5)
    x = mix((trans, 0, -3), (thud, 0, -4), (crack, 0, -5 + gj(seed, 1)), (glass, .002, -6 + gj(seed, 2)))
    return trim(room(x, .45, .15, seed))

# ---------------- 怪物：暮界人形死亡（侵蚀感参照） ----------------

def dusk_death(seed, v):
    p = jitter(seed, .05); d = .7; t = t_axis(d)
    rev = (highpass(noise(.25, seed), 1200) * np.linspace(0, 1, int(.25 * SR)) ** 3)
    exhale = svf(noise(d, seed + 1, 'pink') * 3, 1600 * np.exp(-2.2 * t / d) + 380, 2.5, 'bp') * env_ad(d, .02, 3)
    dark1 = highpass(lowpass(osc(sweep(165 * p, 82 * p, d), d, 'saw'), 1200), 140) * env_ad(d, .02, 3)
    dark2 = highpass(lowpass(osc(sweep(168.5 * p, 84 * p, d), d, 'saw'), 1200), 140) * env_ad(d, .02, 3)
    form = bandpass(noise(d, seed + 2), 560 * p, 4) * env_ad(d, .03, 3.5)
    x = mix((rev, 0, -8), (exhale, .22, 0 + gj(seed, 1)), (dark1, .22, -8), (dark2, .22, -8), (form, .22, -4))
    return trim(room(x, .8, .25, seed, bright=3500))

# ---------------- 脚步 ----------------

def step_stone(seed, v):
    p = jitter(seed, .08)
    heel = highpass(noise(.01, seed), 1500) * env_ad(.01, .0005, 4)
    thump = bandpass(noise(.04, seed + 1), 360 * p, 1.0) * env_ad(.04, .001, 5)
    grit = crackle(.06, 700, seed + 2, 4200) * env_ad(.06, .003, 4)
    return trim(mix((heel, 0, -3 + gj(seed, 1)), (thump, 0, 0), (grit, .004, -8 + gj(seed, 2))))

def step_wood(seed, v):
    p = jitter(seed, .12); r = rng(seed)
    res = modal([(430 * p * r.uniform(.92, 1.08), 1, r.uniform(.06, .1)), (990 * p * r.uniform(.92, 1.08), r.uniform(.4, .8), .06), (1660 * p, r.uniform(.2, .5), .04)], .12, seed, .02)
    thump = bandpass(noise(.04, seed + 1), 520 * p, 1.0) * env_ad(.04, .001, 5)
    heel = highpass(noise(.008, seed + 2), 1800) * env_ad(.008, .0005, 4)
    return trim(mix((heel, 0, -5), (thump, 0, -2 + gj(seed, 1)), (res, .002, -4 + gj(seed, 2))))

# ---------------- 界面 ----------------

def ui_click(seed, v):
    p = jitter(seed, .03)
    tick = modal([(1150 * p, 1, .03), (2300 * p, .35, .02), (3400 * p, .15, .012)], .05, seed)
    n = bandpass(noise(.002, seed), 1800, 1.0)
    return trim(mix((tick, 0, 0), (n, 0, -12)))

def ui_panel(seed, v, opening=True):
    d = .14; t = t_axis(d)
    if opening:
        slide = svf(noise(d, seed, 'pink') * 3, 600 * (2000 / 600) ** (t / d), 1.2, 'bp') * np.sin(np.pi * t / d) ** 1.5
        chime = mix(*[(osc(f, .25) * env_ad(.25, .004, 5), .05 + i * .04, -10 - 2 * i) for i, f in enumerate([880, 1320])])
        return trim(mix((slide, 0, 0), (chime, 0, 0)))
    slide = svf(noise(d, seed, 'pink') * 3, 1400 * (450 / 1400) ** (t / d), 1.0, 'bp') * np.sin(np.pi * t / d) ** 1.5
    thock = modal([(620, 1, .05), (1380, .4, .03)], .08, seed)
    return trim(mix((slide, 0, 0), (thock, .1, -3)))

def ui_error(seed, v):
    def tone(f):
        return lowpass(osc(sweep(f, f * .92, .08), .08, 'tri'), 1800) * env_ad(.08, .003, 4)
    return trim(mix((tone(330), 0, 0), (tone(300), .12, -1)))

def ui_equip_metal(seed, v):
    p = jitter(seed, .04)
    clink = modal([(1210 * p, 1, .16), (2730 * p, .6, .12), (4310 * p, .3, .08)], .22, seed, .01)
    cloth = bandpass(noise(.12, seed + 1), 2100, .8) * env_ad(.12, .02, 3)
    return trim(mix((cloth, 0, -8), (clink, .03, 0)))

# ---------------- 环境：风栖岛（草坡风 + 远海） ----------------

AMB_SR = 32000

def amb_wind(seed, v):
    sr = AMB_SR; d = 26.0; xf = 2.0; n = int(d * sr); t = np.arange(n) / sr
    r = rng(seed)
    def gust(s):
        rr = rng(s); g = sum(rr.uniform(.4, 1) * np.sin(2 * np.pi * rr.uniform(.03, .17) * t + rr.uniform(0, 6.3)) for _ in range(4))
        return .55 + .45 * (g / 4)
    chans = []
    for c in range(2):
        g = np.clip(gust(seed + 10 * c), .1, 1)
        bed = fft_filter(noise(d, seed + c, 'pink', sr), bp_resp(620, .6), sr) * g
        whistle = sum(fft_filter(noise(d, seed + 20 + 3 * c + k, 'white', sr), bp_resp(f, 9), sr) * w
                      for k, (f, w) in enumerate([(880, 1), (1180, .7), (1460, .45)]))
        whistle *= np.clip(g - .55, 0, None) ** 1.5 * 2.2
        rustle = fft_filter(noise(d, seed + 40 + c, 'white', sr), hp_resp(3200, 2), sr) * np.clip(g - .45, 0, None) ** 2 * 1.6
        swell = .6 + .4 * np.sin(2 * np.pi * (.09 + .01 * c) * t + c) ** 2
        sea = fft_filter(noise(d, seed + 60 + c, 'pink', sr), bp_resp(380, .8), sr) * swell
        chans.append(bed * db(0) + whistle * db(-14) + rustle * db(-14) + sea * db(-8))
    x = fft_filter(np.stack(chans), hp_resp(120, 2), sr)
    x = soft_clip(x / (np.max(np.abs(x)) + 1e-12) * 1.6, 1.0)  # 削去偶发尖峰，保证峰值余量
    x = loop_crossfade(x, xf, sr)
    return x

# ---------------- 提示音乐：升级 ----------------

def stinger_levelup(seed, v):
    notes = [587.3, 740.0, 880.0, 1174.7]  # D5 F#5 A5 D6
    harp = [(pluck(f, 1.6, seed + i, .7), i * .07, -3 - i * .5) for i, f in enumerate(notes)]
    bell = [(fm(f, 3.5, np.linspace(1.4, .1, int(1.8 * SR)), 1.8) * env_ad(1.8, .01, 4), .3, -10 - i * 2) for i, f in enumerate([1174.7, 1760.0])]
    shimmer = highpass(noise(1.0, seed), 6000) * np.linspace(0, 1, int(1.0 * SR)) ** 2 * env_ad(1.0, .7, 2)
    pad = lowpass(osc(293.7, 1.8, 'saw'), 1200) * env_ad(1.8, .25, 3)
    x = mix(*harp, *bell, (shimmer, .05, -20), (pad, .2, -18))
    return trim(room(x, 1.4, .35, seed))

SOUNDS: list[Sound] = [
    Sound('cue/hit', 'one', 'impact-light', 4, hit, '命中：2.6–3.8kHz 瞬态 + 300–390→150–200Hz 主体（按变体错开）+ 700–1050Hz 肉感噪声；柔和、可长时间重复'),
    Sound('cue/crit', 'one', 'impact-heavy', 3, crit, '暴击：命中 + 更低更长主体 + 2.2/3.5/5.1kHz 金属"叮" + 短混响'),
    Sound('cue/kill', 'one', 'impact-light', 3, kill, '击杀：轻快"啵" + 1.3/1.76kHz 小闪光；挂机时不吵'),
    Sound('cue/danger', 'one', 'warning', 1, danger, '危险预警：520→780Hz 两声上扬、锯齿低通 2.6kHz；手机喇叭可辨'),
    Sound('cue/shield-break', 'one', 'impact-heavy', 2, shield_break, '护盾破碎：14 个玻璃模态 + 碎屑 + 900→260Hz 能量坍缩'),
    Sound('cue/loot', 'one', 'impact-light', 2, loot, '普通掉落：木/金属轻磕 + 1kHz FM 小铃'),
    Sound('cue/loot-legendary', 'one', 'stinger', 1, loot_legendary, '最高品质掉落：五音 FM 钟琴琶音 + 高频上扬', wired=False),
    Sound('player/cut', 'cast', 'cast', 3, sword_whoosh, '剑挥舞：粉噪声带通 700→3600→700Hz 扫频 + 高频空气'),
    Sound('player/cut', 'impact', 'impact-heavy', 3, sword_impact, '剑命中：瞬态 + 钝击主体 + 2.2kHz 切割 + 1.9/3.2/4.6kHz 刃鸣（轻）'),
    Sound('player/fireball', 'cast', 'cast', 2, fire_cast, '火起手：低通扫频 300→2700Hz 的"呼" + 噼啪渐强'),
    Sound('player/fireball', 'impact', 'impact-heavy', 3, fire_impact, '火命中：低通爆裂 + 750Hz 中频（保证小喇叭能听到）+ 130→62Hz 轰 + 噼啪尾'),
    Sound('player/frost_bolt', 'cast', 'cast', 2, ice_cast, '冰起手：2.1/2.8/3.3kHz FM 晶体渐亮 + 高频气流'),
    Sound('player/frost_bolt', 'impact', 'impact-heavy', 3, ice_impact, '冰命中：瞬态 + 1.3/2.5/3.9/5.6kHz 玻璃模态 + 碎裂颗粒 + 轻钝击'),
    Sound('voice/dusk-humanoid', 'death', 'impact-light', 2, dusk_death, '暮界死亡：反向吸气 → 带通共振峰下滑的"呼出" + 双锯齿失谐低鸣（侵蚀感）', wired=False),
    Sound('foley/step-stone', 'one', 'foley', 5, step_stone, '石板脚步：鞋跟瞬态 + 360Hz 闷响 + 砂砾颗粒', wired=False),
    Sound('foley/step-wood', 'one', 'foley', 5, step_wood, '木甲板脚步：430/990/1660Hz 木模态 + 520Hz 闷响', wired=False),
    Sound('ui/click', 'one', 'ui', 2, ui_click, '按钮：2.4/4.1kHz 短模态"嗒"', wired=False),
    Sound('ui/panel-open', 'one', 'ui', 1, lambda s, v: ui_panel(s, v, True), '面板打开：600→2000Hz 滑动 + 880/1320Hz 上行轻铃', wired=False),
    Sound('ui/panel-close', 'one', 'ui', 1, lambda s, v: ui_panel(s, v, False), '面板关闭：2000→600Hz 滑动 + 990/660Hz 下行轻铃', wired=False),
    Sound('ui/error', 'one', 'ui', 1, ui_error, '错误：两声 330/300Hz 柔和三角波，不刺耳', wired=False),
    Sound('ui/equip-metal', 'one', 'ui', 2, ui_equip_metal, '穿戴金属装备：布料摩擦 + 1.2/2.7/4.3kHz 金属磕碰', wired=False),
    Sound('amb/wind', 'loop', 'ambience', 1, amb_wind, '风栖岛底噪：620Hz 风床（阵风调制）+ 阵风哨音 + 草叶沙沙 + 远海涌浪；24 秒无缝立体声', wired=False, sr=AMB_SR),
    Sound('stinger/level-up', 'one', 'stinger', 1, stinger_levelup, '升级：D 大调竖琴琶音 + FM 钟 + 高频光晕 + 1.4 秒厅堂混响', wired=False),
]
