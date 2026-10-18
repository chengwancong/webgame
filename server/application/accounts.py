"""Identity and the first write interface of the rewrite.

Rules that define this module's boundary:

* An account is identified by its login. Registering a taken login is a
  controlled business result, never a way to log in.
* A request's account comes from its session token, never from the request
  body. A client-supplied account_id is not an identity.
* Every character read is scoped to the account that owns it, inside the same
  query that reads it.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from psycopg import errors as pgerrors

ITERATIONS = 200_000
SCHEME = 'pbkdf2'
SESSION_TTL_SECONDS = int(os.environ.get('ABYSS_SESSION_TTL_SECONDS', str(12 * 60 * 60)))
# Derived from a fixed value so a missing account still costs the same work:
# this removes the "unknown login answers faster" signal, not user enumeration
# itself, which stays a deliberate 409 on registration.
_DUMMY_HASH = f'{SCHEME}${"0" * 32}${"0" * 64}'


def hash_password(password: str, salt: str | None = None) -> str:
    salt = salt or secrets.token_hex(16)
    derived = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), ITERATIONS)
    return f'{SCHEME}${salt}${derived.hex()}'


def verify_password(password: str, stored: str) -> bool:
    parts = (stored or '').split('$')
    if len(parts) != 3 or parts[0] != SCHEME:
        return False
    expected = parts[2]
    derived = hashlib.pbkdf2_hmac('sha256', password.encode(), parts[1].encode(), ITERATIONS).hex()
    return hmac.compare_digest(derived, expected)


def create_account(login: str, password: str) -> dict:
    from server.infrastructure import db

    if len(password) < 12:
        raise ValueError('PASSWORD_TOO_SHORT')
    with db.transaction() as (conn, cur):
        cur.execute('SELECT id FROM accounts WHERE login=%s', (login,))
        if cur.fetchone() is not None:
            # Registration is registration. Returning a session here would turn
            # "someone else's login" into "your account".
            raise ValueError('LOGIN_TAKEN')
        try:
            cur.execute('INSERT INTO accounts(login,password_hash) VALUES(%s,%s) RETURNING id,login,created_at',
                        (login, hash_password(password)))
        except pgerrors.UniqueViolation as error:
            # Two registrations racing for the same login: still just "taken".
            raise ValueError('LOGIN_TAKEN') from error
        row = cur.fetchone()
    return {'account_id': int(row['id']), 'login': str(row['login']), 'created_at': str(row['created_at'])}


def authenticate(login: str, password: str, user_agent: str = '') -> dict | None:
    """Correct password for an existing account creates a revocable session."""
    from server.infrastructure import db

    if not login or not password:
        return None
    with db.transaction() as (conn, cur):
        cur.execute('SELECT id,password_hash FROM accounts WHERE login=%s', (login,))
        row = cur.fetchone()
        stored = str(row['password_hash']) if row is not None else _DUMMY_HASH
        matches = verify_password(password, stored)
        if row is None or not matches:
            return None
        return _issue_session(cur, int(row['id']), user_agent)


def _issue_session(cur, account_id: int, user_agent: str) -> dict:
    token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(token.encode()).digest()
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=SESSION_TTL_SECONDS)
    cur.execute("""INSERT INTO sessions(account_id,token_hash,user_agent,expires_at)
                   VALUES(%s,%s,%s,%s) RETURNING id""",
                (account_id, token_hash, user_agent[:200], expires_at))
    session_id = int(cur.fetchone()['id'])
    return {'session_id': session_id, 'account_id': account_id, 'session_token': token,
            'expires_at': expires_at.isoformat()}


def resolve_session(token: str) -> int | None:
    """Return the account for a live session, or None for anything else."""
    from server.infrastructure import db

    if not token:
        return None
    token_hash = hashlib.sha256(token.encode()).digest()
    with db.transaction() as (conn, cur):
        cur.execute("""SELECT account_id FROM sessions
                       WHERE token_hash=%s AND revoked_at IS NULL AND expires_at > clock_timestamp()""",
                    (token_hash,))
        row = cur.fetchone()
        if row is None:
            return None
        cur.execute('UPDATE sessions SET last_seen_at=clock_timestamp() WHERE token_hash=%s', (token_hash,))
        return int(row['account_id'])


def revoke_session(token: str) -> bool:
    from server.infrastructure import db

    if not token:
        return False
    token_hash = hashlib.sha256(token.encode()).digest()
    with db.transaction() as (conn, cur):
        cur.execute("""UPDATE sessions SET revoked_at=clock_timestamp()
                       WHERE token_hash=%s AND revoked_at IS NULL""", (token_hash,))
        return cur.rowcount == 1


def create_character(account_id: int, command_id: str, name: str) -> dict:
    """Idempotent by command_id: the same command never creates twice."""
    from server.application import commands

    name = (name or '').strip()
    if not 2 <= len(name) <= 16:
        raise ValueError('NAME_LENGTH')
    payload = {'account_id': int(account_id), 'name': name, 'kind': 'character.create'}

    def run(conn, cur):
        try:
            cur.execute("""INSERT INTO characters(account_id,name) VALUES(%s,%s)
                           RETURNING id,account_id,name,level,experience,state_revision""", (account_id, name))
        except pgerrors.UniqueViolation as error:
            raise ValueError('CHARACTER_NAME_TAKEN') from error
        return {'character': dict(cur.fetchone()), 'command_id': command_id}

    return commands.replay_or_run(account_id, command_id, 'character.create', payload, run)


def character_view(account_id: int, character_id: int) -> dict | None:
    """Ownership is part of the query, not a caller-discretion check."""
    from server.infrastructure import db

    with db.transaction() as (conn, cur):
        cur.execute("""SELECT id,account_id,name,level,experience,state_revision FROM characters
                       WHERE id=%s AND account_id=%s""", (character_id, account_id))
        row = cur.fetchone()
        return dict(row) if row else None


def list_characters(account_id: int) -> list[dict]:
    from server.infrastructure import db

    with db.transaction() as (conn, cur):
        cur.execute("""SELECT id,account_id,name,level,experience,state_revision FROM characters
                       WHERE account_id=%s ORDER BY id""", (account_id,))
        return [dict(row) for row in cur.fetchall()]
