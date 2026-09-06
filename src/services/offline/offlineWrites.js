// Offline-capable write facade. Screens call these instead of the raw API.
//
// While OFFLINE_WRITES_ENABLED is false → behaves EXACTLY like the current API
// calls (zero behaviour change). When enabled → network-first; on a network
// failure the write is durably queued in the outbox (with an idempotency key)
// and replayed exactly-once by the sync engine when back online.

import { OFFLINE_WRITES_ENABLED } from './config';
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

const uuid = () =>
    (typeof crypto !== 'undefined' && crypto.randomUUID)
        ? crypto.randomUUID()
        : 'op-' + Date.now() + '-' + Math.random().toString(16).slice(2);

// A failure with no server response = network/offline (safe to queue). A response
// (4xx/5xx) means the server was reached and rejected — surface it, don't queue.
const isNetworkFailure = (err) => !err?.response;

const canQueue = () => OFFLINE_WRITES_ENABLED && !!offlineApi() && !!getBusinessId();

/**
 * Create a sale. `items` = [{productId, qty}] and `creditDelta` (unpaid amount added
 * to the customer's balance) are used for the optimistic local update when offline.
 */
export async function createBillSafe({ billPayload, items = [], customerId = null, creditDelta = 0 }) {
    if (!canQueue()) {
        return createReceipt(billPayload); // unchanged behaviour
    }
    const idempotencyKey = uuid();
    const payload = {
        ...billPayload,
        idempotencyKey,
        source: 'offline',
        clientCreatedAt: new Date().toISOString(),
    };
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw { __offline: true };
        return await createReceipt(payload);
    } catch (err) {
        if (isNetworkFailure(err) || err.__offline) {
            await offlineApi().applyBill(getBusinessId(), {
                op: { id: uuid(), type: 'bill', idempotencyKey, payload },
                items,
                customerId,
                creditDelta,
            });
            return { offline: true, idempotencyKey, data: { ...payload } };
        }
        throw err; // reachable server rejected it → real error
    }
}

/** Collect a payment from a customer (reduces their dues). */
export async function collectPaymentSafe(customerId, body = {}) {
    if (!canQueue()) {
        return collectFromCustomer(customerId, body);
    }
    const idempotencyKey = uuid();
    const payload = { ...body, idempotencyKey };
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw { __offline: true };
        return await collectFromCustomer(customerId, payload);
    } catch (err) {
        if (isNetworkFailure(err) || err.__offline) {
            await offlineApi().applyPayment(getBusinessId(), {
                op: { id: uuid(), type: 'payment', idempotencyKey, payload: { customerId, ...payload } },
                customerId,
                amount: body.amount,
            });
            return { offline: true, idempotencyKey };
        }
        throw err;
    }
}

/** Create or update a customer. Pass `id` to update; omit to create. */
export async function saveCustomerSafe({ id = null, data }) {
    if (!canQueue()) {
        return id ? updateCustomer(id, data) : createCustomer(data);
    }
    const idempotencyKey = uuid();
    try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw { __offline: true };
        return id
            ? await updateCustomer(id, { ...data, idempotencyKey })
            : await createCustomer({ ...data, idempotencyKey });
    } catch (err) {
        if (isNetworkFailure(err) || err.__offline) {
            const localId = id || `local-${idempotencyKey}`;
            const customerDoc = { _id: localId, ...data, balance: data.balance ?? 0, isActive: true, business: getBusinessId() };
            await offlineApi().applyCustomer(getBusinessId(), {
                op: {
                    id: uuid(),
                    type: id ? 'customer_update' : 'customer_create',
                    idempotencyKey,
                    payload: id ? { id, ...data, idempotencyKey } : { ...data, idempotencyKey },
                    localRef: id ? null : localId,
                },
                customer: customerDoc,
            });
            return { offline: true, idempotencyKey, localId };
        }
        throw err;
    }
}
