// Shared Money Book helpers: labels, money formatting, error text.

export const ENTRY_TYPE_LABELS = {
    opening_balance: 'Opening Balance',
    manual_deposit: 'Deposit',
    manual_withdrawal: 'Withdrawal',
    sale_collection: 'Sale Collection',
    vendor_payment: 'Vendor Payment',
    customer_refund: 'Customer Refund',
    sale_cancel: 'Bill Cancelled',
    expense: 'Expense',
    expense_reversal: 'Expense reversed',
    transfer_out: 'Transfer out',
    transfer_in: 'Transfer in',
    transfer_fee: 'Transfer fee',
    adjustment: 'Adjustment',
    refund_reversal: 'Refund reversed',
};

export const ENTRY_TYPE_COLORS = {
    opening_balance: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    manual_deposit: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    manual_withdrawal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    sale_collection: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    vendor_payment: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    customer_refund: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
    sale_cancel: 'bg-slate-200 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
    expense: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    expense_reversal: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    transfer_out: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    transfer_in: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    transfer_fee: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    adjustment: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    refund_reversal: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
};

export const entryTypeLabel = (type) => ENTRY_TYPE_LABELS[type] || type;

export const ACCOUNT_TYPES = ['cash', 'bank', 'wallet', 'card_machine'];
export const ACCOUNT_TYPE_LABELS = {
    cash: 'Cash',
    bank: 'Bank',
    wallet: 'Wallet',
    card_machine: 'Card machine',
};

export const METHOD_LABELS = {
    cash: 'Cash',
    card: 'Card',
    online: 'Online',
    bank_transfer: 'Bank transfer',
    cheque: 'Cheque',
    other: 'Other',
    store_credit: 'Store credit',
};

// Methods that never move real money → never get an account
export const NON_MONEY_METHODS = ['store_credit', 'ledger_adjust', 'vendor_credit', 'credit'];

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** "Rs. 1,250" / "-Rs. 300" (negative balances can exist after a cancel or adjustment) */
export const formatMoney = (amount, currency = 'Rs.') => {
    const v = Number(amount) || 0;
    return `${v < 0 ? '-' : ''}${currency} ${Math.abs(v).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};

/** Today as YYYY-MM-DD in local time (date inputs, back-dating limits) */
export const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Local YYYY-MM-DD of a date (the server's dailySummary keys use the shop's local day) */
export const localDayKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * Readable error text from an API error: `message`, then `error` (some
 * expense handlers), then the first Joi detail when the message is the
 * generic "Validation failed".
 */
export const apiErrorMessage = (err, fallback = 'Something went wrong') => {
    const data = err?.response?.data;
    if (!data) return err?.response ? fallback : 'No answer from the server. Check the connection and try again.';
    if (data.message === 'Validation failed' && Array.isArray(data.errors) && data.errors.length) {
        return data.errors[0].message || data.message;
    }
    return data.message || data.error || fallback;
};

export const errorCode = (err) => err?.response?.data?.code || null;
export const isInsufficientBalance = (err) => errorCode(err) === 'INSUFFICIENT_BALANCE';

/** Account short label for receipts / ledgers: "Meezan Bank ••4421" */
export const accountLabel = (account) => {
    if (!account) return '';
    const tail = account.details?.accountTail;
    return tail ? `${account.name} ••${tail}` : account.name;
};
