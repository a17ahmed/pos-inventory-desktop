// Offline sync (Phase 1, pull-only) — downloads the full product catalog and
// customer list from the API and mirrors them into the local SQLite store (in the
// Electron main process, via window.electronAPI.offline) so they're available
// offline. Safe no-op in the browser / non-Electron builds.
//
// Phase 1 keeps it simple: a full pull on login. The sync_meta cursor we store
// lets a later phase switch to incremental (updatedAt-based) delta sync.

import { getProducts } from '../api/products';
import { getCustomers } from '../api/customers';

const offlineApi = () =>
    (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.offline) || null;

export const isOfflineAvailable = () => !!offlineApi();

function getBusinessId() {
    try {
        const b = JSON.parse(localStorage.getItem('business') || 'null');
        return b?._id || b?.id || null;
    } catch {
        return null;
    }
}

const maxUpdatedAt = (docs) =>
    docs.reduce((m, d) => (d?.updatedAt && d.updatedAt > m ? d.updatedAt : m), '');

// Pull every customer via the paginated endpoint (limit ≤ 100), accumulating pages.
async function pullAllCustomers() {
    const all = [];
    let page = 1;
    let totalPages = 1;
    do {
        const res = await getCustomers({ page, limit: 100 });
        const data = res.data;
        const list = Array.isArray(data?.customers)
            ? data.customers
            : (Array.isArray(data) ? data : []);
        all.push(...list);
        totalPages = data?.totalPages ?? 1;
        page += 1;
    } while (page <= totalPages && page <= 50);
    return all;
}

/**
 * Full pull of products + customers into the local store.
 * Returns a summary; never throws (per-resource errors are collected).
 */
export async function syncOffline({ onProgress } = {}) {
    const api = offlineApi();
    if (!api) return { ok: false, skipped: true, reason: 'not-electron' };
    const businessId = getBusinessId();
    if (!businessId) return { ok: false, skipped: true, reason: 'no-business' };

    const summary = { ok: false, businessId, products: 0, customers: 0, errors: [] };

    // Products — one call returns the whole catalog (server caps at 5000).
    try {
        onProgress?.({ stage: 'products' });
        const res = await getProducts();
        const products = Array.isArray(res.data) ? res.data : (res.data?.products || []);
        if (products.length) {
            const r = await api.cacheProducts(businessId, products);
            if (!r.ok) throw new Error(r.error);
            await api.setSyncMeta(businessId, 'products', {
                lastUpdatedAt: maxUpdatedAt(products),
                count: products.length,
            });
        }
        summary.products = products.length;
    } catch (e) {
        summary.errors.push('products: ' + (e?.message || e));
    }

    // Customers — paged pull.
    try {
        onProgress?.({ stage: 'customers' });
        const customers = await pullAllCustomers();
        if (customers.length) {
            const r = await api.cacheCustomers(businessId, customers);
            if (!r.ok) throw new Error(r.error);
            await api.setSyncMeta(businessId, 'customers', {
                lastUpdatedAt: maxUpdatedAt(customers),
                count: customers.length,
            });
        }
        summary.customers = customers.length;
    } catch (e) {
        summary.errors.push('customers: ' + (e?.message || e));
    }

    summary.ok = summary.errors.length === 0;
    return summary;
}

export async function getOfflineStatus() {
    const api = offlineApi();
    if (!api) return null;
    const businessId = getBusinessId();
    if (!businessId) return null;
    const r = await api.getStatus(businessId);
    return r?.ok ? r.data : null;
}

// Clear local cache (call on logout).
export async function clearOffline() {
    const api = offlineApi();
    if (!api) return;
    const businessId = getBusinessId();
    if (businessId) await api.clear(businessId);
}
