CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  account TEXT NOT NULL,
  text TEXT NOT NULL,
  attachments TEXT DEFAULT '[]',
  timestamp INTEGER NOT NULL
);
