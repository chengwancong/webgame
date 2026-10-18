extends Control
## The session owns this screen; battle receives its own spec and temporary state.

const Ui := preload("res://presentation/game_ui.gd")
const ActorVisual := preload("res://presentation/actor_visual.gd")
const BATTLE_SCENE := preload("res://presentation/battle_view.tscn")
const TOWN := preload("res://assets/art/town.png")
const ENCOUNTER := preload("res://assets/art/encounter.png")
const DEFAULT_CHARACTER_NAME := "回廊行者"

var _login: LineEdit
var _password: LineEdit
var _status: Label
var _camp_status: Label
var _start: Button
var _login_button: Button
var _register_button: Button
var _logout: Button
var _login_panel: Panel
var _camp: Control
var _character_label: Label
var _level_label: Label
var _stats: Label
var _skills: Label
var _encounter: Label
var _preview: Node2D
var _busy := false
var _character: Dictionary = {}
var _spec: Dictionary = {}
var _battle: Control

@onready var _api: Node = get_node("/root/Api")

func _ready() -> void:
	_build_ui()
	_login.text = _query_or_environment("aw_login", "")
	_password.text = _query_or_environment("aw_password", "")
	if _query_or_environment("aw_auto", "") == "1":
		_enter.call_deferred(false)

func _build_ui() -> void:
	Ui.image(self, TOWN, Rect2(0, 0, 1280, 720))
	var title := Ui.panel(self, Rect2(32, 26, 360, 110), true)
	Ui.label(title, "深渊行者", Rect2(24, 9, 312, 60), 44, Ui.WHITE)
	Ui.label(title, "每一次出发，都是新的选择", Rect2(25, 71, 310, 28), 17, Ui.GOLD)
	var footer := Ui.panel(self, Rect2(32, 658, 364, 40), true)
	Ui.label(footer, "开发试玩 · 当前开放开场遭遇", Rect2(12, 6, 340, 26), 16, Ui.WHITE)
	_login_panel = Ui.panel(self, Rect2(842, 158, 398, 482))
	Ui.label(_login_panel, "冒险从这里开始", Rect2(28, 26, 340, 42), 28)
	Ui.label(_login_panel, "登录后进入城镇，准备第一场战斗。", Rect2(28, 76, 342, 48), 18, Ui.MUTED)
	Ui.label(_login_panel, "账号", Rect2(28, 134, 342, 28), 18)
	_login = Ui.input(_login_panel, Rect2(28, 166, 342, 48), "字母、数字或下划线，至少 3 位")
	Ui.label(_login_panel, "密码", Rect2(28, 228, 342, 28), 18)
	_password = Ui.input(_login_panel, Rect2(28, 260, 342, 48), "至少 12 位", true)
	_login_button = Ui.button(_login_panel, "登录", Rect2(28, 330, 164, 52), true)
	_register_button = Ui.button(_login_panel, "注册并登录", Rect2(206, 330, 164, 52))
	_status = Ui.label(_login_panel, "新账号会创建一位回廊行者。", Rect2(28, 400, 342, 64), 17, Ui.MUTED)
	_login_button.pressed.connect(func() -> void: _enter(false))
	_register_button.pressed.connect(func() -> void: _enter(true))
	_password.text_submitted.connect(func(_text: String) -> void: _enter(false))
	_camp = Control.new()
	_camp.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	add_child(_camp)
	_camp.hide()
	var player := Ui.panel(_camp, Rect2(32, 190, 340, 426))
	Ui.label(player, "你的行者", Rect2(24, 22, 292, 28), 18, Ui.MUTED)
	_character_label = Ui.label(player, "", Rect2(24, 60, 292, 44), 27)
	_level_label = Ui.label(player, "", Rect2(24, 108, 292, 28), 18, Ui.MUTED)
	Ui.label(player, "本场战斗属性", Rect2(24, 140, 292, 30), 18)
	_stats = Ui.label(player, "", Rect2(24, 182, 292, 66), 21)
	Ui.label(player, "可用技能", Rect2(24, 262, 292, 28), 18)
	_skills = Ui.label(player, "", Rect2(24, 306, 292, 90), 18)
	_preview = ActorVisual.new()
	_camp.add_child(_preview)
	_preview.configure(true, "", false)
	_preview.position = Vector2(602, 590)
	_preview.scale = Vector2.ONE * 1.65
	var mission := Ui.panel(_camp, Rect2(882, 150, 358, 482))
	Ui.image(mission, ENCOUNTER, Rect2(16, 16, 326, 160))
	Ui.label(mission, "当前遭遇", Rect2(24, 192, 310, 28), 17, Ui.MUTED)
	_encounter = Ui.label(mission, "开场遭遇", Rect2(24, 228, 310, 42), 28)
	Ui.label(mission, "消灭袭击者，守住营地。\n自动普攻；技能可自动或手动释放。", Rect2(24, 283, 310, 74), 18)
	_start = Ui.button(mission, "出发战斗", Rect2(24, 386, 310, 60), true)
	_start.disabled = true
	_start.pressed.connect(_on_start_battle_pressed)
	_camp_status = Ui.label(_camp, "", Rect2(420, 626, 440, 50), 18, Ui.NAVY, true)
	_logout = Ui.button(_camp, "退出登录", Rect2(1086, 32, 154, 48))
	_logout.pressed.connect(_on_logout_pressed)

func _on_start_battle_pressed() -> void:
	_open_online_battle()

