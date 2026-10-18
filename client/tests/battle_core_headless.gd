extends SceneTree
## M0 core contract: same spec, seed and per-tick input produce the same battle,
## twice and in a different process shape than the visible scene.
##
## Always quits with an explicit code: a hanging runner is worse than a failure
## for the checks that have to run on every batch. Three independent exits are
## in place, on purpose:
##   1. a failed build fails this script immediately (no core to tick);
##   2. the loop counts iterations, not battle ticks, so a stalled core still
##      reaches the cap and fails instead of spinning;
##   3. a watchdog timer quits non-zero even if both of the above are broken.

const BattleRunner := preload("res://app/battle_runner.gd")
const BattleArgs := preload("res://tests/battle_args.gd")

const MAX_STEPS := 1200
const WATCHDOG_SECONDS := 60.0

var _watchdog := false

func _initialize() -> void:
	var timer := create_timer(WATCHDOG_SECONDS)
	timer.timeout.connect(_on_watchdog)
	_run.call_deferred()

func _on_watchdog() -> void:
	if not _watchdog:
		_failed("watchdog fired after %.0fs: the runner did not reach a terminal state" % WATCHDOG_SECONDS)

func _run() -> void:
	var spec_path := BattleArgs.arg_value("spec")
	var spec := {} if spec_path.is_empty() else _load_spec_file(spec_path)
	if not spec_path.is_empty() and spec.is_empty():
		_failed("cannot read spec file: " + spec_path)
		return
	var source := "fixture" if spec.is_empty() else str(spec.get("source", "server"))
	var first := _play(spec, source)
	if first.is_empty():
		return  # _play already failed explicitly
	var second := _play(spec, source)
	if second.is_empty():
		return
	if first != second:
		_failed("core is not deterministic for the same seed and input")
		return
	print("BATTLE_CORE_HEADLESS " + JSON.stringify(second))
	quit(0)

func _play(spec: Dictionary, source: String) -> Dictionary:
	var runner = BattleRunner.new()
	if not runner.start(spec, source):
		_failed("battle did not start: " + (runner.last_error if not runner.last_error.is_empty() else "unknown"))
		return {}
	var steps := 0
	while not runner.finished():
		if steps >= MAX_STEPS:
			_failed("battle did not finish within %d iterations (tick=%d)" % [MAX_STEPS, runner.tick()])
			return {}
		if runner.tick() >= BattleRunner.MAX_TICKS:
			_failed("battle did not finish within %d ticks" % BattleRunner.MAX_TICKS)
			return {}
		if not runner.step(runner.policy_command()):
			_failed("battle could not be advanced: " + runner.last_error)
			return {}
		steps += 1
	var trace := runner.trace()
	if str(trace.get("outcome", "")).is_empty():
		_failed("scripted M0 battle must reach a terminal state")
		return {}
	# Terminal contract: advancing a finished battle must be a no-op — same
	# tick, same events, no repeat settlement or duplicate death.
	var frozen := runner.trace()
	runner.step(runner.policy_command())
	if runner.trace() != frozen:
		_failed("core changed state after the battle was already over")
		return {}
	trace["iterations"] = steps
	return trace

func _load_spec_file(path: String) -> Dictionary:
	var text := FileAccess.get_file_as_string(path)
	if text.is_empty():
		return {}
	var parsed = JSON.parse_string(text)
	return parsed if parsed is Dictionary else {}

func _failed(reason: String) -> void:
	_watchdog = true
	push_error("BATTLE_CORE_HEADLESS FAILED: " + reason)
	print("BATTLE_CORE_HEADLESS FAILED: " + reason)
	quit(1)
