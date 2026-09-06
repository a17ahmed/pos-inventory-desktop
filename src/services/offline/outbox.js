// Outbox sync wiring — connects the pure engine (outboxEngine.js) to the real
// HTTP API and the local store (over IPC). Drains queued offline writes when online.

import { runSyncOnce } from './outboxEngine';
import { OFFLINE_WRITES_ENABLED, OUTBOX_SYNC_INTERVAL_MS } from './config';
import { createReceipt } from '../api/receipts';
import { collectFromCustomer, createCustomer, updateCustomer } from '../api/customers';

const offlineApi = () =>
    (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.offline) || null;

function getBusinessId() {
    try {
        const b = JSON.parse(localStorage.getItem('business') || 'null');
        return b?._id || b?.id || null;
    } catch {
        return null;
    }
}

// One op → one server call. Each endpoint carries the op's idempotencyKey so the
// server applies it exactly once even if this retries.
const transport = {
    async bill(payload) {
        const res = await createReceipt(payload); // POST /bill (payload has idempotencyKey, source:'offline')
        return res.data;
    },
    async payment(payload) {
        const { customerId, ...body } = payload;
        const res = await collectFromCustomer(customerId, body);
        return res.data;
    },
    async customer_create(payload) {
        const res = await createCustomer(payload);
        return res.data;
    },
    async customer_update(payload) {
        const { id, ...body } = payload;
        const res = await updateCustomer(id, body);
        return res.data;
    },
};

const store = {
    async getPending() {
        const api = offlineApi();
        const businessId = getBusinessId();
        if (!api || !businessId) return [];
        const r = await api.getPendingOps(businessId);
        return r?.ok ? r.data : [];
    },
    async markOp(id, patch) {
        const api = offlineApi();
        const businessId = getBusinessId();
        if (!api || !businessId) return;
        await api.markOp(businessId, id, patch);
    },
};

let running = false;
let timer = null;

export async function syncOutbox() {
    if (!OFFLINE_WRITES_ENABLED) return null;
    if (running) return null;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return null;
    if (!offlineApi() || !getBusinessId()) return null;
    running = true;
    try {
        return await runSyncOnce({ getPending: store.getPending, markOp: store.markOp, transport });
    } catch (e) {
        console.error('[outbox] sync error', e);
        return null;
    } finally {
        running = false;
    }
}

export function startOutboxAutoSync() {
    if (!OFFLINE_WRITES_ENABLED) return;
    if (typeof window !== 'undefined') window.addEventListener('online', syncOutbox);
    timer = setInterval(syncOutbox, OUTBOX_SYNC_INTERVAL_MS);
    syncOutbox();
}

export function stopOutboxAutoSync() {
    if (timer) clearInterval(timer);
    timer = null;
    if (typeof window !== 'undefined') window.removeEventListener('online', syncOutbox);
}

export async function getOutboxStatus() {
    const api = offlineApi();
    const businessId = getBusinessId();
    if (!api || !businessId) return null;
    const r = await api.getOutboxStatus(businessId);
    return r?.ok ? r.data : null;
}
