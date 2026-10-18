"""Archive character actions and UI/VFX animation data without installing it in the game.

Requires UnityPy==1.25.3. Native bundles retain compiled curves, shaders and custom
components even when a readable export is unavailable. No APK code is executed.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re

import UnityPy

module_spec = importlib.util.spec_from_file_location('apk_extract', Path(__file__).with_name('extract-apk-vfx.py'))
helpers = importlib.util.module_from_spec(module_spec)
module_spec.loader.exec_module(helpers)


def normalized(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else normalized(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [normalized(v) for v in value]
    if isinstance(value, bytes):
        return {'hex': value.hex()}
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(normalized(value), ensure_ascii=False, separators=(',', ':'), allow_nan=False), encoding='utf-8')


def category(row, name):
    location = (row.get('bundle') or '').lower()
    paths = ' '.join(c['path'].lower() for c in row.get('containers', []))
    if 'character_model_male' in location:
        return 'player-male'
    if 'character_model_female' in location:
        return 'player-female'
    if '_npc_' in location or '/npc/' in paths:
        return 'npc'
    if '_monster_' in location or '/monster/' in paths:
        return 'monster'
    if any(v in location for v in ['_ui_', '_animation_game', '_boot_']) or '/ui/' in paths or re.search(r'Panel|Dialog|Btn|Canvas|Tab|Menu|Bubble|Slider|Entry|Tooltip|Button', name):
        return 'ui'
    if '_home_' in location or '/home/' in paths:
        return 'environment'
    if '_character_' in location:
        return 'character-attachments'
    return 'other'


def duration(clip):
    # Runtime clips store sampled channel values inside m_Clip. Those values can
    # include fields called "time" that are not the animation's end time.
    muscle = clip.get('m_MuscleClip', {})
    if clip.get('m_MuscleClipSize', 0) and muscle.get('m_StopTime', 0) > 0:
        return muscle['m_StopTime'] - muscle.get('m_StartTime', 0)
    times = []
    def collect(value):
        if isinstance(value, dict):
            for k, v in value.items():
                if k in ['time', 'm_StopTime', 'm_Stop', 'm_EndTime'] and isinstance(v, (int, float)) and math.isfinite(v):
                    times.append(v)
                elif isinstance(v, (dict, list)):
                    collect(v)
        elif isinstance(value, list):
            for v in value:
                if isinstance(v, (dict, list)):
                    collect(v)
    for key in ['m_RotationCurves', 'm_EulerCurves', 'm_PositionCurves', 'm_ScaleCurves', 'm_FloatCurves', 'm_PPtrCurves', 'm_Events']:
        collect(clip.get(key, []))
    return max(times, default=0)


def export(inventory_file, output):
    inventory = json.loads(inventory_file.read_text(encoding='utf-8'))
    source = helpers.Source(inventory, output)
    rows = inventory['bundles']
    roots = [r for r in rows if any(r['types'].get(t) for t in ['ParticleSystem', 'AnimationClip', 'AnimatorController', 'AnimatorOverrideController', 'Animator', 'Animation'])]
    by_cab = source.cabs
    closure = {r['hash']: r for r in roots}
    unresolved = {}
    pending = list(roots)
    while pending:
        row = pending.pop()
        for asset in row['files']:
            for cab in asset['externals']:
                if cab in ['unity default resources', 'unity_builtin_extra', 'globalgamemanagers.assets']:
                    continue
                dependency = by_cab.get(cab)
                if dependency is None:
                    unresolved.setdefault(cab, set()).add(row['hash'])
                elif dependency['hash'] not in closure:
                    closure[dependency['hash']] = dependency
                    pending.append(dependency)

    native = []
    for row in closure.values():
        # Keep archive-relative paths, but explicitly reject traversal before writing.
        target = (output / 'native' / row['zip']).resolve()
        if not target.is_relative_to((output / 'native').resolve()):
            raise ValueError('Unsafe archive path: ' + row['zip'])
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = source.zip.read(row['zip'])
        target.write_bytes(raw)
        native.append({'hash': row['hash'], 'name': row['bundle'], 'file': target.relative_to(output.resolve()).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'role': 'motion-root' if row in roots else 'dependency'})
    for filename in source.zip.namelist():
        if ('PackageManifest_' in filename or filename in ['assets/bin/Data/data.unity3d', 'assets/bin/Data/unity default resources', 'assets/yoo/YooAssetBuildinManifest.bin']):
            target = output / 'native' / filename
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(source.zip.read(filename))

    structure_types = {'GameObject', 'Transform', 'RectTransform', 'ParticleSystem', 'ParticleSystemRenderer', 'Animator', 'Animation', 'SpriteRenderer', 'MeshRenderer', 'MeshFilter', 'TrailRenderer', 'LineRenderer', 'Canvas', 'CanvasGroup', 'SortingGroup', 'SpriteMask'}
    clips, controllers, structures, particles, failures = [], [], [], [], []
    for index, row in enumerate(roots):
        env = source.load(row)
        structure = {'bundle': row['hash'], 'name': row['bundle'], 'files': row['files'], 'objects': [], 'customComponentsPreservedInNativeBundle': row['types'].get('MonoBehaviour', 0)}
        # Container paths are hints only; internal clips frequently share their controller's path.
        paths = {str(c['pointer']['m_PathID']): c['path'] for c in row['containers'] if c['pointer']['m_FileID'] == 0}
        for obj in env.objects:
            kind = obj.type.name
            if kind not in structure_types | {'AnimationClip', 'AnimatorController', 'AnimatorOverrideController'}:
                continue
            uid = source.uid(obj)
            try:
                data = obj.read_typetree()
                if kind in ['AnimationClip', 'AnimatorController', 'AnimatorOverrideController']:
                    name = data.get('m_Name', '')
                    cat = category(row, name)
                    folder = 'clips' if kind == 'AnimationClip' else 'controllers'
                    file = f'motion/{folder}/{cat}/{uid}.json'
                    write_json(output / file, {'sourceBundle': row['hash'], 'sourceCab': obj.assets_file.name, 'sourceId': str(obj.path_id), 'data': data})
                    entry = {'id': uid, 'name': name, 'category': cat, 'file': file, 'type': kind, 'sourceBundle': row['hash'], 'sourceId': str(obj.path_id), 'assetPathHint': paths.get(str(obj.path_id))}
                    if kind == 'AnimationClip':
                        clip_data = data['m_MuscleClip'].get('m_Clip', {}).get('data', {})
                        bindings = data['m_ClipBindingConstant'].get('genericBindings', [])
                        scheduling = bool(data['m_MuscleClipSize'] and not clip_data.get('m_StreamedClip', {}).get('curveCount', 0) and not clip_data.get('m_DenseClip', {}).get('m_CurveCount', 0) and not any(b.get('typeID') != 1 for b in bindings))
                        entry.update({'sampleRate': data['m_SampleRate'], 'duration': duration(data), 'legacy': data['m_Legacy'], 'compiledCurveBytes': data['m_MuscleClipSize'], 'objectCurves': len(data['m_PPtrCurves']), 'spineSchedulingOnly': scheduling, 'status': 'native-data-extracted'})
                        clips.append(entry)
                    else:
                        controllers.append(entry)
                else:
                    structure['objects'].append({'id': str(obj.path_id), 'type': kind, 'data': data})
                    if kind == 'ParticleSystem':
                        particles.append({'id': uid, 'sourceBundle': row['hash'], 'sourceId': str(obj.path_id), 'gameObject': str(data['m_GameObject']['m_PathID']), 'seconds': data['lengthInSec'], 'looping': data['looping'], 'structure': f'motion/structures/{row["hash"]}.json'})
            except Exception as exc:
                failures.append({'bundle': row['hash'], 'type': kind, 'sourceId': str(obj.path_id), 'error': str(exc), 'retainedInNativeBundle': True})
        if structure['objects']:
            file = f'motion/structures/{row["hash"]}.json'
            write_json(output / file, structure)
            structures.append({'file': file, 'bundle': row['hash'], 'name': row['bundle'], 'objects': len(structure['objects']), 'particleSystems': row['types'].get('ParticleSystem', 0)})
        # Release each root; dependencies are only read when needed by the VFX exporter.
        source.loaded.pop(row['hash'], None)
        if index % 40 == 0:
            print(f'{index}/{len(roots)} motion bundles; {len(clips)} clips; {len(particles)} particle systems', flush=True)

    write_json(output / 'motion/clips.json', clips)
    write_json(output / 'motion/controllers.json', controllers)
    write_json(output / 'motion/structures.json', structures)
    write_json(output / 'motion/particles.json', particles)
    write_json(output / 'native/bundles.json', native)
    write_json(output / 'motion/export-errors.json', failures)
    write_json(output / 'native/unresolved-dependencies.json', [{'cab': cab, 'referencedBy': sorted(hashes)} for cab, hashes in unresolved.items()])
    report = {'apkName': Path(inventory['apk']).name, 'apkSha256': inventory['sha256'], 'unity': '2022.3.57f1', 'tool': 'UnityPy ' + UnityPy.__version__,
              'scope': 'extract-and-archive-only', 'runtimeInstalled': False, 'apkExecuted': False, 'apkBundleCount': len(rows), 'motionBundles': len(roots), 'nativeBundlesWithDependencies': len(native),
              'animationClips': len(clips), 'clipCategories': dict(collections.Counter(c['category'] for c in clips)), 'controllers': len(controllers), 'particleSystems': len(particles), 'structures': len(structures),
              'readableExportErrors': len(failures), 'unresolvedDependencyCabCount': len(unresolved), 'notes': ['Only APK-present resources are extracted. Remote downloadable resources are not fetched.', 'Native bundles preserve compiled curves, custom components and Android shaders; JSON is data, not a playable clip or a Unity editor project.', 'Missing dependency CABs are explicitly listed. Native rendering and adaptation remain unverified.']}
    write_json(output / 'extraction-report.json', report)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inventory', type=Path, default=Path('.runtime/apk-audit/inventory.json'))
    parser.add_argument('--output', type=Path, default=Path('../../source-assets/zjcs-apk'))
    args = parser.parse_args()
    export(args.inventory, args.output.resolve())
