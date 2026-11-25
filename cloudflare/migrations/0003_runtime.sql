-- Runtime security and recoverable history. Apply once to staging after backup.
ALTER TABLE sessions ADD COLUMN csrf_hash TEXT NOT NULL DEFAULT '';
ALTER TABLE teachers ADD COLUMN edit_token TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key TEXT PRIMARY KEY NOT NULL,
  failures INTEGER NOT NULL DEFAULT 0 CHECK(failures >= 0),
  blocked_until INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
) STRICT;
CREATE TABLE IF NOT EXISTS teacher_revisions (
  revision_id TEXT PRIMARY KEY NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  row_version INTEGER NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  actor_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX IF NOT EXISTS revisions_teacher_time ON teacher_revisions(teacher_id,created_at DESC);
CREATE TABLE IF NOT EXISTS config_revisions (
  revision_id TEXT PRIMARY KEY NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
  actor_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
