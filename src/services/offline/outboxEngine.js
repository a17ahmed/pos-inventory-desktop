// Pure outbox sync engine (no framework/API/window imports → unit-testable).
// The wiring in outbox.js injects a `transport` (real HTTP) and a store
// (getPending/markOp over IPC). This file only decides WHAT to do.

// Classify a push failure so we know whether to retry, drop-as-done, or quarantine.
export function classifyError(err) {
    const status = err?.response?.status;
    if (!status) return 'transient';        // no response → network/offline/timeout
    if (status === 409) return 'duplicate';  // already created (idempotent replay)
    if (status >= 500) return 'transient';   // server error → retry later
    if (status >= 400) return 'permanent';   // validation / business rejection
    return 'transient';
}

// Exponential backoff with a ceiling. attempts is the count AFTER this failure.
export function computeBackoffMs(attempts) {
    const base = 5_000; // 5s
    const ms = base * Math.pow(2, Math.max(0, attempts - 1));
    return Math.min(ms, 5 * 60_000); // cap 5 min
}

// Rewrite a temp (offline-created) customer id to its real server id once known.
export function applyRemap(op, remap) {
    const p = { ...op.payload };
    if (op.type === 'bill' && p.customer && remap.has(p.customer)) p.customer = remap.get(p.customer);
    if (op.type === 'payment' && p.customerId && remap.has(p.customerId)) p.customerId = remap.get(p.customerId);
    if (op.type === 'customer_update' && p.id && remap.has(p.id)) p.id = remap.get(p.id);
    return p;
}

const serverIdOf = (doc) =>
    doc?._id || doc?.id || doc?.bill?._id || doc?.customer?._id || doc?.data?._id || null;

/**
 * Push pending ops to the server, in order, exactly-once.
 * @param {object} deps
 *   getPending: () => Promise<op[]>   (ordered, ready-to-send)
 *   markOp: (id, patch) => Promise<void>
 *   transport: { [type]: (payload, op) => Promise<{doc}> }
 *   nowMs?: () => number   (injectable clock for tests)
 * @returns {Promise<{synced,quarantined,retried,stoppedForRetry}>}
 */
export async function runSyncOnce({ getPending, markOp, transport, nowMs = () => Date.now() }) {
    const ops = await getPending();
    const remap = new Map();
    const result = { synced: 0, quarantined: 0, retried: 0, stoppedForRetry: false };

    for (const op of ops) {
        const payload = applyRemap(op, remap);
        try {
            const res = await transport[op.type](payload, op);
            const serverId = serverIdOf(res);
            await markOp(op.id, { status: 'synced', serverId });
            if (op.type === 'customer_create' && op.localRef && serverId) remap.set(op.localRef, serverId);
            result.synced++;
        } catch (err) {
            const kind = classifyError(err);
            if (kind === 'duplicate') {
                // Already on the server (idempotent replay) → done, not a new write.
                const serverId = serverIdOf(err?.response?.data);
                await markOp(op.id, { status: 'synced', serverId });
                if (op.type === 'customer_create' && op.localRef && serverId) remap.set(op.localRef, serverId);
                result.synced++;
            } else if (kind === 'permanent') {
                // Business rejection — never auto-retry, never drop. Quarantine for manual fix.
                await markOp(op.id, {
                    status: 'quarantined',
                    lastError: err?.response?.data?.message || err?.message || 'rejected',
                    incrementAttempt: true,
                });
                result.quarantined++;
            } else {
                // Transient — back off and STOP, to preserve strict ordering (a later op
                // must not jump ahead of a stuck earlier one, esp. bill deps / cashbook order).
                const attempts = (op.attempts || 0) + 1;
                await markOp(op.id, {
                    status: 'failed',
                    lastError: err?.message || 'network',
                    incrementAttempt: true,
                    nextAttemptAt: new Date(nowMs() + computeBackoffMs(attempts)).toISOString(),
                });
                result.retried++;
                result.stoppedForRetry = true;
                break;
            }
        }
    }
    return result;
}
