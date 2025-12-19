CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    role TEXT CHECK(role IN ('renter', 'landlord', 'chairman')) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS price_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    valid_from DATE NOT NULL,
    valid_to DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS price_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    price_list_id INTEGER NOT NULL,
    price_per_day REAL NOT NULL,
    FOREIGN KEY (price_list_id) REFERENCES price_lists(id)
);

CREATE TABLE IF NOT EXISTS plots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    renter_id INTEGER,
    price_item_id INTEGER NOT NULL,
    address TEXT NOT NULL,
    area REAL NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'available',
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (renter_id) REFERENCES users(id),
    FOREIGN KEY (price_item_id) REFERENCES price_items(id)
);

CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plot_id INTEGER NOT NULL,
    renter_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (plot_id) REFERENCES plots(id),
    FOREIGN KEY (renter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS contracts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id INTEGER NOT NULL,
    plot_id INTEGER NOT NULL,
    renter_id INTEGER NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    price_per_day REAL NOT NULL,
    status TEXT DEFAULT 'active',
    signed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (application_id) REFERENCES applications(id),
    FOREIGN KEY (plot_id) REFERENCES plots(id),
    FOREIGN KEY (renter_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    contract_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    payment_date DATE NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (contract_id) REFERENCES contracts(id)
);

INSERT OR IGNORE INTO price_lists (id, name, valid_from, valid_to) 
VALUES (1, 'Основной прейскурант', '2023-01-01', '2024-12-31');