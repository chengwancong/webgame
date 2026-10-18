"""Identity and ownership against the real API, the real sessions and the real
database. Nothing in these tests stands in for any of them.
"""
from __future__ import annotations

import uuid

from tests.conftest import (STRONG_PASSWORD, auth, create_character, login_session, register, unique_login)


def test_health_and_version_report_the_real_state(client):
    assert client.get('/health').json()['database'] == 'ok'
    versions = client.get('/version').json()
    assert {'client_version', 'protocol_version', 'ruleset_version', 'db_schema_version'} <= set(versions)


def test_registering_a_taken_login_is_not_a_login(client):
    login, password = register(client, 'taken')
    again = client.post('/accounts', json={'login': login, 'password': 'another password here'})
    assert again.status_code == 409
    assert again.json()['detail'] == 'LOGIN_TAKEN'
    # The answer must not contain anything usable as credentials.
    assert 'session_token' not in again.text
    assert 'account_id' not in again.json()['detail']


def test_wrong_password_is_refused_everywhere(client):
    login, _password = register(client, 'wrongpw')
    wrong = client.post('/sessions', json={'login': login, 'password': 'definitely the wrong one'})
    assert wrong.status_code == 401
    assert wrong.json()['detail'] == 'INVALID_CREDENTIALS'
    unknown = client.post('/sessions', json={'login': unique_login('ghost'), 'password': STRONG_PASSWORD})
    assert unknown.status_code == 401


def test_unauthenticated_reads_and_writes_are_refused(client):
    login, _password = register(client, 'anon')
    token = login_session(client, login)
    created = create_character(client, token, '守夜人')
    character_id = created.json()['character']['id']
    assert client.get(f'/characters/{character_id}').status_code == 401
    assert client.get('/characters').status_code == 401
    assert client.post('/characters', json={'command_id': str(uuid.uuid4()), 'name': '未认证'}).status_code == 401
    assert client.get('/opening', params={'character_id': character_id}).status_code == 401


def test_garbage_and_revoked_sessions_are_refused(client):
    login, _password = register(client, 'revoke')
    token = login_session(client, login)
    created = create_character(client, token, '回廊行者')
    character_id = created.json()['character']['id']
    assert client.get('/characters', headers=auth(token)).status_code == 200
    assert client.delete('/sessions/current', headers=auth(token)).status_code == 204
    assert client.get('/characters', headers=auth(token)).status_code == 401
    for broken in ['not-a-token', 'Bearer', token + 'x', 'bearer ' + token]:
        assert client.get('/characters', headers={'Authorization': f'Bearer {broken}'}).status_code == 401
    assert client.get('/characters', headers={'Authorization': 'Bearer'}).status_code == 401
    assert client.get('/characters', headers={'Authorization': 'token-without-scheme'}).status_code == 401
    # The character still exists; only the session stopped being usable.
    again = login_session(client, login)
    assert client.get(f'/characters/{character_id}', headers=auth(again)).status_code == 200


def test_client_supplied_account_id_is_not_accepted(client):
    login, _password = register(client, 'owner')
    token = login_session(client, login)
    body = {'command_id': str(uuid.uuid4()), 'name': '越权角色', 'account_id': 1}
    # extra fields are rejected outright: there is no field to carry another
    # account's identity in this request model.
    assert client.post('/characters', json=body, headers=auth(token)).status_code == 422


def test_another_account_cannot_read_the_character(client):
    login, _password = register(client, 'victim')
    token = login_session(client, login)
    created = create_character(client, token, '私有的行者')
    character_id = created.json()['character']['id']

    other_login, _other_password = register(client, 'intruder')
    other_token = login_session(client, other_login)
    forbidden = client.get(f'/characters/{character_id}', headers=auth(other_token))
    assert forbidden.status_code == 404
    assert forbidden.json()['detail'] == 'CHARACTER_NOT_FOUND'
    listed = client.get('/characters', headers=auth(other_token)).json()
    assert [row['name'] for row in listed['characters']] == []
    spec = client.get('/opening', params={'character_id': character_id}, headers=auth(other_token))
    assert spec.status_code == 404


def test_owner_sees_the_character_and_the_right_battle_spec(client):
    login, _password = register(client, 'spec')
    token = login_session(client, login)
    character = create_character(client, token, '开场行者').json()['character']
    view = client.get(f'/characters/{character["id"]}', headers=auth(token)).json()
    assert view['name'] == '开场行者' and view['account_id'] == character['account_id']
    spec = client.get('/opening', params={'character_id': character['id']}, headers=auth(token))
    assert spec.status_code == 200
    body = spec.json()['battle_spec']
    assert body['encounter_id'] == 'm0_opening'
    assert body['ruleset_version'] == 'ruleset-0001-m0'
    assert body['seed'] == 20260927
    assert [actor['id'] for actor in body['actors']] == ['hero', 'raider_1', 'raider_2']
    assert sorted(skill['id'] for skill in body['skills']) == ['strike', 'sweep']
    # The server decides the rules; nothing asks the client what it wants.
    assert body['character']['id'] == character['id']
