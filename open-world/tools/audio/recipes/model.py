"""注册元数据与公共配方；标杆函数不改动。"""
from dataclasses import dataclass
from benchmarks import Sound
@dataclass
class ProductionSound(Sound):
    source: str = 'synth'
    license: str = '项目自制程序合成；无第三方录音'
    weight: str = ''
    category: str = ''
