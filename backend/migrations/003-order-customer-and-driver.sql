ALTER TABLE orders ADD COLUMN cliente_id INTEGER REFERENCES users(id);
ALTER TABLE orders RENAME COLUMN assigned_delivery_id TO repartidor_id;

UPDATE orders
SET cliente_id = CASE
  WHEN (SELECT role_id FROM users WHERE id = orders.created_by) = 'customer' THEN created_by
  ELSE (SELECT id FROM users WHERE email = 'cliente@burgerflow.local' COLLATE NOCASE)
END;

CREATE INDEX idx_orders_cliente_created ON orders(cliente_id, created_at);
DROP INDEX idx_orders_delivery_status;
CREATE INDEX idx_orders_repartidor_status ON orders(repartidor_id, status);

CREATE TRIGGER orders_cliente_required_insert
BEFORE INSERT ON orders
WHEN NEW.cliente_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'orders.cliente_id is required');
END;

CREATE TRIGGER orders_cliente_required_update
BEFORE UPDATE OF cliente_id ON orders
WHEN NEW.cliente_id IS NULL
BEGIN
  SELECT RAISE(ABORT, 'orders.cliente_id is required');
END;

CREATE TRIGGER orders_cliente_role_insert
BEFORE INSERT ON orders
WHEN NEW.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.cliente_id AND role_id = 'customer')
BEGIN
  SELECT RAISE(ABORT, 'orders.cliente_id must reference a customer account');
END;

CREATE TRIGGER orders_cliente_role_update
BEFORE UPDATE OF cliente_id ON orders
WHEN NEW.cliente_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.cliente_id AND role_id = 'customer')
BEGIN
  SELECT RAISE(ABORT, 'orders.cliente_id must reference a customer account');
END;

CREATE TRIGGER orders_repartidor_role_insert
BEFORE INSERT ON orders
WHEN NEW.repartidor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.repartidor_id AND role_id = 'delivery')
BEGIN
  SELECT RAISE(ABORT, 'orders.repartidor_id must reference a delivery account');
END;

CREATE TRIGGER orders_repartidor_role_update
BEFORE UPDATE OF repartidor_id ON orders
WHEN NEW.repartidor_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.repartidor_id AND role_id = 'delivery')
BEGIN
  SELECT RAISE(ABORT, 'orders.repartidor_id must reference a delivery account');
END;
