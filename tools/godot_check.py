"""Run one Godot harness with the same bounds the pipeline uses.

`make core-test` goes through here so a developer sees the same failure the
check sees: bounded time, bounded output, error patterns, and an expected
success marker instead of a bare exit code.
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import processguard  # noqa: E402

GODOT = os.environ.get('ABYSS_GODOT', '/Applications/Godot-4.7.app/Contents/MacOS/Godot')
HARNESSES = {
    'core': ('res://tests/battle_core_headless.gd', r'BATTLE_CORE_HEADLESS \{'),
    'compile': ('res://tests/compile_all.gd', r'COMPILE_CHECK_OK'),
    'visible': ('res://tests/visible_trace.gd', r'VISIBLE_TRACE \{'),
}


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in HARNESSES:
        raise SystemExit(f'usage: {sys.argv[0]} [{"|".join(HARNESSES)}] [-- spec-file]')
    name = sys.argv[1]
    script, marker = HARNESSES[name]
    extra = sys.argv[2:]
    with tempfile.TemporaryDirectory(prefix='awr-godot-') as run_dir:
        log_file = Path(run_dir) / 'godot.log'
        argv = [GODOT, '--headless', '--path', str(ROOT / 'client'), '--log-file', str(log_file),
                '--script', script, *extra]
        result = processguard.run_guarded(
            f'godot-{name}', argv, timeout_seconds=120, max_output_bytes=1_000_000,
            log_path=log_file, fail_patterns=processguard.GODOT_FAIL_PATTERNS,
            expect_pattern=marker)
    print(result.stdout.strip()[-4000:])
    if result.log_bytes:
        print(f'--- engine log: {result.log_bytes} bytes')
    if not result.ok:
        print(f'FAILED: {result.reason}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
