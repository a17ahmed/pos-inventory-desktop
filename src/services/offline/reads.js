// Local-first reads (Phase 1, Tier 1).
// Prefer the offline SQLite cache when it's available and populated — reads are
// instant and work with no internet — and fall back to the network API otherwise
// (e.g. in the browser build, or before the first sync has populated the cache).
// Returned shapes match the API so callers don't branch.

import { getProducts as apiGetProducts } from '../api/products';

const offlineApi = () =>
    (typeof window !== 'undefined' && window.electronAPI && window.electronAPI.offline) || null;

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false;

function getBusinessId() {
    try {
        const b = JSON.parse(localStorage.getItem('business') || 'null');
        return b?._id || b?.id || null;
    } catch {
        return null;
    }
}

/**
 * Load the full product catalog, local-first.
 * @returns {Promise<{ data: object[], source: 'local'|'network' }>}
 */
export async function loadProducts() {
    const api = offlineApi();
    const businessId = getBusinessId();

    if (api && businessId) {
        try {
            const r = await api.getAllProducts(businessId, { activeOnly: true });
            if (r?.ok && Array.isArray(r.data)) {
                // Use local if it has anything, or if we're offline (nothing else to try).
                if (r.data.length > 0 || isOffline()) {
                    return { data: r.data, source: 'local' };
                }
            }
        } catch {
            // fall through to network
        }
    }

    // Network fallback (browser build, or cache not populated yet while online).
    const res = await apiGetProducts();
    const data = Array.isArray(res.data) ? res.data : (res.data?.products || []);
    return { data, source: 'network' };
}

/** True when the offline cache is usable (Electron build + we know the business). */
export function offlineReady() {
    return !!(offlineApi() && getBusinessId());
}

/** All customers from the local mirror (verbatim docs). Empty array if unavailable. */
export async function loadCustomersLocal() {
    const api = offlineApi();
    const businessId = getBusinessId();
    if (!api || !businessId) return [];
    try {
        const r = await api.getAllCustomers(businessId);
        return r?.ok && Array.isArray(r.data) ? r.data : [];
    } catch {
        return [];
    }
}

/** One customer from the local mirror, or null. */
export async function findCustomerByIdLocal(id) {
    const api = offlineApi();
    const businessId = getBusinessId();
    if (!api || !businessId) return null;
    try {
        const r = await api.getCustomerById(businessId, id);
        return r?.ok ? r.data : null;
    } catch {
        return null;
    }
}

/** Business-wide customer KPIs from the local mirror (offline /customer/summary). */
export async function customerSummaryLocal() {
    const api = offlineApi();
    const businessId = getBusinessId();
    if (!api || !businessId) return null;
    try {
        const r = await api.getCustomerSummary(businessId);
        return r?.ok ? r.data : null;
    } catch {
        return null;
    }
}

/** Barcode lookup, local-first (used by the scanner hot-path). Returns a product or null. */
export async function findProductByBarcode(barcode) {
    const api = offlineApi();
    const businessId = getBusinessId();
    if (api && businessId) {
        try {
            const r = await api.getProductByBarcode(businessId, barcode);
            if (r?.ok && r.data) return r.data;
            if (r?.ok && isOffline()) return null; // definitively not in local cache while offline
        } catch {
            /* fall through */
        }
    }
    return null; // caller can fall back to its in-memory list / API if desired
}
