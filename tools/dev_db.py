"""Disposable development PostgreSQL. Never points at a player or test-of-record database."""
from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

BIN = Path.home() / '.local/share/abyss-walker-server/pgsql/18.6/bin'
PORT = 55501


def main() -> int:
    if not (BIN / 'postgres').exists():
        raise SystemExit('PostgreSQL binaries not found; install them before starting a dev database')
    work = Path(tempfile.mkdtemp(prefix='awr-pg-'))
    sockets = work / 'socket'
    sockets.mkdir(mode=0o700)
    try:
        subprocess.run([str(BIN / 'initdb'), '-D', str(work / 'data'), '--username=aw_dev',
                        '--auth-local=trust', '--auth-host=reject', '--encoding=UTF8', '--locale=C'],
                       check=True, stdout=subprocess.DEVNULL)
        subprocess.run([str(BIN / 'pg_ctl'), '-D', str(work / 'data'), '-l', str(work / 'postgres.log'),
                        '-o', f"-h '' -k {sockets} -p {PORT}", '-w', 'start'], check=True)
        print(f"ABYSS_DSN=dbname=postgres user=aw_dev host={sockets} port={PORT}")
        print(f"data={work}")
        print('press Ctrl-C to stop')
        try:
            subprocess.run(['sleep', 'infinity'], check=True)
        except KeyboardInterrupt:
            pass
        finally:
            subprocess.run([str(BIN / 'pg_ctl'), '-D', str(work / 'data'), '-m', 'fast', '-w', 'stop'],
                           check=True, stdout=subprocess.DEVNULL)
    finally:
        shutil.rmtree(work, ignore_errors=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
