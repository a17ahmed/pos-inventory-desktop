// Phase 0 spike — proves better-sqlite3 (the offline store) loads and works in a
// PACKAGED Electron build on the user's machine, without Node.js installed and
// without any build tools. Safe by design: every failure is caught and reported,
// it never throws, so it can never crash app startup.
//
// On boot it opens a SQLite file under userData, writes a row, reads it back, and
// records the outcome to `offline-smoke-result.json` (so you can verify on a real
// install without opening devtools) and to the console.
//
// Remove this file (and its call in main.js) once Phase 1 begins — it's a probe,
// not the real offline layer.

const path = require('path');
const fs = require('fs');

function runOfflineDbSmokeTest(app) {
    const result = {
        ok: false,
        ranAt: new Date().toISOString(),
        electron: process.versions.electron || null,
        node: process.versions.node || null,
        abi: process.versions.modules || null,
        platform: process.platform,
        arch: process.arch,
        packaged: app.isPackaged,
        dbPath: null,
        sqliteVersion: null,
        bootCount: null,
        error: null,
    };

    let db;
    try {
        // Lazy-require inside try: if the native module fails to load on some
        // machine, we capture it as a reportable error instead of a hard crash.
        const Database = require('better-sqlite3');

        const dbPath = path.join(app.getPath('userData'), 'offline-smoke.sqlite');
        result.dbPath = dbPath;

        db = new Database(dbPath);
        db.pragma('journal_mode = WAL'); // durable across crashes — same mode the real store will use

        db.exec(`CREATE TABLE IF NOT EXISTS boot_log (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            booted_at TEXT NOT NULL,
            version  TEXT
        )`);

        db.prepare('INSERT INTO boot_log (booted_at, version) VALUES (?, ?)')
          .run(new Date().toISOString(), app.getVersion());

        result.bootCount = db.prepare('SELECT COUNT(*) AS c FROM boot_log').get().c;
        result.sqliteVersion = db.prepare('SELECT sqlite_version() AS v').get().v;
        result.ok = true;
    } catch (err) {
        result.error = (err && err.message) ? err.message : String(err);
    } finally {
        try { if (db) db.close(); } catch (_) { /* ignore */ }
    }

    // Persist the outcome so it can be checked on a packaged install without devtools.
    try {
        fs.writeFileSync(
            path.join(app.getPath('userData'), 'offline-smoke-result.json'),
            JSON.stringify(result, null, 2)
        );
    } catch (_) { /* non-fatal */ }

    if (result.ok) {
        console.log(
            `[offline-db smoke test] OK — better-sqlite3 works.` +
            ` sqlite ${result.sqliteVersion}, boots=${result.bootCount},` +
            ` ${result.platform}/${result.arch}, packaged=${result.packaged}\n` +
            `  db: ${result.dbPath}`
        );
    } else {
        console.error(`[offline-db smoke test] FAILED — ${result.error}`);
    }

    return result;
}

module.exports = { runOfflineDbSmokeTest };
