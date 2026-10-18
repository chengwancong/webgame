extends Control
## The arena consumes snapshots/events and owns only visual interpolation.

const Ui := preload("res://presentation/game_ui.gd")
const ActorVisual := preload("res://presentation/actor_visual.gd")
const BACKGROUND := preload("res://assets/art/encounter.png")
const HIT_DIR := "res://assets/art/effects/hit/"
var _hit_textures: Array[Texture2D] = []

var _actors: Dictionary = {}
var _last_x: Dictionary = {}
var _destinations: Dictionary = {}
var _width := 24.0
var _effects: Array = []
var _paused := false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	for frame in range(1, 15):
		_hit_textures.append(load(HIT_DIR + "%03d.png" % frame))

func setup(spec: Dictionary, character_name: String) -> void:
	_width = maxf(1.0, float(spec.get("arena", {}).get("width", 24.0)))
	var enemy_index := 0
	for actor in spec.get("actors", []):
		var id := str(actor["id"])
		var hero := str(actor["side"]) == "player"
		var visual := ActorVisual.new()
		add_child(visual)
		visual.configure(hero, character_name if hero else "袭击者 %d" % (enemy_index + 1), not hero)
		var lane := 566.0 if hero else 560.0 - enemy_index * 12.0
		visual.position = Vector2(_screen_x(float(actor["x"])), lane)
		visual.scale = Vector2.ONE
		visual.z_index = int(lane)
		_actors[id] = visual
		_last_x[id] = float(actor["x"])
		_destinations[id] = visual.position
		if not hero:
			enemy_index += 1

func render_snapshot(snapshot: Dictionary, events: Array) -> void:
	for actor in snapshot.get("actors", []):
		var id := str(actor["id"])
		if not _actors.has(id):
			continue
		var visual: Node2D = _actors[id]
		var x := float(actor["x"])
		_destinations[id] = Vector2(_screen_x(x), visual.position.y)
		visual.sync_state(actor, not is_equal_approx(x, float(_last_x.get(id, x))))
		_last_x[id] = x
	for event in events:
		var kind := str(event.get("kind", ""))
		if kind == "cast_started" and _actors.has(event.get("actor_id", "")):
			_actors[event["actor_id"]].play_pose("skill", 0.3)
		if kind == "damage":
			var source := str(event.get("source", ""))
			var target := str(event.get("target", ""))
			if _actors.has(source):
				_actors[source].play_pose("attack" if event.get("cause") == "auto" else "skill", 0.3)
			if _actors.has(target):
				_actors[target].play_pose("hurt", 0.2)
				_float_damage(_actors[target].position, int(event["amount"]), target != "hero")
				if _actors.has(source):
					_effects.append({"at": _actors[target].position + Vector2(0, -90), "life": 0.35})
	queue_redraw()

func set_paused(paused: bool) -> void:
	_paused = paused
	for actor in _actors.values():
		actor.set_process(not paused)

func celebrate() -> void:
	if _actors.has("hero"):
		_actors["hero"].play_pose("win", 3.0)

func _screen_x(x: float) -> float:
	return 104.0 + clampf(x / _width, 0.0, 1.0) * 1060.0

func _float_damage(at: Vector2, amount: int, friendly_hit: bool) -> void:
	var text := Ui.label(self, str(amount), Rect2(at + Vector2(-40, -155), Vector2(80, 44)),
		30, Ui.WHITE if friendly_hit else Color("ffd6b8"), true)
	text.z_index = 700
	text.add_theme_color_override("font_outline_color", Ui.NAVY)
	text.add_theme_constant_override("outline_size", 6)
	var tween := create_tween().set_parallel(true)
	tween.tween_property(text, "position:y", text.position.y - 54.0, 0.65)
	tween.tween_property(text, "modulate:a", 0.0, 0.65)
	tween.chain().tween_callback(text.queue_free)

func _process(delta: float) -> void:
	if _paused:
		return
	for id in _actors:
		_actors[id].position = _actors[id].position.lerp(_destinations[id], minf(1.0, delta * 18.0))
	for effect in _effects:
		effect["life"] -= delta
	_effects = _effects.filter(func(effect: Dictionary) -> bool: return effect["life"] > 0.0)
	queue_redraw()

func _draw() -> void:
	draw_texture_rect(BACKGROUND, Rect2(0, 0, 1280, 720), false)
	for effect in _effects:
		var frame := clampi(int((0.35 - float(effect["life"])) / 0.35 * _hit_textures.size()), 0, _hit_textures.size() - 1)
		draw_texture_rect(_hit_textures[frame], Rect2(effect["at"] - Vector2(80, 100), Vector2(160, 200)), false)
