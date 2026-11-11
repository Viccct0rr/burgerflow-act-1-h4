CREATE TABLE session_store (
  id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE INDEX idx_session_store_expiry ON session_store(expires_at);
