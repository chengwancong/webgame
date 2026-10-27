"""Package the standalone importable sample only, without source-game textures or private data."""
from pathlib import Path
import zipfile

root=Path(__file__).resolve().parents[2]
source=root/'apps/web/public/art-pixel/shiba-spine-sample'
output=root/'.runtime/shiba-spine/shiba-spine-sample.zip'
files=['shiba.json','shiba.atlas','shiba.png','shiba-sprites.png','sample.json','pixel-asset.json']
with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(source/name,name)
    for file in sorted((source/'images').glob('*.png')):
        archive.write(file,'images/'+file.name)
    archive.write(root/'assets/shiba-spine-sample/README.md','README.md')
print(output)
