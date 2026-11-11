import React from 'react';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { ACCOUNT_TYPE_LABELS } from '../../utils/moneyBook';

/**
 * Store Closing: one row per Money Book account — opening, in, out, expected,
 * counted / statement balance, variance. `editors` = { [accountId]: <input/> }
 * on the live preview; without it the saved counts are shown (closing detail).
 * Old closings (before the Money Book) simply don't have the rows.
 */
const AccountReconciliation = ({ rows = [], totalMoneyExpected, fmt, editors }) => {
    if (!rows.length) return null;
    const signCls = (v) => ((Number(v) || 0) < 0 ? 'text-red-600 dark:text-d-red' : '');
    return (
        <div className="bg-white dark:bg-d-card border border-slate-100 dark:border-d-border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-d-border flex items-center justify-between">
                <div>
                    <h3 className="font-semibold text-slate-800 dark:text-d-heading">Money accounts</h3>
                    <p className="text-xs text-slate-500 dark:text-d-muted">Count the drawer; check each bank / wallet statement.</p>
                </div>
                {totalMoneyExpected != null && (
                    <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-d-faint">Total money expected</p>
                        <p className={`font-bold text-slate-800 dark:text-d-heading ${signCls(totalMoneyExpected)}`}>{fmt(totalMoneyExpected)}</p>
                    </div>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 dark:bg-d-elevated text-slate-500 dark:text-d-muted text-xs">
                            <th className="text-left px-4 py-2.5 font-semibold">Account</th>
                            <th className="text-right px-4 py-2.5 font-semibold">Opening</th>
                            <th className="text-right px-4 py-2.5 font-semibold">In</th>
                            <th className="text-right px-4 py-2.5 font-semibold">Out</th>
                            <th className="text-right px-4 py-2.5 font-semibold">Expected</th>
                            <th className="text-right px-4 py-2.5 font-semibold w-40">Counted / statement</th>
                            <th className="text-right px-4 py-2.5 font-semibold">Variance</th>
                            <th className="px-4 py-2.5" />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r) => {
                            const id = String(r.account);
                            const editor = editors?.[id];
                            return (
                                <tr key={id} className="border-t border-slate-50 dark:border-d-border/50">
                                    <td className="px-4 py-3">
                                        <p className="font-medium text-slate-800 dark:text-d-heading">{r.name}</p>
                                        <p className="text-[11px] text-slate-400 dark:text-d-faint">{ACCOUNT_TYPE_LABELS[r.type] || r.type}</p>
                                    </td>
                                    <td className={`px-4 py-3 text-right ${signCls(r.opening)}`}>{fmt(r.opening)}</td>
                                    <td className="px-4 py-3 text-right text-emerald-600 dark:text-d-green">{fmt(r.periodIn)}</td>
                                    <td className="px-4 py-3 text-right text-red-600 dark:text-d-red">{fmt(r.periodOut)}</td>
                                    <td className={`px-4 py-3 text-right font-semibold text-slate-800 dark:text-d-heading ${signCls(r.expected)}`}>{fmt(r.expected)}</td>
                                    <td className="px-4 py-3 text-right">
                                        {editor || <span className="font-semibold text-slate-700 dark:text-d-text">{r.counted != null ? fmt(r.counted) : '—'}</span>}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-semibold ${
                                        r.reconciled === true ? 'text-emerald-600 dark:text-d-green' : r.reconciled === false ? 'text-red-600 dark:text-d-red' : 'text-slate-400'
                                    }`}>
                                        {r.variance != null ? `${r.variance > 0 ? '+' : ''}${fmt(r.variance)}` : '—'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {r.reconciled === true && <FiCheckCircle className="inline text-emerald-500" />}
                                        {r.reconciled === false && <FiXCircle className="inline text-red-500" />}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AccountReconciliation;
