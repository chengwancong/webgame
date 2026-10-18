"""Validate the single content source and split it into public and private outputs.

Public output is what a client package may see. Private output stays on the
server: drop weights and reward ranges are never shipped to players.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'content/src'
SCHEMA = ROOT / 'content/schema'
OUT = ROOT / 'content/build'


def load(name: str) -> dict:
    return json.loads((SRC / name).read_text())


def validate(document: dict, schema_name: str) -> None:
    import jsonschema
    schema = json.loads((SCHEMA / schema_name).read_text())
    jsonschema.validate(document, schema)


def main() -> int:
    public = {'skills': load('skills.json')['skills'], 'encounters': load('encounters.json')['encounters']}
    private = load('rewards.json')
    validate(public, 'public.schema.json')
    validate(private, 'private.schema.json')

    referenced = {skill['id'] for skill in public['skills']}
    encounters = {encounter['id'] for encounter in public['encounters']}
    for grant in private['grants']:
        if grant['encounter_id'] not in encounters:
            raise SystemExit(f"grant {grant['id']} references unknown encounter {grant['encounter_id']}")
    if not referenced:
        raise SystemExit('no skills in content source')

    digest = hashlib.sha256(json.dumps(public, sort_keys=True).encode()).hexdigest()
    versions = json.loads((ROOT / 'contracts/version.json').read_text())
    ruleset = versions['ruleset_version']
    (OUT / 'public').mkdir(parents=True, exist_ok=True)
    (OUT / 'private').mkdir(parents=True, exist_ok=True)
    (OUT / 'public/combat.json').write_text(json.dumps(public, ensure_ascii=False, indent=1))
    (OUT / 'private/rewards.json').write_text(json.dumps(private, ensure_ascii=False, indent=1))
    # The API copies its public view into every BattleSpec it hands out. The
    # client package never receives private data.
    (OUT / 'public/bundle.json').write_text(json.dumps(
        {'ruleset_version': ruleset, 'protocol_version': versions['protocol_version'], 'content': public},
        ensure_ascii=False, indent=1))
    # The client-side file is a fixture for offline/headless runs only. It is
    # generated so it cannot drift away from the content source, and every
    # online path takes its BattleSpec from the API instead.
    fixture = {'_purpose': ('M0 fixture: offline sample battle for headless checks and offline runs only. '
                            'It is not a server response; the online flow uses the BattleSpec from the API.'),
               'ruleset_version': ruleset, **public}
    (ROOT / 'client/data').mkdir(parents=True, exist_ok=True)
    (ROOT / 'client/data/fixture_combat.json').write_text(json.dumps(fixture, ensure_ascii=False, indent=1))
    (OUT / 'manifest.json').write_text(json.dumps({
        'ruleset_version': ruleset,
        'public_digest': digest,
        'public_files': ['combat.json'],
        'private_files': ['rewards.json'],
        'private_never_shipped': True,
    }, ensure_ascii=False, indent=1))
    print(f"content ok: {len(public['skills'])} skills, {len(public['encounters'])} encounters, ruleset {ruleset}")
    return 0


if __name__ == '__main__':
    sys.exit(main())
