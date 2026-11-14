"""Read-only compiled-resource check; no signing, provider or runtime acceptance."""
import hashlib
import json
import pathlib
import plistlib
import sys

def verify(app, receipt):
    app = pathlib.Path(app)
    actual = {str(p.relative_to(app / 'public')): hashlib.sha256(p.read_bytes()).hexdigest()
              for p in (app / 'public').rglob('*') if p.is_file()}
    if actual != receipt['webAssets']:
        raise ValueError('closed_ios_assets_unconfirmed')
    config = json.loads((app / 'public/content-config.json').read_text())
    if config != {'enabled': False, 'url': '', 'publishableKey': ''}:
        raise ValueError('closed_ios_configuration_unconfirmed')
    native = json.loads((app / 'capacitor.config.json').read_text())
    info = plistlib.loads((app / 'Info.plist').read_bytes())
    if (native.get('appId') != 'com.coachbilliott.playerdevelopment'
            or native.get('server', {}).get('url')
            or native.get('server', {}).get('cleartext')
            or info.get('CFBundleIdentifier') != native['appId']):
        raise ValueError('closed_ios_identity_unconfirmed')
    return {'compiledResourcesVerified': True, 'backendEnabled': False,
            'files': len(actual), 'bundleId': native['appId'], 'runtimeAccepted': False}

if __name__ == '__main__':
    print(json.dumps(verify(sys.argv[1], json.loads(pathlib.Path(sys.argv[2]).read_text()))))
