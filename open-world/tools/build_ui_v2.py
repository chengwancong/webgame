#!/usr/bin/env python3
"""Build /art/ui-v2 from assets/ui-source/v2.

Flow: read manifest, validate ids/paths/files/sizes, decode, write a temp tree,
verify the temp tree, then publish. Any failure exits non-zero and leaves the
previous published tree and runtime manifest untouched.
"""
import hashlib, json, os, shutil, sys, tempfile
from pathlib import Path
from PIL import Image, UnidentifiedImageError

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / 'assets/ui-source/v2'
SOURCE_MANIFEST = SOURCE_DIR / 'ui-source.json'
OUTPUT_DIR = ROOT / 'apps/web/public/art/ui-v2'
RUNTIME_MANIFEST = ROOT / 'packages/asset-manifest/ui.v2.json'
TOKENS = json.loads((ROOT / 'packages/ui-tokens/tokens.json').read_text(encoding='utf-8'))
SMALL_ICON_SIZE = int(TOKENS['Size']['GroundLootTexture'].removesuffix('px'))

REQUIRED_IDS = frozenset(
    ['skill-' + name for name in 'cut whirl bolt frost ward ember chain mend nova rush cleave lance'.split()]
    + ['gear-' + name for name in 'blade bow coat charm core shield'.split()]
    + ['portrait-hero', 'portrait-bust', 'sys-bag', 'sys-build', 'sys-goal', 'sys-settings']
)

class BuildFailure(Exception):
    pass

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()

def load_manifest(path: Path) -> dict:
    try:
        data = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        raise BuildFailure(f'manifest unreadable: {e}') from e
    if not isinstance(data, dict) or not isinstance(data.get('assets'), list):
        raise BuildFailure('manifest assets must be a list')
    colors = data.get('colors') or {}
    expected = {
        'midnight_blue': '#0B1F3B', 'slate_blue': '#2A4668', 'warm_cream': '#F7E6C8',
        'apricot_gold': '#FFB65C', 'magic_blue': '#49D2FF', 'coral_red': '#FF6B5B',
    }
    for key, value in expected.items():
        if colors.get(key) != value:
            raise BuildFailure(f'color {key} must be {value}')
    return data

