"""One command for the manual web flow: the exact defect the independent
acceptance found was that `make api` + `make web-serve` never worked together —
the API had no CORS origin for the static page, and the static server picked a
random port nobody could predict.

`make dev` fixes that by construction:

* the static page gets a FIXED address (default http://127.0.0.1:8602, override
  with ABYSS_WEB_PORT) so the origin is deterministic;
* the API is started with ABYSS_CORS_ORIGINS set to exactly that origin — the
  allow-list stays restricted, it is just wired automatically;
* the disposable PostgreSQL is started and migrated here, and its DSN is
  printed, so nothing has to be copied between terminals;
* Ctrl-C (or SIGTERM) stops the API, stops the database, DELETES the cluster
  directory and frees the ports — every path goes through one finally block.

What the second acceptance found: this process reported "bytes removed" while
the directory was still on disk, because it measured the cluster and stopped it
but never deleted it. Cleanup is now a single verified step
(pgproc.stop_and_delete): stop, verify, delete, re-measure. Anything left is
reported as a failure and the exit code is non-zero, so a number printed here
means bytes that are actually gone.

Environment, all optional: ABYSS_WEB_PORT, ABYSS_API_PORT, ABYSS_WEB_BUILD
(directory holding index.html), ABYSS_DEV_EXIT_AFTER (seconds; lets the
lifecycle regression exercise the normal exit path without a signal),
ABYSS_DEV_HEALTH_TIMEOUT (seconds to wait for /health before giving up).
"""
from __future__ import annotations

import contextlib
import os
import signal
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools import pgproc  # noqa: E402
from tools.web_check import StaticServer  # noqa: E402

PY = str(ROOT / '.venv' / 'bin' / 'python') if (ROOT / '.venv' / 'bin' / 'python').exists() \
    else sys.executable
BUILD = ROOT / 'web-build'


class DevError(RuntimeError):
    """A startup step failed; cleanup still runs and the exit code is non-zero."""


def _port_from_env(name: str, fallback: int) -> int:
    raw = (os.environ.get(name) or '').strip()
    if not raw:
        return fallback
    try:
        return int(raw)
    except ValueError:
        raise SystemExit(f'{name} must be an integer, got: {raw}') from None


def _seconds_from_env(name: str, fallback: float) -> float:
    raw = (os.environ.get(name) or '').strip()
    if not raw:
        return fallback
    try:
        return max(0.0, float(raw))
    except ValueError:
        raise SystemExit(f'{name} must be a number of seconds, got: {raw}') from None


def _run(command: list[str], *, env: dict | None = None, timeout: float = 120.0) -> None:
    done = subprocess.run(command, cwd=str(ROOT), env=env, capture_output=True, text=True,
                          timeout=timeout)
    if done.returncode != 0:
        tail = (done.stdout + done.stderr).strip()[-500:]
        raise DevError(f'{" ".join(command)} failed with code {done.returncode}'
                       + (f': {tail}' if tail else ''))


def _terminate_group(process: subprocess.Popen) -> None:
    try:
        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
    except (ProcessLookupError, PermissionError):
        process.terminate()
    try:
        process.wait(timeout=10)
        return
    except subprocess.TimeoutExpired:
        pass
    with contextlib.suppress(Exception):
        os.killpg(os.getpgid(process.pid), signal.SIGKILL)
    process.wait(timeout=10)


