"""The M0 check pipeline: one command that either proves the milestone or fails.

It manages its own world and puts it back the way it found it:

1. build and validate content;
2. compile every client source under the locked Godot, with error detection that
   does not trust exit codes;
3. export the real Web build;
4. start a disposable PostgreSQL in a run directory;
5. apply migrations through the documented entry point;
6. run the whole test suite against real processes, where every database-backed
   test is required to run (a skip is a failure);
7. stop the database, delete the run directory, and report.

Cleanup runs on every path — success, a failed step, an interrupt — before the
report is written, and the report records what was actually measured and
removed. A cleanup that fails is a failed check: the run directory is kept, the
reason is recorded, and the exit code is non-zero. ABYSS_CHECK_FAIL_AFTER=<step>
aborts after a named step; it exists so the failure-path cleanup can be tested
for real instead of trusted.

Resources are torn down in dependency order. A leftover run directory from a
dead check process still holds a database inside it, so the reaper stops and
verifies every cluster in the directory *before* the directory itself is
removed — deleting first would delete a running database's files and lose the
only handle used to stop it.

Timeouts, output caps and log caps come from tools/processguard. Nothing here
replaces a test with a mock.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import shutil
import signal
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import pgproc, processguard, runowner  # noqa: E402
from tools.web_check import run_browser_flow, serve  # noqa: E402
from tests.conftest import start_api, stop_process, http_client, unique_login, STRONG_PASSWORD  # noqa: E402

PY = str(ROOT / '.venv' / 'bin' / 'python')
GODOT = os.environ.get('ABYSS_GODOT', '/Applications/Godot-4.7.app/Contents/MacOS/Godot')
TOTAL_TIMEOUT = 900.0
OWNER_TOOL = 'tools/check.py'

REQUIRED_TESTS = (
    'tests/server/test_identity_boundary.py::test_health_and_version_report_the_real_state',
    'tests/server/test_identity_boundary.py::test_registering_a_taken_login_is_not_a_login',
    'tests/server/test_identity_boundary.py::test_wrong_password_is_refused_everywhere',
    'tests/server/test_identity_boundary.py::test_unauthenticated_reads_and_writes_are_refused',
    'tests/server/test_identity_boundary.py::test_garbage_and_revoked_sessions_are_refused',
    'tests/server/test_identity_boundary.py::test_client_supplied_account_id_is_not_accepted',
    'tests/server/test_identity_boundary.py::test_another_account_cannot_read_the_character',
    'tests/server/test_identity_boundary.py::test_owner_sees_the_character_and_the_right_battle_spec',
    'tests/server/test_first_write.py::test_same_command_id_does_not_create_twice',
    'tests/server/test_first_write.py::test_same_command_id_with_different_payload_is_refused',
    'tests/server/test_first_write.py::test_lost_response_then_retry_returns_the_same_receipt',
    'tests/server/test_first_write.py::test_concurrent_duplicate_commands_produce_one_change',
    'tests/server/test_first_write.py::test_failed_business_write_rolls_back_everything',
    'tests/server/test_first_write.py::test_duplicate_character_name_in_same_account_is_a_controlled_result',
    'tests/server/test_first_write.py::test_api_restart_preserves_characters_and_receipts',
    'tests/core/test_core_failure_modes.py::test_every_client_source_compiles',
    'tests/core/test_core_failure_modes.py::test_headless_core_reaches_a_terminal_state_and_reports_it',
    'tests/core/test_core_failure_modes.py::test_a_broken_core_fails_fast_and_stays_inside_output_bounds',
    'tests/core/test_terminal_blow.py::test_default_sample_still_reaches_a_complete_terminal_state',
    'tests/core/test_terminal_blow.py::test_the_original_acceptance_repro_spec_ends_with_a_complete_killing_tick',
    'tests/core/test_terminal_blow.py::test_a_low_hp_last_enemy_variant_keeps_the_killing_tick',
    'tests/core/test_terminal_blow.py::test_a_single_skill_kills_the_last_enemy',
    'tests/core/test_terminal_blow.py::test_an_auto_attack_kills_the_last_enemy',
    'tests/core/test_terminal_blow.py::test_an_area_skill_clears_every_enemy_in_one_tick',
    'tests/core/test_terminal_blow.py::test_a_party_wipe_ends_defeated_with_complete_events',
    'tests/core/test_visible_matches_headless.py::test_server_spec_drives_identical_visible_and_headless_battles',
    'tests/core/test_visible_matches_headless.py::test_opening_spec_is_stable_across_sessions_and_rereads',
    'tests/web/test_browser_flow.py::test_exported_web_client_plays_the_real_online_flow',
    # Resource lifecycle at the real entry points: the second acceptance could
    # not sign off M0 because every leak it found lived between these pieces.
    'tests/tools/test_cleanup_paths.py::test_run_guarded_cleans_up_when_the_executable_is_missing',
    'tests/tools/test_cleanup_paths.py::test_run_guarded_cleans_up_on_timeout',
    'tests/tools/test_cleanup_paths.py::test_run_guarded_cleans_up_on_output_overflow',
    'tests/tools/test_cleanup_paths.py::test_reaper_recovers_an_orphaned_nested_cluster',
    'tests/tools/test_cleanup_paths.py::test_check_failure_path_cleans_up_and_reports',
    'tests/tools/test_lifecycle_entrypoints.py::test_check_entrypoint_stops_a_leftover_database_before_deleting_its_run_dir',
    'tests/tools/test_lifecycle_entrypoints.py::test_check_entrypoint_keeps_a_run_dir_whose_database_will_not_stop',
    'tests/tools/test_lifecycle_entrypoints.py::test_a_run_dir_is_kept_when_its_own_database_will_not_stop',
    'tests/tools/test_lifecycle_entrypoints.py::test_a_symlinked_or_foreign_run_directory_is_never_reaped',
    'tests/tools/test_lifecycle_entrypoints.py::test_run_guarded_reaps_its_child_when_the_parent_is_interrupted',
    'tests/tools/test_lifecycle_entrypoints.py::test_make_dev_normal_exit_deletes_the_database_and_reports_real_bytes',
    'tests/tools/test_lifecycle_entrypoints.py::test_make_dev_sigterm_deletes_the_database_and_reports_real_bytes',
    'tests/tools/test_lifecycle_entrypoints.py::test_make_dev_startup_failure_stops_everything_it_started',
    'tests/tools/test_lifecycle_entrypoints.py::test_clean_terminal_runs_make_db_migrate_and_api_without_pythonpath',
)


class Step:
    def __init__(self, name: str):
        self.name = name
        self.ok = False
        self.detail: dict = {}
        self.seconds = 0.0


class CheckAbort(Exception):
    """A deliberate stop (injected failure); still goes through full cleanup."""

    def __init__(self, code: int, reason: str):
        super().__init__(reason)
        self.code = code
        self.reason = reason


def log(message: str) -> None:
    print(f'[check] {message}', flush=True)


def stop_run_dir_resources(work: Path) -> dict:
    """Stop every resource a leftover run directory still holds.

    A run directory is only safe to delete once the database inside it is
    stopped and the stop is verified. Deleting the parent first would remove the
    data directory of a live postmaster and destroy the handle needed to stop
    it, leaving an orphaned server listening on a port with no files.

    Returns the record runowner.reap_stale expects: `stopped` false keeps the
    directory (and its ownership record) for a later attempt and is reported,
    never counted as released space.
    """
    children: list[dict] = []
    failures: list[str] = []
    for child in sorted(work.rglob('awr-pg-*')):
        if child.is_symlink() or not child.is_dir():
            continue
        entry = pgproc.stop_cluster_dir(child)
        entry['path'] = str(child)
        children.append(entry)
        if not (entry.get('stopped') and entry.get('verified')):
            failures.append(f"{child}: {entry.get('error') or 'stop not verified'}")
    record: dict = {'stopped': not failures, 'verified': not failures, 'children': children}
    if failures:
        record['error'] = '; '.join(failures)
    return record


def reap_stale_runs() -> list[dict]:
    """Reap leftover check run directories, stopping their databases first."""
    return runowner.reap_stale('awr-check-*', OWNER_TOOL, stopper=stop_run_dir_resources)


def release_run_dir(run_dir: Path, *, api_process=None, cluster=None) -> tuple[list[dict], list[str]]:
    """Release, in dependency order, everything this run directory holds.

    The API goes first (it holds database connections), then the database, and
    only then the directory that contains the database. A resource whose stop
    cannot be verified keeps the directory and its ownership record and is
    reported as an error: an un-released resource must never be counted as
    freed space, and never as a passing check.
    """
    entries: list[dict] = []
    errors: list[str] = []

    api_stopped = True
    if api_process is not None:
        try:
            stop_process(api_process)
            entries.append({'resource': 'api-process', 'pid': api_process.pid, 'action': 'stopped'})
        except Exception as error:  # noqa: BLE001
            api_stopped = False
            errors.append(f'api process stop failed: {type(error).__name__}: {error}')

    cluster_stopped = True
    if cluster is not None:
        try:
            entry = pgproc.stop_and_measure(cluster)
        except Exception as error:  # noqa: BLE001
            entry = {'resource': 'postgres', 'stopped': False, 'verified': False,
                     'error': f'{type(error).__name__}: {error}'}
        entries.append(entry)
        cluster_stopped = bool(entry.get('stopped') and entry.get('verified'))
        if not cluster_stopped:
            errors.append(f'postgres stop not verified: {entry}')

    if api_stopped and cluster_stopped:
        try:
            shutil.rmtree(run_dir)
        except OSError as error:
            errors.append(f'run dir removal incomplete: {error}')
    else:
        errors.append(f'run dir kept because a resource inside it could not be stopped: {run_dir}')
    return entries, errors


def main() -> int:
    started = time.monotonic()
    run_dir = Path(tempfile.mkdtemp(prefix='awr-check-'))
    runowner.claim(run_dir, OWNER_TOOL)
    reaped = reap_stale_runs()
    if reaped:
        log(f"reaped {len(reaped)} leftover check run director(ies) from dead owners: "
            + '; '.join(f"{entry.get('path')} ({entry.get('bytes_removed')} bytes, "
                        f"stopped={entry.get('stopped')}, removed={entry.get('removed')})"
                        for entry in reaped))
    godot_log = run_dir / 'godot.log'
    report: dict = {'started_at': time.strftime('%Y-%m-%dT%H:%M:%S'), 'steps': [], 'ok': False,
                    'reaped_stale_runs': reaped}
    cluster = None
    api_process = None
    flow = None
    passed: set[str] = set()
    failed: list[str] = []
    skipped: list[str] = []
    cleanup: dict = {'run_dir': str(run_dir), 'entries': [], 'before_bytes': None,
                     'after_bytes': None, 'removed': False, 'retained': None, 'errors': []}

    def finish(code: int) -> int:
        """Cleanup first, report last: the saved report must contain what happened.

        Resources are released in dependency order (API, then database, then the
        directory that holds the database), and the directory is only deleted
        once every resource inside it is confirmed stopped. A stop that cannot be
        verified keeps the directory and its ownership record, is recorded as an
        error, and turns the run into a failure: an un-cleaned resource must
        never be reported as released space or as a passing check.
        """
        report['seconds'] = round(time.monotonic() - started, 1)
        report['passed'] = sorted(passed)
        report['failed'] = failed
        report['skipped'] = skipped
        cleanup['before_bytes'] = runowner.dir_size(run_dir)

        entries, errors = release_run_dir(run_dir, api_process=api_process, cluster=cluster)
        cleanup['entries'].extend(entries)
        cleanup['errors'].extend(errors)
        if cluster is not None and not errors:
            log('temporary PostgreSQL stopped (verified); the run directory removed')

        for stale in report.get('reaped_stale_runs') or []:
            if not stale.get('removed'):
                cleanup['errors'].append(
                    f"leftover run not fully reaped: {stale.get('path')} "
                    f"({stale.get('error') or 'stopped=' + str(stale.get('stopped'))})")

        cleanup['removed'] = not run_dir.exists()
        cleanup['after_bytes'] = runowner.dir_size(run_dir) if run_dir.exists() else 0
        if run_dir.exists():
            cleanup['retained'] = str(run_dir)

        if cleanup['errors']:
            # Cleanup failures are check failures, not footnotes.
            code = code or 1
        report['ok'] = code == 0
        report['cleanup'] = cleanup
        _write_report(report)  # LAST, so the report always carries the cleanup record
        log(f"check {'PASSED' if code == 0 else 'FAILED'} in {report['seconds']}s "
            f"(cleanup: before={cleanup['before_bytes']}B after={cleanup['after_bytes']}B "
            f"removed={cleanup['removed']} errors={len(cleanup['errors'])})")
        return code

    def injected_after(step_name: str) -> None:
        if os.environ.get('ABYSS_CHECK_FAIL_AFTER') == step_name:
            raise CheckAbort(1, f"injected failure after step '{step_name}' "
                                f'(ABYSS_CHECK_FAIL_AFTER)')

    steps = report['steps']

    def record(step: Step) -> None:
        steps.append({'name': step.name, 'ok': step.ok, 'seconds': round(step.seconds, 2),
                      **step.detail})
        log(f"{step.name}: {'ok' if step.ok else 'FAILED'} ({step.seconds:.1f}s)")
        if not step.ok:
            for key in ('reason', 'stdout_tail'):
                if step.detail.get(key):
                    print(f'    {key}: {str(step.detail[key])[:1500]}')

    def _interrupt(signum, frame):  # noqa: ARG001 - signal handler signature
        raise KeyboardInterrupt(f'signal {signum}')

    with contextlib.suppress(ValueError, AttributeError):
        signal.signal(signal.SIGTERM, _interrupt)

    code = 0
    try:
        # 1. content
        step = Step('content')
        t0 = time.monotonic()
        result = processguard.run_guarded('content', [PY, 'tools/build_content.py'], cwd=ROOT,
                                          timeout_seconds=60, max_output_bytes=100_000,
                                          fail_patterns=processguard.PYTHON_FAIL_PATTERNS)
        step.seconds = time.monotonic() - t0
        step.ok, step.detail = result.ok, result.summary()
        record(step)
        if not result.ok:
            return finish(1)
        injected_after('content')

        # 2. client compile
        step = Step('compile-client')
        t0 = time.monotonic()
        result = processguard.run_guarded(
            'compile-client',
            [GODOT, '--headless', '--path', str(ROOT / 'client'), '--log-file', str(godot_log),
             '--script', 'res://tests/compile_all.gd'],
            timeout_seconds=90, max_output_bytes=400_000, log_path=godot_log,
            fail_patterns=processguard.GODOT_FAIL_PATTERNS, expect_pattern=r'COMPILE_CHECK_OK')
        step.seconds = time.monotonic() - t0
        step.ok, step.detail = result.ok, result.summary()
        record(step)
        if not result.ok:
            return finish(1)
        injected_after('compile-client')

        # 3. web export into the run directory (deleted again afterwards)
        web_build = run_dir / 'web'
        web_build.mkdir(parents=True, exist_ok=True)
        step = Step('export-web')
        t0 = time.monotonic()
        result = processguard.run_guarded(
            'export-web',
            [GODOT, '--headless', '--path', str(ROOT / 'client'),
             '--export-release', 'Web', str(web_build / 'index.html')],
            timeout_seconds=300, max_output_bytes=400_000,
            fail_patterns=processguard.GODOT_FAIL_PATTERNS, expect_pattern=r'DONE')
        step.seconds = time.monotonic() - t0
        step.ok, step.detail = result.ok, result.summary()
        record(step)
        if not result.ok:
            return finish(1)
        injected_after('export-web')

        # 4. disposable database
        step = Step('postgres')
        t0 = time.monotonic()
        try:
            cluster = pgproc.start(base_dir=run_dir)
            step.ok = True
            step.detail = {'dsn': cluster.dsn.replace(str(run_dir), '<run_dir>'),
                           'port': cluster.port}
        except Exception as error:  # noqa: BLE001
            step.detail = {'reason': str(error)}
        step.seconds = time.monotonic() - t0
        record(step)
        if cluster is None:
            return finish(1)
        injected_after('postgres')

        os.environ['ABYSS_DSN'] = cluster.dsn

        # 5. migrations through the documented entry point
        step = Step('migrate')
        t0 = time.monotonic()
        result = processguard.run_guarded('migrate', [PY, 'tools/migrate.py'], cwd=ROOT,
                                          env={'ABYSS_DSN': cluster.dsn, 'PYTHONPATH': str(ROOT)},
                                          timeout_seconds=60, max_output_bytes=100_000,
                                          fail_patterns=processguard.PYTHON_FAIL_PATTERNS,
                                          expect_pattern=r'migrations applied')
        step.seconds = time.monotonic() - t0
        step.ok, step.detail = result.ok, result.summary()
        record(step)
        if not result.ok:
            return finish(1)
        injected_after('migrate')

        # 6. the full test suite, required to actually run
        step = Step('pytest')
        t0 = time.monotonic()
        env = {'ABYSS_DSN': cluster.dsn, 'ABYSS_REQUIRE_INTEGRATION': '1',
               'ABYSS_WEB_BUILD_DIR': str(web_build), 'PYTHONDONTWRITEBYTECODE': '1'}
        result = processguard.run_guarded(
            'pytest', [PY, '-m', 'pytest', 'tests', '-v', '--tb=short',
                       '--basetemp', str(run_dir / 'pytest-tmp')],
            cwd=ROOT, env=env, timeout_seconds=600, max_output_bytes=2_000_000,
            fail_patterns=processguard.PYTHON_FAIL_PATTERNS)
        step.seconds = time.monotonic() - t0
        passed, failed, skipped = _parse_pytest(result.stdout)
        missing = [node for node in REQUIRED_TESTS if node not in passed]
        step.detail = result.summary() | {
            'passed': len(passed), 'failed': failed, 'skipped': skipped, 'missing_required': missing}
        step.ok = bool(result.ok) and not failed and not skipped and not missing
        record(step)
        if not step.ok:
            return finish(1)
        injected_after('pytest')

        # 7. the web build is exercised once more outside pytest: a plain flow probe
        # that proves the exported build, the API and the database work together
        # even when nobody is running a test framework around them.
        step = Step('browser-flow')
        t0 = time.monotonic()
        try:
            with serve(web_build) as static:
                api_url, api_process = start_api(cluster.dsn, cors_origins=static.base_url)
                try:
                    login = unique_login('flow')
                    with http_client(api_url) as direct:
                        created = direct.post('/accounts',
                                              json={'login': login, 'password': STRONG_PASSWORD})
                        assert created.status_code == 201, created.text
                    flow = run_browser_flow(web_build, api_base=api_url, login=login,
                                            password=STRONG_PASSWORD, character_name='管线行者',
                                            timeout_seconds=180,
                                            screenshot_path=str(run_dir / 'flow.png'), server=static)
                finally:
                    stop_process(api_process)
                    api_process = None
            step.ok = bool(flow is not None and flow.ok)
            step.detail = flow.summary() if flow is not None else {'reason': 'flow never ran'}
        except Exception as error:  # noqa: BLE001
            step.detail = {'reason': f'{type(error).__name__}: {error}'}
        step.seconds = time.monotonic() - t0
        record(step)
        injected_after('browser-flow')

        ok = all(entry['ok'] for entry in steps)
        code = 0 if ok else 1
    except CheckAbort as abort:
        log(f'aborted: {abort.reason}')
        report['aborted'] = abort.reason
        code = abort.code
    except KeyboardInterrupt as interrupt:
        report['unhandled'] = f'interrupted: {interrupt}'
        code = 130
    except Exception as error:  # noqa: BLE001
        report['unhandled'] = f'{type(error).__name__}: {error}'
        code = 1
    return finish(code)


def _parse_pytest(text: str) -> tuple[set[str], list[str], list[str]]:
    passed: set[str] = set()
    failed: list[str] = []
    skipped: list[str] = []
    for line in text.splitlines():
        match = re.match(r'^(tests/\S+::\S+) (PASSED|FAILED|SKIPPED|ERROR)', line.strip())
        if not match:
            continue
        node, state = match.group(1), match.group(2)
        if state == 'PASSED':
            passed.add(node)
        elif state == 'FAILED':
            failed.append(node)
        elif state in ('SKIPPED', 'ERROR'):
            skipped.append(f'{node} ({state})')
    return passed, failed, skipped


def _write_report(report: dict) -> None:
    # ABYSS_CHECK_REPORT lets a test drive this real entry point without
    # overwriting the official result of the last full run.
    target = Path(os.environ.get('ABYSS_CHECK_REPORT')
                  or ROOT / 'docs/reviews/m0-check-report.json')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(report, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    if not Path(GODOT).exists():
        raise SystemExit(f'Godot not found at {GODOT}; set ABYSS_GODOT')
    if not Path(PY).exists():
        raise SystemExit('run make setup first: the project virtualenv is missing')
    sys.exit(main())
