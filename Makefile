# Every target works from a clean terminal with no special environment.
# The interpreter is pinned in tools/bootstrap.py (Python 3.12.x).

PY := .venv/bin/python
GODOT := /Applications/Godot-4.7.app/Contents/MacOS/Godot

.PHONY: setup content core-test view-run db migrate api dev server-test web check ci clean

setup:
	tools/setup

content:
	$(PY) tools/build_content.py

## Headless battle-core contract: deterministic, terminal, bounded.
core-test:
	$(PY) tools/godot_check.py core

## Opens the visible scene locally (a window; close it to exit).
view-run:
	$(GODOT) --path client

## Disposable development database. Ctrl-C stops it and deletes the cluster,
## and the exit code is non-zero if that cleanup did not fully happen.
## Copy the printed ABYSS_DSN into your shell before make migrate / make api.
## Run as a module so the repository root is on sys.path even in a terminal
## with no PYTHONPATH set: `python tools/pgproc.py` cannot import `tools`.
db:
	$(PY) -m tools.pgproc

migrate:
	$(PY) tools/migrate.py

api:
	$(PY) -m uvicorn server.main:app --host 127.0.0.1 --port 8601

server-test:
	$(PY) -m pytest tests/server -q

## Real Web export into web-build/ (gitignored; served by make web-serve).
web:
	$(GODOT) --headless --path client --export-release Web ../web-build/index.html

web-serve:
	$(PY) tools/web_serve.py

## One command for the manual flow: disposable database, migrated API with the
## exact static origin allowed (CORS stays restricted, just wired), and the
## exported build on a FIXED address. Ctrl-C stops the API and the database,
## deletes the cluster directory, and reports the bytes actually deleted.
dev:
	$(PY) tools/dev.py

## Full M0 pipeline: content, compile, export, disposable database, migrations,
## the whole test suite (skips are failures), browser flow, cleanup.
check:
	$(PY) tools/check.py

ci: check

clean:
	$(PY) tools/clean.py
