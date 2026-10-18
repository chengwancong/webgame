"""The exported Web client in a real browser, talking to the real API.

This is the "does the platform actually work" evidence for M0: Godot's Web
export is loaded by Chrome, it logs in over HTTP, creates the character itself,
asks the server for the opening BattleSpec, plays the battle with the same core
the headless harness uses, and reports the trace back to the page.

The browser result is then compared against an independent headless run of the
same server-provided spec, so a picture of the browser alone proves nothing.
"""
from __future__ import annotations

import json
import os
import re
from pathlib import Path

import httpx
import pytest

from tests.conftest import (STRONG_PASSWORD, auth, godot_run, http_client, start_api, stop_process,
                            unique_login)
from tools import web_check

CHARACTER_NAME = '浏览器行者'
EXPORT_TIMEOUT = 240.0


def _extract(name: str, text: str) -> dict:
    match = re.search(rf'^{name} (\{{.*\}})$', text, re.M)
    assert match, f'no {name} line in output:\n{text[-1500:]}'
    return json.loads(match.group(1))


def test_exported_web_client_plays_the_real_online_flow(database, tmp_path):
    build_dir = os.environ.get('ABYSS_WEB_BUILD_DIR', '').strip()
    if not build_dir:
        if os.environ.get('ABYSS_REQUIRE_INTEGRATION') == '1':
            pytest.fail('ABYSS_WEB_BUILD_DIR is required: the browser check must run, not skip')
        pytest.skip('no Web export configured for this pytest invocation; use make check')
    build_dir = Path(build_dir)
    if not (build_dir / 'index.html').exists():
        pytest.fail(f'the Web export is missing index.html in {build_dir}')

    # The server owns its port first, and only then is the API told which single
    # origin to accept: CORS is pinned to one loopback origin, never to "*".
    with web_check.serve(build_dir) as static:
        api_url, api_process = start_api(database, cors_origins=static.base_url)
        try:
            login = unique_login('web')
            with http_client(api_url) as direct:
                created = direct.post('/accounts', json={'login': login, 'password': STRONG_PASSWORD})
                assert created.status_code == 201, created.text
                # Everything after this point is done by the browser itself.

            screenshot = Path(tmp_path) / 'web-flow.png'
            flow = web_check.run_browser_flow(
                build_dir, api_base=api_url, login=login, password=STRONG_PASSWORD,
                character_name=CHARACTER_NAME, timeout_seconds=EXPORT_TIMEOUT,
                screenshot_path=str(screenshot), server=static)
            summary = flow.summary()
            assert flow.ok, f'the browser run did not complete the flow: {summary}\n{flow.status_text[:800]}'
            assert '角色' in flow.status_text or summary['trace_events'] > 0, flow.status_text[:400]
            assert not flow.console_errors, f'browser console errors: {flow.console_errors}'
            assert screenshot.exists() and screenshot.stat().st_size > 5_000, 'no usable screenshot evidence'

            # Independently: the same server data through the headless core.
            with http_client(api_url) as direct:
                token = direct.post('/sessions', json={'login': login, 'password': STRONG_PASSWORD}) \
                    .json()['session_token']
                listing = direct.get('/characters', headers=auth(token)).json()
                names = [row['name'] for row in listing['characters']]
                assert CHARACTER_NAME in names, f'the browser did not create the character: {names}'
                character = next(row for row in listing['characters'] if row['name'] == CHARACTER_NAME)
                spec = direct.get('/opening', params={'character_id': character['id']},
                                  headers=auth(token)).json()['battle_spec']
            spec_path = Path(tmp_path) / 'browser_spec.json'
            spec_path.write_text(json.dumps(spec))
            reference = godot_run('browser-reference', 'res://tests/battle_core_headless.gd',
                                  extra_args=['--', '--spec', str(spec_path)],
                                  expect_pattern=r'BATTLE_CORE_HEADLESS \{', timeout_seconds=90.0,
                                  max_output_bytes=400_000, log_file=str(tmp_path / 'reference.log'))
            assert reference.ok, reference.reason
            expected = _extract('BATTLE_CORE_HEADLESS', reference.stdout)

            for key in ('tick', 'outcome', 'seed', 'encounter_id', 'snapshot', 'events'):
                assert expected[key] == flow.trace.get(key), (
                    f'the browser battle differs from the headless reference on {key}:\n'
                    f'headless={json.dumps(expected[key], ensure_ascii=False)[:500]}\n'
                    f'browser ={json.dumps(flow.trace.get(key), ensure_ascii=False)[:500]}')
        finally:
            stop_process(api_process)
