require('dotenv').config();
const { openDatabase, initializeDatabase } = require('./db');

const db = initializeDatabase(openDatabase());
db.close();
console.log('Roles, permisos, cuentas ficticias, catálogo e inventario de demostración disponibles.');
