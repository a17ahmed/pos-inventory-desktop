import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '../components/ui/PageHeader';
import {
    FiRefreshCw, FiPrinter, FiPlus, FiMinus, FiRepeat, FiSliders,
} from 'react-icons/fi';
import { useAuth } from '../context/AuthContext';
import { useBusiness } from '../context/BusinessContext';
import { useMoneyBook } from '../context/MoneyBookContext';
import { getCheques, reverseTransfer } from '../services/api/moneyBook';
import { appAlert, appConfirm } from '../components/AppDialog';
import { ACCOUNT_TYPES, ACCOUNT_TYPE_LABELS, apiErrorMessage, formatMoney } from '../utils/moneyBook';
import EntriesTable from '../components/moneybook/EntriesTable';
import { Alert, Button, IconButton, Tabs, KpiStrip, KpiCard } from '../components/ui';
import MoneyActionModal from '../components/moneybook/MoneyActionModal';
import TransfersPanel from '../components/moneybook/TransfersPanel';
import ChequesPanel from '../components/moneybook/ChequesPanel';
import AccountSettings from '../components/moneybook/AccountSettings';


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
        ...(chequesAvailable ? [{ id: 'cheques', label: 'Cheques', count: pendingCheques || undefined }] : []),
        ...(isAdmin ? [{ id: 'accounts', label: 'Accounts' }] : []),
    ];

    const presetAccount = selectedAccount ? String(selectedAccount._id) : undefined;

    return (
        <div className="h-full flex flex-col overflow-auto print:overflow-visible">
            <div className="flex-1 p-6 max-w-7xl mx-auto w-full">
                {/* Header */}
                <PageHeader
                    title={<>Money Book</>}
                    subtitle={<>Cash, bank and wallet money in one place
                            {settings?.enabledAt ? ` · bank / online tracking since ${new Date(settings.enabledAt).toLocaleDateString()}` : ''}</>}
                    actions={
                        <>
                            <IconButton label="Refresh" onClick={refreshAll}>
                                <FiRefreshCw className={refreshing ? 'animate-spin' : ''} />
                            </IconButton>
                            <IconButton label="Print" onClick={handlePrint}>
                                <FiPrinter />
                            </IconButton>
                        </>
                    }
                />

                {/* Go-live banner */}
                {showGoLive && (
                    <Alert
                        tone="warning"
                        title="Enter your bank / online opening balance from today's statement"
                        className="mb-6 print:hidden"
                        action={
                            <Button variant="warning" onClick={() => setModal({ kind: 'opening', accountId: String(bankOnline._id) })}>
                                Enter opening balance
                            </Button>
                        }
                    >
                        Until then {bankOnline.name} starts at {fmt(0)}, so payments out of it will be refused.
                    </Alert>
                )}

                {/* Money at a glance — click an account to see its entries */}
                <KpiStrip cols={4} className="mb-6 print:grid-cols-4 print:gap-2">
                    <KpiCard
                        label="Total money"
                        size="sm"
                        value={fmt(totals?.total)}
                        tone={(totals?.total || 0) < 0 ? 'destructive' : undefined}
                        onClick={tab !== 'all' ? () => setTab('all') : undefined}
                        ariaLabel="Total money — show all accounts"
                        className={tab === 'all' ? 'outline outline-2 -outline-offset-1 outline-primary' : undefined}
                    >
                        <div className="mt-2 space-y-0.5">
                            {ACCOUNT_TYPES.filter((t) => activeAccounts.some((a) => a.type === t)).map((t) => (
                                <div key={t} className="flex justify-between text-body-sm text-muted-foreground">
                                    <span>{ACCOUNT_TYPE_LABELS[t]}</span>
                                    <span className={`tabular-nums ${(totals?.byType?.[t] || 0) < 0 ? 'text-destructive' : ''}`}>{fmt(totals?.byType?.[t])}</span>
                                </div>
                            ))}
                        </div>
                    </KpiCard>
                    {activeAccounts.map((a) => {
                        const active = tab === String(a._id);
                        return (
                            <KpiCard
                                key={a._id}
                                size="sm"
                                label={`${a.name}${a.details?.accountTail ? ` ••${a.details.accountTail}` : ''}`}
                                value={fmt(a.balance)}
                                tone={a.balance < 0 ? 'destructive' : undefined}
                                onClick={() => setTab(String(a._id))}
                                ariaLabel={`${a.name}: ${fmt(a.balance)} — show its entries`}
                                className={active ? 'outline outline-2 -outline-offset-1 outline-primary' : undefined}
                                note={
                                    <span className="tabular-nums">
                                        <span className="text-success">+{fmt(a.today?.totalIn)}</span>
                                        {' · '}
                                        <span className="text-destructive">−{fmt(a.today?.totalOut)}</span> today
                                    </span>
                                }
                            >
                                {a.pendingCheques?.count > 0 && (
                                    <span className="inline-block mt-2 text-caption px-2 py-0.5 rounded-md bg-warning-chip text-warning-chip-foreground">
                                        {a.pendingCheques.count} pending cheque{a.pendingCheques.count > 1 ? 's' : ''} · {fmt(a.pendingCheques.amount)}
                                    </span>
                                )}
                            </KpiCard>
                        );
                    })}
                </KpiStrip>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 mb-6 print:hidden">
                    {canManage && (
                        <>
                            <Button onClick={() => setModal({ kind: 'deposit', accountId: presetAccount })} variant="primary">
                                <FiPlus aria-hidden="true" /> Deposit
                            </Button>
                            <Button onClick={() => setModal({ kind: 'withdraw', accountId: presetAccount })} variant="outline">
                                <FiMinus aria-hidden="true" /> Withdraw
                            </Button>
                        </>
                    )}
                    {canTransfer && activeAccounts.length > 1 && (
                        <Button onClick={() => setModal({ kind: 'transfer', accountId: presetAccount })} variant="outline">
                            <FiRepeat aria-hidden="true" /> Transfer
                        </Button>
                    )}
                    {isAdmin && (
                        <Button onClick={() => setModal({ kind: 'adjustment', accountId: presetAccount })} variant="outline">
                            <FiSliders aria-hidden="true" /> Adjustment
                        </Button>
                    )}
                    {canManage && selectedAccount && (Number(selectedAccount.openingBalance) || 0) === 0 && (
                        <Button onClick={() => setModal({ kind: 'opening', accountId: String(selectedAccount._id) })} variant="outline">
                            Set opening balance
                        </Button>
                    )}
                </div>

                {/* Tabs */}
                <Tabs
                    className="mb-4"
                    label="Money Book sections"
                    value={tab}
                    onChange={setTab}
                    items={tabs.map((t) => ({ value: t.id, label: t.label, count: t.count }))}
                />

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
