/**
 * A new idempotency key: a random UUID (v4, 122 random bits from the system's secure random
 * source). Used once per save attempt so the server can tell "the same sale sent again" from
 * "a new sale". Never time-based and never Math.random(), so two keys never collide — not on one
 * computer, not across shops.
 */
export function newIdempotencyKey() {
    const c = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
    if (c?.randomUUID) return c.randomUUID();
    // Fallback (very old runtimes): build a v4 UUID from secure random bytes
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
