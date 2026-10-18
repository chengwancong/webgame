"""Create the project virtualenv and install the locked dependencies.

Refuses to continue on an unsupported interpreter: "it installed" is not the
same as "it is the version this project pins". Run directly, not via make.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REQUIRED_MINOR = (3, 12)


def main() -> int:
    if sys.version_info[:2] != REQUIRED_MINOR:
        raise SystemExit(
            f'Python {REQUIRED_MINOR[0]}.{REQUIRED_MINOR[1]}.x is required for this project, '
            f'found {sys.version.split()[0]} at {sys.executable}.')
    venv = ROOT / '.venv'
    if not (venv / 'bin' / 'python').exists():
        subprocess.run([sys.executable, '-m', 'venv', str(venv)], check=True, cwd=ROOT)
    python = str(venv / 'bin' / 'python')
    subprocess.run([python, '-m', 'pip', 'install', '--upgrade', 'pip'], check=True, cwd=ROOT,
                   stdout=subprocess.DEVNULL)
    subprocess.run([python, '-m', 'pip', 'install', '-r', 'server/requirements.lock.txt'],
                   check=True, cwd=ROOT)
    subprocess.run([python, '-c', 'import psycopg_pool, psycopg, fastapi; print("dependencies ok")'],
                   check=True, cwd=ROOT)
    print(f'setup complete with {python}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
