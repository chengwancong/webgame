"""Asset publication faults must preserve the matching manifest/tree pair."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from PIL import Image

spec = importlib.util.spec_from_file_location('builder', Path(__file__).resolve().parents[1] / 'tools/build_ui_v2.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class PublicationTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='aw-ui-build-test-')
        root = Path(self.temp.name)
        self.patchers = [patch.object(b, key, value) for key, value in {
            'SOURCE_DIR': root/'source', 'SOURCE_MANIFEST': root/'source/manifest.json',
            'OUTPUT_DIR': root/'public/ui', 'RUNTIME_MANIFEST': root/'runtime.json'}.items()]
        for p in self.patchers: p.start()
        b.SOURCE_DIR.mkdir()
        self.manifest = {'version':'test','colors':{'midnight_blue':'#0B1F3B','slate_blue':'#2A4668','warm_cream':'#F7E6C8','apricot_gold':'#FFB65C','magic_blue':'#49D2FF','coral_red':'#FF6B5B'},'assets':[]}
        for aid in sorted(b.REQUIRED_IDS):
            Image.new('RGBA',(4,4),(80,120,230,255)).save(b.SOURCE_DIR/f'{aid}.png')
            self.manifest['assets'].append({'id':aid,'file':f'{aid}.png','size':[4,4]})
        self.save()
        b.build()
        self.original = b.RUNTIME_MANIFEST.read_bytes()
    def tearDown(self):
        for p in reversed(self.patchers): p.stop()
        self.temp.cleanup()
    def save(self): b.SOURCE_MANIFEST.write_text(json.dumps(self.manifest))
    def assert_consistent(self):
        data = json.loads(b.RUNTIME_MANIFEST.read_text())
        for item in data['assets'].values():
            self.assertEqual(item['sha256'], b.sha256_file(b.OUTPUT_DIR/Path(item['path']).name))
    def test_missing_required_and_empty(self):
        for items in [self.manifest['assets'][1:], []]:
            self.manifest['assets'] = items
            self.save()
            with self.assertRaises(b.BuildFailure): b.build()
            self.assertEqual(self.original,b.RUNTIME_MANIFEST.read_bytes())
            self.assert_consistent()
    def test_invalid_asset(self):
        original = self.manifest['assets'][0].copy()
        for update in [{'file':'missing.png'},{'size':[9,9]},{'file':'../outside.png'}]:
            self.manifest['assets'][0] = original | update
            self.save()
            with self.assertRaises(b.BuildFailure): b.build()
            self.assert_consistent()
        self.manifest['assets'][0] = original
        self.save()
        (b.SOURCE_DIR/original['file']).write_bytes(b'broken')
        with self.assertRaises(b.BuildFailure): b.build()
        self.assert_consistent()
    def test_manifest_commit_failure_rolls_back(self):
        Image.new('RGBA',(4,4),(255,80,20,255)).save(b.SOURCE_DIR/self.manifest['assets'][0]['file'])
        replace = b.os.replace
        def fail(src,dst):
            if Path(dst)==b.RUNTIME_MANIFEST: raise OSError('injected commit failure')
            return replace(src,dst)
        with patch.object(b.os,'replace',side_effect=fail):
            with self.assertRaises(b.BuildFailure): b.build()
        self.assertEqual(self.original,b.RUNTIME_MANIFEST.read_bytes())
        self.assert_consistent()
    def test_cleanup_failure_does_not_revert_commit(self):
        Image.new('RGBA',(4,4),(255,80,20,255)).save(b.SOURCE_DIR/self.manifest['assets'][0]['file'])
        remove = b.shutil.rmtree
        def fail(path,*args,**kwargs):
            if str(path).endswith('.rollback'): raise OSError('injected cleanup failure')
            return remove(path,*args,**kwargs)
        with patch.object(b.shutil,'rmtree',side_effect=fail): b.build()
        self.assertNotEqual(self.original,b.RUNTIME_MANIFEST.read_bytes())
        self.assert_consistent()
        b.build()
        self.assertFalse(b.OUTPUT_DIR.with_name('ui.rollback').exists())

if __name__=='__main__': unittest.main()
