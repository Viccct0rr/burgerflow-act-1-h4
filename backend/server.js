require('dotenv').config();
const crypto = require('node:crypto');
const { initializeDatabase, openDatabase } = require('./db');
const { createApp } = require('./app');

const db = initializeDatabase(openDatabase());
if (!process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET no está configurado; se generó uno temporal para esta ejecución local.');
}
const app = createApp({ db });
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`BurgerFlow disponible en http://${host}:${port}`);
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
