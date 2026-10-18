"""The first write interface: one command produces one durable change, and only
one. Real PostgreSQL, real transactions, real HTTP, real concurrency.

The concurrency proof is stricter than "the threads were alive": both requests
must be observed inside PostgreSQL waiting on the same row lock before the
outside lock is released, so the race really happened instead of one request
finishing before the other started.
"""
from __future__ import annotations

import threading
import time
import uuid

import httpx
import psycopg
import pytest

from tests.conftest import (
    auth,
    create_character,
    http_client,
    login_session,
    open_session,
    register,
    start_api,
    stop_process,
)


def _character_count(dsn: str, account_id: int) -> int:
    with psycopg.connect(dsn) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT count(*) FROM characters WHERE account_id=%s', (account_id,))
            return int(cursor.fetchone()[0])


def _receipt_count(dsn: str, account_id: int) -> int:
    with psycopg.connect(dsn) as connection:
        with connection.cursor() as cursor:
            cursor.execute('SELECT count(*) FROM command_receipts WHERE account_id=%s', (account_id,))
            return int(cursor.fetchone()[0])


def _lock_waiters(dsn: str) -> int:
    """Backends currently blocked on a lock in this database.

    The observer connection itself is active but not lock-waiting, so it never
    counts itself. This is the database's own word that a request is stuck on
    the locked row — not a thread-alive guess.
    """
    with psycopg.connect(dsn) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT count(*) FROM pg_stat_activity "
                "WHERE datname = current_database() AND state = 'active' "
                "AND wait_event_type = 'Lock'")
            return int(cursor.fetchone()[0])


def test_same_command_id_does_not_create_twice(client, database):
    login, _password = register(client, 'sequence')
    token = login_session(client, login)
    account_id = open_session(client, login)['account_id']
    command_id = str(uuid.uuid4())
    body = {'command_id': command_id, 'name': '回廊行者'}
    first = client.post('/characters', json=body, headers=auth(token))
    assert first.status_code == 201, first.text
    again = client.post('/characters', json=body, headers=auth(token))
    assert again.status_code == 201
    assert again.json() == first.json()
    assert _character_count(database, account_id) == 1
    assert _receipt_count(database, account_id) == 1


def test_same_command_id_with_different_payload_is_refused(client, database):
    login, _password = register(client, 'conflict')
    token = login_session(client, login)
    command_id = str(uuid.uuid4())
    assert create_character(client, token, '先行者', command_id).status_code == 201
    conflict = client.post('/characters', json={'command_id': command_id, 'name': '另一人'},
                           headers=auth(token))
    assert conflict.status_code == 409
    assert conflict.json()['detail'] == 'COMMAND_CONFLICT'
    assert _character_count(database, open_session(client, login)['account_id']) == 1


def test_lost_response_then_retry_returns_the_same_receipt(client, database):
    """Commit succeeded, the reply never arrived: resend the same command id."""
    login, _password = register(client, 'lostreply')
    token = login_session(client, login)
    account_id = open_session(client, login)['account_id']
    command_id = str(uuid.uuid4())
    body = {'command_id': command_id, 'name': '重试行者'}
    first = client.post('/characters', json=body, headers=auth(token))
    assert first.status_code == 201
    # The first reply is deliberately thrown away; the retry carries the same
    # id. A new id would be a different command and would double the character.
    retried = client.post('/characters', json=body, headers=auth(token))
    assert retried.status_code == 201
    assert retried.json() == first.json()
    assert _character_count(database, account_id) == 1
    assert _receipt_count(database, account_id) == 1


