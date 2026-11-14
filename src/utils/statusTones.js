import {
    FiCheck,
    FiClock,
    FiAlertCircle,
    FiSlash,
    FiPause,
    FiCornerUpLeft,
    FiX,
    FiRepeat,
    FiArrowDownLeft,
    FiArrowUpRight,
    FiSliders,
    FiFlag,
} from 'react-icons/fi';

/**
 * Every status the app shows, in one place, so "Paid" / "Partial" / "Cancelled" look the same on
 * every screen. Use with <StatusBadge kind="payment" value={bill.paymentStatus} />.
 * Tones: neutral · accent · info · success · warning · destructive (design/03-components.md).
 * Each entry has a word (never colour alone) and usually an icon.
 */
export const STATUS = {
    // Bill.status
    bill: {
        completed: { tone: 'success', label: 'Completed', icon: FiCheck },
        hold: { tone: 'warning', label: 'On hold', icon: FiPause },
        cancelled: { tone: 'neutral', label: 'Cancelled', icon: FiSlash },
    },
    // Bill.paymentStatus and Supply.paymentStatus
    payment: {
        paid: { tone: 'success', label: 'Paid', icon: FiCheck },
        partial: { tone: 'warning', label: 'Partial', icon: FiClock },
        unpaid: { tone: 'destructive', label: 'Unpaid', icon: FiAlertCircle },
    },
    // Bill.returnStatus ("none" shows nothing)
    return: {
        partial: { tone: 'warning', label: 'Partly returned', icon: FiCornerUpLeft },
        full: { tone: 'info', label: 'Returned', icon: FiCornerUpLeft },
    },
    // Expense.status
    expense: {
        pending: { tone: 'warning', label: 'Pending', icon: FiClock },
        approved: { tone: 'success', label: 'Approved', icon: FiCheck },
        rejected: { tone: 'destructive', label: 'Rejected', icon: FiX },
    },
    // Money Book cheque status
    cheque: {
        pending: { tone: 'warning', label: 'Pending', icon: FiClock },
        cleared: { tone: 'success', label: 'Cleared', icon: FiCheck },
        cancelled: { tone: 'neutral', label: 'Cancelled', icon: FiSlash },
    },
    // Product stock level (utils/stock.js stockLevel: out / low / ok / untracked)
    stock: {
        out: { tone: 'destructive', label: 'Out of stock', icon: FiAlertCircle },
        low: { tone: 'warning', label: 'Low stock', icon: FiFlag },
        ok: { tone: 'success', label: 'In stock', icon: FiCheck },
        untracked: { tone: 'neutral', label: 'Not tracked', icon: FiSlash },
    },
    // Active / inactive records (employees, customers, accounts)
    active: {
        true: { tone: 'success', label: 'Active', icon: FiCheck },
        false: { tone: 'neutral', label: 'Inactive', icon: FiSlash },
    },
    // Money Book entry types — shown as `tag` chips in the ledger
    entry: {
        opening_balance: { tone: 'info', label: 'Opening Balance', icon: FiFlag },
        manual_deposit: { tone: 'success', label: 'Deposit', icon: FiArrowDownLeft },
        manual_withdrawal: { tone: 'warning', label: 'Withdrawal', icon: FiArrowUpRight },
        sale_collection: { tone: 'success', label: 'Sale Collection', icon: FiArrowDownLeft },
        vendor_payment: { tone: 'destructive', label: 'Vendor Payment', icon: FiArrowUpRight },
        customer_refund: { tone: 'destructive', label: 'Customer Refund', icon: FiCornerUpLeft },
        sale_cancel: { tone: 'neutral', label: 'Bill Cancelled', icon: FiSlash },
        expense: { tone: 'warning', label: 'Expense', icon: FiArrowUpRight },
        expense_reversal: { tone: 'info', label: 'Expense reversed', icon: FiCornerUpLeft },
        transfer_out: { tone: 'accent', label: 'Transfer out', icon: FiRepeat },
        transfer_in: { tone: 'accent', label: 'Transfer in', icon: FiRepeat },
        transfer_fee: { tone: 'neutral', label: 'Transfer fee', icon: FiArrowUpRight },
        adjustment: { tone: 'neutral', label: 'Adjustment', icon: FiSliders },
        refund_reversal: { tone: 'info', label: 'Refund reversed', icon: FiCornerUpLeft },
    },
};

/** { tone, label, icon } for a status, or null when there is nothing to show. */
export const getStatus = (kind, value) => {
    if (value === undefined || value === null || value === '' || value === 'none') return null;
    const hit = STATUS[kind]?.[String(value)];
    if (hit) return hit;
    // Unknown value: still show the word, never a blank
    const words = String(value).replace(/_/g, ' ');
    return { tone: 'neutral', label: words.charAt(0).toUpperCase() + words.slice(1), icon: null };
};
