extends SceneTree
## Compile-only surface check: referencing these scripts and scenes is what makes
## Godot parse them, including their dependencies. Nothing is executed.
##
## The checklist must include every script the M0 client actually runs, because
## a file nobody references is a file nobody knows is broken.

const BattleRunner := preload("res://app/battle_runner.gd")
const BattleCore := preload("res://combat/battle_core.gd")
const BattleArgs := preload("res://tests/battle_args.gd")
const ApiClient := preload("res://net/api_client.gd")
const MainMenu := preload("res://presentation/main_menu.gd")
const BattleView := preload("res://presentation/battle_view.gd")
const GameUi := preload("res://presentation/game_ui.gd")
const ActorVisual := preload("res://presentation/actor_visual.gd")
const BattleArena := preload("res://presentation/battle_arena.gd")

const MENU_SCENE := preload("res://presentation/main_menu.tscn")
const BATTLE_SCENE := preload("res://presentation/battle_view.tscn")


func _initialize() -> void:
	print("COMPILE_CHECK_OK core:%s menu:%s battle:%s" % [
		"present" if BattleCore != null else "missing",
		"present" if MENU_SCENE != null else "missing",
		"present" if BATTLE_SCENE != null else "missing",
	])
	quit(0)
