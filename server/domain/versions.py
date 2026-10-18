"""One source for the four versions. They move independently."""
from __future__ import annotations

import json
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
_cached: dict | None = None


def versions() -> dict:
    global _cached
    if _cached is None:
        _cached = json.loads((_ROOT / 'contracts/version.json').read_text())
    return _cached
