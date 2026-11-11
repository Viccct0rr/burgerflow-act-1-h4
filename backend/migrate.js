require('dotenv').config();
const { openDatabase, migrate } = require('./db');

const db = openDatabase();
migrate(db);
db.close();
console.log('Migraciones SQLite aplicadas.');
