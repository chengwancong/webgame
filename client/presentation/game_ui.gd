extends RefCounted
## Shared presentation tokens. No gameplay parameters belong here.

const INK := Color("283949")
const NAVY := Color("1b3145")
const PAPER := Color("f5edd8")
const GOLD := Color("d3aa63")
const GREEN := Color("43b69b")
const RED := Color("be6253")
const WHITE := Color("fffaf0")
const MUTED := Color("596775")
const DISPLAY_FONT := preload("res://presentation/display_font.tres")
const BODY_FONT := preload("res://presentation/body_font.tres")

static func box(fill: Color, border: Color = GOLD, radius: int = 8) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = fill
	style.border_color = border
	style.set_border_width_all(2)
	style.set_corner_radius_all(radius)
	style.content_margin_left = 16
	style.content_margin_right = 16
	style.content_margin_top = 10
	style.content_margin_bottom = 10
	return style

static func panel(parent: Node, at: Rect2, dark: bool = false) -> Panel:
	var node := Panel.new()
	node.position = at.position
	node.size = at.size
	var fill := NAVY if dark else PAPER
	fill.a = 0.96
	var style := box(fill)
	style.shadow_color = Color(0.04, 0.10, 0.14, 0.25)
	style.shadow_size = 8
	node.add_theme_stylebox_override("panel", style)
	parent.add_child(node)
	return node

static func label(parent: Node, text: String, at: Rect2, font_size: int = 20,
		color: Color = INK, centered: bool = false) -> Label:
	var node := Label.new()
	node.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	node.add_theme_font_size_override("font_size", font_size)
	node.add_theme_font_override("font", DISPLAY_FONT if font_size >= 26 else BODY_FONT)
	node.add_theme_color_override("font_color", color)
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	node.text = text
	node.position = at.position
	node.size = at.size
	if centered:
		node.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	parent.add_child(node)
	return node

static func button(parent: Node, text: String, at: Rect2, primary: bool = false) -> Button:
	var node := Button.new()
	node.text = text
	node.position = at.position
	node.size = at.size
	node.add_theme_font_size_override("font_size", 20)
	var fill := GOLD if primary else NAVY
	var fg := NAVY if primary else WHITE
	node.add_theme_color_override("font_color", fg)
	node.add_theme_color_override("font_hover_color", fg)
	node.add_theme_color_override("font_pressed_color", fg)
	node.add_theme_color_override("font_focus_color", fg)
	node.add_theme_color_override("font_hover_pressed_color", fg)
	node.add_theme_color_override("font_disabled_color", MUTED)
	node.add_theme_stylebox_override("normal", box(fill))
	node.add_theme_stylebox_override("hover", box(fill.lightened(0.13), WHITE))
	node.add_theme_stylebox_override("pressed", box(fill.darkened(0.15), GOLD))
	node.add_theme_stylebox_override("disabled", box(Color("d4d7cc"), Color("aeb5ad")))
	var focus := box(Color(0, 0, 0, 0), WHITE)
	focus.set_border_width_all(3)
	node.add_theme_stylebox_override("focus", focus)
	parent.add_child(node)
	return node

static func input(parent: Node, at: Rect2, placeholder: String, secret: bool = false) -> LineEdit:
	var node := LineEdit.new()
	node.position = at.position
	node.size = at.size
	node.placeholder_text = placeholder
	node.secret = secret
	node.add_theme_font_size_override("font_size", 20)
	node.add_theme_color_override("font_color", INK)
	node.add_theme_color_override("font_placeholder_color", MUTED)
	node.add_theme_stylebox_override("normal", box(WHITE, Color("b9b6a4")))
	node.add_theme_stylebox_override("focus", box(WHITE, NAVY))
	parent.add_child(node)
	return node

static func image(parent: Node, texture: Texture2D, at: Rect2) -> TextureRect:
	var node := TextureRect.new()
	node.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	node.texture = texture
	node.position = at.position
	node.size = at.size
	node.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	node.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(node)
	return node

static func bar(parent: Node, at: Rect2, fill: Color = GREEN) -> ProgressBar:
	var node := ProgressBar.new()
	node.show_percentage = false
	var background := box(NAVY, NAVY, 4)
	var foreground := box(fill, fill, 4)
	for style in [background, foreground]:
		style.content_margin_left = 0
		style.content_margin_right = 0
		style.content_margin_top = 0
		style.content_margin_bottom = 0
		style.set_border_width_all(0)
	node.add_theme_stylebox_override("background", background)
	node.add_theme_stylebox_override("fill", foreground)
	node.position = at.position
	node.size = at.size
	parent.add_child(node)
	return node
