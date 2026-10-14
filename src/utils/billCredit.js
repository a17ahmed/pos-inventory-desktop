// Store credit payments on a bill: credit from a returned bill that the backend
// applied automatically ({ method: 'store_credit', creditFrom, creditFromBillNumber }).

export const getCreditPayments = (bill) =>
    (bill?.payments || [])
        .filter((p) => p.creditFrom || p.method === 'store_credit')
        .map((p) => ({ fromBillNumber: p.creditFromBillNumber ?? '', amount: Number(p.amount) || 0 }));

// Payment method for the receipt header — the real money method, not store credit.
export const getPrimaryPaymentMethod = (bill, fallback = 'cash') => {
    const real = (bill?.payments || []).find((p) => !p.creditFrom && p.method !== 'store_credit');
    if (real) return real.method;
    return getCreditPayments(bill).length > 0 ? 'store credit' : fallback;
};

export const formatPaymentMethod = (p) =>
    p?.creditFrom || p?.method === 'store_credit'
        ? `Credit from Bill #${p.creditFromBillNumber ?? ''}`
        : p?.method || '';
