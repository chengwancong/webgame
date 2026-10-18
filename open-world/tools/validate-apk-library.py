"""Verify extraction against the original APK, not just successful parsing."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

from PIL import Image

spec = importlib.util.spec_from_file_location('apk_extract', Path(__file__).with_name('extract-apk-vfx.py'))
helpers = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helpers)


def validate(inventory_file, root):
    read = lambda file: json.loads((root / file).read_text(encoding='utf-8'), parse_constant=lambda s: (_ for _ in ()).throw(ValueError('Nonstandard JSON: '+s)))
    inventory = json.loads(inventory_file.read_text(encoding='utf-8'))
    source = helpers.Source(inventory, root)
    by_hash = {r['hash']: r for r in inventory['bundles']}
    native = read('native/bundles.json')
    report = {'status': 'passed', 'nativeBundles': 0, 'byteExactSpinePayloads': 0, 'pngs': 0, 'vfxPrefabs': 0, 'animationClips': 0, 'controllers': 0, 'particleSystems': 0, 'runtimeInstalled': False}
    for entry in native:
        data = (root / entry['file']).read_bytes()
        assert hashlib.sha256(data).hexdigest() == entry['sha256'], entry['file']
        assert data == source.zip.read(by_hash[entry['hash']]['zip']), entry['file']
        report['nativeBundles'] += 1
    for group in ['combat-vfx','ui-vfx','spine']:
        textures = read(group + '/textures.json')
        for item in textures.values():
            file = root / group / item['file']
            assert hashlib.sha256(file.read_bytes()).hexdigest() == item['sha256'], str(file)
            with Image.open(file) as png:
                assert png.size == (item['width'],item['height']), str(file)
                png.verify()
            report['pngs'] += 1
        if group == 'spine':
            continue
        material = read(group + '/materials.json')
        meshes = read(group + '/meshes.json')
        entries = read(group + '/source.json')['effects']
        assert len({e['file'] for e in entries}) == len(entries), 'Prefab output name collision'
        for entry in entries:
            prefab = read(group + '/' + entry['file'])
            assert prefab['name'] == entry['name'], entry['file']
            assert not prefab['issues'], entry['file']
            assert len(prefab['layers']) == entry['layers'], entry['file']
            transforms = {t['id'] for t in prefab['transforms']}
            for layer in prefab['layers']:
                assert layer['transform'] in transforms
                for mid in layer['materials']:
                    assert mid in material
                    assert all(t in textures for t in material[mid]['textures'].values())
                if layer.get('mesh'):
                    assert (root / group / meshes[layer['mesh']]['file']).is_file()
            report['vfxPrefabs'] += 1
    payloads = read('spine/files.json')
    active_hash, env = None, None
    for entry in payloads:
        if entry['sourceBundle'] != active_hash:
            if active_hash:
                source.loaded.pop(active_hash, None)
            active_hash = entry['sourceBundle']
            env = source.load(by_hash[active_hash])
        obj = next(o for o in env.objects if o.path_id == int(entry['sourceId']))
        raw = obj.get_raw_data()
        name_length = struct.unpack_from('<i', raw, 0)[0]
        offset = (4 + name_length + 3) & ~3
        length = struct.unpack_from('<i', raw, offset)[0]
        original_bytes = raw[offset + 4:offset + 4 + length]
        decoded = (root / entry['file']).read_bytes()
        assert original_bytes == decoded, 'TextAsset payload mismatch: ' + entry['file']
        assert len(decoded) == entry['bytes'] and hashlib.sha256(decoded).hexdigest() == entry['sha256']
        report['byteExactSpinePayloads'] += 1
    for name, kind, key in [('motion/clips.json', 'AnimationClip', 'animationClips'), ('motion/controllers.json', None, 'controllers')]:
        entries = read(name)
        assert len({e['id'] for e in entries}) == len(entries)
        for entry in entries:
            obj = read(entry['file'])
            assert obj['sourceId'] == entry['sourceId']
            assert obj['data']['m_Name'] == entry['name']
        report[key] = len(entries)
        expected = sum(r['types'].get(kind, 0) if kind else r['types'].get('AnimatorController', 0) + r['types'].get('AnimatorOverrideController', 0) for r in inventory['bundles'])
        assert len(entries) == expected, key
    report['particleSystems'] = len(read('motion/particles.json'))
    assert report['particleSystems'] == sum(r['types'].get('ParticleSystem', 0) for r in inventory['bundles'])
    assert not read('motion/export-errors.json') and not read('spine/export-errors.json')
    # Every native source referenced by a curated effect is part of the portable archive.
    native_hashes = {x['hash'] for x in native}
    for group in ['combat-vfx','ui-vfx']:
        assert set(read(group+'/source.json')['bundles']).issubset(native_hashes)
    report['knownUnresolvedDependencyCabs'] = len(read('native/unresolved-dependencies.json'))
    report['limits'] = ['Extraction integrity only; no runtime or aesthetic acceptance.', 'Spine atlas page matches are by original texture name; missing pages and ambiguous variants remain listed.']
    helpers.save(root/'validation.json',report)
    files = []
    for path in sorted(root.rglob('*')):
        if path.is_file() and path.name != 'files-sha256.json':
            with path.open('rb') as f:
                digest = hashlib.file_digest(f, 'sha256').hexdigest()
            files.append({'file':path.relative_to(root).as_posix(),'bytes':path.stat().st_size,'sha256':digest})
    helpers.save(root/'files-sha256.json',files)
    print(json.dumps(report,indent=2))
    print('Archive files:', len(files), 'bytes:', sum(f['bytes'] for f in files))


if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--inventory',type=Path,default=Path('.runtime/apk-audit/inventory.json'))
    parser.add_argument('--root',type=Path,default=Path('../../source-assets/zjcs-apk'))
    args=parser.parse_args()
    validate(args.inventory,args.root.resolve())
