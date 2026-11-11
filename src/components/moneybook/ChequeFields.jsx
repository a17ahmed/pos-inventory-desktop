import React from 'react';

const cls = 'w-full px-3 py-2 bg-white dark:bg-d-bg border border-slate-200 dark:border-d-border rounded-xl text-sm text-slate-800 dark:text-d-text focus:outline-none focus:border-amber-300 dark:focus:border-d-border-hover';

/**
 * Cheque number + date — shown only for a cheque payment while the shop has
 * cheque tracking on. The cheque stays "pending" (no money moves) until it is
 * cleared from the Money Book.
 */
const ChequeFields = ({ number, date, onChange, className = '' }) => (
    <div className={className}>
        <div className="grid grid-cols-2 gap-3">
            <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-d-muted mb-1">Cheque number</label>
                <input type="text" maxLength={50} value={number} onChange={(e) => onChange({ number: e.target.value, date })} className={cls} />
            </div>
            <div>
                <label className="block text-[12px] font-medium text-slate-500 dark:text-d-muted mb-1">Cheque date</label>
                <input type="date" value={date} onChange={(e) => onChange({ number, date: e.target.value })} className={cls} />
            </div>
        </div>
        <p className="mt-1 text-[11px] text-slate-400 dark:text-d-faint">The money leaves the bank when you mark the cheque cleared in the Money Book.</p>
    </div>
);

export default ChequeFields;
