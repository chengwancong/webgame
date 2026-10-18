extends RefCounted
## Pure data combat core.
##
## No SceneTree, no wall clock, no engine physics, no animation callbacks.
## Progress happens only in explicit ticks with explicit commands, so the
## headless runner and the visible scene produce the same battle from the same
## BattleSpec, seed and per-tick input.
##
## Precision policy (explicit, because hiding state differences behind an
## arbitrary rounding was what broke this file once):
##   - Simulation values keep full float precision. Nothing inside a tick is
##     rounded before it is used.
##   - SNAPSHOT_PRECISION is only applied when a snapshot is serialised, and it
##     is fine enough that two states that differ in any meaningful way still
##     differ after being snapped. It removes binary noise, not differences.
##   - The visible layer chooses its own DISPLAY_DECIMALS for text only.

const SNAPSHOT_PRECISION := 0.000001

var tick := 0
var actors: Array = []
var skills: Dictionary = {}
var events: Array = []
var built := false
var last_error := ""
var rng: RandomNumberGenerator
var _pending_casts: Array = []

## Returns false and records last_error instead of leaving a half-built core.
func build(spec: Dictionary) -> bool:
	built = false
	last_error = ""
	tick = 0
	actors = []
	skills = {}
	events = []
	_pending_casts = []
	var spec_actors: Array = spec.get("actors", [])
	if spec_actors.is_empty():
		last_error = "SPEC_NO_ACTORS"
		return false
	for skill in spec.get("skills", []):
		if not skill is Dictionary or not str(skill.get("id", "")):
			last_error = "SPEC_SKILL_ID_MISSING"
			return false
		skills[str(skill["id"])] = skill
	var sides := {}
	for actor in spec_actors:
		if not actor is Dictionary:
			last_error = "SPEC_ACTOR_NOT_OBJECT"
			return false
		var actor_id := str(actor.get("id", ""))
		var side := str(actor.get("side", ""))
		if actor_id.is_empty() or side.is_empty():
			last_error = "SPEC_ACTOR_ID_OR_SIDE_MISSING"
			return false
		if int(actor.get("max_hp", 0)) <= 0:
			last_error = "SPEC_ACTOR_HP_INVALID"
			return false
		sides[side] = true
		actors.append({
			"id": actor_id, "side": side,
			"hp": int(actor["max_hp"]), "max_hp": int(actor["max_hp"]),
			"damage": int(actor.get("damage", 0)), "range": float(actor.get("range", 1.0)),
			"attack_ticks": int(actor.get("attack_ticks", 1)), "speed": float(actor.get("speed", 0.0)),
			"x": float(actor.get("x", 0.0)), "ready_tick": int(actor.get("attack_ticks", 1)),
			"cooldown_until": {}, "alive": true,
		})
	if sides.size() < 2:
		last_error = "SPEC_ONLY_ONE_SIDE"
		return false
	rng = RandomNumberGenerator.new()
	rng.seed = int(spec.get("seed", 1))
	built = true
	return true

func step(command: Dictionary = {}) -> Array:
	if not built:
		return []
	# A finished battle stays finished: no extra tick, no repeat settlement, no
	# second death for an actor that already died. The killing tick ran to
	# completion one call earlier and archived its events; this guard only
	# stops everything that would come after the terminal state.
	if outcome() != "":
		return []
	var emitted: Array = []
	tick += 1
	# Order inside one tick is fixed and explicit:
	#   1. the player command (reject, or start/resolve a cast);
	#   2. pending casts whose windup elapsed this tick — skills strike first;
	#   3. auto attacks for everyone still alive;
	#   4. the emitted events are archived in full before this call returns, so
	#     the killing blow's damage and death events are never dropped.
	if not command.is_empty():
		_accept_command(command, emitted)
	_resolve_casts(emitted)
	for actor in actors:
		if not actor["alive"]:
			continue
		var target := _nearest_enemy(actor)
		# _nearest_enemy answers an empty Dictionary when nobody is left, and
		# only is_empty() agrees with that contract. The old `== null` check
		# never matched it, so the tick that resolved the last enemy's death
		# crashed on target["x"] and lost that tick's events.
		if target.is_empty():
			continue
		var distance := absf(float(target["x"]) - float(actor["x"]))
		if distance > float(actor["range"]):
			actor["x"] += float(actor["speed"]) * signf(float(target["x"]) - float(actor["x"]))
			continue
		if tick >= int(actor["ready_tick"]):
			actor["ready_tick"] = tick + int(actor["attack_ticks"])
			_hit(actor, target, int(actor["damage"]), "auto", emitted)
	events.append_array(emitted)
	return emitted

func outcome() -> String:
	var player_alive := false
	var enemy_alive := false
	for actor in actors:
		if not bool(actor["alive"]):
			continue
		if str(actor["side"]) == "player":
			player_alive = true
		else:
			enemy_alive = true
	if not player_alive:
		return "defeated"
	if not enemy_alive:
		return "cleared"
	return ""

