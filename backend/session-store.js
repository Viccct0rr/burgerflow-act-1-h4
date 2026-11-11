const session = require('express-session');

class SQLiteSessionStore extends session.Store {
  constructor(db) {
    super();
    this.db = db;
    db.exec(`CREATE TABLE IF NOT EXISTS session_store (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_session_store_expiry ON session_store(expires_at);`);
    this.read = db.prepare('SELECT data FROM session_store WHERE id = ? AND expires_at > ?');
    this.write = db.prepare(`INSERT INTO session_store (id, data, expires_at) VALUES (?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET data = excluded.data, expires_at = excluded.expires_at`);
    this.remove = db.prepare('DELETE FROM session_store WHERE id = ?');
    this.updateExpiry = db.prepare('UPDATE session_store SET expires_at = ? WHERE id = ?');
    this.removeExpired = db.prepare('DELETE FROM session_store WHERE expires_at <= ?');
  }

  get(sid, callback) {
    try {
      const row = this.read.get(sid, Date.now());
      callback(null, row ? JSON.parse(row.data) : null);
    } catch (error) {
      callback(error);
    }
  }

  set(sid, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + Number(value.cookie?.maxAge || 8 * 60 * 60 * 1000);
      this.write.run(sid, JSON.stringify(value), expiresAt);
      this.removeExpired.run(Date.now());
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  touch(sid, value, callback = () => {}) {
    try {
      const expiresAt = value.cookie?.expires
        ? new Date(value.cookie.expires).getTime()
        : Date.now() + Number(value.cookie?.maxAge || 8 * 60 * 60 * 1000);
      this.updateExpiry.run(expiresAt, sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }

  destroy(sid, callback = () => {}) {
    try {
      this.remove.run(sid);
      callback(null);
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = SQLiteSessionStore;
