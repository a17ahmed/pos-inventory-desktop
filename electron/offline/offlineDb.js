// ─────────────────────────────────────────────────────────────────────────────
// Offline store (Phase 1) — local SQLite mirror of the backend Product & Customer
// collections, used so the POS can read its catalog and customers with no internet.
//
// Fidelity guarantee: every row keeps the FULL original document verbatim in a
// `raw` JSON column, so the local copy is 100% identical to what the API returned.
// The typed columns are just extracted projections for fast indexed lookups
// (barcode / sku / name / phone). Read `raw` whenever you need the real object.
//
// Runs in the Electron MAIN process (better-sqlite3 is a native module). The
// renderer talks to it over IPC — see electron/main.js and preload.js.
//
// Storage: one file per business under userData → `offline-<businessId>.sqlite`,
// so multi-tenant data never mixes. WAL mode for crash durability.
// ─────────────────────────────────────────────────────────────────────────────

const path = require('path');
const Database = require('better-sqlite3');

// Schema version — bump when columns change so migrations can run.
const SCHEMA_VERSION = 1;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS products (
    id                 TEXT PRIMARY KEY,      -- Mongo _id (string)
    name               TEXT,
    description        TEXT,
    barcode            TEXT,
    sku                TEXT,
    costPrice          REAL,
    sellingPrice       REAL,
    gst                REAL,
    maxDiscountPercent REAL,                  -- nullable in source
    category           TEXT,
    stockQuantity      REAL,                  -- REAL: units can be fractional (kg/gram/ml)
    lowStockAlert      REAL,
    unit               TEXT,
    trackStock         INTEGER,               -- 0/1
    isActive           INTEGER,               -- 0/1
    business           TEXT,
    createdAt          TEXT,
    updatedAt          TEXT,
    raw                TEXT NOT NULL,         -- full original document (JSON) — source of truth
    syncedAt           TEXT NOT NULL          -- when this row was cached locally
);
CREATE INDEX IF NOT EXISTS idx_products_barcode  ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_sku       ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name      ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_active    ON products(isActive);

CREATE TABLE IF NOT EXISTS customers (
    id             TEXT PRIMARY KEY,
    name           TEXT,
    phone          TEXT,
    email          TEXT,
    address        TEXT,
    notes          TEXT,
    creditDays     REAL,
    creditLimit    REAL,
    isActive       INTEGER,
    business       TEXT,
    openingBalance REAL,
    totalBilled    REAL,
    totalPaid      REAL,
    balance        REAL,
    totalPurchases REAL,
    totalReturns   REAL,
    lastPurchase   TEXT,
    createdAt      TEXT,
    updatedAt      TEXT,
    raw            TEXT NOT NULL,
    syncedAt       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_customers_phone   ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_name    ON customers(name);
CREATE INDEX IF NOT EXISTS idx_customers_balance ON customers(balance);

-- Per-resource sync cursors (for incremental delta sync later).
CREATE TABLE IF NOT EXISTS sync_meta (
    resource       TEXT PRIMARY KEY,   -- 'products' | 'customers'
    lastUpdatedAt  TEXT,               -- high-watermark of source updatedAt seen
    lastSyncAt     TEXT,               -- when we last completed a sync
    count          INTEGER
);
`;

// ─── helpers ─────────────────────────────────────────────────────────────────
const bool = (v) => (v ? 1 : 0);
const iso = (v) => {
    if (v === null || v === undefined) return null;
    try { return new Date(v).toISOString(); } catch { return null; }
};
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));
const idOf = (doc) => String(doc._id ?? doc.id ?? '');

// One open connection per business, opened lazily and reused.
const connections = new Map();

function dbFileFor(app, businessId) {
    const safe = String(businessId || 'default').replace(/[^a-zA-Z0-9_-]/g, '');
    return path.join(app.getPath('userData'), `offline-${safe}.sqlite`);
}

function getDb(app, businessId) {
    if (!businessId) throw new Error('offlineDb: businessId is required');
    if (connections.has(businessId)) return connections.get(businessId);

    const db = new Database(dbFileFor(app, businessId));
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
    connections.set(businessId, db);
    return db;
}

// ─── writes ──────────────────────────────────────────────────────────────────
function upsertProducts(app, businessId, docs = []) {
    const db = getDb(app, businessId);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
        INSERT INTO products (
            id, name, description, barcode, sku, costPrice, sellingPrice, gst,
            maxDiscountPercent, category, stockQuantity, lowStockAlert, unit,
            trackStock, isActive, business, createdAt, updatedAt, raw, syncedAt
        ) VALUES (
            @id, @name, @description, @barcode, @sku, @costPrice, @sellingPrice, @gst,
            @maxDiscountPercent, @category, @stockQuantity, @lowStockAlert, @unit,
            @trackStock, @isActive, @business, @createdAt, @updatedAt, @raw, @syncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
            name=@name, description=@description, barcode=@barcode, sku=@sku,
            costPrice=@costPrice, sellingPrice=@sellingPrice, gst=@gst,
            maxDiscountPercent=@maxDiscountPercent, category=@category,
            stockQuantity=@stockQuantity, lowStockAlert=@lowStockAlert, unit=@unit,
            trackStock=@trackStock, isActive=@isActive, business=@business,
            createdAt=@createdAt, updatedAt=@updatedAt, raw=@raw, syncedAt=@syncedAt
    `);
    const many = db.transaction((rows) => {
        for (const d of rows) {
            stmt.run({
                id: idOf(d),
                name: d.name ?? null,
                description: d.description ?? null,
                barcode: d.barcode ?? null,
                sku: d.sku ?? null,
                costPrice: num(d.costPrice),
                sellingPrice: num(d.sellingPrice),
                gst: num(d.gst),
                maxDiscountPercent: d.maxDiscountPercent == null ? null : num(d.maxDiscountPercent),
                category: d.category ?? null,
                stockQuantity: num(d.stockQuantity),
                lowStockAlert: num(d.lowStockAlert),
                unit: d.unit ?? null,
                trackStock: bool(d.trackStock),
                isActive: bool(d.isActive),
                business: d.business ? String(d.business) : null,
                createdAt: iso(d.createdAt),
                updatedAt: iso(d.updatedAt),
                raw: JSON.stringify(d),   // ← full document, verbatim
                syncedAt: now,
            });
        }
        return rows.length;
    });
    return many(docs);
}

