"""Disposable PostgreSQL lifecycle: start, wait, stop, delete.

Used two ways, both pointing at a throwaway cluster in a run directory:

* as a library, by the check pipeline that must manage its own database;
* as a foreground helper (`make db`) for development, which prints the DSN and
  tears the cluster down when it is interrupted.

It never points at a player database and never reuses an existing data
directory: every cluster is created in a fresh temporary directory and removed
again.
"""
from __future__ import annotations

import contextlib
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    # `make db` runs this file directly, so sys.path[0] is `tools/`, not the
    # repository root, and `from tools import runowner` below would fail with
    # ModuleNotFoundError in a terminal that has no PYTHONPATH set.
    sys.path.insert(0, str(ROOT))

from tools import runowner  # noqa: E402

BIN_DIR = Path(os.environ.get(
    'ABYSS_PG_BIN', str(Path.home() / '.local/share/abyss-walker-server/pgsql/18.6/bin')))
USER = 'aw_dev'
DATABASE = 'postgres'
OWNER_TOOL = 'tools/pgproc.py'


class StartedPostgres:
    def __init__(self, data_dir: Path, host: str, port: int, pid: int | None):
        self.data_dir = data_dir
        self.host = host
        self.port = port
        self.pid = pid

    @property
    def dsn(self) -> str:
        return f'dbname={DATABASE} user={USER} host={self.host} port={self.port}'

    def stop(self) -> dict:
        """Stop and delete, verifying first. Startup-failure path only."""
        return stop_and_delete(self)


def ensure_binaries() -> None:
    missing = [tool for tool in ('postgres', 'initdb', 'pg_ctl', 'pg_isready')
               if not (BIN_DIR / tool).exists()]
    if missing:
        raise SystemExit(
            f'PostgreSQL binaries missing in {BIN_DIR}: {", ".join(missing)}. '
            f'Set ABYSS_PG_BIN or install them before running any database-backed check.')


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(('127.0.0.1', 0))
        return int(probe.getsockname()[1])


def start(base_dir: str | Path | None = None, *, quiet: bool = True) -> StartedPostgres:
    """Start a throwaway cluster bound to 127.0.0.1 on a random free port.

    Loopback TCP instead of a Unix socket: the socket path limit (103 bytes) is
    exceeded as soon as the data directory lives inside a nested run directory.
    Host auth is trust, which is only acceptable because the cluster binds to
    the loopback interface, listens on a random port, holds no player data, and
    is deleted when the run ends.

    Clusters left behind by a killed process are reaped on the next start, so a
    hard kill cannot leak a running PostgreSQL forever.
    """
    ensure_binaries()
    reap_stale()
    if base_dir:
        Path(base_dir).mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix='awr-pg-', dir=str(base_dir) if base_dir else None))
    _mark_owner(work)
    data = work / 'data'
    port = free_port()
    try:
        _run_step([str(BIN_DIR / 'initdb'), '-D', str(data), f'--username={USER}',
                   '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--locale=C'],
                  quiet=quiet)
        _run_step([str(BIN_DIR / 'pg_ctl'), '-D', str(data), '-l', str(work / 'postgres.log'),
                   '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start'], quiet=quiet)
    except RuntimeError:
        # A half-built cluster must not be left behind: nothing is listening
        # yet, so stop what exists, delete what this tool owns, and report the
        # failure with the tail of the failing command.
        cleanup = stop_and_delete(StartedPostgres(data, '127.0.0.1', port, None))
        if not cleanup.get('removed'):
            raise RuntimeError(f'{cleanup}') from None
        raise
    started = StartedPostgres(data, '127.0.0.1', port, None)
    _wait_ready(started)
    return started


def _run_step(command: list[str], *, quiet: bool) -> None:
    """Run one cluster-building command; failure carries the output tail."""
    done = subprocess.run(command, capture_output=quiet, text=quiet)
    if done.returncode != 0:
        tail = ((done.stdout or '') if quiet else '').strip()[-400:]
        raise RuntimeError(f'{command[0]} failed with code {done.returncode}'
                           + (f': {tail}' if tail else ''))


