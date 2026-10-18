extends RefCounted
## Application layer between the combat core and whatever shows it.
## The visible scene and the headless test both drive this same wrapper.
##
## Start always answers whether the battle exists. A caller that ignores a
## failed start cannot accidentally spin inside a loop forever: there is no core
## to tick, and the runner reports it instead of returning silent zeroes.

const BattleCore := preload("res://combat/battle_core.gd")

## Hard cap shared by every driver, whatever else it uses to count its steps.
const MAX_TICKS := 600

## The offline fixture. It exists so the core can be checked without the API;
## nothing in the normal flow reads it. See docs: it is a fixture, not content.
const FIXTURE_PATH := "res://data/fixture_combat.json"

var last_error := ""
var _core: BattleCore
var _source := ""
var _spec_id := ""
var _seed := 0

## source is only provenance: fixture runs and API runs must never be confused
## when two traces are compared.
func start(spec: Dictionary = {}, source := "inline") -> bool:
	last_error = ""
	_core = BattleCore.new()
	if spec.is_empty():
		spec = fixture_spec()
		if source == "inline":
			source = "fixture"
	if not _core.build(spec):
		last_error = _core.last_error
		_source = ""
		return false
	_source = source
	_spec_id = str(spec.get("encounter_id", spec.get("id", "")))
	_seed = int(spec.get("seed", 0))
	return true

static func fixture_spec() -> Dictionary:
	var text := FileAccess.get_file_as_string(FIXTURE_PATH)
	if text.is_empty():
		return {}
	var content = JSON.parse_string(text)
	if content == null or not content is Dictionary:
		return {}
	var encounters: Array = content.get("encounters", [])
	if encounters.is_empty():
		return {}
	var encounter: Dictionary = encounters[0]
	return {"seed": int(encounter.get("seed", 1)), "encounter_id": str(encounter.get("id", "")),
		"skills": content.get("skills", []), "actors": encounter.get("actors", []),
		"arena": encounter.get("arena", {})}

func ready() -> bool:
	return _core != null and _core.built

func step(command: Dictionary = {}) -> bool:
	if not ready():
		last_error = "BATTLE_NOT_STARTED"
		return false
	_core.step(command)
	return true

func tick() -> int:
	return _core.tick if ready() else 0

func finished() -> bool:
	return ready() and _core.outcome() != ""

func outcome() -> String:
	return _core.outcome() if ready() else ""

func snapshot() -> Dictionary:
	return _core.state_snapshot() if ready() else {"tick": 0, "outcome": "", "actors": []}

func skill_states(actor_id: String = "hero") -> Array:
	return _core.skill_states(actor_id) if ready() else []

## Comparable trace: where the data came from, the key events in order, and the
## terminal state. Two drivers are the same battle only if all three match.
func trace() -> Dictionary:
	var body: Dictionary = _core.trace() if ready() else {"tick": 0, "outcome": "", "snapshot": {}, "events": []}
	body["source"] = _source
	body["encounter_id"] = _spec_id
	body["seed"] = _seed
	return body

## The M0 scripted policy: cast the single-target skill whenever it is allowed.
func policy_command() -> Dictionary:
	return {"type": "cast", "actor_id": "hero", "skill_id": "strike"} if tick() % 8 == 0 else {}
