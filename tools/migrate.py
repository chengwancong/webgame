"""Apply server/migrations in order. Requires ABYSS_DSN."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from server.infrastructure import db  # noqa: E402


def main() -> int:
    applied = db.apply_migrations()
    print('migrations applied: ' + (', '.join(applied) if applied else 'none (already current)'))
    return 0


if __name__ == '__main__':
    sys.exit(main())
