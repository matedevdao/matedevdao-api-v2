CREATE TABLE user_sessions (
  wallet_address TEXT NOT NULL,
  token TEXT NOT NULL,
  ip TEXT,
  real_ip TEXT,
  forwarded_for TEXT,
  user_agent TEXT,
  origin TEXT,
  referer TEXT,
  accept_language TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  last_used_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (wallet_address, token)
);