def main() -> int:
    build = Path(os.environ.get('ABYSS_WEB_BUILD') or BUILD)
    if not (build / 'index.html').exists():
        raise SystemExit(f'Web 构建缺失：{build}/index.html\n'
                         '先运行 `make web` 导出 Web 构建，或用 ABYSS_WEB_BUILD 指向已有构建目录')
    web_port = _port_from_env('ABYSS_WEB_PORT', 8602)
    api_port = _port_from_env('ABYSS_API_PORT', 8601)
    exit_after = _seconds_from_env('ABYSS_DEV_EXIT_AFTER', 0.0)
    health_timeout = _seconds_from_env('ABYSS_DEV_HEALTH_TIMEOUT', 30.0)
    origin = f'http://127.0.0.1:{web_port}'

    static = StaticServer(build, web_port)
    cluster = None
    api_process = None
    stopped: list[str] = []
    errors: list[str] = []
    code = 0
    try:
        static.thread.start()
        cluster = pgproc.start()
        print(f'数据库   : {cluster.dsn}', flush=True)
        _run([PY, str(ROOT / 'tools/migrate.py')],
             env={**os.environ, 'ABYSS_DSN': cluster.dsn, 'PYTHONPATH': str(ROOT)})
        api_process = subprocess.Popen(
            [PY, '-m', 'uvicorn', 'server.main:app', '--host', '127.0.0.1',
             '--port', str(api_port), '--log-level', 'warning'],
            cwd=str(ROOT), env={**os.environ, 'ABYSS_DSN': cluster.dsn, 'PYTHONPATH': str(ROOT),
                                'ABYSS_CORS_ORIGINS': origin},
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
        _wait_healthy(api_port, health_timeout)
        print()
        print(' Abyss Walker — 手动体验（全部由本进程管理，Ctrl-C 一次性停止并删除数据库）', flush=True)
        print(f'   游戏页面 : {origin}/          <- 浏览器打开这个', flush=True)
        print(f'   API      : http://127.0.0.1:{api_port}   (CORS 已允许 {origin})', flush=True)
        print('   操作     : 输入账号（≥3 位）与密码（≥12 位），点「登录」或「注册并登录」，'
              '再点「出发战斗」（1 / 2 技能，空格暂停）', flush=True)
        print(flush=True)
        _serve_until_interrupted(exit_after)
    except KeyboardInterrupt:
        print('\n收到中断，正在停止并清理…', flush=True)
    except (DevError, SystemExit) as error:
        errors.append(f'{error}')
        code = 1
    except Exception as error:  # noqa: BLE001
        errors.append(f'{type(error).__name__}: {error}')
        code = 1
    finally:
        if api_process is not None:
            try:
                _terminate_group(api_process)
                stopped.append(f'api (pid {api_process.pid})')
            except Exception as error:  # noqa: BLE001
                errors.append(f'api did not stop: {type(error).__name__}: {error}')
        try:
            static.httpd.shutdown()
            static.httpd.server_close()
            stopped.append(f'static server :{static.port}')
        except Exception as error:  # noqa: BLE001
            errors.append(f'static server did not stop: {type(error).__name__}: {error}')
        if cluster is not None:
            try:
                entry = pgproc.stop_and_delete(cluster)
            except Exception as error:  # noqa: BLE001
                entry = {'stopped': False, 'removed': False,
                         'error': f'{type(error).__name__}: {error}'}
            if (entry.get('stopped') and entry.get('verified') and entry.get('removed')
                    and not entry.get('bytes_after')):
                stopped.append(f"postgres (stopped, deleted {entry['work_dir']}, "
                               f"{entry['bytes_removed']} bytes)")
            else:
                errors.append(f'postgres cleanup incomplete: {entry}')
                if entry.get('retained'):
                    errors.append(f'left behind for inspection: {entry["retained"]}')

    if errors:
        code = 1
    print('stopped: ' + ('; '.join(stopped) if stopped else 'nothing to stop'), flush=True)
    if errors:
        print('ERRORS:', flush=True)
        for line in errors:
            print(f'  - {line}', flush=True)
    return code


def _serve_until_interrupted(exit_after: float) -> None:
    if exit_after <= 0:
        while True:
            time.sleep(3600)
    print(f'（ABYSS_DEV_EXIT_AFTER={exit_after:g}s，到点后按正常路径退出）', flush=True)
    time.sleep(exit_after)


def _wait_healthy(port: int, timeout: float = 30.0) -> None:
    import httpx

    deadline = time.monotonic() + timeout
    last = 'no answer yet'
    while time.monotonic() < deadline:
        try:
            with httpx.Client(timeout=2.0, trust_env=False) as probe:
                response = probe.get(f'http://127.0.0.1:{port}/health')
            if response.status_code == 200 and response.json().get('database') == 'ok':
                return
            last = f'HTTP {response.status_code}'
        except httpx.HTTPError as error:
            last = f'{type(error).__name__}: {error}'
        time.sleep(0.25)
    raise DevError(f'API 在 {timeout}s 内未就绪：{last}')


def _handle(signum, frame) -> None:  # noqa: ARG001
    raise KeyboardInterrupt(f'signal {signum}')


if __name__ == '__main__':
    for name in ('SIGTERM', 'SIGHUP'):
        with contextlib.suppress(ValueError, AttributeError, OSError):
            signal.signal(getattr(signal, name), _handle)
    sys.exit(main())
