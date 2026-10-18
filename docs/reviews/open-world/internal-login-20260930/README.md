# Internal account-only login acceptance

Local dev defaults to AW_TEST_LOGIN=1. Username only (3–32 letters, digits or underscores); first use creates an account, subsequent use restores its character. Enter submits; duplicate clicks are blocked. Existing password hashes are preserved.

API defaults to password mode. Production rejects test login. Set AW_TEST_LOGIN=0 for password-based development login.

Passed: TypeScript, 19 real PostgreSQL tests, Chrome new-account creation, Enter login, logout/relogin restoring the same character, no password field and no page errors. Live port 8612 checked independently. Temporary DB only; existing player data untouched.

QA fixes: serialized test files to avoid concurrent schema creation; added auth_mode to runtime response validation. All checks passed after fixes.

Cleanup: 123301566 bytes (117.59 MiB) removed to zero, including failed runs. Final screenshot and results retained.

Repeat: node tools/accept-test-login.mjs
