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
const SCHEMA_VERSION = 2;

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

-- Outbox: durable queue of offline WRITES (Phase 2). Each op carries a stable
-- idempotencyKey so the server applies it exactly once, even across retries and
-- crashes. Ops are pushed in insertion order (rowid) and NEVER deleted until the
-- server confirms — a failure just leaves the row 'pending' to retry.
CREATE TABLE IF NOT EXISTS outbox (
    id             TEXT PRIMARY KEY,      -- local UUID for this operation
    type           TEXT NOT NULL,         -- 'bill' | 'payment' | 'customer_create' | 'customer_update'
    idempotencyKey TEXT NOT NULL UNIQUE,  -- exactly-once key sent to the server
    payload        TEXT NOT NULL,         -- JSON body to send
    status         TEXT NOT NULL DEFAULT 'pending', -- pending|syncing|synced|failed|quarantined
    attempts       INTEGER NOT NULL DEFAULT 0,
    lastError      TEXT,
    dependsOn      TEXT,                  -- outbox.id this op must follow (e.g. bill after customer_create)
    localRef       TEXT,                  -- temp local id this op created (for id remap)
    serverId       TEXT,                  -- server _id returned on success
    createdAt      TEXT NOT NULL,
    updatedAt      TEXT NOT NULL,
    nextAttemptAt  TEXT                   -- earliest time to retry (backoff)
);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox(status);
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

