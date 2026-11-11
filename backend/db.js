const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const ROOT = path.resolve(__dirname, '..');
const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

const permissionDescriptions = {
  'products:read': 'Consultar el catálogo activo',
  'products:write': 'Crear, editar y desactivar productos',
  'inventory:read': 'Consultar cantidades de inventario',
  'inventory:write': 'Ajustar cantidades de inventario',
  'orders:create': 'Registrar pedidos',
  'orders:read:all': 'Consultar todos los pedidos operativos',
  'orders:read:own': 'Consultar pedidos propios',
  'orders:kitchen': 'Consultar pedidos sin datos de entrega',
  'orders:delivery': 'Consultar entregas asignadas',
  'orders:status:kitchen': 'Actualizar estados de cocina',
  'orders:status:delivery': 'Actualizar estados de entrega',
  'orders:cancel': 'Cancelar pedidos pendientes',
  'orders:assign': 'Asignar repartidores',
  'dashboard:read': 'Consultar indicadores administrativos',
  'users:manage': 'Gestionar cuentas y roles'
};

const rolePermissions = {
  admin: Object.keys(permissionDescriptions),
  cashier: ['products:read', 'orders:create', 'orders:read:all', 'orders:cancel'],
  kitchen: ['products:read', 'orders:kitchen', 'orders:status:kitchen'],
  delivery: ['orders:delivery', 'orders:status:delivery'],
  customer: ['products:read', 'orders:create', 'orders:read:own']
};

const demoProducts = [
  ['Doble Flow Burger', 'Hamburguesas', 'Hamburguesa de demostración', 1250, 30, 'unidades'],
  ['Crispy Spicy Chicken', 'Hamburguesas', 'Pollo crujiente de demostración', 900, 20, 'unidades'],
  ['Vegan Classic Flow', 'Hamburguesas', 'Hamburguesa vegetal de demostración', 1100, 10, 'unidades'],
  ['Papas Clásicas (L)', 'Acompañamientos', 'Papas de demostración', 450, 35, 'porciones'],
  ['Flow Loaded Fries', 'Acompañamientos', 'Papas cargadas de demostración', 600, 18, 'porciones'],
  ['Bacon Blast Burger', 'Hamburguesas', 'Hamburguesa de demostración', 1450, 18, 'unidades'],
  ['Cheese Heaven', 'Hamburguesas', 'Hamburguesa de demostración', 1200, 22, 'unidades'],
  ['The Monster Burger', 'Hamburguesas', 'Hamburguesa de demostración', 1890, 8, 'unidades'],
  ['Classic Smash Burger', 'Hamburguesas', 'Hamburguesa de demostración', 1250, 18, 'unidades'],
  ['Spicy Chicken Sandwich', 'Hamburguesas', 'Sándwich de pollo de demostración', 900, 15, 'unidades'],
  ['Large Fries', 'Acompañamientos', 'Papas fritas de demostración', 450, 30, 'porciones']
];

function openDatabase(filename = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'burgerflow.sqlite')) {
  const resolved = path.isAbsolute(filename) ? filename : path.resolve(ROOT, filename);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  const db = new Database(resolved);
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.pragma('journal_mode = WAL');
  return db;
}

function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const applied = db.prepare('SELECT filename FROM schema_migrations').all().map((row) => row.filename);
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((file) => file.endsWith('.sql')).sort();
  for (const filename of files) {
    if (applied.includes(filename)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, filename), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run(filename);
    })();
  }
}

function seed(db, demoPassword = process.env.DEMO_PASSWORD || 'ChangeThisDemoPassword1!') {
  const insertRole = db.prepare('INSERT OR IGNORE INTO roles (id, name) VALUES (?, ?)');
  const insertPermission = db.prepare('INSERT OR IGNORE INTO permissions (id, description) VALUES (?, ?)');
  const insertRolePermission = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)');
  const insertProduct = db.prepare(`INSERT OR IGNORE INTO products (name, category, description, price_cents)
    VALUES (?, ?, ?, ?)`);
  const insertInventory = db.prepare(`INSERT OR IGNORE INTO inventory (product_id, quantity, unit)
    VALUES (?, ?, ?)`);
  const accounts = [
    ['Administración Demo', 'admin@burgerflow.local', 'admin'],
    ['Caja Demo', 'cajero@burgerflow.local', 'cashier'],
    ['Cocina Demo', 'cocina@burgerflow.local', 'kitchen'],
    ['Reparto Demo', 'delivery@burgerflow.local', 'delivery'],
    ['Repartidor A Demo', 'repartidor-a@burgerflow.local', 'delivery'],
    ['Repartidor B Demo', 'repartidor-b@burgerflow.local', 'delivery'],
    ['Cliente Demo', 'cliente@burgerflow.local', 'customer']
  ];
  const hash = bcrypt.hashSync(demoPassword, 12);

  db.transaction(() => {
    for (const [id, name] of Object.entries({
      admin: 'Administrador',
      cashier: 'Cajero',
      kitchen: 'Cocinero',
      delivery: 'Delivery',
      customer: 'Cliente'
    })) {
      insertRole.run(id, name);
    }
    for (const [id, description] of Object.entries(permissionDescriptions)) {
      insertPermission.run(id, description);
    }
    for (const [roleId, permissions] of Object.entries(rolePermissions)) {
      for (const permission of permissions) insertRolePermission.run(roleId, permission);
    }
    for (const [name, email, role] of accounts) insertUser.run(name, email, hash, role);
    for (const [name, category, description, priceCents, quantity, unit] of demoProducts) {
      insertProduct.run(name, category, description, priceCents);
      const product = db.prepare('SELECT id FROM products WHERE name = ?').get(name);
      insertInventory.run(product.id, quantity, unit);
    }
  })();
}

function initializeDatabase(db, demoPassword) {
  migrate(db);
  seed(db, demoPassword);
  return db;
}

module.exports = { openDatabase, migrate, seed, initializeDatabase, rolePermissions };
