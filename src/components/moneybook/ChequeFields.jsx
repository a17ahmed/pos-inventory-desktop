import React from 'react';

import { inputCls as cls } from './ui';

/**
 * Cheque number + date — shown only for a cheque payment while the shop has
 * cheque tracking on. The cheque stays "pending" (no money moves) until it is
 * cleared from the Money Book.
 */
const ChequeFields = ({ number, date, onChange, className = '' }) => (
    <div className={className}>
        <div className="grid grid-cols-2 gap-3">
            <div>
                <label htmlFor="cheque-number" className="block text-body-sm font-medium text-foreground mb-1.5">Cheque number</label>
                <input id="cheque-number" type="text" maxLength={50} value={number} onChange={(e) => onChange({ number: e.target.value, date })} className={cls} />
            </div>
            <div>
                <label htmlFor="cheque-date" className="block text-body-sm font-medium text-foreground mb-1.5">Cheque date</label>
                <input id="cheque-date" type="date" value={date} onChange={(e) => onChange({ number, date: e.target.value })} className={cls} />
            </div>
        </div>
        <p className="mt-1.5 text-caption text-muted-foreground">The money leaves the bank when you mark the cheque cleared in the Money Book.</p>
    </div>
);

export default ChequeFields;
