-- Canonical editable records; public snapshots are intentionally derived.
CREATE TABLE faculty_categories (
  category_key TEXT PRIMARY KEY NOT NULL,
  label_zh TEXT NOT NULL, label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK(sort_order>=0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
) STRICT;
CREATE TABLE section_definitions (
  section_key TEXT PRIMARY KEY NOT NULL,
  label_zh TEXT NOT NULL, label_en TEXT NOT NULL,
  sort_order INTEGER NOT NULL CHECK(sort_order>=0),
  entry_layout TEXT NOT NULL DEFAULT 'list' CHECK(entry_layout IN ('list','card','cards')),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1))
) STRICT;
CREATE TABLE field_definitions (
  section_key TEXT NOT NULL REFERENCES section_definitions(section_key) ON DELETE RESTRICT,
  field_key TEXT NOT NULL,
  label_zh TEXT NOT NULL, label_en TEXT NOT NULL,
  field_type TEXT NOT NULL CHECK(field_type IN ('text','textarea','url','number','date')),
  sort_order INTEGER NOT NULL CHECK(sort_order>=0),
  is_required INTEGER NOT NULL DEFAULT 0 CHECK(is_required IN (0,1)),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  show_public INTEGER NOT NULL DEFAULT 1 CHECK(show_public IN (0,1)),
  PRIMARY KEY(section_key,field_key)
) STRICT;
CREATE TABLE teachers (
  teacher_id TEXT PRIMARY KEY NOT NULL,
  category_key TEXT NOT NULL REFERENCES faculty_categories(category_key) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK(sort_order>=0),
  email TEXT NOT NULL DEFAULT '', profile_url TEXT NOT NULL DEFAULT '', photo_url TEXT NOT NULL DEFAULT '',
  archived_at TEXT,
  row_version INTEGER NOT NULL DEFAULT 1 CHECK(row_version>0),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX teachers_category_order ON teachers(category_key,sort_order,teacher_id) WHERE archived_at IS NULL;
CREATE TABLE teacher_translations (
  teacher_id TEXT NOT NULL REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  locale TEXT NOT NULL CHECK(locale IN ('zh','en')),
  name TEXT NOT NULL DEFAULT '', title TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '', office TEXT NOT NULL DEFAULT '', expertise TEXT NOT NULL DEFAULT '',
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)),
  PRIMARY KEY(teacher_id,locale)
) STRICT;
CREATE TABLE teacher_entries (
  entry_id TEXT PRIMARY KEY NOT NULL,
  teacher_id TEXT NOT NULL REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  section_key TEXT NOT NULL REFERENCES section_definitions(section_key) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK(sort_order>=0),
  entry_type TEXT NOT NULL DEFAULT 'list_item' CHECK(entry_type IN ('list_item','text')),
  link_url TEXT NOT NULL DEFAULT '',
  card_width INTEGER CHECK(card_width IS NULL OR card_width BETWEEN 180 AND 800),
  card_height INTEGER CHECK(card_height IS NULL OR card_height BETWEEN 100 AND 1200),
  UNIQUE(entry_id,section_key)
) STRICT;
CREATE INDEX entries_teacher_section_order ON teacher_entries(teacher_id,section_key,sort_order,entry_id);
CREATE TABLE entry_translations (
  entry_id TEXT NOT NULL REFERENCES teacher_entries(entry_id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('zh','en')),
  title TEXT NOT NULL DEFAULT '', content TEXT NOT NULL DEFAULT '',
  is_visible INTEGER NOT NULL DEFAULT 1 CHECK(is_visible IN (0,1)),
  PRIMARY KEY(entry_id,locale)
) STRICT;
CREATE TABLE entry_field_values (
  entry_id TEXT NOT NULL,
  section_key TEXT NOT NULL,
  field_key TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('zh','en')),
  value TEXT NOT NULL,
  PRIMARY KEY(entry_id,section_key,field_key,locale),
  FOREIGN KEY(entry_id,section_key) REFERENCES teacher_entries(entry_id,section_key) ON DELETE CASCADE,
  FOREIGN KEY(section_key,field_key) REFERENCES field_definitions(section_key,field_key) ON DELETE RESTRICT
) STRICT;
CREATE INDEX field_values_definition ON entry_field_values(section_key,field_key);
CREATE TABLE users (
  user_id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL COLLATE NOCASE UNIQUE,
  password_hash TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
  must_change_password INTEGER NOT NULL DEFAULT 1 CHECK(must_change_password IN (0,1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE user_roles (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('ADMIN','TEACHER')),
  PRIMARY KEY(user_id,role)
) STRICT;
CREATE TABLE user_teachers (
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  teacher_id TEXT NOT NULL REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  PRIMARY KEY(user_id,teacher_id)
) STRICT;
CREATE INDEX user_teachers_teacher ON user_teachers(teacher_id);
CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK(expires_at>created_at)
) STRICT;
CREATE INDEX sessions_user ON sessions(user_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
-- Publication is a derived, read-only projection; private draft data must never be serialized here.
CREATE TABLE public_teacher_snapshots (
  teacher_id TEXT PRIMARY KEY NOT NULL REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  category_key TEXT NOT NULL REFERENCES faculty_categories(category_key) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL CHECK(sort_order>=0),
  source_version INTEGER NOT NULL CHECK(source_version>0),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_type(payload_json)='object'),
  published_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX public_teachers_order ON public_teacher_snapshots(category_key,sort_order,teacher_id);
CREATE TABLE public_config_snapshot (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND json_type(payload_json)='object'),
  published_by TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE audit_logs (
  audit_id INTEGER PRIMARY KEY,
  actor_id TEXT REFERENCES users(user_id) ON DELETE SET NULL,
  teacher_id TEXT REFERENCES teachers(teacher_id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX audit_teacher_time ON audit_logs(teacher_id,created_at);
