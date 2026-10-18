"""Command receipts: one command_id produces one durable change, and only one.

Concurrency model, stated once because it is the part that failed before:

    BEGIN
      SELECT ... FROM accounts WHERE id = <account> FOR UPDATE   -- serialise
      SELECT receipt                                             -- after the lock
      (no receipt) run business writes
      INSERT receipt                                             -- same tx
    COMMIT

Locking the account inside the same transaction before looking at receipts is
what makes "both requests saw no receipt" impossible. Symptoms: the second
request waits for the first, then reads the receipt the first committed.

If a race does reach the unique constraint anyway, the whole transaction rolls
back (business writes included) and the command is retried once against the now
committed receipt. A conflict is never turned into an unhandled 500.
"""
from __future__ import annotations

import hashlib
import json

import psycopg
from psycopg import errors as pgerrors


class ReceiptRace(Exception):
    """Raised inside a transaction that has been rolled back and can be retried."""


def fingerprint(payload: dict) -> str:
    return hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()


def replay_or_run(account_id: int, command_id: str, kind: str, payload: dict, run) -> dict:
    """Return the stored receipt for a repeated command, or run it exactly once.

    A repeated command_id with a different payload is a caller bug and is
    refused instead of silently doing something else.
    """
    from server.infrastructure import db

    digest = fingerprint(payload)
    for attempt in range(2):
        try:
            with db.transaction() as (conn, cur):
                _lock_account(cur, account_id)
                row = _read_receipt(cur, account_id, command_id)
                if row is not None:
                    if row['request_fingerprint'] != digest:
                        raise ValueError('COMMAND_CONFLICT')
                    return dict(row['result'])
                result = run(conn, cur)
                _insert_receipt(cur, account_id, command_id, digest, kind, result)
                return result
        except ReceiptRace:
            if attempt == 1:
                raise ValueError('COMMAND_RACE_UNRESOLVED') from None
            continue
    raise ValueError('COMMAND_RACE_UNRESOLVED')


def _lock_account(cur, account_id: int) -> None:
    cur.execute('SELECT id FROM accounts WHERE id=%s FOR UPDATE', (account_id,))
    if cur.fetchone() is None:
        raise ValueError('ACCOUNT_NOT_FOUND')


def _read_receipt(cur, account_id: int, command_id: str):
    cur.execute('SELECT result, request_fingerprint FROM command_receipts WHERE account_id=%s AND command_id=%s',
                (account_id, command_id))
    return cur.fetchone()


def _insert_receipt(cur, account_id: int, command_id: str, digest: str, kind: str, result: dict) -> None:
    try:
        cur.execute("""INSERT INTO command_receipts(account_id,command_id,request_fingerprint,kind,result)
                       VALUES(%s,%s,%s,%s,%s)""",
                    (account_id, command_id, digest, kind, json.dumps(result, default=str)))
    except pgerrors.UniqueViolation as error:
        # Roll the whole unit of work back, not just this statement: leaving the
        # business writes behind would create the duplicate we are preventing.
        raise ReceiptRace() from error


def count_rows(account_id: int, table: str) -> int:
    """Integrity check helper for tests that must prove one change happened."""
    from server.infrastructure import db

    if table not in ('characters', 'command_receipts'):
        raise ValueError('UNSUPPORTED_TABLE')
    with db.transaction() as (conn, cur):
        cur.execute(f'SELECT count(*) AS n FROM {table} WHERE account_id=%s', (account_id,))
        return int(cur.fetchone()['n'])
