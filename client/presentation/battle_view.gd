extends Control
## Visible combat, driven by the same runner as the headless comparison.
## Widgets and poses consume state; they never invent damage or rewards.

const BattleRunner := preload("res://app/battle_runner.gd")
const Ui := preload("res://presentation/game_ui.gd")
const BattleArena := preload("res://presentation/battle_arena.gd")
const TICKS_PER_SECOND := 10.0

@onready var _clock: Timer = $Clock

var _runner = BattleRunner.new()
var _source_label := ""
var _character_name := ""
var _encounter_name := ""
var _running := false
var _print_report := true
var _paused := false
var _auto_skills := true
var _playback_speed := 0.5
var _manual_command: Dictionary = {}
var _seen_events := 0
var _arena: Control
var _health: ProgressBar
var _health_text: Label
var _goal: Label
var _feedback: Label
var _pause: Button
var _speed: Button
var _auto: Button
var _skill_buttons: Dictionary = {}
var _skill_ids: Array[String] = []
var _overlay: Control
var _result: Label
var _summary: Label
var _exit_confirm: Control
var _leave: Button
var _result_back: Button
var _exit_resume: Button
var _paused_before_leave := false

signal trace_ready(trace: Dictionary)
signal return_requested
signal retry_requested

func _ready() -> void:
	_build_ui()
	_clock.wait_time = 1.0 / (TICKS_PER_SECOND * _playback_speed)
	_clock.timeout.connect(_on_clock_timeout)

func _build_ui() -> void:
	_arena = BattleArena.new()
	_arena.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_arena)
	var top := Ui.panel(self, Rect2(24, 20, 1232, 84), true)
	top.z_index = 1000
	Ui.label(top, "开场遭遇", Rect2(24, 8, 320, 36), 27, Ui.WHITE)
	_goal = Ui.label(top, "消灭袭击者，守住营地", Rect2(24, 48, 680, 26), 18, Ui.GOLD)
	_speed = Ui.button(top, "演出 0.5×", Rect2(872, 16, 154, 50))
	_pause = Ui.button(top, "暂停", Rect2(1040, 16, 168, 50))
	_speed.pressed.connect(_cycle_speed)
	_pause.pressed.connect(_toggle_pause)
	var hud := Ui.panel(self, Rect2(24, 580, 1232, 116), true)
	hud.z_index = 1000
	_health_text = Ui.label(hud, "", Rect2(24, 16, 268, 28), 20, Ui.WHITE)
	_health = Ui.bar(hud, Rect2(24, 56, 260, 16))
	Ui.label(hud, "接近敌人后自动普攻", Rect2(24, 84, 278, 24), 16, Ui.GOLD)
	_auto = Ui.button(hud, "自动技能：开", Rect2(866, 18, 168, 52))
	_auto.pressed.connect(_toggle_auto)
	_leave = Ui.button(hud, "返回城镇", Rect2(1048, 18, 160, 52))
	_leave.pressed.connect(_ask_leave)
	Ui.label(hud, "空格 暂停 · 1 / 2 施放技能", Rect2(865, 84, 343, 25), 16, Ui.GOLD)
	_feedback = Ui.label(self, "", Rect2(340, 518, 600, 46), 20, Ui.NAVY, true)
	_feedback.z_index = 1000
	_feedback.add_theme_color_override("font_outline_color", Ui.WHITE)
	_feedback.add_theme_constant_override("outline_size", 4)
	_overlay = Control.new()
	_overlay.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.z_index = 1200
	add_child(_overlay)
	var shade := ColorRect.new()
	shade.color = Color(0.07, 0.13, 0.18, 0.52)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_overlay.add_child(shade)
	var result_panel := Ui.panel(_overlay, Rect2(364, 176, 552, 366))
	_result = Ui.label(result_panel, "", Rect2(24, 22, 504, 62), 38, Ui.NAVY, true)
	_summary = Ui.label(result_panel, "", Rect2(32, 106, 488, 92), 23, Ui.INK, true)
	Ui.label(result_panel, "本场为战斗试玩，尚未开放奖励与成长。", Rect2(32, 216, 488, 40), 17, Ui.MUTED, true)
	_result_back = Ui.button(result_panel, "返回城镇", Rect2(32, 284, 232, 54))
	var retry := Ui.button(result_panel, "再次挑战", Rect2(288, 284, 232, 54), true)
	_result_back.pressed.connect(func() -> void: return_requested.emit())
	retry.pressed.connect(func() -> void: retry_requested.emit())
	_overlay.hide()
	_exit_confirm = Control.new()
	_exit_confirm.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_exit_confirm.z_index = 1300
	add_child(_exit_confirm)
	var exit_shade := ColorRect.new()
	exit_shade.color = Color(0.07, 0.13, 0.18, 0.52)
	exit_shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_exit_confirm.add_child(exit_shade)
	var prompt := Ui.panel(_exit_confirm, Rect2(380, 232, 520, 256))
	Ui.label(prompt, "离开本场战斗？", Rect2(24, 24, 472, 40), 28, Ui.INK, true)
	Ui.label(prompt, "返回城镇后，本场战斗会结束。", Rect2(24, 90, 472, 44), 19, Ui.MUTED, true)
	_exit_resume = Ui.button(prompt, "取消返回", Rect2(24, 174, 228, 54), true)
	var exit := Ui.button(prompt, "离开", Rect2(268, 174, 228, 54))
	_exit_resume.pressed.connect(_cancel_leave)
	exit.pressed.connect(func() -> void: return_requested.emit())
	_exit_confirm.hide()