def validate_and_stage(manifest: dict, stage: Path) -> dict:
    missing = REQUIRED_IDS - {v.get('id') for v in manifest['assets'] if isinstance(v, dict) and isinstance(v.get('id'), str)}
    if missing:
        raise BuildFailure('missing required UI assets: ' + ', '.join(sorted(missing)))
    seen = set()
    runtime_assets = {}
    for item in manifest['assets']:
        if not isinstance(item, dict):
            raise BuildFailure('asset entry is not an object')
        aid = item.get('id')
        rel = item.get('file')
        size = item.get('size')
        if not isinstance(aid, str) or not aid or aid in seen:
            raise BuildFailure(f'duplicate or empty id: {aid!r}')
        seen.add(aid)
        if not isinstance(rel, str) or rel.startswith(('/', '\\')) or '..' in Path(rel).parts:
            raise BuildFailure(f'path escapes source dir: {rel!r}')
        if not (isinstance(size, list) and len(size) == 2 and all(isinstance(n, int) and n > 0 for n in size)):
            raise BuildFailure(f'bad size for {aid}')
        src = (SOURCE_DIR / rel).resolve()
        if SOURCE_DIR.resolve() not in src.parents and src != SOURCE_DIR.resolve():
            raise BuildFailure(f'path escapes source dir: {rel}')
        if not src.is_file():
            raise BuildFailure(f'missing source: {rel}')
        try:
            with Image.open(src) as im:
                im.load()
                if im.format != 'PNG':
                    raise BuildFailure(f'{rel} is not PNG')
                if list(im.size) != size:
                    raise BuildFailure(f'{rel} size {im.size} != {tuple(size)}')
        except UnidentifiedImageError as e:
            raise BuildFailure(f'corrupt image {rel}: {e}') from e
        dest_rel = Path(rel)
        dest = stage / dest_rel
        if dest.exists():
            raise BuildFailure(f'output path collision: {dest_rel}')
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        runtime_assets[aid] = {
            'kind': item.get('kind', 'image'),
            'path': '/art/ui-v2/' + dest_rel.as_posix(),
            'size': size,
            'sha256': sha256_file(dest),
        }
        if aid.startswith('gear-'):
            # Prefilter once at build time. WebGL minification of full artwork
            # otherwise loses the hand-drawn edges at a 32px world display size.
            icon_rel = Path('small-icons') / (aid + '.png')
            icon_dest = stage / icon_rel
            icon_dest.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(src) as im:
                icon = im.convert('RGBA')
                icon.thumbnail((SMALL_ICON_SIZE, SMALL_ICON_SIZE), Image.Resampling.LANCZOS)
                canvas = Image.new('RGBA', (SMALL_ICON_SIZE, SMALL_ICON_SIZE))
                canvas.paste(icon, ((SMALL_ICON_SIZE-icon.width)//2, (SMALL_ICON_SIZE-icon.height)//2))
                canvas.save(icon_dest)
            runtime_assets[aid]['icon'] = {
                'path': '/art/ui-v2/' + icon_rel.as_posix(),
                'size': [SMALL_ICON_SIZE, SMALL_ICON_SIZE],
                'sha256': sha256_file(icon_dest),
            }
    return {
        'version': manifest.get('version', '2.1'),
        'direction': manifest.get('direction', ''),
        'chrome': manifest.get('chrome', 'css'),
        'colors': manifest['colors'],
        'assets': runtime_assets,
    }

def verify_stage(stage: Path, runtime: dict) -> None:
    for aid, meta in runtime['assets'].items():
        rel = meta['path'].removeprefix('/art/ui-v2/')
        path = stage / rel
        if not path.is_file():
            raise BuildFailure(f'staged file missing: {aid}')
        if sha256_file(path) != meta['sha256']:
            raise BuildFailure(f'staged hash mismatch: {aid}')
        with Image.open(path) as im:
            if list(im.size) != meta['size']:
                raise BuildFailure(f'staged size mismatch: {aid}')

def publish(stage: Path, runtime: dict) -> None:
    """Commit manifest last; post-commit cleanup must never undo the asset tree."""
    OUTPUT_DIR.parent.mkdir(parents=True, exist_ok=True)
    RUNTIME_MANIFEST.parent.mkdir(parents=True, exist_ok=True)
    previous = OUTPUT_DIR.with_name(OUTPUT_DIR.name + '.rollback')
    tmp_manifest = RUNTIME_MANIFEST.with_suffix('.json.tmp')
    if previous.exists():
        shutil.rmtree(previous)
    published = False
    had_output = OUTPUT_DIR.exists()
    try:
        tmp_manifest.write_text(json.dumps(runtime, ensure_ascii=False, indent=2) + '\n')
        if had_output:
            os.replace(OUTPUT_DIR, previous)
        os.replace(stage, OUTPUT_DIR)
        published = True
        os.replace(tmp_manifest, RUNTIME_MANIFEST)
    except Exception as e:
        if published and OUTPUT_DIR.exists():
            shutil.rmtree(OUTPUT_DIR)
        if previous.exists():
            os.replace(previous, OUTPUT_DIR)
        tmp_manifest.unlink(missing_ok=True)
        raise BuildFailure(f'publish failed, previous output kept: {e}') from e
    # The new tree and manifest are now committed together. A cleanup failure
    # leaves only an obsolete backup; reverting here would corrupt that pair.
    if previous.exists():
        try:
            shutil.rmtree(previous)
        except OSError as e:
            print(f'UI V2 published; obsolete backup cleanup pending: {previous}: {e}', file=sys.stderr)

def build() -> dict:
    manifest = load_manifest(SOURCE_MANIFEST)
    OUTPUT_DIR.parent.mkdir(parents=True, exist_ok=True)
    stage = Path(tempfile.mkdtemp(prefix='ui-v2-stage-', dir=str(OUTPUT_DIR.parent)))
    try:
        runtime = validate_and_stage(manifest, stage)
        verify_stage(stage, runtime)
        publish(stage, runtime)
    except Exception:
        if stage.exists():
            shutil.rmtree(stage, ignore_errors=True)
        raise
    if stage.exists():
        shutil.rmtree(stage, ignore_errors=True)
    return runtime

def self_test() -> None:
    """Run fault injection only in an isolated temporary fixture."""
    import subprocess
    subprocess.run([sys.executable, str(ROOT / 'tests/test_ui_asset_build.py')], check=True)

def main() -> None:
    try:
        if '--self-test' in sys.argv:
            self_test()
        else:
            runtime = build()
            print(f'published {len(runtime["assets"])} assets -> {OUTPUT_DIR}')
    except BuildFailure as e:
        print(f'UI V2 build failed: {e}', file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    main()
