"""Remove this project's transient artifacts and report the freed size.

Scope is deliberately narrow: build outputs, engine caches and run leftovers of
this repository only. It never touches user files, other projects, or anything
outside the repository directory.
"""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = ('.venv', 'web-build', 'client/.godot', 'content/build', 'client/data',
           '.pytest_cache', '__pycache__')


def tree_size(path: Path) -> int:
    total = 0
    for item in path.rglob('*'):
        try:
            if item.is_file():
                total += item.stat().st_size
        except OSError:
            continue
    return total


def main() -> int:
    before = 0
    after = 0
    for name in TARGETS:
        target = ROOT / name
        if not target.exists():
            continue
        size = tree_size(target)
        before += size
        shutil.rmtree(target, ignore_errors=True)
        remaining = tree_size(target) if target.exists() else 0
        after += remaining
        print(f'removed {name}: {size - remaining} bytes')
    print(f'freed {before - after} bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main())
