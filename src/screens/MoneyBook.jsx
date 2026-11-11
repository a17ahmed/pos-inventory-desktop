import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    FiRefreshCw, FiPrinter, FiPlus, FiMinus, FiRepeat, FiSliders, FiAlertTriangle, FiBriefcase,
    FiInbox, FiCreditCard, FiSmartphone, FiDollarSign,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useMoneyBook } from '../context/MoneyBookContext';
import { getCheques, reverseTransfer } from '../services/api/moneyBook';
import { appAlert, appConfirm } from '../components/AppDialog';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, apiErrorMessage, formatMoney } from '../utils/moneyBook';
import EntriesTable from '../components/moneybook/EntriesTable';
import MoneyActionModal from '../components/moneybook/MoneyActionModal';
import TransfersPanel from '../components/moneybook/TransfersPanel';
import ChequesPanel from '../components/moneybook/ChequesPanel';
import AccountSettings from '../components/moneybook/AccountSettings';

const TYPE_ICONS = { cash: FiInbox, bank: FiBriefcase, wallet: FiSmartphone, card_machine: FiCreditCard };

/**
 * Money Book — every money account of the shop (cash drawer, bank, wallets…).
 * Shown on /cashbook only when the shop has it switched on (see App.jsx);
 * otherwise the old CashBook screen renders unchanged.
 */
