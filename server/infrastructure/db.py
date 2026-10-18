"""PostgreSQL access. Every write travels through one transaction."""
from __future__ import annotations

import os
from contextlib import contextmanager
from pathlib import Path

import psycopg
from psycopg.rows import dict_row
from psycopg_pool import ConnectionPool

MIGRATIONS = Path(__file__).resolve().parents[1] / 'migrations'
_pool: ConnectionPool | None = None


def env_text(name: str, default: str = '') -> str:
    return os.environ.get(name, default).strip()


def dsn() -> str:
    value = env_text('ABYSS_DSN')
    if not value:
        raise RuntimeError('ABYSS_DSN is required; never fall back to a player database')
    return value


def pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(dsn(), min_size=1, max_size=8, timeout=20.0, open=True)
    return _pool


def reset_pool() -> None:
    """Close connections so a new DSN (a new disposable database) takes effect."""
    global _pool
    if _pool is not None:
        _pool.close()
        _pool = None


@contextmanager
def transaction():
    with pool().connection() as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            yield conn, cur


def apply_migrations() -> list[str]:
    applied: list[str] = []
    with transaction() as (conn, cur):
        cur.execute("""CREATE TABLE IF NOT EXISTS schema_migrations(
            version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp())""")
        for path in sorted(MIGRATIONS.glob('*.sql')):
            version = int(path.name.split('_')[0])
            cur.execute('SELECT version FROM schema_migrations WHERE version=%s', (version,))
            if cur.fetchone():
                continue
            cur.execute(path.read_text())
            cur.execute('INSERT INTO schema_migrations(version,name) VALUES(%s,%s) ON CONFLICT DO NOTHING',
                        (version, path.name))
            applied.append(path.name)
    return applied
