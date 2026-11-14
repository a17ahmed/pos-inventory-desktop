import React from 'react';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { ACCOUNT_TYPE_LABELS } from '../../utils/moneyBook';
import { cn, TABLE_CARD, TABLE_HEAD_ROW, TABLE_TH, TABLE_ROW, TABLE_TD } from '../ui';

const R = 'text-right tabular-nums';

/**
 * Store Closing: one row per Money Book account — opening, in, out, expected,
 * counted / statement balance, variance. `editors` = { [accountId]: <input/> }
 * on the live preview; without it the saved counts are shown (closing detail).
 * Old closings (before the Money Book) simply don't have the rows.
 */
const AccountReconciliation = ({ rows = [], totalMoneyExpected, fmt, editors }) => {
    if (!rows.length) return null;
    const signCls = (v) => ((Number(v) || 0) < 0 ? 'text-destructive' : '');
    return (
        <section className={TABLE_CARD} aria-label="Money accounts">
            <div className="px-4 py-3 border-b border-hairline flex items-center justify-between gap-3">
                <div>
                    <h3 className="font-heading text-h4 text-foreground">Money accounts</h3>
                    <p className="text-body-sm text-muted-foreground">Count the drawer; check each bank / wallet statement.</p>
                </div>
                {totalMoneyExpected != null && (
                    <div className="text-right">
                        <p className="font-mono text-overline-lg uppercase text-muted-foreground">Total money expected</p>
                        <p className={`font-semibold tabular-nums text-foreground ${signCls(totalMoneyExpected)}`}>{fmt(totalMoneyExpected)}</p>
                    </div>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className={TABLE_HEAD_ROW}>
                            <th className={TABLE_TH}>Account</th>
                            <th className={cn(TABLE_TH, 'text-right')}>Opening</th>
                            <th className={cn(TABLE_TH, 'text-right')}>In</th>
                            <th className={cn(TABLE_TH, 'text-right')}>Out</th>
                            <th className={cn(TABLE_TH, 'text-right')}>Expected</th>
                            <th className={cn(TABLE_TH, 'text-right w-40')}>Counted / statement</th>
                            <th className={cn(TABLE_TH, 'text-right')}>Variance</th>
                            <th className={TABLE_TH}><span className="sr-only">Reconciled</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const id = String(r.account);
                            const editor = editors?.[id];
                            return (
                                <tr key={id} className={TABLE_ROW}>
                                    <td className={cn(TABLE_TD, 'py-2')}>
                                        <p className="font-medium">{r.name}</p>
                                        <p className="text-body-sm text-muted-foreground">{ACCOUNT_TYPE_LABELS[r.type] || r.type}</p>
                                    </td>
                                    <td className={cn(TABLE_TD, R, signCls(r.opening))}>{fmt(r.opening)}</td>
                                    <td className={cn(TABLE_TD, R, 'text-success')}>{fmt(r.periodIn)}</td>
                                    <td className={cn(TABLE_TD, R, 'text-destructive')}>{fmt(r.periodOut)}</td>
                                    <td className={cn(TABLE_TD, R, 'font-semibold', signCls(r.expected))}>{fmt(r.expected)}</td>
                                    <td className={cn(TABLE_TD, R)}>
                                        {editor || <span className="font-semibold">{r.counted != null ? fmt(r.counted) : '—'}</span>}
                                    </td>
                                    <td className={cn(TABLE_TD, R, 'font-semibold', r.reconciled === true ? 'text-success' : r.reconciled === false ? 'text-destructive' : 'text-muted-foreground')}>
                                        {r.variance != null ? `${r.variance > 0 ? '+' : ''}${fmt(r.variance)}` : '—'}
                                    </td>
                                    <td className={cn(TABLE_TD, R)}>
                                        {r.reconciled === true && <FiCheckCircle className="inline text-success" aria-label="Matches" />}
                                        {r.reconciled === false && <FiXCircle className="inline text-destructive" aria-label="Does not match" />}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
};

export default AccountReconciliation;
