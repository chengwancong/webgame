"""Extract original VFX data, textures, meshes and dependency evidence from the APK.

Uses UnityPy 1.25.3. No game code, native libraries or MonoBehaviours are executed.
The inventory is produced by apk-vfx-audit.py. Native particle data is retained;
extracting a texture is not evidence that a Unity prefab has been ported faithfully.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import zipfile

import UnityPy


def safe_json(value):
    if isinstance(value, dict):
        return {k: str(v) if k == 'm_PathID' else safe_json(v) for k, v in value.items()}
    if isinstance(value, (tuple, list)):
        return [safe_json(x) for x in value]
    if isinstance(value, bytes):
        return {'hex': value.hex()}
    if isinstance(value, float) and not math.isfinite(value):
        return 'Infinity' if value > 0 else '-Infinity' if value < 0 else 'NaN'
    return value


def save(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(safe_json(value), ensure_ascii=False, separators=(',', ':')), encoding='utf-8')


class Source:
    def __init__(self, inventory, output):
        self.inventory, self.output = inventory, output
        self.zip = zipfile.ZipFile(inventory['apk'])
        self.cabs = {f['name']: row for row in inventory['bundles'] for f in row['files']}
        self.loaded, self.textures, self.materials, self.meshes = {}, {}, {}, {}
        self.used_bundles = {}

    def load(self, row):
        if row['hash'] not in self.loaded:
            data = self.zip.read(row['zip'])
            env = UnityPy.load(data)
            self.loaded[row['hash']] = env
            self.used_bundles[row['hash']] = {'name': row['bundle'], 'zip': row['zip'], 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
        return self.loaded[row['hash']]

    def ref(self, obj, ptr):
        if not ptr['m_PathID']:
            return None
        if ptr['m_FileID'] == 0:
            return obj.assets_file.objects[ptr['m_PathID']]
        name = obj.assets_file.externals[ptr['m_FileID'] - 1].path.rsplit('/', 1)[-1]
        if name == 'unity default resources':
            if name not in self.loaded:
                self.loaded[name] = UnityPy.load(self.zip.read('assets/bin/Data/unity default resources'))
            env = self.loaded[name]
        else:
            row = self.cabs.get(name)
            if not row:
                raise ValueError('Missing dependency: ' + name)
            env = self.load(row)
        for asset in env.assets:
            if ptr['m_PathID'] in asset.objects:
                return asset.objects[ptr['m_PathID']]
        raise ValueError(f'Missing object: {name}/{ptr["m_PathID"]}')

    @staticmethod
    def uid(obj):
        return hashlib.sha256((obj.assets_file.name + ':' + str(obj.path_id)).encode()).hexdigest()[:16]

    def texture(self, obj):
        key = self.uid(obj)
        if key not in self.textures:
            data = obj.read()
            image = data.image
            file = f'textures/{key}.png'
            (self.output / 'textures').mkdir(exist_ok=True, parents=True)
            image.save(self.output / file)
            self.textures[key] = {'name': data.m_Name, 'file': file, 'width': image.width, 'height': image.height,
                                  'sourceId': str(obj.path_id), 'sourceCab': obj.assets_file.name,
                                  'sha256': hashlib.sha256((self.output / file).read_bytes()).hexdigest()}
        return key

    def mesh(self, obj):
        if obj is None:
            return None
        key = self.uid(obj)
        if key not in self.meshes:
            data = obj.read()
            file = f'meshes/{key}.obj'
            (self.output / 'meshes').mkdir(exist_ok=True, parents=True)
            (self.output / file).write_text(data.export(), encoding='utf-8')
            self.meshes[key] = {'name': data.m_Name, 'file': file, 'sourceId': str(obj.path_id), 'sourceCab': obj.assets_file.name}
        return key

    def material(self, obj):
        key = self.uid(obj)
        if key not in self.materials:
            raw = obj.read_typetree()
            item = {'name': raw['m_Name'], 'raw': raw, 'textures': {}, 'sourceId': str(obj.path_id), 'sourceCab': obj.assets_file.name}
            for prop, value in raw['m_SavedProperties']['m_TexEnvs']:
                tex = self.ref(obj, value['m_Texture'])
                if tex is not None:
                    item['textures'][prop] = self.texture(tex)
            shader = self.ref(obj, raw['m_Shader'])
            item['shader'] = shader.read_typetree().get('m_ParsedForm', {}).get('m_Name') if shader else None
            self.materials[key] = item
        return key

    def effect(self, row, root):
        data = root.read_typetree()
        name = data['m_Name']
        item = {'name': name, 'sourceBundle': row['hash'], 'sourceId': str(root.path_id), 'layers': [], 'issues': [], 'transforms': []}
        def visit(go, parent=None):
            raw = go.read_typetree()
            components = [self.ref(go, c['component']) for c in raw['m_Component']]
            transform = next((o for o in components if o and o.type.name in ['Transform', 'RectTransform']), None)
            if transform is None:
                return
            tr = transform.read_typetree()
            transform_id = str(transform.path_id)
            item['transforms'].append({'id': transform_id, 'parent': parent, 'name': raw['m_Name'], 'active': raw['m_IsActive'],
                                       'position': tr['m_LocalPosition'], 'rotation': tr['m_LocalRotation'], 'scale': tr['m_LocalScale']})
            particle = next((o for o in components if o and o.type.name == 'ParticleSystem'), None)
            renderer = next((o for o in components if o and o.type.name == 'ParticleSystemRenderer'), None)
            if particle and renderer:
                p, r = particle.read_typetree(), renderer.read_typetree()
                layer = {'name': raw['m_Name'], 'transform': transform_id, 'particle': p, 'renderer': r, 'materials': []}
                try:
                    layer['materials'] = [self.material(self.ref(renderer, ptr)) for ptr in r['m_Materials'] if ptr['m_PathID']]
                    layer['mesh'] = self.mesh(self.ref(renderer, r['m_Mesh'])) if r['m_RenderMode'] == 4 else None
                except Exception as error:
                    layer['error'] = str(error)
                    item['issues'].append(raw['m_Name'] + ': ' + str(error))
                item['layers'].append(layer)
            for component in components:
                if component and component.type.name in ['Animation', 'Animator', 'TrailRenderer', 'SpriteRenderer', 'MeshRenderer']:
                    # Retain evidence; these components must be handled by the native baking route.
                    try:
                        payload = component.read_typetree()
                        item.setdefault('otherComponents', []).append({'type': component.type.name, 'transform': transform_id, 'data': payload})
                    except Exception as error:
                        item['issues'].append(component.type.name + ': ' + str(error))
            for ptr in tr['m_Children']:
                child_tr = self.ref(transform, ptr)
                child = self.ref(child_tr, child_tr.read_typetree()['m_GameObject'])
                visit(child, transform_id)
        visit(root)
        return item


def extract(inventory_path, output, scope='combat'):
    inventory = json.loads(inventory_path.read_text(encoding='utf-8'))
    output.mkdir(parents=True, exist_ok=True)
    source = Source(inventory, output)
    pattern = re.compile(r'^(?:Eff_UI_|Effect_UI_)' if scope == 'ui' else r'^Eff_(?:Skill_|PassiveSkill_|Buff_|\s?Element|Universal_Hit|Chaos_|Npc_.*(?:Skill|Hit|Death))', re.I)
    candidates = {}
    for row in inventory['bundles']:
        if row.get('types', {}).get('ParticleSystem', 0) == 0:
            continue
        for obj in row.get('named', []):
            name = (obj.get('name') or '').strip()
            if obj['type'] == 'GameObject' and pattern.search(name) and not re.search(r'\(\d+\)$', name):
                # Prefer the standalone authored prefab over copies embedded in encounter assemblies.
                current = candidates.get(name)
                if current is None or row['types']['ParticleSystem'] < current[0]['types']['ParticleSystem']:
                    candidates[name] = (row, obj['id'])
    effects = []
    used_keys = set()
    for index, (name, (row, path_id)) in enumerate(sorted(candidates.items())):
        env = source.load(row)
        root = next(o for o in env.objects if o.path_id == path_id)
        item = source.effect(row, root)
        key = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
        if key in used_keys:
            key += '-' + source.uid(root)[:8]
        used_keys.add(key)
        file = f'prefabs/{key}.json'
        save(output / file, item)
        effects.append({'id': key, 'name': item['name'], 'file': file, 'layers': len(item['layers']), 'issues': item['issues'],
                        'hasOtherComponents': bool(item.get('otherComponents')), 'sourceBundle': row['hash'], 'sourceId': str(path_id),
                        'status': 'extracted-native-data-not-visual-acceptance'})
        if index % 10 == 0:
            print(f'{index}/{len(candidates)}: {name}', flush=True)
    save(output / 'materials.json', source.materials)
    save(output / 'textures.json', source.textures)
    save(output / 'meshes.json', source.meshes)
    save(output / 'source.json', {'scope': scope, 'apkName': Path(inventory['apk']).name, 'apkSha256': inventory['sha256'], 'unity': '2022.3.57f1',
         'unityPy': UnityPy.__version__, 'effects': effects, 'bundles': source.used_bundles,
         'renderingNote': 'Original decoded textures, native particle curves, hierarchy, materials and meshes. Not native Unity renders; no rebuilt animation or AI art is represented as original.'})
    print(json.dumps({'effects': len(effects), 'textures': len(source.textures), 'materials': len(source.materials), 'meshes': len(source.meshes),
                      'effectsWithDependencyErrors': sum(bool(x['issues']) for x in effects)}, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--inventory', type=Path, default=Path('.runtime/apk-audit/inventory.json'))
    parser.add_argument('--output', type=Path, default=Path('../../source-assets/zjcs-apk/combat-vfx'))
    parser.add_argument('--scope', choices=['combat', 'ui'], default='combat')
    args = parser.parse_args()
    extract(args.inventory, args.output, args.scope)
