"""Export only deterministic timing from the numeric-flow owner, without MC."""
import json, os, runpy, hashlib
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
owner = runpy.run_path(os.path.join(root, 'tools', 'numeric-flow-sim.py'))
stages = owner['build_stages']()
target = os.path.join(root, 'assets', 'numerics', 'world-stage-timing.json')
os.makedirs(os.path.dirname(target), exist_ok=True)
data = {'source': 'tools/numeric-flow-sim.py',
        'sourceSha256': hashlib.sha256(open(os.path.join(root, 'tools', 'numeric-flow-sim.py'), 'rb').read()).hexdigest(),
        'units': 'minutes', 'timeline': [{'level': level, 'minutes': minutes} for level, minutes in owner['H'].items()],
        'stages': [{key: stage[key] for key in ['index', 'group', 'slot', 'start', 'explore', 'push', 'farm', 'clear', 'end', 'level']} for stage in stages]}
with open(target, 'w', encoding='utf-8', newline='\n') as output:
    json.dump(data, output, ensure_ascii=False, indent=2)
    output.write('\n')
print(json.dumps({'stages': len(stages), 'output': target, 'monteCarloRun': False}))
