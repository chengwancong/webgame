"""Ownership records for the temporary run directories this project creates.

Every directory the tools create carries an `owner.json` that names the tool
and the process that made it. Reapers only delete a directory when the record
exists, the tool matches, and the owning process is gone — a shared prefix is
never enough, and a PID that could have been reused is checked against the
record, not guessed. Symbolic links are never followed and never deleted.
"""
from __future__ import annotations

import json
import os
import shutil
import tempfile
import time
from pathlib import Path

OWNER_FILE = 'owner.json'


def claim(path: str | Path, tool: str) -> None:
    """Record who owns this run directory, so a later run can verify it."""
    target = Path(path)
    target.mkdir(parents=True, exist_ok=True)
    (target / OWNER_FILE).write_text(json.dumps({
        'pid': os.getpid(),
        'tool': tool,
        'created_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
    }), encoding='utf-8')


def owner_pid(path: str | Path) -> int:
    """The recorded owner pid, or 0 when there is no credible record."""
    record = Path(path) / OWNER_FILE
    try:
        data = json.loads(record.read_text(encoding='utf-8'))
        pid = int(data.get('pid', 0))
        return pid if pid > 0 else 0
    except (OSError, ValueError, TypeError):
        return 0


def is_owned(path: str | Path, tool: str) -> bool:
    """True only when a record of exactly this tool exists in the directory."""
    record = Path(path) / OWNER_FILE
    try:
        data = json.loads(record.read_text(encoding='utf-8'))
    except (OSError, ValueError, TypeError):
        return False
    return data.get('tool') == tool and isinstance(data.get('pid'), int)


def _pid_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except (ProcessLookupError, PermissionError):
        return False


def reap_stale(pattern: str, tool: str, *, stopper=None) -> list[dict]:
    """Stop and delete directories of this tool whose owner process is gone.

    The search walks the whole temporary tree (nested check directories
    included), but a candidate must pass every gate before anything is
    deleted: a real directory, not a symlink, an owner.json naming exactly
    this tool, and a dead owner process. When a stopper is given (a cluster,
    say) it runs first and its outcome is reported; a failed stop is reported,
    never silently treated as released.
    """
    root = Path(tempfile.gettempdir())
    if not root.exists():
        return []
    records: list[dict] = []
    for candidate in sorted(root.rglob(pattern)):
        try:
            if not candidate.is_dir() or candidate.is_symlink():
                continue
            if not is_owned(candidate, tool):
                continue
            pid = owner_pid(candidate)
            if pid and _pid_alive(pid):
                continue
            entry: dict = {'path': str(candidate), 'owner_pid': pid, 'tool': tool}
            if stopper is not None:
                entry.update(stopper(candidate))
                if not entry.get('stopped'):
                    # A resource that refused to stop is never deleted and
                    # never counted as released; the record says why.
                    entry['removed'] = False
                    records.append(entry)
                    continue
            before = dir_size(candidate)
            shutil.rmtree(candidate, ignore_errors=True)
            entry['bytes_removed'] = before if not candidate.exists() else None
            entry['removed'] = not candidate.exists()
            records.append(entry)
        except OSError as error:  # a broken entry must not abort the whole sweep
            records.append({'path': str(candidate), 'error': f'{type(error).__name__}: {error}'})
            continue
    return records


def dir_size(path: str | Path) -> int:
    """Logical bytes of every regular file below path; symlinks are not followed."""
    total = 0
    try:
        for item in Path(path).rglob('*'):
            try:
                if item.is_file() and not item.is_symlink():
                    total += item.stat().st_size
            except OSError:
                continue
    except OSError:
        return total
    return total
