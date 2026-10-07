"""Exercise setup without contacting a Docker daemon or revealing configuration values."""

import os
from pathlib import Path
import re
import shutil
import subprocess
from tempfile import TemporaryDirectory
import unittest


class SetupTests(unittest.TestCase):
    def setUp(self):
        self.temporary = TemporaryDirectory(prefix="homarr-setup-test-")
        self.addCleanup(self.temporary.cleanup)
        self.directory = Path(self.temporary.name)
        shutil.copyfile(Path(__file__).with_name("setup.sh"), self.directory / "setup.sh")

    def run_setup(self, mode="--init-only", environment=None):
        return subprocess.run(
            ["bash", str(self.directory / "setup.sh"), mode],
            capture_output=True,
            text=True,
            env=environment,
        )

    def test_creates_a_restricted_key_and_preserves_it_on_repeat(self):
        self.assertEqual(self.run_setup().returncode, 0)
        original = (self.directory / ".env").read_bytes()
        self.assertIsNotNone(re.search(rb"^SECRET_ENCRYPTION_KEY=[0-9a-f]{64}$", original, re.M))
        self.assertEqual((self.directory / ".env").stat().st_mode & 0o777, 0o600)
        self.assertEqual(self.run_setup().returncode, 0)
        self.assertEqual((self.directory / ".env").read_bytes(), original)
        self.assertEqual(list(self.directory.glob(".env.tmp.*")), [])

    def test_refuses_to_replace_an_invalid_existing_key(self):
        original = "SECRET_ENCRYPTION_KEY=invalid\n"
        (self.directory / ".env").write_text(original)
        self.assertNotEqual(self.run_setup().returncode, 0)
        self.assertEqual((self.directory / ".env").read_text(), original)

    def test_concurrent_initialization_preserves_one_configuration(self):
        processes = [
            subprocess.Popen(
                ["bash", str(self.directory / "setup.sh"), "--init-only"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            for _ in range(6)
        ]
        for process in processes:
            _, error = process.communicate(timeout=30)
            self.assertEqual(process.returncode, 0, error)
        content = (self.directory / ".env").read_bytes()
        self.assertIsNotNone(re.search(rb"^SECRET_ENCRYPTION_KEY=[0-9a-f]{64}$", content, re.M))
        self.assertEqual(list(self.directory.glob(".env.tmp.*")), [])

    def test_compose_does_not_inherit_a_different_exported_key(self):
        self.assertEqual(self.run_setup().returncode, 0)
        original = (self.directory / ".env").read_bytes()
        commands = self.directory / "commands"
        tools = self.directory / "bin"
        tools.mkdir()
        docker = tools / "docker"
        docker.write_text(
            "#!/usr/bin/env bash\n"
            "if [[ -n ${SECRET_ENCRYPTION_KEY+x} ]]; then exit 47; fi\n"
            'printf "%s\\n" "$*" >> "$HOMARR_TEST_COMMANDS"\n'
        )
        docker.chmod(0o755)
        environment = dict(os.environ)
        environment.update({
            "PATH": str(tools) + os.pathsep + environment["PATH"],
            "SECRET_ENCRYPTION_KEY": "f" * 64,
            "HOMARR_TEST_COMMANDS": str(commands),
        })
        result = self.run_setup("--start", environment)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.directory / ".env").read_bytes(), original)
        self.assertIn("up --wait --wait-timeout 300", commands.read_text())


if __name__ == "__main__":
    unittest.main()
