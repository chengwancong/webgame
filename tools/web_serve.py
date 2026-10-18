"""Serve the exported Web build for manual checking. Not a deployment."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from tools.web_check import StaticServer  # noqa: E402

BUILD = ROOT / 'web-build'


def main() -> int:
    if not (BUILD / 'index.html').exists():
        raise SystemExit('web-build/index.html is missing; run make web first')
    server = StaticServer(BUILD, port=int(sys.argv[1]) if len(sys.argv) > 1 else None)
    print(f'serving {BUILD} at {server.base_url} (Ctrl-C to stop)')
    print('the API must run separately: make api  (default http://127.0.0.1:8601)')
    try:
        with server:
            while True:
                import time
                time.sleep(3600)
    except KeyboardInterrupt:
        print('stopped')
    return 0


if __name__ == '__main__':
    sys.exit(main())
