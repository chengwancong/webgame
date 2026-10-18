extends Node
## Transport only. It knows how to talk to the API and carries the session token
## for the current login. It decides nothing about combat, rewards or assets
## beyond what the server already decided.
##
## Every authenticated call sends the bearer token that `login` stored. There is
## no method that takes an account id: identity comes from the session, never
## from a request body this client could invent.

var base_url := "http://127.0.0.1:8601"
var session_token := ""
var last_status := 0
var last_error := ""

var _http: HTTPRequest


func _ready() -> void:
	_http = HTTPRequest.new()
	_http.name = "HttpRequest"
	add_child(_http)
	var configured := _configured_base_url()
	if not configured.is_empty():
		base_url = configured


static func _read_query(name: String) -> String:
	var search: String = JavaScriptBridge.eval("window.location.search") if OS.has_feature("web") else ""
	if search.is_empty():
		return ""
	for part in String(search).lstrip("?").split("&"):
		var pair := String(part).split("=", true, 1)
		if pair.size() == 2 and pair[0] == name:
			return pair[1].uri_decode()
	return ""


func _configured_base_url() -> String:
	var from_environment := OS.get_environment("ABYSS_API_BASE")
	if not from_environment.is_empty():
		return from_environment
	var from_query := _read_query("aw_api")
	return from_query


func register(login_name: String, password: String) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/accounts",
		JSON.stringify({"login": login_name, "password": password}))


func login(login_name: String, password: String) -> Dictionary:
	var response: Dictionary = await _request(HTTPClient.METHOD_POST, "/sessions",
		JSON.stringify({"login": login_name, "password": password}))
	if bool(response.get("ok", false)):
		session_token = str(response["body"].get("session_token", ""))
	return response


func logout() -> Dictionary:
	var response: Dictionary = await _request(HTTPClient.METHOD_DELETE, "/sessions/current", "")
	if bool(response.get("ok", false)):
		session_token = ""
	return response


func list_characters() -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, "/characters", "")


func create_character(command_id: String, character_name: String) -> Dictionary:
	return await _request(HTTPClient.METHOD_POST, "/characters",
		JSON.stringify({"command_id": command_id, "name": character_name}))


func read_character(character_id: int) -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, "/characters/%d" % character_id, "")


func opening_spec(character_id: int) -> Dictionary:
	return await _request(HTTPClient.METHOD_GET, "/opening?character_id=%d" % character_id, "")


func authenticated() -> bool:
	return not session_token.is_empty()


func _request(method: int, path: String, payload: String) -> Dictionary:
	var headers := PackedStringArray(["Content-Type: application/json"])
	if not session_token.is_empty():
		headers.append("Authorization: Bearer " + session_token)
	var body := payload if method != HTTPClient.METHOD_GET else ""
	last_error = ""
	last_status = 0
	var error := _http.request(base_url + path, headers, method, body)
	if error != OK:
		last_error = "请求未能发出（错误码 %d）：请确认 make dev 已启动" % error
		return {"ok": false, "status": 0, "body": {"detail": last_error}, "raw": "", "error": last_error}
	var outcome: Array = await _http.request_completed
	# outcome[0] is the transport result. A connection failure arrives here as
	# a completed signal with a non-OK result and an empty body — the old code
	# read that as a normal empty JSON answer and callers saw a blank failure.
	var transport := int(outcome[0])
	last_status = int(outcome[1])
	var raw := (outcome[3] as PackedByteArray).get_string_from_utf8()
	if transport != OK:
		last_error = "网络错误（%s）：无法连接 %s，请确认 make dev 已启动" % [error_string(transport), base_url]
		return {"ok": false, "status": last_status, "body": {"detail": last_error},
			"raw": raw, "error": last_error}
	var parsed = JSON.parse_string(raw) if not raw.is_empty() else {}
	if parsed == null and last_status != HTTPClient.RESPONSE_NO_CONTENT:
		last_error = "响应不是有效 JSON（HTTP %d）：%s" % [last_status, raw.left(120)]
		return {"ok": false, "status": last_status, "body": {"detail": last_error},
			"raw": raw, "error": last_error}
	return {"ok": last_status >= 200 and last_status < 300, "status": last_status,
		"body": parsed if parsed != null else {}, "raw": raw, "error": last_error}


static func random_command_id() -> String:
	# Godot has no UUID built-in; a UUID-shaped random id is enough for a client
	# generated idempotency key. The server only ever treats it as opaque.
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var hex := ""
	for _index in range(32):
		hex += "%x" % rng.randi_range(0, 15)
	return "%s-%s-4%s-a%s-%s" % [hex.substr(0, 8), hex.substr(8, 4), hex.substr(13, 3),
		hex.substr(16, 3), hex.substr(19, 12)]