def _wait_ready(cluster: StartedPostgres, timeout: float = 40.0) -> None:
    deadline = time.time() + timeout
    while time.time() < deadline:
        probe = subprocess.run(
            [str(BIN_DIR / 'pg_isready'), '-h', cluster.host, '-p', str(cluster.port),
             '-U', USER, '-d', DATABASE],
            check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if probe.returncode == 0:
            return
        time.sleep(0.2)
    entry = stop_and_delete(cluster)
    if not entry.get('removed'):
        raise SystemExit('temporary PostgreSQL did not become ready in time and its '
                         f'cluster could not be cleaned up: {entry}')
    raise SystemExit('temporary PostgreSQL did not become ready in time')


def _mark_owner(work: Path) -> None:
    """Record which process owns this cluster so a later run can reap it."""
    runowner.claim(work, OWNER_TOOL)


def _postmaster_pid(data: Path) -> int:
    """The pid recorded inside the data directory, or 0."""
    try:
        for line in (data / 'postmaster.pid').read_text().splitlines():
            if line.strip():
                return int(line.strip())
    except (OSError, ValueError):
        pass
    return 0


def _process_is_postgres(pid: int, data: Path) -> bool:
    """A PID alone can be reused; the command line must name postgres here."""
    if not pid:
        return False
    try:
        out = subprocess.run(['ps', '-p', str(pid), '-o', 'command='],
                             check=False, capture_output=True, text=True, timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        return False
    command = out.stdout.strip()
    return 'postgres' in command and str(data) in command


def stop_cluster_dir(work: Path) -> dict:
    """Stop a cluster rooted at this work directory and verify the stop.

    pg_ctl is the arbiter of whether a live postmaster exists; a process
    title is only ever a hint, because PostgreSQL rewrites its own argv.
    Returns a record instead of raising: a failed stop is reported and must
    never be counted as released space.
    """
    data = work / 'data'
    entry: dict = {'stopped': False, 'verified': False}
    if not data.exists():
        entry.update(stopped=True, verified=True, detail='no data directory')
        return entry
    if not (data / 'postmaster.pid').exists():
        entry.update(stopped=True, verified=True, detail='no postmaster.pid; nothing running')
        return entry
    try:
        result = subprocess.run([str(BIN_DIR / 'pg_ctl'), '-D', str(data), '-m', 'immediate', '-w', 'stop'],
                                check=False, capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.TimeoutExpired) as error:
        entry['error'] = f'pg_ctl stop could not run: {type(error).__name__}: {error}'
        return entry
    pid_gone = not (data / 'postmaster.pid').exists()
    entry['stopped'] = result.returncode == 0 or pid_gone
    entry['verified'] = pid_gone
    output = (result.stdout or result.stderr).strip()
    entry['detail'] = output.splitlines()[-1][:200] if output else ''
    if not entry['stopped'] or not entry['verified']:
        entry['error'] = f'pg_ctl stop returncode={result.returncode}, postmaster.pid gone={pid_gone}'
    return entry


def reap_stale() -> list[dict]:
    """Stop and delete clusters whose owning process no longer exists.

    Ownership comes from the runowner record, not the directory prefix; the
    search covers nested run directories, and symlinks are skipped. A cluster
    with a live owner is left alone.
    """
    return runowner.reap_stale('awr-pg-*', OWNER_TOOL, stopper=stop_cluster_dir)


def stop_and_measure(cluster: StartedPostgres) -> dict:
    """For the check pipeline: stop the cluster, verify it, measure the work dir.

    The bytes are counted before anything is removed, so the number is the real
    size of the resource even when the parent run directory removes it later.
    The work directory itself is deliberately kept here: the check pipeline
    owns its removal, and a stop that cannot be verified must not be followed by
    a delete (that would delete a live database's files).
    """
    work = cluster.data_dir.parent
    entry = {'resource': 'postgres', 'work_dir': str(work), 'data_dir': str(cluster.data_dir),
             'port': cluster.port, 'bytes': runowner.dir_size(work)}
    entry.update(stop_cluster_dir(work))
    return entry


def stop_and_delete(cluster: StartedPostgres) -> dict:
    """Stop the cluster, delete its work directory, and report the real bytes.

    `make dev` and `make db` have no outer directory removing the cluster for
    them, so they need a stop *and* a delete in one verified step:

    1. stop PostgreSQL and require the stop to be verified;
    2. delete only a directory this tool can prove it owns, never a symlink;
    3. re-measure afterwards, so `bytes_removed` is what actually went away and
       a partial delete is reported as a failure, not as released space.
    """
    entry = stop_and_measure(cluster)
    work = cluster.data_dir.parent
    if not (entry.get('stopped') and entry.get('verified')):
        entry.update(removed=False, bytes_after=None, bytes_removed=0, retained=str(work),
                     error=entry.get('error') or 'postgres stop was not verified; directory kept')
        return entry
    if work.is_symlink() or not runowner.is_owned(work, OWNER_TOOL):
        entry.update(removed=False, bytes_after=None, bytes_removed=0, retained=str(work),
                     error='refusing to delete a directory this tool does not own')
        return entry
    shutil.rmtree(work, ignore_errors=True)
    entry['removed'] = not work.exists()
    entry['bytes_after'] = runowner.dir_size(work) if work.exists() else 0
    entry['bytes_removed'] = max(0, entry['bytes'] - entry['bytes_after'])
    if not entry['removed'] or entry['bytes_after']:
        entry['retained'] = str(work)
        entry['error'] = (f'directory not fully removed: {entry["bytes_after"]} bytes '
                          f'still present in {work}')
    return entry


def serve() -> int:
    """Foreground development database. Any exit stops it and deletes the cluster."""
    cluster = start(quiet=False)
    pid_candidates = [p for p in (cluster.data_dir / 'postmaster.pid').read_text().splitlines() if p.strip()]
    cluster.pid = int(pid_candidates[0]) if pid_candidates else None

    def shutdown(signum, frame):  # noqa: ARG001 - signal handler signature
        raise KeyboardInterrupt(f'signal {signum}')

    for name in ('SIGTERM', 'SIGHUP', 'SIGINT'):
        with contextlib.suppress(ValueError, AttributeError):
            signal.signal(getattr(signal, name), shutdown)
    # flush=True: with stdout redirected to a file or a pipe, Python buffers
    # block-wise and the DSN would not appear until this process exits — which
    # is exactly the opposite of what a developer copying the DSN needs.
    print(f'ABYSS_DSN={cluster.dsn}', flush=True)
    print(f'data={cluster.data_dir}', flush=True)
    print('stopping stops PostgreSQL and deletes the cluster directory (Ctrl-C)', flush=True)
    try:
        while True:
            time.sleep(1.0)
    except (KeyboardInterrupt, SystemExit):
        pass
    finally:
        entry = stop_and_delete(cluster)
    if entry.get('stopped') and entry.get('verified') and entry.get('removed') and not entry.get('bytes_after'):
        print(f"database stopped and cluster deleted ({entry['bytes_removed']} bytes removed)",
              flush=True)
        return 0
    print(f'database cleanup FAILED: {entry.get("error") or entry}', file=sys.stderr, flush=True)
    print(f'left behind for inspection: {entry.get("retained") or cluster.data_dir.parent}',
          file=sys.stderr, flush=True)
    return 1


if __name__ == '__main__':
    sys.exit(serve())
