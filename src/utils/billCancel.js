// "Cancel bill" — for a sale created by mistake. Unlike a return, the sale is
// treated as never having happened: stock comes back, its cash is reversed and
// the customer balance is recalculated as if the bill didn't exist.
//
// These checks mirror the backend (POST /bill/:id/cancel) so the action is only
// offered when it can succeed. The backend still enforces every rule.

// Payments within this window of the bill's creation were paid at the sale;
// later ones (add payment, customer collection) block a cancel.
const SALE_PAYMENT_WINDOW_MS = 5 * 60 * 1000;

const isSameLocalDay = (a, b) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const isCancelledBill = (bill) => bill?.status === 'cancelled';

// A cancelled bill that was a held bill (cancelled from the hold flow), as
// opposed to a completed sale cancelled by mistake.
export const isCancelledHold = (bill) => isCancelledBill(bill) && !!bill?.holdAt;

/**
 * Can this user cancel this bill right now?
 * Returns { allowed: boolean, reason: string } — reason explains a "no".
 */
export const getCancelState = (bill, { isAdmin, permissions, business, online = true } = {}) => {
    const no = (reason) => ({ allowed: false, reason });
    if (!bill) return no('');
    if (!isAdmin && permissions?.pos?.cancelBill !== true) return no('You are not allowed to cancel bills');
    if (isCancelledBill(bill)) return no('This bill is already cancelled');
    if (bill.status !== 'completed' || (bill.type && bill.type !== 'sale')) {
        return no('Only completed sale bills can be cancelled');
    }
    if ((bill.returns?.length || 0) > 0 || (bill.returnStatus && bill.returnStatus !== 'none')) {
        return no('This bill has returns. Cancel the returns first, then cancel the bill.');
    }
    const createdAt = new Date(bill.createdAt);
    if (!isAdmin && !isSameLocalDay(createdAt, new Date())) {
        return no('Only an admin can cancel a bill from a previous day');
    }
    const latePayment = (bill.payments || []).some(
        (p) => p.paidAt && new Date(p.paidAt).getTime() - createdAt.getTime() > SALE_PAYMENT_WINDOW_MS
    );
    if (latePayment) return no("This bill has payments received after the sale and can't be cancelled");
    if (business?.lastClosingAt && createdAt <= new Date(business.lastClosingAt)) {
        return no("This bill is in a closed period and can't be cancelled");
    }
    if (!online) return no('Cancelling a bill needs an internet connection');
    return { allowed: true, reason: '' };
};

// Cash that a cancel takes back out of the cash book: the cash paid at the sale.
// Preview only — the success message uses the server's cashReversed.
export const estimateCashReversal = (bill) => {
    const createdAt = new Date(bill?.createdAt).getTime();
    const payments = bill?.payments || [];
    if (payments.length > 0) {
        return payments
            .filter((p) => p.method === 'cash')
            .filter((p) => !p.paidAt || new Date(p.paidAt).getTime() - createdAt <= SALE_PAYMENT_WINDOW_MS)
            .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    }
    return 0;
};
