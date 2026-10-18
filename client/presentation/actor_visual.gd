extends Node2D
## Event-driven visual poses. Frame playback never changes combat state.

const ASSET_CATALOG := "res://assets/art/actors.json"

var _hero := true
var _action := "idle"
var _elapsed := 0.0
var _lock := 0.0
var _moving := false
var _dead := false
var _hit_flash := 0.0
var _textures: Dictionary = {}
var _profile: Dictionary = {}
var _pose_duration := 0.28
var _name: Label
var _health: ProgressBar
var _hp_text: Label

const Ui := preload("res://presentation/game_ui.gd")

func configure(hero: bool, caption: String, show_health: bool = true) -> void:
	_hero = hero
	var catalog: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(ASSET_CATALOG))
	_profile = catalog["hero" if hero else "raider"]
	_name = Ui.label(self, caption, Rect2(-105, -226, 210, 26), 18, Ui.NAVY, true)
	_name.add_theme_color_override("font_shadow_color", Ui.WHITE)
	_name.add_theme_constant_override("shadow_outline_size", 5)
	_health = Ui.bar(self, Rect2(-60, -194, 120, 10), Ui.GREEN if hero else Ui.RED)
	_hp_text = Ui.label(self, "", Rect2(-60, -183, 120, 24), 15, Ui.NAVY, true)
	_name.visible = show_health
	_health.visible = show_health
	_hp_text.visible = show_health
	queue_redraw()

func sync_state(actor: Dictionary, moving: bool) -> void:
	_moving = moving
	_health.max_value = int(actor["max_hp"])
	_health.value = int(actor["hp"])
	_hp_text.text = "%d / %d" % [int(actor["hp"]), int(actor["max_hp"])]
	if not bool(actor["alive"]) and not _dead:
		_dead = true
		play_pose("death", 10.0)
		_name.hide()
		_health.hide()
		_hp_text.hide()

func play_pose(action: String, hold: float = 0.28) -> void:
	if _dead and action != "death":
		return
	_action = action
	_elapsed = 0.0
	_lock = hold
	_pose_duration = hold
	if action == "hurt":
		_hit_flash = 0.14
	queue_redraw()

func _process(delta: float) -> void:
	_elapsed += delta
	_lock = maxf(0.0, _lock - delta)
	_hit_flash = maxf(0.0, _hit_flash - delta)
	if _lock == 0.0 and not _dead:
		var next := "move" if _moving else "idle"
		if _action != next:
			_action = next
			_elapsed = 0.0
	queue_redraw()

func _draw() -> void:
	if _profile.is_empty():
		return
	draw_set_transform(Vector2.ZERO, 0, Vector2(1, 0.28))
	draw_circle(Vector2.ZERO, 39.0, Color(0.12, 0.20, 0.14, 0.22))
	draw_set_transform(Vector2.ZERO)
	var loop := _action == "idle" or _action == "move"
	var tint := Color(1.8, 1.3, 1.1) if _hit_flash > 0 else Color.WHITE
	var scale_factor := float(_profile["draw_scale"])
	var anchor := Vector2(float(_profile["anchor_pixels"][0]), float(_profile["anchor_pixels"][1]))
	# All source layers share a canvas, foot anchor and timeline. Flip only the
	# source art; health labels and core positions keep their normal coordinates.
	var flip := bool(_profile["source_facing_left"]) == _hero
	draw_set_transform(Vector2.ZERO, 0, Vector2(-1 if flip else 1, 1))
	for layer in _profile["layers"]:
		var actions: Dictionary = layer["animations"]
		var sequence: Array = actions.get(_action, actions["idle"])
		var fps := float(_profile["fps"])
		if not loop and _action != "death" and _action != "win":
			fps = maxf(fps, sequence.size() / maxf(0.01, _pose_duration))
		var frame_index := int(_elapsed * fps)
		frame_index = frame_index % sequence.size() if loop else mini(frame_index, sequence.size() - 1)
		var texture := _texture(str(layer["base_dir"]) + "/" + str(layer["frame_pattern"]) % int(sequence[frame_index]))
		draw_texture_rect(texture, Rect2(-anchor * scale_factor, Vector2(256, 256) * scale_factor), false, tint)
	draw_set_transform(Vector2.ZERO)

func _texture(path: String) -> Texture2D:
	if not _textures.has(path):
		_textures[path] = load(path)
	return _textures[path]
