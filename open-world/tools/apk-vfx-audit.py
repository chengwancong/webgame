"""Read-only inventory of Unity resources in the user-supplied APK. Never runs the APK.

Install UnityPy==1.25.3 into .runtime/apk-tools, then run with that Python.
Only inventory JSON is written; source archives are never changed.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
import zipfile

import UnityPy


def audit(apk, output):
    output.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(apk) as archive:
        members = {Path(i.filename).stem: i for i in archive.infolist() if i.filename.endswith('.bundle')}
        manifests = [i for i in archive.namelist() if 'PackageManifest_' in i and i.endswith('.bytes')]
        names = {}
        for manifest in manifests:
            for name, digest in re.findall(rb'([a-zA-Z0-9_.-]+\.bundle)\x20\x00([0-9a-f]{32})', archive.read(manifest)):
                names[digest.decode()] = name.decode()
        rows = []
        for index, (digest, member) in enumerate(members.items()):
            row = {'hash': digest, 'bundle': names.get(digest), 'zip': member.filename, 'bytes': member.file_size}
            try:
                env = UnityPy.load(archive.read(member))
                row['types'] = dict(collections.Counter(o.type.name for o in env.objects))
                # Inspect pointers without dereferencing: unrelated missing dependencies
                # must not trigger a recursive scan of the developer's filesystem.
                row['containers'] = []
                for obj in env.objects:
                    if obj.type.name == 'AssetBundle':
                        for p, info in obj.read_typetree()['m_Container']:
                            row['containers'].append({'path': p, 'pointer': info['asset']})
                row['files'] = []
                for bundle in env.files.values():
                    for name, file in getattr(bundle, 'files', {}).items():
                        if hasattr(file, 'externals'):
                            row['files'].append({'name': name, 'externals': [e.path.rsplit('/', 1)[-1] for e in file.externals]})
                row['named'] = []
                for obj in env.objects:
                    if obj.type.name in ['GameObject', 'Texture2D', 'Material', 'AnimationClip', 'Mesh', 'Shader', 'Sprite']:
                        try:
                            name = obj.peek_name()
                            row['named'].append({'type': obj.type.name, 'id': obj.path_id, 'name': name})
                        except Exception as exc:
                            row.setdefault('nameErrors', []).append(str(exc))
            except Exception as exc:
                row['error'] = str(exc)
            rows.append(row)
            if index % 200 == 0:
                print(f'{index}/{len(members)} bundles', flush=True)
        result = {'apk': str(apk), 'sha256': hashlib.file_digest(apk.open('rb'), 'sha256').hexdigest(),
                  'unityPy': UnityPy.__version__, 'bundles': rows}
        (output / 'inventory.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
        print(json.dumps({'bundles': len(rows), 'errors': sum('error' in r for r in rows),
                          'particleBundles': sum(bool(r.get('types', {}).get('ParticleSystem')) for r in rows)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('apk', type=Path)
    parser.add_argument('--output', type=Path, default=Path('.runtime/apk-audit'))
    args = parser.parse_args()
    audit(args.apk, args.output)
