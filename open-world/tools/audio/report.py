"""生成小型交付报告，不提交原始测量与试听合辑。"""
from pathlib import Path
from collections import Counter
import json,hashlib
ROOT=Path(__file__).resolve().parents[2]
def read(path,default=None):
    p=ROOT/path
    return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else default
bank=read('apps/web/src/audio/sample-manifest.json',{})
summary=read('.qa/audio-benchmarks/summary.json',{})
validation=read('.qa/audio-production/validation-result.json',read('.qa/audio-production/validation-before-full.json',{}))
rows=[(key,stage,e) for key,stages in bank.items() for stage,e in stages.items()]
files=list((ROOT/'apps/web/public/audio').rglob('*.wav'))
counts=Counter(key.split('/')[0] for key,stage,e in rows)
failures=summary.get('failures',[])
classes=Counter('跨key频谱相关' if '听感过近' in f else '变体差异' if '变体' in f else '首领预警' if '预警' in f else '响度/时长/其他' for f in failures)
out=['# 音频制作验收报告','', '最终状态（2026-10-15）：硬阻塞，未满足交接完成定义。A0–A10的可执行制作与验证已运行；被动转换事件缺口、素材残差及未覆盖项保留，不能标记全项完成。','',
'## 产物','', '| 类别 | key数 | key/阶段组 | 文件数 | wired组 |','|---|---:|---:|---:|---:|']
for prefix in counts:
    selected=[(k,st,e) for k,st,e in rows if k.startswith(prefix+'/')]
    out.append(f"| {prefix} | {len(set(k for k,st,e in selected))} | {len(selected)} | {sum(len(e['files']) for k,st,e in selected)} | {sum(e['wired'] for k,st,e in selected)} |")
out+=['',f'实际WAV文件 {len(files)} 个，合计 {sum(p.stat().st_size for p in files)} 字节。高于80MB；已依裁决将新环境降至24kHz、非高频变体降至2，高频保留至少3。原标杆不降低变体数。可选 `node tools/audio/transcode.mjs`，本期未运行转码。',
'', '## 客观验收','',f'最后一次检查共有 {len(failures)} 项残差。分类：'+ '；'.join(f'{k} {n}' for k,n in classes.items())+'。',
'三版渲染残差依次为3835、917、819；最终检查增加规范覆盖后，以这里读取的当前检查结果为准。未放宽阈值，也未把未接入项标成wired。',
'', '| 检查 | 结果 |','|---|---|',
'| A0原始标杆 | 23组复跑通过，日志 .qa/audio-production/baseline-build.log |',
'| A1验收自检 | 4项通过 |',
'| 音频相关单测 | 8文件20项通过（新增状态信号2项独立验收）；当前所有229个特效键阶段有采样或明确兜底 |',
'| TypeScript | '+('通过' if validation.get('types')==0 else '早期通过；最终复验待结束')+' |',
'| 生产Vite构建 | '+('通过' if validation.get('productionBuild')==0 else '待结束或失败；见本地日志')+' |',
'| QA Vite构建 | '+('通过' if validation.get('qaBuild')==0 else '待结束或失败；见本地日志')+' |',
'| 全量vitest | '+('通过' if validation.get('fullTests')==0 else '未通过：1760通过、10失败、2个原有跳过；5个文件失败、243个文件通过。新增状态信号2项另行通过')+' |',
'', '最差三类单文件指标（每类前三）：','']
for metric,values in summary.get('worst',{}).items():out.append('- '+metric+'：'+'；'.join(f"{v['key']}/{v['stage']} v{v['v']} = {v['value']}" for v in values))
out+=['','残差示例（完整原始明细仅留本地）：','']+[f'- {f}' for f in failures[:18]]
out+=['','## 接入与未完成范围','',
'已实现五总线/五滑块/后台静音、当前技能预载、按需采样、保留合成兜底、真实掉落动画声音、公共按钮/面板、真实位移脚步、状态结束与跳伤、连携点缀、机制事件、怪物躯体/首领预警、环境流式与定点衰减。具体实现与复验命令见 runtime.md。',
'硬阻塞§7.1：被动移速转伤害没有实际生效事件；mechanism/speed保留素材但wired=false，见blocked.md。尚未完成：全库孪生音归零、所有层级/同组差通过、全部首领预警辨识度通过；部分界面/动作/状态专属触发尚无已确认公共入口，见 uncovered.md 和清单wired=false项。音乐与真实生物声为外采。',
'标杆来自既有交接；本次不宣称重新创作标杆。DSP修复采样取整不一致和循环端点2ms衔接，benchmarks.py配方与TIERS不变。',
'', '## 兜底电平','',
'8组离线近似测量：采样冲击响度比旧兜底中位高12.8dB；按交接一次调整synthGain 0.4→1.736。测量不含浏览器带限振荡和最终限幅器差异。工具 measure_fallback.py / export-fallback.ts，原始数字 .qa/audio-production/fallback-review.json。',
'', '## 试听与安全边界','',
'- 快速试听：`.qa/audio-production/quick-reel.wav`（47段/76.8秒），标签`quick-reel.txt`。',
'- 试听合集：`.qa/audio-benchmarks/benchmarks-reel.wav`。',
'- 时间标签：`.qa/audio-benchmarks/benchmarks-reel.txt`。',
'- QA入口：`audio-qa.html`，仅qa模式构建；每条显示采样/合成兜底/缺失、tier、source与接入状态。',
'- 全量测试使用自有临时数据库；无8612正式库访问、无8790登录/写调用、无无头浏览器。',
'- 未修改战斗模拟、服务端、伤害判定、scene.ts、combat-vfx.ts、shield-feedback.ts或物理技能特效文件。',
'- 不对听感作结论；由用户试听裁决。',
'', '## 恢复','',
'全部本期验证进程已退出，自有临时数据库已清理（剩余0字节）。先按blocked.md由模拟所有者提供实际转换事件，再恢复接入与验收。未提交：完成门槛未通过，且共享文件须仅暂存本期差量；没有提交或回退其他会话改动。']
(ROOT/'docs/reviews/audio-production-20261014/report.md').write_text('\n'.join(out)+'\n',encoding='utf-8')
print('报告已更新；严格残差',len(failures))
