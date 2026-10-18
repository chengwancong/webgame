"""11种元素的身体/质感/尾部；参数来自元素和技能语义。"""
from dsp import *
from benchmarks import jitter

def steel(s,v,d,f): return modal([(f*3,1,d*.65),(f*5.1,.5,d*.4),(f*7.7,.2,d*.25)],d,s,.012)
def fire(s,v,d,f): return mix((highpass(noise(d,s,'pink'),250)*env_ad(d,.004,3),0,0),(crackle(d,100,s+1,3500)*env_ad(d,.01,3),0,-12),(bandpass(noise(d,s+2),780,1)*env_ad(d,.003,4),0,-3))
def ice(s,v,d,f): return modal([(f*2.7,1,d),(f*4.2,.65,d*.7),(f*5.8,.3,d*.4)],d,s,.008)
def storm(s,v,d,f): return mix((crackle(d,240,s,2400)*env_ad(d,.002,4),0,0),(highpass(osc(120,d,'saw'),140)*env_ad(d,.003,4),0,-15),(osc(sweep(1900,700,d),d)*env_ad(d,.002,5),0,-8))
def nature(s,v,d,f): return mix((modal([(f,1,d*.7),(f*2.3,.5,d*.4),(f*3.8,.2,d*.2)],d,s,.02),0,0),(bandpass(noise(d,s+1),2800,2)*env_ad(d,.02,4),0,-12))
def arcane(s,v,d,f): return mix((fm(f,1.41,np.linspace(1.3,.1,len(t_axis(d))),d)*env_ad(d,.01,3),0,0),(fm(f*1.015,2.76,np.linspace(.8,0,len(t_axis(d))),d)*env_ad(d,.02,4),0,-8))
def shadow(s,v,d,f): return mix((highpass(osc(sweep(f,f*.7,d),d,'saw'),160)*env_ad(d,.03,3),0,0),(bandpass(noise(d,s),650,3)*env_ad(d,.04,3),0,-5),(highpass(noise(d,s+1),1200)*env_ad(d,.01,5)[::-1],0,-14))
def earth(s,v,d,f): return mix((highpass(osc(sweep(f,f*.65,d),d,'tri'),150)*env_ad(d,.002,5),0,0),(crackle(d,180,s,1200)*env_ad(d,.003,4),0,-7))
def holy(s,v,d,f): return sum(osc(f*r,d)*env_ad(d,.02,3)/(i+1) for i,r in enumerate([1,1.5,2,3]))
def blood(s,v,d,f): return bandpass(noise(d,s),850,1.6)*env_ad(d,.002,4)*(.7+.3*np.sin(t_axis(d)*2*np.pi*37))
def poison(s,v,d,f): return mix(*[(osc(sweep(f*(1+i*.17),f*(1.6+i*.17),.05),.05)*env_ad(.05,.003,4),i*d/5,-i*2) for i in range(5)],(highpass(noise(d,s),2200)*env_ad(d,.02,4),0,-14))
ELEMENTS={f.__name__:f for f in [steel,fire,ice,storm,nature,arcane,shadow,earth,holy,blood,poison]}
