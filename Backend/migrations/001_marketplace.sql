PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL,
 phone TEXT NOT NULL DEFAULT '', password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('ADMIN','CUSTOMER','RIDER')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 contact_consent INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
CREATE TABLE IF NOT EXISTS categories (slug TEXT PRIMARY KEY, name TEXT NOT NULL, image TEXT NOT NULL, blurb TEXT NOT NULL DEFAULT '', parent_slug TEXT REFERENCES categories(slug));
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, category_slug TEXT NOT NULL REFERENCES categories(slug),
 description TEXT NOT NULL, images TEXT NOT NULL, tags TEXT NOT NULL DEFAULT '[]', available INTEGER NOT NULL DEFAULT 1,
 featured INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS variants (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE, unit TEXT NOT NULL,
 label TEXT NOT NULL, price INTEGER NOT NULL CHECK(price > 0), original_price INTEGER,
 stock INTEGER NOT NULL CHECK(stock >= 0), low_stock INTEGER NOT NULL DEFAULT 5, active INTEGER NOT NULL DEFAULT 1,
 UNIQUE(product_id,label)
);
CREATE INDEX IF NOT EXISTS products_category ON products(category_slug);
CREATE TABLE IF NOT EXISTS recipes (
 slug TEXT PRIMARY KEY, name TEXT NOT NULL, image TEXT NOT NULL, description TEXT NOT NULL,
 prep_time TEXT NOT NULL, cooking_time TEXT NOT NULL, serves INTEGER NOT NULL, difficulty TEXT NOT NULL,
 category TEXT NOT NULL, video TEXT NOT NULL DEFAULT '', steps TEXT NOT NULL, published INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS recipe_ingredients (
 id TEXT PRIMARY KEY, recipe_slug TEXT NOT NULL REFERENCES recipes(slug) ON DELETE CASCADE,
 variant_id TEXT NOT NULL REFERENCES variants(id), qty INTEGER NOT NULL CHECK(qty > 0), note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL,
 payment_status TEXT NOT NULL DEFAULT 'pending', subtotal INTEGER NOT NULL, delivery_fee INTEGER NOT NULL,
 total INTEGER NOT NULL, address TEXT NOT NULL, phone TEXT NOT NULL, instructions TEXT NOT NULL DEFAULT '',
 latitude REAL, longitude REAL, delivery_zone TEXT NOT NULL, idempotency_key TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, reserved_until INTEGER NOT NULL,
 stock_released INTEGER NOT NULL DEFAULT 0, UNIQUE(user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id,created_at);
CREATE INDEX IF NOT EXISTS orders_status ON orders(status);
CREATE TABLE IF NOT EXISTS order_items (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), variant_id TEXT NOT NULL REFERENCES variants(id),
 product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL, image TEXT NOT NULL,
 label TEXT NOT NULL, unit TEXT NOT NULL, qty INTEGER NOT NULL, price INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);
CREATE TABLE IF NOT EXISTS payments (
 reference TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), status TEXT NOT NULL DEFAULT 'pending',
 amount INTEGER NOT NULL, authorization_url TEXT, verified_at TEXT, provider_id TEXT UNIQUE
);
CREATE TABLE IF NOT EXISTS delivery_assignments (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), rider_id TEXT NOT NULL REFERENCES users(id),
 status TEXT NOT NULL DEFAULT 'assigned', assigned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS assignments_rider ON delivery_assignments(rider_id);
CREATE TABLE IF NOT EXISTS tracking_events (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), status TEXT NOT NULL,
 actor_id TEXT REFERENCES users(id), note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS tracking_order ON tracking_events(order_id,created_at);
CREATE TABLE IF NOT EXISTS delivery_locations (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL REFERENCES orders(id), rider_id TEXT NOT NULL REFERENCES users(id),
 latitude REAL NOT NULL, longitude REAL NOT NULL, accuracy REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS locations_order ON delivery_locations(order_id,created_at);
CREATE TABLE IF NOT EXISTS delivery_evidence (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), rider_id TEXT NOT NULL REFERENCES users(id),
 image TEXT, notes TEXT NOT NULL, latitude REAL, longitude REAL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS delivery_confirmations (
 order_id TEXT NOT NULL REFERENCES orders(id), user_id TEXT NOT NULL REFERENCES users(id),
 kind TEXT NOT NULL CHECK(kind IN ('RIDER','CUSTOMER','ADMIN_RESOLUTION')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(order_id,kind)
);
CREATE TABLE IF NOT EXISTS disputes (
 id TEXT PRIMARY KEY, order_id TEXT NOT NULL UNIQUE REFERENCES orders(id), user_id TEXT NOT NULL REFERENCES users(id),
 reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', resolution TEXT, resolved_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS notifications (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), order_id TEXT REFERENCES orders(id),
 message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS notifications_user ON notifications(user_id,created_at);
CREATE TABLE IF NOT EXISTS inventory_transactions (
 id TEXT PRIMARY KEY, variant_id TEXT NOT NULL REFERENCES variants(id), order_id TEXT REFERENCES orders(id),
 actor_id TEXT REFERENCES users(id), delta INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS reviews (
 order_id TEXT PRIMARY KEY REFERENCES orders(id), user_id TEXT NOT NULL REFERENCES users(id),
 speed INTEGER NOT NULL, professionalism INTEGER NOT NULL, freshness INTEGER NOT NULL,
 quality INTEGER NOT NULL, overall INTEGER NOT NULL, comment TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS carts (user_id TEXT PRIMARY KEY REFERENCES users(id), items TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id TEXT PRIMARY KEY, actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, entity_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS uploads (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), mime TEXT NOT NULL, private INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
