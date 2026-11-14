// The server requests in flight, for the top loading bar (components/ui/TopLoadingBar.jsx).
// Requests made with `{ silent: true }` in their axios config (background checks) don't count.
//
// Each request is tracked by id with its address and start time, so:
// - a request can only be finished once (no drift),
// - anything open longer than STALE_MS (the API client gives up after 30 s) is dropped, so the
//   bar can never stay on forever,
// - window.__pendingRequests() shows what is open right now (for "why is the bar still on?").

const STALE_MS = 35000;
const SLOW_MS = 10000;

let seq = 0;
const open = new Map(); // id -> { url, method, start, warned }
let listeners = [];

const emit = () => listeners.forEach((l) => l(open.size));

const sweep = () => {
    const now = Date.now();
    let changed = false;
    open.forEach((r, id) => {
        if (now - r.start > STALE_MS) {
            console.warn(`[loading bar] gave up waiting for ${r.method} ${r.url} after ${Math.round((now - r.start) / 1000)} s`);
            open.delete(id);
            changed = true;
        } else if (!r.warned && now - r.start > SLOW_MS) {
            r.warned = true;
            console.warn(`[loading bar] slow request: ${r.method} ${r.url} (${Math.round((now - r.start) / 1000)} s and still open)`);
        }
    });
    if (changed) emit();
};
setInterval(sweep, 2000);

/** Returns the id to pass to requestFinished. */
export const requestStarted = ({ url = '', method = 'get' } = {}) => {
    const id = ++seq;
    open.set(id, { url, method: method.toUpperCase(), start: Date.now(), warned: false });
    emit();
    return id;
};

export const requestFinished = (id) => {
    if (open.delete(id)) emit();
};

export const subscribeLoading = (fn) => {
    listeners.push(fn);
    fn(open.size);
    return () => {
        listeners = listeners.filter((l) => l !== fn);
    };
};

if (typeof window !== 'undefined') {
    window.__pendingRequests = () =>
        [...open.values()].map((r) => ({ request: `${r.method} ${r.url}`, openFor: `${Math.round((Date.now() - r.start) / 100) / 10} s` }));
}

// Development only: this file holds live state (the open requests). A hot swap would leave the
// bar listening to an old copy while requests go to the new one — so reload the page instead.
if (import.meta.hot) import.meta.hot.decline();
