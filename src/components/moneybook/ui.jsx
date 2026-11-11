import React from 'react';
import { FiX, FiAlertCircle } from 'react-icons/fi';

// Small building blocks shared by the Money Book screens, matching the
// existing modal / input styles (CashBook.jsx, Expenses.jsx).

export const inputCls =
    'w-full px-4 py-2.5 bg-slate-50 dark:bg-d-elevated border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text focus:outline-none focus:border-d-border-hover text-sm';

export const filterCls =
    'px-3 py-2.5 bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-xl text-slate-700 dark:text-d-text text-sm focus:outline-none';

export const btnGhost =
    'flex-1 py-2.5 text-sm font-medium text-slate-600 dark:text-d-muted bg-slate-100 dark:bg-d-elevated rounded-xl hover:bg-slate-200 dark:hover:bg-d-glass transition-colors';

export const btnSolid = (color = 'emerald') => {
    const map = {
        emerald: 'bg-emerald-500 hover:bg-emerald-600',
        orange: 'bg-orange-500 hover:bg-orange-600',
        blue: 'bg-blue-500 hover:bg-blue-600',
        indigo: 'bg-indigo-500 hover:bg-indigo-600',
        amber: 'bg-amber-500 hover:bg-amber-600',
        red: 'bg-red-500 hover:bg-red-600',
    };
    return `flex-1 py-2.5 text-sm font-medium text-white rounded-xl transition-colors disabled:opacity-60 ${map[color] || map.emerald}`;
};

export const Modal = ({ title, onClose, children, wide = false }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className={`bg-white dark:bg-d-card rounded-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} border border-slate-200 dark:border-d-border shadow-2xl max-h-[90vh] overflow-y-auto`}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-d-border">
                <h2 className="text-lg font-bold text-slate-800 dark:text-d-heading">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="p-2 text-slate-400 hover:text-slate-600 dark:text-d-faint dark:hover:text-d-text rounded-lg hover:bg-slate-100 dark:hover:bg-d-glass">
                    <FiX size={18} />
                </button>
            </div>
            {children}
        </div>
    </div>
);

export const Field = ({ label, children, hint }) => (
    <div>
        <label className="block text-sm font-medium text-slate-600 dark:text-d-muted mb-1.5">{label}</label>
        {children}
        {hint && <p className="mt-1 text-[12px] text-slate-400 dark:text-d-faint">{hint}</p>}
    </div>
);

export const ErrorBox = ({ children }) =>
    children ? (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-[rgba(239,68,68,0.08)] border border-red-200 dark:border-[rgba(239,68,68,0.2)] rounded-xl">
            <FiAlertCircle className="text-red-500 dark:text-red-400 flex-shrink-0" size={14} />
            <span className="text-xs text-red-700 dark:text-red-400 font-medium whitespace-pre-line">{children}</span>
        </div>
    ) : null;

export const Spinner = () => (
    <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-primary-500 dark:border-d-accent border-t-transparent rounded-full animate-spin" />
    </div>
);

export const Pager = ({ pagination, onPage, noun = 'entries' }) =>
    pagination?.pages > 1 ? (
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-d-border">
            <p className="text-sm text-slate-500 dark:text-d-muted">
                Page {pagination.page} of {pagination.pages} ({pagination.total} {noun})
            </p>
            <div className="flex gap-2">
                {[['Previous', pagination.page - 1, pagination.page <= 1], ['Next', pagination.page + 1, pagination.page >= pagination.pages]].map(([t, p, dis]) => (
                    <button
                        key={t}
                        disabled={dis}
                        onClick={() => onPage(p)}
                        className="px-3 py-1.5 text-sm rounded-lg bg-slate-100 dark:bg-d-elevated hover:bg-slate-200 dark:hover:bg-d-glass disabled:opacity-40 transition-colors text-slate-700 dark:text-d-text"
                    >
                        {t}
                    </button>
                ))}
            </div>
        </div>
    ) : null;

/** Amount text, red with a minus sign when negative */
export const Money = ({ value, fmt, className = '' }) => (
    <span className={`${(Number(value) || 0) < 0 ? 'text-d-red' : ''} ${className}`}>{fmt(value)}</span>
);
