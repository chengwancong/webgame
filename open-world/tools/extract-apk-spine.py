"""Extract the real Spine skeleton / split animation payloads behind Unity clips.

Unity animation clips in this APK frequently only schedule a Spine animation.
Preserve the original Spine bytes, atlas text and available page textures separately.
"""
import argparse
import collections
import hashlib
import importlib.util
import json
from pathlib import Path
import re

spec = importlib.util.spec_from_file_location('apk_extract', Path(__file__).with_name('extract-apk-vfx.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def export(inventory_file, output):
    inventory = json.loads(inventory_file.read_text(encoding='utf-8'))
    source = helpers.Source(inventory, output / 'spine')
    rows = inventory['bundles']
    files, atlases, used = [], [], {}
    for row in rows:
        if not row['types'].get('TextAsset'):
            continue
        paths = {c['pointer']['m_PathID']: c['path'] for c in row['containers'] if c['pointer']['m_FileID'] == 0}
        if not any(re.search(r'\.skel\.bytes$|\.atlas\.txt$|/SplitAnimations/|/skin_list\.txt$', p, re.I) for p in paths.values()):
            continue
        env = source.load(row)
        used[row['hash']] = row
        for obj in env.objects:
            path = paths.get(obj.path_id, '')
            if obj.type.name != 'TextAsset' or not re.search(r'\.skel\.bytes$|\.atlas\.txt$|/SplitAnimations/|/skin_list\.txt$', path, re.I):
                continue
            data = obj.read()
            raw = data.m_Script.encode('utf-8', errors='surrogateescape')
            relative = Path('spine/original') / path
            target = (output / relative).resolve()
            if not target.is_relative_to((output / 'spine/original').resolve()):
                raise ValueError('Unsafe asset path: ' + path)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
            kind = 'split-animation' if '/splitanimations/' in path.lower() else 'skeleton' if '.skel.' in path.lower() else 'atlas' if '.atlas.' in path.lower() else 'skin-list'
            match = re.search(rb'(?<![0-9])([34]\.[0-9]+\.[0-9]+)', raw[:50]) if kind == 'skeleton' else None
            entry = {'name': data.m_Name, 'file': relative.as_posix(), 'originalPath': path, 'kind': kind, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'sourceId': str(obj.path_id), 'sourceBundle': row['hash']}
            if match:
                entry['spineVersion'] = match.group(1).decode()
            files.append(entry)
            if kind == 'atlas':
                pages = re.findall(r'^([^\r\n]+\.png)\s*\r?\n\s*size:', raw.decode('utf-8'), re.M)
                atlases.append({'file': relative.as_posix(), 'name': data.m_Name, 'pages': [{'name': name, 'textures': []} for name in pages]})
        source.loaded.pop(row['hash'], None)
    wanted = {Path(page['name']).stem.lower() for atlas in atlases for page in atlas['pages']}
    texture_index = collections.defaultdict(list)
    errors = []
    for index, row in enumerate(rows):
        candidates = [o for o in row.get('named', []) if o['type'] == 'Texture2D' and (o['name'] or '').lower() in wanted]
        if not candidates:
            continue
        env = source.load(row)
        used[row['hash']] = row
        paths = {c['pointer']['m_PathID']: c['path'] for c in row['containers'] if c['pointer']['m_FileID'] == 0}
        objects = {o.path_id: o for o in env.objects}
        for candidate in candidates:
            obj = objects[candidate['id']]
            try:
                uid = source.texture(obj)
                source.textures[uid]['assetPathHint'] = paths.get(obj.path_id)
                source.textures[uid]['sourceBundle'] = row['hash']
                texture_index[candidate['name'].lower()].append(uid)
            except Exception as exc:
                errors.append({'name': candidate['name'], 'bundle': row['hash'], 'error': str(exc)})
        source.loaded.pop(row['hash'], None)
        if len(source.textures) % 100 < len(candidates):
            print(f'{len(source.textures)} original Spine page textures', flush=True)
    for atlas in atlases:
        for page in atlas['pages']:
            page['textures'] = texture_index.get(Path(page['name']).stem.lower(), [])
            page['status'] = 'available' if len(page['textures']) == 1 else 'multiple-source-variants' if page['textures'] else 'unmatched-in-apk'

    # Add native split animation / skeleton bundles and their dependencies to the archive.
    pending = list(used.values())
    while pending:
        row = pending.pop()
        for f in row['files']:
            for cab in f['externals']:
                dep = source.cabs.get(cab)
                if dep and dep['hash'] not in used:
                    used[dep['hash']] = dep
                    pending.append(dep)
    native_file = output / 'native/bundles.json'
    native = {x['hash']: x for x in json.loads(native_file.read_text(encoding='utf-8'))}
    for row in used.values():
        if row['hash'] in native:
            continue
        target = (output / 'native' / row['zip']).resolve()
        if not target.is_relative_to((output / 'native').resolve()):
            raise ValueError('Unsafe native path')
        target.parent.mkdir(parents=True, exist_ok=True)
        raw = source.zip.read(row['zip'])
        target.write_bytes(raw)
        native[row['hash']] = {'hash': row['hash'], 'name': row['bundle'], 'file': target.relative_to(output.resolve()).as_posix(), 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest(), 'role': 'spine-payload-or-page-dependency'}
    helpers.save(native_file, list(native.values()))
    helpers.save(output / 'spine/files.json', files)
    helpers.save(output / 'spine/atlases.json', atlases)
    helpers.save(output / 'spine/textures.json', source.textures)
    helpers.save(output / 'spine/export-errors.json', errors)
    counts = dict(collections.Counter(f['kind'] for f in files))
    report = {'files': counts, 'textures': len(source.textures), 'atlasPageReferences': sum(len(a['pages']) for a in atlases), 'atlasPageStatus': dict(collections.Counter(p['status'] for a in atlases for p in a['pages'])), 'errors': len(errors), 'versions': sorted({f['spineVersion'] for f in files if f.get('spineVersion')}), 'splitAnimationsByPath': dict(collections.Counter(f['originalPath'].split('/SplitAnimations/')[0] for f in files if f['kind'] == 'split-animation'))}
    helpers.save(output / 'spine/report.json', report)
    full = json.loads((output / 'extraction-report.json').read_text())
    full['spine'] = report
    full['nativeBundlesWithDependencies'] = len(native)
    helpers.save(output / 'extraction-report.json', full)
    print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inventory', type=Path, default=Path('.runtime/apk-audit/inventory.json'))
    parser.add_argument('--output', type=Path, default=Path('../../source-assets/zjcs-apk'))
    args = parser.parse_args()
    export(args.inventory, args.output.resolve())
