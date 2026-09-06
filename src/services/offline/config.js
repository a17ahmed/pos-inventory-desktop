// Offline feature flags.
//
// OFFLINE_WRITES_ENABLED gates the offline *write* path (outbox: offline sale /
// payment / customer). Keep it OFF until the backend idempotency endpoints are
// deployed (POST /bill 200-on-replay; idempotencyKey on /customer/:id/collect and
// POST /customer). While off, writes go straight to the API exactly as today, so
// there's zero behaviour change for users.
//
// Offline READS (Tier 1) are always on and don't depend on this flag.
export const OFFLINE_WRITES_ENABLED = false;

// Auto-sync cadence for draining the outbox when online (ms).
export const OUTBOX_SYNC_INTERVAL_MS = 60_000;
