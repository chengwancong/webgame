"""Export only the reviewed 256px PNGs, catalogue and native-image provenance."""
import hashlib
import json
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parents[2]
delivery = root.parent / 'docs/05-art/equipment-icons-chibi-20261004'
catalog = json.loads((delivery / 'catalog.json').read_text(encoding='utf-8'))
target = delivery / 'equipment-chibi-324.zip'
assert len(catalog['items']) == 324
with ZipFile(target, 'w', compression=ZIP_DEFLATED) as archive:
    for item in catalog['items']:
        source = root / 'assets/ui-source/v2' / item['file']
        assert hashlib.sha256(source.read_bytes()).hexdigest() == item['sha256'], item['id']
        archive.write(source, 'icons/' + item['id'] + '.png')
    for name in ['README.md', 'catalog.json', 'production-provenance.json']:
        archive.write(delivery / name, name)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert len([name for name in archive.namelist() if name.endswith('.png')]) == 324
print(json.dumps({'zip': str(target), 'icons': 324, 'sets': 54, 'bytes': target.stat().st_size}))
