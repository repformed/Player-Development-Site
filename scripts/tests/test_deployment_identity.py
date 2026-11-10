import json
from pathlib import Path
import subprocess
import unittest


class DeploymentIdentityTests(unittest.TestCase):
    def test_fallback_publishing_accepts_canonical_repository_only(self):
        root = Path(__file__).resolve().parents[2]
        fixtures = [
            ('https://github.com/repformed/Player-Development-Site.git', True),
            ('https://github.com/Repformed/Player-Development-Site', True),
            ('https://github.com/CoachBilliott/Player-Development-Site.git', False),
            ('https://github.com/repformed/another-project.git', False),
            ('https://another-host.test/repformed/Player-Development-Site.git', False),
            ('https://github.com/repformed/Player-Development-Site-copy.git', False),
        ]
        script = """
import { assertPublishingRepository } from './scripts/deployment-identity.mjs';
import { readFileSync } from 'node:fs';
const cases = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(cases.map(([remote]) => {
  try { assertPublishingRepository(remote); return true; } catch { return false; }
})));
"""
        result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=root,
                                input=json.dumps(fixtures), capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(result.stdout), [expected for _, expected in fixtures])

    def test_only_the_stable_application_marker_accepts_a_build(self):
        root = Path(__file__).resolve().parents[2]
        fixtures = [
            ('<title>Repformed</title><meta name="application-id" content="com.coachbilliott.playerdevelopment">', True),
            ("<meta content='com.coachbilliott.playerdevelopment'\n name='application-id'>", True),
            ('<title>Player Development</title>', False),
            ('<title>Repformed</title>', False),
            ('<meta name="application-id" content="another-project">', False),
        ]
        script = """
import { assertDeploymentIdentity } from './scripts/deployment-identity.mjs';
import { readFileSync } from 'node:fs';
const cases = JSON.parse(readFileSync(0, 'utf8'));
const result = cases.map(([html]) => { try { assertDeploymentIdentity(html); return true; } catch { return false; } });
process.stdout.write(JSON.stringify(result));
"""
        result = subprocess.run(['node', '--input-type=module', '-e', script], cwd=root,
                                input=json.dumps(fixtures), capture_output=True, text=True, check=True)
        self.assertEqual(json.loads(result.stdout), [expected for _, expected in fixtures])


if __name__ == '__main__':
    unittest.main()
