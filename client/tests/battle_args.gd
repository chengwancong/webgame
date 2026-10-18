## Shared argument reading for the headless harnesses, so both entry points
## accept exactly the same flags.

static func arg_value(flag: String) -> String:
	var user_args := OS.get_cmdline_user_args()
	var index := user_args.find("--" + flag)
	if index >= 0 and index + 1 < user_args.size():
		return user_args[index + 1]
	for argument in OS.get_cmdline_args():
		if argument.begins_with("--" + flag + "="):
			return argument.split("=", true, 1)[1]
	return ""

static func user_settings() -> Dictionary:
	var settings := {}
	for key in ["spec", "source", "login", "password", "api"]:
		settings[key] = arg_value(key)
	return settings
