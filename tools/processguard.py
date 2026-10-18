"""Run subprocesses with the boundaries that a check pipeline needs.

Three things went wrong before and are enforced here:

* Godot can print a parse error and still exit 0, so exit codes alone never
  decide anything. A run must also match its expected success marker.
* A controller has to have an outside deadline and an output cap; a child that
  never stops writing must not be trusted to stop by itself.
* Log files live next to the run, not in a shared engine directory that keeps
  growing across rounds.

Nothing here mocks a dependency: it only bounds processes.
"""
from __future__ import annotations

import os
import re
import shutil
import signal
import subprocess
import tempfile
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable, Sequence

GODOT_FAIL_PATTERNS: tuple[str, ...] = (
    r'SCRIPT ERROR',
    r'Parse Error',
    r'Compile Error',
    r'ERROR: ',
    r'Failed loading resource',
    r'Nonexistent function',
    r'Invalid call',
    r'Invalid access',
    r'Compilation failed',
)

PYTHON_FAIL_PATTERNS: tuple[str, ...] = (
    r'Traceback \(most recent call last\)',
)


@dataclass
class RunResult:
    name: str
    argv: list[str]
    returncode: int | None = None
    stdout: str = ''
    stderr: str = ''
    output_bytes: int = 0
    log_bytes: int = 0
    elapsed_seconds: float = 0.0
    timed_out: bool = False
    output_overflow: bool = False
    log_overflow: bool = False
    pattern_hits: list[str] = field(default_factory=list)
    ok: bool = False
    reason: str = ''
    forced_cleanup: bool = False
    process_leaked: bool = False
    scratch_dir_retained: str = ''

    def summary(self) -> dict:
        return {
            'name': self.name,
            'command': ' '.join(self.argv),
            'returncode': self.returncode,
            'elapsed_seconds': round(self.elapsed_seconds, 3),
            'output_bytes': self.output_bytes,
            'log_bytes': self.log_bytes,
            'timed_out': self.timed_out,
            'output_overflow': self.output_overflow,
            'log_overflow': self.log_overflow,
            'pattern_hits': self.pattern_hits,
            'ok': self.ok,
            'reason': self.reason,
            'forced_cleanup': self.forced_cleanup,
            'process_leaked': self.process_leaked,
            'scratch_dir_retained': self.scratch_dir_retained,
            'stdout_tail': self.stdout[-4000:],
            'stderr_tail': self.stderr[-4000:],
        }


