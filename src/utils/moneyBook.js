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
    opening_balance: 'bg-info-chip text-info',
    manual_deposit: 'bg-success-chip text-success',
    manual_withdrawal: 'bg-warning-chip text-warning-chip-foreground',
    sale_collection: 'bg-success-chip text-success',
    vendor_payment: 'bg-destructive-chip text-destructive',
    customer_refund: 'bg-destructive-chip text-destructive',
    sale_cancel: 'bg-muted text-foreground',
    expense: 'bg-accent text-primary',
    expense_reversal: 'bg-success-chip text-success',
    transfer_out: 'bg-accent text-primary',
    transfer_in: 'bg-accent text-primary',
    transfer_fee: 'bg-accent text-primary',
    adjustment: 'bg-warning-chip text-warning-chip-foreground',
    refund_reversal: 'bg-info-chip text-info',
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