const MoneyBook = () => {
    const { isAdmin, permissions } = useAuth();
    const { business } = useBusiness();
    const { activeAccounts, totals, settings, chequeTracking, refreshAccounts, handleMoneyError } = useMoneyBook();
    const currency = business?.currency || 'Rs.';
    const fmt = useCallback((v) => formatMoney(v, currency), [currency]);

    const can = (action) => isAdmin || permissions?.cashbook?.[action] === true;
    const canManage = can('manage');
    const canTransfer = can('transfer');

    const [tab, setTab] = useState('all'); // all | <accountId> | transfers | cheques | accounts
    const [modal, setModal] = useState(null); // { kind, accountId? }
    const [reloadKey, setReloadKey] = useState(0);
    const [chequesAvailable, setChequesAvailable] = useState(chequeTracking);
    const [refreshing, setRefreshing] = useState(false);

    const refreshAll = useCallback(async () => {
        setRefreshing(true);
        await refreshAccounts({ force: true });
        setReloadKey((k) => k + 1);
        setRefreshing(false);
    }, [refreshAccounts]);

    useEffect(() => {
        refreshAccounts({ force: true });
    }, [refreshAccounts]);

    // Cheques tab: when tracking is on, or old cheques still exist after it was turned off
    useEffect(() => {
        if (chequeTracking) {
            setChequesAvailable(true);
            return;
        }
        let alive = true;
        getCheques({ limit: 1 })
            .then((res) => alive && setChequesAvailable((res.data?.pagination?.total || 0) > 0))
            .catch(() => alive && setChequesAvailable(false));
        return () => { alive = false; };
    }, [chequeTracking]);

    // A tab for an account that got archived → back to All
    useEffect(() => {
        const fixed = ['all', 'transfers', 'cheques', 'accounts'];
        if (!fixed.includes(tab) && !activeAccounts.some((a) => String(a._id) === tab)) setTab('all');
    }, [tab, activeAccounts]);

    const bankOnline = activeAccounts.find((a) => a.systemKey === 'bank_online');
    const showGoLive = bankOnline && (Number(bankOnline.openingBalance) || 0) === 0 && canManage;
    const pendingCheques = useMemo(() => activeAccounts.reduce((s, a) => s + (a.pendingCheques?.count || 0), 0), [activeAccounts]);

    const onDone = () => {
        setModal(null);
        refreshAll();
    };

    const reverse = async (transferId, label) => {
        const ok = await appConfirm(
            `Reverse ${label}? The same amount goes back the other way (any fee stays spent).`,
            { title: 'Reverse transfer', confirmText: 'Reverse' }
        );
        if (!ok) return;
        try {
            await reverseTransfer(transferId);
            refreshAll();
        } catch (err) {
            handleMoneyError(err);
            appAlert(apiErrorMessage(err, 'Failed to reverse the transfer'), { title: "Couldn't reverse" });
        }
    };

    const handlePrint = () => {
        const html = document.documentElement;
        const wasDark = html.classList.contains('dark');
        if (wasDark) html.classList.remove('dark');
        setTimeout(() => {
            window.print();
            if (wasDark) html.classList.add('dark');
        }, 100);
    };

    const selectedAccount = activeAccounts.find((a) => String(a._id) === tab);
    const tabs = [
        { id: 'all', label: 'All' },
        ...activeAccounts.map((a) => ({ id: String(a._id), label: a.name })),
        { id: 'transfers', label: 'Transfers' },
        ...(chequesAvailable ? [{ id: 'cheques', label: `Cheques${pendingCheques ? ` (${pendingCheques})` : ''}` }] : []),
        ...(isAdmin ? [{ id: 'accounts', label: 'Accounts' }] : []),
    ];

    const actionBtn = 'flex items-center gap-2 px-4 py-2.5 text-white rounded-xl transition-colors text-sm font-medium';
    const presetAccount = selectedAccount ? String(selectedAccount._id) : undefined;

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-d-bg overflow-auto print:overflow-visible">
            <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
                {/* Header */}
                <div className="flex items-center justify-between mb-6 print:mb-2">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-d-heading">Money Book</h1>
                        <p className="text-slate-500 dark:text-d-muted">
                            Cash, bank and wallet money in one place
                            {settings?.enabledAt ? ` · bank / online tracking since ${new Date(settings.enabledAt).toLocaleDateString()}` : ''}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 print:hidden">
                        <button onClick={refreshAll} title="Refresh" className="flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl">
                            <FiRefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                        </button>
                        <button onClick={handlePrint} title="Print" className="flex items-center gap-2 px-3 py-2 text-slate-500 dark:text-d-muted hover:bg-slate-100 dark:hover:bg-d-glass rounded-xl">
                            <FiPrinter size={16} />
                        </button>
                    </div>
                </div>

                {/* Go-live banner */}
                {showGoLive && (
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-6 p-4 rounded-2xl border border-amber-200 dark:border-[rgba(255,210,100,0.25)] bg-amber-50 dark:bg-[rgba(255,210,100,0.06)] print:hidden">
                        <div className="flex items-center gap-3">
                            <FiAlertTriangle className="text-amber-600 dark:text-d-accent flex-shrink-0" size={20} />
                            <div>
                                <p className="font-semibold text-amber-800 dark:text-d-accent">Enter your bank / online opening balance from today's statement</p>
                                <p className="text-sm text-amber-700/80 dark:text-d-muted">
                                    Until then {bankOnline.name} starts at {fmt(0)}, so payments out of it will be refused.
                                </p>
                            </div>
                        </div>
                        <button onClick={() => setModal({ kind: 'opening', accountId: String(bankOnline._id) })} className={`${actionBtn} bg-amber-500 hover:bg-amber-600`}>
                            Enter opening balance
                        </button>
                    </div>
                )}

                {/* Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 print:grid-cols-4 print:gap-2">
                    <div className="bg-white dark:bg-d-card border border-slate-200 dark:border-d-border rounded-2xl p-5">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 bg-[rgba(91,156,246,0.12)] rounded-xl flex items-center justify-center">
                                <FiDollarSign className="text-d-blue" size={20} />
                            </div>
                            <span className="text-slate-500 dark:text-d-muted text-sm">Total money</span>
                        </div>
                        <p className={`text-2xl font-bold font-display ${(totals?.total || 0) < 0 ? 'text-d-red' : 'text-slate-800 dark:text-d-heading'}`}>{fmt(totals?.total)}</p>
                        <div className="mt-2 space-y-0.5">
                            {ACCOUNT_TYPES.filter((t) => activeAccounts.some((a) => a.type === t)).map((t) => (
                                <div key={t} className="flex justify-between text-xs text-slate-500 dark:text-d-muted">
                                    <span>{ACCOUNT_TYPE_LABELS[t]}</span>
                                    <span className={(totals?.byType?.[t] || 0) < 0 ? 'text-d-red' : ''}>{fmt(totals?.byType?.[t])}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    {activeAccounts.map((a) => {
                        const Icon = TYPE_ICONS[a.type] || FiDollarSign;
                        const active = tab === String(a._id);
                        return (
                            <button
                                key={a._id}
                                onClick={() => setTab(String(a._id))}
                                className={`text-left bg-white dark:bg-d-card border rounded-2xl p-5 transition-all ${active ? 'border-amber-400 dark:border-d-accent' : 'border-slate-200 dark:border-d-border hover:border-slate-300 dark:hover:border-d-border-hover'}`}
                            >
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-[rgba(52,232,161,0.12)] rounded-xl flex items-center justify-center">
                                        <Icon className="text-d-green" size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-slate-700 dark:text-d-text text-sm font-semibold truncate">{a.name}</p>
                                        <p className="text-[11px] text-slate-400 dark:text-d-faint">
                                            {ACCOUNT_TYPE_LABELS[a.type]}{a.details?.accountTail ? ` ••${a.details.accountTail}` : ''}
                                        </p>
                                    </div>
                                </div>
                                <p className={`text-xl font-bold font-display ${a.balance < 0 ? 'text-d-red' : 'text-slate-800 dark:text-d-heading'}`}>{fmt(a.balance)}</p>
                                <p className="text-xs mt-1">
                                    <span className="text-d-green">+{fmt(a.today?.totalIn)}</span>
                                    <span className="text-slate-400"> · </span>
                                    <span className="text-d-red">−{fmt(a.today?.totalOut)}</span>
                                    <span className="text-slate-400 dark:text-d-faint"> today</span>
                                </p>
                                {a.pendingCheques?.count > 0 && (
                                    <span className="inline-block mt-2 text-[11px] px-2 py-0.5 rounded-md bg-amber-100 dark:bg-[rgba(255,210,100,0.1)] text-amber-700 dark:text-d-accent">
                                        {a.pendingCheques.count} pending cheque{a.pendingCheques.count > 1 ? 's' : ''} · {fmt(a.pendingCheques.amount)}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 mb-6 print:hidden">
                    {canManage && (
                        <>
                            <button onClick={() => setModal({ kind: 'deposit', accountId: presetAccount })} className={`${actionBtn} bg-emerald-500 hover:bg-emerald-600`}>
                                <FiPlus size={16} /> Deposit
                            </button>
                            <button onClick={() => setModal({ kind: 'withdraw', accountId: presetAccount })} className={`${actionBtn} bg-orange-500 hover:bg-orange-600`}>
                                <FiMinus size={16} /> Withdraw
                            </button>
                        </>
                    )}
                    {canTransfer && activeAccounts.length > 1 && (
                        <button onClick={() => setModal({ kind: 'transfer', accountId: presetAccount })} className={`${actionBtn} bg-indigo-500 hover:bg-indigo-600`}>
                            <FiRepeat size={16} /> Transfer
                        </button>
                    )}
                    {isAdmin && (
                        <button onClick={() => setModal({ kind: 'adjustment', accountId: presetAccount })} className={`${actionBtn} bg-slate-500 hover:bg-slate-600`}>
                            <FiSliders size={16} /> Adjustment
                        </button>
                    )}
                    {canManage && selectedAccount && (Number(selectedAccount.openingBalance) || 0) === 0 && (
                        <button onClick={() => setModal({ kind: 'opening', accountId: String(selectedAccount._id) })} className={`${actionBtn} bg-blue-500 hover:bg-blue-600`}>
                            Set opening balance
                        </button>
                    )}
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 overflow-x-auto border-b border-slate-200 dark:border-d-border print:hidden">
                    {tabs.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => setTab(t.id)}
                            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                                tab === t.id
                                    ? 'border-amber-500 dark:border-d-accent text-amber-600 dark:text-d-accent'
                                    : 'border-transparent text-slate-500 dark:text-d-muted hover:text-slate-700 dark:hover:text-d-text'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {tab === 'transfers' ? (
                    <TransfersPanel
                        fmt={fmt}
                        reloadKey={reloadKey}
                        canTransfer={canTransfer}
                        onReverse={(t) => reverse(t.transferId, `${fmt(t.amount)} from ${t.from?.name} to ${t.to?.name}`)}
                    />
                ) : tab === 'cheques' ? (
                    <ChequesPanel fmt={fmt} reloadKey={reloadKey} canManage={canManage} onChanged={refreshAll} />
                ) : tab === 'accounts' && isAdmin ? (
                    <AccountSettings fmt={fmt} onChanged={refreshAll} />
                ) : (
                    <EntriesTable
                        key={tab}
                        account={tab === 'all' ? 'all' : tab}
                        accountName={selectedAccount?.name}
                        fmt={fmt}
                        reloadKey={reloadKey}
                        canTransfer={canTransfer}
                        onReverseTransfer={(e) => reverse(e.transferId, `this transfer (${fmt(e.amount)})`)}
                    />
                )}
            </div>

            {modal && (
                <MoneyActionModal
                    kind={modal.kind}
                    initialAccountId={modal.accountId}
                    fmt={fmt}
                    onClose={() => setModal(null)}
                    onDone={onDone}
                />
            )}
        </div>
    );
};

export default MoneyBook;
