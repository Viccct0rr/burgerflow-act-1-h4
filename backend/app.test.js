const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const request = require('supertest');
const { createApp } = require('./app');
const { initializeDatabase, migrate, openDatabase, seed } = require('./db');

const DEMO_PASSWORD = 'BurgerFlowTestPassword1!';

function setup() {
  const db = initializeDatabase(new Database(':memory:'), DEMO_PASSWORD);
  db.pragma('foreign_keys = ON');
  const app = createApp({ db, testMode: true, sessionSecret: 'test-secret-that-is-long-enough' });
  return { db, app };
}

async function login(app, email) {
  const agent = request.agent(app);
  const response = await agent.post('/api/auth/login').send({ email, password: DEMO_PASSWORD });
  assert.equal(response.status, 200);
  return agent;
}

async function createDeliveryOrder(app, email = 'cliente@burgerflow.local') {
  const customer = await login(app, email);
  const product = (await customer.get('/api/products').expect(200)).body.products[0];
  const response = await customer.post('/api/orders').send({
    items: [{ productId: product.id, quantity: 1, priceCents: 1 }],
    orderType: 'delivery',
    paymentMethod: 'cash',
    delivery: { name: 'Cliente Ficticio', phone: '+1 555 0100', address: 'Calle de Prueba 100' },
    totalCents: 1,
    customerId: 1
  }).expect(201);
  return { customer, order: response.body.order, product };
}

test('anonymous users cannot mutate inventory and cashier lacks inventory permissions', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const product = db.prepare('SELECT product_id AS id, quantity FROM inventory LIMIT 1').get();
  await request(app).patch(`/api/inventory/${product.id}`).send({ quantity: 1, reason: 'test' }).expect(401);
  const cashier = await login(app, 'cajero@burgerflow.local');
  await cashier.patch(`/api/inventory/${product.id}`).send({ quantity: 1, reason: 'test' }).expect(403);
  assert.equal(db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product.id).quantity, product.quantity);
  const admin = await login(app, 'admin@burgerflow.local');
  const cashierId = db.prepare(`SELECT id FROM users WHERE email = 'cajero@burgerflow.local'`).get().id;
  await admin.patch(`/api/users/${cashierId}`).send({ active: 0 }).expect(204);
  await cashier.get('/api/orders').expect(401);
});

test('admin can perform product CRUD without deleting order history', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const admin = await login(app, 'admin@burgerflow.local');
  const created = await admin.post('/api/products').send({
    name: 'Producto Seguro',
    category: 'Pruebas',
    description: 'Texto de prueba',
    priceCents: 777,
    quantity: 4,
    unit: 'unidades'
  }).expect(201);
  const id = created.body.product.id;
  assert.equal(created.body.product.quantity, 4);
  await admin.patch(`/api/products/${id}`).send({ name: 'Producto Renombrado', priceCents: 900 }).expect(200);
  await admin.patch(`/api/inventory/${id}`).send({ quantity: 3, reason: 'recuento' }).expect(200);
  await admin.delete(`/api/products/${id}`).expect(204);
  assert.equal(db.prepare('SELECT active FROM products WHERE id = ?').get(id).active, 0);
  assert.equal(db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(id).quantity, 3);
});

test('admin can manage demo accounts without exposing stored password hashes', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const admin = await login(app, 'admin@burgerflow.local');
  const created = await admin.post('/api/users').send({
    name: 'Usuario Ficticio',
    email: 'nuevo@burgerflow.local',
    password: 'A-Demo-Password-Long!',
    role: 'cashier'
  }).expect(201);
  assert.equal('password_hash' in created.body.user, false);
  const users = (await admin.get('/api/users').expect(200)).body.users;
  assert.equal(users.some((user) => user.email === 'nuevo@burgerflow.local'), true);
  await admin.patch(`/api/users/${created.body.user.id}`).send({ active: 0 }).expect(204);
  await request(app).post('/api/auth/login').send({
    email: 'nuevo@burgerflow.local',
    password: 'A-Demo-Password-Long!'
  }).expect(401);
});