// Upsert a single customer document onto an already-open db (shared by the bulk
// sync-down and the transactional offline-write path). better-sqlite3 caches the
// prepared statement by SQL text, so re-preparing here is cheap.
function upsertCustomerRow(db, d, now) {
    db.prepare(`
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
    `).run({
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

function upsertCustomers(app, businessId, docs = []) {
    const db = getDb(app, businessId);
    const now = new Date().toISOString();
    const many = db.transaction((rows) => {
        for (const d of rows) upsertCustomerRow(db, d, now);
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

// ─── outbox + transactional offline writes ──────────────────────────────────

// Optimistic local mutations — update BOTH the typed column and the `raw` JSON so
// reads (which return `raw`) reflect the change immediately. Called inside a txn.
function decrementProductStock(db, productId, qty) {
    const row = db.prepare('SELECT raw FROM products WHERE id = ?').get(String(productId));
    if (!row) return;
    const doc = JSON.parse(row.raw);
    doc.stockQuantity = (Number(doc.stockQuantity) || 0) - (Number(qty) || 0);
    db.prepare('UPDATE products SET stockQuantity = ?, raw = ? WHERE id = ?')
      .run(doc.stockQuantity, JSON.stringify(doc), String(productId));
}

function adjustCustomerBalance(db, customerId, delta) {
    const row = db.prepare('SELECT raw FROM customers WHERE id = ?').get(String(customerId));
    if (!row) return;
    const doc = JSON.parse(row.raw);
    doc.balance = (Number(doc.balance) || 0) + (Number(delta) || 0);
    db.prepare('UPDATE customers SET balance = ?, raw = ? WHERE id = ?')
      .run(doc.balance, JSON.stringify(doc), String(customerId));
}

function insertOp(db, op) {
    const now = new Date().toISOString();
    db.prepare(`
        INSERT INTO outbox (id, type, idempotencyKey, payload, status, attempts, dependsOn, localRef, createdAt, updatedAt)
        VALUES (@id, @type, @idempotencyKey, @payload, 'pending', 0, @dependsOn, @localRef, @createdAt, @updatedAt)
    `).run({
        id: op.id,
        type: op.type,
        idempotencyKey: op.idempotencyKey,
        payload: JSON.stringify(op.payload),
        dependsOn: op.dependsOn || null,
        localRef: op.localRef || null,
        createdAt: now,
        updatedAt: now,
    });
}

// Offline SALE: atomically decrement local stock, bump customer balance for the
// credit portion, and enqueue the bill — all-or-nothing so we can never end up
// with a local change that has no outbox entry (or vice-versa).
function applyOfflineBill(app, businessId, { op, items = [], customerId = null, creditDelta = 0 }) {
    const db = getDb(app, businessId);
    db.transaction(() => {
        for (const it of items) decrementProductStock(db, it.productId, it.qty);
        if (customerId && creditDelta) adjustCustomerBalance(db, customerId, creditDelta);
        insertOp(db, op);
    })();
    return { ok: true, opId: op.id };
}

// Offline PAYMENT collection: reduce the customer's balance and enqueue the op.
function applyOfflinePayment(app, businessId, { op, customerId, amount }) {
    const db = getDb(app, businessId);
    db.transaction(() => {
        if (customerId && amount) adjustCustomerBalance(db, customerId, -Math.abs(Number(amount) || 0));
        insertOp(db, op);
    })();
    return { ok: true, opId: op.id };
}

// Offline CUSTOMER create/update: upsert the local row (so it shows at once) and
// enqueue the op, in one transaction.
function applyOfflineCustomer(app, businessId, { op, customer }) {
    const db = getDb(app, businessId);
    db.transaction(() => {
        upsertCustomerRow(db, customer, new Date().toISOString());
        insertOp(db, op);
    })();
    return { ok: true, opId: op.id };
}

// Ops ready to push, in insertion order.
function getPendingOps(app, businessId) {
    const db = getDb(app, businessId);
    const nowIso = new Date().toISOString();
    return db.prepare(`
        SELECT id, type, idempotencyKey, payload, status, attempts, lastError, dependsOn, localRef, serverId
        FROM outbox
        WHERE status IN ('pending','failed')
          AND (nextAttemptAt IS NULL OR nextAttemptAt <= ?)
        ORDER BY rowid ASC
    `).all(nowIso).map((r) => ({ ...r, payload: JSON.parse(r.payload) }));
}

function markOp(app, businessId, id, patch) {
    const db = getDb(app, businessId);
    const cur = db.prepare('SELECT attempts FROM outbox WHERE id = ?').get(id);
    db.prepare(`
        UPDATE outbox SET
            status = COALESCE(@status, status),
            serverId = COALESCE(@serverId, serverId),
            lastError = @lastError,
            attempts = @attempts,
            nextAttemptAt = @nextAttemptAt,
            updatedAt = @updatedAt
        WHERE id = @id
    `).run({
        id,
        status: patch.status || null,
        serverId: patch.serverId || null,
        lastError: patch.lastError ?? null,
        attempts: patch.incrementAttempt ? (cur?.attempts || 0) + 1 : (cur?.attempts || 0),
        nextAttemptAt: patch.nextAttemptAt || null,
        updatedAt: new Date().toISOString(),
    });
}

function getOutboxStatus(app, businessId) {
    const db = getDb(app, businessId);
    const rows = db.prepare('SELECT status, COUNT(*) c FROM outbox GROUP BY status').all();
    const byStatus = {};
    for (const r of rows) byStatus[r.status] = r.c;
    const oldestPending = db.prepare(
        "SELECT createdAt FROM outbox WHERE status IN ('pending','failed') ORDER BY rowid ASC LIMIT 1"
    ).get();
    return { byStatus, oldestPendingAt: oldestPending?.createdAt || null };
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

// Clear a business's cached REFERENCE data (call on logout for privacy).
// Deliberately preserves the outbox — unsynced offline writes (real money) must
// survive logout and sync once the user is back online.
function clearBusiness(app, businessId) {
    const db = getDb(app, businessId);
    db.exec('DELETE FROM products; DELETE FROM customers; DELETE FROM sync_meta;');
}

// How many unsynced writes are still queued (guard a logout/clear if > 0).
function pendingOpCount(app, businessId) {
    const db = getDb(app, businessId);
    return db.prepare("SELECT COUNT(*) c FROM outbox WHERE status IN ('pending','failed','syncing')").get().c;
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
    // outbox / offline writes
    applyOfflineBill,
    applyOfflinePayment,
    applyOfflineCustomer,
    getPendingOps,
    markOp,
    getOutboxStatus,
    pendingOpCount,
    _internal: { dbFileFor },
};
