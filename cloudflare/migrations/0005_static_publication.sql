CREATE TABLE static_publication (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  generation INTEGER NOT NULL DEFAULT 0,
  published_generation INTEGER NOT NULL DEFAULT 0,
  deployment_id TEXT,
  deployment_url TEXT,
  state TEXT NOT NULL DEFAULT 'idle' CHECK(state IN ('idle','publishing','failed')),
  lock_token TEXT NOT NULL DEFAULT '',
  lock_expires_at INTEGER NOT NULL DEFAULT 0,
  last_error TEXT NOT NULL DEFAULT '',
  published_at TEXT
) STRICT;
INSERT INTO static_publication(singleton) VALUES(1);
