"""Cleanup on every path, proven against real processes and directories.

These tests reproduce exactly the leaks the independent acceptance found:
an early return that skipped the scratch-directory removal, a nested
one-shot PostgreSQL that the reaper could not see, and a check run whose
report was saved before its cleanup was measured. Nothing here is stubbed:
clusters are real, kills are real, and the assertions read filesystem and
process state.
"""
from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

from tools import processguard, runowner  # noqa: E402

PYTHON = str(ROOT / '.venv' / 'bin' / 'python') if (ROOT / '.venv' / 'bin' / 'python').exists() \
    else sys.executable


def _awr_run_dirs() -> set[str]:
    root = Path(tempfile.gettempdir())
    return {str(p) for p in root.glob('awr-run-*') if p.is_dir()}


def test_run_guarded_cleans_up_when_the_executable_is_missing():
    """The old code returned early on FileNotFoundError and leaked awr-run-*."""
    before = _awr_run_dirs()
    result = processguard.run_guarded('missing', [str(ROOT / 'no' / 'such' / 'tool')],
                                      timeout_seconds=10)
    assert not result.ok
    assert 'command not found' in result.reason
    assert _awr_run_dirs() - before == set(), 'the scratch directory must not leak'


def test_run_guarded_cleans_up_on_timeout():
    before = _awr_run_dirs()
    result = processguard.run_guarded('slow', ['sleep', '30'], timeout_seconds=2.0)
    assert not result.ok
    assert result.timed_out
    assert _awr_run_dirs() - before == set()


def test_run_guarded_cleans_up_on_output_overflow():
    before = _awr_run_dirs()
    result = processguard.run_guarded(
        'loud', [PYTHON, '-c', 'import time\nwhile True:\n    print("x" * 4096, flush=True)\n    time.sleep(0.01)'],
        timeout_seconds=30, max_output_bytes=100_000)
    assert not result.ok
    assert result.output_overflow
    assert _awr_run_dirs() - before == set()


def test_reaper_recovers_an_orphaned_nested_cluster():
    """A cluster started by a child that died without stopping it.

    The cluster is nested exactly like a check run's (awr-check-*/awr-pg-*),
    the owning helper process is really gone, and the reaper must stop
    PostgreSQL (verified), remove the directory, and report the bytes.
    """
    import psycopg

    from tools import pgproc

    nested_base = Path(tempfile.mkdtemp(prefix='awr-check-orphan-'))
    nested = nested_base / 'awr-check-sim'
    nested.mkdir()
    child_script = (
        "import sys; sys.path.insert(0, %r); sys.path.insert(0, %r)\n"
        "from tools import pgproc\n"
        "cluster = pgproc.start(base_dir=%r, quiet=True)\n"
        "print(cluster.port)\n" % (str(ROOT), str(ROOT / '.venv' / 'lib' / 'python3.12' / 'site-packages'), str(nested))
    )
    try:
        child = subprocess.run([PYTHON, '-c', child_script], capture_output=True, text=True,
                               timeout=180, cwd=str(ROOT))
        assert child.returncode == 0, f'cluster start failed: {child.stderr[-800:]}'
        port = int(child.stdout.strip().splitlines()[-1])

        def _port_open() -> bool:
            with socket.socket() as probe:
                probe.settimeout(1.0)
                return probe.connect_ex(('127.0.0.1', port)) == 0

        assert _port_open(), 'the orphan cluster must be running before the reap'
        with psycopg.connect(f'dbname=postgres user=aw_dev host=127.0.0.1 port={port}',
                             connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                assert cursor.fetchone()[0] == 1

        records = pgproc.reap_stale()
        mine = [r for r in records if r.get('path') == str(nested / 'data').rsplit('/data', 1)[0]
                or r.get('path', '').startswith(str(nested))]
        assert mine, f'the nested orphan must be found and reaped: {records[-3:]}'
        entry = mine[0]
        assert entry.get('stopped') and entry.get('verified'), entry
        assert entry.get('removed') is True, entry
        assert not (nested / 'data').exists()
        assert not _port_open(), 'the reaper must have stopped PostgreSQL'
    finally:
        import shutil
        shutil.rmtree(nested_base, ignore_errors=True)


def test_check_failure_path_cleans_up_and_reports(tmp_path):
    """A real aborted check run: report saved last, cleanup measured, no leftovers."""
    report_path = ROOT / 'docs/reviews/m0-check-report.json'
    saved_report = report_path.read_bytes() if report_path.exists() else None
    env = {**os.environ,
           'ABYSS_CHECK_FAIL_AFTER': 'postgres',
           'PYTHONDONTWRITEBYTECODE': '1'}
    env.pop('ABYSS_DSN', None)
    started = time.monotonic()
    try:
        proc = subprocess.run([PYTHON, str(ROOT / 'tools/check.py')], cwd=str(ROOT), env=env,
                              capture_output=True, text=True, timeout=420)
        elapsed = time.monotonic() - started
        assert proc.returncode == 1, f'expected the injected failure: {proc.stdout[-1500:]}'
        assert elapsed < 420
        report = json.loads(report_path.read_text(encoding='utf-8'))
        assert report['ok'] is False
        assert 'injected failure' in report.get('aborted', '')
        steps = [entry['name'] for entry in report['steps']]
        assert 'postgres' in steps, steps
        cleanup = report['cleanup']
        assert cleanup['before_bytes'] > 0, 'bytes must be measured before removal'
        assert cleanup['removed'] is True
        assert cleanup['after_bytes'] == 0
        assert cleanup['errors'] == [], cleanup['errors']
        postgres_entries = [e for e in cleanup['entries'] if e.get('resource') == 'postgres']
        assert postgres_entries and postgres_entries[0]['stopped'] and postgres_entries[0]['verified']
        assert postgres_entries[0]['bytes'] > 0

        leftovers = runowner.reap_stale('awr-check-*', 'tools/check.py')
        assert leftovers == [], f'an aborted run must not leave owned directories: {leftovers}'
    finally:
        if saved_report is not None:
            report_path.write_bytes(saved_report)
