CREATE TABLE IF NOT EXISTS google_web3_accounts (
  google_sub TEXT NOT NULL PRIMARY KEY,
  wallet_address TEXT NOT NULL,
  token TEXT NOT NULL,
  email TEXT,
  name TEXT,
  picture TEXT,
  linked_at INTEGER NOT NULL
);
