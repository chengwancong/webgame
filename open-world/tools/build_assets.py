"""Rebuild the selected SP33 actors. Never restore retired Pockie monster art."""
from pathlib import Path
import json,subprocess,sys,shutil
ROOT=Path(__file__).resolve().parents[1]
def run(*args):subprocess.run(args,cwd=ROOT,check=True)
# Hero exporter retains its existing UI portrait pipeline.
hero=ROOT/'assets/actors/wushi/rendered'
actors=json.loads((ROOT/'assets/actors/monsters.json').read_text())['actors']
owned=[]
try:
 if not (hero/'render.json').exists():
  if hero.exists():raise RuntimeError('Incomplete pre-existing hero export; inspect before replacing')
  owned.append(hero);run('node','tools/export_sp33_actor.mjs')
 run(sys.executable,'tools/pack_sp33_actor.py')
 for key,actor in actors.items():
  folder=ROOT/actor['source']/'rendered'
  if folder.exists():raise RuntimeError(f'Intermediate folder already exists: {folder}; inspect before rebuilding')
  owned.append(folder);run('node','tools/export_sp33_actor.mjs',key)
 run(sys.executable,'tools/pack_sp33_monsters.py')
finally:
 size=sum(p.stat().st_size for folder in owned for p in folder.rglob('*') if p.is_file())
 for folder in owned:
  if folder.exists():shutil.rmtree(folder)
 print(json.dumps({'temporary_bytes_before':size,'temporary_bytes_after':0,'removed_bytes':size}))
