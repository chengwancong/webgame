"""Failure modes of the client core and its harnesses.

These are exactly the things that failed silently before: a file that does not
compile, a runner that never stops, and a log that grows without limit. Each of
them now has to fail loudly and quickly.
"""
from __future__ import annotations

import json
import re
import shutil
import tempfile
import time
from pathlib import Path

import pytest

from tests.conftest import godot_run, repo_root

CORE_COMPLETION_TIMEOUT = 90.0
OUTPUT_CAP = 400_000


def _extract(name: str, text: str) -> dict:
    match = re.search(rf'^{name} (\{{.*\}})$', text, re.M)
    assert match, f'no {name} line in output:\n{text[-1500:]}'
    return json.loads(match.group(1))


def test_every_client_source_compiles(tmp_path):
    result = godot_run('compile-client', 'res://tests/compile_all.gd',
                       expect_pattern=r'COMPILE_CHECK_OK', timeout_seconds=60.0, max_output_bytes=OUTPUT_CAP,
                       log_file=str(tmp_path / 'compile.log'))
    assert result.ok, result.reason


def test_headless_core_reaches_a_terminal_state_and_reports_it(tmp_path):
    started = time.monotonic()
    result = godot_run('core-headless', 'res://tests/battle_core_headless.gd',
                       expect_pattern=r'BATTLE_CORE_HEADLESS \{', timeout_seconds=CORE_COMPLETION_TIMEOUT,
                       max_output_bytes=OUTPUT_CAP, log_file=str(tmp_path / 'core.log'))
    assert result.ok, result.reason
    elapsed = time.monotonic() - started
    trace = _extract('BATTLE_CORE_HEADLESS', result.stdout)
    assert trace['source'] == 'fixture', 'without --spec only the offline fixture is used'
    assert trace['outcome'] in ('cleared', 'defeated')
    assert trace['tick'] > 0
    assert len(trace['events']) > 0
    assert {row['id'] for row in trace['snapshot']['actors']} == {'hero', 'raider_1', 'raider_2'}
    assert elapsed < CORE_COMPLETION_TIMEOUT, 'the contract: it must decide quickly or fail, never spin'


def test_a_broken_core_fails_fast_and_stays_inside_output_bounds(tmp_path):
    """Deliberately reintroduce the original defect and prove the harness stops."""
    client = repo_root() / 'client'
    sandbox = Path(tempfile.mkdtemp(prefix='awr-broken-', dir=tmp_path))
    for item in client.iterdir():
        if item.name == '.godot':
            continue
        target = sandbox / item.name
        shutil.copytree(item, target) if item.is_dir() else shutil.copy2(item, target)
    core = sandbox / 'combat/battle_core.gd'
    original = core.read_text()
    assert 'rounded(' not in original, 'the original defect must be gone before this test means anything'
    core.write_text(original.replace(
        '"x": snappedf(float(actor["x"]), precision),', '"x": rounded(float(actor["x"])),'))

    time_limit = 25.0
    started = time.monotonic()
    result = godot_run('core-broken', 'res://tests/battle_core_headless.gd', project_path=str(sandbox),
                       timeout_seconds=time_limit, max_output_bytes=OUTPUT_CAP,
                       log_file=str(tmp_path / 'broken.log'))
    elapsed = time.monotonic() - started
    shutil.rmtree(sandbox, ignore_errors=True)

    assert not result.ok, 'a core that cannot compile must not be reported as a pass'
    assert 'error output detected' in result.reason or result.returncode != 0, result.reason
    assert elapsed < time_limit, f'the failure took {elapsed:.1f}s; it must stop early'
    assert result.output_bytes <= OUTPUT_CAP, f'output grew to {result.output_bytes} bytes'
    assert result.log_bytes <= 8_000_000
