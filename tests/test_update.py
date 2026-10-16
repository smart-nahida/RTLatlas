import importlib.util,json,tempfile,unittest
from pathlib import Path
spec=importlib.util.spec_from_file_location('updater',Path(__file__).resolve().parents[1]/'scripts'/'update_project.py')
updater=importlib.util.module_from_spec(spec);spec.loader.exec_module(updater)

class UpdateTest(unittest.TestCase):
    def test_preserves_dependencies_config_and_backup(self):
        with tempfile.TemporaryDirectory() as folder:
            source,target=Path(folder)/'source',Path(folder)/'target'
            for base in (source,target):
                base.mkdir();(base/'package.json').write_text(json.dumps({'name':'rtl-atlas'}));(base/'src').mkdir()
            (source/'src'/'App.tsx').write_text('new');(target/'src'/'App.tsx').write_text('old')
            for name in ['node_modules','.venv']:
                (target/name).mkdir();(target/name/'keep').write_text('preserved')
            (target/'api-settings.json').write_text('encrypted-private-settings');(source/'api-settings.json').write_text('must-not-replace');
            (target/'atlas.project.json').write_text('custom');(source/'atlas.project.json').write_text('should not replace')
            count,backup=updater.apply_update(source,target)
            self.assertEqual((target/'api-settings.json').read_text(),'encrypted-private-settings');self.assertEqual(count,1);self.assertEqual((target/'src'/'App.tsx').read_text(),'new')
            self.assertEqual((backup/'src'/'App.tsx').read_text(),'old');self.assertEqual((target/'atlas.project.json').read_text(),'custom')
            for name in ['node_modules','.venv']:self.assertEqual((target/name/'keep').read_text(),'preserved')
    def test_refuses_source_file_symlink(self):
        with tempfile.TemporaryDirectory() as folder:
            source,target=Path(folder)/'source',Path(folder)/'target'
            for base in (source,target):base.mkdir();(base/'package.json').write_text('{"name":"rtl-atlas"}')
            original=Path(folder)/'original';original.write_text('keep');(source/'code').write_text('replace');(target/'code').symlink_to(original)
            with self.assertRaises(ValueError):updater.apply_update(source,target)
            self.assertEqual(original.read_text(),'keep')