func open(result_pending: bool = true) -> void:
	_print_report = result_pending

func start_battle(spec: Dictionary, source: String = "server", character_name: String = "",
		encounter_name: String = "", auto_run: bool = true) -> bool:
	if not _runner.start(spec, source):
		_set_result("战斗未能开始：" + _runner.last_error)
		_report_runtime_error("battle did not start: " + _runner.last_error)
		return false
	_source_label = source
	_character_name = character_name
	_encounter_name = encounter_name
	_running = auto_run
	_arena.setup(spec, character_name if not character_name.is_empty() else "行者")
	_build_skills()
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.__awTrace='';window.__awStatus='战斗开始';", true)
	if auto_run:
		_clock.start()
	_render()
	return true

func _build_skills() -> void:
	var index := 0
	for skill in _runner.skill_states():
		var id := str(skill["id"])
		var button := Ui.button(self, str(skill.get("name", id)), Rect2(344 + index * 232, 598, 216, 72), true)
		button.z_index = 1000
		button.add_theme_font_size_override("font_size", 18)
		var icon_path := "res://assets/art/skills/%s.png" % id
		if ResourceLoader.exists(icon_path):
			button.icon = load(icon_path)
			button.add_theme_constant_override("icon_max_width", 32)
			button.expand_icon = true
		button.tooltip_text = "%s：%d 伤害，冷却 %d 拍，射程 %s。" % [str(skill.get("name", id)),
			int(skill.get("damage", 0)), int(skill.get("cooldown_ticks", 0)), str(skill.get("range", 0))]
		button.pressed.connect(func() -> void: request_skill(id))
		_skill_buttons[id] = button
		_skill_ids.append(id)
		index += 1

func advance_tick() -> bool:
	if not _runner.ready() or _runner.finished():
		return false
	var command := _manual_command
	_manual_command = {}
	if command.is_empty() and _auto_skills:
		command = _runner.policy_command()
	if not _runner.step(command):
		return false
	_render()
	if _runner.finished():
		_finish()
	return true

func request_skill(skill_id: String) -> void:
	if _runner.finished() or _paused or not _manual_command.is_empty():
		return
	_manual_command = {"type": "cast", "actor_id": "hero", "skill_id": skill_id}
	_feedback.text = "准备施放技能…"

func _toggle_auto() -> void:
	_auto_skills = not _auto_skills
	_auto.text = "自动技能：开" if _auto_skills else "自动技能：关"
	_feedback.text = "自动释放直刺；横扫可手动使用。" if _auto_skills else "手动技能模式，普攻仍会自动进行。"

func _toggle_pause() -> void:
	if _runner.finished():
		return
	_set_paused(not _paused)

func _set_paused(paused: bool) -> void:
	_paused = paused
	_pause.text = "继续" if paused else "暂停"
	_arena.set_paused(paused)
	_feedback.text = "战斗已暂停" if paused else "战斗继续"
	_render_skill_states()

func _cycle_speed() -> void:
	_playback_speed = 1.0 if _playback_speed == 0.5 else (2.0 if _playback_speed == 1.0 else 0.5)
	_clock.wait_time = 1.0 / (TICKS_PER_SECOND * _playback_speed)
	_speed.text = "演出 %s×" % str(_playback_speed)

func _ask_leave() -> void:
	if _runner.finished():
		return_requested.emit()
		return
	_paused_before_leave = _paused
	_set_paused(true)
	_set_background_controls_disabled(true)
	_exit_confirm.show()
	_exit_resume.grab_focus()

func _cancel_leave() -> void:
	_exit_confirm.hide()
	_set_background_controls_disabled(false)
	_set_paused(_paused_before_leave)
	_leave.grab_focus()

func _set_background_controls_disabled(disabled: bool) -> void:
	for control in [_pause, _speed, _auto, _leave]:
		control.disabled = disabled

