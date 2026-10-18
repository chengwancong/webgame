"""Serve a Web export in a real browser and read back what the game reported.

Nothing here simulates the client. A static server serves the exported build,
Chrome loads it, the game performs the same HTTP flow a player would, and the
result is read out of the page with the DevTools protocol. The API it talks to
is the real one, running against the real disposable PostgreSQL started by the
check pipeline.

Why CDP and not `--virtual-time-budget`: virtual time fast-forwards timers but
cannot fast-forward real HTTP requests, so a page waiting on the network looks
finished before it has done anything. Driving the real browser and polling
`window.__awTrace` waits as long as the game actually needs, within a wall-clock
limit, and also gives access to genuine console errors.
"""
from __future__ import annotations

import base64
import contextlib
import functools
import http.server
import json
import os
import shutil
import signal
import socket
import subprocess
import sys
import tempfile
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]

CHROME_CANDIDATES = (
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    'google-chrome',
    'chromium',
)


def chrome_path() -> str:
    configured = os.environ.get('ABYSS_CHROME')
    if configured:
        return configured
    for candidate in CHROME_CANDIDATES:
        if candidate.startswith('/') and Path(candidate).exists():
            return candidate
        if not candidate.startswith('/') and shutil.which(candidate):
            return str(shutil.which(candidate))
    raise RuntimeError('CHROME_NOT_FOUND: set ABYSS_CHROME to a Chromium/Chrome binary')


def free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
        probe.bind(('127.0.0.1', 0))
        return int(probe.getsockname()[1])


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.wasm': 'application/wasm',
        '.pck': 'application/octet-stream',
        '.json': 'application/json',
        '.js': 'text/javascript',
    }

    def log_message(self, fmt: str, *args) -> None:  # keep the run log readable
        pass


class StaticServer:
    def __init__(self, directory: Path, port: int | None = None):
        self.directory = directory
        self.port = port or free_port()
        handler = functools.partial(_QuietHandler, directory=str(directory))
        self.httpd = http.server.ThreadingHTTPServer(('127.0.0.1', self.port), handler)
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    @property
    def base_url(self) -> str:
        return f'http://127.0.0.1:{self.port}'

    def __enter__(self) -> 'StaticServer':
        self.thread.start()
        return self

    def __exit__(self, *exc) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()


def serve(directory: str | Path, port: int | None = None) -> StaticServer:
    return StaticServer(Path(directory), port)


@dataclass
class BrowserFlowResult:
    ok: bool
    elapsed_seconds: float = 0.0
    status_text: str = ''
    trace: dict | None = None
    console_errors: list = field(default_factory=list)
    returncode: int | None = None
    stdout: str = ''
    stderr: str = ''

    def summary(self) -> dict:
        return {
            'ok': self.ok,
            'elapsed_seconds': round(self.elapsed_seconds, 3),
            'status_text': self.status_text[:1000],
            'trace_tick': (self.trace or {}).get('tick'),
            'trace_outcome': (self.trace or {}).get('outcome'),
            'trace_events': len((self.trace or {}).get('events', [])),
            'console_errors': self.console_errors,
            'returncode': self.returncode,
        }


def run_browser_flow(
    build_dir: str | Path,
    *,
    api_base: str,
    login: str,
    password: str,
    character_name: str,
    timeout_seconds: float = 180.0,
    screenshot_path: str | Path | None = None,
    port: int | None = None,
    server: StaticServer | None = None,
) -> BrowserFlowResult:
    """Load the exported game in Chrome, let it play, and read its report."""
    build_dir = Path(build_dir)
    if not (build_dir / 'index.html').exists():
        raise RuntimeError('EXPORT_MISSING: run the Web export before the browser check')
    result = BrowserFlowResult(ok=False)
    started = time.monotonic()
    # An already running server is reused instead of opening a second one on the
    # same port; either way exactly one process serves the export.
    outer = contextlib.nullcontext(server) if server is not None else StaticServer(build_dir, port)
    with outer as opened:
        query = (f'aw_api={api_base}&aw_login={login}&aw_password={password}'
                 f'&aw_character={character_name}&aw_auto=1')
        url = f'{opened.base_url}/index.html?{query}'
        with ChromeSession(url) as chrome:
            deadline = time.monotonic() + timeout_seconds
            while time.monotonic() < deadline:
                trace = chrome.evaluate('window.__awTrace || ""')
                result.status_text = str(chrome.evaluate('window.__awStatus || ""') or '')
                if trace:
                    try:
                        result.trace = json.loads(trace)
                    except json.JSONDecodeError:
                        result.trace = None
                    break
                time.sleep(0.4)
            if screenshot_path is not None:
                shot = chrome.screenshot()
                if shot:
                    Path(screenshot_path).write_bytes(shot)
            result.console_errors = chrome.errors()
        result.returncode = 0
        result.elapsed_seconds = time.monotonic() - started
        result.ok = (result.trace is not None and (result.trace.get('outcome') or '') != ''
                     and not result.console_errors)
        result.stdout = f'page={url}'
    return result