function upsertCustomers(app, businessId, docs = []) {
    const db = getDb(app, businessId);
    const now = new Date().toISOString();
    const stmt = db.prepare(`
        INSERT INTO customers (
            id, name, phone, email, address, notes, creditDays, creditLimit,
            isActive, business, openingBalance, totalBilled, totalPaid, balance,
            totalPurchases, totalReturns, lastPurchase, createdAt, updatedAt, raw, syncedAt
        ) VALUES (
            @id, @name, @phone, @email, @address, @notes, @creditDays, @creditLimit,
            @isActive, @business, @openingBalance, @totalBilled, @totalPaid, @balance,
            @totalPurchases, @totalReturns, @lastPurchase, @createdAt, @updatedAt, @raw, @syncedAt
        )
        ON CONFLICT(id) DO UPDATE SET
            name=@name, phone=@phone, email=@email, address=@address, notes=@notes,
            creditDays=@creditDays, creditLimit=@creditLimit, isActive=@isActive,
            business=@business, openingBalance=@openingBalance, totalBilled=@totalBilled,
            totalPaid=@totalPaid, balance=@balance, totalPurchases=@totalPurchases,
            totalReturns=@totalReturns, lastPurchase=@lastPurchase, createdAt=@createdAt,
            updatedAt=@updatedAt, raw=@raw, syncedAt=@syncedAt
    `);
    const many = db.transaction((rows) => {
        for (const d of rows) {
            stmt.run({
                id: idOf(d),
                name: d.name ?? null,
                phone: d.phone ?? null,
                email: d.email ?? null,
                address: d.address ?? null,
                notes: d.notes ?? null,
                creditDays: num(d.creditDays),
                creditLimit: num(d.creditLimit),
                isActive: bool(d.isActive),
                business: d.business ? String(d.business) : null,
                openingBalance: num(d.openingBalance),
                totalBilled: num(d.totalBilled),
                totalPaid: num(d.totalPaid),
                balance: num(d.balance),
                totalPurchases: num(d.totalPurchases),
                totalReturns: num(d.totalReturns),
                lastPurchase: iso(d.lastPurchase),
                createdAt: iso(d.createdAt),
                updatedAt: iso(d.updatedAt),
                raw: JSON.stringify(d),
                syncedAt: now,
            });
        }
        return rows.length;
    });
    return many(docs);
}