test('orders use database prices, reject invalid quantities and roll back insufficient stock', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const { customer, order, product } = await createDeliveryOrder(app);
  const ownerId = db.prepare('SELECT cliente_id FROM orders WHERE id = ?').get(order.id).cliente_id;
  assert.equal(ownerId, db.prepare(`SELECT id FROM users WHERE email = 'cliente@burgerflow.local'`).get().id);
  assert.equal(order.items[0].unitPriceCents, product.priceCents);
  assert.equal(order.totalCents, product.priceCents + Math.round(product.priceCents * 0.08) + 50);
  assert.equal(order.delivery.address, 'Calle de Prueba 100');
  const initialStock = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product.id).quantity + 1;
  const currentStock = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product.id).quantity;
  assert.equal(currentStock, initialStock - 1);

  for (const quantity of [0, -1, 1.5]) {
    await customer.post('/api/orders').send({
      items: [{ productId: product.id, quantity }],
      orderType: 'pickup',
      paymentMethod: 'cash'
    }).expect(400);
  }

  const admin = await login(app, 'admin@burgerflow.local');
  await admin.patch(`/api/inventory/${product.id}`).send({ quantity: 0, reason: 'prueba de insuficiencia' }).expect(200);
  await customer.post('/api/orders').send({
    items: [{ productId: product.id, quantity: 1 }],
    orderType: 'pickup',
    paymentMethod: 'cash'
  }).expect(409);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, 1);
});

test('customization prices come from the server and duplicate product lines reserve stock together', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const { customer, product } = await createDeliveryOrder(app);
  const result = await customer.post('/api/orders').send({
    items: [
      {
        productId: product.id,
        quantity: 1,
        personalizations: [
          { name: 'Tamaño', value: 'grande', priceDeltaCents: 999999 },
          { name: 'Extra', value: 'Queso extra', priceDeltaCents: 999999 }
        ]
      },
      {
        productId: product.id,
        quantity: 1,
        personalizations: [{ name: 'Extra', value: 'Tocino extra', priceDeltaCents: 0 }]
      }
    ],
    orderType: 'pickup',
    paymentMethod: 'cash'
  }).expect(201);

  const [largeWithCheese, baconExtra] = result.body.order.items;
  assert.equal(largeWithCheese.unitPriceCents, product.priceCents + 300);
  assert.equal(baconExtra.unitPriceCents, product.priceCents + 150);
  assert.deepEqual(largeWithCheese.personalizations.map((option) => option.priceDeltaCents), [200, 100]);
  assert.equal(result.body.order.subtotalCents, product.priceCents * 2 + 450);
  assert.equal(result.body.order.taxCents, Math.round(result.body.order.subtotalCents * 0.08));
  assert.equal(
    result.body.order.totalCents,
    result.body.order.subtotalCents + result.body.order.taxCents + result.body.order.serviceCents
  );
  assert.deepEqual(
    db.prepare(`SELECT price_delta_cents FROM personalizations
      WHERE order_item_id = ? ORDER BY id`).all(largeWithCheese.id).map((row) => row.price_delta_cents),
    [200, 100]
  );

  await customer.post('/api/orders').send({
    items: [{ productId: product.id, quantity: 1, personalizations: [{ name: 'Extra', value: 'Caviar' }] }],
    orderType: 'pickup',
    paymentMethod: 'cash'
  }).expect(400);

  const admin = await login(app, 'admin@burgerflow.local');
  await admin.patch(`/api/inventory/${product.id}`)
    .send({ quantity: 1, reason: 'prueba de cantidad duplicada' }).expect(200);
  const orderCount = db.prepare('SELECT COUNT(*) AS count FROM orders').get().count;
  await customer.post('/api/orders').send({
    items: [
      { productId: product.id, quantity: 1 },
      { productId: product.id, quantity: 1 }
    ],
    orderType: 'pickup',
    paymentMethod: 'cash'
  }).expect(409);
  assert.equal(db.prepare('SELECT COUNT(*) AS count FROM orders').get().count, orderCount);
  assert.equal(db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product.id).quantity, 1);
});

