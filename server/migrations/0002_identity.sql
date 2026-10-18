-- Identity boundary. Added while moving from "records exist" to "requests are authenticated".
CREATE TABLE sessions(
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES accounts(id),
    token_hash BYTEA NOT NULL UNIQUE,
    user_agent TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX sessions_account_id_idx ON sessions(account_id);

ALTER TABLE characters ADD CONSTRAINT characters_account_id_name_key UNIQUE (account_id, name);