def test_concurrent_duplicate_commands_produce_one_change(client, api_base, database):
    """Two requests that both arrive before either has written a receipt.

    An outside connection holds the account row lock first. The release waits
    until PostgreSQL itself reports BOTH request backends waiting on that lock
    (pg_stat_activity, wait_event_type='Lock'), so the race is observed, not
    assumed. Both must answer 201 with the same body, and the database must
    show exactly one character and one receipt.
    """
    login, _password = register(client, 'race')
    token = login_session(client, login)
    account_id = open_session(client, login)['account_id']
    command_id = str(uuid.uuid4())
    body = {'command_id': command_id, 'name': '并发行者'}

    outside = psycopg.connect(database)
    outside.autocommit = False
    with outside.cursor() as cursor:
        cursor.execute('SELECT id FROM accounts WHERE id=%s FOR UPDATE', (account_id,))

    results: dict[int, httpx.Response] = {}
    start_line = threading.Barrier(2)

    def worker(index: int) -> None:
        with httpx.Client(base_url=api_base, timeout=30.0, trust_env=False) as http:
            start_line.wait(timeout=20)
            results[index] = http.post('/characters', json=body, headers=auth(token))

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(2)]
    for thread in threads:
        thread.start()
    # Release only when PostgreSQL says both requests are blocked on the row
    # lock at the same time. A deadline turns "never both blocked" into a
    # failure instead of a silently weaker test.
    deadline = time.monotonic() + 20.0
    both_blocked = False
    while time.monotonic() < deadline:
        if _lock_waiters(database) >= 2:
            both_blocked = True
            break
        time.sleep(0.05)
    assert both_blocked, 'both requests must be observed waiting on the account row lock'
    outside.commit()
    outside.close()
    for thread in threads:
        thread.join(timeout=30)

    assert len(results) == 2, 'both concurrent requests must be answered'
    first_response, second_response = results[0], results[1]
    assert first_response.status_code == 201, first_response.text
    assert second_response.status_code == 201, second_response.text
    assert first_response.json() == second_response.json()
    assert _character_count(database, account_id) == 1
    assert _receipt_count(database, account_id) == 1


def test_failed_business_write_rolls_back_everything(database):
    """Write, then fail: the character and the receipt must both disappear."""
    from server.application import accounts, commands
    from server.infrastructure import db

    account_id = accounts.create_account(*_new_login('rollback'))['account_id']

    written_ids: list[int] = []

    def write_then_fail(conn, cur):
        cur.execute('INSERT INTO characters(account_id,name) VALUES(%s,%s) RETURNING id',
                    (account_id, '回滚行者'))
        written_ids.append(int(cur.fetchone()['id']))
        raise RuntimeError('deliberate failure after the business write')

    command_id = str(uuid.uuid4())
    payload = {'account_id': account_id, 'name': '回滚行者', 'kind': 'character.create'}
    with pytest.raises(RuntimeError):
        commands.replay_or_run(account_id, command_id, 'character.create', payload, write_then_fail)

    assert written_ids, 'the callback must have written something to roll back'
    with db.transaction() as (conn, cur):
        cur.execute('SELECT count(*) AS n FROM characters WHERE id=%s', (written_ids[0],))
        assert int(cur.fetchone()['n']) == 0
        cur.execute('SELECT count(*) AS n FROM command_receipts WHERE account_id=%s AND command_id=%s',
                    (account_id, command_id))
        assert int(cur.fetchone()['n']) == 0
    assert commands.count_rows(account_id, 'characters') == 0
    assert commands.count_rows(account_id, 'command_receipts') == 0


def test_duplicate_character_name_in_same_account_is_a_controlled_result(client, database):
    login, _password = register(client, 'dupname')
    token = login_session(client, login)
    assert create_character(client, token, '同名行者').status_code == 201
    again = create_character(client, token, '同名行者')
    assert again.status_code == 409
    assert again.json()['detail'] == 'CHARACTER_NAME_TAKEN'
    assert _character_count(database, open_session(client, login)['account_id']) == 1


def test_api_restart_preserves_characters_and_receipts(database):
    """A real process restart: nothing durable may depend on the process."""
    import uuid as uuid_module

    login = f'restart_{int(time.time() * 1000) % 10_000_000}'
    password = 'a long enough password'
    command_id = str(uuid_module.uuid4())
    body = {'command_id': command_id, 'name': '重启行者'}

    first_base, first_process = start_api(database)
    try:
        with http_client(first_base) as first_client:
            assert first_client.post('/accounts', json={'login': login, 'password': password}).status_code == 201
            token = login_session(first_client, login)
            created = first_client.post('/characters', json=body, headers=auth(token))
            assert created.status_code == 201, created.text
            character_id = created.json()['character']['id']
    finally:
        stop_process(first_process)

    second_base, second_process = start_api(database)
    try:
        with http_client(second_base) as fresh_client:
            token = login_session(fresh_client, login, password)
            listed = fresh_client.get('/characters', headers=auth(token))
            assert listed.status_code == 200, listed.text
            assert [row['id'] for row in listed.json()['characters']] == [character_id]
            replay = fresh_client.post('/characters', json=body, headers=auth(token))
            assert replay.status_code == 201, replay.text
            assert replay.json() == created.json()
    finally:
        stop_process(second_process)


def _new_login(prefix: str):
    from tests.conftest import unique_login
    return unique_login(prefix), 'a long enough password'
