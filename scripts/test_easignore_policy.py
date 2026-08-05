import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class EasIgnorePolicyTests(unittest.TestCase):
    def test_prohibited_release_artifacts_are_ignored_without_hiding_local_native_source(self) -> None:
        prohibited = [
            ".env.production",
            ".expo/devices.json",
            "android/settings.gradle",
            "audio/001.mp3",
            "audio/001.mp3.part",
            "certs/distribution.p12",
            "certs/profile.mobileprovision",
            "credentials.json",
            "ios/project.pbxproj",
            "keys/app.keystore",
            "keys/auth-key.p8",
            "keys/private.pem",
            "scripts/__pycache__/probe.pyc",
            "secrets.json",
        ]
        required = [
            "modules/headset-controls/ios/HeadsetControls.podspec",
            "modules/headset-controls/ios/HeadsetControlsModule.swift",
            "src/audio/AudioProvider.tsx",
        ]

        with tempfile.TemporaryDirectory() as temporary_directory:
            root = Path(temporary_directory)
            shutil.copyfile(ROOT / ".easignore", root / ".easignore")
            subprocess.run(
                ["git", "init", "--quiet"],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            )
            for relative_path in [*prohibited, *required]:
                path = root / relative_path
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("fixture", encoding="utf-8")

            result = subprocess.run(
                [
                    "git",
                    "ls-files",
                    "--others",
                    "--ignored",
                    "--exclude-from=.easignore",
                ],
                cwd=root,
                check=True,
                capture_output=True,
                text=True,
            )
            ignored = set(result.stdout.splitlines())

        self.assertEqual(set(prohibited), set(prohibited).intersection(ignored))
        self.assertTrue(set(required).isdisjoint(ignored))
        self.assertIn(".git", (ROOT / ".easignore").read_text(encoding="utf-8").splitlines())


if __name__ == "__main__":
    unittest.main()
