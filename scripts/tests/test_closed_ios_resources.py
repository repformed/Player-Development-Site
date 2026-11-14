import hashlib
import importlib.util
import json
import pathlib
import plistlib
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('closed_ios', pathlib.Path(__file__).parents[1] / 'verify-closed-ios.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ClosedIosResources(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.app = pathlib.Path(self.temp.name)
        (self.app / 'public').mkdir()
        self.config = self.app / 'public/content-config.json'
        self.config.write_text(json.dumps({'enabled': False, 'url': '', 'publishableKey': ''}))
        (self.app / 'capacitor.config.json').write_text(json.dumps({'appId': 'com.coachbilliott.playerdevelopment'}))
        (self.app / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier': 'com.coachbilliott.playerdevelopment'}))
        self.receipt = {'webAssets': {'content-config.json': hashlib.sha256(self.config.read_bytes()).hexdigest()}}

    def test_valid_resources(self):
        self.assertEqual(module.verify(self.app, self.receipt)['backendEnabled'], False)

    def test_tampered_asset(self):
        self.config.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'assets_unconfirmed'):
            module.verify(self.app, self.receipt)

    def test_enabled_even_with_matching_manifest(self):
        self.config.write_text(json.dumps({'enabled': True, 'url': 'https://fictional.invalid', 'publishableKey': ''}))
        self.receipt['webAssets']['content-config.json'] = hashlib.sha256(self.config.read_bytes()).hexdigest()
        with self.assertRaisesRegex(ValueError, 'configuration_unconfirmed'):
            module.verify(self.app, self.receipt)

    def test_wrong_bundle(self):
        (self.app / 'Info.plist').write_bytes(plistlib.dumps({'CFBundleIdentifier': 'fictional.other'}))
        with self.assertRaisesRegex(ValueError, 'identity_unconfirmed'):
            module.verify(self.app, self.receipt)

if __name__ == '__main__':
    unittest.main()
