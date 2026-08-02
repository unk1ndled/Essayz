PRAGMA foreign_keys = ON;

ALTER TABLE users ADD COLUMN avatar_url TEXT;

CREATE TABLE petit_mots (
  essay_id TEXT NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (essay_id, user_id)
);

CREATE INDEX petit_mots_user_id_idx ON petit_mots(user_id);
