"""Shared test bootstrap: put the repository root on the import path.

Nothing here stubs a database, a network or an identity. Tests that need those
use the real ones, and the helpers below only start processes and connections.
"""
from __future__ import annotations

import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import httpx
import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

REQUIRED_INTEGRATION = 'ABYSS_REQUIRE_INTEGRATION'
GODOT = os.environ.get('ABYSS_GODOT', '/Applications/Godot-4.7.app/Contents/MacOS/Godot')


def godot() -> str:
    if not Path(GODOT).exists():
        pytest.fail(f'Godot binary not found at {GODOT}; set ABYSS_GODOT to the locked 4.7 binary')
    return GODOT


def godot_run(name: str, script: str, *, extra_args: list[str] = (), expect_pattern: str | None = None,
              timeout_seconds: float = 120.0, max_output_bytes: int = 1_000_000,
              log_file: str | None = None, project_path: str | None = None):
    """Run a Godot script with the same bounds the check pipeline uses."""
    sys.path.insert(0, str(ROOT))
    from tools import processguard

    argv = [godot(), '--headless', '--path', project_path or str(ROOT / 'client')]
    if log_file:
        argv += ['--log-file', log_file]
    argv += ['--script', script, *extra_args]
    return processguard.run_guarded(
        name, argv, timeout_seconds=timeout_seconds, max_output_bytes=max_output_bytes,
        log_path=log_file, fail_patterns=processguard.GODOT_FAIL_PATTERNS, expect_pattern=expect_pattern)


def repo_root() -> Path:
    return ROOT


def python() -> str:
    return str(ROOT / '.venv' / 'bin' / 'python') if (ROOT / '.venv' / 'bin' / 'python').exists() else sys.executable


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(('127.0.0.1', 0))
        return int(probe.getsockname()[1])


def http_client(base_url: str = '', timeout: float = 15.0) -> httpx.Client:
    """Local-loopback client: never inherit ambient proxy settings.

    This machine's environment exports HTTP_PROXY. Left alone, the second
    request on a proxied connection is sent in absolute-form and the server
    answers 404 for a route that plainly exists. Test traffic to 127.0.0.1 must
    go direct, not through whatever the shell exports.
    """
    return httpx.Client(base_url=base_url, timeout=timeout, trust_env=False)


def wait_until_healthy(base_url: str, timeout: float = 25.0) -> None:
    deadline = time.time() + timeout
    last = 'never answered'
    while time.time() < deadline:
        try:
            with http_client(timeout=2.0) as probe:
                response = probe.get(f'{base_url}/health')
            if response.status_code == 200 and response.json().get('database') == 'ok':
                return
            last = f'{response.status_code}: {response.text[:120]}'
        except httpx.HTTPError as error:
            last = f'{type(error).__name__}: {error}'
        time.sleep(0.2)
    raise AssertionError(f'API did not become healthy at {base_url}: {last}')


@pytest.fixture(scope='session')
def database() -> str:
    """The real PostgreSQL for this run. Missing means failure, not a skip.

    Skipping silently is what let a green check coexist with no database work
    being done at all.
    """
    dsn = os.environ.get('ABYSS_DSN', '').strip()
    if not dsn:
        if os.environ.get(REQUIRED_INTEGRATION) == '1':
            pytest.fail('ABYSS_DSN is required: database-backed checks must run, not skip')
        pytest.skip('ABYSS_DSN not set; set it or use make check which starts a disposable database')
    os.environ['ABYSS_DSN'] = dsn
    sys.path.insert(0, str(ROOT))
    from server.infrastructure import db

    db.apply_migrations()
    return dsn


def start_api(database: str, cors_origins: str = '', extra_env: dict | None = None):
    """Start a real API process and return (base_url, popen). Caller stops it."""
    import signal

    port = free_port()
    env = {**os.environ, 'ABYSS_DSN': database, 'PYTHONPATH': str(ROOT),
           'ABYSS_CORS_ORIGINS': cors_origins, **(extra_env or {})}
    command = [python(), '-m', 'uvicorn', 'server.main:app', '--host', '127.0.0.1',
               '--port', str(port), '--log-level', 'warning']
    process = subprocess.Popen(command, cwd=str(ROOT), env=env, start_new_session=True)
    try:
        wait_until_healthy(f'http://127.0.0.1:{port}')
    except AssertionError:
        stop_process(process)
        raise
    return f'http://127.0.0.1:{port}', process


def stop_process(process: subprocess.Popen) -> None:
    import signal
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()


@pytest.fixture(scope='session')
def api_base(database: str) -> str:
    """A real API process on a real socket.

    The application code, the database driver and the HTTP stack are all real:
    an in-process transport would hide exactly the failures this layer needs to
    prove absent.
    """
    base_url, process = start_api(database, os.environ.get('ABYSS_CORS_ORIGINS', ''))
    try:
        yield base_url
    finally:
        stop_process(process)


@pytest.fixture()
def client(api_base: str):
    with http_client(api_base) as loopback_client:
        yield loopback_client


def unique_login(prefix: str) -> str:
    return f'{prefix}_{int(time.time() * 1000) % 10_000_000}_{os.getpid()}'


STRONG_PASSWORD = 'a long enough password'


def register(http_client: httpx.Client, prefix: str = 'm0') -> tuple[str, str]:
    login = unique_login(prefix)
    response = http_client.post('/accounts', json={'login': login, 'password': STRONG_PASSWORD})
    assert response.status_code == 201, response.text
    return login, STRONG_PASSWORD


def login_session(http_client: httpx.Client, login: str, password: str = STRONG_PASSWORD) -> str:
    return open_session(http_client, login, password)['session_token']


def open_session(http_client: httpx.Client, login: str, password: str = STRONG_PASSWORD) -> dict:
    response = http_client.post('/sessions', json={'login': login, 'password': password})
    assert response.status_code == 201, response.text
    return response.json()


def auth(token: str) -> dict:
    return {'Authorization': f'Bearer {token}'}


def create_character(http_client: httpx.Client, token: str, name: str = '回廊行者',
                     command_id: str | None = None) -> httpx.Response:
    import uuid
    return http_client.post('/characters', json={'command_id': command_id or str(uuid.uuid4()), 'name': name},
                            headers=auth(token))
