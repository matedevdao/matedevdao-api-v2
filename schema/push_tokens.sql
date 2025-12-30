CREATE TABLE push_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_address TEXT NOT NULL,
    fcm_token TEXT NOT NULL UNIQUE,
    device_info TEXT,
    created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
    updated_at INTEGER
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_address);
