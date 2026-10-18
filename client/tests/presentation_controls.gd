extends SceneTree
## Exercise player controls against the real scene and core, without a second
## combat implementation. Network/default trace parity is covered separately.

const BattleScene := preload("res://presentation/battle_view.tscn")
const Runner := preload("res://app/battle_runner.gd")

func _initialize() -> void:
	_run.call_deferred()

func _run() -> void:
	var view := BattleScene.instantiate()
	view._print_report = false
	root.add_child(view)
	assert(view.start_battle(Runner.fixture_spec(), "fixture", "测试行者", "", false))
	view._running = true
	view._clock.stop()
	view._toggle_pause()
	view._on_clock_timeout()
	assert(view.take_trace()["tick"] == 0, "paused timer advanced the core")
	view._ask_leave()
	view._cancel_leave()
	assert(view._paused, "cancel leave lost the prior paused state")
	view._toggle_pause()
	view._toggle_auto()
	for i in range(15):
		assert(view.advance_tick())
	view.request_skill("sweep")
	assert(view.advance_tick())
	var states: Array = view._runner.skill_states()
	var sweep: Dictionary = {}
	for skill in states:
		if skill["id"] == "sweep":
			sweep = skill
	assert(int(sweep["cooldown_remaining_ticks"]) == int(sweep["cooldown_ticks"]), "UI cooldown is not the core cooldown")
	for i in range(3):
		assert(view.advance_tick())
	var saw_sweep := false
	for event in view.take_trace()["events"]:
		if event.get("kind") == "damage" and event.get("cause") == "sweep":
			saw_sweep = true
	assert(saw_sweep, "manual skill did not cause real damage")
	view._toggle_auto()
	while not view.finished():
		assert(view.advance_tick())
	assert(view._overlay.visible, "terminal result is not presented")
	assert(view._pause.disabled and view._leave.disabled, "result leaves background controls active")
	print("PRESENTATION_CONTROLS_OK " + JSON.stringify(view.take_trace()))
	view.queue_free()
	await process_frame
	quit(0)