test('kitchen and cashier responses omit delivery details; delivery sees assigned orders only', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const { customer, order } = await createDeliveryOrder(app);
  await customer.patch(`/api/orders/${order.id}/delivery`).send({
    name: 'Cliente Ficticio Actualizado',
    phone: '+1 555 0101',
    address: 'Avenida de Prueba 200'
  }).expect(204);
  const ownOrders = (await customer.get('/api/orders').expect(200)).body.orders;
  assert.equal(ownOrders[0].delivery.address, 'Avenida de Prueba 200');
  const kitchen = await login(app, 'cocina@burgerflow.local');
  const kitchenOrders = (await kitchen.get('/api/orders/kitchen').expect(200)).body.orders;
  assert.equal(kitchenOrders[0].id, order.id);
  assert.equal('delivery' in kitchenOrders[0], false);
  assert.equal('paymentMethod' in kitchenOrders[0], false);
  assert.equal('totalCents' in kitchenOrders[0], false);

  const cashier = await login(app, 'cajero@burgerflow.local');
  const cashierOrders = (await cashier.get('/api/orders').expect(200)).body.orders;
  assert.equal('delivery' in cashierOrders[0], false);
  await kitchen.patch(`/api/orders/${order.id}/status`).send({ status: 'preparing' }).expect(200);
  await kitchen.patch(`/api/orders/${order.id}/status`).send({ status: 'ready' }).expect(200);

  const deliveryUser = db.prepare(`SELECT id FROM users WHERE email = 'delivery@burgerflow.local'`).get();
  const otherDeliveryId = db.prepare(`INSERT INTO users (name, email, password_hash, role_id)
    VALUES ('Repartidor de prueba', 'otro.delivery@burgerflow.local', ?, 'delivery')`)
    .run(bcrypt.hashSync(DEMO_PASSWORD, 10)).lastInsertRowid;
  const driver = await login(app, 'delivery@burgerflow.local');
  const assigned = (await driver.get('/api/orders/delivery').expect(200)).body.orders;
  assert.equal(assigned[0].id, order.id);
  assert.equal(assigned[0].delivery.address, 'Avenida de Prueba 200');

  const otherDriver = await login(app, 'otro.delivery@burgerflow.local');
  assert.deepEqual((await otherDriver.get('/api/orders/delivery').expect(200)).body.orders, []);
  await otherDriver.patch(`/api/orders/${order.id}/status`).send({ status: 'out_for_delivery' }).expect(404);
  await driver.patch(`/api/orders/${order.id}/status`).send({ status: 'out_for_delivery' }).expect(200);
  await driver.patch(`/api/orders/${order.id}/status`).send({ status: 'delivered' }).expect(200);
  assert.notEqual(deliveryUser.id, otherDeliveryId);
});

test('only the assigned delivery account can read a specific order and its address', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const { order: firstOrder } = await createDeliveryOrder(app);
  const { order: secondOrder } = await createDeliveryOrder(app);
  const admin = await login(app, 'admin@burgerflow.local');
  const driverAId = db.prepare(`SELECT id FROM users WHERE email = 'repartidor-a@burgerflow.local'`).get().id;
  const driverBId = db.prepare(`SELECT id FROM users WHERE email = 'repartidor-b@burgerflow.local'`).get().id;
  await admin.patch(`/api/orders/${firstOrder.id}/assign`).send({ deliveryUserId: driverAId }).expect(204);
  await admin.patch(`/api/orders/${secondOrder.id}/assign`).send({ deliveryUserId: driverAId }).expect(204);

  const driverA = await login(app, 'repartidor-a@burgerflow.local');
  const firstAllowed = await driverA.get(`/api/orders/${firstOrder.id}`).expect(200);
  const secondAllowed = await driverA.get(`/api/orders/${secondOrder.id}`).expect(200);
  assert.equal(firstAllowed.body.order.delivery.address, 'Calle de Prueba 100');
  assert.equal(secondAllowed.body.order.delivery.phone, '+1 555 0100');
  assert.equal('totalCents' in firstAllowed.body.order, false);

  const driverB = await login(app, 'repartidor-b@burgerflow.local');
  for (const order of [firstOrder, secondOrder]) {
    const denied = await driverB.get(`/api/orders/${order.id}?userId=${driverAId}`).expect(404);
    const responseText = JSON.stringify(denied.body);
    assert.equal(responseText.includes('Calle de Prueba 100'), false);
    assert.equal(responseText.includes('+1 555 0100'), false);
    assert.equal(responseText.includes('Cliente Ficticio'), false);
    assert.deepEqual(denied.body, { error: 'Pedido no encontrado.' });
  }
  assert.equal(db.prepare('SELECT repartidor_id FROM orders WHERE id = ?').get(firstOrder.id).repartidor_id, driverAId);
  assert.notEqual(driverAId, driverBId);
});

