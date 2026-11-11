const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const SQLiteSessionStore = require('./session-store');

const MOCKUP_DIR = path.resolve(__dirname, '..', 'mockup');
const MONEY_PATTERN = /^\d{1,7}(?:\.\d{1,2})?$/;
const VALID_ROLES = new Set(['admin', 'cashier', 'kitchen', 'delivery', 'customer']);
const STATUS_TRANSITIONS = {
  pending: new Set(['preparing', 'cancelled']),
  preparing: new Set(['ready', 'cancelled']),
  ready: new Set(['out_for_delivery']),
  out_for_delivery: new Set(['delivered']),
  delivered: new Set(),
  cancelled: new Set()
};

function createApp({ db, sessionStore, testMode = false, sessionSecret = process.env.SESSION_SECRET } = {}) {
  if (!db) throw new Error('createApp requiere una conexión SQLite.');
  if (!sessionSecret && process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET es obligatorio en producción.');
  }
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: '32kb', strict: true }));
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(session({
    name: 'burgerflow.sid',
    secret: sessionSecret || crypto.randomBytes(32).toString('hex'),
    store: sessionStore || new SQLiteSessionStore(db),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 8 * 60 * 60 * 1000
    }
  }));
  if (!testMode) {
    app.use('/api/auth/login', rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-8',
      legacyHeaders: false
    }));
  }

  function rejectCrossOrigin(req, res, next) {
    const origin = req.get('origin');
    if (!origin) return next();
    try {
      const requestOrigin = `${req.protocol}://${req.get('host')}`;
      if (new URL(origin).origin !== requestOrigin) {
        return res.status(403).json({ error: 'Origen no permitido.' });
      }
    } catch {
      return res.status(403).json({ error: 'Origen no permitido.' });
    }
    return next();
  }

  app.use('/api', rejectCrossOrigin);

  const userByEmail = db.prepare(`SELECT u.id, u.name, u.email, u.password_hash, u.active, r.id AS role_id
    FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = ? COLLATE NOCASE`);
  const activeUserById = db.prepare(`SELECT id, role_id FROM users WHERE id = ? AND active = 1`);
  const permissionCheck = db.prepare(`SELECT 1 FROM role_permissions rp
    JOIN permissions p ON p.id = rp.permission_id
    WHERE rp.role_id = ? AND rp.permission_id = ?`);

  function requireAuth(req, res, next) {
    if (!req.session.user) return res.status(401).json({ error: 'Inicia sesión para continuar.' });
    const activeUser = activeUserById.get(req.session.user.id);
    if (!activeUser) {
      req.session.destroy(() => {});
      return res.status(401).json({ error: 'La cuenta está inactiva. Inicia sesión con una cuenta autorizada.' });
    }
    req.session.user.role = activeUser.role_id;
    next();
  }

  function requirePermission(permission) {
    return (req, res, next) => {
      requireAuth(req, res, (error) => {
        if (error) return next(error);
        if (res.headersSent) return;
        if (!permissionCheck.get(req.session.user.role, permission)) {
          return res.status(403).json({ error: 'No tienes permiso para esta operación.' });
        }
        next();
      });
    };
  }

  function publicUser(user) {
    return { id: user.id, name: user.name, email: user.email, role: user.role_id };
  }

  app.post('/api/auth/login', (req, res, next) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 254) : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = email && userByEmail.get(email);
    if (!user || !user.active || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos.' });
    }
    req.session.regenerate((error) => {
      if (error) return next(error);
      req.session.user = { id: user.id, role: user.role_id };
      req.session.save((saveError) => {
        if (saveError) return next(saveError);
        res.json({ user: publicUser(user) });
      });
    });
  });

  app.get('/api/auth/me', (req, res) => {
    if (!req.session.user) return res.json({ user: null });
    const user = db.prepare(`SELECT u.id, u.name, u.email, u.active, r.id AS role_id
      FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?`).get(req.session.user.id);
    if (!user || !user.active) {
      req.session.destroy(() => res.json({ user: null }));
      return;
    }
    res.json({ user: publicUser(user) });
  });

  app.post('/api/auth/logout', requireAuth, (req, res, next) => {
    req.session.destroy((error) => {
      if (error) return next(error);
      res.clearCookie('burgerflow.sid', { httpOnly: true, sameSite: 'strict' });
      res.status(204).end();
    });
  });

  function productDto(row, includeInventory = false) {
    const product = {
      id: row.id,
      name: row.name,
      category: row.category,
      description: row.description,
      priceCents: row.price_cents,
      active: Boolean(row.active)
    };
    if (includeInventory) {
      product.quantity = row.quantity;
      product.unit = row.unit;
      product.lowStockThreshold = row.low_stock_threshold;
    }
    return product;
  }

  const productQuery = `SELECT p.id, p.name, p.category, p.description, p.price_cents, p.active,
      i.quantity, i.unit, i.low_stock_threshold
    FROM products p LEFT JOIN inventory i ON i.product_id = p.id`;

  app.get('/api/products', (req, res) => {
    const rows = db.prepare(`${productQuery} WHERE p.active = 1 ORDER BY p.category, p.name`).all();
    res.json({ products: rows.map((row) => productDto(row)) });
  });

  app.post('/api/products', requirePermission('products:write'), (req, res) => {
    const input = validateProduct(req.body);
    if (input.error) return res.status(400).json({ error: input.error });
    try {
      const create = db.transaction(() => {
        const result = db.prepare(`INSERT INTO products (name, category, description, price_cents)
          VALUES (?, ?, ?, ?)`).run(input.name, input.category, input.description, input.priceCents);
        db.prepare('INSERT INTO inventory (product_id, quantity, unit) VALUES (?, ?, ?)')
          .run(result.lastInsertRowid, input.quantity, input.unit);
        return db.prepare(`${productQuery} WHERE p.id = ?`).get(result.lastInsertRowid);
      });
      res.status(201).json({ product: productDto(create(), true) });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ya existe un producto con ese nombre.' });
      throw error;
    }
  });

  app.patch('/api/products/:id', requirePermission('products:write'), (req, res) => {
    const id = positiveId(req.params.id);
    const current = id && db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Producto no encontrado.' });
    const merged = validateProduct({
      ...req.body,
      name: req.body?.name ?? current.name,
      category: req.body?.category ?? current.category,
      description: req.body?.description ?? current.description,
      priceCents: req.body?.priceCents ?? current.price_cents,
      quantity: db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(id)?.quantity ?? 0,
      unit: db.prepare('SELECT unit FROM inventory WHERE product_id = ?').get(id)?.unit ?? 'unidades'
    }, { requireQuantity: false });
    if (merged.error) return res.status(400).json({ error: merged.error });
    db.prepare(`UPDATE products SET name = ?, category = ?, description = ?, price_cents = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(merged.name, merged.category, merged.description, merged.priceCents, id);
    const updated = db.prepare(`${productQuery} WHERE p.id = ?`).get(id);
    res.json({ product: productDto(updated, true) });
  });

  app.delete('/api/products/:id', requirePermission('products:write'), (req, res) => {
    const id = positiveId(req.params.id);
    if (!id) return res.status(400).json({ error: 'Identificador inválido.' });
    const result = db.prepare('UPDATE products SET active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND active = 1').run(id);
    if (!result.changes) return res.status(404).json({ error: 'Producto no encontrado o ya desactivado.' });
    res.status(204).end();
  });

  app.get('/api/inventory', requirePermission('inventory:read'), (req, res) => {
    const rows = db.prepare(`${productQuery} WHERE p.active = 1 ORDER BY p.name`).all();
    res.json({ inventory: rows.map((row) => productDto(row, true)) });
  });

  app.patch('/api/inventory/:productId', requirePermission('inventory:write'), (req, res) => {
    const productId = positiveId(req.params.productId);
    const quantity = req.body?.quantity;
    const reason = safeString(req.body?.reason, 120);
    if (!productId || !Number.isSafeInteger(quantity) || quantity < 0 || !reason) {
      return res.status(400).json({ error: 'Cantidad entera no negativa y motivo válido son obligatorios.' });
    }
    const adjust = db.transaction(() => {
      const current = db.prepare('SELECT quantity FROM inventory WHERE product_id = ?').get(productId);
      if (!current) return null;
      const delta = quantity - current.quantity;
      db.prepare(`UPDATE inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?`)
        .run(quantity, productId);
      if (delta) db.prepare(`INSERT INTO inventory_movements (product_id, changed_by, delta, reason)
        VALUES (?, ?, ?, ?)`).run(productId, req.session.user.id, delta, reason);
      return db.prepare(`${productQuery} WHERE p.id = ?`).get(productId);
    });
    const row = adjust();
    if (!row) return res.status(404).json({ error: 'Producto no encontrado.' });
    res.json({ product: productDto(row, true) });
  });

  function itemDetails(orderId) {
    const items = db.prepare(`SELECT id, product_id, product_name, quantity, unit_price_cents, line_total_cents
      FROM order_items WHERE order_id = ? ORDER BY id`).all(orderId);
    return items.map((item) => ({
      id: item.id,
      productId: item.product_id,
      name: item.product_name,
      quantity: item.quantity,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
      personalizations: db.prepare(`SELECT name, value, price_delta_cents
        FROM personalizations WHERE order_item_id = ? ORDER BY id`)
        .all(item.id).map((option) => ({
          name: option.name,
          value: option.value,
          priceDeltaCents: option.price_delta_cents
        }))
    }));
  }

  function orderDto(row, { includeDelivery = false, includePayment = false, includeAmounts = true } = {}) {
    const order = {
      id: row.id,
      code: row.code,
      type: row.order_type,
      status: row.status,
      createdAt: row.created_at,
      items: itemDetails(row.id)
    };
    if (includeAmounts) {
      order.subtotalCents = row.subtotal_cents;
      order.taxCents = row.tax_cents;
      order.serviceCents = row.service_cents;
      order.totalCents = row.total_cents;
    }
    if (includePayment) order.paymentMethod = row.payment_method;
    if (includeDelivery) {
      order.delivery = db.prepare(`SELECT customer_name AS name, phone, address
        FROM delivery_info WHERE order_id = ?`).get(row.id) || null;
    }
    return order;
  }

  const orderSelect = `SELECT id, code, created_by, cliente_id, repartidor_id, order_type, status, payment_method,
      subtotal_cents, tax_cents, service_cents, total_cents, created_at FROM orders`;

  app.get('/api/orders', requireAuth, (req, res) => {
    const user = req.session.user;
    let rows;
    if (user.role === 'admin' || user.role === 'cashier') {
      rows = db.prepare(`${orderSelect} ORDER BY created_at DESC LIMIT 100`).all();
    } else if (user.role === 'customer') {
      rows = db.prepare(`${orderSelect} WHERE cliente_id = ? ORDER BY created_at DESC LIMIT 100`).all(user.id);
    } else {
      return res.status(403).json({ error: 'No tienes permiso para consultar pedidos generales.' });
    }
    res.json({ orders: rows.map((row) => orderDto(row, {
      includeDelivery: user.role === 'admin' || user.role === 'customer',
      includePayment: user.role === 'admin' || user.role === 'cashier'
    })) });
  });

  app.get('/api/orders/kitchen', requirePermission('orders:kitchen'), (req, res) => {
    const rows = db.prepare(`${orderSelect} WHERE status IN ('pending', 'preparing', 'ready')
      ORDER BY created_at`).all();
    res.json({ orders: rows.map((row) => orderDto(row, { includeAmounts: false })) });
  });

  app.get('/api/orders/delivery', requirePermission('orders:delivery'), (req, res) => {
    const rows = req.session.user.role === 'admin'
      ? db.prepare(`${orderSelect} WHERE order_type = 'delivery' AND status IN ('ready', 'out_for_delivery')
          ORDER BY created_at`).all()
      : db.prepare(`${orderSelect} WHERE repartidor_id = ?
          AND status IN ('ready', 'out_for_delivery') ORDER BY created_at`).all(req.session.user.id);
    res.json({ orders: rows.map((row) => orderDto(row, { includeDelivery: true, includeAmounts: false })) });
  });

  app.get('/api/orders/:id', requireAuth, (req, res) => {
    const id = positiveId(req.params.id);
    const user = req.session.user;
    const order = id && db.prepare(`${orderSelect} WHERE id = ?`).get(id);
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado.' });

    if (user.role === 'delivery') {
      if (order.order_type !== 'delivery' || order.repartidor_id !== user.id) {
        return res.status(404).json({ error: 'Pedido no encontrado.' });
      }
      return res.json({ order: orderDto(order, { includeDelivery: true, includeAmounts: false }) });
    }
    if (user.role === 'admin') {
      return res.json({ order: orderDto(order, { includeDelivery: true, includePayment: true }) });
    }
    if (user.role === 'customer' && order.cliente_id === user.id) {
      return res.json({ order: orderDto(order, { includeDelivery: true }) });
    }
    if (user.role === 'cashier') {
      return res.json({ order: orderDto(order, { includePayment: true }) });
    }
    return res.status(404).json({ error: 'Pedido no encontrado.' });
  });

  app.post('/api/orders', requirePermission('orders:create'), (req, res) => {
    const { items, orderType, paymentMethod, delivery } = req.body || {};
    if (!Array.isArray(items) || items.length < 1 || items.length > 30) {
      return res.status(400).json({ error: 'El pedido debe contener entre 1 y 30 productos.' });
    }
    if (!['dine_in', 'pickup', 'delivery'].includes(orderType)) {
      return res.status(400).json({ error: 'Tipo de pedido inválido.' });
    }
    if (!['cash', 'card', 'qr'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Método de pago inválido.' });
    }
    if (orderType === 'delivery') {
      const invalidDelivery = validateDelivery(delivery);
      if (invalidDelivery) return res.status(400).json({ error: invalidDelivery });
    }
    let customerId;
    if (req.session.user.role === 'customer') {
      customerId = req.session.user.id;
    } else {
      const requestedCustomerId = req.body?.customerId === undefined
        ? null
        : positiveId(req.body.customerId);
      const customer = requestedCustomerId
        ? db.prepare(`SELECT id FROM users WHERE id = ? AND role_id = 'customer' AND active = 1`).get(requestedCustomerId)
        : db.prepare(`SELECT id FROM users WHERE email = 'cliente@burgerflow.local' COLLATE NOCASE
            AND role_id = 'customer' AND active = 1`).get();
      if (requestedCustomerId && !customer) {
        return res.status(400).json({ error: 'La cuenta de cliente indicada no es válida.' });
      }
      if (!customer) return res.status(400).json({ error: 'No hay una cuenta de cliente activa para asociar el pedido.' });
      customerId = customer.id;
    }
    const validatedItems = [];
    for (const item of items) {
      const personalizations = normalizePersonalizations(item?.personalizations);
      if (!item || !Number.isSafeInteger(item.productId) || item.productId < 1 ||
          !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 25 ||
          personalizations === null) {
        return res.status(400).json({ error: 'Producto, cantidad entera positiva o personalización inválida.' });
      }
      validatedItems.push({ ...item, personalizations });
    }

    try {
      const createOrder = db.transaction(() => {
        const requestedQuantities = new Map();
        for (const item of validatedItems) {
          requestedQuantities.set(item.productId, (requestedQuantities.get(item.productId) || 0) + item.quantity);
        }
        const products = validatedItems.map((item) => {
          const row = db.prepare(`SELECT p.id, p.name, p.price_cents, i.quantity
            FROM products p JOIN inventory i ON i.product_id = p.id
            WHERE p.id = ? AND p.active = 1`).get(item.productId);
          if (!row) throw new DomainError(400, 'Uno de los productos no está disponible.');
          const modifierCents = item.personalizations.reduce((sum, option) => sum + option.priceDeltaCents, 0);
          return {
            ...row,
            requestedQuantity: item.quantity,
            unitPriceCents: row.price_cents + modifierCents,
            personalizations: item.personalizations
          };
        });
        const productById = new Map(products.map((item) => [item.id, item]));
        for (const [productId, quantity] of requestedQuantities) {
          const item = productById.get(productId);
          if (item.quantity < quantity) throw new DomainError(409, `Inventario insuficiente para ${item.name}.`);
        }
        const subtotal = products.reduce((sum, item) => sum + item.unitPriceCents * item.requestedQuantity, 0);
        const tax = Math.round(subtotal * 0.08);
        const service = products.length ? 50 : 0;
        const total = subtotal + tax + service;
        const assignedDelivery = orderType === 'delivery'
          ? db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
              WHERE r.id = 'delivery' AND u.active = 1 ORDER BY u.id LIMIT 1`).get()?.id || null
          : null;
        const code = `BF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const result = db.prepare(`INSERT INTO orders
          (code, created_by, cliente_id, repartidor_id, order_type, status, payment_method,
           subtotal_cents, tax_cents, service_cents, total_cents)
          VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?)`)
          .run(code, req.session.user.id, customerId, assignedDelivery, orderType, paymentMethod, subtotal, tax, service, total);
        const orderId = result.lastInsertRowid;
        for (const item of products) {
          const lineTotal = item.unitPriceCents * item.requestedQuantity;
          const line = db.prepare(`INSERT INTO order_items
            (order_id, product_id, product_name, quantity, unit_price_cents, line_total_cents)
            VALUES (?, ?, ?, ?, ?, ?)`)
            .run(orderId, item.id, item.name, item.requestedQuantity, item.unitPriceCents, lineTotal);
          const insertPersonalization = db.prepare(`INSERT INTO personalizations
            (order_item_id, name, value, price_delta_cents) VALUES (?, ?, ?, ?)`);
          for (const option of item.personalizations) {
            insertPersonalization.run(line.lastInsertRowid, option.name, option.value, option.priceDeltaCents);
          }
          db.prepare(`UPDATE inventory SET quantity = quantity - ?, updated_at = CURRENT_TIMESTAMP
            WHERE product_id = ?`).run(item.requestedQuantity, item.id);
          db.prepare(`INSERT INTO inventory_movements (product_id, changed_by, delta, reason)
            VALUES (?, ?, ?, 'Reserva por pedido')`).run(item.id, req.session.user.id, -item.requestedQuantity);
        }
        if (orderType === 'delivery') {
          db.prepare(`INSERT INTO delivery_info (order_id, customer_name, phone, address)
            VALUES (?, ?, ?, ?)`).run(orderId, delivery.name.trim(), delivery.phone.trim(), delivery.address.trim());
        }
        db.prepare(`INSERT INTO order_status_history (order_id, changed_by, old_status, new_status)
          VALUES (?, ?, NULL, 'pending')`).run(orderId, req.session.user.id);
        return db.prepare(`${orderSelect} WHERE id = ?`).get(orderId);
      });
      const order = createOrder();
      res.status(201).json({ order: orderDto(order, {
        includeDelivery: req.session.user.role === 'admin' || req.session.user.role === 'customer',
        includePayment: req.session.user.role === 'admin' || req.session.user.role === 'cashier'
      }) });
    } catch (error) {
      if (error instanceof DomainError) return res.status(error.status).json({ error: error.message });
      throw error;
    }
  });

  app.patch('/api/orders/:id/delivery', requireAuth, (req, res) => {
    const id = positiveId(req.params.id);
    const user = req.session.user;
    const order = id && db.prepare(`${orderSelect} WHERE id = ?`).get(id);
    const ownsOrder = order &&
      ((user.role === 'customer' && order.cliente_id === user.id) ||
       (user.role === 'cashier' && order.created_by === user.id));
    if (!order || order.order_type !== 'delivery' || (user.role !== 'admin' && !ownsOrder)) {
      return res.status(404).json({ error: 'Pedido de delivery no encontrado.' });
    }
    if (order.status !== 'pending') {
      return res.status(409).json({ error: 'Los datos de entrega solo pueden cambiar antes de iniciar la preparación.' });
    }
    const invalidDelivery = validateDelivery(req.body);
    if (invalidDelivery) return res.status(400).json({ error: invalidDelivery });
    const result = db.prepare(`UPDATE delivery_info SET customer_name = ?, phone = ?, address = ?
      WHERE order_id = ?`).run(req.body.name.trim(), req.body.phone.trim(), req.body.address.trim(), id);
    if (!result.changes) return res.status(404).json({ error: 'Datos de entrega no encontrados.' });
    res.status(204).end();
  });

  app.patch('/api/orders/:id/status', requireAuth, (req, res) => {
    const id = positiveId(req.params.id);
    const newStatus = req.body?.status;
    const user = req.session.user;
    const row = id && db.prepare(`${orderSelect} WHERE id = ?`).get(id);
    if (!row) return res.status(404).json({ error: 'Pedido no encontrado.' });
    if (user.role === 'delivery' && row.repartidor_id !== user.id) {
      return res.status(404).json({ error: 'Pedido no encontrado.' });
    }
    const canKitchen = permissionCheck.get(user.role, 'orders:status:kitchen');
    const canDelivery = permissionCheck.get(user.role, 'orders:status:delivery');
    const canCancel = permissionCheck.get(user.role, 'orders:cancel');
    const isAdmin = user.role === 'admin';
    const allowed = STATUS_TRANSITIONS[row.status]?.has(newStatus) &&
      ((newStatus === 'cancelled' && (canCancel || isAdmin) && ['pending', 'preparing'].includes(row.status)) ||
       (newStatus === 'preparing' || newStatus === 'ready') && (canKitchen || isAdmin) ||
       (newStatus === 'out_for_delivery' || newStatus === 'delivered') && (canDelivery || isAdmin));
    if (!allowed) return res.status(403).json({ error: 'Transición de estado no permitida.' });
    const changeStatus = db.transaction(() => {
      db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(newStatus, id);
      db.prepare(`INSERT INTO order_status_history (order_id, changed_by, old_status, new_status)
        VALUES (?, ?, ?, ?)`).run(id, user.id, row.status, newStatus);
      if (newStatus === 'cancelled') {
        const items = db.prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?').all(id);
        for (const item of items) {
          db.prepare('UPDATE inventory SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE product_id = ?')
            .run(item.quantity, item.product_id);
          db.prepare(`INSERT INTO inventory_movements (product_id, changed_by, delta, reason)
            VALUES (?, ?, ?, 'Reversión por cancelación')`).run(item.product_id, user.id, item.quantity);
        }
      }
      return db.prepare(`${orderSelect} WHERE id = ?`).get(id);
    });
    res.json({ order: orderDto(changeStatus(), { includeDelivery: isAdmin, includePayment: isAdmin }) });
  });

  app.patch('/api/orders/:id/assign', requirePermission('orders:assign'), (req, res) => {
    const id = positiveId(req.params.id);
    const assigneeId = positiveId(req.body?.deliveryUserId);
    const assignee = assigneeId && db.prepare(`SELECT u.id FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND r.id = 'delivery' AND u.active = 1`).get(assigneeId);
    const order = id && db.prepare(`${orderSelect} WHERE id = ? AND order_type = 'delivery'`).get(id);
    if (!order) return res.status(404).json({ error: 'Pedido de delivery no encontrado.' });
    if (!['pending', 'preparing', 'ready'].includes(order.status)) {
      return res.status(409).json({ error: 'No se puede asignar o reasignar una entrega cerrada.' });
    }
    if (!assignee) return res.status(400).json({ error: 'Repartidor activo inválido.' });
    db.prepare('UPDATE orders SET repartidor_id = ? WHERE id = ?').run(assignee.id, id);
    res.status(204).end();
  });

  app.get('/api/dashboard', requirePermission('dashboard:read'), (req, res) => {
    const totals = db.prepare(`SELECT COUNT(*) AS order_count,
      COALESCE(SUM(CASE WHEN date(created_at) = date('now','localtime') THEN total_cents ELSE 0 END), 0) AS today_sales,
      COALESCE(SUM(CASE WHEN status IN ('pending','preparing','ready','out_for_delivery') THEN 1 ELSE 0 END), 0) AS in_progress
      FROM orders`).get();
    const lowStock = db.prepare(`SELECT COUNT(*) AS count FROM inventory i
      JOIN products p ON p.id = i.product_id WHERE p.active = 1 AND i.quantity <= i.low_stock_threshold`).get();
    res.json({ metrics: { orderCount: totals.order_count, todaySalesCents: totals.today_sales, inProgress: totals.in_progress, lowStock: lowStock.count } });
  });

  app.get('/api/users', requirePermission('users:manage'), (req, res) => {
    const users = db.prepare(`SELECT u.id, u.name, u.email, u.active, r.id AS role
      FROM users u JOIN roles r ON r.id = u.role_id ORDER BY u.id`).all()
      .map((user) => ({ ...user, active: Boolean(user.active) }));
    res.json({ users });
  });

  app.post('/api/users', requirePermission('users:manage'), (req, res) => {
    const name = safeString(req.body?.name, 100);
    const email = safeEmail(req.body?.email);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const role = req.body?.role;
    if (!name || !email || password.length < 12 || !VALID_ROLES.has(role)) {
      return res.status(400).json({ error: 'Nombre, correo, rol válido y contraseña de al menos 12 caracteres son obligatorios.' });
    }
    try {
      const result = db.prepare(`INSERT INTO users (name, email, password_hash, role_id) VALUES (?, ?, ?, ?)`)
        .run(name, email, bcrypt.hashSync(password, 12), role);
      res.status(201).json({ user: { id: result.lastInsertRowid, name, email, role, active: true } });
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'Ese correo ya está registrado.' });
      throw error;
    }
  });

  app.patch('/api/users/:id', requirePermission('users:manage'), (req, res) => {
    const id = positiveId(req.params.id);
    if (!id || (req.body?.active !== 0 && req.body?.active !== 1)) {
      return res.status(400).json({ error: 'Identificador o estado activo inválido.' });
    }
    if (id === req.session.user.id && req.body.active === 0) {
      return res.status(400).json({ error: 'No puedes desactivar tu propia sesión.' });
    }
    const result = db.prepare('UPDATE users SET active = ? WHERE id = ?').run(req.body.active, id);
    if (!result.changes) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.status(204).end();
  });

  app.use(express.static(MOCKUP_DIR, { extensions: ['html'], index: 'index.html' }));
  app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta de API no encontrada.' }));
  app.use((error, req, res, next) => {
    console.error(error);
    if (res.headersSent) return next(error);
    res.status(500).json({ error: 'Error interno del servidor.' });
  });
  return app;
}

class DomainError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function positiveId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function safeString(value, maxLength) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  return text && text.length <= maxLength ? text : '';
}

function safeEmail(value) {
  const email = safeString(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function validateProduct(body, { requireQuantity = true } = {}) {
  const name = safeString(body?.name, 100);
  const category = safeString(body?.category, 60);
  const description = typeof body?.description === 'string' ? body.description.trim().slice(0, 500) : '';
  const priceCents = body?.priceCents;
  const quantity = body?.quantity;
  const unit = safeString(body?.unit, 24);
  if (!name || !category || !Number.isSafeInteger(priceCents) || priceCents < 0 ||
      (requireQuantity && (!Number.isSafeInteger(quantity) || quantity < 0 || !unit))) {
    return { error: 'Nombre, categoría, precio válido y cantidad entera no negativa son obligatorios.' };
  }
  return { name, category, description, priceCents, quantity, unit };
}

function validateDelivery(delivery) {
  const name = safeString(delivery?.name, 100);
  const phone = safeString(delivery?.phone, 24);
  const address = safeString(delivery?.address, 240);
  if (!name || !/^[+0-9 ()-]{7,24}$/.test(phone) || !address) {
    return 'Nombre, teléfono válido y dirección son obligatorios para delivery.';
  }
  return '';
}

function normalizePersonalizations(options) {
  if (options === undefined) return [];
  if (!Array.isArray(options) || options.length > 8) return null;

  const extraPrices = new Map([
    ['Queso extra', 100],
    ['Tocino extra', 150],
    ['Huevo frito', 100],
    ['Aros de cebolla', 120]
  ]);
  const uniqueOptions = new Set();
  let hasSize = false;
  const normalized = [];

  for (const option of options) {
    let name = safeString(option?.name, 50);
    let value = safeString(option?.value, 100);
    if (!name || !value) return null;

    if (name === 'Personalización') {
      const legacyExtra = value.match(/^(Queso extra|Tocino extra|Huevo frito|Aros de cebolla)(?:\s*\+\s*Bs\s*\d+(?:\.\d{1,2})?)?$/i);
      const legacyRemoval = value.match(/^Sin\s+(Cebolla|Pickles)$/i);
      if (legacyExtra) {
        name = 'Extra';
        value = [...extraPrices.keys()].find((item) => item.toLowerCase() === legacyExtra[1].toLowerCase());
      } else if (legacyRemoval) {
        name = 'Sin';
        value = legacyRemoval[1].toLowerCase() === 'cebolla' ? 'Cebolla' : 'Pickles';
      }
    }

    let priceDeltaCents = 0;
    if (name === 'Tamaño') {
      if (hasSize || !['regular', 'grande'].includes(value)) return null;
      hasSize = true;
      if (value === 'grande') priceDeltaCents = 200;
    } else if (name === 'Extra') {
      if (!extraPrices.has(value)) return null;
      priceDeltaCents = extraPrices.get(value);
    } else if (name === 'Sin' && !['Cebolla', 'Pickles'].includes(value)) {
      return null;
    }

    const uniqueKey = `${name.toLowerCase()}:${value.toLowerCase()}`;
    if (uniqueOptions.has(uniqueKey)) return null;
    uniqueOptions.add(uniqueKey);
    normalized.push({ name, value, priceDeltaCents });
  }

  return normalized;
}

module.exports = { createApp };