class ChromeSession:
    """Headless Chrome driven over the DevTools protocol, inside a time limit."""

    def __init__(self, url: str):
        self.url = url
        self.port = free_port()
        self.profile = Path(tempfile.mkdtemp(prefix='awr-chrome-'))
        self.process: subprocess.Popen | None = None
        self.socket = None
        self._errors: list[str] = []
        self._messages: list[dict] = []
        self._stderr_lines: list[str] = []
        self._sequence = 0
        self.stderr_tail = ''

    def __enter__(self) -> 'ChromeSession':
        self.process = subprocess.Popen([
            chrome_path(), '--headless=new', '--disable-gpu', '--no-sandbox',
            '--enable-unsafe-swiftshader', '--mute-audio', '--hide-scrollbars',
            '--no-proxy-server', '--disable-background-timer-throttling',
            f'--remote-debugging-port={self.port}', f'--user-data-dir={self.profile}',
            '--window-size=1152,720', '--no-first-run', self.url,
        ], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True, start_new_session=True)
        threading.Thread(target=self._drain_stderr, daemon=True).start()
        self._connect()
        return self

    def __exit__(self, *exc) -> None:
        if self.socket is not None:
            with contextlib.suppress(Exception):
                self.socket.close()
        if self.process is not None:
            try:
                os.killpg(os.getpgid(self.process.pid), signal.SIGTERM)
            except (ProcessLookupError, PermissionError, OSError):
                self.process.terminate()
            with contextlib.suppress(subprocess.TimeoutExpired):
                self.process.wait(timeout=10)
        shutil.rmtree(self.profile, ignore_errors=True)
        self.stderr_tail = '\n'.join(self._stderr_lines[-40:])

    def _drain_stderr(self) -> None:
        if self.process is None or self.process.stderr is None:
            return
        for line in self.process.stderr:
            self._stderr_lines.append(line.rstrip())
            if len(self._stderr_lines) > 200:
                self._stderr_lines = self._stderr_lines[-200:]

    def _connect(self) -> None:
        from websockets.sync.client import connect

        deadline = time.time() + 30.0
        target = None
        with httpx.Client(timeout=5.0, trust_env=False) as http_client:
            while time.time() < deadline:
                try:
                    listing = http_client.get(f'http://127.0.0.1:{self.port}/json/list').json()
                except httpx.HTTPError:
                    time.sleep(0.3)
                    continue
                for entry in listing:
                    if entry.get('type') == 'page' and 'index.html' in entry.get('url', ''):
                        target = entry
                        break
                if target is None:
                    for entry in listing:
                        if entry.get('type') == 'page':
                            target = entry
                            break
                if target is not None:
                    break
                time.sleep(0.3)
        if target is None:
            raise RuntimeError('CHROME_TARGET_NOT_FOUND: could not reach the page target')
        self.socket = connect(target['webSocketDebuggerUrl'], open_timeout=20.0)
        self._send(0, 'Runtime.enable', {})
        self._send(1, 'Log.enable', {})
        threading.Thread(target=self._read_loop, daemon=True).start()

    def _read_loop(self) -> None:
        if self.socket is None:
            return
        while True:
            try:
                raw = self.socket.recv(timeout=1.0)
            except TimeoutError:
                # An idle second is normal. Returning here used to kill the only
                # reader on the socket: later commands then timed out with no
                # answer and the session eventually died on a keepalive ping.
                # The pipeline's flow hid this because that page keeps logging.
                continue
            except Exception:  # noqa: BLE001 - the socket closes when Chrome exits
                return
            if raw is None:
                continue
            try:
                message = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue
            self._messages.append(message)
            method = message.get('method', '')
            params = message.get('params', {})
            if method == 'Runtime.exceptionThrown':
                details = params.get('exceptionDetails', {})
                self._errors.append('exception: ' + str(details.get('text')) + ' ' +
                                    str(details.get('exception', {}).get('description', ''))[:300])
            elif method == 'Runtime.consoleAPICalled' and params.get('type') == 'error':
                parts = [str(arg.get('value', arg.get('description', ''))) for arg in params.get('args', [])]
                self._errors.append('console: ' + ' '.join(parts)[:300])
            elif method == 'Log.entryAdded' and params.get('entry', {}).get('level') == 'error':
                self._errors.append('log: ' + str(params['entry'].get('text'))[:300])

    def _send(self, identifier: int, method: str, params: dict) -> None:
        if self.socket is None:
            raise RuntimeError('CHROME_NOT_CONNECTED')
        self.socket.send(json.dumps({'id': identifier, 'method': method, 'params': params}))

    def evaluate(self, expression: str) -> object:
        if self.socket is None:
            return None
        self._sequence += 1
        identifier = 1000 + self._sequence
        self._send(identifier, 'Runtime.evaluate', {'expression': expression, 'returnByValue': True})
        deadline = time.time() + 10.0
        while time.time() < deadline:
            for message in list(self._messages):
                if message.get('id') == identifier:
                    return message.get('result', {}).get('result', {}).get('value')
            time.sleep(0.1)
        return None

    def screenshot(self) -> bytes | None:
        if self.socket is None:
            return None
        self._sequence += 1
        identifier = 5000 + self._sequence
        self._send(identifier, 'Page.captureScreenshot', {'format': 'png'})
        deadline = time.time() + 15.0
        while time.time() < deadline:
            for message in list(self._messages):
                if message.get('id') == identifier:
                    data = message.get('result', {}).get('data')
                    return base64.b64decode(data) if data else None
            time.sleep(0.1)
        return None

    def errors(self) -> list[str]:
        return [entry for entry in self._errors if entry][:20]


if __name__ == '__main__':
    flow = run_browser_flow(sys.argv[1], api_base=sys.argv[2], login=sys.argv[3],
                            password=sys.argv[4], character_name=sys.argv[5])
    print(json.dumps(flow.summary(), ensure_ascii=False, indent=1))
    print(flow.status_text[:2000])
