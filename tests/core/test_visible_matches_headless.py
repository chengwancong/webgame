"""The M0 cross-check: the visible scene and the pure-headless core must agree.

They both receive the BattleSpec the server just returned for a real character,
driven by the same seed and the same per-tick policy. The comparison uses the
key event sequence and the terminal state, not a shortened summary string.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import httpx

from tests.conftest import (auth, create_character, godot_run, login_session, open_session, register)

TRACED_KEYS = ('tick', 'outcome', 'seed', 'encounter_id', 'snapshot', 'events')


def _extract(name: str, text: str) -> dict:
    match = re.search(rf'^{name} (\{{.*\}})$', text, re.M)
    assert match, f'no {name} line in output:\n{text[-1500:]}'
    return json.loads(match.group(1))


def test_server_spec_drives_identical_visible_and_headless_battles(client, tmp_path):
    login, _password = register(client, 'client')
    session = open_session(client, login)
    token = session['session_token']
    character = create_character(client, token, '共鸣行者').json()['character']

    response = client.get('/opening', params={'character_id': character['id']}, headers=auth(token))
    assert response.status_code == 200, response.text
    battle_spec = response.json()['battle_spec']
    spec_path = Path(tmp_path) / 'opening_spec.json'
    spec_path.write_text(json.dumps(battle_spec))

    headless = godot_run('cross-headless', 'res://tests/battle_core_headless.gd',
                         extra_args=['--', '--spec', str(spec_path)], expect_pattern=r'BATTLE_CORE_HEADLESS \{',
                         timeout_seconds=90.0, max_output_bytes=400_000,
                         log_file=str(tmp_path / 'headless.log'))
    assert headless.ok, headless.reason
    visible = godot_run('cross-visible', 'res://tests/visible_trace.gd',
                        extra_args=['--', '--spec', str(spec_path)], expect_pattern=r'VISIBLE_TRACE \{',
                        timeout_seconds=90.0, max_output_bytes=400_000,
                        log_file=str(tmp_path / 'visible.log'))
    assert visible.ok, visible.reason

    baseline = _extract('BATTLE_CORE_HEADLESS', headless.stdout)
    rendered = _extract('VISIBLE_TRACE', visible.stdout)

    assert baseline['source'] == 'server' == rendered['source']
    assert baseline['encounter_id'] == 'm0_opening'
    for key in TRACED_KEYS:
        assert baseline[key] == rendered[key], (
            f'visible and headless disagree on {key}:\n'
            f'headless={json.dumps(baseline[key], ensure_ascii=False)[:600]}\n'
            f'visible ={json.dumps(rendered[key], ensure_ascii=False)[:600]}')
    assert baseline['outcome'] in ('cleared', 'defeated')
    assert len(baseline['events']) >= 5, 'a comparison over too few events proves nothing'
    deaths = [event for event in baseline['events'] if event.get('kind') == 'death']
    assert len(deaths) == 2, 'both enemies must actually die in the scripted M0 opening'


def test_the_client_can_reach_the_api_over_real_http(api_base, client):
    """The track the Godot side uses is reachable and answers; no local stub."""
    response = httpx.get(f'{api_base}/version', timeout=10.0)
    assert response.status_code == 200
    versions = response.json()
    assert versions['protocol_version'] >= 1
    health = httpx.get(f'{api_base}/health', timeout=10.0).json()
    assert health['database'] == 'ok'


def test_opening_spec_is_stable_across_sessions_and_rereads(client, tmp_path):
    login, _password = register(client, 'stable')
    first_token = login_session(client, login)
    character = create_character(client, first_token, '重连行者').json()['character']
    first = client.get('/opening', params={'character_id': character['id']}, headers=auth(first_token)).json()
    # A second login in another "device" must get the same rules and seed: a
    # retry is supposed to replay this opening, not roll a different one.
    again_token = login_session(client, login)
    second = client.get('/opening', params={'character_id': character['id']}, headers=auth(again_token)).json()
    for key in ('encounter_id', 'ruleset_version', 'seed'):
        assert first['battle_spec'][key] == second['battle_spec'][key]
    assert first['battle_spec']['actors'] == second['battle_spec']['actors']
