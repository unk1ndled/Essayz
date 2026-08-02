PRAGMA foreign_keys = ON;

CREATE TABLE invitations (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by TEXT REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX invitations_created_by_idx ON invitations(created_by);
CREATE INDEX invitations_expires_at_idx ON invitations(expires_at);