function setSyncMeta(app, businessId, resource, { lastUpdatedAt, count }) {
    const db = getDb(app, businessId);
    db.prepare(`
        INSERT INTO sync_meta (resource, lastUpdatedAt, lastSyncAt, count)
        VALUES (@resource, @lastUpdatedAt, @lastSyncAt, @count)
        ON CONFLICT(resource) DO UPDATE SET
            lastUpdatedAt=@lastUpdatedAt, lastSyncAt=@lastSyncAt, count=@count
    `).run({
        resource,
        lastUpdatedAt: lastUpdatedAt || null,
        lastSyncAt: new Date().toISOString(),
        count: count ?? null,
    });
}

// ─── reads (return the verbatim documents from `raw`) ────────────────────────
const parseRaw = (row) => (row ? JSON.parse(row.raw) : null);
const parseRawList = (rows) => rows.map((r) => JSON.parse(r.raw));

function getProductByBarcode(app, businessId, barcode) {
    const db = getDb(app, businessId);
    return parseRaw(db.prepare('SELECT raw FROM products WHERE barcode = ? LIMIT 1').get(String(barcode)));
}

function getProductBySku(app, businessId, sku) {
    const db = getDb(app, businessId);
    return parseRaw(db.prepare('SELECT raw FROM products WHERE sku = ? LIMIT 1').get(String(sku)));
}

function searchProducts(app, businessId, query, limit = 50) {
    const db = getDb(app, businessId);
    const q = `%${String(query || '').toLowerCase()}%`;
    return parseRawList(db.prepare(`
        SELECT raw FROM products
        WHERE isActive = 1 AND (
            lower(name) LIKE ? OR lower(barcode) LIKE ? OR lower(sku) LIKE ?
        )
        ORDER BY name LIMIT ?
    `).all(q, q, q, limit));
}

function getAllProducts(app, businessId, { activeOnly = true } = {}) {
    const db = getDb(app, businessId);
    const sql = activeOnly
        ? 'SELECT raw FROM products WHERE isActive = 1 ORDER BY name'
        : 'SELECT raw FROM products ORDER BY name';
    return parseRawList(db.prepare(sql).all());
}

function searchCustomers(app, businessId, query, limit = 50) {
    const db = getDb(app, businessId);
    const q = `%${String(query || '').toLowerCase()}%`;
    return parseRawList(db.prepare(`
        SELECT raw FROM customers
        WHERE lower(name) LIKE ? OR lower(phone) LIKE ?
        ORDER BY name LIMIT ?
    `).all(q, q, limit));
}

function getAllCustomers(app, businessId, limit = 5000) {
    const db = getDb(app, businessId);
    return parseRawList(db.prepare('SELECT raw FROM customers ORDER BY name LIMIT ?').all(limit));
}

function getCustomerById(app, businessId, id) {
    const db = getDb(app, businessId);
    return parseRaw(db.prepare('SELECT raw FROM customers WHERE id = ? LIMIT 1').get(String(id)));
}

// Business-wide customer KPIs computed from the local mirror — the offline
// equivalent of GET /customer/summary.
function getCustomerSummary(app, businessId) {
    const db = getDb(app, businessId);
    const row = db.prepare(`
        SELECT
            COUNT(*) AS totalCustomers,
            COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0) AS totalOutstandingDues,
            COALESCE(SUM(CASE WHEN balance > 0 THEN 1 ELSE 0 END), 0) AS customersWithDues
        FROM customers WHERE isActive = 1
    `).get();
    return {
        totalCustomers: row.totalCustomers || 0,
        totalOutstandingDues: row.totalOutstandingDues || 0,
        customersWithDues: row.customersWithDues || 0,
    };
}

function getStatus(app, businessId) {
    const db = getDb(app, businessId);
    const products = db.prepare('SELECT COUNT(*) c FROM products').get().c;
    const customers = db.prepare('SELECT COUNT(*) c FROM customers').get().c;
    const meta = db.prepare('SELECT resource, lastUpdatedAt, lastSyncAt, count FROM sync_meta').all();
    return { businessId, products, customers, meta, dbFile: dbFileFor(app, businessId) };
}

// Clear a business's cached data (call on logout for security/privacy).
function clearBusiness(app, businessId) {
    const db = getDb(app, businessId);
    db.exec('DELETE FROM products; DELETE FROM customers; DELETE FROM sync_meta;');
}

module.exports = {
    SCHEMA_VERSION,
    getDb,
    upsertProducts,
    upsertCustomers,
    setSyncMeta,
    getProductByBarcode,
    getProductBySku,
    searchProducts,
    getAllProducts,
    searchCustomers,
    getAllCustomers,
    getCustomerById,
    getCustomerSummary,
    getStatus,
    clearBusiness,
    _internal: { dbFileFor },
};
