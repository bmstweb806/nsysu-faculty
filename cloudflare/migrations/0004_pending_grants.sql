-- Imported Sheet permissions without creating login credentials.
CREATE TABLE pending_account_grants (
  email TEXT PRIMARY KEY NOT NULL COLLATE NOCASE,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','TEACHER')),
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  is_active INTEGER NOT NULL CHECK(is_active IN (0,1)),
  imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((role='ADMIN' AND teacher_id IS NULL) OR (role='TEACHER' AND teacher_id IS NOT NULL))
) STRICT;
CREATE INDEX pending_grants_teacher ON pending_account_grants(teacher_id);
