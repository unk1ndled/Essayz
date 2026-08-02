PRAGMA foreign_keys = ON;

CREATE TABLE essay_hearts (
  essay_id TEXT NOT NULL REFERENCES essays(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (essay_id, user_id)
);

CREATE INDEX essay_hearts_user_id_idx ON essay_hearts(user_id);
