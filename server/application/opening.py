"""The opening BattleSpec: the smallest example of "server decides, client plays".

The server owns what a battle may contain - which ruleset, which encounter,
which skill parameters, which seed - and hands the client a complete, read-only
BattleSpec. Nothing here touches Godot, a scene or a window: the spec is plain
JSON derived from the public content build.
"""
from __future__ import annotations

import json
from pathlib import Path

from server.application import accounts
from server.domain import versions

PUBLIC_CONTENT = Path(__file__).resolve().parents[2] / 'content/build/public/combat.json'
OPENING_ENCOUNTER_ID = 'm0_opening'

SPEC_KEYS = ('encounter_id', 'ruleset_version', 'protocol_version', 'seed', 'arena', 'skills', 'actors')


def _public_content() -> dict:
    if not PUBLIC_CONTENT.exists():
        raise RuntimeError('CONTENT_BUILD_MISSING')
    document = json.loads(PUBLIC_CONTENT.read_text())
    if not document.get('skills') or not document.get('encounters'):
        raise RuntimeError('CONTENT_BUILD_EMPTY')
    return document


def opening_spec(account_id: int, character_id: int) -> dict | None:
    """Return a BattleSpec for the opening encounter, or None if not owned.

    Read-only by design: no receipt is written for opening a local battle. Only
    the reported outcome will later be allowed to change durable state.
    """
    character = accounts.character_view(account_id, character_id)
    if character is None:
        return None
    content = _public_content()
    encounter = next((item for item in content['encounters'] if item.get('id') == OPENING_ENCOUNTER_ID), None)
    if encounter is None:
        raise RuntimeError('OPENING_ENCOUNTER_MISSING')
    values = versions.versions()
    seed = int(encounter.get('seed') or 1)
    # The seed comes from content, not from the clock: re-entering this opening
    # replays the same battle, which is what makes client/server comparisons and
    # retry-after-crash behaviour reproducible.
    return {
        'battle_id': f'{OPENING_ENCOUNTER_ID}:{character_id}',
        'encounter_id': OPENING_ENCOUNTER_ID,
        'ruleset_version': values['ruleset_version'],
        'protocol_version': values['protocol_version'],
        'client_version': values['client_version'],
        'db_schema_version': values['db_schema_version'],
        'seed': seed,
        'arena': dict(encounter.get('arena', {})),
        'skills': [dict(skill) for skill in content['skills']],
        'actors': [dict(actor) for actor in encounter.get('actors', [])],
        'character': character,
    }