func _input(event: InputEvent) -> void:
	if _overlay.visible or _exit_confirm.visible or not event.is_pressed() or event.is_echo():
		return
	if event is InputEventKey:
		if event.keycode == KEY_SPACE:
			_toggle_pause()
			get_viewport().set_input_as_handled()
		elif event.keycode == KEY_1 or event.keycode == KEY_2:
			var index := 0 if event.keycode == KEY_1 else 1
			if index < _skill_ids.size():
				request_skill(_skill_ids[index])
			get_viewport().set_input_as_handled()

func finished() -> bool:
	return _runner.finished()

func take_trace() -> Dictionary:
	var trace := _runner.trace()
	trace["display_source"] = _source_label
	trace["character"] = _character_name
	trace["encounter"] = _encounter_name
	return trace

func _on_clock_timeout() -> void:
	if _running and not _paused:
		advance_tick()

func _render() -> void:
	var snapshot: Dictionary = _runner.snapshot()
	var trace := _runner.trace()
	var events: Array = trace.get("events", [])
	var fresh := events.slice(_seen_events)
	_seen_events = events.size()
	_arena.render_snapshot(snapshot, fresh)
	var remaining := 0
	var total := 0
	for actor in snapshot.get("actors", []):
		if str(actor["side"]) == "player":
			_health.max_value = int(actor["max_hp"])
			_health.value = int(actor["hp"])
			_health_text.text = "%s  %d / %d" % [_character_name if not _character_name.is_empty() else "行者", int(actor["hp"]), int(actor["max_hp"])]
		else:
			total += 1
			if bool(actor["alive"]):
				remaining += 1
	_goal.text = "消灭袭击者  %d / %d" % [total - remaining, total]
	for event in fresh:
		if event.get("kind") == "rejected":
			_feedback.text = "尚未进入技能射程，正在靠近敌人。" if event.get("reason") == "out_of_range" else "技能暂时无法施放，请等待冷却。"
		elif event.get("kind") == "cast_started":
			_feedback.text = "行者施放技能"
		elif event.get("kind") == "death":
			_feedback.text = "敌人倒下" if event.get("target") != "hero" else "行者倒下"
	_render_skill_states()

func _render_skill_states() -> void:
	for skill in _runner.skill_states():
		var button: Button = _skill_buttons.get(str(skill["id"]))
		if button == null:
			continue
		var cooldown := int(skill.get("cooldown_remaining_ticks", 0))
		button.text = "%s  [%d]\n%s" % [str(skill.get("name", skill["id"])), _skill_ids.find(str(skill["id"])) + 1,
			"冷却 %d 拍" % cooldown if cooldown > 0 else "%d 伤害 · 就绪" % int(skill.get("damage", 0))]
		button.disabled = cooldown > 0 or _runner.finished() or _paused

func _finish() -> void:
	_running = false
	_clock.stop()
	_set_result(_outcome_text(_runner.outcome()))
	_set_background_controls_disabled(true)
	var dealt := 0
	var taken := 0
	var defeated := 0
	for event in _runner.trace().get("events", []):
		if event.get("kind") == "damage":
			if event.get("source") == "hero":
				dealt += int(event["amount"])
			if event.get("target") == "hero":
				taken += int(event["amount"])
		elif event.get("kind") == "death" and event.get("target") != "hero":
			defeated += 1
	_summary.text = "击败敌人 %d\n造成伤害 %d    承受伤害 %d" % [defeated, dealt, taken]
	if _runner.outcome() == "cleared":
		_arena.celebrate()
	_overlay.show()
	_result_back.grab_focus()
	if _print_report:
		var trace := take_trace()
		print("VISIBLE_TRACE " + JSON.stringify(trace))
		trace_ready.emit(trace)
		_push_to_page(trace)

func _set_result(text: String) -> void:
	_result.text = text
	_push_status(text)

static func _outcome_text(outcome: String) -> String:
	return "战斗结果：胜利" if outcome == "cleared" else ("战斗结果：失败" if outcome == "defeated" else "战斗进行中")

func _report_runtime_error(message: String) -> void:
	push_error("BATTLE_VIEW_ERROR " + message)
	print("BATTLE_VIEW_ERROR " + message)
	_push_status("错误 " + message)

func _push_status(text: String) -> void:
	if OS.has_feature("web"):
		JavaScriptBridge.eval("window.__awStatus=%s" % JSON.stringify(text), true)

func _push_to_page(trace: Dictionary) -> void:
	if not OS.has_feature("web"):
		return
	JavaScriptBridge.eval("window.__awTrace=%s" % JSON.stringify(JSON.stringify(trace)), true)
	# A hidden diagnostic surface for QA, never a raw JSON panel in the game.
	JavaScriptBridge.eval("""
		var node = document.getElementById('aw-status');
		if (!node) { node = document.createElement('div'); node.id = 'aw-status'; document.body.appendChild(node); }
		node.style.display = 'none';
		node.textContent = (window.__awStatus || '') + ' || trace=' + (window.__awTrace || '');
	""", true)
