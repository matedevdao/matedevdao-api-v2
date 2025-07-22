CREATE TABLE wallet_login_nonces (
  wallet_address TEXT NOT NULL PRIMARY KEY,
  nonce TEXT NOT NULL,
  domain TEXT NOT NULL,
  uri TEXT NOT NULL,
  issued_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
