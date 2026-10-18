"""Terminal-blow regression for the combat core.

The independent acceptance found the defect this file pins down: when a skill
resolved the last enemy's death, the auto-attack loop still ran, read an empty
target and crashed — the snapshot said "cleared" but the killing tick's damage
and death events were gone. Every case here drives the real headless harness
(real Godot process, error patterns enforced, exit code never trusted alone)
and checks the full trace: outcome, event completeness and no advancement past
the terminal tick.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from tests.conftest import godot_run

CORE_COMPLETION_TIMEOUT = 90.0
OUTPUT_CAP = 400_000
ORIGINAL_REPRO = Path(__file__).resolve().parent / 'fixtures' / 'core-terminal-repro.json'


def _extract(text: str) -> dict:
    match = re.search(r'^BATTLE_CORE_HEADLESS (\{.*\})$', text, re.M)
    assert match, f'no headless trace in output:\n{text[-1500:]}'
    return json.loads(match.group(1))


def _run_headless(tmp_path, name: str, spec: dict | None = None):
    extra_args: list[str] = []
    if spec is not None:
        spec_path = tmp_path / f'{name}-spec.json'
        spec_path.write_text(json.dumps(spec, ensure_ascii=False), encoding='utf-8')
        extra_args = ['--', '--spec', str(spec_path)]
    result = godot_run(
        f'core-{name}', 'res://tests/battle_core_headless.gd', extra_args=extra_args,
        expect_pattern=r'BATTLE_CORE_HEADLESS \{', timeout_seconds=CORE_COMPLETION_TIMEOUT,
        max_output_bytes=OUTPUT_CAP, log_file=str(tmp_path / f'{name}.log'))
    assert result.ok, f'{name}: {result.reason}\n{result.stdout[-1200:]}'
    return _extract(result.stdout)


def _hero(**overrides) -> dict:
    actor = {'id': 'hero', 'side': 'player', 'max_hp': 120, 'damage': 10, 'range': 3.0,
             'attack_ticks': 6, 'speed': 0.6, 'x': 0.0}
    actor.update(overrides)
    return actor


def _enemy(enemy_id: str, **overrides) -> dict:
    actor = {'id': enemy_id, 'side': 'enemy', 'max_hp': 40, 'damage': 0, 'range': 1.0,
             'attack_ticks': 6, 'speed': 0.0, 'x': 2.5}
    actor.update(overrides)
    return actor


def _skill(skill_id: str, kind: str, **overrides) -> dict:
    skill = {'id': skill_id, 'kind': kind, 'damage': 12, 'range': 3.0,
             'cooldown_ticks': 8, 'windup_ticks': 0}
    skill.update(overrides)
    return skill


def _assert_terminal(trace: dict, *, expected_outcome: str, dead: list[str], alive: list[str]):
    assert trace['outcome'] == expected_outcome, trace['outcome']
    snapshot = {row['id']: row for row in trace['snapshot']['actors']}
    for actor_id in dead:
        assert snapshot[actor_id]['alive'] is False, actor_id
        assert snapshot[actor_id]['hp'] == 0, actor_id
    for actor_id in alive:
        assert snapshot[actor_id]['alive'] is True, actor_id

    deaths = [event for event in trace['events'] if event['kind'] == 'death']
    damages = [event for event in trace['events'] if event['kind'] == 'damage']
    # Every dead actor dies exactly once, and every death is paired with a
    # damage event on the same tick: the killing blow is fully archived.
    assert sorted(event['target'] for event in deaths) == sorted(dead)
    for death in deaths:
        assert any(d['tick'] == death['tick'] and d['target'] == death['target'] for d in damages), death
    # Nothing happens after the battle is decided: the trace ends on the tick
    # that produced the last death.
    last_death_tick = max(event['tick'] for event in deaths)
    assert trace['tick'] == last_death_tick, f"trace ended on tick {trace['tick']}, last death on {last_death_tick}"


def test_default_sample_still_reaches_a_complete_terminal_state(tmp_path):
    trace = _run_headless(tmp_path, 'default')
    dead = [row['id'] for row in trace['snapshot']['actors'] if not row['alive']]
    alive = [row['id'] for row in trace['snapshot']['actors'] if row['alive']]
    assert dead, 'the default sample must produce casualties'
    _assert_terminal(trace, expected_outcome='cleared' if alive else 'defeated',
                     dead=dead, alive=alive)


def test_the_original_acceptance_repro_spec_ends_with_a_complete_killing_tick(tmp_path):
    """The retained acceptance spec, run byte for byte as a fixed regression.

    This is the spec the first acceptance kept: the default opening encounter
    with only raider_2.max_hp lowered to 1. The killing blow is the skill on
    tick 26, and before the fix the script error on that tick dropped its damage
    and death events while the snapshot still said "cleared". The spec is read
    from tests/core/fixtures/, not rebuilt here, so a variant of it can never be
    mistaken for it.
    """
    assert ORIGINAL_REPRO.exists(), f'the retained acceptance spec is missing: {ORIGINAL_REPRO}'
    result = godot_run(
        'core-original-repro', 'res://tests/battle_core_headless.gd',
        extra_args=['--', '--spec', str(ORIGINAL_REPRO)],
        expect_pattern=r'BATTLE_CORE_HEADLESS \{', timeout_seconds=CORE_COMPLETION_TIMEOUT,
        max_output_bytes=OUTPUT_CAP, log_file=str(tmp_path / 'original-repro.log'))
    assert result.ok, f'{result.reason}\n{result.stdout[-1200:]}'
    trace = _extract(result.stdout)
    assert trace['tick'] == 26, trace['tick']
    killing_tick = [event for event in trace['events'] if event['tick'] == trace['tick']]
    assert any(event['kind'] == 'damage' and event.get('target') == 'raider_2'
               for event in killing_tick), f'the killing blow must be archived: {killing_tick}'
    assert any(event['kind'] == 'death' and event.get('target') == 'raider_2'
               for event in killing_tick), f'the killing death must be archived: {killing_tick}'
    _assert_terminal(trace, expected_outcome='cleared', dead=['raider_1', 'raider_2'], alive=['hero'])


def test_a_low_hp_last_enemy_variant_keeps_the_killing_tick(tmp_path):
    """A synthetic variant of the acceptance case: closer enemies, stronger hero.

    Deliberately not the retained spec (that one is
    test_the_original_acceptance_repro_spec_ends_with_a_complete_killing_tick);
    it covers the same class of defect with different positions and damage.
    """
    spec = {
        'seed': 20260927,
        'encounter_id': 'terminal-low-hp',
        'skills': [_skill('strike', 'single')],
        'actors': [
            _hero(damage=10, attack_ticks=6, speed=0.6),
            _enemy('raider_1', max_hp=40, x=2.0),
            _enemy('raider_2', max_hp=1, x=2.5),
        ],
    }
    trace = _run_headless(tmp_path, 'low-hp', spec)
    _assert_terminal(trace, expected_outcome='cleared', dead=['raider_1', 'raider_2'], alive=['hero'])


def test_a_single_skill_kills_the_last_enemy(tmp_path):
    """No auto attacks at all: both deaths must come from the skill."""
    spec = {
        'seed': 20260927,
        'encounter_id': 'terminal-skill',
        'skills': [_skill('strike', 'single', damage=50)],
        'actors': [
            _hero(attack_ticks=999, speed=2.0),
            _enemy('raider_1', max_hp=40, x=2.0),
            _enemy('raider_2', max_hp=1, x=2.5),
        ],
    }
    trace = _run_headless(tmp_path, 'skill-last', spec)
    killing_causes = [event.get('cause') for event in trace['events']
                      if event['kind'] == 'damage' and event['tick'] == trace['tick']]
    assert 'strike' in killing_causes, f'the last blow must be the skill: {killing_causes}'
    _assert_terminal(trace, expected_outcome='cleared', dead=['raider_1', 'raider_2'], alive=['hero'])


def test_an_auto_attack_kills_the_last_enemy(tmp_path):
    """No usable skills: the terminal blow must come from the auto attack."""
    spec = {
        'seed': 20260927,
        'encounter_id': 'terminal-auto',
        'skills': [],
        'actors': [
            _hero(damage=50, attack_ticks=1, speed=2.0),
            _enemy('raider_1', max_hp=40, x=2.0),
        ],
    }
    trace = _run_headless(tmp_path, 'auto-last', spec)
    killing_causes = [event.get('cause') for event in trace['events']
                      if event['kind'] == 'damage' and event['tick'] == trace['tick']]
    assert killing_causes == ['auto'], killing_causes
    _assert_terminal(trace, expected_outcome='cleared', dead=['raider_1'], alive=['hero'])


def test_an_area_skill_clears_every_enemy_in_one_tick(tmp_path):
    spec = {
        'seed': 20260927,
        'encounter_id': 'terminal-area',
        'skills': [_skill('strike', 'area', damage=50, range=5.0)],
        'actors': [
            _hero(attack_ticks=999, speed=2.0),
            _enemy('raider_1', max_hp=40, x=2.0),
            _enemy('raider_2', max_hp=40, x=2.5),
        ],
    }
    trace = _run_headless(tmp_path, 'area-clear', spec)
    death_ticks = {event['tick'] for event in trace['events'] if event['kind'] == 'death'}
    assert len(death_ticks) == 1, f'both enemies must die in the same tick: {death_ticks}'
    area_hits = [event for event in trace['events']
                 if event['kind'] == 'damage' and event.get('cause') == 'strike']
    assert len(area_hits) == 2, area_hits
    _assert_terminal(trace, expected_outcome='cleared', dead=['raider_1', 'raider_2'], alive=['hero'])


def test_a_party_wipe_ends_defeated_with_complete_events(tmp_path):
    spec = {
        'seed': 20260927,
        'encounter_id': 'terminal-wipe',
        'skills': [],
        'actors': [
            _hero(max_hp=120, damage=0, attack_ticks=999),
            _enemy('raider_1', max_hp=40, damage=50, range=3.0, attack_ticks=1, x=2.0),
        ],
    }
    trace = _run_headless(tmp_path, 'wipe', spec)
    _assert_terminal(trace, expected_outcome='defeated', dead=['hero'], alive=['raider_1'])
