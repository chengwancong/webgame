extends SceneTree
## Drives the actual visible battle scene with data from a real path, and emits
## the same canonical trace the pure-core runner emits.
##
## It is not a copy of the core loop: it owns no stepping logic. It calls the
## scene's advance_tick(), which is exactly what the Timer calls during play.
## Same spec file, same seed, same policy -> the two traces must be identical.

const MAX_STEPS := 1200
const WATCHDOG_SECONDS := 60.0

const BATTLE_SCENE := preload("res://presentation/battle_view.tscn")
const BattleArgs := preload("res://tests/battle_args.gd")

var _watchdog := false

func _initialize() -> void:
	var timer := create_timer(WATCHDOG_SECONDS)
	timer.timeout.connect(_on_watchdog)
	_run.call_deferred()

func _on_watchdog() -> void:
	if not _watchdog:
		_failed("watchdog fired after %.0fs: the visible scene never reported a result" % WATCHDOG_SECONDS)

func _run() -> void:
	var spec_path := BattleArgs.arg_value("spec")
	if spec_path.is_empty():
		_failed("spec file is required for the visible scene comparison")
		return
	var spec := _load_spec(spec_path)
	if spec.is_empty():
		_failed("cannot read spec file: " + spec_path)
		return
	var view := BATTLE_SCENE.instantiate()
	view._print_report = false
	root.add_child(view)
	if not view.start_battle(spec, str(spec.get("source", "server")), "", "", false):
		_failed("the visible scene could not start the battle")
		return
	var steps := 0
	while view.finished() == false:
		if steps >= MAX_STEPS:
			_failed("visible battle did not finish within %d iterations" % MAX_STEPS)
			return
		if view.advance_tick() == false:
			_failed("visible battle stopped advancing at iteration %d" % steps)
			return
		steps += 1
	var trace: Dictionary = view.take_trace()
	if str(trace.get("outcome", "")).is_empty():
		_failed("visible battle reached no terminal state")
		return
	print("VISIBLE_TRACE " + JSON.stringify(trace))
	quit(0)

func _load_spec(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		return {}
	var parsed = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}

func _failed(reason: String) -> void:
	_watchdog = true
	push_error("VISIBLE_TRACE FAILED: " + reason)
	print("VISIBLE_TRACE FAILED: " + reason)
	quit(1)