func _enter(register: bool) -> void:
	if _busy:
		return
	_set_busy(true)
	_status.add_theme_color_override("font_color", Ui.MUTED)
	var login_name := _login.text.strip_edges()
	if len(login_name) < 3 or len(_password.text) < 12:
		_login_error("账号至少 3 位，密码至少 12 位。")
		return
	_status.text = "正在为你连接城镇…"
	if register:
		var created: Dictionary = await _api.register(login_name, _password.text)
		if not bool(created.get("ok", false)):
			_login_error(_failure_text(created, "注册失败"))
			return
	var session: Dictionary = await _api.login(login_name, _password.text)
	if not bool(session.get("ok", false)):
		_login_error(_failure_text(session, "登录失败"))
		return
	var character: Dictionary = await _ensure_character()
	if character.is_empty():
		_set_busy(false)
		return
	_character = character
	_password.clear()
	_login_panel.hide()
	_camp.show()
	_character_label.text = str(character.get("name", ""))
	_level_label.text = "Lv.%d" % int(character.get("level", 1))
	_camp_status.text = "正在查看本场遭遇…"
	await _refresh_spec()
	_set_busy(false)
	if _query_or_environment("aw_auto", "") == "1" and not _spec.is_empty():
		_open_online_battle()

func _ensure_character() -> Dictionary:
	var listing: Dictionary = await _api.list_characters()
	if not bool(listing.get("ok", false)):
		_login_error(_failure_text(listing, "读取角色失败"))
		return {}
	var characters: Array = listing.get("body", {}).get("characters", [])
	if not characters.is_empty():
		return characters[0]
	var wanted := _query_or_environment("aw_character", DEFAULT_CHARACTER_NAME)
	var created: Dictionary = await _api.create_character(_api.random_command_id(), wanted)
	if not bool(created.get("ok", false)):
		_login_error(_failure_text(created, "创建角色失败"))
		return {}
	var again: Dictionary = await _api.read_character(int(created["body"]["character"]["id"]))
	if not bool(again.get("ok", false)):
		_login_error(_failure_text(again, "读取角色失败"))
		return {}
	return again["body"]

func _refresh_spec() -> bool:
	var response: Dictionary = await _api.opening_spec(int(_character.get("id", 0)))
	if not bool(response.get("ok", false)):
		_camp_status.text = _failure_text(response, "无法进入遭遇，请重试")
		return false
	_spec = response["body"].get("battle_spec", {})
	for actor in _spec.get("actors", []):
		if actor.get("side") == "player":
			_stats.text = "生命  %d\n普攻伤害  %d" % [int(actor.get("max_hp", 0)), int(actor.get("damage", 0))]
	var lines: Array[String] = []
	for skill in _spec.get("skills", []):
		lines.append("%s  ·  %d 伤害" % [str(skill.get("name", skill.get("id", ""))), int(skill.get("damage", 0))])
	_skills.text = "\n".join(lines)
	_encounter.text = str(_spec.get("name", "开场遭遇"))
	_camp_status.text = "准备好了，就出发吧。"
	return true

func _open_online_battle() -> void:
	if _busy or _character.is_empty():
		return
	_set_busy(true)
	_camp_status.text = "正在准备战斗…"
	if not await _refresh_spec():
		_set_busy(false)
		return
	var view := BATTLE_SCENE.instantiate() as Control
	add_child(view)
	if not view.start_battle(_spec, "server", str(_character.get("name", "")), str(_spec.get("encounter_id", "")), true):
		view.queue_free()
		_camp_status.text = "战斗数据异常，请稍后重试。"
		_set_busy(false)
		return
	_battle = view
	_camp.hide()
	view.return_requested.connect(_return_to_camp)
	view.retry_requested.connect(_retry)
	_set_busy(false)

func _return_to_camp() -> void:
	if is_instance_valid(_battle):
		_battle.queue_free()
	_battle = null
	_camp.show()
	_camp_status.text = "已返回城镇。你可以再次挑战。"
	_start.grab_focus()

func _retry() -> void:
	_return_to_camp()
	_open_online_battle.call_deferred()

func _on_logout_pressed() -> void:
	if _busy:
		return
	_set_busy(true)
	var response: Dictionary = await _api.logout()
	if bool(response.get("ok", false)):
		_character = {}
		_spec = {}
		_camp.hide()
		_login_panel.show()
		_status.text = "已退出登录。"
		_login.grab_focus()
	else:
		_camp_status.text = _failure_text(response, "退出失败，请重试")
	_set_busy(false)

func _set_busy(busy: bool) -> void:
	_busy = busy
	_login.editable = not busy
	_password.editable = not busy
	_login_button.disabled = busy
	_register_button.disabled = busy
	_logout.disabled = busy
	_start.disabled = busy or _character.is_empty()
	_start.text = "准备中…" if busy else "出发战斗"

func _login_error(message: String) -> void:
	_status.text = message
	_status.add_theme_color_override("font_color", Ui.RED)
	_set_busy(false)

static func _failure_text(response: Dictionary, fallback: String) -> String:
	if int(response.get("status", 0)) == 0:
		return "无法连接服务器，请检查网络后重试。"
	var detail := str(response.get("body", {}).get("detail", ""))
	match detail:
		"LOGIN_TAKEN": return "账号已存在，请点击登录。"
		"INVALID_CREDENTIALS": return "账号或密码不正确，请重新输入。"
		"UNAUTHENTICATED": return "登录已失效，请退出后重新登录。"
	return fallback + ("：" + detail if not detail.is_empty() else "，请稍后重试。")

static func _query_or_environment(name: String, fallback: String) -> String:
	var value := OS.get_environment(name.to_upper())
	if not value.is_empty():
		return value
	if OS.has_feature("web"):
		var search = JavaScriptBridge.eval("window.location.search", true)
		if typeof(search) == TYPE_STRING and search != "":
			for part in String(search).lstrip("?").split("&"):
				var pair := String(part).split("=", true, 1)
				if pair.size() == 2 and pair[0] == name:
					return String(pair[1]).uri_decode()
	return fallback