func state_snapshot(precision: float = SNAPSHOT_PRECISION) -> Dictionary:
	var rows: Array = []
	for actor in actors:
		rows.append({"id": str(actor["id"]), "side": str(actor["side"]), "hp": int(actor["hp"]),
			"max_hp": int(actor["max_hp"]), "x": snappedf(float(actor["x"]), precision),
			"alive": bool(actor["alive"]), "ready_tick": int(actor["ready_tick"])})
	return {"tick": tick, "outcome": outcome(), "actors": rows}

## Read-only presentation query. Cooldowns still have their single owner here.
func skill_states(actor_id: String) -> Array:
	var actor := _actor(actor_id)
	if actor.is_empty():
		return []
	var result: Array = []
	for id in skills:
		var state: Dictionary = skills[id].duplicate(true)
		state["cooldown_remaining_ticks"] = maxi(0, int(actor["cooldown_until"].get(id, 0)) - tick)
		result.append(state)
	return result

## Canonical comparable trace: key events in order plus the terminal state.
## Two processes comparing these compare the battle, not a summary string.
func trace() -> Dictionary:
	var key_events: Array = []
	for event in events:
		var kind := str(event.get("kind", ""))
		if kind == "damage" or kind == "death" or kind == "cast_started" or kind == "rejected":
			key_events.append(event.duplicate(true))
	return {
		"tick": tick,
		"outcome": outcome(),
		"snapshot": state_snapshot(),
		"events": key_events,
	}

func _accept_command(command: Dictionary, emitted: Array) -> void:
	var actor_id := str(command.get("actor_id", "hero"))
	var skill_id := str(command.get("skill_id", ""))
	var actor := _actor(actor_id)
	var skill: Dictionary = skills.get(skill_id, {})
	if actor.is_empty() or skill.is_empty():
		emitted.append({"kind": "rejected", "tick": tick, "reason": "unknown_skill_or_actor", "skill_id": skill_id})
		return
	if int(actor["cooldown_until"].get(skill_id, 0)) > tick:
		emitted.append({"kind": "rejected", "tick": tick, "reason": "cooldown", "skill_id": skill_id})
		return
	var target := _nearest_enemy(actor)
	if target.is_empty():
		emitted.append({"kind": "rejected", "tick": tick, "reason": "no_target", "skill_id": skill_id})
		return
	if absf(float(target["x"]) - float(actor["x"])) > float(skill["range"]):
		emitted.append({"kind": "rejected", "tick": tick, "reason": "out_of_range", "skill_id": skill_id})
		return
	actor["cooldown_until"][skill_id] = tick + int(skill["cooldown_ticks"])
	var windup := int(skill.get("windup_ticks", 0))
	if windup <= 0:
		_resolve_cast(actor, skill, emitted)
	else:
		_pending_casts.append({"actor_id": actor_id, "skill_id": skill_id, "resolve_tick": tick + windup})
		emitted.append({"kind": "cast_started", "tick": tick, "skill_id": skill_id, "actor_id": actor_id})

func _resolve_casts(emitted: Array) -> void:
	var remaining: Array = []
	for pending in _pending_casts:
		if int(pending["resolve_tick"]) > tick:
			remaining.append(pending)
			continue
		var actor := _actor(str(pending["actor_id"]))
		if actor.is_empty() or not bool(actor["alive"]):
			continue
		_resolve_cast(actor, skills.get(str(pending["skill_id"]), {}), emitted)
	_pending_casts = remaining

func _resolve_cast(actor: Dictionary, skill: Dictionary, emitted: Array) -> void:
	var targets: Array = []
	if str(skill["kind"]) == "area":
		for other in actors:
			if bool(other["alive"]) and str(other["side"]) != str(actor["side"]) \
					and absf(float(other["x"]) - float(actor["x"])) <= float(skill["range"]):
				targets.append(other)
	elif str(skill["kind"]) == "single":
		var nearest := _nearest_enemy(actor)
		if not nearest.is_empty():
			targets.append(nearest)
	for target in targets:
		_hit(actor, target, int(skill["damage"]), str(skill["id"]), emitted)

func _hit(source: Dictionary, target: Dictionary, base: int, cause: String, emitted: Array) -> void:
	var amount := maxi(1, base + rng.randi_range(-1, 1))
	target["hp"] = maxi(0, int(target["hp"]) - amount)
	emitted.append({"kind": "damage", "tick": tick, "source": str(source["id"]), "target": str(target["id"]),
		"amount": amount, "cause": cause})
	if int(target["hp"]) == 0 and bool(target["alive"]):
		target["alive"] = false
		emitted.append({"kind": "death", "tick": tick, "target": str(target["id"])})

func _actor(actor_id: String) -> Dictionary:
	for actor in actors:
		if str(actor["id"]) == actor_id:
			return actor
	return {}

func _nearest_enemy(actor: Dictionary) -> Dictionary:
	var best: Dictionary = {}
	var best_distance := INF
	for other in actors:
		if not bool(other["alive"]) or str(other["side"]) == str(actor["side"]):
			continue
		var distance := absf(float(other["x"]) - float(actor["x"]))
		if distance < best_distance:
			best_distance = distance
			best = other
	return best
