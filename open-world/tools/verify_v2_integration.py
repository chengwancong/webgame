#!/usr/bin/env python3
"""Static checks for the V2 UI integration.

The script proves source and manifest conditions only. It does not claim a
visual pass. Regressions at the bottom must keep failing when the old faults
are reintroduced as text fixtures.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / 'apps/web/src/style.css').read_text()
PRESENTATION = (ROOT / 'apps/web/src/presentation.ts').read_text()
MAIN = (ROOT / 'apps/web/src/main.ts').read_text()
MANIFEST = json.loads((ROOT / 'packages/asset-manifest/ui.v2.json').read_text())
PUBLIC = ROOT / 'apps/web/public'

EXPECTED_COLORS = {
    'midnight_blue': '#0B1F3B',
    'slate_blue': '#2A4668',
    'warm_cream': '#F7E6C8',
    'apricot_gold': '#FFB65C',
    'magic_blue': '#49D2FF',
    'coral_red': '#FF6B5B',
}

def fail(msg):
    print('FAIL', msg)
    return False

def check_manifest():
    ok = True
    colors = MANIFEST.get('colors') or {}
    for key, value in EXPECTED_COLORS.items():
        if colors.get(key) != value:
            ok = fail(f'color {key} is {colors.get(key)!r}')
    assets = MANIFEST.get('assets') or {}
    if len(assets) < 20:
        ok = fail('runtime manifest has too few assets')
    seen = set()
    for aid, meta in assets.items():
        if aid in seen:
            ok = fail(f'duplicate {aid}')
        seen.add(aid)
        rel = str(meta.get('path', '')).removeprefix('/')
        path = PUBLIC / rel
        if not path.is_file():
            ok = fail(f'missing published file {rel}')
        if meta.get('path', '').startswith('/art/ui/') and not meta['path'].startswith('/art/ui-v2/'):
            ok = fail(f'legacy path {meta["path"]}')
    return ok

def check_sources():
    ok = True
    if "art('skill-" not in PRESENTATION or "art('gear-" not in PRESENTATION:
        ok = fail('presentation does not resolve skill/gear art from the manifest')
    if '/art/ui/' in PRESENTATION or '/art/ui/' in CSS:
        ok = fail('game source still references /art/ui/')
    for wrong in ('#1A2332', '#2D3E54', '#FFF8E7'):
        if wrong in CSS.split('/* retired')[0]:
            ok = fail(f'wrong color {wrong} still in css')
    for right in ('#0B1F3B', '#2A4668', '#F7E6C8', '#FFB65C'):
        if right not in CSS:
            ok = fail(f'missing color {right}')
    if 'const head=' in PRESENTATION.split("title=")[0]:
        ok = fail('panel head is built before the page title')
    if 'width:max-content' not in CSS or 'border-radius:50%' not in CSS:
        ok = fail('minimap box is not sized from its canvas')
    if 'focusKey' not in MAIN or "this.confirm" not in MAIN.split("Escape")[1][:240]:
        ok = fail('focus restore or layered Escape is missing')
    if 'class="cell"' in PRESENTATION or 'item-slot.png' in CSS:
        ok = fail('old slot chrome is still rendered')
    if '缺项' not in PRESENTATION:
        ok = fail('auto-setting gaps are not stated')
    return ok

def detects_old_slot(css):
    return 'item-slot.png' in css or "url('/art/ui/" in css

def detects_minimap_overflow(css):
    # A fixed width smaller than the canvas plus the declared padding and border overflows.
    return '.minimap{position:absolute;top:12px;right:12px;width:120px' in css

def detects_empty_title(source):
    head_at = source.find('const head=')
    title_at = source.find("title='选择远行目的地'")
    return head_at != -1 and (title_at == -1 or head_at < title_at)

def detects_missing_asset(manifest):
    return any(not (PUBLIC / str(meta.get('path', '')).removeprefix('/')).is_file() for meta in manifest.get('assets', {}).values())

def check_regressions():
    ok = True
    old_css = ".cell{background:url('/art/ui/v2/item-slot.png')}"
    if not detects_old_slot(old_css):
        ok = fail('regression missed an old slot image')
    overflow = '.minimap{position:absolute;top:12px;right:12px;width:120px;padding:8px;border:2px solid #fff} canvas{width:140px;height:140px}'
    if not detects_minimap_overflow(overflow):
        ok = fail('regression missed a minimap overflow')
    early_head = "const head=`<h2>${title}</h2>`;\ntitle='选择远行目的地'"
    if not detects_empty_title(early_head):
        ok = fail('regression missed an empty title')
    if detects_empty_title(PRESENTATION):
        ok = fail('current presentation still builds the head too early')
    missing = {'assets': {'gone': {'path': '/art/ui-v2/missing.png'}}}
    if not detects_missing_asset(missing):
        ok = fail('regression missed a missing asset')
    if detects_missing_asset(MANIFEST):
        ok = fail('current manifest points at a missing file')
    if detects_old_slot(CSS) or detects_minimap_overflow(CSS):
        ok = fail('current css still matches a fault fixture')
    return ok

def main():
    checks = [check_manifest(), check_sources(), check_regressions()]
    if not all(checks):
        print('V2 static check failed')
        sys.exit(1)
    print(f'V2 static check ok ({len(MANIFEST["assets"])} assets). This is not a visual acceptance.')

if __name__ == '__main__':
    main()
