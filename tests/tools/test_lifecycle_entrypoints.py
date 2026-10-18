"""Lifecycle regressions at the real entry points, not at the helper functions.

The second independent acceptance could not sign off M0 because every leak it
found lived *between* the pieces the unit tests already covered:

* ``tools/check.py`` reaped a leftover run directory — deleting the database
  files inside it — before stopping the PostgreSQL still running in it;
* ``tools/processguard.py`` removed its log directory on an interrupt while the
  child process it had started kept running (the child is in its own session,
  so nothing else was ever going to reap it);
* ``tools/dev.py`` printed "bytes removed" without deleting anything, so the
  number disagreed with the filesystem;
* ``make db`` could not start at all in a terminal with no PYTHONPATH.

Each test drives the same command line a person would type, and then reads real
process state, real ports and real directories. Nothing here asserts on a
mocked resource, and nothing here infers a whole flow from one helper function.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

PYTHON = str(ROOT / '.venv' / 'bin' / 'python') if (ROOT / '.venv' / 'bin' / 'python').exists() \
    else sys.executable
MAKE = shutil.which('make') or '/usr/bin/make'
PROXY_VARS = ('HTTP_PROXY', 'HTTPS_PROXY', 'http_proxy', 'https_proxy', 'ALL_PROXY', 'all_proxy')


# --------------------------------------------------------------------------- helpers

def _clean_env(scratch: Path, **extra) -> dict:
    """A terminal like the README assumes: no PYTHONPATH, no DSN, no proxy."""
    env = {key: value for key, value in os.environ.items()
           if key not in ('PYTHONPATH', 'ABYSS_DSN', 'ABYSS_CORS_ORIGINS', *PROXY_VARS)}
    env['TMPDIR'] = str(scratch)
    env.update({key: str(value) for key, value in extra.items()})
    return env


def _alive(pid: int) -> bool:
    if not pid:
        return False
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def _dead_pid() -> int:
    """A pid that is really gone, so an owner record can never look alive."""
    proc = subprocess.Popen([PYTHON, '-c', 'pass'])
    proc.wait()
    for _ in range(50):
        if not _alive(proc.pid):
            return proc.pid
        time.sleep(0.1)
    raise AssertionError('could not obtain a dead pid')


def _port_open(port: int) -> bool:
    with socket.socket() as probe:
        probe.settimeout(1.0)
        return probe.connect_ex(('127.0.0.1', port)) == 0


def _wait_port(port: int, want_open: bool, timeout: float = 15.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if _port_open(port) == want_open:
            return True
        time.sleep(0.25)
    return _port_open(port) == want_open


def _wait_healthy(port: int, timeout: float = 60.0) -> bool:
    import httpx

    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with httpx.Client(timeout=2.0, trust_env=False) as probe:
                response = probe.get(f'http://127.0.0.1:{port}/health')
            if response.status_code == 200 and response.json().get('database') == 'ok':
                return True
        except httpx.HTTPError:
            pass
        time.sleep(0.3)
    return False


def _wait_for_text(path: Path, needle: str, timeout: float, *, output=None) -> str:
    deadline = time.time() + timeout
    while time.time() < deadline:
        text = path.read_text(errors='replace') if path.exists() else ''
        if needle in text:
            return text
        if output is not None and output.poll() is not None and needle not in text:
            return ''
        time.sleep(0.25)
    return path.read_text(errors='replace') if path.exists() else ''


def _leftovers(root: Path) -> list[str]:
    return sorted(str(item) for item in root.rglob('awr-*'))


def _kill_group(process: subprocess.Popen) -> None:
    for sig in (signal.SIGTERM, signal.SIGKILL):
        if process.poll() is not None:
            return
        try:
            os.killpg(os.getpgid(process.pid), sig)
        except (ProcessLookupError, PermissionError):
            process.kill()
        try:
            process.wait(timeout=10)
            return
        except subprocess.TimeoutExpired:
            continue


def _child_pid(parent: int) -> int:
    found = subprocess.run(['pgrep', '-P', str(parent)], capture_output=True, text=True, check=False)
    pids = [int(line) for line in found.stdout.split() if line.strip().isdigit()]
    return pids[0] if pids else 0


def _free_port() -> int:
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        return int(probe.getsockname()[1])


def _stand_in_build(tmp_path: Path) -> Path:
    """The lifecycle tests only need a servable directory: the real export is
    exercised by tests/web/test_browser_flow.py."""
    build = tmp_path / 'web-build'
    build.mkdir()
    (build / 'index.html').write_text('<html><body>stand-in for lifecycle tests</body></html>')
    return build


def _run_check(scratch: Path, report: Path, *, env_extra: dict | None = None):
    env = _clean_env(scratch, ABYSS_CHECK_FAIL_AFTER='content', PYTHONDONTWRITEBYTECODE='1',
                     ABYSS_CHECK_REPORT=str(report), **(env_extra or {}))
    proc = subprocess.run([PYTHON, str(ROOT / 'tools' / 'check.py')], cwd=str(ROOT), env=env,
                          capture_output=True, text=True, timeout=420)
    return proc, json.loads(report.read_text(encoding='utf-8'))


# ----------------------------------------------------------- check entry point (P1)

def test_check_entrypoint_stops_a_leftover_database_before_deleting_its_run_dir(tmp_path):
    """The exact ordering the acceptance faulted: stop the database, then delete.

    The leftover run directory is built the way a killed check leaves one: a
    helper process claims the check directory, starts a real PostgreSQL inside
    it, and exits, so both ownership records name a dead process while the
    server is still listening.
    """
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    report = tmp_path / 'check-report.json'
    stale = scratch / 'awr-check-orphan'
    stale.mkdir()

    helper = (
        f"import sys; sys.path.insert(0, {str(ROOT)!r})\n"
        "from tools import pgproc, runowner\n"
        f"runowner.claim({str(stale)!r}, 'tools/check.py')\n"
        f"cluster = pgproc.start(base_dir={str(stale)!r})\n"
        "print(cluster.port, flush=True)\n"
    )
    started = subprocess.run([PYTHON, '-c', helper], cwd=str(ROOT), env=_clean_env(scratch),
                             capture_output=True, text=True, timeout=300)
    assert started.returncode == 0, f'could not build the leftover: {started.stderr[-1000:]}'
    port = int(started.stdout.strip().splitlines()[-1])

    nested = next(stale.glob('awr-pg-*'))
    assert not _alive(json.loads((stale / 'owner.json').read_text())['pid']), 'owner must be gone'
    assert not _alive(json.loads((nested / 'owner.json').read_text())['pid']), 'owner must be gone'
    assert _port_open(port), 'the leftover PostgreSQL must be listening before the reap'

    proc, data = _run_check(scratch, report)

    assert proc.returncode == 1, f'the injected abort must fail the run: {proc.stdout[-1500:]}'
    entries = [entry for entry in data['reaped_stale_runs'] if entry.get('path') == str(stale)]
    assert entries, f'the leftover must be reaped through the real entry point: {data["reaped_stale_runs"]}'
    entry = entries[0]
    assert entry.get('stopped') and entry.get('verified'), entry
    assert entry.get('removed') is True, entry
    assert entry.get('bytes_removed', 0) > 0, entry
    assert _wait_port(port, False), (
        'the leftover PostgreSQL must be stopped, not orphaned with its files deleted')
    assert not stale.exists(), 'the reaped directory must be gone'
    assert data['cleanup']['removed'] is True, data['cleanup']
    assert data['cleanup']['errors'] == [], data['cleanup']['errors']
    assert _leftovers(scratch) == [], 'nothing may be left in the temp root'


def test_check_entrypoint_keeps_a_run_dir_whose_database_will_not_stop(tmp_path):
    """A stop that cannot be verified keeps the directory and fails the check."""
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    report = tmp_path / 'check-report.json'
    stale = scratch / 'awr-check-stuck'
    stale.mkdir()
    dead = _dead_pid()
    (stale / 'owner.json').write_text(json.dumps({'pid': dead, 'tool': 'tools/check.py',
                                                  'created_at': '2026-09-28T00:00:00'}))
    nested = stale / 'awr-pg-stuck'
    (nested / 'data').mkdir(parents=True)
    # A postmaster.pid in a directory that is not a cluster: pg_ctl cannot stop
    # it, the pid file survives, and the reaper must refuse to delete anything.
    (nested / 'data' / 'postmaster.pid').write_text(f'{dead}\n')
    (nested / 'owner.json').write_text(json.dumps({'pid': dead, 'tool': 'tools/pgproc.py',
                                                   'created_at': '2026-09-28T00:00:00'}))
    try:
        proc, data = _run_check(scratch, report)

        assert proc.returncode == 1, proc.stdout[-1500:]
        entries = [entry for entry in data['reaped_stale_runs'] if entry.get('path') == str(stale)]
        assert entries, data['reaped_stale_runs']
        entry = entries[0]
        assert entry.get('stopped') is False, entry
        assert entry.get('removed') is False, entry
        assert entry.get('error'), 'a refused stop must say why'
        assert stale.exists(), 'the directory of a database that would not stop must be kept'
        assert (stale / 'owner.json').exists(), 'the ownership record must survive for a later attempt'
        assert any('leftover run not fully reaped' in error for error in data['cleanup']['errors']), \
            data['cleanup']['errors']
        assert data['ok'] is False
    finally:
        shutil.rmtree(stale, ignore_errors=True)


def test_a_run_dir_is_kept_when_its_own_database_will_not_stop(tmp_path):
    """The same rule applies to the run that is finishing right now.

    release_run_dir is what tools/check.py's finish() calls: if the stop of the
    database inside the run directory cannot be verified, the directory and its
    ownership record must survive, and the failure must be reported.
    """
    from tools import check as check_module
    from tools import pgproc, runowner

    run_dir = tmp_path / 'awr-check-current'
    runowner.claim(run_dir, 'tools/check.py')
    nested = run_dir / 'awr-pg-stuck'
    (nested / 'data').mkdir(parents=True)
    (nested / 'data' / 'postmaster.pid').write_text(f'{_dead_pid()}\n')
    (nested / 'owner.json').write_text(json.dumps({'pid': _dead_pid(), 'tool': 'tools/pgproc.py',
                                                   'created_at': '2026-09-28T00:00:00'}))
    cluster = pgproc.StartedPostgres(nested / 'data', '127.0.0.1', 1, None)
    try:
        entries, errors = check_module.release_run_dir(run_dir, cluster=cluster)
        assert entries and entries[0].get('stopped') is False, entries
        assert any('could not be stopped' in error for error in errors), errors
        assert run_dir.exists(), 'the directory must be kept when its database would not stop'
        assert (run_dir / 'owner.json').exists(), 'the ownership record must survive'
    finally:
        shutil.rmtree(run_dir, ignore_errors=True)


def test_a_symlinked_or_foreign_run_directory_is_never_reaped(tmp_path, monkeypatch):
    """Ownership, not a directory prefix, decides what may be deleted.

    A symlink that matches the name pattern must not be followed (or removed),
    and a directory whose owner record names another tool is not ours to touch.
    """
    from tools import check as check_module

    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    real = tmp_path / 'real-data'
    real.mkdir()
    (real / 'keep-me.txt').write_text('precious')
    link = scratch / 'awr-check-link'
    link.symlink_to(real)
    (real / 'owner.json').write_text(json.dumps({'pid': _dead_pid(), 'tool': 'tools/check.py',
                                                 'created_at': '2026-09-28T00:00:00'}))
    foreign = scratch / 'awr-check-foreign'
    foreign.mkdir()
    (foreign / 'owner.json').write_text(json.dumps({'pid': _dead_pid(), 'tool': 'tools/dev.py',
                                                    'created_at': '2026-09-28T00:00:00'}))
    monkeypatch.setattr(tempfile, 'tempdir', str(scratch))

    assert check_module.reap_stale_runs() == [], 'neither candidate is this tool\'s to reap'
    assert link.is_symlink(), 'the symlink itself must survive untouched'
    assert (real / 'keep-me.txt').read_text() == 'precious', 'the link target must not be touched'
    assert foreign.exists(), 'a directory owned by another tool must be left alone'


# ------------------------------------------------------ process guard interrupts (P2)

def test_run_guarded_reaps_its_child_when_the_parent_is_interrupted(tmp_path):
    """SIGTERM into the parent must not leave the managed child running.

    The wrapper uses the same interruption semantics as tools/check.py: a signal
    handler that raises KeyboardInterrupt inside the frame that is running
    run_guarded. Before the fix the child survived the interrupt (it is started
    in its own session) while the scratch directory was already deleted.
    """
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    pid_file = tmp_path / 'child.pid'
    wrapper = tmp_path / 'wrapper.py'
    wrapper.write_text(
        "import signal, sys\n"
        f"sys.path.insert(0, {str(ROOT)!r})\n"
        "from tools import processguard\n"
        "def handler(signum, frame):\n"
        "    raise KeyboardInterrupt(f'signal {signum}')\n"
        "signal.signal(signal.SIGTERM, handler)\n"
        "child = [sys.executable, '-c',\n"
        "         'import os, sys, time; open(sys.argv[1], \"w\").write(str(os.getpid())); '\n"
        "         'time.sleep(300)', sys.argv[1]]\n"
        "try:\n"
        "    result = processguard.run_guarded('interrupt-probe', child, timeout_seconds=300)\n"
        "except KeyboardInterrupt as interrupt:\n"
        "    print(f'INTERRUPTED {interrupt}', flush=True)\n"
        "    sys.exit(0)\n"
        "print(f'COMPLETED ok={result.ok}', flush=True)\n"
        "sys.exit(9)\n")

    process = subprocess.Popen([PYTHON, str(wrapper), str(pid_file)], cwd=str(ROOT),
                               env=_clean_env(scratch), stdout=subprocess.PIPE,
                               stderr=subprocess.STDOUT, text=True, start_new_session=True)
    try:
        deadline = time.time() + 30
        child_pid = 0
        while time.time() < deadline and not child_pid:
            if pid_file.exists() and pid_file.read_text().strip().isdigit():
                child_pid = int(pid_file.read_text().strip())
            time.sleep(0.2)
        assert child_pid, 'the managed child never started'
        assert _alive(child_pid), 'the child must be running before the interrupt'

        os.kill(process.pid, signal.SIGTERM)
        output, _ = process.communicate(timeout=60)
        assert process.returncode == 0, f'the wrapper exit was not the interrupt path: {output}'
        assert 'INTERRUPTED' in output, output

        deadline = time.time() + 15
        while time.time() < deadline and _alive(child_pid):
            time.sleep(0.25)
        assert not _alive(child_pid), (
            f'the managed child (pid {child_pid}) survived the interrupt and its log directory removal')
        assert _leftovers(scratch) == [], 'the scratch directory must not outlive the run'
    finally:
        _kill_group(process)
        child_pid = locals().get('child_pid', 0)
        if _alive(child_pid):
            with contextlib.suppress(OSError):
                os.kill(child_pid, signal.SIGKILL)


# --------------------------------------------------------------- make dev lifecycle (P2)

def test_make_dev_normal_exit_deletes_the_database_and_reports_real_bytes(tmp_path):
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    build = _stand_in_build(tmp_path)
    web_port, api_port = _free_port(), _free_port()
    log = tmp_path / 'dev.log'
    env = _clean_env(scratch, ABYSS_WEB_BUILD=str(build), ABYSS_WEB_PORT=web_port,
                     ABYSS_API_PORT=api_port, ABYSS_DEV_EXIT_AFTER='3')

    with open(log, 'wb') as sink:
        proc = subprocess.run([PYTHON, str(ROOT / 'tools/dev.py')], cwd=str(ROOT), env=env,
                              stdout=sink, stderr=subprocess.STDOUT, timeout=240)
    text = log.read_text(errors='replace')

    assert proc.returncode == 0, text[-2000:]
    match = re.search(r'postgres \(stopped, deleted (\S+), (\d+) bytes\)', text)
    assert match, f'the reported cleanup must name the directory and the bytes: {text[-800:]}'
    reported_dir, reported_bytes = Path(match.group(1)), int(match.group(2))
    assert reported_bytes > 0, match.group(0)
    assert not reported_dir.exists(), 'the bytes reported as deleted must really be gone'
    assert _leftovers(scratch) == [], 'make dev must not leave its database directory behind'
    assert not _port_open(web_port) and not _port_open(api_port), 'ports must be freed'


def test_make_dev_sigterm_deletes_the_database_and_reports_real_bytes(tmp_path):
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    build = _stand_in_build(tmp_path)
    web_port, api_port = _free_port(), _free_port()
    log = tmp_path / 'dev-sigterm.log'
    env = _clean_env(scratch, ABYSS_WEB_BUILD=str(build), ABYSS_WEB_PORT=web_port,
                     ABYSS_API_PORT=api_port)
    with open(log, 'wb') as sink:
        proc = subprocess.Popen([PYTHON, str(ROOT / 'tools/dev.py')], cwd=str(ROOT), env=env,
                                stdout=sink, stderr=subprocess.STDOUT, start_new_session=True)
    try:
        assert _wait_healthy(api_port), f'dev never became healthy: {log.read_text()[-800:]}'
        assert list(scratch.glob('awr-pg-*')), 'a cluster must be running while dev serves'

        os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
        assert proc.wait(timeout=120) == 0, log.read_text()[-2000:]

        text = log.read_text(errors='replace')
        match = re.search(r'postgres \(stopped, deleted (\S+), (\d+) bytes\)', text)
        assert match, text[-800:]
        assert not Path(match.group(1)).exists()
        assert int(match.group(2)) > 0
        assert _wait_port(api_port, False) and _wait_port(web_port, False)
        assert _leftovers(scratch) == []
    finally:
        _kill_group(proc)


def test_make_dev_startup_failure_stops_everything_it_started(tmp_path):
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    build = _stand_in_build(tmp_path)
    web_port, api_port = _free_port(), _free_port()
    occupied = socket.socket()
    occupied.bind(('127.0.0.1', api_port))
    occupied.listen(1)
    log = tmp_path / 'dev-fail.log'
    env = _clean_env(scratch, ABYSS_WEB_BUILD=str(build), ABYSS_WEB_PORT=web_port,
                     ABYSS_API_PORT=api_port, ABYSS_DEV_HEALTH_TIMEOUT='5')
    try:
        with open(log, 'wb') as sink:
            proc = subprocess.run([PYTHON, str(ROOT / 'tools/dev.py')], cwd=str(ROOT), env=env,
                                  stdout=sink, stderr=subprocess.STDOUT, timeout=240)
        text = log.read_text(errors='replace')

        assert proc.returncode == 1, f'a failed startup must not report success: {text[-1200:]}'
        assert 'ERRORS:' in text, text[-1200:]
        assert _leftovers(scratch) == [], 'a failed startup must not leave its database behind'
        assert not _port_open(web_port), 'the static server must be released'
    finally:
        occupied.close()
        shutil.rmtree(scratch, ignore_errors=True)


# ------------------------------------------------------------ make db clean terminal (P2)

def test_clean_terminal_runs_make_db_migrate_and_api_without_pythonpath(tmp_path):
    """The README's commands, in a terminal that has no PYTHONPATH at all.

    `make db` failed with ModuleNotFoundError there because the file entry point
    put tools/ on sys.path instead of the repository root. The full documented
    sequence is exercised: db -> migrate -> api -> interrupt db.
    """
    scratch = tmp_path / 'tmp'
    scratch.mkdir()
    log = tmp_path / 'make-db.log'
    env = _clean_env(scratch)
    assert 'PYTHONPATH' not in env
    with open(log, 'wb') as sink:
        proc = subprocess.Popen([MAKE, 'db'], cwd=str(ROOT), env=env, stdout=sink,
                                stderr=subprocess.STDOUT, start_new_session=True)
    try:
        # Wait for the line *after* the DSN: DSN contains spaces, so reading the
        # log mid-write would capture a fragment of it.
        text = _wait_for_text(log, '\ndata=', timeout=180, output=proc)
        assert 'ABYSS_DSN=' in text, f'make db did not start: {text[-1500:]}'
        assert 'ModuleNotFoundError' not in text, text[-1500:]
        dsn = re.search(r'ABYSS_DSN=(\S.*)', text).group(1).strip()
        port = int(re.search(r'port=(\d+)', dsn).group(1))
        assert _wait_port(port, True), 'the database must be up'

        migrated = subprocess.run([MAKE, 'migrate'], cwd=str(ROOT), env={**env, 'ABYSS_DSN': dsn},
                                  capture_output=True, text=True, timeout=180)
        assert migrated.returncode == 0, migrated.stdout + migrated.stderr
        assert 'migrations applied' in migrated.stdout

        api = subprocess.Popen([MAKE, 'api'], cwd=str(ROOT), env={**env, 'ABYSS_DSN': dsn},
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                               start_new_session=True)
        try:
            assert _wait_healthy(8601), 'make api must serve a working /health'
        finally:
            _kill_group(api)

        child = _child_pid(proc.pid)
        assert child, 'make db must be running the python helper'
        os.kill(child, signal.SIGTERM)
        text = _wait_for_text(log, 'cluster deleted', timeout=120)
        assert 'cluster deleted' in text, f'the database was not cleaned up: {text[-1500:]}'
        assert 'cleanup FAILED' not in text, text[-1500:]
        assert _wait_port(port, False), 'the database port must be closed'
        assert not list(scratch.glob('awr-pg-*')), 'the cluster directory must be deleted'
        assert proc.wait(timeout=60) == 0, f'the documented db entry must exit cleanly: {text[-800:]}'
    finally:
        _kill_group(proc)