def run_guarded(
    name: str,
    argv: Sequence[str],
    *,
    cwd: str | Path | None = None,
    env: dict | None = None,
    timeout_seconds: float = 120.0,
    max_output_bytes: int = 2_000_000,
    max_log_bytes: int = 8_000_000,
    log_path: str | Path | None = None,
    fail_patterns: Iterable[str] = (),
    expect_pattern: str | None = None,
    extra_pythonpath: str | None = None,
) -> RunResult:
    """Run one command under an outside deadline, output cap and pattern check."""
    result = RunResult(name=name, argv=list(argv))
    patterns = [p for p in fail_patterns]
    combined_env = os.environ.copy()
    if env:
        combined_env.update({k: str(v) for k, v in env.items()})
    if extra_pythonpath:
        existing = combined_env.get('PYTHONPATH', '')
        combined_env['PYTHONPATH'] = extra_pythonpath if not existing else extra_pythonpath + os.pathsep + existing

    out_dir = Path(tempfile.mkdtemp(prefix='awr-run-'))
    out_file = out_dir / 'stdout.txt'
    started = time.monotonic()
    process = None
    try:
        try:
            with open(out_file, 'wb') as sink:
                process = subprocess.Popen(
                    list(argv), cwd=str(cwd) if cwd else None, env=combined_env,
                    stdout=sink, stderr=subprocess.STDOUT, start_new_session=True,
                )
            deadline = started + timeout_seconds
            while True:
                if time.monotonic() > deadline:
                    _terminate(process)
                    result.timed_out = True
                    process.wait(timeout=15)
                    break
                code = process.poll()
                if code is not None:
                    result.returncode = code
                    break
                size = out_file.stat().st_size if out_file.exists() else 0
                if size > max_output_bytes:
                    _terminate(process)
                    result.output_overflow = True
                    try:
                        process.wait(timeout=15)
                    except subprocess.TimeoutExpired:
                        _kill(process)
                    break
                if log_path is not None and Path(log_path).exists():
                    log_size = Path(log_path).stat().st_size
                    if log_size > max_log_bytes:
                        _terminate(process)
                        result.log_overflow = True
                        try:
                            process.wait(timeout=15)
                        except subprocess.TimeoutExpired:
                            _kill(process)
                        break
                time.sleep(0.05)
            if result.returncode is None:
                result.returncode = process.wait(timeout=15)
        except FileNotFoundError as error:
            result.reason = f'command not found: {error}'
            return result
        except subprocess.TimeoutExpired:
            # The child ignored the first SIGTERM and did not exit inside the
            # wait. Escalation and the wait for it to be really gone happen in
            # the outer finally, so the same path is used for interrupts.
            result.timed_out = True
            result.reason = 'process did not exit after termination'
            return result
        finally:
            result.elapsed_seconds = time.monotonic() - started

        raw = out_file.read_bytes() if out_file.exists() else b''
        result.output_bytes = len(raw)
        text = raw.decode('utf-8', errors='replace')
        result.stdout = text
        if log_path is not None and Path(log_path).exists():
            result.log_bytes = Path(log_path).stat().st_size

        haystack = text
        if log_path is not None and Path(log_path).exists() and result.log_bytes <= max_log_bytes:
            haystack += '\n' + Path(log_path).read_text(errors='replace')
        result.pattern_hits = sorted({p for p in patterns if re.search(p, haystack)})

        if result.timed_out:
            result.reason = f'exceeded outside time limit of {timeout_seconds}s'
        elif result.output_overflow:
            result.reason = f'output exceeded cap of {max_output_bytes} bytes'
        elif result.log_overflow:
            result.reason = f'log file exceeded cap of {max_log_bytes} bytes'
        elif result.pattern_hits:
            firstline = _first_matching_line(haystack, result.pattern_hits[0])
            result.reason = f'error output detected: {firstline}'
        elif result.returncode != 0:
            result.reason = f'non-zero exit code {result.returncode}'
        elif expect_pattern is not None and not re.search(expect_pattern, haystack):
            result.reason = f'expected success marker not found: {expect_pattern}'
        else:
            result.ok = True
    finally:
        # Every exit path — success, timeout, missing executable, or an
        # interrupt raised into this frame by the parent's SIGTERM handler —
        # ends the run's own process group and waits for it to be gone before
        # removing the scratch directory. The old code only terminated on the
        # timeout branch, so an interrupt deleted the log directory while the
        # child kept running: it is started with start_new_session=True, so
        # nothing else was ever going to reap it.
        _reap_process(process, result)
        if result.process_leaked:
            # Not confirmed gone: keep the scratch directory and its path so the
            # leak is traceable instead of silently reported as cleaned up.
            result.scratch_dir_retained = str(out_dir)
        else:
            shutil.rmtree(out_dir, ignore_errors=True)
    return result


def _first_matching_line(text: str, pattern: str) -> str:
    for line in text.splitlines():
        if re.search(pattern, line):
            return line.strip()[:400]
    return pattern


def _wait_gone(process: subprocess.Popen, timeout: float) -> bool:
    try:
        process.wait(timeout=timeout)
        return True
    except subprocess.TimeoutExpired:
        return False


def _reap_process(process: subprocess.Popen | None, result: RunResult) -> None:
    """Terminate anything still running and wait until it is really gone.

    SIGTERM to the whole process group first, then SIGKILL if the group ignores
    it, each followed by a bounded wait. A group that survives SIGKILL is
    reported as a leak rather than assumed dead.
    """
    if process is None or process.poll() is not None:
        return
    result.forced_cleanup = True
    _terminate(process)
    if _wait_gone(process, 10.0):
        return
    _kill(process)
    if _wait_gone(process, 10.0):
        return
    result.process_leaked = True
    note = f'survived SIGKILL; its process group may still be running'
    result.reason = f'{result.reason}; {note}' if result.reason else note


def _terminate(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        process.terminate()


def _kill(process: subprocess.Popen) -> None:
    if process.poll() is not None:
        return
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
    except (ProcessLookupError, PermissionError):
        process.kill()
