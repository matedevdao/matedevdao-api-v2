CREATE TABLE profiles (
  account TEXT PRIMARY KEY,
  nickname TEXT,
  bio TEXT,

  primary_nft_contract_address TEXT,
  primary_nft_token_id TEXT,

  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER
);