test('migration adds customer and delivery foreign keys and preserves existing order assignments', (t) => {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.pragma('foreign_keys = ON');
  db.exec(fs.readFileSync(path.join(__dirname, 'migrations', '001-initial-schema.sql'), 'utf8'));
  db.exec(`CREATE TABLE schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  db.prepare('INSERT INTO schema_migrations (filename) VALUES (?)').run('001-initial-schema.sql');
  seed(db, DEMO_PASSWORD);
  const cashierId = db.prepare(`SELECT id FROM users WHERE email = 'cajero@burgerflow.local'`).get().id;
  const clientId = db.prepare(`SELECT id FROM users WHERE email = 'cliente@burgerflow.local'`).get().id;
  const driverId = db.prepare(`SELECT id FROM users WHERE email = 'repartidor-a@burgerflow.local'`).get().id;
  const legacyOrderId = db.prepare(`INSERT INTO orders
    (code, created_by, assigned_delivery_id, order_type, status, payment_method,
     subtotal_cents, tax_cents, service_cents, total_cents)
    VALUES ('BF-MIGRATION', ?, ?, 'delivery', 'ready', 'cash', 100, 8, 50, 158)`)
    .run(cashierId, driverId).lastInsertRowid;

  migrate(db);
  const migrated = db.prepare('SELECT cliente_id, repartidor_id FROM orders WHERE id = ?').get(legacyOrderId);
  assert.equal(migrated.cliente_id, clientId);
  assert.equal(migrated.repartidor_id, driverId);
  assert.deepEqual(db.pragma('foreign_key_check'), []);
  assert.throws(() => db.prepare('UPDATE orders SET cliente_id = ? WHERE id = ?').run(cashierId, legacyOrderId));
  assert.throws(() => db.prepare('UPDATE orders SET repartidor_id = ? WHERE id = ?').run(clientId, legacyOrderId));
});

test('order states are role-limited and cancellation restores stock', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  const cashier = await login(app, 'cajero@burgerflow.local');
  const product = db.prepare('SELECT product_id AS id, quantity FROM inventory LIMIT 1').get();
  const orderResponse = await cashier.post('/api/orders').send({
    items: [{ productId: product.id, quantity: 2 }],
    orderType: 'dine_in',
    paymentMethod: 'cash'
  }).expect(201);
  const orderId = orderResponse.body.order.id;
  const kitchen = await login(app, 'cocina@burgerflow.local');
  await kitchen.patch(`/api/orders/${orderId}/status`).send({ status: 'ready' }).expect(403);
  await kitchen.patch(`/api/orders/${orderId}/status`).send({ status: 'preparing' }).expect(200);
  await kitchen.patch(`/api/orders/${orderId}/status`).send({ status: 'ready' }).expect(200);
  await kitchen.patch(`/api/orders/${orderId}/status`).send({ status: 'cancelled' }).expect(403);
  const secondOrder = await cashier.post('/api/orders').send({
    items: [{ productId: product.id, quantity: 2 }],
    orderType: 'dine_in',
    paymentMethod: 'cash'
  }).expect(201);
  const stockAfterOrder = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product.id).quantity;
  await cashier.patch(`/api/orders/${secondOrder.body.order.id}/status`).send({ status: 'cancelled' }).expect(200);
  assert.equal(db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(product.id).quantity, stockAfterOrder + 2);
});

test('database and authenticated session persist across a server restart', async (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'burgerflow-test-'));
  const filename = path.join(directory, 'restart.sqlite');
  let restartedDb;
  t.after(() => {
    restartedDb?.close();
    fs.rmSync(directory, { recursive: true, force: true });
  });
  const firstDb = initializeDatabase(openDatabase(filename), DEMO_PASSWORD);
  const firstApp = createApp({ db: firstDb, sessionSecret: 'persistent-test-secret' });
  const loginResponse = await request(firstApp).post('/api/auth/login')
    .send({ email: 'admin@burgerflow.local', password: DEMO_PASSWORD }).expect(200);
  const cookie = loginResponse.headers['set-cookie'][0].split(';')[0];
  firstDb.prepare('UPDATE inventory SET quantity = 17 WHERE product_id = 1').run();
  firstDb.close();
  restartedDb = initializeDatabase(openDatabase(filename), DEMO_PASSWORD);
  assert.equal(restartedDb.prepare('SELECT quantity FROM inventory WHERE product_id = 1').get().quantity, 17);
  assert.ok(restartedDb.prepare('SELECT id FROM products WHERE id = 1').get());
  const restartedApp = createApp({ db: restartedDb, sessionSecret: 'persistent-test-secret' });
  const sessionResponse = await request(restartedApp).get('/api/auth/me').set('Cookie', cookie).expect(200);
  assert.equal(sessionResponse.body.user.role, 'admin');
});

test('inventory rendering never places user-controlled values into innerHTML', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'mockup', 'api-client.js'), 'utf8');
  assert.match(source, /cell\.textContent = text/);
  assert.doesNotMatch(source, /row\.innerHTML\s*=/);
});

test('cross-origin state-changing requests are rejected', async (t) => {
  const { db, app } = setup();
  t.after(() => db.close());
  await request(app).post('/api/auth/login')
    .set('Origin', 'https://attacker.example')
    .send({ email: 'admin@burgerflow.local', password: DEMO_PASSWORD })
    .expect(403);
});
