CREATE TABLE personalizations_with_price (
  id INTEGER PRIMARY KEY,
  order_item_id INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value TEXT NOT NULL,
  price_delta_cents INTEGER NOT NULL DEFAULT 0 CHECK (price_delta_cents >= 0)
);

INSERT INTO personalizations_with_price (id, order_item_id, name, value, price_delta_cents)
SELECT id, order_item_id, name, value, price_delta_cents
FROM personalizations;

DROP TABLE personalizations;
ALTER TABLE personalizations_with_price RENAME TO personalizations;
