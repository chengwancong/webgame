"""12种形态的时序，不使用列表序号。"""
from dsp import *
def slash(x,s): return mix((x,0,0),(highpass(noise(.08,s),1900)*env_ad(.08,.03,4),0,-10))
def spin(x,s): return mix((x,0,0),(x,.065,-5),(x,.13,-9))
def dash(x,s): return mix((x,0,0),(bandpass(noise(.16,s),1200,1)*env_ad(.16,.08,4),0,-7))
def burst(x,s): return room(x,.18,.14,s)
def shield(x,s): return room(x,.3,.2,s)
def projectile(x,s): return mix((x,0,0),(highpass(noise(.05,s),3500)*env_ad(.05,.005,4),0,-12))
def zone(x,s): return mix((x,0,0),(x,.09,-8))
def chain(x,s): return mix((x,0,0),(x,.04,-6))
def heal(x,s): return room(x,.35,.18,s)
def summon(x,s): return mix((x[::-1],0,-12),(x,.12,0))
def mark(x,s): return room(x,.22,.1,s)
def beam(x,s): return mix((x,0,0),(x,.07,-4),(x,.14,-8))
FORMS={f.__name__:f for f in [slash,spin,dash,burst,shield,projectile,zone,chain,heal,summon,mark,beam]}
